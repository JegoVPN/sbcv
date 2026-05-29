import type { Connection } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { deriveGraph } from "../src/canvas/graph";
import { disconnectEdge } from "../src/domain/commands";
import { portRelations, type PortNodeKind } from "../src/domain/portRelationRegistry";
import type { SingBoxConfig } from "../src/domain/types";
import { useProjectStore } from "../src/state/useProjectStore";

type Candidate = {
  nodeKind: PortNodeKind;
  nodeType: string;
  handleId: string;
};

type SymmetryCase = {
  relationId: string;
  name: string;
  base: SingBoxConfig;
  sourceId: string;
  sourceHandle: string;
  candidate: Candidate;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function applyChip(caseItem: SymmetryCase) {
  useProjectStore.getState().importJson(JSON.stringify(caseItem.base));
  useProjectStore.getState().createNodeAndConnect(
    caseItem.sourceId,
    caseItem.sourceHandle,
    caseItem.candidate,
    { x: 320, y: 180 },
  );
  const state = useProjectStore.getState();
  if (!state.selectedId) throw new Error(`${caseItem.name}: chip flow did not select created node`);
  return { config: clone(state.config), createdNodeId: state.selectedId };
}

function edgeForCreatedConnection(caseItem: SymmetryCase, config: SingBoxConfig, createdNodeId: string) {
  return deriveGraph(config, { positions: {} }, []).edges.find((edge) => {
    const forward =
      edge.source === caseItem.sourceId &&
      edge.sourceHandle === caseItem.sourceHandle &&
      edge.target === createdNodeId &&
      edge.targetHandle === caseItem.candidate.handleId;
    const reverse =
      edge.target === caseItem.sourceId &&
      edge.targetHandle === caseItem.sourceHandle &&
      edge.source === createdNodeId &&
      edge.sourceHandle === caseItem.candidate.handleId;
    return forward || reverse;
  });
}

function applyDrag(caseItem: SymmetryCase, chipConfig: SingBoxConfig, createdNodeId: string) {
  const edge = edgeForCreatedConnection(caseItem, chipConfig, createdNodeId);
  if (!edge) throw new Error(`${caseItem.name}: chip flow did not emit a graph edge`);
  const baseWithCreatedNode = disconnectEdge(chipConfig, edge.id);

  useProjectStore.getState().importJson(JSON.stringify(baseWithCreatedNode));
  useProjectStore.getState().connectPorts({
    source: caseItem.sourceId,
    sourceHandle: caseItem.sourceHandle,
    target: createdNodeId,
    targetHandle: caseItem.candidate.handleId,
  } satisfies Connection);
  return clone(useProjectStore.getState().config);
}

const cases: SymmetryCase[] = [
  {
    relationId: "route-final",
    name: "route final outbound",
    base: { route: {}, outbounds: [] },
    sourceId: "route:main",
    sourceHandle: "outbound",
    candidate: { nodeKind: "outbound", nodeType: "direct", handleId: "route" },
  },
  {
    relationId: "route-rule",
    name: "route rule outbound",
    base: { route: { rules: [{}] }, outbounds: [] },
    sourceId: "route-rule:0",
    sourceHandle: "outbound",
    candidate: { nodeKind: "outbound", nodeType: "direct", handleId: "route-rule" },
  },
  {
    relationId: "route-rule-inbound",
    name: "route rule inbound matcher",
    base: { inbounds: [{ type: "tun", tag: "tun-in" }], route: { rules: [] } },
    sourceId: "inbound:tun-in",
    sourceHandle: "route-rule-match",
    candidate: { nodeKind: "route-rule", nodeType: "route-rule", handleId: "inbound" },
  },
  {
    relationId: "route-rule-set",
    name: "route rule set",
    base: { route: { rules: [{}], rule_set: [] } },
    sourceId: "route-rule:0",
    sourceHandle: "rule-set",
    candidate: { nodeKind: "rule-set", nodeType: "remote", handleId: "route-rule" },
  },
  {
    relationId: "dns-final",
    name: "dns final server",
    base: { dns: { servers: [] } },
    sourceId: "dns:main",
    sourceHandle: "dns-server",
    candidate: { nodeKind: "dns-server", nodeType: "local", handleId: "dns" },
  },
  {
    relationId: "dns-rule",
    name: "dns rule server",
    base: { dns: { rules: [{}], servers: [] } },
    sourceId: "dns-rule:0",
    sourceHandle: "dns-server",
    candidate: { nodeKind: "dns-server", nodeType: "local", handleId: "dns-rule" },
  },
  {
    relationId: "dns-rule-inbound",
    name: "dns rule inbound matcher",
    base: { inbounds: [{ type: "tun", tag: "tun-in" }], dns: { rules: [] } },
    sourceId: "inbound:tun-in",
    sourceHandle: "dns-rule-match",
    candidate: { nodeKind: "dns-rule", nodeType: "dns-rule", handleId: "inbound" },
  },
  {
    relationId: "dns-rule-set",
    name: "dns rule set",
    base: { dns: { rules: [{}] }, route: { rule_set: [] } },
    sourceId: "dns-rule:0",
    sourceHandle: "rule-set",
    candidate: { nodeKind: "rule-set", nodeType: "remote", handleId: "dns-rule" },
  },
  {
    relationId: "selector",
    name: "selector outbound member",
    base: { outbounds: [{ type: "selector", tag: "select", outbounds: [] }] },
    sourceId: "outbound:select",
    sourceHandle: "outbound-member",
    candidate: { nodeKind: "outbound", nodeType: "direct", handleId: "selector-group" },
  },
  {
    relationId: "urltest",
    name: "urltest outbound member",
    base: { outbounds: [{ type: "urltest", tag: "auto", outbounds: [] }] },
    sourceId: "outbound:auto",
    sourceHandle: "outbound-member",
    candidate: { nodeKind: "outbound", nodeType: "direct", handleId: "urltest-group" },
  },
  {
    relationId: "outbound-detour",
    name: "outbound detour",
    base: { outbounds: [{ type: "socks", tag: "proxy", server: "127.0.0.1", server_port: 1080 }] },
    sourceId: "outbound:proxy",
    sourceHandle: "dial-detour",
    candidate: { nodeKind: "outbound", nodeType: "direct", handleId: "detour-target" },
  },
  {
    relationId: "dns-server-detour",
    name: "dns server detour",
    base: { dns: { servers: [{ type: "https", tag: "remote", server: "1.1.1.1" }] }, outbounds: [] },
    sourceId: "dns-server:remote",
    sourceHandle: "outbound",
    candidate: { nodeKind: "outbound", nodeType: "direct", handleId: "dns-detour" },
  },
  {
    relationId: "dns-server-endpoint",
    name: "dns server endpoint",
    base: { dns: { servers: [{ type: "tailscale", tag: "ts-dns" }] }, endpoints: [] },
    sourceId: "dns-server:ts-dns",
    sourceHandle: "endpoint",
    candidate: { nodeKind: "endpoint", nodeType: "tailscale", handleId: "dns-server" },
  },
  {
    relationId: "dns-server-service",
    name: "dns server resolved service",
    base: { dns: { servers: [{ type: "resolved", tag: "resolved-dns" }] }, services: [] },
    sourceId: "dns-server:resolved-dns",
    sourceHandle: "service",
    candidate: { nodeKind: "service", nodeType: "resolved", handleId: "dns-server" },
  },
  {
    relationId: "endpoint-detour",
    name: "endpoint detour",
    base: { endpoints: [{ type: "wireguard", tag: "wg-ep" }], outbounds: [] },
    sourceId: "endpoint:wg-ep",
    sourceHandle: "dial-detour",
    candidate: { nodeKind: "outbound", nodeType: "direct", handleId: "detour-target" },
  },
  {
    relationId: "service-detour-ccm",
    name: "service detour",
    base: { services: [{ type: "ccm", tag: "ccm" }], outbounds: [] },
    sourceId: "service:ccm",
    sourceHandle: "detour",
    candidate: { nodeKind: "outbound", nodeType: "direct", handleId: "service-detour" },
  },
  {
    relationId: "service-detour-ocm",
    name: "OCM service detour",
    base: { services: [{ type: "ocm", tag: "ocm" }], outbounds: [] },
    sourceId: "service:ocm",
    sourceHandle: "detour",
    candidate: { nodeKind: "outbound", nodeType: "direct", handleId: "service-detour" },
  },
  {
    relationId: "service-verify-endpoint",
    name: "service verify endpoint",
    base: { services: [{ type: "derp", tag: "derp" }], endpoints: [] },
    sourceId: "service:derp",
    sourceHandle: "verify-client-endpoint",
    candidate: { nodeKind: "endpoint", nodeType: "tailscale", handleId: "derp-service" },
  },
  {
    relationId: "service-ssm-inbound",
    name: "managed shadowsocks inbound service",
    base: { inbounds: [], services: [{ type: "ssm-api", tag: "ssm", servers: {} }] },
    sourceId: "service:ssm",
    sourceHandle: "managed-inbound",
    candidate: { nodeKind: "inbound", nodeType: "shadowsocks", handleId: "service" },
  },
  {
    relationId: "rule-set-download",
    name: "rule set download detour",
    base: { route: { rule_set: [{ type: "remote", tag: "remote-rules" }] }, outbounds: [] },
    sourceId: "rule-set:remote-rules",
    sourceHandle: "download-detour",
    candidate: { nodeKind: "outbound", nodeType: "direct", handleId: "rule-set-download" },
  },
  {
    relationId: "clash-api-download-detour",
    name: "clash api download detour",
    base: { experimental: { clash_api: {} }, outbounds: [] },
    sourceId: "settings:experimental",
    sourceHandle: "clash-download-detour",
    candidate: { nodeKind: "outbound", nodeType: "direct", handleId: "clash-download-detour" },
  },
  {
    relationId: "certificate-provider-endpoint",
    name: "certificate provider endpoint",
    base: { certificate_providers: [{ type: "tailscale", tag: "ts-cert" }], endpoints: [] },
    sourceId: "certificate-provider:ts-cert",
    sourceHandle: "endpoint",
    candidate: { nodeKind: "endpoint", nodeType: "tailscale", handleId: "certificate-provider" },
  },
  {
    relationId: "settings-ntp-detour",
    name: "ntp detour",
    base: { ntp: { enabled: true, server: "time.apple.com" }, outbounds: [] },
    sourceId: "settings:ntp",
    sourceHandle: "dial-detour",
    candidate: { nodeKind: "outbound", nodeType: "direct", handleId: "detour-target" },
  },
  {
    relationId: "dial-domain-resolver",
    name: "outbound domain resolver",
    base: { outbounds: [{ type: "socks", tag: "px", server: "1.2.3.4", server_port: 1080 }], dns: { servers: [] } },
    sourceId: "outbound:px",
    sourceHandle: "domain-resolver",
    candidate: { nodeKind: "dns-server", nodeType: "local", handleId: "domain-resolver-target" },
  },
  {
    relationId: "endpoint-domain-resolver",
    name: "endpoint domain resolver",
    base: { endpoints: [{ type: "wireguard", tag: "wg-ep" }], dns: { servers: [] } },
    sourceId: "endpoint:wg-ep",
    sourceHandle: "domain-resolver",
    candidate: { nodeKind: "dns-server", nodeType: "local", handleId: "domain-resolver-target" },
  },
  {
    relationId: "dns-server-domain-resolver",
    name: "dns server domain resolver",
    base: { dns: { servers: [{ type: "https", tag: "doh", server: "1.1.1.1" }] } },
    sourceId: "dns-server:doh",
    sourceHandle: "domain-resolver",
    candidate: { nodeKind: "dns-server", nodeType: "local", handleId: "domain-resolver-target" },
  },
  {
    relationId: "route-default-http-client",
    name: "route default http client",
    base: { route: {}, http_clients: [] },
    sourceId: "route:main",
    sourceHandle: "default-http-client",
    candidate: { nodeKind: "http-client", nodeType: "http-client", handleId: "http-client-ref" },
  },
  {
    relationId: "rule-set-http-client",
    name: "rule set http client",
    base: { route: { rule_set: [{ type: "remote", tag: "rs", format: "binary", url: "https://example.com/r.srs" }] } },
    sourceId: "rule-set:rs",
    sourceHandle: "http-client",
    candidate: { nodeKind: "http-client", nodeType: "http-client", handleId: "http-client-ref" },
  },
  {
    relationId: "certificate-provider-http-client",
    name: "certificate provider http client",
    base: { certificate_providers: [{ type: "acme", tag: "cp", domain: ["example.com"] }] },
    sourceId: "certificate-provider:cp",
    sourceHandle: "http-client",
    candidate: { nodeKind: "http-client", nodeType: "http-client", handleId: "http-client-ref" },
  },
  {
    relationId: "http-client-detour",
    name: "http client dial detour",
    base: { http_clients: [{ tag: "hc" }], outbounds: [] },
    sourceId: "http-client:hc",
    sourceHandle: "dial-detour",
    candidate: { nodeKind: "outbound", nodeType: "direct", handleId: "detour-target" },
  },
];

describe("chip-create and drag-connect symmetry", () => {
  it("has an executable symmetry case for every writable registry relation", () => {
    const writableRelationIds = portRelations
      .filter((relation) => relation.mode === "writable")
      .map((relation) => relation.id)
      .sort();
    const coveredRelationIds = cases.map((caseItem) => caseItem.relationId).sort();

    expect(coveredRelationIds).toEqual(writableRelationIds);
  });

  it.each(cases)("$name converges to the same canonical config", (caseItem) => {
    const chip = applyChip(caseItem);
    const dragConfig = applyDrag(caseItem, chip.config, chip.createdNodeId);

    expect(dragConfig).toEqual(chip.config);
  });
});
