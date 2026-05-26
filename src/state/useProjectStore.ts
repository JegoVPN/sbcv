import { create } from "zustand";
import {
  addDnsRule,
  addDnsServer,
  addInbound,
  addOutbound,
  addRouteRule,
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
  setDnsFinal,
  setRouteFinal,
  updateDnsRule,
  updateEntityField,
  updateRouteRule,
} from "../domain/commands";
import { validateConfig } from "../domain/diagnostics";
import { parseConfigJson, stringifyConfig } from "../domain/serialization";
import {
  dnsServerTypeForPaletteKind,
  inboundTypeForPaletteKind,
  outboundTypeForPaletteKind,
  preferredDnsServerTag,
  preferredInboundTag,
  preferredOutboundTag,
} from "../domain/protocols";
import { targetById } from "../domain/targets";
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

type ProjectStore = {
  channel: SingBoxChannel;
  version: string;
  config: SingBoxConfig;
  layout: ProjectLayout;
  selectedId: string | null;
  jsonDraft: string;
  panelTab: PanelTab;
  diagnostics: Diagnostic[];
  officialValidationMessage: string;
  setSelectedId: (id: string | null) => void;
  setPanelTab: (tab: PanelTab) => void;
  setChannel: (channel: SingBoxChannel) => void;
  setTarget: (id: SingBoxTargetId) => void;
  loadTemplate: () => void;
  loadTemplatePreset: (id: TemplatePresetId) => void;
  loadMinimal: () => void;
  createFromPalette: (kind: string) => void;
  createCompatible: (sourceId: string, kind: string) => void;
  connectOutboundReference: (outboundTag: string, reference: OutboundReferenceKind, parentTag?: string) => void;
  togglePortConnection: (nodeId: string, direction: PortDirection, port: NodePortAction) => void;
  updateField: (ref: EntityRef, field: string, value: unknown) => void;
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
  setNodePosition: (id: string, position: { x: number; y: number }) => void;
};

function computeDiagnostics(config: SingBoxConfig, channel: SingBoxChannel) {
  return validateConfig(config, channel);
}

