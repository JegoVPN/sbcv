import "@xyflow/react/dist/style.css";
import { Background, ConnectionMode, ControlButton, Controls, MiniMap, ReactFlow, useEdgesState, useNodesState } from "@xyflow/react";
import type { Connection, Edge, NodeTypes, OnConnectEnd, OnConnectStart, ReactFlowInstance } from "@xyflow/react";
import { Hand, Map as MapIcon, MousePointer2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deriveGraph } from "../canvas/graph";
import type { SbcFlowNode } from "../canvas/graph";
import {
  endpointMatchesNode,
  portEndpointsForNode,
  portRelations,
  relationForHandles,
  type PortEndpoint,
  type PortNodeKind,
} from "../domain/portRelationRegistry";
import {
  CREATABLE_DNS_SERVER_TYPES,
  CREATABLE_ENDPOINT_TYPES,
  CREATABLE_INBOUND_TYPES,
  CREATABLE_OUTBOUND_TYPES,
  CREATABLE_RULE_SET_TYPES,
  CREATABLE_SERVICE_TYPES,
} from "../domain/protocols";
import { useProjectStore } from "../state/useProjectStore";
import { ChipPickerPopover, type ChipPickerCandidate } from "./ChipPickerPopover";
import {
  CanvasInteractionContext,
  EMPTY_COMPATIBLE_PORT_KEYS,
  createCanvasInteractionStore,
  interactionPortKey,
} from "./canvasInteractionContext";
import { SbcNode } from "./SbcNode";
import { useViewport } from "./useViewport";

const nodeTypes: NodeTypes = {
  sbc: SbcNode,
};

const connectionLineStyle = {
  stroke: "#e4e9ee",
  strokeWidth: 2.4,
};

type PendingPort = {
  nodeId: string;
  handleId: string;
  kind: PortNodeKind;
  type: string;
};

type ChipPickerState = {
  x: number;
  y: number;
  flowPosition: { x: number; y: number };
  source: PendingPort;
  candidates: ChipPickerCandidate[];
};

const candidateTypesByKind: Partial<Record<PortNodeKind, readonly string[]>> = {
  inbound: CREATABLE_INBOUND_TYPES,
  outbound: CREATABLE_OUTBOUND_TYPES,
  "dns-server": CREATABLE_DNS_SERVER_TYPES,
  endpoint: CREATABLE_ENDPOINT_TYPES,
  service: CREATABLE_SERVICE_TYPES,
  "rule-set": CREATABLE_RULE_SET_TYPES,
  route: ["route"],
  "route-rule": ["route-rule"],
  dns: ["dns"],
  "dns-rule": ["dns-rule"],
};

const typeLabels: Record<string, string> = {
  direct: "Direct",
  block: "Block",
  socks: "SOCKS",
  http: "HTTP",
  shadowsocks: "Shadowsocks",
  vmess: "VMess",
  trojan: "Trojan",
  naive: "Naive",
  hysteria: "Hysteria",
  shadowtls: "ShadowTLS",
  vless: "VLESS",
  tuic: "TUIC",
  hysteria2: "Hysteria2",
  anytls: "AnyTLS",
  tor: "Tor",
  ssh: "SSH",
  selector: "Selector",
  urltest: "URLTest",
  local: "Local DNS",
  hosts: "Hosts DNS",
  tcp: "TCP DNS",
  udp: "UDP DNS",
  tls: "TLS DNS",
  quic: "QUIC DNS",
  https: "HTTPS DNS",
  h3: "HTTP/3 DNS",
  dhcp: "DHCP DNS",
  fakeip: "FakeIP DNS",
  tailscale: "Tailscale",
  resolved: "Resolved",
  remote: "Remote Rule Set",
  inline: "Inline Rule Set",
  route: "Route",
  "route-rule": "Route Rule",
  dns: "DNS",
  "dns-rule": "DNS Rule",
  "ssm-api": "SSM API",
  derp: "DERP",
  ccm: "CCM",
  ocm: "OCM",
};

function candidateLabel(nodeKind: PortNodeKind, nodeType: string) {
  return typeLabels[nodeType] ?? `${nodeType} ${nodeKind}`;
}

