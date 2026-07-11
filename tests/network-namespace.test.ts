import { describe, expect, it } from "vitest";

import {
  addNetworkNamespace,
  changeEntityType,
  deleteEntity,
  renameTag,
  updateEntityField,
} from "../src/domain/commands";
import { validateConfig } from "../src/domain/diagnostics";
import { dedupeTags } from "../src/domain/indexes";
import { PORT_NODE_KINDS } from "../src/domain/portRelationRegistry";
import { replaceRegisteredTagReferences } from "../src/domain/referenceRegistry";
import { normalizeConfig } from "../src/domain/serialization";
import type { SingBoxConfig } from "../src/domain/types";

function asConfig(value: unknown): SingBoxConfig {
  return value as SingBoxConfig;
}

function codes(config: SingBoxConfig, channel: "stable" | "testing" = "testing") {
  return validateConfig(config, channel).map((diagnostic) => diagnostic.code);
}

function referenceFixture(): SingBoxConfig {
  return asConfig({
    network_namespaces: [{ type: "default", tag: "managed", path: "/run/netns/managed" }],
    inbounds: [
      { type: "tun", tag: "tun", netns: "managed" },
      {
        type: "shadowtls",
        tag: "shadow",
        netns: "/run/netns/literal",
        tls: {
          reality: { handshake: { netns: "managed" } },
          certificate_provider: { type: "acme", http_client: { netns: "managed" } },
        },
        handshake: { netns: "managed" },
        handshake_for_server_name: { "example.com": { netns: "managed" } },
      },
      {
        type: "cloudflared",
        tag: "cloudflared",
        control_dialer: { netns: "managed" },
        tunnel_dialer: { netns: "managed" },
      },
      { type: "hysteria2", tag: "h2-in", realm: { http_client: { netns: "managed" } } },
    ],
    outbounds: [
      { type: "direct", tag: "direct", netns: "managed" },
      { type: "hysteria2", tag: "h2-out", realm: { http_client: { netns: "managed" } } },
    ],
    dns: { servers: [{ type: "udp", tag: "dns", netns: "managed" }] },
    endpoints: [{ type: "wireguard", tag: "endpoint", netns: "managed" }],
    services: [
      {
        type: "derp",
        tag: "derp",
        netns: "raw-listen-name",
        tls: {
          reality: { handshake: { netns: "managed" } },
          certificate_provider: { type: "acme", http_client: { netns: "managed" } },
        },
        mesh_with: [{ netns: "managed" }],
        verify_client_url: [{ netns: "managed" }],
      },
      {
        type: "api",
        tag: "api",
        netns: "managed",
        dashboard: { http_client: { netns: "managed" } },
      },
    ],
    ntp: { netns: "managed" },
    http_clients: [{ tag: "http", netns: "managed" }],
    route: {
      rule_set: [{ type: "remote", tag: "rules", http_client: { netns: "managed" } }],
    },
    certificate_providers: [
      { type: "acme", tag: "cert", http_client: { netns: "managed" } },
    ],
  });
}

function managedRefValues(config: SingBoxConfig): unknown[] {
  const inbounds = config.inbounds as Array<Record<string, any>>;
  const outbounds = config.outbounds as Array<Record<string, any>>;
  const services = config.services as Array<Record<string, any>>;
  return [
    inbounds[0]?.netns,
    inbounds[1]?.handshake?.netns,
    inbounds[1]?.tls?.reality?.handshake?.netns,
    inbounds[1]?.tls?.certificate_provider?.http_client?.netns,
    inbounds[1]?.handshake_for_server_name?.["example.com"]?.netns,
    inbounds[2]?.control_dialer?.netns,
    inbounds[2]?.tunnel_dialer?.netns,
    inbounds[3]?.realm?.http_client?.netns,
    outbounds[0]?.netns,
    outbounds[1]?.realm?.http_client?.netns,
    (config.dns?.servers?.[0] as Record<string, unknown>)?.netns,
    (config.endpoints?.[0] as Record<string, unknown>)?.netns,
    services[1]?.netns,
    services[0]?.tls?.reality?.handshake?.netns,
    services[0]?.tls?.certificate_provider?.http_client?.netns,
    services[0]?.mesh_with?.[0]?.netns,
    services[0]?.verify_client_url?.[0]?.netns,
    services[1]?.dashboard?.http_client?.netns,
    (config.ntp as Record<string, unknown>)?.netns,
    (config.http_clients?.[0] as Record<string, unknown>)?.netns,
    (config.route?.rule_set?.[0] as Record<string, any>)?.http_client?.netns,
    (config.certificate_providers?.[0] as Record<string, any>)?.http_client?.netns,
  ];
}

