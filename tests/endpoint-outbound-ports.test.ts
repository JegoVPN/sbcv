import { describe, expect, it } from "vitest";
import { relationForHandles } from "../src/domain/portRelationRegistry";
import { deriveGraph } from "../src/canvas/graph";
import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxConfig } from "../src/domain/types";

// A7b guardrail (endpoint-outbound-half, canvas). The five outbound-target relations are broadened so an
// endpoint node (WireGuard or Tailscale) is a valid downstream target — it exposes the same input ports an
// outbound does (route, route-rule, selector-group, urltest-group, dns-detour), the registry can explain a
// route/selector/dns edge into it, and deriveGraph wires that edge to the `endpoint:<tag>` node rather than
// a non-existent `outbound:<tag>`. (Audit endpoint-wireguard P0-2 / _SUMMARY T14; migration.md:221-223.)

function asConfig(value: unknown): SingBoxConfig {
  return value as SingBoxConfig;
}

const TARGET_RELATIONS: Array<[string, string, string, string]> = [
  // [sourceKind, sourceHandle, inputHandle, relationId]
  ["route", "outbound", "route", "route-final"],
  ["route-rule", "outbound", "route-rule", "route-rule"],
  ["dns-server", "outbound", "dns-detour", "dns-server-detour"],
];

describe("endpoint outbound-half — endpoint nodes as outbound targets (A7b)", () => {
  for (const type of ["wireguard", "tailscale"]) {
    for (const [sourceKind, sourceHandle, inputHandle, relationId] of TARGET_RELATIONS) {
      it(`resolves ${relationId} into a ${type} endpoint target`, () => {
        const sourceType = sourceKind === "dns-server" ? "https" : sourceKind;
        expect(
          relationForHandles(
            sourceKind as never,
            sourceType,
            sourceHandle,
            "endpoint",
            type,
            inputHandle,
            ["writable"],
          )?.id,
        ).toBe(relationId);
      });
    }

    it(`resolves selector/urltest membership into a ${type} endpoint`, () => {
      expect(
        relationForHandles("outbound", "selector", "outbound-member", "endpoint", type, "selector-group", ["writable"])?.id,
      ).toBe("selector");
      expect(
        relationForHandles("outbound", "urltest", "outbound-member", "endpoint", type, "urltest-group", ["writable"])?.id,
      ).toBe("urltest");
    });
  }

  it("wires a route.final edge to the endpoint node, not a phantom outbound node", () => {
    const config = asConfig({
      endpoints: [{ type: "wireguard", tag: "wg", address: ["10.0.0.2/32"], private_key: "k", peers: [] }],
      route: { final: "wg" },
    });
    const { edges } = deriveGraph(config, { positions: {} }, validateConfig(config, "testing"));
    const finalEdge = edges.find((edge) => edge.id === "edge:route-final:wg");
    expect(finalEdge?.target).toBe("endpoint:wg");
    expect(finalEdge?.targetHandle).toBe("route");
  });

  it("wires a selector member edge to the endpoint node", () => {
    const config = asConfig({
      outbounds: [{ type: "selector", tag: "auto", outbounds: ["wg"] }],
      endpoints: [{ type: "wireguard", tag: "wg", address: ["10.0.0.2/32"], private_key: "k", peers: [] }],
    });
    const { edges } = deriveGraph(config, { positions: {} }, validateConfig(config, "testing"));
    const memberEdge = edges.find((edge) => edge.target === "endpoint:wg" && edge.targetHandle === "selector-group");
    expect(memberEdge).toBeDefined();
  });

  it("wires a dns-server detour edge to the endpoint node", () => {
    const config = asConfig({
      endpoints: [{ type: "wireguard", tag: "wg", address: ["10.0.0.2/32"], private_key: "k", peers: [] }],
      dns: { servers: [{ type: "https", tag: "doh", server: "1.1.1.1", detour: "wg" }] },
    });
    const { edges } = deriveGraph(config, { positions: {} }, validateConfig(config, "testing"));
    const detourEdge = edges.find((edge) => edge.id === "edge:dns-server-detour:doh:wg");
    expect(detourEdge?.target).toBe("endpoint:wg");
    expect(detourEdge?.targetHandle).toBe("dns-detour");
  });
});
