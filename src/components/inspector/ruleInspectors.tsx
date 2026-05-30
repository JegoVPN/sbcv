import { dnsRuleAllowsServer, routeRuleAllowsOutbound } from "../../domain/commands";
import type { SingBoxChannel, SingBoxConfig } from "../../domain/types";
import { AdvancedNonScalarFields, AdvancedScalarFields } from "./advancedFields";
import type { InspectorEntity } from "./helpers";
import {
  dnsRuleAdvancedFields,
  dnsRulePrimaryFields,
  InlineRuleSetEditor,
  RuleAdvancedFields,
  RuleListField,
  routeRuleAdvancedFields,
  routeRulePrimaryFields,
  SharedRuleFields,
} from "./ruleControls";

// C14 — the two rule inspectors (route + DNS) extracted from the Inspector monolith. They compose the
// shared rule controls from ./ruleControls and the action gates from domain/commands. Behaviour-frozen
// move; the green suite is the preservation gate. Both are rendered by the Inspector shell's
// route-rule / dns-rule branches.

export function RouteRuleInspector({
  index,
  rule,
  config,
  updateRouteRule,
}: {
  index: number;
  rule: InspectorEntity;
  config: SingBoxConfig;
  updateRouteRule: (index: number, patch: Record<string, unknown>) => void;
}) {
  const isLogical = rule.type === "logical";
  const patch = (next: Record<string, unknown>) => updateRouteRule(index, next);

  return (
    <div className="rule-inspector" aria-label={`Route rule ${index + 1} inspector`}>
      <label className="field">
        <span>Rule Type</span>
        <select
          value={isLogical ? "logical" : "default"}
          onChange={(event) =>
            patch(
              event.target.value === "logical"
                ? { type: "logical", mode: String(rule.mode ?? "and"), rules: Array.isArray(rule.rules) ? rule.rules : [] }
                : { type: undefined, mode: undefined, rules: undefined },
            )
          }
        >
          <option value="default">Default match</option>
          <option value="logical">Logical group</option>
        </select>
      </label>

      {isLogical ? (
        <>
          <label className="field">
            <span>Mode</span>
            <select value={String(rule.mode ?? "and")} onChange={(event) => patch({ mode: event.target.value })}>
              <option value="and">and</option>
              <option value="or">or</option>
            </select>
          </label>
          <InlineRuleSetEditor key={`logical-rules-${index}`} value={rule.rules} onChange={(value) => patch({ rules: value })} />
        </>
      ) : (
        <>
          <div className="inspector-section-title">Match</div>
          <RuleListField label="Inbound tags" value={rule.inbound} onChange={(value) => patch({ inbound: value })} />
          <RuleListField label="Domain suffix" value={rule.domain_suffix} onChange={(value) => patch({ domain_suffix: value })} />
          <RuleListField label="Domain keyword" value={rule.domain_keyword} onChange={(value) => patch({ domain_keyword: value })} />
          <RuleListField label="Domain" value={rule.domain} onChange={(value) => patch({ domain: value })} />
          <RuleListField label="Domain regex" value={rule.domain_regex} onChange={(value) => patch({ domain_regex: value })} />
          <RuleListField label="Match rule-set" value={rule.rule_set} onChange={(value) => patch({ rule_set: value })} />
        </>
      )}

      <div className="inspector-section-title">Action</div>
      <label className="field">
        <span>Action</span>
        <select
          value={String(rule.action ?? "route")}
          onChange={(event) => {
            const nextAction = event.target.value;
            const cleared: Record<string, unknown> = { action: nextAction };
            if (nextAction !== "route" && nextAction !== "bypass" && rule.outbound !== undefined) {
              cleared.outbound = undefined;
            }
            patch(cleared);
          }}
        >
          <option value="route">route</option>
          <option value="bypass">bypass</option>
          <option value="reject">reject</option>
          <option value="hijack-dns">hijack-dns</option>
          <option value="route-options">route-options</option>
          <option value="sniff">sniff</option>
          <option value="resolve">resolve</option>
        </select>
      </label>
      {routeRuleAllowsOutbound(rule) ? (
        <label className="field">
          <span>Outbound</span>
          <select value={String(rule.outbound ?? "")} onChange={(event) => patch({ outbound: event.target.value || undefined })}>
            <option value="">None</option>
            {/* R4: route rules may target an endpoint as well as an outbound — offer both. */}
            {[...(config.outbounds ?? []), ...(config.endpoints ?? [])].map((target, targetIndex) => (
              <option key={`${target.tag ?? "untagged"}-${targetIndex}`} value={target.tag ?? ""}>
                {target.tag ?? `untagged-${targetIndex + 1}`}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {String(rule.action) === "reject" ? (
        <>
          <label className="field">
            <span>Reject Method</span>
            <select value={String(rule.method ?? "default")} onChange={(event) => patch({ method: event.target.value === "default" ? undefined : event.target.value })}>
              <option value="default">default</option>
              <option value="drop">drop</option>
            </select>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={Boolean(rule.no_drop)} onChange={(event) => patch({ no_drop: event.target.checked || undefined })} />
            <span>No drop (else method falls back to drop after 50 hits in 30s)</span>
          </label>
        </>
      ) : null}
      {String(rule.action) === "sniff" ? (
        <>
          <RuleListField label="Sniffer" value={rule.sniffer} onChange={(value) => patch({ sniffer: value })} />
          <label className="field">
            <span>Sniff Timeout</span>
            <input type="text" value={String(rule.timeout ?? "")} onChange={(event) => patch({ timeout: event.target.value || undefined })} placeholder="300ms" />
          </label>
        </>
      ) : null}
      {String(rule.action) === "resolve" ? (
        <>
          <label className="field">
            <span>Resolve Server</span>
            <select value={String(rule.server ?? "")} onChange={(event) => patch({ server: event.target.value || undefined })}>
              <option value="">(default)</option>
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
            <span>Resolve Strategy</span>
            <select value={String(rule.strategy ?? "")} onChange={(event) => patch({ strategy: event.target.value || undefined })}>
              <option value="">(default)</option>
              <option value="prefer_ipv4">prefer_ipv4</option>
              <option value="prefer_ipv6">prefer_ipv6</option>
              <option value="ipv4_only">ipv4_only</option>
              <option value="ipv6_only">ipv6_only</option>
            </select>
          </label>
        </>
      ) : null}
      {["route", "route-options", "bypass"].includes(String(rule.action ?? "route")) ? (
        <fieldset className="field field--checklist" data-testid="route-rule-route-options">
          <legend>Route options</legend>
          <label className="field">
            <span>Override Address</span>
            <input
              value={typeof rule.override_address === "string" ? rule.override_address : ""}
              placeholder="e.g. 1.1.1.1 (replaces destination IP)"
              onChange={(event) => patch({ override_address: event.target.value || undefined })}
            />
          </label>
          <label className="field">
            <span>Override Port</span>
            <input
              type="number"
              value={typeof rule.override_port === "number" ? rule.override_port : ""}
              placeholder="e.g. 443"
              onChange={(event) => {
                const next = event.target.value;
                if (!next) return patch({ override_port: undefined });
                const parsed = Number(next);
                patch({ override_port: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined });
              }}
            />
          </label>
          <label className="field">
            <span>Network Strategy</span>
            <select
              value={typeof rule.network_strategy === "string" ? rule.network_strategy : ""}
              onChange={(event) => patch({ network_strategy: event.target.value || undefined })}
            >
              <option value="">(unset)</option>
              {/* network_strategy accepts only default/hybrid/fallback; wifi/cellular/ethernet are
                  network_type values (shared/dial.md). (L2-fix-route-strategy, audit H2) */}
              <option value="default">default</option>
              <option value="hybrid">hybrid</option>
              <option value="fallback">fallback</option>
            </select>
          </label>
          <label className="field">
            <span>Fallback Delay</span>
            <input
              value={typeof rule.fallback_delay === "string" ? rule.fallback_delay : ""}
              placeholder="e.g. 300ms"
              onChange={(event) => patch({ fallback_delay: event.target.value || undefined })}
            />
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(rule.udp_disable_domain_unmapping)}
              onChange={(event) =>
                patch({ udp_disable_domain_unmapping: event.target.checked || undefined })
              }
            />
            <span>UDP disable domain unmapping</span>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(rule.tls_fragment)}
              onChange={(event) => patch({ tls_fragment: event.target.checked || undefined })}
            />
            <span>TLS fragment</span>
          </label>
        </fieldset>
      ) : null}
      <label className="toggle-row">
        <input type="checkbox" checked={Boolean(rule.invert)} onChange={(event) => patch({ invert: event.target.checked || undefined })} />
        <span>Invert match</span>
      </label>

      {!isLogical ? <SharedRuleFields rule={rule} onPatch={patch} /> : null}
      {!isLogical ? <RuleAdvancedFields fields={routeRuleAdvancedFields} rule={rule} onPatch={patch} /> : null}
      <AdvancedScalarFields entity={rule} handledFields={routeRulePrimaryFields} entityRef={{ kind: "route-rule", index }} updateField={(_, field, value) => patch({ [field]: value })} />
      <AdvancedNonScalarFields entity={rule} handledFields={routeRulePrimaryFields} entityRef={{ kind: "route-rule", index }} updateField={(_, field, value) => patch({ [field]: value })} />
    </div>
  );
}

export function DnsRuleInspector({
  index,
  rule,
  config,
  channel,
  updateDnsRule,
}: {
  index: number;
  rule: InspectorEntity;
  config: SingBoxConfig;
  channel: SingBoxChannel;
  updateDnsRule: (index: number, patch: Record<string, unknown>) => void;
}) {
  const isLogical = rule.type === "logical";
  const patch = (next: Record<string, unknown>) => updateDnsRule(index, next);

  return (
    <div className="rule-inspector" aria-label={`DNS rule ${index + 1} inspector`}>
      <label className="field">
        <span>Rule Type</span>
        <select
          value={isLogical ? "logical" : "default"}
          onChange={(event) =>
            patch(
              event.target.value === "logical"
                ? { type: "logical", mode: String(rule.mode ?? "and"), rules: Array.isArray(rule.rules) ? rule.rules : [] }
                : { type: undefined, mode: undefined, rules: undefined },
            )
          }
        >
          <option value="default">Default match</option>
          <option value="logical">Logical group</option>
        </select>
      </label>

      {isLogical ? (
        <>
          <label className="field">
            <span>Mode</span>
            <select value={String(rule.mode ?? "and")} onChange={(event) => patch({ mode: event.target.value })}>
              <option value="and">and</option>
              <option value="or">or</option>
            </select>
          </label>
          <InlineRuleSetEditor key={`logical-rules-${index}`} value={rule.rules} onChange={(value) => patch({ rules: value })} />
        </>
      ) : (
        <>
          <div className="inspector-section-title">Match</div>
          <RuleListField label="Inbound tags" value={rule.inbound} onChange={(value) => patch({ inbound: value })} />
          <RuleListField label="Query type" value={rule.query_type} onChange={(value) => patch({ query_type: value })} />
          <RuleListField label="Domain suffix" value={rule.domain_suffix} onChange={(value) => patch({ domain_suffix: value })} />
          <RuleListField label="Domain keyword" value={rule.domain_keyword} onChange={(value) => patch({ domain_keyword: value })} />
          <RuleListField label="Domain" value={rule.domain} onChange={(value) => patch({ domain: value })} />
          <RuleListField label="Domain regex" value={rule.domain_regex} onChange={(value) => patch({ domain_regex: value })} />
          <RuleListField label="Match rule-set" value={rule.rule_set} onChange={(value) => patch({ rule_set: value })} />
        </>
      )}

      <div className="inspector-section-title">Action</div>
      <label className="field">
        <span>Action</span>
        <select
          value={String(rule.action ?? "route")}
          onChange={(event) => {
            const nextAction = event.target.value;
            const cleared: Record<string, unknown> = { action: nextAction };
            // route and evaluate both require `server` (dns/rule_action.md); only scrub it when the
            // next action bears no server. Single source of truth via the domain helper.
            if (!dnsRuleAllowsServer({ action: nextAction }) && rule.server !== undefined) {
              cleared.server = undefined;
            }
            patch(cleared);
          }}
        >
          <option value="route">route</option>
          {/* evaluate / respond are 1.14-only actions (dns/rule_action.md) — offer them on the testing
              channel only, but keep an already-set value selectable so the control still displays it. */}
          {channel === "testing" || rule.action === "evaluate" ? <option value="evaluate">evaluate</option> : null}
          {channel === "testing" || rule.action === "respond" ? <option value="respond">respond</option> : null}
          <option value="route-options">route-options</option>
          <option value="reject">reject</option>
          <option value="predefined">predefined</option>
        </select>
      </label>
      {/* hint sits outside the label so it doesn't pollute the select's accessible name */}
      {rule.action === "evaluate" ? (
        <small className="shared-field-hint">
          evaluate (1.14+): queries a server and saves the response for later rules; allowed on top-level rules only, and does not terminate rule evaluation.
        </small>
      ) : rule.action === "respond" ? (
        <small className="shared-field-hint">
          respond (1.14+): returns the response from a preceding top-level evaluate; sends no query, and errors if there is no evaluated response.
        </small>
      ) : null}
      {dnsRuleAllowsServer(rule) ? (
        <label className="field">
          <span>Server</span>
          <select value={String(rule.server ?? "")} onChange={(event) => patch({ server: event.target.value || undefined })}>
            <option value="">(default)</option>
            {(config.dns?.servers ?? []).map((server, serverIndex) => (
              <option key={`${server.tag ?? "untagged"}-${serverIndex}`} value={server.tag ?? ""}>
                {server.tag ?? `untagged-${serverIndex + 1}`}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {String(rule.action) === "reject" ? (
        <>
          <label className="field">
            <span>Reject Method</span>
            <select value={String(rule.method ?? "default")} onChange={(event) => patch({ method: event.target.value === "default" ? undefined : event.target.value })}>
              <option value="default">default</option>
              <option value="drop">drop</option>
            </select>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={Boolean(rule.no_drop)} onChange={(event) => patch({ no_drop: event.target.checked || undefined })} />
            <span>No drop (else method falls back to drop after 50 hits in 30s)</span>
          </label>
        </>
      ) : null}
      {String(rule.action) === "predefined" ? (
        <label className="field">
          <span>Predefined RCODE</span>
          <select value={String(rule.rcode ?? "NOERROR")} onChange={(event) => patch({ rcode: event.target.value === "NOERROR" ? undefined : event.target.value })}>
            <option value="NOERROR">NOERROR</option>
            <option value="FORMERR">FORMERR</option>
            <option value="SERVFAIL">SERVFAIL</option>
            <option value="NXDOMAIN">NXDOMAIN</option>
            <option value="NOTIMP">NOTIMP</option>
            <option value="REFUSED">REFUSED</option>
          </select>
        </label>
      ) : null}
      <label className="toggle-row">
        <input type="checkbox" checked={Boolean(rule.invert)} onChange={(event) => patch({ invert: event.target.checked || undefined })} />
        <span>Invert match</span>
      </label>

      {!isLogical ? <SharedRuleFields rule={rule} onPatch={patch} /> : null}
      {!isLogical ? <RuleAdvancedFields fields={dnsRuleAdvancedFields} rule={rule} onPatch={patch} /> : null}
      <AdvancedScalarFields entity={rule} handledFields={dnsRulePrimaryFields} entityRef={{ kind: "dns-rule", index }} updateField={(_, field, value) => patch({ [field]: value })} />
      <AdvancedNonScalarFields entity={rule} handledFields={dnsRulePrimaryFields} entityRef={{ kind: "dns-rule", index }} updateField={(_, field, value) => patch({ [field]: value })} />
    </div>
  );
}
