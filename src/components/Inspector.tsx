import { useEffect, useMemo, useState } from "react";
import {
  Braces,
  GitBranch,
  Globe2,
  Network,
  RadioTower,
  Route,
  Server,
  Trash2,
  X,
} from "lucide-react";
import type { EntityRef, SingBoxConfig } from "../domain/types";
import { useProjectStore } from "../state/useProjectStore";
import { InspectorPanels } from "./InspectorPanels";

type InspectorEntity = Record<string, unknown>;
type InspectorKind = EntityRef["kind"];

const inspectorIcons = {
  inbound: RadioTower,
  outbound: Network,
  "dns-server": Server,
  route: Route,
  "route-rule": GitBranch,
  dns: Globe2,
  "dns-rule": GitBranch,
  settings: Braces,
} satisfies Record<InspectorKind, typeof Braces>;

function selectedRefFromId(id: string | null): EntityRef | null {
  if (!id) return null;
  const [kind, ...rest] = id.split(":");
  const value = rest.join(":");
  if (kind === "inbound" && value) return { kind: "inbound", tag: value };
  if (kind === "outbound" && value) return { kind: "outbound", tag: value };
  if (kind === "dns-server" && value) return { kind: "dns-server", tag: value };
  if (kind === "route") return { kind: "route", id: "main" };
  if (kind === "dns") return { kind: "dns", id: "main" };
  if (kind === "route-rule" && value) return { kind: "route-rule", index: Number(value) };
  if (kind === "dns-rule" && value) return { kind: "dns-rule", index: Number(value) };
  if (kind === "settings" && value) return { kind: "settings", path: value as keyof SingBoxConfig };
  return null;
}

function generatedIndex(value: string, kind: "inbound" | "outbound" | "dns-server") {
  const prefix = `untagged-${kind}-`;
  if (!value.startsWith(prefix)) return -1;
  const index = Number(value.slice(prefix.length)) - 1;
  return Number.isInteger(index) && index >= 0 ? index : -1;
}

function findTaggedOrGenerated<T extends { tag?: string }>(items: T[] | undefined, tag: string, kind: "inbound" | "outbound" | "dns-server") {
  const byTag = items?.find((item) => item.tag === tag);
  if (byTag) return byTag;
  const index = generatedIndex(tag, kind);
  return index >= 0 ? items?.[index] : undefined;
}

function toList(value: unknown): string {
  return Array.isArray(value) ? value.join(", ") : "";
}

function fromList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const inboundHandledFields = new Set(["tag", "type", "address", "auto_route"]);
const outboundHandledFields = new Set(["tag", "type", "server", "server_port", "outbounds", "default", "detour"]);
const dnsServerHandledFields = new Set(["tag", "type", "address", "server", "server_port", "path", "detour"]);

function labelForField(field: string) {
  return field
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function editableScalarFields(entity: InspectorEntity, handledFields: Set<string>) {
  return Object.entries(entity).filter(([field, value]) => {
    if (handledFields.has(field)) return false;
    const valueType = typeof value;
    return valueType === "string" || valueType === "number" || valueType === "boolean";
  });
}

function objectField(value: unknown): InspectorEntity {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as InspectorEntity) : {};
}

