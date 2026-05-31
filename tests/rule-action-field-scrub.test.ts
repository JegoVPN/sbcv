import { describe, expect, it } from "vitest";
import { parseConfigJson, stringifyConfig } from "../src/domain/serialization";

// L4-rule-field-scrub (A10d-rest): A10d scrubbed a stale `server`/`outbound` on rules whose action
// doesn't allow it. This extends the same import-boundary scrub to the other action-exclusive
// rule-output fields (verified against sing-box 1.14 rule_action docs):
//   - dns/route reject-only: `method`, `no_drop`
//   - dns predefined-only:   `rcode`, `answer`, `ns`, `extra`
// U13 — also scrub the remaining action-specific route fields when the rule's action changes away from
// the action that owns them:
//   - sniff-only:   `sniffer` (timeout is sniff OR resolve — see below)
//   - resolve-only: `strategy`, `disable_cache`, `disable_optimistic_cache`, `rewrite_ttl`, `client_subnet`
//   - sniff|resolve: `timeout` (sniff timeout AND the 1.14 resolve query timeout share the key)
//   - route-options group (override_*/network_strategy/fallback_*/udp_*/tls_*): valid on
//     route/route-options/bypass only — KEPT there (a route rule legitimately carries them), scrubbed
//     elsewhere. `network_type` is a MATCH field (every action), so it is NOT in the group.

function importConfig(config: unknown) {
  return parseConfigJson(JSON.stringify(config));
}

describe("L4-rule-field-scrub — dns-rule action-exclusive fields", () => {
  it("scrubs reject-only method/no_drop from a non-reject dns rule", () => {
    const rule = importConfig({ dns: { rules: [{ action: "route", server: "s", method: "drop", no_drop: true }] } }).dns?.rules?.[0] as Record<string, unknown>;
    expect(rule).not.toHaveProperty("method");
    expect(rule).not.toHaveProperty("no_drop");
    expect(rule.server).toBe("s"); // route keeps server
  });

  it("keeps method/no_drop on a reject dns rule", () => {
    const rule = importConfig({ dns: { rules: [{ action: "reject", method: "drop", no_drop: true }] } }).dns?.rules?.[0] as Record<string, unknown>;
    expect(rule.method).toBe("drop");
    expect(rule.no_drop).toBe(true);
  });

  it("scrubs predefined-only rcode/answer/ns/extra from a non-predefined dns rule", () => {
    const rule = importConfig({ dns: { rules: [{ action: "route", rcode: "NXDOMAIN", answer: ["a"], ns: ["n"], extra: ["e"] }] } }).dns?.rules?.[0] as Record<string, unknown>;
    expect(rule).not.toHaveProperty("rcode");
    expect(rule).not.toHaveProperty("answer");
    expect(rule).not.toHaveProperty("ns");
    expect(rule).not.toHaveProperty("extra");
  });

  it("on a reject dns rule keeps method/no_drop but still drops a stale predefined-only rcode", () => {
    const rule = importConfig({ dns: { rules: [{ action: "reject", method: "drop", no_drop: true, rcode: "STALE" }] } }).dns?.rules?.[0] as Record<string, unknown>;
    expect(rule.method).toBe("drop");
    expect(rule.no_drop).toBe(true);
    expect(rule).not.toHaveProperty("rcode");
  });

  it("keeps rcode/answer on a predefined dns rule (and scrubs the predefined-incompatible server)", () => {
    const rule = importConfig({ dns: { rules: [{ action: "predefined", rcode: "NXDOMAIN", answer: ["a"], server: "stale" }] } }).dns?.rules?.[0] as Record<string, unknown>;
    expect(rule.rcode).toBe("NXDOMAIN");
    expect(rule.answer).toEqual(["a"]);
    expect(rule).not.toHaveProperty("server"); // predefined does not allow server
  });
});

