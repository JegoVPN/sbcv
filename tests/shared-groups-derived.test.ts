import { describe, expect, it } from "vitest";

import {
  sharedGroupsForEntity,
  supportsDnsServerDialFields,
  supportsOutboundDialFields,
} from "../src/domain/sharedFieldRegistry";
import type { EntityRef } from "../src/domain/types";

// S4 makes sharedGroupsForEntity + the dial predicates derive from the schema registry. These frozen
// expectations pin the exact behavior independently of the table, so a derivation bug is caught here
// (config-doc-capability + rule-set-http-client cover route/endpoint/service; this adds the dial
// predicates — not otherwise snapshotted — plus a few representative typed-kind group lists).

describe("supportsOutboundDialFields (registry-derived)", () => {
  it.each([
    ["direct", true],
    ["socks", true],
    ["wireguard", true],
    ["tor", true],
    ["block", false],
    ["dns", false],
    ["selector", false],
    ["urltest", false],
    ["nope", false],
    [undefined, false],
  ])("%s → %s", (type, expected) => {
    expect(supportsOutboundDialFields(type as string | undefined)).toBe(expected);
  });
});

describe("supportsDnsServerDialFields (registry-derived)", () => {
  it.each([
    ["local", true],
    ["tcp", true],
    ["tls", true],
    ["mdns", true],
    ["hosts", false],
    ["fakeip", false],
    ["tailscale", false],
    ["resolved", false],
    ["legacy", false],
    [undefined, false],
  ])("%s → %s", (type, expected) => {
    expect(supportsDnsServerDialFields(type as string | undefined)).toBe(expected);
  });
});

describe("sharedGroupsForEntity — representative typed + non-typed snapshots", () => {
  const grp = (ref: EntityRef, type: string, channel: "stable" | "testing" = "testing") =>
    sharedGroupsForEntity(ref, type, channel);

  it("inbound vmess (tls + multiplex + transport)", () => {
    expect(grp({ kind: "inbound", tag: "in" }, "vmess")).toEqual([
      "listen",
      "tls",
      "multiplex",
      "tcp-brutal",
      "v2ray-transport",
    ]);
  });
  it("outbound socks (dial + udp-over-tcp)", () => {
    expect(grp({ kind: "outbound", tag: "o" }, "socks")).toEqual(["dial", "udp-over-tcp"]);
  });
  it("inbound shadowtls (nested dial)", () => {
    expect(grp({ kind: "inbound", tag: "in" }, "shadowtls")).toEqual(["listen", "dial"]);
  });
  it("rule-set remote http-client is testing-gated", () => {
    expect(grp({ kind: "rule-set", tag: "rs" }, "remote", "testing")).toEqual(["http-client"]);
    expect(grp({ kind: "rule-set", tag: "rs" }, "remote", "stable")).toEqual([]);
  });
  it("route (non-typed) keeps inline channel gating", () => {
    expect(grp({ kind: "route", id: "main" }, "route", "testing")).toEqual(["dial", "http-client", "neighbor"]);
    expect(grp({ kind: "route", id: "main" }, "route", "stable")).toEqual(["dial"]);
  });
  it("http-client (non-typed) → tls + http2 + dial", () => {
    expect(grp({ kind: "http-client", tag: "hc" }, "")).toEqual(["tls", "http2", "dial"]);
  });
});
