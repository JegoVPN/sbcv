import { Trash2 } from "lucide-react";

import { defaultFieldKeysFor } from "../../domain/schemaRegistry";
import { PlatformBanner, SensitiveTextField } from "./controls";
import { fromList, type InspectorEntity, objectField, toList, withUniqueBlankKey } from "./helpers";
import { OutboundSectionsB, type OutboundSectionProps } from "./outboundSectionsB";

// C14 — the outbound entity inspector extracted from the Inspector monolith, split across two files for
// the ~600-line bar. This file renders the first-half per-protocol sections (naive / shadowtls / tor /
// block / hysteria / ssh / shadowsocks / vmess / vless); OutboundSectionsB renders the rest + Advanced
// fallback. Behaviour-frozen; rendered unchanged by the shell's `ref.kind === "outbound"` branch.

export function OutboundInspector(props: OutboundSectionProps) {
  const { entity, entityRef, entityType, updateField } = props;
  // R4: which identity fields THIS type carries, from the schema factory — so a server/server_port
  // missing from an imported config still renders an editable input (type-driven, not presence-gated).
  const typeFields = defaultFieldKeysFor("outbound", entityType);
  return (
    <>
          {entityType === "naive" ? (
            <PlatformBanner
              kind="platform"
              text="naive outbound runs only on Apple platforms, Android, Windows, and certain Linux builds. Linux and Windows builds must ship libcronet (libcronet.so on Linux / libcronet.dll on Windows, on the binary's path)."
            />
          ) : null}
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
                  onChange={(event) => updateField(entityRef, "executable_path", event.target.value || undefined)}
                />
              </label>
              <label className="field">
                <span>Data Directory</span>
                <input
                  value={String(entity.data_directory ?? "")}
                  placeholder="$HOME/.cache/sing-box/tor"
                  onChange={(event) => updateField(entityRef, "data_directory", event.target.value || undefined)}
                />
              </label>
              <label className="field">
                <span>Extra Args (CSV)</span>
                <input
                  value={toList(entity.extra_args)}
                  placeholder="--SafeLogging,0"
                  onChange={(event) => {
                    const next = fromList(event.target.value);
                    updateField(entityRef, "extra_args", next.length ? next : undefined);
                  }}
                />
              </label>
              {(() => {
                const torrc = objectField(entity.torrc);
                const entries = Object.entries(torrc);
                const writeTorrc = (next: InspectorEntity) =>
                  updateField(entityRef, "torrc", Object.keys(next).length ? next : undefined);
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
              text="Removed: outbound type `block` was removed in sing-box 1.13 (deprecated since 1.11). It is rejected on the stable (1.13) and testing (1.14) channels — use a route rule with action `reject` instead."
            />
          ) : null}
          {entityType === "hysteria" ? (
            <PlatformBanner
              kind="deprecated"
              text="Hysteria v1 is legacy — prefer `hysteria2` for new deployments."
            />
          ) : null}
          {typeFields.has("server") || "server" in entity ? (
            <label className="field">
              <span>Server</span>
              <input
                value={String(entity.server ?? "")}
                placeholder="server address (host or IP)"
                onChange={(event) => updateField(entityRef, "server", event.target.value)}
              />
            </label>
          ) : null}
          {typeFields.has("server_port") || "server_port" in entity ? (
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
                      updateField(entityRef, "server_port", Number.isFinite(next) && next > 0 ? next : undefined);
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
                onChange={(event) => updateField(entityRef, "network", event.target.value || undefined)}
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
                onChange={(next) => updateField(entityRef, "uuid", next || undefined)}
              />
              <button
                type="button"
                className="palette-action"
                onClick={() => {
                  const uuid = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                    ? crypto.randomUUID()
                    : "00000000-0000-4000-8000-000000000000");
                  updateField(entityRef, "uuid", uuid);
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
                  onChange={(event) => updateField(entityRef, "username", event.target.value || undefined)}
                />
              </label>
              {entityType !== "naive" ? (
                <SensitiveTextField
                  label="Password"
                  value={String(entity.password ?? "")}
                  onChange={(next) => updateField(entityRef, "password", next || undefined)}
                />
              ) : null}
            </>
          ) : null}
          {entityType && ["shadowsocks", "trojan", "naive", "tuic", "hysteria2", "anytls", "shadowtls"].includes(entityType) ? (
            <SensitiveTextField
              label="Password"
              value={String(entity.password ?? "")}
              onChange={(next) => updateField(entityRef, "password", next || undefined)}
            />
          ) : null}
          {entityType === "hysteria" ? (
            <>
              <SensitiveTextField
                label="Auth (string)"
                value={String(entity.auth_str ?? "")}
                onChange={(next) => updateField(entityRef, "auth_str", next || undefined)}
              />
              <label className="field" data-testid="outbound-hysteria-up-mbps">
                <span>Up Mbps</span>
                <input
                  type="number"
                  value={typeof entity.up_mbps === "number" ? entity.up_mbps : ""}
                  placeholder="required (Mbps)"
                  onChange={(event) => {
                    const raw = event.target.value;
                    if (!raw) return updateField(entityRef, "up_mbps", undefined);
                    const parsed = Number(raw);
                    updateField(
                      entityRef,
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
                    if (!raw) return updateField(entityRef, "down_mbps", undefined);
                    const parsed = Number(raw);
                    updateField(
                      entityRef,
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
                  onChange={(event) => updateField(entityRef, "obfs", event.target.value || undefined)}
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
                  onChange={(event) => updateField(entityRef, "user", event.target.value || undefined)}
                />
              </label>
              <SensitiveTextField
                label="Password"
                value={String(entity.password ?? "")}
                onChange={(next) => updateField(entityRef, "password", next || undefined)}
              />
              <label className="field">
                <span>Private Key Path</span>
                <input
                  value={String(entity.private_key_path ?? "")}
                  onChange={(event) =>
                    updateField(entityRef, "private_key_path", event.target.value || undefined)
                  }
                  placeholder="~/.ssh/id_ed25519"
                />
              </label>
              <SensitiveTextField
                label="Private Key (PEM)"
                value={String(entity.private_key ?? "")}
                onChange={(next) => updateField(entityRef, "private_key", next || undefined)}
              />
              <SensitiveTextField
                label="Private Key Passphrase"
                value={String(entity.private_key_passphrase ?? "")}
                onChange={(next) => updateField(entityRef, "private_key_passphrase", next || undefined)}
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
                    updateField(entityRef, "host_key", lines.length ? lines : undefined);
                  }}
                />
              </label>
              <label className="field">
                <span>Host Key Algorithms</span>
                <input
                  value={Array.isArray(entity.host_key_algorithms) ? (entity.host_key_algorithms as string[]).join(", ") : ""}
                  onChange={(event) =>
                    updateField(entityRef, "host_key_algorithms", fromList(event.target.value).length ? fromList(event.target.value) : undefined)
                  }
                  placeholder="ssh-ed25519, ssh-rsa"
                />
              </label>
              <label className="field">
                <span>Client Version</span>
                <input
                  value={String(entity.client_version ?? "")}
                  onChange={(event) => updateField(entityRef, "client_version", event.target.value || undefined)}
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
                    updateField(entityRef, "cipher", next.length ? next : undefined);
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
                    updateField(entityRef, "mac", next.length ? next : undefined);
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
                    updateField(entityRef, "kex_algorithm", next.length ? next : undefined);
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
                    updateField(entityRef, "plugin", event.target.value || undefined)
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
                      updateField(entityRef, "plugin_opts", event.target.value || undefined)
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
                onChange={(event) => updateField(entityRef, "security", event.target.value)}
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
                onChange={(event) => updateField(entityRef, "flow", event.target.value || undefined)}
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
                  updateField(entityRef, "quic_congestion_control", event.target.value || undefined)
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
      <OutboundSectionsB {...props} />
    </>
  );
}
