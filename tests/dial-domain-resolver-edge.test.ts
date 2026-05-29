import { describe, expect, it, beforeEach } from "vitest";

import { deriveGraph } from "../src/canvas/graph";
import { disconnectEdge } from "../src/domain/commands";
import { formatEdgeId, relationForHandles } from "../src/domain/portRelationRegistry";
import { useProjectStore } from "../src/state/useProjectStore";
import type { SingBoxConfig } from "../src/domain/types";

// C11b (G7): domain_resolver (shared/dial.md — string OR object `.server` form, added 1.12.0, required
// for domain-named servers since 1.14.0) on a dial-bearing entity (outbound / endpoint / dns-server) is
// a writable edge into the referenced dns-server. The Inspector select stays the editor; this adds the
// canvas output port + connect/disconnect symmetry. Per-source-kind relations mirror the detour family
// so type-gating (dial group membership) is precise per kind.

const layout = { positions: {} };
const edgesOf = (config: SingBoxConfig) => deriveGraph(config, layout, []).edges;
const nodeOf = (config: SingBoxConfig, id: string) =>
  deriveGraph(config, layout, []).nodes.find((node) => node.id === id);

function outboundConfig(domainResolver: unknown): SingBoxConfig {
  return {
    dns: { servers: [{ type: "udp", tag: "boot", server: "1.1.1.1", server_port: 53 }] },
    outbounds: [
      { type: "trojan", tag: "px", server: "proxy.example.com", server_port: 443, password: "x", domain_resolver: domainResolver },
    ],
  } as unknown as SingBoxConfig;
}

