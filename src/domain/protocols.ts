export const OUTBOUND_PALETTE_TYPES = {
  direct: "direct",
  block: "block",
  socks: "socks",
  "http-out": "http",
  "ss-out": "shadowsocks",
  "vmess-out": "vmess",
  "trojan-out": "trojan",
  "naive-out": "naive",
  "wireguard-out": "wireguard",
  "hysteria-out": "hysteria",
  "shadowtls-out": "shadowtls",
  "vless-out": "vless",
  "tuic-out": "tuic",
  "hysteria2-out": "hysteria2",
  "anytls-out": "anytls",
  "tor-out": "tor",
  "ssh-out": "ssh",
  "dns-out": "dns",
  selector: "selector",
  urltest: "urltest",
} as const;

export const CREATABLE_OUTBOUND_TYPES = [
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
] as const;

export type OutboundPaletteKind = keyof typeof OUTBOUND_PALETTE_TYPES;

// Canvas "+" compatible-chip label -> creatable outbound type. Covers exactly the creatable outbound
// kinds (no WireGuard — that is an endpoint, not a creatable outbound; no DNS). Used by createCompatible
// so every advertised selector/urltest proxy chip actually creates and attaches a member.
const OUTBOUND_CHIP_TYPES: Record<string, string> = {
  Direct: "direct",
  Block: "block",
  SOCKS: "socks",
  HTTP: "http",
  Shadowsocks: "shadowsocks",
  VMess: "vmess",
  Trojan: "trojan",
  Naive: "naive",
  Hysteria: "hysteria",
  Hysteria2: "hysteria2",
  ShadowTLS: "shadowtls",
  VLESS: "vless",
  TUIC: "tuic",
  AnyTLS: "anytls",
  Tor: "tor",
  SSH: "ssh",
  Selector: "selector",
  URLTest: "urltest",
};

export function outboundTypeForChipLabel(label: string): string | undefined {
  return OUTBOUND_CHIP_TYPES[label];
}

export const INBOUND_PALETTE_TYPES = {
  "inbound-direct": "direct",
  "inbound-mixed": "mixed",
  "inbound-socks": "socks",
  "inbound-http": "http",
  "inbound-shadowsocks": "shadowsocks",
  "inbound-vmess": "vmess",
  "inbound-trojan": "trojan",
  "inbound-naive": "naive",
  "inbound-hysteria": "hysteria",
  "inbound-shadowtls": "shadowtls",
  "inbound-vless": "vless",
  "inbound-tuic": "tuic",
  "inbound-hysteria2": "hysteria2",
  "inbound-anytls": "anytls",
  "inbound-tun": "tun",
  "inbound-redirect": "redirect",
  "inbound-tproxy": "tproxy",
  "inbound-cloudflared": "cloudflared",
} as const;

export const CREATABLE_INBOUND_TYPES = [
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
] as const;

export type InboundPaletteKind = keyof typeof INBOUND_PALETTE_TYPES;

export const DNS_SERVER_PALETTE_TYPES = {
  "dns-legacy": "legacy",
  "dns-local": "local",
  "dns-hosts": "hosts",
  "dns-tcp": "tcp",
  "dns-udp": "udp",
  "dns-tls": "tls",
  "dns-quic": "quic",
  "dns-https": "https",
  "dns-h3": "h3",
  "dns-dhcp": "dhcp",
  "dns-fakeip-server": "fakeip",
  "dns-mdns": "mdns",
  "dns-tailscale": "tailscale",
  "dns-resolved": "resolved",
} as const;

export const CREATABLE_DNS_SERVER_TYPES = [
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
] as const;

export type DnsServerPaletteKind = keyof typeof DNS_SERVER_PALETTE_TYPES;

export const ENDPOINT_PALETTE_TYPES = {
  "endpoint-wireguard": "wireguard",
  "endpoint-tailscale": "tailscale",
} as const;

export const CREATABLE_ENDPOINT_TYPES = ["wireguard", "tailscale"] as const;

export type EndpointPaletteKind = keyof typeof ENDPOINT_PALETTE_TYPES;

export const SERVICE_PALETTE_TYPES = {
  "service-derp": "derp",
  "service-resolved": "resolved",
  "service-ssm-api": "ssm-api",
  "service-ccm": "ccm",
  "service-ocm": "ocm",
  "service-hysteria-realm": "hysteria-realm",
} as const;

