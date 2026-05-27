import { getUniqueTag } from "./indexes";
import { preferredDnsServerTag, preferredEndpointTag, preferredInboundTag, preferredServiceTag } from "./protocols";
import { cloneConfig, STABLE_MINIMAL_CONFIG, STABLE_TUN_SPLIT_CONFIG } from "./templates";
import type {
  DnsRule,
  DnsServerConfig,
  EndpointConfig,
  EntityRef,
  InboundConfig,
  OutboundConfig,
  RouteRule,
  ServiceConfig,
  SingBoxConfig,
  TaggedConfig,
} from "./types";

export function createMinimalConfig(): SingBoxConfig {
  return cloneConfig(STABLE_MINIMAL_CONFIG);
}

export function createStableTunSplitConfig(): SingBoxConfig {
  return cloneConfig(STABLE_TUN_SPLIT_CONFIG);
}

export function ensureSettings(config: SingBoxConfig, path: keyof SingBoxConfig): SingBoxConfig {
  const next = cloneConfig(config);
  const current = next[path];
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    next[path] = {};
  }
  if (path === "log") {
    next.log = {
      level: "info",
      ...(typeof current === "object" && current && !Array.isArray(current) ? current : {}),
    };
  }
  if (path === "ntp") {
    next.ntp = {
      enabled: false,
      server: "time.apple.com",
      server_port: 123,
      interval: "30m",
      ...(typeof current === "object" && current && !Array.isArray(current) ? current : {}),
    };
  }
  if (path === "certificate") {
    next.certificate = {
      store: "system",
      certificate: [],
      certificate_path: [],
      certificate_directory_path: [],
      ...(typeof current === "object" && current && !Array.isArray(current) ? current : {}),
    };
  }
  if (path === "experimental") {
    next.experimental = {
      cache_file: {
        enabled: false,
        path: "",
        cache_id: "",
        store_fakeip: false,
      },
      clash_api: {
        external_controller: "",
        secret: "",
        default_mode: "",
        access_control_allow_origin: [],
        access_control_allow_private_network: false,
      },
      ...(typeof current === "object" && current && !Array.isArray(current) ? current : {}),
    };
  }
  return next;
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

export function addInbound(config: SingBoxConfig, type = "tun", preferredTag?: string): SingBoxConfig {
  const next = cloneConfig(config);
  const tag = getUniqueTag(next, preferredTag ?? preferredInboundTag(type));
  next.inbounds = [...(next.inbounds ?? []), createInbound(type, tag)];
  return next;
}

