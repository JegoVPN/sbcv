import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// L2-med-banners-copy (MED audit): four protocol / build-tag banners were inaccurate.
// - tuic 0-RTT "weaker forward secrecy" → upstream: "vulnerable to replay attacks".
// - tailscale/derp "Stock release binaries omit … support" is false — `with_tailscale` is enabled by
//   default (build-from-source.md), so it IS in official default builds; only custom builds drop it.
// - V2Ray API banner now backticks the tag + says "not in the default build" (`with_v2ray_api` is the
//   one tag NOT enabled by default).
// - block outbound "Imports still round-trip" is false — `block` was removed in 1.13 and is rejected on
//   both supported channels (stable 1.13 / testing 1.14).

describe("L2-med-banners-copy — protocol/build-tag banner accuracy", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("tuic 0-RTT hint names the replay-attack risk, not 'forward secrecy'", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ outbounds: [{ type: "tuic", tag: "t", server: "s", server_port: 443 }] }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-outbound:t"));
    const inspector = within(screen.getByTestId("node-inspector"));
    expect(inspector.getByText(/vulnerable to replay attacks/i)).toBeInTheDocument();
    expect(inspector.queryByText(/weaker forward secrecy/i)).toBeNull();
  });

  it("dns-server tailscale build-tag banner no longer claims stock binaries omit it", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ dns: { servers: [{ type: "tailscale", tag: "ts" }] } }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-dns-server:ts"));
    const inspector = within(screen.getByTestId("node-inspector"));
    expect(inspector.getByText(/in official default builds/i)).toBeInTheDocument();
    expect(inspector.queryByText(/Stock release binaries omit/i)).toBeNull();
  });

  it("endpoint tailscale build-tag banner is softened to default-build wording", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ endpoints: [{ type: "tailscale", tag: "te", auth_key: "k" }] }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-endpoint:te"));
    const inspector = within(screen.getByTestId("node-inspector"));
    expect(inspector.getByText(/in official default builds/i)).toBeInTheDocument();
    expect(inspector.queryByText(/Stock release binaries omit/i)).toBeNull();
  });

  it("service derp build-tag banner is softened to default-build wording", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ services: [{ type: "derp", tag: "d", listen: "::", listen_port: 8443 }] }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-service:d"));
    const inspector = within(screen.getByTestId("node-inspector"));
    expect(inspector.getByText(/in official default builds/i)).toBeInTheDocument();
    expect(inspector.queryByText(/Stock release binaries omit/i)).toBeNull();
  });

  it("block outbound banner says it was removed in 1.13, not 'imports still round-trip'", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ outbounds: [{ type: "block", tag: "b" }] }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-outbound:b"));
    const inspector = within(screen.getByTestId("node-inspector"));
    expect(inspector.getByText(/removed in sing-box 1\.13/i)).toBeInTheDocument();
    expect(inspector.queryByText(/still round-trip/i)).toBeNull();
  });

  it("V2Ray API banner names the tag and that it is not in the default build", () => {
    useProjectStore.getState().loadMinimal();
    useProjectStore.getState().createFromPalette("settings-experimental");
    render(<App />);
    const inspector = within(screen.getByTestId("node-inspector"));
    const banner = inspector.getByText(/Build-tag gate: V2Ray API/);
    expect(banner.textContent).toContain("with_v2ray_api");
    expect(banner.textContent).toMatch(/not in the default build/i);
  });
});
