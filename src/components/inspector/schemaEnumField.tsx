import { fieldMetaFor, type SchemaEntityKind, type SchemaEnumOption } from "../../domain/schemaRegistry";
import type { EntityRef } from "../../domain/types";
import { useProjectStore } from "../../state/useProjectStore";
import type { InspectorEntity, UpdateField } from "./helpers";

// V0 / M5: the data-driven enum <select>. It renders a (kind,type)'s enum field from its SchemaFieldMeta —
// the SAME registry metadata the V1 validator reads — so each protocol enum's value list is defined ONCE
// (closing the "field surface split into two parallel systems" architecture gap). Faithfully reproduces the
// hand-written selects it replaces: optgroups (SchemaEnumOption.group, in first-appearance order), per-option
// labels, a per-field empty-option label, numeric coercion (shadowtls `version`), and hides testing-only
// options (hysteria2 obfs `gecko`) on the stable channel.

// Presentation that a title-cased path leaf gets wrong (acronyms / nested leaf). Values stay in the registry.
const FIELD_LABEL_OVERRIDE: Record<string, string> = {
  quic_congestion_control: "QUIC Congestion Control",
  udp_relay_mode: "UDP Relay Mode",
  wildcard_sni: "Wildcard SNI",
  "obfs.type": "Obfuscation Type",
};
const FIELD_EMPTY_LABEL: Record<string, string> = {
  version: "(default — 1)",
  network: "(default — tcp + udp)",
  method: "(none)",
  flow: "(none)",
  security: "(auto)",
  wildcard_sni: "(off)",
  stack: "(default — mixed)",
  "obfs.type": "(none)",
};

function titleCase(segment: string): string {
  return segment
    .split("_")
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function valueAtPath(entity: InspectorEntity, path: string[]): unknown {
  let cursor: unknown = entity;
  for (const segment of path) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

// Write `value` (or clear) at a possibly-nested path, funnelling through updateField on the top-level key so
// the canonical-config mutation path is unchanged. A nested leaf rebuilds its parent object (preserving
// siblings) and drops the parent entirely when it becomes empty.
function writeAtPath(
  entity: InspectorEntity,
  path: string[],
  value: unknown,
  entityRef: EntityRef,
  updateField: UpdateField,
) {
  const [head, ...rest] = path;
  if (!head) return;
  if (rest.length === 0) {
    updateField(entityRef, head, value);
    return;
  }
  const asObject = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {});
  const root = asObject(entity[head]);
  let cursor = root;
  for (let index = 0; index < rest.length - 1; index += 1) {
    const segment = rest[index]!;
    cursor[segment] = asObject(cursor[segment]);
    cursor = cursor[segment] as Record<string, unknown>;
  }
  const leaf = rest[rest.length - 1]!;
  if (value === undefined) delete cursor[leaf];
  else cursor[leaf] = value;
  updateField(entityRef, head, Object.keys(root).length ? root : undefined);
}

type GroupedOptions = { group?: string; options: SchemaEnumOption[] };

function groupOptions(options: SchemaEnumOption[]): GroupedOptions[] {
  const groups: GroupedOptions[] = [];
  const byLabel = new Map<string, GroupedOptions>();
  for (const option of options) {
    const key = option.group ?? "";
    let bucket = byLabel.get(key);
    if (!bucket) {
      bucket = { group: option.group, options: [] };
      byLabel.set(key, bucket);
      groups.push(bucket);
    }
    bucket.options.push(option);
  }
  return groups;
}

export function SchemaEnumField({
  kind,
  type,
  field,
  entity,
  entityRef,
  updateField,
}: {
  kind: SchemaEntityKind;
  type: string;
  /** The enum field's path joined with ".", e.g. "network" or "obfs.type". */
  field: string;
  entity: InspectorEntity;
  entityRef: EntityRef;
  updateField: UpdateField;
}) {
  // Channel gates testing-only options (e.g. obfs `gecko`); read from the store so callers needn't thread it.
  const channel = useProjectStore((state) => state.channel);
  const meta = fieldMetaFor(kind, type).find((candidate) => candidate.path.join(".") === field);
  if (!meta?.enum) return null;

  const key = meta.path.join(".");
  const label = meta.label ?? FIELD_LABEL_OVERRIDE[key] ?? titleCase(meta.path[meta.path.length - 1]!);
  const emptyLabel = meta.emptyLabel ?? FIELD_EMPTY_LABEL[key] ?? "(default)";
  const numeric = meta.numeric === true;
  const raw = valueAtPath(entity, meta.path);
  const current = raw === undefined || raw === null ? "" : String(raw);
  // Hide options gated to the other channel (e.g. obfs `gecko` is testing-only); keep deprecated values
  // (still selectable for round-trip, like the hand-written legacy-cipher optgroup).
  const options = meta.enum.filter((option) => !(option.channel && option.channel !== channel));
  const grouped = groupOptions(options);

  const renderOption = (option: SchemaEnumOption) => (
    <option key={option.value} value={option.value}>
      {option.label ?? option.value}
    </option>
  );

  return (
    <label className="field">
      <span>{label}</span>
      <select
        value={current}
        onChange={(event) => {
          const next = event.target.value;
          writeAtPath(entity, meta.path, next === "" ? undefined : numeric ? Number(next) : next, entityRef, updateField);
        }}
      >
        <option value="">{emptyLabel}</option>
        {grouped.map((bucket) =>
          bucket.group ? (
            <optgroup key={bucket.group} label={bucket.group}>
              {bucket.options.map(renderOption)}
            </optgroup>
          ) : (
            bucket.options.map(renderOption)
          ),
        )}
      </select>
    </label>
  );
}
