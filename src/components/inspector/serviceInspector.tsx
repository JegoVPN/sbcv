import { Trash2 } from "lucide-react";

import type { EntityRef, SingBoxChannel, SingBoxConfig } from "../../domain/types";
import { AdvancedNonScalarFields, AdvancedScalarFields } from "./advancedFields";
import { JsonField, PlatformBanner, SensitiveTextField } from "./controls";
import { serviceHandledFields } from "./handledFields";
import { endpointTags, type InspectorEntity, objectField, outboundTags, type UpdateField } from "./helpers";
import { SchemaEnumField } from "./schemaEnumField";

// C14 — the service entity inspector extracted from the Inspector monolith. Behaviour-frozen move:
// rendered unchanged by the shell's `ref.kind === "service"` branch.

// USB/IP device-match rows shared by the usbip-server (export selection) and usbip-client (import
// selection) editors. Within one row all set fields must match; rows union (service/usbip-server.md).
function UsbipDevicesEditor({
  devices,
  onChange,
  emptyHint,
  testId,
}: {
  devices: Record<string, unknown>[];
  onChange: (next: Record<string, unknown>[]) => void;
  emptyHint: string;
  testId: string;
}) {
  const patchDevice = (index: number, patch: Record<string, unknown>) =>
    onChange(devices.map((device, i) => (i === index ? { ...device, ...patch } : device)));
  const cleanPatch = (key: string, value: unknown) => ({ [key]: value === "" || value === undefined ? undefined : value });
  return (
    <fieldset className="field field--checklist" data-testid={testId}>
      <legend>Device matches</legend>
      {devices.length === 0 ? <p className="field__hint">{emptyHint}</p> : null}
      {devices.map((device, index) => (
        <div key={index} className="rule-row">
          <label className="field">
            <span>Bus ID</span>
            <input
              value={String(device.bus_id ?? "")}
              placeholder="e.g. 1-2"
              onChange={(event) => patchDevice(index, cleanPatch("bus_id", event.target.value))}
            />
          </label>
          <label className="field">
            <span>Vendor ID</span>
            <input
              type="number"
              value={typeof device.vendor_id === "number" ? device.vendor_id : ""}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                patchDevice(index, cleanPatch("vendor_id", event.target.value === "" || !Number.isFinite(parsed) ? undefined : parsed));
              }}
            />
          </label>
          <label className="field">
            <span>Product ID</span>
            <input
              type="number"
              value={typeof device.product_id === "number" ? device.product_id : ""}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                patchDevice(index, cleanPatch("product_id", event.target.value === "" || !Number.isFinite(parsed) ? undefined : parsed));
              }}
            />
          </label>
          <label className="field">
            <span>Serial</span>
            <input
              value={String(device.serial ?? "")}
              onChange={(event) => patchDevice(index, cleanPatch("serial", event.target.value))}
            />
          </label>
          <button
            type="button"
            className="icon-danger"
            onClick={() => onChange(devices.filter((_, i) => i !== index))}
            aria-label={`Remove device match ${index + 1}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="palette-action" onClick={() => onChange([...devices, {}])}>
        Add device match
      </button>
    </fieldset>
  );
}

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

          {entityType === "api" ? (
            <>
              <PlatformBanner
                kind="channel"
                text={
                  channel === "stable"
                    ? "Channel gate: service api is testing-only (sing-box 1.14+). The current channel is stable; exporting this node will fail sing-box check."
                    : "Channel gate: service api is 1.14 testing-only. Stable targets will refuse to load it."
                }
              />
              <SensitiveTextField
                label="Secret (Bearer token; empty = no auth)"
                value={String(entity.secret ?? "")}
                onChange={(next) => updateField(entityRef, "secret", next || undefined)}
              />
              <label className="field">
                <span>CORS allowed origins</span>
                <textarea
                  rows={3}
                  value={Array.isArray(entity.access_control_allow_origin) ? (entity.access_control_allow_origin as string[]).join("\n") : ""}
                  placeholder={"one origin per line; empty = *"}
                  onChange={(event) => {
                    const lines = event.target.value
                      .split(/\n/)
                      .map((line) => line.trim())
                      .filter(Boolean);
                    updateField(entityRef, "access_control_allow_origin", lines.length ? lines : undefined);
                  }}
                />
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={Boolean(entity.access_control_allow_private_network)}
                  onChange={(event) => updateField(entityRef, "access_control_allow_private_network", event.target.checked || undefined)}
                />
                <span>Allow access from private network</span>
              </label>
              {(() => {
                const raw = entity.dashboard;
                const dashboardObj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined;
                // service/api.md: boolean ≡ { enabled }, string ≡ { enabled: true, path } — normalize the
                // shorthand to the object form on the first structured edit so nothing is lost.
                const base = dashboardObj ?? (raw === true ? { enabled: true } : typeof raw === "string" ? { enabled: true, path: raw } : {});
                const enabled = raw === true || typeof raw === "string" || dashboardObj?.enabled === true;
                const writeDashboard = (patch: Record<string, unknown>) => {
                  const merged: Record<string, unknown> = { ...base, ...patch };
                  const cleaned: Record<string, unknown> = {};
                  for (const [key, value] of Object.entries(merged)) {
                    if (value === undefined || value === "") continue;
                    cleaned[key] = value;
                  }
                  updateField(entityRef, "dashboard", Object.keys(cleaned).length ? cleaned : undefined);
                };
                return (
                  <fieldset className="field field--checklist" data-testid="api-dashboard">
                    <legend>Dashboard (served at /dashboard/)</legend>
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(event) => writeDashboard({ enabled: event.target.checked || undefined })}
                      />
                      <span>Enable web dashboard</span>
                    </label>
                    {enabled ? (
                      <>
                        <label className="field">
                          <span>Path</span>
                          <input
                            value={typeof base.path === "string" ? base.path : ""}
                            placeholder="default ./dashboard"
                            onChange={(event) => writeDashboard({ path: event.target.value || undefined })}
                          />
                        </label>
                        <label className="field">
                          <span>Download URL</span>
                          <input
                            value={typeof base.download_url === "string" ? base.download_url : ""}
                            placeholder="default sing-box-dashboard gh-pages zip"
                            onChange={(event) => writeDashboard({ download_url: event.target.value || undefined })}
                          />
                        </label>
                        <label className="field">
                          <span>Update interval</span>
                          <input
                            value={typeof base.update_interval === "string" ? base.update_interval : ""}
                            placeholder="default 1d"
                            onChange={(event) => writeDashboard({ update_interval: event.target.value || undefined })}
                          />
                        </label>
                        {base.http_client !== undefined && typeof base.http_client !== "string" ? (
                          <JsonField
                            label="HTTP Client (object form)"
                            value={base.http_client}
                            onChange={(value) => writeDashboard({ http_client: value })}
                          />
                        ) : (
                          <label className="field">
                            <span>HTTP Client (http_clients tag)</span>
                            <input
                              value={typeof base.http_client === "string" ? base.http_client : ""}
                              placeholder="empty = default_http_client / first http_clients entry"
                              onChange={(event) => writeDashboard({ http_client: event.target.value || undefined })}
                            />
                          </label>
                        )}
                      </>
                    ) : null}
                  </fieldset>
                );
              })()}
            </>
          ) : null}

          {entityType === "usbip-server" ? (
            <>
              <PlatformBanner
                kind="channel"
                text={
                  channel === "stable"
                    ? "Channel gate: service usbip-server is testing-only (sing-box 1.14+). The current channel is stable; exporting this node will fail sing-box check."
                    : "Channel gate: service usbip-server is 1.14 testing-only. Stable targets will refuse to load it."
                }
              />
              <PlatformBanner
                kind="platform"
                text="Platform gate: the default provider runs via the CLI on Linux/Windows/macOS only and requires elevated privileges (macOS additionally needs a CGO build with SIP disabled). Not available on iOS."
              />
              <SchemaEnumField kind="service" type="usbip-server" field="provider" entity={entity} entityRef={entityRef} updateField={updateField} />
              <UsbipDevicesEditor
                devices={Array.isArray(entity.devices) ? (entity.devices as Record<string, unknown>[]) : []}
                onChange={(next) => updateField(entityRef, "devices", next.length ? next : undefined)}
                emptyHint="Required with the default provider: add at least one match selecting which local USB devices to export."
                testId="usbip-server-devices"
              />
            </>
          ) : null}

          {entityType === "usbip-client" ? (
            <>
              <PlatformBanner
                kind="channel"
                text={
                  channel === "stable"
                    ? "Channel gate: service usbip-client is testing-only (sing-box 1.14+). The current channel is stable; exporting this node will fail sing-box check."
                    : "Channel gate: service usbip-client is 1.14 testing-only. Stable targets will refuse to load it."
                }
              />
              <label className="field">
                <span>Server (usbip-server address)</span>
                <input
                  value={String(entity.server ?? "")}
                  placeholder="required"
                  onChange={(event) => updateField(entityRef, "server", event.target.value || undefined)}
                />
              </label>
              <label className="field">
                <span>Server Port</span>
                <input
                  type="number"
                  value={typeof entity.server_port === "number" ? entity.server_port : ""}
                  placeholder="default 3240"
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    updateField(entityRef, "server_port", event.target.value === "" || !Number.isFinite(parsed) ? undefined : parsed);
                  }}
                />
              </label>
              <UsbipDevicesEditor
                devices={Array.isArray(entity.devices) ? (entity.devices as Record<string, unknown>[]) : []}
                onChange={(next) => updateField(entityRef, "devices", next.length ? next : undefined)}
                emptyHint="Empty = import every exported device."
                testId="usbip-client-devices"
              />
            </>
          ) : null}

          <AdvancedScalarFields entity={entity} handledFields={serviceHandledFields} entityRef={entityRef} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={serviceHandledFields} entityRef={entityRef} updateField={updateField} />
        </>
  );
}