function sync(config: SingBoxConfig, channel: SingBoxChannel) {
  return {
    config,
    jsonDraft: stringifyConfig(config),
    diagnostics: computeDiagnostics(config, channel),
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
  const [kind, ...rest] = nodeId.split(":");
  return { kind: kind ?? "", value: rest.join(":") };
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

function firstDnsRuleIndex(config: SingBoxConfig, serverTag: string) {
  return config.dns?.rules?.findIndex((rule) => rule.server === serverTag) ?? -1;
}

function firstDnsServerDetouringThrough(config: SingBoxConfig, outboundTag: string) {
  return config.dns?.servers?.find((server) => server.detour === outboundTag);
}

function firstDialableDnsServer(config: SingBoxConfig) {
  const nonDialableTypes = new Set(["local", "hosts", "fakeip"]);
  return config.dns?.servers?.find((server) => !nonDialableTypes.has(server.type));
}

function firstOutboundDetouringThrough(config: SingBoxConfig, outboundTag: string) {
  return config.outbounds?.find((outbound) => outbound.tag !== outboundTag && outbound.detour === outboundTag);
}

function firstDirectOutboundTag(config: SingBoxConfig, excludedTag: string) {
  return config.outbounds?.find((outbound) => outbound.tag !== excludedTag && outbound.type === "direct")?.tag;
}

function supportsOutboundDetour(type: string | undefined) {
  return Boolean(type && !["direct", "block", "selector", "urltest", "dns"].includes(type));
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
    if (Number.isInteger(index)) return updateRouteRule(config, index, { outbound: createdTag });
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
    return updateEntityField(config, { kind: "dns-server", tag: selected.value }, "detour", createdTag);
  }

  return config;
}

function disconnectSelectorMember(config: SingBoxConfig, parentTag: string, childTag: string, parentType: string) {
  return disconnectEdge(config, `edge:${parentType}:${parentTag}:${childTag}`);
}

const initialConfig = createStableTunSplitConfig();

export const useProjectStore = create<ProjectStore>((set) => ({
  channel: "stable",
  version: "1.13",
  config: initialConfig,
  layout: { positions: {} },
  selectedId: null,
  jsonDraft: stringifyConfig(initialConfig),
  panelTab: "rules",
  diagnostics: computeDiagnostics(initialConfig, "stable"),
  officialValidationMessage:
    "Browser validation is semantic. Run pnpm validate:fixtures for sing-box-stable / sing-box-testing CLI checks.",

  setSelectedId: (id) => set({ selectedId: id }),
  setPanelTab: (tab) => set({ panelTab: tab }),
  setChannel: (channel) =>
    set((state) => ({
      channel,
      version: channel === "stable" ? "1.13" : "1.14",
      diagnostics: computeDiagnostics(state.config, channel),
    })),
  setTarget: (id) =>
    set((state) => {
      const target = targetById(id);
      return {
        channel: target.channel,
        version: target.version,
        diagnostics: computeDiagnostics(state.config, target.channel),
      };
    }),

  loadTemplate: () =>
    set((state) => ({
      ...sync(createStableTunSplitConfig(), state.channel),
      layout: { positions: {} },
      selectedId: null,
    })),
  loadTemplatePreset: (id) =>
    set(() => {
      const preset = createTemplatePreset(id);
      return {
        ...sync(preset.config, preset.channel),
        channel: preset.channel,
        version: preset.version,
        layout: { positions: {} },
        selectedId: null,
      };
    }),
  loadMinimal: () =>
    set((state) => ({
      ...sync(createMinimalConfig(), state.channel),
      layout: { positions: {} },
      selectedId: null,
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
        if (created) selectedId = `dns-server:${created.tag}`;
      }
      if (kind === "dns-rule") config = addDnsRule(config);
      return { ...sync(config, state.channel), layout, selectedId };
    }),

  createCompatible: (sourceId, kind) =>
    set((state) => {
      let config = state.config;
      if (kind === "Route") config = ensureRoute(config);
      if (kind === "Direct") config = addOutbound(config, "direct", "direct");
      if (kind === "Block") config = addOutbound(config, "block", "block");
      if (kind === "Selector") config = addOutbound(config, "selector", "proxy");
      if (kind === "URLTest") config = addOutbound(config, "urltest", "auto");
      if (kind === "SOCKS") config = addOutbound(config, "socks", "proxy-out");
      if (kind === "DNS Server") config = addDnsServer(config, "local");

      const outbounds = config.outbounds ?? [];
      const latestOutbound = outbounds[outbounds.length - 1];
      if (latestOutbound && sourceId === "route:main") {
        config = setRouteFinal(config, latestOutbound.tag);
      }
      const sourceParts = sourceId.split(":");
      if (latestOutbound && sourceParts[0] === "outbound") {
        config = connectSelectorCandidate(config, sourceParts[1] ?? "", latestOutbound.tag);
      }
      const servers = config.dns?.servers ?? [];
      const latestServer = servers[servers.length - 1];
      if (latestServer && sourceId === "dns:main") {
        config = setDnsFinal(config, latestServer.tag);
      }

      let layout = state.layout;
      if (latestOutbound) {
        layout = nextLayout(layout, `outbound:${latestOutbound.tag}`, 1050, 140 + outbounds.length * 110);
      }
      if (latestServer) {
        layout = nextLayout(layout, `dns-server:${latestServer.tag}`, 850, 560 + servers.length * 100);
      }
      return { ...sync(config, state.channel), layout };
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
          config = updateEntityField(config, { kind: "dns-server", tag: serverTag }, "detour", outboundTag);
        }
      }

      if (reference === "outbound-detour") {
        if (parentTag) {
          config = updateEntityField(config, { kind: "outbound", tag: parentTag }, "detour", outboundTag);
        } else {
          config = addOutbound(config, "socks", preferredOutboundTag("socks"));
          const created = config.outbounds?.[config.outbounds.length - 1];
          if (created?.tag) {
            config = updateEntityField(config, { kind: "outbound", tag: created.tag }, "detour", outboundTag);
            layout = nextLayout(layout, `outbound:${created.tag}`, 2160, 260);
          }
        }
      }

      return { ...sync(config, state.channel), layout, selectedId: `outbound:${outboundTag}` };
    }),

  togglePortConnection: (nodeId, direction, port) =>
    set((state) => {
      const node = parseNodeId(nodeId);
      let config = state.config;

      if (direction === "input") {
        if (node.kind === "route" && port.key === "inbound") {
          config = addInbound(config, "tun");
          return sync(config, state.channel);
        }

        if (node.kind === "route-rule" && port.key === "route") {
          config = ensureRoute(config);
          return sync(config, state.channel);
        }

        if (node.kind === "dns" && port.key === "inbound-query") {
          config = addInbound(config, "tun");
          return sync(config, state.channel);
        }

        if (node.kind === "dns-rule" && port.key === "dns") {
          config = addDnsServer(config, "local");
          return sync(config, state.channel);
        }

        if (node.kind === "dns-server" && port.key === "dns-rule") {
          const index = firstDnsRuleIndex(config, node.value);
          config = index >= 0 ? disconnectEdge(config, `edge:dns-rule:${index}:${node.value}`) : addDnsRule(config, { domain_suffix: ["example"], server: node.value });
          return sync(config, state.channel);
        }

        if (node.kind === "dns-server" && port.key === "dns") {
          config = config.dns?.final === node.value ? disconnectEdge(config, `edge:dns-final:${node.value}`) : setDnsFinal(config, node.value);
          return sync(config, state.channel);
        }

        if (node.kind === "outbound" && port.key === "route") {
          config = config.route?.final === node.value ? disconnectEdge(config, `edge:route-final:${node.value}`) : setRouteFinal(config, node.value);
          return sync(config, state.channel);
        }

        if (node.kind === "outbound" && port.key === "route-rule") {
          const index = firstRouteRuleIndex(config, node.value);
          config = index >= 0 ? disconnectEdge(config, `edge:route-rule:${index}:${node.value}`) : addRouteRule(config, { domain_suffix: ["example"], outbound: node.value });
          return sync(config, state.channel);
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
          return sync(config, state.channel);
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
          return sync(config, state.channel);
        }

        if (node.kind === "outbound" && port.key === "detour-target") {
          const child = firstOutboundDetouringThrough(config, node.value);
          if (child) {
            config = updateEntityField(config, { kind: "outbound", tag: child.tag }, "detour", undefined);
          } else {
            config = addOutbound(config, "socks", preferredOutboundTag("socks"));
            const created = config.outbounds?.[config.outbounds.length - 1];
            if (created) config = updateEntityField(config, { kind: "outbound", tag: created.tag }, "detour", node.value);
          }
          return sync(config, state.channel);
        }
      }

      if (direction === "output") {
        if (node.kind === "inbound" && port.key === "route") {
          config = ensureRoute(config);
          return sync(config, state.channel);
        }

        if (node.kind === "route" && port.key === "route-rule") {
          const lastRuleIndex = (config.route?.rules?.length ?? 0) - 1;
          config = lastRuleIndex >= 0 ? deleteRouteRule(config, lastRuleIndex) : addRouteRule(config);
          return sync(config, state.channel);
        }

        if (node.kind === "route" && port.key === "outbound") {
          if (config.route?.final) {
            config = disconnectEdge(config, `edge:route-final:${config.route.final}`);
          } else {
            config = addOutbound(config, "direct", "direct");
            const created = config.outbounds?.[config.outbounds.length - 1];
            if (created) config = setRouteFinal(config, created.tag);
          }
          return sync(config, state.channel);
        }

        if (node.kind === "route-rule" && port.key === "outbound") {
          const index = Number(node.value);
          const outbound = Number.isInteger(index) ? config.route?.rules?.[index]?.outbound : undefined;
          if (outbound) config = disconnectEdge(config, `edge:route-rule:${index}:${outbound}`);
          else {
            config = addOutbound(config, "direct", "direct");
            const created = config.outbounds?.[config.outbounds.length - 1];
            if (created && Number.isInteger(index)) config = updateRouteRule(config, index, { outbound: created.tag });
          }
          return sync(config, state.channel);
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
          return sync(config, state.channel);
        }

        if (node.kind === "outbound" && port.key === "dial-detour") {
          const outbound = config.outbounds?.find((item) => item.tag === node.value);
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
          return sync(config, state.channel);
        }

        if (node.kind === "dns" && port.key === "dns-rule") {
          const lastRuleIndex = (config.dns?.rules?.length ?? 0) - 1;
          config = lastRuleIndex >= 0 ? deleteDnsRule(config, lastRuleIndex) : addDnsRule(config);
          return sync(config, state.channel);
        }

        if (node.kind === "dns" && port.key === "dns-server") {
          if (config.dns?.final) config = disconnectEdge(config, `edge:dns-final:${config.dns.final}`);
          else config = addDnsServer(config, "local");
          return sync(config, state.channel);
        }

        if (node.kind === "dns-rule" && port.key === "dns-server") {
          const index = Number(node.value);
          const server = Number.isInteger(index) ? config.dns?.rules?.[index]?.server : undefined;
          if (server) config = disconnectEdge(config, `edge:dns-rule:${index}:${server}`);
          else {
            config = addDnsServer(config, "local");
            const created = config.dns?.servers?.[config.dns.servers.length - 1];
            if (created && Number.isInteger(index)) config = updateDnsRule(config, index, { server: created.tag });
          }
          return sync(config, state.channel);
        }

        if (node.kind === "dns-server" && port.key === "outbound") {
          const server = config.dns?.servers?.find((item) => item.tag === node.value);
          if (server?.detour) config = updateEntityField(config, { kind: "dns-server", tag: node.value }, "detour", undefined);
          else {
            config = addOutbound(config, "direct", "direct");
            const created = config.outbounds?.[config.outbounds.length - 1];
            if (created) config = updateEntityField(config, { kind: "dns-server", tag: node.value }, "detour", created.tag);
          }
          return sync(config, state.channel);
        }
      }

      return state;
    }),

  updateField: (ref, field, value) =>
    set((state) => sync(updateEntityField(state.config, ref, field, value), state.channel)),
  renameTag: (oldTag, newTag) => set((state) => sync(renameTag(state.config, oldTag, newTag), state.channel)),
  deleteEntity: (ref) => set((state) => sync(deleteEntity(state.config, ref), state.channel)),
  disconnectEdge: (edgeId) => set((state) => sync(disconnectEdge(state.config, edgeId), state.channel)),
  addRouteRule: () => set((state) => sync(addRouteRule(state.config), state.channel)),
  updateRouteRule: (index, patch) =>
    set((state) => sync(updateRouteRule(state.config, index, patch), state.channel)),
  moveRouteRule: (index, direction) =>
    set((state) => sync(moveRouteRule(state.config, index, direction), state.channel)),
  deleteRouteRule: (index) => set((state) => sync(deleteRouteRule(state.config, index), state.channel)),
  addDnsRule: () => set((state) => sync(addDnsRule(state.config), state.channel)),
  updateDnsRule: (index, patch) => set((state) => sync(updateDnsRule(state.config, index, patch), state.channel)),
  moveDnsRule: (index, direction) => set((state) => sync(moveDnsRule(state.config, index, direction), state.channel)),
  deleteDnsRule: (index) => set((state) => sync(deleteDnsRule(state.config, index), state.channel)),
  setJsonDraft: (value) => set({ jsonDraft: value }),
  applyJsonDraft: () =>
    set((state) => {
      try {
        return sync(parseConfigJson(state.jsonDraft), state.channel);
      } catch (error) {
        return {
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
        return { ...sync(parseConfigJson(value), state.channel), selectedId: null, layout: { positions: {} } };
      } catch (error) {
        return {
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
  validateNow: () =>
    set((state) => ({
      diagnostics: computeDiagnostics(state.config, state.channel),
      officialValidationMessage:
        "Semantic validation complete in browser. Official CLI validation runs through pnpm validate:fixtures.",
    })),
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

export function getSelectedRef(): EntityRef | null {
  const selectedId = useProjectStore.getState().selectedId;
  const { config } = useProjectStore.getState();
  if (!selectedId) return null;
  const [kind, rest] = selectedId.split(":");
  if (kind === "inbound" && rest) return { kind: "inbound", tag: rest };
  if (kind === "outbound" && rest) return { kind: "outbound", tag: rest };
  if (kind === "dns-server" && rest) return { kind: "dns-server", tag: rest };
  if (kind === "route") return { kind: "route", id: "main" };
  if (kind === "dns") return { kind: "dns", id: "main" };
  if (kind === "settings" && rest) return { kind: "settings", path: rest as keyof SingBoxConfig };
  if (kind === "route-rule") {
    const index = Number(rest);
    if (Number.isInteger(index) && config.route?.rules?.[index]) return { kind: "route-rule", index };
  }
  if (kind === "dns-rule") {
    const index = Number(rest);
    if (Number.isInteger(index) && config.dns?.rules?.[index]) return { kind: "dns-rule", index };
  }
  return null;
}
