import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// L2-fix-dns-hints (audit H8): the tailscale DNS server `accept_default_resolvers` toggle was labeled
// "(forward queries to MagicDNS chain)" — wrong. Upstream: it accepts the system DEFAULT resolvers for
// FALLBACK queries (in addition to MagicDNS); off ⇒ NXDOMAIN for non-Tailscale domains. The resolved
// server's bare label gained the equivalent fallback hint.

describe("L2-fix-dns-hints — accept_default_resolvers reads as fallback, not MagicDNS forwarding", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("tailscale dns-server label describes fallback, not 'MagicDNS chain'", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ dns: { servers: [{ type: "tailscale", tag: "ts", endpoint: "ep" }] } }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-dns-server:ts"));
    const inspector = within(screen.getByTestId("node-inspector"));
    expect(inspector.getByText(/Accept default resolvers for fallback/)).toBeInTheDocument();
    expect(inspector.queryByText(/MagicDNS chain/)).toBeNull();
  });

  it("resolved dns-server gains a fallback hint (no longer a bare label)", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ dns: { servers: [{ type: "resolved", tag: "rv" }] } }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-dns-server:rv"));
    const inspector = within(screen.getByTestId("node-inspector"));
    expect(inspector.getByText(/Accept default resolvers for fallback/)).toBeInTheDocument();
  });
});
