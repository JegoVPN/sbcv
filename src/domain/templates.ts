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

export type TemplatePresetId = "template-1.12" | "template-1.13" | "template-1.14";

export type TemplatePreset = {
  id: TemplatePresetId;
  label: string;
  channel: SingBoxChannel;
  version: string;
  config: SingBoxConfig;
};

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: "template-1.13",
    label: "1.13 Stable TUN Split",
    channel: "stable",
    version: "1.13",
    config: STABLE_TUN_SPLIT_CONFIG,
  },
  {
    id: "template-1.12",
    label: "1.12 Legacy Mixed Split",
    channel: "stable",
    version: "1.12",
    config: LEGACY_112_SPLIT_CONFIG,
  },
  {
    id: "template-1.14",
    label: "1.14 Testing HTTP Client",
    channel: "testing",
    version: "1.14",
    config: TESTING_114_SPLIT_CONFIG,
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
