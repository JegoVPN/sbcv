import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A19 (W27): the V2Ray API build-tag banner told users to compile with the `v2rayapi` tag, but the
// upstream build tag is `with_v2ray_api` (installation/build-from-source.md). Following the wrong copy
// yields a binary that still lacks V2Ray API.

describe("A19 — settings-experimental V2Ray build-tag label", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("names the correct upstream build tag with_v2ray_api", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ experimental: { v2ray_api: { listen: "127.0.0.1:8080" } } }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-settings:experimental"));

    const inspector = within(screen.getByTestId("node-inspector"));
    const banner = inspector.getByText(/Build-tag gate: V2Ray API/);
    expect(banner.textContent).toContain("with_v2ray_api");
    // The bare wrong tag must be gone.
    expect(banner.textContent).not.toMatch(/\bv2rayapi\b/);
  });
});
