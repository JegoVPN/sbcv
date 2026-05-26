import type { Edge, Node } from "@xyflow/react";
import type { Diagnostic, EntityRef, SingBoxConfig } from "../domain/types";
import type { ProjectLayout } from "../domain/types";

export type SbcNodeKind =
  | "inbound"
  | "route"
  | "route-rule"
  | "dns"
  | "dns-server"
  | "dns-rule"
  | "outbound"
  | "settings";

export type SbcNodeData = {
  ref: EntityRef;
  kind: SbcNodeKind;
  type: string;
  title: string;
  subtitle: string;
  status: "valid" | "warning" | "error";
  compatible: string[];
};

export type SbcFlowNode = Node<SbcNodeData, "sbc">;

const DEFAULT_POSITIONS: Record<string, { x: number; y: number }> = {
  "route:main": { x: 420, y: 260 },
  "dns:main": { x: 420, y: 620 },
};
const MAX_VISUAL_RULE_NODES = 24;
const MAX_VISUAL_CANDIDATE_EDGES = 96;

function nodePosition(layout: ProjectLayout, id: string, fallback: { x: number; y: number }) {
  return layout.positions[id] ?? DEFAULT_POSITIONS[id] ?? fallback;
}

function makeNode(
  id: string,
  data: SbcNodeData,
  layout: ProjectLayout,
  fallback: { x: number; y: number },
): SbcFlowNode {
  return {
    id,
    type: "sbc",
    position: nodePosition(layout, id, fallback),
    data,
  };
}

function diagnosticStatus(pathPrefix: string, diagnostics: Diagnostic[]): SbcNodeData["status"] {
  const scoped = diagnostics.filter((diagnostic) =>
    diagnostic.path.startsWith(pathPrefix),
  );
  if (scoped.some((diagnostic) => diagnostic.level === "error")) return "error";
  if (scoped.some((diagnostic) => diagnostic.level === "warning")) return "warning";
  return "valid";
}

function listLabel(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value.join(", ");
  return value;
}

function listItems<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function entityTag(tag: string | undefined, kind: string, index: number) {
  return tag && tag.trim() ? tag : `untagged-${kind}-${index + 1}`;
}

