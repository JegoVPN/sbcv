import { Trash2 } from "lucide-react";

import type { SharedFieldGroupId } from "../../domain/sharedFieldRegistry";
import type { EntityRef, SingBoxChannel, SingBoxConfig } from "../../domain/types";
import { JsonField, ModuleCard } from "./controls";
import {
  endpointTags,
  fromList,
  type InspectorEntity,
  objectField,
  outboundTags,
  toList,
  type UpdateField,
  withUniqueBlankKey,
} from "./helpers";

// C14 — the shared field-definition machinery extracted from the Inspector monolith: the SharedField
// type/control system (sharedFieldDefinitions + SharedFieldControl + SharedFieldCards), the
// certificate-provider per-type fields, and their pure path/value helpers. Imported by the Inspector
// shell + the per-family components; depends only on the leaf controls + helpers (no cycle).

export type SharedFieldKind = "text" | "number" | "boolean" | "list" | "lines" | "select" | "keyvalue";

export type SharedFieldDefinition = {
  label: string;
  path: string[];
  kind: SharedFieldKind;
  options?: string[];
  /** Optional helper text rendered under the control. */
  hint?: string;
  /** Hide this field unless the boolean value at this path is true. */
  gatedBy?: string[];
  /**
   * Show this field only when the value at `path` equals one of `in` (value-equality gating, e.g.
   * a V2Ray transport sub-field that applies only to `transport.type === "ws"`). Distinct from
   * `gatedBy`, which is boolean-truthiness only.
   */
  visibleWhen?: { path: string[]; in: string[] };
  /**
   * For tag-or-object shared fields (domain_resolver): when the value is an OBJECT, render a structured
   * subform (server + strategy + siblings) instead of the raw JSON fallback. Other object-valued select
   * fields (http_client, a full client config) keep the JSON editor.
   */
  objectForm?: "domain-resolver";
};

const networkStrategyOptions = ["default", "hybrid", "fallback"];
// domain_resolver object form uses the DNS rule-action `route` shape minus `action` (shared/dial.md).
const domainResolverStrategyOptions = ["", "prefer_ipv4", "prefer_ipv6", "ipv4_only", "ipv6_only"];
const tlsVersionOptions = ["1.0", "1.1", "1.2", "1.3"];
const transportTypeOptions = ["http", "ws", "quic", "grpc", "httpupgrade"];

const sharedGroupTitles: Record<SharedFieldGroupId, string> = {
  listen: "Listen Fields",
  dial: "Dial Fields",
  tls: "TLS",
  "http-client": "HTTP Client",
  http2: "HTTP2 Fields",
  quic: "QUIC Fields",
  "certificate-provider": "Certificate Provider",
  "dns01-challenge": "DNS01 Challenge",
  "pre-match": "Pre-match",
  multiplex: "Multiplex",
  "v2ray-transport": "V2Ray Transport",
  "udp-over-tcp": "UDP over TCP",
  "tcp-brutal": "TCP Brutal",
  "wifi-state": "Wi-Fi State",
  neighbor: "Neighbor Resolution",
};

function sharedValueAt(entity: InspectorEntity, path: string[]) {
  let current: unknown = entity;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as InspectorEntity)[segment];
  }
  return current;
}

function nestedPatch(entity: InspectorEntity, path: string[], value: unknown): { field: string; value: unknown } | null {
  const [field, ...nested] = path;
  if (!field) return null;
  if (!nested.length) return { field, value };
  const root = objectField(entity[field]);
  let cursor: InspectorEntity = { ...root };
  const nextRoot = cursor;
  for (let index = 0; index < nested.length - 1; index += 1) {
    const segment = nested[index];
    if (!segment) return null;
    const child = objectField(cursor[segment]);
    cursor[segment] = { ...child };
    cursor = cursor[segment] as InspectorEntity;
  }
  const last = nested[nested.length - 1];
  if (!last) return null;
  cursor[last] = value;
  // Clearing the last populated leaf of a nested object would otherwise leave an empty `{}` behind (the
  // export pruner keeps empty objects), so a cleared sub-field emits non-canonical noise (e.g.
  // `external_account: {}`). Drop the whole top-level object when every leaf became empty. (C2-B)
  return { field, value: hasMeaningfulValue(nextRoot) ? nextRoot : undefined };
}

// True if a value carries information worth serializing: a non-empty string/array, any boolean/number,
// or an object with at least one meaningful leaf (recursively). Empty objects/strings/arrays are noise.
function hasMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).some(hasMeaningfulValue);
  return true;
}

function isSharedValueActive(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return value;
  return value !== undefined && value !== null && value !== "";
}

