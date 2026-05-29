import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  Ban,
  Blocks,
  Braces,
  Cable,
  ChevronRight,
  Clock3,
  FileKey2,
  FlaskConical,
  GitBranch,
  Globe2,
  KeyRound,
  Layers3,
  Network,
  Plug,
  RadioTower,
  Search,
  Server,
  Shield,
  Shuffle,
  Waypoints,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getNodeIcon } from "../canvas/iconRegistry";
import type { IconRenderer } from "../canvas/iconRegistry";
import {
  dnsServerTypeForPaletteKind,
  endpointTypeForPaletteKind,
  inboundTypeForPaletteKind,
  outboundTypeForPaletteKind,
  serviceTypeForPaletteKind,
} from "../domain/protocols";
import { TEMPLATE_PRESETS, TEMPLATE_PRESET_IDS } from "../domain/templates";
import type { TemplatePresetId } from "../domain/templates";
import { useProjectStore } from "../state/useProjectStore";

// Resolve a Palette item's `kind` to a node {kind, type} so its icon comes from the shared registry
// (IC-P1-3 single source). Items that are not a creatable node (templates, shared fields, geoip,
// rule actions, sub-features) return null and keep their own catalog icon.
export function paletteNodeRef(kind: string): { kind: string; type: string } | null {
  const outbound = outboundTypeForPaletteKind(kind);
  if (outbound) return { kind: "outbound", type: outbound };
  const inbound = inboundTypeForPaletteKind(kind);
  if (inbound) return { kind: "inbound", type: inbound };
  const dnsServer = dnsServerTypeForPaletteKind(kind);
  if (dnsServer) return { kind: "dns-server", type: dnsServer };
  const endpoint = endpointTypeForPaletteKind(kind);
  if (endpoint) return { kind: "endpoint", type: endpoint };
  const service = serviceTypeForPaletteKind(kind);
  if (service) return { kind: "service", type: service };
  switch (kind) {
    case "route":
      return { kind: "route", type: "route" };
    case "route-rule":
      return { kind: "route-rule", type: "route-rule" };
    case "dns-hub":
      return { kind: "dns", type: "dns" };
    case "dns-rule":
      return { kind: "dns-rule", type: "dns-rule" };
    case "rule-set-remote":
      return { kind: "rule-set", type: "remote" };
    case "rule-set-local":
      return { kind: "rule-set", type: "local" };
    case "rule-set-inline":
      return { kind: "rule-set", type: "inline" };
    case "http-client":
      return { kind: "http-client", type: "http-client" };
    case "settings-log":
      return { kind: "settings", type: "log" };
    case "settings-ntp":
      return { kind: "settings", type: "ntp" };
    case "settings-certificate":
      return { kind: "settings", type: "certificate" };
    case "settings-experimental":
      return { kind: "settings", type: "experimental" };
    default:
      break;
  }
  if (kind === "certificate-provider" || kind.startsWith("certificate-provider-")) {
    return { kind: "certificate-provider", type: kind };
  }
  return null;
}

function paletteIcon(kind: string, fallback: LucideIcon): IconRenderer {
  const ref = paletteNodeRef(kind);
  return ref ? getNodeIcon(ref.kind, ref.type) : fallback;
}

type PaletteItem = {
  label: string;
  kind: string;
  icon: LucideIcon;
  docsUrl: string;
  status?: PaletteStatus;
  ready?: boolean;
};

type PaletteGroup = {
  title: string;
  items: PaletteItem[];
};

type PaletteStatus = "add" | "setup" | "table" | "inspector" | "docs" | "gated" | "pending" | "deprecated" | "open";

function docs(path = "") {
  return `https://sing-box.sagernet.org/configuration/${path}`;
}

const templatePresetIdSet = new Set<string>(TEMPLATE_PRESET_IDS);

function isTemplatePresetId(kind: string): kind is TemplatePresetId {
  return templatePresetIdSet.has(kind);
}

