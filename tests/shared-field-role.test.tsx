import { act, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A0 / W3 guardrail (Pass-2 T1/T2; Codex C0-6/C0-7).
// sharedFieldDefinitions (src/components/Inspector.tsx:1502-1567) returns one TLS/multiplex field list
// regardless of ref.kind, so an INBOUND TLS card renders client-only fields and an inbound multiplex card
// renders outbound-only fields. These are characterization tests: green today, they flip RED when A1
// (shared-cards-by-direction) splits the field list by direction — at which point update them to assert
// the inbound (server) field set. The harness `it` proves the cards render so a flip can't be masked.

function renderInboundVmessInspector() {
  useProjectStore.getState().loadMinimal();
  act(() => {
    useProjectStore.getState().createFromPalette("inbound-vmess");
  });
  render(<App />);
  return within(screen.getByLabelText("Node inspector"));
}

describe("shared TLS/multiplex cards by direction (W3 -> A1)", () => {
  it("harness: an inbound vmess inspector renders the shared TLS and multiplex cards", () => {
    const inspector = renderInboundVmessInspector();
    // Role-neutral fields present in both directions — proves the cards rendered.
    expect(inspector.getByText("Server Name")).toBeInTheDocument();
    expect(inspector.getByText("Padding")).toBeInTheDocument();
  });

  it("documents inbound TLS rendering client-only fields today (C0-6)", () => {
    const inspector = renderInboundVmessInspector();
    expect(inspector.getByText("Insecure (client only)")).toBeInTheDocument();
    expect(inspector.getByText("Disable SNI (client only)")).toBeInTheDocument();
  });

  it("documents inbound multiplex rendering outbound-only fields today (C0-7)", () => {
    const inspector = renderInboundVmessInspector();
    expect(inspector.getByText("Max Connections")).toBeInTheDocument();
    expect(inspector.getByText("Min Streams")).toBeInTheDocument();
  });
});
