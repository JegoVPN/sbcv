import { useEffect, useMemo, useState } from "react";
import { Trash2, X } from "lucide-react";
import { getNodeIcon } from "../canvas/iconRegistry";
import type { EntityRef, SingBoxConfig } from "../domain/types";
import {
  CREATABLE_DNS_SERVER_TYPES,
  CREATABLE_ENDPOINT_TYPES,
  CREATABLE_INBOUND_TYPES,
  CREATABLE_OUTBOUND_TYPES,
  CREATABLE_RULE_SET_TYPES,
  CREATABLE_SERVICE_TYPES,
} from "../domain/protocols";
import { sharedGroupsForEntity } from "../domain/sharedFieldRegistry";
import { PlatformBanner } from "./inspector/controls";
import { DnsRuleInspector, RouteRuleInspector } from "./inspector/ruleInspectors";
import { SettingsInspector } from "./inspector/settingsInspector";
import { DnsInspector } from "./inspector/dnsInspector";
import { RouteInspector } from "./inspector/routeInspector";
import { InboundInspector } from "./inspector/inboundInspector";
import { OutboundInspector } from "./inspector/outboundInspector";
import { DnsServerInspector } from "./inspector/dnsServerInspector";
import { EndpointInspector } from "./inspector/endpointInspector";
import { ServiceInspector } from "./inspector/serviceInspector";
import { CertificateProviderInspector } from "./inspector/certificateProviderInspector";
import { RuleSetInspector } from "./inspector/ruleSetInspector";
import { SharedFieldCards } from "./inspector/sharedFields";
// Preserve the public API the C17 guard test imports from this module (moved to inspector/handledFields).
export { INLINE_RENDERED_KEYS, inboundHandledFields, outboundHandledFields, structurallyCoveredKeys } from "./inspector/handledFields";
import { endpointReferences, type InspectorEntity } from "./inspector/helpers";
import { useProjectStore } from "../state/useProjectStore";

// Preserve the public API: withUniqueBlankKey moved to inspector/helpers (C14) but is imported by tests
// from this module.
export { withUniqueBlankKey } from "./inspector/helpers";

function selectedRefFromId(id: string | null): EntityRef | null {
  if (!id) return null;
  const separator = id.indexOf(":");
  const kind = separator >= 0 ? id.slice(0, separator) : id;
  const value = separator >= 0 ? id.slice(separator + 1) : "";
  if (kind === "inbound" && value) return { kind: "inbound", tag: value };
  if (kind === "outbound" && value) return { kind: "outbound", tag: value };
  if (kind === "dns-server" && value) return { kind: "dns-server", tag: value };
  if (kind === "endpoint" && value) return { kind: "endpoint", tag: value };
  if (kind === "service" && value) return { kind: "service", tag: value };
  if (kind === "rule-set" && value) return { kind: "rule-set", tag: value };
  if (kind === "certificate-provider" && value) return { kind: "certificate-provider", tag: value };
  if (kind === "http-client" && value) return { kind: "http-client", tag: value };
  if (kind === "route") return { kind: "route", id: "main" };
  if (kind === "dns") return { kind: "dns", id: "main" };
  if (kind === "route-rule" && value) return { kind: "route-rule", index: Number(value) };
  if (kind === "dns-rule" && value) return { kind: "dns-rule", index: Number(value) };
  if (kind === "settings" && value) return { kind: "settings", path: value as keyof SingBoxConfig };
  return null;
}

function generatedIndex(value: string, kind: "inbound" | "outbound" | "dns-server" | "endpoint" | "service" | "rule-set" | "certificate-provider" | "http-client") {
  const prefix = `untagged-${kind}-`;
  if (!value.startsWith(prefix)) return -1;
  const index = Number(value.slice(prefix.length)) - 1;
  return Number.isInteger(index) && index >= 0 ? index : -1;
}

function findTaggedOrGenerated<T extends { tag?: string }>(
  items: T[] | undefined,
  tag: string,
  kind: "inbound" | "outbound" | "dns-server" | "endpoint" | "service" | "rule-set" | "certificate-provider" | "http-client",
) {
  const byTag = items?.find((item) => item.tag === tag);
  if (byTag) return byTag;
  const index = generatedIndex(tag, kind);
  return index >= 0 ? items?.[index] : undefined;
}