function templateIcon(id: TemplatePresetId): LucideIcon {
  if (id === "template-1.12") return RadioTower;
  if (id === "template-1.14") return Globe2;
  if (id.includes("bypass")) return GitBranch;
  return Blocks;
}

const groups: PaletteGroup[] = [
  {
    title: "Templates",
    items: TEMPLATE_PRESETS.map((preset) => ({
      label: preset.label,
      kind: preset.id,
      icon: templateIcon(preset.id),
      docsUrl: preset.docsUrl ?? docs(),
      ready: true,
    })),
  },
  {
    title: "Log",
    items: [{ label: "Log Settings", kind: "settings-log", icon: Braces, docsUrl: docs("log/"), ready: true }],
  },
  {
    title: "DNS",
    items: [
      { label: "DNS Hub", kind: "dns-hub", icon: Globe2, docsUrl: docs("dns/"), ready: true },
      { label: "DNS Rule", kind: "dns-rule", icon: GitBranch, docsUrl: docs("dns/rule/"), status: "table" },
      { label: "FakeIP", kind: "dns-fakeip", icon: Blocks, docsUrl: docs("dns/fakeip/") },
      { label: "Legacy Server", kind: "dns-legacy", icon: Server, docsUrl: docs("dns/server/legacy/"), status: "docs" },
      { label: "Local Server", kind: "dns-local", icon: Globe2, docsUrl: docs("dns/server/local/"), ready: true },
      { label: "Hosts Server", kind: "dns-hosts", icon: Server, docsUrl: docs("dns/server/hosts/"), status: "setup" },
      { label: "TCP Server", kind: "dns-tcp", icon: Server, docsUrl: docs("dns/server/tcp/"), status: "setup" },
      { label: "UDP Server", kind: "dns-udp", icon: Server, docsUrl: docs("dns/server/udp/"), status: "setup" },
      { label: "TLS Server", kind: "dns-tls", icon: Shield, docsUrl: docs("dns/server/tls/"), status: "setup" },
      { label: "QUIC Server", kind: "dns-quic", icon: Plug, docsUrl: docs("dns/server/quic/"), status: "setup" },
      { label: "HTTPS Server", kind: "dns-https", icon: Globe2, docsUrl: docs("dns/server/https/"), ready: true },
      { label: "HTTP3 Server", kind: "dns-h3", icon: Globe2, docsUrl: docs("dns/server/http3/"), status: "setup" },
      { label: "DHCP Server", kind: "dns-dhcp", icon: Network, docsUrl: docs("dns/server/dhcp/"), status: "setup" },
      { label: "FakeIP Server", kind: "dns-fakeip-server", icon: Blocks, docsUrl: docs("dns/server/fakeip/"), status: "setup" },
      { label: "mDNS Server", kind: "dns-mdns", icon: Globe2, docsUrl: docs("dns/server/mdns/"), status: "gated" },
      { label: "Tailscale Server", kind: "dns-tailscale", icon: Waypoints, docsUrl: docs("dns/server/tailscale/"), status: "setup" },
      { label: "Resolved Server (Linux only)", kind: "dns-resolved", icon: Server, docsUrl: docs("dns/server/resolved/"), status: "setup" },
    ],
  },
  {
    title: "NTP",
    items: [{ label: "NTP Settings", kind: "settings-ntp", icon: Clock3, docsUrl: docs("ntp/"), status: "setup" }],
  },
  {
    title: "Certificate",
    items: [{ label: "Certificate", kind: "settings-certificate", icon: FileKey2, docsUrl: docs("certificate/"), status: "setup" }],
  },
  {
    title: "Certificate Providers",
    items: [
      { label: "Provider", kind: "certificate-provider", icon: KeyRound, docsUrl: docs("shared/certificate-provider/"), status: "gated" },
      { label: "ACME", kind: "certificate-provider-acme", icon: KeyRound, docsUrl: docs("shared/certificate-provider/acme/"), status: "gated" },
      { label: "Tailscale", kind: "certificate-provider-tailscale", icon: Waypoints, docsUrl: docs("shared/certificate-provider/tailscale/"), status: "gated" },
      { label: "Cloudflare Origin CA", kind: "certificate-provider-cloudflare-origin-ca", icon: KeyRound, docsUrl: docs("shared/certificate-provider/cloudflare-origin-ca/"), status: "gated" },
    ],
  },
  {
    title: "HTTP Clients",
    items: [{ label: "HTTP Client", kind: "http-client", icon: Globe2, docsUrl: docs("shared/http-client/"), status: "setup" }],
  },
  {
    title: "Endpoints",
    items: [
      { label: "WireGuard", kind: "endpoint-wireguard", icon: Waypoints, docsUrl: docs("endpoint/wireguard/"), status: "setup" },
      { label: "Tailscale", kind: "endpoint-tailscale", icon: Waypoints, docsUrl: docs("endpoint/tailscale/"), status: "setup" },
    ],
  },
  {
    title: "Inbounds",
    items: [
      { label: "Direct", kind: "inbound-direct", icon: Cable, docsUrl: docs("inbound/direct/"), status: "setup" },
      { label: "Mixed", kind: "inbound-mixed", icon: RadioTower, docsUrl: docs("inbound/mixed/"), ready: true },
      { label: "SOCKS", kind: "inbound-socks", icon: Network, docsUrl: docs("inbound/socks/"), status: "setup" },
      { label: "HTTP", kind: "inbound-http", icon: Globe2, docsUrl: docs("inbound/http/"), status: "setup" },
      { label: "Shadowsocks", kind: "inbound-shadowsocks", icon: Shield, docsUrl: docs("inbound/shadowsocks/"), status: "setup" },
      { label: "VMess", kind: "inbound-vmess", icon: Shield, docsUrl: docs("inbound/vmess/"), status: "setup" },
      { label: "Trojan", kind: "inbound-trojan", icon: Shield, docsUrl: docs("inbound/trojan/"), status: "setup" },
      { label: "Naive", kind: "inbound-naive", icon: Globe2, docsUrl: docs("inbound/naive/"), status: "setup" },
      { label: "Hysteria", kind: "inbound-hysteria", icon: Plug, docsUrl: docs("inbound/hysteria/"), status: "setup" },
      { label: "ShadowTLS", kind: "inbound-shadowtls", icon: Shield, docsUrl: docs("inbound/shadowtls/"), status: "setup" },
      { label: "VLESS", kind: "inbound-vless", icon: Shield, docsUrl: docs("inbound/vless/"), status: "setup" },
      { label: "TUIC", kind: "inbound-tuic", icon: Plug, docsUrl: docs("inbound/tuic/"), status: "setup" },
      { label: "Hysteria2", kind: "inbound-hysteria2", icon: Plug, docsUrl: docs("inbound/hysteria2/"), status: "setup" },
      { label: "AnyTLS", kind: "inbound-anytls", icon: Shield, docsUrl: docs("inbound/anytls/"), status: "setup" },
      { label: "TUN", kind: "inbound-tun", icon: RadioTower, docsUrl: docs("inbound/tun/"), ready: true },
      { label: "Redirect (Linux / macOS)", kind: "inbound-redirect", icon: GitBranch, docsUrl: docs("inbound/redirect/"), status: "setup" },
      { label: "TProxy (Linux only)", kind: "inbound-tproxy", icon: GitBranch, docsUrl: docs("inbound/tproxy/"), status: "setup" },
      { label: "Cloudflared", kind: "inbound-cloudflared", icon: Globe2, docsUrl: docs("inbound/cloudflared/"), status: "setup" },
    ],
  },
  {
    title: "Outbounds",
    items: [
      { label: "Direct", kind: "direct", icon: Cable, docsUrl: docs("outbound/direct/"), ready: true },
      { label: "Block", kind: "block", icon: Ban, docsUrl: docs("outbound/block/"), ready: true },
      { label: "SOCKS", kind: "socks", icon: Network, docsUrl: docs("outbound/socks/"), ready: true },
      { label: "HTTP", kind: "http-out", icon: Globe2, docsUrl: docs("outbound/http/"), status: "setup" },
      { label: "Shadowsocks", kind: "ss-out", icon: Shield, docsUrl: docs("outbound/shadowsocks/"), status: "setup" },
      { label: "VMess", kind: "vmess-out", icon: Shield, docsUrl: docs("outbound/vmess/"), status: "setup" },
      { label: "Trojan", kind: "trojan-out", icon: Shield, docsUrl: docs("outbound/trojan/"), status: "setup" },
      { label: "Naive", kind: "naive-out", icon: Globe2, docsUrl: docs("outbound/naive/"), status: "setup" },
      { label: "WireGuard", kind: "wireguard-out", icon: Waypoints, docsUrl: docs("outbound/wireguard/"), status: "docs" },
      { label: "Hysteria", kind: "hysteria-out", icon: Plug, docsUrl: docs("outbound/hysteria/"), status: "setup" },
      { label: "ShadowTLS", kind: "shadowtls-out", icon: Shield, docsUrl: docs("outbound/shadowtls/"), status: "setup" },
      { label: "VLESS", kind: "vless-out", icon: Shield, docsUrl: docs("outbound/vless/"), status: "setup" },
      { label: "TUIC", kind: "tuic-out", icon: Plug, docsUrl: docs("outbound/tuic/"), status: "setup" },
      { label: "Hysteria2", kind: "hysteria2-out", icon: Plug, docsUrl: docs("outbound/hysteria2/"), status: "setup" },
      { label: "AnyTLS", kind: "anytls-out", icon: Shield, docsUrl: docs("outbound/anytls/"), status: "setup" },
      { label: "Tor", kind: "tor-out", icon: Network, docsUrl: docs("outbound/tor/"), status: "setup" },
      { label: "SSH", kind: "ssh-out", icon: Server, docsUrl: docs("outbound/ssh/"), status: "setup" },
      { label: "DNS", kind: "dns-out", icon: Globe2, docsUrl: docs("outbound/dns/"), status: "docs" },
      { label: "Selector", kind: "selector", icon: Shuffle, docsUrl: docs("outbound/selector/"), ready: true },
      { label: "URLTest", kind: "urltest", icon: Shuffle, docsUrl: docs("outbound/urltest/"), ready: true },
    ],
  },
  {
    title: "Route",
    items: [
      { label: "Route Hub", kind: "route", icon: GitBranch, docsUrl: docs("route/"), ready: true },
      { label: "Route Rule", kind: "route-rule", icon: GitBranch, docsUrl: docs("route/rule/"), status: "table" },
      { label: "Rule Action", kind: "route-rule-action", icon: GitBranch, docsUrl: docs("route/rule_action/"), status: "inspector" },
      { label: "GeoIP", kind: "route-geoip", icon: Globe2, docsUrl: docs("route/geoip/") },
      { label: "Geosite", kind: "route-geosite", icon: Globe2, docsUrl: docs("route/geosite/") },
      { label: "Remote Rule Set", kind: "rule-set-remote", icon: Layers3, docsUrl: docs("rule-set/"), status: "setup" },
      { label: "Local Rule Set", kind: "rule-set-local", icon: Layers3, docsUrl: docs("rule-set/"), status: "setup" },
      { label: "Inline Rule Set", kind: "rule-set-inline", icon: Layers3, docsUrl: docs("rule-set/"), status: "setup" },
      { label: "Rule Set Source Format", kind: "rule-set-source-format", icon: Layers3, docsUrl: docs("rule-set/source-format/") },
      { label: "Headless Rule", kind: "rule-set-headless-rule", icon: GitBranch, docsUrl: docs("rule-set/headless-rule/"), status: "inspector" },
      { label: "AdGuard Rule Set", kind: "rule-set-adguard", icon: Layers3, docsUrl: docs("rule-set/adguard/") },
      { label: "Protocol Sniff", kind: "route-sniff", icon: Search, docsUrl: docs("route/sniff/") },
    ],
  },
  {
    title: "Services",
    items: [
      { label: "DERP", kind: "service-derp", icon: Server, docsUrl: docs("service/derp/"), status: "setup" },
      { label: "Resolved (Linux only)", kind: "service-resolved", icon: Server, docsUrl: docs("service/resolved/"), status: "setup" },
      { label: "SSM API", kind: "service-ssm-api", icon: Server, docsUrl: docs("service/ssm-api/"), status: "setup" },
      { label: "CCM", kind: "service-ccm", icon: Server, docsUrl: docs("service/ccm/"), status: "setup" },
      { label: "OCM", kind: "service-ocm", icon: Server, docsUrl: docs("service/ocm/"), status: "setup" },
      { label: "Hysteria Realm", kind: "service-hysteria-realm", icon: Plug, docsUrl: docs("service/hysteria-realm/"), status: "setup" },
    ],
  },
  {
    title: "Experimental",
    items: [
      { label: "Experimental", kind: "settings-experimental", icon: FlaskConical, docsUrl: docs("experimental/"), status: "setup" },
      { label: "Cache File", kind: "experimental-cache-file", icon: FileKey2, docsUrl: docs("experimental/cache-file/"), status: "inspector" },
      { label: "Clash API", kind: "experimental-clash-api", icon: Server, docsUrl: docs("experimental/clash-api/"), status: "inspector" },
      { label: "V2Ray API", kind: "experimental-v2ray-api", icon: Server, docsUrl: docs("experimental/v2ray-api/"), status: "inspector" },
    ],
  },
  {
    title: "Shared",
    items: [
      { label: "Listen Fields", kind: "shared-listen", icon: RadioTower, docsUrl: docs("shared/listen/"), status: "inspector" },
      { label: "Dial Fields", kind: "shared-dial", icon: Cable, docsUrl: docs("shared/dial/"), status: "inspector" },
      { label: "TLS", kind: "shared-tls", icon: Shield, docsUrl: docs("shared/tls/"), status: "inspector" },
      { label: "HTTP Client", kind: "shared-http-client", icon: Globe2, docsUrl: docs("shared/http-client/"), status: "gated" },
      { label: "HTTP2 Fields", kind: "shared-http2", icon: Globe2, docsUrl: docs("shared/http2/"), status: "gated" },
      { label: "QUIC Fields", kind: "shared-quic", icon: Plug, docsUrl: docs("shared/quic/"), status: "gated" },
      { label: "Certificate Provider", kind: "shared-certificate-provider", icon: KeyRound, docsUrl: docs("shared/certificate-provider/"), status: "gated" },
      { label: "ACME", kind: "shared-acme", icon: KeyRound, docsUrl: docs("shared/certificate-provider/acme/"), status: "gated" },
      { label: "Tailscale Provider", kind: "shared-tailscale-provider", icon: Waypoints, docsUrl: docs("shared/certificate-provider/tailscale/"), status: "gated" },
      { label: "Cloudflare Origin CA", kind: "shared-cloudflare-origin-ca", icon: KeyRound, docsUrl: docs("shared/certificate-provider/cloudflare-origin-ca/"), status: "gated" },
      { label: "DNS01 Challenge", kind: "shared-dns01", icon: KeyRound, docsUrl: docs("shared/dns01_challenge/"), status: "inspector" },
      { label: "Pre-match", kind: "shared-pre-match", icon: GitBranch, docsUrl: docs("shared/pre-match/"), status: "table" },
      { label: "Multiplex", kind: "shared-multiplex", icon: Shuffle, docsUrl: docs("shared/multiplex/"), status: "inspector" },
      { label: "V2Ray Transport", kind: "shared-v2ray-transport", icon: Network, docsUrl: docs("shared/v2ray-transport/"), status: "inspector" },
      { label: "UDP over TCP", kind: "shared-udp-over-tcp", icon: Network, docsUrl: docs("shared/udp-over-tcp/"), status: "inspector" },
      { label: "TCP Brutal", kind: "shared-tcp-brutal", icon: Cable, docsUrl: docs("shared/tcp-brutal/"), status: "inspector" },
      { label: "Wi-Fi State", kind: "shared-wifi-state", icon: RadioTower, docsUrl: docs("shared/wifi-state/"), status: "table" },
      { label: "Neighbor Resolution", kind: "shared-neighbor", icon: Waypoints, docsUrl: docs("shared/neighbor/"), status: "gated" },
    ],
  },
];

