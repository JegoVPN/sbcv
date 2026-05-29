import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Braces, Network, Route, Server, Trash2, X } from "lucide-react";
import { getNodeIcon } from "../canvas/iconRegistry";
import { dnsRuleAllowsServer, routeRuleAllowsOutbound } from "../domain/commands";
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
type UpdateField = (ref: EntityRef, field: string, value: unknown) => void;

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
  "users",
  "method",
  "version",
  "padding_scheme",
  "tls",
  "multiplex",
  "transport",
  "handshake",
  "stack",
  "route_address",
  "route_exclude_address",
  "route_address_set",
  "route_exclude_address_set",
  "loopback_address",
  "endpoint_independent_nat",
  "platform",
  "quic_congestion_control",
  "masquerade",
  "brutal_debug",
  "fallback",
  "override_address",
  "override_port",
  "network",
  "token",
  "ha_connections",
  "protocol",
  "post_quantum",
  "region",
  "grace_period",
  "set_system_proxy",
  "include_uid_range",
  "exclude_uid_range",
  "include_interface",
  "exclude_interface",
  "include_package",
  "exclude_package",
  "auto_redirect",
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
  "interrupt_exist_connections",
  "tls",
  "multiplex",
  "transport",
  "udp_over_tcp",
  "network",
  "method",
  "version",
  "security",
  "flow",
  "congestion_control",
  "version",
  "uuid",
  "username",
  "password",
  "auth_str",
  "user",
  "private_key",
  "private_key_path",
  "private_key_passphrase",
  "host_key",
  "host_key_algorithms",
  "client_version",
  "cipher",
  "mac",
  "kex_algorithm",
  "url",
  "interval",
  "tolerance",
  "idle_timeout",
  "packet_encoding",
  "plugin",
  "plugin_opts",
  "udp_relay_mode",
  "udp_over_stream",
  "obfs",
  "executable_path",
  "data_directory",
  "extra_args",
  "torrc",
  "extra_headers",
  "path",
  "headers",
  "quic_congestion_control",
  "heartbeat",
  "zero_rtt_handshake",
  "server_ports",
  "hop_interval",
  "up_mbps",
  "down_mbps",
  "idle_session_check_interval",
  "idle_session_timeout",
  "min_idle_session",
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
  "service",
  "accept_default_resolvers",
  "accept_search_domain",
  "tls",
  "neighbor_domain",
  "prefer_go",
  "predefined",
  "inet4_range",
  "inet6_range",
  "headers",
  "interface",
  ...dialSharedFields,
]);
// On stable the `accept_search_domain` first-class toggle is hidden (it is 1.14+). Drop it from the
// handled set there so an imported stable value still falls through to the Advanced fallback and can be
// inspected/removed, rather than being invisible AND stuck.
const dnsServerHandledFieldsStable = new Set([...dnsServerHandledFields].filter((f) => f !== "accept_search_domain"));
function dnsServerHandledFieldsForChannel(channel: string): Set<string> {
  return channel === "testing" ? dnsServerHandledFields : dnsServerHandledFieldsStable;
}
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
  "auth_key",
  "system_interface",
  "system_interface_name",
  "system_interface_mtu",
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
const ruleSetHandledFields = new Set(["tag", "type", "format", "url", "path", "update_interval", "download_detour", "http_client", "rules"]);

