import type { SingBoxChannel, SingBoxConfig } from "./types";

export const STABLE_MINIMAL_CONFIG: SingBoxConfig = {
  log: {
    level: "info",
  },
  inbounds: [],
  outbounds: [
    {
      type: "direct",
      tag: "direct",
    },
  ],
  route: {
    final: "direct",
  },
};

export const STABLE_TUN_SPLIT_CONFIG: SingBoxConfig = {
  log: {
    level: "info",
  },
  dns: {
    servers: [
      {
        type: "local",
        tag: "local-dns",
      },
      {
        type: "https",
        tag: "remote-doh",
        server: "1.1.1.1",
        server_port: 443,
        path: "/dns-query",
        detour: "proxy",
      },
    ],
    rules: [
      {
        domain_suffix: ["cn"],
        server: "local-dns",
      },
    ],
    final: "remote-doh",
  },
  inbounds: [
    {
      type: "tun",
      tag: "tun-in",
      address: ["172.19.0.1/30"],
      auto_route: true,
    },
  ],
  outbounds: [
    {
      type: "direct",
      tag: "direct",
    },
    {
      type: "block",
      tag: "block",
    },
    {
      type: "socks",
      tag: "hk",
      server: "127.0.0.1",
      server_port: 1081,
    },
    {
      type: "socks",
      tag: "jp",
      server: "127.0.0.1",
      server_port: 1082,
    },
    {
      type: "urltest",
      tag: "auto",
      outbounds: ["hk", "jp"],
      url: "https://www.gstatic.com/generate_204",
      interval: "3m",
    },
    {
      type: "selector",
      tag: "proxy",
      outbounds: ["hk", "jp", "auto"],
      default: "auto",
    },
  ],
  route: {
    rules: [
      {
        domain_suffix: ["cn"],
        outbound: "direct",
      },
      {
        domain_keyword: ["ads"],
        outbound: "block",
      },
    ],
    final: "proxy",
    auto_detect_interface: true,
    default_domain_resolver: "local-dns",
  },
};

export const LEGACY_112_SPLIT_CONFIG: SingBoxConfig = {
  log: {
    level: "info",
  },
  dns: {
    servers: [
      {
        type: "local",
        tag: "local-dns",
      },
      {
        type: "https",
        tag: "remote-doh",
        server: "1.1.1.1",
        server_port: 443,
        path: "/dns-query",
        detour: "proxy",
      },
    ],
    rules: [
      {
        domain_suffix: ["cn"],
        server: "local-dns",
      },
    ],
    final: "remote-doh",
  },
  inbounds: [
    {
      type: "mixed",
      tag: "mixed-in",
      listen: "127.0.0.1",
      listen_port: 2080,
    },
  ],
  outbounds: [
    {
      type: "direct",
      tag: "direct",
    },
    {
      type: "block",
      tag: "block",
    },
    {
      type: "socks",
      tag: "hk",
      server: "127.0.0.1",
      server_port: 1081,
    },
    {
      type: "socks",
      tag: "jp",
      server: "127.0.0.1",
      server_port: 1082,
    },
    {
      type: "selector",
      tag: "proxy",
      outbounds: ["hk", "jp"],
      default: "hk",
    },
  ],
  route: {
    rules: [
      {
        domain_suffix: ["cn"],
        outbound: "direct",
      },
      {
        domain_keyword: ["ads"],
        outbound: "block",
      },
    ],
    final: "proxy",
    auto_detect_interface: true,
    default_domain_resolver: "local-dns",
  },
};

export const TESTING_114_SPLIT_CONFIG: SingBoxConfig = {
  ...STABLE_TUN_SPLIT_CONFIG,
  http_clients: [
    {
      tag: "remote-client",
      engine: "go",
    },
  ],
};

const OFFICIAL_CLIENT_DOCS_URL = "https://sing-box.sagernet.org/manual/proxy/client/#examples";

export const OFFICIAL_CLIENT_TUN_IPV4_CONFIG: SingBoxConfig = {
  dns: {
    servers: [
      {
        tag: "google",
        type: "tls",
        server: "8.8.8.8",
      },
      {
        tag: "local",
        type: "udp",
        server: "223.5.5.5",
      },
    ],
    strategy: "ipv4_only",
  },
  inbounds: [
    {
      type: "tun",
      tag: "tun-in",
      address: ["172.19.0.1/30"],
      auto_route: true,
      strict_route: true,
    },
  ],
  outbounds: [
    {
      type: "direct",
      tag: "direct",
    },
  ],
  route: {
    rules: [
      {
        action: "sniff",
      },
      {
        protocol: "dns",
        action: "hijack-dns",
      },
      {
        ip_is_private: true,
        outbound: "direct",
      },
    ],
    default_domain_resolver: "local",
    auto_detect_interface: true,
  },
};

