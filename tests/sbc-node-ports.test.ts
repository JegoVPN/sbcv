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
  { kind: "dns", type: "dns", inputKeys: ["inbound-query"], outputKeys: ["dns-rule", "dns-server"] },
  { kind: "dns-rule", type: "dns-rule", inputKeys: ["dns", "inbound"], outputKeys: ["dns-server", "rule-set"] },
  { kind: "dns-server", type: "https", inputKeys: ["dns", "dns-rule"], outputKeys: ["outbound"] },
  { kind: "dns-server", type: "tailscale", inputKeys: ["dns", "dns-rule"], outputKeys: ["outbound", "endpoint"] },
  { kind: "endpoint", type: "wireguard", inputKeys: [], outputKeys: ["dial-detour"] },
  { kind: "endpoint", type: "tailscale", inputKeys: ["dns-server", "derp-service"], outputKeys: ["dial-detour"] },
  { kind: "rule-set", type: "remote", inputKeys: ["route-rule", "dns-rule"], outputKeys: ["download-detour"] },
  {
    kind: "outbound",
    type: "direct",
    inputKeys: ["route", "route-rule", "selector-group", "urltest-group", "dns-detour", "detour-target", "service-detour", "rule-set-download"],
    outputKeys: ["dial-detour"],
  },
  {
    kind: "outbound",
    type: "socks",
    inputKeys: ["route", "route-rule", "selector-group", "urltest-group", "dns-detour", "detour-target", "service-detour", "rule-set-download"],
    outputKeys: ["dial-detour"],
  },
  {
    kind: "outbound",
    type: "selector",
    inputKeys: ["route", "route-rule", "selector-group", "urltest-group", "dns-detour", "detour-target", "service-detour", "rule-set-download"],
    outputKeys: ["outbound-member"],
  },
  {
    kind: "outbound",
    type: "urltest",
    inputKeys: ["route", "route-rule", "selector-group", "urltest-group", "dns-detour", "detour-target", "service-detour", "rule-set-download"],
    outputKeys: ["outbound-member"],
  },
  { kind: "service", type: "ssm-api", inputKeys: ["managed-inbound"], outputKeys: [] },
  { kind: "service", type: "derp", inputKeys: [], outputKeys: ["verify-client-endpoint"] },
  { kind: "service", type: "ccm", inputKeys: [], outputKeys: ["detour"] },
  { kind: "service", type: "resolved", inputKeys: [], outputKeys: [] },
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
});
