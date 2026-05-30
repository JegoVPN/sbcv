import type { EntityRef } from "../../domain/types";
import { isSensitiveFieldName, JsonField, SensitiveTextField } from "./controls";
import { editableNonScalarFields, editableScalarFields, type InspectorEntity, labelForField, parseOptionalNumber, type UpdateField } from "./helpers";

// C14 — the Advanced JSON fallback renderers extracted from the Inspector monolith. Any entity field NOT
// claimed by a structured control (i.e. not in the kind's handledFields) renders here as an editable
// scalar (sensitive fields masked) or a JSON sub-editor — guaranteeing no field is silently unreachable.

export function AdvancedScalarFields({
  entity,
  handledFields,
  entityRef,
  updateField,
}: {
  entity: InspectorEntity;
  handledFields: ReadonlySet<string>;
  entityRef: EntityRef;
  updateField: UpdateField;
}) {
  const fields = editableScalarFields(entity, handledFields);
  if (!fields.length) return null;
  return (
    <details className="advanced-fields">
      <summary>Advanced fields <span>{fields.length}</span></summary>
      <div className="advanced-fields__body">
        {fields.map(([field, value]) => {
          if (typeof value === "boolean") {
            return (
              <label className="toggle-row" key={field}>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(event) => updateField(entityRef, field, event.target.checked)}
                />
                <span>{labelForField(field)}</span>
              </label>
            );
          }
          if (typeof value === "string" && isSensitiveFieldName(field)) {
            return (
              <SensitiveTextField
                key={field}
                label={labelForField(field)}
                value={value}
                onChange={(next) => updateField(entityRef, field, next)}
              />
            );
          }
          return (
            <label className="field" key={field}>
              <span>{labelForField(field)}</span>
              <input
                type={typeof value === "number" ? "number" : "text"}
                value={String(value)}
                onChange={(event) =>
                  updateField(
                    entityRef,
                    field,
                    typeof value === "number" ? parseOptionalNumber(event.target.value) : event.target.value,
                  )
                }
              />
            </label>
          );
        })}
      </div>
    </details>
  );
}

export function AdvancedNonScalarFields({
  entity,
  handledFields,
  entityRef,
  updateField,
}: {
  entity: InspectorEntity;
  handledFields: ReadonlySet<string>;
  entityRef: EntityRef;
  updateField: UpdateField;
}) {
  const fields = editableNonScalarFields(entity, handledFields);
  if (!fields.length) return null;
  const refKey = JSON.stringify(entityRef);
  return (
    <details className="advanced-fields advanced-fields--non-scalar">
      <summary>Advanced JSON fields <span>{fields.length}</span></summary>
      <div className="advanced-fields__body">
        {fields.map(([field, value]) => (
          <JsonField
            key={`${refKey}:${field}`}
            label={labelForField(field)}
            value={value}
            onChange={(next) => updateField(entityRef, field, next)}
          />
        ))}
      </div>
    </details>
  );
}