export function createInbound(type: string, tag: string): InboundConfig {
  if (type === "tun") {
    return {
      type,
      tag,
      address: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"],
      auto_route: true,
    };
  }
  if (type === "mixed") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 2080,
      set_system_proxy: false,
    };
  }
  if (type === "direct") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 2081,
    };
  }
  if (type === "socks") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 2080,
      users: [{ username: "user", password: "change-me" }],
    };
  }
  if (type === "http") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 2080,
      users: [{ username: "user", password: "change-me" }],
      set_system_proxy: false,
    };
  }
  if (type === "shadowsocks") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 2080,
      method: "aes-128-gcm",
      password: "change-me",
    };
  }
  if (type === "vmess") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 2080,
      users: [{ name: "user", uuid: "bf000d23-0752-40b4-affe-68f7707a9661", alterId: 0 }],
    };
  }
  if (type === "trojan") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 2080,
      users: [{ name: "user", password: "change-me" }],
      tls: { enabled: true, server_name: "" },
    };
  }
  if (type === "naive") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 2080,
      users: [{ username: "user", password: "change-me" }],
      tls: { enabled: true, server_name: "" },
    };
  }
  if (type === "hysteria") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 2080,
      up_mbps: 100,
      down_mbps: 100,
      users: [{ name: "user", auth_str: "change-me" }],
      tls: { enabled: true, server_name: "" },
    };
  }
  if (type === "shadowtls") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 2080,
      version: 3,
      users: [{ name: "user", password: "change-me" }],
      handshake: { server: "google.com", server_port: 443 },
    };
  }
  if (type === "vless") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 2080,
      users: [{ name: "user", uuid: "bf000d23-0752-40b4-affe-68f7707a9661" }],
      tls: { enabled: true, server_name: "" },
    };
  }
  if (type === "tuic") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 2080,
      users: [{ name: "user", uuid: "059032a9-7d40-4a96-9bb1-36823d848068", password: "change-me" }],
      congestion_control: "cubic",
      auth_timeout: "3s",
      zero_rtt_handshake: false,
      heartbeat: "10s",
      tls: { enabled: true, server_name: "" },
    };
  }
  if (type === "hysteria2") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 2080,
      up_mbps: 100,
      down_mbps: 100,
      users: [{ name: "user", password: "change-me" }],
      ignore_client_bandwidth: false,
      tls: { enabled: true, server_name: "" },
    };
  }
  if (type === "anytls") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 2080,
      users: [{ name: "user", password: "change-me" }],
      tls: { enabled: true, server_name: "" },
    };
  }
  if (type === "redirect") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 2080,
    };
  }
  if (type === "tproxy") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 2080,
    };
  }
  return { type, tag };
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
  if (type === "socks") {
    return {
      type,
      tag,
      server: "127.0.0.1",
      server_port: 1080,
    };
  }
  if (type === "http") {
    return {
      type,
      tag,
      server: "127.0.0.1",
      server_port: 1080,
      username: "user",
      password: "change-me",
    };
  }
  if (type === "shadowsocks") {
    return {
      type,
      tag,
      server: "127.0.0.1",
      server_port: 1080,
      method: "aes-128-gcm",
      password: "change-me",
    };
  }
  if (type === "vmess") {
    return {
      type,
      tag,
      server: "127.0.0.1",
      server_port: 1080,
      uuid: "bf000d23-0752-40b4-affe-68f7707a9661",
      security: "auto",
      alter_id: 0,
    };
  }
  if (type === "trojan") {
    return {
      type,
      tag,
      server: "127.0.0.1",
      server_port: 1080,
      password: "change-me",
      tls: { enabled: true, server_name: "" },
    };
  }
  if (type === "naive") {
    return {
      type,
      tag,
      server: "127.0.0.1",
      server_port: 1080,
      username: "user",
      password: "change-me",
      tls: { enabled: true, server_name: "" },
    };
  }
  if (type === "hysteria") {
    return {
      type,
      tag,
      server: "127.0.0.1",
      server_port: 1080,
      up_mbps: 100,
      down_mbps: 100,
      auth_str: "change-me",
      tls: { enabled: true, server_name: "" },
    };
  }
  if (type === "shadowtls") {
    return {
      type,
      tag,
      server: "127.0.0.1",
      server_port: 1080,
      version: 3,
      password: "change-me",
      tls: { enabled: true, server_name: "" },
    };
  }
  if (type === "vless") {
    return {
      type,
      tag,
      server: "127.0.0.1",
      server_port: 1080,
      uuid: "bf000d23-0752-40b4-affe-68f7707a9661",
      tls: { enabled: true, server_name: "" },
    };
  }
  if (type === "tuic") {
    return {
      type,
      tag,
      server: "127.0.0.1",
      server_port: 1080,
      uuid: "2dd61d93-75d8-4da4-ac0e-6aece7eac365",
      password: "change-me",
      congestion_control: "cubic",
      udp_relay_mode: "native",
      tls: { enabled: true, server_name: "" },
    };
  }
  if (type === "hysteria2") {
    return {
      type,
      tag,
      server: "127.0.0.1",
      server_port: 1080,
      password: "change-me",
      up_mbps: 100,
      down_mbps: 100,
      tls: { enabled: true, server_name: "" },
    };
  }
  if (type === "anytls") {
    return {
      type,
      tag,
      server: "127.0.0.1",
      server_port: 1080,
      password: "change-me",
      idle_session_check_interval: "30s",
      idle_session_timeout: "30s",
      min_idle_session: 5,
      tls: { enabled: true, server_name: "" },
    };
  }
  if (type === "tor") {
    return {
      type,
      tag,
      executable_path: "/usr/bin/tor",
      extra_args: [],
      data_directory: "$HOME/.cache/tor",
      torrc: { ClientOnly: 1 },
    };
  }
  if (type === "ssh") {
    return {
      type,
      tag,
      server: "127.0.0.1",
      server_port: 22,
      user: "root",
      password: "change-me",
    };
  }
  if (type === "selector") return { type, tag, outbounds: [], default: undefined };
  if (type === "urltest") {
    return {
      type,
      tag,
      outbounds: [],
      url: "https://www.gstatic.com/generate_204",
      interval: "3m",
      tolerance: 50,
      idle_timeout: "30m",
      interrupt_exist_connections: false,
    };
  }
  return { type, tag };
}

