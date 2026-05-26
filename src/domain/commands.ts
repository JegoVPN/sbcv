import { getUniqueTag } from "./indexes";
import { cloneConfig, STABLE_MINIMAL_CONFIG, STABLE_TUN_SPLIT_CONFIG } from "./templates";
import type {
  DnsRule,
  DnsServerConfig,
  EntityRef,
  InboundConfig,
  OutboundConfig,
  RouteRule,
  SingBoxConfig,
} from "./types";

export function createMinimalConfig(): SingBoxConfig {
  return cloneConfig(STABLE_MINIMAL_CONFIG);
}

export function createStableTunSplitConfig(): SingBoxConfig {
  return cloneConfig(STABLE_TUN_SPLIT_CONFIG);
}

function ensureArray<T>(array: T[] | undefined): T[] {
  return array ? [...array] : [];
}

export function ensureRoute(config: SingBoxConfig): SingBoxConfig {
  const next = cloneConfig(config);
  next.route = next.route ?? { rules: [], final: undefined };
  next.route.rules = ensureArray(next.route.rules);
  return next;
}

export function addInbound(config: SingBoxConfig, type: "tun" | "mixed" = "tun"): SingBoxConfig {
  const next = cloneConfig(config);
  const tag = getUniqueTag(next, type === "tun" ? "tun-in" : "mixed-in");
  const inbound: InboundConfig =
    type === "tun"
      ? {
          type: "tun",
          tag,
          address: ["172.19.0.1/30"],
          auto_route: true,
        }
      : {
          type: "mixed",
          tag,
          listen: "127.0.0.1",
          listen_port: 2080,
        };
  next.inbounds = [...(next.inbounds ?? []), inbound];
  return next;
}

export function addOutbound(config: SingBoxConfig, type: string, preferredTag?: string): SingBoxConfig {
  const next = cloneConfig(config);
  const tag = getUniqueTag(next, preferredTag ?? type);
  const outbound = createOutbound(type, tag);
  next.outbounds = [...(next.outbounds ?? []), outbound];
  return next;
}

export function createOutbound(type: string, tag: string): OutboundConfig {
  if (type === "direct") return { type, tag };
  if (type === "block") return { type, tag };
  if (type === "selector") return { type, tag, outbounds: [], default: undefined };
  if (type === "urltest") {
    return {
      type,
      tag,
      outbounds: [],
      url: "https://www.gstatic.com/generate_204",
      interval: "3m",
    };
  }
  return {
    type: "socks",
    tag,
    server: "127.0.0.1",
    server_port: 1080,
  };
}

export function addDnsServer(config: SingBoxConfig, type: "local" | "https" = "local"): SingBoxConfig {
  const next = cloneConfig(config);
  next.dns = next.dns ?? {};
  const tag = getUniqueTag(next, type === "local" ? "local-dns" : "remote-doh");
  const server: DnsServerConfig =
    type === "local"
      ? { type: "local", tag }
      : {
          type: "https",
          tag,
          address: "https://1.1.1.1/dns-query",
          server: "1.1.1.1",
          server_port: 443,
        };
  next.dns.servers = [...(next.dns.servers ?? []), server];
  next.dns.final = next.dns.final ?? tag;
  return next;
}

export function addRouteRule(config: SingBoxConfig, rule?: RouteRule): SingBoxConfig {
  const next = ensureRoute(config);
  next.route!.rules = [
    ...(next.route!.rules ?? []),
    rule ?? { domain_suffix: ["example"], outbound: next.route?.final },
  ];
  return next;
}

export function addDnsRule(config: SingBoxConfig, rule?: DnsRule): SingBoxConfig {
  const next = cloneConfig(config);
  next.dns = next.dns ?? {};
  next.dns.rules = [
    ...(next.dns.rules ?? []),
    rule ?? { domain_suffix: ["example"], server: next.dns.final },
  ];
  return next;
}