// Seeds a new kv-repeater row with a unique, non-empty key so a blank {"":""} entry can never be
// committed to (and exported from) canonical config (W13 / C0-6). Mirrors the ccm/ocm addHeader pattern.
export function withUniqueBlankKey<T extends Record<string, unknown>>(map: T, base: string): T {
  let candidate = base;
  let suffix = 2;
  while (Object.prototype.hasOwnProperty.call(map, candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return { ...map, [candidate]: "" } as T;
}

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
  // Endpoints share the outbound tag namespace (A7a/A7b: a WireGuard/Tailscale endpoint is a valid
  // route/selector/detour target), so they belong in every outbound-target picker, including the
  // selector/urltest candidate checklist (otherwise endpoint members read as stale and cannot be removed).
  return [
    ...(config.outbounds ?? []).map((outbound) => outbound.tag),
    ...(config.endpoints ?? []).map((endpoint) => endpoint.tag),
  ].filter((tag): tag is string => Boolean(tag && tag !== excludeTag));
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
    const nums = items.map((item) => Number(item)).filter((item) => Number.isFinite(item));
    // All-non-numeric input must clear the field, not store an empty no-op array.
    return nums.length ? nums : undefined;
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
  "override_address",
  "override_port",
  "network_strategy",
  "fallback_delay",
  "udp_disable_domain_unmapping",
  "tls_fragment",
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

const SENSITIVE_FIELD_PATTERNS = [
  "password",
  "passphrase",
  "private_key",
  "pre_shared_key",
  "preshared_key",
  "psk",
  "secret",
  "token",
  "auth_key",
  "authkey",
  "credential",
];

function isSensitiveFieldName(field: string) {
  const lower = field.toLowerCase();
  return SENSITIVE_FIELD_PATTERNS.some((pattern) => lower.includes(pattern));
}

function SensitiveTextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const [reveal, setReveal] = useState(false);
  return (
    <label className="field field--sensitive">
      <span>{label}</span>
      <span className="field__input-row">
        <input
          type={reveal ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
        <button
          type="button"
          className="field__reveal-button"
          aria-label={reveal ? `Hide ${label}` : `Show ${label}`}
          onClick={() => setReveal((current) => !current)}
        >
          {reveal ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}

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
        {fields.map(([field, value]) => {
          if (typeof value === "boolean") {
            return (
              <label className="toggle-row" key={field}>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(event) => updateField(entityRef, field, event.target.checked)}
                />
                <span>{labelForField(field)}</span>
              </label>
            );
          }
          if (typeof value === "string" && isSensitiveFieldName(field)) {
            return (
              <SensitiveTextField
                key={field}
                label={labelForField(field)}
                value={value}
                onChange={(next) => updateField(entityRef, field, next)}
              />
            );
          }
          return (
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
          );
        })}
      </div>
    </details>
  );
}

// Common headless-rule match fields surfaced as structured inputs (headless-rule.md). Anything outside
// this set (logical rules, exotic/version-gated fields) is preserved untouched and stays editable via
// the JSON escape hatch.
const INLINE_RULE_LIST_FIELDS: Array<{ key: string; label: string; numeric?: boolean }> = [
  { key: "domain", label: "Domain" },
  { key: "domain_suffix", label: "Domain suffix" },
  { key: "domain_keyword", label: "Domain keyword" },
  { key: "domain_regex", label: "Domain regex" },
  { key: "ip_cidr", label: "IP CIDR" },
  { key: "source_ip_cidr", label: "Source IP CIDR" },
  { key: "port", label: "Port", numeric: true },
  { key: "network", label: "Network (tcp/udp)" },
  { key: "process_name", label: "Process name" },
];

function isLogicalRule(rule: unknown): boolean {
  return Boolean(rule) && typeof rule === "object" && (rule as Record<string, unknown>).type === "logical";
}

function InlineRuleSetEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const rules = Array.isArray(value) ? value : [];
  const [mode, setMode] = useState<"structured" | "json">("structured");

  const replaceRule = (index: number, next: Record<string, unknown>) => {
    onChange(rules.map((rule, idx) => (idx === index ? next : rule)));
  };
  const patchRule = (index: number, patch: Record<string, unknown>) => {
    const current = (rules[index] ?? {}) as Record<string, unknown>;
    const next = { ...current, ...patch };
    for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
    replaceRule(index, next);
  };
  const addRule = () => onChange([...rules, {}]);
  const removeRule = (index: number) => onChange(rules.filter((_, idx) => idx !== index));
  const moveRule = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= rules.length) return;
    const next = [...rules];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  if (mode === "json") {
    return (
      <div className="inline-rules">
        <div className="inline-rules__toolbar">
          <span>Rules ({rules.length})</span>
          <button type="button" className="node-icon-button" onClick={() => setMode("structured")}>
            Structured editor
          </button>
        </div>
        <InlineRulesJsonField value={rules} onChange={onChange} />
      </div>
    );
  }

  return (
    <div className="inline-rules">
      <div className="inline-rules__toolbar">
        <span>Rules ({rules.length})</span>
        <button type="button" className="node-icon-button" onClick={() => setMode("json")} aria-label="Edit rules as JSON">
          Edit rules as JSON
        </button>
      </div>
      {rules.map((rule, index) => {
        const ruleObj = (rule ?? {}) as Record<string, unknown>;
        const logical = isLogicalRule(rule);
        return (
          <div className="inline-rule" data-testid={`inline-rule-${index}`} key={index}>
            <div className="inline-rule__head">
              <span>Rule {index + 1}{logical ? " · logical" : ""}</span>
              <span className="inline-rule__actions">
                <button type="button" className="node-icon-button" aria-label={`Move inline rule ${index + 1} up`} disabled={index === 0} onClick={() => moveRule(index, -1)}>↑</button>
                <button type="button" className="node-icon-button" aria-label={`Move inline rule ${index + 1} down`} disabled={index === rules.length - 1} onClick={() => moveRule(index, 1)}>↓</button>
                <button type="button" className="node-icon-button" aria-label={`Remove inline rule ${index + 1}`} onClick={() => removeRule(index)}>✕</button>
              </span>
            </div>
            {logical ? (
              <span className="field__hint">Logical (and/or) rule — edit its nested rules in JSON mode.</span>
            ) : (
              INLINE_RULE_LIST_FIELDS.map((field) => (
                <label className="field" key={field.key}>
                  <span>{field.label}</span>
                  <input
                    value={listishToText(ruleObj[field.key])}
                    onChange={(event) => {
                      const list = textToRuleList(event.target.value, field.numeric ? [0] : ruleObj[field.key]);
                      patchRule(index, { [field.key]: list });
                    }}
                  />
                </label>
              ))
            )}
            {logical ? null : (
              <label className="field inline-rule__invert">
                <span>Invert</span>
                <input
                  type="checkbox"
                  checked={ruleObj.invert === true}
                  onChange={(event) => patchRule(index, { invert: event.target.checked || undefined })}
                />
              </label>
            )}
          </div>
        );
      })}
      <button type="button" className="palette-add palette-add--add" aria-label="Add inline rule" onClick={addRule}>
        + Add rule
      </button>
    </div>
  );
}

