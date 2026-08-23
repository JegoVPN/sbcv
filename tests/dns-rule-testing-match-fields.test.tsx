import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { validateConfig } from "../src/domain/diagnostics";
import { useProjectStore } from "../src/state/useProjectStore";

function importRule(rule: Record<string, unknown>, channel: "stable" | "testing") {
  useProjectStore.getState().setChannel(channel);
  useProjectStore.getState().importJson(
    JSON.stringify({
      dns: {
        servers: [{ type: "local", tag: "local" }],
        rules: [rule],
        final: "local",
      },
      outbounds: [{ type: "direct", tag: "direct" }],
      route: { final: "direct" },
    }),
  );
}

function openRule(rule: Record<string, unknown>, channel: "stable" | "testing") {
  importRule(rule, channel);
  render(<App />);
  fireEvent.click(screen.getByTestId("node-dns-rule:0"));
}

function currentRule() {
  return useProjectStore.getState().config.dns?.rules?.[0] as Record<string, unknown> | undefined;
}

describe("sing-box 1.14 DNS query match fields", () => {
  beforeEach(() => useProjectStore.getState().importJson("{}"));
  afterEach(() => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson("{}");
  });

  it("hides fresh testing-only controls on stable and exposes canonical editors on testing", () => {
    openRule({ domain_suffix: ["example.com"], action: "route", server: "local" }, "stable");
    expect(screen.queryByTestId("dns-rule-testing-match-fields")).toBeNull();

    act(() => useProjectStore.getState().setChannel("testing"));
    const group = screen.getByTestId("dns-rule-testing-match-fields");
    fireEvent.click(within(group).getByText(/Testing match fields/i));

    fireEvent.change(within(group).getByLabelText("Query client subnet"), {
      target: { value: "10.0.0.0/24, 192.168.0.1" },
    });
    fireEvent.click(within(group).getByLabelText("Query DNSSEC OK bit"));
    fireEvent.change(within(group).getByLabelText("Package name regex"), {
      target: { value: "^com\\.example$" },
    });
    fireEvent.change(within(group).getByLabelText("Preferred DNS server tags"), {
      target: { value: "local" },
    });

    expect(currentRule()).toMatchObject({
      query_client_subnet: ["10.0.0.0/24", "192.168.0.1"],
      query_dnssec: true,
      package_name_regex: ["^com\\.example$"],
      preferred_by: ["local"],
    });
  });

  it("keeps imported testing fields editable on stable while blocking stable export", () => {
    openRule(
      {
        query_client_subnet: ["10.0.0.0/8"],
        query_dnssec: false,
        package_name_regex: ["^org\\.example$"],
        preferred_by: ["local"],
        action: "route",
        server: "local",
      },
      "stable",
    );

    const group = screen.getByTestId("dns-rule-testing-match-fields");
    fireEvent.click(within(group).getByText(/Testing match fields/i));
    expect((within(group).getByLabelText("Query client subnet") as HTMLInputElement).value).toBe("10.0.0.0/8");
    expect(within(group).getAllByLabelText("Package name regex")).toHaveLength(1);
    expect(within(group).getAllByLabelText("Preferred DNS server tags")).toHaveLength(1);

    const codes = validateConfig(useProjectStore.getState().config, "stable").map((finding) => finding.code);
    expect(codes).toContain("dns-rule-query-client-subnet-testing-only");
    expect(codes).toContain("dns-rule-query-dnssec-testing-only");
    expect(codes).toContain("dns-rule-package-name-regex-testing-only");
    expect(codes).toContain("dns-rule-preferred-by-testing-only");
  });

  it("warns when preferred_by points at a missing DNS server", () => {
    importRule({ preferred_by: ["missing"], action: "route", server: "local" }, "testing");
    const finding = validateConfig(useProjectStore.getState().config, "testing").find(
      (item) => item.code === "missing-dns-rule-preferred-by",
    );
    expect(finding?.level).toBe("warning");
    expect(finding?.path).toBe("/dns/rules/0/preferred_by");
  });
});
