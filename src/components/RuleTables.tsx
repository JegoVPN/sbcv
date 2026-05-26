import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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
  const config = useProjectStore((state) => state.config);
  const addRouteRule = useProjectStore((state) => state.addRouteRule);
  const updateRouteRule = useProjectStore((state) => state.updateRouteRule);
  const moveRouteRule = useProjectStore((state) => state.moveRouteRule);
  const deleteRouteRule = useProjectStore((state) => state.deleteRouteRule);
  const outbounds = listItems(config.outbounds);
  const rules = listItems(config.route?.rules);
  const routeBounds = pageBounds(rules.length, routePage);
  const visibleRules = rules.slice(routeBounds.start, routeBounds.end);

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
      <RulePager {...routeBounds} total={rules.length} setPage={setRoutePage} />
      <div className="rules-grid rules-grid--route">
        <div>#</div>
        <div>Domain suffix</div>
        <div>Keyword</div>
        <div>Outbound</div>
        <div>Order</div>
        {visibleRules.map((rule, index) => {
          const ruleIndex = routeBounds.start + index;
          return (
          <div className="rules-row" key={`${ruleIndex}-${rule.outbound ?? "none"}`}>
            <div className="rule-index">{ruleIndex + 1}</div>
            <input
              aria-label={`Route rule ${ruleIndex + 1} domain suffix`}
              value={listToText(rule.domain_suffix)}
              onChange={(event) => updateRouteRule(ruleIndex, { domain_suffix: textToList(event.target.value) })}
            />
            <input
              aria-label={`Route rule ${ruleIndex + 1} keyword`}
              value={listToText(rule.domain_keyword)}
              onChange={(event) => updateRouteRule(ruleIndex, { domain_keyword: textToList(event.target.value) })}
            />
            <select
              aria-label={`Route rule ${ruleIndex + 1} outbound`}
              value={rule.outbound ?? ""}
              onChange={(event) => updateRouteRule(ruleIndex, { outbound: event.target.value || undefined })}
            >
              <option value="">Missing</option>
              {outbounds.map((outbound) => (
                <option key={outbound.tag} value={outbound.tag}>
                  {outbound.tag}
                </option>
              ))}
            </select>
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
          );
        })}
      </div>
    </section>
  );
}

export function DnsRulesTable() {
  const [dnsPage, setDnsPage] = useState(0);
  const config = useProjectStore((state) => state.config);
  const addDnsRule = useProjectStore((state) => state.addDnsRule);
  const updateDnsRule = useProjectStore((state) => state.updateDnsRule);
  const moveDnsRule = useProjectStore((state) => state.moveDnsRule);
  const deleteDnsRule = useProjectStore((state) => state.deleteDnsRule);
  const servers = listItems(config.dns?.servers);
  const rules = listItems(config.dns?.rules);
  const dnsBounds = pageBounds(rules.length, dnsPage);
  const visibleRules = rules.slice(dnsBounds.start, dnsBounds.end);

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
      <RulePager {...dnsBounds} total={rules.length} setPage={setDnsPage} />
      <div className="rules-grid rules-grid--dns">
        <div>#</div>
        <div>Domain suffix</div>
        <div>Keyword</div>
        <div>Server</div>
        <div>Order</div>
        {visibleRules.map((rule, index) => {
          const ruleIndex = dnsBounds.start + index;
          return (
          <div className="rules-row" key={`${ruleIndex}-${rule.server ?? "none"}`}>
            <div className="rule-index">{ruleIndex + 1}</div>
            <input
              aria-label={`DNS rule ${ruleIndex + 1} domain suffix`}
              value={listToText(rule.domain_suffix)}
              onChange={(event) => updateDnsRule(ruleIndex, { domain_suffix: textToList(event.target.value) })}
            />
            <input
              aria-label={`DNS rule ${ruleIndex + 1} keyword`}
              value={listToText(rule.domain_keyword)}
              onChange={(event) => updateDnsRule(ruleIndex, { domain_keyword: textToList(event.target.value) })}
            />
            <select
              aria-label={`DNS rule ${ruleIndex + 1} server`}
              value={rule.server ?? ""}
              onChange={(event) => updateDnsRule(ruleIndex, { server: event.target.value || undefined })}
            >
              <option value="">Missing</option>
              {servers.map((server) => (
                <option key={server.tag} value={server.tag}>
                  {server.tag}
                </option>
              ))}
            </select>
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
          );
        })}
      </div>
    </section>
  );
}
