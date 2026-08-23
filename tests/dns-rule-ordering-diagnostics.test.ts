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
function allCodes(config: SingBoxConfig): string[] {
  return validateConfig(config, "testing").map((d) => d.code);
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

  it("requires explicit match_response for Response Match Fields (response_rcode)", () => {
    const config = asConfig({
      dns: { servers: [{ type: "local", tag: "l" }], rules: [{ domain: ["x"], response_rcode: "NXDOMAIN", action: "route", server: "l" }] },
    });
    expect(errorCodes(config)).toContain("dns-rule-response-fields-without-match-response");
  });

  it("does not fire the 1.14 ordering errors on the stable channel (already flagged testing-only there)", () => {
    const config = asConfig({
      dns: { servers: [{ type: "local", tag: "l" }], rules: [{ domain: ["x"], action: "respond" }] },
    });
    expect(errorCodes(config, "stable")).not.toContain("dns-rule-respond-without-evaluate");
  });

  it("resolves a string match_response only against a preceding evaluate with the same tag", () => {
    const valid = asConfig({
      dns: {
        servers: [{ type: "https", tag: "doh", server: "1.1.1.1" }],
        rules: [
          { action: "evaluate", server: "doh", tag: "fast" },
          { match_response: "fast", response_rcode: "NOERROR", action: "respond" },
        ],
      },
    });
    expect(errorCodes(valid)).not.toContain("dns-rule-match-response-tag-missing");
    expect(errorCodes(valid)).not.toContain("dns-rule-respond-without-evaluate");

    const wrongTag = structuredClone(valid);
    wrongTag.dns!.rules![1]!.match_response = "slow";
    expect(errorCodes(wrongTag)).toContain("dns-rule-match-response-tag-missing");
  });

  it("does not let tagged and untagged evaluate response identities substitute for each other", () => {
    const taggedThenTrue = asConfig({
      dns: { rules: [{ action: "evaluate", server: "doh", tag: "fast" }, { match_response: true, action: "route", server: "doh" }] },
    });
    expect(errorCodes(taggedThenTrue)).toContain("dns-rule-match-response-without-evaluate");

    const untaggedThenString = asConfig({
      dns: { rules: [{ action: "evaluate", server: "doh" }, { match_response: "fast", action: "route", server: "doh" }] },
    });
    expect(errorCodes(untaggedThenString)).toContain("dns-rule-match-response-tag-missing");
  });

  it("requires match_response when response match fields are present", () => {
    const config = asConfig({ dns: { rules: [{ action: "evaluate", server: "doh" }, { response_rcode: "NXDOMAIN" }] } });
    expect(errorCodes(config)).toContain("dns-rule-response-fields-without-match-response");
  });

  it("requires response fields and match_response to live on the same logical sub-rule", () => {
    const config = asConfig({
      dns: {
        rules: [
          { action: "evaluate", server: "doh" },
          { type: "logical", mode: "or", rules: [{ response_rcode: "NOERROR" }, { match_response: true }], action: "reject" },
        ],
      },
    });
    expect(errorCodes(config)).toContain("dns-rule-response-fields-without-match-response");
  });

  it("requires match_response when evaluate uses response IP fields", () => {
    const config = asConfig({ dns: { rules: [{ action: "evaluate", server: "doh", ip_cidr: ["1.1.1.0/24"] }] } });
    expect(errorCodes(config)).toContain("dns-rule-response-fields-without-match-response");
  });

  it("validates race action, response dependency, and speculative conflict", () => {
    const config = asConfig({
      dns: {
        rules: [
          { action: "evaluate", server: "doh" },
          { action: "evaluate", match_response: true, race: true, speculative: true, server: "doh" },
        ],
      },
    });
    const codes = errorCodes(config);
    expect(codes).toContain("dns-rule-race-action-conflict");
    expect(codes).toContain("dns-rule-race-speculative-conflict");

    expect(errorCodes(asConfig({ dns: { rules: [{ action: "route", server: "doh", race: true }] } }))).toContain(
      "dns-rule-race-without-match-response",
    );
  });

  it("accepts a race match_response nested in a logical sub-rule", () => {
    const config = asConfig({
      dns: {
        rules: [
          { action: "evaluate", server: "doh" },
          { type: "logical", mode: "and", rules: [{ match_response: true, response_rcode: "NOERROR" }], action: "route", server: "doh", race: true },
        ],
      },
    });
    expect(errorCodes(config)).not.toContain("dns-rule-race-without-match-response");
    expect(errorCodes(config)).not.toContain("dns-rule-match-response-without-evaluate");
  });

  it("warns when speculative has no preceding race and accepts it after one", () => {
    const noRace = asConfig({ dns: { rules: [{ action: "route", server: "doh", speculative: true }] } });
    expect(allCodes(noRace)).toContain("dns-rule-speculative-without-race");

    const withRace = asConfig({
      dns: {
        rules: [
          { action: "evaluate", server: "doh" },
          { action: "reject", match_response: true, race: true },
          { action: "route", server: "doh", speculative: true },
        ],
      },
    });
    expect(allCodes(withRace)).not.toContain("dns-rule-speculative-without-race");
  });

  it("blocks response/race fields on stable, including nested logical rules", () => {
    const config = asConfig({
      dns: { rules: [{ type: "logical", mode: "and", rules: [{ match_response: true, response_rcode: "NOERROR" }], race: true }] },
    });
    const codes = errorCodes(config, "stable");
    expect(codes).toContain("dns-rule-race-testing-only");
    expect(codes).toContain("dns-rule-match-response-testing-only");
    expect(codes).toContain("dns-rule-response-rcode-testing-only");
  });
});