export function addDnsServer(config: SingBoxConfig, type = "local", preferredTag?: string): SingBoxConfig {
  const next = cloneConfig(config);
  next.dns = next.dns ?? {};
  const tag = getUniqueTag(next, preferredTag ?? preferredDnsServerTag(type));
  next.dns.servers = [...(next.dns.servers ?? []), createDnsServer(type, tag)];
  next.dns.final = next.dns.final ?? tag;
  return next;
}

export function addEndpoint(config: SingBoxConfig, type = "wireguard", preferredTag?: string): SingBoxConfig {
  const next = cloneConfig(config);
  const tag = getUniqueTag(next, preferredTag ?? preferredEndpointTag(type));
  next.endpoints = [...(next.endpoints ?? []), createEndpoint(type, tag)];
  return next;
}

export function addService(config: SingBoxConfig, type = "resolved", preferredTag?: string): SingBoxConfig {
  const next = cloneConfig(config);
  let service = createService(type, getUniqueTag(next, preferredTag ?? preferredServiceTag(type)));

  if (type === "ssm-api") {
    let inboundTag = next.inbounds?.find((inbound) => inbound.type === "shadowsocks" && inbound.managed)?.tag;
    if (!inboundTag) {
      inboundTag = getUniqueTag(next, "ss-managed-in");
      next.inbounds = [
        ...(next.inbounds ?? []),
        {
          ...createInbound("shadowsocks", inboundTag),
          method: "2022-blake3-aes-128-gcm",
          password: "Q7WI7Eid7AOHSdFDw3bkdA==",
          managed: true,
        },
      ];
    }
    service = { ...service, servers: { "/": inboundTag } };
  }

  next.services = [...(next.services ?? []), service];
  return next;
}

export function createService(type: string, tag: string): ServiceConfig {
  if (type === "resolved") {
    return {
      type,
      tag,
      listen: "127.0.0.53",
      listen_port: 53,
    };
  }
  if (type === "derp") {
    return {
      type,
      tag,
      listen: "::",
      listen_port: 8443,
      config_path: "derper.key",
      home: "",
      verify_client_endpoint: [],
      mesh_with: [],
      stun: { enabled: false, listen: "::", listen_port: 3478 },
      tls: { enabled: true, server_name: "" },
    };
  }
  if (type === "ssm-api") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 9090,
      servers: {},
      cache_path: "",
    };
  }
  if (type === "ccm") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 8080,
      credential_path: "",
      usages_path: "",
      users: [],
      headers: {},
    };
  }
  if (type === "ocm") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 8081,
      credential_path: "",
      usages_path: "",
      users: [],
      headers: {},
    };
  }
  if (type === "hysteria-realm") {
    return {
      type,
      tag,
      listen: "127.0.0.1",
      listen_port: 8444,
      users: [{ name: "user", token: "change-me", max_realms: 1 }],
    };
  }
  return { type, tag };
}

export function createEndpoint(type: string, tag: string): EndpointConfig {
  if (type === "wireguard") {
    return {
      type,
      tag,
      system: false,
      name: "wg0",
      mtu: 1408,
      address: ["172.16.0.2/32"],
      private_key: "EEKlAzKfS87ShJPnvEF3AiJjGS9JHEzgn2jB3J7yMkY=",
      peers: [
        {
          server: "127.0.0.1",
          server_port: 51820,
          public_key: "tM4NaeCZrzxQ6BfhyeuQMy5jDReji4o8h5LVAGpI1HQ=",
          allowed_ips: ["0.0.0.0/0"],
        },
      ],
      udp_timeout: "5m",
    };
  }
  if (type === "tailscale") {
    return {
      type,
      tag,
      state_directory: "$HOME/.tailscale",
      control_url: "https://controlplane.tailscale.com",
      accept_routes: false,
      advertise_routes: [],
      advertise_exit_node: false,
      advertise_tags: [],
      system_interface: false,
      udp_timeout: "5m",
    };
  }
  return { type, tag };
}

