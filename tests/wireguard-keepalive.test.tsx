import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// U2 — WireGuard peer `persistent_keepalive_interval` is an integer number of seconds
// (endpoint/wireguard.md: "The persistent keepalive interval, in seconds."). The control wrote
// `event.target.value` verbatim (a string) with a "25s" placeholder, so the exported config carried a
// string where sing-box decodes a uint and rejects it. Sibling `port` is already coerced via
// parseOptionalPort; keepalive must coerce the same way. This is the audit's only emit-correctness bug.

function importWg(peer: Record<string, unknown> = {}) {
  useProjectStore.getState().importJson(
    JSON.stringify({
      endpoints: [
        {
          type: "wireguard",
          tag: "wg",
          address: ["172.16.0.2/32"],
          private_key: "EEKlAzKfS87ShJPnvEF3AiJjGS9JHEzgn2jB3J7yMkY=",
          peers: [{ address: "9.9.9.9", port: 1234, public_key: "k", allowed_ips: ["0.0.0.0/0"], ...peer }],
        },
      ],
    }),
  );
}

function peer0() {
  const ep = useProjectStore.getState().config.endpoints?.[0] as unknown as Record<string, unknown>;
  return (ep.peers as Record<string, unknown>[])[0]!;
}

describe("U2 — WireGuard peer persistent_keepalive_interval is an integer", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("writes an integer (not a string) and uses a numeric placeholder", () => {
    importWg();
    render(<App />);
    fireEvent.click(screen.getByTestId("node-endpoint:wg"));

    const input = screen.getByLabelText("Persistent Keepalive") as HTMLInputElement;
    // Placeholder must not suggest a duration string.
    expect(input.getAttribute("placeholder")).toBe("25");

    fireEvent.change(input, { target: { value: "25" } });
    expect(peer0().persistent_keepalive_interval).toBe(25);
    expect(typeof peer0().persistent_keepalive_interval).toBe("number");
  });

  it("reads an imported integer back into the control", () => {
    importWg({ persistent_keepalive_interval: 25 });
    render(<App />);
    fireEvent.click(screen.getByTestId("node-endpoint:wg"));
    const input = screen.getByLabelText("Persistent Keepalive") as HTMLInputElement;
    expect(input.value).toBe("25");
  });

  it("clears the field on empty / non-integer input instead of storing a bad value", () => {
    importWg({ persistent_keepalive_interval: 25 });
    render(<App />);
    fireEvent.click(screen.getByTestId("node-endpoint:wg"));
    const input = screen.getByLabelText("Persistent Keepalive") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "" } });
    expect(peer0().persistent_keepalive_interval).toBeUndefined();

    fireEvent.change(input, { target: { value: "abc" } });
    expect(peer0().persistent_keepalive_interval).toBeUndefined();

    // A fractional value is not a valid integer-seconds interval → cleared, never stored as a float.
    fireEvent.change(input, { target: { value: "2.5" } });
    expect(peer0().persistent_keepalive_interval).toBeUndefined();
  });

  it("exports the keepalive as a JSON number", () => {
    importWg();
    render(<App />);
    fireEvent.click(screen.getByTestId("node-endpoint:wg"));
    fireEvent.change(screen.getByLabelText("Persistent Keepalive"), { target: { value: "15" } });
    const json = JSON.stringify(useProjectStore.getState().config);
    expect(json).toContain('"persistent_keepalive_interval":15');
  });
});
