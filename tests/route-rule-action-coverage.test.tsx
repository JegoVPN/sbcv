import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxChannel, SingBoxConfig } from "../src/domain/types";
import { useProjectStore } from "../src/state/useProjectStore";

function routeCodes(config: SingBoxConfig, channel: SingBoxChannel, version?: string) {
  return validateConfig(config, channel, version).map((d) => d.code);
}

// U6a — per-action coverage gaps in the route/DNS rule inspectors (route/rule_action.md, dns/rule_action.md):
//  - route `resolve` exposed only server+strategy; disable_cache/rewrite_ttl/client_subnet (1.12) and
//    timeout/disable_optimistic_cache (1.14) had no control.
//  - route `reject` Method offered only default/drop; `reply` (1.13, ICMP echo) was missing. Per upstream,
//    `reply` is ROUTE-only — DNS reject has just default/drop, so DNS must NOT grow a reply option.
//  - DNS `predefined` could set only rcode; answer/ns/extra lists had no control.
// New keys are registered in routeRule/dnsRulePrimaryFields so they never double-render in the Advanced
// JSON fallback. 1.14 fields are channel-gated in the UI (rendered on testing, or when already set).

function importRoute(rule: Record<string, unknown>) {
  useProjectStore.getState().importJson(JSON.stringify({ route: { rules: [rule] } }));
}
function importDns(rule: Record<string, unknown>) {
  useProjectStore.getState().importJson(JSON.stringify({ dns: { servers: [{ type: "local", tag: "local-dns" }], rules: [rule] } }));
}
const routeRule = () => useProjectStore.getState().config.route?.rules?.[0] as Record<string, unknown> | undefined;
const dnsRule = () => useProjectStore.getState().config.dns?.rules?.[0] as Record<string, unknown> | undefined;

function openRoute(rule: Record<string, unknown>, channel: "stable" | "testing" = "stable") {
  useProjectStore.getState().setChannel(channel);
  importRoute(rule);
  render(<App />);
  fireEvent.click(screen.getByTestId("node-route-rule:0"));
}
function openDns(rule: Record<string, unknown>, channel: "stable" | "testing" = "stable") {
  useProjectStore.getState().setChannel(channel);
  importDns(rule);
  render(<App />);
  fireEvent.click(screen.getByTestId("node-dns-rule:0"));
}

