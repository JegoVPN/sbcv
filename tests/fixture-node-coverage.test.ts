import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { deriveGraph } from "../src/canvas/graph";
import { validateConfig } from "../src/domain/diagnostics";
import { parseConfigJson } from "../src/domain/serialization";
import { TEMPLATE_PRESETS, cloneConfig } from "../src/domain/templates";
import type { SingBoxChannel, SingBoxConfig } from "../src/domain/types";

const MAX_VISUAL_RULE_NODES = 24;
const MAX_VISUAL_RULE_SET_NODES = 24;

type Counts = {
  inbounds: number;
  outbounds: number;
  endpoints: number;
  services: number;
  routeHub: number;
  routeRules: number;
  routeRuleSets: number;
  dnsHub: number;
  dnsRules: number;
  dnsServers: number;
  settings: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function expectedCounts(config: SingBoxConfig): Counts {
  return {
    inbounds: Array.isArray(config.inbounds) ? config.inbounds.length : 0,
    outbounds: Array.isArray(config.outbounds) ? config.outbounds.length : 0,
    endpoints: Array.isArray(config.endpoints) ? config.endpoints.length : 0,
    services: Array.isArray(config.services) ? config.services.length : 0,
    routeHub: config.route ? 1 : 0,
    routeRules: Array.isArray(config.route?.rules) ? config.route!.rules!.length : 0,
    routeRuleSets: Array.isArray(config.route?.rule_set) ? config.route!.rule_set!.length : 0,
    dnsHub: config.dns ? 1 : 0,
    dnsRules: Array.isArray(config.dns?.rules) ? config.dns!.rules!.length : 0,
    dnsServers: Array.isArray(config.dns?.servers) ? config.dns!.servers!.length : 0,
    settings:
      (isPlainObject(config.log) ? 1 : 0) +
      (isPlainObject(config.ntp) ? 1 : 0) +
      (isPlainObject(config.certificate) ? 1 : 0) +
      (isPlainObject(config.experimental) ? 1 : 0),
  };
}

function actualCounts(graph: ReturnType<typeof deriveGraph>): Counts {
  const result: Counts = {
    inbounds: 0,
    outbounds: 0,
    endpoints: 0,
    services: 0,
    routeHub: 0,
    routeRules: 0,
    routeRuleSets: 0,
    dnsHub: 0,
    dnsRules: 0,
    dnsServers: 0,
    settings: 0,
  };
  for (const node of graph.nodes) {
    const kind = node.data.kind;
    if (kind === "inbound") result.inbounds += 1;
    else if (kind === "outbound") result.outbounds += 1;
    else if (kind === "endpoint") result.endpoints += 1;
    else if (kind === "service") result.services += 1;
    else if (kind === "route") result.routeHub += 1;
    else if (kind === "route-rule") result.routeRules += 1;
    else if (kind === "rule-set") result.routeRuleSets += 1;
    else if (kind === "dns") result.dnsHub += 1;
    else if (kind === "dns-rule") result.dnsRules += 1;
    else if (kind === "dns-server") result.dnsServers += 1;
    else if (kind === "settings") result.settings += 1;
  }
  return result;
}

type DropCheck = { key: keyof Counts; expected: number; actual: number };

function diffCounts(expected: Counts, actual: Counts): DropCheck[] {
  const drops: DropCheck[] = [];
  const expectedRouteRules = expected.routeRules > MAX_VISUAL_RULE_NODES ? 0 : expected.routeRules;
  const expectedRouteRuleSets =
    expected.routeRuleSets > MAX_VISUAL_RULE_SET_NODES ? 0 : expected.routeRuleSets;
  const expectedDnsRules = expected.dnsRules > MAX_VISUAL_RULE_NODES ? 0 : expected.dnsRules;

  const cmp = (key: keyof Counts, exp: number, act: number) => {
    if (exp !== act) drops.push({ key, expected: exp, actual: act });
  };

  cmp("inbounds", expected.inbounds, actual.inbounds);
  cmp("outbounds", expected.outbounds, actual.outbounds);
  cmp("endpoints", expected.endpoints, actual.endpoints);
  cmp("services", expected.services, actual.services);
  cmp("routeHub", expected.routeHub, actual.routeHub);
  cmp("routeRules", expectedRouteRules, actual.routeRules);
  cmp("routeRuleSets", expectedRouteRuleSets, actual.routeRuleSets);
  cmp("dnsHub", expected.dnsHub, actual.dnsHub);
  cmp("dnsRules", expectedDnsRules, actual.dnsRules);
  cmp("dnsServers", expected.dnsServers, actual.dnsServers);
  cmp("settings", expected.settings, actual.settings);
  return drops;
}

function* walkJson(root: string): Generator<string> {
  for (const entry of readdirSync(root)) {
    const full = path.join(root, entry);
    if (statSync(full).isDirectory()) yield* walkJson(full);
    else if (entry.endsWith(".json")) yield full;
  }
}

function auditFile(file: string, channel: SingBoxChannel) {
  const config = parseConfigJson(readFileSync(file, "utf8"));
  const diagnostics = validateConfig(config, channel);
  const graph = deriveGraph(config, { positions: {} }, diagnostics);
  const expected = expectedCounts(config);
  const actual = actualCounts(graph);
  return { expected, actual, drops: diffCounts(expected, actual) };
}

function ensureNoDrops(files: string[], channel: SingBoxChannel) {
  const failures: string[] = [];
  for (const file of files) {
    const result = auditFile(file, channel);
    if (result.drops.length === 0) continue;
    const details = result.drops
      .map((d) => `${d.key} expected=${d.expected} actual=${d.actual}`)
      .join("; ");
    failures.push(`${path.relative(process.cwd(), file)} :: ${details}`);
  }
  return failures;
}

describe("canvas node coverage vs imported config", () => {
  it("renders every entity declared in bundled stable fixtures", () => {
    const files = [...walkJson(path.join("fixtures", "stable"))];
    expect(files.length).toBeGreaterThan(0);
    expect(ensureNoDrops(files, "stable")).toEqual([]);
  });

  it("renders every entity declared in bundled testing fixtures", () => {
    const files = [...walkJson(path.join("fixtures", "testing"))];
    expect(files.length).toBeGreaterThan(0);
    expect(ensureNoDrops(files, "testing")).toEqual([]);
  });

  it("renders every entity declared in every bundled template preset", () => {
    const failures: string[] = [];
    for (const preset of TEMPLATE_PRESETS) {
      const config = cloneConfig(preset.config);
      const diagnostics = validateConfig(config, preset.channel);
      const graph = deriveGraph(config, { positions: {} }, diagnostics);
      const drops = diffCounts(expectedCounts(config), actualCounts(graph));
      if (drops.length === 0) continue;
      const details = drops
        .map((d) => `${d.key} expected=${d.expected} actual=${d.actual}`)
        .join("; ");
      failures.push(`${preset.id} :: ${details}`);
    }
    expect(failures).toEqual([]);
  });

  it("renders every entity declared in external fixture corpus (cap-aware)", () => {
    const manifest = JSON.parse(
      readFileSync(path.join("fixtures", "external", "manifest.json"), "utf8"),
    ) as Array<{ fixture_path: string; channel: SingBoxChannel; counts_toward_200?: boolean }>;
    const failures: string[] = [];
    let audited = 0;
    for (const entry of manifest) {
      if (entry.counts_toward_200 === false) continue;
      audited += 1;
      const result = auditFile(entry.fixture_path, entry.channel);
      if (result.drops.length === 0) continue;
      const details = result.drops
        .map((d) => `${d.key} expected=${d.expected} actual=${d.actual}`)
        .join("; ");
      failures.push(`${entry.fixture_path} :: ${details}`);
    }
    expect(audited).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });
});
