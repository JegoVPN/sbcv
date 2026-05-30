import { useEffect, useMemo, useRef, useState } from "react";
import { Braces, Network, Route, Server, Trash2, X } from "lucide-react";
import { getNodeIcon } from "../canvas/iconRegistry";
import type { EntityRef, SingBoxChannel, SingBoxConfig } from "../domain/types";
import {
  CREATABLE_DNS_SERVER_TYPES,
  CREATABLE_ENDPOINT_TYPES,
  CREATABLE_INBOUND_TYPES,
  CREATABLE_OUTBOUND_TYPES,
  CREATABLE_RULE_SET_TYPES,
  CREATABLE_SERVICE_TYPES,
} from "../domain/protocols";
import type { SharedFieldGroupId } from "../domain/sharedFieldRegistry";
import { sharedGroupsForEntity } from "../domain/sharedFieldRegistry";
import { JsonField, ModuleCard, PlatformBanner, SensitiveTextField } from "./inspector/controls";
import { AdvancedNonScalarFields, AdvancedScalarFields } from "./inspector/advancedFields";
import { InlineRuleSetEditor } from "./inspector/ruleControls";
import { DnsRuleInspector, RouteRuleInspector } from "./inspector/ruleInspectors";
import {
  certificateProviderFields,
  SharedFieldCards,
  SharedFieldControl,
  sharedFieldDefinitions,
} from "./inspector/sharedFields";
import {
  certificateProviderHandledFields,
  dnsServerHandledFieldsForChannel,
  endpointHandledFields,
  inboundHandledFields,
  outboundHandledFields,
  ruleSetHandledFields,
  serviceHandledFields,
} from "./inspector/handledFields";
// Preserve the public API the C17 guard test imports from this module (moved to inspector/handledFields).
export { INLINE_RENDERED_KEYS, inboundHandledFields, outboundHandledFields, structurallyCoveredKeys } from "./inspector/handledFields";
import {
  endpointTags,
  fromList,
  type InspectorEntity,
  inboundTags,
  labelForField,
  objectField,
  outboundTags,
  toList,
  type UpdateField,
  withUniqueBlankKey,
} from "./inspector/helpers";
import { useProjectStore } from "../state/useProjectStore";
import { DnsRulesTable, RouteRulesTable } from "./RuleTables";

// Preserve the public API: withUniqueBlankKey moved to inspector/helpers (C14) but is imported by tests
// from this module.
export { withUniqueBlankKey } from "./inspector/helpers";

function selectedRefFromId(id: string | null): EntityRef | null {
  if (!id) return null;
  const separator = id.indexOf(":");
  const kind = separator >= 0 ? id.slice(0, separator) : id;
  const value = separator >= 0 ? id.slice(separator + 1) : "";
  if (kind === "inbound" && value) return { kind: "inbound", tag: value };
  if (kind === "outbound" && value) return { kind: "outbound", tag: value };
  if (kind === "dns-server" && value) return { kind: "dns-server", tag: value };
  if (kind === "endpoint" && value) return { kind: "endpoint", tag: value };
  if (kind === "service" && value) return { kind: "service", tag: value };
  if (kind === "rule-set" && value) return { kind: "rule-set", tag: value };
  if (kind === "certificate-provider" && value) return { kind: "certificate-provider", tag: value };
  if (kind === "http-client" && value) return { kind: "http-client", tag: value };
  if (kind === "route") return { kind: "route", id: "main" };
  if (kind === "dns") return { kind: "dns", id: "main" };
  if (kind === "route-rule" && value) return { kind: "route-rule", index: Number(value) };
  if (kind === "dns-rule" && value) return { kind: "dns-rule", index: Number(value) };
  if (kind === "settings" && value) return { kind: "settings", path: value as keyof SingBoxConfig };
  return null;
}

function generatedIndex(value: string, kind: "inbound" | "outbound" | "dns-server" | "endpoint" | "service" | "rule-set" | "certificate-provider" | "http-client") {
  const prefix = `untagged-${kind}-`;
  if (!value.startsWith(prefix)) return -1;
  const index = Number(value.slice(prefix.length)) - 1;
  return Number.isInteger(index) && index >= 0 ? index : -1;
}

function findTaggedOrGenerated<T extends { tag?: string }>(
  items: T[] | undefined,
  tag: string,
  kind: "inbound" | "outbound" | "dns-server" | "endpoint" | "service" | "rule-set" | "certificate-provider" | "http-client",
) {
  const byTag = items?.find((item) => item.tag === tag);
  if (byTag) return byTag;
  const index = generatedIndex(tag, kind);
  return index >= 0 ? items?.[index] : undefined;
}

function endpointReferences(config: SingBoxConfig, tag: string) {
  return {
    tailscaleDnsServers: config.dns?.servers?.filter((server) => server.type === "tailscale" && server.endpoint === tag).map((server) => server.tag) ?? [],
    derpServices:
      config.services
        ?.filter((service) => {
          const refs = service.verify_client_endpoint;
          return Array.isArray(refs) ? refs.includes(tag) : refs === tag;
        })
        .map((service) => service.tag ?? service.type) ?? [],
    certificateProviders: config.certificate_providers?.filter((provider) => provider.endpoint === tag).map((provider) => provider.tag) ?? [],
  };
}

function formatReferenceList(items: string[] | number[]) {
  return items.length ? items.join(", ") : "none";
}

type InboundUserField = {
  key: string;
  label: string;
  sensitive?: boolean;
  type?: "text" | "number";
  enum?: ReadonlyArray<{ value: string; label?: string }>;
};

type InboundUserSchema = {
  fields: InboundUserField[];
  defaultUser: (index: number) => Record<string, unknown>;
};

const INBOUND_USER_SCHEMAS: Record<string, InboundUserSchema> = {
  socks: {
    fields: [
      { key: "username", label: "Username" },
      { key: "password", label: "Password", sensitive: true },
    ],
    defaultUser: (n) => ({ username: `user${n}`, password: "" }),
  },
  http: {
    fields: [
      { key: "username", label: "Username" },
      { key: "password", label: "Password", sensitive: true },
    ],
    defaultUser: (n) => ({ username: `user${n}`, password: "" }),
  },
  mixed: {
    fields: [
      { key: "username", label: "Username" },
      { key: "password", label: "Password", sensitive: true },
    ],
    defaultUser: (n) => ({ username: `user${n}`, password: "" }),
  },
  naive: {
    fields: [
      { key: "username", label: "Username" },
      { key: "password", label: "Password", sensitive: true },
    ],
    defaultUser: (n) => ({ username: `user${n}`, password: "" }),
  },
  shadowsocks: {
    fields: [
      { key: "name", label: "Name" },
      { key: "password", label: "Password", sensitive: true },
    ],
    defaultUser: (n) => ({ name: `user${n}`, password: "" }),
  },
  shadowtls: {
    fields: [
      { key: "name", label: "Name" },
      { key: "password", label: "Password (v3)", sensitive: true },
    ],
    defaultUser: (n) => ({ name: `user${n}`, password: "" }),
  },
  trojan: {
    fields: [
      { key: "name", label: "Name" },
      { key: "password", label: "Password", sensitive: true },
    ],
    defaultUser: (n) => ({ name: `user${n}`, password: "" }),
  },
  vmess: {
    fields: [
      { key: "name", label: "Name" },
      { key: "uuid", label: "UUID", sensitive: true },
      { key: "alterId", label: "Alter ID", type: "number" },
    ],
    defaultUser: (n) => ({ name: `user${n}`, uuid: "", alterId: 0 }),
  },
  vless: {
    fields: [
      { key: "name", label: "Name" },
      { key: "uuid", label: "UUID", sensitive: true },
      {
        key: "flow",
        label: "Flow",
        enum: [
          { value: "", label: "(none)" },
          { value: "xtls-rprx-vision", label: "xtls-rprx-vision" },
        ],
      },
    ],
    defaultUser: (n) => ({ name: `user${n}`, uuid: "" }),
  },
  tuic: {
    fields: [
      { key: "name", label: "Name" },
      { key: "uuid", label: "UUID", sensitive: true },
      { key: "password", label: "Password", sensitive: true },
    ],
    defaultUser: (n) => ({ name: `user${n}`, uuid: "", password: "" }),
  },
  hysteria: {
    fields: [
      { key: "name", label: "Name" },
      { key: "auth_str", label: "Auth String", sensitive: true },
    ],
    defaultUser: (n) => ({ name: `user${n}`, auth_str: "" }),
  },
  hysteria2: {
    fields: [
      { key: "name", label: "Name" },
      { key: "password", label: "Password", sensitive: true },
    ],
    defaultUser: (n) => ({ name: `user${n}`, password: "" }),
  },
  anytls: {
    fields: [
      { key: "name", label: "Name" },
      { key: "password", label: "Password", sensitive: true },
    ],
    defaultUser: (n) => ({ name: `user${n}`, password: "" }),
  },
};

