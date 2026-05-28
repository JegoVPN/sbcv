import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  Ban,
  CheckCircle2,
  CircleAlert,
  CirclePlus,
  Database,
  GitBranch,
  Globe2,
  Layers3,
  Network,
  Plus,
  RadioTower,
  Route,
  Server,
  Settings2,
  Shield,
  Shuffle,
  Trash2,
  TriangleAlert,
  Waypoints,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SbcFlowNode, SbcNodeKind } from "../canvas/graph";
import { getNodeIcon } from "../canvas/iconRegistry";
import { nodeTitlebarLabel } from "../canvas/nodeLabels";
import { dnsRuleAllowsServer } from "../domain/commands";
import {
  portEndpointsForNode,
  portRelations,
  relationIsAggregate,
  type PortDirection,
  type PortEndpoint,
  type PortIconId,
  type PortRelationMode,
} from "../domain/portRelationRegistry";
import { useProjectStore } from "../state/useProjectStore";
import { useCanvasInteraction } from "./canvasInteractionContext";

const EMPTY_CONNECTED_PORTS: Partial<Record<PortDirection, string[]>> = {};

export { getNodeIcon };

// Validity readability (A9 / T9-W10): error and warning each get a distinct glyph so a warning node
// is never visually identical to a valid one. Status glyphs are reserved for status only.
function statusIcon(status: string): LucideIcon {
  if (status === "error") return CircleAlert;
  if (status === "warning") return TriangleAlert;
  return CheckCircle2;
}

export type PortSpec = {
  key: string;
  label: string;
  nodeKind: SbcNodeKind;
  nodeType?: string;
  icon: LucideIcon;
  mode: PortRelationMode;
  editable: boolean;
  aggregate: boolean;
};

const portIconMap: Record<PortIconId, LucideIcon> = {
  ban: Ban,
  database: Database,
  "git-branch": GitBranch,
  globe: Globe2,
  layers: Layers3,
  network: Network,
  radio: RadioTower,
  route: Route,
  server: Server,
  settings: Settings2,
  shield: Shield,
  shuffle: Shuffle,
  waypoints: Waypoints,
};

function relationForEndpoint(endpoint: PortEndpoint) {
  return portRelations.find((entry) => entry.source === endpoint || entry.target === endpoint);
}

function otherEndpoint(endpoint: PortEndpoint) {
  const relation = relationForEndpoint(endpoint);
  if (!relation) return null;
  return relation.source === endpoint ? relation.target : relation.source;
}

export function getPortSpecs(
  kind: SbcNodeKind,
  type: string,
  direction: PortDirection,
  action?: string,
): PortSpec[] {
  return portEndpointsForNode(kind, type, direction).flatMap((endpoint) => {
    const relation = relationForEndpoint(endpoint);
    const compatible = otherEndpoint(endpoint);
    if (!relation || !compatible) return [];
    // A10c: a dns-rule only dials a DNS server for server-bearing actions (route/evaluate). For other
    // actions the graph edge is already suppressed, so hide the dead output port too. `action`
    // undefined keeps every port (action-agnostic callers / pre-action contexts).
    if (
      kind === "dns-rule" &&
      direction === "output" &&
      endpoint.portKey === "dns-server" &&
      action !== undefined &&
      !dnsRuleAllowsServer({ action })
    ) {
      return [];
    }
    return [
      {
        key: endpoint.portKey,
        label: endpoint.label,
        nodeKind: compatible.nodeKind,
        nodeType: compatible.nodeType,
        icon: portIconMap[endpoint.icon],
        mode: relation.mode,
        editable: relation.mode === "writable",
        aggregate: relationIsAggregate(relation.id),
      },
    ];
  });
}