describe("C11b — dial-domain-resolver writable edge", () => {
  it("renders an edge for an outbound's string domain_resolver to dns-server:<tag>", () => {
    const edge = edgesOf(outboundConfig("boot")).find((e) => e.id === formatEdgeId("dial-domain-resolver", "px", "boot"));
    expect(edge).toMatchObject({
      source: "outbound:px",
      target: "dns-server:boot",
      sourceHandle: "domain-resolver",
      targetHandle: "domain-resolver-target",
      deletable: true,
    });
  });

  it("renders the same edge for the object form (domain_resolver.server)", () => {
    const edge = edgesOf(outboundConfig({ server: "boot", strategy: "prefer_ipv4" })).find(
      (e) => e.id === formatEdgeId("dial-domain-resolver", "px", "boot"),
    );
    expect(edge?.target).toBe("dns-server:boot");
  });

  it("renders edges for endpoint and dns-server sources too", () => {
    const config = {
      dns: {
        servers: [
          { type: "udp", tag: "boot", server: "1.1.1.1", server_port: 53 },
          { type: "https", tag: "doh", server: "dns.example.com", domain_resolver: "boot" },
        ],
      },
      endpoints: [{ type: "wireguard", tag: "wg", domain_resolver: "boot" }],
    } as unknown as SingBoxConfig;
    const ids = new Set(edgesOf(config).map((e) => e.id));
    expect(ids.has(formatEdgeId("endpoint-domain-resolver", "wg", "boot"))).toBe(true);
    expect(ids.has(formatEdgeId("dns-server-domain-resolver", "doh", "boot"))).toBe(true);
  });

  it("renders no edge when the resolver tag is not an existing dns-server", () => {
    expect(edgesOf(outboundConfig("ghost")).some((e) => e.id.startsWith("edge:dial-domain-resolver"))).toBe(false);
  });

  it("renders no self-loop when a dns-server resolves its own host through itself", () => {
    const config = {
      dns: { servers: [{ type: "https", tag: "doh", server: "dns.example.com", domain_resolver: "doh" }] },
    } as unknown as SingBoxConfig;
    expect(edgesOf(config).some((e) => e.id.startsWith("edge:dns-server-domain-resolver"))).toBe(false);
  });

  it("lights the output dot on the source and the input dot on the dns-server", () => {
    const config = outboundConfig("boot");
    expect(nodeOf(config, "outbound:px")?.data.connectedPorts?.output ?? []).toContain("domain-resolver");
    expect(nodeOf(config, "dns-server:boot")?.data.connectedPorts?.input ?? []).toContain("domain-resolver-target");
  });

  it("relationForHandles resolves outbound/endpoint/dns-server sources, but not non-dial types", () => {
    expect(relationForHandles("outbound", "trojan", "domain-resolver", "dns-server", "udp", "domain-resolver-target")?.id).toBe("dial-domain-resolver");
    expect(relationForHandles("endpoint", "wireguard", "domain-resolver", "dns-server", "udp", "domain-resolver-target")?.id).toBe("endpoint-domain-resolver");
    expect(relationForHandles("dns-server", "https", "domain-resolver", "dns-server", "udp", "domain-resolver-target")?.id).toBe("dns-server-domain-resolver");
    // selector outbound has no dial group → no domain_resolver output port relation.
    expect(relationForHandles("outbound", "selector", "domain-resolver", "dns-server", "udp", "domain-resolver-target")).toBeUndefined();
    // a non-dial dns-server (hosts) cannot be a source either.
    expect(relationForHandles("dns-server", "hosts", "domain-resolver", "dns-server", "udp", "domain-resolver-target")).toBeUndefined();
  });

  it("disconnect clears the string form on the source", () => {
    const updated = disconnectEdge(outboundConfig("boot"), formatEdgeId("dial-domain-resolver", "px", "boot"));
    expect((updated.outbounds?.[0] as Record<string, unknown>).domain_resolver).toBeUndefined();
  });

  it("disconnect clears the object form on the source", () => {
    const updated = disconnectEdge(
      outboundConfig({ server: "boot", strategy: "prefer_ipv4" }),
      formatEdgeId("dial-domain-resolver", "px", "boot"),
    );
    expect((updated.outbounds?.[0] as Record<string, unknown>).domain_resolver).toBeUndefined();
  });

  it("disconnect clears an endpoint and a dns-server source", () => {
    const config = {
      dns: {
        servers: [
          { type: "udp", tag: "boot", server: "1.1.1.1", server_port: 53 },
          { type: "https", tag: "doh", server: "dns.example.com", domain_resolver: "boot" },
        ],
      },
      endpoints: [{ type: "wireguard", tag: "wg", domain_resolver: "boot" }],
    } as unknown as SingBoxConfig;
    const afterEndpoint = disconnectEdge(config, formatEdgeId("endpoint-domain-resolver", "wg", "boot"));
    expect((afterEndpoint.endpoints?.[0] as Record<string, unknown>).domain_resolver).toBeUndefined();
    const afterServer = disconnectEdge(config, formatEdgeId("dns-server-domain-resolver", "doh", "boot"));
    expect((afterServer.dns?.servers?.[1] as Record<string, unknown>).domain_resolver).toBeUndefined();
  });

  describe("connectPorts writes the reference through canonical config", () => {
    beforeEach(() => {
      useProjectStore.getState().setChannel("stable");
    });

    it("sets domain_resolver (string) on the outbound source", () => {
      useProjectStore.getState().importJson(
        JSON.stringify({
          dns: { servers: [{ type: "udp", tag: "boot", server: "1.1.1.1", server_port: 53 }] },
          outbounds: [{ type: "trojan", tag: "px", server: "proxy.example.com", server_port: 443, password: "x" }],
        }),
      );
      useProjectStore.getState().connectPorts({
        source: "outbound:px",
        sourceHandle: "domain-resolver",
        target: "dns-server:boot",
        targetHandle: "domain-resolver-target",
      });
      const outbound = useProjectStore.getState().config.outbounds?.find((o) => o.tag === "px") as Record<string, unknown>;
      expect(outbound.domain_resolver).toBe("boot");
    });

    it("preserves an existing object form's sibling fields, updating only server", () => {
      useProjectStore.getState().importJson(
        JSON.stringify({
          dns: {
            servers: [
              { type: "udp", tag: "boot", server: "1.1.1.1", server_port: 53 },
              { type: "udp", tag: "boot2", server: "8.8.8.8", server_port: 53 },
            ],
          },
          outbounds: [
            { type: "trojan", tag: "px", server: "proxy.example.com", server_port: 443, password: "x", domain_resolver: { server: "boot", strategy: "prefer_ipv4" } },
          ],
        }),
      );
      useProjectStore.getState().connectPorts({
        source: "outbound:px",
        sourceHandle: "domain-resolver",
        target: "dns-server:boot2",
        targetHandle: "domain-resolver-target",
      });
      const outbound = useProjectStore.getState().config.outbounds?.find((o) => o.tag === "px") as Record<string, unknown>;
      expect(outbound.domain_resolver).toEqual({ server: "boot2", strategy: "prefer_ipv4" });
    });
  });
});