describe("L4-rule-field-scrub — route-rule action-exclusive fields", () => {
  it("scrubs reject-only method/no_drop from a non-reject route rule", () => {
    const rule = importConfig({ route: { rules: [{ action: "route", outbound: "out", method: "drop", no_drop: true }] } }).route?.rules?.[0] as Record<string, unknown>;
    expect(rule).not.toHaveProperty("method");
    expect(rule).not.toHaveProperty("no_drop");
    expect(rule.outbound).toBe("out");
  });

  it("keeps method/no_drop on a reject route rule", () => {
    const rule = importConfig({ route: { rules: [{ action: "reject", method: "default", no_drop: true }] } }).route?.rules?.[0] as Record<string, unknown>;
    expect(rule.method).toBe("default");
    expect(rule.no_drop).toBe(true);
  });

  it("keeps shared route-options fields on a route rule (they are valid there)", () => {
    const rule = importConfig({ route: { rules: [{ action: "route", outbound: "out", override_address: "1.1.1.1", network_strategy: "default" }] } }).route?.rules?.[0] as Record<string, unknown>;
    expect(rule.override_address).toBe("1.1.1.1");
    expect(rule.network_strategy).toBe("default");
  });

  it("does not re-export a scrubbed field", () => {
    const config = importConfig({ dns: { rules: [{ action: "route", rcode: "SCRUBME" }] } });
    expect(stringifyConfig(config)).not.toContain("SCRUBME");
  });
});

describe("U13 — route-rule action-group scrub", () => {
  it("scrubs sniff-only sniffer from a non-sniff route rule, keeps it on sniff", () => {
    const off = importConfig({ route: { rules: [{ action: "route", outbound: "out", sniffer: ["http"] }] } }).route?.rules?.[0] as Record<string, unknown>;
    expect(off).not.toHaveProperty("sniffer");
    const on = importConfig({ route: { rules: [{ action: "sniff", sniffer: ["http"] }] } }).route?.rules?.[0] as Record<string, unknown>;
    expect(on.sniffer).toEqual(["http"]);
  });

  it("keeps timeout on both sniff and resolve, scrubs it elsewhere", () => {
    const sniff = importConfig({ route: { rules: [{ action: "sniff", timeout: "300ms" }] } }).route?.rules?.[0] as Record<string, unknown>;
    expect(sniff.timeout).toBe("300ms");
    const resolve = importConfig({ route: { rules: [{ action: "resolve", timeout: "5s" }] } }).route?.rules?.[0] as Record<string, unknown>;
    expect(resolve.timeout).toBe("5s");
    const reject = importConfig({ route: { rules: [{ action: "reject", timeout: "5s" }] } }).route?.rules?.[0] as Record<string, unknown>;
    expect(reject).not.toHaveProperty("timeout");
  });

  it("scrubs resolve-only fields from a non-resolve route rule, keeps them on resolve", () => {
    const off = importConfig({ route: { rules: [{ action: "route", outbound: "o", strategy: "prefer_ipv4", disable_cache: true, disable_optimistic_cache: true, rewrite_ttl: 30, client_subnet: "1.2.3.0/24" }] } }).route?.rules?.[0] as Record<string, unknown>;
    for (const k of ["strategy", "disable_cache", "disable_optimistic_cache", "rewrite_ttl", "client_subnet"]) expect(off).not.toHaveProperty(k);
    const on = importConfig({ route: { rules: [{ action: "resolve", strategy: "prefer_ipv4", disable_cache: true, rewrite_ttl: 30, client_subnet: "1.2.3.0/24" }] } }).route?.rules?.[0] as Record<string, unknown>;
    expect(on.strategy).toBe("prefer_ipv4");
    expect(on.disable_cache).toBe(true);
    expect(on.rewrite_ttl).toBe(30);
    expect(on.client_subnet).toBe("1.2.3.0/24");
  });

  it("scrubs the route-options group when leaving route/route-options/bypass, keeps it on bypass", () => {
    const reject = importConfig({ route: { rules: [{ action: "reject", override_address: "1.1.1.1", udp_connect: true, tls_fragment: true, tls_spoof: "ex", fallback_network_type: ["wifi"] }] } }).route?.rules?.[0] as Record<string, unknown>;
    for (const k of ["override_address", "udp_connect", "tls_fragment", "tls_spoof", "fallback_network_type"]) expect(reject).not.toHaveProperty(k);
    const bypass = importConfig({ route: { rules: [{ action: "bypass", override_address: "1.1.1.1", udp_connect: true }] } }).route?.rules?.[0] as Record<string, unknown>;
    expect(bypass.override_address).toBe("1.1.1.1");
    expect(bypass.udp_connect).toBe(true);
  });

  it("never scrubs the network_type MATCH field (valid on every action)", () => {
    const reject = importConfig({ route: { rules: [{ action: "reject", network_type: ["wifi"] }] } }).route?.rules?.[0] as Record<string, unknown>;
    expect(reject.network_type).toEqual(["wifi"]);
  });
});