const templateGroup = groups[0];
const libraryGroups = groups.slice(1);

// Badge words per the L1-vocab spec (docs/ui-language.md, user-signed-off 2026-05-29): plain,
// cause-not-jargon. `legacy` stays the colored quality-bar; `Needs 1.14` reads the cause of gating.
const statusLabel: Record<PaletteStatus, string> = {
  add: "Add",
  setup: "Add",
  table: "List",
  inspector: "In parent",
  docs: "Reference",
  gated: "Needs 1.14",
  pending: "Soon",
  deprecated: "Legacy",
  open: "Open",
};

const deprecatedKinds = new Set<string>([
  "block",
  "hysteria-out",
  "dns-fakeip",
]);

function itemStatus(item: PaletteItem, channel: string, singletons: Set<string>): PaletteStatus {
  if (item.kind === "service-hysteria-realm" && channel !== "testing") return "gated";
  // cloudflared inbound is sing-box 1.14+ — creatable on testing, gated on stable.
  if (item.kind === "inbound-cloudflared" && channel !== "testing") return "gated";
  // http_clients[] is sing-box 1.14+ — creatable on testing, gated on stable.
  if (item.kind === "http-client" && channel !== "testing") return "gated";
  // certificate_providers[] is sing-box 1.14+ — creatable (setup) on testing, gated on stable. (C2)
  // Matches only the real palette items (certificate-provider*), not the reference-only "shared-*" set.
  if (item.kind.startsWith("certificate-provider")) return channel === "testing" ? "setup" : "gated";
  if (deprecatedKinds.has(item.kind)) return "deprecated";
  if (singletons.has(item.kind)) return "open";
  if (item.status) return item.status;
  if (item.ready || isTemplatePresetId(item.kind)) return "add";
  return "docs";
}

