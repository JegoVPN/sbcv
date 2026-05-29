import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// L2-fix-hysteria-mbps (audit H4): the Hysteria v1 outbound up_mbps/down_mbps placeholders said
// "empty = no rate limit", but upstream (outbound/hysteria.md) marks both as Required. Relabeled to
// "required (Mbps)". (H5/H6 — the broader "v1 deprecated" stance — deferred; see the goal doc.)

describe("L2-fix-hysteria-mbps — required Mbps placeholder", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("up/down Mbps placeholders say required, not 'no rate limit'", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ outbounds: [{ type: "hysteria", tag: "hy", server: "e.x", server_port: 443, up_mbps: 10, down_mbps: 50, auth_str: "x" }] }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-outbound:hy"));
    const up = within(screen.getByTestId("outbound-hysteria-up-mbps")).getByRole("spinbutton");
    const down = within(screen.getByTestId("outbound-hysteria-down-mbps")).getByRole("spinbutton");
    expect(up.getAttribute("placeholder")).toBe("required (Mbps)");
    expect(down.getAttribute("placeholder")).toBe("required (Mbps)");
  });
});
