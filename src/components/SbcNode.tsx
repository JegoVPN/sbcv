import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  Ban,
  CheckCircle2,
  CircleAlert,
  CirclePlus,
  Cog,
  CornerDownRight,
  Crosshair,
  Database,
  DownloadCloud,
  Filter,
  Flag,
  FlagTriangleRight,
  GitBranch,
  Globe2,
  Layers3,
  ListChecks,
  ListOrdered,
  Milestone,
  Network,
  RadioTower,
  Route,
  Server,
  Settings2,
  Shield,
  ShieldCheck,
  Shuffle,
  Spline,
  Target,
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
  cog: Cog,
  "corner-down-right": CornerDownRight,
  crosshair: Crosshair,
  database: Database,
  "download-cloud": DownloadCloud,
  filter: Filter,
  flag: Flag,
  "flag-triangle-right": FlagTriangleRight,
  "git-branch": GitBranch,
  globe: Globe2,
  layers: Layers3,
  "list-checks": ListChecks,
  "list-ordered": ListOrdered,
  milestone: Milestone,
  network: Network,
  radio: RadioTower,
  route: Route,
  server: Server,
  settings: Settings2,
  shield: Shield,
  "shield-check": ShieldCheck,
  shuffle: Shuffle,
  spline: Spline,
  target: Target,
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

// N1: ports split into two groups so the card shows only its CONNECTED ports by default. Connected
// ports render in the normal (vertically-centered) flow column; UNCONNECTED ports render in an absolute
// `.sbc-node__ports-extra` overlay that's hidden until the node is hovered or the port is a valid
// drop-target during a connect-drag. Because the overlay is out-of-flow, revealing it never moves the
// connected ports (no edge re-anchoring / React Flow re-measure needed — RF reads handle positions
// live at interaction time). All ports stay mounted so their handles are always connectable.
export function portIsConnected(connectedPorts: Partial<Record<PortDirection, string[]>>, direction: PortDirection, key: string): boolean {
  return Boolean(connectedPorts[direction]?.includes(key));
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
  const { compatiblePortKeys, disconnectPort, pendingPortKey, openPortPicker } = useCanvasInteraction(id, portKeys);
  const { setSelectedId, deleteEntity } = useProjectStore(
    useShallow((state) => ({
      setSelectedId: state.setSelectedId,
      deleteEntity: state.deleteEntity,
    })),
  );
  const connectedPorts = data.connectedPorts ?? EMPTY_CONNECTED_PORTS;

  const renderPort = (port: PortSpec, direction: PortDirection) => {
    const connected = portIsConnected(connectedPorts, direction, port.key);
    const isCompatible = compatiblePortKeys.has(port.key);
    const isPending = pendingPortKey === port.key;
    const side = direction === "input" ? "input" : "output";
    const handleSide = direction === "input" ? "in" : "out";
    const position = direction === "input" ? Position.Left : Position.Right;
    const relationWord = direction === "input" ? "for" : "from";
    // An editable, still-unconnected port IS the "add a downstream node" affordance: clicking it opens
    // the same searchable picker as dragging the port out to empty canvas (openPortPicker). The old
    // separate "+" badge was dropped — it overlapped the port icon and duplicated this exact action.
    const isAddable = port.editable && !connected;
    const actionLabel = port.editable ? (connected ? "Connected" : "Start") : connected ? "Linked" : "Readonly";
    const ariaLabel = isAddable
      ? `Add a node to ${port.label} of ${data.title}`
      : `${actionLabel} ${port.label} ${relationWord} ${data.title}`;
    return (
      <div
        className={`sbc-port sbc-port--${side} ${connected ? "is-connected" : ""}${isCompatible ? " is-compatible" : ""}${isPending ? " is-pending" : ""}${isAddable ? " is-addable" : ""}`}
        key={port.key}
        role="button"
        tabIndex={0}
        title={port.label}
        aria-label={ariaLabel}
        data-port-type={port.key}
        data-port-node-kind={port.nodeKind}
        data-port-node-type={port.nodeType}
        data-port-mode={port.mode}
        data-editable={port.editable ? "true" : "false"}
        data-connected={connected ? "true" : "false"}
        onClick={(event) => {
          event.stopPropagation();
          if (isAddable) openPortPicker(id, port.key);
        }}
        onKeyDown={
          isAddable
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  openPortPicker(id, port.key);
                }
              }
            : undefined
        }
      >
        <Handle
          id={port.key}
          className={`sbc-handle sbc-handle--${handleSide} sbc-handle--target${isCompatible ? " valid" : ""}`}
          type="target"
          position={position}
          isConnectable={port.editable}
        />
        <Handle
          id={port.key}
          className={`sbc-handle sbc-handle--${handleSide} sbc-handle--source${isCompatible ? " valid" : ""}`}
          type="source"
          position={position}
          isConnectable={port.editable}
        />
        <port.icon size={15} />
        <span className="sbc-port__label">{port.label}</span>
        {port.editable && connected && !port.aggregate ? (
          <button
            className="sbc-port__action nodrag"
            type="button"
            aria-label={`Disconnect ${port.label} ${relationWord} ${data.title}`}
            onClick={(event) => {
              event.stopPropagation();
              disconnectPort(id, port.key);
            }}
          >
            <Trash2 size={10} />
          </button>
        ) : null}
      </div>
    );
  };

  // Connected ports stay in the centered flow column; unconnected ones go to the hover/drag-revealed
  // overlay. Split per direction so each column centers on just its connected ports.
  const splitPorts = (ports: PortSpec[], direction: PortDirection) => ({
    connected: ports.filter((port) => portIsConnected(connectedPorts, direction, port.key)),
    extra: ports.filter((port) => !portIsConnected(connectedPorts, direction, port.key)),
  });
  const leftPorts = splitPorts(inputPorts, "input");
  const rightPorts = splitPorts(outputPorts, "output");

  const isDeprecated = data.kind === "outbound" && data.type === "block";
  const isNotice = data.kind === "notice";

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
          {leftPorts.connected.map((port) => renderPort(port, "input"))}
          <div className="sbc-node__ports-extra" data-testid="node-left-ports-extra">
            {leftPorts.extra.map((port) => renderPort(port, "input"))}
          </div>
        </div>

        <div className="sbc-node__ports sbc-node__ports--right" data-testid="node-right-ports">
          {rightPorts.connected.map((port) => renderPort(port, "output"))}
          <div className="sbc-node__ports-extra" data-testid="node-right-ports-extra">
            {rightPorts.extra.map((port) => renderPort(port, "output"))}
          </div>
        </div>

        <div className="sbc-node__summary">
          <div className="sbc-node__status">
            <StatusIcon size={16} />
          </div>
          <div className="sbc-node__title">{data.title}</div>
          <div className="sbc-node__subtitle">{data.subtitle}</div>
        </div>

        {!isNotice ? (
          <>
            <button
              className="sbc-node__delete"
              type="button"
              aria-label={`Delete ${data.title}`}
              onClick={(event) => {
                event.stopPropagation();
                deleteEntity(data.ref);
              }}
            >
              <Trash2 size={14} />
            </button>
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
                aria-label={`${data.connections} downstream connections for ${data.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedId(id);
                }}
              >
                <CirclePlus size={15} />
                {data.connections}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
