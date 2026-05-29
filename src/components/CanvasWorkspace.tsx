import "@xyflow/react/dist/style.css";
import { Background, ConnectionMode, ControlButton, Controls, MiniMap, ReactFlow, ViewportPortal, useEdgesState, useNodesState } from "@xyflow/react";
import type { Connection, Edge, EdgeTypes, NodeTypes, OnConnectEnd, OnConnectStart, ReactFlowInstance } from "@xyflow/react";
import { Hand, Map as MapIcon, MousePointer2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deriveGraph } from "../canvas/graph";
import type { SbcFlowNode } from "../canvas/graph";
import { typeLabels } from "../canvas/nodeLabels";
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
import { CanvasEdge } from "./CanvasEdge";
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

const edgeTypes: EdgeTypes = {
  sbc: CanvasEdge,
};

const connectionLineStyle = {
  stroke: "#e4e9ee",
  strokeWidth: 2.4,
  strokeDasharray: "10 14",
  strokeLinecap: "round",
} as const;
const CHIP_PICKER_WIDTH = 320;
const CHIP_PICKER_MAX_HEIGHT = 360;
const CHIP_PICKER_MARGIN = 16;

type PendingPort = {
  nodeId: string;
  handleId: string;
  kind: PortNodeKind;
  type: string;
  sourceFlowPosition: { x: number; y: number } | null;
};

