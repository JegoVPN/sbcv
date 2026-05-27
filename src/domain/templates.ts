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

const PRESET_OUTBOUND_SG_SS = {
  type: "shadowsocks",
  tag: "SG-ss",
  server: "127.0.0.1",
  server_port: 8388,
  method: "2022-blake3-aes-128-gcm",
  password: "REPLACE_ME_PSK",
};

const PRESET_OUTBOUND_JP_ANYTLS = {
  type: "anytls",
  tag: "JP-anytls",
  server: "127.0.0.1",
  server_port: 8443,
  password: "REPLACE_ME_PASSWORD",
  tls: {
    enabled: true,
    server_name: "jp.example.com",
  },
};

const PRESET_OUTBOUND_HK_HY2 = {
  type: "hysteria2",
  tag: "HK-hy2",
  server: "127.0.0.1",
  server_port: 36713,
  password: "REPLACE_ME_PASSWORD",
  tls: {
    enabled: true,
    server_name: "hk.example.com",
  },
};

const CLASH2SFA_112_DOCS_URL =
  "https://github.com/xmdhs/clash2sfa/blob/master/provide/static/config.json-1.12.0%2B.template";

export const LEGACY_112_SPLIT_CONFIG: SingBoxConfig = {
  log: {},
  dns: {
    servers: [
      {
        tag: "remote",
        type: "https",
        server: "8.8.8.8",
        detour: "select",
      },
      {
        tag: "local",
        type: "https",
        server: "223.5.5.5",
      },
      {
        type: "fakeip",
        tag: "fakeip",
        inet4_range: "198.18.0.0/15",
        inet6_range: "2001:0470:f9da:fdfa::1/64",
      },
    ],
    rules: [
      {
        rule_set: ["AdGuardSDNSFilter", "chrome-doh"],
        action: "predefined",
      },
      {
        query_type: "HTTPS",
        action: "predefined",
      },
      {
        query_type: ["A", "AAAA"],
        rewrite_ttl: 1,
        server: "fakeip",
      },
      {
        clash_mode: "global",
        server: "remote",
      },
      {
        clash_mode: "direct",
        server: "local",
      },
      {
        rule_set: "geosite-cn",
        server: "local",
      },
      {
        rule_set: "ext-cn-domain",
        server: "local",
      },
    ],
    strategy: "prefer_ipv4",
    independent_cache: true,
  },
  inbounds: [
    {
      type: "tun",
      tag: "tun-in",
      address: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"],
      strict_route: true,
      mtu: 9000,
      endpoint_independent_nat: true,
      auto_route: true,
    },
    {
      type: "socks",
      tag: "socks-in",
      listen: "127.0.0.1",
      listen_port: 2333,
    },
    {
      type: "mixed",
      tag: "mixed-in",
      listen: "127.0.0.1",
      listen_port: 2334,
    },
  ],
  outbounds: [
    {
      type: "direct",
      tag: "direct",
    },
    PRESET_OUTBOUND_SG_SS,
    PRESET_OUTBOUND_JP_ANYTLS,
    PRESET_OUTBOUND_HK_HY2,
    {
      type: "selector",
      tag: "select",
      outbounds: ["SG-ss", "JP-anytls", "HK-hy2", "direct"],
      default: "SG-ss",
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
        action: "resolve",
        strategy: "prefer_ipv4",
      },
      {
        clash_mode: "direct",
        outbound: "direct",
      },
      {
        clash_mode: "global",
        outbound: "select",
      },
      {
        ip_is_private: true,
        outbound: "direct",
      },
      {
        rule_set: "geoip-cn",
        outbound: "direct",
      },
    ],
    auto_detect_interface: true,
    default_domain_resolver: {
      server: "local",
    },
    rule_set: [
      {
        tag: "geoip-cn",
        type: "remote",
        format: "binary",
        url: "https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set/geoip-cn.srs",
      },
      {
        tag: "geosite-cn",
        type: "remote",
        format: "binary",
        url: "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-geolocation-cn.srs",
      },
      {
        tag: "AdGuardSDNSFilter",
        type: "remote",
        format: "binary",
        url: "https://raw.githubusercontent.com/xmdhs/sing-box-ruleset/rule-set/AdGuardSDNSFilterSingBox.srs",
      },
      {
        tag: "chrome-doh",
        type: "remote",
        format: "source",
        url: "https://gist.githubusercontent.com/xmdhs/71fc5ff6ef29f5ecaf2c52b8de5c3172/raw/chrome-doh.json",
      },
      {
        tag: "ext-cn-domain",
        type: "remote",
        format: "binary",
        url: "https://raw.githubusercontent.com/xmdhs/cn-domain-list/rule-set/ext-cn-list.srs",
      },
    ],
  },
  experimental: {
    cache_file: {
      enabled: true,
    },
    clash_api: {
      external_controller: "127.0.0.1:9090",
      secret: "",
    },
  },
};

