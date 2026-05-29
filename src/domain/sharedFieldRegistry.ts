import { schemaRow, sharedGroupsFromTable } from "./schemaRegistry";
import type { EntityRef } from "./types";

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

// Per-(kind,type) shared-group membership lives in the schema registry; a type "supports dial"
// iff its registry row lists the `dial` group (dial is channel-invariant — never testing-only).
export function supportsOutboundDialFields(type: string | null | undefined) {
  return Boolean(type && schemaRow("outbound", type)?.sharedGroups.includes("dial"));
}

export function supportsDnsServerDialFields(type: string | null | undefined) {
  return Boolean(type && schemaRow("dns-server", type)?.sharedGroups.includes("dial"));
}

export function sharedGroupsForEntity(
  ref: EntityRef,
  type?: string | null,
  channel: "stable" | "testing" = "testing",
): SharedFieldGroupId[] {
  const entityType = type ?? "";

  // Typed entity kinds derive their groups from the schema registry (the single source of truth).
  if (
    ref.kind === "inbound" ||
    ref.kind === "outbound" ||
    ref.kind === "dns-server" ||
    ref.kind === "endpoint" ||
    ref.kind === "service" ||
    ref.kind === "rule-set"
  ) {
    return sharedGroupsFromTable(ref.kind, entityType, channel);
  }

  // Non-typed kinds (route / route-rule / dns-rule / settings / http-client) are not registry rows;
  // their fixed group sets + channel gating stay inline here.
  const groups: SharedFieldGroupId[] = [];
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