export function createDnsServer(type: string, tag: string): DnsServerConfig {
  if (type === "local") return { type, tag };
  if (type === "legacy") {
    return {
      type,
      tag,
      address: "8.8.8.8",
      strategy: "prefer_ipv4",
    };
  }
  if (type === "hosts") {
    return {
      type,
      tag,
      path: "/etc/hosts",
    };
  }
  if (type === "tcp" || type === "udp") {
    return {
      type,
      tag,
      server: "1.1.1.1",
      server_port: 53,
    };
  }
  if (type === "tls" || type === "quic") {
    return {
      type,
      tag,
      server: "1.1.1.1",
      server_port: 853,
    };
  }
  if (type === "https") {
    return {
      type,
      tag,
      server: "1.1.1.1",
      server_port: 443,
      path: "/dns-query",
    };
  }
  if (type === "h3") {
    return {
      type,
      tag,
      server: "1.1.1.1",
      server_port: 443,
      path: "/dns-query",
    };
  }
  if (type === "dhcp") {
    return {
      type,
      tag,
      interface: "auto",
    };
  }
  if (type === "fakeip") {
    return {
      type,
      tag,
      inet4_range: "198.18.0.0/15",
      inet6_range: "fc00::/18",
    };
  }
  if (type === "mdns") {
    return {
      type,
      tag,
      interface: [],
    };
  }
  if (type === "tailscale") {
    return {
      type,
      tag,
      accept_default_resolvers: false,
    };
  }
  if (type === "resolved") {
    return {
      type,
      tag,
      service: "resolved",
      accept_default_resolvers: false,
    };
  }
  return { type, tag };
}

export function addRuleSet(config: SingBoxConfig, type = "remote", preferredTag?: string): SingBoxConfig {
  const next = ensureRoute(config);
  const tag = getUniqueTag(next, preferredTag ?? `${type}-rules`);
  next.route!.rule_set = [...(next.route!.rule_set ?? []), createRuleSet(type, tag)];
  return next;
}

export function createRuleSet(type: string, tag: string): TaggedConfig {
  if (type === "inline") {
    return {
      type,
      tag,
      rules: [{ domain_suffix: ["example.com"] }],
    };
  }
  if (type === "local") {
    return {
      type,
      tag,
      format: "source",
      path: "./rules.json",
    };
  }
  return {
    type: "remote",
    tag,
    format: "source",
    url: "https://example.com/rules.json",
    update_interval: "1d",
  };
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
  if (ref.kind === "endpoint") {
    next.endpoints = (next.endpoints ?? []).map((item) =>
      item.tag === ref.tag ? { ...item, [field]: value } : item,
    );
  }
  if (ref.kind === "service") {
    next.services = (next.services ?? []).map((item) =>
      item.tag === ref.tag ? { ...item, [field]: value } : item,
    );
  }
  if (ref.kind === "rule-set") {
    next.route = next.route ?? {};
    next.route.rule_set = (next.route.rule_set ?? []).map((item) =>
      item.tag === ref.tag ? { ...item, [field]: value } : item,
    );
  }
  if (ref.kind === "route") {
    next.route = { ...(next.route ?? {}), [field]: value };
  }
  if (ref.kind === "dns") {
    next.dns = { ...(next.dns ?? {}), [field]: value };
  }
  if (ref.kind === "settings") {
    const current = next[ref.path];
    const objectValue =
      current && typeof current === "object" && !Array.isArray(current) ? current : {};
    next[ref.path] = { ...objectValue, [field]: value };
  }
  return next;
}

