import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// U5 — WireGuard endpoint: `listen_port`, `name` (system-interface scope), and `workers` are documented
// (endpoint/wireguard.md) but had no control. `listen_port` lives in listenSharedFields, but an endpoint
// only emits the Dial card (dialSharedFields, which excludes it); the `system` toggle was rendered but
// its paired `name` was not (half-implemented); `workers` had nothing. The factory seeds only {type,tag},
// so a from-scratch WireGuard endpoint could never set any of the three. Add inline controls + register
// the keys as handled (suppress the Advanced double-render) + inline-rendered (C17 guard). All three are
// 1.11+ base fields, so no version gate.

function importWg(extra: Record<string, unknown> = {}) {
  useProjectStore.getState().importJson(
    JSON.stringify({
      endpoints: [
        {
          type: "wireguard",
          tag: "wg",
          address: ["172.16.0.2/32"],
          private_key: "EEKlAzKfS87ShJPnvEF3AiJjGS9JHEzgn2jB3J7yMkY=",
          peers: [{ address: "9.9.9.9", port: 1234, public_key: "k", allowed_ips: ["0.0.0.0/0"] }],
          ...extra,
        },
      ],
    }),
  );
  render(<App />);
  fireEvent.click(screen.getByTestId("node-endpoint:wg"));
}
const ep = () => useProjectStore.getState().config.endpoints?.[0] as Record<string, unknown> | undefined;

describe("U5 — WireGuard endpoint fields", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("edits listen_port as an integer port (blank or out-of-range clears)", () => {
    importWg();
    const input = screen.getByLabelText("Listen Port") as HTMLInputElement;
    expect(input.type).toBe("number");
    fireEvent.change(input, { target: { value: "10000" } });
    expect(ep()?.listen_port).toBe(10000);
    expect(typeof ep()?.listen_port).toBe("number");
    fireEvent.change(input, { target: { value: "" } });
    expect(ep()?.listen_port).toBeUndefined();
    // a port is 1..65535; an out-of-range value never reaches the config.
    fireEvent.change(input, { target: { value: "99999" } });
    expect(ep()?.listen_port).toBeUndefined();
  });

  it("edits workers as a positive integer (0 == default CPU count, so blank/0 clears)", () => {
    importWg();
    const input = screen.getByLabelText(/^Workers/) as HTMLInputElement;
    expect(input.type).toBe("number");
    fireEvent.change(input, { target: { value: "4" } });
    expect(ep()?.workers).toBe(4);
    expect(typeof ep()?.workers).toBe("number");
    fireEvent.change(input, { target: { value: "" } });
    expect(ep()?.workers).toBeUndefined();
    // upstream default is 0 (= CPU count), so 0 prunes to unset rather than exporting a no-op.
    fireEvent.change(input, { target: { value: "0" } });
    expect(ep()?.workers).toBeUndefined();
  });

  it("hides the interface name control until the system interface is enabled", () => {
    importWg();
    expect(screen.queryByLabelText(/Interface Name/i)).toBeNull();
  });

  it("edits name when the system interface is enabled (system-interface scope)", () => {
    importWg({ system: true });
    const input = screen.getByLabelText(/Interface Name/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "wg-tun" } });
    expect(ep()?.name).toBe("wg-tun");
    fireEvent.change(input, { target: { value: "" } });
    expect(ep()?.name).toBeUndefined();
  });

  it("round-trips imported values into the controls", () => {
    importWg({ listen_port: 51820, workers: 2, system: true, name: "wg-tun" });
    expect((screen.getByLabelText("Listen Port") as HTMLInputElement).value).toBe("51820");
    expect((screen.getByLabelText(/^Workers/) as HTMLInputElement).value).toBe("2");
    expect((screen.getByLabelText(/Interface Name/i) as HTMLInputElement).value).toBe("wg-tun");
  });

  it("does not render listen_port / workers in the Advanced fallback (handled, no double control)", () => {
    importWg({ listen_port: 51820, workers: 2 });
    // Exactly one control each — the dedicated inline control, not also an Advanced kv row.
    expect(screen.getAllByLabelText("Listen Port")).toHaveLength(1);
    expect(screen.getAllByLabelText(/^Workers/)).toHaveLength(1);
  });
});
