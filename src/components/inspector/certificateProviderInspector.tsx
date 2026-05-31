import type { EntityRef, SingBoxChannel, SingBoxConfig } from "../../domain/types";
import { AdvancedNonScalarFields, AdvancedScalarFields } from "./advancedFields";
import { certificateProviderFields, isSharedFieldVisible, SharedFieldControl } from "./sharedFields";
import { certificateProviderHandledFields } from "./handledFields";
import { type InspectorEntity, type UpdateField } from "./helpers";

// C14 — the certificate-provider entity inspector extracted from the Inspector monolith.
// Behaviour-frozen move: rendered unchanged by the shell's `ref.kind === "certificate-provider"` branch.

export function CertificateProviderInspector({
  entity,
  entityRef,
  config,
  entityType,
  channel,
  updateField,
}: {
  entity: InspectorEntity;
  entityRef: EntityRef;
  config: SingBoxConfig;
  entityType: string | null;
  channel: SingBoxChannel;
  updateField: UpdateField;
}) {
  return (
        <>
          {certificateProviderFields(entityType, config, channel)
            .filter((definition) => isSharedFieldVisible(definition, entity))
            .map((definition) => (
            <SharedFieldControl
              key={definition.path.join(".")}
              definition={definition}
              entity={entity}
              entityRef={entityRef}
              updateField={updateField}
            />
          ))}
          <AdvancedScalarFields entity={entity} handledFields={certificateProviderHandledFields} entityRef={entityRef} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={certificateProviderHandledFields} entityRef={entityRef} updateField={updateField} />
        </>
  );
}
