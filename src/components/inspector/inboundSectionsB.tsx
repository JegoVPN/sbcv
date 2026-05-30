import { Trash2 } from "lucide-react";

import type { EntityRef } from "../../domain/types";
import { AdvancedNonScalarFields, AdvancedScalarFields } from "./advancedFields";
import { JsonField, SensitiveTextField } from "./controls";
import { inboundHandledFields } from "./handledFields";
import { type InspectorEntity, objectField, parseOptionalNumber, type UpdateField } from "./helpers";

// C14 — the second half of the inbound per-protocol inspector (shadowtls / anytls / shadowsocks / the
// per-type user-credential editor / tproxy / cloudflared / direct / trojan / hysteria2 / naive / ... +
// the Advanced fallback), plus the inbound user-credential schema table, split out of inboundInspector.tsx
// for the ~600-line bar. Behaviour-frozen; rendered by InboundInspector after its first-half sections.

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

export type InboundSectionProps = {
  entity: InspectorEntity;
  entityRef: EntityRef;
  entityType: string | null;
  updateField: UpdateField;
};

export function InboundSectionsB({
  entity,
  entityRef,
  entityType,
  updateField,
}: InboundSectionProps) {
  return (
    <>
          {entityType === "shadowtls" ? (
            <label className="field">
              <span>Version</span>
              <select
                value={typeof entity.version === "number" ? String(entity.version) : ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (!raw) {
                    updateField(entityRef, "version", undefined);
                    return;
                  }
                  const parsed = Number(raw);
                  updateField(entityRef, "version", Number.isFinite(parsed) ? parsed : undefined);
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
                    updateField(entityRef, "padding_scheme", undefined);
                    return;
                  }
                  const lines = raw
                    .split(/\n/)
                    .map((line) => line.trim())
                    .filter(Boolean);
                  updateField(entityRef, "padding_scheme", lines.length ? lines : undefined);
                }}
              />
            </label>
          ) : null}
          {entityType === "shadowsocks" ? (
            <label className="field">
              <span>Method</span>
              <select
                value={typeof entity.method === "string" ? entity.method : ""}
                onChange={(event) => updateField(entityRef, "method", event.target.value || undefined)}
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
                  updateField(entityRef, "set_system_proxy", event.target.checked || undefined)
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
                onChange={(event) => updateField(entityRef, "network", event.target.value || undefined)}
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
                onChange={(next) => updateField(entityRef, "token", next || undefined)}
                placeholder="base64 tunnel token"
              />
              <label className="field">
                <span>HA Connections</span>
                <input
                  type="number"
                  value={typeof entity.ha_connections === "number" ? entity.ha_connections : ""}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    updateField(entityRef, "ha_connections", event.target.value === "" || !Number.isFinite(parsed) ? undefined : parsed);
                  }}
                />
              </label>
              <label className="field">
                <span>Protocol</span>
                <select value={String(entity.protocol ?? "")} onChange={(event) => updateField(entityRef, "protocol", event.target.value || undefined)}>
                  <option value="">(auto)</option>
                  <option value="quic">quic</option>
                  <option value="http2">http2</option>
                </select>
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={entity.post_quantum === true} onChange={(event) => updateField(entityRef, "post_quantum", event.target.checked || undefined)} />
                <span>Post-quantum</span>
              </label>
              <label className="field">
                <span>Region</span>
                <input value={String(entity.region ?? "")} onChange={(event) => updateField(entityRef, "region", event.target.value || undefined)} />
              </label>
              <label className="field">
                <span>Grace Period</span>
                <input value={String(entity.grace_period ?? "")} onChange={(event) => updateField(entityRef, "grace_period", event.target.value || undefined)} placeholder="30s" />
              </label>
            </>
          ) : null}
          {entityType === "direct" ? (
            <>
              <label className="field" data-testid="inbound-direct-network">
                <span>Network</span>
                <select
                  value={typeof entity.network === "string" ? entity.network : ""}
                  onChange={(event) => updateField(entityRef, "network", event.target.value || undefined)}
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
                  onChange={(event) => updateField(entityRef, "override_address", event.target.value || undefined)}
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
                    if (!raw) return updateField(entityRef, "override_port", undefined);
                    const parsed = Number(raw);
                    updateField(entityRef, "override_port", Number.isFinite(parsed) ? parsed : undefined);
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
                updateField(entityRef, "fallback", Object.keys(next).length ? next : undefined);
              // fallback_for_alpn is a map { "<alpn>": { server, server_port } }. Rows are keyed by index
              // (stable across key edits); the ALPN key input is uncontrolled + committed on blur, so the
              // map isn't rebuilt mid-keystroke (no focus loss, no empty-key churn).
              const alpnMap = objectField(entity.fallback_for_alpn);
              const alpnEntries = Object.entries(alpnMap);
              const writeAlpn = (next: Array<[string, unknown]>) => {
                const obj: InspectorEntity = {};
                for (const [key, value] of next) if (key) obj[key] = value;
                updateField(entityRef, "fallback_for_alpn", Object.keys(obj).length ? obj : undefined);
              };
              const commitAlpnKey = (index: number, key: string) =>
                writeAlpn(alpnEntries.map((entry, i) => (i === index ? [key, entry[1]] : entry)));
              const patchAlpnTarget = (index: number, patch: InspectorEntity) =>
                writeAlpn(
                  alpnEntries.map((entry, i) =>
                    i === index ? [entry[0], { ...objectField(entry[1]), ...patch }] : entry,
                  ),
                );
              const removeAlpn = (index: number) => writeAlpn(alpnEntries.filter((_, i) => i !== index));
              const addAlpn = () => {
                const used = new Set(alpnEntries.map(([key]) => key));
                const preferred = ["h2", "http/1.1"].find((candidate) => !used.has(candidate));
                let key = preferred;
                if (!key) {
                  let n = 1;
                  while (used.has(`alpn-${n}`)) n += 1;
                  key = `alpn-${n}`;
                }
                writeAlpn([...alpnEntries, [key, { server: "", server_port: 443 }]]);
              };
              return (
                <>
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
                  <p className="field__hint">Disabled when both Server and Port are empty.</p>
                </fieldset>
                <fieldset className="field field--checklist" data-testid="inbound-trojan-fallback-for-alpn">
                  <legend>Fallback for ALPN (optional)</legend>
                  {alpnEntries.length === 0 ? (
                    <p className="field__hint">
                      Per-ALPN fallback servers. A TLS request whose ALPN is not listed here is rejected.
                    </p>
                  ) : null}
                  {alpnEntries.map(([alpn, rawTarget], index) => {
                    const target = objectField(rawTarget);
                    return (
                      <div key={index} className="rule-row">
                        <label className="field">
                          <span>ALPN</span>
                          <input
                            key={`alpn-key-${index}-${alpn}`}
                            defaultValue={alpn}
                            placeholder="h2"
                            onBlur={(event) => commitAlpnKey(index, event.target.value.trim())}
                          />
                        </label>
                        <label className="field">
                          <span>Server</span>
                          <input
                            value={typeof target.server === "string" ? target.server : ""}
                            placeholder="127.0.0.1"
                            onChange={(event) => patchAlpnTarget(index, { server: event.target.value || undefined })}
                          />
                        </label>
                        <label className="field">
                          <span>Server Port</span>
                          <input
                            type="number"
                            value={typeof target.server_port === "number" ? target.server_port : ""}
                            placeholder="8081"
                            onChange={(event) => {
                              const parsed = Number(event.target.value);
                              patchAlpnTarget(index, {
                                server_port:
                                  event.target.value === "" || !Number.isFinite(parsed) ? undefined : parsed,
                              });
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="icon-danger"
                          onClick={() => removeAlpn(index)}
                          aria-label={`Remove ALPN fallback ${index + 1}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                  <button type="button" className="palette-action" onClick={addAlpn}>
                    Add ALPN fallback
                  </button>
                </fieldset>
                </>
              );
            })()
          ) : null}
          {entityType === "hysteria2" ? (
            <>
              {/* masquerade is string | object ({type:file|proxy|string,…}) (hysteria2.md). The object form
                  was handled-but-unrendered → invisible AND destroyed on string-input edits (M1 data loss).
                  Render the URL input for string/unset, and a parse-safe JSON editor for the object form so
                  it round-trips and stays editable. */}
              {entity.masquerade !== null && typeof entity.masquerade === "object" ? (
                <div data-testid="inbound-hysteria2-masquerade">
                  <JsonField
                    label="Masquerade (object)"
                    value={entity.masquerade}
                    onChange={(next) => updateField(entityRef, "masquerade", next)}
                  />
                </div>
              ) : (
                <label className="field" data-testid="inbound-hysteria2-masquerade">
                  <span>Masquerade (URL)</span>
                  <input
                    value={typeof entity.masquerade === "string" ? entity.masquerade : ""}
                    placeholder="http://127.0.0.1:8080 or file:///var/www"
                    onChange={(event) => updateField(entityRef, "masquerade", event.target.value || undefined)}
                  />
                </label>
              )}
              <label className="toggle-row" data-testid="inbound-hysteria2-brutal-debug">
                <input
                  type="checkbox"
                  checked={Boolean(entity.brutal_debug)}
                  onChange={(event) =>
                    updateField(entityRef, "brutal_debug", event.target.checked || undefined)
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
                  onChange={(event) => updateField(entityRef, "network", event.target.value || undefined)}
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
                    updateField(entityRef, "quic_congestion_control", event.target.value || undefined)
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
              updateField(entityRef, "users", next.length ? next : undefined);
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
                              value={typeof value === "number" ? value : ""}
                              onChange={(event) => patchUser(index, { [field.key]: parseOptionalNumber(event.target.value) })}
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
          <AdvancedScalarFields entity={entity} handledFields={inboundHandledFields} entityRef={entityRef} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={inboundHandledFields} entityRef={entityRef} updateField={updateField} />
    </>
  );
}
