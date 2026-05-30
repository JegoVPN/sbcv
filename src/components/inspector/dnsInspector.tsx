import type { EntityRef, SingBoxChannel, SingBoxConfig } from "../../domain/types";
import { PlatformBanner } from "./controls";
import { AdvancedNonScalarFields, AdvancedScalarFields } from "./advancedFields";
import { type InspectorEntity, objectField, parseOptionalNumber, type UpdateField } from "./helpers";
import { DnsRulesTable } from "../RuleTables";

// Keys the DNS hub already renders (here + the Rules table + servers as nodes), so the Advanced fallback
// surfaces only genuinely-unmodeled dns root keys (M2: no field silently unreachable on the dns singleton).
const dnsHandledFields: ReadonlySet<string> = new Set([
  "final",
  "strategy",
  "disable_cache",
  "disable_expire",
  "independent_cache",
  "cache_capacity",
  "reverse_mapping",
  "client_subnet",
  "fakeip",
  "optimistic",
  "timeout",
  "rules",
  "servers",
]);

// C14 — the dns (singleton) inspector extracted from the Inspector monolith. Behaviour-frozen move:
// rendered unchanged by the shell's `ref.kind === "dns"` branch.

export function DnsInspector({
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
          <label className="field">
            <span>Final DNS Server</span>
            <select
              value={typeof entity.final === "string" ? entity.final : ""}
              onChange={(event) => updateField(entityRef, "final", event.target.value || undefined)}
            >
              <option value="">First DNS server</option>
              {(config.dns?.servers ?? [])
                .map((server) => server.tag)
                .filter((tag): tag is string => Boolean(tag))
                .map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>Strategy</span>
            <select
              value={typeof entity.strategy === "string" ? entity.strategy : ""}
              onChange={(event) => updateField(entityRef, "strategy", event.target.value || undefined)}
            >
              <option value="">(default)</option>
              <option value="prefer_ipv4">prefer_ipv4</option>
              <option value="prefer_ipv6">prefer_ipv6</option>
              <option value="ipv4_only">ipv4_only</option>
              <option value="ipv6_only">ipv6_only</option>
            </select>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.disable_cache)}
              onChange={(event) => updateField(entityRef, "disable_cache", event.target.checked || undefined)}
            />
            <span>Disable cache</span>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.disable_expire)}
              onChange={(event) => updateField(entityRef, "disable_expire", event.target.checked || undefined)}
            />
            <span>Disable expire</span>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.independent_cache)}
              onChange={(event) =>
                updateField(entityRef, "independent_cache", event.target.checked || undefined)
              }
            />
            <span>Independent cache</span>
          </label>
          <label className="field">
            <span>Cache Capacity</span>
            <input
              type="number"
              value={typeof entity.cache_capacity === "number" ? entity.cache_capacity : ""}
              onChange={(event) => updateField(entityRef, "cache_capacity", parseOptionalNumber(event.target.value))}
            />
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(entity.reverse_mapping)}
              onChange={(event) => updateField(entityRef, "reverse_mapping", event.target.checked || undefined)}
            />
            <span>Reverse mapping</span>
          </label>
          <label className="field">
            <span>Client Subnet</span>
            <input
              type="text"
              value={typeof entity.client_subnet === "string" ? entity.client_subnet : ""}
              onChange={(event) => updateField(entityRef, "client_subnet", event.target.value || undefined)}
            />
          </label>
          {(() => {
            const fakeip = objectField(entity.fakeip);
            const writeFakeip = (next: InspectorEntity) =>
              updateField(entityRef, "fakeip", Object.keys(next).length ? next : undefined);
            return (
              <fieldset className="field field--checklist" data-testid="dns-hub-fakeip">
                <legend>FakeIP</legend>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={Boolean(fakeip.enabled)}
                    onChange={(event) => {
                      if (event.target.checked) writeFakeip({ ...fakeip, enabled: true });
                      else {
                        const { enabled: _e, ...rest } = fakeip as Record<string, unknown>;
                        writeFakeip(rest);
                      }
                    }}
                  />
                  <span>FakeIP enabled</span>
                </label>
                <label className="field">
                  <span>IPv4 Range</span>
                  <input
                    value={typeof fakeip.inet4_range === "string" ? fakeip.inet4_range : ""}
                    placeholder="198.18.0.0/15"
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) {
                        const { inet4_range: _v, ...rest } = fakeip as Record<string, unknown>;
                        writeFakeip(rest);
                      } else {
                        writeFakeip({ ...fakeip, inet4_range: value });
                      }
                    }}
                  />
                </label>
                <label className="field">
                  <span>IPv6 Range</span>
                  <input
                    value={typeof fakeip.inet6_range === "string" ? fakeip.inet6_range : ""}
                    placeholder="fc00::/18"
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) {
                        const { inet6_range: _v, ...rest } = fakeip as Record<string, unknown>;
                        writeFakeip(rest);
                      } else {
                        writeFakeip({ ...fakeip, inet6_range: value });
                      }
                    }}
                  />
                </label>
              </fieldset>
            );
          })()}
          <PlatformBanner
            kind="channel"
            text="The next two fields (Optimistic, Timeout) only take effect on sing-box 1.14+ (testing channel)."
          />
          <label className="toggle-row" data-testid="dns-hub-optimistic">
            <input
              type="checkbox"
              checked={Boolean(entity.optimistic)}
              onChange={(event) => updateField(entityRef, "optimistic", event.target.checked || undefined)}
            />
            <span>Optimistic (testing 1.14+)</span>
          </label>
          <label className="field" data-testid="dns-hub-timeout">
            <span>Timeout (testing 1.14+, e.g. "5s")</span>
            <input
              value={typeof entity.timeout === "string" ? entity.timeout : ""}
              placeholder="5s"
              onChange={(event) => updateField(entityRef, "timeout", event.target.value || undefined)}
            />
          </label>
          <AdvancedScalarFields entity={entity} handledFields={dnsHandledFields} entityRef={entityRef} updateField={updateField} />
          <AdvancedNonScalarFields entity={entity} handledFields={dnsHandledFields} entityRef={entityRef} updateField={updateField} />
          <DnsRulesTable />
        </>
  );
}
