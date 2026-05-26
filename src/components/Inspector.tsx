import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Braces,
  GitBranch,
  Globe2,
  Layers3,
  Network,
  RadioTower,
  Route,
  Server,
  Trash2,
  Waypoints,
  X,
} from "lucide-react";
import type { EntityRef, SingBoxConfig } from "../domain/types";
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
import { useProjectStore } from "../state/useProjectStore";
import { DnsRulesTable, RouteRulesTable } from "./RuleTables";

type InspectorEntity = Record<string, unknown>;
type InspectorKind = EntityRef["kind"];
type UpdateField = (ref: EntityRef, field: string, value: unknown) => void;

const inspectorIcons = {
  inbound: RadioTower,
  outbound: Network,
  "dns-server": Server,
  endpoint: Waypoints,
  service: Server,
  "rule-set": Layers3,
  route: Route,
  "route-rule": GitBranch,
  dns: Globe2,
  "dns-rule": GitBranch,
  settings: Braces,
} satisfies Record<InspectorKind, typeof Braces>;

function selectedRefFromId(id: string | null): EntityRef | null {
  if (!id) return null;
  const [kind, ...rest] = id.split(":");
  const value = rest.join(":");
  if (kind === "inbound" && value) return { kind: "inbound", tag: value };
  if (kind === "outbound" && value) return { kind: "outbound", tag: value };
  if (kind === "dns-server" && value) return { kind: "dns-server", tag: value };
  if (kind === "endpoint" && value) return { kind: "endpoint", tag: value };
  if (kind === "service" && value) return { kind: "service", tag: value };
  if (kind === "rule-set" && value) return { kind: "rule-set", tag: value };
  if (kind === "route") return { kind: "route", id: "main" };
  if (kind === "dns") return { kind: "dns", id: "main" };
  if (kind === "route-rule" && value) return { kind: "route-rule", index: Number(value) };
  if (kind === "dns-rule" && value) return { kind: "dns-rule", index: Number(value) };
  if (kind === "settings" && value) return { kind: "settings", path: value as keyof SingBoxConfig };
  return null;
}

function generatedIndex(value: string, kind: "inbound" | "outbound" | "dns-server" | "endpoint" | "service" | "rule-set") {
  const prefix = `untagged-${kind}-`;
  if (!value.startsWith(prefix)) return -1;
  const index = Number(value.slice(prefix.length)) - 1;
  return Number.isInteger(index) && index >= 0 ? index : -1;
}

function findTaggedOrGenerated<T extends { tag?: string }>(
  items: T[] | undefined,
  tag: string,
  kind: "inbound" | "outbound" | "dns-server" | "endpoint" | "service" | "rule-set",
) {
  const byTag = items?.find((item) => item.tag === tag);
  if (byTag) return byTag;
  const index = generatedIndex(tag, kind);
  return index >= 0 ? items?.[index] : undefined;
}

function toList(value: unknown): string {
  return Array.isArray(value) ? value.join(", ") : "";
}

function fromList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const listenSharedFields = [
  "listen",
  "listen_port",
  "bind_interface",
  "routing_mark",
  "reuse_addr",
  "netns",
  "tcp_fast_open",
  "tcp_multi_path",
  "disable_tcp_keep_alive",
  "tcp_keep_alive",
  "tcp_keep_alive_interval",
  "udp_fragment",
  "udp_timeout",
  "detour",
];
const dialSharedFields = [
  "detour",
  "bind_interface",
  "inet4_bind_address",
  "inet6_bind_address",
  "bind_address_no_port",
  "routing_mark",
  "reuse_addr",
  "netns",
  "connect_timeout",
  "tcp_fast_open",
  "tcp_multi_path",
  "disable_tcp_keep_alive",
  "tcp_keep_alive",
  "tcp_keep_alive_interval",
  "udp_fragment",
  "domain_resolver",
  "network_strategy",
  "network_type",
  "fallback_network_type",
  "fallback_delay",
  "domain_strategy",
];
const quicSharedFields = ["initial_packet_size", "disable_path_mtu_discovery", "idle_timeout", "keep_alive_period"];
const inboundHandledFields = new Set([
  "tag",
  "type",
  "address",
  "auto_route",
  "tls",
  "multiplex",
  "transport",
  "handshake",
  ...listenSharedFields,
  ...quicSharedFields,
]);
const outboundHandledFields = new Set([
  "tag",
  "type",
  "server",
  "server_port",
  "outbounds",
  "default",
  "tls",
  "multiplex",
  "transport",
  "udp_over_tcp",
  ...dialSharedFields,
  ...quicSharedFields,
]);
const dnsServerHandledFields = new Set([
  "tag",
  "type",
  "address",
  "server",
  "server_port",
  "path",
  "endpoint",
  "tls",
  "neighbor_domain",
  ...dialSharedFields,
]);
const endpointHandledFields = new Set([
  "tag",
  "type",
  "address",
  "private_key",
  "peers",
  "detour",
  "state_directory",
  "control_url",
  "advertise_routes",
  "advertise_tags",
  "relay_server_static_endpoints",
  ...dialSharedFields,
]);
const serviceHandledFields = new Set([
  "tag",
  "type",
  "listen",
  "listen_port",
  "tls",
  "servers",
  "cache_path",
  "config_path",
  "verify_client_endpoint",
  "verify_client_url",
  "home",
  "mesh_with",
  "mesh_psk",
  "mesh_psk_file",
  "stun",
  "credential_path",
  "usages_path",
  "users",
  "headers",
  "detour",
  "idle_timeout",
  "keep_alive_period",
  "stream_receive_window",
  "connection_receive_window",
  "max_concurrent_streams",
  ...listenSharedFields,
]);
const ruleSetHandledFields = new Set(["tag", "type", "format", "url", "path", "update_interval", "download_detour", "http_client"]);

function labelForField(field: string) {
  return field
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function editableScalarFields(entity: InspectorEntity, handledFields: Set<string>) {
  return Object.entries(entity).filter(([field, value]) => {
    if (handledFields.has(field)) return false;
    const valueType = typeof value;
    return valueType === "string" || valueType === "number" || valueType === "boolean";
  });
}

function editableNonScalarFields(entity: InspectorEntity, handledFields: Set<string>) {
  return Object.entries(entity).filter(([field, value]) => {
    if (handledFields.has(field)) return false;
    if (value === null || value === undefined) return false;
    const valueType = typeof value;
    if (valueType === "string" || valueType === "number" || valueType === "boolean") return false;
    return Array.isArray(value) || valueType === "object";
  });
}

function objectField(value: unknown): InspectorEntity {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as InspectorEntity) : {};
}