export function changeEntityType(
  config: SingBoxConfig,
  ref: Extract<EntityRef, { kind: "inbound" | "outbound" | "dns-server" | "endpoint" | "service" | "rule-set" }>,
  nextType: string,
): SingBoxConfig {
  const next = cloneConfig(config);
  if (ref.kind === "inbound") {
    next.inbounds = (next.inbounds ?? []).map((item) =>
      item.tag === ref.tag ? { ...createInbound(nextType, ref.tag), tag: ref.tag } : item,
    );
  }
  if (ref.kind === "outbound") {
    next.outbounds = (next.outbounds ?? []).map((item) => {
      if (item.tag !== ref.tag) return item;
      const replacement = createOutbound(nextType, ref.tag);
      const detour = item.detour;
      return detour ? { ...replacement, detour } : replacement;
    });
  }
  if (ref.kind === "dns-server") {
    next.dns = next.dns ?? {};
    next.dns.servers = (next.dns.servers ?? []).map((item) => {
      if (item.tag !== ref.tag) return item;
      const replacement = createDnsServer(nextType, ref.tag);
      const detour = item.detour;
      const endpoint = item.endpoint;
      return {
        ...replacement,
        ...(detour ? { detour } : {}),
        ...(nextType === "tailscale" && endpoint ? { endpoint } : {}),
      };
    });
  }
  if (ref.kind === "endpoint") {
    next.endpoints = (next.endpoints ?? []).map((item) => {
      if (item.tag !== ref.tag) return item;
      const replacement = createEndpoint(nextType, ref.tag);
      const detour = item.detour;
      return detour ? { ...replacement, detour } : replacement;
    });
    if (nextType !== "tailscale") {
      next.dns?.servers?.forEach((server) => {
        if (server.endpoint === ref.tag) server.endpoint = undefined;
      });
      next.certificate_providers = next.certificate_providers?.map((provider) => ({
        ...provider,
        endpoint: provider.endpoint === ref.tag ? undefined : provider.endpoint,
      }));
    }
  }
  if (ref.kind === "service") {
    next.services = (next.services ?? []).map((item) => {
      if (item.tag !== ref.tag) return item;
      const replacement = createService(nextType, ref.tag);
      const listen = item.listen;
      const listenPort = item.listen_port;
      return {
        ...replacement,
        ...(listen ? { listen } : {}),
        ...(typeof listenPort === "number" ? { listen_port: listenPort } : {}),
      };
    });
  }
  if (ref.kind === "rule-set") {
    next.route = next.route ?? {};
    next.route.rule_set = (next.route.rule_set ?? []).map((item) => {
      if (item.tag !== ref.tag) return item;
      const replacement = createRuleSet(nextType, ref.tag);
      const downloadDetour = item.download_detour;
      return nextType === "remote" && downloadDetour ? { ...replacement, download_detour: downloadDetour } : replacement;
    });
  }
  return next;
}

function replaceRuleSetRef(value: string | string[] | undefined, oldTag: string, newTag: string) {
  if (Array.isArray(value)) return value.map((tag) => (tag === oldTag ? newTag : tag));
  return value === oldTag ? newTag : value;
}

function removeRuleSetRef(value: string | string[] | undefined, tag: string) {
  if (Array.isArray(value)) return value.filter((item) => item !== tag);
  return value === tag ? undefined : value;
}

function replaceTagRef(value: string | string[] | undefined, oldTag: string, newTag: string) {
  if (Array.isArray(value)) return value.map((tag) => (tag === oldTag ? newTag : tag));
  return value === oldTag ? newTag : value;
}

function removeTagRef(value: string | string[] | undefined, tag: string) {
  if (Array.isArray(value)) return value.filter((item) => item !== tag);
  return value === tag ? undefined : value;
}

