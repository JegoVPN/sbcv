import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// W6 (re-run#3 P1): the inline rule-set editor now structures the full headless-rule match-field set
// (rule-set/headless-rule.md), not just ~9 — so geosite/geoip/process/network matchers community templates
// rely on no longer force the JSON escape hatch.

const ruleSet = () =>
  (useProjectStore.getState().config.route?.rule_set?.[0] as Record<string, any> | undefined);

function openInline(rule: Record<string, unknown>) {
  useProjectStore.getState().importJson(JSON.stringify({ route: { rule_set: [{ type: "inline", tag: "inline-rs", rules: [rule] }] } }));
  render(<App />);
  fireEvent.click(screen.getByTestId("node-rule-set:inline-rs"));
  return within(screen.getByTestId("inline-rule-0"));
}

describe("W6 — inline rule-set headless match fields", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("renders + edits the newly-structured matchers (process_path, package_name, port_range, network_type, wifi_ssid)", () => {
    const rule = openInline({ domain_suffix: ["x.com"] });
    const edits: Array<[string, string, string | string[]]> = [
      ["Process path", "/usr/bin/curl", ["/usr/bin/curl"]],
      ["Package name (Android)", "com.example.app", ["com.example.app"]],
      ["Port range (e.g. 1000:2000)", "1000:2000", ["1000:2000"]],
      ["Network type (wifi/cellular/…)", "wifi", ["wifi"]],
      ["Wi-Fi SSID", "HomeNet", ["HomeNet"]],
    ];
    for (const [label, value] of edits) {
      fireEvent.change(rule.getByLabelText(label), { target: { value } });
    }
    const r = ruleSet()?.rules?.[0];
    expect(r.process_path).toEqual(["/usr/bin/curl"]);
    expect(r.package_name).toEqual(["com.example.app"]);
    expect(r.port_range).toEqual(["1000:2000"]);
    expect(r.network_type).toEqual(["wifi"]);
    expect(r.wifi_ssid).toEqual(["HomeNet"]);
    // unrelated original field preserved
    expect(r.domain_suffix).toEqual(["x.com"]);
  });

  it("source_port is numeric-coerced like port", () => {
    const rule = openInline({});
    fireEvent.change(rule.getByLabelText("Source port"), { target: { value: "8080, 9090" } });
    expect(ruleSet()?.rules?.[0]?.source_port).toEqual([8080, 9090]);
  });
});
