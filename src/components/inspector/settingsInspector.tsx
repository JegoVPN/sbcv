import type { EntityRef, SingBoxChannel, SingBoxConfig } from "../../domain/types";
import { AdvancedNonScalarFields, AdvancedScalarFields } from "./advancedFields";
import { ModuleCard, PlatformBanner, SensitiveTextField } from "./controls";
import { fromList, type InspectorEntity, objectField, outboundTags, toList, type UpdateField } from "./helpers";

// Keys each settings section already renders, so the Advanced fallback surfaces only genuinely-unmodeled
// keys (M2: e.g. experimental.v2ray_api becomes visible/editable instead of JSON-only). Too-small a set
// only duplicates a shared-card key (harmless) — it never hides one.
const settingsHandledByPath: Record<string, ReadonlySet<string>> = {
  log: new Set(["disabled", "level", "output", "timestamp"]),
  ntp: new Set(["enabled", "server", "server_port", "interval", "detour"]),
  certificate: new Set(["store", "certificate", "certificate_path", "certificate_directory_path"]),
  experimental: new Set(["cache_file", "clash_api"]),
};
const EMPTY_HANDLED: ReadonlySet<string> = new Set();

// C14 — the settings inspector (the log / ntp / certificate / experimental singleton "settings" entities,
// keyed by entityRef.path) extracted from the Inspector monolith. Behaviour-frozen move: rendered
// unchanged by the shell's `ref.kind === "settings"` branch; the inner per-path gates are preserved.

