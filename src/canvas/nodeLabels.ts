// Human-readable labels for canvas node kinds and types. Shared by the canvas selection helpers
// (CanvasWorkspace) and the node titlebar (SbcNode) so a node never shows raw machine enums like
// `outbound / shadowsocks` — it reads `Outbound · Shadowsocks`. (A28, W34)

export const typeLabels: Record<string, string> = {
  direct: "Direct",
  block: "Block",
  socks: "SOCKS",
  http: "HTTP",
  shadowsocks: "Shadowsocks",
  vmess: "VMess",
  trojan: "Trojan",
  naive: "Naive",
  hysteria: "Hysteria",
  shadowtls: "ShadowTLS",
  vless: "VLESS",
  tuic: "TUIC",
  hysteria2: "Hysteria2",
  anytls: "AnyTLS",
  tor: "Tor",
  ssh: "SSH",
  wireguard: "WireGuard",
  selector: "Selector",
  urltest: "URLTest",
  local: "Local DNS",
  hosts: "Hosts DNS",
  tcp: "TCP DNS",
  udp: "UDP DNS",
  tls: "TLS DNS",
  quic: "QUIC DNS",
  https: "HTTPS DNS",
  h3: "HTTP/3 DNS",
  dhcp: "DHCP DNS",
  fakeip: "FakeIP DNS",
  tailscale: "Tailscale",
  resolved: "Resolved",
  remote: "Remote Rule Set",
  inline: "Inline Rule Set",
  route: "Route",
  "route-rule": "Route Rule",
  dns: "DNS",
  "dns-rule": "DNS Rule",
  "ssm-api": "SSM API",
  derp: "DERP",
  ccm: "CCM",
  ocm: "OCM",
  ntp: "NTP",
  // notice-node summary types (graph.ts) — acronym-correct so they don't read "Dns Rules".
  "route-rules": "Route Rules",
  "dns-rules": "DNS Rules",
};

const kindLabels: Record<string, string> = {
  inbound: "Inbound",
  outbound: "Outbound",
  endpoint: "Endpoint",
  route: "Route",
  "route-rule": "Route Rule",
  dns: "DNS",
  "dns-server": "DNS Server",
  "dns-rule": "DNS Rule",
  service: "Service",
  "rule-set": "Rule Set",
  "certificate-provider": "Certificate Provider",
  "http-client": "HTTP Client",
  settings: "Settings",
  notice: "Notice",
};

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function labelForNodeType(type: string): string {
  return typeLabels[type] ?? titleCase(type);
}

export function labelForNodeKind(kind: string): string {
  return kindLabels[kind] ?? titleCase(kind);
}

// The node titlebar reads `<Kind> · <Type>`, collapsing to a single label for singleton nodes whose
// type duplicates their kind (route/route-rule/dns/dns-rule) so it never reads "Route · Route".
export function nodeTitlebarLabel(kind: string, type: string): string {
  const kindLabel = labelForNodeKind(kind);
  if (!type || type === kind) return kindLabel;
  const typeLabel = labelForNodeType(type);
  return typeLabel === kindLabel ? kindLabel : `${kindLabel} · ${typeLabel}`;
}