export function Inspector({ compact = false }: { compact?: boolean } = {}) {
  const selectedId = useProjectStore((state) => state.selectedId);
  const config = useProjectStore((state) => state.config);
  const channel = useProjectStore((state) => state.channel);
  const updateField = useProjectStore((state) => state.updateField);
  const updateRouteRule = useProjectStore((state) => state.updateRouteRule);
  const updateDnsRule = useProjectStore((state) => state.updateDnsRule);
  const changeEntityType = useProjectStore((state) => state.changeEntityType);
  const renameTag = useProjectStore((state) => state.renameTag);
  const deleteEntity = useProjectStore((state) => state.deleteEntity);
  const setSelectedId = useProjectStore((state) => state.setSelectedId);
  const ref = useMemo(() => selectedRefFromId(selectedId), [selectedId]);
  const entity = useMemo<InspectorEntity | null>(() => {
    if (!ref) return null;
    if (ref.kind === "inbound") return (findTaggedOrGenerated(config.inbounds, ref.tag, "inbound") as InspectorEntity | undefined) ?? null;
    if (ref.kind === "outbound") return (findTaggedOrGenerated(config.outbounds, ref.tag, "outbound") as InspectorEntity | undefined) ?? null;
    if (ref.kind === "dns-server") {
      return (findTaggedOrGenerated(config.dns?.servers, ref.tag, "dns-server") as InspectorEntity | undefined) ?? null;
    }
    if (ref.kind === "endpoint") return (findTaggedOrGenerated(config.endpoints, ref.tag, "endpoint") as InspectorEntity | undefined) ?? null;
    if (ref.kind === "service") return (findTaggedOrGenerated(config.services, ref.tag, "service") as InspectorEntity | undefined) ?? null;
    if (ref.kind === "rule-set") return (findTaggedOrGenerated(config.route?.rule_set, ref.tag, "rule-set") as InspectorEntity | undefined) ?? null;
    if (ref.kind === "certificate-provider") return (findTaggedOrGenerated(config.certificate_providers, ref.tag, "certificate-provider") as InspectorEntity | undefined) ?? null;
    if (ref.kind === "http-client") return (findTaggedOrGenerated(config.http_clients, ref.tag, "http-client") as InspectorEntity | undefined) ?? null;
    if (ref.kind === "route") return (config.route as InspectorEntity | undefined) ?? null;
    if (ref.kind === "dns") return (config.dns as InspectorEntity | undefined) ?? null;
    if (ref.kind === "route-rule") return (config.route?.rules?.[ref.index] as InspectorEntity | undefined) ?? null;
    if (ref.kind === "dns-rule") return (config.dns?.rules?.[ref.index] as InspectorEntity | undefined) ?? null;
    if (ref.kind === "settings") {
      const entity = config[ref.path];
      return entity && typeof entity === "object" && !Array.isArray(entity)
        ? (entity as InspectorEntity)
        : null;
    }
    return null;
  }, [config, ref]);
  const [tagDraft, setTagDraft] = useState("");
  const [tagDraftFocused, setTagDraftFocused] = useState(false);
  const tagValue = typeof entity?.tag === "string" ? entity.tag : null;

  useEffect(() => {
    if (tagDraftFocused) return;
    setTagDraft(tagValue ?? "");
  }, [tagDraftFocused, tagValue]);

  if (!ref || !entity) return null;

  const entityType = typeof entity.type === "string" ? entity.type : null;
  const requestTypeChange = (nextType: string) => {
    if (!ref || nextType === entityType) return;
    // Confirm before a type change discards type-specific fields the new type won't keep (W7 / T3).
    // "Meaningful" = own fields with a non-empty value (ignore tag/type and empty scaffold defaults).
    const hasMeaningfulFields = Object.entries(entity as Record<string, unknown>).some(([key, value]) => {
      if (key === "tag" || key === "type" || value == null || value === "") return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
      return true;
    });
    // Leaving tailscale (endpoint) / resolved (service) scrubs references to this entity elsewhere.
    const scrubsRefs = (ref.kind === "endpoint" && nextType !== "tailscale") || (ref.kind === "service" && nextType !== "resolved");
    if (
      (hasMeaningfulFields || scrubsRefs) &&
      !window.confirm(
        `Change this ${ref.kind} to "${nextType}"? Fields specific to the current type are discarded${scrubsRefs ? ", and references to it elsewhere are removed" : ""}.`,
      )
    ) {
      return;
    }
    changeEntityType(ref, nextType);
  };
  // Settings entities carry no canonical `type`; deriveGraph uses the ref path (log/ntp/experimental)
  // as the node type, so match it here to keep the header icon consistent with the node card.
  const iconType = ref.kind === "settings" ? String(ref.path) : entityType ?? "";
  const InspectorIcon = getNodeIcon(ref.kind, iconType);
  const selectedEndpointReferences =
    ref.kind === "endpoint" && tagValue ? endpointReferences(config, tagValue) : null;
  const sharedGroups = sharedGroupsForEntity(ref, entityType, channel);

  return (
    <aside className={`inspector ${compact ? "inspector--compact" : ""}`} aria-label="Node inspector" data-testid="node-inspector">
      <div className="inspector__header" data-testid="inspector-header">
        <div className="inspector__title">
          <InspectorIcon size={18} />
          <span>{ref.kind}</span>
        </div>
        <button type="button" className="node-icon-button" aria-label="Close inspector" onClick={() => setSelectedId(null)}>
          <X size={16} />
        </button>
      </div>
      <div className="inspector-heading">
        <div>
          <div className="inspector-kind">{ref.kind}</div>
          <h2>{tagValue ?? ref.kind}</h2>
        </div>
        {ref.kind !== "route" && ref.kind !== "dns" ? (
          <button type="button" className="icon-danger" onClick={() => deleteEntity(ref)}>
            <Trash2 size={15} />
          </button>
        ) : null}
      </div>

      {ref.kind === "route" ? (
        <>
          <label className="field">
            <span>Final Outbound</span>
            <select
              value={typeof entity.final === "string" ? entity.final : ""}
              onChange={(event) => updateField(ref, "final", event.target.value || undefined)}
            >
              <option value="">First outbound</option>
              {outboundTags(config).map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.auto_detect_interface)}
              onChange={(event) =>
                updateField(ref, "auto_detect_interface", event.target.checked || undefined)
              }
            />
            <span>Auto detect interface</span>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.override_android_vpn)}
              onChange={(event) =>
                updateField(ref, "override_android_vpn", event.target.checked || undefined)
              }
            />
            <span>Override Android VPN</span>
          </label>
          <label className="field">
            <span>Default Interface</span>
            <input
              value={typeof entity.default_interface === "string" ? entity.default_interface : ""}
              placeholder="e.g. eth0 (Linux/macOS, requires permissions)"
              onChange={(event) =>
                updateField(ref, "default_interface", event.target.value || undefined)
              }
            />
          </label>
          <label className="field">
            <span>Default Routing Mark (Linux)</span>
            <input
              type="number"
              value={typeof entity.default_mark === "number" ? entity.default_mark : ""}
              placeholder="0..2147483647 (Linux fwmark)"
              onChange={(event) => {
                const next = event.target.value;
                if (!next) {
                  updateField(ref, "default_mark", undefined);
                  return;
                }
                const parsed = Number(next);
                updateField(ref, "default_mark", Number.isFinite(parsed) ? parsed : undefined);
              }}
            />
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.find_process)}
              onChange={(event) =>
                updateField(ref, "find_process", event.target.checked || undefined)
              }
            />
            <span>Find process (process matchers in rules)</span>
          </label>
          {/* default_network_strategy / default_network_type are rendered by the shared Dial group
              (string[] list), so no hardcoded duplicates here (W24). */}
          <RouteRulesTable />
        </>
      ) : null}
      {ref.kind === "dns" ? (
        <>
          <label className="field">
            <span>Final DNS Server</span>
            <select
              value={typeof entity.final === "string" ? entity.final : ""}
              onChange={(event) => updateField(ref, "final", event.target.value || undefined)}
            >
              <option value="">First DNS server</option>
              {(config.dns?.servers ?? [])
                .map((server) => server.tag)
                .filter((tag): tag is string => Boolean(tag))
                .map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>Strategy</span>
            <select
              value={typeof entity.strategy === "string" ? entity.strategy : ""}
              onChange={(event) => updateField(ref, "strategy", event.target.value || undefined)}
            >
              <option value="">(default)</option>
              <option value="prefer_ipv4">prefer_ipv4</option>
              <option value="prefer_ipv6">prefer_ipv6</option>
              <option value="ipv4_only">ipv4_only</option>
              <option value="ipv6_only">ipv6_only</option>
            </select>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.disable_cache)}
              onChange={(event) => updateField(ref, "disable_cache", event.target.checked || undefined)}
            />
            <span>Disable cache</span>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.disable_expire)}
              onChange={(event) => updateField(ref, "disable_expire", event.target.checked || undefined)}
            />
            <span>Disable expire</span>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.independent_cache)}
              onChange={(event) =>
                updateField(ref, "independent_cache", event.target.checked || undefined)
              }
            />
            <span>Independent cache</span>
          </label>
          <label className="field">
            <span>Cache Capacity</span>
            <input
              type="number"
              value={Number(entity.cache_capacity ?? 0)}
              onChange={(event) => updateField(ref, "cache_capacity", Number(event.target.value) || undefined)}
            />
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.reverse_mapping)}
              onChange={(event) => updateField(ref, "reverse_mapping", event.target.checked || undefined)}
            />
            <span>Reverse mapping</span>
          </label>
          <label className="field">
            <span>Client Subnet</span>
            <input
              type="text"
              value={typeof entity.client_subnet === "string" ? entity.client_subnet : ""}
              onChange={(event) => updateField(ref, "client_subnet", event.target.value || undefined)}
            />
          </label>
          {(() => {
            const fakeip = objectField(entity.fakeip);
            const writeFakeip = (next: InspectorEntity) =>
              updateField(ref, "fakeip", Object.keys(next).length ? next : undefined);
            return (
              <fieldset className="field field--checklist" data-testid="dns-hub-fakeip">
                <legend>FakeIP</legend>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={Boolean(fakeip.enabled)}
                    onChange={(event) => {
                      if (event.target.checked) writeFakeip({ ...fakeip, enabled: true });
                      else {
                        const { enabled: _e, ...rest } = fakeip as Record<string, unknown>;
                        writeFakeip(rest);
                      }
                    }}
                  />
                  <span>FakeIP enabled</span>
                </label>
                <label className="field">
                  <span>IPv4 Range</span>
                  <input
                    value={typeof fakeip.inet4_range === "string" ? fakeip.inet4_range : ""}
                    placeholder="198.18.0.0/15"
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) {
                        const { inet4_range: _v, ...rest } = fakeip as Record<string, unknown>;
                        writeFakeip(rest);
                      } else {
                        writeFakeip({ ...fakeip, inet4_range: value });
                      }
                    }}
                  />
                </label>
                <label className="field">
                  <span>IPv6 Range</span>
                  <input
                    value={typeof fakeip.inet6_range === "string" ? fakeip.inet6_range : ""}
                    placeholder="fc00::/18"
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) {
                        const { inet6_range: _v, ...rest } = fakeip as Record<string, unknown>;
                        writeFakeip(rest);
                      } else {
                        writeFakeip({ ...fakeip, inet6_range: value });
                      }
                    }}
                  />
                </label>
              </fieldset>
            );
          })()}
          <PlatformBanner
            kind="channel"
            text="The next two fields (Optimistic, Timeout) only take effect on sing-box 1.14+ (testing channel)."
          />
          <label className="toggle-row" data-testid="dns-hub-optimistic">
            <input
              type="checkbox"
              checked={Boolean(entity.optimistic)}
              onChange={(event) => updateField(ref, "optimistic", event.target.checked || undefined)}
            />
            <span>Optimistic (testing 1.14+)</span>
          </label>
          <label className="field" data-testid="dns-hub-timeout">
            <span>Timeout (testing 1.14+, e.g. "5s")</span>
            <input
              value={typeof entity.timeout === "string" ? entity.timeout : ""}
              placeholder="5s"
              onChange={(event) => updateField(ref, "timeout", event.target.value || undefined)}
            />
          </label>
          <DnsRulesTable />
        </>
      ) : null}
      {ref.kind === "route-rule" ? (
        <RouteRuleInspector index={ref.index} rule={entity} config={config} updateRouteRule={updateRouteRule} />
      ) : null}
      {ref.kind === "dns-rule" ? (
        <DnsRuleInspector index={ref.index} rule={entity} config={config} channel={channel} updateDnsRule={updateDnsRule} />
      ) : null}

      {tagValue ? (
        <label className="field">
          <span>Tag</span>
          <input
            value={tagDraft}
            onFocus={() => setTagDraftFocused(true)}
            onChange={(event) => setTagDraft(event.target.value)}
            onBlur={() => {
              setTagDraftFocused(false);
              renameTag(tagValue, tagDraft);
            }}
          />
        </label>
      ) : null}

      {entityType ? (
        <label className="field">
          <span>Type</span>
          {ref.kind === "inbound" ? (
            <select value={entityType} onChange={(event) => requestTypeChange(event.target.value)}>
              {CREATABLE_INBOUND_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          ) : ref.kind === "outbound" ? (
            <select value={entityType} onChange={(event) => requestTypeChange(event.target.value)}>
              {CREATABLE_OUTBOUND_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          ) : ref.kind === "dns-server" ? (
            <select value={entityType} onChange={(event) => requestTypeChange(event.target.value)}>
              {CREATABLE_DNS_SERVER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          ) : ref.kind === "endpoint" ? (
            <select value={entityType} onChange={(event) => requestTypeChange(event.target.value)}>
              {CREATABLE_ENDPOINT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          ) : ref.kind === "service" ? (
            <select value={entityType} onChange={(event) => requestTypeChange(event.target.value)}>
              {CREATABLE_SERVICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          ) : ref.kind === "rule-set" ? (
            <select value={entityType} onChange={(event) => requestTypeChange(event.target.value)}>
              {CREATABLE_RULE_SET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          ) : (
            <input value={entityType} disabled />
          )}
        </label>
      ) : null}

      {ref.kind === "settings" && ref.path === "log" ? (
        <>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.disabled)}
              onChange={(event) => updateField(ref, "disabled", event.target.checked || undefined)}
            />
            <span>Disable log</span>
          </label>
          <label className="field">
            <span>Level</span>
            <select
              value={String(entity.level ?? "info")}
              onChange={(event) => updateField(ref, "level", event.target.value)}
              disabled={Boolean(entity.disabled)}
            >
              <option value="trace">trace</option>
              <option value="debug">debug</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
              <option value="fatal">fatal</option>
              <option value="panic">panic</option>
            </select>
          </label>
          <label className="field">
            <span>Output</span>
            <input
              value={String(entity.output ?? "")}
              onChange={(event) => updateField(ref, "output", event.target.value || undefined)}
              placeholder="file path (omit to use console)"
              disabled={Boolean(entity.disabled)}
            />
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.timestamp)}
              onChange={(event) => updateField(ref, "timestamp", event.target.checked || undefined)}
              disabled={Boolean(entity.disabled)}
            />
            <span>Prefix each line with a timestamp</span>
          </label>
        </>
      ) : null}

      {ref.kind === "settings" && ref.path === "ntp" ? (
        <>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.enabled)}
              onChange={(event) => updateField(ref, "enabled", event.target.checked)}
            />
            <span>Enable NTP</span>
          </label>
          <label className="field">
            <span>Server</span>
            <input
              value={String(entity.server ?? "")}
              onChange={(event) => updateField(ref, "server", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Port</span>
            <input
              type="number"
              value={Number(entity.server_port ?? 123)}
              onChange={(event) => updateField(ref, "server_port", Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Interval</span>
            <input
              value={String(entity.interval ?? "30m")}
              onChange={(event) => updateField(ref, "interval", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Detour</span>
            <select
              value={typeof entity.detour === "string" ? entity.detour : ""}
              onChange={(event) => updateField(ref, "detour", event.target.value || undefined)}
            >
              <option value="">(default outbound)</option>
              {outboundTags(config).map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      {ref.kind === "settings" && ref.path === "certificate" ? (
        <>
          <label className="field">
            <span>Store</span>
            <select
              value={String(entity.store ?? "system")}
              onChange={(event) => updateField(ref, "store", event.target.value)}
            >
              <option value="system">system</option>
              <option value="mozilla">mozilla</option>
              <option value="chrome">chrome</option>
              <option value="none">none</option>
            </select>
          </label>
          <label className="field">
            <span>Certificate PEM</span>
            <textarea
              rows={8}
              value={Array.isArray(entity.certificate) ? (entity.certificate as string[]).join("\n\n") : ""}
              onChange={(event) => {
                const raw = event.target.value;
                if (!raw.trim()) {
                  updateField(ref, "certificate", undefined);
                  return;
                }
                const blocks = raw
                  .split(/\n{2,}/)
                  .map((block) => block.replace(/^\s+|\s+$/g, ""))
                  .filter(Boolean);
                updateField(ref, "certificate", blocks.length ? blocks : undefined);
              }}
              placeholder={"Paste one or more PEM blocks.\nSeparate multiple certificates with a blank line."}
            />
          </label>
          <label className="field">
            <span>Certificate Paths</span>
            <input
              value={toList(entity.certificate_path)}
              onChange={(event) => updateField(ref, "certificate_path", fromList(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Certificate Directory Paths</span>
            <input
              value={toList(entity.certificate_directory_path)}
              onChange={(event) => updateField(ref, "certificate_directory_path", fromList(event.target.value))}
            />
          </label>
        </>
      ) : null}

      {ref.kind === "settings" && ref.path === "experimental" ? (
        (() => {
          const cacheFile = objectField(entity.cache_file);
          const clashApi = objectField(entity.clash_api);
          const v2rayApi = objectField(entity.v2ray_api);
          const v2rayStats = objectField(v2rayApi.stats);
          const clashEnabled = Boolean(clashApi.external_controller || clashApi.secret || clashApi.default_mode);
          const v2rayEnabled = Boolean(v2rayApi.listen || v2rayStats.enabled);
          return (
            <div className="settings-module-list" aria-label="Experimental modules">
              <ModuleCard title="Cache File" active={Boolean(cacheFile.enabled)}>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={Boolean(cacheFile.enabled)}
                    onChange={(event) => updateField(ref, "cache_file", { ...cacheFile, enabled: event.target.checked })}
                  />
                  <span>Enable cache file</span>
                </label>
                <label className="field">
                  <span>Path</span>
                  <input
                    value={String(cacheFile.path ?? "")}
                    onChange={(event) => updateField(ref, "cache_file", { ...cacheFile, path: event.target.value })}
                    placeholder="cache.db"
                  />
                </label>
                <label className="field">
                  <span>Cache ID</span>
                  <input
                    value={String(cacheFile.cache_id ?? "")}
                    onChange={(event) => updateField(ref, "cache_file", { ...cacheFile, cache_id: event.target.value })}
                  />
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={Boolean(cacheFile.store_fakeip)}
                    onChange={(event) => updateField(ref, "cache_file", { ...cacheFile, store_fakeip: event.target.checked })}
                  />
                  <span>Store FakeIP</span>
                </label>
                {channel === "testing" && Boolean(cacheFile.store_rdrc) ? (
                  <PlatformBanner
                    kind="deprecated"
                    text="store_rdrc (caches only rejected / address-filter DNS results) is deprecated in 1.14 and will be removed in 1.16. Use store_dns, which persists the full DNS cache."
                  />
                ) : null}
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={Boolean(cacheFile.store_rdrc)}
                    onChange={(event) =>
                      updateField(ref, "cache_file", {
                        ...cacheFile,
                        store_rdrc: event.target.checked || undefined,
                      })
                    }
                  />
                  <span>Store RDRC (rejected-response cache)</span>
                </label>
                {Boolean(cacheFile.store_rdrc) ? (
                  <label className="field">
                    <span>RDRC Timeout</span>
                    <input
                      value={String(cacheFile.rdrc_timeout ?? "")}
                      onChange={(event) =>
                        updateField(ref, "cache_file", {
                          ...cacheFile,
                          rdrc_timeout: event.target.value || undefined,
                        })
                      }
                      placeholder="30m"
                    />
                  </label>
                ) : null}
                {channel === "testing" ? (
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={Boolean(cacheFile.store_dns)}
                      onChange={(event) =>
                        updateField(ref, "cache_file", {
                          ...cacheFile,
                          store_dns: event.target.checked || undefined,
                        })
                      }
                    />
                    <span>Store DNS responses (1.14 testing)</span>
                  </label>
                ) : null}
              </ModuleCard>

              <ModuleCard title="Clash API" active={clashEnabled}>
                <label className="field">
                  <span>Controller</span>
                  <input
                    value={String(clashApi.external_controller ?? "")}
                    onChange={(event) =>
                      updateField(ref, "clash_api", { ...clashApi, external_controller: event.target.value })
                    }
                    placeholder="127.0.0.1:9090"
                  />
                </label>
                <SensitiveTextField
                  label="Secret"
                  value={String(clashApi.secret ?? "")}
                  onChange={(next) => updateField(ref, "clash_api", { ...clashApi, secret: next })}
                />
                <label className="field">
                  <span>Default Mode</span>
                  <select
                    value={String(clashApi.default_mode ?? "")}
                    onChange={(event) =>
                      updateField(ref, "clash_api", { ...clashApi, default_mode: event.target.value || undefined })
                    }
                  >
                    <option value="">(unset)</option>
                    <option value="rule">rule</option>
                    <option value="global">global</option>
                    <option value="direct">direct</option>
                  </select>
                </label>
                <label className="field">
                  <span>External UI Directory</span>
                  <input
                    value={String(clashApi.external_ui ?? "")}
                    onChange={(event) =>
                      updateField(ref, "clash_api", { ...clashApi, external_ui: event.target.value || undefined })
                    }
                    placeholder="./ui or absolute path"
                  />
                </label>
                <label className="field">
                  <span>External UI Download URL</span>
                  <input
                    value={String(clashApi.external_ui_download_url ?? "")}
                    onChange={(event) =>
                      updateField(ref, "clash_api", {
                        ...clashApi,
                        external_ui_download_url: event.target.value || undefined,
                      })
                    }
                    placeholder="https://… (auto-extracted to external_ui)"
                  />
                </label>
                <label className="field">
                  <span>External UI Download Detour</span>
                  <select
                    value={String(clashApi.external_ui_download_detour ?? "")}
                    onChange={(event) =>
                      updateField(ref, "clash_api", {
                        ...clashApi,
                        external_ui_download_detour: event.target.value || undefined,
                      })
                    }
                  >
                    <option value="">(default outbound)</option>
                    {outboundTags(config).map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </label>
                <details className="advanced-fields">
                  <summary>Advanced CORS <span>2</span></summary>
                  <div className="advanced-fields__body">
                    <label className="field">
                      <span>Allowed Origins</span>
                      <input
                        value={toList(clashApi.access_control_allow_origin)}
                        onChange={(event) =>
                          updateField(ref, "clash_api", {
                            ...clashApi,
                            access_control_allow_origin: fromList(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={Boolean(clashApi.access_control_allow_private_network)}
                        onChange={(event) =>
                          updateField(ref, "clash_api", {
                            ...clashApi,
                            access_control_allow_private_network: event.target.checked,
                          })
                        }
                      />
                      <span>Allow private network</span>
                    </label>
                  </div>
                </details>
              </ModuleCard>

              <ModuleCard title="V2Ray API" active={v2rayEnabled}>
                <PlatformBanner
                  kind="build-tag"
                  text="Build-tag gate: V2Ray API requires sing-box built with the `with_v2ray_api` tag, which is not in the default build. Enabling listen + stats on a build without it fails at runtime."
                />
                <label className="field">
                  <span>Listen</span>
                  <input
                    value={String(v2rayApi.listen ?? "")}
                    onChange={(event) => updateField(ref, "v2ray_api", { ...v2rayApi, listen: event.target.value })}
                  />
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={Boolean(v2rayStats.enabled)}
                    onChange={(event) =>
                      updateField(ref, "v2ray_api", {
                        ...v2rayApi,
                        stats: { ...v2rayStats, enabled: event.target.checked },
                      })
                    }
                  />
                  <span>Enable stats</span>
                </label>
                <label className="field" data-testid="v2ray-stats-inbounds">
                  <span>Stats Inbounds (CSV of inbound tags)</span>
                  <input
                    value={toList(v2rayStats.inbounds)}
                    placeholder="mixed-in, tun-in"
                    onChange={(event) => {
                      const next = fromList(event.target.value);
                      updateField(ref, "v2ray_api", {
                        ...v2rayApi,
                        stats: { ...v2rayStats, inbounds: next.length ? next : undefined },
                      });
                    }}
                  />
                </label>
                <label className="field" data-testid="v2ray-stats-outbounds">
                  <span>Stats Outbounds (CSV of outbound tags)</span>
                  <input
                    value={toList(v2rayStats.outbounds)}
                    placeholder="proxy, direct"
                    onChange={(event) => {
                      const next = fromList(event.target.value);
                      updateField(ref, "v2ray_api", {
                        ...v2rayApi,
                        stats: { ...v2rayStats, outbounds: next.length ? next : undefined },
                      });
                    }}
                  />
                </label>
                <label className="field" data-testid="v2ray-stats-users">
                  <span>Stats Users (CSV of vmess/vless usernames)</span>
                  <input
                    value={toList(v2rayStats.users)}
                    placeholder="alice, bob"
                    onChange={(event) => {
                      const next = fromList(event.target.value);
                      updateField(ref, "v2ray_api", {
                        ...v2rayApi,
                        stats: { ...v2rayStats, users: next.length ? next : undefined },
                      });
                    }}
                  />
                </label>
              </ModuleCard>
            </div>
          );
        })()
      ) : null}

      {ref.kind === "inbound" ? (
        <>
          {entityType === "hysteria" ? (
            <PlatformBanner
              kind="deprecated"
              text="Hysteria v1 is legacy — prefer `hysteria2` for new deployments."
            />
          ) : null}
          {entityType === "redirect" ? (
            <PlatformBanner
              kind="platform"
              text="Platform gate: redirect inbound is supported on Linux and macOS only (Linux iptables REDIRECT / macOS pf). Exports are produced on any host but the sing-box runtime will refuse to start on Windows/Android/iOS."
            />
          ) : null}
          {entityType === "tproxy" ? (
            <PlatformBanner
              kind="platform"
              text="Platform gate: TProxy inbound only works on Linux (iptables TPROXY). Exports work on any host but sing-box will refuse to start elsewhere."
            />
          ) : null}
          {entityType === "tun" ? (
            <PlatformBanner
              kind="platform"
              text="Platform-sensitive: TUN inbound behaves differently on Linux / macOS / Windows / Android / iOS. Apple platforms typically need platform.http_proxy and stack=system."
            />
          ) : null}
          {entityType === "tun" ? (
            <>
              <label className="field">
                <span>Address</span>
                <input
                  value={toList(entity.address)}
                  onChange={(event) => updateField(ref, "address", fromList(event.target.value))}
                />
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={Boolean(entity.auto_route)}
                  onChange={(event) => updateField(ref, "auto_route", event.target.checked)}
                />
                <span>Auto route</span>
              </label>
            </>
          ) : null}
          {entityType === "tun" ? (
            <>
              <label className="field" data-testid="tun-stack-field">
                <span>Stack</span>
                <select
                  value={typeof entity.stack === "string" ? entity.stack : ""}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (!next) {
                      updateField(ref, "stack", undefined);
                      if (entity.endpoint_independent_nat) updateField(ref, "endpoint_independent_nat", undefined);
                      return;
                    }
                    updateField(ref, "stack", next);
                    if (next !== "gvisor" && entity.endpoint_independent_nat) {
                      updateField(ref, "endpoint_independent_nat", undefined);
                    }
                  }}
                >
                  <option value="">(default)</option>
                  <option value="system">system</option>
                  <option value="gvisor">gvisor</option>
                  <option value="mixed">mixed</option>
                </select>
              </label>
              <label className="field">
                <span>Route address (CIDR)</span>
                <input
                  value={toList(entity.route_address)}
                  placeholder="0.0.0.0/1, 128.0.0.0/1, ::/1, 8000::/1"
                  onChange={(event) => {
                    const next = fromList(event.target.value);
                    updateField(ref, "route_address", next.length ? next : undefined);
                  }}
                />
              </label>
              <label className="field">
                <span>Route exclude address (CIDR)</span>
                <input
                  value={toList(entity.route_exclude_address)}
                  placeholder="192.168.0.0/16, fc00::/7"
                  onChange={(event) => {
                    const next = fromList(event.target.value);
                    updateField(ref, "route_exclude_address", next.length ? next : undefined);
                  }}
                />
              </label>
              <label className="field">
                <span>Route address set (rule-set tags)</span>
                <input
                  value={toList(entity.route_address_set)}
                  placeholder="cn-ips, geosite-cn"
                  onChange={(event) => {
                    const next = fromList(event.target.value);
                    updateField(ref, "route_address_set", next.length ? next : undefined);
                  }}
                />
              </label>
              <label className="field">
                <span>Route exclude address set (rule-set tags)</span>
                <input
                  value={toList(entity.route_exclude_address_set)}
                  placeholder="private-ip"
                  onChange={(event) => {
                    const next = fromList(event.target.value);
                    updateField(ref, "route_exclude_address_set", next.length ? next : undefined);
                  }}
                />
              </label>
              <label className="field">
                <span>Loopback address</span>
                <input
                  value={toList(entity.loopback_address)}
                  placeholder="10.7.0.1, fdfe:dcba:9876::2"
                  onChange={(event) => {
                    const next = fromList(event.target.value);
                    updateField(ref, "loopback_address", next.length ? next : undefined);
                  }}
                />
              </label>
              <label className="field" data-testid="tun-include-uid-range">
                <span>Include UID range (Linux, CSV)</span>
                <input
                  value={toList(entity.include_uid_range)}
                  placeholder="1000:2000, 3000:4000"
                  onChange={(event) => {
                    const next = fromList(event.target.value);
                    updateField(ref, "include_uid_range", next.length ? next : undefined);
                  }}
                />
              </label>
              <label className="field" data-testid="tun-exclude-uid-range">
                <span>Exclude UID range (Linux, CSV)</span>
                <input
                  value={toList(entity.exclude_uid_range)}
                  placeholder="0:999"
                  onChange={(event) => {
                    const next = fromList(event.target.value);
                    updateField(ref, "exclude_uid_range", next.length ? next : undefined);
                  }}
                />
              </label>
              <label className="field" data-testid="tun-include-interface">
                <span>Include Interface (CSV)</span>
                <input
                  value={toList(entity.include_interface)}
                  placeholder="eth0, wlan0"
                  onChange={(event) => {
                    const next = fromList(event.target.value);
                    updateField(ref, "include_interface", next.length ? next : undefined);
                  }}
                />
              </label>
              <label className="field" data-testid="tun-exclude-interface">
                <span>Exclude Interface (CSV)</span>
                <input
                  value={toList(entity.exclude_interface)}
                  placeholder="lo, docker0"
                  onChange={(event) => {
                    const next = fromList(event.target.value);
                    updateField(ref, "exclude_interface", next.length ? next : undefined);
                  }}
                />
              </label>
              <label className="field" data-testid="tun-include-package">
                <span>Include Package (Android, CSV)</span>
                <input
                  value={toList(entity.include_package)}
                  placeholder="com.example.app"
                  onChange={(event) => {
                    const next = fromList(event.target.value);
                    updateField(ref, "include_package", next.length ? next : undefined);
                  }}
                />
              </label>
              <label className="field" data-testid="tun-exclude-package">
                <span>Exclude Package (Android, CSV)</span>
                <input
                  value={toList(entity.exclude_package)}
                  placeholder="com.android.geoclient"
                  onChange={(event) => {
                    const next = fromList(event.target.value);
                    updateField(ref, "exclude_package", next.length ? next : undefined);
                  }}
                />
              </label>
              <label className="toggle-row" data-testid="tun-auto-redirect">
                <input
                  type="checkbox"
                  checked={Boolean(entity.auto_redirect)}
                  onChange={(event) =>
                    updateField(ref, "auto_redirect", event.target.checked || undefined)
                  }
                />
                <span>Auto redirect (Linux, requires `auto_route`)</span>
              </label>
              {entity.stack === "gvisor" ? (
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={Boolean(entity.endpoint_independent_nat)}
                    onChange={(event) =>
                      updateField(ref, "endpoint_independent_nat", event.target.checked || undefined)
                    }
                  />
                  <span>Endpoint-independent NAT (gvisor only)</span>
                </label>
              ) : null}
              {(() => {
                const platform = objectField(entity.platform);
                const httpProxy = objectField(platform.http_proxy);
                const writeProxy = (patch: InspectorEntity) => {
                  const merged: InspectorEntity = { ...httpProxy, ...patch };
                  const cleaned: InspectorEntity = {};
                  for (const [k, v] of Object.entries(merged)) {
                    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue;
                    cleaned[k] = v;
                  }
                  const nextPlatform: InspectorEntity = { ...platform };
                  if (Object.keys(cleaned).length) nextPlatform.http_proxy = cleaned;
                  else delete nextPlatform.http_proxy;
                  updateField(ref, "platform", Object.keys(nextPlatform).length ? nextPlatform : undefined);
                };
                return (
                  <fieldset className="field field--checklist" data-testid="tun-platform-http-proxy">
                    <legend>Platform · HTTP Proxy</legend>
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={Boolean(httpProxy.enabled)}
                        onChange={(event) =>
                          writeProxy({ enabled: event.target.checked ? true : undefined })
                        }
                      />
                      <span>Enabled</span>
                    </label>
                    <label className="field">
                      <span>Server</span>
                      <input
                        value={typeof httpProxy.server === "string" ? httpProxy.server : ""}
                        placeholder="127.0.0.1"
                        onChange={(event) => writeProxy({ server: event.target.value || undefined })}
                      />
                    </label>
                    <label className="field">
                      <span>Server port</span>
                      <input
                        type="number"
                        value={typeof httpProxy.server_port === "number" ? httpProxy.server_port : ""}
                        placeholder="8080"
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          writeProxy({ server_port: Number.isFinite(next) && next > 0 ? next : undefined });
                        }}
                      />
                    </label>
                    <label className="field">
                      <span>Bypass domain</span>
                      <input
                        value={toList(httpProxy.bypass_domain)}
                        placeholder="*.local, 192.168.0.0/16"
                        onChange={(event) => {
                          const list = fromList(event.target.value);
                          writeProxy({ bypass_domain: list.length ? list : undefined });
                        }}
                      />
                    </label>
                    <label className="field">
                      <span>Match domain (Apple GUI only)</span>
                      <input
                        value={toList(httpProxy.match_domain)}
                        placeholder="*.example.com"
                        onChange={(event) => {
                          const list = fromList(event.target.value);
                          writeProxy({ match_domain: list.length ? list : undefined });
                        }}
                      />
                    </label>
                  </fieldset>
                );
              })()}
            </>
          ) : null}
          {entityType === "shadowtls" ? (
            <label className="field">
              <span>Version</span>
              <select
                value={typeof entity.version === "number" ? String(entity.version) : ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (!raw) {
                    updateField(ref, "version", undefined);
                    return;
                  }
                  const parsed = Number(raw);
                  updateField(ref, "version", Number.isFinite(parsed) ? parsed : undefined);
                }}
              >
                <option value="">(default — 1)</option>
                <option value="1">1 (no auth)</option>
                <option value="2">2 (single user)</option>
                <option value="3">3 (multi-user via users[])</option>
              </select>
            </label>
          ) : null}
          {entityType === "anytls" ? (
            <label className="field">
              <span>Padding scheme</span>
              <textarea
                rows={4}
                value={Array.isArray(entity.padding_scheme) ? (entity.padding_scheme as string[]).join("\n") : ""}
                placeholder={"one rule per line, e.g.\nstop=8\n0=30-30\n1=100-400"}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (!raw.trim()) {
                    updateField(ref, "padding_scheme", undefined);
                    return;
                  }
                  const lines = raw
                    .split(/\n/)
                    .map((line) => line.trim())
                    .filter(Boolean);
                  updateField(ref, "padding_scheme", lines.length ? lines : undefined);
                }}
              />
            </label>
          ) : null}
          {entityType === "shadowsocks" ? (
            <label className="field">
              <span>Method</span>
              <select
                value={typeof entity.method === "string" ? entity.method : ""}
                onChange={(event) => updateField(ref, "method", event.target.value || undefined)}
              >
                <option value="">(none)</option>
                <optgroup label="Shadowsocks 2022">
                  <option value="2022-blake3-aes-128-gcm">2022-blake3-aes-128-gcm</option>
                  <option value="2022-blake3-aes-256-gcm">2022-blake3-aes-256-gcm</option>
                  <option value="2022-blake3-chacha20-poly1305">2022-blake3-chacha20-poly1305</option>
                </optgroup>
                <optgroup label="AEAD">
                  <option value="aes-128-gcm">aes-128-gcm</option>
                  <option value="aes-192-gcm">aes-192-gcm</option>
                  <option value="aes-256-gcm">aes-256-gcm</option>
                  <option value="chacha20-ietf-poly1305">chacha20-ietf-poly1305</option>
                  <option value="xchacha20-ietf-poly1305">xchacha20-ietf-poly1305</option>
                </optgroup>
                {/* Shadowsocks INBOUND accepts only 2022 + AEAD + `none` (inbound/shadowsocks.md);
                    stream ciphers (aes-*-ctr/cfb, rc4-md5, chacha20-ietf, xchacha20) are outbound-only
                    and the inbound rejects them. (L2-fix-ss-inbound-ciphers, audit H3) */}
                <optgroup label="Other">
                  <option value="none">none (no encryption)</option>
                </optgroup>
              </select>
            </label>
          ) : null}
          {entityType === "mixed" || entityType === "http" || entityType === "socks" ? (
            <label className="toggle-row" data-testid="inbound-set-system-proxy">
              <input
                type="checkbox"
                checked={Boolean(entity.set_system_proxy)}
                onChange={(event) =>
                  updateField(ref, "set_system_proxy", event.target.checked || undefined)
                }
              />
              <span>Set System Proxy (Linux / Android / Windows / macOS)</span>
            </label>
          ) : null}
          {entityType === "tproxy" ? (
            <label className="field" data-testid="inbound-tproxy-network">
              <span>Network</span>
              <select
                value={typeof entity.network === "string" ? entity.network : ""}
                onChange={(event) => updateField(ref, "network", event.target.value || undefined)}
              >
                <option value="">(both)</option>
                <option value="tcp">tcp</option>
                <option value="udp">udp</option>
              </select>
            </label>
          ) : null}
          {entityType === "cloudflared" ? (
            <>
              <div className="inspector-section-title">Cloudflare Tunnel</div>
              <SensitiveTextField
                label="Token"
                value={String(entity.token ?? "")}
                onChange={(next) => updateField(ref, "token", next || undefined)}
                placeholder="base64 tunnel token"
              />
              <label className="field">
                <span>HA Connections</span>
                <input
                  type="number"
                  value={typeof entity.ha_connections === "number" ? entity.ha_connections : ""}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    updateField(ref, "ha_connections", event.target.value === "" || !Number.isFinite(parsed) ? undefined : parsed);
                  }}
                />
              </label>
              <label className="field">
                <span>Protocol</span>
                <select value={String(entity.protocol ?? "")} onChange={(event) => updateField(ref, "protocol", event.target.value || undefined)}>
                  <option value="">(auto)</option>
                  <option value="quic">quic</option>
                  <option value="http2">http2</option>
                </select>
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={entity.post_quantum === true} onChange={(event) => updateField(ref, "post_quantum", event.target.checked || undefined)} />
                <span>Post-quantum</span>
              </label>
              <label className="field">
                <span>Region</span>
                <input value={String(entity.region ?? "")} onChange={(event) => updateField(ref, "region", event.target.value || undefined)} />
              </label>
              <label className="field">
                <span>Grace Period</span>
                <input value={String(entity.grace_period ?? "")} onChange={(event) => updateField(ref, "grace_period", event.target.value || undefined)} placeholder="30s" />
              </label>
            </>
          ) : null}
          {entityType === "direct" ? (
            <>
              <label className="field" data-testid="inbound-direct-network">
                <span>Network</span>
                <select
                  value={typeof entity.network === "string" ? entity.network : ""}
                  onChange={(event) => updateField(ref, "network", event.target.value || undefined)}
                >
                  <option value="">(both)</option>
                  <option value="tcp">tcp</option>
                  <option value="udp">udp</option>
                </select>
              </label>
              <label className="field" data-testid="inbound-direct-override-address">
                <span>Override Address</span>
                <input
                  value={typeof entity.override_address === "string" ? entity.override_address : ""}
                  placeholder="1.1.1.1"
                  onChange={(event) => updateField(ref, "override_address", event.target.value || undefined)}
                />
              </label>
              <label className="field" data-testid="inbound-direct-override-port">
                <span>Override Port</span>
                <input
                  type="number"
                  value={typeof entity.override_port === "number" ? entity.override_port : ""}
                  placeholder="53"
                  onChange={(event) => {
                    const raw = event.target.value;
                    if (!raw) return updateField(ref, "override_port", undefined);
                    const parsed = Number(raw);
                    updateField(ref, "override_port", Number.isFinite(parsed) ? parsed : undefined);
                  }}
                />
              </label>
            </>
          ) : null}
          {entityType === "trojan" ? (
            (() => {
              const fallback = objectField(entity.fallback);
              const fallbackServer = typeof fallback.server === "string" ? fallback.server : "";
              const fallbackPort = typeof fallback.server_port === "number" ? fallback.server_port : "";
              const writeFallback = (next: InspectorEntity) =>
                updateField(ref, "fallback", Object.keys(next).length ? next : undefined);
              return (
                <fieldset className="field field--checklist" data-testid="inbound-trojan-fallback">
                  <legend>Fallback Server (optional)</legend>
                  <label className="field">
                    <span>Server</span>
                    <input
                      value={fallbackServer}
                      placeholder="127.0.0.1"
                      onChange={(event) => {
                        const value = event.target.value;
                        if (!value) {
                          const { server: _server, ...rest } = fallback as Record<string, unknown>;
                          writeFallback(rest);
                          return;
                        }
                        writeFallback({ ...fallback, server: value });
                      }}
                    />
                  </label>
                  <label className="field">
                    <span>Server Port</span>
                    <input
                      type="number"
                      value={fallbackPort}
                      placeholder="80"
                      onChange={(event) => {
                        const raw = event.target.value;
                        if (!raw) {
                          const { server_port: _port, ...rest } = fallback as Record<string, unknown>;
                          writeFallback(rest);
                          return;
                        }
                        const parsed = Number(raw);
                        if (Number.isFinite(parsed)) {
                          writeFallback({ ...fallback, server_port: parsed });
                        }
                      }}
                    />
                  </label>
                  <p className="field__hint">
                    Disabled when both Server and Port are empty. Use Advanced JSON for fallback_for_alpn.
                  </p>
                </fieldset>
              );
            })()
          ) : null}
          {entityType === "hysteria2" ? (
            <>
              <label className="field" data-testid="inbound-hysteria2-masquerade">
                <span>Masquerade (URL)</span>
                <input
                  value={typeof entity.masquerade === "string" ? entity.masquerade : ""}
                  placeholder="http://127.0.0.1:8080 or file:///var/www"
                  onChange={(event) => updateField(ref, "masquerade", event.target.value || undefined)}
                />
              </label>
              <label className="toggle-row" data-testid="inbound-hysteria2-brutal-debug">
                <input
                  type="checkbox"
                  checked={Boolean(entity.brutal_debug)}
                  onChange={(event) =>
                    updateField(ref, "brutal_debug", event.target.checked || undefined)
                  }
                />
                <span>Brutal Debug (verbose congestion-control logging)</span>
              </label>
            </>
          ) : null}
          {entityType === "naive" ? (
            <>
              <label className="field" data-testid="inbound-naive-network">
                <span>Network</span>
                <select
                  value={typeof entity.network === "string" ? entity.network : ""}
                  onChange={(event) => updateField(ref, "network", event.target.value || undefined)}
                >
                  <option value="">(both)</option>
                  <option value="tcp">tcp</option>
                  <option value="udp">udp</option>
                </select>
              </label>
              <label className="field" data-testid="inbound-naive-quic-congestion-control">
                <span>QUIC Congestion Control</span>
                <select
                  value={typeof entity.quic_congestion_control === "string" ? entity.quic_congestion_control : ""}
                  onChange={(event) =>
                    updateField(ref, "quic_congestion_control", event.target.value || undefined)
                  }
                >
                  <option value="">(default — bbr)</option>
                  <option value="bbr">bbr</option>
                  <option value="bbr_standard">bbr_standard</option>
                  <option value="bbr2">bbr2</option>
                  <option value="bbr2_variant">bbr2_variant</option>
                  <option value="cubic">cubic</option>
                  <option value="reno">reno</option>
                </select>
              </label>
            </>
          ) : null}
          {(() => {
            const schema = INBOUND_USER_SCHEMAS[entityType ?? ""];
            if (!schema) return null;
            const users = Array.isArray(entity.users) ? (entity.users as Record<string, unknown>[]) : [];
            const writeUsers = (next: Record<string, unknown>[]) =>
              updateField(ref, "users", next.length ? next : undefined);
            const patchUser = (index: number, patch: Record<string, unknown>) =>
              writeUsers(users.map((user, i) => (i === index ? { ...user, ...patch } : user)));
            const removeUser = (index: number) => writeUsers(users.filter((_, i) => i !== index));
            const addUser = () => writeUsers([...users, { ...schema.defaultUser(users.length + 1) }]);
            return (
              <fieldset className="field field--checklist" data-testid={`${entityType}-inbound-users-editor`}>
                <legend>Users</legend>
                {users.length === 0 ? (
                  <p className="field__hint">No users yet. Click Add to create one.</p>
                ) : null}
                {users.map((user, index) => (
                  <div key={index} className="rule-row">
                    {schema.fields.map((field) => {
                      const value = user[field.key];
                      if (field.sensitive) {
                        if (field.key === "uuid") {
                          return (
                            <div key={field.key} className="field-group">
                              <SensitiveTextField
                                label={field.label}
                                value={String(value ?? "")}
                                onChange={(next) => patchUser(index, { [field.key]: next })}
                              />
                              <button
                                type="button"
                                className="palette-action"
                                aria-label={`Generate UUID for user ${index + 1}`}
                                onClick={() => {
                                  const generated =
                                    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                                      ? crypto.randomUUID()
                                      : "00000000-0000-4000-8000-000000000000";
                                  patchUser(index, { [field.key]: generated });
                                }}
                              >
                                Generate UUID
                              </button>
                            </div>
                          );
                        }
                        return (
                          <SensitiveTextField
                            key={field.key}
                            label={field.label}
                            value={String(value ?? "")}
                            onChange={(next) => patchUser(index, { [field.key]: next })}
                          />
                        );
                      }
                      if (field.type === "number") {
                        return (
                          <label className="field" key={field.key}>
                            <span>{field.label}</span>
                            <input
                              type="number"
                              value={Number(value ?? 0)}
                              onChange={(event) => patchUser(index, { [field.key]: Number(event.target.value) })}
                            />
                          </label>
                        );
                      }
                      if (field.enum && field.enum.length > 0) {
                        return (
                          <label className="field" key={field.key}>
                            <span>{field.label}</span>
                            <select
                              value={String(value ?? "")}
                              onChange={(event) =>
                                patchUser(index, { [field.key]: event.target.value || undefined })
                              }
                            >
                              {field.enum.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label ?? option.value}
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      }
                      return (
                        <label className="field" key={field.key}>
                          <span>{field.label}</span>
                          <input
                            value={String(value ?? "")}
                            onChange={(event) => patchUser(index, { [field.key]: event.target.value })}
                          />
                        </label>
                      );
                    })}
                    <button
                      type="button"
                      className="icon-danger"
                      onClick={() => removeUser(index)}
                      aria-label={`Remove user ${index + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button type="button" className="palette-action" onClick={addUser}>
                  Add user
                </button>
              </fieldset>
            );
          })()}
          <AdvancedScalarFields entity={entity} handledFields={inboundHandledFields} entityRef={ref} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={inboundHandledFields} entityRef={ref} updateField={updateField} />
        </>
      ) : null}

      {ref.kind === "outbound" ? (
        <>
          {entityType === "naive" ? (
            <PlatformBanner
              kind="platform"
              text="naive outbound runs only on Apple platforms, Android, Windows, and certain Linux builds. Linux and Windows builds must ship libcronet (libcronet.so on Linux / libcronet.dll on Windows, on the binary's path)."
            />
          ) : null}
          {entityType === "shadowtls" ? (
            <label className="field">
              <span>Version</span>
              <select
                value={typeof entity.version === "number" ? String(entity.version) : ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (!raw) {
                    updateField(ref, "version", undefined);
                    return;
                  }
                  const parsed = Number(raw);
                  updateField(ref, "version", Number.isFinite(parsed) ? parsed : undefined);
                }}
              >
                <option value="">(default — 1)</option>
                <option value="1">1 (no auth)</option>
                <option value="2">2 (single user)</option>
                <option value="3">3 (single user, server-side hash)</option>
              </select>
            </label>
          ) : null}
          {entityType === "tor" ? (
            <>
              <PlatformBanner
                kind="build-tag"
                text="Build-tag gate: outbound tor requires sing-box built with `with_tor` or an external tor binary at executable_path. Standard releases do not include embedded tor."
              />
              <label className="field">
                <span>Executable Path</span>
                <input
                  value={String(entity.executable_path ?? "")}
                  placeholder="/usr/bin/tor"
                  onChange={(event) => updateField(ref, "executable_path", event.target.value || undefined)}
                />
              </label>
              <label className="field">
                <span>Data Directory</span>
                <input
                  value={String(entity.data_directory ?? "")}
                  placeholder="$HOME/.cache/sing-box/tor"
                  onChange={(event) => updateField(ref, "data_directory", event.target.value || undefined)}
                />
              </label>
              <label className="field">
                <span>Extra Args (CSV)</span>
                <input
                  value={toList(entity.extra_args)}
                  placeholder="--SafeLogging,0"
                  onChange={(event) => {
                    const next = fromList(event.target.value);
                    updateField(ref, "extra_args", next.length ? next : undefined);
                  }}
                />
              </label>
              {(() => {
                const torrc = objectField(entity.torrc);
                const entries = Object.entries(torrc);
                const writeTorrc = (next: InspectorEntity) =>
                  updateField(ref, "torrc", Object.keys(next).length ? next : undefined);
                return (
                  <fieldset className="field field--checklist" data-testid="tor-torrc-editor">
                    <legend>torrc options</legend>
                    {entries.length === 0 ? (
                      <p className="field__hint">No torrc keys. Click Add to set ClientOnly, BridgeRelay, etc.</p>
                    ) : null}
                    {entries.map(([key, value], index) => (
                      <div key={`${key}-${index}`} className="rule-row">
                        <label className="field">
                          <span>Key</span>
                          <input
                            value={key}
                            onChange={(event) => {
                              const newKey = event.target.value;
                              if (!newKey || newKey === key) return;
                              const next: InspectorEntity = {};
                              for (const [k, v] of entries) next[k === key ? newKey : k] = v;
                              writeTorrc(next);
                            }}
                          />
                        </label>
                        <label className="field">
                          <span>Value</span>
                          <input
                            value={typeof value === "string" || typeof value === "number" ? String(value) : JSON.stringify(value)}
                            onChange={(event) => {
                              const raw = event.target.value;
                              const next: InspectorEntity = { ...torrc };
                              const num = Number(raw);
                              next[key] = raw === "" ? "" : Number.isFinite(num) && /^-?\d+(?:\.\d+)?$/.test(raw) ? num : raw;
                              writeTorrc(next);
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="icon-danger"
                          aria-label={`Remove torrc ${key}`}
                          onClick={() => {
                            const next: InspectorEntity = { ...torrc };
                            delete next[key];
                            writeTorrc(next);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="palette-action"
                      onClick={() => writeTorrc(withUniqueBlankKey(torrc, "Option"))}
                    >
                      Add torrc key
                    </button>
                  </fieldset>
                );
              })()}
            </>
          ) : null}
          {entityType === "block" ? (
            <PlatformBanner
              kind="deprecated"
              text="Removed: outbound type `block` was removed in sing-box 1.13 (deprecated since 1.11). It is rejected on the stable (1.13) and testing (1.14) channels — use a route rule with action `reject` instead."
            />
          ) : null}
          {entityType === "hysteria" ? (
            <PlatformBanner
              kind="deprecated"
              text="Hysteria v1 is legacy — prefer `hysteria2` for new deployments."
            />
          ) : null}
          {"server" in entity ? (
            <label className="field">
              <span>Server</span>
              <input
                value={String(entity.server ?? "")}
                onChange={(event) => updateField(ref, "server", event.target.value)}
              />
            </label>
          ) : null}
          {"server_port" in entity ? (
            (() => {
              const portDefaultByType: Record<string, number> = {
                socks: 1080,
                http: 8080,
                trojan: 443,
                naive: 443,
                vless: 443,
                shadowtls: 443,
                ssh: 22,
              };
              const defaultPort = entityType && portDefaultByType[entityType];
              return (
                <label className="field">
                  <span>Port</span>
                  <input
                    type="number"
                    value={
                      typeof entity.server_port === "number" ? entity.server_port : defaultPort ?? ""
                    }
                    placeholder={defaultPort ? String(defaultPort) : "port"}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      updateField(ref, "server_port", Number.isFinite(next) && next > 0 ? next : undefined);
                    }}
                  />
                </label>
              );
            })()
          ) : null}
          {entityType && ["socks", "http", "shadowsocks", "vmess", "trojan", "vless", "tuic", "hysteria", "hysteria2"].includes(entityType) ? (
            <label className="field">
              <span>Network</span>
              <select
                value={typeof entity.network === "string" ? entity.network : ""}
                onChange={(event) => updateField(ref, "network", event.target.value || undefined)}
              >
                <option value="">tcp + udp (both)</option>
                <option value="tcp">tcp</option>
                <option value="udp">udp</option>
              </select>
            </label>
          ) : null}
          {entityType && ["vmess", "vless", "tuic"].includes(entityType) ? (
            <>
              <SensitiveTextField
                label="UUID"
                value={String(entity.uuid ?? "")}
                onChange={(next) => updateField(ref, "uuid", next || undefined)}
              />
              <button
                type="button"
                className="palette-action"
                onClick={() => {
                  const uuid = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                    ? crypto.randomUUID()
                    : "00000000-0000-4000-8000-000000000000");
                  updateField(ref, "uuid", uuid);
                }}
              >
                Generate UUID
              </button>
            </>
          ) : null}
          {entityType && ["http", "socks", "naive"].includes(entityType) ? (
            <>
              <label className="field">
                <span>Username</span>
                <input
                  value={String(entity.username ?? "")}
                  onChange={(event) => updateField(ref, "username", event.target.value || undefined)}
                />
              </label>
              {entityType !== "naive" ? (
                <SensitiveTextField
                  label="Password"
                  value={String(entity.password ?? "")}
                  onChange={(next) => updateField(ref, "password", next || undefined)}
                />
              ) : null}
            </>
          ) : null}
          {entityType && ["shadowsocks", "trojan", "naive", "tuic", "hysteria2", "anytls", "shadowtls"].includes(entityType) ? (
            <SensitiveTextField
              label="Password"
              value={String(entity.password ?? "")}
              onChange={(next) => updateField(ref, "password", next || undefined)}
            />
          ) : null}
          {entityType === "hysteria" ? (
            <>
              <SensitiveTextField
                label="Auth (string)"
                value={String(entity.auth_str ?? "")}
                onChange={(next) => updateField(ref, "auth_str", next || undefined)}
              />
              <label className="field" data-testid="outbound-hysteria-up-mbps">
                <span>Up Mbps</span>
                <input
                  type="number"
                  value={typeof entity.up_mbps === "number" ? entity.up_mbps : ""}
                  placeholder="required (Mbps)"
                  onChange={(event) => {
                    const raw = event.target.value;
                    if (!raw) return updateField(ref, "up_mbps", undefined);
                    const parsed = Number(raw);
                    updateField(
                      ref,
                      "up_mbps",
                      Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined,
                    );
                  }}
                />
              </label>
              <label className="field" data-testid="outbound-hysteria-down-mbps">
                <span>Down Mbps</span>
                <input
                  type="number"
                  value={typeof entity.down_mbps === "number" ? entity.down_mbps : ""}
                  placeholder="required (Mbps)"
                  onChange={(event) => {
                    const raw = event.target.value;
                    if (!raw) return updateField(ref, "down_mbps", undefined);
                    const parsed = Number(raw);
                    updateField(
                      ref,
                      "down_mbps",
                      Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined,
                    );
                  }}
                />
              </label>
              <label className="field" data-testid="outbound-hysteria-obfs">
                <span>Obfs (string, optional)</span>
                <input
                  value={typeof entity.obfs === "string" ? entity.obfs : ""}
                  placeholder="obfuscation password"
                  onChange={(event) => updateField(ref, "obfs", event.target.value || undefined)}
                />
              </label>
            </>
          ) : null}
          {entityType === "ssh" ? (
            <>
              <label className="field">
                <span>SSH User</span>
                <input
                  value={String(entity.user ?? "")}
                  onChange={(event) => updateField(ref, "user", event.target.value || undefined)}
                />
              </label>
              <SensitiveTextField
                label="Password"
                value={String(entity.password ?? "")}
                onChange={(next) => updateField(ref, "password", next || undefined)}
              />
              <label className="field">
                <span>Private Key Path</span>
                <input
                  value={String(entity.private_key_path ?? "")}
                  onChange={(event) =>
                    updateField(ref, "private_key_path", event.target.value || undefined)
                  }
                  placeholder="~/.ssh/id_ed25519"
                />
              </label>
              <SensitiveTextField
                label="Private Key (PEM)"
                value={String(entity.private_key ?? "")}
                onChange={(next) => updateField(ref, "private_key", next || undefined)}
              />
              <SensitiveTextField
                label="Private Key Passphrase"
                value={String(entity.private_key_passphrase ?? "")}
                onChange={(next) => updateField(ref, "private_key_passphrase", next || undefined)}
              />
              <label className="field">
                <span>Host Key (newline-separated SHA256)</span>
                <textarea
                  value={Array.isArray(entity.host_key) ? (entity.host_key as string[]).join("\n") : ""}
                  onChange={(event) => {
                    const lines = event.target.value
                      .split(/\r?\n/)
                      .map((line) => line.trim())
                      .filter(Boolean);
                    updateField(ref, "host_key", lines.length ? lines : undefined);
                  }}
                />
              </label>
              <label className="field">
                <span>Host Key Algorithms</span>
                <input
                  value={Array.isArray(entity.host_key_algorithms) ? (entity.host_key_algorithms as string[]).join(", ") : ""}
                  onChange={(event) =>
                    updateField(ref, "host_key_algorithms", fromList(event.target.value).length ? fromList(event.target.value) : undefined)
                  }
                  placeholder="ssh-ed25519, ssh-rsa"
                />
              </label>
              <label className="field">
                <span>Client Version</span>
                <input
                  value={String(entity.client_version ?? "")}
                  onChange={(event) => updateField(ref, "client_version", event.target.value || undefined)}
                />
              </label>
              <PlatformBanner
                kind="channel"
                text="The next three fields (Ciphers, MACs, Key Exchange Algorithms) only take effect on sing-box 1.14+ (testing channel)."
              />
              <label className="field" data-testid="outbound-ssh-cipher">
                <span>Ciphers (CSV)</span>
                <input
                  value={Array.isArray(entity.cipher) ? (entity.cipher as string[]).join(", ") : ""}
                  placeholder="chacha20-poly1305@openssh.com, aes256-gcm@openssh.com"
                  onChange={(event) => {
                    const next = fromList(event.target.value);
                    updateField(ref, "cipher", next.length ? next : undefined);
                  }}
                />
              </label>
              <label className="field" data-testid="outbound-ssh-mac">
                <span>MACs (CSV)</span>
                <input
                  value={Array.isArray(entity.mac) ? (entity.mac as string[]).join(", ") : ""}
                  placeholder="hmac-sha2-256, hmac-sha2-512"
                  onChange={(event) => {
                    const next = fromList(event.target.value);
                    updateField(ref, "mac", next.length ? next : undefined);
                  }}
                />
              </label>
              <label className="field" data-testid="outbound-ssh-kex">
                <span>Key Exchange Algorithms (CSV)</span>
                <input
                  value={Array.isArray(entity.kex_algorithm) ? (entity.kex_algorithm as string[]).join(", ") : ""}
                  placeholder="curve25519-sha256, diffie-hellman-group14-sha256"
                  onChange={(event) => {
                    const next = fromList(event.target.value);
                    updateField(ref, "kex_algorithm", next.length ? next : undefined);
                  }}
                />
              </label>
            </>
          ) : null}
          {entityType === "shadowsocks" ? (
            <>
              <label className="field">
                <span>Method</span>
                <select
                  value={typeof entity.method === "string" ? entity.method : ""}
                  onChange={(event) => updateField(ref, "method", event.target.value || undefined)}
                >
                  <option value="">(none)</option>
                  <optgroup label="Shadowsocks 2022">
                    <option value="2022-blake3-aes-128-gcm">2022-blake3-aes-128-gcm</option>
                    <option value="2022-blake3-aes-256-gcm">2022-blake3-aes-256-gcm</option>
                    <option value="2022-blake3-chacha20-poly1305">2022-blake3-chacha20-poly1305</option>
                  </optgroup>
                  <optgroup label="AEAD">
                    <option value="aes-128-gcm">aes-128-gcm</option>
                    <option value="aes-192-gcm">aes-192-gcm</option>
                    <option value="aes-256-gcm">aes-256-gcm</option>
                    <option value="chacha20-ietf-poly1305">chacha20-ietf-poly1305</option>
                    <option value="xchacha20-ietf-poly1305">xchacha20-ietf-poly1305</option>
                  </optgroup>
                  <optgroup label="Legacy / Stream cipher">
                    <option value="none">none</option>
                    <option value="aes-128-ctr">aes-128-ctr</option>
                    <option value="aes-192-ctr">aes-192-ctr</option>
                    <option value="aes-256-ctr">aes-256-ctr</option>
                    <option value="aes-128-cfb">aes-128-cfb</option>
                    <option value="aes-192-cfb">aes-192-cfb</option>
                    <option value="aes-256-cfb">aes-256-cfb</option>
                    <option value="rc4-md5">rc4-md5</option>
                    <option value="chacha20-ietf">chacha20-ietf</option>
                    <option value="xchacha20">xchacha20</option>
                  </optgroup>
                </select>
              </label>
              <label className="field">
                <span>Plugin (SIP003)</span>
                <select
                  value={typeof entity.plugin === "string" ? entity.plugin : ""}
                  onChange={(event) =>
                    updateField(ref, "plugin", event.target.value || undefined)
                  }
                >
                  <option value="">(none)</option>
                  <option value="obfs-local">obfs-local</option>
                  <option value="v2ray-plugin">v2ray-plugin</option>
                </select>
              </label>
              {typeof entity.plugin === "string" && entity.plugin ? (
                <label className="field">
                  <span>Plugin Opts</span>
                  <input
                    value={typeof entity.plugin_opts === "string" ? entity.plugin_opts : ""}
                    placeholder="obfs=tls;obfs-host=example.com"
                    onChange={(event) =>
                      updateField(ref, "plugin_opts", event.target.value || undefined)
                    }
                  />
                </label>
              ) : null}
            </>
          ) : null}
          {entityType === "vmess" ? (
            <label className="field">
              <span>Security</span>
              <select
                value={typeof entity.security === "string" ? entity.security : "auto"}
                onChange={(event) => updateField(ref, "security", event.target.value)}
              >
                <option value="auto">auto</option>
                <option value="none">none</option>
                <option value="zero">zero</option>
                <option value="aes-128-gcm">aes-128-gcm</option>
                <option value="chacha20-poly1305">chacha20-poly1305</option>
                <option value="aes-128-ctr">aes-128-ctr (legacy)</option>
              </select>
            </label>
          ) : null}
          {entityType === "vless" ? (
            <label className="field">
              <span>Flow</span>
              <select
                value={typeof entity.flow === "string" ? entity.flow : ""}
                onChange={(event) => updateField(ref, "flow", event.target.value || undefined)}
              >
                <option value="">(none)</option>
                <option value="xtls-rprx-vision">xtls-rprx-vision</option>
              </select>
            </label>
          ) : null}
          {entityType === "naive" ? (
            <label className="field" data-testid="naive-quic-congestion-control">
              <span>QUIC Congestion Control</span>
              <select
                value={typeof entity.quic_congestion_control === "string" ? entity.quic_congestion_control : ""}
                onChange={(event) =>
                  updateField(ref, "quic_congestion_control", event.target.value || undefined)
                }
              >
                <option value="">(default — bbr)</option>
                <option value="bbr">bbr</option>
                <option value="bbr2">bbr2</option>
                <option value="cubic">cubic</option>
                <option value="reno">reno</option>
              </select>
            </label>
          ) : null}
          {entityType === "http" ? (
            <>
              <label className="field" data-testid="outbound-http-path">
                <span>Path</span>
                <input
                  value={typeof entity.path === "string" ? entity.path : ""}
                  placeholder="/proxy"
                  onChange={(event) => updateField(ref, "path", event.target.value || undefined)}
                />
              </label>
              {(() => {
                const headers = objectField(entity.headers);
                const entries = Object.entries(headers);
                const writeHeaders = (next: InspectorEntity) =>
                  updateField(ref, "headers", Object.keys(next).length ? next : undefined);
                return (
                  <fieldset className="field field--checklist" data-testid="outbound-http-headers">
                    <legend>Headers</legend>
                    {entries.length === 0 ? (
                      <p className="field__hint">No extra request headers.</p>
                    ) : null}
                    {entries.map(([key, value], index) => (
                      <div key={`${key}-${index}`} className="rule-row">
                        <label className="field">
                          <span>Name</span>
                          <input
                            value={key}
                            onChange={(event) => {
                              const newKey = event.target.value;
                              if (!newKey || newKey === key) return;
                              const next: InspectorEntity = {};
                              for (const [k, v] of entries) next[k === key ? newKey : k] = v;
                              writeHeaders(next);
                            }}
                          />
                        </label>
                        <label className="field">
                          <span>Value</span>
                          <input
                            value={typeof value === "string" ? value : String(value ?? "")}
                            onChange={(event) => writeHeaders({ ...headers, [key]: event.target.value })}
                          />
                        </label>
                        <button
                          type="button"
                          className="icon-danger"
                          aria-label={`Remove header ${key}`}
                          onClick={() => {
                            const next: InspectorEntity = { ...headers };
                            delete next[key];
                            writeHeaders(next);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="palette-action"
                      onClick={() => writeHeaders(withUniqueBlankKey(headers, "X-Header"))}
                    >
                      Add header
                    </button>
                  </fieldset>
                );
              })()}
            </>
          ) : null}
          {entityType === "naive" ? (
            (() => {
              const headers = objectField(entity.extra_headers);
              const entries = Object.entries(headers);
              const writeHeaders = (next: InspectorEntity) =>
                updateField(ref, "extra_headers", Object.keys(next).length ? next : undefined);
              return (
                <fieldset className="field field--checklist" data-testid="naive-extra-headers">
                  <legend>Extra Headers</legend>
                  {entries.length === 0 ? (
                    <p className="field__hint">No custom headers. Click Add to set User-Agent, Authorization, etc.</p>
                  ) : null}
                  {entries.map(([key, value], index) => (
                    <div key={`${key}-${index}`} className="rule-row">
                      <label className="field">
                        <span>Name</span>
                        <input
                          value={key}
                          onChange={(event) => {
                            const newKey = event.target.value;
                            if (!newKey || newKey === key) return;
                            const next: InspectorEntity = {};
                            for (const [k, v] of entries) next[k === key ? newKey : k] = v;
                            writeHeaders(next);
                          }}
                        />
                      </label>
                      <label className="field">
                        <span>Value</span>
                        <input
                          value={typeof value === "string" ? value : String(value ?? "")}
                          onChange={(event) => writeHeaders({ ...headers, [key]: event.target.value })}
                        />
                      </label>
                      <button
                        type="button"
                        className="icon-danger"
                        aria-label={`Remove header ${key}`}
                        onClick={() => {
                          const next: InspectorEntity = { ...headers };
                          delete next[key];
                          writeHeaders(next);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="palette-action"
                    onClick={() => writeHeaders(withUniqueBlankKey(headers, "X-Header"))}
                  >
                    Add header
                  </button>
                </fieldset>
              );
            })()
          ) : null}
          {entityType === "hysteria2" ? (
            <>
              <label className="field">
                <span>Up Mbps</span>
                <input
                  type="number"
                  value={typeof entity.up_mbps === "number" ? entity.up_mbps : ""}
                  placeholder="empty = let BBR pick"
                  onChange={(event) => {
                    const next = event.target.value;
                    if (!next) return updateField(ref, "up_mbps", undefined);
                    const parsed = Number(next);
                    updateField(ref, "up_mbps", Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined);
                  }}
                />
              </label>
              <label className="field">
                <span>Down Mbps</span>
                <input
                  type="number"
                  value={typeof entity.down_mbps === "number" ? entity.down_mbps : ""}
                  placeholder="empty = let BBR pick"
                  onChange={(event) => {
                    const next = event.target.value;
                    if (!next) return updateField(ref, "down_mbps", undefined);
                    const parsed = Number(next);
                    updateField(ref, "down_mbps", Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined);
                  }}
                />
              </label>
              <label className="field">
                <span>Server Ports (port hopping)</span>
                <input
                  value={toList(entity.server_ports)}
                  placeholder="2080:3000, 4000:5000"
                  onChange={(event) => {
                    const next = fromList(event.target.value);
                    updateField(ref, "server_ports", next.length ? next : undefined);
                  }}
                />
              </label>
              <label className="field">
                <span>Hop Interval</span>
                <input
                  value={String(entity.hop_interval ?? "")}
                  placeholder="30s"
                  onChange={(event) => updateField(ref, "hop_interval", event.target.value || undefined)}
                />
              </label>
            </>
          ) : null}
          {entityType === "anytls" ? (
            <fieldset className="field field--checklist" data-testid="anytls-idle-session">
              <legend>Idle session</legend>
              <label className="field">
                <span>Check interval</span>
                <input
                  value={typeof entity.idle_session_check_interval === "string" ? entity.idle_session_check_interval : ""}
                  placeholder="e.g. 30s"
                  onChange={(event) =>
                    updateField(ref, "idle_session_check_interval", event.target.value || undefined)
                  }
                />
              </label>
              <label className="field">
                <span>Timeout</span>
                <input
                  value={typeof entity.idle_session_timeout === "string" ? entity.idle_session_timeout : ""}
                  placeholder="e.g. 30s"
                  onChange={(event) =>
                    updateField(ref, "idle_session_timeout", event.target.value || undefined)
                  }
                />
              </label>
              <label className="field">
                <span>Min idle sessions</span>
                <input
                  type="number"
                  value={typeof entity.min_idle_session === "number" ? entity.min_idle_session : ""}
                  placeholder="default 0"
                  onChange={(event) => {
                    const next = event.target.value;
                    if (!next) return updateField(ref, "min_idle_session", undefined);
                    const parsed = Number(next);
                    updateField(ref, "min_idle_session", Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined);
                  }}
                />
              </label>
            </fieldset>
          ) : null}
          {entityType === "hysteria2" ? (
            (() => {
              const obfs = objectField(entity.obfs);
              const writeObfs = (patch: InspectorEntity) => {
                const merged: InspectorEntity = { ...obfs, ...patch };
                const cleaned: InspectorEntity = {};
                for (const [k, v] of Object.entries(merged)) {
                  if (v === undefined || v === "") continue;
                  cleaned[k] = v;
                }
                updateField(ref, "obfs", Object.keys(cleaned).length ? cleaned : undefined);
              };
              return (
                <fieldset className="field field--checklist" data-testid="hysteria2-obfs">
                  <legend>Obfuscator (obfs)</legend>
                  <label className="field">
                    <span>Type</span>
                    <select
                      value={typeof obfs.type === "string" ? obfs.type : ""}
                      onChange={(event) => writeObfs({ type: event.target.value || undefined })}
                    >
                      <option value="">(disabled)</option>
                      <option value="salamander">salamander</option>
                      <option value="gecko">gecko (1.14+ testing)</option>
                    </select>
                  </label>
                  {typeof obfs.type === "string" && obfs.type ? (
                    <SensitiveTextField
                      label="Password"
                      value={typeof obfs.password === "string" ? obfs.password : ""}
                      onChange={(next) => writeObfs({ password: next || undefined })}
                    />
                  ) : null}
                </fieldset>
              );
            })()
          ) : null}
          {entityType === "vmess" || entityType === "vless" ? (
            <label className="field">
              <span>Packet Encoding</span>
              <select
                value={typeof entity.packet_encoding === "string" ? entity.packet_encoding : ""}
                onChange={(event) => updateField(ref, "packet_encoding", event.target.value || undefined)}
              >
                <option value="">(disabled)</option>
                <option value="packetaddr">packetaddr</option>
                <option value="xudp">xudp</option>
              </select>
            </label>
          ) : null}
          {entityType === "tuic" ? (
            <>
              <label className="field">
                <span>Congestion Control</span>
                <select
                  value={typeof entity.congestion_control === "string" ? entity.congestion_control : "cubic"}
                  onChange={(event) => updateField(ref, "congestion_control", event.target.value)}
                >
                  <option value="cubic">cubic</option>
                  <option value="new_reno">new_reno</option>
                  <option value="bbr">bbr</option>
                </select>
              </label>
              <label className="field">
                <span>UDP Relay Mode</span>
                <select
                  value={typeof entity.udp_relay_mode === "string" ? entity.udp_relay_mode : ""}
                  onChange={(event) => {
                    const next = event.target.value;
                    updateField(ref, "udp_relay_mode", next || undefined);
                    if (next && entity.udp_over_stream) {
                      updateField(ref, "udp_over_stream", undefined);
                    }
                  }}
                >
                  <option value="">(default: native)</option>
                  <option value="native">native</option>
                  <option value="quic">quic</option>
                </select>
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={Boolean(entity.udp_over_stream)}
                  onChange={(event) => {
                    updateField(ref, "udp_over_stream", event.target.checked || undefined);
                    if (event.target.checked && entity.udp_relay_mode) {
                      updateField(ref, "udp_relay_mode", undefined);
                    }
                  }}
                />
                <span>UDP over Stream (conflicts with udp_relay_mode)</span>
              </label>
              <label className="field" data-testid="tuic-heartbeat">
                <span>Heartbeat</span>
                <input
                  value={typeof entity.heartbeat === "string" ? entity.heartbeat : ""}
                  placeholder="10s"
                  onChange={(event) => updateField(ref, "heartbeat", event.target.value || undefined)}
                />
              </label>
              <label className="toggle-row" data-testid="tuic-zero-rtt-handshake">
                <input
                  type="checkbox"
                  checked={Boolean(entity.zero_rtt_handshake)}
                  onChange={(event) =>
                    updateField(ref, "zero_rtt_handshake", event.target.checked || undefined)
                  }
                />
                <span>0-RTT Handshake (faster reconnects, vulnerable to replay attacks)</span>
              </label>
            </>
          ) : null}
          {entityType === "socks" ? (
            <label className="field">
              <span>SOCKS Version</span>
              <select
                value={typeof entity.version === "string" ? entity.version : "5"}
                onChange={(event) => updateField(ref, "version", event.target.value)}
              >
                <option value="5">5</option>
                <option value="4a">4a</option>
                <option value="4">4</option>
              </select>
            </label>
          ) : null}
          {(entityType === "selector" || entityType === "urltest") && tagValue !== null ? (
            (() => {
              const currentCandidates = Array.isArray(entity.outbounds)
                ? (entity.outbounds as unknown[]).filter((item): item is string => typeof item === "string")
                : [];
              const availableTags = outboundTags(config, tagValue);
              const toggleCandidate = (candidate: string) => {
                const next = currentCandidates.includes(candidate)
                  ? currentCandidates.filter((item) => item !== candidate)
                  : [...currentCandidates, candidate];
                updateField(ref, "outbounds", next);
                if (entityType === "selector") {
                  const currentDefault = typeof entity.default === "string" ? entity.default : "";
                  if (currentDefault && !next.includes(currentDefault)) {
                    updateField(ref, "default", undefined);
                  }
                }
              };
              return (
                <fieldset className="field field--checklist" data-testid="candidate-checklist">
                  <legend>Candidates</legend>
                  {availableTags.length === 0 ? (
                    <p className="field__hint">Add another outbound first to populate candidates.</p>
                  ) : null}
                  {availableTags.map((candidate) => (
                    <label key={candidate} className="toggle-row toggle-row--inline">
                      <input
                        type="checkbox"
                        checked={currentCandidates.includes(candidate)}
                        onChange={() => toggleCandidate(candidate)}
                      />
                      <span>{candidate}</span>
                    </label>
                  ))}
                  {currentCandidates.filter((tag) => !availableTags.includes(tag)).map((stale) => (
                    <label key={`stale-${stale}`} className="toggle-row toggle-row--inline toggle-row--stale">
                      <input type="checkbox" checked readOnly />
                      <span>
                        {stale} <em>(missing)</em>
                      </span>
                    </label>
                  ))}
                </fieldset>
              );
            })()
          ) : "outbounds" in entity ? (
            <label className="field">
              <span>Candidates</span>
              <input
                value={toList(entity.outbounds)}
                onChange={(event) => updateField(ref, "outbounds", fromList(event.target.value))}
              />
            </label>
          ) : null}
          {entityType === "selector" ? (
            (() => {
              const candidates = Array.isArray(entity.outbounds)
                ? (entity.outbounds as unknown[]).filter((item): item is string => typeof item === "string")
                : [];
              return (
                <label className="field">
                  <span>Default</span>
                  <select
                    value={typeof entity.default === "string" ? entity.default : ""}
                    onChange={(event) => updateField(ref, "default", event.target.value || undefined)}
                  >
                    <option value="">First candidate</option>
                    {candidates.map((candidate) => (
                      <option key={candidate} value={candidate}>
                        {candidate}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })()
          ) : null}
          {entityType === "selector" || entityType === "urltest" ? (
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={Boolean(entity.interrupt_exist_connections)}
                onChange={(event) =>
                  updateField(ref, "interrupt_exist_connections", event.target.checked || undefined)
                }
              />
              <span>Interrupt existing connections on switch</span>
            </label>
          ) : null}
          {entityType === "urltest" ? (
            <>
              <label className="field" data-testid="urltest-url-field">
                <span>Test URL</span>
                <input
                  value={String(entity.url ?? "")}
                  placeholder="https://www.gstatic.com/generate_204"
                  onChange={(event) => updateField(ref, "url", event.target.value || undefined)}
                />
              </label>
              <label className="field">
                <span>Interval</span>
                <input
                  value={String(entity.interval ?? "")}
                  placeholder="3m"
                  onChange={(event) => updateField(ref, "interval", event.target.value || undefined)}
                />
              </label>
              <label className="field">
                <span>Tolerance (ms)</span>
                <input
                  type="number"
                  value={typeof entity.tolerance === "number" ? entity.tolerance : ""}
                  placeholder="50"
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    updateField(ref, "tolerance", Number.isFinite(next) && next >= 0 ? next : undefined);
                  }}
                />
              </label>
              <label className="field">
                <span>Idle timeout</span>
                <input
                  value={String(entity.idle_timeout ?? "")}
                  placeholder="30m"
                  onChange={(event) => updateField(ref, "idle_timeout", event.target.value || undefined)}
                />
              </label>
            </>
          ) : null}
          <AdvancedScalarFields entity={entity} handledFields={outboundHandledFields} entityRef={ref} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={outboundHandledFields} entityRef={ref} updateField={updateField} />
        </>
      ) : null}

      {ref.kind === "dns-server" ? (
        <>
          {entityType === "local" ? (
            <label className="toggle-row" data-testid="dns-server-local-prefer-go">
              <input
                type="checkbox"
                checked={Boolean(entity.prefer_go)}
                onChange={(event) =>
                  updateField(ref, "prefer_go", event.target.checked || undefined)
                }
              />
              <span>Prefer Go resolver (1.13+; skips Apple getaddrinfo / Linux systemd-resolved — Android platform DNS and macOS DHCP still apply)</span>
            </label>
          ) : null}
          {entityType === "resolved" ? (
            <>
              <PlatformBanner
                kind="platform"
                text="Platform gate: dns-server `resolved` is Linux/systemd specific. It requires a matching service:resolved peer; exports work on any host but sing-box will refuse to start on macOS/Windows/Android/iOS."
              />
              <label className="field">
                <span>Service</span>
                <select
                  value={typeof entity.service === "string" ? entity.service : ""}
                  onChange={(event) => updateField(ref, "service", event.target.value || undefined)}
                >
                  <option value="">(select service:resolved)</option>
                  {(config.services ?? [])
                    .filter((service) => service.type === "resolved" && typeof service.tag === "string")
                    .map((service) => (
                      <option key={service.tag} value={service.tag}>
                        {service.tag}
                      </option>
                    ))}
                </select>
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={Boolean(entity.accept_default_resolvers)}
                  onChange={(event) =>
                    updateField(ref, "accept_default_resolvers", event.target.checked || undefined)
                  }
                />
                <span>Accept default resolvers for fallback (in addition to matching domains; off ⇒ NXDOMAIN for non-matching)</span>
              </label>
            </>
          ) : null}
          {entityType === "tailscale" ? (
            <PlatformBanner
              kind="build-tag"
              text="Build-tag gate: dns-server `tailscale` requires sing-box built with the `with_tailscale` tag (in official default builds; absent only from custom builds that drop it)."
            />
          ) : null}
          {"address" in entity ? (
            <label className="field">
              <span>Address</span>
              <input
                value={String(entity.address ?? "")}
                onChange={(event) => updateField(ref, "address", event.target.value)}
              />
            </label>
          ) : null}
          {"server" in entity ? (
            <label className="field">
              <span>Server</span>
              <input
                value={String(entity.server ?? "")}
                onChange={(event) => updateField(ref, "server", event.target.value)}
              />
            </label>
          ) : null}
          {"server_port" in entity ? (
            (() => {
              const portDefaultByType: Record<string, number> = {
                tcp: 53,
                udp: 53,
                dhcp: 53,
                tls: 853,
                quic: 853,
                https: 443,
                h3: 443,
              };
              const defaultPort = entityType && portDefaultByType[entityType] ? portDefaultByType[entityType] : 53;
              const portValue = typeof entity.server_port === "number" ? entity.server_port : defaultPort;
              return (
                <label className="field">
                  <span>Port</span>
                  <input
                    type="number"
                    value={portValue}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      updateField(ref, "server_port", Number.isFinite(next) && next > 0 ? next : undefined);
                    }}
                    placeholder={String(defaultPort)}
                  />
                </label>
              );
            })()
          ) : null}
          {"path" in entity ? (
            entityType === "hosts" ? (
              <label className="field">
                <span>Path(s)</span>
                <input
                  value={
                    Array.isArray(entity.path)
                      ? (entity.path as string[]).join(", ")
                      : typeof entity.path === "string"
                        ? entity.path
                        : ""
                  }
                  placeholder="/etc/hosts (comma-separated for multiple)"
                  onChange={(event) => {
                    const raw = event.target.value;
                    const list = raw.split(",").map((part) => part.trim()).filter(Boolean);
                    if (!list.length) {
                      updateField(ref, "path", undefined);
                    } else if (list.length === 1) {
                      updateField(ref, "path", list[0]);
                    } else {
                      updateField(ref, "path", list);
                    }
                  }}
                />
              </label>
            ) : (
              <label className="field">
                <span>Path</span>
                <input
                  value={typeof entity.path === "string" ? entity.path : ""}
                  onChange={(event) => updateField(ref, "path", event.target.value || undefined)}
                />
              </label>
            )
          ) : null}
          {entityType === "tailscale" ? (
            <>
              <label className="field">
                <span>Tailscale Endpoint</span>
                <select
                  value={String(entity.endpoint ?? "")}
                  onChange={(event) => updateField(ref, "endpoint", event.target.value || undefined)}
                >
                  <option value="">Create or select endpoint</option>
                  {endpointTags(config, "tailscale").map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={Boolean(entity.accept_default_resolvers)}
                  onChange={(event) =>
                    updateField(ref, "accept_default_resolvers", event.target.checked || undefined)
                  }
                />
                <span>Accept default resolvers for fallback (in addition to MagicDNS; off ⇒ NXDOMAIN for non-Tailscale domains)</span>
              </label>
              {channel === "testing" ? (
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={Boolean(entity.accept_search_domain)}
                    onChange={(event) =>
                      updateField(ref, "accept_search_domain", event.target.checked || undefined)
                    }
                  />
                  <span>Accept search domain (since sing-box 1.14.0)</span>
                </label>
              ) : null}
            </>
          ) : null}
          {entityType === "hosts" ? (
            (() => {
              const predefined = objectField(entity.predefined);
              const entries = Object.entries(predefined);
              const updatePredefined = (next: Record<string, string[]>) => {
                const cleaned = Object.fromEntries(Object.entries(next).filter(([, ips]) => ips.length > 0));
                updateField(ref, "predefined", Object.keys(cleaned).length ? cleaned : undefined);
              };
              const ipsAsList = (value: unknown): string[] => {
                if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
                if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
                return [];
              };
              const setDomain = (oldDomain: string, newDomain: string) => {
                if (oldDomain === newDomain) return;
                const next: Record<string, string[]> = {};
                for (const [key, value] of entries) {
                  if (key === oldDomain) next[newDomain] = ipsAsList(value);
                  else next[key] = ipsAsList(value);
                }
                updatePredefined(next);
              };
              const setIps = (domain: string, ipsText: string) => {
                const next: Record<string, string[]> = {};
                for (const [key, value] of entries) {
                  next[key] = key === domain ? fromList(ipsText) : ipsAsList(value);
                }
                updatePredefined(next);
              };
              const removeRow = (domain: string) => {
                const next = Object.fromEntries(entries.filter(([key]) => key !== domain).map(([key, value]) => [key, ipsAsList(value)]));
                updatePredefined(next);
              };
              const addRow = () => {
                let candidate = "example.com";
                let suffix = 1;
                while (Object.prototype.hasOwnProperty.call(predefined, candidate)) {
                  suffix += 1;
                  candidate = `example${suffix}.com`;
                }
                const next: Record<string, string[]> = Object.fromEntries(
                  entries.map(([key, value]) => [key, ipsAsList(value)]),
                );
                next[candidate] = ["127.0.0.1"];
                updatePredefined(next);
              };
              return (
                <fieldset className="field field--checklist" data-testid="hosts-predefined-editor">
                  <legend>Predefined Hosts</legend>
                  {entries.length === 0 ? (
                    <p className="field__hint">No predefined mappings yet. Click Add to start.</p>
                  ) : null}
                  {entries.map(([domain, ipValue]) => (
                    <div key={domain} className="rule-row">
                      <label className="field">
                        <span>Domain</span>
                        <input value={domain} onChange={(event) => setDomain(domain, event.target.value)} />
                      </label>
                      <label className="field">
                        <span>IPs</span>
                        <input
                          value={ipsAsList(ipValue).join(", ")}
                          onChange={(event) => setIps(domain, event.target.value)}
                          placeholder="comma-separated IPv4/IPv6"
                        />
                      </label>
                      <button type="button" className="icon-danger" onClick={() => removeRow(domain)} aria-label={`Remove ${domain}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="palette-action" onClick={addRow}>
                    Add host mapping
                  </button>
                </fieldset>
              );
            })()
          ) : null}
          {entityType === "dhcp" ? (
            <label className="field">
              <span>Interface</span>
              <input
                value={typeof entity.interface === "string" ? entity.interface : ""}
                placeholder="(default interface)"
                onChange={(event) => updateField(ref, "interface", event.target.value || undefined)}
              />
            </label>
          ) : null}
          {entityType === "https" || entityType === "h3" ? (
            (() => {
              const headers = objectField(entity.headers);
              const entries = Object.entries(headers);
              const writeHeaders = (next: InspectorEntity) =>
                updateField(ref, "headers", Object.keys(next).length ? next : undefined);
              return (
                <fieldset className="field field--checklist" data-testid="dns-https-headers">
                  <legend>HTTP Headers</legend>
                  {entries.length === 0 ? (
                    <p className="field__hint">No custom DoH headers. Click Add to set User-Agent, Authorization, etc.</p>
                  ) : null}
                  {entries.map(([key, value], idx) => (
                    <div key={`${key}-${idx}`} className="rule-row">
                      <label className="field">
                        <span>Name</span>
                        <input
                          value={key}
                          onChange={(event) => {
                            const newKey = event.target.value;
                            if (!newKey || newKey === key) return;
                            const next: InspectorEntity = {};
                            for (const [k, v] of entries) next[k === key ? newKey : k] = v;
                            writeHeaders(next);
                          }}
                        />
                      </label>
                      <label className="field">
                        <span>Value</span>
                        <input
                          value={typeof value === "string" ? value : String(value ?? "")}
                          onChange={(event) => writeHeaders({ ...headers, [key]: event.target.value })}
                        />
                      </label>
                      <button
                        type="button"
                        className="icon-danger"
                        aria-label={`Remove header ${key}`}
                        onClick={() => {
                          const next: InspectorEntity = { ...headers };
                          delete next[key];
                          writeHeaders(next);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="palette-action"
                    onClick={() => writeHeaders(withUniqueBlankKey(headers, "X-Header"))}
                  >
                    Add header
                  </button>
                </fieldset>
              );
            })()
          ) : null}
          {entityType === "fakeip" ? (
            <>
              <label className="field">
                <span>IPv4 Range (CIDR)</span>
                <input
                  value={typeof entity.inet4_range === "string" ? entity.inet4_range : ""}
                  placeholder="198.18.0.0/15"
                  onChange={(event) => updateField(ref, "inet4_range", event.target.value || undefined)}
                />
              </label>
              <label className="field">
                <span>IPv6 Range (CIDR)</span>
                <input
                  value={typeof entity.inet6_range === "string" ? entity.inet6_range : ""}
                  placeholder="fc00::/18"
                  onChange={(event) => updateField(ref, "inet6_range", event.target.value || undefined)}
                />
              </label>
            </>
          ) : null}
          <AdvancedScalarFields entity={entity} handledFields={dnsServerHandledFieldsForChannel(channel)} entityRef={ref} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={dnsServerHandledFieldsForChannel(channel)} entityRef={ref} updateField={updateField} />
        </>
      ) : null}

      {ref.kind === "endpoint" ? (
        <>
          {tagValue ? (
            <>
              <div className="inspector-section-title">Connections</div>
              <div className="reference-card">
                <div>
                  <span>Upstream Tailscale DNS servers</span>
                  <strong>{formatReferenceList(selectedEndpointReferences?.tailscaleDnsServers ?? [])}</strong>
                </div>
                <div>
                  <span>Upstream DERP services</span>
                  <strong>{formatReferenceList(selectedEndpointReferences?.derpServices ?? [])}</strong>
                </div>
                <div>
                  <span>Upstream certificate providers</span>
                  <strong>{formatReferenceList(selectedEndpointReferences?.certificateProviders ?? [])}</strong>
                </div>
              </div>
            </>
          ) : null}
          {entityType === "wireguard" ? (
            <>
              <label className="field">
                <span>Address</span>
                <input
                  value={toList(entity.address)}
                  onChange={(event) => updateField(ref, "address", fromList(event.target.value))}
                  placeholder="10.0.0.2/32, fd00::2/128"
                />
              </label>
              <SensitiveTextField
                label="Private Key"
                value={String(entity.private_key ?? "")}
                onChange={(next) => updateField(ref, "private_key", next)}
              />
              {(() => {
                const peers = Array.isArray(entity.peers) ? (entity.peers as Record<string, unknown>[]) : [];
                const writePeers = (next: Record<string, unknown>[]) => {
                  updateField(ref, "peers", next.length ? next : undefined);
                };
                const patchPeer = (index: number, patch: Record<string, unknown>) => {
                  writePeers(peers.map((peer, i) => (i === index ? { ...peer, ...patch } : peer)));
                };
                const removePeer = (index: number) => writePeers(peers.filter((_, i) => i !== index));
                const addPeer = () =>
                  writePeers([
                    ...peers,
                    {
                      // upstream WireGuard peer keys (endpoint/wireguard.md): address/port, not server/server_port
                      address: "192.0.2.1",
                      port: 51820,
                      public_key: "",
                      allowed_ips: ["0.0.0.0/0"],
                    } as Record<string, unknown>,
                  ]);
                return (
                  <fieldset className="field field--checklist" data-testid="wireguard-peers-editor">
                    <legend>Peers</legend>
                    {peers.length === 0 ? (
                      <p className="field__hint">No peers configured. Click Add to create one.</p>
                    ) : null}
                    {peers.map((peer, index) => (
                      <div key={index} className="rule-row">
                        <label className="field">
                          <span>Address</span>
                          <input
                            value={String(peer.address ?? "")}
                            onChange={(event) => patchPeer(index, { address: event.target.value })}
                          />
                        </label>
                        <label className="field">
                          <span>Port</span>
                          <input
                            type="number"
                            value={Number(peer.port ?? 51820)}
                            onChange={(event) => patchPeer(index, { port: Number(event.target.value) })}
                          />
                        </label>
                        <SensitiveTextField
                          label="Public Key"
                          value={String(peer.public_key ?? "")}
                          onChange={(next) => patchPeer(index, { public_key: next })}
                        />
                        <SensitiveTextField
                          label="Pre-Shared Key"
                          value={String(peer.pre_shared_key ?? "")}
                          onChange={(next) => patchPeer(index, { pre_shared_key: next || undefined })}
                        />
                        <label className="field">
                          <span>Allowed IPs</span>
                          <input
                            value={Array.isArray(peer.allowed_ips) ? (peer.allowed_ips as string[]).join(", ") : ""}
                            onChange={(event) => patchPeer(index, { allowed_ips: fromList(event.target.value) })}
                            placeholder="0.0.0.0/0, ::/0"
                          />
                        </label>
                        <label className="field">
                          <span>Persistent Keepalive</span>
                          <input
                            value={String(peer.persistent_keepalive_interval ?? "")}
                            onChange={(event) =>
                              patchPeer(index, {
                                persistent_keepalive_interval: event.target.value || undefined,
                              })
                            }
                            placeholder="25s"
                          />
                        </label>
                        <button
                          type="button"
                          className="icon-danger"
                          onClick={() => removePeer(index)}
                          aria-label={`Remove peer ${index + 1}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button type="button" className="palette-action" onClick={addPeer}>
                      Add peer
                    </button>
                  </fieldset>
                );
              })()}
            </>
          ) : null}
          {entityType === "tailscale" ? (
            <>
              <PlatformBanner
                kind="build-tag"
                text="Build-tag gate: endpoint `tailscale` requires sing-box built with the `with_tailscale` tag (in official default builds; absent only from custom builds that drop it)."
              />
              <SensitiveTextField
                label="Auth Key"
                value={String(entity.auth_key ?? "")}
                onChange={(next) => updateField(ref, "auth_key", next || undefined)}
                placeholder="tskey-auth-..."
              />
              <label className="field">
                <span>State Directory</span>
                <input
                  value={String(entity.state_directory ?? "")}
                  onChange={(event) => updateField(ref, "state_directory", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Control URL</span>
                <input
                  value={String(entity.control_url ?? "")}
                  onChange={(event) => updateField(ref, "control_url", event.target.value || undefined)}
                />
              </label>
              <label className="field">
                <span>Advertise Routes</span>
                <input
                  value={toList(entity.advertise_routes)}
                  onChange={(event) => updateField(ref, "advertise_routes", fromList(event.target.value))}
                />
              </label>
              <label className="field">
                <span>Advertise Tags (since sing-box 1.13.0)</span>
                <input
                  value={toList(entity.advertise_tags)}
                  onChange={(event) => updateField(ref, "advertise_tags", fromList(event.target.value))}
                />
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={entity.system_interface === true}
                  onChange={(event) => updateField(ref, "system_interface", event.target.checked || undefined)}
                />
                <span>System Interface (since sing-box 1.13.0)</span>
              </label>
              <label className="field">
                <span>System Interface Name (since sing-box 1.13.0)</span>
                <input
                  value={typeof entity.system_interface_name === "string" ? entity.system_interface_name : ""}
                  placeholder="tailscale0"
                  onChange={(event) => updateField(ref, "system_interface_name", event.target.value || undefined)}
                />
              </label>
              <label className="field">
                <span>System Interface MTU (since sing-box 1.13.0)</span>
                <input
                  type="number"
                  value={typeof entity.system_interface_mtu === "number" ? entity.system_interface_mtu : ""}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    updateField(
                      ref,
                      "system_interface_mtu",
                      event.target.value === "" || !Number.isFinite(parsed) ? undefined : parsed,
                    );
                  }}
                />
              </label>
            </>
          ) : null}
          <AdvancedScalarFields entity={entity} handledFields={endpointHandledFields} entityRef={ref} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={endpointHandledFields} entityRef={ref} updateField={updateField} />
        </>
      ) : null}

      {ref.kind === "service" ? (
        <>
          {entityType === "resolved" ? (
            <PlatformBanner
              kind="platform"
              text="Platform gate: service `resolved` is Linux/systemd specific. Exports work on any host but sing-box will refuse to start on macOS/Windows/Android/iOS."
            />
          ) : null}
          {entityType === "ssm-api" ? (
            <>
              {(() => {
                const allShadowsocksInbounds = (config.inbounds ?? []).filter(
                  (inbound) => inbound.type === "shadowsocks" && typeof inbound.tag === "string",
                );
                const managedTags = allShadowsocksInbounds
                  .filter((inbound) => Boolean(inbound.managed))
                  .map((inbound) => inbound.tag as string);
                const serversMap = objectField(entity.servers);
                const selectedTags = new Set(
                  Object.values(serversMap).filter((value): value is string => typeof value === "string"),
                );
                const toggleManaged = (tag: string) => {
                  const wasSelected = selectedTags.has(tag);
                  const nextMap: Record<string, unknown> = { ...serversMap };
                  for (const key of Object.keys(nextMap)) {
                    if (nextMap[key] === tag) delete nextMap[key];
                  }
                  if (!wasSelected) {
                    const path = Object.keys(nextMap).length === 0 ? "/" : `/${tag}`;
                    nextMap[path] = tag;
                  }
                  updateField(ref, "servers", nextMap);
                  updateField({ kind: "inbound", tag }, "managed", !wasSelected || undefined);
                };
                return (
                  <fieldset className="field field--checklist" data-testid="ssm-managed-checklist">
                    <legend>Managed Shadowsocks Inbounds</legend>
                    {allShadowsocksInbounds.length === 0 ? (
                      <p className="field__hint">Add a Shadowsocks inbound first to manage it via SSM API.</p>
                    ) : null}
                    {allShadowsocksInbounds.map((inbound) => {
                      const tag = inbound.tag as string;
                      const isSelected = selectedTags.has(tag);
                      const isManaged = managedTags.includes(tag);
                      return (
                        <label key={tag} className="toggle-row toggle-row--inline">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleManaged(tag)}
                          />
                          <span>
                            {tag}
                            {isSelected && !isManaged ? <em> (sets managed=true)</em> : null}
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                );
              })()}
              <label className="field">
                <span>Cache Path</span>
                <input
                  value={String(entity.cache_path ?? "")}
                  onChange={(event) => updateField(ref, "cache_path", event.target.value || undefined)}
                />
              </label>
              <JsonField key={`${JSON.stringify(ref)}:ssm-servers`} label="Endpoint Mapping JSON (advanced multi-path)" value={entity.servers ?? {}} onChange={(value) => updateField(ref, "servers", value)} />
            </>
          ) : null}

          {entityType === "derp" ? (
            <>
              <PlatformBanner
                kind="build-tag"
                text="Build-tag gate: service `derp` requires sing-box built with the `with_tailscale` tag for verify_client_endpoint integration (in official default builds; absent only from custom builds that drop it)."
              />
              <label className="field">
                <span>Config Path</span>
                <input
                  value={String(entity.config_path ?? "")}
                  onChange={(event) => updateField(ref, "config_path", event.target.value)}
                />
              </label>
              {(() => {
                const tailscaleEndpoints = endpointTags(config, "tailscale");
                const rawValue = entity.verify_client_endpoint;
                const currentEndpoints = Array.isArray(rawValue)
                  ? (rawValue as unknown[]).filter((item): item is string => typeof item === "string")
                  : typeof rawValue === "string" && rawValue.length > 0
                    ? [rawValue]
                    : [];
                const toggleEndpoint = (candidate: string) => {
                  const next = currentEndpoints.includes(candidate)
                    ? currentEndpoints.filter((item) => item !== candidate)
                    : [...currentEndpoints, candidate];
                  updateField(ref, "verify_client_endpoint", next.length ? next : undefined);
                };
                return (
                  <fieldset className="field field--checklist" data-testid="derp-endpoint-checklist">
                    <legend>Verify Tailscale Endpoints</legend>
                    {tailscaleEndpoints.length === 0 ? (
                      <p className="field__hint">Add a Tailscale endpoint first to authorize DERP clients.</p>
                    ) : null}
                    {tailscaleEndpoints.map((endpoint) => (
                      <label key={endpoint} className="toggle-row toggle-row--inline">
                        <input
                          type="checkbox"
                          checked={currentEndpoints.includes(endpoint)}
                          onChange={() => toggleEndpoint(endpoint)}
                        />
                        <span>{endpoint}</span>
                      </label>
                    ))}
                    {currentEndpoints.filter((tag) => !tailscaleEndpoints.includes(tag)).map((stale) => (
                      <label key={`stale-${stale}`} className="toggle-row toggle-row--inline toggle-row--stale">
                        <input type="checkbox" checked readOnly />
                        <span>{stale} <em>(missing)</em></span>
                      </label>
                    ))}
                  </fieldset>
                );
              })()}
              <label className="field">
                <span>Home</span>
                <input
                  value={String(entity.home ?? "")}
                  onChange={(event) => updateField(ref, "home", event.target.value)}
                  placeholder="blank or redirect URL"
                />
              </label>
              {(() => {
                const rows = Array.isArray(entity.verify_client_url)
                  ? (entity.verify_client_url as InspectorEntity[])
                  : [];
                const writeRows = (next: InspectorEntity[]) =>
                  updateField(ref, "verify_client_url", next.length ? next : undefined);
                const patchRow = (index: number, patch: InspectorEntity) =>
                  writeRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
                return (
                  <fieldset className="field field--checklist" data-testid="derp-verify-client-url">
                    <legend>Verify Client URL</legend>
                    {rows.length === 0 ? (
                      <p className="field__hint">No verify-client URLs configured. Add one to enforce client identity at HTTP layer.</p>
                    ) : null}
                    {rows.map((row, index) => (
                      <div key={index} className="rule-row">
                        <label className="field">
                          <span>URL</span>
                          <input
                            value={typeof row.url === "string" ? row.url : ""}
                            placeholder="https://verify.example.com/check"
                            onChange={(event) => patchRow(index, { url: event.target.value || undefined })}
                          />
                        </label>
                        <label className="field">
                          <span>Detour</span>
                          <input
                            value={typeof row.detour === "string" ? row.detour : ""}
                            placeholder="(outbound tag)"
                            onChange={(event) => patchRow(index, { detour: event.target.value || undefined })}
                          />
                        </label>
                        <button
                          type="button"
                          className="icon-danger"
                          aria-label={`Remove verify URL ${index + 1}`}
                          onClick={() => writeRows(rows.filter((_, i) => i !== index))}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button type="button" className="palette-action" onClick={() => writeRows([...rows, { url: "" }])}>
                      Add verify URL
                    </button>
                  </fieldset>
                );
              })()}
              {(() => {
                const peers = Array.isArray(entity.mesh_with)
                  ? (entity.mesh_with as InspectorEntity[])
                  : [];
                const writePeers = (next: InspectorEntity[]) =>
                  updateField(ref, "mesh_with", next.length ? next : undefined);
                const patchPeer = (index: number, patch: InspectorEntity) =>
                  writePeers(peers.map((row, i) => (i === index ? { ...row, ...patch } : row)));
                return (
                  <fieldset className="field field--checklist" data-testid="derp-mesh-with">
                    <legend>Mesh peers (mesh_with)</legend>
                    {peers.length === 0 ? (
                      <p className="field__hint">No mesh peers configured.</p>
                    ) : null}
                    {peers.map((peer, index) => (
                      <div key={index} className="rule-row">
                        <label className="field">
                          <span>Server (required)</span>
                          <input
                            value={typeof peer.server === "string" ? peer.server : ""}
                            placeholder="derp2.example.com"
                            onChange={(event) => patchPeer(index, { server: event.target.value || undefined })}
                          />
                        </label>
                        <label className="field">
                          <span>Server port (required)</span>
                          <input
                            type="number"
                            value={typeof peer.server_port === "number" ? peer.server_port : ""}
                            placeholder="8443"
                            onChange={(event) => {
                              const next = Number(event.target.value);
                              patchPeer(index, {
                                server_port: Number.isFinite(next) && next > 0 ? next : undefined,
                              });
                            }}
                          />
                        </label>
                        <label className="field">
                          <span>Host (optional)</span>
                          <input
                            value={typeof peer.host === "string" ? peer.host : ""}
                            onChange={(event) => patchPeer(index, { host: event.target.value || undefined })}
                          />
                        </label>
                        <button
                          type="button"
                          className="icon-danger"
                          aria-label={`Remove mesh peer ${index + 1}`}
                          onClick={() => writePeers(peers.filter((_, i) => i !== index))}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="palette-action"
                      onClick={() => writePeers([...peers, { server: "", server_port: 8443 }])}
                    >
                      Add mesh peer
                    </button>
                  </fieldset>
                );
              })()}
              <label className="field">
                <span>Mesh PSK</span>
                <input
                  value={String(entity.mesh_psk ?? "")}
                  onChange={(event) => updateField(ref, "mesh_psk", event.target.value || undefined)}
                />
              </label>
              <label className="field">
                <span>Mesh PSK File</span>
                <input
                  value={String(entity.mesh_psk_file ?? "")}
                  onChange={(event) => updateField(ref, "mesh_psk_file", event.target.value || undefined)}
                />
              </label>
              {(() => {
                const stunValue = entity.stun;
                const isShorthand = typeof stunValue === "number";
                const stun = isShorthand
                  ? ({ enabled: true, listen_port: stunValue } as InspectorEntity)
                  : objectField(stunValue);
                const writeStun = (patch: InspectorEntity) => {
                  const merged: InspectorEntity = { ...stun, ...patch };
                  if (merged.enabled === undefined || merged.enabled === false) {
                    const next: InspectorEntity = {};
                    for (const [k, v] of Object.entries(merged)) {
                      if (k === "enabled") continue;
                      if (v === undefined || v === "") continue;
                      next[k] = v;
                    }
                    updateField(ref, "stun", Object.keys(next).length ? { enabled: false, ...next } : undefined);
                    return;
                  }
                  const cleaned: InspectorEntity = {};
                  for (const [k, v] of Object.entries(merged)) {
                    if (v === undefined || v === "") continue;
                    cleaned[k] = v;
                  }
                  updateField(ref, "stun", cleaned);
                };
                return (
                  <fieldset className="field field--checklist" data-testid="derp-stun">
                    <legend>STUN</legend>
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={Boolean(stun.enabled)}
                        onChange={(event) => writeStun({ enabled: event.target.checked })}
                      />
                      <span>Enabled</span>
                    </label>
                    <label className="field">
                      <span>Listen</span>
                      <input
                        value={typeof stun.listen === "string" ? stun.listen : ""}
                        placeholder="::"
                        onChange={(event) => writeStun({ listen: event.target.value || undefined })}
                      />
                    </label>
                    <label className="field">
                      <span>Listen port</span>
                      <input
                        type="number"
                        value={typeof stun.listen_port === "number" ? stun.listen_port : ""}
                        placeholder="3478"
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          writeStun({ listen_port: Number.isFinite(next) && next > 0 ? next : undefined });
                        }}
                      />
                    </label>
                  </fieldset>
                );
              })()}
            </>
          ) : null}

          {entityType === "ccm" || entityType === "ocm" ? (
            <>
              <label className="field">
                <span>Credential Path</span>
                <input
                  value={String(entity.credential_path ?? "")}
                  onChange={(event) => updateField(ref, "credential_path", event.target.value || undefined)}
                />
              </label>
              <label className="field">
                <span>Usages Path</span>
                <input
                  value={String(entity.usages_path ?? "")}
                  onChange={(event) => updateField(ref, "usages_path", event.target.value || undefined)}
                />
              </label>
              <label className="field">
                <span>API Detour</span>
                <select
                  value={String(entity.detour ?? "")}
                  onChange={(event) => updateField(ref, "detour", event.target.value || undefined)}
                >
                  <option value="">Default outbound</option>
                  {outboundTags(config).map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>
              {(() => {
                const users = Array.isArray(entity.users) ? (entity.users as Record<string, unknown>[]) : [];
                const writeUsers = (next: Record<string, unknown>[]) =>
                  updateField(ref, "users", next.length ? next : undefined);
                const patchUser = (index: number, patch: Record<string, unknown>) =>
                  writeUsers(users.map((user, i) => (i === index ? { ...user, ...patch } : user)));
                const removeUser = (index: number) => writeUsers(users.filter((_, i) => i !== index));
                const addUser = () =>
                  writeUsers([...users, { name: `user${users.length + 1}`, token: "" }]);
                return (
                  <fieldset className="field field--checklist" data-testid={`${entityType}-users-editor`}>
                    <legend>Users</legend>
                    {users.length === 0 ? (
                      <p className="field__hint">No users yet. Click Add to create one.</p>
                    ) : null}
                    {users.map((user, index) => (
                      <div key={index} className="rule-row">
                        <label className="field">
                          <span>Name</span>
                          <input
                            value={String(user.name ?? "")}
                            onChange={(event) => patchUser(index, { name: event.target.value })}
                          />
                        </label>
                        <SensitiveTextField
                          label="Token"
                          value={String(user.token ?? "")}
                          onChange={(next) => patchUser(index, { token: next })}
                        />
                        <button type="button" className="icon-danger" onClick={() => removeUser(index)} aria-label={`Remove user ${index + 1}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button type="button" className="palette-action" onClick={addUser}>
                      Add user
                    </button>
                  </fieldset>
                );
              })()}
              {(() => {
                const headers = objectField(entity.headers);
                const entries = Object.entries(headers);
                const writeHeaders = (next: Record<string, unknown>) =>
                  updateField(ref, "headers", Object.keys(next).length ? next : undefined);
                const renameHeader = (oldKey: string, newKey: string) => {
                  if (oldKey === newKey) return;
                  const next: Record<string, unknown> = {};
                  for (const [k, v] of entries) {
                    next[k === oldKey ? newKey : k] = v;
                  }
                  writeHeaders(next);
                };
                const setHeaderValue = (key: string, value: string) => {
                  const next: Record<string, unknown> = {};
                  for (const [k, v] of entries) {
                    next[k] = k === key ? value : v;
                  }
                  writeHeaders(next);
                };
                const removeHeader = (key: string) => {
                  const next = Object.fromEntries(entries.filter(([k]) => k !== key));
                  writeHeaders(next);
                };
                const addHeader = () => {
                  let candidate = "X-Header";
                  let suffix = 1;
                  while (Object.prototype.hasOwnProperty.call(headers, candidate)) {
                    suffix += 1;
                    candidate = `X-Header-${suffix}`;
                  }
                  writeHeaders({ ...headers, [candidate]: "" });
                };
                return (
                  <fieldset className="field field--checklist" data-testid={`${entityType}-headers-editor`}>
                    <legend>Headers</legend>
                    {entries.length === 0 ? (
                      <p className="field__hint">No custom HTTP headers.</p>
                    ) : null}
                    {entries.map(([key, value]) => (
                      <div key={key} className="rule-row">
                        <label className="field">
                          <span>Name</span>
                          <input value={key} onChange={(event) => renameHeader(key, event.target.value)} />
                        </label>
                        <label className="field">
                          <span>Value</span>
                          <input value={String(value ?? "")} onChange={(event) => setHeaderValue(key, event.target.value)} />
                        </label>
                        <button type="button" className="icon-danger" onClick={() => removeHeader(key)} aria-label={`Remove header ${key}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button type="button" className="palette-action" onClick={addHeader}>
                      Add header
                    </button>
                  </fieldset>
                );
              })()}
            </>
          ) : null}

          {entityType === "hysteria-realm" ? (
            <>
              <PlatformBanner
                kind="channel"
                text={
                  channel === "stable"
                    ? "Channel gate: service hysteria-realm is testing-only (sing-box 1.14+). The current channel is stable; exporting this node will fail sing-box check."
                    : "Channel gate: service hysteria-realm is 1.14 testing-only. Stable targets will refuse to load it."
                }
              />
              {(() => {
                const users = Array.isArray(entity.users) ? (entity.users as Record<string, unknown>[]) : [];
                const writeUsers = (next: Record<string, unknown>[]) =>
                  updateField(ref, "users", next.length ? next : undefined);
                const patchUser = (index: number, patch: Record<string, unknown>) =>
                  writeUsers(users.map((user, i) => (i === index ? { ...user, ...patch } : user)));
                const removeUser = (index: number) => writeUsers(users.filter((_, i) => i !== index));
                const addUser = () => writeUsers([...users, { name: `user${users.length + 1}`, token: "" }]);
                return (
                  <fieldset className="field field--checklist" data-testid="hysteria-realm-users-editor">
                    <legend>Realm Users</legend>
                    {users.length === 0 ? (
                      <p className="field__hint">No users yet. Click Add to create one.</p>
                    ) : null}
                    {users.map((user, index) => (
                      <div key={index} className="rule-row">
                        <label className="field">
                          <span>Name</span>
                          <input
                            value={String(user.name ?? "")}
                            onChange={(event) => patchUser(index, { name: event.target.value })}
                          />
                        </label>
                        <SensitiveTextField
                          label="Token"
                          value={String(user.token ?? "")}
                          onChange={(next) => patchUser(index, { token: next })}
                        />
                        <label className="field">
                          <span>Max Realms</span>
                          <input
                            type="number"
                            value={Number(user.max_realms ?? 0)}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              patchUser(index, {
                                max_realms: Number.isFinite(value) && value > 0 ? value : undefined,
                              });
                            }}
                            placeholder="0 = unlimited"
                          />
                        </label>
                        <button
                          type="button"
                          className="icon-danger"
                          onClick={() => removeUser(index)}
                          aria-label={`Remove user ${index + 1}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button type="button" className="palette-action" onClick={addUser}>
                      Add user
                    </button>
                  </fieldset>
                );
              })()}
            </>
          ) : null}

          <AdvancedScalarFields entity={entity} handledFields={serviceHandledFields} entityRef={ref} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={serviceHandledFields} entityRef={ref} updateField={updateField} />
        </>
      ) : null}

      {ref.kind === "rule-set" ? (
        <>
          {entity.type === "remote" || entity.type === "local" ? (
            <label className="field">
              <span>Format</span>
              <select
                value={String(entity.format ?? "source")}
                onChange={(event) => updateField(ref, "format", event.target.value)}
              >
                <option value="source">source</option>
                <option value="binary">binary</option>
              </select>
            </label>
          ) : null}
          {entity.type === "remote" ? (
            <>
              <label className="field">
                <span>URL</span>
                <input
                  value={String(entity.url ?? "")}
                  onChange={(event) => updateField(ref, "url", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Update Interval</span>
                <input
                  value={String(entity.update_interval ?? "")}
                  onChange={(event) => updateField(ref, "update_interval", event.target.value || undefined)}
                />
              </label>
              {channel === "testing" && entity.download_detour ? (
                <PlatformBanner
                  kind="deprecated"
                  text="`download_detour` is deprecated in sing-box 1.14.0 (removed in 1.16.0). Use an HTTP Client (`http_client`) instead."
                />
              ) : null}
              <label className="field">
                <span>Download Detour</span>
                <select
                  value={String(entity.download_detour ?? "")}
                  onChange={(event) => updateField(ref, "download_detour", event.target.value || undefined)}
                >
                  <option value="">Default outbound</option>
                  {outboundTags(config).map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          {entity.type === "local" ? (
            <label className="field">
              <span>Path</span>
              <input
                value={String(entity.path ?? "")}
                onChange={(event) => updateField(ref, "path", event.target.value)}
              />
            </label>
          ) : null}
          {entity.type === "inline" ? (
            <InlineRuleSetEditor
              key={`${JSON.stringify(ref)}:inline-rules`}
              value={entity.rules}
              onChange={(value) => updateField(ref, "rules", value)}
            />
          ) : null}
          <AdvancedScalarFields entity={entity} handledFields={ruleSetHandledFields} entityRef={ref} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={ruleSetHandledFields} entityRef={ref} updateField={updateField} />
        </>
      ) : null}

      {ref.kind === "certificate-provider" ? (
        <>
          {certificateProviderFields(entityType, config).map((definition) => (
            <SharedFieldControl
              key={definition.path.join(".")}
              definition={definition}
              entity={entity}
              entityRef={ref}
              updateField={updateField}
            />
          ))}
          <AdvancedScalarFields entity={entity} handledFields={certificateProviderHandledFields} entityRef={ref} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={certificateProviderHandledFields} entityRef={ref} updateField={updateField} />
        </>
      ) : null}

      {(() => {
        const tls = (entity as Record<string, unknown>).tls;
        if (!tls || typeof tls !== "object" || Array.isArray(tls)) return null;
        const acme = (tls as Record<string, unknown>).acme;
        if (!acme || typeof acme !== "object" || Array.isArray(acme)) return null;
        return (
          <PlatformBanner
            kind="deprecated"
            text="Inline tls.acme is deprecated since sing-box 1.14.0. Move the ACME options into tls.certificate_provider (type=acme) or a top-level certificate_providers[] entry. The current value still round-trips, but sing-box will reject it after the field is removed."
          />
        );
      })()}
      <SharedFieldCards
        groups={sharedGroups}
        entity={entity}
        entityRef={ref}
        entityType={entityType}
        config={config}
        channel={channel}
        updateField={updateField}
      />
    </aside>
  );
}
