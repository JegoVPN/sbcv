// W11 — faithful one-line summary of a route/DNS rule, shared by the canvas node subtitle (graph.ts) AND
// the Route/DNS hub summary tables (RuleTables.tsx). A rule is "match conditions + an action"
// (route/rule_action.md, dns/rule_action.md). The old surfaces derived `match` from only four domain
// fields (domain_suffix/keyword/domain/rule_set) and the table never showed the action at all — so
// sniff/hijack-dns/resolve/reject and logical (and/or) rules rendered as visually-identical empty rows,
// and clash_mode / ip_is_private rules read as unconditional routes. This domain helper is the single
// source for "what does this rule actually match + do", surfacing logical groups and the non-domain
// matchers the Inspector already enumerates (ruleControls route/dnsRuleAdvancedFields).

// route + dns rule actions (route/rule_action.md, dns/rule_action.md). evaluate/respond are 1.14 DNS
// actions; included so a testing-target rule's action never falls through to a raw enum string.
export const RULE_ACTION_LABELS: Record<string, string> = {
  reject: "reject",
  "route-options": "route-options",
  sniff: "sniff",
  resolve: "resolve",
  "hijack-dns": "hijack-dns",
  bypass: "bypass",
  predefined: "predefined",
  evaluate: "evaluate",
  respond: "respond",
};

export function isLogicalRule(rule: unknown): boolean {
  return Boolean(rule && typeof rule === "object" && (rule as Record<string, unknown>).type === "logical");
}

// The classifying action label for the canvas subtitle: omits the default `route` (its target is shown by
// the edge) and returns undefined for a route/absent action, matching the long-standing subtitle behavior.
export function ruleActionLabel(action: unknown): string | undefined {
  if (typeof action !== "string" || action === "route") return undefined;
  return RULE_ACTION_LABELS[action] ?? action;
}

function compactList(value: unknown): string | undefined {
  const arr = Array.isArray(value) ? value : value !== undefined && value !== null && value !== "" ? [value] : [];
  if (!arr.length) return undefined;
  const shown = arr.slice(0, 3).map((item) => String(item)).join(", ");
  return arr.length > 3 ? `${shown} +${arr.length - 3}` : shown;
}

// A faithful summary of a rule's MATCH conditions (not the action). Domain-ish matchers keep priority (so
// existing subtitles are unchanged); when none are present it falls back to the salient non-domain matcher
// instead of a generic "match rule" string. Logical groups summarize their mode + child count. Returns
// undefined ONLY for a rule with no match conditions at all (a pure-action rule like `{action:"sniff"}`).
export function ruleMatchSummary(rule: Record<string, unknown>): string | undefined {
  if (isLogicalRule(rule)) {
    const mode = typeof rule.mode === "string" ? rule.mode : "and";
    const count = Array.isArray(rule.rules) ? rule.rules.length : 0;
    return `logical ${mode}${count ? ` · ${count}` : ""}`;
  }
  const domainish =
    compactList(rule.domain_suffix) ??
    compactList(rule.domain_keyword) ??
    compactList(rule.domain) ??
    compactList(rule.domain_regex) ??
    compactList(rule.rule_set);
  if (domainish) return domainish;

  if (rule.clash_mode) return `clash: ${String(rule.clash_mode)}`;
  if (rule.ip_is_private === true) return "private IP";
  if (rule.source_ip_is_private === true) return "src private IP";
  const ipCidr = compactList(rule.ip_cidr) ?? compactList(rule.source_ip_cidr);
  if (ipCidr) return `IP ${ipCidr}`;
  const protocol = compactList(rule.protocol);
  if (protocol) return `protocol: ${protocol}`;
  const queryType = compactList(rule.query_type);
  if (queryType) return `query: ${queryType}`;
  const network = typeof rule.network === "string" ? rule.network : compactList(rule.network);
  if (network) return `network: ${network}`;
  const port = compactList(rule.port) ?? compactList(rule.port_range);
  if (port) return `port ${port}`;
  const process = compactList(rule.process_name) ?? compactList(rule.package_name);
  if (process) return `process: ${process}`;
  // Any other active matcher → name it rather than collapse to a generic fallback.
  for (const key of [
    "network_type", "wifi_ssid", "wifi_bssid", "user", "auth_user", "geoip", "geosite",
    "source_geoip", "ip_version", "client", "ip_accept_any", "network_is_expensive",
    "network_is_constrained", "source_port", "source_port_range", "process_path", "package_name",
    "client_subnet",
  ]) {
    const value = rule[key];
    if (value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)) {
      return key.replace(/_/g, " ");
    }
  }
  return undefined;
}

// The summary line for the hub tables: ALWAYS names the action (defaulting to `route`) plus the match
// summary, so no configured rule ever renders as a blank card. e.g. "sniff", "route · cn",
// "reject · protocol: quic", "logical and · 2".
export function ruleSummaryLine(rule: Record<string, unknown>): string {
  const action = typeof rule.action === "string" && rule.action ? rule.action : "route";
  const actionLabel = RULE_ACTION_LABELS[action] ?? action;
  const match = ruleMatchSummary(rule);
  return match ? `${actionLabel} · ${match}` : actionLabel;
}
