import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxChannel, SingBoxConfig } from "../src/domain/types";
import { useProjectStore } from "../src/state/useProjectStore";

// U7a — outbound hysteria2: the obfs editor exposed only type+password, so the gecko-only on-wire packet
// sizes (obfs.min_packet_size / max_packet_size, 1.14) had no control; and the 1.14 top-level fields
// hop_interval_max / bbr_profile / realm (+ the older brutal_debug) had no control either. The outbound
// inspector gates versions via diagnostics (not UI channel-gating — matching the existing gecko option and
// the realm/bbr_profile/hop_interval_max diagnostics), so controls render unconditionally.

function codes(config: SingBoxConfig, channel: SingBoxChannel, version?: string) {
  return validateConfig(config, channel, version).map((d) => d.code);
}

function openHy2(extra: Record<string, unknown> = {}) {
  useProjectStore
    .getState()
    .importJson(JSON.stringify({ outbounds: [{ type: "hysteria2", tag: "hy2", server: "1.2.3.4", server_port: 443, password: "x", ...extra }] }));
  render(<App />);
  fireEvent.click(screen.getByTestId("node-outbound:hy2"));
}
const ob = () => useProjectStore.getState().config.outbounds?.[0] as Record<string, unknown> | undefined;
const obfs = () => ob()?.obfs as Record<string, unknown> | undefined;

describe("U7a — outbound hysteria2 obfs + 1.14 fields", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  describe("obfs gecko packet sizes", () => {
    it("shows + edits min/max packet size when obfs.type is gecko", () => {
      openHy2({ obfs: { type: "gecko", password: "p" } });
      const min = screen.getByLabelText(/Min Packet Size/i) as HTMLInputElement;
      const max = screen.getByLabelText(/Max Packet Size/i) as HTMLInputElement;
      expect(min.type).toBe("number");
      fireEvent.change(min, { target: { value: "512" } });
      expect(obfs()?.min_packet_size).toBe(512);
      fireEvent.change(max, { target: { value: "1200" } });
      expect(obfs()?.max_packet_size).toBe(1200);
    });

    it("hides the packet-size controls for salamander (gecko-only)", () => {
      openHy2({ obfs: { type: "salamander", password: "p" } });
      expect(screen.queryByLabelText(/Min Packet Size/i)).toBeNull();
      expect(screen.queryByLabelText(/Max Packet Size/i)).toBeNull();
    });
  });

  describe("1.14 top-level fields", () => {
    it("edits hop_interval_max / bbr_profile / brutal_debug", () => {
      openHy2();
      fireEvent.change(screen.getByLabelText(/Hop Interval Max/i), { target: { value: "60s" } });
      expect(ob()?.hop_interval_max).toBe("60s");

      const bbr = screen.getByLabelText(/BBR Profile/i) as HTMLSelectElement;
      expect(Array.from(bbr.options).map((o) => o.value)).toEqual(["standard", "conservative", "aggressive"]);
      fireEvent.change(bbr, { target: { value: "aggressive" } });
      expect(ob()?.bbr_profile).toBe("aggressive");
      // standard is the upstream default → prune to unset.
      fireEvent.change(bbr, { target: { value: "standard" } });
      expect(ob()?.bbr_profile).toBeUndefined();

      const debug = screen.getByLabelText(/Brutal Debug/i) as HTMLInputElement;
      fireEvent.click(debug);
      expect(ob()?.brutal_debug).toBe(true);
    });

    it("edits realm as a JSON object", () => {
      openHy2();
      const realm = screen.getByLabelText(/Realm/i) as HTMLTextAreaElement;
      fireEvent.change(realm, { target: { value: '{"server_url":"https://realm.example"}' } });
      expect(ob()?.realm).toEqual({ server_url: "https://realm.example" });
    });
  });

  describe("version diagnostics (stable / 1.13)", () => {
    it("flags gecko obfs packet sizes on stable", () => {
      const config = {
        outbounds: [{ type: "hysteria2", tag: "hy2", server: "1.2.3.4", server_port: 443, password: "x", obfs: { type: "gecko", min_packet_size: 512 } }],
      } as unknown as SingBoxConfig;
      expect(codes(config, "stable", "1.13")).toContain("hysteria2-obfs-packet-size-testing-only");
      expect(codes(config, "testing", "1.14")).not.toContain("hysteria2-obfs-packet-size-testing-only");
    });
  });
});

