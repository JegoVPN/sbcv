import { act, render, screen, within, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// C2 (G2) slice B: a selected certificate_providers[] entry opens a per-type structured editor —
// acme (domain[]/email/provider/data_directory + 1.14 key_type/profile/account_key + EAB),
// cloudflare-origin-ca (domain[]/api_token/origin_ca_key/request_type/requested_validity), and tailscale
// (endpoint picker). Source: testing/.../shared/certificate-provider/{acme,cloudflare-origin-ca,tailscale}.md.
// certificate_providers are testing-only (1.14), so no in-editor channel gate.

function inspectorFor(provider: Record<string, unknown>) {
  useProjectStore.getState().setChannel("testing");
  useProjectStore.getState().importJson(JSON.stringify({
    certificate_providers: [provider],
    endpoints: [{ type: "tailscale", tag: "ts-ep" }],
  }));
  act(() => {
    useProjectStore.getState().setChannel("testing");
    useProjectStore.getState().setSelectedId(`certificate-provider:${provider.tag}`);
  });
  render(<App />);
  return within(screen.getByLabelText("Node inspector"));
}

afterEach(() => {
  useProjectStore.getState().setChannel("stable");
  useProjectStore.getState().importJson(JSON.stringify({}));
});

describe("C2b — certificate-provider per-type Inspector editor", () => {
  it("acme shows domain / email / provider / key_type controls", () => {
    const inspector = inspectorFor({ type: "acme", tag: "acme-cp", domain: ["a.example.com"] });
    expect(inspector.getByText("Domain")).toBeInTheDocument();
    expect(inspector.getByText("Email")).toBeInTheDocument();
    expect(inspector.getByText("Provider")).toBeInTheDocument();
    expect(inspector.getByText("Key Type")).toBeInTheDocument();
    expect(inspector.getByText("EAB Key ID")).toBeInTheDocument();
  });

  it("acme edits write through canonical config", () => {
    const inspector = inspectorFor({ type: "acme", tag: "acme-cp", domain: [] });
    const email = inspector.getByText("Email").closest("label")!.querySelector("input")!;
    fireEvent.change(email, { target: { value: "ops@example.com" } });
    const provider = useProjectStore.getState().config.certificate_providers?.[0] as Record<string, unknown>;
    expect(provider.email).toBe("ops@example.com");
  });

  it("clearing the last EAB sub-field drops external_account entirely (no empty-object noise)", () => {
    const inspector = inspectorFor({ type: "acme", tag: "acme-cp", domain: [], external_account: { key_id: "k" } });
    const eab = inspector.getByText("EAB Key ID").closest("label")!.querySelector("input")!;
    fireEvent.change(eab, { target: { value: "" } });
    const provider = useProjectStore.getState().config.certificate_providers?.[0] as Record<string, unknown>;
    expect(provider.external_account).toBeUndefined();
  });

  it("requested_validity round-trips as a number, not a string", () => {
    const inspector = inspectorFor({ type: "cloudflare-origin-ca", tag: "cf-cp", domain: [] });
    const validity = inspector.getByText("Requested Validity").closest("label")!.querySelector("input")!;
    fireEvent.change(validity, { target: { value: "90" } });
    const provider = useProjectStore.getState().config.certificate_providers?.[0] as Record<string, unknown>;
    expect(provider.requested_validity).toBe(90);
  });

  it("cloudflare-origin-ca shows api_token / request_type / requested_validity", () => {
    const inspector = inspectorFor({ type: "cloudflare-origin-ca", tag: "cf-cp", domain: ["a.example.com"] });
    expect(inspector.getByText("API Token")).toBeInTheDocument();
    expect(inspector.getByText("Origin CA Key")).toBeInTheDocument();
    expect(inspector.getByText("Request Type")).toBeInTheDocument();
    expect(inspector.getByText("Requested Validity")).toBeInTheDocument();
    // No ACME-only control leaks into the cloudflare editor.
    expect(inspector.queryByText("Key Type")).not.toBeInTheDocument();
  });

  it("tailscale shows an endpoint picker populated with tailscale endpoints", () => {
    const inspector = inspectorFor({ type: "tailscale", tag: "ts-cp", endpoint: "" });
    const endpointLabel = inspector.getByText("Endpoint").closest("label")!;
    const select = endpointLabel.querySelector("select")!;
    expect(within(select).getByRole("option", { name: "ts-ep" })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "ts-ep" } });
    const provider = useProjectStore.getState().config.certificate_providers?.[0] as Record<string, unknown>;
    expect(provider.endpoint).toBe("ts-ep");
    // No ACME / cloudflare controls leak into the tailscale editor.
    expect(inspector.queryByText("Provider")).not.toBeInTheDocument();
    expect(inspector.queryByText("API Token")).not.toBeInTheDocument();
  });
});
