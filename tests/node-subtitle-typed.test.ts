import { describe, expect, it } from "vitest";
import { deriveGraph } from "../src/canvas/graph";
import type { SingBoxConfig } from "../src/domain/types";

// Typed node subtitles (grounded in upstream docs): the titlebar already names the type, so the subtitle
// carries per-instance identity — hub final, outbound server/detour/members, dns-server per-type summary,
// service counts/listen, inline rule-set count.
function subtitleOf(config: unknown, id: string): string | undefined {
  const { nodes } = deriveGraph(config as SingBoxConfig, { positions: {} }, []);
  return nodes.find((node) => node.id === id)?.data.subtitle;
}

describe("typed node subtitles", () => {
  it("route/dns hubs append the final target", () => {
    expect(
      subtitleOf({ route: { rules: [{ domain: ["x"] }], final: "direct" }, outbounds: [{ type: "direct", tag: "direct" }] }, "route:main"),
    ).toBe("1 ordered rules · final → direct");
    expect(subtitleOf({ dns: { rules: [], final: "local" } }, "dns:main")).toBe("0 ordered rules · final → local");
    expect(subtitleOf({ route: { rules: [] } }, "route:main")).toBe("0 ordered rules");
  });

  it("outbound proxy shows server:port without the redundant type prefix", () => {
    expect(
      subtitleOf({ outbounds: [{ type: "shadowsocks", tag: "ss", server: "1.2.3.4", server_port: 8388 }] }, "outbound:ss"),
    ).toBe("1.2.3.4:8388");
  });

  it("outbound with a detour shows the detour chain", () => {
    expect(
      subtitleOf(
        { outbounds: [{ type: "shadowsocks", tag: "ss", detour: "direct" }, { type: "direct", tag: "direct" }] },
        "outbound:ss",
      ),
    ).toBe("→ direct");
  });

  it("selector/urltest groups show the member list (capped) plus default", () => {
    expect(
      subtitleOf(
        {
          outbounds: [
            { type: "selector", tag: "sel", outbounds: ["a", "b"], default: "b" },
            { type: "direct", tag: "a" },
            { type: "direct", tag: "b" },
          ],
        },
        "outbound:sel",
      ),
    ).toBe("a, b · default b");
  });

  it("dns-server subtitles are per-type for hostless servers", () => {
    expect(subtitleOf({ dns: { servers: [{ type: "fakeip", tag: "fk", inet4_range: "198.18.0.0/15" }] } }, "dns-server:fk")).toBe(
      "FakeIP 198.18.0.0/15",
    );
    expect(subtitleOf({ dns: { servers: [{ type: "hosts", tag: "h", predefined: { "a.com": "1.1.1.1" } }] } }, "dns-server:h")).toBe(
      "1 records",
    );
    expect(subtitleOf({ dns: { servers: [{ type: "dhcp", tag: "d", interface: "eth0" }] } }, "dns-server:d")).toBe("dhcp · eth0");
  });

  it("services show per-instance info, not static prose", () => {
    expect(subtitleOf({ services: [{ type: "ssm-api", tag: "api", servers: { "/a": "in" } }] }, "service:api")).toBe(
      "1 managed servers",
    );
    expect(subtitleOf({ services: [{ type: "derp", tag: "d", listen: "0.0.0.0", listen_port: 443 }] }, "service:d")).toBe(
      "listen 0.0.0.0:443",
    );
  });

  it("inline rule-set shows its rule count", () => {
    expect(subtitleOf({ route: { rule_set: [{ type: "inline", tag: "r", rules: [{}, {}] }] } }, "rule-set:r")).toBe(
      "2 inline rules",
    );
  });

  it("inbound subtitles add a second dimension (users / method / tun interface)", () => {
    // credential protocols & auth-configured socks show the user count
    expect(
      subtitleOf({ inbounds: [{ type: "vmess", tag: "v", listen_port: 443, users: [{ uuid: "x" }] }] }, "inbound:v"),
    ).toBe("listen :443 · 1 users");
    expect(
      subtitleOf({ inbounds: [{ type: "socks", tag: "s", listen: "127.0.0.1", listen_port: 1080, users: [{}, {}] }] }, "inbound:s"),
    ).toBe("listen 127.0.0.1:1080 · 2 users");
    // shadowsocks shows its cipher
    expect(
      subtitleOf({ inbounds: [{ type: "shadowsocks", tag: "ss", listen_port: 8388, method: "aes-256-gcm" }] }, "inbound:ss"),
    ).toBe("listen :8388 · aes-256-gcm");
    // tun is interface · address, not a fake listen:port
    expect(
      subtitleOf({ inbounds: [{ type: "tun", tag: "t", interface_name: "tun0", address: ["172.18.0.1/30"] }] }, "inbound:t"),
    ).toBe("tun0 · 172.18.0.1/30");
    // an auth-optional socks with no users is unchanged (no noisy suffix)
    expect(
      subtitleOf({ inbounds: [{ type: "socks", tag: "s2", listen: "127.0.0.1", listen_port: 1081 }] }, "inbound:s2"),
    ).toBe("listen 127.0.0.1:1081");
    // graceful fallbacks: tun with only an interface; shadowsocks with no method
    expect(subtitleOf({ inbounds: [{ type: "tun", tag: "t2", interface_name: "tun1" }] }, "inbound:t2")).toBe("tun1");
    expect(
      subtitleOf({ inbounds: [{ type: "shadowsocks", tag: "ss2", listen_port: 8389 }] }, "inbound:ss2"),
    ).toBe("listen :8389");
  });
});
