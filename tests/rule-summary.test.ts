import { describe, expect, it } from "vitest";
import { deriveGraph } from "../src/canvas/graph";
import { ruleMatchSummary, ruleSummaryLine } from "../src/domain/ruleSummary";
import type { SingBoxConfig } from "../src/domain/types";

// W11 — the Route/DNS hub tables + canvas subtitles previously summarized a rule from only four domain
// fields and the table never showed the action, so sniff/hijack-dns/resolve/clash_mode/logical rules
// rendered as identical blank/unconditional rows. ruleSummary is the single source for a faithful
// "match + action" summary.

describe("ruleMatchSummary — faithful match (incl. non-domain + logical)", () => {
  it("keeps domain matchers as the priority label (backward compatible)", () => {
    expect(ruleMatchSummary({ domain_suffix: ["cn"] })).toBe("cn");
    expect(ruleMatchSummary({ domain_keyword: ["ads"] })).toBe("ads");
    expect(ruleMatchSummary({ rule_set: ["geoip-cn", "geosite-cn"] })).toBe("geoip-cn, geosite-cn");
  });

  it("surfaces non-domain matchers the old 4-field derivation dropped", () => {
    expect(ruleMatchSummary({ clash_mode: "Global" })).toBe("clash: Global");
    expect(ruleMatchSummary({ ip_is_private: true })).toBe("private IP");
    expect(ruleMatchSummary({ protocol: ["quic"] })).toBe("protocol: quic");
    expect(ruleMatchSummary({ query_type: ["A", "AAAA"] })).toBe("query: A, AAAA");
    expect(ruleMatchSummary({ port: [443] })).toBe("port 443");
  });

  it("summarizes a logical group instead of collapsing to a blank/generic label", () => {
    expect(ruleMatchSummary({ type: "logical", mode: "and", rules: [{}, {}] })).toBe("logical and · 2");
    expect(ruleMatchSummary({ type: "logical", mode: "or", rules: [{}] })).toBe("logical or · 1");
  });

  it("returns undefined only for a pure-action rule with no match conditions", () => {
    expect(ruleMatchSummary({ action: "sniff" })).toBeUndefined();
  });
});

describe("ruleSummaryLine — table line always names the action (never a blank card)", () => {
  it("pure-action rules show the action", () => {
    expect(ruleSummaryLine({ action: "sniff" })).toBe("sniff");
    expect(ruleSummaryLine({ protocol: ["dns"], action: "hijack-dns" })).toBe("hijack-dns · protocol: dns");
    expect(ruleSummaryLine({ action: "resolve" })).toBe("resolve");
  });

  it("default route rules show route + match", () => {
    expect(ruleSummaryLine({ domain_suffix: ["cn"], outbound: "direct" })).toBe("route · cn");
    expect(ruleSummaryLine({ clash_mode: "Global", outbound: "proxy" })).toBe("route · clash: Global");
  });

  it("logical rule shows its structure", () => {
    expect(ruleSummaryLine({ type: "logical", mode: "and", rules: [{}, {}], server: "remote" })).toBe("route · logical and · 2");
  });
});

describe("canvas subtitle no longer collapses distinct non-domain rules to a generic label", () => {
  const config = {
    outbounds: [{ type: "direct", tag: "direct" }, { type: "selector", tag: "proxy", outbounds: ["direct"] }],
    route: {
      rules: [
        { action: "sniff" },
        { protocol: ["dns"], action: "hijack-dns" },
        { clash_mode: "Global", outbound: "proxy" },
        { ip_is_private: true, outbound: "direct" },
      ],
    },
  } as unknown as SingBoxConfig;
  const { nodes } = deriveGraph(config, { positions: {} }, []);
  const sub = (id: string) => nodes.find((node) => node.id === id)?.data.subtitle;

  it("each rule gets a distinct, faithful subtitle (not the generic 'match rule')", () => {
    expect(sub("route-rule:0")).toBe("sniff");
    expect(sub("route-rule:1")).toBe("protocol: dns · hijack-dns");
    expect(sub("route-rule:2")).toBe("clash: Global");
    expect(sub("route-rule:3")).toBe("private IP");
    // the four must not be identical (the original bug collapsed several to "match rule")
    expect(new Set([sub("route-rule:0"), sub("route-rule:1"), sub("route-rule:2"), sub("route-rule:3")]).size).toBe(4);
  });
});
