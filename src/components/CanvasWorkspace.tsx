import "@xyflow/react/dist/style.css";
import { Background, ConnectionMode, ControlButton, Controls, MiniMap, ReactFlow, useEdgesState, useNodesState } from "@xyflow/react";
import type { Connection, Edge, NodeTypes, ReactFlowInstance } from "@xyflow/react";
import { Hand, Map as MapIcon, MousePointer2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deriveGraph } from "../canvas/graph";
import type { SbcFlowNode } from "../canvas/graph";
import { useProjectStore } from "../state/useProjectStore";
import { getPortSpecs, SbcNode } from "./SbcNode";
import { useViewport } from "./useViewport";

const nodeTypes: NodeTypes = {
  sbc: SbcNode,
};

const connectionLineStyle = {
  stroke: "#e4e9ee",
  strokeWidth: 2.4,
};

function specMatchesNode(
  spec: ReturnType<typeof getPortSpecs>[number],
  node: SbcFlowNode | undefined,
) {
  if (!node) return false;
  if (spec.nodeKind !== node.data.kind) return false;
  return !spec.nodeType || spec.nodeType === node.data.type;
}

function matchesDirectedConnection(
  outputNode: SbcFlowNode | undefined,
  outputHandle: string | null | undefined,
  inputNode: SbcFlowNode | undefined,
  inputHandle: string | null | undefined,
) {
  if (!outputNode || !inputNode || !outputHandle || !inputHandle) return false;
  if (outputNode.id === inputNode.id) return false;
  const outputSpec = getPortSpecs(outputNode.data.kind, outputNode.data.type, "output").find(
    (spec) => spec.key === outputHandle,
  );
  const inputSpec = getPortSpecs(inputNode.data.kind, inputNode.data.type, "input").find(
    (spec) => spec.key === inputHandle,
  );
  return Boolean(outputSpec && inputSpec && specMatchesNode(outputSpec, inputNode) && specMatchesNode(inputSpec, outputNode));
}

export function CanvasWorkspace() {
  const flowRef = useRef<ReactFlowInstance<SbcFlowNode, Edge> | null>(null);
  const config = useProjectStore((state) => state.config);
  const layout = useProjectStore((state) => state.layout);
  const diagnostics = useProjectStore((state) => state.diagnostics);
  const selectedId = useProjectStore((state) => state.selectedId);
  const setSelectedId = useProjectStore((state) => state.setSelectedId);
  const connectPorts = useProjectStore((state) => state.connectPorts);
  const disconnectEdge = useProjectStore((state) => state.disconnectEdge);
  const setNodePosition = useProjectStore((state) => state.setNodePosition);
  const freshLoadToken = useProjectStore((state) => state.freshLoadToken);
  const graph = useMemo(() => deriveGraph(config, layout, diagnostics), [config, diagnostics, layout]);
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);
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

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph.edges, graph.nodes, setEdges, setNodes]);

  useEffect(() => {
    if (freshLoadToken === 0) return;
    fitFullGraph();
  }, [fitFullGraph, freshLoadToken]);

  return (
    <section className="canvas-shell" data-interaction={interaction} aria-label="SBC visual canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgesDelete={(deleted) => deleted.forEach((edge) => disconnectEdge(edge.id))}
        onConnect={connectPorts}
        isValidConnection={isValidConnection}
        onNodeClick={(_, node) => setSelectedId(node.id)}
        onInit={(instance) => {
          flowRef.current = instance;
          fitFullGraph();
        }}
        onNodeDragStop={(_, node) => setNodePosition(node.id, node.position)}
        onPaneClick={() => setSelectedId(null)}
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
      {selectedId ? <div className="canvas-selection-pill">Selected {selectedId}</div> : null}
    </section>
  );
}
