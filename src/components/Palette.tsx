import { useMemo, useState } from "react";
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
import type { TemplatePresetId } from "../domain/templates";
import { useProjectStore } from "../state/useProjectStore";

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

type PaletteStatus = "add" | "setup" | "table" | "inspector" | "docs" | "gated" | "pending";

function docs(path = "") {
  return `https://sing-box.sagernet.org/configuration/${path}`;
}

function isTemplatePresetId(kind: string): kind is TemplatePresetId {
  return kind === "template-1.12" || kind === "template-1.13" || kind === "template-1.14";
}

const groups: PaletteGroup[] = [
  {
    title: "Templates",
    items: [
      { label: "1.13 Stable TUN Split", kind: "template-1.13", icon: Blocks, docsUrl: docs(), ready: true },
      { label: "1.12 Legacy Mixed Split", kind: "template-1.12", icon: RadioTower, docsUrl: docs(), ready: true },
      { label: "1.14 Testing HTTP Client", kind: "template-1.14", icon: Globe2, docsUrl: docs(), ready: true },
    ],
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
      { label: "DNS Rule Action", kind: "dns-rule-action", icon: GitBranch, docsUrl: docs("dns/rule_action/"), status: "inspector" },
      { label: "FakeIP", kind: "dns-fakeip", icon: Blocks, docsUrl: docs("dns/fakeip/") },
      { label: "Legacy Server", kind: "dns-legacy", icon: Server, docsUrl: docs("dns/server/legacy/") },
      { label: "Local Server", kind: "dns-local", icon: Globe2, docsUrl: docs("dns/server/local/"), ready: true },
      { label: "Hosts Server", kind: "dns-hosts", icon: Server, docsUrl: docs("dns/server/hosts/") },
      { label: "TCP Server", kind: "dns-tcp", icon: Server, docsUrl: docs("dns/server/tcp/") },
      { label: "UDP Server", kind: "dns-udp", icon: Server, docsUrl: docs("dns/server/udp/") },
      { label: "TLS Server", kind: "dns-tls", icon: Shield, docsUrl: docs("dns/server/tls/") },
      { label: "QUIC Server", kind: "dns-quic", icon: Plug, docsUrl: docs("dns/server/quic/") },
      { label: "HTTPS Server", kind: "dns-https", icon: Globe2, docsUrl: docs("dns/server/https/"), ready: true },
      { label: "HTTP3 Server", kind: "dns-http3", icon: Globe2, docsUrl: docs("dns/server/http3/") },
      { label: "DHCP Server", kind: "dns-dhcp", icon: Network, docsUrl: docs("dns/server/dhcp/") },
      { label: "mDNS Server", kind: "dns-mdns", icon: Globe2, docsUrl: docs("dns/server/mdns/") },
      { label: "Tailscale Server", kind: "dns-tailscale", icon: Waypoints, docsUrl: docs("dns/server/tailscale/") },
      { label: "Resolved Server", kind: "dns-resolved", icon: Server, docsUrl: docs("dns/server/resolved/") },
    ],
  },
  {
    title: "NTP",
    items: [{ label: "NTP Settings", kind: "settings-ntp", icon: Clock3, docsUrl: docs("ntp/"), status: "pending" }],
  },
  {
    title: "Certificate",
    items: [{ label: "Certificate", kind: "settings-certificate", icon: FileKey2, docsUrl: docs("certificate/"), status: "pending" }],
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
    items: [{ label: "HTTP Client", kind: "http-client", icon: Globe2, docsUrl: docs("shared/http-client/"), status: "gated" }],
  },
  {
    title: "Endpoints",
    items: [
      { label: "WireGuard", kind: "endpoint-wireguard", icon: Waypoints, docsUrl: docs("endpoint/wireguard/") },
      { label: "Tailscale", kind: "endpoint-tailscale", icon: Waypoints, docsUrl: docs("endpoint/tailscale/") },
    ],
  },
  {
    title: "Inbounds",
    items: [
      { label: "Direct", kind: "inbound-direct", icon: Cable, docsUrl: docs("inbound/direct/"), status: "setup" },
      { label: "Mixed", kind: "mixed", icon: RadioTower, docsUrl: docs("inbound/mixed/"), ready: true },
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
      { label: "TUN", kind: "tun", icon: RadioTower, docsUrl: docs("inbound/tun/"), ready: true },
      { label: "Redirect", kind: "inbound-redirect", icon: GitBranch, docsUrl: docs("inbound/redirect/"), status: "setup" },
      { label: "TProxy", kind: "inbound-tproxy", icon: GitBranch, docsUrl: docs("inbound/tproxy/"), status: "setup" },
      { label: "Cloudflared", kind: "inbound-cloudflared", icon: Globe2, docsUrl: docs("inbound/cloudflared/"), status: "gated" },
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
      { label: "WireGuard", kind: "wireguard-out", icon: Waypoints, docsUrl: docs("outbound/wireguard/") },
      { label: "Hysteria", kind: "hysteria-out", icon: Plug, docsUrl: docs("outbound/hysteria/"), status: "setup" },
      { label: "ShadowTLS", kind: "shadowtls-out", icon: Shield, docsUrl: docs("outbound/shadowtls/"), status: "setup" },
      { label: "VLESS", kind: "vless-out", icon: Shield, docsUrl: docs("outbound/vless/"), status: "setup" },
      { label: "TUIC", kind: "tuic-out", icon: Plug, docsUrl: docs("outbound/tuic/"), status: "setup" },
      { label: "Hysteria2", kind: "hysteria2-out", icon: Plug, docsUrl: docs("outbound/hysteria2/"), status: "setup" },
      { label: "AnyTLS", kind: "anytls-out", icon: Shield, docsUrl: docs("outbound/anytls/"), status: "setup" },
      { label: "Tor", kind: "tor-out", icon: Network, docsUrl: docs("outbound/tor/"), status: "setup" },
      { label: "SSH", kind: "ssh-out", icon: Server, docsUrl: docs("outbound/ssh/"), status: "setup" },
      { label: "DNS", kind: "dns-out", icon: Globe2, docsUrl: docs("outbound/dns/") },
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
      { label: "Rule Set", kind: "rule-set", icon: Layers3, docsUrl: docs("rule-set/"), status: "pending" },
      { label: "Protocol Sniff", kind: "route-sniff", icon: Search, docsUrl: docs("route/sniff/") },
    ],
  },
  {
    title: "Services",
    items: [
      { label: "DERP", kind: "service-derp", icon: Server, docsUrl: docs("service/derp/") },
      { label: "Resolved", kind: "service-resolved", icon: Server, docsUrl: docs("service/resolved/") },
      { label: "SSM API", kind: "service-ssm-api", icon: Server, docsUrl: docs("service/ssm-api/") },
      { label: "CCM", kind: "service-ccm", icon: Server, docsUrl: docs("service/ccm/") },
      { label: "OCM", kind: "service-ocm", icon: Server, docsUrl: docs("service/ocm/") },
      { label: "Hysteria Realm", kind: "service-hysteria-realm", icon: Plug, docsUrl: docs("service/hysteria-realm/") },
    ],
  },
  {
    title: "Experimental",
    items: [
      { label: "Experimental", kind: "settings-experimental", icon: FlaskConical, docsUrl: docs("experimental/"), status: "pending" },
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

const statusLabel: Record<PaletteStatus, string> = {
  add: "Add",
  setup: "Setup",
  table: "Table",
  inspector: "Inspector",
  docs: "Docs",
  gated: "Gated",
  pending: "Pending",
};

function itemStatus(item: PaletteItem): PaletteStatus {
  if (item.status) return item.status;
  if (item.ready || isTemplatePresetId(item.kind)) return "add";
  return "docs";
}

function statusTitle(status: PaletteStatus, label: string) {
  if (status === "add") return `Add ${label} to canvas`;
  if (status === "setup") return `Add ${label} setup draft to canvas`;
  if (status === "table") return `Add or edit ${label} through the ordered table`;
  if (status === "inspector") return `${label} is edited inside its parent Inspector`;
  if (status === "gated") return `${label} is target-gated and needs matching sing-box validation`;
  if (status === "pending") return `${label} is planned but not implemented as a writable command yet`;
  return `${label} is documentation-only in the current UI`;
}

function canActivate(item: PaletteItem, status: PaletteStatus) {
  return status === "add" || status === "setup" || (status === "table" && (item.kind === "dns-rule" || item.kind === "route-rule"));
}

export function Palette() {
  const [query, setQuery] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [activeGroupTitle, setActiveGroupTitle] = useState("Templates");
  const loadTemplatePreset = useProjectStore((state) => state.loadTemplatePreset);
  const createFromPalette = useProjectStore((state) => state.createFromPalette);
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
  const activeGroup = libraryGroups.find((group) => group.title === activeGroupTitle) ?? libraryGroups[0];
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
            setTemplatesOpen(false);
          }}
          createFromPalette={createFromPalette}
        />
      ) : null}
      {!query.trim() && libraryOpen ? (
        <nav className="palette-nav" aria-label="Configuration groups">
          {libraryGroups.map((group) => (
            <button
              key={group.title}
              type="button"
              className={group.title === activeGroupTitle ? "is-active" : ""}
              onClick={() => setActiveGroupTitle(group.title)}
            >
              <ChevronRight size={14} />
              <span>{group.title}</span>
              <small>{group.items.length}</small>
            </button>
          ))}
        </nav>
      ) : null}
      {displayedGroups.map((group) => (
        <PaletteSection
          key={group.title}
          group={group}
          loadTemplatePreset={loadTemplatePreset}
          createFromPalette={(kind) => {
            createFromPalette(kind);
            if (!query.trim()) setLibraryOpen(false);
          }}
        />
      ))}
    </aside>
  );
}

function PaletteSection({
  group,
  loadTemplatePreset,
  createFromPalette,
}: {
  group: PaletteGroup;
  loadTemplatePreset: (id: TemplatePresetId) => void;
  createFromPalette: (kind: string) => void;
}) {
  return (
    <section className="palette-group" key={group.title}>
      <h2>{group.title}</h2>
      <div className="palette-list">
        {group.items.map((item) => {
          const Icon = item.icon;
          const status = itemStatus(item);
          const actionable = canActivate(item, status);
          return (
            <div className="palette-entry" key={item.kind}>
              <button
                type="button"
                className={`palette-add palette-add--${status}`}
                disabled={!actionable}
                aria-label={actionable ? `${statusLabel[status]} ${item.label}` : `${item.label}: ${statusLabel[status]}`}
                title={statusTitle(status, item.label)}
                onClick={() => {
                  if (isTemplatePresetId(item.kind)) loadTemplatePreset(item.kind);
                  else createFromPalette(item.kind);
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                <small>{statusLabel[status]}</small>
              </button>
              <a className="palette-doc-link" href={item.docsUrl} target="_blank" rel="noreferrer">
                Docs
              </a>
            </div>
          );
        })}
      </div>
    </section>
  );
}
