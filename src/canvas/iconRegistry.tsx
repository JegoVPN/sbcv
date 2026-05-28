import type { ComponentType } from "react";
import {
  ArrowLeftRight,
  ArrowUpRight,
  Ban,
  Bot,
  Castle,
  Cog,
  Cpu,
  Earth,
  FileKey2,
  Filter,
  FlaskConical,
  Gauge,
  Ghost,
  GitBranch,
  House,
  Info,
  KeySquare,
  Layers,
  List,
  LogIn,
  MessageSquare,
  Network,
  RadioTower,
  Route,
  Router,
  ScrollText,
  Server,
  ServerCog,
  Share2,
  Shuffle,
  Signpost,
  Spline,
  Split,
  SquareTerminal,
  Waypoints,
  Webhook,
} from "lucide-react";

// One shared, type-aware node-identity icon registry (A8b / IC-P1-3). The same {kind, type}
// resolves to the same glyph on the node card, the chip picker, and the Inspector header. The
// confirmed v4 set (docs/ui-icon-set.md + docs/ui-reviews-pass2/_icons-preview-v4.html) gives
// proxy + DNS-transport protocols a 2-letter monogram and everything else a distinct Lucide glyph.
// Status glyphs (CheckCircle2 / CircleAlert / TriangleAlert) are reserved and never an identity icon.

export type IconRenderProps = { size?: number | string; strokeWidth?: number | string; className?: string };
export type IconRenderer = ComponentType<IconRenderProps>;