function outboundTags(config: SingBoxConfig, excludeTag?: string) {
  return (config.outbounds ?? [])
    .map((outbound) => outbound.tag)
    .filter((tag): tag is string => Boolean(tag && tag !== excludeTag));
}

function endpointTags(config: SingBoxConfig, type?: string) {
  return (config.endpoints ?? [])
    .filter((endpoint) => !type || endpoint.type === type)
    .map((endpoint) => endpoint.tag)
    .filter((tag): tag is string => Boolean(tag));
}

function inboundTags(config: SingBoxConfig, type?: string) {
  return (config.inbounds ?? [])
    .filter((inbound) => !type || inbound.type === type)
    .map((inbound) => inbound.tag)
    .filter((tag): tag is string => Boolean(tag));
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

function listishToText(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function textToRuleList(value: string, currentValue: unknown) {
  const items = fromList(value);
  if (!items.length) return undefined;
  if (Array.isArray(currentValue) && currentValue.every((item) => typeof item === "number")) {
    return items.map((item) => Number(item)).filter((item) => Number.isFinite(item));
  }
  return items;
}

function ruleFieldValue(rule: InspectorEntity, field: string) {
  return listishToText(rule[field]);
}

const routeRulePrimaryFields = new Set([
  "type",
  "mode",
  "rules",
  "inbound",
  "domain_suffix",
  "domain_keyword",
  "domain",
  "domain_regex",
  "rule_set",
  "outbound",
  "action",
  "invert",
  "method",
  "no_drop",
  "sniffer",
  "timeout",
  "server",
  "strategy",
]);

const dnsRulePrimaryFields = new Set([
  "type",
  "mode",
  "rules",
  "inbound",
  "query_type",
  "domain_suffix",
  "domain_keyword",
  "domain",
  "domain_regex",
  "rule_set",
  "server",
  "action",
  "invert",
  "method",
  "no_drop",
  "rcode",
]);

const routeRuleAdvancedFields = [
  "ip_version",
  "network",
  "auth_user",
  "protocol",
  "client",
  "geosite",
  "source_geoip",
  "geoip",
  "source_ip_cidr",
  "source_ip_is_private",
  "ip_cidr",
  "ip_is_private",
  "source_port",
  "source_port_range",
  "port",
  "port_range",
  "process_name",
  "process_path",
  "process_path_regex",
  "package_name",
  "user",
  "user_id",
  "clash_mode",
  "network_type",
  "network_is_expensive",
  "network_is_constrained",
  "preferred_by",
  "rule_set_ip_cidr_match_source",
];

const dnsRuleAdvancedFields = [
  "ip_version",
  "network",
  "auth_user",
  "protocol",
  "geosite",
  "source_geoip",
  "geoip",
  "source_ip_cidr",
  "source_ip_is_private",
  "ip_cidr",
  "ip_is_private",
  "ip_accept_any",
  "source_port",
  "source_port_range",
  "port",
  "port_range",
  "process_name",
  "process_path",
  "process_path_regex",
  "package_name",
  "user",
  "user_id",
  "clash_mode",
  "network_type",
  "network_is_expensive",
  "network_is_constrained",
  "rule_set_ip_cidr_match_source",
  "rule_set_ip_cidr_accept_empty",
  "disable_cache",
  "rewrite_ttl",
  "client_subnet",
];

function AdvancedScalarFields({
  entity,
  handledFields,
  entityRef,
  updateField,
}: {
  entity: InspectorEntity;
  handledFields: Set<string>;
  entityRef: EntityRef;
  updateField: UpdateField;
}) {
  const fields = editableScalarFields(entity, handledFields);
  if (!fields.length) return null;
  return (
    <details className="advanced-fields">
      <summary>Advanced fields <span>{fields.length}</span></summary>
      <div className="advanced-fields__body">
        {fields.map(([field, value]) =>
          typeof value === "boolean" ? (
            <label className="toggle-row" key={field}>
              <input
                type="checkbox"
                checked={value}
                onChange={(event) => updateField(entityRef, field, event.target.checked)}
              />
              <span>{labelForField(field)}</span>
            </label>
          ) : (
            <label className="field" key={field}>
              <span>{labelForField(field)}</span>
              <input
                type={typeof value === "number" ? "number" : "text"}
                value={String(value)}
                onChange={(event) =>
                  updateField(entityRef, field, typeof value === "number" ? Number(event.target.value) : event.target.value)
                }
              />
            </label>
          ),
        )}
      </div>
    </details>
  );
}

function JsonField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        value={JSON.stringify(value ?? null, null, 2)}
        onChange={(event) => {
          try {
            onChange(JSON.parse(event.target.value));
          } catch {
            onChange(event.target.value);
          }
        }}
      />
    </label>
  );
}

function AdvancedNonScalarFields({
  entity,
  handledFields,
  entityRef,
  updateField,
}: {
  entity: InspectorEntity;
  handledFields: Set<string>;
  entityRef: EntityRef;
  updateField: UpdateField;
}) {
  const fields = editableNonScalarFields(entity, handledFields);
  if (!fields.length) return null;
  return (
    <details className="advanced-fields advanced-fields--non-scalar">
      <summary>Advanced JSON fields <span>{fields.length}</span></summary>
      <div className="advanced-fields__body">
        {fields.map(([field, value]) => (
          <JsonField
            key={field}
            label={labelForField(field)}
            value={value}
            onChange={(next) => updateField(entityRef, field, next)}
          />
        ))}
      </div>
    </details>
  );
}

function RuleListField({
  label,
  value,
  currentValue,
  onChange,
}: {
  label: string;
  value: unknown;
  currentValue?: unknown;
  onChange: (value: unknown) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={listishToText(value)}
        onChange={(event) => onChange(textToRuleList(event.target.value, currentValue ?? value))}
      />
    </label>
  );
}

