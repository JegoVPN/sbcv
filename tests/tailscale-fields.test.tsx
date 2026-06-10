import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxChannel, SingBoxConfig } from "../src/domain/types";
import { useProjectStore } from "../src/state/useProjectStore";

// U4 — Tailscale endpoint: accept_routes / ephemeral / exit_node / exit_node_allow_lan_access /
// hostname / relay_server_port are documented (endpoint/tailscale.md) but had no dedicated control, no
// factory seed, and were not in the handled set. AdvancedScalarFields only iterates keys that already
// exist on the entity, so a from-scratch tailscale node could never set them. Add inline controls and
// register the keys as handled + inline-rendered (C17 guard). relay_server_port is 1.13+, so it also
// gets a version gate (advertise_tags / system_interface are the sibling 1.13 gates).

function codes(config: SingBoxConfig, channel: SingBoxChannel, version?: string) {
  return validateConfig(config, channel, version).map((d) => d.code);
}

describe("U4 — Tailscale endpoint fields", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  function openTailscale(extra: Record<string, unknown> = {}) {
    useProjectStore
      .getState()
      .importJson(JSON.stringify({ endpoints: [{ type: "tailscale", tag: "ts", auth_key: "k", ...extra }] }));
    render(<App />);
    fireEvent.click(screen.getByTestId("node-endpoint:ts"));
  }
  const ep = () => useProjectStore.getState().config.endpoints?.[0] as Record<string, unknown> | undefined;

  it("toggles accept_routes / ephemeral / exit_node_allow_lan_access as booleans", () => {
    openTailscale();
    for (const [label, key] of [
      [/^Accept Routes/, "accept_routes"],
      [/^Ephemeral/, "ephemeral"],
      [/^Exit Node Allow LAN Access/, "exit_node_allow_lan_access"],
    ] as const) {
      const cb = screen.getByLabelText(label) as HTMLInputElement;
      expect(cb.type).toBe("checkbox");
      // Off by default; checking writes the explicit boolean, unchecking removes the key (== default false).
      fireEvent.click(cb);
      expect(ep()?.[key]).toBe(true);
      fireEvent.click(cb);
      expect(ep()?.[key]).toBeUndefined();
    }
  });

  it("edits exit_node and hostname as strings (blank clears)", () => {
    openTailscale();
    const exitNode = screen.getByLabelText("Exit Node") as HTMLInputElement;
    fireEvent.change(exitNode, { target: { value: "us-exit-1" } });
    expect(ep()?.exit_node).toBe("us-exit-1");
    fireEvent.change(exitNode, { target: { value: "" } });
    expect(ep()?.exit_node).toBeUndefined();

    const hostname = screen.getByLabelText("Hostname") as HTMLInputElement;
    fireEvent.change(hostname, { target: { value: "my-node" } });
    expect(ep()?.hostname).toBe("my-node");
    fireEvent.change(hostname, { target: { value: "" } });
    expect(ep()?.hostname).toBeUndefined();
  });

  it("edits relay_server_port as an integer port (blank or 0 clears to the default)", () => {
    openTailscale();
    const port = screen.getByLabelText(/Relay Server Port/i) as HTMLInputElement;
    expect(port.type).toBe("number");
    fireEvent.change(port, { target: { value: "41641" } });
    expect(ep()?.relay_server_port).toBe(41641);
    fireEvent.change(port, { target: { value: "" } });
    expect(ep()?.relay_server_port).toBeUndefined();
    // upstream default is 0 (auto/disabled), so 0 prunes to unset rather than exporting a no-op value.
    fireEvent.change(port, { target: { value: "0" } });
    expect(ep()?.relay_server_port).toBeUndefined();
  });

  it("round-trips an imported from-scratch value through the new controls", () => {
    openTailscale({ accept_routes: true, ephemeral: true, exit_node: "us-exit-1", hostname: "node-a", relay_server_port: 41641 });
    expect((screen.getByLabelText(/^Accept Routes/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/^Ephemeral/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Exit Node") as HTMLInputElement).value).toBe("us-exit-1");
    expect((screen.getByLabelText("Hostname") as HTMLInputElement).value).toBe("node-a");
    expect((screen.getByLabelText(/Relay Server Port/i) as HTMLInputElement).value).toBe("41641");
  });

  describe("ssh_server (since sing-box 1.14.0)", () => {
    // Documented as bool-or-object with `true` ≡ `{ "enabled": true }` (endpoint/tailscale.md);
    // controls follow the udp_over_tcp precedent and edit the object form. The stable-target
    // backstop is the data-driven field-testing-only gate (VT3) — no bespoke version diagnostic.
    it("enables ssh_server as the documented object form and prunes the field when disabled", () => {
      openTailscale();
      const cb = screen.getByLabelText(/^SSH Server/) as HTMLInputElement;
      expect(cb.type).toBe("checkbox");
      fireEvent.click(cb);
      expect(ep()?.ssh_server).toEqual({ enabled: true });
      fireEvent.click(cb);
      expect(ep()?.ssh_server).toBeUndefined();
    });

    it("edits the disable_* options inside the object (unchecking prunes the key)", () => {
      openTailscale({ ssh_server: { enabled: true } });
      for (const [label, key] of [
        [/^Disable PTY/, "disable_pty"],
        [/^Disable SFTP/, "disable_sftp"],
        [/^Disable Forwarding/, "disable_forwarding"],
      ] as const) {
        const cb = screen.getByLabelText(label) as HTMLInputElement;
        fireEvent.click(cb);
        expect(ep()?.ssh_server).toEqual({ enabled: true, [key]: true });
        fireEvent.click(cb);
        expect(ep()?.ssh_server).toEqual({ enabled: true });
      }
    });

    it("reads the bare-boolean shorthand (true) and rewrites the object form on edit", () => {
      openTailscale({ ssh_server: true });
      expect((screen.getByLabelText(/^SSH Server/) as HTMLInputElement).checked).toBe(true);
      fireEvent.click(screen.getByLabelText(/^Disable SFTP/) as HTMLInputElement);
      expect(ep()?.ssh_server).toEqual({ enabled: true, disable_sftp: true });
    });

    it("preserves unknown ssh_server sub-keys when editing a documented option", () => {
      // Future upstream sub-keys must survive a toggle edit — editing one documented
      // option must not silently drop sibling data the controls don't know about.
      openTailscale({ ssh_server: { enabled: true, future_key: "x" } });
      fireEvent.click(screen.getByLabelText(/^Disable SFTP/) as HTMLInputElement);
      expect(ep()?.ssh_server).toEqual({ enabled: true, future_key: "x", disable_sftp: true });
    });

    it("treats an imported ssh_server:false as off and enables to the object form", () => {
      openTailscale({ ssh_server: false });
      const cb = screen.getByLabelText(/^SSH Server/) as HTMLInputElement;
      expect(cb.checked).toBe(false);
      fireEvent.click(cb);
      expect(ep()?.ssh_server).toEqual({ enabled: true });
    });

    it("hides the disable_* options while ssh_server is off", () => {
      openTailscale();
      expect(screen.queryByLabelText(/^Disable PTY/)).toBeNull();
      expect(screen.queryByLabelText(/^Disable SFTP/)).toBeNull();
      expect(screen.queryByLabelText(/^Disable Forwarding/)).toBeNull();
    });
  });

  describe("relay_server_port version gate (since sing-box 1.13.0)", () => {
    const GATE = "endpoint-tailscale-relay-server-port-1-13-only";
    it("flags a relay_server_port on a 1.12 target, clean on 1.13", () => {
      const config = {
        endpoints: [{ type: "tailscale", tag: "ts", auth_key: "k", relay_server_port: 41641 }],
      } as unknown as SingBoxConfig;
      expect(codes(config, "stable", "1.12")).toContain(GATE);
      expect(codes(config, "stable", "1.13")).not.toContain(GATE);
    });
    it("does not flag relay_server_port:0 (the upstream default — feature off)", () => {
      const config = {
        endpoints: [{ type: "tailscale", tag: "ts", auth_key: "k", relay_server_port: 0 }],
      } as unknown as SingBoxConfig;
      expect(codes(config, "stable", "1.12")).not.toContain(GATE);
    });
  });
});