// U7b — inbound hysteria2 had NO obfs control at all (only the Advanced JSON fallback reached it). Add the
// same structured obfs fieldset as outbound (type salamander/gecko, password, gecko packet sizes), register
// obfs in inboundHandledFields, and flag the gecko packet sizes on stable.
function openHy2In(extra: Record<string, unknown> = {}) {
  useProjectStore
    .getState()
    .importJson(JSON.stringify({ inbounds: [{ type: "hysteria2", tag: "hy2in", listen: "::", listen_port: 443, users: [{ password: "p" }], ...extra }] }));
  render(<App />);
  fireEvent.click(screen.getByTestId("node-inbound:hy2in"));
}
const ib = () => useProjectStore.getState().config.inbounds?.[0] as Record<string, unknown> | undefined;
const ibObfs = () => ib()?.obfs as Record<string, unknown> | undefined;

describe("U7b — inbound hysteria2 obfs", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("renders the obfs type control and edits type + password", () => {
    openHy2In();
    const type = screen.getByLabelText(/Obfuscator Type/i) as HTMLSelectElement;
    const values = Array.from(type.options).map((o) => o.value);
    expect(values).toEqual(["", "salamander", "gecko"]);
    fireEvent.change(type, { target: { value: "salamander" } });
    expect(ibObfs()?.type).toBe("salamander");

    const password = screen.getByLabelText("Obfuscator Password") as HTMLInputElement;
    fireEvent.change(password, { target: { value: "sekret" } });
    expect(ibObfs()?.password).toBe("sekret");
  });

  it("hides gecko packet sizes for salamander", () => {
    openHy2In({ obfs: { type: "salamander", password: "p" } });
    expect(screen.queryByLabelText(/Min Packet Size/i)).toBeNull();
  });

  it("shows + edits gecko packet sizes for gecko", () => {
    openHy2In({ obfs: { type: "gecko", password: "p" } });
    fireEvent.change(screen.getByLabelText(/Min Packet Size/i), { target: { value: "512" } });
    expect(ibObfs()?.min_packet_size).toBe(512);
  });

  it("flags inbound gecko obfs packet sizes on stable", () => {
    const config = {
      inbounds: [{ type: "hysteria2", tag: "hy2in", listen: "::", listen_port: 443, users: [{ password: "p" }], obfs: { type: "gecko", max_packet_size: 1200 } }],
    } as unknown as SingBoxConfig;
    expect(codes(config, "stable", "1.13")).toContain("hysteria2-obfs-packet-size-testing-only");
    expect(codes(config, "testing", "1.14")).not.toContain("hysteria2-obfs-packet-size-testing-only");
  });

  // Regression: hysteria v1 inbound carries `obfs` as a plain STRING (an obfuscated password,
  // inbound/hysteria.md). Adding obfs to inboundHandledFields suppresses it from the Advanced fallback for
  // ALL inbound types, so v1 needs its own string control or its imported value becomes unreachable.
  it("keeps the hysteria v1 obfs string reachable (not hidden by the v2 object handling)", () => {
    useProjectStore
      .getState()
      .importJson(JSON.stringify({ inbounds: [{ type: "hysteria", tag: "hy1", listen: "::", listen_port: 443, up_mbps: 100, down_mbps: 100, obfs: "secretpass", users: [{ auth_str: "x" }] }] }));
    render(<App />);
    fireEvent.click(screen.getByTestId("node-inbound:hy1"));
    const obfs = screen.getByLabelText("Obfs (obfuscated password)") as HTMLInputElement;
    expect(obfs.value).toBe("secretpass");
    fireEvent.change(obfs, { target: { value: "newpass" } });
    expect((useProjectStore.getState().config.inbounds?.[0] as Record<string, unknown>)?.obfs).toBe("newpass");
  });
});
