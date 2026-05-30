import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { parseConfigJson, stringifyConfig } from "../src/domain/serialization";
import { useProjectStore } from "../src/state/useProjectStore";

// V5-S1 — tun mtu / strict_route / interface_name are now first-class controls (previously raw-JSON-only),
// removing three common fields from the Advanced-JSON long tail. The C17 guard (no-silent-unreachable)
// separately proves they're structurally covered.

function selectTun() {
  useProjectStore.getState().importJson(
    JSON.stringify({ inbounds: [{ type: "tun", tag: "tun-in", address: ["172.19.0.1/30"], auto_route: true }] }),
  );
  act(() => {
    useProjectStore.getState().setSelectedId("inbound:tun-in");
  });
}

describe("V5-S1 — tun device fields", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("edits interface_name / mtu / strict_route into the canonical config and round-trips", () => {
    selectTun();
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));

    fireEvent.change(within(inspector.getByTestId("tun-interface-name")).getByRole("textbox"), {
      target: { value: "utun9" },
    });
    fireEvent.change(within(inspector.getByTestId("tun-mtu")).getByRole("spinbutton"), {
      target: { value: "9000" },
    });
    fireEvent.click(within(inspector.getByTestId("tun-strict-route")).getByRole("checkbox"));

    const tun = useProjectStore.getState().config.inbounds![0] as Record<string, unknown>;
    expect(tun.interface_name).toBe("utun9");
    expect(tun.mtu).toBe(9000);
    expect(tun.strict_route).toBe(true);

    // Round-trip: the edited config survives stringify → parse unchanged.
    const config = useProjectStore.getState().config;
    expect(parseConfigJson(stringifyConfig(config))).toEqual(config);
  });

  it("clears mtu/interface_name back to unset (pruned) when emptied", () => {
    selectTun();
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));

    const mtu = within(inspector.getByTestId("tun-mtu")).getByRole("spinbutton");
    fireEvent.change(mtu, { target: { value: "1500" } });
    expect((useProjectStore.getState().config.inbounds![0] as Record<string, unknown>).mtu).toBe(1500);
    fireEvent.change(mtu, { target: { value: "" } });
    expect((useProjectStore.getState().config.inbounds![0] as Record<string, unknown>).mtu).toBeUndefined();
  });
});
