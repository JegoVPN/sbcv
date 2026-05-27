import { describe, expect, it } from "vitest";
import { deriveGraph, type SbcFlowNode } from "../src/canvas/graph";
import { createStableTunSplitConfig, disconnectEdge } from "../src/domain/commands";
import {
  formatEdgeId,
  parseEdgeId,
  parseNodeId,
  portRelations,
  relationForHandles,
  type PortRelationMode,
} from "../src/domain/portRelationRegistry";
import type { SingBoxConfig } from "../src/domain/types";

const allRelationModes: PortRelationMode[] = ["writable", "readonly", "decorative", "order-only"];

function graphWithBroadPortCoverage() {
  const config = createStableTunSplitConfig();

  config.inbounds = [
    ...(config.inbounds ?? []),
    { type: "shadowsocks", tag: "ss-in", listen: "127.0.0.1", listen_port: 1088, method: "none", password: "" } as never,
  ];
  config.route = {
    ...config.route,
    rules: [
      { domain_suffix: ["cn"], inbound: "tun-in", outbound: "direct", rule_set: "remote-rules" },
      ...(config.route?.rules?.slice(1) ?? []),
    ],
    rule_set: [
      {
        type: "remote",
        tag: "remote-rules",
        format: "binary",
        url: "https://example.com/rules.srs",
        download_detour: "proxy",
      },
    ],
  };
  config.dns = {
    ...config.dns,
    servers: [
      ...(config.dns?.servers ?? []),
      { type: "tailscale", tag: "ts-dns", endpoint: "ts-ep", detour: "proxy", accept_default_resolvers: false },
      { type: "resolved", tag: "resolved-dns", service: "resolved-svc" } as never,
    ],
    rules: [{ domain_suffix: ["cn"], inbound: "tun-in", server: "local-dns", rule_set: "remote-rules" }],
  };
  config.endpoints = [
    { type: "tailscale", tag: "ts-ep", detour: "proxy" },
  ];
  config.certificate_providers = [
    { type: "tailscale", tag: "ts-cert", endpoint: "ts-ep" },
  ];
  config.services = [
    { type: "resolved", tag: "resolved-svc", listen: "127.0.0.53", listen_port: 53 } as never,
    { type: "ssm-api", tag: "ssm", servers: { "/": "ss-in" } } as never,
    { type: "derp", tag: "derp", verify_client_endpoint: "ts-ep" } as never,
    { type: "ccm", tag: "ccm", detour: "proxy" } as never,
  ];
  config.ntp = { enabled: true, server: "time.apple.com", detour: "proxy" } as never;
  config.experimental = {
    clash_api: { external_ui_download_detour: "proxy" },
  };

  return deriveGraph(config, { positions: {} }, []);
}