export function sharedFieldDefinitions(
  group: SharedFieldGroupId,
  ref: EntityRef,
  type: string | null,
  config: SingBoxConfig,
  channel: SingBoxChannel,
): SharedFieldDefinition[] {
  const outboundOptions = outboundTags(config, ref.kind === "outbound" ? ref.tag : undefined);
  const httpClientOptions = (config.http_clients ?? [])
    .map((client) => client.tag)
    .filter((tag): tag is string => Boolean(tag));

  if (group === "listen") {
    const inboundOptions = (config.inbounds ?? [])
      .map((inbound) => inbound.tag)
      .filter((tag): tag is string => Boolean(tag && (ref.kind !== "inbound" || tag !== ref.tag)));
    // ccm/ocm redefine `detour` as an OUTBOUND tag (the Claude/OpenAI API target), edited by the
    // dedicated "API Detour" control. The listen-group inbound `detour` writes the same key, so omit it
    // here to avoid silently stomping the outbound detour with an inbound tag (C1-21 / C2-1).
    const detourIsOutbound = ref.kind === "service" && (type === "ccm" || type === "ocm");
    return [
      { label: "Listen", path: ["listen"], kind: "text" },
      { label: "Listen Port", path: ["listen_port"], kind: "number" },
      { label: "Bind Interface (1.12+)", path: ["bind_interface"], kind: "text" },
      { label: "Routing Mark (Linux)", path: ["routing_mark"], kind: "text" },
      { label: "Reuse Address (1.12+)", path: ["reuse_addr"], kind: "boolean" },
      { label: "Network Namespace (Linux, 1.12+)", path: ["netns"], kind: "text" },
      { label: "TCP Fast Open", path: ["tcp_fast_open"], kind: "boolean" },
      { label: "TCP Multi Path", path: ["tcp_multi_path"], kind: "boolean" },
      { label: "Disable TCP Keep Alive (1.13+)", path: ["disable_tcp_keep_alive"], kind: "boolean" },
      { label: "TCP Keep Alive (1.13+)", path: ["tcp_keep_alive"], kind: "text" },
      { label: "TCP Keep Alive Interval", path: ["tcp_keep_alive_interval"], kind: "text" },
      { label: "UDP Fragment", path: ["udp_fragment"], kind: "boolean" },
      { label: "UDP Timeout", path: ["udp_timeout"], kind: "text" },
      ...(detourIsOutbound
        ? []
        : [{ label: "Inbound Detour", path: ["detour"], kind: "select" as const, options: inboundOptions }]),
    ];
  }

  const dnsServerOptions = (config.dns?.servers ?? [])
    .map((server) => server.tag)
    .filter((tag): tag is string => Boolean(tag));

  if (group === "dial" && ref.kind === "route") {
    return [
      { label: "Default Domain Resolver", path: ["default_domain_resolver"], kind: "select", options: ["", ...dnsServerOptions], objectForm: "domain-resolver" },
      { label: "Default Network Strategy", path: ["default_network_strategy"], kind: "select", options: networkStrategyOptions },
      { label: "Default Network Type", path: ["default_network_type"], kind: "list" },
      { label: "Default Fallback Network", path: ["default_fallback_network_type"], kind: "list" },
      { label: "Default Fallback Delay", path: ["default_fallback_delay"], kind: "text" },
    ];
  }

  if (group === "dial" && ref.kind === "inbound" && type === "shadowtls") {
    return [
      { label: "Handshake Server", path: ["handshake", "server"], kind: "text" },
      { label: "Handshake Port", path: ["handshake", "server_port"], kind: "number" },
      { label: "Handshake Detour", path: ["handshake", "detour"], kind: "select", options: outboundOptions },
      { label: "Connect Timeout", path: ["handshake", "connect_timeout"], kind: "text" },
    ];
  }

  if (group === "dial") {
    return [
      { label: "Detour", path: ["detour"], kind: "select", options: outboundOptions },
      { label: "Bind Interface", path: ["bind_interface"], kind: "text" },
      { label: "IPv4 Bind Address", path: ["inet4_bind_address"], kind: "text" },
      { label: "IPv6 Bind Address", path: ["inet6_bind_address"], kind: "text" },
      { label: "Bind Address No Port (Linux, 1.13+)", path: ["bind_address_no_port"], kind: "boolean" },
      { label: "Routing Mark (Linux)", path: ["routing_mark"], kind: "text" },
      { label: "Reuse Address", path: ["reuse_addr"], kind: "boolean" },
      { label: "Network Namespace (Linux, 1.12+)", path: ["netns"], kind: "text" },
      { label: "Connect Timeout", path: ["connect_timeout"], kind: "text" },
      { label: "TCP Fast Open", path: ["tcp_fast_open"], kind: "boolean" },
      { label: "TCP Multi Path", path: ["tcp_multi_path"], kind: "boolean" },
      { label: "Disable TCP Keep Alive (1.13+)", path: ["disable_tcp_keep_alive"], kind: "boolean" },
      { label: "TCP Keep Alive (1.13+)", path: ["tcp_keep_alive"], kind: "text" },
      { label: "TCP Keep Alive Interval (1.13+)", path: ["tcp_keep_alive_interval"], kind: "text" },
      { label: "UDP Fragment", path: ["udp_fragment"], kind: "boolean" },
      { label: "Domain Resolver", path: ["domain_resolver"], kind: "select", options: ["", ...dnsServerOptions], objectForm: "domain-resolver" },
      { label: "Network Strategy", path: ["network_strategy"], kind: "select", options: networkStrategyOptions },
      { label: "Network Type", path: ["network_type"], kind: "list", hint: "Values: wifi, cellular, ethernet, other. Graphical Android/Apple clients only, with auto_detect_interface enabled." },
      { label: "Fallback Network", path: ["fallback_network_type"], kind: "list", hint: "Values: wifi, cellular, ethernet, other. Graphical Android/Apple clients only, with auto_detect_interface enabled." },
      { label: "Fallback Delay", path: ["fallback_delay"], kind: "text" },
      // domain_strategy was removed in sing-box 1.14 — hide it on the testing channel; on stable
      // (1.12/1.13) it's still accepted (deprecated). See dial.md / migration.
      ...(channel === "testing"
        ? []
        : ([{ label: "Domain Strategy (deprecated; removed in 1.14)", path: ["domain_strategy"], kind: "text" }] as SharedFieldDefinition[])),
    ];
  }

  if (group === "tls") {
    const certificateProviderOptions = [
      "",
      ...((config.certificate_providers ?? [])
        .map((provider) => provider.tag)
        .filter((tag): tag is string => Boolean(tag))),
    ];
    // TLS role split: inbound/service present a server certificate (server role); outbound/dns-server
    // dial out and verify an upstream certificate (client role). Fields are partitioned so a server card
    // never shows client-only options and vice versa (C0-6 / W6).
    const isServerRole = ref.kind === "inbound" || ref.kind === "service";
    // naive (outbound) supports only a narrow client TLS surface.
    if (ref.kind === "outbound" && type === "naive") {
      // naive is TLS-only (scaffold seeds tls.enabled=true), so no enable toggle; upstream supports only
      // server_name/certificate/certificate_path/ech here (outbound/naive.md).
      return [
        { label: "Server Name", path: ["tls", "server_name"], kind: "text" },
        { label: "Certificate (PEM)", path: ["tls", "certificate"], kind: "lines" },
        { label: "Certificate Path", path: ["tls", "certificate_path"], kind: "text" },
        { label: "ECH Enabled", path: ["tls", "ech", "enabled"], kind: "boolean" },
        { label: "ECH Config (PEM)", path: ["tls", "ech", "config"], kind: "lines", gatedBy: ["tls", "ech", "enabled"] },
        { label: "ECH Config Path", path: ["tls", "ech", "config_path"], kind: "text", gatedBy: ["tls", "ech", "enabled"] },
        { label: "ECH Query Server Name", path: ["tls", "ech", "query_server_name"], kind: "text", gatedBy: ["tls", "ech", "enabled"] },
      ];
    }
    const shared: SharedFieldDefinition[] = [
      { label: "Enabled", path: ["tls", "enabled"], kind: "boolean" },
      { label: "Server Name", path: ["tls", "server_name"], kind: "text" },
      { label: "ALPN", path: ["tls", "alpn"], kind: "list" },
      { label: "Min Version", path: ["tls", "min_version"], kind: "select", options: tlsVersionOptions },
      { label: "Max Version", path: ["tls", "max_version"], kind: "select", options: tlsVersionOptions },
      { label: "Cipher Suites", path: ["tls", "cipher_suites"], kind: "list" },
      { label: "Curve Preferences (1.13+)", path: ["tls", "curve_preferences"], kind: "list" },
      { label: "Certificate (PEM)", path: ["tls", "certificate"], kind: "lines" },
      { label: "Certificate Path", path: ["tls", "certificate_path"], kind: "text" },
      { label: "ECH Enabled", path: ["tls", "ech", "enabled"], kind: "boolean" },
    ];
    const serverOnly: SharedFieldDefinition[] = [
      { label: "Key (PEM)", path: ["tls", "key"], kind: "lines" },
      { label: "Key Path", path: ["tls", "key_path"], kind: "text" },
      { label: "Client Authentication", path: ["tls", "client_authentication"], kind: "select", options: ["no", "request", "require-any", "verify-if-given", "require-and-verify"] },
      { label: "Certificate Provider", path: ["tls", "certificate_provider"], kind: "select", options: certificateProviderOptions },
      { label: "Reality Enabled", path: ["tls", "reality", "enabled"], kind: "boolean" },
      { label: "Reality Handshake Server", path: ["tls", "reality", "handshake", "server"], kind: "text", gatedBy: ["tls", "reality", "enabled"] },
      { label: "Reality Handshake Server Port", path: ["tls", "reality", "handshake", "server_port"], kind: "number", gatedBy: ["tls", "reality", "enabled"] },
      { label: "Reality Private Key", path: ["tls", "reality", "private_key"], kind: "text", gatedBy: ["tls", "reality", "enabled"] },
      { label: "Reality Short ID", path: ["tls", "reality", "short_id"], kind: "list", gatedBy: ["tls", "reality", "enabled"] },
      { label: "Reality Max Time Difference", path: ["tls", "reality", "max_time_difference"], kind: "text", gatedBy: ["tls", "reality", "enabled"] },
      { label: "ECH Key (PEM)", path: ["tls", "ech", "key"], kind: "lines", gatedBy: ["tls", "ech", "enabled"] },
      { label: "ECH Key Path", path: ["tls", "ech", "key_path"], kind: "text", gatedBy: ["tls", "ech", "enabled"] },
    ];
    const clientOnly: SharedFieldDefinition[] = [
      { label: "Disable SNI", path: ["tls", "disable_sni"], kind: "boolean" },
      { label: "Insecure", path: ["tls", "insecure"], kind: "boolean" },
      { label: "Certificate Public Key SHA256 (1.13+)", path: ["tls", "certificate_public_key_sha256"], kind: "list" },
      { label: "Fragment (1.12+)", path: ["tls", "fragment"], kind: "boolean" },
      { label: "Fragment Fallback Delay (1.12+)", path: ["tls", "fragment_fallback_delay"], kind: "text" },
      { label: "Record Fragment (1.12+)", path: ["tls", "record_fragment"], kind: "boolean" },
      { label: "uTLS Enabled (1.10+)", path: ["tls", "utls", "enabled"], kind: "boolean" },
      { label: "uTLS Fingerprint", path: ["tls", "utls", "fingerprint"], kind: "select", options: ["", "chrome", "firefox", "edge", "safari", "360", "qq", "ios", "android", "random", "randomized"], gatedBy: ["tls", "utls", "enabled"] },
      { label: "Reality Enabled", path: ["tls", "reality", "enabled"], kind: "boolean" },
      { label: "Reality Public Key", path: ["tls", "reality", "public_key"], kind: "text", gatedBy: ["tls", "reality", "enabled"] },
      { label: "Reality Short ID", path: ["tls", "reality", "short_id"], kind: "text", gatedBy: ["tls", "reality", "enabled"] },
      { label: "ECH Config (PEM)", path: ["tls", "ech", "config"], kind: "lines", gatedBy: ["tls", "ech", "enabled"] },
      { label: "ECH Config Path", path: ["tls", "ech", "config_path"], kind: "text", gatedBy: ["tls", "ech", "enabled"] },
      { label: "ECH Query Server Name", path: ["tls", "ech", "query_server_name"], kind: "text", gatedBy: ["tls", "ech", "enabled"] },
    ];
    // Inline ACME editor (deprecated in 1.14 but still valid) — Inbound server-only in both channels.
    // domain[] empty disables ACME. provider is free-text so a custom `https://…` directory survives.
    // dns01_challenge provider-specific fields gate on the chosen provider; the 1.14-added top-level
    // dns01 fields are channel-gated to testing. (shared/tls.md, shared/dns01_challenge.md)
    const dns01Provider = (p: string[]) => ({ path: ["tls", "acme", "dns01_challenge", "provider"], in: p });
    const tlsAcmeFields: SharedFieldDefinition[] =
      ref.kind === "inbound"
        ? [
            { label: "ACME Domain", path: ["tls", "acme", "domain"], kind: "list", hint: "Empty disables ACME." },
            { label: "ACME Email", path: ["tls", "acme", "email"], kind: "text" },
            { label: "ACME Provider", path: ["tls", "acme", "provider"], kind: "text", hint: "letsencrypt | zerossl | https://… (custom)" },
            { label: "ACME Data Directory", path: ["tls", "acme", "data_directory"], kind: "text" },
            { label: "ACME Default Server Name", path: ["tls", "acme", "default_server_name"], kind: "text" },
            { label: "ACME Disable HTTP Challenge", path: ["tls", "acme", "disable_http_challenge"], kind: "boolean" },
            { label: "ACME Disable TLS-ALPN Challenge", path: ["tls", "acme", "disable_tls_alpn_challenge"], kind: "boolean" },
            { label: "ACME Alternative HTTP Port", path: ["tls", "acme", "alternative_http_port"], kind: "number" },
            { label: "ACME Alternative TLS Port", path: ["tls", "acme", "alternative_tls_port"], kind: "number" },
            { label: "ACME EAB Key ID", path: ["tls", "acme", "external_account", "key_id"], kind: "text" },
            { label: "ACME EAB MAC Key", path: ["tls", "acme", "external_account", "mac_key"], kind: "text" },
            { label: "DNS01 Provider", path: ["tls", "acme", "dns01_challenge", "provider"], kind: "select", options: ["alidns", "cloudflare", "acmedns"] },
            { label: "DNS01 Access Key ID", path: ["tls", "acme", "dns01_challenge", "access_key_id"], kind: "text", visibleWhen: dns01Provider(["alidns"]) },
            { label: "DNS01 Access Key Secret", path: ["tls", "acme", "dns01_challenge", "access_key_secret"], kind: "text", visibleWhen: dns01Provider(["alidns"]) },
            { label: "DNS01 Region ID", path: ["tls", "acme", "dns01_challenge", "region_id"], kind: "text", visibleWhen: dns01Provider(["alidns"]) },
            { label: "DNS01 Security Token", path: ["tls", "acme", "dns01_challenge", "security_token"], kind: "text", visibleWhen: dns01Provider(["alidns"]) },
            { label: "DNS01 API Token", path: ["tls", "acme", "dns01_challenge", "api_token"], kind: "text", visibleWhen: dns01Provider(["cloudflare"]) },
            { label: "DNS01 Zone Token", path: ["tls", "acme", "dns01_challenge", "zone_token"], kind: "text", visibleWhen: dns01Provider(["cloudflare"]) },
            { label: "DNS01 Username", path: ["tls", "acme", "dns01_challenge", "username"], kind: "text", visibleWhen: dns01Provider(["acmedns"]) },
            { label: "DNS01 Password", path: ["tls", "acme", "dns01_challenge", "password"], kind: "text", visibleWhen: dns01Provider(["acmedns"]) },
            { label: "DNS01 Subdomain", path: ["tls", "acme", "dns01_challenge", "subdomain"], kind: "text", visibleWhen: dns01Provider(["acmedns"]) },
            { label: "DNS01 Server URL", path: ["tls", "acme", "dns01_challenge", "server_url"], kind: "text", visibleWhen: dns01Provider(["acmedns"]) },
            ...(channel === "testing"
              ? ([
                  { label: "DNS01 TTL", path: ["tls", "acme", "dns01_challenge", "ttl"], kind: "text" },
                  { label: "DNS01 Propagation Delay", path: ["tls", "acme", "dns01_challenge", "propagation_delay"], kind: "text" },
                  { label: "DNS01 Propagation Timeout", path: ["tls", "acme", "dns01_challenge", "propagation_timeout"], kind: "text" },
                  { label: "DNS01 Resolvers", path: ["tls", "acme", "dns01_challenge", "resolvers"], kind: "list" },
                  { label: "DNS01 Override Domain", path: ["tls", "acme", "dns01_challenge", "override_domain"], kind: "text" },
                ] as SharedFieldDefinition[])
              : []),
          ]
        : [];
    return isServerRole ? [...shared, ...serverOnly, ...tlsAcmeFields] : [...shared, ...clientOnly];
  }

  if (group === "quic") {
    return [
      { label: "Initial Packet Size", path: ["initial_packet_size"], kind: "number" },
      { label: "Disable Path MTU Discovery", path: ["disable_path_mtu_discovery"], kind: "boolean" },
      { label: "Idle Timeout", path: ["idle_timeout"], kind: "text" },
      { label: "Keep Alive Period", path: ["keep_alive_period"], kind: "text" },
    ];
  }

  if (group === "multiplex") {
    // Inbound multiplex accepts only enabled/padding (+ brutal, its own group). protocol and the stream
    // limits are dialed by the client, so they are outbound-only (C0-7 / W6).
    const clientStreamFields: SharedFieldDefinition[] = ref.kind === "outbound"
      ? [
          { label: "Protocol", path: ["multiplex", "protocol"], kind: "select", options: ["smux", "yamux", "h2mux"] },
          { label: "Max Connections", path: ["multiplex", "max_connections"], kind: "number" },
          { label: "Min Streams", path: ["multiplex", "min_streams"], kind: "number" },
          { label: "Max Streams", path: ["multiplex", "max_streams"], kind: "number" },
        ]
      : [];
    return [
      { label: "Enabled", path: ["multiplex", "enabled"], kind: "boolean" },
      ...clientStreamFields,
      { label: "Padding", path: ["multiplex", "padding"], kind: "boolean" },
    ];
  }

  if (group === "tcp-brutal") {
    return [
      { label: "Enabled", path: ["multiplex", "brutal", "enabled"], kind: "boolean" },
      { label: "Upload Mbps", path: ["multiplex", "brutal", "up_mbps"], kind: "number" },
      { label: "Download Mbps", path: ["multiplex", "brutal", "down_mbps"], kind: "number" },
    ];
  }

  if (group === "v2ray-transport") {
    // Per-variant fields, gated by transport.type (shared/v2ray-transport.md). quic has no sub-fields.
    // HTTP host is a string list; HTTPUpgrade host is a single string — hence two Host definitions.
    const onType = (types: string[]) => ({ path: ["transport", "type"], in: types });
    return [
      { label: "Type", path: ["transport", "type"], kind: "select", options: transportTypeOptions },
      { label: "Host", path: ["transport", "host"], kind: "list", visibleWhen: onType(["http"]) },
      { label: "Host", path: ["transport", "host"], kind: "text", visibleWhen: onType(["httpupgrade"]) },
      { label: "Path", path: ["transport", "path"], kind: "text", visibleWhen: onType(["http", "ws", "httpupgrade"]) },
      { label: "Method", path: ["transport", "method"], kind: "text", visibleWhen: onType(["http"]) },
      { label: "Service Name", path: ["transport", "service_name"], kind: "text", visibleWhen: onType(["grpc"]) },
      { label: "Max Early Data", path: ["transport", "max_early_data"], kind: "number", visibleWhen: onType(["ws"]) },
      { label: "Early Data Header Name", path: ["transport", "early_data_header_name"], kind: "text", visibleWhen: onType(["ws"]) },
      { label: "Permit Without Stream", path: ["transport", "permit_without_stream"], kind: "boolean", visibleWhen: onType(["grpc"]) },
      { label: "Idle Timeout", path: ["transport", "idle_timeout"], kind: "text", visibleWhen: onType(["http", "grpc"]) },
      { label: "Ping Timeout", path: ["transport", "ping_timeout"], kind: "text", visibleWhen: onType(["http", "grpc"]) },
      { label: "Headers", path: ["transport", "headers"], kind: "keyvalue", visibleWhen: onType(["http", "ws", "httpupgrade"]) },
    ];
  }

  if (group === "udp-over-tcp") {
    return [
      { label: "Enabled", path: ["udp_over_tcp", "enabled"], kind: "boolean" },
      { label: "Version", path: ["udp_over_tcp", "version"], kind: "select", options: ["1", "2"] },
    ];
  }

  if (group === "http-client") {
    return ref.kind === "rule-set"
      ? [{ label: "HTTP Client", path: ["http_client"], kind: "select", options: httpClientOptions }]
      : [{ label: "Default HTTP Client", path: ["default_http_client"], kind: "select", options: httpClientOptions }];
  }

  if (group === "http2") {
    return [
      { label: "Idle Timeout", path: ["idle_timeout"], kind: "text" },
      { label: "Keep Alive Period", path: ["keep_alive_period"], kind: "text" },
      { label: "Stream Receive Window", path: ["stream_receive_window"], kind: "text" },
      { label: "Connection Receive Window", path: ["connection_receive_window"], kind: "text" },
      { label: "Max Concurrent Streams", path: ["max_concurrent_streams"], kind: "number" },
    ];
  }

  if (group === "neighbor") {
    if (ref.kind === "route") {
      return [
        { label: "Find Neighbor", path: ["find_neighbor"], kind: "boolean" },
        { label: "DHCP Lease Files", path: ["dhcp_lease_files"], kind: "list" },
      ];
    }
    if (ref.kind === "dns-server") {
      return [{ label: "Neighbor Domain", path: ["neighbor_domain"], kind: "list" }];
    }
  }

  return [];
}

