import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getNodeIcon, nodeIconId, RESERVED_STATUS_ICON_IDS } from "../src/canvas/iconRegistry";
import { ChipPickerPopover, type ChipPickerCandidate } from "../src/components/ChipPickerPopover";
import { paletteNodeRef } from "../src/components/Palette";

// A8b / IC-P1-3: one shared, type-aware node-identity icon registry. These lock the confirmed v4 set
// (docs/ui-icon-set.md + _icons-preview-v4.html) and the cross-surface single-source guarantee.

const V4_NODE_ICONS: Array<[kind: string, type: string, id: string]> = [
  // Outbound — status glyph removed from `direct`; urltest off the storage metaphor.
  ["outbound", "direct", "arrow-up-right"],
  ["outbound", "block", "ban"],
  ["outbound", "selector", "shuffle"],
  ["outbound", "urltest", "gauge"],
  ["outbound", "dns", "signpost"],
  ["outbound", "ssh", "square-terminal"],
  ["outbound", "socks", "mono:S5"],
  ["outbound", "http", "mono:HT"],
  ["outbound", "shadowsocks", "mono:SS"],
  ["outbound", "vmess", "mono:VM"],
  ["outbound", "hysteria2", "mono:H2"],
  ["outbound", "tuic", "mono:TU"],
  ["outbound", "anytls", "mono:AT"],
  ["outbound", "shadowtls", "mono:ST"],
  ["outbound", "tor", "mono:TO"],
  ["outbound", "wireguard", "mono:WG"],
  // Inbound — no longer all RadioTower; proxies reuse the protocol monogram.
  ["inbound", "direct", "log-in"],
  ["inbound", "mixed", "arrow-left-right"],
  ["inbound", "tun", "network"],
  ["inbound", "redirect", "spline"],
  ["inbound", "tproxy", "split"],
  ["inbound", "socks", "mono:S5"],
  ["inbound", "shadowsocks", "mono:SS"],
  // DNS server — no longer all Server.
  ["dns-server", "local", "house"],
  ["dns-server", "dhcp", "router"],
  ["dns-server", "fakeip", "ghost"],
  ["dns-server", "resolved", "cpu"],
  ["dns-server", "hosts", "list"],
  ["dns-server", "https", "mono:HS"],
  ["dns-server", "quic", "mono:QC"],
  ["dns-server", "tailscale", "mono:TS"],
  // Service — no longer all Server (and distinct from dns-server).
  ["service", "derp", "share2"],
  ["service", "resolved", "server-cog"],
  ["service", "ssm-api", "key-square"],
  ["service", "ccm", "message-square"],
  ["service", "ocm", "bot"],
  ["service", "hysteria-realm", "castle"],
  // Hubs / rules / resources.
  ["route", "route", "route"],
  ["dns", "dns", "earth"],
  ["route-rule", "route-rule", "git-branch"],
  ["dns-rule", "dns-rule", "filter"],
  ["rule-set", "remote", "layers"],
  ["endpoint", "wireguard", "mono:WG"],
  ["endpoint", "tailscale", "mono:TS"],
  ["certificate-provider", "tailscale", "file-key2"],
  ["http-client", "http-client", "webhook"],
  ["settings", "log", "scroll-text"],
  ["settings", "ntp", "clock"],
  ["settings", "certificate", "file-badge2"],
  ["settings", "experimental", "flask-conical"],
];

describe("icon registry — confirmed v4 node identity set", () => {
  it.each(V4_NODE_ICONS)("%s/%s resolves to %s", (kind, type, id) => {
    expect(nodeIconId(kind, type)).toBe(id);
  });

  it("never resolves a node identity icon to a reserved status glyph", () => {
    const reserved = new Set<string>(RESERVED_STATUS_ICON_IDS);
    for (const [kind, type] of V4_NODE_ICONS) {
      expect(reserved.has(nodeIconId(kind, type)), `${kind}/${type}`).toBe(false);
    }
  });

  it("gives every distinct node type a unique icon (collision guarantee)", () => {
    const seen = new Map<string, string>();
    for (const [kind, type] of V4_NODE_ICONS) {
      // in/out share a protocol monogram by design — only assert uniqueness for distinct entries.
      const id = nodeIconId(kind, type);
      const key = `${kind}/${type}`;
      const clash = [...seen.entries()].find(([, v]) => v === id);
      if (clash && !sharesProtocol(clash[0], key)) {
        throw new Error(`icon ${id} double-booked by ${clash[0]} and ${key}`);
      }
      seen.set(key, id);
    }
  });

  it("returns a renderable component for every entry", () => {
    for (const [kind, type] of V4_NODE_ICONS) {
      // Lucide icons are forwardRef objects; monograms are function components — both truthy/renderable.
      expect(getNodeIcon(kind, type)).toBeTruthy();
    }
  });
});

// Two entries may share an icon only when they are the same protocol seen from inbound vs outbound.
function sharesProtocol(a: string, b: string): boolean {
  const proto = (s: string) => s.split("/")[1];
  return proto(a) === proto(b);
}

describe("icon registry — single source across surfaces", () => {
  function renderPicker(candidate: ChipPickerCandidate) {
    return render(
      <ChipPickerPopover
        x={0}
        y={0}
        width={200}
        maxHeight={300}
        candidates={[candidate]}
        onPick={() => {}}
        onClose={() => {}}
      />,
    );
  }

  it("chip picker renders the registry glyph for a urltest outbound (gauge, not a separate map)", () => {
    const { container } = renderPicker({
      id: "c1",
      label: "fast",
      nodeKind: "outbound",
      nodeType: "urltest",
      handleId: "h1",
    });
    expect(container.querySelector(".lucide-gauge")).not.toBeNull();
  });

  it("palette node-creating items resolve through the registry (urltest -> gauge, not Shuffle)", () => {
    const cases: Array<[paletteKind: string, expectedId: string]> = [
      ["urltest", "gauge"],
      ["ss-out", "mono:SS"],
      ["service-derp", "share2"],
      ["dns-hub", "earth"],
      ["dns-rule", "filter"],
      ["settings-ntp", "clock"],
      ["endpoint-wireguard", "mono:WG"],
    ];
    for (const [paletteKind, expectedId] of cases) {
      const ref = paletteNodeRef(paletteKind);
      expect(ref, paletteKind).not.toBeNull();
      expect(nodeIconId(ref!.kind, ref!.type), paletteKind).toBe(expectedId);
    }
    // Non-node catalog entries keep their own icon (no registry ref).
    expect(paletteNodeRef("route-geoip")).toBeNull();
    expect(paletteNodeRef("shared-tls")).toBeNull();
  });

  it("chip picker renders the registry glyph for a service (server, not Settings)", () => {
    const { container } = renderPicker({
      id: "c2",
      label: "DERP",
      nodeKind: "service",
      nodeType: "derp",
      handleId: "h2",
    });
    // v4: service/derp -> share2. The old picker map collapsed all services to Settings.
    expect(container.querySelector(".lucide-share2")).not.toBeNull();
    expect(container.querySelector(".lucide-settings")).toBeNull();
  });
});
