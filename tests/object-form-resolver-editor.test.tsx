import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { parseConfigJson, stringifyConfig } from "../src/domain/serialization";
import { useProjectStore } from "../src/state/useProjectStore";

// V6 — object-form domain_resolver gets a structured subform (server + strategy + siblings) instead of
// the raw JSON fallback. String form keeps the dropdown; string↔object switch loses no keys.

const baseConfig = (resolver: unknown) => ({
  dns: { servers: [{ type: "local", tag: "dns-local" }] },
  outbounds: [
    {
      type: "shadowsocks",
      tag: "ss",
      server: "x",
      server_port: 8080,
      method: "aes-128-gcm",
      password: "p",
      domain_resolver: resolver,
    },
  ],
});

function select(resolver: unknown) {
  useProjectStore.getState().importJson(JSON.stringify(baseConfig(resolver)));
  act(() => {
    useProjectStore.getState().setSelectedId("outbound:ss");
  });
}

function resolverOf() {
  return (useProjectStore.getState().config.outbounds![0] as Record<string, unknown>).domain_resolver;
}

describe("V6 — object-form domain_resolver editor", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("renders a structured subform for the object form and edits strategy while preserving siblings", () => {
    select({ server: "dns-local", strategy: "prefer_ipv4", disable_cache: true, custom_future_key: "keep" });
    render(<App />);
    const subform = within(screen.getByTestId("domain-resolver-object"));

    fireEvent.change(subform.getByDisplayValue("prefer_ipv4"), { target: { value: "ipv4_only" } });

    expect(resolverOf()).toEqual({
      server: "dns-local",
      strategy: "ipv4_only",
      disable_cache: true,
      custom_future_key: "keep", // unknown keys are preserved via spread
    });
    const config = useProjectStore.getState().config;
    expect(parseConfigJson(stringifyConfig(config))).toEqual(config);
  });

  it("collapses an object resolver back to a tag string", () => {
    select({ server: "dns-local", strategy: "ipv6_only" });
    render(<App />);
    fireEvent.click(
      within(screen.getByTestId("domain-resolver-object")).getByRole("button", { name: /collapse to tag/i }),
    );
    expect(resolverOf()).toBe("dns-local");
  });

  it("expands a tag-string resolver into the object form without losing the server", () => {
    select("dns-local");
    render(<App />);
    // String form: no object subform yet; the expand affordance is present.
    expect(screen.queryByTestId("domain-resolver-object")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /add resolver options/i }));
    expect(resolverOf()).toEqual({ server: "dns-local" });
  });
});