describe("port relation registry", () => {
  it("parses node and edge ids without dropping colon tag segments", () => {
    expect(parseNodeId("outbound:proxy:sg")).toEqual({ kind: "outbound", value: "proxy:sg" });
    expect(parseNodeId("certificate-provider:cert:edge")).toEqual({ kind: "certificate-provider", value: "cert:edge" });
    expect(parseNodeId("http-client:client:edge")).toEqual({ kind: "http-client", value: "client:edge" });

    const edgeId = formatEdgeId("route-rule", 12, "proxy:sg");
    expect(edgeId).toBe("edge:route-rule:12:proxy%3Asg");
    expect(parseEdgeId(edgeId)).toEqual({ relationId: "route-rule", parts: ["12", "proxy:sg"] });
    expect(parseEdgeId("edge:route-rule:%E0%A4%A")).toBeNull();
    expect(() => formatEdgeId("route:rule", 12)).toThrow(/Relation id cannot contain/);
  });

  it("keeps relation ids unique", () => {
    const ids = portRelations.map((relation) => relation.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("matches writable handles while excluding visual-only relations from writable validation", () => {
    expect(
      relationForHandles("route", "route", "outbound", "outbound", "direct", "route")?.id,
    ).toBe("route-final");

    expect(
      relationForHandles("route", "route", "route-rule", "route-rule", "route-rule", "route", ["writable"]),
    ).toBeUndefined();
    expect(
      relationForHandles("route", "route", "route-rule", "route-rule", "route-rule", "route", allRelationModes)?.mode,
    ).toBe("readonly");

    expect(
      relationForHandles("dns-server", "resolved", "service", "service", "resolved", "dns-server", ["writable"]),
    ).toMatchObject({ id: "dns-server-service" });
    expect(
      relationForHandles("dns-server", "resolved", "service", "service", "resolved", "dns-server", allRelationModes)?.mode,
    ).toBe("writable");

    expect(
      relationForHandles("settings", "ntp", "dial-detour", "outbound", "direct", "detour-target", ["writable"])?.id,
    ).toBe("settings-ntp-detour");
    expect(
      relationForHandles("settings", "experimental", "clash-download-detour", "outbound", "direct", "clash-download-detour", ["writable"])?.id,
    ).toBe("clash-api-download-detour");
    expect(
      relationForHandles("certificate-provider", "tailscale", "endpoint", "endpoint", "tailscale", "certificate-provider", ["writable"])?.id,
    ).toBe("certificate-provider-endpoint");
  });

  it("keeps every rendered graph edge explainable by the registry", () => {
    const { nodes, edges } = graphWithBroadPortCoverage();
    const nodeById = new Map<string, SbcFlowNode>(nodes.map((node) => [node.id, node]));

    for (const edge of edges) {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      expect(source, `${edge.id} source node`).toBeDefined();
      expect(target, `${edge.id} target node`).toBeDefined();

      const parsed = parseEdgeId(edge.id);
      const relation = relationForHandles(
        source!.data.kind,
        source!.data.type,
        edge.sourceHandle,
        target!.data.kind,
        target!.data.type,
        edge.targetHandle,
        allRelationModes,
      );

      expect(parsed, edge.id).toBeDefined();
      expect(relation?.id, edge.id).toBe(parsed?.relationId);
    }
  });

  it("precomputes connected port state in graph data for node rendering", () => {
    const { nodes } = graphWithBroadPortCoverage();
    const nodeById = new Map(nodes.map((node) => [node.id, node]));

    expect(nodeById.get("inbound:tun-in")?.data.connectedPorts?.output).toEqual(
      expect.arrayContaining(["route", "route-rule-match", "dns-rule-match"]),
    );
    expect(nodeById.get("route:main")?.data.connectedPorts).toMatchObject({
      input: expect.arrayContaining(["inbound"]),
      output: expect.arrayContaining(["outbound", "route-rule"]),
    });
    expect(nodeById.get("route-rule:0")?.data.connectedPorts).toMatchObject({
      input: expect.arrayContaining(["inbound", "route"]),
      output: expect.arrayContaining(["outbound", "rule-set"]),
    });
    expect(nodeById.get("dns:main")?.data.connectedPorts?.output).toEqual(
      expect.arrayContaining(["dns-rule", "dns-server"]),
    );
    expect(nodeById.get("dns-server:resolved-dns")?.data.connectedPorts?.output).toEqual(
      expect.arrayContaining(["service"]),
    );
    expect(nodeById.get("endpoint:ts-ep")?.data.connectedPorts).toMatchObject({
      input: expect.arrayContaining(["certificate-provider", "derp-service", "dns-server"]),
      output: expect.arrayContaining(["dial-detour"]),
    });
    expect(nodeById.get("service:ssm")?.data.connectedPorts?.input).toEqual(
      expect.arrayContaining(["managed-inbound"]),
    );
    expect(nodeById.get("certificate-provider:ts-cert")?.data.connectedPorts?.output).toEqual(
      expect.arrayContaining(["endpoint"]),
    );
    expect(nodeById.get("settings:ntp")?.data.connectedPorts?.output).toEqual(
      expect.arrayContaining(["dial-detour"]),
    );
    expect(nodeById.get("settings:experimental")?.data.connectedPorts?.output).toEqual(
      expect.arrayContaining(["clash-download-detour"]),
    );
  });

  it("round-trips colon tags through rendered edge ids and disconnect commands", () => {
    const config: SingBoxConfig = {
      log: { level: "info" },
      inbounds: [{ type: "tun", tag: "tun:in", address: ["172.19.0.1/30"], auto_route: true }],
      outbounds: [
        { type: "direct", tag: "direct:sg" },
        { type: "selector", tag: "selector:grp", outbounds: ["direct:sg"] },
      ],
      dns: {
        servers: [{ type: "local", tag: "dns:local" }],
        rules: [{ inbound: "tun:in", server: "dns:local" }],
        final: "dns:local",
      },
      route: {
        rules: [{ inbound: "tun:in", outbound: "direct:sg" }],
        final: "selector:grp",
      },
    };

    const { edges } = deriveGraph(config, { positions: {} }, []);
    const routeRuleEdgeId = formatEdgeId("route-rule", 0, "direct:sg");
    const selectorEdgeId = formatEdgeId("selector", "selector:grp", 0, "direct:sg");

    expect(edges.map((edge) => edge.id)).toEqual(expect.arrayContaining([routeRuleEdgeId, selectorEdgeId]));
    expect(parseEdgeId(routeRuleEdgeId)?.parts).toEqual(["0", "direct:sg"]);
    expect(parseEdgeId(selectorEdgeId)?.parts).toEqual(["selector:grp", "0", "direct:sg"]);

    const withoutRouteRule = disconnectEdge(config, routeRuleEdgeId);
    expect(withoutRouteRule.route?.rules?.[0]?.outbound).toBeUndefined();

    const withoutSelectorMember = disconnectEdge(config, selectorEdgeId);
    expect(withoutSelectorMember.outbounds?.find((outbound) => outbound.tag === "selector:grp")?.outbounds).toEqual([]);
  });
});
