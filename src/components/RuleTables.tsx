import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { dnsRuleAllowsServer, routeRuleAllowsOutbound } from "../domain/commands";
import { isLogicalRule, ruleSummaryLine } from "../domain/ruleSummary";
import { useProjectStore } from "../state/useProjectStore";

const RULE_PAGE_SIZE = 100;

function listItems<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function listToText(value: string[] | string | undefined) {
  if (Array.isArray(value)) return value.join(", ");
  return typeof value === "string" ? value : "";
}

function textToList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function pageBounds(total: number, page: number) {
  const pageCount = Math.max(1, Math.ceil(total / RULE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * RULE_PAGE_SIZE;
  return {
    page: safePage,
    pageCount,
    start,
    end: Math.min(start + RULE_PAGE_SIZE, total),
  };
}

function RulePager({
  page,
  pageCount,
  start,
  end,
  total,
  setPage,
}: {
  page: number;
  pageCount: number;
  start: number;
  end: number;
  total: number;
  setPage: (page: number) => void;
}) {
  if (total <= RULE_PAGE_SIZE) return null;

  return (
    <div className="rule-pager" aria-label="Rule table pagination">
      <span>
        {start + 1}-{end} / {total}
      </span>
      <button type="button" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
        Prev
      </button>
      <button type="button" onClick={() => setPage(Math.min(pageCount - 1, page + 1))} disabled={page >= pageCount - 1}>
        Next
      </button>
    </div>
  );
}

export function RouteRulesTable() {
  const [routePage, setRoutePage] = useState(0);
  const { outbounds, endpoints, ruleSets, rules, addRouteRule, updateRouteRule, moveRouteRule, deleteRouteRule } = useProjectStore(
    useShallow((state) => ({
      outbounds: state.config.outbounds,
      endpoints: state.config.endpoints,
      ruleSets: state.config.route?.rule_set,
      rules: state.config.route?.rules,
      addRouteRule: state.addRouteRule,
      updateRouteRule: state.updateRouteRule,
      moveRouteRule: state.moveRouteRule,
      deleteRouteRule: state.deleteRouteRule,
    })),
  );
  // R4: route rules can target an endpoint as well as an outbound (sing-box outbound target semantics),
  // so the select offers both. Order: outbounds first, then endpoints.
  const routeOutbounds = [...listItems(outbounds), ...listItems(endpoints)];
  const routeRuleSets = listItems(ruleSets);
  const routeRules = listItems(rules);
  const routeBounds = pageBounds(routeRules.length, routePage);
  const visibleRules = routeRules.slice(routeBounds.start, routeBounds.end);

  return (
    <section className="table-panel" aria-label="Route rules">
      <div className="table-panel__header">
        <div>
          <h2>Route Rules</h2>
          <p>Ordered first-match routing rules. Canvas edges only visualize these references.</p>
        </div>
        <button type="button" onClick={addRouteRule}>
          <Plus size={15} /> Rule
        </button>
      </div>
      <RulePager {...routeBounds} total={routeRules.length} setPage={setRoutePage} />
      <div className="rule-list">
        {visibleRules.map((rule, index) => {
          const ruleIndex = routeBounds.start + index;
          return (
            <article className="rule-card" key={`${ruleIndex}-${rule.outbound ?? "none"}`}>
              <div className="rule-card__header">
                <span>Rule {ruleIndex + 1}</span>
                <div className="row-actions">
                  <button type="button" aria-label={`Move route rule ${ruleIndex + 1} up`} onClick={() => moveRouteRule(ruleIndex, -1)}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" aria-label={`Move route rule ${ruleIndex + 1} down`} onClick={() => moveRouteRule(ruleIndex, 1)}>
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" aria-label={`Delete route rule ${ruleIndex + 1}`} onClick={() => deleteRouteRule(ruleIndex)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {/* W11: faithful read-only summary (action + the rule's actual match conditions, incl.
                  clash_mode / protocol / ip_is_private / logical) so an action-rule is never a blank card. */}
              <p className="rule-card__summary" aria-label={`Route rule ${ruleIndex + 1} summary`}>
                {ruleSummaryLine(rule as Record<string, unknown>)}
              </p>
              {isLogicalRule(rule) ? (
                // A logical (and/or) rule's matchers live in its nested rules[] — editing flat fields here
                // would inject an illegal top-level matcher. Send the user to the rule node's full editor.
                <p className="rule-card__hint">Logical group — open the rule node to edit its nested conditions.</p>
              ) : (
                <>
                  <label className="rule-field">
                    <span>Domain suffix</span>
                    <input
                      aria-label={`Route rule ${ruleIndex + 1} domain suffix`}
                      value={listToText(rule.domain_suffix)}
                      onChange={(event) => updateRouteRule(ruleIndex, { domain_suffix: textToList(event.target.value) })}
                    />
                  </label>
                  <label className="rule-field">
                    <span>Keyword</span>
                    <input
                      aria-label={`Route rule ${ruleIndex + 1} keyword`}
                      value={listToText(rule.domain_keyword)}
                      onChange={(event) => updateRouteRule(ruleIndex, { domain_keyword: textToList(event.target.value) })}
                    />
                  </label>
                  {/* R4: hide the target select for actions that scrub `outbound` (reject / hijack-dns /
                      sniff / resolve / route-options) — it would be a dead control. Action is set in the
                      Inspector; gating mirrors the domain normalizer (routeRuleAllowsOutbound). */}
                  {routeRuleAllowsOutbound(rule) ? (
                    <label className="rule-field">
                      <span>Outbound</span>
                      <select
                        aria-label={`Route rule ${ruleIndex + 1} outbound`}
                        value={rule.outbound ?? ""}
                        onChange={(event) => updateRouteRule(ruleIndex, { outbound: event.target.value || undefined })}
                      >
                        <option value="">Missing</option>
                        {routeOutbounds.map((outbound, outboundIndex) => (
                          <option key={`${outbound.tag ?? "untagged"}-${outboundIndex}`} value={outbound.tag ?? ""}>
                            {outbound.tag ?? `untagged-${outboundIndex + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="rule-field">
                    <span>Match rule-set</span>
                    <input
                      aria-label={`Route rule ${ruleIndex + 1} rule set`}
                      list="route-rule-set-tags"
                      value={listToText(rule.rule_set)}
                      onChange={(event) => {
                        const ruleSet = textToList(event.target.value);
                        updateRouteRule(ruleIndex, { rule_set: ruleSet.length ? ruleSet : undefined });
                      }}
                    />
                  </label>
                </>
              )}
            </article>
          );
        })}
      </div>
      <datalist id="route-rule-set-tags">
        {routeRuleSets.map((ruleSet, index) => (
          <option key={`${ruleSet.tag ?? "untagged"}-${index}`} value={ruleSet.tag ?? ""} />
        ))}
      </datalist>
    </section>
  );
}

export function DnsRulesTable() {
  const [dnsPage, setDnsPage] = useState(0);
  const { servers, ruleSets, rules, channel, addDnsRule, updateDnsRule, moveDnsRule, deleteDnsRule } = useProjectStore(
    useShallow((state) => ({
      servers: state.config.dns?.servers,
      ruleSets: state.config.route?.rule_set,
      rules: state.config.dns?.rules,
      channel: state.channel,
      addDnsRule: state.addDnsRule,
      updateDnsRule: state.updateDnsRule,
      moveDnsRule: state.moveDnsRule,
      deleteDnsRule: state.deleteDnsRule,
    })),
  );
  const dnsServers = listItems(servers);
  const dnsRuleSets = listItems(ruleSets);
  const dnsRules = listItems(rules);
  const dnsBounds = pageBounds(dnsRules.length, dnsPage);
  const visibleRules = dnsRules.slice(dnsBounds.start, dnsBounds.end);

  return (
    <section className="table-panel" aria-label="DNS rules">
      <div className="table-panel__header">
        <div>
          <h2>DNS Rules</h2>
          <p>Ordered DNS matching logic with explicit server references.</p>
        </div>
        <button type="button" onClick={addDnsRule}>
          <Plus size={15} /> Rule
        </button>
      </div>
      <RulePager {...dnsBounds} total={dnsRules.length} setPage={setDnsPage} />
      <div className="rule-list">
        {visibleRules.map((rule, index) => {
          const ruleIndex = dnsBounds.start + index;
          return (
            <article className="rule-card" key={`${ruleIndex}-${rule.server ?? "none"}`}>
              <div className="rule-card__header">
                <span>DNS Rule {ruleIndex + 1}</span>
                <div className="row-actions">
                  <button type="button" aria-label={`Move DNS rule ${ruleIndex + 1} up`} onClick={() => moveDnsRule(ruleIndex, -1)}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" aria-label={`Move DNS rule ${ruleIndex + 1} down`} onClick={() => moveDnsRule(ruleIndex, 1)}>
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" aria-label={`Delete DNS rule ${ruleIndex + 1}`} onClick={() => deleteDnsRule(ruleIndex)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {/* W11: faithful read-only summary (action + actual match conditions, incl. query_type /
                  clash_mode / logical) so a predefined/reject/logical DNS rule is never a blank card. */}
              <p className="rule-card__summary" aria-label={`DNS rule ${ruleIndex + 1} summary`}>
                {ruleSummaryLine(rule as Record<string, unknown>)}
              </p>
              {isLogicalRule(rule) ? (
                <p className="rule-card__hint">Logical group — open the rule node to edit its nested conditions.</p>
              ) : (
                <>
                  <label className="rule-field">
                    <span>Domain suffix</span>
                    <input
                      aria-label={`DNS rule ${ruleIndex + 1} domain suffix`}
                      value={listToText(rule.domain_suffix)}
                      onChange={(event) => updateDnsRule(ruleIndex, { domain_suffix: textToList(event.target.value) })}
                    />
                  </label>
                  <label className="rule-field">
                    <span>Keyword</span>
                    <input
                      aria-label={`DNS rule ${ruleIndex + 1} keyword`}
                      value={listToText(rule.domain_keyword)}
                      onChange={(event) => updateDnsRule(ruleIndex, { domain_keyword: textToList(event.target.value) })}
                    />
                  </label>
                  {/* U3: the rule ACTION is editable from the table too (deep per-action options stay in the
                      node inspector). updateDnsRule → normalizeDnsRule scrubs action-incompatible keys, so
                      switching action here is lossless. evaluate/respond are 1.14-only: offered on testing,
                      or kept selectable when already set so the control still displays the value. */}
                  <label className="rule-field">
                    <span>Action</span>
                    <select
                      aria-label={`DNS rule ${ruleIndex + 1} action`}
                      value={typeof rule.action === "string" && rule.action ? rule.action : "route"}
                      onChange={(event) => updateDnsRule(ruleIndex, { action: event.target.value })}
                    >
                      <option value="route">route</option>
                      {channel === "testing" || rule.action === "evaluate" ? <option value="evaluate">evaluate</option> : null}
                      {channel === "testing" || rule.action === "respond" ? <option value="respond">respond</option> : null}
                      <option value="route-options">route-options</option>
                      <option value="reject">reject</option>
                      <option value="predefined">predefined</option>
                    </select>
                  </label>
                  {/* U3: the rule ACTION is editable from the table too (deep per-action options stay in
                      the node inspector). updateDnsRule → normalizeDnsRule scrubs action-incompatible keys,
                      so switching action here is lossless. evaluate/respond are 1.14-only: offered on
                      testing, or kept selectable when already set so the control still displays the value. */}
                  <label className="rule-field">
                    <span>Action</span>
                    <select
                      aria-label={`DNS rule ${ruleIndex + 1} action`}
                      value={typeof rule.action === "string" && rule.action ? rule.action : "route"}
                      onChange={(event) => updateDnsRule(ruleIndex, { action: event.target.value })}
                    >
                      <option value="route">route</option>
                      {channel === "testing" || rule.action === "evaluate" ? <option value="evaluate">evaluate</option> : null}
                      {channel === "testing" || rule.action === "respond" ? <option value="respond">respond</option> : null}
                      <option value="route-options">route-options</option>
                      <option value="reject">reject</option>
                      <option value="predefined">predefined</option>
                    </select>
                  </label>
                  {/* R4: hide the server select for actions that scrub `server` (predefined / reject /
                      respond) — dead control otherwise. Gating mirrors the domain normalizer (dnsRuleAllowsServer). */}
                  {dnsRuleAllowsServer(rule) ? (
                    <label className="rule-field">
                      <span>Server</span>
                      <select
                        aria-label={`DNS rule ${ruleIndex + 1} server`}
                        value={rule.server ?? ""}
                        onChange={(event) => updateDnsRule(ruleIndex, { server: event.target.value || undefined })}
                      >
                        <option value="">Missing</option>
                        {dnsServers.map((server, serverIndex) => (
                          <option key={`${server.tag ?? "untagged"}-${serverIndex}`} value={server.tag ?? ""}>
                            {server.tag ?? `untagged-${serverIndex + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="rule-field">
                    <span>Match rule-set</span>
                    <input
                      aria-label={`DNS rule ${ruleIndex + 1} rule set`}
                      list="dns-rule-set-tags"
                      value={listToText(rule.rule_set)}
                      onChange={(event) => {
                        const ruleSet = textToList(event.target.value);
                        updateDnsRule(ruleIndex, { rule_set: ruleSet.length ? ruleSet : undefined });
                      }}
                    />
                  </label>
                </>
              )}
            </article>
          );
        })}
      </div>
      <datalist id="dns-rule-set-tags">
        {dnsRuleSets.map((ruleSet, index) => (
          <option key={`${ruleSet.tag ?? "untagged"}-${index}`} value={ruleSet.tag ?? ""} />
        ))}
      </datalist>
    </section>
  );
}