describe("sing-box 1.14 network namespace domain", () => {
  it("normalizes the top-level array shape and rejects a non-array", () => {
    const config = normalizeConfig({
      network_namespaces: [
        { type: "", tag: "empty", path: "/run/netns/empty" },
        { type: null, tag: "null", path: "/run/netns/null" },
      ],
    });
    expect(config.network_namespaces).toEqual([
      { type: "default", tag: "empty", path: "/run/netns/empty" },
      { type: "default", tag: "null", path: "/run/netns/null" },
    ]);
    expect(() => normalizeConfig({ network_namespaces: {} })).toThrow(
      'sing-box config field "network_namespaces" must be an array.',
    );
    expect(() => normalizeConfig({ network_namespaces: [null] })).toThrow(
      'sing-box config field "network_namespaces[0]" must be an object.',
    );
  });

  it("creates, uniquely tags, updates, and changes network namespace types", () => {
    const first = addNetworkNamespace({}, "default", "ns");
    expect(first.network_namespaces).toEqual([
      { type: "default", tag: "ns", path: "" },
    ]);
    const second = addNetworkNamespace(first, "unshare", "ns");
    expect(second.network_namespaces?.[1]).toEqual({ type: "unshare", tag: "ns-2" });

    const updated = updateEntityField(
      second,
      { kind: "network-namespace", tag: "ns" },
      "path",
      "/run/netns/custom",
    );
    expect(updated.network_namespaces?.[0]?.path).toBe("/run/netns/custom");
    const changed = changeEntityType(
      updated,
      { kind: "network-namespace", tag: "ns" },
      "unshare",
    );
    expect(changed.network_namespaces?.[0]).toEqual({ type: "unshare", tag: "ns" });
    expect(PORT_NODE_KINDS).toContain("network-namespace");
  });

  it("renames every documented managed Listen/Dial/TUN reference and preserves literals", () => {
    const next = renameTag(referenceFixture(), "network-namespace", "managed", "renamed");
    expect(next.network_namespaces?.[0]?.tag).toBe("renamed");
    expect(managedRefValues(next)).toEqual(Array(22).fill("renamed"));
    expect((next.inbounds?.[1] as Record<string, unknown>).netns).toBe("/run/netns/literal");
    expect((next.services?.[0] as Record<string, unknown>).netns).toBe("raw-listen-name");
  });

  it("deletes every managed reference and preserves literals", () => {
    const next = deleteEntity(referenceFixture(), { kind: "network-namespace", tag: "managed" });
    expect(next.network_namespaces).toBeUndefined();
    expect(managedRefValues(next)).toEqual(Array(22).fill(undefined));
    expect((next.inbounds?.[1] as Record<string, unknown>).netns).toBe("/run/netns/literal");
    expect((next.services?.[0] as Record<string, unknown>).netns).toBe("raw-listen-name");
  });

  it("does not rewrite an unresolved raw netns name or path", () => {
    const config = asConfig({
      inbounds: [{ type: "mixed", tag: "in", netns: "literal" }],
      outbounds: [{ type: "direct", tag: "out", netns: "literal" }],
      ntp: { netns: "/run/netns/literal" },
    });
    replaceRegisteredTagReferences(config, "literal", "changed");
    expect(config.inbounds?.[0]?.netns).toBe("literal");
    expect(config.outbounds?.[0]?.netns).toBe("literal");
    expect((config.ntp as Record<string, unknown>).netns).toBe("/run/netns/literal");
  });

  it("repairs missing and duplicate required network namespace tags on import", () => {
    const config = asConfig({
      network_namespaces: [
        { type: "default", tag: "", path: "/run/netns/a" },
        { type: "default", tag: "netns", path: "/run/netns/b" },
      ],
    });
    expect(dedupeTags(config)).toEqual({ assigned: 1, renamed: 1 });
    expect(config.network_namespaces?.map((namespace) => namespace.tag)).toEqual([
      "netns",
      "netns-2",
    ]);
  });
});