export function deriveGraph(config: SingBoxConfig, layout: ProjectLayout, diagnostics: Diagnostic[]) {
  const nodes: SbcFlowNode[] = [];
  const edges: Edge[] = [];
  const inbounds = listItems(config.inbounds);
  const outbounds = listItems(config.outbounds);
  const routeRules = listItems(config.route?.rules);
  const dnsServers = listItems(config.dns?.servers);
  const dnsRules = listItems(config.dns?.rules);
  let visualCandidateEdges = 0;

  inbounds.forEach((inbound, index) => {
    const tag = entityTag(inbound.tag, "inbound", index);
    const id = `inbound:${tag}`;
    nodes.push(
      makeNode(
        id,
        {
          ref: { kind: "inbound", tag },
          kind: "inbound",
          type: inbound.type,
          title: tag,
          subtitle: `${inbound.type} inbound`,
          status: diagnosticStatus(`/inbounds/${index}`, diagnostics),
          compatible: ["Route"],
        },
        layout,
        { x: 80, y: 160 + index * 180 },
      ),
    );
    if (config.route) {
      edges.push({
        id: `edge:inbound:${tag}:route`,
        source: id,
        target: "route:main",
        animated: true,
        label: "traffic",
      });
    }
  });

  if (config.route) {
    const visualizeRouteRules = routeRules.length <= MAX_VISUAL_RULE_NODES;
    nodes.push(
      makeNode(
        "route:main",
        {
          ref: { kind: "route", id: "main" },
          kind: "route",
          type: "route",
          title: "Route",
          subtitle: `${routeRules.length} ordered rules`,
          status: diagnosticStatus("/route", diagnostics),
          compatible: ["Direct", "Block", "Selector", "URLTest", "SOCKS"],
        },
        layout,
        { x: 420, y: 240 },
      ),
    );

    if (visualizeRouteRules) {
      routeRules.forEach((rule, index) => {
        const id = `route-rule:${index}`;
        const label =
          listLabel(rule.domain_suffix) ??
          listLabel(rule.domain_keyword) ??
          listLabel(rule.domain) ??
          listLabel(rule.rule_set) ??
          rule.action ??
          "match rule";
        nodes.push(
          makeNode(
            id,
            {
              ref: { kind: "route-rule", index },
              kind: "route-rule",
              type: "route-rule",
              title: `Rule ${index + 1}`,
              subtitle: label,
              status: diagnosticStatus(`/route/rules/${index}`, diagnostics),
              compatible: ["Direct", "Block", "Selector", "URLTest", "SOCKS"],
            },
            layout,
            { x: 690, y: 120 + index * 130 },
          ),
        );
        edges.push({
          id: `edge:route-rule-order:${index}`,
          source: "route:main",
          target: id,
          label: "ordered",
        });
        if (rule.outbound) {
          edges.push({
            id: `edge:route-rule:${index}:${rule.outbound}`,
            source: id,
            target: `outbound:${rule.outbound}`,
            label: "outbound",
          });
        }
      });
    }

    if (config.route.final) {
      edges.push({
        id: `edge:route-final:${config.route.final}`,
        source: "route:main",
        target: `outbound:${config.route.final}`,
        label: "final",
        animated: true,
      });
    }
  }

  outbounds.forEach((outbound, index) => {
    const tag = entityTag(outbound.tag, "outbound", index);
    const id = `outbound:${tag}`;
    nodes.push(
      makeNode(
        id,
        {
          ref: { kind: "outbound", tag },
          kind: "outbound",
          type: outbound.type,
          title: tag,
          subtitle:
            Array.isArray(outbound.outbounds) &&
            outbound.outbounds.length &&
            (outbound.type === "selector" || outbound.type === "urltest")
              ? `${outbound.type}: ${outbound.outbounds.join(", ")}`
              : outbound.server
                ? `${outbound.type} ${outbound.server}:${outbound.server_port ?? ""}`
                : `${outbound.type} outbound`,
          status: diagnosticStatus(`/outbounds/${index}`, diagnostics),
          compatible:
            outbound.type === "selector" || outbound.type === "urltest"
              ? ["SOCKS", "Direct", "Block"]
              : [],
        },
        layout,
        { x: outbound.type === "selector" || outbound.type === "urltest" ? 970 : 1240, y: 120 + index * 120 },
      ),
    );

    if (Array.isArray(outbound.outbounds)) {
      outbound.outbounds.forEach((candidateTag, candidateIndex) => {
        if (visualCandidateEdges >= MAX_VISUAL_CANDIDATE_EDGES) return;
        visualCandidateEdges += 1;
        edges.push({
          id: `edge:${outbound.type}:${tag}:${candidateIndex}:${candidateTag}`,
          source: id,
          target: `outbound:${candidateTag}`,
          label: "candidate",
        });
      });
    }
  });

  if (config.dns) {
    const visualizeDnsRules = dnsRules.length <= MAX_VISUAL_RULE_NODES;
    nodes.push(
      makeNode(
        "dns:main",
        {
          ref: { kind: "dns", id: "main" },
          kind: "dns",
          type: "dns",
          title: "DNS",
          subtitle: `${dnsRules.length} ordered rules`,
          status: diagnosticStatus("/dns", diagnostics),
          compatible: ["DNS Server"],
        },
        layout,
        { x: 420, y: 620 },
      ),
    );

    dnsServers.forEach((server, index) => {
      const tag = entityTag(server.tag, "dns-server", index);
      const id = `dns-server:${tag}`;
      nodes.push(
        makeNode(
          id,
          {
            ref: { kind: "dns-server", tag },
            kind: "dns-server",
            type: server.type,
            title: tag,
            subtitle: `${server.type} dns server`,
            status: diagnosticStatus(`/dns/servers/${index}`, diagnostics),
            compatible: [],
          },
          layout,
          { x: 880, y: 560 + index * 120 },
        ),
      );
    });

    if (visualizeDnsRules) {
      dnsRules.forEach((rule, index) => {
        const id = `dns-rule:${index}`;
        nodes.push(
          makeNode(
            id,
            {
              ref: { kind: "dns-rule", index },
              kind: "dns-rule",
              type: "dns-rule",
              title: `DNS Rule ${index + 1}`,
              subtitle:
                listLabel(rule.domain_suffix) ??
                listLabel(rule.domain_keyword) ??
                listLabel(rule.domain) ??
                listLabel(rule.rule_set) ??
                rule.action ??
                "dns match",
              status: diagnosticStatus(`/dns/rules/${index}`, diagnostics),
              compatible: ["DNS Server"],
            },
            layout,
            { x: 670, y: 580 + index * 120 },
          ),
        );
        edges.push({
          id: `edge:dns-rule-order:${index}`,
          source: "dns:main",
          target: id,
          label: "ordered",
        });
        if (rule.server) {
          edges.push({
            id: `edge:dns-rule:${index}:${rule.server}`,
            source: id,
            target: `dns-server:${rule.server}`,
            label: "server",
          });
        }
      });
    }

    if (config.dns.final) {
      edges.push({
        id: `edge:dns-final:${config.dns.final}`,
        source: "dns:main",
        target: `dns-server:${config.dns.final}`,
        label: "final",
      });
    }
  }

  return { nodes, edges };
}