function statusTitle(status: PaletteStatus, label: string) {
  if (status === "add") return `Add ${label} to the canvas`;
  if (status === "setup") return `Add ${label} as a draft — fill in the required fields after`;
  if (status === "table") return `Add or edit ${label} through the ordered list`;
  if (status === "inspector") return `${label} is edited inside its parent node`;
  if (status === "gated") return `${label} needs sing-box 1.14 — switch to the testing target to create it`;
  if (status === "pending") return `${label} is planned — not creatable yet`;
  if (status === "deprecated") return `${label} is deprecated by sing-box; new configs should use the recommended replacement`;
  if (status === "open") return `${label} already exists — click to open the Inspector`;
  return `${label} is reference-only in the current UI`;
}

function canActivate(item: PaletteItem, status: PaletteStatus) {
  return (
    status === "add" ||
    status === "setup" ||
    status === "deprecated" ||
    status === "open" ||
    (status === "table" && (item.kind === "dns-rule" || item.kind === "route-rule"))
  );
}

export function Palette() {
  const [query, setQuery] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [activeGroupTitle, setActiveGroupTitle] = useState<string | null>(null);
  const [loadedTemplateId, setLoadedTemplateId] = useState<TemplatePresetId | null>(null);
  const {
    loadTemplatePreset,
    createFromPalette,
    setSelectedId,
    channel,
    hasLog,
    hasNtp,
    hasCertificate,
    hasExperimental,
    hasRoute,
    hasDns,
  } = useProjectStore(
    useShallow((state) => ({
      loadTemplatePreset: state.loadTemplatePreset,
      createFromPalette: state.createFromPalette,
      setSelectedId: state.setSelectedId,
      channel: state.channel,
      hasLog: Boolean(state.config.log && Object.keys(state.config.log).length > 0),
      hasNtp: Boolean(state.config.ntp && Object.keys(state.config.ntp).length > 0),
      hasCertificate: Boolean(state.config.certificate && Object.keys(state.config.certificate).length > 0),
      hasExperimental: Boolean(state.config.experimental && Object.keys(state.config.experimental).length > 0),
      hasRoute: Boolean(state.config.route),
      hasDns: Boolean(state.config.dns),
    })),
  );
  const singletonsPresent = useMemo(() => {
    const set = new Set<string>();
    if (hasLog) set.add("settings-log");
    if (hasNtp) set.add("settings-ntp");
    if (hasCertificate) set.add("settings-certificate");
    if (hasExperimental) set.add("settings-experimental");
    if (hasRoute) set.add("route");
    if (hasDns) set.add("dns-hub");
    return set;
  }, [hasCertificate, hasDns, hasExperimental, hasLog, hasNtp, hasRoute]);
  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return libraryGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          `${group.title} ${item.label}`.toLowerCase().includes(normalized),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [libraryGroups, query]);
  // W29: search must also cover the Templates group, not just the library.
  const filteredTemplateGroup = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized || !templateGroup) return null;
    const items = templateGroup.items.filter((item) =>
      `${templateGroup.title} ${item.label}`.toLowerCase().includes(normalized),
    );
    return items.length > 0 ? { ...templateGroup, items } : null;
  }, [query]);
  const activeGroup = activeGroupTitle ? libraryGroups.find((group) => group.title === activeGroupTitle) : null;
  const displayedGroups = query.trim() ? filteredGroups : libraryOpen && activeGroup ? [activeGroup] : [];

  return (
    <aside className="palette" aria-label="Node palette">
      <div className="panel-title">Add Library</div>
      <label className="palette-search">
        <Search size={14} />
        <input
          aria-label="Search sing-box configuration entries"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (event.target.value.trim()) {
              setLibraryOpen(true);
              setTemplatesOpen(false);
            }
          }}
          placeholder="Search config"
        />
      </label>
      <div className="palette-mode-pills" aria-label="Palette sections">
        <button
          type="button"
          className={templatesOpen ? "is-active" : ""}
          onClick={() => {
            setTemplatesOpen((open) => !open);
            setLibraryOpen(false);
            setActiveGroupTitle(null);
          }}
        >
          <ChevronRight size={14} />
          <span>Templates</span>
          <small>{templateGroup?.items.length ?? 0}</small>
        </button>
        <button
          type="button"
          className={libraryOpen ? "is-active" : ""}
          onClick={() => {
            setLibraryOpen((open) => !open);
            setTemplatesOpen(false);
            setActiveGroupTitle(null);
          }}
        >
          <ChevronRight size={14} />
          <span>Library</span>
          <small>{libraryGroups.length}</small>
        </button>
      </div>
      {!query.trim() && templatesOpen && templateGroup ? (
        <PaletteSection
          group={templateGroup}
          loadTemplatePreset={(id) => {
            loadTemplatePreset(id);
            setLoadedTemplateId(id);
          }}
          createFromPalette={createFromPalette}
          loadedTemplateId={loadedTemplateId}
          channel={channel}
          singletonsPresent={singletonsPresent}
          setSelectedId={setSelectedId}
        />
      ) : null}
      {!query.trim() && libraryOpen ? (
        <nav className="palette-nav" aria-label="Configuration groups">
          {libraryGroups.map((group) => (
            <button
              key={group.title}
              type="button"
              className={group.title === activeGroupTitle ? "is-active" : ""}
              onClick={() => setActiveGroupTitle((current) => (current === group.title ? null : group.title))}
            >
              <ChevronRight size={14} />
              <span>{group.title}</span>
              <small>{group.items.length}</small>
            </button>
          ))}
        </nav>
      ) : null}
      {query.trim() && filteredTemplateGroup ? (
        <PaletteSection
          group={filteredTemplateGroup}
          loadTemplatePreset={(id) => {
            loadTemplatePreset(id);
            setLoadedTemplateId(id);
          }}
          createFromPalette={createFromPalette}
          loadedTemplateId={loadedTemplateId}
          channel={channel}
          singletonsPresent={singletonsPresent}
          setSelectedId={setSelectedId}
        />
      ) : null}
      {displayedGroups.map((group) => (
        <PaletteSection
          key={group.title}
          group={group}
          loadTemplatePreset={loadTemplatePreset}
          createFromPalette={createFromPalette}
          loadedTemplateId={loadedTemplateId}
          channel={channel}
          singletonsPresent={singletonsPresent}
          setSelectedId={setSelectedId}
        />
      ))}
    </aside>
  );
}