export const CREATABLE_SERVICE_TYPES = ["derp", "resolved", "ssm-api", "ccm", "ocm", "hysteria-realm"] as const;

export type ServicePaletteKind = keyof typeof SERVICE_PALETTE_TYPES;

const preferredOutboundTags: Record<string, string> = {
  direct: "direct",
  block: "block",
  socks: "proxy-out",
  http: "http-out",
  shadowsocks: "ss-out",
  vmess: "vmess-out",
  trojan: "trojan-out",
  naive: "naive-out",
  wireguard: "wg-out",
  hysteria: "hysteria-out",
  shadowtls: "shadowtls-out",
  vless: "vless-out",
  tuic: "tuic-out",
  hysteria2: "hy2-out",
  anytls: "anytls-out",
  tor: "tor-out",
  ssh: "ssh-out",
  dns: "dns-out",
  selector: "proxy",
  urltest: "auto",
};

const preferredInboundTags: Record<string, string> = {
  direct: "direct-in",
  mixed: "mixed-in",
  socks: "socks-in",
  http: "http-in",
  shadowsocks: "ss-in",
  vmess: "vmess-in",
  trojan: "trojan-in",
  naive: "naive-in",
  hysteria: "hysteria-in",
  shadowtls: "st-in",
  vless: "vless-in",
  tuic: "tuic-in",
  hysteria2: "hy2-in",
  anytls: "anytls-in",
  tun: "tun-in",
  redirect: "redirect-in",
  tproxy: "tproxy-in",
  cloudflared: "cloudflared-in",
};

const preferredDnsServerTags: Record<string, string> = {
  legacy: "legacy-dns",
  local: "local-dns",
  hosts: "hosts-dns",
  tcp: "tcp-dns",
  udp: "udp-dns",
  tls: "tls-dns",
  quic: "quic-dns",
  https: "remote-doh",
  h3: "h3-dns",
  dhcp: "dhcp-dns",
  fakeip: "fakeip-dns",
  mdns: "mdns-dns",
  tailscale: "tailscale-dns",
  resolved: "resolved-dns",
};

const preferredRuleSetTags: Record<string, string> = {
  remote: "remote-rules",
  local: "local-rules",
  inline: "inline-rules",
};

export const CREATABLE_RULE_SET_TYPES = ["remote", "local", "inline"] as const;

const preferredEndpointTags: Record<string, string> = {
  wireguard: "wg-ep",
  tailscale: "ts-ep",
};

const preferredServiceTags: Record<string, string> = {
  derp: "derp",
  resolved: "resolved",
  "ssm-api": "ssm-api",
  ccm: "ccm",
  ocm: "ocm",
  "hysteria-realm": "hy-realm",
};

export function outboundTypeForPaletteKind(kind: string): string | undefined {
  return OUTBOUND_PALETTE_TYPES[kind as OutboundPaletteKind];
}

export function preferredOutboundTag(type: string): string {
  return preferredOutboundTags[type] ?? `${type}-out`;
}

export function inboundTypeForPaletteKind(kind: string): string | undefined {
  return INBOUND_PALETTE_TYPES[kind as InboundPaletteKind];
}

export function preferredInboundTag(type: string): string {
  return preferredInboundTags[type] ?? `${type}-in`;
}

export function dnsServerTypeForPaletteKind(kind: string): string | undefined {
  return DNS_SERVER_PALETTE_TYPES[kind as DnsServerPaletteKind];
}

export function preferredDnsServerTag(type: string): string {
  return preferredDnsServerTags[type] ?? `${type}-dns`;
}

export function preferredRuleSetTag(type: string): string {
  return preferredRuleSetTags[type] ?? `${type}-rules`;
}

export function endpointTypeForPaletteKind(kind: string): string | undefined {
  return ENDPOINT_PALETTE_TYPES[kind as EndpointPaletteKind];
}

export function preferredEndpointTag(type: string): string {
  return preferredEndpointTags[type] ?? `${type}-ep`;
}

export function serviceTypeForPaletteKind(kind: string): string | undefined {
  return SERVICE_PALETTE_TYPES[kind as ServicePaletteKind];
}

export function preferredServiceTag(type: string): string {
  return preferredServiceTags[type] ?? `${type}-service`;
}
