import {
  CREATABLE_DNS_SERVER_TYPES,
  CREATABLE_ENDPOINT_TYPES,
  CREATABLE_INBOUND_TYPES,
  CREATABLE_OUTBOUND_TYPES,
} from "./protocols";
import type { EntityRef, SingBoxConfig } from "./types";

export type SharedFieldGroupId =
  | "listen"
  | "dial"
  | "tls"
  | "http-client"
  | "http2"
  | "quic"
  | "certificate-provider"
  | "dns01-challenge"
  | "pre-match"
  | "multiplex"
  | "v2ray-transport"
  | "udp-over-tcp"
  | "tcp-brutal"
  | "wifi-state"
  | "neighbor";

export type SharedDocPlacement = {
  doc: string;
  group: SharedFieldGroupId;
  owners: string[];
  mode: "embedded-inspector" | "resource" | "rule-inspector" | "target-gated";
};

export const SHARED_DOC_PLACEMENTS: SharedDocPlacement[] = [
  {
    doc: "shared/listen.md",
    group: "listen",
    owners: ["inbounds[]", "services[]"],
    mode: "embedded-inspector",
  },
  {
    doc: "shared/dial.md",
    group: "dial",
    owners: ["outbounds[]", "endpoints[]", "dns.servers[]", "ntp", "route", "route.rule_set[]"],
    mode: "embedded-inspector",
  },
  {
    doc: "shared/tls.md",
    group: "tls",
    owners: ["inbounds[]", "outbounds[]", "dns.servers[]", "services[]", "http_clients[]"],
    mode: "embedded-inspector",
  },
  {
    doc: "shared/http-client.md",
    group: "http-client",
    owners: ["http_clients[]", "route", "route.rule_set[]", "certificate_providers[]"],
    mode: "target-gated",
  },
  {
    doc: "shared/http2.md",
    group: "http2",
    owners: ["http_clients[]", "service[hysteria-realm]"],
    mode: "target-gated",
  },
  {
    doc: "shared/quic.md",
    group: "quic",
    owners: ["inbounds[hysteria|hysteria2|tuic]", "outbounds[hysteria|hysteria2|tuic]", "http_clients[]"],
    mode: "embedded-inspector",
  },
  {
    doc: "shared/certificate-provider/index.md",
    group: "certificate-provider",
    owners: ["certificate_providers[]", "tls.certificate_provider"],
    mode: "target-gated",
  },
  {
    doc: "shared/certificate-provider/acme.md",
    group: "certificate-provider",
    owners: ["certificate_providers[type=acme]", "tls.acme deprecated inline object"],
    mode: "target-gated",
  },
  {
    doc: "shared/certificate-provider/tailscale.md",
    group: "certificate-provider",
    owners: ["certificate_providers[type=tailscale]", "endpoint[tailscale]"],
    mode: "target-gated",
  },
  {
    doc: "shared/certificate-provider/cloudflare-origin-ca.md",
    group: "certificate-provider",
    owners: ["certificate_providers[type=cloudflare-origin-ca]"],
    mode: "target-gated",
  },
  {
    doc: "shared/dns01_challenge.md",
    group: "dns01-challenge",
    owners: ["certificate_providers[type=acme].dns01_challenge", "tls.acme.dns01_challenge"],
    mode: "target-gated",
  },
  {
    doc: "shared/pre-match.md",
    group: "pre-match",
    owners: ["route.rules[].action"],
    mode: "rule-inspector",
  },
  {
    doc: "shared/multiplex.md",
    group: "multiplex",
    owners: ["inbounds[shadowsocks|vmess|trojan|vless]", "outbounds[shadowsocks|vmess|trojan|vless]"],
    mode: "embedded-inspector",
  },
  {
    doc: "shared/v2ray-transport.md",
    group: "v2ray-transport",
    owners: ["inbounds[vmess|trojan|vless]", "outbounds[vmess|trojan|vless]"],
    mode: "embedded-inspector",
  },
  {
    doc: "shared/udp-over-tcp.md",
    group: "udp-over-tcp",
    owners: ["outbounds[socks|shadowsocks|naive]"],
    mode: "embedded-inspector",
  },
  {
    doc: "shared/tcp-brutal.md",
    group: "tcp-brutal",
    owners: ["multiplex.brutal"],
    mode: "embedded-inspector",
  },
  {
    doc: "shared/wifi-state.md",
    group: "wifi-state",
    owners: ["route.rules[]", "dns.rules[]"],
    mode: "rule-inspector",
  },
  {
    doc: "shared/neighbor.md",
    group: "neighbor",
    owners: ["route.rules[]", "dns.rules[]", "route", "dns.servers[type=local]"],
    mode: "rule-inspector",
  },
];

const inboundTlsTypes = new Set(["anytls", "http", "hysteria", "hysteria2", "naive", "trojan", "tuic", "vless", "vmess"]);
const inboundQuicTypes = new Set(["hysteria", "hysteria2", "tuic"]);
const inboundMultiplexTypes = new Set(["shadowsocks", "vmess", "trojan", "vless"]);
const inboundTransportTypes = new Set(["vmess", "trojan", "vless"]);
const inboundNestedDialTypes = new Set(["shadowtls"]);