function makeMonogram(code: string): IconRenderer {
  function MonogramIcon({ size = 16, className }: IconRenderProps) {
    const px = typeof size === "number" ? size : Number.parseInt(size, 10) || 16;
    return (
      <span
        className={className}
        data-monogram={code}
        aria-hidden="true"
        style={{
          display: "inline-grid",
          placeItems: "center",
          width: px,
          height: px,
          fontSize: Math.round(px * 0.6),
          lineHeight: 1,
          fontWeight: 760,
          letterSpacing: "-0.04em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {code}
      </span>
    );
  }
  MonogramIcon.displayName = `Monogram(${code})`;
  return MonogramIcon;
}

// Status glyphs are reserved — no node identity icon may resolve to one of these ids.
export const RESERVED_STATUS_ICON_IDS = ["check-circle-2", "circle-alert", "triangle-alert", "circle-x"] as const;

// 2-letter monograms for proxy protocols (shared across inbound + outbound), per v4 preview.
const PROXY_MONOGRAM: Record<string, string> = {
  socks: "S5",
  http: "HT",
  shadowsocks: "SS",
  vmess: "VM",
  vless: "VL",
  trojan: "TR",
  naive: "NA",
  hysteria: "HY",
  hysteria2: "H2",
  tuic: "TU",
  anytls: "AT",
  shadowtls: "ST",
};

// 2-letter monograms for DNS-server transport protocols, per v4 preview.
const DNS_TRANSPORT_MONOGRAM: Record<string, string> = {
  tcp: "TC",
  udp: "UD",
  tls: "TL",
  https: "HS",
  h3: "H3",
  quic: "QC",
};

const INBOUND_FUNCTIONAL: Record<string, string> = {
  direct: "log-in",
  mixed: "arrow-left-right",
  tun: "network",
  redirect: "spline",
  tproxy: "split",
};

const OUTBOUND_FUNCTIONAL: Record<string, string> = {
  direct: "arrow-up-right",
  block: "ban",
  selector: "shuffle",
  urltest: "gauge",
  dns: "signpost",
  ssh: "square-terminal",
};

const DNS_SERVER_FUNCTIONAL: Record<string, string> = {
  local: "house",
  dhcp: "router",
  fakeip: "ghost",
  resolved: "cpu",
  hosts: "list",
};

const SERVICE_FUNCTIONAL: Record<string, string> = {
  derp: "share2",
  resolved: "server-cog",
  "ssm-api": "key-square",
  ccm: "message-square",
  ocm: "bot",
  "hysteria-realm": "castle",
};

// Type-agnostic, kind-level default icon.
const KIND_DEFAULT: Record<string, string> = {
  inbound: "radio-tower",
  outbound: "network",
  route: "route",
  "route-rule": "git-branch",
  dns: "earth",
  "dns-server": "server",
  "dns-rule": "filter",
  endpoint: "waypoints",
  service: "server",
  "rule-set": "layers",
  "certificate-provider": "file-key2",
  "http-client": "webhook",
  settings: "cog",
  notice: "info",
};

const RENDERERS: Record<string, IconRenderer> = {
  "arrow-left-right": ArrowLeftRight,
  "arrow-up-right": ArrowUpRight,
  ban: Ban,
  bot: Bot,
  castle: Castle,
  cog: Cog,
  cpu: Cpu,
  earth: Earth,
  "file-key2": FileKey2,
  filter: Filter,
  "flask-conical": FlaskConical,
  gauge: Gauge,
  ghost: Ghost,
  "git-branch": GitBranch,
  house: House,
  info: Info,
  "key-square": KeySquare,
  layers: Layers,
  list: List,
  "log-in": LogIn,
  "message-square": MessageSquare,
  network: Network,
  "radio-tower": RadioTower,
  route: Route,
  router: Router,
  "scroll-text": ScrollText,
  server: Server,
  "server-cog": ServerCog,
  share2: Share2,
  shuffle: Shuffle,
  signpost: Signpost,
  spline: Spline,
  split: Split,
  "square-terminal": SquareTerminal,
  waypoints: Waypoints,
  webhook: Webhook,
};

const MONOGRAM_CACHE = new Map<string, IconRenderer>();

function monogramId(code: string): string {
  return `mono:${code}`;
}

/** Stable id for a node's identity icon — used for the collision guarantee and cross-surface tests. */
export function nodeIconId(kind: string, type: string): string {
  // Brand protocols, gated by the kinds v4 confirms (not every "tailscale"-typed kind is the brand).
  // v4 ships these as brand SVGs; until the license/bundle-size review (deferred follow-up
  // A8b-brands) they fall back to a distinct monogram so they stay collision-free.
  if (kind === "outbound" && type === "tor") return "mono:TO";
  if (kind === "endpoint" && type === "wireguard") return "mono:WG";
  if ((kind === "endpoint" || kind === "dns-server") && type === "tailscale") return "mono:TS";

  if (kind === "inbound" || kind === "outbound") {
    const proxy = PROXY_MONOGRAM[type];
    if (proxy) return monogramId(proxy);
  }
  if (kind === "dns-server") {
    const transport = DNS_TRANSPORT_MONOGRAM[type];
    if (transport) return monogramId(transport);
  }

  if (kind === "inbound") {
    const fn = INBOUND_FUNCTIONAL[type];
    if (fn) return fn;
  }
  if (kind === "outbound") {
    const fn = OUTBOUND_FUNCTIONAL[type];
    if (fn) return fn;
  }
  if (kind === "dns-server") {
    const fn = DNS_SERVER_FUNCTIONAL[type];
    if (fn) return fn;
  }
  if (kind === "service") {
    const fn = SERVICE_FUNCTIONAL[type];
    if (fn) return fn;
  }
  if (kind === "settings") {
    if (type === "log") return "scroll-text";
    if (type === "experimental") return "flask-conical";
    return "cog";
  }

  return KIND_DEFAULT[kind] ?? "server";
}

/** The renderable identity icon component for a node {kind, type}. Lucide glyph or monogram. */
export function getNodeIcon(kind: string, type: string): IconRenderer {
  const id = nodeIconId(kind, type);
  if (id.startsWith("mono:")) {
    const code = id.slice("mono:".length);
    let renderer = MONOGRAM_CACHE.get(code);
    if (!renderer) {
      renderer = makeMonogram(code);
      MONOGRAM_CACHE.set(code, renderer);
    }
    return renderer;
  }
  return RENDERERS[id] ?? Server;
}
