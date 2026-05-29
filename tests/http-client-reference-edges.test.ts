import { describe, expect, it } from "vitest";

import { deriveGraph } from "../src/canvas/graph";
import { disconnectEdge } from "../src/domain/commands";
import { formatEdgeId, relationForHandles } from "../src/domain/portRelationRegistry";
import type { SingBoxConfig } from "../src/domain/types";

// C11c (G7): the http_client cross-object references (route.default_http_client, rule_set[*].http_client,
// certificate_providers[*].http_client — all 1.14-only strings naming a top-level http_clients[] entry)
// plus the shared HTTP-client object's own dial `detour` become writable, testing-gated edges, so the
// http-client node stops floating. Source: testing/configuration/shared/http-client.md. The object form of
// an http_client value is inline (no tag) and is intentionally NOT edged — same as the C1-20 diagnostic.

const layout = { positions: {} };
const testingEdges = (config: SingBoxConfig) => deriveGraph(config, layout, [], "testing").edges;
const stableEdges = (config: SingBoxConfig) => deriveGraph(config, layout, [], "stable").edges;
const testingNode = (config: SingBoxConfig, id: string) =>
  deriveGraph(config, layout, [], "testing").nodes.find((node) => node.id === id);
const stableNode = (config: SingBoxConfig, id: string) =>
  deriveGraph(config, layout, [], "stable").nodes.find((node) => node.id === id);

function configWithRefs(): SingBoxConfig {
  return {
    http_clients: [{ tag: "hc", detour: "out" }],
    outbounds: [{ type: "direct", tag: "out" }],
    route: {
      default_http_client: "hc",
      rule_set: [{ type: "remote", tag: "rs", format: "binary", url: "https://example.com/r.srs", http_client: "hc" }],
    },
    certificate_providers: [{ type: "acme", tag: "cp", domain: ["example.com"], http_client: "hc" }],
  } as unknown as SingBoxConfig;
}

describe("C11c — http_client reference edges (testing-gated)", () => {
  it("renders route.default_http_client → http-client on testing", () => {
    const edge = testingEdges(configWithRefs()).find((e) => e.id === formatEdgeId("route-default-http-client", "hc"));
    expect(edge).toMatchObject({
      source: "route:main",
      target: "http-client:hc",
      sourceHandle: "default-http-client",
      targetHandle: "http-client-ref",
      deletable: true,
    });
  });

  it("renders rule_set[*].http_client → http-client on testing", () => {
    const edge = testingEdges(configWithRefs()).find((e) => e.id === formatEdgeId("rule-set-http-client", "rs", "hc"));
    expect(edge).toMatchObject({ source: "rule-set:rs", target: "http-client:hc", sourceHandle: "http-client", targetHandle: "http-client-ref" });
  });

  it("renders certificate_providers[*].http_client → http-client on testing", () => {
    const edge = testingEdges(configWithRefs()).find((e) => e.id === formatEdgeId("certificate-provider-http-client", "cp", "hc"));
    expect(edge).toMatchObject({ source: "certificate-provider:cp", target: "http-client:hc", sourceHandle: "http-client", targetHandle: "http-client-ref" });
  });

  it("renders the shared HTTP-client object's own detour → outbound on testing", () => {
    const edge = testingEdges(configWithRefs()).find((e) => e.id === formatEdgeId("http-client-detour", "hc", "out"));
    expect(edge).toMatchObject({ source: "http-client:hc", target: "outbound:out", sourceHandle: "dial-detour", targetHandle: "detour-target" });
  });

  it("suppresses every http_client edge on stable", () => {
    const ids = new Set(stableEdges(configWithRefs()).map((e) => e.id));
    expect([...ids].some((id) => id.startsWith("edge:route-default-http-client"))).toBe(false);
    expect([...ids].some((id) => id.startsWith("edge:rule-set-http-client"))).toBe(false);
    expect([...ids].some((id) => id.startsWith("edge:certificate-provider-http-client"))).toBe(false);
    expect([...ids].some((id) => id.startsWith("edge:http-client-detour"))).toBe(false);
  });

  it("does not edge an inline object-form http_client (no tag to resolve)", () => {
    const config = {
      http_clients: [{ tag: "hc" }],
      route: { default_http_client: { engine: "go", detour: "out" } },
      outbounds: [{ type: "direct", tag: "out" }],
    } as unknown as SingBoxConfig;
    expect(testingEdges(config).some((e) => e.id.startsWith("edge:route-default-http-client"))).toBe(false);
  });

  it("does not edge a string ref that names no http-client", () => {
    const config = { route: { default_http_client: "ghost" } } as unknown as SingBoxConfig;
    expect(testingEdges(config).some((e) => e.id.startsWith("edge:route-default-http-client"))).toBe(false);
  });

  it("lights the http-client input dot on testing only", () => {
    expect(testingNode(configWithRefs(), "http-client:hc")?.data.connectedPorts?.input ?? []).toContain("http-client-ref");
    expect(stableNode(configWithRefs(), "http-client:hc")?.data.connectedPorts?.input ?? []).not.toContain("http-client-ref");
  });

  it("relationForHandles resolves all four http_client relations", () => {
    expect(relationForHandles("route", "route", "default-http-client", "http-client", "http-client", "http-client-ref")?.id).toBe("route-default-http-client");
    expect(relationForHandles("rule-set", "remote", "http-client", "http-client", "http-client", "http-client-ref")?.id).toBe("rule-set-http-client");
    expect(relationForHandles("certificate-provider", "acme", "http-client", "http-client", "http-client", "http-client-ref")?.id).toBe("certificate-provider-http-client");
    expect(relationForHandles("http-client", "http-client", "dial-detour", "outbound", "direct", "detour-target")?.id).toBe("http-client-detour");
  });

  it("disconnect clears each http_client reference", () => {
    const afterRoute = disconnectEdge(configWithRefs(), formatEdgeId("route-default-http-client", "hc"));
    expect((afterRoute.route as Record<string, unknown>).default_http_client).toBeUndefined();

    const afterRuleSet = disconnectEdge(configWithRefs(), formatEdgeId("rule-set-http-client", "rs", "hc"));
    expect((afterRuleSet.route?.rule_set?.[0] as Record<string, unknown>).http_client).toBeUndefined();

    const afterCert = disconnectEdge(configWithRefs(), formatEdgeId("certificate-provider-http-client", "cp", "hc"));
    expect((afterCert.certificate_providers?.[0] as Record<string, unknown>).http_client).toBeUndefined();

    const afterDetour = disconnectEdge(configWithRefs(), formatEdgeId("http-client-detour", "hc", "out"));
    expect((afterDetour.http_clients?.[0] as Record<string, unknown>).detour).toBeUndefined();
  });
});
