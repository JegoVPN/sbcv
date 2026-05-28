import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A17 (W25): the redirect inbound rendered TWO platform banners, both wrongly stating "Linux only".
// Upstream: redirect is supported on Linux AND macOS; only tproxy is Linux-only. De-duplicate and fix
// the copy.

function importInbound(type: string) {
  useProjectStore.getState().importJson(
    JSON.stringify({ inbounds: [{ type, tag: `${type}-in`, listen: "::", listen_port: 1080 }] }),
  );
}

function platformBanners() {
  const inspector = screen.getByTestId("node-inspector");
  return Array.from(inspector.querySelectorAll(".inspector-banner--platform"));
}

describe("A17 — inbound-redirect platform banner", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("redirect shows exactly one platform banner that names macOS (Linux + macOS)", () => {
    importInbound("redirect");
    render(<App />);
    fireEvent.click(screen.getByTestId("node-inbound:redirect-in"));

    const banners = platformBanners();
    expect(banners).toHaveLength(1);
    expect(banners[0]?.textContent).toMatch(/macOS/);
    expect(banners[0]?.textContent).not.toMatch(/Linux-only|Linux only/i);
  });

  it("tproxy keeps exactly one Linux platform banner (no duplicate)", () => {
    importInbound("tproxy");
    render(<App />);
    fireEvent.click(screen.getByTestId("node-inbound:tproxy-in"));

    const banners = platformBanners();
    expect(banners).toHaveLength(1);
    expect(banners[0]?.textContent).toMatch(/Linux/);
  });
});
