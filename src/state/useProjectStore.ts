import { create } from "zustand";
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
  connectSelectorCandidate,
  createMinimalConfig,
  createStableTunSplitConfig,
  deleteDnsRule,
  deleteEntity,
  deleteRouteRule,
  disconnectEdge,
  ensureSettings,
  ensureRoute,
  moveDnsRule,
  moveRouteRule,
  renameTag,
  dnsRuleAllowsServer,
  routeRuleAllowsOutbound,
  setDnsFinal,
  setRouteFinal,
  updateDnsRule,
  updateEntityField,
  updateRouteRule,
} from "../domain/commands";
import { validateConfig } from "../domain/diagnostics";
import {
  formatEdgeId,
  isPortNodeKind,
  parseNodeId as parsePortNodeId,
  relationForHandles,
  type PortNodeKind,
} from "../domain/portRelationRegistry";
import { parseConfigJson, stringifyConfig } from "../domain/serialization";
import {
  dnsServerTypeForPaletteKind,
  endpointTypeForPaletteKind,
  inboundTypeForPaletteKind,
  outboundTypeForPaletteKind,
  preferredDnsServerTag,
  preferredEndpointTag,
  preferredInboundTag,
  preferredOutboundTag,
  preferredRuleSetTag,
  preferredServiceTag,
  serviceTypeForPaletteKind,
} from "../domain/protocols";
import { supportsDnsServerDialFields, supportsOutboundDialFields } from "../domain/sharedFieldRegistry";
import { targetById, targetFromVersion } from "../domain/targets";
import { createTemplatePreset } from "../domain/templates";
import type { TemplatePresetId } from "../domain/templates";
import type { Diagnostic, EntityRef, ProjectLayout, SingBoxChannel, SingBoxConfig, SingBoxTargetId } from "../domain/types";

type PanelTab = "rules" | "dns" | "json" | "diagnostics";
type PortDirection = "input" | "output";
type OutboundReferenceKind =
  | "route-final"
  | "route-rule"
  | "selector-member"
  | "urltest-member"
  | "dns-detour"
  | "outbound-detour";
type NodePortAction = {
  key: string;
  nodeKind: string;
  nodeType?: string;
  label: string;
};
type PortConnection = {
  source?: string | null;
  target?: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};
type CreateNodeAndConnectCandidate = {
  nodeKind: PortNodeKind;
  nodeType: string;
  handleId: string;
};

const BROWSER_VALIDATION_MESSAGE =
  "Browser validation is semantic. Official fixture checks use the target-matched sing-box binary.";

let semanticValidationTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
let semanticValidationToken = 0;

function cancelSemanticValidation() {
  semanticValidationToken += 1;
  if (semanticValidationTimer) {
    globalThis.clearTimeout(semanticValidationTimer);
    semanticValidationTimer = null;
  }
}

type ProjectStore = {
  channel: SingBoxChannel;
  version: string;
  config: SingBoxConfig;
  layout: ProjectLayout;
  selectedId: string | null;
  jsonDraft: string;
  panelTab: PanelTab;
  globalPanelOpen: boolean;
  diagnostics: Diagnostic[];
  officialDiagnostics: Diagnostic[];
  officialValidationMessage: string;
  checkNotice: string;
  isChecking: boolean;
  isOfficialChecking: boolean;
  layoutCaptureToken: number;
  freshLoadToken: number;
  focusToken: number;
  focusedNodeId: string | null;
  setSelectedId: (id: string | null) => void;
  focusNode: (id: string) => void;
  setPanelTab: (tab: PanelTab) => void;
  openGlobalPanel: (tab: PanelTab) => void;
  closeGlobalPanel: () => void;
  goHome: () => void;
  setChannel: (channel: SingBoxChannel) => void;
  setTarget: (id: SingBoxTargetId) => void;
  loadTemplate: () => void;
  loadTemplatePreset: (id: TemplatePresetId) => void;
  loadMinimal: () => void;
  createFromPalette: (kind: string) => void;
  createCompatible: (sourceId: string, kind: string) => void;
  createNodeAndConnect: (
    sourceId: string,
    sourceHandle: string,
    candidate: CreateNodeAndConnectCandidate,
    position: { x: number; y: number },
  ) => void;
  connectOutboundReference: (outboundTag: string, reference: OutboundReferenceKind, parentTag?: string) => void;
  connectPorts: (connection: PortConnection) => void;
  togglePortConnection: (nodeId: string, direction: PortDirection, port: NodePortAction) => void;
  updateField: (ref: EntityRef, field: string, value: unknown) => void;
  changeEntityType: (ref: EntityRef, nextType: string) => void;
  renameTag: (oldTag: string, newTag: string) => void;
  deleteEntity: (ref: EntityRef) => void;
  disconnectEdge: (edgeId: string) => void;
  addRouteRule: () => void;
  updateRouteRule: (index: number, patch: Record<string, unknown>) => void;
  moveRouteRule: (index: number, direction: -1 | 1) => void;
  deleteRouteRule: (index: number) => void;
  addDnsRule: () => void;
  updateDnsRule: (index: number, patch: Record<string, unknown>) => void;
  moveDnsRule: (index: number, direction: -1 | 1) => void;
  deleteDnsRule: (index: number) => void;
  setJsonDraft: (value: string) => void;
  applyJsonDraft: () => void;
  importJson: (value: string) => void;
  refreshJson: () => void;
  validateNow: () => void;
  runOfficialCheck: () => Promise<void>;
  captureGraphPositions: (token: number, nodes: Array<{ id: string; position: { x: number; y: number } }>) => void;
  setNodePosition: (id: string, position: { x: number; y: number }) => void;
};

function defaultVersionForChannel(channel: SingBoxChannel) {
  return channel === "stable" ? "1.13" : "1.14";
}

function computeDiagnostics(config: SingBoxConfig, channel: SingBoxChannel, version: string = defaultVersionForChannel(channel)) {
  return validateConfig(config, channel, version);
}

function sync(config: SingBoxConfig, channel: SingBoxChannel, version: string = defaultVersionForChannel(channel)) {
  cancelSemanticValidation();
  return {
    config,
    jsonDraft: stringifyConfig(config),
    diagnostics: computeDiagnostics(config, channel, version),
    officialDiagnostics: [],
    officialValidationMessage: BROWSER_VALIDATION_MESSAGE,
    checkNotice: "",
    isChecking: false,
    isOfficialChecking: false,
  };
}

function resetValidationState() {
  cancelSemanticValidation();
  return {
    officialDiagnostics: [],
    officialValidationMessage: BROWSER_VALIDATION_MESSAGE,
    checkNotice: "",
    isChecking: false,
    isOfficialChecking: false,
    focusedNodeId: null,
  };
}

function freshLayoutState(state: Pick<ProjectStore, "layoutCaptureToken" | "freshLoadToken">) {
  return {
    layout: { positions: {} },
    layoutCaptureToken: state.layoutCaptureToken + 1,
    freshLoadToken: state.freshLoadToken + 1,
  };
}

function nextLayout(layout: ProjectLayout, id: string, x: number, y: number): ProjectLayout {
  if (layout.positions[id]) return layout;
  return {
    positions: {
      ...layout.positions,
      [id]: { x, y },
    },
  };
}

function pinLayout(layout: ProjectLayout, id: string, x: number, y: number): ProjectLayout {
  return {
    positions: {
      ...layout.positions,
      [id]: layout.positions[id] ?? { x, y },
    },
  };
}

function parseNodeId(nodeId: string) {
  return parsePortNodeId(nodeId) ?? { kind: "", value: "" };
}

function nodeIdForRef(ref: EntityRef): string | null {
  if (
    ref.kind === "inbound" ||
    ref.kind === "outbound" ||
    ref.kind === "dns-server" ||
    ref.kind === "endpoint" ||
    ref.kind === "service" ||
    ref.kind === "rule-set" ||
    ref.kind === "certificate-provider" ||
    ref.kind === "http-client"
  ) {
    return `${ref.kind}:${ref.tag}`;
  }
  if (ref.kind === "route-rule") return `route-rule:${ref.index}`;
  if (ref.kind === "dns-rule") return `dns-rule:${ref.index}`;
  if (ref.kind === "route") return "route:main";
  if (ref.kind === "dns") return "dns:main";
  if (ref.kind === "settings") return `settings:${ref.path}`;
  return null;
}

function isTaggedNodeKind(kind: string) {
  return (
    kind === "inbound" ||
    kind === "outbound" ||
    kind === "dns-server" ||
    kind === "endpoint" ||
    kind === "service" ||
    kind === "rule-set" ||
    kind === "certificate-provider" ||
    kind === "http-client"
  );
}

function remapTaggedNodeId(id: string | null, oldTag: string, newTag: string) {
  if (!id) return id;
  const parsed = parseNodeId(id);
  return isTaggedNodeKind(parsed.kind) && parsed.value === oldTag ? `${parsed.kind}:${newTag}` : id;
}

function clearNodeId(id: string | null, deletedId: string | null) {
  return id && deletedId && id === deletedId ? null : id;
}

function remapTaggedLayout(layout: ProjectLayout, oldTag: string, newTag: string): ProjectLayout {
  const nextPositions: ProjectLayout["positions"] = {};
  let changed = false;
  for (const [id, position] of Object.entries(layout.positions)) {
    const nextId = remapTaggedNodeId(id, oldTag, newTag) ?? id;
    if (nextId !== id) changed = true;
    nextPositions[nextId] = position;
  }
  return changed ? { positions: nextPositions } : layout;
}

function removeLayoutPosition(layout: ProjectLayout, deletedId: string | null): ProjectLayout {
  if (!deletedId || !layout.positions[deletedId]) return layout;
  const { [deletedId]: _deleted, ...positions } = layout.positions;
  return { positions };
}