export function SettingsInspector({
  entity,
  entityRef,
  config,
  channel,
  updateField,
}: {
  entity: InspectorEntity;
  entityRef: EntityRef;
  config: SingBoxConfig;
  channel: SingBoxChannel;
  updateField: UpdateField;
}) {
  return (
    <>
      {entityRef.kind === "settings" && entityRef.path === "log" ? (
        <>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.disabled)}
              onChange={(event) => updateField(entityRef, "disabled", event.target.checked || undefined)}
            />
            <span>Disable log</span>
          </label>
          <label className="field">
            <span>Level</span>
            <select
              value={String(entity.level ?? "info")}
              onChange={(event) => updateField(entityRef, "level", event.target.value)}
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
              onChange={(event) => updateField(entityRef, "output", event.target.value || undefined)}
              placeholder="file path (omit to use console)"
              disabled={Boolean(entity.disabled)}
            />
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.timestamp)}
              onChange={(event) => updateField(entityRef, "timestamp", event.target.checked || undefined)}
              disabled={Boolean(entity.disabled)}
            />
            <span>Prefix each line with a timestamp</span>
          </label>
        </>
      ) : null}

      {entityRef.kind === "settings" && entityRef.path === "ntp" ? (
        <>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.enabled)}
              onChange={(event) => updateField(entityRef, "enabled", event.target.checked)}
            />
            <span>Enable NTP</span>
          </label>
          <label className="field">
            <span>Server</span>
            <input
              value={String(entity.server ?? "")}
              onChange={(event) => updateField(entityRef, "server", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Port</span>
            <input
              type="number"
              value={Number(entity.server_port ?? 123)}
              onChange={(event) => updateField(entityRef, "server_port", Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Interval</span>
            <input
              value={String(entity.interval ?? "30m")}
              onChange={(event) => updateField(entityRef, "interval", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Detour</span>
            <select
              value={typeof entity.detour === "string" ? entity.detour : ""}
              onChange={(event) => updateField(entityRef, "detour", event.target.value || undefined)}
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

      {entityRef.kind === "settings" && entityRef.path === "certificate" ? (
        <>
          <label className="field">
            <span>Store</span>
            <select
              value={String(entity.store ?? "system")}
              onChange={(event) => updateField(entityRef, "store", event.target.value)}
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
                  updateField(entityRef, "certificate", undefined);
                  return;
                }
                const blocks = raw
                  .split(/\n{2,}/)
                  .map((block) => block.replace(/^\s+|\s+$/g, ""))
                  .filter(Boolean);
                updateField(entityRef, "certificate", blocks.length ? blocks : undefined);
              }}
              placeholder={"Paste one or more PEM blocks.\nSeparate multiple certificates with a blank line."}
            />
          </label>
          <label className="field">
            <span>Certificate Paths</span>
            <input
              value={toList(entity.certificate_path)}
              onChange={(event) => updateField(entityRef, "certificate_path", fromList(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Certificate Directory Paths</span>
            <input
              value={toList(entity.certificate_directory_path)}
              onChange={(event) => updateField(entityRef, "certificate_directory_path", fromList(event.target.value))}
            />
          </label>
        </>
      ) : null}

      {entityRef.kind === "settings" && entityRef.path === "experimental" ? (
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
                    onChange={(event) => updateField(entityRef, "cache_file", { ...cacheFile, enabled: event.target.checked })}
                  />
                  <span>Enable cache file</span>
                </label>
                <label className="field">
                  <span>Path</span>
                  <input
                    value={String(cacheFile.path ?? "")}
                    onChange={(event) => updateField(entityRef, "cache_file", { ...cacheFile, path: event.target.value })}
                    placeholder="cache.db"
                  />
                </label>
                <label className="field">
                  <span>Cache ID</span>
                  <input
                    value={String(cacheFile.cache_id ?? "")}
                    onChange={(event) => updateField(entityRef, "cache_file", { ...cacheFile, cache_id: event.target.value })}
                  />
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={Boolean(cacheFile.store_fakeip)}
                    onChange={(event) => updateField(entityRef, "cache_file", { ...cacheFile, store_fakeip: event.target.checked })}
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
                      updateField(entityRef, "cache_file", {
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
                        updateField(entityRef, "cache_file", {
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
                        updateField(entityRef, "cache_file", {
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
                      updateField(entityRef, "clash_api", { ...clashApi, external_controller: event.target.value })
                    }
                    placeholder="127.0.0.1:9090"
                  />
                </label>
                <SensitiveTextField
                  label="Secret"
                  value={String(clashApi.secret ?? "")}
                  onChange={(next) => updateField(entityRef, "clash_api", { ...clashApi, secret: next })}
                />
                <label className="field">
                  <span>Default Mode</span>
                  <select
                    value={String(clashApi.default_mode ?? "")}
                    onChange={(event) =>
                      updateField(entityRef, "clash_api", { ...clashApi, default_mode: event.target.value || undefined })
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
                      updateField(entityRef, "clash_api", { ...clashApi, external_ui: event.target.value || undefined })
                    }
                    placeholder="./ui or absolute path"
                  />
                </label>
                <label className="field">
                  <span>External UI Download URL</span>
                  <input
                    value={String(clashApi.external_ui_download_url ?? "")}
                    onChange={(event) =>
                      updateField(entityRef, "clash_api", {
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
                      updateField(entityRef, "clash_api", {
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
                          updateField(entityRef, "clash_api", {
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
                          updateField(entityRef, "clash_api", {
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
                    onChange={(event) => updateField(entityRef, "v2ray_api", { ...v2rayApi, listen: event.target.value })}
                  />
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={Boolean(v2rayStats.enabled)}
                    onChange={(event) =>
                      updateField(entityRef, "v2ray_api", {
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
                      updateField(entityRef, "v2ray_api", {
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
                      updateField(entityRef, "v2ray_api", {
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
                      updateField(entityRef, "v2ray_api", {
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
      {entityRef.kind === "settings" ? (
        <>
          <AdvancedScalarFields
            entity={entity}
            handledFields={settingsHandledByPath[String(entityRef.path)] ?? EMPTY_HANDLED}
            entityRef={entityRef}
            updateField={updateField}
          />
          <AdvancedNonScalarFields
            entity={entity}
            handledFields={settingsHandledByPath[String(entityRef.path)] ?? EMPTY_HANDLED}
            entityRef={entityRef}
            updateField={updateField}
          />
        </>
      ) : null}
    </>
  );
}
