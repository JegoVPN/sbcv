import { describe, expect, it } from "vitest";
import { deriveGraph } from "../src/canvas/graph";
import { useProjectStore } from "../src/state/useProjectStore";

// A0 / W2 guardrail (Pass-2 T8; Codex C1-9/12/15).
// Every "+" compatible chip advertised by graph.ts must have a working branch in
// useProjectStore.createCompatible (src/state/useProjectStore.ts:969-1033). Today createCompatible handles
// exactly eight labels; graph.ts advertises 16 more (14 selector/urltest proxy types + "Shadowsocks
// Inbound" + "Tailscale Endpoint"), so clicking those chips is a silent no-op.
//
// This probes createCompatible BEHAVIORALLY rather than against a hard-coded handled list: for each
// advertised (node, chip) pair it invokes createCompatible and checks whether canonical config changed. A
// chip that leaves config unchanged is dead. The `it.fails` therefore flips red whichever way A8
// (canvas-connect-legibility) closes the gap — by wiring the missing branches OR by pruning the chips —
// at which point convert `it.fails` -> `it`.
//
// NOTE: the fixture intentionally omits `route` so the inbound "Route" chip (ensureRoute) actually
// mutates; with a pre-existing route, ensureRoute is idempotent and would be a false "dead" positive.
const FIXTURE = {
  inbounds: [{ type: "mixed", tag: "in" }],
  outbounds: [
    { type: "direct", tag: "direct" },
    { type: "selector", tag: "proxy", outbounds: ["direct"] },
  ],
  dns: { servers: [{ type: "tailscale", tag: "ts-dns", endpoint: "ts-ep" }], rules: [{ server: "ts-dns" }] },
  endpoints: [{ type: "tailscale", tag: "ts-ep" }],
  certificate_providers: [{ type: "tailscale", tag: "ts-cert" }],
  services: [
    { type: "ssm-api", tag: "ssm" },
    { type: "derp", tag: "derp" },
  ],
};

function loadFixture() {
  useProjectStore.getState().importJson(JSON.stringify(FIXTURE));
}

function advertisedPairs(): Array<{ nodeId: string; chip: string }> {
  const graph = deriveGraph(useProjectStore.getState().config, { positions: {} }, []);
  const pairs: Array<{ nodeId: string; chip: string }> = [];
  for (const node of graph.nodes) for (const chip of node.data.compatible ?? []) pairs.push({ nodeId: node.id, chip });
  return pairs;
}

describe("compatible-chip coverage (W2 -> A8)", () => {
  it("sanity: the fixture advertises both handled and currently-dead chips", () => {
    loadFixture();
    const chips = new Set(advertisedPairs().map((pair) => pair.chip));
    expect(chips.has("Route")).toBe(true); // handled
    expect(chips.has("VMess")).toBe(true); // dead (selector proxy chip with no createCompatible branch)
    expect(chips.has("Shadowsocks Inbound")).toBe(true); // dead (ssm-api chip with no branch)
  });

  it.fails("every advertised compatible chip mutates canonical config via createCompatible", () => {
    loadFixture();
    const pairs = advertisedPairs();
    const dead = new Set<string>();
    for (const { nodeId, chip } of pairs) {
      loadFixture();
      const before = useProjectStore.getState().jsonDraft;
      useProjectStore.getState().createCompatible(nodeId, chip);
      if (useProjectStore.getState().jsonDraft === before) dead.add(chip);
    }
    expect([...dead]).toEqual([]);
  });
});