const outboundDialTypes = new Set([...CREATABLE_OUTBOUND_TYPES, "wireguard"].filter((type) => type !== "block" && type !== "dns" && type !== "selector" && type !== "urltest"));
const outboundTlsTypes = new Set(["anytls", "http", "hysteria", "hysteria2", "naive", "shadowtls", "trojan", "tuic", "vless", "vmess"]);
const outboundQuicTypes = new Set(["hysteria", "hysteria2", "tuic"]);
const outboundMultiplexTypes = new Set(["shadowsocks", "trojan", "vless", "vmess"]);
const outboundTransportTypes = new Set(["trojan", "vless", "vmess"]);
const outboundUdpOverTcpTypes = new Set(["socks", "shadowsocks", "naive"]);
const dnsServerDialTypes = new Set([...CREATABLE_DNS_SERVER_TYPES, "mdns"].filter((type) => type !== "hosts" && type !== "fakeip" && type !== "tailscale" && type !== "resolved"));
const dnsServerTlsTypes = new Set(["tls", "quic", "https", "h3"]);
const serviceListenTypes = new Set(["derp", "resolved", "ssm-api", "ccm", "ocm", "hysteria-realm"]);
const serviceTlsTypes = new Set(["derp", "ssm-api", "ccm", "ocm", "hysteria-realm"]);

export function supportsOutboundDialFields(type: string | null | undefined) {
  return Boolean(type && outboundDialTypes.has(type));
}

export function supportsDnsServerDialFields(type: string | null | undefined) {
  return Boolean(type && dnsServerDialTypes.has(type));
}

export function sharedGroupsForEntity(
  ref: EntityRef,
  type?: string | null,
  channel: "stable" | "testing" = "testing",
): SharedFieldGroupId[] {
  const entityType = type ?? "";
  const groups: SharedFieldGroupId[] = [];

  if (ref.kind === "inbound") {
    if ((CREATABLE_INBOUND_TYPES as readonly string[]).includes(entityType)) groups.push("listen");
    if (inboundTlsTypes.has(entityType)) groups.push("tls");
    if (inboundQuicTypes.has(entityType)) groups.push("quic");
    if (inboundMultiplexTypes.has(entityType)) groups.push("multiplex", "tcp-brutal");
    if (inboundTransportTypes.has(entityType)) groups.push("v2ray-transport");
    if (inboundNestedDialTypes.has(entityType)) groups.push("dial");
  }

  if (ref.kind === "outbound") {
    if (supportsOutboundDialFields(entityType)) groups.push("dial");
    if (outboundTlsTypes.has(entityType)) groups.push("tls");
    if (outboundQuicTypes.has(entityType)) groups.push("quic");
    if (outboundMultiplexTypes.has(entityType)) groups.push("multiplex", "tcp-brutal");
    if (outboundTransportTypes.has(entityType)) groups.push("v2ray-transport");
    if (outboundUdpOverTcpTypes.has(entityType)) groups.push("udp-over-tcp");
  }

  if (ref.kind === "dns-server") {
    if (supportsDnsServerDialFields(entityType)) groups.push("dial");
    if (dnsServerTlsTypes.has(entityType)) groups.push("tls");
    if (entityType === "local") groups.push("neighbor");
  }

  if (ref.kind === "endpoint") {
    if ((CREATABLE_ENDPOINT_TYPES as readonly string[]).includes(entityType)) groups.push("dial");
  }

  if (ref.kind === "service") {
    if (serviceListenTypes.has(entityType)) groups.push("listen");
    if (serviceTlsTypes.has(entityType)) groups.push("tls");
    if (entityType === "hysteria-realm") groups.push("http2");
  }

  // `http_client` is a sing-box 1.14 field; only surface it for the testing channel.
  if (ref.kind === "rule-set" && entityType === "remote" && channel === "testing") groups.push("http-client");
  if (ref.kind === "route") {
    groups.push("dial");
    if (channel === "testing") groups.push("http-client", "neighbor");
  }
  if (ref.kind === "route-rule") {
    groups.push("pre-match", "wifi-state");
    if (channel === "testing") groups.push("neighbor");
  }
  if (ref.kind === "dns-rule") {
    groups.push("wifi-state");
    if (channel === "testing") groups.push("neighbor");
  }
  if (ref.kind === "settings" && ref.path === "ntp") groups.push("dial");
  // A top-level http_clients[] entry carries the shared HTTP-client object: tls + http2 + dial (1.14).
  if (ref.kind === "http-client") groups.push("tls", "http2", "dial");

  return groups.filter((group, index) => groups.indexOf(group) === index);
}

export function sharedDocPlacementFor(doc: string) {
  return SHARED_DOC_PLACEMENTS.find((placement) => placement.doc === doc);
}
