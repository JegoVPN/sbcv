import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveGraph } from "../src/canvas/graph";
import {
  addDnsRule,
  addDnsServer,
  addEndpoint,
  addInbound,
  addOutbound,
  addRouteRule,
  addRuleSet,
  addService,
  changeEntityType,
  createMinimalConfig,
  ensureRoute,
  updateDnsRule,
  updateEntityField,
  updateRouteRule,
} from "../src/domain/commands";
import {
  CREATABLE_DNS_SERVER_TYPES,
  CREATABLE_ENDPOINT_TYPES,
  CREATABLE_INBOUND_TYPES,
  CREATABLE_OUTBOUND_TYPES,
  CREATABLE_RULE_SET_TYPES,
  CREATABLE_SERVICE_TYPES,
  preferredDnsServerTag,
  preferredEndpointTag,
  preferredInboundTag,
  preferredOutboundTag,
  preferredRuleSetTag,
  preferredServiceTag,
} from "../src/domain/protocols";
import { SHARED_DOC_PLACEMENTS, sharedDocPlacementFor, sharedGroupsForEntity } from "../src/domain/sharedFieldRegistry";
import type { EntityRef, SingBoxConfig } from "../src/domain/types";
import { getPortSpecs } from "../src/components/SbcNode";

const repoRoot = process.cwd();
const testingDocsDir = join(repoRoot, ".tmp/sing-box-docs/testing/docs/configuration");
const matrixPath = join(repoRoot, "docs/sing-box-doc-readthrough-matrix.md");
const palettePath = join(repoRoot, "src/components/Palette.tsx");
const emptyLayout = { positions: {} };

function walkMarkdown(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkMarkdown(absolute));
      continue;
    }
    if (!entry.name.endsWith(".md") || entry.name.endsWith(".zh.md")) continue;
    result.push(relative(testingDocsDir, absolute).replaceAll("\\", "/"));
  }
  return result.sort((a, b) => a.localeCompare(b));
}

