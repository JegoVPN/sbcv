import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { labelForNodeKind, labelForNodeType, nodeTitlebarLabel } from "../src/canvas/nodeLabels";
import { useProjectStore } from "../src/state/useProjectStore";

// A28 (W34): the node titlebar rendered raw machine enums — `outbound / shadowsocks`. It now reads a
// human label — `Outbound · Shadowsocks` — via a shared label helper, and collapses to one word for
// singleton nodes whose type duplicates their kind (route/dns/route-rule/dns-rule) so it never reads
// "Route · Route".

describe("A28 — node label helper", () => {
  it("maps known kinds and protocol types to human labels", () => {
    expect(labelForNodeKind("outbound")).toBe("Outbound");
    expect(labelForNodeKind("dns-server")).toBe("DNS Server");
    expect(labelForNodeKind("rule-set")).toBe("Rule Set");
    expect(labelForNodeType("shadowsocks")).toBe("Shadowsocks");
    expect(labelForNodeType("shadowtls")).toBe("ShadowTLS");
    expect(labelForNodeType("wireguard")).toBe("WireGuard");
  });

  it("title-cases unknown kinds/types instead of leaking the raw enum", () => {
    expect(labelForNodeType("some-new-proto")).toBe("Some New Proto");
    expect(labelForNodeKind("brand-new-kind")).toBe("Brand New Kind");
  });

  it("keeps acronyms correct for settings/notice summary types", () => {
    expect(labelForNodeType("ntp")).toBe("NTP");
    expect(labelForNodeType("route-rules")).toBe("Route Rules");
    expect(labelForNodeType("dns-rules")).toBe("DNS Rules");
  });

  it("combines kind · type for distinct pairs", () => {
    expect(nodeTitlebarLabel("outbound", "shadowsocks")).toBe("Outbound · Shadowsocks");
    expect(nodeTitlebarLabel("inbound", "vless")).toBe("Inbound · VLESS");
    expect(nodeTitlebarLabel("dns-server", "tailscale")).toBe("DNS Server · Tailscale");
  });

  it("collapses singleton nodes whose type duplicates their kind", () => {
    expect(nodeTitlebarLabel("route", "route")).toBe("Route");
    expect(nodeTitlebarLabel("route-rule", "route-rule")).toBe("Route Rule");
    expect(nodeTitlebarLabel("dns", "dns")).toBe("DNS");
    expect(nodeTitlebarLabel("dns-rule", "dns-rule")).toBe("DNS Rule");
  });
});

describe("A28 — SbcNode titlebar renders the human label", () => {
  it("shows `Outbound · Shadowsocks`, not the raw `outbound / shadowsocks`", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ outbounds: [{ type: "shadowsocks", tag: "ss-out", method: "aes-128-gcm", password: "x" }] }),
    );
    render(<App />);
    const node = screen.getByTestId("node-outbound:ss-out");
    const titlebar = node.querySelector('[data-testid="node-titlebar"]');
    expect(titlebar?.textContent).toContain("Outbound · Shadowsocks");
    expect(titlebar?.textContent).not.toContain("outbound / shadowsocks");
  });
});