function remapRuleMoveId(id: string | null, kind: "route-rule" | "dns-rule", index: number, target: number) {
  if (!id) return id;
  const parsed = parseNodeId(id);
  if (parsed.kind !== kind) return id;
  const current = Number(parsed.value);
  if (current === index) return `${kind}:${target}`;
  if (current === target) return `${kind}:${index}`;
  return id;
}

function remapRuleDeleteId(id: string | null, kind: "route-rule" | "dns-rule", index: number) {
  if (!id) return id;
  const parsed = parseNodeId(id);
  if (parsed.kind !== kind) return id;
  const current = Number(parsed.value);
  if (!Number.isInteger(current)) return id;
  if (current === index) return null;
  return current > index ? `${kind}:${current - 1}` : id;
}

function remapRuleMoveLayout(layout: ProjectLayout, kind: "route-rule" | "dns-rule", index: number, target: number): ProjectLayout {
  const sourceId = `${kind}:${index}`;
  const targetId = `${kind}:${target}`;
  if (!layout.positions[sourceId] && !layout.positions[targetId]) return layout;
  const positions = { ...layout.positions };
  const sourcePosition = positions[sourceId];
  const targetPosition = positions[targetId];
  if (targetPosition) positions[sourceId] = targetPosition;
  else delete positions[sourceId];
  if (sourcePosition) positions[targetId] = sourcePosition;
  else delete positions[targetId];
  return { positions };
}

function remapRuleDeleteLayout(layout: ProjectLayout, kind: "route-rule" | "dns-rule", index: number): ProjectLayout {
  let changed = false;
  const positions: ProjectLayout["positions"] = {};
  for (const [id, position] of Object.entries(layout.positions)) {
    const parsed = parseNodeId(id);
    if (parsed.kind !== kind) {
      positions[id] = position;
      continue;
    }
    const current = Number(parsed.value);
    if (!Number.isInteger(current)) {
      positions[id] = position;
      continue;
    }
    if (current === index) {
      changed = true;
      continue;
    }
    const nextId = current > index ? `${kind}:${current - 1}` : id;
    if (nextId !== id) changed = true;
    positions[nextId] = position;
  }
  return changed ? { positions } : layout;
}

function firstOutboundParent(config: SingBoxConfig, childTag: string, parentType?: string) {
  return (config.outbounds ?? []).find((outbound) => {
    if (parentType && outbound.type !== parentType) return false;
    return outbound.outbounds?.includes(childTag);
  });
}

function firstRouteRuleIndex(config: SingBoxConfig, outboundTag: string) {
  return config.route?.rules?.findIndex((rule) => rule.outbound === outboundTag) ?? -1;
}

