import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { deriveGraph, type SbcFlowNode } from "../src/canvas/graph";
import {
  changeEntityType as changeConfigEntityType,
  deleteEntity as deleteConfigEntity,
  renameTag as renameConfigTag,
} from "../src/domain/commands";
import { validateConfig } from "../src/domain/diagnostics";
import { parseConfigJson } from "../src/domain/serialization";
import { TEMPLATE_PRESETS, cloneConfig } from "../src/domain/templates";
import type { EntityRef, SingBoxChannel, SingBoxConfig } from "../src/domain/types";
import { useProjectStore } from "../src/state/useProjectStore";

const MAX_VISUAL_RULE_NODES = 24;
const MAX_VISUAL_RULE_SET_NODES = 24;

type Counts = {
  inbounds: number;
  outbounds: number;
  endpoints: number;
  services: number;
  certificateProviders: number;
  httpClients: number;
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
    certificateProviders: Array.isArray(config.certificate_providers) ? config.certificate_providers.length : 0,
    httpClients: Array.isArray(config.http_clients) ? config.http_clients.length : 0,
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
    certificateProviders: 0,
    httpClients: 0,
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
    else if (kind === "certificate-provider") result.certificateProviders += 1;
    else if (kind === "http-client") result.httpClients += 1;
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
type MutationSource = {
  name: string;
  channel: SingBoxChannel;
  config: SingBoxConfig;
};

function diffCounts(expected: Counts, actual: Counts): DropCheck[] {
  const drops: DropCheck[] = [];
  const expectedRouteRules = Math.min(expected.routeRules, MAX_VISUAL_RULE_NODES);
  const expectedRouteRuleSets =
    expected.routeRuleSets > MAX_VISUAL_RULE_SET_NODES ? 0 : expected.routeRuleSets;
  const expectedDnsRules = Math.min(expected.dnsRules, MAX_VISUAL_RULE_NODES);

  const cmp = (key: keyof Counts, exp: number, act: number) => {
    if (exp !== act) drops.push({ key, expected: exp, actual: act });
  };

  cmp("inbounds", expected.inbounds, actual.inbounds);
  cmp("outbounds", expected.outbounds, actual.outbounds);
  cmp("endpoints", expected.endpoints, actual.endpoints);
  cmp("services", expected.services, actual.services);
  cmp("certificateProviders", expected.certificateProviders, actual.certificateProviders);
  cmp("httpClients", expected.httpClients, actual.httpClients);
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

function fixtureMutationSources() {
  const sources: MutationSource[] = [];
  for (const file of walkJson(path.join("fixtures", "stable"))) {
    sources.push({
      name: path.relative(process.cwd(), file),
      channel: "stable",
      config: parseConfigJson(readFileSync(file, "utf8")),
    });
  }
  for (const file of walkJson(path.join("fixtures", "testing"))) {
    sources.push({
      name: path.relative(process.cwd(), file),
      channel: "testing",
      config: parseConfigJson(readFileSync(file, "utf8")),
    });
  }
  for (const preset of TEMPLATE_PRESETS) {
    sources.push({
      name: preset.id,
      channel: preset.channel,
      config: cloneConfig(preset.config),
    });
  }
  return sources;
}

function isTaggedRef(ref: EntityRef): ref is Extract<EntityRef, { tag: string }> {
  return "tag" in ref;
}

function isSyntheticGraphTag(tag: string) {
  return tag.startsWith("untagged-");
}

function canDeleteGraphNode(node: SbcFlowNode) {
  const ref = node.data.ref;
  if (ref.kind === "route" || ref.kind === "dns") return false;
  return !(isTaggedRef(ref) && isSyntheticGraphTag(ref.tag));
}

function canRenameGraphNode(node: SbcFlowNode) {
  const ref = node.data.ref;
  return isTaggedRef(ref) && !isSyntheticGraphTag(ref.tag);
}

function alternateEntityType(node: SbcFlowNode) {
  const choices: Partial<Record<SbcFlowNode["data"]["kind"], string[]>> = {
    inbound: ["tun", "mixed"],
    outbound: ["direct", "http"],
    "dns-server": ["local", "https"],
    endpoint: ["tailscale", "wireguard"],
    service: ["resolved", "derp"],
    "rule-set": ["remote", "local"],
  };
  return choices[node.data.kind]?.find((type) => type !== node.data.type);
}

function tagMissingDiagnostics(config: SingBoxConfig, channel: SingBoxChannel, tag: string) {
  return validateConfig(config, channel).filter(
    (diagnostic) => diagnostic.code.startsWith("missing") && diagnostic.message.includes(`"${tag}"`),
  );
}

function assertNoMissingReferenceToTag(
  source: MutationSource,
  config: SingBoxConfig,
  tag: string,
  context: string,
) {
  expect(
    tagMissingDiagnostics(config, source.channel, tag).map((diagnostic) => `${diagnostic.code} ${diagnostic.path}`),
    `${source.name} ${context} left stale reference to ${tag}`,
  ).toEqual([]);
}

function importConfigWithPinnedNode(config: SingBoxConfig, nodeId: string) {
  useProjectStore.getState().importJson(JSON.stringify(config));
  useProjectStore.setState({
    selectedId: nodeId,
    focusedNodeId: nodeId,
    layout: { positions: { [nodeId]: { x: 111, y: 222 } } },
  });
}

function sweepGraphEntityMutations(source: MutationSource) {
  const graph = deriveGraph(source.config, { positions: {} }, validateConfig(source.config, source.channel));
  for (const node of graph.nodes) {
    if (node.data.kind === "notice") continue;

    if (canDeleteGraphNode(node)) {
      const deleted = deleteConfigEntity(source.config, node.data.ref);
      deriveGraph(deleted, { positions: {} }, validateConfig(deleted, source.channel));

      if (isTaggedRef(node.data.ref)) {
        expect(
          deriveGraph(deleted, { positions: {} }, validateConfig(deleted, source.channel)).nodes.some(
            (candidate) => candidate.id === node.id,
          ),
          `${source.name} delete ${node.id} left the same graph node`,
        ).toBe(false);
        assertNoMissingReferenceToTag(source, deleted, node.data.ref.tag, `delete ${node.id}`);
      }

      importConfigWithPinnedNode(source.config, node.id);
      useProjectStore.getState().deleteEntity(node.data.ref);
      const state = useProjectStore.getState();
      expect(state.selectedId, `${source.name} delete ${node.id} left stale selectedId`).not.toBe(node.id);
      expect(state.focusedNodeId, `${source.name} delete ${node.id} left stale focusedNodeId`).not.toBe(node.id);
      expect(state.layout.positions[node.id], `${source.name} delete ${node.id} left stale layout`).toBeUndefined();
    }

    const renameRef = node.data.ref;
    if (isTaggedRef(renameRef) && canRenameGraphNode(node)) {
      const oldTag = renameRef.tag;
      const newTag = `${oldTag}-renamed-pr12`;
      const renamed = renameConfigTag(source.config, renameRef.kind, oldTag, newTag);
      const renamedGraph = deriveGraph(renamed, { positions: {} }, validateConfig(renamed, source.channel));
      expect(
        renamedGraph.nodes.some((candidate) => candidate.id === node.id),
        `${source.name} rename ${node.id} left old graph node`,
      ).toBe(false);
      expect(
        renamedGraph.nodes.some((candidate) => candidate.id === `${node.data.kind}:${newTag}`),
        `${source.name} rename ${node.id} did not create renamed graph node`,
      ).toBe(true);
      assertNoMissingReferenceToTag(source, renamed, oldTag, `rename ${node.id}`);

      importConfigWithPinnedNode(source.config, node.id);
      useProjectStore.getState().renameTag(renameRef.kind, oldTag, newTag);
      const state = useProjectStore.getState();
      const newId = `${node.data.kind}:${newTag}`;
      expect(state.selectedId, `${source.name} rename ${node.id} did not remap selectedId`).toBe(newId);
      expect(state.focusedNodeId, `${source.name} rename ${node.id} did not remap focusedNodeId`).toBe(newId);
      expect(state.layout.positions[node.id], `${source.name} rename ${node.id} left old layout`).toBeUndefined();
      expect(state.layout.positions[newId], `${source.name} rename ${node.id} did not remap layout`).toEqual({
        x: 111,
        y: 222,
      });
    }

    const nextType = alternateEntityType(node);
    const typeChangeRef = node.data.ref;
    if (nextType && isTaggedRef(typeChangeRef) && !isSyntheticGraphTag(typeChangeRef.tag)) {
      const ref = typeChangeRef as Extract<
        EntityRef,
        { kind: "inbound" | "outbound" | "dns-server" | "endpoint" | "service" | "rule-set" }
      >;
      const changed = changeConfigEntityType(source.config, ref, nextType);
      const changedGraph = deriveGraph(changed, { positions: {} }, validateConfig(changed, source.channel));
      expect(
        changedGraph.nodes.some((candidate) => candidate.id === node.id && candidate.data.type === nextType),
        `${source.name} type-change ${node.id} did not keep the graph node at the new type`,
      ).toBe(true);
      assertNoMissingReferenceToTag(source, changed, typeChangeRef.tag, `type-change ${node.id}`);
    }
  }
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

  it("keeps graph-managed bundled entities clean across delete, rename, and type-change", () => {
    const sources = fixtureMutationSources();
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) sweepGraphEntityMutations(source);
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
