import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useProjectStore } from "../state/useProjectStore";

function listToText(value: string[] | undefined) {
  return value?.join(", ") ?? "";
}

function textToList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function RouteRulesTable() {
  const config = useProjectStore((state) => state.config);
  const addRouteRule = useProjectStore((state) => state.addRouteRule);
  const updateRouteRule = useProjectStore((state) => state.updateRouteRule);
  const moveRouteRule = useProjectStore((state) => state.moveRouteRule);
  const deleteRouteRule = useProjectStore((state) => state.deleteRouteRule);
  const outbounds = config.outbounds ?? [];
  const rules = config.route?.rules ?? [];

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
      <div className="rules-grid rules-grid--route">
        <div>#</div>
        <div>Domain suffix</div>
        <div>Keyword</div>
        <div>Outbound</div>
        <div>Order</div>
        {rules.map((rule, index) => (
          <div className="rules-row" key={`${index}-${rule.outbound ?? "none"}`}>
            <div className="rule-index">{index + 1}</div>
            <input
              aria-label={`Route rule ${index + 1} domain suffix`}
              value={listToText(rule.domain_suffix)}
              onChange={(event) => updateRouteRule(index, { domain_suffix: textToList(event.target.value) })}
            />
            <input
              aria-label={`Route rule ${index + 1} keyword`}
              value={listToText(rule.domain_keyword)}
              onChange={(event) => updateRouteRule(index, { domain_keyword: textToList(event.target.value) })}
            />
            <select
              aria-label={`Route rule ${index + 1} outbound`}
              value={rule.outbound ?? ""}
              onChange={(event) => updateRouteRule(index, { outbound: event.target.value || undefined })}
            >
              <option value="">Missing</option>
              {outbounds.map((outbound) => (
                <option key={outbound.tag} value={outbound.tag}>
                  {outbound.tag}
                </option>
              ))}
            </select>
            <div className="row-actions">
              <button type="button" aria-label={`Move route rule ${index + 1} up`} onClick={() => moveRouteRule(index, -1)}>
                <ArrowUp size={14} />
              </button>
              <button type="button" aria-label={`Move route rule ${index + 1} down`} onClick={() => moveRouteRule(index, 1)}>
                <ArrowDown size={14} />
              </button>
              <button type="button" aria-label={`Delete route rule ${index + 1}`} onClick={() => deleteRouteRule(index)}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function DnsRulesTable() {
  const config = useProjectStore((state) => state.config);
  const addDnsRule = useProjectStore((state) => state.addDnsRule);
  const updateDnsRule = useProjectStore((state) => state.updateDnsRule);
  const moveDnsRule = useProjectStore((state) => state.moveDnsRule);
  const deleteDnsRule = useProjectStore((state) => state.deleteDnsRule);
  const servers = config.dns?.servers ?? [];
  const rules = config.dns?.rules ?? [];

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
      <div className="rules-grid rules-grid--dns">
        <div>#</div>
        <div>Domain suffix</div>
        <div>Keyword</div>
        <div>Server</div>
        <div>Order</div>
        {rules.map((rule, index) => (
          <div className="rules-row" key={`${index}-${rule.server ?? "none"}`}>
            <div className="rule-index">{index + 1}</div>
            <input
              aria-label={`DNS rule ${index + 1} domain suffix`}
              value={listToText(rule.domain_suffix)}
              onChange={(event) => updateDnsRule(index, { domain_suffix: textToList(event.target.value) })}
            />
            <input
              aria-label={`DNS rule ${index + 1} keyword`}
              value={listToText(rule.domain_keyword)}
              onChange={(event) => updateDnsRule(index, { domain_keyword: textToList(event.target.value) })}
            />
            <select
              aria-label={`DNS rule ${index + 1} server`}
              value={rule.server ?? ""}
              onChange={(event) => updateDnsRule(index, { server: event.target.value || undefined })}
            >
              <option value="">Missing</option>
              {servers.map((server) => (
                <option key={server.tag} value={server.tag}>
                  {server.tag}
                </option>
              ))}
            </select>
            <div className="row-actions">
              <button type="button" aria-label={`Move DNS rule ${index + 1} up`} onClick={() => moveDnsRule(index, -1)}>
                <ArrowUp size={14} />
              </button>
              <button type="button" aria-label={`Move DNS rule ${index + 1} down`} onClick={() => moveDnsRule(index, 1)}>
                <ArrowDown size={14} />
              </button>
              <button type="button" aria-label={`Delete DNS rule ${index + 1}`} onClick={() => deleteDnsRule(index)}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