export const OFFICIAL_CLIENT_TUN_DUAL_STACK_CONFIG: SingBoxConfig = {
  dns: {
    servers: [
      {
        tag: "google",
        type: "tls",
        server: "8.8.8.8",
      },
      {
        tag: "local",
        type: "udp",
        server: "223.5.5.5",
      },
    ],
  },
  inbounds: [
    {
      type: "tun",
      tag: "tun-in",
      address: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"],
      auto_route: true,
      strict_route: true,
    },
  ],
  outbounds: [
    {
      type: "direct",
      tag: "direct",
    },
  ],
  route: {
    rules: [
      {
        action: "sniff",
      },
      {
        protocol: "dns",
        action: "hijack-dns",
      },
      {
        ip_is_private: true,
        outbound: "direct",
      },
    ],
    default_domain_resolver: "local",
    auto_detect_interface: true,
  },
};

export const OFFICIAL_CLIENT_TUN_FAKEIP_CONFIG: SingBoxConfig = {
  dns: {
    servers: [
      {
        tag: "google",
        type: "tls",
        server: "8.8.8.8",
      },
      {
        tag: "local",
        type: "udp",
        server: "223.5.5.5",
      },
      {
        tag: "remote",
        type: "fakeip",
        inet4_range: "198.18.0.0/15",
        inet6_range: "fc00::/18",
      },
    ],
    rules: [
      {
        query_type: ["A", "AAAA"],
        server: "remote",
      },
    ],
    independent_cache: true,
  },
  inbounds: [
    {
      type: "tun",
      tag: "tun-in",
      address: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"],
      auto_route: true,
      strict_route: true,
    },
  ],
  outbounds: [
    {
      type: "direct",
      tag: "direct",
    },
  ],
  route: {
    rules: [
      {
        action: "sniff",
      },
      {
        protocol: "dns",
        action: "hijack-dns",
      },
      {
        ip_is_private: true,
        outbound: "direct",
      },
    ],
    default_domain_resolver: "local",
    auto_detect_interface: true,
  },
};

const OFFICIAL_CHINA_RULE_SETS = [
  {
    type: "remote",
    tag: "geosite-geolocation-cn",
    format: "binary",
    url: "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-geolocation-cn.srs",
  },
  {
    type: "remote",
    tag: "geosite-geolocation-!cn",
    format: "binary",
    url: "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-geolocation-!cn.srs",
  },
  {
    type: "remote",
    tag: "geoip-cn",
    format: "binary",
    url: "https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set/geoip-cn.srs",
  },
];

export const OFFICIAL_CLIENT_BYPASS_DNS_LEAK_CONFIG: SingBoxConfig = {
  dns: {
    servers: [
      {
        tag: "google",
        type: "tls",
        server: "8.8.8.8",
      },
      {
        tag: "local",
        type: "https",
        server: "223.5.5.5",
      },
    ],
    rules: [
      {
        rule_set: "geosite-geolocation-cn",
        server: "local",
      },
      {
        type: "logical",
        mode: "and",
        rules: [
          {
            rule_set: "geosite-geolocation-!cn",
            invert: true,
          },
          {
            rule_set: "geoip-cn",
          },
        ],
        server: "local",
      },
    ],
  },
  route: {
    default_domain_resolver: "local",
    rule_set: OFFICIAL_CHINA_RULE_SETS,
  },
  experimental: {
    cache_file: {
      enabled: true,
      store_rdrc: true,
    },
    clash_api: {
      default_mode: "Enhanced",
    },
  },
};

export const OFFICIAL_CLIENT_BYPASS_NO_LEAK_CONFIG: SingBoxConfig = {
  dns: {
    servers: [
      {
        tag: "google",
        type: "tls",
        server: "8.8.8.8",
      },
      {
        tag: "local",
        type: "https",
        server: "223.5.5.5",
      },
    ],
    rules: [
      {
        rule_set: "geosite-geolocation-cn",
        server: "local",
      },
      {
        type: "logical",
        mode: "and",
        rules: [
          {
            rule_set: "geosite-geolocation-!cn",
            invert: true,
          },
          {
            rule_set: "geoip-cn",
          },
        ],
        server: "google",
        client_subnet: "114.114.114.114/24",
      },
    ],
  },
  route: {
    default_domain_resolver: "local",
    rule_set: OFFICIAL_CHINA_RULE_SETS,
  },
  experimental: {
    cache_file: {
      enabled: true,
      store_rdrc: true,
    },
    clash_api: {
      default_mode: "Enhanced",
    },
  },
};

