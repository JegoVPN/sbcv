import { generatedEntityTag } from "./portRelationRegistry";
import type { SingBoxConfig } from "./types";

function taggedNodeId(
  kind: "outbound" | "inbound" | "dns-server" | "endpoint" | "service" | "rule-set" | "certificate-provider" | "http-client",
  tag: string | undefined,
  index: number,
): string {
  const safeTag = tag && tag.trim() ? tag : generatedEntityTag(kind, index);
  return `${kind}:${safeTag}`;
}

export function nodeIdForDiagnosticPath(path: string, config: SingBoxConfig): string | null {
  if (!path || !path.startsWith("/")) return null;

  const settingsMatch = path.match(/^\/(log|ntp|certificate|experimental)(?:\/|$)/);
  if (settingsMatch) return `settings:${settingsMatch[1]}`;

  const routeRuleMatch = path.match(/^\/route\/rules\/(\d+)(?:\/|$)/);
  if (routeRuleMatch) {
    const idx = Number(routeRuleMatch[1]);
    if (config.route?.rules?.[idx]) return `route-rule:${idx}`;
    return "route:main";
  }

  const ruleSetMatch = path.match(/^\/route\/rule_set\/(\d+)(?:\/|$)/);
  if (ruleSetMatch) {
    const idx = Number(ruleSetMatch[1]);
    const item = config.route?.rule_set?.[idx];
    if (item) return taggedNodeId("rule-set", item.tag, idx);
    return "route:main";
  }

  if (path === "/route" || path.startsWith("/route/")) return "route:main";

  const dnsRuleMatch = path.match(/^\/dns\/rules\/(\d+)(?:\/|$)/);
  if (dnsRuleMatch) {
    const idx = Number(dnsRuleMatch[1]);
    if (config.dns?.rules?.[idx]) return `dns-rule:${idx}`;
    return "dns:main";
  }

  const dnsServerMatch = path.match(/^\/dns\/servers\/(\d+)(?:\/|$)/);
  if (dnsServerMatch) {
    const idx = Number(dnsServerMatch[1]);
    const item = config.dns?.servers?.[idx];
    if (item) return taggedNodeId("dns-server", item.tag, idx);
    return "dns:main";
  }

  if (path === "/dns" || path.startsWith("/dns/")) return "dns:main";

  const outboundMatch = path.match(/^\/outbounds\/(\d+)(?:\/|$)/);
  if (outboundMatch) {
    const idx = Number(outboundMatch[1]);
    const item = config.outbounds?.[idx];
    if (item) return taggedNodeId("outbound", item.tag, idx);
    return null;
  }

  const inboundMatch = path.match(/^\/inbounds\/(\d+)(?:\/|$)/);
  if (inboundMatch) {
    const idx = Number(inboundMatch[1]);
    const item = config.inbounds?.[idx];
    if (item) return taggedNodeId("inbound", item.tag, idx);
    return null;
  }

  const endpointMatch = path.match(/^\/endpoints\/(\d+)(?:\/|$)/);
  if (endpointMatch) {
    const idx = Number(endpointMatch[1]);
    const item = config.endpoints?.[idx];
    if (item) return taggedNodeId("endpoint", item.tag, idx);
    return null;
  }

  const serviceMatch = path.match(/^\/services\/(\d+)(?:\/|$)/);
  if (serviceMatch) {
    const idx = Number(serviceMatch[1]);
    const item = config.services?.[idx];
    if (item) return taggedNodeId("service", item.tag, idx);
    return null;
  }

  const certificateProviderMatch = path.match(/^\/certificate_providers\/(\d+)(?:\/|$)/);
  if (certificateProviderMatch) {
    const idx = Number(certificateProviderMatch[1]);
    const item = config.certificate_providers?.[idx];
    if (item) return taggedNodeId("certificate-provider", item.tag, idx);
    return null;
  }

  const httpClientMatch = path.match(/^\/http_clients\/(\d+)(?:\/|$)/);
  if (httpClientMatch) {
    const idx = Number(httpClientMatch[1]);
    const item = config.http_clients?.[idx];
    if (item) return taggedNodeId("http-client", item.tag, idx);
    return null;
  }

  return null;
}
