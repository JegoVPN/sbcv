import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { parseConfigJson, stringifyConfig } from "../src/domain/serialization";
import { useProjectStore } from "../src/state/useProjectStore";

// DF1 — sing-box `tun.address` accepts string | string[]. The Address control read `toList(entity.address)`
// (→ "" for a string) and wrote `fromList(...)` (always an array): a string-form address rendered BLANK and
// the first keystroke overwrote the original string with an array of the typed text — silent data loss.
// Fix: coerce a string `tun.address` to a single-element array at the import boundary (normalizeConfig), so
// the value is visible and edits never destroy it. string ↔ single-element-array is sing-box-equivalent
// (verified: both stable + testing binaries `check` exit 0 on either form).

describe("DF1 — tun.address string form", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("coerces a string tun.address to a single-element array at import", () => {
    const config = parseConfigJson(
      JSON.stringify({ inbounds: [{ type: "tun", tag: "tun-in", address: "172.18.0.1/30" }] }),
    );
    expect((config.inbounds![0] as Record<string, unknown>).address).toEqual(["172.18.0.1/30"]);
  });

  it("leaves an array tun.address untouched and round-trips", () => {
    const json = JSON.stringify({
      inbounds: [{ type: "tun", tag: "tun-in", address: ["172.18.0.1/30", "fdfe:dcba:9876::1/126"] }],
    });
    const config = parseConfigJson(json);
    expect((config.inbounds![0] as Record<string, unknown>).address).toEqual([
      "172.18.0.1/30",
      "fdfe:dcba:9876::1/126",
    ]);
    expect(parseConfigJson(stringifyConfig(config))).toEqual(config);
  });

  it("shows a string-form address in the control (non-empty) and does not destroy it on edit", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ inbounds: [{ type: "tun", tag: "tun-in", address: "172.18.0.1/30", auto_route: true }] }),
    );
    act(() => {
      useProjectStore.getState().setSelectedId("inbound:tun-in");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));
    const addressInput = inspector.getByLabelText("Address", { exact: true }) as HTMLInputElement;

    // Before the fix the value rendered blank (toList of a string → ""), hiding the configured address.
    expect(addressInput.value).toBe("172.18.0.1/30");

    // Appending a second prefix keeps the original value rather than clobbering it on first edit.
    fireEvent.change(addressInput, { target: { value: "172.18.0.1/30, fdfe:dcba:9876::1/126" } });
    expect((useProjectStore.getState().config.inbounds![0] as Record<string, unknown>).address).toEqual([
      "172.18.0.1/30",
      "fdfe:dcba:9876::1/126",
    ]);
  });
});
