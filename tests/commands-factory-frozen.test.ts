import { describe, expect, it } from "vitest";

import {
  createDnsServer,
  createEndpoint,
  createInbound,
  createOutbound,
  createRuleSet,
  createService,
} from "../src/domain/commands";

// Frozen golden objects for the trickiest factory defaults. S3 flips create*() to delegate to the
// schema registry; these goldens (independent of both the table and the registry) prove the
// delegation reproduces the exact known output. The broad existing suite is the wider regression net.

describe("commands — create*() frozen goldens (S3 delegation guard)", () => {
  it("inbound tun (unified address[] + auto_route)", () => {
    expect(createInbound("tun", "x")).toEqual({
      type: "tun",
      tag: "x",
      address: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"],
      auto_route: true,
    });
  });
  it("inbound tuic (auth_timeout / heartbeat / zero_rtt)", () => {
    expect(createInbound("tuic", "x")).toEqual({
      type: "tuic",
      tag: "x",
      listen: "127.0.0.1",
      listen_port: 2080,
      users: [{ name: "user", uuid: "059032a9-7d40-4a96-9bb1-36823d848068", password: "change-me" }],
      congestion_control: "cubic",
      auth_timeout: "3s",
      zero_rtt_handshake: false,
      heartbeat: "10s",
      tls: { enabled: true, server_name: "" },
    });
  });
  it("inbound vmess (alterId:0)", () => {
    expect(createInbound("vmess", "x")).toEqual({
      type: "vmess",
      tag: "x",
      listen: "127.0.0.1",
      listen_port: 2080,
      users: [{ name: "user", uuid: "bf000d23-0752-40b4-affe-68f7707a9661", alterId: 0 }],
    });
  });
  it("inbound cloudflared (token only)", () => {
    expect(createInbound("cloudflared", "x")).toEqual({ type: "cloudflared", tag: "x", token: "" });
  });
  it("outbound anytls (idle_session_*)", () => {
    expect(createOutbound("anytls", "x")).toEqual({
      type: "anytls",
      tag: "x",
      server: "127.0.0.1",
      server_port: 1080,
      password: "change-me",
      idle_session_check_interval: "30s",
      idle_session_timeout: "30s",
      min_idle_session: 5,
      tls: { enabled: true, server_name: "" },
    });
  });
  it("outbound shadowtls (handshake/version)", () => {
    expect(createOutbound("shadowtls", "x")).toEqual({
      type: "shadowtls",
      tag: "x",
      server: "127.0.0.1",
      server_port: 1080,
      version: 3,
      password: "change-me",
      tls: { enabled: true, server_name: "" },
    });
  });
  it("outbound urltest (url/interval/tolerance)", () => {
    expect(createOutbound("urltest", "x")).toEqual({
      type: "urltest",
      tag: "x",
      outbounds: [],
      url: "https://www.gstatic.com/generate_204",
      interval: "3m",
      tolerance: 50,
      idle_timeout: "30m",
      interrupt_exist_connections: false,
    });
  });
  it("endpoint wireguard (peers/private_key/address[])", () => {
    expect(createEndpoint("wireguard", "x")).toEqual({
      type: "wireguard",
      tag: "x",
      system: false,
      name: "wg0",
      mtu: 1408,
      address: ["172.16.0.2/32"],
      private_key: "EEKlAzKfS87ShJPnvEF3AiJjGS9JHEzgn2jB3J7yMkY=",
      peers: [
        {
          address: "127.0.0.1",
          port: 51820,
          public_key: "tM4NaeCZrzxQ6BfhyeuQMy5jDReji4o8h5LVAGpI1HQ=",
          allowed_ips: ["0.0.0.0/0"],
        },
      ],
      udp_timeout: "5m",
    });
  });
  it("service ssm-api (servers/cache_path)", () => {
    expect(createService("ssm-api", "x")).toEqual({
      type: "ssm-api",
      tag: "x",
      listen: "127.0.0.1",
      listen_port: 9090,
      servers: {},
      cache_path: "",
    });
  });
  it("dns-server legacy (address/strategy)", () => {
    expect(createDnsServer("legacy", "x")).toEqual({ type: "legacy", tag: "x", address: "8.8.8.8", strategy: "prefer_ipv4" });
  });
  it("rule-set remote (url/update_interval)", () => {
    expect(createRuleSet("remote", "x")).toEqual({
      type: "remote",
      tag: "x",
      format: "source",
      url: "https://example.com/rules.json",
      update_interval: "1d",
    });
  });
});

describe("commands — create*() edge cases preserved by delegation", () => {
  it("unknown inbound/outbound/dns-server/service type → { type, tag } fallback", () => {
    expect(createInbound("totally-unknown", "x")).toEqual({ type: "totally-unknown", tag: "x" });
    expect(createOutbound("totally-unknown", "x")).toEqual({ type: "totally-unknown", tag: "x" });
    expect(createDnsServer("totally-unknown", "x")).toEqual({ type: "totally-unknown", tag: "x" });
    expect(createService("totally-unknown", "x")).toEqual({ type: "totally-unknown", tag: "x" });
    expect(createEndpoint("totally-unknown", "x")).toEqual({ type: "totally-unknown", tag: "x" });
  });
  it("deprecated-but-known outbound types still produce { type, tag }", () => {
    expect(createOutbound("wireguard", "x")).toEqual({ type: "wireguard", tag: "x" });
    expect(createOutbound("dns", "x")).toEqual({ type: "dns", tag: "x" });
  });
  it("unknown rule-set type throws (not a silent fallback)", () => {
    expect(() => createRuleSet("bogus", "x")).toThrow(/Unsupported rule-set type/);
  });
  it("each call returns a fresh object (mutating one does not leak to the next)", () => {
    const a = createInbound("tun", "x") as { address: string[] };
    a.address.push("10.0.0.0/8");
    const b = createInbound("tun", "x") as { address: string[] };
    expect(b.address).toEqual(["172.19.0.1/30", "fdfe:dcba:9876::1/126"]);
  });
});
