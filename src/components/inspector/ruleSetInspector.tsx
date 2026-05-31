import type { EntityRef, SingBoxChannel, SingBoxConfig } from "../../domain/types";
import { AdvancedNonScalarFields, AdvancedScalarFields } from "./advancedFields";
import { PlatformBanner } from "./controls";
import { ruleSetHandledFields } from "./handledFields";
import { type InspectorEntity, outboundTags, type UpdateField } from "./helpers";
import { InlineRuleSetEditor } from "./ruleControls";

// C14 — the rule-set entity inspector extracted from the Inspector monolith. Behaviour-frozen move:
// rendered unchanged by the shell's `ref.kind === "rule-set"` branch.

export function RuleSetInspector({
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
          {entity.type === "remote" || entity.type === "local" ? (
            <label className="field">
              <span>Format</span>
              <select
                value={String(entity.format ?? "source")}
                onChange={(event) => updateField(entityRef, "format", event.target.value)}
              >
                <option value="source">source</option>
                <option value="binary">binary</option>
              </select>
            </label>
          ) : null}
          {entity.type === "remote" ? (
            <>
              <label className="field">
                <span>URL</span>
                <input
                  value={String(entity.url ?? "")}
                  onChange={(event) => updateField(entityRef, "url", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Update Interval</span>
                <input
                  value={String(entity.update_interval ?? "")}
                  onChange={(event) => updateField(entityRef, "update_interval", event.target.value || undefined)}
                />
              </label>
              {channel === "testing" && entity.download_detour ? (
                <PlatformBanner
                  kind="deprecated"
                  text="`download_detour` is deprecated in sing-box 1.14.0 (removed in 1.16.0). Use an HTTP Client (`http_client`) instead. Create one in the HTTP Client section below, then select it."
                />
              ) : null}
              <label className="field">
                <span>Download Detour</span>
                <select
                  value={String(entity.download_detour ?? "")}
                  onChange={(event) => updateField(entityRef, "download_detour", event.target.value || undefined)}
                >
                  <option value="">Default outbound</option>
                  {outboundTags(config).map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          {entity.type === "local" ? (
            <label className="field">
              <span>Path</span>
              <input
                value={String(entity.path ?? "")}
                onChange={(event) => updateField(entityRef, "path", event.target.value)}
              />
            </label>
          ) : null}
          {entity.type === "inline" ? (
            <InlineRuleSetEditor
              key={`${JSON.stringify(entityRef)}:inline-rules`}
              value={entity.rules}
              onChange={(value) => updateField(entityRef, "rules", value)}
            />
          ) : null}
          <AdvancedScalarFields entity={entity} handledFields={ruleSetHandledFields} entityRef={entityRef} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={ruleSetHandledFields} entityRef={entityRef} updateField={updateField} />
        </>
  );
}
