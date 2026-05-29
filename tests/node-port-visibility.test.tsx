import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { portIsConnected } from "../src/components/SbcNode";
import { useProjectStore } from "../src/state/useProjectStore";

// N1-connected-default: a card shows only its CONNECTED ports in the centered flow column; UNCONNECTED
// ports live in the `.sbc-node__ports-extra` overlay (hidden until hover / a compatible connect-drag,
// via CSS). Splitting connected vs unconnected is what this guards; the reveal itself is CSS-only and
// verified in the Playwright e2e (jsdom doesn't apply stylesheet CSS).

describe("N1 — portIsConnected", () => {
  it("reads connectivity from the per-direction connectedPorts map", () => {
    const cp = { input: ["route"], output: ["detour"] };
    expect(portIsConnected(cp, "input", "route")).toBe(true);
    expect(portIsConnected(cp, "input", "dns-detour")).toBe(false);
    expect(portIsConnected(cp, "output", "detour")).toBe(true);
    expect(portIsConnected({}, "input", "route")).toBe(false);
  });
});

describe("N1 — connected ports render in the primary column, unconnected in the overlay", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("a connected port is a primary child; unconnected ports sit in .sbc-node__ports-extra", () => {
    // route.final=direct connects direct's inbound "route" port; its other ports stay unconnected.
    useProjectStore.getState().importJson(
      JSON.stringify({ route: { final: "direct" }, outbounds: [{ type: "direct", tag: "direct" }] }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-outbound:direct"));
    const node = screen.getByTestId("node-outbound:direct");

    // No connected port is hidden in the overlay group.
    const overlayPorts = [...node.querySelectorAll(".sbc-node__ports-extra .sbc-port")];
    expect(overlayPorts.every((port) => port.getAttribute("data-connected") === "false")).toBe(true);

    // The connected "route" port is present, connected, and NOT inside the overlay (a primary child).
    const routePort = node.querySelector('[data-port-type="route"]');
    expect(routePort).not.toBeNull();
    expect(routePort?.getAttribute("data-connected")).toBe("true");
    expect(routePort?.closest(".sbc-node__ports-extra")).toBeNull();

    // There is at least one unconnected port, and it lives in the overlay.
    expect(overlayPorts.length).toBeGreaterThan(0);
  });
});
