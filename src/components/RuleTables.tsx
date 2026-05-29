import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
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
  const { outbounds, ruleSets, rules, addRouteRule, updateRouteRule, moveRouteRule, deleteRouteRule } = useProjectStore(
    useShallow((state) => ({
      outbounds: state.config.outbounds,
      ruleSets: state.config.route?.rule_set,
      rules: state.config.route?.rules,
      addRouteRule: state.addRouteRule,
      updateRouteRule: state.updateRouteRule,
      moveRouteRule: state.moveRouteRule,
      deleteRouteRule: state.deleteRouteRule,
    })),
  );
  const routeOutbounds = listItems(outbounds);
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
  const { servers, ruleSets, rules, addDnsRule, updateDnsRule, moveDnsRule, deleteDnsRule } = useProjectStore(
    useShallow((state) => ({
      servers: state.config.dns?.servers,
      ruleSets: state.config.route?.rule_set,
      rules: state.config.dns?.rules,
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
