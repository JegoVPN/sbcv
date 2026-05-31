import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// U12 — standalone ACME certificate-provider could only set the flat fields (domain/email/provider/…); its
// dns01_challenge (provider + credentials) and the 1.14 http_client were reachable only as raw JSON. The
// inline-TLS ACME editor already has a structured dns01_challenge editor — extract it to a shared helper
// (parameterized by root path) so the standalone provider renders the same controls without drift.
// certificate_providers are testing-only (1.14), so the editor renders on testing.

function inspectorFor(provider: Record<string, unknown>) {
  useProjectStore.getState().setChannel("testing");
  useProjectStore.getState().importJson(JSON.stringify({ certificate_providers: [provider] }));
  act(() => {
    useProjectStore.getState().setChannel("testing");
    useProjectStore.getState().setSelectedId(`certificate-provider:${provider.tag}`);
  });
  render(<App />);
  return within(screen.getByLabelText("Node inspector"));
}
const cp = () => useProjectStore.getState().config.certificate_providers?.[0] as Record<string, unknown> | undefined;
const dns01 = () => cp()?.dns01_challenge as Record<string, unknown> | undefined;

describe("U12 — standalone ACME cert-provider dns01_challenge + http_client", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("renders a structured DNS01 provider control and writes dns01_challenge.provider", () => {
    const inspector = inspectorFor({ type: "acme", tag: "acme-cp", domain: ["a.example.com"] });
    const provider = inspector.getByText("DNS01 Provider").closest("label")!.querySelector("select")!;
    fireEvent.change(provider, { target: { value: "cloudflare" } });
    expect(dns01()?.provider).toBe("cloudflare");
  });

  it("gates provider-specific credentials (cloudflare → API Token, not alidns keys)", () => {
    const inspector = inspectorFor({ type: "acme", tag: "acme-cp", dns01_challenge: { provider: "cloudflare" } });
    expect(inspector.getByText("DNS01 API Token")).toBeInTheDocument();
    expect(inspector.queryByText("DNS01 Access Key ID")).toBeNull();
  });

  it("shows the alidns credentials when provider is alidns", () => {
    const inspector = inspectorFor({ type: "acme", tag: "acme-cp", dns01_challenge: { provider: "alidns" } });
    expect(inspector.getByText("DNS01 Access Key ID")).toBeInTheDocument();
    expect(inspector.queryByText("DNS01 API Token")).toBeNull();
  });

  it("exposes the 1.14 dns01 fields (TTL) on testing", () => {
    const inspector = inspectorFor({ type: "acme", tag: "acme-cp", dns01_challenge: { provider: "cloudflare" } });
    expect(inspector.getByText("DNS01 TTL")).toBeInTheDocument();
  });

  it("exposes an HTTP Client select for the cert-provider", () => {
    const inspector = inspectorFor({ type: "acme", tag: "acme-cp", http_clients: undefined });
    expect(inspector.getByText("HTTP Client")).toBeInTheDocument();
  });

  it("round-trips an imported dns01_challenge credential", () => {
    const inspector = inspectorFor({ type: "acme", tag: "acme-cp", dns01_challenge: { provider: "cloudflare", api_token: "tok" } });
    const token = inspector.getByText("DNS01 API Token").closest("label")!.querySelector("input")!;
    expect(token.value).toBe("tok");
  });
});
