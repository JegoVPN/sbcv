import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A29 (W35): node subtitles were generic type-repeats — `socks inbound`, `tls dns server` — which, now
// that the titlebar reads "Inbound · SOCKS" (A28), are pure duplication. Inbound and DNS-server
// subtitles now carry real connection info (listen host:port, server host[:port]) like the endpoint /
// outbound / service subtitles already do.

function subtitleOf(nodeId: string): string {
  const node = screen.getByTestId(`node-${nodeId}`);
  return node.querySelector(".sbc-node__subtitle")?.textContent ?? "";
}

afterEach(() => {
  useProjectStore.getState().importJson(JSON.stringify({}));
});

describe("A29 — inbound subtitle shows the listen address", () => {
  it("shows `listen host:port`, not the redundant `socks inbound`", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ inbounds: [{ type: "socks", tag: "in", listen: "127.0.0.1", listen_port: 1080 }] }),
    );
    render(<App />);
    expect(subtitleOf("inbound:in")).toBe("listen 127.0.0.1:1080");
  });

  it("shows `listen :port` when only a port is set", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ inbounds: [{ type: "http", tag: "in", listen_port: 8080 }] }),
    );
    render(<App />);
    expect(subtitleOf("inbound:in")).toBe("listen :8080");
  });

  it("falls back to the type descriptor when there is no listen address", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ inbounds: [{ type: "tun", tag: "in" }] }),
    );
    render(<App />);
    expect(subtitleOf("inbound:in")).toBe("tun inbound");
  });
});

describe("A29 — dns-server subtitle shows the server address", () => {
  it("shows the remote server host[:port], not the redundant `tls dns server`", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ dns: { servers: [{ type: "tls", tag: "cf", server: "1.1.1.1", server_port: 853 }] } }),
    );
    render(<App />);
    expect(subtitleOf("dns-server:cf")).toBe("1.1.1.1:853");
  });

  it("falls back to the type descriptor for a local server with no address", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ dns: { servers: [{ type: "local", tag: "sys" }] } }),
    );
    render(<App />);
    expect(subtitleOf("dns-server:sys")).toBe("local dns server");
  });

  it("reads the legacy 1.11 `address` URL when there is no structured `server`", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ dns: { servers: [{ type: "tls", tag: "leg", address: "tls://1.1.1.1" }] } }),
    );
    render(<App />);
    expect(subtitleOf("dns-server:leg")).toBe("tls://1.1.1.1");
  });

  it("shows `via <endpoint>` for a tailscale dns server", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({
        endpoints: [{ type: "tailscale", tag: "ts-ep" }],
        dns: { servers: [{ type: "tailscale", tag: "ts", endpoint: "ts-ep" }] },
      }),
    );
    render(<App />);
    expect(subtitleOf("dns-server:ts")).toBe("via ts-ep");
  });
});