// The raw-JSON escape hatch for inline rules: parse-safe (keeps the last valid array on a parse error,
// never stores unparseable text), mirroring JsonField's contract.
function InlineRulesJsonField({ value, onChange }: { value: unknown[]; onChange: (value: unknown) => void }) {
  const serialized = JSON.stringify(value, null, 2);
  const [draft, setDraft] = useState(serialized);
  const [error, setError] = useState<string | null>(null);
  const lastEmittedRef = useRef(serialized);
  useEffect(() => {
    if (serialized !== lastEmittedRef.current) {
      lastEmittedRef.current = serialized;
      setDraft(serialized);
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);
  return (
    <label className="field">
      <span>Rules JSON</span>
      <textarea
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (!next.trim()) {
            setError(null);
            lastEmittedRef.current = "[]";
            onChange([]);
            return;
          }
          try {
            const parsed = JSON.parse(next);
            if (!Array.isArray(parsed)) {
              setError("Expected a JSON array of headless rule objects.");
              return;
            }
            setError(null);
            lastEmittedRef.current = JSON.stringify(parsed, null, 2);
            onChange(parsed);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Invalid JSON.");
          }
        }}
        data-testid="inline-rules-json"
      />
      {error ? (
        <span className="field__hint field__hint--error" role="alert">
          {error} The previous valid rules array is still stored — fix the JSON and the editor will sync back.
        </span>
      ) : null}
    </label>
  );
}