describe("network namespace diagnostics", () => {
  it("blocks the top-level collection and TUN netns on stable", () => {
    const config = asConfig({
      network_namespaces: [{ type: "default", tag: "ns", path: "/run/netns/ns" }],
      inbounds: [{ type: "tun", tag: "tun", netns: "raw-name" }],
    });
    expect(codes(config, "stable")).toEqual(
      expect.arrayContaining(["network-namespaces-testing-only", "tun-netns-testing-only"]),
    );
  });

  it("removes the testing-only field when the last namespace is deleted before switching to stable", () => {
    const config = asConfig({
      network_namespaces: [{ type: "default", tag: "ns", path: "/run/netns/ns" }],
    });
    const next = deleteEntity(config, { kind: "network-namespace", tag: "ns" });
    expect(next.network_namespaces).toBeUndefined();
    expect(codes(next, "stable")).not.toContain("network-namespaces-testing-only");
    expect(codes(asConfig({ network_namespaces: [] }), "stable")).toContain(
      "network-namespaces-testing-only",
    );
    expect(normalizeConfig({ network_namespaces: [] }).network_namespaces).toBeUndefined();
  });

  it("requires unique nonblank tags and a path for the default type", () => {
    const config = asConfig({
      network_namespaces: [
        { type: "default", tag: "", path: "" },
        { type: "default", tag: "dup", path: "/run/netns/a" },
        { type: "unshare", tag: "dup" },
      ],
    });
    expect(codes(config)).toEqual(
      expect.arrayContaining(["entity-missing-tag", "duplicate-tag", "missing-required-field"]),
    );
  });

  it("accepts an omitted type as default and rejects undocumented types", () => {
    const valid = asConfig({
      network_namespaces: [
        { tag: "implicit", path: "/run/netns/implicit" },
        { type: null, tag: "null-default", path: "/run/netns/null" },
        { type: "unshare", tag: "rootless" },
      ],
    });
    expect(codes(valid)).not.toContain("network-namespace-type-invalid");
    expect(codes(valid)).not.toContain("missing-required-field");
    expect(codes(asConfig({ network_namespaces: [{ type: "other", tag: "bad" }] }))).toContain(
      "network-namespace-type-invalid",
    );
  });

  it("validates per-type scalar shapes and rejects fields from the other type", () => {
    const config = asConfig({
      network_namespaces: [
        { type: "default", tag: "default", path: 42, pid_file: "/tmp/pid" },
        { type: "unshare", tag: "unshare", pid_file: false, path: "/run/netns/x" },
      ],
    });
    const diagnostics = validateConfig(config, "testing");
    expect(diagnostics.filter((item) => item.code === "type-invalid").map((item) => item.path)).toEqual([
      "/network_namespaces/0/path",
      "/network_namespaces/1/pid_file",
    ]);
    expect(diagnostics.filter((item) => item.code === "unknown-field").map((item) => item.path)).toEqual([
      "/network_namespaces/0/pid_file",
      "/network_namespaces/1/path",
    ]);
  });

  it("strictly validates omitted and empty default types", () => {
    const diagnostics = validateConfig(
      asConfig({
        network_namespaces: [
          { tag: "implicit", path: "blue", pid_file: "/tmp/not-default.pid" },
          { type: "", tag: "empty-default" },
        ],
      }),
      "testing",
    );
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unknown-field", path: "/network_namespaces/0/pid_file" }),
        expect.objectContaining({ code: "missing-required-field", path: "/network_namespaces/1/path" }),
      ]),
    );
  });

  it("reports the documented TUN netns/platform conflict", () => {
    const config = asConfig({
      inbounds: [{ type: "tun", tag: "tun", netns: "ns", platform: {} }],
    });
    expect(codes(config)).toContain("tun-netns-platform-conflict");
  });

  it("rejects a non-string TUN netns like the alpha.43 decoder", () => {
    const diagnostics = validateConfig(
      asConfig({ inbounds: [{ type: "tun", tag: "tun", netns: 42 }] }),
      "testing",
    );
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: "type-invalid", path: "/inbounds/0/netns" }),
    );
  });

  it("accepts null namespace defaults and a null TUN netns like the alpha.43 decoder", () => {
    const diagnostics = validateConfig(
      asConfig({
        network_namespaces: [{ type: null, tag: "ns", path: "/run/netns/ns" }],
        inbounds: [{ type: "tun", tag: "tun", netns: null }],
      }),
      "testing",
    );
    expect(diagnostics).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "network-namespace-type-invalid" })]),
    );
    expect(diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "type-invalid", path: "/inbounds/0/netns" }),
      ]),
    );
  });

  it("warns only when a Dial owner resolves netns to a managed unshare resource", () => {
    const config = asConfig({
      network_namespaces: [
        { type: "unshare", tag: "isolated" },
        { type: "default", tag: "existing", path: "/run/netns/existing" },
      ],
      outbounds: [
        { type: "direct", tag: "warn", netns: "isolated" },
        { type: "direct", tag: "raw", netns: "raw-name" },
        { type: "direct", tag: "default", netns: "existing" },
      ],
      inbounds: [
        { type: "tun", tag: "tun", netns: "isolated" },
        { type: "mixed", tag: "listen", netns: "isolated" },
        {
          type: "vless",
          tag: "reality-server",
          tls: {
            reality: { handshake: { netns: "isolated" } },
            certificate_provider: { type: "acme", http_client: { netns: "isolated" } },
          },
        },
      ],
      services: [
        {
          type: "api",
          tag: "api",
          netns: "isolated",
          tls: { certificate_provider: { type: "acme", http_client: { netns: "isolated" } } },
        },
      ],
    });
    const warnings = validateConfig(config, "testing").filter(
      (diagnostic) => diagnostic.code === "network-namespace-unshare-dial",
    );
    expect(warnings.map((warning) => warning.path)).toEqual([
      "/outbounds/0/netns",
      "/inbounds/2/tls/reality/handshake/netns",
      "/inbounds/2/tls/certificate_provider/http_client/netns",
      "/services/0/tls/certificate_provider/http_client/netns",
    ]);
    expect(warnings[0]?.level).toBe("warning");
  });

  it("does not flag a cleared undefined TUN netns field as testing-only", () => {
    const config = asConfig({ inbounds: [{ type: "tun", tag: "tun", netns: undefined }] });
    expect(codes(config, "stable")).not.toContain("tun-netns-testing-only");
  });
});