export function renameTag(config: SingBoxConfig, oldTag: string, newTag: string): SingBoxConfig {
  if (!newTag.trim() || oldTag === newTag) return config;
  const next = cloneConfig(config);

  next.inbounds = next.inbounds?.map((item) =>
    item.tag === oldTag ? { ...item, tag: newTag } : item,
  );
  const remapOutbound = <T extends OutboundConfig>(item: T): T => ({
    ...item,
    tag: item.tag === oldTag ? newTag : item.tag,
    outbounds: item.outbounds?.map((tag) => (tag === oldTag ? newTag : tag)),
    default: item.default === oldTag ? newTag : item.default,
    detour: typeof item.detour === "string" && item.detour === oldTag ? newTag : item.detour,
  });
  next.outbounds = next.outbounds?.map(remapOutbound);
  next.dns = next.dns
    ? {
        ...next.dns,
        final: next.dns.final === oldTag ? newTag : next.dns.final,
        servers: next.dns.servers?.map((item) =>
          item.tag === oldTag
            ? { ...item, tag: newTag, endpoint: item.endpoint === oldTag ? newTag : item.endpoint }
            : { ...item, endpoint: item.endpoint === oldTag ? newTag : item.endpoint },
        ),
        rules: next.dns.rules?.map((rule) => ({
          ...rule,
          inbound: replaceTagRef(rule.inbound, oldTag, newTag),
          server: rule.server === oldTag ? newTag : rule.server,
        })),
      }
    : next.dns;
  next.route = next.route
    ? {
        ...next.route,
        final: next.route.final === oldTag ? newTag : next.route.final,
        rule_set: next.route.rule_set?.map((item) =>
          item.tag === oldTag ? { ...item, tag: newTag } : item,
        ),
        rules: next.route.rules?.map((rule) => ({
          ...rule,
          inbound: replaceTagRef(rule.inbound, oldTag, newTag),
          outbound: rule.outbound === oldTag ? newTag : rule.outbound,
          rule_set: replaceRuleSetRef(rule.rule_set, oldTag, newTag),
        })),
      }
    : next.route;
  next.endpoints = next.endpoints?.map((item) =>
    item.tag === oldTag ? { ...item, tag: newTag, detour: item.detour === oldTag ? newTag : item.detour } : item,
  );
  next.services = next.services?.map((item) => ({
    ...item,
    verify_client_endpoint: replaceTagRef(item.verify_client_endpoint as string | string[] | undefined, oldTag, newTag),
    detour: item.detour === oldTag ? newTag : item.detour,
    servers:
      item.servers && typeof item.servers === "object" && !Array.isArray(item.servers)
        ? Object.fromEntries(Object.entries(item.servers).map(([path, tag]) => [path, tag === oldTag ? newTag : tag]))
        : item.servers,
  }));
  next.certificate_providers = next.certificate_providers?.map((item) => ({
    ...item,
    endpoint: item.endpoint === oldTag ? newTag : item.endpoint,
  }));
  if (next.dns?.rules) {
    next.dns.rules = next.dns.rules.map((rule) => ({
      ...rule,
      rule_set: replaceRuleSetRef(rule.rule_set, oldTag, newTag),
    }));
  }
  if (next.route?.rule_set) {
    next.route.rule_set = next.route.rule_set.map((item) => {
      const value = (item as Record<string, unknown>).download_detour;
      if (value === oldTag) return { ...item, download_detour: newTag } as TaggedConfig;
      return item;
    });
  }
  if (next.experimental && typeof next.experimental === "object" && !Array.isArray(next.experimental)) {
    const clashApi = (next.experimental as Record<string, unknown>).clash_api;
    if (clashApi && typeof clashApi === "object" && !Array.isArray(clashApi)) {
      const detour = (clashApi as Record<string, unknown>).external_ui_download_detour;
      if (detour === oldTag) {
        next.experimental = {
          ...next.experimental,
          clash_api: { ...(clashApi as Record<string, unknown>), external_ui_download_detour: newTag },
        };
      }
    }
  }
  if (next.ntp && typeof next.ntp === "object" && !Array.isArray(next.ntp)) {
    const ntpDetour = (next.ntp as Record<string, unknown>).detour;
    if (ntpDetour === oldTag) {
      next.ntp = { ...next.ntp, detour: newTag };
    }
  }
  return next;
}

