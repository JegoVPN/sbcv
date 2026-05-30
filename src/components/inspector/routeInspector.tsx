import type { EntityRef, SingBoxConfig } from "../../domain/types";
import { type InspectorEntity, outboundTags, type UpdateField } from "./helpers";
import { RouteRulesTable } from "../RuleTables";

// C14 — the route (singleton) inspector extracted from the Inspector monolith. Behaviour-frozen move:
// rendered unchanged by the shell's `ref.kind === "route"` branch.

export function RouteInspector({
  entity,
  entityRef,
  config,
  updateField,
}: {
  entity: InspectorEntity;
  entityRef: EntityRef;
  config: SingBoxConfig;
  updateField: UpdateField;
}) {
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
          <RouteRulesTable />
        </>
  );
}
