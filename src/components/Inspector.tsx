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
import { ModuleCard, PlatformBanner, SensitiveTextField } from "./inspector/controls";
import { AdvancedNonScalarFields, AdvancedScalarFields } from "./inspector/advancedFields";
import { DnsRuleInspector, RouteRuleInspector } from "./inspector/ruleInspectors";
import { OutboundInspector } from "./inspector/outboundInspector";
import { DnsServerInspector } from "./inspector/dnsServerInspector";
import { EndpointInspector } from "./inspector/endpointInspector";
import { ServiceInspector } from "./inspector/serviceInspector";
import { CertificateProviderInspector } from "./inspector/certificateProviderInspector";
import { RuleSetInspector } from "./inspector/ruleSetInspector";
import {
  SharedFieldCards,
  sharedFieldDefinitions,
} from "./inspector/sharedFields";
import {
  inboundHandledFields,
} from "./inspector/handledFields";
// Preserve the public API the C17 guard test imports from this module (moved to inspector/handledFields).
export { INLINE_RENDERED_KEYS, inboundHandledFields, outboundHandledFields, structurallyCoveredKeys } from "./inspector/handledFields";
import {
  endpointTags,
  endpointReferences,
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
        <OutboundInspector entity={entity} entityRef={ref} config={config} channel={channel} entityType={entityType} tagValue={tagValue} updateField={updateField} />
      ) : null}

      {ref.kind === "dns-server" ? (
        <DnsServerInspector entity={entity} entityRef={ref} config={config} channel={channel} entityType={entityType} updateField={updateField} />
      ) : null}

      {ref.kind === "endpoint" ? (
        <EndpointInspector entity={entity} entityRef={ref} entityType={entityType} tagValue={tagValue} selectedEndpointReferences={selectedEndpointReferences} updateField={updateField} />
      ) : null}

      {ref.kind === "service" ? (
        <ServiceInspector entity={entity} entityRef={ref} config={config} channel={channel} entityType={entityType} updateField={updateField} />
      ) : null}

      {ref.kind === "rule-set" ? (
        <RuleSetInspector entity={entity} entityRef={ref} config={config} channel={channel} updateField={updateField} />
      ) : null}

      {ref.kind === "certificate-provider" ? (
        <CertificateProviderInspector entity={entity} entityRef={ref} config={config} entityType={entityType} updateField={updateField} />
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
