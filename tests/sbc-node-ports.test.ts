import { describe, expect, it } from "vitest";
import type { SbcNodeKind } from "../src/canvas/graph";
import { getNodeIcon, getPortSpecs } from "../src/components/SbcNode";

type PortCase = {
  kind: SbcNodeKind;
  type: string;
  inputKeys: string[];
  outputKeys: string[];
};

const cases: PortCase[] = [
  { kind: "inbound", type: "tun", inputKeys: [], outputKeys: ["route", "route-rule-match", "dns-rule-match"] },
  { kind: "route", type: "route", inputKeys: ["inbound"], outputKeys: ["route-rule", "outbound"] },
  { kind: "route-rule", type: "route-rule", inputKeys: ["route", "inbound"], outputKeys: ["outbound", "rule-set"] },
  { kind: "dns", type: "dns", inputKeys: [], outputKeys: ["dns-rule", "dns-server"] },
  { kind: "dns-rule", type: "dns-rule", inputKeys: ["dns", "inbound"], outputKeys: ["dns-server", "rule-set"] },
  { kind: "dns-server", type: "https", inputKeys: ["dns", "dns-rule"], outputKeys: ["outbound"] },
  { kind: "dns-server", type: "tailscale", inputKeys: ["dns", "dns-rule"], outputKeys: ["endpoint"] },
  { kind: "dns-server", type: "resolved", inputKeys: ["dns", "dns-rule"], outputKeys: ["service"] },
  { kind: "endpoint", type: "wireguard", inputKeys: [], outputKeys: ["dial-detour"] },
  { kind: "endpoint", type: "tailscale", inputKeys: ["dns-server", "derp-service", "certificate-provider"], outputKeys: ["dial-detour"] },
  { kind: "rule-set", type: "remote", inputKeys: ["route-rule", "dns-rule"], outputKeys: ["download-detour"] },
  { kind: "rule-set", type: "local", inputKeys: ["route-rule", "dns-rule"], outputKeys: [] },
  { kind: "rule-set", type: "inline", inputKeys: ["route-rule", "dns-rule"], outputKeys: [] },
  {
    kind: "outbound",
    type: "direct",
    inputKeys: ["route", "route-rule", "selector-group", "urltest-group", "dns-detour", "detour-target", "service-detour", "rule-set-download", "clash-download-detour"],
    outputKeys: ["dial-detour"],
  },
  {
    kind: "outbound",
    type: "socks",
    inputKeys: ["route", "route-rule", "selector-group", "urltest-group", "dns-detour", "detour-target", "service-detour", "rule-set-download", "clash-download-detour"],
    outputKeys: ["dial-detour"],
  },
  {
    kind: "outbound",
    type: "selector",
    inputKeys: ["route", "route-rule", "selector-group", "urltest-group", "dns-detour", "detour-target", "service-detour", "rule-set-download", "clash-download-detour"],
    outputKeys: ["outbound-member"],
  },
  {
    kind: "outbound",
    type: "urltest",
    inputKeys: ["route", "route-rule", "selector-group", "urltest-group", "dns-detour", "detour-target", "service-detour", "rule-set-download", "clash-download-detour"],
    outputKeys: ["outbound-member"],
  },
  { kind: "service", type: "ssm-api", inputKeys: ["managed-inbound"], outputKeys: [] },
  { kind: "service", type: "derp", inputKeys: [], outputKeys: ["verify-client-endpoint"] },
  { kind: "service", type: "ccm", inputKeys: [], outputKeys: ["detour"] },
  { kind: "service", type: "resolved", inputKeys: ["dns-server"], outputKeys: [] },
  { kind: "certificate-provider", type: "tailscale", inputKeys: [], outputKeys: ["endpoint"] },
  { kind: "settings", type: "ntp", inputKeys: [], outputKeys: ["dial-detour"] },
  { kind: "settings", type: "experimental", inputKeys: [], outputKeys: ["clash-download-detour"] },
];

describe("SBC node port registry", () => {
  it("uses upstream/downstream node type icons instead of copying the current node icon", () => {
    for (const item of cases) {
      const nodeIcon = getNodeIcon(item.kind, item.type);
      const inputPorts = getPortSpecs(item.kind, item.type, "input");
      const outputPorts = getPortSpecs(item.kind, item.type, "output");

      expect(inputPorts.map((port) => port.key), `${item.kind}/${item.type} input ports`).toEqual(item.inputKeys);
      expect(outputPorts.map((port) => port.key), `${item.kind}/${item.type} output ports`).toEqual(item.outputKeys);

      for (const port of [...inputPorts, ...outputPorts]) {
        const sameNodeType = port.nodeKind === item.kind && port.nodeType === item.type;
        if (!sameNodeType) {
          expect(port.icon, `${item.kind}/${item.type} port ${port.key}`).not.toBe(nodeIcon);
        }
      }
    }
  });

  it("marks selector and urltest as specific upstream group types for member outbounds", () => {
    const memberInputs = getPortSpecs("outbound", "direct", "input");

    expect(memberInputs.find((port) => port.key === "selector-group")).toMatchObject({
      nodeKind: "outbound",
      nodeType: "selector",
    });
    expect(memberInputs.find((port) => port.key === "urltest-group")).toMatchObject({
      nodeKind: "outbound",
      nodeType: "urltest",
    });
  });

  it("marks visual hub and ordered-list ports readonly instead of editable", () => {
    expect(getPortSpecs("route", "route", "input").find((port) => port.key === "inbound")).toMatchObject({
      editable: false,
      mode: "decorative",
    });
    expect(getPortSpecs("route", "route", "output").find((port) => port.key === "route-rule")).toMatchObject({
      editable: false,
      mode: "readonly",
    });
    expect(getPortSpecs("dns", "dns", "output").find((port) => port.key === "dns-rule")).toMatchObject({
      editable: false,
      mode: "readonly",
    });
  });
});

// A0 / W5 port-guard guardrail (Pass-2 T13; _RELATIONSHIPS.md P1-a + P2-f).
describe("dial detour port type guards (W5 -> A6)", () => {
  // Regression lock (already green). The canvas-pr7 atomic added nodeTypeExcludes to the
  // dns-server-detour source (portRelationRegistry.ts:105), so non-dialable DNS server types no longer
  // expose a detour outbound port. Re-verified against HEAD; this locks it against regression.
  it.each(["fakeip", "hosts", "resolved", "tailscale"])(
    "dns-server %s does not expose a detour outbound output port",
    (type) => {
      expect(getPortSpecs("dns-server", type, "output").map((port) => port.key)).not.toContain("outbound");
    },
  );

  // Red target. The `detour-target` INPUT endpoints (portRelationRegistry.ts:106/108/117) carry no
  // nodeTypeExcludes, so non-dialable outbounds (block/selector/urltest/dns) still expose a dial
  // detour-target input — a dead chain (_RELATIONSHIPS.md P2-f). Flips red when A6 adds
  // nodeTypeExcludes ["block","selector","urltest","dns"] to those endpoints; convert `it.fails` -> `it`.
  for (const type of ["block", "selector", "urltest", "dns"]) {
    it.fails(`outbound ${type} does not expose a dial detour-target input`, () => {
      expect(getPortSpecs("outbound", type, "input").map((port) => port.key)).not.toContain("detour-target");
    });
  }
});