const SUBSCRIBE_114_DOCS_URL =
  "https://github.com/Toperlock/sing-box-subscribe/blob/main/config_template/sb-config-1.14.json";

const SUBSCRIBE_114_PROXY_CANDIDATES = ["HK-hy2", "SG-ss", "JP-anytls"];

export const TESTING_114_SPLIT_CONFIG: SingBoxConfig = {
  log: {
    level: "info",
    timestamp: true,
  },
  experimental: {
    clash_api: {
      external_controller: "127.0.0.1:9090",
      external_ui: "ui",
      secret: "",
      external_ui_download_url:
        "https://gh-proxy.com/https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip",
      external_ui_download_detour: "direct",
      default_mode: "rule",
    },
    cache_file: {
      enabled: true,
      store_fakeip: true,
      store_dns: true,
    },
  },
  dns: {
    servers: [
      { tag: "local", type: "local" },
      {
        tag: "hosts",
        type: "hosts",
        predefined: {
          "dns.alidns.com": ["223.5.5.5", "223.6.6.6"],
          "dns.google": ["8.8.8.8", "8.8.4.4"],
        },
      },
      {
        tag: "alidns",
        type: "https",
        server: "dns.alidns.com",
        domain_resolver: "hosts",
      },
      {
        tag: "ggdns",
        type: "https",
        server: "dns.google",
        domain_resolver: "hosts",
        detour: "Proxy",
      },
      {
        tag: "fakeip",
        type: "fakeip",
        inet4_range: "198.18.0.0/15",
        inet6_range: "fc00::/18",
      },
    ],
    rules: [
      { clash_mode: "direct", server: "local" },
      { clash_mode: "global", server: "ggdns" },
      { query_type: ["A", "AAAA"], server: "fakeip" },
      { rule_set: "geosite-cn", server: "local" },
      { action: "evaluate", server: "alidns" },
      { match_response: true, rule_set: "geoip-cn", action: "respond" },
    ],
    final: "ggdns",
    strategy: "prefer_ipv4",
  },
  inbounds: [
    {
      tag: "tun-in",
      type: "tun",
      address: ["172.19.0.0/30", "fdfe:dcba:9876::0/126"],
      stack: "system",
      auto_route: true,
      strict_route: true,
      platform: {
        http_proxy: {
          enabled: true,
          server: "127.0.0.1",
          server_port: 7890,
        },
      },
    },
    {
      tag: "mixed-in",
      type: "mixed",
      listen: "127.0.0.1",
      listen_port: 7890,
    },
  ],
  outbounds: [
    PRESET_OUTBOUND_HK_HY2,
    PRESET_OUTBOUND_SG_SS,
    PRESET_OUTBOUND_JP_ANYTLS,
    {
      tag: "Proxy",
      type: "selector",
      outbounds: ["auto", "direct", ...SUBSCRIBE_114_PROXY_CANDIDATES],
    },
    {
      tag: "OpenAI",
      type: "selector",
      outbounds: ["TaiWan", "Singapore", "Japan", "America", "Others"],
      default: "America",
    },
    {
      tag: "Google",
      type: "selector",
      outbounds: ["HongKong", "TaiWan", "Singapore", "Japan", "America", "Others"],
    },
    {
      tag: "Telegram",
      type: "selector",
      outbounds: ["HongKong", "TaiWan", "Singapore", "Japan", "America", "Others"],
    },
    {
      tag: "Twitter",
      type: "selector",
      outbounds: ["HongKong", "TaiWan", "Singapore", "Japan", "America", "Others"],
    },
    {
      tag: "Facebook",
      type: "selector",
      outbounds: ["HongKong", "TaiWan", "Singapore", "Japan", "America", "Others"],
    },
    {
      tag: "BiliBili",
      type: "selector",
      outbounds: ["direct", "HongKong", "TaiWan"],
    },
    {
      tag: "Bahamut",
      type: "selector",
      outbounds: ["TaiWan", "Proxy"],
    },
    {
      tag: "Spotify",
      type: "selector",
      outbounds: ["HongKong", "TaiWan", "Singapore", "Japan", "America", "Others"],
      default: "America",
    },
    {
      tag: "TikTok",
      type: "selector",
      outbounds: ["HongKong", "TaiWan", "Singapore", "Japan", "America"],
      default: "America",
    },
    {
      tag: "Netflix",
      type: "selector",
      outbounds: ["HongKong", "TaiWan", "Singapore", "Japan", "America", "Others"],
    },
    {
      tag: "Disney+",
      type: "selector",
      outbounds: ["HongKong", "TaiWan", "Singapore", "Japan", "America", "Others"],
    },
    {
      tag: "Apple",
      type: "selector",
      outbounds: ["direct", "HongKong", "TaiWan", "Singapore", "Japan", "America", "Others"],
    },
    {
      tag: "Microsoft",
      type: "selector",
      outbounds: ["direct", "HongKong", "TaiWan", "Singapore", "Japan", "America", "Others"],
    },
    {
      tag: "Games",
      type: "selector",
      outbounds: ["direct", "HongKong", "TaiWan", "Singapore", "Japan", "America", "Others"],
      default: "Japan",
    },
    {
      tag: "Streaming",
      type: "selector",
      outbounds: ["HongKong", "TaiWan", "Singapore", "Japan", "America", "Others"],
    },
    {
      tag: "Global",
      type: "selector",
      outbounds: ["HongKong", "TaiWan", "Singapore", "Japan", "America", "Others", "direct"],
    },
    {
      tag: "China",
      type: "selector",
      outbounds: ["direct", "Proxy"],
    },
    {
      tag: "HongKong",
      type: "selector",
      outbounds: ["HK-hy2"],
    },
    {
      tag: "TaiWan",
      type: "selector",
      outbounds: [...SUBSCRIBE_114_PROXY_CANDIDATES],
    },
    {
      tag: "Singapore",
      type: "selector",
      outbounds: ["SG-ss"],
    },
    {
      tag: "Japan",
      type: "selector",
      outbounds: ["JP-anytls"],
    },
    {
      tag: "America",
      type: "selector",
      outbounds: [...SUBSCRIBE_114_PROXY_CANDIDATES],
    },
    {
      tag: "Others",
      type: "selector",
      outbounds: [...SUBSCRIBE_114_PROXY_CANDIDATES],
    },
    {
      tag: "auto",
      type: "urltest",
      outbounds: [...SUBSCRIBE_114_PROXY_CANDIDATES],
      url: "http://www.gstatic.com/generate_204",
      interval: "10m",
      tolerance: 50,
    },
    {
      type: "direct",
      tag: "direct",
    },
  ],
  http_clients: [
    { tag: "default", detour: "Proxy" },
    { tag: "client-direct", detour: "direct" },
  ],
  route: {
    default_domain_resolver: {
      server: "local",
    },
    auto_detect_interface: true,
    final: "Proxy",
    rules: [
      { inbound: ["tun-in", "mixed-in"], action: "sniff" },
      {
        type: "logical",
        mode: "or",
        rules: [{ port: 53 }, { protocol: "dns" }],
        action: "hijack-dns",
      },
      {
        rule_set: "geosite-category-ads-all",
        clash_mode: "rule",
        action: "reject",
      },
      {
        rule_set: "geosite-category-ads-all",
        clash_mode: "global",
        outbound: "Proxy",
      },
      { clash_mode: "direct", outbound: "direct" },
      { clash_mode: "global", outbound: "Proxy" },
      {
        domain: [
          "clash.razord.top",
          "yacd.metacubex.one",
          "yacd.haishan.me",
          "d.metacubex.one",
        ],
        outbound: "direct",
      },
      { ip_is_private: true, outbound: "direct" },
      { rule_set: "geosite-openai", outbound: "OpenAI" },
      {
        rule_set: ["geosite-youtube", "geoip-google", "geosite-google", "geosite-github"],
        outbound: "Google",
      },
      { rule_set: ["geoip-telegram", "geosite-telegram"], outbound: "Telegram" },
      { rule_set: ["geoip-twitter", "geosite-twitter"], outbound: "Twitter" },
      { rule_set: ["geoip-facebook", "geosite-facebook"], outbound: "Facebook" },
      { rule_set: "geosite-bilibili", outbound: "BiliBili" },
      { rule_set: "geosite-bahamut", outbound: "Bahamut" },
      { rule_set: "geosite-spotify", outbound: "Spotify" },
      { rule_set: "geosite-tiktok", outbound: "TikTok" },
      { rule_set: ["geoip-netflix", "geosite-netflix"], outbound: "Netflix" },
      { rule_set: "geosite-disney", outbound: "Disney+" },
      { rule_set: ["geoip-apple", "geosite-apple", "geosite-amazon"], outbound: "Apple" },
      { rule_set: "geosite-microsoft", outbound: "Microsoft" },
      { rule_set: ["geosite-category-games", "geosite-dmm"], outbound: "Games" },
      { rule_set: ["geosite-hbo", "geosite-primevideo"], outbound: "Streaming" },
      { rule_set: "geosite-geolocation-!cn", outbound: "Global" },
      { rule_set: ["geoip-cn", "geosite-cn"], outbound: "China" },
    ],
    rule_set: [
      { tag: "geosite-category-ads-all", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/category-ads-all.srs", http_client: "default" },
      { tag: "geosite-openai", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/Toperlock/sing-box-geosite/main/rule/OpenAI.srs", http_client: "default" },
      { tag: "geosite-youtube", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/youtube.srs", http_client: "default" },
      { tag: "geoip-google", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geoip/google.srs", http_client: "default" },
      { tag: "geosite-google", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/google.srs", http_client: "default" },
      { tag: "geosite-github", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/github.srs", http_client: "default" },
      { tag: "geoip-telegram", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geoip/telegram.srs", http_client: "default" },
      { tag: "geosite-telegram", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/telegram.srs", http_client: "default" },
      { tag: "geoip-twitter", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geoip/twitter.srs", http_client: "default" },
      { tag: "geosite-twitter", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/twitter.srs", http_client: "default" },
      { tag: "geoip-facebook", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geoip/facebook.srs", http_client: "default" },
      { tag: "geosite-facebook", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/facebook.srs", http_client: "default" },
      { tag: "geosite-bilibili", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/bilibili.srs", http_client: "default" },
      { tag: "geosite-bahamut", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/bahamut.srs", http_client: "default" },
      { tag: "geosite-spotify", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/spotify.srs", http_client: "default" },
      { tag: "geosite-tiktok", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/tiktok.srs", http_client: "default" },
      { tag: "geoip-netflix", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geoip/netflix.srs", http_client: "default" },
      { tag: "geosite-netflix", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/netflix.srs", http_client: "default" },
      { tag: "geosite-disney", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/disney.srs", http_client: "default" },
      { tag: "geoip-apple", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo-lite/geoip/apple.srs", http_client: "default" },
      { tag: "geosite-apple", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/apple.srs", http_client: "default" },
      { tag: "geosite-amazon", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/amazon.srs", http_client: "default" },
      { tag: "geosite-microsoft", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/microsoft.srs", http_client: "default" },
      { tag: "geosite-category-games", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/category-games.srs", http_client: "default" },
      { tag: "geosite-dmm", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/dmm.srs", http_client: "default" },
      { tag: "geosite-hbo", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/hbo.srs", http_client: "default" },
      { tag: "geosite-primevideo", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/primevideo.srs", http_client: "default" },
      { tag: "geosite-geolocation-!cn", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/geolocation-!cn.srs", http_client: "default" },
      { tag: "geoip-cn", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geoip/cn.srs", http_client: "default" },
      { tag: "geosite-cn", type: "remote", format: "binary", url: "https://gh-proxy.com/raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/cn.srs", http_client: "default" },
    ],
  },
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

const CATBOX_113_DOCS_URL = "https://files.catbox.moe/uw17zj.json";

const CATBOX_113_PROXY_CANDIDATES = ["HK-hy2", "SG-ss", "JP-anytls"];

export const CATBOX_113_TEMPLATE_CONFIG: SingBoxConfig = {
  experimental: {
    clash_api: {
      external_controller: "127.0.0.1:9090",
      external_ui: "ui",
      secret: "",
      external_ui_download_url:
        "https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip",
      external_ui_download_detour: "Default",
      default_mode: "rule",
    },
    cache_file: {
      enabled: true,
      rdrc_timeout: "7d",
    },
  },
  log: {
    level: "info",
    timestamp: true,
  },
  dns: {
    servers: [
      { tag: "cn_bootstrap", type: "udp", server: "223.5.5.5", server_port: 53 },
      {
        tag: "proxy_bootstrap",
        type: "udp",
        server: "1.1.1.1",
        server_port: 53,
        detour: "Default",
        domain_resolver: "cn_bootstrap",
      },
      {
        tag: "cn_dns",
        type: "tls",
        server: "223.5.5.5",
        server_port: 853,
        domain_resolver: "cn_bootstrap",
      },
      {
        tag: "proxy_dns",
        type: "tls",
        server: "1.1.1.1",
        server_port: 853,
        detour: "Default",
        domain_resolver: "proxy_bootstrap",
      },
      {
        tag: "paypal_dns",
        type: "tls",
        server: "8.8.8.8",
        server_port: 853,
        detour: "PayPal",
        domain_resolver: "proxy_bootstrap",
      },
      {
        tag: "ai_dns",
        type: "tls",
        server: "8.8.8.8",
        server_port: 853,
        detour: "AI-Service",
        domain_resolver: "proxy_bootstrap",
      },
      {
        tag: "tiktok_dns",
        type: "tls",
        server: "8.8.8.8",
        server_port: 853,
        detour: "TikTok",
        domain_resolver: "proxy_bootstrap",
      },
      {
        tag: "media_dns",
        type: "tls",
        server: "8.8.8.8",
        server_port: 853,
        detour: "Streaming-Media",
        domain_resolver: "proxy_bootstrap",
      },
      {
        tag: "telegram_dns",
        type: "tls",
        server: "8.8.8.8",
        server_port: 853,
        detour: "Telegram",
        domain_resolver: "proxy_bootstrap",
      },
      {
        tag: "instagram_dns",
        type: "tls",
        server: "8.8.8.8",
        server_port: 853,
        detour: "Instagram",
        domain_resolver: "proxy_bootstrap",
      },
      {
        tag: "emby_dns",
        type: "tls",
        server: "8.8.8.8",
        server_port: 853,
        detour: "Emby",
        domain_resolver: "proxy_bootstrap",
      },
    ],
    rules: [
      { domain_suffix: ["节点订阅域名"], server: "cn_bootstrap" },
      { clash_mode: "direct", server: "cn_dns" },
      { clash_mode: "global", server: "proxy_dns" },
      { rule_set: "paypal", server: "paypal_dns" },
      { rule_set: "aiservice", server: "ai_dns" },
      { rule_set: "tiktok", server: "tiktok_dns" },
      { rule_set: ["netflixsite", "hbo", "disney", "hulu"], server: "media_dns" },
      { rule_set: "telegramsite", server: "telegram_dns" },
      { rule_set: "instagram", server: "instagram_dns" },
      {
        type: "logical",
        mode: "or",
        rules: [{ rule_set: "emby" }, { domain_suffix: ["uhdnow.com"] }],
        server: "emby_dns",
      },
      { rule_set: "gfw", server: "proxy_dns" },
      {
        type: "logical",
        mode: "or",
        rules: [{ domain_suffix: [".cn"] }, { rule_set: "cnsite" }],
        server: "cn_dns",
      },
    ],
    final: "proxy_dns",
    strategy: "ipv4_only",
  },
  inbounds: [
    {
      type: "tun",
      tag: "tun-in",
      interface_name: "singbox_tun",
      address: ["172.18.0.1/30"],
      mtu: 1500,
      auto_route: true,
      route_exclude_address: [
        "10.0.0.0/8",
        "100.64.0.0/10",
        "169.254.0.0/16",
        "172.16.0.0/12",
        "192.0.0.0/24",
        "192.168.0.0/16",
      ],
      strict_route: true,
      endpoint_independent_nat: false,
      stack: "mixed",
    },
    {
      type: "mixed",
      tag: "mixed-in",
      listen: "127.0.0.1",
      listen_port: 7890,
    },
  ],
  outbounds: [
    PRESET_OUTBOUND_HK_HY2,
    PRESET_OUTBOUND_SG_SS,
    PRESET_OUTBOUND_JP_ANYTLS,
    {
      type: "selector",
      tag: "Default",
      interrupt_exist_connections: true,
      outbounds: ["Auto", ...CATBOX_113_PROXY_CANDIDATES],
    },
    {
      type: "urltest",
      tag: "Auto",
      outbounds: [...CATBOX_113_PROXY_CANDIDATES],
      interval: "3m",
      tolerance: 30,
    },
    {
      type: "selector",
      tag: "Relay",
      interrupt_exist_connections: true,
      outbounds: ["Direct-Out"],
    },
    {
      type: "selector",
      tag: "PayPal",
      interrupt_exist_connections: true,
      outbounds: ["Default", "Auto"],
    },
    {
      type: "selector",
      tag: "AI-Service",
      interrupt_exist_connections: true,
      outbounds: ["Default", "Auto"],
    },
    {
      type: "selector",
      tag: "TikTok",
      interrupt_exist_connections: true,
      outbounds: ["Default", "Auto"],
    },
    {
      type: "selector",
      tag: "Streaming-Media",
      interrupt_exist_connections: true,
      outbounds: ["Default", "Auto"],
    },
    {
      type: "selector",
      tag: "Telegram",
      interrupt_exist_connections: true,
      outbounds: ["Default", "Auto"],
    },
    {
      type: "selector",
      tag: "Instagram",
      interrupt_exist_connections: true,
      outbounds: ["Default", "Auto"],
    },
    {
      type: "selector",
      tag: "Emby",
      interrupt_exist_connections: true,
      outbounds: ["Default", "Auto", "Direct-Out"],
    },
    {
      type: "selector",
      tag: "BiliBili",
      interrupt_exist_connections: true,
      outbounds: ["Direct-Out", "Default", "Auto"],
    },
    {
      type: "direct",
      tag: "Direct-Out",
    },
  ],
  route: {
    final: "Default",
    auto_detect_interface: true,
    default_domain_resolver: "proxy_dns",
    rules: [
      {
        type: "logical",
        mode: "and",
        rules: [{ port: 443 }, { network: "udp" }],
        action: "reject",
      },
      { network: "icmp", outbound: "Direct-Out" },
      { action: "sniff", sniffer: ["http", "tls", "quic", "dns"], timeout: "500ms" },
      {
        type: "logical",
        mode: "or",
        rules: [{ protocol: "dns" }, { port: 53 }],
        action: "hijack-dns",
      },
      { ip_is_private: true, outbound: "Direct-Out" },
      { domain_suffix: ["节点订阅域名"], outbound: "Direct-Out" },
      { clash_mode: "direct", outbound: "Direct-Out" },
      { clash_mode: "global", outbound: "Default" },
      { protocol: "quic", action: "reject" },
      { protocol: "bittorrent", outbound: "Direct-Out" },
      { port: [5201], outbound: "Direct-Out" },
      { domain_suffix: ["ottiptv.cc"], outbound: "Direct-Out" },
      { domain_suffix: ["uhdnow.com"], outbound: "Emby" },
      { rule_set: "emby", outbound: "Emby" },
      { rule_set: "paypal", outbound: "PayPal" },
      { rule_set: "telegramsite", outbound: "Telegram" },
      { rule_set: "tiktok", outbound: "TikTok" },
      { rule_set: "instagram", outbound: "Instagram" },
      { rule_set: "aiservice", outbound: "AI-Service" },
      { rule_set: ["netflixsite", "hbo", "disney", "hulu"], outbound: "Streaming-Media" },
      { rule_set: "bilibili", outbound: "BiliBili" },
      { rule_set: "cngames", outbound: "Direct-Out" },
      { rule_set: "gfw", outbound: "Default" },
      { action: "resolve" },
      { rule_set: "telegramip", outbound: "Telegram" },
      { rule_set: "netflixip", outbound: "Streaming-Media" },
      { rule_set: "cnip", outbound: "Direct-Out" },
    ],
    rule_set: [
      { type: "remote", tag: "cnsite", format: "binary", url: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/cn.srs", update_interval: "24h", download_detour: "Direct-Out" },
      { tag: "cnip", type: "remote", format: "binary", url: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geoip/cn.srs", update_interval: "24h", download_detour: "Direct-Out" },
      { tag: "cngames", type: "remote", format: "binary", url: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/category-games-!cn@cn.srs", update_interval: "24h", download_detour: "Direct-Out" },
      { tag: "gfw", type: "remote", format: "binary", url: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/gfw.srs", update_interval: "24h", download_detour: "Direct-Out" },
      { tag: "aiservice", type: "remote", format: "binary", url: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/category-ai-!cn.srs", update_interval: "24h", download_detour: "Direct-Out" },
      { tag: "paypal", type: "remote", format: "binary", url: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/paypal.srs", update_interval: "24h", download_detour: "Direct-Out" },
      { tag: "tiktok", type: "remote", format: "binary", url: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/tiktok.srs", update_interval: "24h", download_detour: "Direct-Out" },
      { tag: "instagram", type: "remote", format: "binary", url: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/instagram.srs", update_interval: "24h", download_detour: "Direct-Out" },
      { tag: "telegramip", type: "remote", format: "binary", url: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geoip/telegram.srs", update_interval: "24h", download_detour: "Direct-Out" },
      { tag: "telegramsite", type: "remote", format: "binary", url: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/telegram.srs", update_interval: "24h", download_detour: "Direct-Out" },
      { tag: "netflixsite", type: "remote", format: "binary", url: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/netflix.srs", update_interval: "24h", download_detour: "Direct-Out" },
      { tag: "netflixip", type: "remote", format: "binary", url: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geoip/netflix.srs", update_interval: "24h", download_detour: "Direct-Out" },
      { tag: "disney", type: "remote", format: "binary", url: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/disney.srs", update_interval: "24h", download_detour: "Direct-Out" },
      { tag: "hbo", type: "remote", format: "binary", url: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/hbo.srs", update_interval: "24h", download_detour: "Direct-Out" },
      { tag: "hulu", type: "remote", format: "binary", url: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/hulu.srs", update_interval: "24h", download_detour: "Direct-Out" },
      { tag: "bilibili", type: "remote", format: "binary", url: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/bilibili.srs", update_interval: "24h", download_detour: "Direct-Out" },
      { tag: "emby", type: "remote", format: "binary", url: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/category-emby.srs", update_interval: "24h", download_detour: "Direct-Out" },
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
    label: "1.13 community template",
    channel: "stable",
    version: "1.13",
    config: CATBOX_113_TEMPLATE_CONFIG,
    docsUrl: CATBOX_113_DOCS_URL,
  },
  {
    id: "template-1.12",
    label: "1.12 community template",
    channel: "stable",
    version: "1.12",
    config: LEGACY_112_SPLIT_CONFIG,
    docsUrl: CLASH2SFA_112_DOCS_URL,
  },
  {
    id: "template-1.14",
    label: "1.14 community template",
    channel: "testing",
    version: "1.14",
    config: TESTING_114_SPLIT_CONFIG,
    docsUrl: SUBSCRIBE_114_DOCS_URL,
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
