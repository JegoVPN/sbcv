import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// U10 — same class as U1: the domain_resolver / default_domain_resolver Server <select> sources its
// options from another collection (DNS servers). When none exist it was a bare None-only dead end with no
// hint. Add an empty-state hint so the user knows to create a DNS server first (the in-place create is the
// optional, deferred part). No round-trip change.

const EMPTY_HINT = /No DNS servers defined/i;
const REF_HINT = /References a DNS server by tag/i;

describe("U10 — domain_resolver empty-state hint", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("shows the empty-state hint on an outbound Domain Resolver when no DNS servers exist", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ outbounds: [{ type: "socks", tag: "s", server: "1.1.1.1", server_port: 1080 }] }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-outbound:s"));
    expect(screen.getByText(EMPTY_HINT)).toBeInTheDocument();
    expect(screen.queryByText(REF_HINT)).toBeNull();
  });

  it("shows the reference hint once a DNS server exists", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({
        outbounds: [{ type: "socks", tag: "s", server: "1.1.1.1", server_port: 1080 }],
        dns: { servers: [{ type: "local", tag: "ls" }] },
      }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-outbound:s"));
    expect(screen.getByText(REF_HINT)).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_HINT)).toBeNull();
  });

  it("still round-trips a selected resolver tag (no behavior change)", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({
        outbounds: [{ type: "socks", tag: "s", server: "1.1.1.1", server_port: 1080, domain_resolver: "ls" }],
        dns: { servers: [{ type: "local", tag: "ls" }] },
      }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-outbound:s"));
    const select = screen.getByLabelText("Domain Resolver") as HTMLSelectElement;
    expect(select.value).toBe("ls");
  });
});
