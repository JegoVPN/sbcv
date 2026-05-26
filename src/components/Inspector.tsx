import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import type { EntityRef } from "../domain/types";
import { useProjectStore } from "../state/useProjectStore";

type InspectorEntity = Record<string, unknown>;

function selectedRefFromId(id: string | null): EntityRef | null {
  if (!id) return null;
  const [kind, value] = id.split(":");
  if (kind === "inbound" && value) return { kind: "inbound", tag: value };
  if (kind === "outbound" && value) return { kind: "outbound", tag: value };
  if (kind === "dns-server" && value) return { kind: "dns-server", tag: value };
  if (kind === "route") return { kind: "route", id: "main" };
  if (kind === "dns") return { kind: "dns", id: "main" };
  if (kind === "route-rule" && value) return { kind: "route-rule", index: Number(value) };
  if (kind === "dns-rule" && value) return { kind: "dns-rule", index: Number(value) };
  return null;
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

export function Inspector() {
  const selectedId = useProjectStore((state) => state.selectedId);
  const config = useProjectStore((state) => state.config);
  const updateField = useProjectStore((state) => state.updateField);
  const renameTag = useProjectStore((state) => state.renameTag);
  const deleteEntity = useProjectStore((state) => state.deleteEntity);
  const setPanelTab = useProjectStore((state) => state.setPanelTab);
  const ref = useMemo(() => selectedRefFromId(selectedId), [selectedId]);
  const entity = useMemo<InspectorEntity | null>(() => {
    if (!ref) return null;
    if (ref.kind === "inbound") return (config.inbounds?.find((item) => item.tag === ref.tag) as InspectorEntity | undefined) ?? null;
    if (ref.kind === "outbound") return (config.outbounds?.find((item) => item.tag === ref.tag) as InspectorEntity | undefined) ?? null;
    if (ref.kind === "dns-server") {
      return (config.dns?.servers?.find((item) => item.tag === ref.tag) as InspectorEntity | undefined) ?? null;
    }
    if (ref.kind === "route") return (config.route as InspectorEntity | undefined) ?? null;
    if (ref.kind === "dns") return (config.dns as InspectorEntity | undefined) ?? null;
    if (ref.kind === "route-rule") return (config.route?.rules?.[ref.index] as InspectorEntity | undefined) ?? null;
    if (ref.kind === "dns-rule") return (config.dns?.rules?.[ref.index] as InspectorEntity | undefined) ?? null;
    return null;
  }, [config, ref]);
  const [tagDraft, setTagDraft] = useState("");

  useEffect(() => {
    if (entity && "tag" in entity && typeof entity.tag === "string") setTagDraft(entity.tag);
    else setTagDraft("");
  }, [entity]);

  if (!ref || !entity) {
    return (
      <aside className="inspector">
        <div className="panel-title">Inspector</div>
        <div className="empty-state">Select a node to edit its canonical sing-box entity.</div>
      </aside>
    );
  }

  const tagValue = typeof entity.tag === "string" ? entity.tag : null;
  const entityType = typeof entity.type === "string" ? entity.type : null;

  return (
    <aside className="inspector" aria-label="Node inspector">
      <div className="panel-title">Inspector</div>
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

      {ref.kind === "route" ? (
        <button type="button" className="wide-action" onClick={() => setPanelTab("rules")}>
          Edit ordered route rules
        </button>
      ) : null}

      {ref.kind === "dns" ? (
        <button type="button" className="wide-action" onClick={() => setPanelTab("dns")}>
          Edit ordered DNS rules
        </button>
      ) : null}

      {ref.kind === "route-rule" || ref.kind === "dns-rule" ? (
        <button
          type="button"
          className="wide-action"
          onClick={() => setPanelTab(ref.kind === "route-rule" ? "rules" : "dns")}
        >
          Open ordered table
        </button>
      ) : null}
    </aside>
  );
}
