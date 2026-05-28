import { describe, expect, it } from "vitest";
import { deriveGraph } from "../src/canvas/graph";
import type { SingBoxConfig } from "../src/domain/types";

// A0 / W2 guardrail (Pass-2 T8; Codex C1-9/12/15).
// Every "+" compatible chip advertised by graph.ts must have a matching branch in
// useProjectStore.createCompatible (src/state/useProjectStore.ts:969-993). Today createCompatible handles
// exactly eight labels; graph.ts advertises 16 more (14 selector/urltest proxy types + "Shadowsocks
// Inbound" + "Tailscale Endpoint"), so those chips are silent no-ops. The `it.fails` asserts the post-fix
// contract (no advertised chip is unhandled); it flips red when A8 (canvas-connect-legibility) wires or
// prunes the dead chips — convert `it.fails` -> `it` at that point.

// Mirrors createCompatible's handled set (useProjectStore.ts:974-993). Keep in sync when A8 lands.
const HANDLED = new Set([
  "Route", "Direct", "Block", "Selector", "URLTest", "SOCKS", "DNS Server", "DNS Tailscale Server",
]);

function coverageFixture(): SingBoxConfig {
  return {
    inbounds: [{ type: "mixed", tag: "in" }],
    outbounds: [
      { type: "direct", tag: "direct" },
      { type: "selector", tag: "proxy", outbounds: ["direct"] },
    ],
    route: { rules: [{ inbound: ["in"], outbound: "direct" }], final: "proxy" },
    dns: { servers: [{ type: "tailscale", tag: "ts-dns", endpoint: "ts-ep" }], rules: [{ server: "ts-dns" }] },
    endpoints: [{ type: "tailscale", tag: "ts-ep" }],
    certificate_providers: [{ type: "tailscale", tag: "ts-cert" }],
    services: [
      { type: "ssm-api", tag: "ssm" },
      { type: "derp", tag: "derp" },
    ],
  } as unknown as SingBoxConfig;
}

function advertisedChips(): string[] {
  const graph = deriveGraph(coverageFixture(), { positions: {} }, []);
  const chips = new Set<string>();
  for (const node of graph.nodes) for (const chip of node.data.compatible ?? []) chips.add(chip);
  return [...chips];
}

describe("compatible-chip coverage (W2 -> A8)", () => {
  it("sanity: the fixture advertises chips and includes the Route chip", () => {
    const chips = advertisedChips();
    expect(chips.length).toBeGreaterThan(0);
    expect(chips).toContain("Route");
  });

  it("documents the dead chips advertised today (blast radius)", () => {
    // Proves the fixture surfaces the selector/urltest proxy list + service chips that have no
    // createCompatible branch. When A8 prunes/wires them, update this list accordingly.
    expect(advertisedChips()).toEqual(expect.arrayContaining([
      "VMess", "Trojan", "VLESS", "WireGuard", "Shadowsocks Inbound", "Tailscale Endpoint",
    ]));
  });

  it.fails("every advertised compatible chip has a createCompatible branch", () => {
    const unhandled = advertisedChips().filter((chip) => !HANDLED.has(chip));
    expect(unhandled).toEqual([]);
  });
});
