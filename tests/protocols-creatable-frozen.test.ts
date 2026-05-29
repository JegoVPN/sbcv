import { describe, expect, it } from "vitest";

import {
  CREATABLE_DNS_SERVER_TYPES,
  CREATABLE_ENDPOINT_TYPES,
  CREATABLE_INBOUND_TYPES,
  CREATABLE_OUTBOUND_TYPES,
  CREATABLE_RULE_SET_TYPES,
  CREATABLE_SERVICE_TYPES,
} from "../src/domain/protocols";

// Frozen golden snapshots of the CREATABLE_* exports. S2 flips these to derive from the schema
// registry; this test guards that the derivation reproduces the exact list + order it had before
// (the S1 `creatableTypes == CREATABLE_*` guard becomes trivially true once they are the same call).

describe("protocols — CREATABLE_* frozen snapshots (order-preserving)", () => {
  it("inbound", () => {
    expect([...CREATABLE_INBOUND_TYPES]).toEqual([
      "direct",
      "mixed",
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
      "tun",
      "redirect",
      "tproxy",
      "cloudflared",
    ]);
  });
  it("outbound", () => {
    expect([...CREATABLE_OUTBOUND_TYPES]).toEqual([
      "direct",
      "block",
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
      "tor",
      "ssh",
      "selector",
      "urltest",
    ]);
  });
  it("dns-server", () => {
    expect([...CREATABLE_DNS_SERVER_TYPES]).toEqual([
      "local",
      "hosts",
      "tcp",
      "udp",
      "tls",
      "quic",
      "https",
      "h3",
      "dhcp",
      "fakeip",
      "tailscale",
      "resolved",
    ]);
  });
  it("endpoint", () => {
    expect([...CREATABLE_ENDPOINT_TYPES]).toEqual(["wireguard", "tailscale"]);
  });
  it("service", () => {
    expect([...CREATABLE_SERVICE_TYPES]).toEqual(["derp", "resolved", "ssm-api", "ccm", "ocm", "hysteria-realm"]);
  });
  it("rule-set", () => {
    expect([...CREATABLE_RULE_SET_TYPES]).toEqual(["remote", "local", "inline"]);
  });
});
