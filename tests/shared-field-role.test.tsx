import { act, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A0/W3 guardrail, flipped green by A1 (shared-cards-by-direction).
// sharedFieldDefinitions now splits the TLS and multiplex cards by role: server role (inbound + service)
// presents a server certificate; client role (outbound + dns-server) verifies an upstream certificate.
// A server card must not render client-only fields and vice-versa (C0-6 / C0-7 / W6).

function inboundVmessInspector() {
  useProjectStore.getState().loadMinimal();
  act(() => {
    useProjectStore.getState().createFromPalette("inbound-vmess");
  });
  render(<App />);
  return within(screen.getByLabelText("Node inspector"));
}

function outboundVmessInspector() {
  useProjectStore.getState().importJson(JSON.stringify({
    outbounds: [{ type: "vmess", tag: "v-out", server: "127.0.0.1", server_port: 443, uuid: "00000000-0000-0000-0000-000000000000" }],
  }));
  act(() => {
    useProjectStore.getState().setSelectedId("outbound:v-out");
  });
  render(<App />);
  return within(screen.getByLabelText("Node inspector"));
}

describe("shared TLS/multiplex cards by direction (W3 / A1)", () => {
  it("inbound (server) shows server fields and hides client/outbound-only fields", () => {
    const inspector = inboundVmessInspector();
    expect(inspector.getByText("Server Name")).toBeInTheDocument(); // shared
    expect(inspector.getByText("Client Authentication")).toBeInTheDocument(); // TLS server-only
    expect(inspector.getByText("Padding")).toBeInTheDocument(); // multiplex shared
    expect(inspector.queryByText("Insecure")).not.toBeInTheDocument(); // TLS client-only
    expect(inspector.queryByText("Disable SNI")).not.toBeInTheDocument();
    expect(inspector.queryByText("Max Connections")).not.toBeInTheDocument(); // multiplex outbound-only
    expect(inspector.queryByText("Min Streams")).not.toBeInTheDocument();
  });

  it("outbound (client) shows client fields and hides server-only fields", () => {
    const inspector = outboundVmessInspector();
    expect(inspector.getByText("Insecure")).toBeInTheDocument(); // TLS client-only
    expect(inspector.getByText("Max Connections")).toBeInTheDocument(); // multiplex outbound-only
    expect(inspector.queryByText("Client Authentication")).not.toBeInTheDocument(); // TLS server-only
    expect(inspector.queryByText("Key Path")).not.toBeInTheDocument(); // TLS server-only
  });
});