export const OFFICIAL_CLIENT_BYPASS_ROUTE_RULES_CONFIG: SingBoxConfig = {
  outbounds: [
    {
      type: "direct",
      tag: "direct",
    },
  ],
  route: {
    rules: [
      {
        action: "sniff",
      },
      {
        type: "logical",
        mode: "or",
        rules: [
          {
            protocol: "dns",
          },
          {
            port: 53,
          },
        ],
        action: "hijack-dns",
      },
      {
        ip_is_private: true,
        outbound: "direct",
      },
      {
        type: "logical",
        mode: "or",
        rules: [
          {
            port: 853,
          },
          {
            network: "udp",
            port: 443,
          },
          {
            protocol: "stun",
          },
        ],
        action: "reject",
      },
      {
        rule_set: "geosite-geolocation-cn",
        outbound: "direct",
      },
      {
        type: "logical",
        mode: "and",
        rules: [
          {
            rule_set: "geoip-cn",
          },
          {
            rule_set: "geosite-geolocation-!cn",
            invert: true,
          },
        ],
        outbound: "direct",
      },
    ],
    rule_set: [
      {
        type: "remote",
        tag: "geoip-cn",
        format: "binary",
        url: "https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set/geoip-cn.srs",
      },
      {
        type: "remote",
        tag: "geosite-geolocation-cn",
        format: "binary",
        url: "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-geolocation-cn.srs",
      },
    ],
  },
};

export const TEMPLATE_PRESET_IDS = [
  "template-1.13",
  "template-1.12",
  "template-1.14",
  "template-official-client-tun-ipv4",
  "template-official-client-tun-dual-stack",
  "template-official-client-tun-fakeip",
  "template-official-client-bypass-dns-leak",
  "template-official-client-bypass-no-leak",
  "template-official-client-bypass-route-rules",
] as const;

export type TemplatePresetId = (typeof TEMPLATE_PRESET_IDS)[number];

export type TemplatePreset = {
  id: TemplatePresetId;
  label: string;
  channel: SingBoxChannel;
  version: string;
  config: SingBoxConfig;
  docsUrl?: string;
};

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: "template-1.13",
    label: "1.13 stable tun split",
    channel: "stable",
    version: "1.13",
    config: STABLE_TUN_SPLIT_CONFIG,
  },
  {
    id: "template-1.12",
    label: "1.12 legacy mixed split",
    channel: "stable",
    version: "1.12",
    config: LEGACY_112_SPLIT_CONFIG,
  },
  {
    id: "template-1.14",
    label: "1.14 testing http client",
    channel: "testing",
    version: "1.14",
    config: TESTING_114_SPLIT_CONFIG,
  },
  {
    id: "template-official-client-tun-ipv4",
    label: "official client tun ipv4",
    channel: "stable",
    version: "1.13",
    config: OFFICIAL_CLIENT_TUN_IPV4_CONFIG,
    docsUrl: OFFICIAL_CLIENT_DOCS_URL,
  },
  {
    id: "template-official-client-tun-dual-stack",
    label: "official client tun ipv4 + ipv6",
    channel: "stable",
    version: "1.13",
    config: OFFICIAL_CLIENT_TUN_DUAL_STACK_CONFIG,
    docsUrl: OFFICIAL_CLIENT_DOCS_URL,
  },
  {
    id: "template-official-client-tun-fakeip",
    label: "official client tun fakeip",
    channel: "stable",
    version: "1.13",
    config: OFFICIAL_CLIENT_TUN_FAKEIP_CONFIG,
    docsUrl: OFFICIAL_CLIENT_DOCS_URL,
  },
  {
    id: "template-official-client-bypass-dns-leak",
    label: "official client bypass dns leak",
    channel: "stable",
    version: "1.13",
    config: OFFICIAL_CLIENT_BYPASS_DNS_LEAK_CONFIG,
    docsUrl: OFFICIAL_CLIENT_DOCS_URL,
  },
  {
    id: "template-official-client-bypass-no-leak",
    label: "official client bypass no leak",
    channel: "stable",
    version: "1.13",
    config: OFFICIAL_CLIENT_BYPASS_NO_LEAK_CONFIG,
    docsUrl: OFFICIAL_CLIENT_DOCS_URL,
  },
  {
    id: "template-official-client-bypass-route-rules",
    label: "official client bypass route rules",
    channel: "stable",
    version: "1.13",
    config: OFFICIAL_CLIENT_BYPASS_ROUTE_RULES_CONFIG,
    docsUrl: OFFICIAL_CLIENT_DOCS_URL,
  },
];

export function createTemplatePreset(id: TemplatePresetId) {
  const preset = TEMPLATE_PRESETS.find((item) => item.id === id) ?? TEMPLATE_PRESETS[0];
  if (!preset) throw new Error(`Unknown template preset: ${id}`);
  return {
    id: preset.id,
    label: preset.label,
    channel: preset.channel,
    version: preset.version,
    config: cloneConfig(preset.config),
  };
}

export function cloneConfig(config: SingBoxConfig): SingBoxConfig {
  return structuredClone(config) as SingBoxConfig;
}
