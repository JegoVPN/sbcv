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

    it("is gated on stable but actionable on testing in the Palette", async () => {
      useProjectStore.getState().loadMinimal();
      useProjectStore.getState().setChannel("testing");
      render(<App />);
      const palette = within(await screen.findByLabelText("Node palette"));
      fireEvent.click(palette.getByRole("button", { name: /Library/ }));
      fireEvent.click(palette.getByRole("button", { name: /^Inbounds/ }));
      // On testing, the Cloudflared entry is a "Setup" action (creatable), not gated.
      expect(palette.getByRole("button", { name: "Add Cloudflared" })).toBeInTheDocument();
    });
  });
});

// C4 (G3): "Add Cloudflared" on the testing target actually creates a cloudflared inbound (seeded
// token:"") and selects it, instead of being a dead click. The store gate must agree with the
// palette's testing-only itemStatus. Source: testing/configuration/inbound/cloudflared.md.
describe("C4 — cloudflared palette creation", () => {
  beforeEach(() => {
    useProjectStore.getState().importJson(JSON.stringify({}));
  });
  afterEach(() => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("creates exactly one cloudflared inbound (token empty) and selects it on testing", () => {
    useProjectStore.getState().setChannel("testing");
    useProjectStore.getState().createFromPalette("inbound-cloudflared");
    const state = useProjectStore.getState();
    const cloudflared = (state.config.inbounds ?? []).filter((i) => (i as { type?: string }).type === "cloudflared");
    expect(cloudflared).toHaveLength(1);
    expect((cloudflared[0] as { tag?: string }).tag).toBe("cloudflared-in");
    expect((cloudflared[0] as { token?: unknown }).token).toBe("");
    expect(state.selectedId).toBe("inbound:cloudflared-in");
  });

  it("creates nothing on stable (still needs 1.14)", () => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().createFromPalette("inbound-cloudflared");
    const inbounds = useProjectStore.getState().config.inbounds ?? [];
    expect(inbounds.filter((i) => (i as { type?: string }).type === "cloudflared")).toHaveLength(0);
  });

  it("does not regress non-cloudflared inbound creation", () => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().createFromPalette("inbound-mixed");
    const inbounds = useProjectStore.getState().config.inbounds ?? [];
    expect(inbounds.filter((i) => (i as { type?: string }).type === "mixed")).toHaveLength(1);
  });

  it("click-through: 'Add Cloudflared' renders a cloudflared node", async () => {
    useProjectStore.getState().loadMinimal();
    useProjectStore.getState().setChannel("testing");
    render(<App />);
    const palette = within(await screen.findByLabelText("Node palette"));
    fireEvent.click(palette.getByRole("button", { name: /Library/ }));
    fireEvent.click(palette.getByRole("button", { name: /^Inbounds/ }));
    fireEvent.click(palette.getByRole("button", { name: "Add Cloudflared" }));
    expect(screen.getByTestId("node-inbound:cloudflared-in")).toBeInTheDocument();
    const cloudflared = (useProjectStore.getState().config.inbounds ?? []).filter(
      (i) => (i as { type?: string }).type === "cloudflared",
    );
    expect(cloudflared).toHaveLength(1);
    expect((cloudflared[0] as { token?: unknown }).token).toBe("");
  });
});