function PlatformBanner({ kind, text }: { kind: "platform" | "build-tag" | "deprecated" | "channel"; text: string }) {
  return (
    <div className={`inspector-banner inspector-banner--${kind}`} role="note" aria-label={text}>
      {text}
    </div>
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
  const serialized = JSON.stringify(value ?? null, null, 2);
  const [draft, setDraft] = useState(serialized);
  const [error, setError] = useState<string | null>(null);
  // Tracks the serialized form this editor last emitted, so an external value change (e.g. selecting a
  // different entity that reuses this component instance) can be told apart from our own valid edit.
  const lastEmittedRef = useRef(serialized);
  useEffect(() => {
    // External change: reset the draft and clear any stale parse error so the previous entity's bad
    // draft can never be written onto the newly selected one. Our own valid edits keep lastEmittedRef in
    // sync, so they don't trigger a reset (and the textarea isn't reformatted mid-edit).
    if (serialized !== lastEmittedRef.current) {
      lastEmittedRef.current = serialized;
      setDraft(serialized);
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);
  return (
    <label className="field inspector-json-field">
      <span>{label}</span>
      <textarea
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (!next.trim()) {
            // Empty input clears the field instead of erroring (mirrors InlineRuleSetEditor).
            setError(null);
            lastEmittedRef.current = JSON.stringify(null, null, 2);
            onChange(undefined);
            return;
          }
          try {
            const parsed = JSON.parse(next);
            setError(null);
            lastEmittedRef.current = JSON.stringify(parsed ?? null, null, 2);
            onChange(parsed);
          } catch (cause) {
            // Never write unparseable text into canonical config; keep the last valid value.
            setError(cause instanceof Error ? cause.message : "Invalid JSON.");
          }
        }}
      />
      {error ? (
        <span className="field__hint field__hint--error" role="alert">
          {error} The previous valid value is kept — fix the JSON to apply changes.
        </span>
      ) : null}
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
  const refKey = JSON.stringify(entityRef);
  return (
    <details className="advanced-fields advanced-fields--non-scalar">
      <summary>Advanced JSON fields <span>{fields.length}</span></summary>
      <div className="advanced-fields__body">
        {fields.map(([field, value]) => (
          <JsonField
            key={`${refKey}:${field}`}
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
          <InlineRuleSetEditor key={`logical-rules-${index}`} value={rule.rules} onChange={(value) => patch({ rules: value })} />
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
      {routeRuleAllowsOutbound(rule) ? (
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
      {["route", "route-options", "bypass"].includes(String(rule.action ?? "route")) ? (
        <fieldset className="field field--checklist" data-testid="route-rule-route-options">
          <legend>Route options</legend>
          <label className="field">
            <span>Override Address</span>
            <input
              value={typeof rule.override_address === "string" ? rule.override_address : ""}
              placeholder="e.g. 1.1.1.1 (replaces destination IP)"
              onChange={(event) => patch({ override_address: event.target.value || undefined })}
            />
          </label>
          <label className="field">
            <span>Override Port</span>
            <input
              type="number"
              value={typeof rule.override_port === "number" ? rule.override_port : ""}
              placeholder="e.g. 443"
              onChange={(event) => {
                const next = event.target.value;
                if (!next) return patch({ override_port: undefined });
                const parsed = Number(next);
                patch({ override_port: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined });
              }}
            />
          </label>
          <label className="field">
            <span>Network Strategy</span>
            <select
              value={typeof rule.network_strategy === "string" ? rule.network_strategy : ""}
              onChange={(event) => patch({ network_strategy: event.target.value || undefined })}
            >
              <option value="">(unset)</option>
              {/* network_strategy accepts only default/hybrid/fallback; wifi/cellular/ethernet are
                  network_type values (shared/dial.md). (L2-fix-route-strategy, audit H2) */}
              <option value="default">default</option>
              <option value="hybrid">hybrid</option>
              <option value="fallback">fallback</option>
            </select>
          </label>
          <label className="field">
            <span>Fallback Delay</span>
            <input
              value={typeof rule.fallback_delay === "string" ? rule.fallback_delay : ""}
              placeholder="e.g. 300ms"
              onChange={(event) => patch({ fallback_delay: event.target.value || undefined })}
            />
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(rule.udp_disable_domain_unmapping)}
              onChange={(event) =>
                patch({ udp_disable_domain_unmapping: event.target.checked || undefined })
              }
            />
            <span>UDP disable domain unmapping</span>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(rule.tls_fragment)}
              onChange={(event) => patch({ tls_fragment: event.target.checked || undefined })}
            />
            <span>TLS fragment</span>
          </label>
        </fieldset>
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
          <InlineRuleSetEditor key={`logical-rules-${index}`} value={rule.rules} onChange={(value) => patch({ rules: value })} />
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
            // route and evaluate both require `server` (dns/rule_action.md); only scrub it when the
            // next action bears no server. Single source of truth via the domain helper.
            if (!dnsRuleAllowsServer({ action: nextAction }) && rule.server !== undefined) {
              cleared.server = undefined;
            }
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
      {dnsRuleAllowsServer(rule) ? (
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
  /** Hide this field unless the boolean value at this path is true. */
  gatedBy?: string[];
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
    // ccm/ocm redefine `detour` as an OUTBOUND tag (the Claude/OpenAI API target), edited by the
    // dedicated "API Detour" control. The listen-group inbound `detour` writes the same key, so omit it
    // here to avoid silently stomping the outbound detour with an inbound tag (C1-21 / C2-1).
    const detourIsOutbound = ref.kind === "service" && (type === "ccm" || type === "ocm");
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
      ...(detourIsOutbound
        ? []
        : [{ label: "Inbound Detour", path: ["detour"], kind: "select" as const, options: inboundOptions }]),
    ];
  }

  const dnsServerOptions = (config.dns?.servers ?? [])
    .map((server) => server.tag)
    .filter((tag): tag is string => Boolean(tag));

  if (group === "dial" && ref.kind === "route") {
    return [
      { label: "Default Domain Resolver", path: ["default_domain_resolver"], kind: "select", options: ["", ...dnsServerOptions] },
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
      { label: "Domain Resolver", path: ["domain_resolver"], kind: "select", options: ["", ...dnsServerOptions] },
      { label: "Network Strategy", path: ["network_strategy"], kind: "select", options: networkStrategyOptions },
      { label: "Network Type", path: ["network_type"], kind: "list" },
      { label: "Fallback Network", path: ["fallback_network_type"], kind: "list" },
      { label: "Fallback Delay", path: ["fallback_delay"], kind: "text" },
      { label: "Domain Strategy (deprecated 1.12+)", path: ["domain_strategy"], kind: "text" },
    ];
  }

  if (group === "tls") {
    const certificateProviderOptions = [
      "",
      ...((config.certificate_providers ?? [])
        .map((provider) => provider.tag)
        .filter((tag): tag is string => Boolean(tag))),
    ];
    // TLS role split: inbound/service present a server certificate (server role); outbound/dns-server
    // dial out and verify an upstream certificate (client role). Fields are partitioned so a server card
    // never shows client-only options and vice versa (C0-6 / W6).
    const isServerRole = ref.kind === "inbound" || ref.kind === "service";
    // naive (outbound) supports only a narrow client TLS surface.
    if (ref.kind === "outbound" && type === "naive") {
      // naive is TLS-only (scaffold seeds tls.enabled=true), so no enable toggle; upstream supports only
      // server_name/certificate/certificate_path/ech here (outbound/naive.md).
      return [
        { label: "Server Name", path: ["tls", "server_name"], kind: "text" },
        { label: "Certificate (PEM lines or list)", path: ["tls", "certificate"], kind: "list" },
        { label: "Certificate Path", path: ["tls", "certificate_path"], kind: "text" },
        { label: "ECH Enabled", path: ["tls", "ech", "enabled"], kind: "boolean" },
        { label: "ECH Config (PEM/lines)", path: ["tls", "ech", "config"], kind: "list", gatedBy: ["tls", "ech", "enabled"] },
        { label: "ECH Config Path", path: ["tls", "ech", "config_path"], kind: "text", gatedBy: ["tls", "ech", "enabled"] },
        { label: "ECH Query Server Name", path: ["tls", "ech", "query_server_name"], kind: "text", gatedBy: ["tls", "ech", "enabled"] },
      ];
    }
    const shared: SharedFieldDefinition[] = [
      { label: "Enabled", path: ["tls", "enabled"], kind: "boolean" },
      { label: "Server Name", path: ["tls", "server_name"], kind: "text" },
      { label: "ALPN", path: ["tls", "alpn"], kind: "list" },
      { label: "Min Version", path: ["tls", "min_version"], kind: "select", options: tlsVersionOptions },
      { label: "Max Version", path: ["tls", "max_version"], kind: "select", options: tlsVersionOptions },
      { label: "Cipher Suites", path: ["tls", "cipher_suites"], kind: "list" },
      { label: "Curve Preferences (1.13+)", path: ["tls", "curve_preferences"], kind: "list" },
      { label: "Certificate (PEM lines or list)", path: ["tls", "certificate"], kind: "list" },
      { label: "Certificate Path", path: ["tls", "certificate_path"], kind: "text" },
      { label: "ECH Enabled", path: ["tls", "ech", "enabled"], kind: "boolean" },
    ];
    const serverOnly: SharedFieldDefinition[] = [
      { label: "Key (PEM lines or list)", path: ["tls", "key"], kind: "list" },
      { label: "Key Path", path: ["tls", "key_path"], kind: "text" },
      { label: "Client Authentication", path: ["tls", "client_authentication"], kind: "select", options: ["no", "request", "require-any", "verify-if-given", "require-and-verify"] },
      { label: "Certificate Provider", path: ["tls", "certificate_provider"], kind: "select", options: certificateProviderOptions },
      { label: "Reality Enabled", path: ["tls", "reality", "enabled"], kind: "boolean" },
      { label: "Reality Handshake Server", path: ["tls", "reality", "handshake", "server"], kind: "text", gatedBy: ["tls", "reality", "enabled"] },
      { label: "Reality Handshake Server Port", path: ["tls", "reality", "handshake", "server_port"], kind: "number", gatedBy: ["tls", "reality", "enabled"] },
      { label: "Reality Private Key", path: ["tls", "reality", "private_key"], kind: "text", gatedBy: ["tls", "reality", "enabled"] },
      { label: "Reality Short ID", path: ["tls", "reality", "short_id"], kind: "list", gatedBy: ["tls", "reality", "enabled"] },
      { label: "Reality Max Time Difference", path: ["tls", "reality", "max_time_difference"], kind: "text", gatedBy: ["tls", "reality", "enabled"] },
      { label: "ECH Key (PEM/lines)", path: ["tls", "ech", "key"], kind: "list", gatedBy: ["tls", "ech", "enabled"] },
      { label: "ECH Key Path", path: ["tls", "ech", "key_path"], kind: "text", gatedBy: ["tls", "ech", "enabled"] },
    ];
    const clientOnly: SharedFieldDefinition[] = [
      { label: "Disable SNI", path: ["tls", "disable_sni"], kind: "boolean" },
      { label: "Insecure", path: ["tls", "insecure"], kind: "boolean" },
      { label: "Certificate Public Key SHA256 (1.13+)", path: ["tls", "certificate_public_key_sha256"], kind: "list" },
      { label: "Fragment (1.12+)", path: ["tls", "fragment"], kind: "boolean" },
      { label: "Fragment Fallback Delay (1.12+)", path: ["tls", "fragment_fallback_delay"], kind: "text" },
      { label: "Record Fragment (1.12+)", path: ["tls", "record_fragment"], kind: "boolean" },
      { label: "uTLS Enabled (1.10+)", path: ["tls", "utls", "enabled"], kind: "boolean" },
      { label: "uTLS Fingerprint", path: ["tls", "utls", "fingerprint"], kind: "select", options: ["", "chrome", "firefox", "edge", "safari", "360", "qq", "ios", "android", "random", "randomized"], gatedBy: ["tls", "utls", "enabled"] },
      { label: "Reality Enabled", path: ["tls", "reality", "enabled"], kind: "boolean" },
      { label: "Reality Public Key", path: ["tls", "reality", "public_key"], kind: "text", gatedBy: ["tls", "reality", "enabled"] },
      { label: "Reality Short ID", path: ["tls", "reality", "short_id"], kind: "text", gatedBy: ["tls", "reality", "enabled"] },
      { label: "ECH Config (PEM/lines)", path: ["tls", "ech", "config"], kind: "list", gatedBy: ["tls", "ech", "enabled"] },
      { label: "ECH Config Path", path: ["tls", "ech", "config_path"], kind: "text", gatedBy: ["tls", "ech", "enabled"] },
      { label: "ECH Query Server Name", path: ["tls", "ech", "query_server_name"], kind: "text", gatedBy: ["tls", "ech", "enabled"] },
    ];
    return isServerRole ? [...shared, ...serverOnly] : [...shared, ...clientOnly];
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
    // Inbound multiplex accepts only enabled/padding (+ brutal, its own group). protocol and the stream
    // limits are dialed by the client, so they are outbound-only (C0-7 / W6).
    const clientStreamFields: SharedFieldDefinition[] = ref.kind === "outbound"
      ? [
          { label: "Protocol", path: ["multiplex", "protocol"], kind: "select", options: ["smux", "yamux", "h2mux"] },
          { label: "Max Connections", path: ["multiplex", "max_connections"], kind: "number" },
          { label: "Min Streams", path: ["multiplex", "min_streams"], kind: "number" },
          { label: "Max Streams", path: ["multiplex", "max_streams"], kind: "number" },
        ]
      : [];
    return [
      { label: "Enabled", path: ["multiplex", "enabled"], kind: "boolean" },
      ...clientStreamFields,
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
    // Some shared fields (http_client / default_http_client / domain_resolver) may hold a tag string
    // OR an inline object. The tag <select> can't represent an object — rendering it as "None" and
    // writing a string would silently destroy the object. Fall back to the parse-safe JSON editor so
    // the object form is preserved and editable.
    if (value !== null && typeof value === "object") {
      return <JsonField label={definition.label} value={value} onChange={applyValue} />;
    }
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
            {card.definitions
              .filter((definition) => {
                if (!definition.gatedBy) return true;
                return Boolean(sharedValueAt(entity, definition.gatedBy));
              })
              .map((definition) => (
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
        <DnsRuleInspector index={ref.index} rule={entity} config={config} updateDnsRule={updateDnsRule} />
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
                    text="store_rdrc is deprecated in sing-box 1.14 testing. Migrate to store_dns; both fields round-trip but only store_dns is recommended."
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
                  <span>Store RDRC (DNS cache reasons)</span>
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
                  text="Build-tag gate: V2Ray API requires sing-box compiled with the with_v2ray_api tag. Standard releases do not include it; enabling listen+stats on a stock binary fails at runtime."
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
              text="Hysteria v1 is deprecated upstream. New deployments should use type=hysteria2; v1 is kept for import compatibility only."
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
              text="Deprecated: outbound type `block` is superseded by route action `reject` from sing-box 1.11+. Imports still round-trip; new configs should use route.rules[].action=reject."
            />
          ) : null}
          {entityType === "hysteria" ? (
            <PlatformBanner
              kind="deprecated"
              text="Hysteria v1 is deprecated. The official docs recommend migrating to Hysteria2; new deployments should choose `hysteria2`."
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
                <span>0-RTT Handshake (faster reconnects, weaker forward secrecy)</span>
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
              <span>Prefer Go resolver (since sing-box 1.13.0; bypasses platform-native DNS)</span>
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
              text="Build-tag gate: dns-server `tailscale` requires sing-box built with the `with_tailscale` tag. Stock release binaries omit Tailscale support."
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
                placeholder="auto (system default)"
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
                text="Build-tag gate: endpoint `tailscale` requires sing-box built with the `with_tailscale` tag. Stock release binaries omit Tailscale support."
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
                text="Build-tag gate: service `derp` requires sing-box built with the `with_tailscale` tag for verify_client_endpoint integration. Stock release binaries omit DERP support."
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
        updateField={updateField}
      />
    </aside>
  );
}
