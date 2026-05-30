import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// DF2 — the mdns dns-server `interface` is a List (string[] of interface names), but the only Interface
// control was gated to the dhcp server and rendered a single string. An imported mdns server's
// interface[] therefore had no editor AND was excluded from the Advanced fallback (it sits in
// dnsServerHandledFields) — silently unreachable. mdns is testing-only (1.14, import-only), so the test
// imports it and switches the channel to testing.

describe("DF2 — dns-server mdns interface list", () => {
  beforeEach(() => {
    useProjectStore.getState().importJson(JSON.stringify({}));
    useProjectStore.getState().setChannel("stable");
  });
  afterEach(() => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("shows and edits the mdns interface as a comma-separated list", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ dns: { servers: [{ type: "mdns", tag: "mdns-dns", interface: ["en0", "en1"] }] } }),
    );
    useProjectStore.getState().setChannel("testing");
    render(<App />);
    fireEvent.click(screen.getByTestId("node-dns-server:mdns-dns"));

    const input = within(screen.getByTestId("mdns-interface")).getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("en0, en1");

    fireEvent.change(input, { target: { value: "en0, en1, en2" } });
    expect(useProjectStore.getState().config.dns?.servers?.[0]?.interface).toEqual(["en0", "en1", "en2"]);

    // Clearing the list removes the key (export-minimal), not an empty array.
    fireEvent.change(input, { target: { value: "" } });
    expect(useProjectStore.getState().config.dns?.servers?.[0]?.interface).toBeUndefined();
  });
});