function coerceSharedFieldValue(kind: SharedFieldKind, rawValue: string | boolean) {
  if (kind === "boolean") return Boolean(rawValue);
  if (kind === "number") return rawValue === "" ? undefined : Number(rawValue);
  if (kind === "list") return fromList(String(rawValue));
  // R5: a PEM/line array (tls.certificate/key/ech.*) is split on NEWLINES, not commas — a pasted PEM
  // block round-trips intact as the `string[]` of lines sing-box expects. Trailing blank lines (from a
  // trailing newline) are trimmed; internal blanks (between chained certs) are preserved.
  if (kind === "lines") {
    const lines = String(rawValue).split("\n");
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    return lines.length ? lines : undefined;
  }
  return rawValue === "" ? undefined : rawValue;
}

export function SharedFieldControl({
  definition,
  entity,
  entityRef,
  updateField,
}: {
  definition: SharedFieldDefinition;
  entity: InspectorEntity;
  entityRef: EntityRef;
  updateField: UpdateField;
}) {
  const value = sharedValueAt(entity, definition.path);
  const applyValue = (nextValue: unknown) => {
    const patch = nestedPatch(entity, definition.path, nextValue);
    if (patch) updateField(entityRef, patch.field, patch.value);
  };

  if (definition.kind === "boolean") {
    return (
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => applyValue(event.target.checked)}
        />
        <span>{definition.label}</span>
        {definition.hint ? <small className="shared-field-hint">{definition.hint}</small> : null}
      </label>
    );
  }

  if (definition.kind === "select") {
    // Some shared fields (http_client / default_http_client / domain_resolver) may hold a tag string
    // OR an inline object. The tag <select> can't represent an object.
    const isObject = value !== null && typeof value === "object" && !Array.isArray(value);

    // V6: domain_resolver object form gets a structured subform (server + strategy + siblings) instead
    // of the raw JSON fallback. Unknown keys are preserved via spread, so editing never drops data.
    if (isObject && definition.objectForm === "domain-resolver") {
      const obj = value as Record<string, unknown>;
      const writeObj = (patch: Record<string, unknown>) => {
        const next: Record<string, unknown> = { ...obj, ...patch };
        for (const key of Object.keys(next)) {
          if (next[key] === undefined || next[key] === "") delete next[key];
        }
        applyValue(Object.keys(next).length ? next : undefined);
      };
      const serverValue = typeof obj.server === "string" ? obj.server : "";
      return (
        <fieldset className="field field--checklist" data-testid="domain-resolver-object">
          <legend>{definition.label}</legend>
          <label className="field">
            <span>Server (DNS)</span>
            <select value={serverValue} onChange={(event) => writeObj({ server: event.target.value })}>
              {(definition.options ?? [""]).map((option) => (
                <option key={option} value={option}>
                  {option || "None"}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Strategy</span>
            <select
              value={typeof obj.strategy === "string" ? obj.strategy : ""}
              onChange={(event) => writeObj({ strategy: event.target.value })}
            >
              {domainResolverStrategyOptions.map((option) => (
                <option key={option} value={option}>
                  {option || "(default)"}
                </option>
              ))}
            </select>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={Boolean(obj.disable_cache)}
              onChange={(event) => writeObj({ disable_cache: event.target.checked || undefined })}
            />
            <span>Disable Cache</span>
          </label>
          <label className="field">
            <span>Rewrite TTL</span>
            <input
              type="number"
              value={typeof obj.rewrite_ttl === "number" ? obj.rewrite_ttl : ""}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                writeObj({ rewrite_ttl: event.target.value === "" || !Number.isFinite(parsed) ? undefined : parsed });
              }}
            />
          </label>
          <label className="field">
            <span>Client Subnet</span>
            <input
              value={typeof obj.client_subnet === "string" ? obj.client_subnet : ""}
              placeholder="1.2.3.0/24"
              onChange={(event) => writeObj({ client_subnet: event.target.value })}
            />
          </label>
          <button
            type="button"
            className="palette-action"
            onClick={() => applyValue(serverValue || undefined)}
          >
            Collapse to tag only
          </button>
        </fieldset>
      );
    }

    // Other object-valued select fields (http_client: a full client config) keep the JSON editor.
    if (isObject) {
      return <JsonField label={definition.label} value={value} onChange={applyValue} />;
    }

    return (
      <label className="field">
        <span>{definition.label}</span>
        <select
          value={String(value ?? "")}
          onChange={(event) => applyValue(coerceSharedFieldValue(definition.kind, event.target.value))}
        >
          <option value="">None</option>
          {(definition.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {definition.hint ? <small className="shared-field-hint">{definition.hint}</small> : null}
        {definition.objectForm === "domain-resolver" && typeof value === "string" && value ? (
          <button
            type="button"
            className="palette-action"
            onClick={() => applyValue({ server: value })}
          >
            Add resolver options
          </button>
        ) : null}
      </label>
    );
  }

  if (definition.kind === "keyvalue") {
    // String→string map editor (e.g. transport.headers), mirroring the protocol headers editor.
    const map = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    const entries = Object.entries(map);
    const noun = definition.label.toLowerCase().replace(/s$/, "");
    const write = (next: Record<string, unknown>) => applyValue(Object.keys(next).length ? next : undefined);
    return (
      <fieldset className="field field--checklist">
        <legend>{definition.label}</legend>
        {entries.length === 0 ? <p className="field__hint">No {definition.label.toLowerCase()}.</p> : null}
        {entries.map(([key, val], index) => (
          <div key={`${key}-${index}`} className="rule-row">
            <label className="field">
              <span>Name</span>
              <input
                aria-label={`${definition.label} name ${index}`}
                value={key}
                onChange={(event) => {
                  const newKey = event.target.value;
                  if (!newKey || newKey === key) return;
                  const next: Record<string, unknown> = {};
                  for (const [k, v] of entries) next[k === key ? newKey : k] = v;
                  write(next);
                }}
              />
            </label>
            <label className="field">
              <span>Value</span>
              <input
                aria-label={`${definition.label} value ${index}`}
                value={typeof val === "string" ? val : String(val ?? "")}
                onChange={(event) => write({ ...map, [key]: event.target.value })}
              />
            </label>
            <button
              type="button"
              className="icon-danger"
              aria-label={`Remove ${noun} ${key}`}
              onClick={() => {
                const next = { ...map };
                delete next[key];
                write(next);
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button type="button" className="palette-action" onClick={() => write(withUniqueBlankKey(map, "X-Header"))}>
          Add {noun}
        </button>
        {definition.hint ? <small className="shared-field-hint">{definition.hint}</small> : null}
      </fieldset>
    );
  }

  if (definition.kind === "lines") {
    // R5: PEM/line-array editor — a multi-line textarea (newline-delimited), not a comma CSV input.
    return (
      <label className="field">
        <span>{definition.label}</span>
        <textarea
          className="shared-field-pem"
          rows={4}
          value={Array.isArray(value) ? value.join("\n") : String(value ?? "")}
          placeholder={"-----BEGIN CERTIFICATE-----\n…paste PEM here…\n-----END CERTIFICATE-----"}
          onChange={(event) => applyValue(coerceSharedFieldValue("lines", event.target.value))}
        />
        {definition.hint ? <small className="shared-field-hint">{definition.hint}</small> : null}
      </label>
    );
  }

  return (
    <label className="field">
      <span>{definition.label}</span>
      <input
        type={definition.kind === "number" ? "number" : "text"}
        value={definition.kind === "list" ? toList(value) : String(value ?? "")}
        onChange={(event) => applyValue(coerceSharedFieldValue(definition.kind, event.target.value))}
      />
      {definition.hint ? <small className="shared-field-hint">{definition.hint}</small> : null}
    </label>
  );
}

export function SharedFieldCards({
  groups,
  entity,
  entityRef,
  entityType,
  config,
  channel,
  updateField,
}: {
  groups: SharedFieldGroupId[];
  entity: InspectorEntity;
  entityRef: EntityRef;
  entityType: string | null;
  config: SingBoxConfig;
  channel: SingBoxChannel;
  updateField: UpdateField;
}) {
  const cards = groups
    .map((group) => ({
      group,
      definitions: sharedFieldDefinitions(group, entityRef, entityType, config, channel),
    }))
    .filter((card) => card.definitions.length > 0);

  if (!cards.length) return null;

  return (
    <div className="settings-module-list" aria-label="Shared field sections">
      <div className="inspector-section-title">Shared Configuration</div>
      {cards.map((card) => {
        const active = card.definitions.some((definition) => isSharedValueActive(sharedValueAt(entity, definition.path)));
        return (
          <ModuleCard key={card.group} title={sharedGroupTitles[card.group]} active={active}>
            {card.definitions
              .filter((definition) => {
                if (definition.gatedBy && !sharedValueAt(entity, definition.gatedBy)) return false;
                if (definition.visibleWhen) {
                  const current = sharedValueAt(entity, definition.visibleWhen.path);
                  if (!definition.visibleWhen.in.includes(String(current ?? ""))) return false;
                }
                return true;
              })
              .map((definition) => (
                <SharedFieldControl
                  key={definition.path.join(".")}
                  definition={definition}
                  entity={entity}
                  entityRef={entityRef}
                  updateField={updateField}
                />
              ))}
          </ModuleCard>
        );
      })}
    </div>
  );
}

// C2-B: per-type structured field definitions for certificate_providers (testing-only, 1.14). acme &
// cloudflare-origin-ca require domain[]; tailscale reuses a Tailscale endpoint. Rendered through the shared
// SharedFieldControl so the list/select/text/number controls (and object-form JSON fallback) are reused.
export function certificateProviderFields(entityType: string | null, config: SingBoxConfig): SharedFieldDefinition[] {
  if (entityType === "acme") {
    return [
      { label: "Domain", path: ["domain"], kind: "list", hint: "ACME is disabled when empty." },
      { label: "Email", path: ["email"], kind: "text" },
      { label: "Provider", path: ["provider"], kind: "text", hint: "letsencrypt | zerossl | https://… (custom)" },
      { label: "Data Directory", path: ["data_directory"], kind: "text" },
      { label: "Key Type", path: ["key_type"], kind: "select", options: ["ed25519", "p256", "p384", "rsa2048", "rsa4096"] },
      { label: "Profile", path: ["profile"], kind: "text" },
      { label: "Account Key", path: ["account_key"], kind: "text" },
      { label: "EAB Key ID", path: ["external_account", "key_id"], kind: "text" },
      { label: "EAB MAC Key", path: ["external_account", "mac_key"], kind: "text" },
    ];
  }
  if (entityType === "cloudflare-origin-ca") {
    return [
      { label: "Domain", path: ["domain"], kind: "list", hint: "Certificate hostnames." },
      { label: "API Token", path: ["api_token"], kind: "text", hint: "Conflicts with Origin CA Key." },
      { label: "Origin CA Key", path: ["origin_ca_key"], kind: "text", hint: "Conflicts with API Token." },
      { label: "Request Type", path: ["request_type"], kind: "select", options: ["origin-rsa", "origin-ecc"] },
      { label: "Requested Validity", path: ["requested_validity"], kind: "number", hint: "Days: 7 | 30 | 90 | 365 | 730 | 1095 | 5475 (default)." },
    ];
  }
  if (entityType === "tailscale") {
    return [{ label: "Endpoint", path: ["endpoint"], kind: "select", options: endpointTags(config, "tailscale") }];
  }
  return [];
}

