import { describe, expect, it } from "vitest";
import { deriveGraph } from "../src/canvas/graph";
import type { SingBoxConfig } from "../src/domain/types";

// A rule is "match + action". The card subtitle labels the action (route/rule_action.md,
// dns/rule_action.md) so a sniff/reject/resolve rule isn't visually identical to a route rule. The
// default `route` action is omitted (its target is shown by the edge).
const config = {
  outbounds: [{ type: "direct", tag: "direct" }],
  route: {
    rules: [
      { domain_suffix: ["cn"], outbound: "direct" },
      { domain_keyword: ["ads"], action: "reject" },
      { domain: ["x.com"], action: "sniff" },
    ],
  },
  dns: { rules: [{ domain_suffix: ["cn"], action: "reject" }] },
} as unknown as SingBoxConfig;

const { nodes } = deriveGraph(config, { positions: {} }, []);
const sub = (id: string) => nodes.find((node) => node.id === id)?.data.subtitle;
const action = (id: string) => nodes.find((node) => node.id === id)?.data.action;

describe("rule action label", () => {
  it("a default route rule shows only its match (no action noise, target shown by the edge)", () => {
    expect(sub("route-rule:0")).toBe("cn");
    expect(action("route-rule:0")).toBeUndefined();
  });

  it("non-default route actions are labelled in the subtitle and recorded in data.action", () => {
    expect(sub("route-rule:1")).toBe("ads · reject");
    expect(action("route-rule:1")).toBe("reject");
    expect(sub("route-rule:2")).toBe("x.com · sniff");
    expect(action("route-rule:2")).toBe("sniff");
  });

  it("dns rule actions are labelled the same way", () => {
    expect(sub("dns-rule:0")).toBe("cn · reject");
    expect(action("dns-rule:0")).toBe("reject");
  });
});
