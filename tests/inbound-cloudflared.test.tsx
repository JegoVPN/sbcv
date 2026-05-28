import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { createInbound } from "../src/domain/commands";
import { validateConfig } from "../src/domain/diagnostics";
import { CREATABLE_INBOUND_TYPES } from "../src/domain/protocols";
import type { SingBoxChannel, SingBoxConfig } from "../src/domain/types";
import { useProjectStore } from "../src/state/useProjectStore";

// A21 (C1-22): full testing-target support for the cloudflared inbound (sing-box 1.14). Creatable on
// testing (gated on stable), with a token-required diagnostic and a first-class Inspector branch.

function codes(config: SingBoxConfig, channel: SingBoxChannel, version?: string) {
  return validateConfig(config, channel, version).map((d) => d.code);
}

describe("A21 — cloudflared testing inbound", () => {
  it("is creatable and scaffolds a token field", () => {
    expect(CREATABLE_INBOUND_TYPES as readonly string[]).toContain("cloudflared");
    const cf = createInbound("cloudflared", "cf-in") as Record<string, unknown>;
    expect(cf.type).toBe("cloudflared");
    expect("token" in cf).toBe(true);
  });

  describe("diagnostics", () => {
    const noToken = { inbounds: [{ type: "cloudflared", tag: "cf" }] } as unknown as SingBoxConfig;
    it("flags a missing token", () => {
      expect(codes(noToken, "testing")).toContain("inbound-cloudflared-token-missing");
    });
    it("warns it is testing-only on a stable (1.13) target", () => {
      const withToken = { inbounds: [{ type: "cloudflared", tag: "cf", token: "tok" }] } as unknown as SingBoxConfig;
      expect(codes(withToken, "stable", "1.13")).toContain("inbound-cloudflared-testing-only");
      expect(codes(withToken, "testing", "1.14")).not.toContain("inbound-cloudflared-testing-only");
    });
  });

  describe("UI", () => {
    beforeEach(() => {
      useProjectStore.getState().importJson(JSON.stringify({}));
      useProjectStore.getState().setChannel("testing");
    });
    afterEach(() => {
      useProjectStore.getState().setChannel("stable");
      useProjectStore.getState().importJson(JSON.stringify({}));
    });

    it("renders a Token control in the Inspector for a cloudflared inbound", () => {
      useProjectStore.getState().importJson(JSON.stringify({ inbounds: [{ type: "cloudflared", tag: "cf", token: "tok" }] }));
      useProjectStore.getState().setChannel("testing");
      render(<App />);
      fireEvent.click(screen.getByTestId("node-inbound:cf"));
      const inspector = within(screen.getByTestId("node-inspector"));
      expect(inspector.getByLabelText("Token")).toBeInTheDocument();
    });

    it("is gated on stable but actionable on testing in the Palette", () => {
      useProjectStore.getState().loadMinimal();
      useProjectStore.getState().setChannel("testing");
      render(<App />);
      const palette = within(screen.getByLabelText("Node palette"));
      fireEvent.click(palette.getByRole("button", { name: /Library/ }));
      fireEvent.click(palette.getByRole("button", { name: /^Inbounds/ }));
      // On testing, the Cloudflared entry is a "Setup" action (creatable), not gated.
      expect(palette.getByRole("button", { name: "Setup Cloudflared" })).toBeInTheDocument();
    });
  });
});
