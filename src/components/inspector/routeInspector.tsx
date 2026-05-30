import type { EntityRef, SingBoxChannel, SingBoxConfig } from "../../domain/types";
import { type InspectorEntity, outboundTags, type UpdateField } from "./helpers";
import { AdvancedNonScalarFields, AdvancedScalarFields } from "./advancedFields";
import { RouteRulesTable } from "../RuleTables";

// Keys the route node already renders (here + the shared Dial card + the Rules table + rule_set nodes),
// so the Advanced fallback below surfaces only genuinely-unmodeled route keys (M2: restore the
// "no field silently unreachable" invariant for the route singleton). default_http_client is rendered by
// the http-client shared group, which the shell adds to route ONLY on testing — so it is handled only
// there; on stable it falls through to the Advanced fallback (else an imported stable value is hidden).
function routeHandledFields(channel: SingBoxChannel): ReadonlySet<string> {
  const keys = [
    "final",
    "auto_detect_interface",
    "override_android_vpn",
    "default_interface",
    "default_mark",
    "find_process",
    "default_domain_resolver",
    "default_network_strategy",
    "default_network_type",
    "default_fallback_network_type",
    "rules",
    "rule_set",
  ];
  if (channel === "testing") keys.push("default_http_client");
  return new Set(keys);
}

// C14 — the route (singleton) inspector extracted from the Inspector monolith. Behaviour-frozen move:
// rendered unchanged by the shell's `ref.kind === "route"` branch.

export function RouteInspector({
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
  const handledFields = routeHandledFields(channel);
  return (
        <>
          <label className="field">
            <span>Final Outbound</span>
            <select
              value={typeof entity.final === "string" ? entity.final : ""}
              onChange={(event) => updateField(entityRef, "final", event.target.value || undefined)}
            >
              <option value="">First outbound</option>
              {outboundTags(config).map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.auto_detect_interface)}
              onChange={(event) =>
                updateField(entityRef, "auto_detect_interface", event.target.checked || undefined)
              }
            />
            <span>Auto detect interface</span>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.override_android_vpn)}
              onChange={(event) =>
                updateField(entityRef, "override_android_vpn", event.target.checked || undefined)
              }
            />
            <span>Override Android VPN</span>
          </label>
          <label className="field">
            <span>Default Interface</span>
            <input
              value={typeof entity.default_interface === "string" ? entity.default_interface : ""}
              placeholder="e.g. eth0 (Linux/macOS, requires permissions)"
              onChange={(event) =>
                updateField(entityRef, "default_interface", event.target.value || undefined)
              }
            />
          </label>
          <label className="field">
            <span>Default Routing Mark (Linux)</span>
            <input
              type="number"
              value={typeof entity.default_mark === "number" ? entity.default_mark : ""}
              placeholder="0..2147483647 (Linux fwmark)"
              onChange={(event) => {
                const next = event.target.value;
                if (!next) {
                  updateField(entityRef, "default_mark", undefined);
                  return;
                }
                const parsed = Number(next);
                updateField(entityRef, "default_mark", Number.isFinite(parsed) ? parsed : undefined);
              }}
            />
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.find_process)}
              onChange={(event) =>
                updateField(entityRef, "find_process", event.target.checked || undefined)
              }
            />
            <span>Find process (process matchers in rules)</span>
          </label>
          {/* default_network_strategy / default_network_type are rendered by the shared Dial group
              (string[] list), so no hardcoded duplicates here (W24). */}
          <AdvancedScalarFields entity={entity} handledFields={handledFields} entityRef={entityRef} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={handledFields} entityRef={entityRef} updateField={updateField} />
          <RouteRulesTable />
        </>
  );
}