function RuleAdvancedFields({
  fields,
  rule,
  onPatch,
}: {
  fields: string[];
  rule: InspectorEntity;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  return (
    <details className="advanced-fields">
      <summary>Advanced match fields <span>{fields.length}</span></summary>
      <div className="advanced-fields__body">
        {fields.map((field) => {
          const value = rule[field];
          if (typeof value === "boolean") {
            return (
              <label className="toggle-row" key={field}>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(event) => onPatch({ [field]: event.target.checked })}
                />
                <span>{labelForField(field)}</span>
              </label>
            );
          }
          if (typeof value === "number") {
            return (
              <label className="field" key={field}>
                <span>{labelForField(field)}</span>
                <input
                  type="number"
                  value={value}
                  onChange={(event) => onPatch({ [field]: Number(event.target.value) || undefined })}
                />
              </label>
            );
          }
          return (
            <RuleListField
              key={field}
              label={labelForField(field)}
              value={value}
              currentValue={value}
              onChange={(nextValue) => onPatch({ [field]: nextValue })}
            />
          );
        })}
      </div>
    </details>
  );
}

function SharedRuleFields({
  rule,
  onPatch,
}: {
  rule: InspectorEntity;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  return (
    <details className="advanced-fields">
      <summary>Shared Wi-Fi / Neighbor <span>4</span></summary>
      <div className="advanced-fields__body">
        <RuleListField label="Wi-Fi SSID" value={rule.wifi_ssid} onChange={(value) => onPatch({ wifi_ssid: value })} />
        <RuleListField label="Wi-Fi BSSID" value={rule.wifi_bssid} onChange={(value) => onPatch({ wifi_bssid: value })} />
        <RuleListField
          label="Source MAC"
          value={rule.source_mac_address}
          onChange={(value) => onPatch({ source_mac_address: value })}
        />
        <RuleListField
          label="Source Hostname"
          value={rule.source_hostname}
          onChange={(value) => onPatch({ source_hostname: value })}
        />
      </div>
    </details>
  );
}

function RouteRuleInspector({
  index,
  rule,
  config,
  updateRouteRule,
}: {
  index: number;
  rule: InspectorEntity;
  config: SingBoxConfig;
  updateRouteRule: (index: number, patch: Record<string, unknown>) => void;
}) {
  const isLogical = rule.type === "logical";
  const patch = (next: Record<string, unknown>) => updateRouteRule(index, next);

  return (
    <div className="rule-inspector" aria-label={`Route rule ${index + 1} inspector`}>
      <label className="field">
        <span>Rule Type</span>
        <select
          value={isLogical ? "logical" : "default"}
          onChange={(event) =>
            patch(
              event.target.value === "logical"
                ? { type: "logical", mode: String(rule.mode ?? "and"), rules: Array.isArray(rule.rules) ? rule.rules : [] }
                : { type: undefined, mode: undefined, rules: undefined },
            )
          }
        >
          <option value="default">Default match</option>
          <option value="logical">Logical group</option>
        </select>
      </label>

      {isLogical ? (
        <>
          <label className="field">
            <span>Mode</span>
            <select value={String(rule.mode ?? "and")} onChange={(event) => patch({ mode: event.target.value })}>
              <option value="and">and</option>
              <option value="or">or</option>
            </select>
          </label>
          <label className="field">
            <span>Rules JSON</span>
            <textarea
              value={JSON.stringify(rule.rules ?? [], null, 2)}
              onChange={(event) => {
                try {
                  patch({ rules: JSON.parse(event.target.value) });
                } catch {
                  patch({ rules: event.target.value });
                }
              }}
            />
          </label>
        </>
      ) : (
        <>
          <div className="inspector-section-title">Match</div>
          <RuleListField label="Inbound tags" value={rule.inbound} onChange={(value) => patch({ inbound: value })} />
          <RuleListField label="Domain suffix" value={rule.domain_suffix} onChange={(value) => patch({ domain_suffix: value })} />
          <RuleListField label="Domain keyword" value={rule.domain_keyword} onChange={(value) => patch({ domain_keyword: value })} />
          <RuleListField label="Domain" value={rule.domain} onChange={(value) => patch({ domain: value })} />
          <RuleListField label="Domain regex" value={rule.domain_regex} onChange={(value) => patch({ domain_regex: value })} />
          <RuleListField label="Rule Set" value={rule.rule_set} onChange={(value) => patch({ rule_set: value })} />
        </>
      )}

      <div className="inspector-section-title">Action</div>
      <label className="field">
        <span>Action</span>
        <select
          value={String(rule.action ?? "route")}
          onChange={(event) => {
            const nextAction = event.target.value;
            const cleared: Record<string, unknown> = { action: nextAction };
            if (nextAction !== "route" && nextAction !== "bypass" && rule.outbound !== undefined) {
              cleared.outbound = undefined;
            }
            patch(cleared);
          }}
        >
          <option value="route">route</option>
          <option value="bypass">bypass</option>
          <option value="reject">reject</option>
          <option value="hijack-dns">hijack-dns</option>
          <option value="route-options">route-options</option>
          <option value="sniff">sniff</option>
          <option value="resolve">resolve</option>
        </select>
      </label>
      {String(rule.action ?? "route") === "route" ? (
        <label className="field">
          <span>Outbound</span>
          <select value={String(rule.outbound ?? "")} onChange={(event) => patch({ outbound: event.target.value || undefined })}>
            <option value="">None</option>
            {(config.outbounds ?? []).map((outbound, outboundIndex) => (
              <option key={`${outbound.tag ?? "untagged"}-${outboundIndex}`} value={outbound.tag ?? ""}>
                {outbound.tag ?? `untagged-${outboundIndex + 1}`}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {String(rule.action) === "reject" ? (
        <>
          <label className="field">
            <span>Reject Method</span>
            <select value={String(rule.method ?? "default")} onChange={(event) => patch({ method: event.target.value === "default" ? undefined : event.target.value })}>
              <option value="default">default</option>
              <option value="drop">drop</option>
            </select>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={Boolean(rule.no_drop)} onChange={(event) => patch({ no_drop: event.target.checked || undefined })} />
            <span>No drop (only return)</span>
          </label>
        </>
      ) : null}
      {String(rule.action) === "sniff" ? (
        <>
          <RuleListField label="Sniffer" value={rule.sniffer} onChange={(value) => patch({ sniffer: value })} />
          <label className="field">
            <span>Sniff Timeout</span>
            <input type="text" value={String(rule.timeout ?? "")} onChange={(event) => patch({ timeout: event.target.value || undefined })} placeholder="300ms" />
          </label>
        </>
      ) : null}
      {String(rule.action) === "resolve" ? (
        <>
          <label className="field">
            <span>Resolve Server</span>
            <select value={String(rule.server ?? "")} onChange={(event) => patch({ server: event.target.value || undefined })}>
              <option value="">(default)</option>
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
            <span>Resolve Strategy</span>
            <select value={String(rule.strategy ?? "")} onChange={(event) => patch({ strategy: event.target.value || undefined })}>
              <option value="">(default)</option>
              <option value="prefer_ipv4">prefer_ipv4</option>
              <option value="prefer_ipv6">prefer_ipv6</option>
              <option value="ipv4_only">ipv4_only</option>
              <option value="ipv6_only">ipv6_only</option>
            </select>
          </label>
        </>
      ) : null}
      <label className="toggle-row">
        <input type="checkbox" checked={Boolean(rule.invert)} onChange={(event) => patch({ invert: event.target.checked || undefined })} />
        <span>Invert match</span>
      </label>

      {!isLogical ? <SharedRuleFields rule={rule} onPatch={patch} /> : null}
      {!isLogical ? <RuleAdvancedFields fields={routeRuleAdvancedFields} rule={rule} onPatch={patch} /> : null}
      <AdvancedScalarFields entity={rule} handledFields={routeRulePrimaryFields} entityRef={{ kind: "route-rule", index }} updateField={(_, field, value) => patch({ [field]: value })} />
    </div>
  );
}

function DnsRuleInspector({
  index,
  rule,
  config,
  updateDnsRule,
}: {
  index: number;
  rule: InspectorEntity;
  config: SingBoxConfig;
  updateDnsRule: (index: number, patch: Record<string, unknown>) => void;
}) {
  const isLogical = rule.type === "logical";
  const patch = (next: Record<string, unknown>) => updateDnsRule(index, next);

  return (
    <div className="rule-inspector" aria-label={`DNS rule ${index + 1} inspector`}>
      <label className="field">
        <span>Rule Type</span>
        <select
          value={isLogical ? "logical" : "default"}
          onChange={(event) =>
            patch(
              event.target.value === "logical"
                ? { type: "logical", mode: String(rule.mode ?? "and"), rules: Array.isArray(rule.rules) ? rule.rules : [] }
                : { type: undefined, mode: undefined, rules: undefined },
            )
          }
        >
          <option value="default">Default match</option>
          <option value="logical">Logical group</option>
        </select>
      </label>

      {isLogical ? (
        <>
          <label className="field">
            <span>Mode</span>
            <select value={String(rule.mode ?? "and")} onChange={(event) => patch({ mode: event.target.value })}>
              <option value="and">and</option>
              <option value="or">or</option>
            </select>
          </label>
          <label className="field">
            <span>Rules JSON</span>
            <textarea
              value={JSON.stringify(rule.rules ?? [], null, 2)}
              onChange={(event) => {
                try {
                  patch({ rules: JSON.parse(event.target.value) });
                } catch {
                  patch({ rules: event.target.value });
                }
              }}
            />
          </label>
        </>
      ) : (
        <>
          <div className="inspector-section-title">Match</div>
          <RuleListField label="Inbound tags" value={rule.inbound} onChange={(value) => patch({ inbound: value })} />
          <RuleListField label="Query type" value={rule.query_type} onChange={(value) => patch({ query_type: value })} />
          <RuleListField label="Domain suffix" value={rule.domain_suffix} onChange={(value) => patch({ domain_suffix: value })} />
          <RuleListField label="Domain keyword" value={rule.domain_keyword} onChange={(value) => patch({ domain_keyword: value })} />
          <RuleListField label="Domain" value={rule.domain} onChange={(value) => patch({ domain: value })} />
          <RuleListField label="Domain regex" value={rule.domain_regex} onChange={(value) => patch({ domain_regex: value })} />
          <RuleListField label="Rule Set" value={rule.rule_set} onChange={(value) => patch({ rule_set: value })} />
        </>
      )}

      <div className="inspector-section-title">Action</div>
      <label className="field">
        <span>Action</span>
        <select
          value={String(rule.action ?? "route")}
          onChange={(event) => {
            const nextAction = event.target.value;
            const cleared: Record<string, unknown> = { action: nextAction };
            if (nextAction !== "route" && rule.server !== undefined) cleared.server = undefined;
            patch(cleared);
          }}
        >
          <option value="route">route</option>
          <option value="evaluate">evaluate</option>
          <option value="respond">respond</option>
          <option value="route-options">route-options</option>
          <option value="reject">reject</option>
          <option value="predefined">predefined</option>
        </select>
      </label>
      {String(rule.action ?? "route") === "route" ? (
        <label className="field">
          <span>Server</span>
          <select value={String(rule.server ?? "")} onChange={(event) => patch({ server: event.target.value || undefined })}>
            <option value="">(default)</option>
            {(config.dns?.servers ?? []).map((server, serverIndex) => (
              <option key={`${server.tag ?? "untagged"}-${serverIndex}`} value={server.tag ?? ""}>
                {server.tag ?? `untagged-${serverIndex + 1}`}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {String(rule.action) === "reject" ? (
        <>
          <label className="field">
            <span>Reject Method</span>
            <select value={String(rule.method ?? "default")} onChange={(event) => patch({ method: event.target.value === "default" ? undefined : event.target.value })}>
              <option value="default">default</option>
              <option value="drop">drop</option>
            </select>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={Boolean(rule.no_drop)} onChange={(event) => patch({ no_drop: event.target.checked || undefined })} />
            <span>No drop (only return)</span>
          </label>
        </>
      ) : null}
      {String(rule.action) === "predefined" ? (
        <label className="field">
          <span>Predefined RCODE</span>
          <select value={String(rule.rcode ?? "NOERROR")} onChange={(event) => patch({ rcode: event.target.value === "NOERROR" ? undefined : event.target.value })}>
            <option value="NOERROR">NOERROR</option>
            <option value="FORMERR">FORMERR</option>
            <option value="SERVFAIL">SERVFAIL</option>
            <option value="NXDOMAIN">NXDOMAIN</option>
            <option value="NOTIMP">NOTIMP</option>
            <option value="REFUSED">REFUSED</option>
          </select>
        </label>
      ) : null}
      <label className="toggle-row">
        <input type="checkbox" checked={Boolean(rule.invert)} onChange={(event) => patch({ invert: event.target.checked || undefined })} />
        <span>Invert match</span>
      </label>

      {!isLogical ? <SharedRuleFields rule={rule} onPatch={patch} /> : null}
      {!isLogical ? <RuleAdvancedFields fields={dnsRuleAdvancedFields} rule={rule} onPatch={patch} /> : null}
      <AdvancedScalarFields entity={rule} handledFields={dnsRulePrimaryFields} entityRef={{ kind: "dns-rule", index }} updateField={(_, field, value) => patch({ [field]: value })} />
    </div>
  );
}

function ModuleCard({
  title,
  active,
  children,
}: {
  title: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <details className={`settings-module-card ${active ? "is-active" : ""}`}>
      <summary>
        <span>{title}</span>
        <strong>{active ? "ON" : "OFF"}</strong>
      </summary>
      <div className="settings-module-card__body">{children}</div>
    </details>
  );
}

type SharedFieldKind = "text" | "number" | "boolean" | "list" | "select";

type SharedFieldDefinition = {
  label: string;
  path: string[];
  kind: SharedFieldKind;
  options?: string[];
};

const networkStrategyOptions = ["default", "hybrid", "fallback"];
const tlsVersionOptions = ["1.0", "1.1", "1.2", "1.3"];
const transportTypeOptions = ["http", "ws", "quic", "grpc", "httpupgrade"];

const sharedGroupTitles: Record<SharedFieldGroupId, string> = {
  listen: "Listen Fields",
  dial: "Dial Fields",
  tls: "TLS",
  "http-client": "HTTP Client",
  http2: "HTTP2 Fields",
  quic: "QUIC Fields",
  "certificate-provider": "Certificate Provider",
  "dns01-challenge": "DNS01 Challenge",
  "pre-match": "Pre-match",
  multiplex: "Multiplex",
  "v2ray-transport": "V2Ray Transport",
  "udp-over-tcp": "UDP over TCP",
  "tcp-brutal": "TCP Brutal",
  "wifi-state": "Wi-Fi State",
  neighbor: "Neighbor Resolution",
};

function sharedValueAt(entity: InspectorEntity, path: string[]) {
  let current: unknown = entity;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as InspectorEntity)[segment];
  }
  return current;
}

function nestedPatch(entity: InspectorEntity, path: string[], value: unknown): { field: string; value: unknown } | null {
  const [field, ...nested] = path;
  if (!field) return null;
  if (!nested.length) return { field, value };
  const root = objectField(entity[field]);
  let cursor: InspectorEntity = { ...root };
  const nextRoot = cursor;
  for (let index = 0; index < nested.length - 1; index += 1) {
    const segment = nested[index];
    if (!segment) return null;
    const child = objectField(cursor[segment]);
    cursor[segment] = { ...child };
    cursor = cursor[segment] as InspectorEntity;
  }
  const last = nested[nested.length - 1];
  if (!last) return null;
  cursor[last] = value;
  return { field, value: nextRoot };
}

function isSharedValueActive(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return value;
  return value !== undefined && value !== null && value !== "";
}

function sharedFieldDefinitions(
  group: SharedFieldGroupId,
  ref: EntityRef,
  type: string | null,
  config: SingBoxConfig,
): SharedFieldDefinition[] {
  const outboundOptions = outboundTags(config, ref.kind === "outbound" ? ref.tag : undefined);
  const httpClientOptions = (config.http_clients ?? [])
    .map((client) => client.tag)
    .filter((tag): tag is string => Boolean(tag));

  if (group === "listen") {
    const inboundOptions = (config.inbounds ?? [])
      .map((inbound) => inbound.tag)
      .filter((tag): tag is string => Boolean(tag && (ref.kind !== "inbound" || tag !== ref.tag)));
    return [
      { label: "Listen", path: ["listen"], kind: "text" },
      { label: "Listen Port", path: ["listen_port"], kind: "number" },
      { label: "Bind Interface (1.12+)", path: ["bind_interface"], kind: "text" },
      { label: "Routing Mark (Linux)", path: ["routing_mark"], kind: "text" },
      { label: "Reuse Address (1.12+)", path: ["reuse_addr"], kind: "boolean" },
      { label: "Network Namespace (Linux, 1.12+)", path: ["netns"], kind: "text" },
      { label: "TCP Fast Open", path: ["tcp_fast_open"], kind: "boolean" },
      { label: "TCP Multi Path", path: ["tcp_multi_path"], kind: "boolean" },
      { label: "Disable TCP Keep Alive (1.13+)", path: ["disable_tcp_keep_alive"], kind: "boolean" },
      { label: "TCP Keep Alive (1.13+)", path: ["tcp_keep_alive"], kind: "text" },
      { label: "TCP Keep Alive Interval", path: ["tcp_keep_alive_interval"], kind: "text" },
      { label: "UDP Fragment", path: ["udp_fragment"], kind: "boolean" },
      { label: "UDP Timeout", path: ["udp_timeout"], kind: "text" },
      { label: "Inbound Detour", path: ["detour"], kind: "select", options: inboundOptions },
    ];
  }

  if (group === "dial" && ref.kind === "route") {
    return [
      { label: "Default Domain Resolver", path: ["default_domain_resolver"], kind: "text" },
      { label: "Default Network Strategy", path: ["default_network_strategy"], kind: "select", options: networkStrategyOptions },
      { label: "Default Network Type", path: ["default_network_type"], kind: "list" },
      { label: "Default Fallback Network", path: ["default_fallback_network_type"], kind: "list" },
      { label: "Default Fallback Delay", path: ["default_fallback_delay"], kind: "text" },
    ];
  }

  if (group === "dial" && ref.kind === "inbound" && type === "shadowtls") {
    return [
      { label: "Handshake Server", path: ["handshake", "server"], kind: "text" },
      { label: "Handshake Port", path: ["handshake", "server_port"], kind: "number" },
      { label: "Handshake Detour", path: ["handshake", "detour"], kind: "select", options: outboundOptions },
      { label: "Connect Timeout", path: ["handshake", "connect_timeout"], kind: "text" },
    ];
  }

  if (group === "dial") {
    return [
      { label: "Detour", path: ["detour"], kind: "select", options: outboundOptions },
      { label: "Bind Interface", path: ["bind_interface"], kind: "text" },
      { label: "IPv4 Bind Address", path: ["inet4_bind_address"], kind: "text" },
      { label: "IPv6 Bind Address", path: ["inet6_bind_address"], kind: "text" },
      { label: "Bind Address No Port (Linux, 1.13+)", path: ["bind_address_no_port"], kind: "boolean" },
      { label: "Routing Mark (Linux)", path: ["routing_mark"], kind: "text" },
      { label: "Reuse Address", path: ["reuse_addr"], kind: "boolean" },
      { label: "Network Namespace (Linux, 1.12+)", path: ["netns"], kind: "text" },
      { label: "Connect Timeout", path: ["connect_timeout"], kind: "text" },
      { label: "TCP Fast Open", path: ["tcp_fast_open"], kind: "boolean" },
      { label: "TCP Multi Path", path: ["tcp_multi_path"], kind: "boolean" },
      { label: "Disable TCP Keep Alive (1.13+)", path: ["disable_tcp_keep_alive"], kind: "boolean" },
      { label: "TCP Keep Alive (1.13+)", path: ["tcp_keep_alive"], kind: "text" },
      { label: "TCP Keep Alive Interval (1.13+)", path: ["tcp_keep_alive_interval"], kind: "text" },
      { label: "UDP Fragment", path: ["udp_fragment"], kind: "boolean" },
      { label: "Domain Resolver", path: ["domain_resolver"], kind: "text" },
      { label: "Network Strategy", path: ["network_strategy"], kind: "select", options: networkStrategyOptions },
      { label: "Network Type", path: ["network_type"], kind: "list" },
      { label: "Fallback Network", path: ["fallback_network_type"], kind: "list" },
      { label: "Fallback Delay", path: ["fallback_delay"], kind: "text" },
      { label: "Domain Strategy (deprecated 1.12+)", path: ["domain_strategy"], kind: "text" },
    ];
  }

  if (group === "tls") {
    return [
      { label: "Enabled", path: ["tls", "enabled"], kind: "boolean" },
      { label: "Server Name", path: ["tls", "server_name"], kind: "text" },
      { label: "Disable SNI (client only)", path: ["tls", "disable_sni"], kind: "boolean" },
      { label: "Insecure (client only)", path: ["tls", "insecure"], kind: "boolean" },
      { label: "ALPN", path: ["tls", "alpn"], kind: "list" },
      { label: "Min Version", path: ["tls", "min_version"], kind: "select", options: tlsVersionOptions },
      { label: "Max Version", path: ["tls", "max_version"], kind: "select", options: tlsVersionOptions },
      { label: "Cipher Suites", path: ["tls", "cipher_suites"], kind: "list" },
      { label: "Curve Preferences (1.13+)", path: ["tls", "curve_preferences"], kind: "list" },
      { label: "Certificate (PEM lines or list)", path: ["tls", "certificate"], kind: "list" },
      { label: "Certificate Path", path: ["tls", "certificate_path"], kind: "text" },
      { label: "Key (PEM lines or list, server)", path: ["tls", "key"], kind: "list" },
      { label: "Key Path (server)", path: ["tls", "key_path"], kind: "text" },
      { label: "Certificate Public Key SHA256 (client only)", path: ["tls", "certificate_public_key_sha256"], kind: "list" },
      { label: "Client Authentication (server)", path: ["tls", "client_authentication"], kind: "select", options: ["", "request", "require", "verify-if-given", "require-and-verify"] },
      { label: "Certificate Provider", path: ["tls", "certificate_provider"], kind: "text" },
      { label: "Fragment (client, 1.12+)", path: ["tls", "fragment"], kind: "boolean" },
      { label: "Fragment Fallback Delay (1.12+)", path: ["tls", "fragment_fallback_delay"], kind: "text" },
      { label: "Record Fragment (client, 1.12+)", path: ["tls", "record_fragment"], kind: "boolean" },
      { label: "uTLS Enabled (client, 1.10+)", path: ["tls", "utls", "enabled"], kind: "boolean" },
      { label: "uTLS Fingerprint", path: ["tls", "utls", "fingerprint"], kind: "select", options: ["", "chrome", "firefox", "edge", "safari", "360", "qq", "ios", "android", "random", "randomized"] },
      { label: "Reality Enabled", path: ["tls", "reality", "enabled"], kind: "boolean" },
      { label: "Reality Public Key (client)", path: ["tls", "reality", "public_key"], kind: "text" },
      { label: "Reality Short ID (client)", path: ["tls", "reality", "short_id"], kind: "text" },
      { label: "ECH Enabled", path: ["tls", "ech", "enabled"], kind: "boolean" },
    ];
  }

  if (group === "quic") {
    return [
      { label: "Initial Packet Size", path: ["initial_packet_size"], kind: "number" },
      { label: "Disable Path MTU Discovery", path: ["disable_path_mtu_discovery"], kind: "boolean" },
      { label: "Idle Timeout", path: ["idle_timeout"], kind: "text" },
      { label: "Keep Alive Period", path: ["keep_alive_period"], kind: "text" },
    ];
  }

  if (group === "multiplex") {
    return [
      { label: "Enabled", path: ["multiplex", "enabled"], kind: "boolean" },
      { label: "Protocol", path: ["multiplex", "protocol"], kind: "select", options: ["smux", "yamux", "h2mux"] },
      { label: "Max Connections", path: ["multiplex", "max_connections"], kind: "number" },
      { label: "Min Streams", path: ["multiplex", "min_streams"], kind: "number" },
      { label: "Max Streams", path: ["multiplex", "max_streams"], kind: "number" },
      { label: "Padding", path: ["multiplex", "padding"], kind: "boolean" },
    ];
  }

  if (group === "tcp-brutal") {
    return [
      { label: "Enabled", path: ["multiplex", "brutal", "enabled"], kind: "boolean" },
      { label: "Upload Mbps", path: ["multiplex", "brutal", "up_mbps"], kind: "number" },
      { label: "Download Mbps", path: ["multiplex", "brutal", "down_mbps"], kind: "number" },
    ];
  }

  if (group === "v2ray-transport") {
    return [
      { label: "Type", path: ["transport", "type"], kind: "select", options: transportTypeOptions },
      { label: "Host", path: ["transport", "host"], kind: "list" },
      { label: "Path", path: ["transport", "path"], kind: "text" },
      { label: "Service Name", path: ["transport", "service_name"], kind: "text" },
      { label: "Idle Timeout", path: ["transport", "idle_timeout"], kind: "text" },
      { label: "Ping Timeout", path: ["transport", "ping_timeout"], kind: "text" },
    ];
  }

  if (group === "udp-over-tcp") {
    return [
      { label: "Enabled", path: ["udp_over_tcp", "enabled"], kind: "boolean" },
      { label: "Version", path: ["udp_over_tcp", "version"], kind: "select", options: ["1", "2"] },
    ];
  }

  if (group === "http-client") {
    return ref.kind === "rule-set"
      ? [{ label: "HTTP Client", path: ["http_client"], kind: "select", options: httpClientOptions }]
      : [{ label: "Default HTTP Client", path: ["default_http_client"], kind: "select", options: httpClientOptions }];
  }

  if (group === "http2") {
    return [
      { label: "Idle Timeout", path: ["idle_timeout"], kind: "text" },
      { label: "Keep Alive Period", path: ["keep_alive_period"], kind: "text" },
      { label: "Stream Receive Window", path: ["stream_receive_window"], kind: "text" },
      { label: "Connection Receive Window", path: ["connection_receive_window"], kind: "text" },
      { label: "Max Concurrent Streams", path: ["max_concurrent_streams"], kind: "number" },
    ];
  }

  if (group === "neighbor") {
    if (ref.kind === "route") {
      return [
        { label: "Find Neighbor", path: ["find_neighbor"], kind: "boolean" },
        { label: "DHCP Lease Files", path: ["dhcp_lease_files"], kind: "list" },
      ];
    }
    if (ref.kind === "dns-server") {
      return [{ label: "Neighbor Domain", path: ["neighbor_domain"], kind: "list" }];
    }
  }

  return [];
}

function coerceSharedFieldValue(kind: SharedFieldKind, rawValue: string | boolean) {
  if (kind === "boolean") return Boolean(rawValue);
  if (kind === "number") return rawValue === "" ? undefined : Number(rawValue);
  if (kind === "list") return fromList(String(rawValue));
  return rawValue === "" ? undefined : rawValue;
}

function SharedFieldControl({
  definition,
  entity,
  entityRef,
  updateField,
}: {
  definition: SharedFieldDefinition;
  entity: InspectorEntity;
  entityRef: EntityRef;
  updateField: UpdateField;
}) {
  const value = sharedValueAt(entity, definition.path);
  const applyValue = (nextValue: unknown) => {
    const patch = nestedPatch(entity, definition.path, nextValue);
    if (patch) updateField(entityRef, patch.field, patch.value);
  };

  if (definition.kind === "boolean") {
    return (
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => applyValue(event.target.checked)}
        />
        <span>{definition.label}</span>
      </label>
    );
  }

  if (definition.kind === "select") {
    return (
      <label className="field">
        <span>{definition.label}</span>
        <select
          value={String(value ?? "")}
          onChange={(event) => applyValue(coerceSharedFieldValue(definition.kind, event.target.value))}
        >
          <option value="">None</option>
          {(definition.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="field">
      <span>{definition.label}</span>
      <input
        type={definition.kind === "number" ? "number" : "text"}
        value={definition.kind === "list" ? toList(value) : String(value ?? "")}
        onChange={(event) => applyValue(coerceSharedFieldValue(definition.kind, event.target.value))}
      />
    </label>
  );
}

function SharedFieldCards({
  groups,
  entity,
  entityRef,
  entityType,
  config,
  updateField,
}: {
  groups: SharedFieldGroupId[];
  entity: InspectorEntity;
  entityRef: EntityRef;
  entityType: string | null;
  config: SingBoxConfig;
  updateField: UpdateField;
}) {
  const cards = groups
    .map((group) => ({
      group,
      definitions: sharedFieldDefinitions(group, entityRef, entityType, config),
    }))
    .filter((card) => card.definitions.length > 0);

  if (!cards.length) return null;

  return (
    <div className="settings-module-list" aria-label="Shared field sections">
      <div className="inspector-section-title">Shared Configuration</div>
      {cards.map((card) => {
        const active = card.definitions.some((definition) => isSharedValueActive(sharedValueAt(entity, definition.path)));
        return (
          <ModuleCard key={card.group} title={sharedGroupTitles[card.group]} active={active}>
            {card.definitions.map((definition) => (
              <SharedFieldControl
                key={definition.path.join(".")}
                definition={definition}
                entity={entity}
                entityRef={entityRef}
                updateField={updateField}
              />
            ))}
          </ModuleCard>
        );
      })}
    </div>
  );
}

export function Inspector() {
  const selectedId = useProjectStore((state) => state.selectedId);
  const config = useProjectStore((state) => state.config);
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

  useEffect(() => {
    if (entity && "tag" in entity && typeof entity.tag === "string") setTagDraft(entity.tag);
    else setTagDraft("");
  }, [entity]);

  if (!ref || !entity) return null;

  const tagValue = typeof entity.tag === "string" ? entity.tag : null;
  const entityType = typeof entity.type === "string" ? entity.type : null;
  const InspectorIcon = inspectorIcons[ref.kind];
  const selectedEndpointReferences =
    ref.kind === "endpoint" && tagValue ? endpointReferences(config, tagValue) : null;
  const sharedGroups = sharedGroupsForEntity(ref, entityType);

  return (
    <aside className="inspector" aria-label="Node inspector" data-testid="node-inspector">
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
          <DnsRulesTable />
        </>
      ) : null}
      {ref.kind === "route-rule" ? (
        <RouteRuleInspector index={ref.index} rule={entity} config={config} updateRouteRule={updateRouteRule} />
      ) : null}
      {ref.kind === "dns-rule" ? (
        <DnsRuleInspector index={ref.index} rule={entity} config={config} updateDnsRule={updateDnsRule} />
      ) : null}

      {tagValue ? (
        <label className="field">
          <span>Tag</span>
          <input
            value={tagDraft}
            onChange={(event) => setTagDraft(event.target.value)}
            onBlur={() => renameTag(tagValue, tagDraft)}
          />
        </label>
      ) : null}

      {entityType ? (
        <label className="field">
          <span>Type</span>
          {ref.kind === "inbound" ? (
            <select value={entityType} onChange={(event) => changeEntityType(ref, event.target.value)}>
              {CREATABLE_INBOUND_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          ) : ref.kind === "outbound" ? (
            <select value={entityType} onChange={(event) => changeEntityType(ref, event.target.value)}>
              {CREATABLE_OUTBOUND_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          ) : ref.kind === "dns-server" ? (
            <select value={entityType} onChange={(event) => changeEntityType(ref, event.target.value)}>
              {CREATABLE_DNS_SERVER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          ) : ref.kind === "endpoint" ? (
            <select value={entityType} onChange={(event) => changeEntityType(ref, event.target.value)}>
              {CREATABLE_ENDPOINT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          ) : ref.kind === "service" ? (
            <select value={entityType} onChange={(event) => changeEntityType(ref, event.target.value)}>
              {CREATABLE_SERVICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          ) : ref.kind === "rule-set" ? (
            <select value={entityType} onChange={(event) => changeEntityType(ref, event.target.value)}>
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
              value={toList(entity.certificate)}
              onChange={(event) => updateField(ref, "certificate", fromList(event.target.value))}
              placeholder="PEM entries, comma separated"
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
              </ModuleCard>

              <ModuleCard title="Clash API" active={clashEnabled}>
                <label className="field">
                  <span>Controller</span>
                  <input
                    value={String(clashApi.external_controller ?? "")}
                    onChange={(event) =>
                      updateField(ref, "clash_api", { ...clashApi, external_controller: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Secret</span>
                  <input
                    value={String(clashApi.secret ?? "")}
                    onChange={(event) => updateField(ref, "clash_api", { ...clashApi, secret: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Default Mode</span>
                  <input
                    value={String(clashApi.default_mode ?? "")}
                    onChange={(event) => updateField(ref, "clash_api", { ...clashApi, default_mode: event.target.value })}
                  />
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
              </ModuleCard>
            </div>
          );
        })()
      ) : null}

      {ref.kind === "inbound" ? (
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
          <AdvancedScalarFields entity={entity} handledFields={inboundHandledFields} entityRef={ref} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={inboundHandledFields} entityRef={ref} updateField={updateField} />
        </>
      ) : null}

      {ref.kind === "outbound" ? (
        <>
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
            <label className="field">
              <span>Port</span>
              <input
                type="number"
                value={Number(entity.server_port ?? 0)}
                onChange={(event) => updateField(ref, "server_port", Number(event.target.value))}
              />
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
          <AdvancedScalarFields entity={entity} handledFields={outboundHandledFields} entityRef={ref} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={outboundHandledFields} entityRef={ref} updateField={updateField} />
        </>
      ) : null}

      {ref.kind === "dns-server" ? (
        <>
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
            <label className="field">
              <span>Port</span>
              <input
                type="number"
                value={Number(entity.server_port ?? 0)}
                onChange={(event) => updateField(ref, "server_port", Number(event.target.value))}
              />
            </label>
          ) : null}
          {"path" in entity ? (
            <label className="field">
              <span>Path</span>
              <input
                value={String(entity.path ?? "")}
                onChange={(event) => updateField(ref, "path", event.target.value)}
              />
            </label>
          ) : null}
          {entityType === "tailscale" ? (
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
          ) : null}
          <AdvancedScalarFields entity={entity} handledFields={dnsServerHandledFields} entityRef={ref} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={dnsServerHandledFields} entityRef={ref} updateField={updateField} />
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
                />
              </label>
              <label className="field">
                <span>Private Key</span>
                <input
                  value={String(entity.private_key ?? "")}
                  onChange={(event) => updateField(ref, "private_key", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Peers JSON</span>
                <textarea
                  value={JSON.stringify(entity.peers ?? [], null, 2)}
                  onChange={(event) => {
                    try {
                      updateField(ref, "peers", JSON.parse(event.target.value));
                    } catch {
                      updateField(ref, "peers", event.target.value);
                    }
                  }}
                />
              </label>
            </>
          ) : null}
          {entityType === "tailscale" ? (
            <>
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
                <span>Advertise Tags</span>
                <input
                  value={toList(entity.advertise_tags)}
                  onChange={(event) => updateField(ref, "advertise_tags", fromList(event.target.value))}
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
          {entityType === "ssm-api" ? (
            <>
              <label className="field">
                <span>Managed Shadowsocks Inbound</span>
                <select
                  value={String(Object.values(objectField(entity.servers))[0] ?? "")}
                  onChange={(event) => updateField(ref, "servers", event.target.value ? { "/": event.target.value } : {})}
                >
                  <option value="">None</option>
                  {inboundTags(config, "shadowsocks").map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Cache Path</span>
                <input
                  value={String(entity.cache_path ?? "")}
                  onChange={(event) => updateField(ref, "cache_path", event.target.value || undefined)}
                />
              </label>
              <JsonField label="Endpoint Mapping JSON" value={entity.servers ?? {}} onChange={(value) => updateField(ref, "servers", value)} />
            </>
          ) : null}

          {entityType === "derp" ? (
            <>
              <label className="field">
                <span>Config Path</span>
                <input
                  value={String(entity.config_path ?? "")}
                  onChange={(event) => updateField(ref, "config_path", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Verify Tailscale Endpoints</span>
                <input
                  value={listishToText(entity.verify_client_endpoint)}
                  onChange={(event) =>
                    updateField(ref, "verify_client_endpoint", textToRuleList(event.target.value, entity.verify_client_endpoint))
                  }
                  placeholder={endpointTags(config, "tailscale").join(", ")}
                />
              </label>
              <label className="field">
                <span>Home</span>
                <input
                  value={String(entity.home ?? "")}
                  onChange={(event) => updateField(ref, "home", event.target.value)}
                  placeholder="blank or redirect URL"
                />
              </label>
              <JsonField
                label="Verify Client URL JSON"
                value={entity.verify_client_url ?? []}
                onChange={(value) => updateField(ref, "verify_client_url", value)}
              />
              <JsonField label="Mesh With JSON" value={entity.mesh_with ?? []} onChange={(value) => updateField(ref, "mesh_with", value)} />
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
              <JsonField label="STUN JSON" value={entity.stun ?? { enabled: false }} onChange={(value) => updateField(ref, "stun", value)} />
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
              <JsonField label="Users JSON" value={entity.users ?? []} onChange={(value) => updateField(ref, "users", value)} />
              <JsonField label="Headers JSON" value={entity.headers ?? {}} onChange={(value) => updateField(ref, "headers", value)} />
            </>
          ) : null}

          {entityType === "hysteria-realm" ? (
            <JsonField label="Users JSON" value={entity.users ?? []} onChange={(value) => updateField(ref, "users", value)} />
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
            <label className="field">
              <span>Rules JSON</span>
              <textarea
                value={JSON.stringify(entity.rules ?? [], null, 2)}
                onChange={(event) => {
                  try {
                    updateField(ref, "rules", JSON.parse(event.target.value));
                  } catch {
                    updateField(ref, "rules", event.target.value);
                  }
                }}
              />
            </label>
          ) : null}
          <AdvancedScalarFields entity={entity} handledFields={ruleSetHandledFields} entityRef={ref} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={ruleSetHandledFields} entityRef={ref} updateField={updateField} />
        </>
      ) : null}

      <SharedFieldCards
        groups={sharedGroups}
        entity={entity}
        entityRef={ref}
        entityType={entityType}
        config={config}
        updateField={updateField}
      />
    </aside>
  );
}
