import { Trash2 } from "lucide-react";

import type { EntityRef } from "../../domain/types";
import { AdvancedNonScalarFields, AdvancedScalarFields } from "./advancedFields";
import { PlatformBanner, SensitiveTextField } from "./controls";
import { endpointHandledFields } from "./handledFields";
import { type EndpointReferences, fromList, type InspectorEntity, parseOptionalPort, toList, type UpdateField } from "./helpers";

// C14 — the endpoint entity inspector extracted from the Inspector monolith. Behaviour-frozen move:
// rendered unchanged by the shell's `ref.kind === "endpoint"` branch. The shell computes
// selectedEndpointReferences (via helpers.endpointReferences) and passes it in read-only.

function formatReferenceList(items: string[] | number[]) {
  return items.length ? items.join(", ") : "none";
}

export function EndpointInspector({
  entity,
  entityRef,
  entityType,
  tagValue,
  selectedEndpointReferences,
  updateField,
}: {
  entity: InspectorEntity;
  entityRef: EntityRef;
  entityType: string | null;
  tagValue: string | null;
  selectedEndpointReferences: EndpointReferences | null;
  updateField: UpdateField;
}) {
  return (
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
                  onChange={(event) => updateField(entityRef, "address", fromList(event.target.value))}
                  placeholder="10.0.0.2/32, fd00::2/128"
                />
              </label>
              <SensitiveTextField
                label="Private Key"
                value={String(entity.private_key ?? "")}
                onChange={(next) => updateField(entityRef, "private_key", next)}
              />
              {(() => {
                const peers = Array.isArray(entity.peers) ? (entity.peers as Record<string, unknown>[]) : [];
                const writePeers = (next: Record<string, unknown>[]) => {
                  updateField(entityRef, "peers", next.length ? next : undefined);
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
                            value={typeof peer.port === "number" ? peer.port : ""}
                            placeholder="51820"
                            onChange={(event) => patchPeer(index, { port: parseOptionalPort(event.target.value) })}
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
                        <label className="field" data-testid={`wireguard-peer-reserved-${index}`}>
                          <span>Reserved (3 bytes)</span>
                          <input
                            value={Array.isArray(peer.reserved) ? (peer.reserved as number[]).join(", ") : ""}
                            placeholder="0, 0, 0"
                            onChange={(event) => {
                              const parts = event.target.value.split(",").map((p) => p.trim()).filter((p) => p !== "");
                              const nums = parts.map(Number);
                              // reserved is exactly 3 bytes (endpoint/wireguard.md) — only write a valid
                              // [int,int,int]; anything else (partial entry, wrong arity) prunes to unset.
                              const valid = nums.length === 3 && nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
                              patchPeer(index, { reserved: valid ? nums : undefined });
                            }}
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
              {/* DF5 — `system` selects the system TUN stack (vs the default gVisor userspace stack); it was
                  a bare, unexplained Advanced toggle. Promote it to a named, annotated control. */}
              <label className="toggle-row" data-testid="wireguard-system">
                <input
                  type="checkbox"
                  checked={entity.system === true}
                  onChange={(event) => updateField(entityRef, "system", event.target.checked || undefined)}
                />
                <span>System interface (use the system TUN stack instead of gVisor; requires privilege)</span>
              </label>
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
                onChange={(next) => updateField(entityRef, "auth_key", next || undefined)}
                placeholder="tskey-auth-..."
              />
              <label className="field">
                <span>State Directory</span>
                <input
                  value={String(entity.state_directory ?? "")}
                  onChange={(event) => updateField(entityRef, "state_directory", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Control URL</span>
                <input
                  value={String(entity.control_url ?? "")}
                  onChange={(event) => updateField(entityRef, "control_url", event.target.value || undefined)}
                />
              </label>
              <label className="field">
                <span>Advertise Routes</span>
                <input
                  value={toList(entity.advertise_routes)}
                  onChange={(event) => updateField(entityRef, "advertise_routes", fromList(event.target.value))}
                />
              </label>
              <label className="field">
                <span>Advertise Tags (since sing-box 1.13.0)</span>
                <input
                  value={toList(entity.advertise_tags)}
                  onChange={(event) => updateField(entityRef, "advertise_tags", fromList(event.target.value))}
                />
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={entity.system_interface === true}
                  onChange={(event) => updateField(entityRef, "system_interface", event.target.checked || undefined)}
                />
                <span>System Interface (since sing-box 1.13.0)</span>
              </label>
              <label className="field">
                <span>System Interface Name (since sing-box 1.13.0)</span>
                <input
                  value={typeof entity.system_interface_name === "string" ? entity.system_interface_name : ""}
                  placeholder="tailscale0"
                  onChange={(event) => updateField(entityRef, "system_interface_name", event.target.value || undefined)}
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
                      entityRef,
                      "system_interface_mtu",
                      event.target.value === "" || !Number.isFinite(parsed) ? undefined : parsed,
                    );
                  }}
                />
              </label>
              <label className="field">
                <span>Relay Server Static Endpoints (since sing-box 1.13.0)</span>
                <input
                  value={toList(entity.relay_server_static_endpoints)}
                  placeholder="192.0.2.1:41641, 198.51.100.2:41641"
                  onChange={(event) => {
                    const next = fromList(event.target.value);
                    updateField(entityRef, "relay_server_static_endpoints", next.length ? next : undefined);
                  }}
                />
              </label>
            </>
          ) : null}
          <AdvancedScalarFields entity={entity} handledFields={endpointHandledFields} entityRef={entityRef} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={endpointHandledFields} entityRef={entityRef} updateField={updateField} />
        </>
  );
}