function summaryFor(ref: EntityRef, entity: InspectorEntity) {
  const lines = [
    `kind: ${ref.kind}`,
    typeof entity.type === "string" ? `type: ${entity.type}` : null,
    typeof entity.tag === "string" ? `tag: ${entity.tag}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

function supportsDialDetour(type: string | null) {
  return Boolean(type && !["direct", "block", "selector", "urltest", "dns"].includes(type));
}

function outboundTags(config: SingBoxConfig, excludeTag?: string) {
  return (config.outbounds ?? [])
    .map((outbound) => outbound.tag)
    .filter((tag): tag is string => Boolean(tag && tag !== excludeTag));
}

function outboundGroups(config: SingBoxConfig, type: "selector" | "urltest") {
  return (config.outbounds ?? [])
    .filter((outbound) => outbound.type === type && typeof outbound.tag === "string")
    .map((outbound) => ({
      tag: outbound.tag,
      members: Array.isArray(outbound.outbounds) ? outbound.outbounds : [],
    }));
}

function outboundReferences(config: SingBoxConfig, tag: string) {
  return {
    routeFinal: config.route?.final === tag,
    routeRules:
      config.route?.rules
        ?.map((rule, index) => (rule.outbound === tag ? index + 1 : null))
        .filter((index): index is number => index !== null) ?? [],
    selectors: outboundGroups(config, "selector").filter((group) => group.members.includes(tag)).map((group) => group.tag),
    urltests: outboundGroups(config, "urltest").filter((group) => group.members.includes(tag)).map((group) => group.tag),
    dnsDetours: config.dns?.servers?.filter((server) => server.detour === tag).map((server) => server.tag) ?? [],
    outboundDetours:
      config.outbounds
        ?.filter((outbound) => outbound.tag !== tag && outbound.detour === tag)
        .map((outbound) => outbound.tag) ?? [],
  };
}

function formatReferenceList(items: string[] | number[]) {
  return items.length ? items.join(", ") : "none";
}

export function Inspector() {
  const selectedId = useProjectStore((state) => state.selectedId);
  const config = useProjectStore((state) => state.config);
  const updateField = useProjectStore((state) => state.updateField);
  const renameTag = useProjectStore((state) => state.renameTag);
  const deleteEntity = useProjectStore((state) => state.deleteEntity);
  const setSelectedId = useProjectStore((state) => state.setSelectedId);
  const connectOutboundReference = useProjectStore((state) => state.connectOutboundReference);
  const createCompatible = useProjectStore((state) => state.createCompatible);
  const ref = useMemo(() => selectedRefFromId(selectedId), [selectedId]);
  const entity = useMemo<InspectorEntity | null>(() => {
    if (!ref) return null;
    if (ref.kind === "inbound") return (findTaggedOrGenerated(config.inbounds, ref.tag, "inbound") as InspectorEntity | undefined) ?? null;
    if (ref.kind === "outbound") return (findTaggedOrGenerated(config.outbounds, ref.tag, "outbound") as InspectorEntity | undefined) ?? null;
    if (ref.kind === "dns-server") {
      return (findTaggedOrGenerated(config.dns?.servers, ref.tag, "dns-server") as InspectorEntity | undefined) ?? null;
    }
    if (ref.kind === "route") return (config.route as InspectorEntity | undefined) ?? null;
    if (ref.kind === "dns") return (config.dns as InspectorEntity | undefined) ?? null;
    if (ref.kind === "route-rule") return (config.route?.rules?.[ref.index] as InspectorEntity | undefined) ?? null;
    if (ref.kind === "dns-rule") return (config.dns?.rules?.[ref.index] as InspectorEntity | undefined) ?? null;
    if (ref.kind === "settings") {
      const entity = config[ref.path];
      return entity && typeof entity === "object" && !Array.isArray(entity)
        ? (entity as InspectorEntity)
        : null;
    }
    return null;
  }, [config, ref]);
  const [tagDraft, setTagDraft] = useState("");

  useEffect(() => {
    if (entity && "tag" in entity && typeof entity.tag === "string") setTagDraft(entity.tag);
    else setTagDraft("");
  }, [entity]);

  if (!ref || !entity) return null;

  const tagValue = typeof entity.tag === "string" ? entity.tag : null;
  const entityType = typeof entity.type === "string" ? entity.type : null;
  const InspectorIcon = inspectorIcons[ref.kind];
  const selectedOutboundReferences =
    ref.kind === "outbound" && tagValue ? outboundReferences(config, tagValue) : null;
  const selectorGroups = outboundGroups(config, "selector");
  const urltestGroups = outboundGroups(config, "urltest");
  const firstSelector = selectorGroups.find((group) => tagValue && !group.members.includes(tagValue));
  const firstUrltest = urltestGroups.find((group) => tagValue && !group.members.includes(tagValue));

  return (
    <aside className="inspector" aria-label="Node inspector" data-testid="node-inspector">
      <div className="inspector__header" data-testid="inspector-header">
        <div className="inspector__title">
          <InspectorIcon size={18} />
          <span>{ref.kind}</span>
        </div>
        <button type="button" className="node-icon-button" aria-label="Close inspector" onClick={() => setSelectedId(null)}>
          <X size={16} />
        </button>
      </div>
      <div className="inspector-heading">
        <div>
          <div className="inspector-kind">{ref.kind}</div>
          <h2>{tagValue ?? ref.kind}</h2>
        </div>
        {ref.kind !== "route" && ref.kind !== "dns" ? (
          <button type="button" className="icon-danger" onClick={() => deleteEntity(ref)}>
            <Trash2 size={15} />
          </button>
        ) : null}
      </div>

      <textarea
        className="inspector__primary-editor"
        aria-label="Selected node summary"
        data-testid="inspector-primary-editor"
        value={summaryFor(ref, entity)}
        readOnly
      />

      {tagValue ? (
        <label className="field">
          <span>Tag</span>
          <input
            value={tagDraft}
            onChange={(event) => setTagDraft(event.target.value)}
            onBlur={() => renameTag(tagValue, tagDraft)}
          />
        </label>
      ) : null}

      {entityType ? (
        <label className="field">
          <span>Type</span>
          <input value={entityType} disabled />
        </label>
      ) : null}

      {ref.kind === "settings" && ref.path === "log" ? (
        <>
          <label className="field">
            <span>Level</span>
            <select
              value={String(entity.level ?? "info")}
              onChange={(event) => updateField(ref, "level", event.target.value)}
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
              onChange={(event) => updateField(ref, "output", event.target.value || undefined)}
              placeholder="stdout or file path"
            />
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.disabled)}
              onChange={(event) => updateField(ref, "disabled", event.target.checked || undefined)}
            />
            <span>Disable log</span>
          </label>
        </>
      ) : null}

      {ref.kind === "settings" && ref.path === "ntp" ? (
        <>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.enabled)}
              onChange={(event) => updateField(ref, "enabled", event.target.checked)}
            />
            <span>Enable NTP</span>
          </label>
          <label className="field">
            <span>Server</span>
            <input
              value={String(entity.server ?? "")}
              onChange={(event) => updateField(ref, "server", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Port</span>
            <input
              type="number"
              value={Number(entity.server_port ?? 123)}
              onChange={(event) => updateField(ref, "server_port", Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Interval</span>
            <input
              value={String(entity.interval ?? "30m")}
              onChange={(event) => updateField(ref, "interval", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Detour</span>
            <input
              value={String(entity.detour ?? "")}
              onChange={(event) => updateField(ref, "detour", event.target.value || undefined)}
            />
          </label>
        </>
      ) : null}

      {ref.kind === "settings" && ref.path === "certificate" ? (
        <>
          <label className="field">
            <span>Store</span>
            <select
              value={String(entity.store ?? "system")}
              onChange={(event) => updateField(ref, "store", event.target.value)}
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
              value={toList(entity.certificate)}
              onChange={(event) => updateField(ref, "certificate", fromList(event.target.value))}
              placeholder="PEM entries, comma separated"
            />
          </label>
          <label className="field">
            <span>Certificate Paths</span>
            <input
              value={toList(entity.certificate_path)}
              onChange={(event) => updateField(ref, "certificate_path", fromList(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Certificate Directory Paths</span>
            <input
              value={toList(entity.certificate_directory_path)}
              onChange={(event) => updateField(ref, "certificate_directory_path", fromList(event.target.value))}
            />
          </label>
        </>
      ) : null}

      {ref.kind === "settings" && ref.path === "experimental" ? (
        (() => {
          const cacheFile = objectField(entity.cache_file);
          const clashApi = objectField(entity.clash_api);
          const v2rayApi = objectField(entity.v2ray_api);
          const v2rayStats = objectField(v2rayApi.stats);
          return (
            <>
              <div className="inspector-section-title">Cache File</div>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={Boolean(cacheFile.enabled)}
                  onChange={(event) => updateField(ref, "cache_file", { ...cacheFile, enabled: event.target.checked })}
                />
                <span>Enable cache file</span>
              </label>
              <label className="field">
                <span>Cache Path</span>
                <input
                  value={String(cacheFile.path ?? "")}
                  onChange={(event) => updateField(ref, "cache_file", { ...cacheFile, path: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Cache ID</span>
                <input
                  value={String(cacheFile.cache_id ?? "")}
                  onChange={(event) => updateField(ref, "cache_file", { ...cacheFile, cache_id: event.target.value })}
                />
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={Boolean(cacheFile.store_fakeip)}
                  onChange={(event) => updateField(ref, "cache_file", { ...cacheFile, store_fakeip: event.target.checked })}
                />
                <span>Store FakeIP</span>
              </label>

              <div className="inspector-section-title">Clash API</div>
              <label className="field">
                <span>External Controller</span>
                <input
                  value={String(clashApi.external_controller ?? "")}
                  onChange={(event) =>
                    updateField(ref, "clash_api", { ...clashApi, external_controller: event.target.value })
                  }
                />
              </label>
              <label className="field">
                <span>Secret</span>
                <input
                  value={String(clashApi.secret ?? "")}
                  onChange={(event) => updateField(ref, "clash_api", { ...clashApi, secret: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Default Mode</span>
                <input
                  value={String(clashApi.default_mode ?? "")}
                  onChange={(event) => updateField(ref, "clash_api", { ...clashApi, default_mode: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Allowed Origins</span>
                <input
                  value={toList(clashApi.access_control_allow_origin)}
                  onChange={(event) =>
                    updateField(ref, "clash_api", { ...clashApi, access_control_allow_origin: fromList(event.target.value) })
                  }
                />
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={Boolean(clashApi.access_control_allow_private_network)}
                  onChange={(event) =>
                    updateField(ref, "clash_api", {
                      ...clashApi,
                      access_control_allow_private_network: event.target.checked,
                    })
                  }
                />
                <span>Allow private network</span>
              </label>

              <div className="inspector-section-title">V2Ray API</div>
              <label className="field">
                <span>Listen</span>
                <input
                  value={String(v2rayApi.listen ?? "")}
                  onChange={(event) => updateField(ref, "v2ray_api", { ...v2rayApi, listen: event.target.value })}
                />
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={Boolean(v2rayStats.enabled)}
                  onChange={(event) =>
                    updateField(ref, "v2ray_api", {
                      ...v2rayApi,
                      stats: { ...v2rayStats, enabled: event.target.checked },
                    })
                  }
                />
                <span>Enable stats</span>
              </label>
            </>
          );
        })()
      ) : null}

      {ref.kind === "inbound" ? (
        <>
          <label className="field">
            <span>Address</span>
            <input
              value={toList(entity.address)}
              onChange={(event) => updateField(ref, "address", fromList(event.target.value))}
            />
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.auto_route)}
              onChange={(event) => updateField(ref, "auto_route", event.target.checked)}
            />
            <span>Auto route</span>
          </label>
          {editableScalarFields(entity, inboundHandledFields).map(([field, value]) =>
            typeof value === "boolean" ? (
              <label className="toggle-row" key={field}>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(event) => updateField(ref, field, event.target.checked)}
                />
                <span>{labelForField(field)}</span>
              </label>
            ) : (
              <label className="field" key={field}>
                <span>{labelForField(field)}</span>
                <input
                  type={typeof value === "number" ? "number" : "text"}
                  value={String(value)}
                  onChange={(event) =>
                    updateField(ref, field, typeof value === "number" ? Number(event.target.value) : event.target.value)
                  }
                />
              </label>
            ),
          )}
        </>
      ) : null}

      {ref.kind === "outbound" ? (
        <>
          {tagValue ? (
            <>
              <div className="inspector-section-title">Connections</div>
              <div className="reference-card">
                <div>
                  <span>Route final</span>
                  <strong>{selectedOutboundReferences?.routeFinal ? "active" : "none"}</strong>
                </div>
                <div>
                  <span>Route rules</span>
                  <strong>{formatReferenceList(selectedOutboundReferences?.routeRules ?? [])}</strong>
                </div>
                <div>
                  <span>Selector groups</span>
                  <strong>{formatReferenceList(selectedOutboundReferences?.selectors ?? [])}</strong>
                </div>
                <div>
                  <span>URLTest groups</span>
                  <strong>{formatReferenceList(selectedOutboundReferences?.urltests ?? [])}</strong>
                </div>
                <div>
                  <span>DNS detours</span>
                  <strong>{formatReferenceList(selectedOutboundReferences?.dnsDetours ?? [])}</strong>
                </div>
                <div>
                  <span>Dial detours</span>
                  <strong>{formatReferenceList(selectedOutboundReferences?.outboundDetours ?? [])}</strong>
                </div>
              </div>
              <div className="inspector-action-grid">
                <button
                  type="button"
                  onClick={() => connectOutboundReference(tagValue, "route-final")}
                  disabled={Boolean(selectedOutboundReferences?.routeFinal)}
                >
                  Set Route final
                </button>
                <button type="button" onClick={() => connectOutboundReference(tagValue, "route-rule")}>
                  Add Route rule to this outbound
                </button>
                <button
                  type="button"
                  onClick={() => connectOutboundReference(tagValue, "selector-member", firstSelector?.tag)}
                  disabled={selectorGroups.length > 0 && !firstSelector}
                >
                  {firstSelector ? `Add to selector ${firstSelector.tag}` : selectorGroups.length ? "Already in every selector" : "Create selector + add"}
                </button>
                <button
                  type="button"
                  onClick={() => connectOutboundReference(tagValue, "urltest-member", firstUrltest?.tag)}
                  disabled={urltestGroups.length > 0 && !firstUrltest}
                >
                  {firstUrltest ? `Add to URLTest ${firstUrltest.tag}` : urltestGroups.length ? "Already in every URLTest" : "Create URLTest + add"}
                </button>
                <button
                  type="button"
                  onClick={() => connectOutboundReference(tagValue, "dns-detour")}
                  disabled={Boolean(selectedOutboundReferences?.dnsDetours.length)}
                >
                  Use for DNS server detour
                </button>
              </div>
              {supportsDialDetour(entityType) ? (
                <label className="field">
                  <span>Dial Detour</span>
                  <select
                    value={String(entity.detour ?? "")}
                    onChange={(event) => updateField(ref, "detour", event.target.value || undefined)}
                  >
                    <option value="">None</option>
                    {outboundTags(config, tagValue).map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {entityType === "selector" || entityType === "urltest" ? (
                <>
                  <div className="inspector-section-title">Downstream Candidates</div>
                  <div className="inspector-action-grid inspector-action-grid--compact">
                    <button type="button" onClick={() => createCompatible(`outbound:${tagValue}`, "SOCKS")}>
                      Add SOCKS candidate
                    </button>
                    <button type="button" onClick={() => createCompatible(`outbound:${tagValue}`, "Direct")}>
                      Add Direct candidate
                    </button>
                    <button type="button" onClick={() => createCompatible(`outbound:${tagValue}`, "Block")}>
                      Add Block candidate
                    </button>
                  </div>
                </>
              ) : null}
            </>
          ) : null}
          {"server" in entity ? (
            <label className="field">
              <span>Server</span>
              <input
                value={String(entity.server ?? "")}
                onChange={(event) => updateField(ref, "server", event.target.value)}
              />
            </label>
          ) : null}
          {"server_port" in entity ? (
            <label className="field">
              <span>Port</span>
              <input
                type="number"
                value={Number(entity.server_port ?? 0)}
                onChange={(event) => updateField(ref, "server_port", Number(event.target.value))}
              />
            </label>
          ) : null}
          {"outbounds" in entity ? (
            <label className="field">
              <span>Candidates</span>
              <input
                value={toList(entity.outbounds)}
                onChange={(event) => updateField(ref, "outbounds", fromList(event.target.value))}
              />
            </label>
          ) : null}
          {"default" in entity ? (
            <label className="field">
              <span>Default</span>
              <input
                value={String(entity.default ?? "")}
                onChange={(event) => updateField(ref, "default", event.target.value || undefined)}
              />
            </label>
          ) : null}
          {editableScalarFields(entity, outboundHandledFields).map(([field, value]) =>
            typeof value === "boolean" ? (
              <label className="toggle-row" key={field}>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(event) => updateField(ref, field, event.target.checked)}
                />
                <span>{labelForField(field)}</span>
              </label>
            ) : (
              <label className="field" key={field}>
                <span>{labelForField(field)}</span>
                <input
                  type={typeof value === "number" ? "number" : "text"}
                  value={String(value)}
                  onChange={(event) =>
                    updateField(ref, field, typeof value === "number" ? Number(event.target.value) : event.target.value)
                  }
                />
              </label>
            ),
          )}
        </>
      ) : null}

      {ref.kind === "dns-server" ? (
        <>
          {"address" in entity ? (
            <label className="field">
              <span>Address</span>
              <input
                value={String(entity.address ?? "")}
                onChange={(event) => updateField(ref, "address", event.target.value)}
              />
            </label>
          ) : null}
          {"server" in entity ? (
            <label className="field">
              <span>Server</span>
              <input
                value={String(entity.server ?? "")}
                onChange={(event) => updateField(ref, "server", event.target.value)}
              />
            </label>
          ) : null}
          {"server_port" in entity ? (
            <label className="field">
              <span>Port</span>
              <input
                type="number"
                value={Number(entity.server_port ?? 0)}
                onChange={(event) => updateField(ref, "server_port", Number(event.target.value))}
              />
            </label>
          ) : null}
          {"path" in entity ? (
            <label className="field">
              <span>Path</span>
              <input
                value={String(entity.path ?? "")}
                onChange={(event) => updateField(ref, "path", event.target.value)}
              />
            </label>
          ) : null}
          <label className="field">
            <span>Detour</span>
            <input
              value={String(entity.detour ?? "")}
              onChange={(event) => updateField(ref, "detour", event.target.value || undefined)}
            />
          </label>
          {editableScalarFields(entity, dnsServerHandledFields).map(([field, value]) =>
            typeof value === "boolean" ? (
              <label className="toggle-row" key={field}>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(event) => updateField(ref, field, event.target.checked)}
                />
                <span>{labelForField(field)}</span>
              </label>
            ) : (
              <label className="field" key={field}>
                <span>{labelForField(field)}</span>
                <input
                  type={typeof value === "number" ? "number" : "text"}
                  value={String(value)}
                  onChange={(event) =>
                    updateField(ref, field, typeof value === "number" ? Number(event.target.value) : event.target.value)
                  }
                />
              </label>
            ),
          )}
        </>
      ) : null}

      <InspectorPanels />
    </aside>
  );
}
