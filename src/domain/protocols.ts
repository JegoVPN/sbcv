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

export type OutboundPaletteKind = keyof typeof OUTBOUND_PALETTE_TYPES;

export const INBOUND_PALETTE_TYPES = {
  "inbound-direct": "direct",
  mixed: "mixed",
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
  tun: "tun",
  "inbound-redirect": "redirect",
  "inbound-tproxy": "tproxy",
  "inbound-cloudflared": "cloudflared",
} as const;

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
  "dns-http3": "h3",
  "dns-dhcp": "dhcp",
  "dns-fakeip-server": "fakeip",
  "dns-mdns": "mdns",
  "dns-tailscale": "tailscale",
  "dns-resolved": "resolved",
} as const;

export type DnsServerPaletteKind = keyof typeof DNS_SERVER_PALETTE_TYPES;

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
