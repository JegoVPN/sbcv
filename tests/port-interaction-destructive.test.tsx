import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

function clickPort(nodeId: string, portKey: string) {
  const node = screen.getByTestId(`node-${nodeId}`);
  const port = node.querySelector<HTMLButtonElement>(`button[data-port-type="${portKey}"]`);
  if (!port) throw new Error(`Missing port ${portKey} on ${nodeId}`);
  fireEvent.click(port);
}

function expectPortClickNoMutation(nodeId: string, portKey: string) {
  const before = useProjectStore.getState().jsonDraft;
  clickPort(nodeId, portKey);
  expect(useProjectStore.getState().jsonDraft, `${nodeId}:${portKey}`).toBe(before);
}

function tagRefContains(ref: unknown, tag: string) {
  return Array.isArray(ref) ? ref.includes(tag) : ref === tag;
}

describe("canvas side-port destructive click guard", () => {
  it("does not mutate canonical config when clicking populated hub and rule ports", () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);

    expectPortClickNoMutation("route:main", "inbound");
    expectPortClickNoMutation("route:main", "route-rule");
    expectPortClickNoMutation("route:main", "outbound");
    expectPortClickNoMutation("route-rule:0", "inbound");
    expectPortClickNoMutation("route-rule:0", "outbound");

    expectPortClickNoMutation("dns:main", "inbound-query");
    expectPortClickNoMutation("dns:main", "dns-rule");
    expectPortClickNoMutation("dns:main", "dns-server");
    expectPortClickNoMutation("dns-rule:0", "inbound");
    expectPortClickNoMutation("dns-rule:0", "dns-server");
  });

  it("does not remove group members or create detour targets on side-port click", () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);
    const config = useProjectStore.getState().config;
    const selector = config.outbounds?.find((outbound) => outbound.type === "selector");
    const urltest = config.outbounds?.find((outbound) => outbound.type === "urltest");
    const dnsServer = config.dns?.servers?.[0];

    expect(selector?.tag).toBeTruthy();
    expect(urltest?.tag).toBeTruthy();
    expect(dnsServer?.tag).toBeTruthy();

    expectPortClickNoMutation(`outbound:${selector!.tag}`, "outbound-member");
    expectPortClickNoMutation(`outbound:${urltest!.tag}`, "outbound-member");
    expectPortClickNoMutation(`dns-server:${dnsServer!.tag}`, "outbound");
  });

  it("does not remove any inbound rule references when multiple rules share an inbound", () => {
    useProjectStore.getState().loadTemplate();
    const initialConfig = useProjectStore.getState().config;
    const inboundTag = initialConfig.inbounds?.[0]?.tag;
    const outboundTag = initialConfig.route?.final;
    const dnsServerTag = initialConfig.dns?.final;

    expect(inboundTag).toBeTruthy();
    expect(outboundTag).toBeTruthy();
    expect(dnsServerTag).toBeTruthy();

    for (const suffix of ["shared-route-inbound-a", "shared-route-inbound-b"]) {
      useProjectStore.getState().addRouteRule();
      const routeRuleIndex = (useProjectStore.getState().config.route?.rules?.length ?? 1) - 1;
      useProjectStore.getState().updateRouteRule(routeRuleIndex, {
        domain_suffix: [suffix],
        inbound: inboundTag,
        outbound: outboundTag,
      });
    }
    for (const suffix of ["shared-dns-inbound-a", "shared-dns-inbound-b"]) {
      useProjectStore.getState().addDnsRule();
      const dnsRuleIndex = (useProjectStore.getState().config.dns?.rules?.length ?? 1) - 1;
      useProjectStore.getState().updateDnsRule(dnsRuleIndex, {
        domain_suffix: [suffix],
        inbound: inboundTag,
        server: dnsServerTag,
      });
    }

    const routeRefCount = () =>
      useProjectStore.getState().config.route?.rules?.filter((rule) => tagRefContains(rule.inbound, inboundTag!)).length ?? 0;
    const dnsRefCount = () =>
      useProjectStore.getState().config.dns?.rules?.filter((rule) => tagRefContains(rule.inbound, inboundTag!)).length ?? 0;

    expect(routeRefCount()).toBeGreaterThan(1);
    expect(dnsRefCount()).toBeGreaterThan(1);

    render(<App />);

    expectPortClickNoMutation(`inbound:${inboundTag}`, "route-rule-match");
    expect(routeRefCount()).toBeGreaterThan(1);
    expectPortClickNoMutation(`inbound:${inboundTag}`, "dns-rule-match");
    expect(dnsRefCount()).toBeGreaterThan(1);
  });
});
