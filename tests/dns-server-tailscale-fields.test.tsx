import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A15 (W23 / C1-5): the dns-server `tailscale` `accept_search_domain` field (bool, sing-box 1.14.0) had
// no first-class control, so a testing-channel user could not enable the one new field of the 1.14 doc
// revision. (endpoint is already type-gated to tailscale; the spurious detour port was already removed.)

function importTailscaleDns() {
  useProjectStore.getState().importJson(
    JSON.stringify({
      endpoints: [{ type: "tailscale", tag: "ep", auth_key: "k" }],
      dns: { servers: [{ type: "tailscale", tag: "ts-dns", endpoint: "ep" }] },
    }),
  );
}

describe("A15 — dns-server tailscale accept_search_domain", () => {
  beforeEach(() => {
    useProjectStore.getState().importJson(JSON.stringify({}));
    useProjectStore.getState().setChannel("stable");
  });
  afterEach(() => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("shows a testing-gated accept_search_domain toggle that round-trips", () => {
    importTailscaleDns();
    useProjectStore.getState().setChannel("testing");
    render(<App />);
    fireEvent.click(screen.getByTestId("node-dns-server:ts-dns"));

    const toggle = screen.getByLabelText(/Accept search domain/i) as HTMLInputElement;
    expect(toggle.type).toBe("checkbox");
    fireEvent.click(toggle);
    expect(useProjectStore.getState().config.dns?.servers?.[0]?.accept_search_domain).toBe(true);
    fireEvent.click(toggle);
    expect(useProjectStore.getState().config.dns?.servers?.[0]?.accept_search_domain).toBeUndefined();
  });

  it("hides the accept_search_domain toggle on stable (it is sing-box 1.14+)", () => {
    importTailscaleDns();
    render(<App />);
    fireEvent.click(screen.getByTestId("node-dns-server:ts-dns"));
    expect(screen.queryByLabelText(/Accept search domain/i)).toBeNull();
    // accept_default_resolvers (1.12) stays available.
    expect(screen.getByLabelText(/Accept default resolvers/i)).toBeInTheDocument();
  });
});
