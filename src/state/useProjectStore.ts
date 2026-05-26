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
import type { Diagnostic, EntityRef, ProjectLayout, SingBoxChannel, SingBoxConfig } from "../domain/types";

type PanelTab = "rules" | "dns" | "json" | "diagnostics";

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
  loadTemplate: () => void;
  loadMinimal: () => void;
  createFromPalette: (kind: string) => void;
  createCompatible: (sourceId: string, kind: string) => void;
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

const initialConfig = createStableTunSplitConfig();

export const useProjectStore = create<ProjectStore>((set, get) => ({
  channel: "stable",
  version: "stable",
  config: initialConfig,
  layout: { positions: {} },
  selectedId: "route:main",
  jsonDraft: stringifyConfig(initialConfig),
  panelTab: "rules",
  diagnostics: computeDiagnostics(initialConfig, "stable"),
  officialValidationMessage:
    "Browser validation is semantic. Run pnpm validate:fixtures for sing-box-stable / sing-box-testing CLI checks.",

  setSelectedId: (id) => set({ selectedId: id }),
  setPanelTab: (tab) => set({ panelTab: tab }),
  setChannel: (channel) => set((state) => ({ channel, diagnostics: computeDiagnostics(state.config, channel) })),

  loadTemplate: () => set((state) => sync(createStableTunSplitConfig(), state.channel)),
  loadMinimal: () => set((state) => sync(createMinimalConfig(), state.channel)),

  createFromPalette: (kind) =>
    set((state) => {
      let config = state.config;
      if (kind === "tun") config = addInbound(config, "tun");
      if (kind === "route") config = ensureRoute(config);
      if (kind === "direct") config = addOutbound(config, "direct", "direct");
      if (kind === "block") config = addOutbound(config, "block", "block");
      if (kind === "selector") config = addOutbound(config, "selector", "proxy");
      if (kind === "urltest") config = addOutbound(config, "urltest", "auto");
      if (kind === "socks") config = addOutbound(config, "socks", "proxy-out");
      if (kind === "dns-local") config = addDnsServer(config, "local");
      if (kind === "dns-https") config = addDnsServer(config, "https");
      return sync(config, state.channel);
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
        return sync(parseConfigJson(value), state.channel);
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
