import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { validateConfig } from "../src/domain/diagnostics";
import { useProjectStore } from "../src/state/useProjectStore";

function openRule(rule: Record<string, unknown>, channel: "stable" | "testing") {
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
  render(<App />);
  fireEvent.click(screen.getByTestId("node-dns-rule:0"));
}

function currentRule() {
  return useProjectStore.getState().config.dns?.rules?.[0] as Record<string, unknown> | undefined;
}

describe("DNS rule query action options", () => {
  beforeEach(() => useProjectStore.getState().importJson("{}"));
  afterEach(() => {
    cleanup();
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson("{}");
  });

  it("edits stable query options with binary-safe types", () => {
    openRule({ action: "route", server: "local" }, "stable");
    const group = screen.getByTestId("dns-rule-query-options");
    expect(within(group).queryByLabelText(/Disable optimistic cache/i)).toBeNull();
    expect(within(group).queryByLabelText(/Query timeout/i)).toBeNull();
    expect(within(group).queryByLabelText(/Remove client subnet/i)).toBeNull();

    fireEvent.click(within(group).getByLabelText("Disable cache"));
    fireEvent.change(within(group).getByLabelText("Rewrite TTL"), { target: { value: "300" } });
    fireEvent.change(within(group).getByLabelText("Client subnet"), { target: { value: "10.0.0.0/8" } });
    expect(currentRule()).toMatchObject({ disable_cache: true, rewrite_ttl: 300, client_subnet: "10.0.0.0/8" });

    fireEvent.change(within(group).getByLabelText("Rewrite TTL"), { target: { value: "-1" } });
    expect(currentRule()?.rewrite_ttl).toBeUndefined();
    fireEvent.change(within(group).getByLabelText("Rewrite TTL"), { target: { value: "4294967296" } });
    expect(currentRule()?.rewrite_ttl).toBeUndefined();
  });

  it("edits testing options and keeps client_subnet/remove_client_subnet mutually exclusive", () => {
    openRule({ action: "route", server: "local", client_subnet: "10.0.0.0/8" }, "testing");
    const group = screen.getByTestId("dns-rule-query-options");
    fireEvent.click(within(group).getByLabelText(/Disable optimistic cache/i));
    fireEvent.change(within(group).getByLabelText(/Query timeout/i), { target: { value: "5s" } });
    fireEvent.click(within(group).getByLabelText(/Remove client subnet/i));
    expect(currentRule()).toMatchObject({ disable_optimistic_cache: true, timeout: "5s", remove_client_subnet: true });
    expect(currentRule()?.client_subnet).toBeUndefined();

    fireEvent.change(within(group).getByLabelText("Client subnet"), { target: { value: "192.168.0.0/24" } });
    expect(currentRule()?.client_subnet).toBe("192.168.0.0/24");
    expect(currentRule()?.remove_client_subnet).toBeUndefined();
  });

  it("keeps imported testing values reachable on stable and blocks stable export", () => {
    openRule(
      {
        action: "route",
        server: "local",
        disable_optimistic_cache: true,
        timeout: "5s",
        remove_client_subnet: true,
      },
      "stable",
    );
    const group = screen.getByTestId("dns-rule-query-options");
    expect(within(group).getAllByLabelText(/Disable optimistic cache/i)).toHaveLength(1);
    expect(within(group).getAllByLabelText(/Query timeout/i)).toHaveLength(1);
    expect(within(group).getAllByLabelText(/Remove client subnet/i)).toHaveLength(1);
    const codes = validateConfig(useProjectStore.getState().config, "stable").map((finding) => finding.code);
    expect(codes).toContain("dns-rule-disable-optimistic-cache-testing-only");
    expect(codes).toContain("dns-rule-timeout-testing-only");
    expect(codes).toContain("dns-rule-remove-client-subnet-testing-only");
  });

  it("scrubs query options when the action changes to an incompatible action", () => {
    openRule({ action: "route", server: "local", disable_cache: true, rewrite_ttl: 60, timeout: "5s" }, "testing");
    fireEvent.change(screen.getByLabelText("Action"), { target: { value: "reject" } });
    expect(screen.queryByTestId("dns-rule-query-options")).toBeNull();
    expect(currentRule()).not.toHaveProperty("disable_cache");
    expect(currentRule()).not.toHaveProperty("rewrite_ttl");
    expect(currentRule()).not.toHaveProperty("timeout");
  });

  it("diagnoses imported uint32 and client-subnet conflicts", () => {
    openRule({ action: "route", server: "local", rewrite_ttl: -1, client_subnet: "10.0.0.0/8", remove_client_subnet: true }, "testing");
    const codes = validateConfig(useProjectStore.getState().config, "testing").map((finding) => finding.code);
    expect(codes).toContain("dns-rule-rewrite-ttl-invalid");
    expect(codes).toContain("dns-rule-client-subnet-conflict");

    useProjectStore.getState().importJson(JSON.stringify({ dns: { rules: [{ action: "route", rewrite_ttl: null, client_subnet: null, remove_client_subnet: true }] } }));
    const nullableCodes = validateConfig(useProjectStore.getState().config, "testing").map((finding) => finding.code);
    expect(nullableCodes).not.toContain("dns-rule-rewrite-ttl-invalid");
    expect(nullableCodes).not.toContain("dns-rule-client-subnet-conflict");
  });
});
