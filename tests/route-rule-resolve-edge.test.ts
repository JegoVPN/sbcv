import { describe, expect, it } from "vitest";

import { deriveGraph } from "../src/canvas/graph";
import { normalizeRouteRule } from "../src/domain/commands";
import { formatEdgeId } from "../src/domain/portRelationRegistry";
import type { RouteRule, SingBoxConfig } from "../src/domain/types";

// V7-S3: a route rule with the `resolve` action picks a DNS server (route/rule_action.md "resolve" → server).
// That reference was Inspector-only; this promotes it to a writable canvas edge mirroring the dns-rule→server
// edge. `server` is resolve-only, so the edge (and the normalizer) gate on action === "resolve".

const layout = { positions: {} };
const edgesOf = (config: SingBoxConfig) => deriveGraph(config, layout, []).edges;

function routeConfig(rule: Record<string, unknown>): SingBoxConfig {
  return {
    dns: { servers: [{ type: "udp", tag: "boot", server: "1.1.1.1", server_port: 53 }] },
    route: { rules: [rule] },
  } as unknown as SingBoxConfig;
}

describe("V7-S3 — route-rule resolve server edge", () => {
  it("renders a route-rule-resolve edge to dns-server:<tag> for a resolve rule with a server", () => {
    const edge = edgesOf(routeConfig({ action: "resolve", server: "boot", domain_suffix: ["a.com"] })).find(
      (e) => e.id === formatEdgeId("route-rule-resolve", 0, "boot"),
    );
    expect(edge).toMatchObject({
      source: "route-rule:0",
      target: "dns-server:boot",
      sourceHandle: "resolve-server",
      targetHandle: "route-rule-resolve",
    });
  });

  it("does NOT render the edge when the action is not resolve (server is dead there)", () => {
    // A route rule carrying a stale `server` on a non-resolve action must not draw the edge.
    const edges = edgesOf(routeConfig({ action: "route", outbound: "boot", server: "boot" }));
    expect(edges.some((e) => e.id.startsWith("route-rule-resolve:"))).toBe(false);
  });

  it("normalizeRouteRule scrubs `server` off any non-resolve action, keeps it for resolve", () => {
    expect(normalizeRouteRule({ action: "resolve", server: "boot" } as unknown as RouteRule)).toMatchObject({
      action: "resolve",
      server: "boot",
    });
    expect(normalizeRouteRule({ action: "route", outbound: "x", server: "boot" } as unknown as RouteRule)).not.toHaveProperty(
      "server",
    );
  });
});