export function updateRouteRule(
  config: SingBoxConfig,
  index: number,
  patch: Partial<RouteRule>,
): SingBoxConfig {
  const next = ensureRoute(config);
  const rules = [...(next.route!.rules ?? [])];
  const current = rules[index];
  if (!current) return next;
  rules[index] = { ...current, ...patch };
  next.route!.rules = rules;
  return next;
}

export function updateDnsRule(
  config: SingBoxConfig,
  index: number,
  patch: Partial<DnsRule>,
): SingBoxConfig {
  const next = cloneConfig(config);
  next.dns = next.dns ?? {};
  const rules = [...(next.dns.rules ?? [])];
  const current = rules[index];
  if (!current) return next;
  rules[index] = { ...current, ...patch };
  next.dns.rules = rules;
  return next;
}

export function moveRouteRule(config: SingBoxConfig, index: number, direction: -1 | 1): SingBoxConfig {
  const next = ensureRoute(config);
  const rules = [...(next.route!.rules ?? [])];
  const target = index + direction;
  if (target < 0 || target >= rules.length) return next;
  const current = rules[index];
  const other = rules[target];
  if (!current || !other) return next;
  rules[index] = other;
  rules[target] = current;
  next.route!.rules = rules;
  return next;
}

export function moveDnsRule(config: SingBoxConfig, index: number, direction: -1 | 1): SingBoxConfig {
  const next = cloneConfig(config);
  next.dns = next.dns ?? {};
  const rules = [...(next.dns.rules ?? [])];
  const target = index + direction;
  if (target < 0 || target >= rules.length) return next;
  const current = rules[index];
  const other = rules[target];
  if (!current || !other) return next;
  rules[index] = other;
  rules[target] = current;
  next.dns.rules = rules;
  return next;
}

export function deleteRouteRule(config: SingBoxConfig, index: number): SingBoxConfig {
  const next = ensureRoute(config);
  next.route!.rules = (next.route!.rules ?? []).filter((_, ruleIndex) => ruleIndex !== index);
  return next;
}

export function deleteDnsRule(config: SingBoxConfig, index: number): SingBoxConfig {
  const next = cloneConfig(config);
  if (next.dns?.rules) {
    next.dns.rules = next.dns.rules.filter((_, ruleIndex) => ruleIndex !== index);
  }
  return next;
}

export function setRouteFinal(config: SingBoxConfig, tag: string): SingBoxConfig {
  const next = ensureRoute(config);
  next.route!.final = tag;
  return next;
}

export function setDnsFinal(config: SingBoxConfig, tag: string): SingBoxConfig {
  const next = cloneConfig(config);
  next.dns = next.dns ?? {};
  next.dns.final = tag;
  return next;
}

export function connectSelectorCandidate(
  config: SingBoxConfig,
  selectorTag: string,
  outboundTag: string,
): SingBoxConfig {
  const next = cloneConfig(config);
  next.outbounds = (next.outbounds ?? []).map((outbound) => {
    if (outbound.tag !== selectorTag) return outbound;
    const current = outbound.outbounds ?? [];
    if (current.includes(outboundTag)) return outbound;
    return { ...outbound, outbounds: [...current, outboundTag] };
  });
  return next;
}

export function updateEntityField(
  config: SingBoxConfig,
  ref: EntityRef,
  field: string,
  value: unknown,
): SingBoxConfig {
  const next = cloneConfig(config);
  if (ref.kind === "inbound") {
    next.inbounds = (next.inbounds ?? []).map((item) =>
      item.tag === ref.tag ? { ...item, [field]: value } : item,
    );
  }
  if (ref.kind === "outbound") {
    next.outbounds = (next.outbounds ?? []).map((item) =>
      item.tag === ref.tag ? { ...item, [field]: value } : item,
    );
  }
  if (ref.kind === "dns-server") {
    next.dns = next.dns ?? {};
    next.dns.servers = (next.dns.servers ?? []).map((item) =>
      item.tag === ref.tag ? { ...item, [field]: value } : item,
    );
  }
  return next;
}

