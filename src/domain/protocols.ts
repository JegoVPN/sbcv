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

export function outboundTypeForPaletteKind(kind: string): string | undefined {
  return OUTBOUND_PALETTE_TYPES[kind as OutboundPaletteKind];
}

export function preferredOutboundTag(type: string): string {
  return preferredOutboundTags[type] ?? `${type}-out`;
}
