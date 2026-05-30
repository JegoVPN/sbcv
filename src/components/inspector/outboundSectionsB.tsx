import { Trash2 } from "lucide-react";

import type { EntityRef, SingBoxConfig } from "../../domain/types";
import { AdvancedNonScalarFields, AdvancedScalarFields } from "./advancedFields";
import { SensitiveTextField } from "./controls";
import { outboundHandledFields } from "./handledFields";
import { fromList, type InspectorEntity, objectField, outboundTags, toList, type UpdateField, withUniqueBlankKey } from "./helpers";

// C14 — the second half of the outbound per-protocol inspector (http / hysteria2 / anytls / tuic / socks /
// selector / urltest + the Advanced JSON fallback), split out of outboundInspector.tsx to keep each file
// under the ~600-line bar. Behaviour-frozen; rendered by OutboundInspector after its first-half sections.

export type OutboundSectionProps = {
  entity: InspectorEntity;
  entityRef: EntityRef;
  config: SingBoxConfig;
  entityType: string | null;
  tagValue: string | null;
  updateField: UpdateField;
};

export function OutboundSectionsB({
  entity,
  entityRef,
  config,
  entityType,
  tagValue,
  updateField,
}: OutboundSectionProps) {
  return (
    <>
          {entityType === "http" ? (
            <>
              <label className="field" data-testid="outbound-http-path">
                <span>Path</span>
                <input
                  value={typeof entity.path === "string" ? entity.path : ""}
                  placeholder="/proxy"
                  onChange={(event) => updateField(entityRef, "path", event.target.value || undefined)}
                />
              </label>
              {(() => {
                const headers = objectField(entity.headers);
                const entries = Object.entries(headers);
                const writeHeaders = (next: InspectorEntity) =>
                  updateField(entityRef, "headers", Object.keys(next).length ? next : undefined);
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
                updateField(entityRef, "extra_headers", Object.keys(next).length ? next : undefined);
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
                    if (!next) return updateField(entityRef, "up_mbps", undefined);
                    const parsed = Number(next);
                    updateField(entityRef, "up_mbps", Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined);
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
                    if (!next) return updateField(entityRef, "down_mbps", undefined);
                    const parsed = Number(next);
                    updateField(entityRef, "down_mbps", Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined);
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
                    updateField(entityRef, "server_ports", next.length ? next : undefined);
                  }}
                />
              </label>
              <label className="field">
                <span>Hop Interval</span>
                <input
                  value={String(entity.hop_interval ?? "")}
                  placeholder="30s"
                  onChange={(event) => updateField(entityRef, "hop_interval", event.target.value || undefined)}
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
                    updateField(entityRef, "idle_session_check_interval", event.target.value || undefined)
                  }
                />
              </label>
              <label className="field">
                <span>Timeout</span>
                <input
                  value={typeof entity.idle_session_timeout === "string" ? entity.idle_session_timeout : ""}
                  placeholder="e.g. 30s"
                  onChange={(event) =>
                    updateField(entityRef, "idle_session_timeout", event.target.value || undefined)
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
                    if (!next) return updateField(entityRef, "min_idle_session", undefined);
                    const parsed = Number(next);
                    updateField(entityRef, "min_idle_session", Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined);
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
                updateField(entityRef, "obfs", Object.keys(cleaned).length ? cleaned : undefined);
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
                onChange={(event) => updateField(entityRef, "packet_encoding", event.target.value || undefined)}
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
                  onChange={(event) => updateField(entityRef, "congestion_control", event.target.value)}
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
                    updateField(entityRef, "udp_relay_mode", next || undefined);
                    if (next && entity.udp_over_stream) {
                      updateField(entityRef, "udp_over_stream", undefined);
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
                    updateField(entityRef, "udp_over_stream", event.target.checked || undefined);
                    if (event.target.checked && entity.udp_relay_mode) {
                      updateField(entityRef, "udp_relay_mode", undefined);
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
                  onChange={(event) => updateField(entityRef, "heartbeat", event.target.value || undefined)}
                />
              </label>
              <label className="toggle-row" data-testid="tuic-zero-rtt-handshake">
                <input
                  type="checkbox"
                  checked={Boolean(entity.zero_rtt_handshake)}
                  onChange={(event) =>
                    updateField(entityRef, "zero_rtt_handshake", event.target.checked || undefined)
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
                onChange={(event) => updateField(entityRef, "version", event.target.value)}
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
                updateField(entityRef, "outbounds", next);
                if (entityType === "selector") {
                  const currentDefault = typeof entity.default === "string" ? entity.default : "";
                  if (currentDefault && !next.includes(currentDefault)) {
                    updateField(entityRef, "default", undefined);
                  }
                }
              };
              // V9-S1: candidate order is meaningful (urltest priority; selector first-candidate default).
              // The checklist above is order-agnostic (add appends), so this list reorders entity.outbounds.
              const moveCandidate = (index: number, direction: -1 | 1) => {
                const target = index + direction;
                if (target < 0 || target >= currentCandidates.length) return;
                const next = [...currentCandidates];
                [next[index], next[target]] = [next[target]!, next[index]!];
                updateField(entityRef, "outbounds", next);
              };
              return (
                <>
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
                {currentCandidates.length >= 2 ? (
                  <fieldset className="field field--checklist" data-testid="candidate-order">
                    <legend>Candidate order</legend>
                    {currentCandidates.map((candidate, index) => (
                      <div key={`${candidate}-${index}`} className="rule-row">
                        <span className="rule-row__label">
                          {index + 1}. {candidate}
                        </span>
                        <button
                          type="button"
                          className="node-icon-button"
                          aria-label={`Move candidate ${candidate} up`}
                          disabled={index === 0}
                          onClick={() => moveCandidate(index, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="node-icon-button"
                          aria-label={`Move candidate ${candidate} down`}
                          disabled={index === currentCandidates.length - 1}
                          onClick={() => moveCandidate(index, 1)}
                        >
                          ↓
                        </button>
                      </div>
                    ))}
                  </fieldset>
                ) : null}
                </>
              );
            })()
          ) : "outbounds" in entity ? (
            <label className="field">
              <span>Candidates</span>
              <input
                value={toList(entity.outbounds)}
                onChange={(event) => updateField(entityRef, "outbounds", fromList(event.target.value))}
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
                    onChange={(event) => updateField(entityRef, "default", event.target.value || undefined)}
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
                  updateField(entityRef, "interrupt_exist_connections", event.target.checked || undefined)
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
                  onChange={(event) => updateField(entityRef, "url", event.target.value || undefined)}
                />
              </label>
              <label className="field">
                <span>Interval</span>
                <input
                  value={String(entity.interval ?? "")}
                  placeholder="3m"
                  onChange={(event) => updateField(entityRef, "interval", event.target.value || undefined)}
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
                    updateField(entityRef, "tolerance", Number.isFinite(next) && next >= 0 ? next : undefined);
                  }}
                />
              </label>
              <label className="field">
                <span>Idle timeout</span>
                <input
                  value={String(entity.idle_timeout ?? "")}
                  placeholder="30m"
                  onChange={(event) => updateField(entityRef, "idle_timeout", event.target.value || undefined)}
                />
              </label>
            </>
          ) : null}
          <AdvancedScalarFields entity={entity} handledFields={outboundHandledFields} entityRef={entityRef} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={outboundHandledFields} entityRef={entityRef} updateField={updateField} />
    </>
  );
}