export function deleteEntity(config: SingBoxConfig, ref: EntityRef): SingBoxConfig {
  const next = cloneConfig(config);
  if (ref.kind === "inbound") {
    next.inbounds = (next.inbounds ?? []).filter((item) => item.tag !== ref.tag);
    next.route?.rules?.forEach((rule) => {
      rule.inbound = removeTagRef(rule.inbound, ref.tag);
    });
    next.dns?.rules?.forEach((rule) => {
      rule.inbound = removeTagRef(rule.inbound, ref.tag);
    });
    next.services = next.services?.map((service) => {
      if (!service.servers || typeof service.servers !== "object" || Array.isArray(service.servers)) return service;
      return {
        ...service,
        servers: Object.fromEntries(Object.entries(service.servers).filter(([, tag]) => tag !== ref.tag)),
      };
    });
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
      detour: typeof item.detour === "string" && item.detour === ref.tag ? undefined : item.detour,
    }));
    next.services = next.services?.map((item) => ({
      ...item,
      detour: item.detour === ref.tag ? undefined : item.detour,
    }));
    next.dns?.servers?.forEach((server) => {
      if (server.detour === ref.tag) server.detour = undefined;
    });
    if (next.route?.rule_set) {
      next.route.rule_set = next.route.rule_set.map((item) => {
        const value = (item as Record<string, unknown>).download_detour;
        if (value === ref.tag) return { ...item, download_detour: undefined } as TaggedConfig;
        return item;
      });
    }
    if (next.experimental && typeof next.experimental === "object" && !Array.isArray(next.experimental)) {
      const clashApi = (next.experimental as Record<string, unknown>).clash_api;
      if (
        clashApi &&
        typeof clashApi === "object" &&
        !Array.isArray(clashApi) &&
        (clashApi as Record<string, unknown>).external_ui_download_detour === ref.tag
      ) {
        next.experimental = {
          ...next.experimental,
          clash_api: { ...(clashApi as Record<string, unknown>), external_ui_download_detour: undefined },
        };
      }
    }
    if (
      next.ntp &&
      typeof next.ntp === "object" &&
      !Array.isArray(next.ntp) &&
      (next.ntp as Record<string, unknown>).detour === ref.tag
    ) {
      next.ntp = { ...next.ntp, detour: undefined };
    }
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
  if (ref.kind === "endpoint") {
    next.endpoints = (next.endpoints ?? []).filter((item) => item.tag !== ref.tag);
    next.dns?.servers?.forEach((server) => {
      if (server.endpoint === ref.tag) server.endpoint = undefined;
    });
    next.services = next.services?.map((item) => ({
      ...item,
      verify_client_endpoint: removeTagRef(item.verify_client_endpoint as string | string[] | undefined, ref.tag),
    }));
    next.certificate_providers = next.certificate_providers?.map((item) => ({
      ...item,
      endpoint: item.endpoint === ref.tag ? undefined : item.endpoint,
    }));
  }
  if (ref.kind === "service") {
    next.services = (next.services ?? []).filter((item) => item.tag !== ref.tag);
  }
  if (ref.kind === "rule-set") {
    if (next.route?.rule_set) {
      next.route.rule_set = next.route.rule_set.filter((item) => item.tag !== ref.tag);
    }
    next.route?.rules?.forEach((rule) => {
      rule.rule_set = removeRuleSetRef(rule.rule_set, ref.tag);
    });
    next.dns?.rules?.forEach((rule) => {
      rule.rule_set = removeRuleSetRef(rule.rule_set, ref.tag);
    });
  }
  if (ref.kind === "route-rule") return deleteRouteRule(config, ref.index);
  if (ref.kind === "dns-rule") return deleteDnsRule(config, ref.index);
  if (ref.kind === "settings") {
    delete next[ref.path];
  }
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
  if (relation === "route-rule-inbound") {
    const index = Number(parts[2]);
    const tag = parts[3];
    if (Number.isInteger(index) && tag && next.route?.rules?.[index]) {
      next.route.rules[index].inbound = removeTagRef(next.route.rules[index].inbound, tag);
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
  if (relation === "dns-rule-inbound") {
    const index = Number(parts[2]);
    const tag = parts[3];
    if (Number.isInteger(index) && tag && next.dns?.rules?.[index]) {
      next.dns.rules[index].inbound = removeTagRef(next.dns.rules[index].inbound, tag);
    }
  }
  if (relation === "route-rule-set") {
    const index = Number(parts[2]);
    const tag = parts[3];
    if (Number.isInteger(index) && tag && next.route?.rules?.[index]) {
      next.route.rules[index].rule_set = removeRuleSetRef(next.route.rules[index].rule_set, tag);
    }
  }
  if (relation === "dns-rule-set") {
    const index = Number(parts[2]);
    const tag = parts[3];
    if (Number.isInteger(index) && tag && next.dns?.rules?.[index]) {
      next.dns.rules[index].rule_set = removeRuleSetRef(next.dns.rules[index].rule_set, tag);
    }
  }
  if (relation === "dns-server-endpoint") {
    const serverTag = parts[2];
    const endpointTag = parts[3];
    if (serverTag && endpointTag) {
      next.dns?.servers?.forEach((server) => {
        if (server.tag === serverTag && server.endpoint === endpointTag) server.endpoint = undefined;
      });
    }
  }
  if (relation === "endpoint-detour") {
    const endpointTag = parts[2];
    if (endpointTag) {
      next.endpoints = next.endpoints?.map((endpoint) =>
        endpoint.tag === endpointTag ? { ...endpoint, detour: undefined } : endpoint,
      );
    }
  }
  return next;
}
