import "@xyflow/react/dist/style.css";
import { Background, Controls, MiniMap, ReactFlow, useEdgesState, useNodesState } from "@xyflow/react";
import type { NodeTypes } from "@xyflow/react";
import { useEffect, useMemo } from "react";
import { deriveGraph } from "../canvas/graph";
import { useProjectStore } from "../state/useProjectStore";
import { SbcNode } from "./SbcNode";

const nodeTypes: NodeTypes = {
  sbc: SbcNode,
};

export function CanvasWorkspace() {
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

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph.edges, graph.nodes, setEdges, setNodes]);

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
        onNodeDragStop={(_, node) => setNodePosition(node.id, node.position)}
        onPaneClick={() => setSelectedId(null)}
        fitView
        minZoom={0.25}
        maxZoom={1.4}
        nodesDraggable
        edgesFocusable
        nodesFocusable
        elementsSelectable
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background color="#1f2730" gap={18} size={1} />
        <MiniMap pannable zoomable className="sbc-minimap" />
        <Controls position="bottom-left" />
      </ReactFlow>
      {selectedId ? <div className="canvas-selection-pill">Selected {selectedId}</div> : null}
    </section>
  );
}
