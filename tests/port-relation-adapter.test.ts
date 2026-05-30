import { describe, expect, it } from "vitest";

import { adapterConnect, adapterDisconnect, adapterIsConnected } from "../src/domain/portReferenceAdapter";
import { relationForId } from "../src/domain/portRelationRegistry";
import type { PortRelation } from "../src/domain/portRelationRegistry";
import type { SingBoxConfig } from "../src/domain/types";

// C13 — the registry-driven adapter behind connect/disconnect (and, in the read slice, isPortConnected).
// connectDirectedPortReference / disconnectEdge now delegate here; the symmetry suites
// (port-interaction-symmetry / port-disconnect-symmetry) are the broad behaviour lock. This adds direct
// adapter coverage across the reference shapes it interprets from canonicalPath: tag-bound scalar,
// index-bound tag-array, singleton, a gated relation, and a bespoke (string|object) one.

const rel = (id: string): PortRelation => relationForId(id)!;
const node = (kind: string, value: string) => ({ kind, value });

describe("C13 — port reference adapter", () => {
  it("connects + disconnects a tag-bound scalar (outbound-detour) via canonicalPath", () => {
    const config = { outbounds: [{ type: "direct", tag: "a" }, { type: "direct", tag: "b" }] } as unknown as SingBoxConfig;
    const connected = adapterConnect(config, rel("outbound-detour"), node("outbound", "a"), node("outbound", "b"));
    expect(connected?.outbounds?.find((o) => o.tag === "a")?.detour).toBe("b");
    const cleared = structuredClone(connected!);
    adapterDisconnect(cleared, "outbound-detour", ["a", "b"]);
    expect(cleared.outbounds?.find((o) => o.tag === "a")?.detour).toBeUndefined();
  });

  it("connects an index-bound tag-array (route-rule-inbound) with normalizing addTagRef", () => {
    const config = { inbounds: [{ type: "tun", tag: "in" }], route: { rules: [{}] } } as unknown as SingBoxConfig;
    const connected = adapterConnect(config, rel("route-rule-inbound"), node("inbound", "in"), node("route-rule", "0"));
    expect(connected?.route?.rules?.[0]?.inbound).toBe("in"); // single ref normalizes to a scalar string
    const cleared = structuredClone(connected!);
    adapterDisconnect(cleared, "route-rule-inbound", ["0", "in"]);
    expect(cleared.route?.rules?.[0]?.inbound).toBeUndefined();
  });

  it("connects a singleton (route-final) and disconnects it", () => {
    const config = { route: {}, outbounds: [{ type: "direct", tag: "x" }] } as unknown as SingBoxConfig;
    const connected = adapterConnect(config, rel("route-final"), node("route", "main"), node("outbound", "x"));
    expect(connected?.route?.final).toBe("x");
    const cleared = structuredClone(connected!);
    adapterDisconnect(cleared, "route-final", ["x"]);
    expect(cleared.route?.final).toBeUndefined();
  });

  it("honours the action gate: a reject route rule cannot take an outbound", () => {
    const config = { route: { rules: [{ action: "reject" }] }, outbounds: [{ type: "direct", tag: "x" }] } as unknown as SingBoxConfig;
    expect(adapterConnect(config, rel("route-rule"), node("route-rule", "0"), node("outbound", "x"))).toBeNull();
  });

  it("honours the dial-group gate: a legacy dns-server cannot take a detour (relationForHandles omits legacy)", () => {
    const config = { dns: { servers: [{ type: "legacy", tag: "lg", address: "8.8.8.8" }] }, outbounds: [{ type: "direct", tag: "x" }] } as unknown as SingBoxConfig;
    expect(adapterConnect(config, rel("dns-server-detour"), node("dns-server", "lg"), node("outbound", "x"))).toBeNull();
  });

  it("connects/disconnects the bespoke string|object domain_resolver, preserving object siblings", () => {
    const config = {
      dns: { servers: [{ type: "udp", tag: "boot", server: "1.1.1.1" }] },
      outbounds: [{ type: "trojan", tag: "px", server: "e.com", domain_resolver: { server: "old", strategy: "prefer_ipv4" } }],
    } as unknown as SingBoxConfig;
    const connected = adapterConnect(config, rel("dial-domain-resolver"), node("outbound", "px"), node("dns-server", "boot"));
    expect((connected?.outbounds?.[0] as Record<string, unknown>).domain_resolver).toEqual({ server: "boot", strategy: "prefer_ipv4" });
    const cleared = structuredClone(connected!);
    adapterDisconnect(cleared, "dial-domain-resolver", ["px", "boot"]);
    expect((cleared.outbounds?.[0] as Record<string, unknown>).domain_resolver).toBeUndefined();
  });

  describe("adapterIsConnected (read path)", () => {
    const cfg = {
      route: { final: "px", rules: [{ inbound: "tun-in", outbound: "direct" }] },
      inbounds: [{ type: "tun", tag: "tun-in" }],
      outbounds: [{ type: "trojan", tag: "px", server: "e.com" }, { type: "direct", tag: "direct" }],
    } as unknown as SingBoxConfig;

    it("forward: route's outbound output lights when route.final is set", () => {
      expect(adapterIsConnected(cfg, "route", "route", "main", "output", "outbound", "stable")).toBe(true);
    });
    it("reverse: an outbound's route input lights only for the route.final target", () => {
      expect(adapterIsConnected(cfg, "outbound", "trojan", "px", "input", "route", "stable")).toBe(true);
      expect(adapterIsConnected(cfg, "outbound", "direct", "direct", "input", "route", "stable")).toBe(false);
    });
    it("matcher reverse: an inbound's route-rule-match output lights when a rule references it", () => {
      expect(adapterIsConnected(cfg, "inbound", "tun", "tun-in", "output", "route-rule-match", "stable")).toBe(true);
    });
    it("matcher forward: a route-rule's inbound input lights when the rule has an inbound", () => {
      expect(adapterIsConnected(cfg, "route-rule", "route-rule", "0", "input", "inbound", "stable")).toBe(true);
    });
    it("returns undefined for a non-writable (readonly/hub) port so the caller falls through", () => {
      expect(adapterIsConnected(cfg, "route-rule", "route-rule", "0", "input", "route", "stable")).toBeUndefined();
      expect(adapterIsConnected(cfg, "route", "route", "main", "output", "route-rule", "stable")).toBeUndefined();
    });
    it("legacy parity: an empty rule tag-array (inbound: []) keeps the dot lit; service verify [] is dark", () => {
      // The index-bound rule fields used Boolean() pre-refactor (empty array is truthy → lit), while the
      // tag-bound service verify_client_endpoint used a length check (empty → dark). Both reachable by
      // disconnecting the last ref (commands' removeTagRef leaves an empty array).
      const ruleEmpty = { route: { rules: [{ inbound: [] }] } } as unknown as SingBoxConfig;
      expect(adapterIsConnected(ruleEmpty, "route-rule", "route-rule", "0", "input", "inbound", "stable")).toBe(true);
      const verifyEmpty = { services: [{ type: "derp", tag: "d", verify_client_endpoint: [] }] } as unknown as SingBoxConfig;
      expect(adapterIsConnected(verifyEmpty, "service", "derp", "d", "output", "verify-client-endpoint", "stable")).toBe(false);
    });

    it("channel-gates http_client: a stable target never lights the http-client-ref input", () => {
      const withHttp = { route: { default_http_client: "hc" }, http_clients: [{ tag: "hc" }] } as unknown as SingBoxConfig;
      expect(adapterIsConnected(withHttp, "http-client", "http-client", "hc", "input", "http-client-ref", "testing")).toBe(true);
      expect(adapterIsConnected(withHttp, "http-client", "http-client", "hc", "input", "http-client-ref", "stable")).toBe(false);
    });
  });
});