function PaletteSection({
  group,
  loadTemplatePreset,
  createFromPalette,
  loadedTemplateId,
  channel,
  singletonsPresent,
  setSelectedId,
}: {
  group: PaletteGroup;
  loadTemplatePreset: (id: TemplatePresetId) => void;
  createFromPalette: (kind: string) => void;
  loadedTemplateId: TemplatePresetId | null;
  channel: string;
  singletonsPresent: Set<string>;
  setSelectedId: (id: string | null) => void;
}) {
  const isTemplateGroup = group.title === "Templates";
  return (
    <section className={`palette-group ${isTemplateGroup ? "palette-group--templates" : ""}`} key={group.title}>
      <h2>{group.title}</h2>
      <div className="palette-list">
        {group.items.map((item) => {
          const Icon = paletteIcon(item.kind, item.icon);
          const status = itemStatus(item, channel, singletonsPresent);
          const actionable = canActivate(item, status);
          const templateAdded = isTemplateGroup && isTemplatePresetId(item.kind) && item.kind === loadedTemplateId;
          const singletonSelectionId =
            item.kind === "settings-log"
              ? "settings:log"
              : item.kind === "settings-ntp"
                ? "settings:ntp"
                : item.kind === "settings-certificate"
                  ? "settings:certificate"
                  : item.kind === "settings-experimental"
                    ? "settings:experimental"
                    : item.kind === "route"
                      ? "route:main"
                      : item.kind === "dns-hub"
                        ? "dns:main"
                        : null;
          return (
            <div className="palette-entry" key={item.kind}>
              <button
                type="button"
                className={`palette-add palette-add--${status} ${templateAdded ? "is-added" : ""}`}
                disabled={!actionable}
                aria-label={
                  templateAdded
                    ? `Added ${item.label}`
                    : actionable
                      ? `${statusLabel[status]} ${item.label}`
                      : `${item.label}: ${statusLabel[status]}`
                }
                title={statusTitle(status, item.label)}
                onClick={() => {
                  if (isTemplatePresetId(item.kind)) loadTemplatePreset(item.kind);
                  else createFromPalette(item.kind);
                  if (singletonSelectionId) setSelectedId(singletonSelectionId);
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                <small>{templateAdded ? "Added" : statusLabel[status]}</small>
              </button>
              {isTemplateGroup ? null : (
                <a className="palette-doc-link" href={item.docsUrl} target="_blank" rel="noreferrer">
                  Docs
                </a>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
