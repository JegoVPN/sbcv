import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { createConfigExport } from "../src/domain/serialization";
import { parseConfigJson } from "../src/domain/serialization";
import { useProjectStore } from "../src/state/useProjectStore";

// C3 (G4): the deprecated-but-valid inbound server `tls.acme` object becomes fully editable via a
// structured ACME editor + dns01_challenge sub-editor, instead of being swallowed by handledFields.
// Source: stable/.../shared/tls.md (ACME = server/Inbound-only), stable+testing/.../shared/dns01_challenge.md.

function importInbound(tls: unknown, channel: "stable" | "testing" = "stable") {
  useProjectStore.getState().importJson(
    JSON.stringify({ inbounds: [{ type: "trojan", tag: "t", listen: "127.0.0.1", listen_port: 443, users: [{ name: "u", password: "p" }], tls }] }),
  );
  useProjectStore.getState().setChannel(channel);
}

function importOutbound(tls: unknown) {
  useProjectStore.getState().importJson(
    JSON.stringify({ outbounds: [{ type: "trojan", tag: "o", server: "x", server_port: 443, password: "p", tls }] }),
  );
}

describe("C3 — inbound TLS ACME editor", () => {
  beforeEach(() => {
    useProjectStore.getState().importJson(JSON.stringify({}));
  });
  afterEach(() => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("inbound (server role) shows ACME Domain + DNS01 Provider; outbound (client role) does not", () => {
    importInbound({ enabled: true, server_name: "e.com" });
    render(<App />);
    fireEvent.click(screen.getByTestId("node-inbound:t"));
    expect(screen.getByText("ACME Domain")).toBeTruthy();
    expect(screen.getByText("DNS01 Provider")).toBeTruthy();
  });

  it("outbound TLS shows no ACME surface", () => {
    importOutbound({ enabled: true, server_name: "e.com" });
    render(<App />);
    fireEvent.click(screen.getByTestId("node-outbound:o"));
    expect(screen.queryByText("ACME Domain")).toBeNull();
    expect(screen.queryByText("DNS01 Provider")).toBeNull();
  });

  it("channel-gates the 1.14 dns01 fields (hidden on stable, shown on testing)", () => {
    importInbound({ enabled: true, server_name: "e.com" }, "stable");
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByTestId("node-inbound:t"));
    expect(screen.queryByText("DNS01 Override Domain")).toBeNull();
    unmount();

    importInbound({ enabled: true, server_name: "e.com" }, "testing");
    render(<App />);
    fireEvent.click(screen.getByTestId("node-inbound:t"));
    expect(screen.getByText("DNS01 Override Domain")).toBeTruthy();
  });

  it("gates provider-specific dns01 fields on the chosen provider", () => {
    importInbound({ enabled: true, server_name: "e.com", acme: { domain: ["e.com"], dns01_challenge: { provider: "cloudflare" } } });
    render(<App />);
    fireEvent.click(screen.getByTestId("node-inbound:t"));
    expect(screen.getByText("DNS01 API Token")).toBeTruthy(); // cloudflare field
    expect(screen.queryByText("DNS01 Access Key ID")).toBeNull(); // alidns field hidden
  });

  it("round-trips a tls.acme object (custom https provider + dns01 cloudflare) unchanged through export", () => {
    const acme = {
      domain: ["e.com"],
      email: "a@e.com",
      provider: "https://acme.example/dir",
      external_account: { key_id: "k", mac_key: "m" },
      dns01_challenge: { provider: "cloudflare", api_token: "tok" },
    };
    importInbound({ enabled: true, server_name: "e.com", acme });
    const exported = createConfigExport(useProjectStore.getState().config);
    const reparsed = parseConfigJson(exported.contents);
    const inbound = (reparsed.inbounds?.[0] as Record<string, unknown>).tls as Record<string, unknown>;
    expect(inbound.acme).toEqual(acme);
  });
});