function parseMatrix(markdown: string) {
  const rows = new Map<string, { channel: string; className: string; implementation: string }>();
  const start = markdown.indexOf("## Full English Doc Matrix");
  const end = markdown.indexOf("## Addability And UI Semantics");
  const section = start >= 0 && end > start ? markdown.slice(start, end) : markdown;
  const rowRegex = /^\| `([^`]+)` \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(section))) {
    const [doc, channel, className, implementation] = match.slice(1);
    if (!doc || !channel || !className || !implementation) throw new Error(`Invalid matrix row: ${match[0]}`);
    rows.set(doc, {
      channel: channel.trim(),
      className: className.trim(),
      implementation: implementation.trim(),
    });
  }
  return rows;
}

function normalizeDocsPath(urlPath: string, officialSet: Set<string>) {
  const clean = urlPath.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!clean) return "index.md";
  const indexDoc = `${clean}/index.md`;
  if (officialSet.has(indexDoc)) return indexDoc;
  return `${clean}.md`;
}

function explicitStatus(rest: string) {
  const status = rest.match(/status:\s*"([^"]+)"/)?.[1];
  if (status) return status;
  if (/ready:\s*true/.test(rest)) return "add";
  return "docs";
}

function parsePalette(tsx: string, officialSet: Set<string>) {
  const entries: Array<{ label: string; kind: string; doc: string; status: string }> = [];
  const itemRegex =
    /\{\s*label:\s*"([^"]+)",\s*kind:\s*"([^"]+)",\s*icon:\s*[A-Za-z0-9_]+,\s*docsUrl:\s*docs\((?:"([^"]*)")?\)([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(tsx))) {
    const [label, kind] = match.slice(1);
    if (!label || !kind) throw new Error(`Invalid palette entry: ${match[0]}`);
    entries.push({
      label,
      kind,
      doc: normalizeDocsPath(match[3] ?? "", officialSet),
      status: explicitStatus(match[4] ?? ""),
    });
  }
  return entries;
}

function docsByPalette<T extends { doc: string }>(entries: T[]) {
  const byDoc = new Map<string, T[]>();
  for (const entry of entries) {
    byDoc.set(entry.doc, [...(byDoc.get(entry.doc) ?? []), entry]);
  }
  return byDoc;
}

function docForDnsServerType(type: string) {
  return type === "h3" ? "dns/server/http3.md" : `dns/server/${type}.md`;
}

function supportsDialDetour(type: string) {
  return !["block", "selector", "urltest", "dns"].includes(type);
}

function assertNode(config: SingBoxConfig, id: string, type: string) {
  const node = deriveGraph(config, emptyLayout, []).nodes.find((item) => item.id === id);
  expect(node?.data.type).toBe(type);
  return node;
}

function addDirectDetour(config: SingBoxConfig) {
  return addOutbound(config, "direct", "detour-out");
}

function assertTag(tag: string | undefined, context: string): string {
  if (!tag) throw new Error(`Missing tag for ${context}`);
  return tag;
}

const docs = existsSync(testingDocsDir) ? walkMarkdown(testingDocsDir) : [];
const officialSet = new Set(docs);
const matrixRows = parseMatrix(readFileSync(matrixPath, "utf8"));
const paletteEntries = parsePalette(readFileSync(palettePath, "utf8"), officialSet);
const paletteByDoc = docsByPalette(paletteEntries);
const allowedStatuses = new Set(["add", "setup", "table", "inspector", "docs", "gated", "pending"]);
const baseDocsWithoutDirectPalette = new Set([
  "index.md",
  "dns/server/index.md",
  "dns/rule_action.md",
  "endpoint/index.md",
  "inbound/index.md",
  "outbound/index.md",
  "service/index.md",
]);

const smokeCoveredDocs = new Set<string>([
  "index.md",
  "log/index.md",
  "ntp/index.md",
  "certificate/index.md",
  "experimental/index.md",
  "experimental/cache-file.md",
  "experimental/clash-api.md",
  "experimental/v2ray-api.md",
  "dns/index.md",
  "dns/rule.md",
  "dns/rule_action.md",
  "route/index.md",
  "route/rule.md",
  "route/rule_action.md",
  "rule-set/index.md",
  "shared/pre-match.md",
  "shared/wifi-state.md",
  ...CREATABLE_INBOUND_TYPES.map((type) => `inbound/${type}.md`),
  ...CREATABLE_OUTBOUND_TYPES.map((type) => `outbound/${type}.md`),
  ...CREATABLE_DNS_SERVER_TYPES.map(docForDnsServerType),
  ...CREATABLE_ENDPOINT_TYPES.map((type) => `endpoint/${type}.md`),
  ...CREATABLE_SERVICE_TYPES.map((type) => `service/${type}.md`),
  // A22: http_clients[] is now a creatable top-level node (smoke: tests/http-client-create.test.tsx).
  "shared/http-client.md",
]);

describe("official sing-box config docs are mapped one by one", () => {
  it("has a local testing docs checkout for per-doc tests", () => {
    expect(existsSync(testingDocsDir)).toBe(true);
    expect(docs.length).toBeGreaterThanOrEqual(100);
  });

  it.each(docs)("%s has an explicit SBC UI contract", (doc) => {
    const matrixRow = matrixRows.get(doc);
    expect(matrixRow, `missing matrix row for ${doc}`).toBeDefined();
    expect(matrixRow?.implementation, `empty implementation for ${doc}`).toMatch(/\S/);

    const entries = paletteByDoc.get(doc) ?? [];
    if (!entries.length) {
      expect(baseDocsWithoutDirectPalette.has(doc), `missing palette surface for ${doc}`).toBe(true);
      return;
    }
    entries.forEach((entry) => {
      expect(allowedStatuses.has(entry.status), `invalid palette status for ${doc}`).toBe(true);
    });
  });

  it.each(docs.filter((doc) => doc.startsWith("shared/")))("%s has concrete host placement", (doc) => {
    const placement = sharedDocPlacementFor(doc);
    expect(placement, `missing shared placement for ${doc}`).toBeDefined();
    expect(placement?.owners.length, `missing shared owners for ${doc}`).toBeGreaterThan(0);
    expect(placement?.mode, `missing shared mode for ${doc}`).toMatch(/\S/);
  });

  it("requires every writable or table-backed doc to have operational smoke coverage", () => {
    const missing = paletteEntries
      .filter((entry) => entry.status === "add" || entry.status === "setup" || entry.status === "table")
      .map((entry) => entry.doc)
      .filter((doc) => !smokeCoveredDocs.has(doc));

    expect([...new Set(missing)].sort()).toEqual([]);
  });
});

describe("shared field docs attach only to valid parent objects", () => {
  it("maps every shared config doc to a non-node owner instead of a fake standalone node", () => {
    const sharedDocs = docs.filter((doc) => doc.startsWith("shared/"));
    expect(SHARED_DOC_PLACEMENTS.map((placement) => placement.doc).sort()).toEqual(sharedDocs.sort());
  });

  it.each(CREATABLE_INBOUND_TYPES)("inbound/%s shared sections follow the official doc links", (type) => {
    const groups = sharedGroupsForEntity({ kind: "inbound", tag: "in" }, type);
    expect(groups).toContain("listen");
    if (["http", "naive", "hysteria", "hysteria2", "tuic", "anytls", "vmess", "trojan", "vless"].includes(type)) {
      expect(groups).toContain("tls");
    }
    if (["hysteria", "hysteria2", "tuic"].includes(type)) expect(groups).toContain("quic");
    if (["shadowsocks", "vmess", "trojan", "vless"].includes(type)) {
      expect(groups).toEqual(expect.arrayContaining(["multiplex", "tcp-brutal"]));
    }
    if (["vmess", "trojan", "vless"].includes(type)) expect(groups).toContain("v2ray-transport");
    if (type === "shadowtls") expect(groups).toContain("dial");
  });

  it.each(CREATABLE_OUTBOUND_TYPES)("outbound/%s shared sections follow the official doc links", (type) => {
    const groups = sharedGroupsForEntity({ kind: "outbound", tag: "out" }, type);
    if (["block", "selector", "urltest"].includes(type)) {
      expect(groups).not.toContain("dial");
    } else {
      expect(groups).toContain("dial");
    }
    if (["http", "naive", "hysteria", "hysteria2", "shadowtls", "tuic", "anytls", "vmess", "trojan", "vless"].includes(type)) {
      expect(groups).toContain("tls");
    }
    if (["hysteria", "hysteria2", "tuic"].includes(type)) expect(groups).toContain("quic");
    if (["socks", "shadowsocks", "naive"].includes(type)) expect(groups).toContain("udp-over-tcp");
    if (type === "tuic") expect(groups).not.toContain("udp-over-tcp"); // TUIC uses udp_over_stream, not udp_over_tcp
    if (["shadowsocks", "vmess", "trojan", "vless"].includes(type)) {
      expect(groups).toEqual(expect.arrayContaining(["multiplex", "tcp-brutal"]));
    }
    if (["vmess", "trojan", "vless"].includes(type)) expect(groups).toContain("v2ray-transport");
  });

  it.each(CREATABLE_DNS_SERVER_TYPES)("%s DNS server shared sections follow the official doc links", (type) => {
    const groups = sharedGroupsForEntity({ kind: "dns-server", tag: "server" }, type);
    if (["hosts", "fakeip", "tailscale", "resolved"].includes(type)) {
      expect(groups).not.toContain("dial");
    } else {
      expect(groups).toContain("dial");
    }
    if (["tls", "quic", "https", "h3"].includes(type)) expect(groups).toContain("tls");
    if (type === "local") expect(groups).toContain("neighbor");
  });

  it("maps route, rule, endpoint, NTP, and rule-set shared fields to their owners", () => {
    expect(sharedGroupsForEntity({ kind: "route", id: "main" }, "route")).toEqual(["dial", "http-client", "neighbor"]);
    expect(sharedGroupsForEntity({ kind: "route-rule", index: 0 }, "route-rule")).toEqual(["pre-match", "wifi-state", "neighbor"]);
    expect(sharedGroupsForEntity({ kind: "dns-rule", index: 0 }, "dns-rule")).toEqual(["wifi-state", "neighbor"]);
    expect(sharedGroupsForEntity({ kind: "endpoint", tag: "wg" }, "wireguard")).toEqual(["dial"]);
    expect(sharedGroupsForEntity({ kind: "service", tag: "derp" }, "derp")).toEqual(["listen", "tls"]);
    expect(sharedGroupsForEntity({ kind: "service", tag: "resolved" }, "resolved")).toEqual(["listen"]);
    expect(sharedGroupsForEntity({ kind: "service", tag: "realm" }, "hysteria-realm")).toEqual(["listen", "tls", "http2"]);
    expect(sharedGroupsForEntity({ kind: "settings", path: "ntp" }, null)).toEqual(["dial"]);
    expect(sharedGroupsForEntity({ kind: "rule-set", tag: "remote" }, "remote")).toEqual(["http-client"]);
  });

  it("hides testing-only shared groups (http-client / neighbor) on stable channel", () => {
    expect(sharedGroupsForEntity({ kind: "route", id: "main" }, "route", "stable")).toEqual(["dial"]);
    expect(sharedGroupsForEntity({ kind: "route-rule", index: 0 }, "route-rule", "stable")).toEqual(["pre-match", "wifi-state"]);
    expect(sharedGroupsForEntity({ kind: "dns-rule", index: 0 }, "dns-rule", "stable")).toEqual(["wifi-state"]);
  });
});

describe("implemented docs create editable nodes and references", () => {
  it.each(CREATABLE_INBOUND_TYPES)("inbound/%s.md creates a source node with route/DNS rule outputs", (type) => {
    let config = addInbound(createMinimalConfig(), type, preferredInboundTag(type));
    config = ensureRoute(config);
    const tag = assertTag(config.inbounds?.at(-1)?.tag, `inbound/${type}`);
    assertNode(config, `inbound:${tag}`, type);
    const expectedOutputKinds = ["route", "route-rule", "dns-rule"];
    if (type === "shadowsocks") expectedOutputKinds.push("service");
    expect(getPortSpecs("inbound", type, "output").map((port) => port.nodeKind)).toEqual([
      ...expectedOutputKinds,
    ]);

    config = updateEntityField(config, { kind: "inbound", tag }, "listen_port", 2099);
    expect(config.inbounds?.find((inbound) => inbound.tag === tag)?.listen_port).toBe(2099);

    const alternateType = type === "tun" ? "mixed" : "tun";
    config = changeEntityType(config, { kind: "inbound", tag }, alternateType);
    expect(config.inbounds?.find((inbound) => inbound.tag === tag)?.type).toBe(alternateType);
  });

  it.each(CREATABLE_OUTBOUND_TYPES)("outbound/%s.md creates a target node with upstream/downstream refs", (type) => {
    let config = addOutbound(createMinimalConfig(), type, preferredOutboundTag(type));
    const tag = assertTag(config.outbounds?.at(-1)?.tag, `outbound/${type}`);
    assertNode(config, `outbound:${tag}`, type);
    expect(getPortSpecs("outbound", type, "input").map((port) => port.key)).toContain("route");
    expect(getPortSpecs("outbound", type, "input").map((port) => port.key)).toContain("route-rule");

    config = ensureRoute(config);
    config = addRouteRule(config, { domain_suffix: ["example"], outbound: tag });
    expect(deriveGraph(config, emptyLayout, []).edges.some((edge) => edge.target === `outbound:${tag}`)).toBe(true);

    config = updateEntityField(config, { kind: "outbound", tag }, "server", "127.0.0.1");
    expect(config.outbounds?.find((outbound) => outbound.tag === tag)?.server).toBe("127.0.0.1");

    if (type === "selector" || type === "urltest") {
      config = addOutbound(config, "direct", "candidate-out");
      config = updateEntityField(config, { kind: "outbound", tag }, "outbounds", ["candidate-out"]);
      expect(deriveGraph(config, emptyLayout, []).edges.some((edge) => edge.source === `outbound:${tag}`)).toBe(true);
    } else if (supportsDialDetour(type)) {
      config = addDirectDetour(config);
      config = updateEntityField(config, { kind: "outbound", tag }, "detour", "detour-out");
      expect(deriveGraph(config, emptyLayout, []).edges.some((edge) => edge.id.includes("outbound-detour"))).toBe(true);
    }

    const alternateType = type === "direct" ? "socks" : "direct";
    config = changeEntityType(config, { kind: "outbound", tag }, alternateType);
    expect(config.outbounds?.find((outbound) => outbound.tag === tag)?.type).toBe(alternateType);
  });

  it.each(CREATABLE_DNS_SERVER_TYPES)("%s DNS server doc creates editable server nodes and DNS refs", (type) => {
    let config = addDnsServer(createMinimalConfig(), type, preferredDnsServerTag(type));
    const tag = assertTag(config.dns?.servers?.at(-1)?.tag, `dns/server/${type}`);
    config = updateEntityField(config, { kind: "dns-server", tag }, "address", "8.8.8.8");
    assertNode(config, `dns-server:${tag}`, type);
    expect(config.dns?.servers?.find((server) => server.tag === tag)?.address).toBe("8.8.8.8");

    config = updateEntityField(config, { kind: "dns", id: "main" }, "final", tag);
    expect(deriveGraph(config, emptyLayout, []).edges.some((edge) => edge.id === `edge:dns-final:${tag}`)).toBe(true);

    if (type === "tailscale") {
      config = addEndpoint(config, "tailscale", "ts-ep");
      config = updateEntityField(config, { kind: "dns-server", tag }, "endpoint", "ts-ep");
      expect(deriveGraph(config, emptyLayout, []).edges.some((edge) => edge.id.includes("dns-server-endpoint"))).toBe(true);
    }

    const alternateType = type === "local" ? "https" : "local";
    config = changeEntityType(config, { kind: "dns-server", tag }, alternateType);
    expect(config.dns?.servers?.find((server) => server.tag === tag)?.type).toBe(alternateType);
  });

  it.each(CREATABLE_SERVICE_TYPES)("service/%s.md creates editable service nodes and refs", (type) => {
    let config = addService(createMinimalConfig(), type, preferredServiceTag(type));
    const tag = assertTag(config.services?.at(-1)?.tag, `service/${type}`);
    assertNode(config, `service:${tag}`, type);

    config = updateEntityField(config, { kind: "service", tag }, "listen_port", 19090);
    expect(config.services?.find((service) => service.tag === tag)?.listen_port).toBe(19090);

    if (type === "ssm-api") {
      const service = config.services?.find((item) => item.tag === tag);
      const inboundTag = Object.values(service?.servers ?? {})[0];
      expect(config.inbounds?.find((inbound) => inbound.tag === inboundTag)?.managed).toBe(true);
      expect(deriveGraph(config, emptyLayout, []).edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: `inbound:${inboundTag}`,
            target: `service:${tag}`,
            sourceHandle: "service",
            targetHandle: "managed-inbound",
          }),
        ]),
      );
    }

    if (type === "derp") {
      config = addEndpoint(config, "tailscale", "ts-ep");
      config = updateEntityField(config, { kind: "service", tag }, "verify_client_endpoint", "ts-ep");
      expect(deriveGraph(config, emptyLayout, []).edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: `service:${tag}`,
            target: "endpoint:ts-ep",
            sourceHandle: "verify-client-endpoint",
            targetHandle: "derp-service",
          }),
        ]),
      );
    }

    if (type === "ccm" || type === "ocm") {
      config = addDirectDetour(config);
      config = updateEntityField(config, { kind: "service", tag }, "detour", "detour-out");
      expect(deriveGraph(config, emptyLayout, []).edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: `service:${tag}`,
            target: "outbound:detour-out",
            sourceHandle: "detour",
            targetHandle: "service-detour",
          }),
        ]),
      );
    }

    const alternateType = type === "resolved" ? "ocm" : "resolved";
    config = changeEntityType(config, { kind: "service", tag }, alternateType);
    expect(config.services?.find((service) => service.tag === tag)?.type).toBe(alternateType);
  });

  it.each(CREATABLE_ENDPOINT_TYPES)("endpoint/%s.md creates editable endpoint nodes and detour refs", (type) => {
    let config = addEndpoint(createMinimalConfig(), type, preferredEndpointTag(type));
    const tag = assertTag(config.endpoints?.at(-1)?.tag, `endpoint/${type}`);
    config = addDirectDetour(config);
    config = updateEntityField(config, { kind: "endpoint", tag }, "detour", "detour-out");
    assertNode(config, `endpoint:${tag}`, type);
    expect(deriveGraph(config, emptyLayout, []).edges.some((edge) => edge.id.includes("endpoint-detour"))).toBe(true);

    const alternateType = type === "wireguard" ? "tailscale" : "wireguard";
    config = changeEntityType(config, { kind: "endpoint", tag }, alternateType);
    expect(config.endpoints?.find((endpoint) => endpoint.tag === tag)?.type).toBe(alternateType);
  });

  it.each(CREATABLE_RULE_SET_TYPES)("rule-set %s creates editable resource nodes and rule refs", (type) => {
    let config = addRuleSet(createMinimalConfig(), type, preferredRuleSetTag(type));
    const tag = assertTag(config.route?.rule_set?.at(-1)?.tag, `rule-set/${type}`);
    config = addRouteRule(config, { domain_keyword: ["test"], rule_set: [tag] });
    assertNode(config, `rule-set:${tag}`, type);
    expect(deriveGraph(config, emptyLayout, []).edges.some((edge) => edge.target === `rule-set:${tag}`)).toBe(true);

    const ref: EntityRef = { kind: "rule-set", tag };
    config = updateEntityField(config, ref, "format", "source");
    expect(config.route?.rule_set?.find((ruleSet) => ruleSet.tag === tag)?.format).toBe("source");
  });

  it("route-rule.md and dns/rule.md edit match fields, action refs, and graph edges", () => {
    let config = createMinimalConfig();
    config = ensureRoute(config);
    config = addOutbound(config, "direct", "direct");
    config = addRouteRule(config, { domain_suffix: ["cn"], outbound: "direct" });
    const routeRuleIndex = (config.route?.rules?.length ?? 1) - 1;
    config = updateRouteRule(config, routeRuleIndex, { domain_suffix: ["sg"], action: "route", outbound: "direct" });
    expect(config.route?.rules?.[routeRuleIndex]?.domain_suffix).toEqual(["sg"]);
    expect(
      deriveGraph(config, emptyLayout, []).edges.some(
        (edge) => edge.id === `edge:route-rule:${routeRuleIndex}:direct`,
      ),
    ).toBe(true);

    config = addDnsServer(config, "https", "remote-doh");
    config = addDnsRule(config, { domain_keyword: ["ads"], server: "remote-doh" });
    const dnsRuleIndex = (config.dns?.rules?.length ?? 1) - 1;
    config = updateDnsRule(config, dnsRuleIndex, { query_type: ["A"], server: "remote-doh" });
    expect(config.dns?.rules?.[dnsRuleIndex]?.query_type).toEqual(["A"]);
    expect(
      deriveGraph(config, emptyLayout, []).edges.some(
        (edge) => edge.id === `edge:dns-rule:${dnsRuleIndex}:remote-doh`,
      ),
    ).toBe(true);
  });
});
