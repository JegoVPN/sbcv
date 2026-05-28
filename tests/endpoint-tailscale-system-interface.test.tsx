import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxChannel, SingBoxConfig } from "../src/domain/types";
import { useProjectStore } from "../src/state/useProjectStore";

// A14 (W22 / C0-13): tailscale endpoint `system_interface` is a BOOLEAN ("create a system TUN
// interface"), not a string; the custom name is `system_interface_name` and the MTU is
// `system_interface_mtu`. All three are sing-box 1.13+.

function codes(config: SingBoxConfig, channel: SingBoxChannel, version?: string) {
  return validateConfig(config, channel, version).map((d) => d.code);
}
const GATE = "endpoint-tailscale-system-interface-1-13-only";

describe("A14 — endpoint-tailscale system_interface", () => {
  describe("Inspector controls", () => {
    beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
    afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

    function importTailscale(extra: Record<string, unknown> = {}) {
      useProjectStore.getState().importJson(
        JSON.stringify({ endpoints: [{ type: "tailscale", tag: "ts", auth_key: "k", ...extra }] }),
      );
    }

    it("renders system_interface as a boolean checkbox", () => {
      importTailscale({ system_interface: true });
      render(<App />);
      fireEvent.click(screen.getByTestId("node-endpoint:ts"));

      const checkbox = screen.getByLabelText("System Interface (since sing-box 1.13.0)") as HTMLInputElement;
      expect(checkbox.type).toBe("checkbox");
      expect(checkbox.checked).toBe(true);

      // Unchecking removes the key (equivalent to the upstream default `false`), keeping export minimal.
      fireEvent.click(checkbox);
      expect(useProjectStore.getState().config.endpoints?.[0]?.system_interface).toBeUndefined();
      // Re-checking writes the explicit boolean true.
      fireEvent.click(checkbox);
      expect(useProjectStore.getState().config.endpoints?.[0]?.system_interface).toBe(true);
    });

    it("edits system_interface_name (string) and system_interface_mtu (number)", () => {
      importTailscale();
      render(<App />);
      fireEvent.click(screen.getByTestId("node-endpoint:ts"));

      fireEvent.change(screen.getByLabelText("System Interface Name (since sing-box 1.13.0)"), { target: { value: "tailscale0" } });
      expect(useProjectStore.getState().config.endpoints?.[0]?.system_interface_name).toBe("tailscale0");

      const mtu = screen.getByLabelText("System Interface MTU (since sing-box 1.13.0)");
      fireEvent.change(mtu, { target: { value: "1280" } });
      expect(useProjectStore.getState().config.endpoints?.[0]?.system_interface_mtu).toBe(1280);

      // Non-finite input clears the field instead of storing NaN (which would export as null).
      fireEvent.change(mtu, { target: { value: "" } });
      expect(useProjectStore.getState().config.endpoints?.[0]?.system_interface_mtu).toBeUndefined();
    });
  });

  describe("version gate (1.13+)", () => {
    it("flags a boolean system_interface on a 1.12 target, clean on 1.13", () => {
      const config = { endpoints: [{ type: "tailscale", tag: "ts", auth_key: "k", system_interface: true }] } as unknown as SingBoxConfig;
      expect(codes(config, "stable", "1.12")).toContain(GATE);
      expect(codes(config, "stable", "1.13")).not.toContain(GATE);
    });
    it("does not flag system_interface:false (the default — feature off)", () => {
      const config = { endpoints: [{ type: "tailscale", tag: "ts", auth_key: "k", system_interface: false }] } as unknown as SingBoxConfig;
      expect(codes(config, "stable", "1.12")).not.toContain(GATE);
    });
    it("flags system_interface_name / system_interface_mtu on a 1.12 target", () => {
      const named = { endpoints: [{ type: "tailscale", tag: "ts", auth_key: "k", system_interface_name: "tailscale0" }] } as unknown as SingBoxConfig;
      expect(codes(named, "stable", "1.12")).toContain(GATE);
      const mtu = { endpoints: [{ type: "tailscale", tag: "ts", auth_key: "k", system_interface_mtu: 1280 }] } as unknown as SingBoxConfig;
      expect(codes(mtu, "stable", "1.12")).toContain(GATE);
    });
  });
});
