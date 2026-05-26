export type SingBoxChannel = "stable" | "testing";

export type SingBoxTarget = {
  channel: SingBoxChannel;
  version: string;
  docsBaseUrl: string;
  binaryName: "sing-box-stable" | "sing-box-testing";
};

export type SingBoxTargetId = "1.12-stable" | "1.13-stable" | "1.14-testing";

export type TaggedConfig = {
  type: string;
  tag: string;
  [key: string]: unknown;
};

export type TaggedResourceConfig = {
  tag: string;
  [key: string]: unknown;
};

export type InboundConfig = TaggedConfig & {
  address?: string[];
  auto_route?: boolean;
};

export type OutboundConfig = TaggedConfig & {
  server?: string;
  server_port?: number;
  outbounds?: string[];
  default?: string;
  url?: string;
  interval?: string;
};

export type DnsServerConfig = TaggedConfig & {
  detour?: string;
  address?: string;
  server?: string;
  server_port?: number;
  path?: string;
};

export type RouteRule = {
  domain_suffix?: string[];
  domain_keyword?: string[];
  domain?: string[];
  rule_set?: string | string[];
  outbound?: string;
  action?: string;
  [key: string]: unknown;
};

export type DnsRule = {
  domain_suffix?: string[];
  domain_keyword?: string[];
  domain?: string[];
  rule_set?: string | string[];
  server?: string;
  action?: string;
  [key: string]: unknown;
};

export type RouteConfig = {
  rules?: RouteRule[];
  rule_set?: TaggedConfig[];
  final?: string;
  auto_detect_interface?: boolean;
  default_domain_resolver?: string | Record<string, unknown>;
  [key: string]: unknown;
};

export type DnsConfig = {
  servers?: DnsServerConfig[];
  rules?: DnsRule[];
  final?: string;
  strategy?: string;
  [key: string]: unknown;
};

export type SingBoxConfig = {
  log?: Record<string, unknown>;
  dns?: DnsConfig;
  ntp?: Record<string, unknown>;
  certificate?: Record<string, unknown>;
  certificate_providers?: TaggedConfig[];
  http_clients?: TaggedResourceConfig[];
  endpoints?: TaggedConfig[];
  inbounds?: InboundConfig[];
  outbounds?: OutboundConfig[];
  route?: RouteConfig;
  services?: TaggedConfig[];
  experimental?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ProjectLayout = {
  positions: Record<string, { x: number; y: number }>;
};

export type SbcProject = {
  appVersion: string;
  singBoxChannel: SingBoxChannel;
  singBoxVersion: string;
  config: SingBoxConfig;
  layout: ProjectLayout;
};

export type EntityRef =
  | { kind: "inbound"; tag: string }
  | { kind: "outbound"; tag: string }
  | { kind: "dns-server"; tag: string }
  | { kind: "route"; id: "main" }
  | { kind: "route-rule"; index: number }
  | { kind: "dns"; id: "main" }
  | { kind: "dns-rule"; index: number }
  | { kind: "settings"; path: keyof SingBoxConfig };

export type Diagnostic = {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
  path: string;
  source: "semantic" | "official";
};