describe("U6a — route/DNS rule action coverage", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  describe("route resolve subfields", () => {
    it("edits the 1.12 resolve subfields (disable_cache / rewrite_ttl / client_subnet) on any channel", () => {
      openRoute({ inbound: ["in"], action: "resolve" });
      const cache = screen.getByLabelText(/Disable Cache/i) as HTMLInputElement;
      expect(cache.type).toBe("checkbox");
      fireEvent.click(cache);
      expect(routeRule()?.disable_cache).toBe(true);

      const ttl = screen.getByLabelText(/Rewrite TTL/i) as HTMLInputElement;
      fireEvent.change(ttl, { target: { value: "300" } });
      expect(routeRule()?.rewrite_ttl).toBe(300);

      const subnet = screen.getByLabelText(/Client Subnet/i) as HTMLInputElement;
      fireEvent.change(subnet, { target: { value: "192.168.0.0/24" } });
      expect(routeRule()?.client_subnet).toBe("192.168.0.0/24");
    });

    it("channel-gates the 1.14 resolve subfields (timeout / disable_optimistic_cache) to testing", () => {
      openRoute({ inbound: ["in"], action: "resolve" }, "stable");
      expect(screen.queryByLabelText(/Resolve Timeout/i)).toBeNull();
      expect(screen.queryByLabelText(/Disable Optimistic Cache/i)).toBeNull();
    });

    it("shows + edits the 1.14 resolve subfields on testing", () => {
      openRoute({ inbound: ["in"], action: "resolve" }, "testing");
      const timeout = screen.getByLabelText(/Resolve Timeout/i) as HTMLInputElement;
      fireEvent.change(timeout, { target: { value: "5s" } });
      expect(routeRule()?.timeout).toBe("5s");

      const opt = screen.getByLabelText(/Disable Optimistic Cache/i) as HTMLInputElement;
      fireEvent.click(opt);
      expect(routeRule()?.disable_optimistic_cache).toBe(true);
    });

    it("keeps an imported 1.14 resolve value editable even on stable (reachability)", () => {
      openRoute({ inbound: ["in"], action: "resolve", timeout: "5s" }, "stable");
      const timeout = screen.getByLabelText(/Resolve Timeout/i) as HTMLInputElement;
      expect(timeout.value).toBe("5s");
    });
  });

  describe("reject method reply (route-only, 1.13)", () => {
    it("offers a reply option on a route reject rule", () => {
      openRoute({ inbound: ["in"], action: "reject" });
      const method = screen.getByLabelText("Reject Method") as HTMLSelectElement;
      const values = Array.from(method.options).map((o) => o.value);
      expect(values).toContain("reply");
      fireEvent.change(method, { target: { value: "reply" } });
      expect(routeRule()?.method).toBe("reply");
    });

    it("does NOT offer reply on a DNS reject rule (DNS reject is default/drop only)", () => {
      openDns({ domain_suffix: ["cn"], action: "reject" });
      const method = screen.getByLabelText("Reject Method") as HTMLSelectElement;
      const values = Array.from(method.options).map((o) => o.value);
      expect(values).not.toContain("reply");
      expect(values).toEqual(["default", "drop"]);
    });
  });

  describe("DNS predefined answer/ns/extra", () => {
    it("edits the predefined record lists", () => {
      openDns({ domain_suffix: ["cn"], action: "predefined" });
      const answer = screen.getByLabelText(/Answer records/i) as HTMLInputElement;
      fireEvent.change(answer, { target: { value: "localhost. IN A 127.0.0.1" } });
      expect(dnsRule()?.answer).toEqual(["localhost. IN A 127.0.0.1"]);

      const ns = screen.getByLabelText(/Name server records/i) as HTMLInputElement;
      fireEvent.change(ns, { target: { value: "ns1.example. IN NS a." } });
      expect(dnsRule()?.ns).toEqual(["ns1.example. IN NS a."]);

      const extra = screen.getByLabelText(/Extra records/i) as HTMLInputElement;
      fireEvent.change(extra, { target: { value: "x. IN TXT hi" } });
      expect(dnsRule()?.extra).toEqual(["x. IN TXT hi"]);
    });
  });

  describe("no Advanced double-render", () => {
    it("renders each new resolve subfield exactly once (handled, not also in the JSON fallback)", () => {
      openRoute({ inbound: ["in"], action: "resolve", disable_cache: true, client_subnet: "10.0.0.0/8" }, "testing");
      expect(screen.getAllByLabelText(/Disable Cache/i)).toHaveLength(1);
      expect(screen.getAllByLabelText(/Client Subnet/i)).toHaveLength(1);
    });
  });

  // U6b — route-options subfields + tls_spoof/tls_spoof_method (route/rule_action.md).
  describe("route-options subfields (U6b)", () => {
    it("edits the base route-options subfields (udp_connect / udp_timeout / tls_record_fragment / tls_fragment_fallback_delay / fallback_network_type)", () => {
      openRoute({ inbound: ["in"], action: "route-options" });
      const udpConnect = screen.getByLabelText(/UDP Connect/i) as HTMLInputElement;
      expect(udpConnect.type).toBe("checkbox");
      fireEvent.click(udpConnect);
      expect(routeRule()?.udp_connect).toBe(true);

      fireEvent.change(screen.getByLabelText(/UDP Timeout/i), { target: { value: "5m" } });
      expect(routeRule()?.udp_timeout).toBe("5m");

      fireEvent.change(screen.getByLabelText(/TLS Record Fragment/i), { target: { value: "1" } });
      expect(routeRule()?.tls_record_fragment).toBe("1");

      fireEvent.change(screen.getByLabelText(/TLS Fragment Fallback Delay/i), { target: { value: "500ms" } });
      expect(routeRule()?.tls_fragment_fallback_delay).toBe("500ms");

      fireEvent.change(screen.getByLabelText(/Fallback Network Type/i), { target: { value: "wifi, cellular" } });
      expect(routeRule()?.fallback_network_type).toEqual(["wifi", "cellular"]);
    });

    it("channel-gates tls_spoof / tls_spoof_method to testing", () => {
      openRoute({ inbound: ["in"], action: "route-options" }, "stable");
      expect(screen.queryByLabelText(/TLS Spoof SNI/i)).toBeNull();
      expect(screen.queryByLabelText(/TLS Spoof Method/i)).toBeNull();
    });

    it("shows + edits tls_spoof / tls_spoof_method on testing", () => {
      openRoute({ inbound: ["in"], action: "route-options" }, "testing");
      fireEvent.change(screen.getByLabelText(/TLS Spoof SNI/i), { target: { value: "example.com" } });
      expect(routeRule()?.tls_spoof).toBe("example.com");

      const method = screen.getByLabelText(/TLS Spoof Method/i) as HTMLSelectElement;
      const values = Array.from(method.options).map((o) => o.value);
      expect(values).toEqual(["wrong-sequence", "wrong-checksum", "wrong-ack", "wrong-md5", "wrong-timestamp"]);
      fireEvent.change(method, { target: { value: "wrong-checksum" } });
      expect(routeRule()?.tls_spoof_method).toBe("wrong-checksum");
    });

    it("keeps an imported tls_spoof value editable on stable (reachability)", () => {
      openRoute({ inbound: ["in"], action: "route-options", tls_spoof: "example.com" }, "stable");
      expect((screen.getByLabelText(/TLS Spoof SNI/i) as HTMLInputElement).value).toBe("example.com");
    });

    it("flags tls_spoof / tls_spoof_method on a pre-1.14 target", () => {
      const GATE = "route-rule-tls-spoof-1-14-only";
      const config = { route: { rules: [{ inbound: ["in"], action: "route-options", tls_spoof: "example.com" }] } } as unknown as SingBoxConfig;
      expect(routeCodes(config, "stable", "1.13")).toContain(GATE);
      expect(routeCodes(config, "testing", "1.14")).not.toContain(GATE);
    });
  });
});
