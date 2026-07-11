import type { EntityRef } from "../../domain/types";
import { AdvancedNonScalarFields, AdvancedScalarFields } from "./advancedFields";
import { PlatformBanner } from "./controls";
import type { InspectorEntity, UpdateField } from "./helpers";

const NETWORK_NAMESPACE_HANDLED_FIELDS = new Set(["tag", "type", "path", "pid_file"]);

export function NetworkNamespaceInspector({
  entity,
  entityRef,
  entityType,
  updateField,
}: {
  entity: InspectorEntity;
  entityRef: Extract<EntityRef, { kind: "network-namespace" }>;
  entityType: string;
  updateField: UpdateField;
}) {
  return (
    <>
      <PlatformBanner kind="platform" text="Network namespaces are supported on Linux only." />

      {entityType === "default" ? (
        <label className="field">
          <span>Path (required)</span>
          <input
            value={typeof entity.path === "string" ? entity.path : ""}
            placeholder="name or /run/netns/name"
            onChange={(event) => updateField(entityRef, "path", event.target.value || undefined)}
          />
        </label>
      ) : null}

      {entityType === "unshare" ? (
        <>
          <label className="field">
            <span>PID File</span>
            <input
              value={typeof entity.pid_file === "string" ? entity.pid_file : ""}
              placeholder="optional path"
              onChange={(event) => updateField(entityRef, "pid_file", event.target.value || undefined)}
            />
          </label>
          <p className="field__hint">Rootless creation requires unprivileged user namespaces to be enabled.</p>
        </>
      ) : null}

      <AdvancedScalarFields
        entity={entity}
        handledFields={NETWORK_NAMESPACE_HANDLED_FIELDS}
        entityRef={entityRef}
        updateField={updateField}
      />
      <AdvancedNonScalarFields
        entity={entity}
        handledFields={NETWORK_NAMESPACE_HANDLED_FIELDS}
        entityRef={entityRef}
        updateField={updateField}
      />
    </>
  );
}
