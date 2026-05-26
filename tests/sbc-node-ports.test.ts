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
  { kind: "rule-set", type: "remote", inputKeys: ["route-rule", "dns-rule"], outputKeys: ["download-detour"] },
  {
    kind: "outbound",
    type: "direct",
    inputKeys: ["route", "route-rule", "selector-group", "urltest-group", "dns-detour", "detour-target", "rule-set-download"],
    outputKeys: [],
  },
  {
    kind: "outbound",
    type: "socks",
    inputKeys: ["route", "route-rule", "selector-group", "urltest-group", "dns-detour", "detour-target", "rule-set-download"],
    outputKeys: ["dial-detour"],
  },
  {
    kind: "outbound",
    type: "selector",
    inputKeys: ["route", "route-rule", "selector-group", "urltest-group", "dns-detour", "detour-target", "rule-set-download"],
    outputKeys: ["outbound-member"],
  },
  {
    kind: "outbound",
    type: "urltest",
    inputKeys: ["route", "route-rule", "selector-group", "urltest-group", "dns-detour", "detour-target", "rule-set-download"],
    outputKeys: ["outbound-member"],
  },
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
