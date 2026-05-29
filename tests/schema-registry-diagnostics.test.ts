import { describe, expect, it } from "vitest";

import { proxyOutboundTypes, requiredFieldsFor, tlsRequiredTypes } from "../src/domain/schemaRegistry";

// Frozen golden = the literal Sets in diagnostics.ts today (proxyOutboundTypes :598-612,
// tlsRequiredOutboundTypes :613-621, tlsRequiredInboundTypes :622-629, cloudflared token :1096).
// S5 flips diagnostics.ts to consume the table selectors; this characterization test then becomes
// the guard that the table still emits the exact same membership it does today.

const PROXY_OUTBOUND_TODAY = [
  "socks",
  "http",
  "shadowsocks",
  "vmess",
  "trojan",
  "naive",
  "hysteria",
  "shadowtls",
  "vless",
  "tuic",
  "hysteria2",
  "anytls",
  "ssh",
];

const TLS_REQUIRED_OUTBOUND_TODAY = ["trojan", "naive", "hysteria", "hysteria2", "tuic", "anytls", "shadowtls"];

const TLS_REQUIRED_INBOUND_TODAY = ["trojan", "naive", "hysteria", "hysteria2", "tuic", "anytls"];

describe("schemaRegistry — diagnostics type Sets match today's diagnostics.ts literals", () => {
  it("proxy outbound types", () => {
    expect(proxyOutboundTypes()).toEqual(new Set(PROXY_OUTBOUND_TODAY));
  });
  it("tls-required outbound types", () => {
    expect(tlsRequiredTypes("outbound")).toEqual(new Set(TLS_REQUIRED_OUTBOUND_TODAY));
  });
  it("tls-required inbound types", () => {
    expect(tlsRequiredTypes("inbound")).toEqual(new Set(TLS_REQUIRED_INBOUND_TODAY));
  });
  it("cloudflared has token as a baseline required field", () => {
    expect(requiredFieldsFor("inbound", "cloudflared")).toEqual(["token"]);
  });
});
