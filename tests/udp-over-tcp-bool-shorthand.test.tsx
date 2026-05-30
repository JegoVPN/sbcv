import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { parseConfigJson, stringifyConfig } from "../src/domain/serialization";
import { useProjectStore } from "../src/state/useProjectStore";

// DF3 — sing-box `udp_over_tcp` accepts a boolean shorthand: `true` ≡ `{enabled:true}` (version defaults
// to 2), per shared/udp-over-tcp.md ("the structure can be replaced with a boolean value when the version
// is not specified"). The Enabled checkbox reads `["udp_over_tcp","enabled"]`, which is `undefined` for the
// boolean form → the card showed OFF even when the config meant ON. Fix: coerce a boolean `udp_over_tcp`
// to the object form at import (both shorthand and object `check` exit 0 on stable + testing).

describe("DF3 — udp_over_tcp boolean shorthand", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("coerces a boolean udp_over_tcp to the object form at import", () => {
    const on = parseConfigJson(
      JSON.stringify({ outbounds: [{ type: "socks", tag: "s", server: "1.2.3.4", server_port: 1080, udp_over_tcp: true }] }),
    );
    expect((on.outbounds![0] as Record<string, unknown>).udp_over_tcp).toEqual({ enabled: true });

    const off = parseConfigJson(
      JSON.stringify({ outbounds: [{ type: "socks", tag: "s", server: "1.2.3.4", server_port: 1080, udp_over_tcp: false }] }),
    );
    expect((off.outbounds![0] as Record<string, unknown>).udp_over_tcp).toEqual({ enabled: false });
  });

  it("leaves the object form untouched and round-trips", () => {
    const json = JSON.stringify({
      outbounds: [{ type: "socks", tag: "s", server: "1.2.3.4", server_port: 1080, udp_over_tcp: { enabled: true, version: 2 } }],
    });
    const config = parseConfigJson(json);
    expect((config.outbounds![0] as Record<string, unknown>).udp_over_tcp).toEqual({ enabled: true, version: 2 });
    expect(parseConfigJson(stringifyConfig(config))).toEqual(config);
  });

  it("shows the boolean shorthand as ON in the UDP over TCP card", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({
        outbounds: [
          { type: "shadowsocks", tag: "ss", server: "1.2.3.4", server_port: 8388, method: "aes-128-gcm", password: "p", udp_over_tcp: true },
        ],
      }),
    );
    act(() => {
      useProjectStore.getState().setSelectedId("outbound:ss");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));
    // Scope to the UDP over TCP ModuleCard — shadowsocks also renders a Multiplex card with its own
    // "Enabled" toggle, so the label is only unique within this section's <details>.
    const card = inspector.getByText("UDP over TCP").closest("details")!;
    const enabled = within(card).getByLabelText("Enabled") as HTMLInputElement;
    expect(enabled.checked).toBe(true);
  });
});