function tagRefs(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function addTagRef(value: string | string[] | undefined, tag: string): string | string[] {
  const refs = tagRefs(value);
  if (refs.includes(tag)) return value ?? tag;
  return refs.length ? [...refs, tag] : tag;
}

function removeTagRef(value: string | string[] | undefined, tag: string): string | string[] | undefined {
  const refs = tagRefs(value).filter((item) => item !== tag);
  if (refs.length === 0) return undefined;
  return refs.length === 1 ? refs[0] : refs;
}

function firstRouteRuleInboundIndex(config: SingBoxConfig, inboundTag: string) {
  return config.route?.rules?.findIndex((rule) => tagRefs(rule.inbound).includes(inboundTag)) ?? -1;
}

function firstRouteRuleSetIndex(config: SingBoxConfig, ruleSetTag: string) {
  return config.route?.rules?.findIndex((rule) => {
    if (Array.isArray(rule.rule_set)) return rule.rule_set.includes(ruleSetTag);
    return rule.rule_set === ruleSetTag;
  }) ?? -1;
}

function firstDnsRuleIndex(config: SingBoxConfig, serverTag: string) {
  return config.dns?.rules?.findIndex((rule) => rule.server === serverTag) ?? -1;
}

function firstDnsRuleInboundIndex(config: SingBoxConfig, inboundTag: string) {
  return config.dns?.rules?.findIndex((rule) => tagRefs(rule.inbound).includes(inboundTag)) ?? -1;
}

function firstDnsRuleSetIndex(config: SingBoxConfig, ruleSetTag: string) {
  return config.dns?.rules?.findIndex((rule) => {
    if (Array.isArray(rule.rule_set)) return rule.rule_set.includes(ruleSetTag);
    return rule.rule_set === ruleSetTag;
  }) ?? -1;
}

function firstDnsServerDetouringThrough(config: SingBoxConfig, outboundTag: string) {
  return config.dns?.servers?.find((server) => server.detour === outboundTag);
}

function firstDialableDnsServer(config: SingBoxConfig) {
  return config.dns?.servers?.find((server) => supportsDnsServerDialFields(server.type));
}

function firstOutboundDetouringThrough(config: SingBoxConfig, outboundTag: string) {
  return config.outbounds?.find((outbound) => outbound.tag !== outboundTag && outbound.detour === outboundTag);
}

function firstEndpointDetouringThrough(config: SingBoxConfig, outboundTag: string) {
  return config.endpoints?.find((endpoint) => endpoint.detour === outboundTag);
}

function firstRuleSetDownloadingThrough(config: SingBoxConfig, outboundTag: string) {
  return config.route?.rule_set?.find((ruleSet) => ruleSet.download_detour === outboundTag);
}

function firstRuleSetTag(config: SingBoxConfig) {
  return config.route?.rule_set?.find((ruleSet) => typeof ruleSet.tag === "string" && ruleSet.tag)?.tag;
}

function firstTailscaleEndpointTag(config: SingBoxConfig) {
  return config.endpoints?.find((endpoint) => endpoint.type === "tailscale" && typeof endpoint.tag === "string")?.tag;
}

function firstTailscaleDnsServer(config: SingBoxConfig) {
  return config.dns?.servers?.find((server) => server.type === "tailscale");
}

function firstDnsServerUsingEndpoint(config: SingBoxConfig, endpointTag: string) {
  return config.dns?.servers?.find((server) => server.type === "tailscale" && server.endpoint === endpointTag);
}

function firstDirectOutboundTag(config: SingBoxConfig, excludedTag: string) {
  return config.outbounds?.find((outbound) => outbound.tag !== excludedTag && outbound.type === "direct")?.tag;
}

function firstSsmServiceUsingInbound(config: SingBoxConfig, inboundTag: string) {
  return config.services?.find(
    (service) =>
      service.type === "ssm-api" &&
      service.servers &&
      Object.values(service.servers).includes(inboundTag),
  );
}

function firstServiceDetouringThrough(config: SingBoxConfig, outboundTag: string) {
  return config.services?.find((service) => service.detour === outboundTag);
}

function firstDerpServiceVerifyingEndpoint(config: SingBoxConfig, endpointTag: string) {
  return config.services?.find((service) => {
    if (service.type !== "derp") return false;
    const refs = tagRefs(service.verify_client_endpoint as string | string[] | undefined);
    return refs.includes(endpointTag);
  });
}

function firstServiceTagByType(config: SingBoxConfig, type: string) {
  return config.services?.find((service) => service.type === type && typeof service.tag === "string")?.tag;
}

function ensureManagedShadowsocksInbound(config: SingBoxConfig) {
  const existing = config.inbounds?.find((inbound) => inbound.type === "shadowsocks" && inbound.managed && inbound.tag);
  if (existing?.tag) return { config, tag: existing.tag };

  let next = addInbound(config, "shadowsocks", "ss-managed-in");
  const created = next.inbounds?.[next.inbounds.length - 1];
  if (!created?.tag) return { config: next, tag: "" };
  next = updateEntityField(next, { kind: "inbound", tag: created.tag }, "method", "2022-blake3-aes-128-gcm");
  next = updateEntityField(next, { kind: "inbound", tag: created.tag }, "password", "Q7WI7Eid7AOHSdFDw3bkdA==");
  next = updateEntityField(next, { kind: "inbound", tag: created.tag }, "managed", true);
  return { config: next, tag: created.tag };
}

function ensureService(config: SingBoxConfig, type: string) {
  const existingTag = firstServiceTagByType(config, type);
  if (existingTag) return { config, tag: existingTag };
  const next = addService(config, type, preferredServiceTag(type));
  return { config: next, tag: next.services?.[next.services.length - 1]?.tag ?? "" };
}

function supportsOutboundDetour(type: string | undefined) {
  return supportsOutboundDialFields(type);
}

function connectCreatedOutboundForSelection(
  config: SingBoxConfig,
  selectedId: string | null,
  createdTag: string,
): SingBoxConfig {
  if (!selectedId) return config;

  const selected = parseNodeId(selectedId);

  if (selected.kind === "route") {
    const withRoute = ensureRoute(config);
    if (!withRoute.route?.final) return setRouteFinal(withRoute, createdTag);
    return addRouteRule(withRoute, { domain_suffix: ["example"], outbound: createdTag });
  }

  if (selected.kind === "route-rule") {
    const index = Number(selected.value);
    const rule = Number.isInteger(index) ? config.route?.rules?.[index] : undefined;
    if (Number.isInteger(index) && routeRuleAllowsOutbound(rule)) return updateRouteRule(config, index, { outbound: createdTag });
  }

  if (selected.kind === "outbound") {
    const parent = config.outbounds?.find((outbound) => outbound.tag === selected.value);
    if (parent?.type === "selector" || parent?.type === "urltest") {
      return connectSelectorCandidate(config, parent.tag, createdTag);
    }
    if (parent?.tag && supportsOutboundDetour(parent.type)) {
      return updateEntityField(config, { kind: "outbound", tag: parent.tag }, "detour", createdTag);
    }
  }

  if (selected.kind === "dns-server") {
    const server = config.dns?.servers?.find((item) => item.tag === selected.value);
    return supportsDnsServerDialFields(server?.type)
      ? updateEntityField(config, { kind: "dns-server", tag: selected.value }, "detour", createdTag)
      : config;
  }

  if (selected.kind === "endpoint") {
    return updateEntityField(config, { kind: "endpoint", tag: selected.value }, "detour", createdTag);
  }

  if (selected.kind === "rule-set") {
    const ruleSet = config.route?.rule_set?.find((item) => item.tag === selected.value);
    return ruleSet?.type === "remote"
      ? updateEntityField(config, { kind: "rule-set", tag: selected.value }, "download_detour", createdTag)
      : config;
  }

  return config;
}

function disconnectSelectorMember(config: SingBoxConfig, parentTag: string, childTag: string, parentType: string) {
  return disconnectEdge(config, formatEdgeId(parentType, parentTag, childTag));
}

function numberedNodeIndex(node: { value: string }) {
  const index = Number(node.value);
  return Number.isInteger(index) ? index : -1;
}

function portNodeType(config: SingBoxConfig, node: { kind: string; value: string }) {
  if (node.kind === "inbound") return config.inbounds?.find((item) => item.tag === node.value)?.type;
  if (node.kind === "outbound") return config.outbounds?.find((item) => item.tag === node.value)?.type;
  if (node.kind === "dns-server") return config.dns?.servers?.find((item) => item.tag === node.value)?.type;
  if (node.kind === "endpoint") return config.endpoints?.find((item) => item.tag === node.value)?.type;
  if (node.kind === "service") return config.services?.find((item) => item.tag === node.value)?.type;
  if (node.kind === "rule-set") return config.route?.rule_set?.find((item) => item.tag === node.value)?.type;
  if (node.kind === "certificate-provider") return config.certificate_providers?.find((item) => item.tag === node.value)?.type;
  if (node.kind === "http-client") return "http-client";
  if (node.kind === "route") return "route";
  if (node.kind === "route-rule") return "route-rule";
  if (node.kind === "dns") return "dns";
  if (node.kind === "dns-rule") return "dns-rule";
  if (node.kind === "settings") return node.value;
  return undefined;
}

function clashApiObject(config: SingBoxConfig) {
  const clashApi = config.experimental?.clash_api;
  return clashApi && typeof clashApi === "object" && !Array.isArray(clashApi)
    ? clashApi as Record<string, unknown>
    : {};
}

function setClashApiDownloadDetour(config: SingBoxConfig, outboundTag: string | undefined) {
  return updateEntityField(
    config,
    { kind: "settings", path: "experimental" },
    "clash_api",
    { ...clashApiObject(config), external_ui_download_detour: outboundTag },
  );
}

function connectDirectedPortReference(
  config: SingBoxConfig,
  outputNode: { kind: string; value: string },
  outputHandle: string | null | undefined,
  inputNode: { kind: string; value: string },
  inputHandle: string | null | undefined,
): SingBoxConfig | null {
  if (!outputHandle || !inputHandle) return null;
  if (outputNode.kind === inputNode.kind && outputNode.value === inputNode.value) return null;
  if (!isPortNodeKind(outputNode.kind) || !isPortNodeKind(inputNode.kind)) return null;
  const writableRelation = relationForHandles(
    outputNode.kind,
    portNodeType(config, outputNode),
    outputHandle,
    inputNode.kind,
    portNodeType(config, inputNode),
    inputHandle,
    ["writable"],
  );
  if (!writableRelation) return null;

  if (outputNode.kind === "inbound" && outputHandle === "route-rule-match" && inputNode.kind === "route-rule" && inputHandle === "inbound") {
    const index = numberedNodeIndex(inputNode);
    const current = index >= 0 ? config.route?.rules?.[index] : undefined;
    return index >= 0 ? updateRouteRule(config, index, { inbound: addTagRef(current?.inbound, outputNode.value) }) : null;
  }

  if (outputNode.kind === "inbound" && outputHandle === "dns-rule-match" && inputNode.kind === "dns-rule" && inputHandle === "inbound") {
    const index = numberedNodeIndex(inputNode);
    const current = index >= 0 ? config.dns?.rules?.[index] : undefined;
    return index >= 0 ? updateDnsRule(config, index, { inbound: addTagRef(current?.inbound, outputNode.value) }) : null;
  }

  if (outputNode.kind === "inbound" && outputHandle === "service" && inputNode.kind === "service" && inputHandle === "managed-inbound") {
    const service = config.services?.find((item) => item.tag === inputNode.value);
    const inbound = config.inbounds?.find((item) => item.tag === outputNode.value);
    if (service?.type !== "ssm-api" || inbound?.type !== "shadowsocks") return null;
    const currentServers = service.servers && typeof service.servers === "object" ? service.servers : {};
    const withService = updateEntityField(config, { kind: "service", tag: inputNode.value }, "servers", { ...currentServers, "/": outputNode.value });
    return updateEntityField(withService, { kind: "inbound", tag: outputNode.value }, "managed", true);
  }

  if (outputNode.kind === "route" && outputHandle === "outbound" && inputNode.kind === "outbound" && inputHandle === "route") {
    return setRouteFinal(config, inputNode.value);
  }

  if (outputNode.kind === "route-rule" && outputHandle === "outbound" && inputNode.kind === "outbound" && inputHandle === "route-rule") {
    const index = numberedNodeIndex(outputNode);
    const rule = index >= 0 ? config.route?.rules?.[index] : undefined;
    return index >= 0 && routeRuleAllowsOutbound(rule) ? updateRouteRule(config, index, { outbound: inputNode.value }) : null;
  }

  if (outputNode.kind === "route-rule" && outputHandle === "rule-set" && inputNode.kind === "rule-set" && inputHandle === "route-rule") {
    const index = numberedNodeIndex(outputNode);
    const current = index >= 0 ? config.route?.rules?.[index] : undefined;
    return index >= 0 ? updateRouteRule(config, index, { rule_set: addTagRef(current?.rule_set, inputNode.value) }) : null;
  }

  if (outputNode.kind === "dns" && outputHandle === "dns-server" && inputNode.kind === "dns-server" && inputHandle === "dns") {
    return setDnsFinal(config, inputNode.value);
  }

  if (outputNode.kind === "dns-rule" && outputHandle === "dns-server" && inputNode.kind === "dns-server" && inputHandle === "dns-rule") {
    const index = numberedNodeIndex(outputNode);
    const rule = index >= 0 ? config.dns?.rules?.[index] : undefined;
    return index >= 0 && dnsRuleAllowsServer(rule) ? updateDnsRule(config, index, { server: inputNode.value }) : null;
  }

  if (outputNode.kind === "dns-rule" && outputHandle === "rule-set" && inputNode.kind === "rule-set" && inputHandle === "dns-rule") {
    const index = numberedNodeIndex(outputNode);
    const current = index >= 0 ? config.dns?.rules?.[index] : undefined;
    return index >= 0 ? updateDnsRule(config, index, { rule_set: addTagRef(current?.rule_set, inputNode.value) }) : null;
  }

  if (outputNode.kind === "dns-server" && outputHandle === "outbound" && inputNode.kind === "outbound" && inputHandle === "dns-detour") {
    const server = config.dns?.servers?.find((item) => item.tag === outputNode.value);
    return supportsDnsServerDialFields(server?.type)
      ? updateEntityField(config, { kind: "dns-server", tag: outputNode.value }, "detour", inputNode.value)
      : null;
  }

  if (outputNode.kind === "dns-server" && outputHandle === "endpoint" && inputNode.kind === "endpoint" && inputHandle === "dns-server") {
    return updateEntityField(config, { kind: "dns-server", tag: outputNode.value }, "endpoint", inputNode.value);
  }

  if (outputNode.kind === "dns-server" && outputHandle === "service" && inputNode.kind === "service" && inputHandle === "dns-server") {
    const server = config.dns?.servers?.find((item) => item.tag === outputNode.value);
    const service = config.services?.find((item) => item.tag === inputNode.value);
    return server?.type === "resolved" && service?.type === "resolved"
      ? updateEntityField(config, { kind: "dns-server", tag: outputNode.value }, "service", inputNode.value)
      : null;
  }

  if (outputNode.kind === "endpoint" && outputHandle === "dial-detour" && inputNode.kind === "outbound" && inputHandle === "detour-target") {
    return updateEntityField(config, { kind: "endpoint", tag: outputNode.value }, "detour", inputNode.value);
  }

  if (outputNode.kind === "service" && outputHandle === "verify-client-endpoint" && inputNode.kind === "endpoint" && inputHandle === "derp-service") {
    const service = config.services?.find((item) => item.tag === outputNode.value);
    const endpoint = config.endpoints?.find((item) => item.tag === inputNode.value);
    if (service?.type !== "derp" || endpoint?.type !== "tailscale") return null;
    return updateEntityField(
      config,
      { kind: "service", tag: outputNode.value },
      "verify_client_endpoint",
      addTagRef(service.verify_client_endpoint as string | string[] | undefined, inputNode.value),
    );
  }

  if (outputNode.kind === "service" && outputHandle === "detour" && inputNode.kind === "outbound" && inputHandle === "service-detour") {
    const service = config.services?.find((item) => item.tag === outputNode.value);
    if (service?.type !== "ccm" && service?.type !== "ocm") return null;
    return updateEntityField(config, { kind: "service", tag: outputNode.value }, "detour", inputNode.value);
  }

  if (outputNode.kind === "rule-set" && outputHandle === "download-detour" && inputNode.kind === "outbound" && inputHandle === "rule-set-download") {
    return updateEntityField(config, { kind: "rule-set", tag: outputNode.value }, "download_detour", inputNode.value);
  }

  if (outputNode.kind === "settings" && outputNode.value === "experimental" && outputHandle === "clash-download-detour" && inputNode.kind === "outbound" && inputHandle === "clash-download-detour") {
    return setClashApiDownloadDetour(config, inputNode.value);
  }

  if (outputNode.kind === "settings" && outputNode.value === "ntp" && outputHandle === "dial-detour" && inputNode.kind === "outbound" && inputHandle === "detour-target") {
    return updateEntityField(config, { kind: "settings", path: "ntp" }, "detour", inputNode.value);
  }

  if (outputNode.kind === "certificate-provider" && outputHandle === "endpoint" && inputNode.kind === "endpoint" && inputHandle === "certificate-provider") {
    const provider = config.certificate_providers?.find((item) => item.tag === outputNode.value);
    const endpoint = config.endpoints?.find((item) => item.tag === inputNode.value);
    return provider?.type === "tailscale" && endpoint?.type === "tailscale"
      ? updateEntityField(config, { kind: "certificate-provider", tag: outputNode.value }, "endpoint", inputNode.value)
      : null;
  }

  if (outputNode.kind === "outbound" && inputNode.kind === "outbound") {
    if (outputHandle === "outbound-member" && (inputHandle === "selector-group" || inputHandle === "urltest-group")) {
      return connectSelectorCandidate(config, outputNode.value, inputNode.value);
    }
    if (outputHandle === "dial-detour" && inputHandle === "detour-target") {
      const outbound = config.outbounds?.find((item) => item.tag === outputNode.value);
      return supportsOutboundDetour(outbound?.type)
        ? updateEntityField(config, { kind: "outbound", tag: outputNode.value }, "detour", inputNode.value)
        : null;
    }
  }

  return null;
}

function createNodeForConnectCandidate(config: SingBoxConfig, candidate: CreateNodeAndConnectCandidate) {
  let next = config;
  if (candidate.nodeKind === "outbound") {
    const insertIndex = next.outbounds?.length ?? 0;
    next = addOutbound(next, candidate.nodeType, preferredOutboundTag(candidate.nodeType));
    const created = next.outbounds?.[insertIndex];
    return created?.tag ? { config: next, nodeId: `outbound:${created.tag}` } : null;
  }
  if (candidate.nodeKind === "dns-server") {
    const insertIndex = next.dns?.servers?.length ?? 0;
    next = addDnsServer(next, candidate.nodeType, preferredDnsServerTag(candidate.nodeType));
    const created = next.dns?.servers?.[insertIndex];
    return created?.tag ? { config: next, nodeId: `dns-server:${created.tag}` } : null;
  }
  if (candidate.nodeKind === "endpoint") {
    const insertIndex = next.endpoints?.length ?? 0;
    next = addEndpoint(next, candidate.nodeType, preferredEndpointTag(candidate.nodeType));
    const created = next.endpoints?.[insertIndex];
    return created?.tag ? { config: next, nodeId: `endpoint:${created.tag}` } : null;
  }
  if (candidate.nodeKind === "service") {
    const insertIndex = next.services?.length ?? 0;
    next = addService(next, candidate.nodeType, preferredServiceTag(candidate.nodeType));
    const created = next.services?.[insertIndex];
    return created?.tag ? { config: next, nodeId: `service:${created.tag}` } : null;
  }
  if (candidate.nodeKind === "rule-set") {
    const insertIndex = next.route?.rule_set?.length ?? 0;
    next = addRuleSet(next, candidate.nodeType, preferredRuleSetTag(candidate.nodeType));
    const created = next.route?.rule_set?.[insertIndex];
    return created?.tag ? { config: next, nodeId: `rule-set:${created.tag}` } : null;
  }
  if (candidate.nodeKind === "inbound") {
    const insertIndex = next.inbounds?.length ?? 0;
    next = addInbound(next, candidate.nodeType, preferredInboundTag(candidate.nodeType));
    const created = next.inbounds?.[insertIndex];
    return created?.tag ? { config: next, nodeId: `inbound:${created.tag}` } : null;
  }
  if (candidate.nodeKind === "route") {
    next = ensureRoute(next);
    return { config: next, nodeId: "route:main" };
  }
  if (candidate.nodeKind === "route-rule") {
    const insertIndex = next.route?.rules?.length ?? 0;
    next = addRouteRule(next);
    return { config: next, nodeId: `route-rule:${insertIndex}` };
  }
  if (candidate.nodeKind === "dns") {
    next = next.dns ? next : addDnsServer(next, "local", preferredDnsServerTag("local"));
    return { config: next, nodeId: "dns:main" };
  }
  if (candidate.nodeKind === "dns-rule") {
    const insertIndex = next.dns?.rules?.length ?? 0;
    next = addDnsRule(next);
    return { config: next, nodeId: `dns-rule:${insertIndex}` };
  }
  return null;
}

const initialConfig = createStableTunSplitConfig();

export const useProjectStore = create<ProjectStore>((set, get) => ({
  channel: "stable",
  version: "1.13",
  config: initialConfig,
  layout: { positions: {} },
  selectedId: null,
  jsonDraft: stringifyConfig(initialConfig),
  panelTab: "rules",
  globalPanelOpen: false,
  diagnostics: computeDiagnostics(initialConfig, "stable"),
  officialDiagnostics: [],
  officialValidationMessage: BROWSER_VALIDATION_MESSAGE,
  checkNotice: "",
  isChecking: false,
  isOfficialChecking: false,
  layoutCaptureToken: 1,
  freshLoadToken: 0,
  focusToken: 0,
  focusedNodeId: null,

  setSelectedId: (id) => set({ selectedId: id }),
  focusNode: (id) =>
    set((state) => ({
      selectedId: id,
      focusedNodeId: id,
      focusToken: state.focusToken + 1,
      globalPanelOpen: false,
    })),
  setPanelTab: (tab) => set({ panelTab: tab }),
  openGlobalPanel: (tab) => set({ panelTab: tab, globalPanelOpen: true, selectedId: null }),
  closeGlobalPanel: () => set({ globalPanelOpen: false }),
  goHome: () =>
    set((state) => ({
      selectedId: null,
      globalPanelOpen: false,
      freshLoadToken: state.freshLoadToken + 1,
    })),
  setChannel: (channel) =>
    set((state) => ({
      ...resetValidationState(),
      channel,
      version: channel === "stable" ? "1.13" : "1.14",
      diagnostics: computeDiagnostics(state.config, channel),
    })),
  setTarget: (id) =>
    set((state) => {
      const target = targetById(id);
      return {
        ...resetValidationState(),
        channel: target.channel,
        version: target.version,
        diagnostics: computeDiagnostics(state.config, target.channel, target.version),
      };
    }),

  loadTemplate: () =>
    set((state) => ({
      ...sync(createStableTunSplitConfig(), state.channel, state.version),
      ...freshLayoutState(state),
      selectedId: null,
      globalPanelOpen: false,
      focusedNodeId: null,
    })),
  loadTemplatePreset: (id) =>
    set((state) => {
      const preset = createTemplatePreset(id);
      return {
        ...sync(preset.config, preset.channel, preset.version),
        channel: preset.channel,
        version: preset.version,
        ...freshLayoutState(state),
        selectedId: null,
        globalPanelOpen: false,
        focusedNodeId: null,
      };
    }),
  loadMinimal: () =>
    set((state) => ({
      ...sync(createMinimalConfig(), state.channel, state.version),
      ...freshLayoutState(state),
      selectedId: null,
      globalPanelOpen: false,
      focusedNodeId: null,
    })),

  createFromPalette: (kind) =>
    set((state) => {
      let config = state.config;
      let layout = state.layout;
      let selectedId = state.selectedId;
      if (kind === "settings-log") {
        config = ensureSettings(config, "log");
        layout = pinLayout(layout, "settings:log", -300, 40);
        selectedId = "settings:log";
      }
      if (kind === "settings-ntp") {
        config = ensureSettings(config, "ntp");
        layout = pinLayout(layout, "settings:ntp", -300, 370);
        selectedId = "settings:ntp";
      }
      if (kind === "settings-certificate") {
        config = ensureSettings(config, "certificate");
        layout = pinLayout(layout, "settings:certificate", -300, 700);
        selectedId = "settings:certificate";
      }
      if (kind === "settings-experimental") {
        config = ensureSettings(config, "experimental");
        layout = pinLayout(layout, "settings:experimental", -300, 1030);
        selectedId = "settings:experimental";
      }
      const inboundType = inboundTypeForPaletteKind(kind);
      if (inboundType && inboundType !== "cloudflared") {
        config = addInbound(config, inboundType, preferredInboundTag(inboundType));
        const created = config.inbounds?.[config.inbounds.length - 1];
        if (created) selectedId = `inbound:${created.tag}`;
      }
      if (kind === "route") config = ensureRoute(config);
      if (kind === "route-rule") config = addRouteRule(config);
      const ruleSetType =
        kind === "rule-set" || kind === "rule-set-remote"
          ? "remote"
          : kind === "rule-set-local"
            ? "local"
            : kind === "rule-set-inline"
              ? "inline"
              : null;
      if (ruleSetType) {
        config = addRuleSet(config, ruleSetType, preferredRuleSetTag(ruleSetType));
        const created = config.route?.rule_set?.[config.route.rule_set.length - 1];
        if (created) selectedId = `rule-set:${created.tag}`;
      }
      const endpointType = endpointTypeForPaletteKind(kind);
      if (endpointType) {
        config = addEndpoint(config, endpointType, preferredEndpointTag(endpointType));
        const created = config.endpoints?.[config.endpoints.length - 1];
        if (created) {
          const selected = parseNodeId(state.selectedId ?? "");
          if (selected.kind === "dns-server" && endpointType === "tailscale") {
            config = updateEntityField(config, { kind: "dns-server", tag: selected.value }, "endpoint", created.tag);
          }
          selectedId = `endpoint:${created.tag}`;
        }
      }
      const serviceType = serviceTypeForPaletteKind(kind);
      if (serviceType && (serviceType !== "hysteria-realm" || state.channel === "testing")) {
        config = addService(config, serviceType, preferredServiceTag(serviceType));
        const created = config.services?.[config.services.length - 1];
        if (created) selectedId = `service:${created.tag}`;
      }
      const outboundType = outboundTypeForPaletteKind(kind);
      if (outboundType && outboundType !== "wireguard" && outboundType !== "dns") {
        config = addOutbound(config, outboundType, preferredOutboundTag(outboundType));
        const created = config.outbounds?.[config.outbounds.length - 1];
        if (created) {
          config = connectCreatedOutboundForSelection(config, state.selectedId, created.tag);
          selectedId = `outbound:${created.tag}`;
        }
      }
      if (kind === "dns-hub") config = config.dns ? config : addDnsServer(config, "local");
      const dnsServerType = dnsServerTypeForPaletteKind(kind);
      if (dnsServerType && dnsServerType !== "legacy" && dnsServerType !== "mdns") {
        config = addDnsServer(config, dnsServerType, preferredDnsServerTag(dnsServerType));
        const created = config.dns?.servers?.[config.dns.servers.length - 1];
        if (created) {
          const selected = parseNodeId(state.selectedId ?? "");
          if (selected.kind === "endpoint" && dnsServerType === "tailscale") {
            config = updateEntityField(config, { kind: "dns-server", tag: created.tag }, "endpoint", selected.value);
          }
          selectedId = `dns-server:${created.tag}`;
        }
      }
      if (kind === "dns-rule") config = addDnsRule(config);
      return { ...sync(config, state.channel, state.version), layout, selectedId };
    }),

  createCompatible: (sourceId, kind) =>
    set((state) => {
      let config = state.config;
      let createdOutboundTag: string | null = null;
      let createdDnsServerTag: string | null = null;
      if (kind === "Route") config = ensureRoute(config);

      const createOutboundForKind = (type: string, preferredTag: string) => {
        const insertIndex = config.outbounds?.length ?? 0;
        config = addOutbound(config, type, preferredTag);
        createdOutboundTag = config.outbounds?.[insertIndex]?.tag ?? null;
      };
      const createDnsServerForKind = (type: string) => {
        const insertIndex = config.dns?.servers?.length ?? 0;
        config = addDnsServer(config, type);
        createdDnsServerTag = config.dns?.servers?.[insertIndex]?.tag ?? null;
      };

      if (kind === "Direct") createOutboundForKind("direct", "direct");
      if (kind === "Block") createOutboundForKind("block", "block");
      if (kind === "Selector") createOutboundForKind("selector", "proxy");
      if (kind === "URLTest") createOutboundForKind("urltest", "auto");
      if (kind === "SOCKS") createOutboundForKind("socks", "proxy-out");
      if (kind === "DNS Server") createDnsServerForKind("local");
      if (kind === "DNS Tailscale Server") createDnsServerForKind("tailscale");

      const source = parseNodeId(sourceId);
      if (createdOutboundTag && source.kind === "route") {
        const withRoute = ensureRoute(config);
        config = !withRoute.route?.final
          ? setRouteFinal(withRoute, createdOutboundTag)
          : addRouteRule(withRoute, { domain_suffix: ["example"], outbound: createdOutboundTag });
      }
      if (createdOutboundTag && source.kind === "route-rule") {
        const index = Number(source.value);
        const rule = Number.isInteger(index) ? config.route?.rules?.[index] : undefined;
        if (Number.isInteger(index) && routeRuleAllowsOutbound(rule)) {
          config = updateRouteRule(config, index, { outbound: createdOutboundTag });
        }
      }
      if (createdOutboundTag && source.kind === "outbound") {
        config = connectCreatedOutboundForSelection(config, sourceId, createdOutboundTag);
      }
      if (createdOutboundTag && (source.kind === "dns-server" || source.kind === "endpoint" || source.kind === "rule-set")) {
        config = connectCreatedOutboundForSelection(config, sourceId, createdOutboundTag);
      }
      if (createdDnsServerTag && source.kind === "dns") {
        config = setDnsFinal(config, createdDnsServerTag);
      }
      if (createdDnsServerTag && source.kind === "endpoint") {
        const endpoint = config.endpoints?.find((item) => item.tag === source.value);
        const server = config.dns?.servers?.find((item) => item.tag === createdDnsServerTag);
        if (endpoint?.type === "tailscale" && server?.type === "tailscale") {
          config = updateEntityField(config, { kind: "dns-server", tag: createdDnsServerTag }, "endpoint", source.value);
        }
      }

      let layout = state.layout;
      if (createdOutboundTag) {
        layout = nextLayout(layout, `outbound:${createdOutboundTag}`, 1050, 140 + (config.outbounds?.length ?? 1) * 110);
      }
      if (createdDnsServerTag) {
        layout = nextLayout(layout, `dns-server:${createdDnsServerTag}`, 850, 560 + (config.dns?.servers?.length ?? 1) * 100);
      }
      return { ...sync(config, state.channel, state.version), layout };
    }),

  connectOutboundReference: (outboundTag, reference, parentTag) =>
    set((state) => {
      let config = state.config;
      let layout = state.layout;

      if (reference === "route-final") {
        config = setRouteFinal(config, outboundTag);
      }

      if (reference === "route-rule") {
        config = addRouteRule(config, { domain_suffix: ["example"], outbound: outboundTag });
      }

      if (reference === "selector-member" || reference === "urltest-member") {
        const parentType = reference === "selector-member" ? "selector" : "urltest";
        let targetParent = parentTag;
        if (!targetParent) {
          config = addOutbound(config, parentType, parentType === "selector" ? "proxy" : "auto");
          const created = config.outbounds?.[config.outbounds.length - 1];
          targetParent = created?.tag;
          if (created?.tag) {
            layout = nextLayout(layout, `outbound:${created.tag}`, 2160, 260);
          }
        }
        if (targetParent) config = connectSelectorCandidate(config, targetParent, outboundTag);
      }

      if (reference === "dns-detour") {
        let serverTag = parentTag;
        if (!serverTag) {
          const existing = firstDialableDnsServer(config);
          if (existing) {
            serverTag = existing.tag;
          } else {
            config = addDnsServer(config, "https", preferredDnsServerTag("https"));
            const created = config.dns?.servers?.[config.dns.servers.length - 1];
            serverTag = created?.tag;
            if (created?.tag) {
              layout = nextLayout(layout, `dns-server:${created.tag}`, 2160, 900);
            }
          }
        }
        if (serverTag) {
          const server = config.dns?.servers?.find((item) => item.tag === serverTag);
          if (supportsDnsServerDialFields(server?.type)) {
            config = updateEntityField(config, { kind: "dns-server", tag: serverTag }, "detour", outboundTag);
          }
        }
      }

      if (reference === "outbound-detour") {
        if (parentTag) {
          const parent = config.outbounds?.find((item) => item.tag === parentTag);
          if (supportsOutboundDetour(parent?.type)) {
            config = updateEntityField(config, { kind: "outbound", tag: parentTag }, "detour", outboundTag);
          }
        } else {
          config = addOutbound(config, "socks", preferredOutboundTag("socks"));
          const created = config.outbounds?.[config.outbounds.length - 1];
          if (created?.tag) {
            config = updateEntityField(config, { kind: "outbound", tag: created.tag }, "detour", outboundTag);
            layout = nextLayout(layout, `outbound:${created.tag}`, 2160, 260);
          }
        }
      }

      return { ...sync(config, state.channel, state.version), layout, selectedId: `outbound:${outboundTag}` };
    }),

  connectPorts: (connection) =>
    set((state) => {
      if (!connection.source || !connection.target) return state;
      const source = parseNodeId(connection.source);
      const target = parseNodeId(connection.target);
      const connected =
        connectDirectedPortReference(state.config, source, connection.sourceHandle, target, connection.targetHandle) ??
        connectDirectedPortReference(state.config, target, connection.targetHandle, source, connection.sourceHandle);
      return connected ? sync(connected, state.channel, state.version) : state;
    }),

  createNodeAndConnect: (sourceId, sourceHandle, candidate, position) =>
    set((state) => {
      const created = createNodeForConnectCandidate(state.config, candidate);
      if (!created) return state;
      const source = parseNodeId(sourceId);
      const target = parseNodeId(created.nodeId);
      const connected =
        connectDirectedPortReference(created.config, source, sourceHandle, target, candidate.handleId) ??
        connectDirectedPortReference(created.config, target, candidate.handleId, source, sourceHandle);
      if (!connected) return state;
      return {
        ...sync(connected, state.channel, state.version),
        layout: pinLayout(state.layout, created.nodeId, position.x, position.y),
        selectedId: created.nodeId,
        focusedNodeId: created.nodeId,
        focusToken: state.focusToken + 1,
        globalPanelOpen: false,
      };
    }),

  togglePortConnection: (nodeId, direction, port) =>
    set((state) => {
      const node = parseNodeId(nodeId);
      let config = state.config;

      if (direction === "input") {
        if (node.kind === "route" && port.key === "inbound") {
          config = addInbound(config, "tun");
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "route-rule" && port.key === "route") {
          config = ensureRoute(config);
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "route-rule" && port.key === "inbound") {
          const index = Number(node.value);
          if (!Number.isInteger(index)) return state;
          const current = config.route?.rules?.[index];
          if (current?.inbound) {
            config = updateRouteRule(config, index, { inbound: undefined });
          } else {
            let inboundTag = config.inbounds?.[0]?.tag;
            if (!inboundTag) {
              config = addInbound(config, "tun");
              inboundTag = config.inbounds?.[config.inbounds.length - 1]?.tag;
            }
            if (inboundTag) config = updateRouteRule(config, index, { inbound: inboundTag });
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "dns-rule" && port.key === "dns") {
          config = addDnsServer(config, "local");
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "dns-rule" && port.key === "inbound") {
          const index = Number(node.value);
          if (!Number.isInteger(index)) return state;
          const current = config.dns?.rules?.[index];
          if (current?.inbound) {
            config = updateDnsRule(config, index, { inbound: undefined });
          } else {
            let inboundTag = config.inbounds?.[0]?.tag;
            if (!inboundTag) {
              config = addInbound(config, "tun");
              inboundTag = config.inbounds?.[config.inbounds.length - 1]?.tag;
            }
            if (inboundTag) config = updateDnsRule(config, index, { inbound: inboundTag });
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "dns-server" && port.key === "dns-rule") {
          const index = firstDnsRuleIndex(config, node.value);
          config = index >= 0 ? disconnectEdge(config, formatEdgeId("dns-rule", index, node.value)) : addDnsRule(config, { domain_suffix: ["example"], server: node.value });
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "dns-server" && port.key === "dns") {
          config = config.dns?.final === node.value ? disconnectEdge(config, formatEdgeId("dns-final", node.value)) : setDnsFinal(config, node.value);
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "outbound" && port.key === "route") {
          config = config.route?.final === node.value ? disconnectEdge(config, formatEdgeId("route-final", node.value)) : setRouteFinal(config, node.value);
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "outbound" && port.key === "route-rule") {
          const index = firstRouteRuleIndex(config, node.value);
          config = index >= 0 ? disconnectEdge(config, formatEdgeId("route-rule", index, node.value)) : addRouteRule(config, { domain_suffix: ["example"], outbound: node.value });
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "outbound" && (port.key === "selector-group" || port.key === "urltest-group")) {
          const parentType = port.key === "selector-group" ? "selector" : "urltest";
          const parent = firstOutboundParent(config, node.value, parentType);
          if (parent) {
            config = disconnectSelectorMember(config, parent.tag, node.value, parent.type);
          } else {
            config = addOutbound(config, parentType, parentType === "selector" ? "proxy" : "auto");
            const created = config.outbounds?.[config.outbounds.length - 1];
            if (created) config = connectSelectorCandidate(config, created.tag, node.value);
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "outbound" && port.key === "dns-detour") {
          const server = firstDnsServerDetouringThrough(config, node.value);
          if (server) {
            config = updateEntityField(config, { kind: "dns-server", tag: server.tag }, "detour", undefined);
          } else {
            const existing = firstDialableDnsServer(config);
            if (existing) {
              config = updateEntityField(config, { kind: "dns-server", tag: existing.tag }, "detour", node.value);
            } else {
              config = addDnsServer(config, "https", preferredDnsServerTag("https"));
              const created = config.dns?.servers?.[config.dns.servers.length - 1];
              if (created) config = updateEntityField(config, { kind: "dns-server", tag: created.tag }, "detour", node.value);
            }
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "outbound" && port.key === "detour-target") {
          const child = firstOutboundDetouringThrough(config, node.value);
          const endpoint = firstEndpointDetouringThrough(config, node.value);
          if (child) {
            config = updateEntityField(config, { kind: "outbound", tag: child.tag }, "detour", undefined);
          } else if (endpoint) {
            config = updateEntityField(config, { kind: "endpoint", tag: endpoint.tag }, "detour", undefined);
          } else {
            config = addOutbound(config, "socks", preferredOutboundTag("socks"));
            const created = config.outbounds?.[config.outbounds.length - 1];
            if (created) config = updateEntityField(config, { kind: "outbound", tag: created.tag }, "detour", node.value);
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "outbound" && port.key === "service-detour") {
          const service = firstServiceDetouringThrough(config, node.value);
          if (service?.tag) {
            config = updateEntityField(config, { kind: "service", tag: service.tag }, "detour", undefined);
          } else {
            const ensured = ensureService(config, "ocm");
            config = ensured.config;
            if (ensured.tag) config = updateEntityField(config, { kind: "service", tag: ensured.tag }, "detour", node.value);
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "endpoint" && port.key === "dns-server") {
          const endpoint = config.endpoints?.find((item) => item.tag === node.value);
          if (endpoint?.type !== "tailscale") return state;
          const server = firstDnsServerUsingEndpoint(config, node.value);
          if (server) {
            config = updateEntityField(config, { kind: "dns-server", tag: server.tag }, "endpoint", undefined);
          } else {
            const existing = firstTailscaleDnsServer(config);
            if (existing) {
              config = updateEntityField(config, { kind: "dns-server", tag: existing.tag }, "endpoint", node.value);
            } else {
              config = addDnsServer(config, "tailscale", preferredDnsServerTag("tailscale"));
              const created = config.dns?.servers?.[config.dns.servers.length - 1];
              if (created) config = updateEntityField(config, { kind: "dns-server", tag: created.tag }, "endpoint", node.value);
            }
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "endpoint" && port.key === "derp-service") {
          const endpoint = config.endpoints?.find((item) => item.tag === node.value);
          if (endpoint?.type !== "tailscale") return state;
          const service = firstDerpServiceVerifyingEndpoint(config, node.value);
          if (service?.tag) {
            config = updateEntityField(
              config,
              { kind: "service", tag: service.tag },
              "verify_client_endpoint",
              removeTagRef(service.verify_client_endpoint as string | string[] | undefined, node.value),
            );
          } else {
            const ensured = ensureService(config, "derp");
            config = ensured.config;
            const created = config.services?.find((item) => item.tag === ensured.tag);
            if (created?.tag) {
              config = updateEntityField(
                config,
                { kind: "service", tag: created.tag },
                "verify_client_endpoint",
                addTagRef(created.verify_client_endpoint as string | string[] | undefined, node.value),
              );
            }
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "outbound" && port.key === "rule-set-download") {
          const ruleSet = firstRuleSetDownloadingThrough(config, node.value);
          if (ruleSet?.tag) {
            config = updateEntityField(config, { kind: "rule-set", tag: ruleSet.tag }, "download_detour", undefined);
          } else {
            let ruleSetTag = firstRuleSetTag(config);
            if (!ruleSetTag) {
              config = addRuleSet(config, "remote", preferredRuleSetTag("remote"));
              ruleSetTag = config.route?.rule_set?.[config.route.rule_set.length - 1]?.tag;
            }
            if (ruleSetTag) config = updateEntityField(config, { kind: "rule-set", tag: ruleSetTag }, "download_detour", node.value);
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "service" && port.key === "managed-inbound") {
          const service = config.services?.find((item) => item.tag === node.value);
          if (service?.type !== "ssm-api") return state;
          const servers = service.servers && typeof service.servers === "object" ? service.servers : {};
          if (Object.values(servers).length > 0) {
            config = updateEntityField(config, { kind: "service", tag: node.value }, "servers", {});
          } else {
            const ensured = ensureManagedShadowsocksInbound(config);
            config = ensured.config;
            if (ensured.tag) config = updateEntityField(config, { kind: "service", tag: node.value }, "servers", { "/": ensured.tag });
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "rule-set" && port.key === "route-rule") {
          const index = firstRouteRuleSetIndex(config, node.value);
          if (index >= 0) {
            config = disconnectEdge(config, formatEdgeId("route-rule-set", index, node.value));
          } else {
            config = addRouteRule(config, { domain_suffix: ["example"], rule_set: node.value, outbound: config.route?.final });
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "rule-set" && port.key === "dns-rule") {
          const index = firstDnsRuleSetIndex(config, node.value);
          if (index >= 0) {
            config = disconnectEdge(config, formatEdgeId("dns-rule-set", index, node.value));
          } else {
            config = addDnsRule(config, { domain_suffix: ["example"], rule_set: node.value, server: config.dns?.final });
          }
          return sync(config, state.channel, state.version);
        }
      }

      if (direction === "output") {
        if (node.kind === "inbound" && port.key === "route") {
          config = ensureRoute(config);
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "inbound" && port.key === "route-rule-match") {
          const index = firstRouteRuleInboundIndex(config, node.value);
          if (index >= 0) {
            const current = config.route?.rules?.[index];
            config = updateRouteRule(config, index, { inbound: removeTagRef(current?.inbound, node.value) });
          } else {
            config = addRouteRule(config, { inbound: node.value, outbound: config.route?.final });
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "inbound" && port.key === "dns-rule-match") {
          const index = firstDnsRuleInboundIndex(config, node.value);
          if (index >= 0) {
            const current = config.dns?.rules?.[index];
            config = updateDnsRule(config, index, { inbound: removeTagRef(current?.inbound, node.value) });
          } else {
            config = addDnsRule(config, { inbound: node.value, server: config.dns?.final });
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "inbound" && port.key === "service") {
          const inbound = config.inbounds?.find((item) => item.tag === node.value);
          if (inbound?.type !== "shadowsocks") return state;
          const service = firstSsmServiceUsingInbound(config, node.value);
          if (service?.tag) {
            const servers = Object.fromEntries(
              Object.entries(service.servers ?? {}).filter(([, inboundTag]) => inboundTag !== node.value),
            );
            config = updateEntityField(config, { kind: "service", tag: service.tag }, "servers", servers);
          } else {
            const ensured = ensureService(config, "ssm-api");
            config = ensured.config;
            const targetService = config.services?.find((item) => item.tag === ensured.tag);
            const currentServers = targetService?.servers && typeof targetService.servers === "object" ? targetService.servers : {};
            if (ensured.tag) {
              config = updateEntityField(config, { kind: "service", tag: ensured.tag }, "servers", { ...currentServers, "/": node.value });
            }
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "route" && port.key === "route-rule") {
          const lastRuleIndex = (config.route?.rules?.length ?? 0) - 1;
          config = lastRuleIndex >= 0 ? deleteRouteRule(config, lastRuleIndex) : addRouteRule(config);
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "route" && port.key === "outbound") {
          if (config.route?.final) {
            config = disconnectEdge(config, formatEdgeId("route-final", config.route.final));
          } else {
            config = addOutbound(config, "direct", "direct");
            const created = config.outbounds?.[config.outbounds.length - 1];
            if (created) config = setRouteFinal(config, created.tag);
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "route-rule" && port.key === "outbound") {
          const index = Number(node.value);
          const rule = Number.isInteger(index) ? config.route?.rules?.[index] : undefined;
          if (!Number.isInteger(index) || !rule || !routeRuleAllowsOutbound(rule)) return state;
          const outbound = rule?.outbound;
          if (outbound) config = disconnectEdge(config, formatEdgeId("route-rule", index, outbound));
          else {
            config = addOutbound(config, "direct", "direct");
            const created = config.outbounds?.[config.outbounds.length - 1];
            if (created && Number.isInteger(index)) config = updateRouteRule(config, index, { outbound: created.tag });
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "route-rule" && port.key === "rule-set") {
          const index = Number(node.value);
          if (!Number.isInteger(index)) return state;
          const current = config.route?.rules?.[index];
          if (current?.rule_set) {
            config = updateRouteRule(config, index, { rule_set: undefined });
          } else {
            let ruleSetTag = firstRuleSetTag(config);
            if (!ruleSetTag) {
              config = addRuleSet(config, "remote", preferredRuleSetTag("remote"));
              ruleSetTag = config.route?.rule_set?.[config.route.rule_set.length - 1]?.tag;
            }
            if (ruleSetTag) config = updateRouteRule(config, index, { rule_set: addTagRef(current?.rule_set, ruleSetTag) });
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "outbound" && port.key === "outbound-member") {
          const parent = config.outbounds?.find((outbound) => outbound.tag === node.value);
          const lastMember = parent?.outbounds?.[parent.outbounds.length - 1];
          if (parent && lastMember) {
            config = disconnectSelectorMember(config, parent.tag, lastMember, parent.type);
          } else if (parent) {
            config = addOutbound(config, "socks", "proxy-out");
            const created = config.outbounds?.[config.outbounds.length - 1];
            if (created) config = connectSelectorCandidate(config, parent.tag, created.tag);
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "outbound" && port.key === "dial-detour") {
          const outbound = config.outbounds?.find((item) => item.tag === node.value);
          if (!supportsOutboundDetour(outbound?.type)) return state;
          if (outbound?.detour) {
            config = updateEntityField(config, { kind: "outbound", tag: node.value }, "detour", undefined);
          } else {
            let targetTag = firstDirectOutboundTag(config, node.value);
            if (!targetTag) {
              config = addOutbound(config, "direct", preferredOutboundTag("direct"));
              targetTag = config.outbounds?.[config.outbounds.length - 1]?.tag;
            }
            if (targetTag) config = updateEntityField(config, { kind: "outbound", tag: node.value }, "detour", targetTag);
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "dns" && port.key === "dns-rule") {
          const lastRuleIndex = (config.dns?.rules?.length ?? 0) - 1;
          config = lastRuleIndex >= 0 ? deleteDnsRule(config, lastRuleIndex) : addDnsRule(config);
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "dns" && port.key === "dns-server") {
          if (config.dns?.final) config = disconnectEdge(config, formatEdgeId("dns-final", config.dns.final));
          else config = addDnsServer(config, "local");
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "dns-rule" && port.key === "dns-server") {
          const index = Number(node.value);
          const rule = Number.isInteger(index) ? config.dns?.rules?.[index] : undefined;
          if (!Number.isInteger(index) || !rule || !dnsRuleAllowsServer(rule)) return state;
          const server = rule?.server;
          if (server) config = disconnectEdge(config, formatEdgeId("dns-rule", index, server));
          else {
            config = addDnsServer(config, "local");
            const created = config.dns?.servers?.[config.dns.servers.length - 1];
            if (created && Number.isInteger(index)) config = updateDnsRule(config, index, { server: created.tag });
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "dns-rule" && port.key === "rule-set") {
          const index = Number(node.value);
          if (!Number.isInteger(index)) return state;
          const current = config.dns?.rules?.[index];
          if (current?.rule_set) {
            config = updateDnsRule(config, index, { rule_set: undefined });
          } else {
            let ruleSetTag = firstRuleSetTag(config);
            if (!ruleSetTag) {
              config = addRuleSet(config, "remote", preferredRuleSetTag("remote"));
              ruleSetTag = config.route?.rule_set?.[config.route.rule_set.length - 1]?.tag;
            }
            if (ruleSetTag) config = updateDnsRule(config, index, { rule_set: addTagRef(current?.rule_set, ruleSetTag) });
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "rule-set" && port.key === "download-detour") {
          const ruleSet = config.route?.rule_set?.find((item) => item.tag === node.value);
          if (ruleSet?.type !== "remote") return state;
          if (ruleSet?.download_detour) {
            config = updateEntityField(config, { kind: "rule-set", tag: node.value }, "download_detour", undefined);
          } else {
            let targetTag = firstDirectOutboundTag(config, node.value);
            if (!targetTag) {
              config = addOutbound(config, "direct", preferredOutboundTag("direct"));
              targetTag = config.outbounds?.[config.outbounds.length - 1]?.tag;
            }
            if (targetTag) config = updateEntityField(config, { kind: "rule-set", tag: node.value }, "download_detour", targetTag);
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "dns-server" && port.key === "outbound") {
          const server = config.dns?.servers?.find((item) => item.tag === node.value);
          if (!supportsDnsServerDialFields(server?.type)) return state;
          if (server?.detour) config = updateEntityField(config, { kind: "dns-server", tag: node.value }, "detour", undefined);
          else {
            config = addOutbound(config, "direct", "direct");
            const created = config.outbounds?.[config.outbounds.length - 1];
            if (created) config = updateEntityField(config, { kind: "dns-server", tag: node.value }, "detour", created.tag);
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "dns-server" && port.key === "endpoint") {
          const server = config.dns?.servers?.find((item) => item.tag === node.value);
          if (server?.endpoint) {
            config = updateEntityField(config, { kind: "dns-server", tag: node.value }, "endpoint", undefined);
          } else {
            let endpointTag = firstTailscaleEndpointTag(config);
            if (!endpointTag) {
              config = addEndpoint(config, "tailscale", preferredEndpointTag("tailscale"));
              endpointTag = config.endpoints?.[config.endpoints.length - 1]?.tag;
            }
            if (endpointTag) config = updateEntityField(config, { kind: "dns-server", tag: node.value }, "endpoint", endpointTag);
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "endpoint" && port.key === "dial-detour") {
          const endpoint = config.endpoints?.find((item) => item.tag === node.value);
          if (endpoint?.detour) {
            config = updateEntityField(config, { kind: "endpoint", tag: node.value }, "detour", undefined);
          } else {
            let targetTag = firstDirectOutboundTag(config, node.value);
            if (!targetTag) {
              config = addOutbound(config, "direct", preferredOutboundTag("direct"));
              targetTag = config.outbounds?.[config.outbounds.length - 1]?.tag;
            }
            if (targetTag) config = updateEntityField(config, { kind: "endpoint", tag: node.value }, "detour", targetTag);
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "service" && port.key === "verify-client-endpoint") {
          const service = config.services?.find((item) => item.tag === node.value);
          if (service?.type !== "derp") return state;
          const refs = tagRefs(service.verify_client_endpoint as string | string[] | undefined);
          if (refs.length > 0) {
            config = updateEntityField(config, { kind: "service", tag: node.value }, "verify_client_endpoint", undefined);
          } else {
            let endpointTag = firstTailscaleEndpointTag(config);
            if (!endpointTag) {
              config = addEndpoint(config, "tailscale", preferredEndpointTag("tailscale"));
              endpointTag = config.endpoints?.[config.endpoints.length - 1]?.tag;
            }
            if (endpointTag) config = updateEntityField(config, { kind: "service", tag: node.value }, "verify_client_endpoint", endpointTag);
          }
          return sync(config, state.channel, state.version);
        }

        if (node.kind === "service" && port.key === "detour") {
          const service = config.services?.find((item) => item.tag === node.value);
          if (service?.type !== "ccm" && service?.type !== "ocm") return state;
          if (service.detour) {
            config = updateEntityField(config, { kind: "service", tag: node.value }, "detour", undefined);
          } else {
            let targetTag = firstDirectOutboundTag(config, node.value);
            if (!targetTag) {
              config = addOutbound(config, "direct", preferredOutboundTag("direct"));
              targetTag = config.outbounds?.[config.outbounds.length - 1]?.tag;
            }
            if (targetTag) config = updateEntityField(config, { kind: "service", tag: node.value }, "detour", targetTag);
          }
          return sync(config, state.channel, state.version);
        }
      }

      return state;
    }),

  updateField: (ref, field, value) =>
    set((state) => sync(updateEntityField(state.config, ref, field, value), state.channel, state.version)),
  changeEntityType: (ref, nextType) =>
    set((state) => {
      if (
        ref.kind !== "inbound" &&
        ref.kind !== "outbound" &&
        ref.kind !== "dns-server" &&
        ref.kind !== "endpoint" &&
        ref.kind !== "service" &&
        ref.kind !== "rule-set"
      ) {
        return state;
      }
      return sync(changeEntityType(state.config, ref, nextType), state.channel, state.version);
    }),
  renameTag: (oldTag, newTag) =>
    set((state) => {
      const config = renameTag(state.config, oldTag, newTag);
      if (config === state.config) return state;
      return {
        ...sync(config, state.channel, state.version),
        selectedId: remapTaggedNodeId(state.selectedId, oldTag, newTag),
        focusedNodeId: remapTaggedNodeId(state.focusedNodeId, oldTag, newTag),
        layout: remapTaggedLayout(state.layout, oldTag, newTag),
      };
    }),
  deleteEntity: (ref) =>
    set((state) => {
      if (ref.kind === "route-rule") {
        const rules = state.config.route?.rules ?? [];
        if (!rules[ref.index]) return state;
        return {
          ...sync(deleteEntity(state.config, ref), state.channel, state.version),
          selectedId: remapRuleDeleteId(state.selectedId, "route-rule", ref.index),
          focusedNodeId: remapRuleDeleteId(state.focusedNodeId, "route-rule", ref.index),
          layout: remapRuleDeleteLayout(state.layout, "route-rule", ref.index),
        };
      }
      if (ref.kind === "dns-rule") {
        const rules = state.config.dns?.rules ?? [];
        if (!rules[ref.index]) return state;
        return {
          ...sync(deleteEntity(state.config, ref), state.channel, state.version),
          selectedId: remapRuleDeleteId(state.selectedId, "dns-rule", ref.index),
          focusedNodeId: remapRuleDeleteId(state.focusedNodeId, "dns-rule", ref.index),
          layout: remapRuleDeleteLayout(state.layout, "dns-rule", ref.index),
        };
      }
      const deletedId = nodeIdForRef(ref);
      return {
        ...sync(deleteEntity(state.config, ref), state.channel, state.version),
        selectedId: clearNodeId(state.selectedId, deletedId),
        focusedNodeId: clearNodeId(state.focusedNodeId, deletedId),
        layout: removeLayoutPosition(state.layout, deletedId),
      };
    }),
  disconnectEdge: (edgeId) => set((state) => sync(disconnectEdge(state.config, edgeId), state.channel, state.version)),
  addRouteRule: () => set((state) => sync(addRouteRule(state.config), state.channel, state.version)),
  updateRouteRule: (index, patch) =>
    set((state) => sync(updateRouteRule(state.config, index, patch), state.channel, state.version)),
  moveRouteRule: (index, direction) =>
    set((state) => {
      const rules = state.config.route?.rules ?? [];
      const target = index + direction;
      if (target < 0 || target >= rules.length || !rules[index] || !rules[target]) return state;
      return {
        ...sync(moveRouteRule(state.config, index, direction), state.channel, state.version),
        selectedId: remapRuleMoveId(state.selectedId, "route-rule", index, target),
        focusedNodeId: remapRuleMoveId(state.focusedNodeId, "route-rule", index, target),
        layout: remapRuleMoveLayout(state.layout, "route-rule", index, target),
      };
    }),
  deleteRouteRule: (index) =>
    set((state) => {
      const rules = state.config.route?.rules ?? [];
      if (!rules[index]) return state;
      return {
        ...sync(deleteRouteRule(state.config, index), state.channel, state.version),
        selectedId: remapRuleDeleteId(state.selectedId, "route-rule", index),
        focusedNodeId: remapRuleDeleteId(state.focusedNodeId, "route-rule", index),
        layout: remapRuleDeleteLayout(state.layout, "route-rule", index),
      };
    }),
  addDnsRule: () => set((state) => sync(addDnsRule(state.config), state.channel, state.version)),
  updateDnsRule: (index, patch) => set((state) => sync(updateDnsRule(state.config, index, patch), state.channel, state.version)),
  moveDnsRule: (index, direction) =>
    set((state) => {
      const rules = state.config.dns?.rules ?? [];
      const target = index + direction;
      if (target < 0 || target >= rules.length || !rules[index] || !rules[target]) return state;
      return {
        ...sync(moveDnsRule(state.config, index, direction), state.channel, state.version),
        selectedId: remapRuleMoveId(state.selectedId, "dns-rule", index, target),
        focusedNodeId: remapRuleMoveId(state.focusedNodeId, "dns-rule", index, target),
        layout: remapRuleMoveLayout(state.layout, "dns-rule", index, target),
      };
    }),
  deleteDnsRule: (index) =>
    set((state) => {
      const rules = state.config.dns?.rules ?? [];
      if (!rules[index]) return state;
      return {
        ...sync(deleteDnsRule(state.config, index), state.channel, state.version),
        selectedId: remapRuleDeleteId(state.selectedId, "dns-rule", index),
        focusedNodeId: remapRuleDeleteId(state.focusedNodeId, "dns-rule", index),
        layout: remapRuleDeleteLayout(state.layout, "dns-rule", index),
      };
    }),
  setJsonDraft: (value) => set({ jsonDraft: value }),
  applyJsonDraft: () =>
    set((state) => {
      try {
        return {
          ...sync(parseConfigJson(state.jsonDraft), state.channel, state.version),
          selectedId: null,
          ...freshLayoutState(state),
          globalPanelOpen: false,
          focusedNodeId: null,
        };
      } catch (error) {
        return {
          ...resetValidationState(),
          diagnostics: [
            {
              level: "error",
              code: "json-parse",
              path: "$",
              source: "semantic",
              message: error instanceof Error ? error.message : "Invalid JSON.",
            },
          ],
        };
      }
    }),
  importJson: (value) =>
    set((state) => {
      try {
        return {
          ...sync(parseConfigJson(value), state.channel, state.version),
          selectedId: null,
          ...freshLayoutState(state),
          globalPanelOpen: false,
          focusedNodeId: null,
        };
      } catch (error) {
        return {
          ...resetValidationState(),
          jsonDraft: value,
          diagnostics: [
            {
              level: "error",
              code: "json-parse",
              path: "$",
              source: "semantic",
              message: error instanceof Error ? error.message : "Invalid JSON.",
            },
          ],
        };
      }
    }),
  refreshJson: () => set((state) => ({ jsonDraft: stringifyConfig(state.config) })),
  validateNow: () => {
    cancelSemanticValidation();
    const token = semanticValidationToken + 1;
    semanticValidationToken = token;
    set({ isChecking: true, checkNotice: "" });
    semanticValidationTimer = globalThis.setTimeout(() => {
      if (token !== semanticValidationToken) return;
      semanticValidationTimer = null;
      set((state) => {
        if (token !== semanticValidationToken) return state;
        const diagnostics = computeDiagnostics(state.config, state.channel, state.version);
        const errors = diagnostics.filter((diagnostic) => diagnostic.level === "error").length;
        const warnings = diagnostics.filter((diagnostic) => diagnostic.level === "warning").length;
        const checkedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const result = errors ? `${errors} errors` : warnings ? `${warnings} warnings` : "valid";
        const target = targetFromVersion(state.channel, state.version);
        return {
          diagnostics,
          officialValidationMessage:
            `Semantic validation complete in browser. Official fixture validation for ${target.label} uses ${target.binaryName}.`,
          checkNotice: `Checked ${checkedAt}: ${result}`,
          isChecking: false,
        };
      });
    }, 250);
  },
  runOfficialCheck: async () => {
    const rawUrl = (import.meta.env.VITE_OFFICIAL_CHECK_URL ?? "").trim();
    if (!rawUrl) return;
    const url = `${rawUrl.replace(/\/+$/, "")}/check`;

    const { channel, version, config } = get();
    const target = targetFromVersion(channel, version);

    set({ isOfficialChecking: true, officialDiagnostics: [] });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({ target: target.label, config }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: "valid" | "warning" | "invalid";
        warnings?: string[];
        errors?: string[];
        binary?: string;
        binaryVersion?: string;
      };

      const officialDiagnostics: Diagnostic[] = [];
      for (const warning of data.warnings ?? []) {
        officialDiagnostics.push({
          level: "warning",
          code: "sing-box-warning",
          path: "",
          message: warning,
          source: "official",
        });
      }
      for (const error of data.errors ?? []) {
        officialDiagnostics.push({
          level: "error",
          code: "sing-box-error",
          path: "",
          message: error,
          source: "official",
        });
      }
      if (!res.ok && officialDiagnostics.length === 0) {
        officialDiagnostics.push({
          level: "warning",
          code: "official-check-http-error",
          path: "",
          message: `Official validator returned HTTP ${res.status}.`,
          source: "official",
        });
      }

      const binaryNote = data.binaryVersion ? ` (sing-box ${data.binaryVersion})` : "";
      const officialValidationMessage = (() => {
        if (data.status === "valid") return `Official validator${binaryNote}: valid.`;
        if (data.status === "warning")
          return `Official validator${binaryNote}: ${officialDiagnostics.length} warning${officialDiagnostics.length === 1 ? "" : "s"}.`;
        if (data.status === "invalid")
          return `Official validator${binaryNote}: ${officialDiagnostics.length} error${officialDiagnostics.length === 1 ? "" : "s"}.`;
        return `Official validator unreachable: HTTP ${res.status}.`;
      })();

      set((state) => {
        if (state.config !== config || state.channel !== channel || state.version !== version) return state;
        return {
          officialDiagnostics,
          officialValidationMessage,
          isOfficialChecking: false,
        };
      });
    } catch (err) {
      set((state) => {
        if (state.config !== config || state.channel !== channel || state.version !== version) return state;
        return {
          officialDiagnostics: [
            {
              level: "warning",
              code: "official-check-unreachable",
              path: "",
              message: `Official validator unreachable: ${(err as Error).message ?? "network error"}`,
              source: "official",
            },
          ],
          officialValidationMessage: "Official validator unreachable.",
          isOfficialChecking: false,
        };
      });
    }
  },
  captureGraphPositions: (token, nodes) =>
    set((state) => {
      if (token !== state.layoutCaptureToken || token === 0) return state;
      let positions = state.layout.positions;
      let changed = false;
      for (const node of nodes) {
        if (positions[node.id]) continue;
        if (!changed) {
          positions = { ...positions };
          changed = true;
        }
        positions[node.id] = { x: node.position.x, y: node.position.y };
      }
      return {
        layoutCaptureToken: 0,
        ...(changed ? { layout: { positions } } : null),
      };
    }),
  setNodePosition: (id, position) =>
    set((state) => ({
      layout: {
        positions: {
          ...state.layout.positions,
          [id]: position,
        },
      },
    })),
}));
