import { PlatformBanner } from "./controls";
import { fromList, type InspectorEntity, objectField, toList } from "./helpers";
import { InboundSectionsB, type InboundSectionProps } from "./inboundSectionsB";

// C14 — the inbound entity inspector extracted from the Inspector monolith, split across two files for the
// ~600-line bar. This file renders the first-half sections (hysteria obfs / redirect / tproxy / the tun
// listen+address+stack config); InboundSectionsB renders the rest + the Advanced fallback. Behaviour-frozen;
// rendered unchanged by the shell's `ref.kind === "inbound"` branch.

export function InboundInspector(props: InboundSectionProps) {
  const { entity, entityRef, entityType, updateField } = props;
  return (
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
                  onChange={(event) => updateField(entityRef, "address", fromList(event.target.value))}
                />
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={Boolean(entity.auto_route)}
                  onChange={(event) => updateField(entityRef, "auto_route", event.target.checked)}
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
                      updateField(entityRef, "stack", undefined);
                      if (entity.endpoint_independent_nat) updateField(entityRef, "endpoint_independent_nat", undefined);
                      return;
                    }
                    updateField(entityRef, "stack", next);
                    if (next !== "gvisor" && entity.endpoint_independent_nat) {
                      updateField(entityRef, "endpoint_independent_nat", undefined);
                    }
                  }}
                >
                  <option value="">(default)</option>
                  <option value="system">system</option>
                  <option value="gvisor">gvisor</option>
                  <option value="mixed">mixed</option>
                </select>
              </label>
              <label className="field" data-testid="tun-interface-name">
                <span>Interface name</span>
                <input
                  value={typeof entity.interface_name === "string" ? entity.interface_name : ""}
                  placeholder="auto-selected if empty"
                  onChange={(event) => {
                    const next = event.target.value.trim();
                    updateField(entityRef, "interface_name", next ? next : undefined);
                  }}
                />
              </label>
              <label className="field" data-testid="tun-mtu">
                <span>MTU</span>
                <input
                  type="number"
                  min={0}
                  value={typeof entity.mtu === "number" ? entity.mtu : ""}
                  placeholder="9000"
                  onChange={(event) => {
                    const raw = event.target.value;
                    const parsed = Number(raw);
                    updateField(entityRef, "mtu", raw === "" || !Number.isFinite(parsed) ? undefined : parsed);
                  }}
                />
              </label>
              <label className="toggle-row" data-testid="tun-strict-route">
                <input
                  type="checkbox"
                  checked={Boolean(entity.strict_route)}
                  onChange={(event) => updateField(entityRef, "strict_route", event.target.checked || undefined)}
                />
                <span>Strict route (enforce strict routing when `auto_route` is enabled)</span>
              </label>
              <label className="field">
                <span>Route address (CIDR)</span>
                <input
                  value={toList(entity.route_address)}
                  placeholder="0.0.0.0/1, 128.0.0.0/1, ::/1, 8000::/1"
                  onChange={(event) => {
                    const next = fromList(event.target.value);
                    updateField(entityRef, "route_address", next.length ? next : undefined);
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
                    updateField(entityRef, "route_exclude_address", next.length ? next : undefined);
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
                    updateField(entityRef, "route_address_set", next.length ? next : undefined);
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
                    updateField(entityRef, "route_exclude_address_set", next.length ? next : undefined);
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
                    updateField(entityRef, "loopback_address", next.length ? next : undefined);
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
                    updateField(entityRef, "include_uid_range", next.length ? next : undefined);
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
                    updateField(entityRef, "exclude_uid_range", next.length ? next : undefined);
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
                    updateField(entityRef, "include_interface", next.length ? next : undefined);
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
                    updateField(entityRef, "exclude_interface", next.length ? next : undefined);
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
                    updateField(entityRef, "include_package", next.length ? next : undefined);
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
                    updateField(entityRef, "exclude_package", next.length ? next : undefined);
                  }}
                />
              </label>
              <label className="toggle-row" data-testid="tun-auto-redirect">
                <input
                  type="checkbox"
                  checked={Boolean(entity.auto_redirect)}
                  onChange={(event) =>
                    updateField(entityRef, "auto_redirect", event.target.checked || undefined)
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
                      updateField(entityRef, "endpoint_independent_nat", event.target.checked || undefined)
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
                  updateField(entityRef, "platform", Object.keys(nextPlatform).length ? nextPlatform : undefined);
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
      <InboundSectionsB {...props} />
    </>
  );
}
