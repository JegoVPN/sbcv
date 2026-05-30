import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { RouteRulesTable, DnsRulesTable } from "../src/components/RuleTables";
import { useProjectStore } from "../src/state/useProjectStore";

// R4 — type-driven visibility + dead rule-target cleanup.
// (1) A required identity field (server / server_port / path) omitted by an imported config still renders
//     an editable Inspector control, driven by the schema factory — not by the field's presence — so it
//     is repairable from the GUI instead of forcing a JSON edit.
// (2) Route/DNS rule tables hide the target select for actions where the target is scrubbed (dead control),
//     and still show it for route/evaluate. Endpoints are offered as route targets and round-trip.

const reset = () => useProjectStore.getState().importJson(JSON.stringify({}));

function importAndSelect(json: object, id: string) {
  useProjectStore.getState().importJson(JSON.stringify(json));
  act(() => {
    useProjectStore.getState().setSelectedId(id);
  });
}

describe("R4 — Inspector type-driven field repair", () => {
  beforeEach(reset);
  afterEach(reset);

  it("renders Server + Port for an imported shadowsocks outbound that omitted them, and edits round-trip", () => {
    importAndSelect(
      { outbounds: [{ type: "shadowsocks", tag: "ss", method: "aes-128-gcm", password: "x" }] },
      "outbound:ss",
    );
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));

    fireEvent.change(inspector.getByLabelText("Server"), { target: { value: "example.com" } });
    fireEvent.change(inspector.getByLabelText("Port"), { target: { value: "8388" } });

    const ss = useProjectStore.getState().config.outbounds![0] as Record<string, unknown>;
    expect(ss.server).toBe("example.com");
    expect(ss.server_port).toBe(8388);
  });

  it("renders Server / Port / Path for an imported DoH (https) dns-server that omitted them, and edits round-trip", () => {
    importAndSelect({ dns: { servers: [{ type: "https", tag: "doh" }] } }, "dns-server:doh");
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));

    // Use a non-default port (the field pre-fills 443 for https, so 443 would be a no-op change).
    fireEvent.change(inspector.getByLabelText("Server"), { target: { value: "1.1.1.1" } });
    fireEvent.change(inspector.getByLabelText("Port"), { target: { value: "8443" } });
    fireEvent.change(inspector.getByLabelText("Path"), { target: { value: "/custom-query" } });

    const doh = useProjectStore.getState().config.dns!.servers![0] as Record<string, unknown>;
    expect(doh.server).toBe("1.1.1.1");
    expect(doh.server_port).toBe(8443);
    expect(doh.path).toBe("/custom-query");
  });
});

describe("R4 — route rule table dead-control gating", () => {
  beforeEach(reset);
  afterEach(reset);

  it("shows the Outbound select for a route action and hides it for reject", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({
        outbounds: [{ type: "direct", tag: "direct-out" }],
        route: {
          rules: [
            { action: "route", outbound: "direct-out", domain_suffix: ["a.com"] },
            { action: "reject", domain_suffix: ["b.com"] },
          ],
        },
      }),
    );
    render(<RouteRulesTable />);
    // The "route" rule (1) keeps its target select; the "reject" rule (2) does not.
    expect(screen.getByLabelText("Route rule 1 outbound")).toBeTruthy();
    expect(screen.queryByLabelText("Route rule 2 outbound")).toBeNull();
  });

  it("offers an endpoint as a route target and the selection round-trips", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({
        outbounds: [{ type: "direct", tag: "direct-out" }],
        endpoints: [{ type: "wireguard", tag: "wg-ep" }],
        route: { rules: [{ action: "route", domain_suffix: ["a.com"] }] },
      }),
    );
    render(<RouteRulesTable />);
    const select = screen.getByLabelText("Route rule 1 outbound") as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toContain("wg-ep");

    fireEvent.change(select, { target: { value: "wg-ep" } });
    expect((useProjectStore.getState().config.route!.rules![0] as Record<string, unknown>).outbound).toBe("wg-ep");
  });
});

describe("R4 — dns rule table dead-control gating", () => {
  beforeEach(reset);
  afterEach(reset);

  it("shows the Server select for route/evaluate and hides it for predefined / reject", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({
        dns: {
          servers: [{ type: "udp", tag: "udp-dns", server: "1.1.1.1" }],
          rules: [
            { action: "route", server: "udp-dns", domain_suffix: ["a.com"] },
            { action: "predefined", rcode: "NXDOMAIN", domain_suffix: ["b.com"] },
            { action: "reject", domain_suffix: ["c.com"] },
          ],
        },
      }),
    );
    render(<DnsRulesTable />);
    expect(screen.getByLabelText("DNS rule 1 server")).toBeTruthy();
    expect(screen.queryByLabelText("DNS rule 2 server")).toBeNull();
    expect(screen.queryByLabelText("DNS rule 3 server")).toBeNull();
  });
});