type ChipPickerState = {
  x: number;
  y: number;
  width: number;
  maxHeight: number;
  lineStart: { x: number; y: number };
  lineEnd: { x: number; y: number };
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function visibleFlowBounds(
  shellRect: DOMRect | undefined,
  flow: ReactFlowInstance<SbcFlowNode, Edge> | null,
) {
  if (!shellRect || !flow) return undefined;
  const topLeft = flow.screenToFlowPosition({ x: shellRect.left, y: shellRect.top });
  const bottomRight = flow.screenToFlowPosition({ x: shellRect.right, y: shellRect.bottom });
  const x = Math.min(topLeft.x, bottomRight.x);
  const y = Math.min(topLeft.y, bottomRight.y);
  return {
    x,
    y,
    width: Math.abs(bottomRight.x - topLeft.x),
    height: Math.abs(bottomRight.y - topLeft.y),
  };
}

function boundedPickerPlacement(
  point: { x: number; y: number },
  bounds: ReturnType<typeof visibleFlowBounds>,
) {
  if (!bounds) {
    return {
      x: point.x,
      y: point.y,
      width: CHIP_PICKER_WIDTH,
      maxHeight: CHIP_PICKER_MAX_HEIGHT,
    };
  }
  const margin = Math.min(CHIP_PICKER_MARGIN, Math.floor(Math.min(bounds.width, bounds.height) / 4));
  const width = Math.max(120, Math.min(CHIP_PICKER_WIDTH, bounds.width - margin * 2));
  const maxHeight = Math.max(140, Math.min(CHIP_PICKER_MAX_HEIGHT, bounds.height - margin * 2));
  return {
    x: clamp(point.x, bounds.x + margin, bounds.x + bounds.width - width - margin),
    y: clamp(point.y, bounds.y + margin, bounds.y + bounds.height - maxHeight - margin),
    width,
    maxHeight,
  };
}

function lineEndForPicker(
  lineStart: { x: number; y: number },
  picker: Pick<ChipPickerState, "x" | "y" | "width">,
) {
  return {
    x: lineStart.x <= picker.x + picker.width / 2 ? picker.x : picker.x + picker.width,
    y: picker.y + 32,
  };
}

function chipPickerConnectorPath(start: { x: number; y: number }, end: { x: number; y: number }) {
  const direction = end.x >= start.x ? 1 : -1;
  const controlDistance = Math.max(96, Math.min(260, Math.abs(end.x - start.x) * 0.45));
  return [
    `M ${start.x.toFixed(1)} ${start.y.toFixed(1)}`,
    `C ${(start.x + controlDistance * direction).toFixed(1)} ${start.y.toFixed(1)}`,
    `${(end.x - controlDistance * direction).toFixed(1)} ${end.y.toFixed(1)}`,
    `${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
  ].join(" ");
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

// Outcome of releasing a connection drag (L3-invalid-drop). Pure so it can be unit-tested without a
// real React Flow drag (which jsdom can't drive): `connected` = a valid drop (onConnect applies it);
// `incompatible` = released on a node/handle that rejected the connection (→ user feedback);
// `open-picker` = released on empty canvas (→ offer to create a compatible node).
export type ConnectEndOutcome = "connected" | "incompatible" | "open-picker";
export function classifyConnectEnd(state: { isValid?: boolean | null; toNode?: unknown; toHandle?: unknown }): ConnectEndOutcome {
  if (state.isValid) return "connected";
  if (state.toNode || state.toHandle) return "incompatible";
  return "open-picker";
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
  const captureGraphPositions = useProjectStore((state) => state.captureGraphPositions);
  const setNodePosition = useProjectStore((state) => state.setNodePosition);
  const freshLoadToken = useProjectStore((state) => state.freshLoadToken);
  const layoutCaptureToken = useProjectStore((state) => state.layoutCaptureToken);
  const focusToken = useProjectStore((state) => state.focusToken);
  const focusedNodeId = useProjectStore((state) => state.focusedNodeId);
  const graph = useMemo(() => deriveGraph(config, layout, diagnostics), [config, diagnostics, layout]);
  const graphPositions = useMemo(
    () => graph.nodes.map((node) => ({ id: node.id, position: node.position })),
    [graph.nodes],
  );
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

  useEffect(() => {
    if (layoutCaptureToken === 0) return;
    captureGraphPositions(layoutCaptureToken, graphPositions);
  }, [captureGraphPositions, graphPositions, layoutCaptureToken]);

  const handleConnectStart = useCallback<OnConnectStart>((event, params) => {
    if (!params.nodeId || !params.handleId) return;
    const node = nodeById.get(params.nodeId);
    if (!node) return;
    const point = eventClientPoint(event);
    setChipPicker(null);
    setPendingPort({
      nodeId: node.id,
      handleId: params.handleId,
      kind: node.data.kind,
      type: node.data.type,
      sourceFlowPosition: point && flowRef.current ? flowRef.current.screenToFlowPosition(point) : null,
    });
  }, [nodeById, setPendingPort]);
  const handleConnectEnd = useCallback<OnConnectEnd>((event, connectionState) => {
    const pending = pendingPortRef.current;
    setPendingPort(null);
    if (!pending) return;
    const state = connectionState as { isValid?: boolean | null; toNode?: unknown; toHandle?: unknown };
    const outcome = classifyConnectEnd(state);
    if (outcome === "connected") return; // onConnect applies the edge
    if (outcome === "incompatible") {
      // Released on a node/handle that rejected the connection — say why nothing happened.
      useProjectStore.getState().pushToast({
        message: "Those ports can't be connected — they aren't compatible.",
        tone: "error",
        durationMs: 4000,
      });
      return;
    }
    const point = eventClientPoint(event);
    if (!point) return;
    const candidates = chipCandidatesForPending(pending);
    if (candidates.length === 0) return;
    const sourceFlowPosition = pending.sourceFlowPosition ?? flowRef.current?.screenToFlowPosition(point) ?? null;
    const flowPosition = flowRef.current?.screenToFlowPosition(point) ?? point;
    const pickerPlacement = boundedPickerPlacement(
      flowPosition,
      visibleFlowBounds(shellRef.current?.getBoundingClientRect(), flowRef.current),
    );
    const lineStart = sourceFlowPosition ?? flowPosition;
    const lineEnd = lineEndForPicker(lineStart, pickerPlacement);
    suppressNextPaneClickRef.current = true;
    window.setTimeout(() => {
      suppressNextPaneClickRef.current = false;
    }, 0);
    setChipPicker({
      ...pickerPlacement,
      lineStart,
      lineEnd,
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
    <section
      ref={shellRef}
      className="canvas-shell"
      data-interaction={interaction}
      data-chip-picker-open={chipPicker ? "true" : "false"}
      aria-label="SBC visual canvas"
    >
      <CanvasInteractionContext.Provider value={interactionStoreRef.current}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
        {chipPicker ? (
          <ViewportPortal>
            <svg className="chip-picker-link" aria-hidden="true">
              <path
                className="chip-picker-link__path"
                d={chipPickerConnectorPath(chipPicker.lineStart, chipPicker.lineEnd)}
              />
            </svg>
            <ChipPickerPopover
              x={chipPicker.x}
              y={chipPicker.y}
              width={chipPicker.width}
              maxHeight={chipPicker.maxHeight}
              candidates={chipPicker.candidates}
              onPick={handlePickCandidate}
              onClose={() => setChipPicker(null)}
            />
          </ViewportPortal>
        ) : null}
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
      </CanvasInteractionContext.Provider>
      {selectedTitle ? <div className="canvas-selection-pill">Selected {selectedTitle}</div> : null}
    </section>
  );
}
