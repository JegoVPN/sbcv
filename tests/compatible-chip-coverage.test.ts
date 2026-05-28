import { describe, expect, it } from "vitest";
import { deriveGraph } from "../src/canvas/graph";
import { useProjectStore } from "../src/state/useProjectStore";

// A0 / W2 guardrail (Pass-2 T8; Codex C1-9/12/15), resolved by A8a (canvas-connect-legibility).
// Every "+" compatible chip advertised by graph.ts must have a working branch in
// useProjectStore.createCompatible. A8a closed the gap two ways: the selector/urltest proxy chips now map
// through the creatable-outbound registry (`outboundTypeForChipLabel`) and create + attach a member; the
// chips with no cheap creator — "Shadowsocks Inbound" (ssm-api), "Tailscale Endpoint" (cert-provider/derp),
// and "WireGuard" (an endpoint, not a creatable outbound) — were pruned from graph.ts.
//
// This probes createCompatible BEHAVIORALLY rather than against a hard-coded handled list: for each
// advertised (node, chip) pair it invokes createCompatible and checks whether canonical config changed. No
// advertised chip may leave config unchanged.
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
  it("sanity: the fixture advertises handled outbound chips and no longer advertises the pruned ones", () => {
    loadFixture();
    const chips = new Set(advertisedPairs().map((pair) => pair.chip));
    expect(chips.has("Route")).toBe(true); // handled
    expect(chips.has("VMess")).toBe(true); // now handled via the outbound chip registry (A8a)
    expect(chips.has("Shadowsocks Inbound")).toBe(false); // pruned — ssm-api inbound creator out of scope
    expect(chips.has("Tailscale Endpoint")).toBe(false); // pruned — cert-provider/derp endpoint creator out of scope
    expect(chips.has("WireGuard")).toBe(false); // pruned — WireGuard is an endpoint, not a creatable outbound
  });

  it("every advertised compatible chip mutates canonical config via createCompatible", () => {
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