export function Inspector({ compact = false }: { compact?: boolean } = {}) {
  const selectedId = useProjectStore((state) => state.selectedId);
  const config = useProjectStore((state) => state.config);
  const channel = useProjectStore((state) => state.channel);
  const updateField = useProjectStore((state) => state.updateField);
  const updateRouteRule = useProjectStore((state) => state.updateRouteRule);
  const updateDnsRule = useProjectStore((state) => state.updateDnsRule);
  const changeEntityType = useProjectStore((state) => state.changeEntityType);
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
    if (ref.kind === "endpoint") return (findTaggedOrGenerated(config.endpoints, ref.tag, "endpoint") as InspectorEntity | undefined) ?? null;
    if (ref.kind === "service") return (findTaggedOrGenerated(config.services, ref.tag, "service") as InspectorEntity | undefined) ?? null;
    if (ref.kind === "rule-set") return (findTaggedOrGenerated(config.route?.rule_set, ref.tag, "rule-set") as InspectorEntity | undefined) ?? null;
    if (ref.kind === "certificate-provider") return (findTaggedOrGenerated(config.certificate_providers, ref.tag, "certificate-provider") as InspectorEntity | undefined) ?? null;
    if (ref.kind === "http-client") return (findTaggedOrGenerated(config.http_clients, ref.tag, "http-client") as InspectorEntity | undefined) ?? null;
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
  const [tagDraftFocused, setTagDraftFocused] = useState(false);
  const tagValue = typeof entity?.tag === "string" ? entity.tag : null;

  useEffect(() => {
    if (tagDraftFocused) return;
    setTagDraft(tagValue ?? "");
  }, [tagDraftFocused, tagValue]);

  if (!ref || !entity) return null;

  const entityType = typeof entity.type === "string" ? entity.type : null;
  const requestTypeChange = (nextType: string) => {
    if (!ref || nextType === entityType) return;
    // Confirm before a type change discards type-specific fields the new type won't keep (W7 / T3).
    // "Meaningful" = own fields with a non-empty value (ignore tag/type and empty scaffold defaults).
    const hasMeaningfulFields = Object.entries(entity as Record<string, unknown>).some(([key, value]) => {
      if (key === "tag" || key === "type" || value == null || value === "") return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
      return true;
    });
    // Leaving tailscale (endpoint) / resolved (service) scrubs references to this entity elsewhere.
    const scrubsRefs = (ref.kind === "endpoint" && nextType !== "tailscale") || (ref.kind === "service" && nextType !== "resolved");
    if (
      (hasMeaningfulFields || scrubsRefs) &&
      !window.confirm(
        `Change this ${ref.kind} to "${nextType}"? Fields specific to the current type are discarded${scrubsRefs ? ", and references to it elsewhere are removed" : ""}.`,
      )
    ) {
      return;
    }
    changeEntityType(ref, nextType);
  };
  // Settings entities carry no canonical `type`; deriveGraph uses the ref path (log/ntp/experimental)
  // as the node type, so match it here to keep the header icon consistent with the node card.
  const iconType = ref.kind === "settings" ? String(ref.path) : entityType ?? "";
  const InspectorIcon = getNodeIcon(ref.kind, iconType);
  const selectedEndpointReferences =
    ref.kind === "endpoint" && tagValue ? endpointReferences(config, tagValue) : null;
  const sharedGroups = sharedGroupsForEntity(ref, entityType, channel);

  return (
    <aside className={`inspector ${compact ? "inspector--compact" : ""}`} aria-label="Node inspector" data-testid="node-inspector">
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

      {ref.kind === "route" ? (
        <RouteInspector entity={entity} entityRef={ref} config={config} updateField={updateField} />
      ) : null}
      {ref.kind === "dns" ? (
        <DnsInspector entity={entity} entityRef={ref} config={config} channel={channel} updateField={updateField} />
      ) : null}
      {ref.kind === "route-rule" ? (
        <RouteRuleInspector index={ref.index} rule={entity} config={config} updateRouteRule={updateRouteRule} />
      ) : null}
      {ref.kind === "dns-rule" ? (
        <DnsRuleInspector index={ref.index} rule={entity} config={config} channel={channel} updateDnsRule={updateDnsRule} />
      ) : null}

      {tagValue ? (
        <label className="field">
          <span>Tag</span>
          <input
            value={tagDraft}
            onFocus={() => setTagDraftFocused(true)}
            onChange={(event) => setTagDraft(event.target.value)}
            onBlur={() => {
              setTagDraftFocused(false);
              // The Tag field only renders for taggable entities; narrow ref.kind to a ReferenceKind so
              // the rename is namespace-scoped (V10-S0 / M3).
              if (ref && "tag" in ref) renameTag(ref.kind, ref.tag, tagDraft);
            }}
          />
        </label>
      ) : null}

      {entityType ? (
        <label className="field">
          <span>Type</span>
          {ref.kind === "inbound" ? (
            <select value={entityType} onChange={(event) => requestTypeChange(event.target.value)}>
              {CREATABLE_INBOUND_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          ) : ref.kind === "outbound" ? (
            <select value={entityType} onChange={(event) => requestTypeChange(event.target.value)}>
              {CREATABLE_OUTBOUND_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          ) : ref.kind === "dns-server" ? (
            <select value={entityType} onChange={(event) => requestTypeChange(event.target.value)}>
              {CREATABLE_DNS_SERVER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          ) : ref.kind === "endpoint" ? (
            <select value={entityType} onChange={(event) => requestTypeChange(event.target.value)}>
              {CREATABLE_ENDPOINT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          ) : ref.kind === "service" ? (
            <select value={entityType} onChange={(event) => requestTypeChange(event.target.value)}>
              {CREATABLE_SERVICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          ) : ref.kind === "rule-set" ? (
            <select value={entityType} onChange={(event) => requestTypeChange(event.target.value)}>
              {CREATABLE_RULE_SET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          ) : (
            <input value={entityType} disabled />
          )}
        </label>
      ) : null}

      {ref.kind === "settings" ? (
        <SettingsInspector entity={entity} entityRef={ref} config={config} channel={channel} updateField={updateField} />
      ) : null}

      {ref.kind === "inbound" ? (
        <InboundInspector entity={entity} entityRef={ref} entityType={entityType} updateField={updateField} />
      ) : null}

      {ref.kind === "outbound" ? (
        <OutboundInspector entity={entity} entityRef={ref} config={config} entityType={entityType} tagValue={tagValue} updateField={updateField} />
      ) : null}

      {ref.kind === "dns-server" ? (
        <DnsServerInspector entity={entity} entityRef={ref} config={config} channel={channel} entityType={entityType} updateField={updateField} />
      ) : null}

      {ref.kind === "endpoint" ? (
        <EndpointInspector entity={entity} entityRef={ref} entityType={entityType} tagValue={tagValue} selectedEndpointReferences={selectedEndpointReferences} updateField={updateField} />
      ) : null}

      {ref.kind === "service" ? (
        <ServiceInspector entity={entity} entityRef={ref} config={config} channel={channel} entityType={entityType} updateField={updateField} />
      ) : null}

      {ref.kind === "rule-set" ? (
        <RuleSetInspector entity={entity} entityRef={ref} config={config} channel={channel} updateField={updateField} />
      ) : null}

      {ref.kind === "certificate-provider" ? (
        <CertificateProviderInspector entity={entity} entityRef={ref} config={config} entityType={entityType} updateField={updateField} />
      ) : null}

      {(() => {
        const tls = (entity as Record<string, unknown>).tls;
        if (!tls || typeof tls !== "object" || Array.isArray(tls)) return null;
        const acme = (tls as Record<string, unknown>).acme;
        if (!acme || typeof acme !== "object" || Array.isArray(acme)) return null;
        return (
          <PlatformBanner
            kind="deprecated"
            text="Inline tls.acme is deprecated since sing-box 1.14.0. Move the ACME options into tls.certificate_provider (type=acme) or a top-level certificate_providers[] entry. The current value still round-trips, but sing-box will reject it after the field is removed."
          />
        );
      })()}
      <SharedFieldCards
        groups={sharedGroups}
        entity={entity}
        entityRef={ref}
        entityType={entityType}
        config={config}
        channel={channel}
        updateField={updateField}
      />
    </aside>
  );
}
