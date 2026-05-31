import { describe, expect, it } from "vitest";
import { parseConfigJson, stringifyConfig } from "../src/domain/serialization";

// L4-rule-field-scrub (A10d-rest): A10d scrubbed a stale `server`/`outbound` on rules whose action
// doesn't allow it. This extends the same import-boundary scrub to the other *unambiguously*
// action-exclusive rule-output fields (verified against sing-box 1.14 rule_action docs):
//   - dns/route reject-only: `method`, `no_drop`
//   - dns predefined-only:   `rcode`, `answer`, `ns`, `extra`
// Shared route-options fields (override_*, network_*, …) are NOT scrubbed — they are valid on
// route/bypass/route-options, so removing them would drop valid config.

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

  it("does NOT scrub shared route-options fields on a route rule", () => {
    const rule = importConfig({ route: { rules: [{ action: "route", outbound: "out", override_address: "1.1.1.1", network_strategy: "default" }] } }).route?.rules?.[0] as Record<string, unknown>;
    expect(rule.override_address).toBe("1.1.1.1");
    expect(rule.network_strategy).toBe("default");
  });

  it("does not re-export a scrubbed field", () => {
    const config = importConfig({ dns: { rules: [{ action: "route", rcode: "SCRUBME" }] } });
    expect(stringifyConfig(config)).not.toContain("SCRUBME");
  });
});
