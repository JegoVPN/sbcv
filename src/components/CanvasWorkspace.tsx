import "@xyflow/react/dist/style.css";
import { Background, Controls, MiniMap, ReactFlow, useEdgesState, useNodesState } from "@xyflow/react";
import type { Edge, NodeTypes, ReactFlowInstance } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { deriveGraph } from "../canvas/graph";
import type { SbcFlowNode } from "../canvas/graph";
import { useProjectStore } from "../state/useProjectStore";
import { SbcNode } from "./SbcNode";

const nodeTypes: NodeTypes = {
  sbc: SbcNode,
};

export function CanvasWorkspace() {
  const flowRef = useRef<ReactFlowInstance<SbcFlowNode, Edge> | null>(null);
  const config = useProjectStore((state) => state.config);
  const layout = useProjectStore((state) => state.layout);
  const diagnostics = useProjectStore((state) => state.diagnostics);
  const selectedId = useProjectStore((state) => state.selectedId);
  const setSelectedId = useProjectStore((state) => state.setSelectedId);
  const disconnectEdge = useProjectStore((state) => state.disconnectEdge);
  const setNodePosition = useProjectStore((state) => state.setNodePosition);
  const graph = useMemo(() => deriveGraph(config, layout, diagnostics), [config, diagnostics, layout]);
  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);
  const fitFullGraph = useCallback(() => {
    window.requestAnimationFrame(() => {
      flowRef.current?.fitView({ padding: 0.24, duration: 120 });
    });
  }, []);

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
    fitFullGraph();
  }, [fitFullGraph, graph.edges, graph.nodes, setEdges, setNodes]);

  return (
    <section className="canvas-shell" aria-label="SBC visual canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgesDelete={(deleted) => deleted.forEach((edge) => disconnectEdge(edge.id))}
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
        nodesDraggable
        edgesFocusable
        nodesFocusable
        elementsSelectable
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background color="#1f2730" gap={18} size={1} />
        <MiniMap pannable zoomable className="sbc-minimap" />
        <Controls position="bottom-center" showInteractive={false} />
      </ReactFlow>
      {selectedId ? <div className="canvas-selection-pill">Selected {selectedId}</div> : null}
    </section>
  );
}
