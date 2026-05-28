import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxChannel, SingBoxConfig } from "../src/domain/types";

// A10b (C0-4): model DNS-rule evaluate/respond ordering. Upstream (dns/rule_action.md):
// - `respond` is only allowed AFTER a preceding top-level `evaluate` rule.
// - `match_response` (and Response Match Fields) require a preceding top-level `evaluate` rule; a rule's
//   own `evaluate` does not satisfy it (matching happens before the action runs).

function asConfig(value: unknown): SingBoxConfig {
  return value as SingBoxConfig;
}
function errorCodes(config: SingBoxConfig, channel: SingBoxChannel = "testing"): string[] {
  return validateConfig(config, channel)
    .filter((d) => d.level === "error")
    .map((d) => d.code);
}

describe("A10b — DNS rule evaluate/respond ordering (C0-4)", () => {
  it("flags a respond rule with no preceding evaluate", () => {
    const config = asConfig({
      dns: { servers: [{ type: "local", tag: "l" }], rules: [{ domain: ["x"], action: "respond" }] },
    });
    expect(errorCodes(config)).toContain("dns-rule-respond-without-evaluate");
  });

  it("accepts a respond rule that follows a top-level evaluate", () => {
    const config = asConfig({
      dns: {
        servers: [{ type: "https", tag: "doh", server: "1.1.1.1" }],
        rules: [
          { domain: ["x"], action: "evaluate", server: "doh" },
          { domain: ["x"], action: "respond" },
        ],
      },
    });
    expect(errorCodes(config)).not.toContain("dns-rule-respond-without-evaluate");
  });

  it("flags match_response with no preceding evaluate", () => {
    const config = asConfig({
      dns: { servers: [{ type: "local", tag: "l" }], rules: [{ domain: ["x"], match_response: true, action: "route", server: "l" }] },
    });
    expect(errorCodes(config)).toContain("dns-rule-match-response-without-evaluate");
  });

  it("does not let a rule's OWN evaluate satisfy the match_response precondition", () => {
    // evaluate + match_response on the same rule: matching happens before the action runs, so this
    // rule still needs an EARLIER evaluate.
    const config = asConfig({
      dns: {
        servers: [{ type: "https", tag: "doh", server: "1.1.1.1" }],
        rules: [{ domain: ["x"], action: "evaluate", server: "doh", match_response: true }],
      },
    });
    expect(errorCodes(config)).toContain("dns-rule-match-response-without-evaluate");
  });

  it("accepts match_response after a preceding evaluate", () => {
    const config = asConfig({
      dns: {
        servers: [{ type: "https", tag: "doh", server: "1.1.1.1" }],
        rules: [
          { domain: ["x"], action: "evaluate", server: "doh" },
          { domain: ["x"], match_response: true, action: "route", server: "doh" },
        ],
      },
    });
    expect(errorCodes(config)).not.toContain("dns-rule-match-response-without-evaluate");
  });

  it("also requires a preceding evaluate for Response Match Fields (response_rcode), not just match_response", () => {
    const config = asConfig({
      dns: { servers: [{ type: "local", tag: "l" }], rules: [{ domain: ["x"], response_rcode: "NXDOMAIN", action: "route", server: "l" }] },
    });
    expect(errorCodes(config)).toContain("dns-rule-match-response-without-evaluate");
  });

  it("does not fire the 1.14 ordering errors on the stable channel (already flagged testing-only there)", () => {
    const config = asConfig({
      dns: { servers: [{ type: "local", tag: "l" }], rules: [{ domain: ["x"], action: "respond" }] },
    });
    expect(errorCodes(config, "stable")).not.toContain("dns-rule-respond-without-evaluate");
  });
});