export function renameTag(config: SingBoxConfig, oldTag: string, newTag: string): SingBoxConfig {
  if (!newTag.trim() || oldTag === newTag) return config;
  const next = cloneConfig(config);

  next.inbounds = next.inbounds?.map((item) =>
    item.tag === oldTag ? { ...item, tag: newTag } : item,
  );
  next.outbounds = next.outbounds?.map((item) =>
    item.tag === oldTag
      ? { ...item, tag: newTag, outbounds: item.outbounds?.map((tag) => (tag === oldTag ? newTag : tag)) }
      : { ...item, outbounds: item.outbounds?.map((tag) => (tag === oldTag ? newTag : tag)) },
  );
  next.dns = next.dns
    ? {
        ...next.dns,
        final: next.dns.final === oldTag ? newTag : next.dns.final,
        servers: next.dns.servers?.map((item) =>
          item.tag === oldTag ? { ...item, tag: newTag } : item,
        ),
        rules: next.dns.rules?.map((rule) => ({
          ...rule,
          server: rule.server === oldTag ? newTag : rule.server,
        })),
      }
    : next.dns;
  next.route = next.route
    ? {
        ...next.route,
        final: next.route.final === oldTag ? newTag : next.route.final,
        rules: next.route.rules?.map((rule) => ({
          ...rule,
          outbound: rule.outbound === oldTag ? newTag : rule.outbound,
        })),
      }
    : next.route;
  return next;
}

export function deleteEntity(config: SingBoxConfig, ref: EntityRef): SingBoxConfig {
  const next = cloneConfig(config);
  if (ref.kind === "inbound") {
    next.inbounds = (next.inbounds ?? []).filter((item) => item.tag !== ref.tag);
  }
  if (ref.kind === "outbound") {
    next.outbounds = (next.outbounds ?? []).filter((item) => item.tag !== ref.tag);
    if (next.route?.final === ref.tag) next.route.final = undefined;
    next.route?.rules?.forEach((rule) => {
      if (rule.outbound === ref.tag) rule.outbound = undefined;
    });
    next.outbounds = next.outbounds?.map((item) => ({
      ...item,
      outbounds: item.outbounds?.filter((tag) => tag !== ref.tag),
      default: item.default === ref.tag ? undefined : item.default,
    }));
  }
  if (ref.kind === "dns-server") {
    if (next.dns?.servers) {
      next.dns.servers = next.dns.servers.filter((item) => item.tag !== ref.tag);
    }
    if (next.dns?.final === ref.tag) next.dns.final = undefined;
    next.dns?.rules?.forEach((rule) => {
      if (rule.server === ref.tag) rule.server = undefined;
    });
  }
  if (ref.kind === "route-rule") return deleteRouteRule(config, ref.index);
  if (ref.kind === "dns-rule") return deleteDnsRule(config, ref.index);
  return next;
}

export function disconnectEdge(config: SingBoxConfig, edgeId: string): SingBoxConfig {
  const next = cloneConfig(config);
  const parts = edgeId.split(":");
  const relation = parts[1];
  if (relation === "route-final") {
    if (next.route) next.route.final = undefined;
  }
  if (relation === "route-rule") {
    const index = Number(parts[2]);
    if (Number.isInteger(index) && next.route?.rules?.[index]) {
      next.route.rules[index].outbound = undefined;
    }
  }
  if (relation === "selector" || relation === "urltest") {
    const parent = parts[2];
    const child = parts[4] ?? parts[3];
    next.outbounds = next.outbounds?.map((outbound) =>
      outbound.tag === parent
        ? { ...outbound, outbounds: outbound.outbounds?.filter((tag) => tag !== child) }
        : outbound,
    );
  }
  if (relation === "dns-final") {
    if (next.dns) next.dns.final = undefined;
  }
  if (relation === "dns-rule") {
    const index = Number(parts[2]);
    if (Number.isInteger(index) && next.dns?.rules?.[index]) {
      next.dns.rules[index].server = undefined;
    }
  }
  return next;
}
