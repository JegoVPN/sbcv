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

const outboundHandledFields = new Set(["tag", "type", "server", "server_port", "outbounds", "default"]);

function labelForField(field: string) {
  return field
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function editableScalarFields(entity: InspectorEntity) {
  return Object.entries(entity).filter(([field, value]) => {
    if (outboundHandledFields.has(field)) return false;
    const valueType = typeof value;
    return valueType === "string" || valueType === "number" || valueType === "boolean";
  });
}

function summaryFor(ref: EntityRef, entity: InspectorEntity) {
  const lines = [
    `kind: ${ref.kind}`,
    typeof entity.type === "string" ? `type: ${entity.type}` : null,
    typeof entity.tag === "string" ? `tag: ${entity.tag}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function Inspector() {
  const selectedId = useProjectStore((state) => state.selectedId);
  const config = useProjectStore((state) => state.config);
  const updateField = useProjectStore((state) => state.updateField);
  const renameTag = useProjectStore((state) => state.renameTag);
  const deleteEntity = useProjectStore((state) => state.deleteEntity);
  const setSelectedId = useProjectStore((state) => state.setSelectedId);
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
        </>
      ) : null}

      {ref.kind === "outbound" ? (
        <>
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
          {editableScalarFields(entity).map(([field, value]) =>
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
        </>
      ) : null}

      <InspectorPanels />
    </aside>
  );
}
