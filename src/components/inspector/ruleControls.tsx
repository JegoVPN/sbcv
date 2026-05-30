import { useEffect, useRef, useState } from "react";

import { JsonField } from "./controls";
import { fromList, type InspectorEntity, labelForField } from "./helpers";

// C14 — the rule editing controls extracted from the Inspector monolith and shared by both rule
// inspectors: the recursive inline rule-set editor + its JSON escape hatch, the list/advanced/shared
// rule field controls, and the rule field-name tables. Behaviour-frozen; the green suite is the
// preservation gate. The symbols the inspectors (and the Inspector shell, for InlineRuleSetEditor)
// render are exported; the rest stay private.

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

export const routeRulePrimaryFields = new Set([
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

export const dnsRulePrimaryFields = new Set([
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

export const routeRuleAdvancedFields = [
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

export const dnsRuleAdvancedFields = [
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

// A nested logical sub-rule recurses with the same structured editor; beyond this depth it falls back
// to the JSON escape hatch (the grammar allows unbounded nesting, but the UI caps disclosure). (C12)
const MAX_INLINE_RULE_DEPTH = 3;

export function InlineRuleSetEditor({
  value,
  onChange,
  depth = 0,
  idPrefix = "inline-rule",
}: {
  value: unknown;
  onChange: (value: unknown) => void;
  depth?: number;
  idPrefix?: string;
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
          <div className="inline-rule" data-testid={`${idPrefix}-${index}`} key={index}>
            <div className="inline-rule__head">
              <span>Rule {index + 1}{logical ? " · logical" : ""}</span>
              <span className="inline-rule__actions">
                <button type="button" className="node-icon-button" aria-label={`Move inline rule ${index + 1} up`} disabled={index === 0} onClick={() => moveRule(index, -1)}>↑</button>
                <button type="button" className="node-icon-button" aria-label={`Move inline rule ${index + 1} down`} disabled={index === rules.length - 1} onClick={() => moveRule(index, 1)}>↓</button>
                <button type="button" className="node-icon-button" aria-label={`Remove inline rule ${index + 1}`} onClick={() => removeRule(index)}>✕</button>
              </span>
            </div>
            {logical ? (
              depth < MAX_INLINE_RULE_DEPTH ? (
                <>
                  <label className="field">
                    <span>Mode</span>
                    <select
                      value={typeof ruleObj.mode === "string" ? ruleObj.mode : "and"}
                      onChange={(event) => patchRule(index, { mode: event.target.value })}
                    >
                      <option value="and">and</option>
                      <option value="or">or</option>
                    </select>
                  </label>
                  <InlineRuleSetEditor
                    depth={depth + 1}
                    idPrefix={`${idPrefix}-${index}-sub`}
                    value={ruleObj.rules}
                    onChange={(next) => patchRule(index, { rules: next })}
                  />
                </>
              ) : (
                <span className="field__hint">Logical (and/or) rule nested too deep — edit its nested rules in JSON mode.</span>
              )
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

export function RuleListField({
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

export function RuleAdvancedFields({
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

export function SharedRuleFields({
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
