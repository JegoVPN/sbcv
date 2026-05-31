import { Trash2 } from "lucide-react";

import type { EntityRef, SingBoxChannel, SingBoxConfig } from "../../domain/types";
import { AdvancedNonScalarFields, AdvancedScalarFields } from "./advancedFields";
import { JsonField, PlatformBanner, SensitiveTextField } from "./controls";
import { serviceHandledFields } from "./handledFields";
import { endpointTags, type InspectorEntity, objectField, outboundTags, type UpdateField } from "./helpers";

// C14 — the service entity inspector extracted from the Inspector monolith. Behaviour-frozen move:
// rendered unchanged by the shell's `ref.kind === "service"` branch.

export function ServiceInspector({
  entity,
  entityRef,
  config,
  channel,
  entityType,
  updateField,
}: {
  entity: InspectorEntity;
  entityRef: EntityRef;
  config: SingBoxConfig;
  channel: SingBoxChannel;
  entityType: string | null;
  updateField: UpdateField;
}) {
  return (
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
                  updateField(entityRef, "servers", nextMap);
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
                  onChange={(event) => updateField(entityRef, "cache_path", event.target.value || undefined)}
                />
              </label>
              <JsonField key={`${JSON.stringify(entityRef)}:ssm-servers`} label="Endpoint Mapping JSON (advanced multi-path)" value={entity.servers ?? {}} onChange={(value) => updateField(entityRef, "servers", value)} />
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
                  onChange={(event) => updateField(entityRef, "config_path", event.target.value)}
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
                  updateField(entityRef, "verify_client_endpoint", next.length ? next : undefined);
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
                  onChange={(event) => updateField(entityRef, "home", event.target.value)}
                  placeholder="blank or redirect URL"
                />
              </label>
              {(() => {
                // U15b — a row may be the `{url, ...HTTP Client Fields}` object OR the string shorthand
                // (`"__URL__"` ≡ `{url}`, derp.md:67-71). Normalize string rows to the object form for
                // editing (the object form is the documented equivalent), so the destructure + JSON editor
                // below never spread a string into character-index garbage and never drop the URL on edit.
                const rows = (Array.isArray(entity.verify_client_url) ? entity.verify_client_url : []).map((row) =>
                  typeof row === "string" ? ({ url: row } as InspectorEntity) : (row as InspectorEntity),
                );
                const writeRows = (next: InspectorEntity[]) =>
                  updateField(entityRef, "verify_client_url", next.length ? next : undefined);
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
                        {/* U15b — detour is an outbound tag (HTTP Client Fields, service/derp.md); a select
                            prevents typos and surfaces the available outbounds, mirroring ccm/ocm. */}
                        <label className="field">
                          <span>Detour</span>
                          <select
                            value={typeof row.detour === "string" ? row.detour : ""}
                            onChange={(event) => patchRow(index, { detour: event.target.value || undefined })}
                          >
                            <option value="">(default outbound)</option>
                            {outboundTags(config).map((tag) => (
                              <option key={tag} value={tag}>
                                {tag}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="icon-danger"
                          aria-label={`Remove verify URL ${index + 1}`}
                          onClick={() => writeRows(rows.filter((_, i) => i !== index))}
                        >
                          <Trash2 size={14} />
                        </button>
                        {/* U15b — the remaining HTTP Client Fields (tls / headers / dial) of this row as a
                            parse-safe JSON editor; url + detour above are merged back so they never duplicate. */}
                        {(() => {
                          const { url: _url, detour: _detour, ...rest } = row as Record<string, unknown>;
                          return (
                            <JsonField
                              label="HTTP Client Fields (tls / headers / dial)"
                              value={Object.keys(rest).length ? rest : undefined}
                              onChange={(next) => {
                                const extra = next && typeof next === "object" && !Array.isArray(next) ? (next as Record<string, unknown>) : {};
                                writeRows(
                                  rows.map((r, i) =>
                                    i === index
                                      ? {
                                          ...(typeof r.url === "string" ? { url: r.url } : {}),
                                          ...(typeof r.detour === "string" ? { detour: r.detour } : {}),
                                          ...extra,
                                        }
                                      : r,
                                  ),
                                );
                              }}
                            />
                          );
                        })()}
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
                  updateField(entityRef, "mesh_with", next.length ? next : undefined);
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
                  onChange={(event) => updateField(entityRef, "mesh_psk", event.target.value || undefined)}
                />
              </label>
              <label className="field">
                <span>Mesh PSK File</span>
                <input
                  value={String(entity.mesh_psk_file ?? "")}
                  onChange={(event) => updateField(entityRef, "mesh_psk_file", event.target.value || undefined)}
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
                    updateField(entityRef, "stun", Object.keys(next).length ? { enabled: false, ...next } : undefined);
                    return;
                  }
                  const cleaned: InspectorEntity = {};
                  for (const [k, v] of Object.entries(merged)) {
                    if (v === undefined || v === "") continue;
                    cleaned[k] = v;
                  }
                  updateField(entityRef, "stun", cleaned);
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
                  onChange={(event) => updateField(entityRef, "credential_path", event.target.value || undefined)}
                />
              </label>
              <label className="field">
                <span>Usages Path</span>
                <input
                  value={String(entity.usages_path ?? "")}
                  onChange={(event) => updateField(entityRef, "usages_path", event.target.value || undefined)}
                />
              </label>
              <label className="field">
                <span>API Detour</span>
                <select
                  value={String(entity.detour ?? "")}
                  onChange={(event) => updateField(entityRef, "detour", event.target.value || undefined)}
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
                  updateField(entityRef, "users", next.length ? next : undefined);
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
                  updateField(entityRef, "headers", Object.keys(next).length ? next : undefined);
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
                  updateField(entityRef, "users", next.length ? next : undefined);
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

          <AdvancedScalarFields entity={entity} handledFields={serviceHandledFields} entityRef={entityRef} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={serviceHandledFields} entityRef={entityRef} updateField={updateField} />
        </>
  );
}