function eventClientPoint(event: MouseEvent | TouchEvent) {
  if ("changedTouches" in event) {
    const touch = event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  return { x: event.clientX, y: event.clientY };
}

function pendingMatchesEndpoint(pending: PendingPort, endpoint: PortEndpoint) {
  return endpoint.portKey === pending.handleId && endpointMatchesNode(endpoint, pending.kind, pending.type);
}

function candidatesForEndpoint(endpoint: PortEndpoint): ChipPickerCandidate[] {
  const types = endpoint.nodeType ? [endpoint.nodeType] : candidateTypesByKind[endpoint.nodeKind] ?? [];
  return types
    .filter((nodeType) => endpointMatchesNode(endpoint, endpoint.nodeKind, nodeType))
    .map((nodeType) => ({
      id: `${endpoint.nodeKind}:${nodeType}:${endpoint.portKey}`,
      label: candidateLabel(endpoint.nodeKind, nodeType),
      nodeKind: endpoint.nodeKind,
      nodeType,
      handleId: endpoint.portKey,
    }));
}

function chipCandidatesForPending(pending: PendingPort): ChipPickerCandidate[] {
  const candidates = new Map<string, ChipPickerCandidate>();
  for (const relation of portRelations) {
    if (relation.mode !== "writable" || !relation.createTarget?.length) continue;
    if (pendingMatchesEndpoint(pending, relation.source) && relation.createTarget.includes(relation.target.nodeKind)) {
      for (const candidate of candidatesForEndpoint(relation.target)) candidates.set(candidate.id, candidate);
    }
    if (pendingMatchesEndpoint(pending, relation.target) && relation.createTarget.includes(relation.source.nodeKind)) {
      for (const candidate of candidatesForEndpoint(relation.source)) candidates.set(candidate.id, candidate);
    }
  }
  return [...candidates.values()];
}

function matchesDirectedConnection(
  outputNode: SbcFlowNode | undefined,
  outputHandle: string | null | undefined,
  inputNode: SbcFlowNode | undefined,
  inputHandle: string | null | undefined,
) {
  if (!outputNode || !inputNode || !outputHandle || !inputHandle) return false;
  if (outputNode.id === inputNode.id) return false;
  return Boolean(
    relationForHandles(
      outputNode.data.kind,
      outputNode.data.type,
      outputHandle,
      inputNode.data.kind,
      inputNode.data.type,
      inputHandle,
      ["writable"],
    ),
  );
}

export function CanvasWorkspace() {
  const shellRef = useRef<HTMLElement | null>(null);
  const flowRef = useRef<ReactFlowInstance<SbcFlowNode, Edge> | null>(null);
  const pendingPortRef = useRef<PendingPort | null>(null);
  const suppressNextPaneClickRef = useRef(false);
  const isNodeDraggingRef = useRef(false);
  const interactionStoreRef = useRef(createCanvasInteractionStore());
  const config = useProjectStore((state) => state.config);
  const layout = useProjectStore((state) => state.layout);
  const diagnostics = useProjectStore((state) => state.diagnostics);
  const selectedId = useProjectStore((state) => state.selectedId);
  const setSelectedId = useProjectStore((state) => state.setSelectedId);
  const connectPorts = useProjectStore((state) => state.connectPorts);
  const createNodeAndConnect = useProjectStore((state) => state.createNodeAndConnect);
  const disconnectEdge = useProjectStore((state) => state.disconnectEdge);
  const deleteEntity = useProjectStore((state) => state.deleteEntity);
  const setNodePosition = useProjectStore((state) => state.setNodePosition);
  const freshLoadToken = useProjectStore((state) => state.freshLoadToken);
  const focusToken = useProjectStore((state) => state.focusToken);
  const focusedNodeId = useProjectStore((state) => state.focusedNodeId);
  const graph = useMemo(() => deriveGraph(config, layout, diagnostics), [config, diagnostics, layout]);
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const selectedTitle = selectedId ? nodeById.get(selectedId)?.data.title ?? selectedId : null;
  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);
  const [pendingPort, setPendingPortState] = useState<PendingPort | null>(null);
  const [chipPicker, setChipPicker] = useState<ChipPickerState | null>(null);
  const { isMobile } = useViewport();
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [interaction, setInteraction] = useState<"pan" | "select">("pan");
  const fitFullGraph = useCallback(() => {
    window.requestAnimationFrame(() => {
      flowRef.current?.fitView({ padding: 0.24, duration: 120 });
    });
  }, []);
  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      const sourceNode = connection.source ? nodeById.get(connection.source) : undefined;
      const targetNode = connection.target ? nodeById.get(connection.target) : undefined;
      return (
        matchesDirectedConnection(sourceNode, connection.sourceHandle, targetNode, connection.targetHandle) ||
        matchesDirectedConnection(targetNode, connection.targetHandle, sourceNode, connection.sourceHandle)
      );
    },
    [nodeById],
  );
  const setPendingPort = useCallback((next: PendingPort | null) => {
    pendingPortRef.current = next;
    setPendingPortState(next);
  }, []);
  const compatiblePortKeys = useMemo(() => {
    if (!pendingPort) return EMPTY_COMPATIBLE_PORT_KEYS;
    const result = new Set<string>();
    for (const node of graph.nodes) {
      if (node.id === pendingPort.nodeId) continue;
      const endpoints = [
        ...portEndpointsForNode(node.data.kind, node.data.type, "input"),
        ...portEndpointsForNode(node.data.kind, node.data.type, "output"),
      ];
      for (const endpoint of endpoints) {
        const matches =
          relationForHandles(pendingPort.kind, pendingPort.type, pendingPort.handleId, node.data.kind, node.data.type, endpoint.portKey, ["writable"]) ||
          relationForHandles(node.data.kind, node.data.type, endpoint.portKey, pendingPort.kind, pendingPort.type, pendingPort.handleId, ["writable"]);
        if (matches) result.add(interactionPortKey(node.id, endpoint.portKey));
      }
    }
    return result;
  }, [graph.nodes, pendingPort]);
  const edgeByPort = useMemo(() => {
    const result = new Map<string, string>();
    for (const edge of graph.edges) {
      if (edge.deletable === false) continue;
      if (edge.sourceHandle) {
        const key = interactionPortKey(edge.source, edge.sourceHandle);
        if (!result.has(key)) result.set(key, edge.id);
      }
      if (edge.targetHandle) {
        const key = interactionPortKey(edge.target, edge.targetHandle);
        if (!result.has(key)) result.set(key, edge.id);
      }
    }
    return result;
  }, [graph.edges]);
  const disconnectPort = useCallback((nodeId: string, handleId: string) => {
    const edgeId = edgeByPort.get(interactionPortKey(nodeId, handleId));
    if (edgeId) disconnectEdge(edgeId);
  }, [disconnectEdge, edgeByPort]);

  useEffect(() => {
    interactionStoreRef.current.setDisconnectPort(disconnectPort);
  }, [disconnectPort]);

  useEffect(() => {
    interactionStoreRef.current.setSnapshot({
      pendingPortKey: pendingPort ? interactionPortKey(pendingPort.nodeId, pendingPort.handleId) : null,
      compatiblePortKeys,
    });
  }, [compatiblePortKeys, pendingPort]);
  const handleConnectStart = useCallback<OnConnectStart>((_, params) => {
    if (!params.nodeId || !params.handleId) return;
    const node = nodeById.get(params.nodeId);
    if (!node) return;
    setChipPicker(null);
    setPendingPort({
      nodeId: node.id,
      handleId: params.handleId,
      kind: node.data.kind,
      type: node.data.type,
    });
  }, [nodeById, setPendingPort]);
  const handleConnectEnd = useCallback<OnConnectEnd>((event, connectionState) => {
    const pending = pendingPortRef.current;
    setPendingPort(null);
    if (!pending) return;
    const state = connectionState as { isValid?: boolean; toNode?: unknown; toHandle?: unknown };
    if (state.isValid || state.toNode || state.toHandle) return;
    const point = eventClientPoint(event);
    if (!point) return;
    const candidates = chipCandidatesForPending(pending);
    if (candidates.length === 0) return;
    const rect = shellRef.current?.getBoundingClientRect();
    const flowPosition = flowRef.current?.screenToFlowPosition(point) ?? point;
    suppressNextPaneClickRef.current = true;
    window.setTimeout(() => {
      suppressNextPaneClickRef.current = false;
    }, 0);
    setChipPicker({
      x: rect ? point.x - rect.left : point.x,
      y: rect ? point.y - rect.top : point.y,
      flowPosition,
      source: pending,
      candidates,
    });
  }, [setPendingPort]);
  const handleConnect = useCallback((connection: Connection) => {
    connectPorts(connection);
    setPendingPort(null);
    setChipPicker(null);
  }, [connectPorts, setPendingPort]);
  const handlePickCandidate = useCallback((candidate: ChipPickerCandidate) => {
    if (!chipPicker) return;
    createNodeAndConnect(chipPicker.source.nodeId, chipPicker.source.handleId, {
      nodeKind: candidate.nodeKind,
      nodeType: candidate.nodeType,
      handleId: candidate.handleId,
    }, chipPicker.flowPosition);
    setChipPicker(null);
  }, [chipPicker, createNodeAndConnect]);

  useEffect(() => {
    if (!isNodeDraggingRef.current) setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph.edges, graph.nodes, setEdges, setNodes]);

  useEffect(() => {
    if (freshLoadToken === 0) return;
    fitFullGraph();
  }, [fitFullGraph, freshLoadToken]);

  useEffect(() => {
    if (focusToken === 0 || !focusedNodeId) return;
    window.requestAnimationFrame(() => {
      flowRef.current?.fitView({
        nodes: [{ id: focusedNodeId }],
        padding: 0.6,
        duration: 320,
        maxZoom: 1,
      });
    });
  }, [focusToken, focusedNodeId]);

  return (
    <section ref={shellRef} className="canvas-shell" data-interaction={interaction} aria-label="SBC visual canvas">
      <CanvasInteractionContext.Provider value={interactionStoreRef.current}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={(deleted) => deleted.forEach((node) => {
          if (node.data.kind !== "notice") deleteEntity(node.data.ref);
        })}
        onEdgesDelete={(deleted) => deleted.forEach((edge) => disconnectEdge(edge.id))}
        onConnect={handleConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onClickConnectStart={handleConnectStart}
        onClickConnectEnd={handleConnectEnd}
        isValidConnection={isValidConnection}
        onNodeClick={(_, node) => setSelectedId(node.id)}
        onInit={(instance) => {
          flowRef.current = instance;
          fitFullGraph();
        }}
        onNodeDragStart={() => {
          isNodeDraggingRef.current = true;
        }}
        onNodeDragStop={(_, node) => {
          isNodeDraggingRef.current = false;
          setNodePosition(node.id, node.position);
        }}
        onPaneClick={() => {
          if (suppressNextPaneClickRef.current) return;
          setSelectedId(null);
          setChipPicker(null);
        }}
        fitView
        fitViewOptions={{ padding: 0.24 }}
        minZoom={0.03}
        maxZoom={1.4}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={54}
        connectionDragThreshold={1}
        connectionLineStyle={connectionLineStyle}
        nodesDraggable={!isMobile}
        edgesFocusable={!isMobile}
        nodesFocusable
        elementsSelectable
        panOnDrag={isMobile ? true : interaction === "pan"}
        selectionOnDrag={isMobile ? false : interaction === "select"}
        deleteKeyCode={isMobile ? null : ["Backspace", "Delete"]}
      >
        <Background color="#1f2730" gap={18} size={1} />
        {!isMobile && showMiniMap ? <MiniMap pannable zoomable className="sbc-minimap" /> : null}
        <Controls
          position="bottom-center"
          showZoom={!isMobile}
          showFitView
          showInteractive={false}
        >
          {isMobile ? null : (
            <>
              <ControlButton
                className="sbc-ctrl-cursor"
                onClick={() => setInteraction("select")}
                data-active={interaction === "select"}
                title="Select"
                aria-label="Select mode"
                aria-pressed={interaction === "select"}
              >
                <MousePointer2 size={16} strokeWidth={1.8} />
              </ControlButton>
              <ControlButton
                className="sbc-ctrl-hand"
                onClick={() => setInteraction("pan")}
                data-active={interaction === "pan"}
                title="Pan"
                aria-label="Pan mode"
                aria-pressed={interaction === "pan"}
              >
                <Hand size={16} strokeWidth={1.8} />
              </ControlButton>
              <ControlButton
                className="sbc-ctrl-map"
                onClick={() => setShowMiniMap((prev) => !prev)}
                title={showMiniMap ? "Hide minimap" : "Show minimap"}
                aria-label={showMiniMap ? "Hide minimap" : "Show minimap"}
                aria-pressed={showMiniMap}
              >
                <MapIcon size={16} strokeWidth={1.8} />
              </ControlButton>
            </>
          )}
        </Controls>
      </ReactFlow>
      {chipPicker ? (
        <ChipPickerPopover
          x={chipPicker.x}
          y={chipPicker.y}
          candidates={chipPicker.candidates}
          onPick={handlePickCandidate}
          onClose={() => setChipPicker(null)}
        />
      ) : null}
      </CanvasInteractionContext.Provider>
      {selectedTitle ? <div className="canvas-selection-pill">Selected {selectedTitle}</div> : null}
    </section>
  );
}
