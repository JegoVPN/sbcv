import { Trash2 } from "lucide-react";

import { defaultFieldKeysFor } from "../../domain/schemaRegistry";
import type { EntityRef, SingBoxChannel, SingBoxConfig } from "../../domain/types";
import { AdvancedNonScalarFields, AdvancedScalarFields } from "./advancedFields";
import { PlatformBanner } from "./controls";
import { dnsServerHandledFieldsForChannel } from "./handledFields";
import { endpointTags, fromList, type InspectorEntity, objectField, toList, type UpdateField, withUniqueBlankKey } from "./helpers";

// C14 — the dns-server entity inspector extracted from the Inspector monolith. Behaviour-frozen move:
// rendered unchanged by the shell's `ref.kind === "dns-server"` branch.

export function DnsServerInspector({
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
  // R4: type-driven field visibility — render server/server_port/path for a type that carries them
  // (per the schema factory) even when an imported config omitted the value, so it stays repairable.
  const typeFields = defaultFieldKeysFor("dns-server", entityType);
  return (
        <>
          {entityType === "local" ? (
            <label className="toggle-row" data-testid="dns-server-local-prefer-go">
              <input
                type="checkbox"
                checked={Boolean(entity.prefer_go)}
                onChange={(event) =>
                  updateField(entityRef, "prefer_go", event.target.checked || undefined)
                }
              />
              <span>Prefer Go resolver (1.13+; skips Apple getaddrinfo / Linux systemd-resolved — Android platform DNS and macOS DHCP still apply)</span>
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
                  onChange={(event) => updateField(entityRef, "service", event.target.value || undefined)}
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
                    updateField(entityRef, "accept_default_resolvers", event.target.checked || undefined)
                  }
                />
                <span>Accept default resolvers for fallback (in addition to matching domains; off ⇒ NXDOMAIN for non-matching)</span>
              </label>
            </>
          ) : null}
          {entityType === "tailscale" ? (
            <PlatformBanner
              kind="build-tag"
              text="Build-tag gate: dns-server `tailscale` requires sing-box built with the `with_tailscale` tag (in official default builds; absent only from custom builds that drop it)."
            />
          ) : null}
          {"address" in entity ? (
            <label className="field">
              <span>Address</span>
              <input
                value={String(entity.address ?? "")}
                onChange={(event) => updateField(entityRef, "address", event.target.value)}
              />
            </label>
          ) : null}
          {typeFields.has("server") || "server" in entity ? (
            <label className="field">
              <span>Server</span>
              <input
                value={String(entity.server ?? "")}
                placeholder="resolver address (host or IP)"
                onChange={(event) => updateField(entityRef, "server", event.target.value)}
              />
            </label>
          ) : null}
          {typeFields.has("server_port") || "server_port" in entity ? (
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
                      updateField(entityRef, "server_port", Number.isFinite(next) && next > 0 ? next : undefined);
                    }}
                    placeholder={String(defaultPort)}
                  />
                </label>
              );
            })()
          ) : null}
          {typeFields.has("path") || "path" in entity ? (
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
                      updateField(entityRef, "path", undefined);
                    } else if (list.length === 1) {
                      updateField(entityRef, "path", list[0]);
                    } else {
                      updateField(entityRef, "path", list);
                    }
                  }}
                />
              </label>
            ) : (
              <label className="field">
                <span>Path</span>
                <input
                  value={typeof entity.path === "string" ? entity.path : ""}
                  onChange={(event) => updateField(entityRef, "path", event.target.value || undefined)}
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
                  onChange={(event) => updateField(entityRef, "endpoint", event.target.value || undefined)}
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
                    updateField(entityRef, "accept_default_resolvers", event.target.checked || undefined)
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
                      updateField(entityRef, "accept_search_domain", event.target.checked || undefined)
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
                updateField(entityRef, "predefined", Object.keys(cleaned).length ? cleaned : undefined);
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
                placeholder="(default interface)"
                onChange={(event) => updateField(entityRef, "interface", event.target.value || undefined)}
              />
            </label>
          ) : null}
          {entityType === "mdns" ? (
            // mdns `interface` is a List (string[]) of interface names to send queries on — distinct from
            // the dhcp single-string control above (DF2: it had no editor for mdns and was excluded from
            // the Advanced fallback).
            <label className="field" data-testid="mdns-interface">
              <span>Interface (mDNS query interfaces)</span>
              <input
                value={toList(entity.interface)}
                placeholder="en0, en1 — all up/multicast interfaces if empty"
                onChange={(event) => {
                  const next = fromList(event.target.value);
                  updateField(entityRef, "interface", next.length ? next : undefined);
                }}
              />
            </label>
          ) : null}
          {entityType === "https" || entityType === "h3" ? (
            (() => {
              const headers = objectField(entity.headers);
              const entries = Object.entries(headers);
              const writeHeaders = (next: InspectorEntity) =>
                updateField(entityRef, "headers", Object.keys(next).length ? next : undefined);
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
                  onChange={(event) => updateField(entityRef, "inet4_range", event.target.value || undefined)}
                />
              </label>
              <label className="field">
                <span>IPv6 Range (CIDR)</span>
                <input
                  value={typeof entity.inet6_range === "string" ? entity.inet6_range : ""}
                  placeholder="fc00::/18"
                  onChange={(event) => updateField(entityRef, "inet6_range", event.target.value || undefined)}
                />
              </label>
            </>
          ) : null}
          <AdvancedScalarFields entity={entity} handledFields={dnsServerHandledFieldsForChannel(channel)} entityRef={entityRef} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={dnsServerHandledFieldsForChannel(channel)} entityRef={entityRef} updateField={updateField} />
        </>
  );
}