export function SbcNode({ id, data, selected }: NodeProps<SbcFlowNode>) {
  const Icon = getNodeIcon(data.kind, data.type);
  const StatusIcon = statusIcon(data.status);
  const inputPorts = getPortSpecs(data.kind, data.type, "input", data.action);
  const outputPorts = getPortSpecs(data.kind, data.type, "output", data.action);
  const portKeys = useMemo(
    () => [
      ...getPortSpecs(data.kind, data.type, "input", data.action),
      ...getPortSpecs(data.kind, data.type, "output", data.action),
    ].map((port) => port.key),
    [data.kind, data.type, data.action],
  );
  const { compatiblePortKeys, disconnectPort, pendingPortKey } = useCanvasInteraction(id, portKeys);
  const { setSelectedId, createCompatible, deleteEntity } = useProjectStore(
    useShallow((state) => ({
      setSelectedId: state.setSelectedId,
      createCompatible: state.createCompatible,
      deleteEntity: state.deleteEntity,
    })),
  );
  const connectedPorts = data.connectedPorts ?? EMPTY_CONNECTED_PORTS;
  const isDeprecated = data.kind === "outbound" && data.type === "block";
  const isNotice = data.kind === "notice";
  const canDelete = !isNotice;

  return (
    <div
      className={`sbc-node-shell ${selected ? "is-selected" : ""}${isDeprecated ? " sbc-node-shell--deprecated" : ""}`}
      onClick={() => setSelectedId(id)}
      data-testid={`node-${id}`}
    >
      <div className="sbc-node-titlebar" data-testid="node-titlebar">
        <span className="sbc-node-titlebar__icon">
          <Icon size={18} strokeWidth={2.2} />
        </span>
        <span>{nodeTitlebarLabel(data.kind, data.type)}</span>
        {isDeprecated ? (
          <span className="sbc-node-titlebar__badge" data-testid="node-deprecated-badge" title="Deprecated since sing-box 1.11 — use route action=reject">
            deprecated
          </span>
        ) : null}
      </div>
      <div className={`sbc-node sbc-node--${data.status} ${selected ? "is-selected" : ""}`} data-testid="node-card">
        {selected ? (
          <>
            <span className="sbc-node__corner sbc-node__corner--tl" data-testid="node-selection-corner" />
            <span className="sbc-node__corner sbc-node__corner--tr" data-testid="node-selection-corner" />
            <span className="sbc-node__corner sbc-node__corner--br" data-testid="node-selection-corner" />
            <span className="sbc-node__corner sbc-node__corner--bl" data-testid="node-selection-corner" />
          </>
        ) : null}

        <div className="sbc-node__ports sbc-node__ports--left" data-testid="node-left-ports">
          {inputPorts.map((port) => {
            const connected = Boolean(connectedPorts.input?.includes(port.key));
            const actionLabel = port.editable ? (connected ? "Connected" : "Start") : (connected ? "Linked" : "Readonly");
            const isCompatible = compatiblePortKeys.has(port.key);
            const isPending = pendingPortKey === port.key;
            return (
              <div
                className={`sbc-port sbc-port--input ${connected ? "is-connected" : ""}${isCompatible ? " is-compatible" : ""}${isPending ? " is-pending" : ""}`}
                key={port.key}
                role="button"
                tabIndex={0}
                title={port.label}
                aria-label={`${actionLabel} ${port.label} for ${data.title}`}
                data-port-type={port.key}
                data-port-node-kind={port.nodeKind}
                data-port-node-type={port.nodeType}
                data-port-mode={port.mode}
                data-editable={port.editable ? "true" : "false"}
                data-connected={connected ? "true" : "false"}
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <Handle
                  id={port.key}
                  className={`sbc-handle sbc-handle--in sbc-handle--target${isCompatible ? " valid" : ""}`}
                  type="target"
                  position={Position.Left}
                  isConnectable={port.editable}
                />
                <Handle
                  id={port.key}
                  className={`sbc-handle sbc-handle--in sbc-handle--source${isCompatible ? " valid" : ""}`}
                  type="source"
                  position={Position.Left}
                  isConnectable={port.editable}
                />
                <port.icon size={15} />
                <span className="sbc-port__label">{port.label}</span>
                {port.editable && connected && !port.aggregate ? (
                  <button
                    className="sbc-port__action nodrag"
                    type="button"
                    aria-label={`Disconnect ${port.label} for ${data.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      disconnectPort(id, port.key);
                    }}
                  >
                    <Trash2 size={10} />
                  </button>
                ) : port.editable && !connected ? (
                  <span className="sbc-port__action" aria-hidden><Plus size={11} /></span>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="sbc-node__ports sbc-node__ports--right" data-testid="node-right-ports">
          {outputPorts.map((port) => {
            const connected = Boolean(connectedPorts.output?.includes(port.key));
            const actionLabel = port.editable ? (connected ? "Connected" : "Start") : (connected ? "Linked" : "Readonly");
            const isCompatible = compatiblePortKeys.has(port.key);
            const isPending = pendingPortKey === port.key;
            return (
              <div
                className={`sbc-port sbc-port--output ${connected ? "is-connected" : ""}${isCompatible ? " is-compatible" : ""}${isPending ? " is-pending" : ""}`}
                key={port.key}
                role="button"
                tabIndex={0}
                title={port.label}
                aria-label={`${actionLabel} ${port.label} from ${data.title}`}
                data-port-type={port.key}
                data-port-node-kind={port.nodeKind}
                data-port-node-type={port.nodeType}
                data-port-mode={port.mode}
                data-editable={port.editable ? "true" : "false"}
                data-connected={connected ? "true" : "false"}
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <Handle
                  id={port.key}
                  className={`sbc-handle sbc-handle--out sbc-handle--target${isCompatible ? " valid" : ""}`}
                  type="target"
                  position={Position.Right}
                  isConnectable={port.editable}
                />
                <Handle
                  id={port.key}
                  className={`sbc-handle sbc-handle--out sbc-handle--source${isCompatible ? " valid" : ""}`}
                  type="source"
                  position={Position.Right}
                  isConnectable={port.editable}
                />
                <port.icon size={15} />
                <span className="sbc-port__label">{port.label}</span>
                {port.editable && connected && !port.aggregate ? (
                  <button
                    className="sbc-port__action nodrag"
                    type="button"
                    aria-label={`Disconnect ${port.label} from ${data.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      disconnectPort(id, port.key);
                    }}
                  >
                    <Trash2 size={10} />
                  </button>
                ) : port.editable && !connected ? (
                  <span className="sbc-port__action" aria-hidden><Plus size={11} /></span>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="sbc-node__summary">
          <div className="sbc-node__status">
            <StatusIcon size={16} />
          </div>
          <div className="sbc-node__title">{data.title}</div>
          <div className="sbc-node__subtitle">{data.subtitle}</div>
        </div>

        {data.compatible.length > 0 ? (
          <button
            className="sbc-node__add nodrag"
            type="button"
            aria-label={`Add from ${data.title}`}
            onClick={(event) => {
              event.stopPropagation();
              const first = data.compatible[0];
              if (first) createCompatible(id, first);
            }}
          >
            <Plus size={20} />
          </button>
        ) : null}

        {!isNotice ? (
          <>
            <div className="sbc-node__toolbar nodrag" data-testid="node-bottom-toolbar">
              <span className="sbc-node-pill sbc-node-pill--type">
                <Icon size={16} />
                {data.type}
              </span>
              <span className={`sbc-node-pill sbc-node-pill--${data.status}`}>
                <StatusIcon size={14} />
                {data.status}
              </span>
              <button
                className="node-icon-button"
                type="button"
                aria-label={`Open inspector for ${data.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedId(id);
                }}
              >
                <Settings2 size={15} />
              </button>
              <button
                className="sbc-node-primary"
                type="button"
                aria-label={`${data.compatible.length} compatible connections for ${data.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedId(id);
                }}
              >
                <CirclePlus size={15} />
                {data.compatible.length}
              </button>
            </div>

            <div className="sbc-node__actions nodrag" data-testid="node-hover-actions">
              {data.compatible.map((kind) => (
                <button
                  key={kind}
                  className="node-chip"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    createCompatible(id, kind);
                  }}
                >
                  + {kind}
                </button>
              ))}
              {canDelete ? (
                <button
                  className="node-icon-button node-icon-button--danger"
                  type="button"
                  aria-label={`Delete ${data.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteEntity(data.ref);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
