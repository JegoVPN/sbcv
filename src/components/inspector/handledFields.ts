import {
  CREATABLE_DNS_SERVER_TYPES,
  CREATABLE_ENDPOINT_TYPES,
  CREATABLE_INBOUND_TYPES,
  CREATABLE_OUTBOUND_TYPES,
  CREATABLE_SERVICE_TYPES,
} from "../../domain/protocols";
import { sharedGroupsForEntity } from "../../domain/sharedFieldRegistry";
import type { EntityRef, SingBoxChannel, SingBoxConfig } from "../../domain/types";
import { sharedFieldDefinitions } from "./sharedFields";

// C14 — per-kind handledFields sets (which scalar keys the structured controls own, so the rest fall to
// the Advanced JSON fallback) + the shared-field key spreads + the C17 silent-unreachable guard
// (structurallyCoveredKeys / INLINE_RENDERED_KEYS). Pure data/logic, no JSX. Imported by the family
// blocks + re-exported from Inspector for the C17 test. Depends only on sharedFields/registry/protocols.

const listenSharedFields = [
  "listen",
  "listen_port",
  "bind_interface",
  "routing_mark",
  "reuse_addr",
  "netns",
  "tcp_fast_open",
  "tcp_multi_path",
  "disable_tcp_keep_alive",
  "tcp_keep_alive",
  "tcp_keep_alive_interval",
  "udp_fragment",
  "udp_timeout",
  "detour",
];
const dialSharedFields = [
  "detour",
  "bind_interface",
  "inet4_bind_address",
  "inet6_bind_address",
  "bind_address_no_port",
  "routing_mark",
  "reuse_addr",
  "netns",
  "connect_timeout",
  "tcp_fast_open",
  "tcp_multi_path",
  "disable_tcp_keep_alive",
  "tcp_keep_alive",
  "tcp_keep_alive_interval",
  "udp_fragment",
  "domain_resolver",
  "network_strategy",
  "network_type",
  "fallback_network_type",
  "fallback_delay",
  "domain_strategy",
];
const quicSharedFields = ["initial_packet_size", "disable_path_mtu_discovery", "idle_timeout", "keep_alive_period"];
export const inboundHandledFields: ReadonlySet<string> = new Set([
  "tag",
  "type",
  "address",
  "auto_route",
  "users",
  "method",
  "version",
  "padding_scheme",
  "tls",
  "multiplex",
  "transport",
  "handshake",
  "stack",
  "route_address",
  "route_exclude_address",
  "route_address_set",
  "route_exclude_address_set",
  "loopback_address",
  "endpoint_independent_nat",
  "platform",
  "quic_congestion_control",
  "masquerade",
  "brutal_debug",
  // U7b — inbound hysteria2 obfs now has a structured control (mirrors outbound), so handle it.
  "obfs",
  "fallback",
  "fallback_for_alpn",
  "override_address",
  "override_port",
  "network",
  "token",
  "ha_connections",
  // U8 — inbound TUIC fields promoted to dedicated controls (inbound/tuic.md).
  "congestion_control",
  "auth_timeout",
  "zero_rtt_handshake",
  "heartbeat",
  "protocol",
  "post_quantum",
  "region",
  "grace_period",
  "set_system_proxy",
  "include_uid_range",
  "exclude_uid_range",
  "include_interface",
  "exclude_interface",
  "include_package",
  "exclude_package",
  "auto_redirect",
  "interface_name",
  "mtu",
  "strict_route",
  ...listenSharedFields,
  ...quicSharedFields,
]);
export const outboundHandledFields: ReadonlySet<string> = new Set([
  "tag",
  "type",
  "server",
  "server_port",
  "outbounds",
  "default",
  "interrupt_exist_connections",
  "tls",
  "multiplex",
  "transport",
  "udp_over_tcp",
  "network",
  "method",
  "version",
  "security",
  "flow",
  "congestion_control",
  "version",
  "uuid",
  "username",
  "password",
  "auth_str",
  "user",
  "private_key",
  "private_key_path",
  "private_key_passphrase",
  "host_key",
  "host_key_algorithms",
  "client_version",
  "cipher",
  "mac",
  "kex_algorithm",
  "url",
  "interval",
  "tolerance",
  "idle_timeout",
  "packet_encoding",
  "plugin",
  "plugin_opts",
  "udp_relay_mode",
  "udp_over_stream",
  "obfs",
  "executable_path",
  "data_directory",
  "extra_args",
  "torrc",
  "extra_headers",
  "path",
  "headers",
  "quic_congestion_control",
  "quic",
  "insecure_concurrency",
  "heartbeat",
  "zero_rtt_handshake",
  "server_ports",
  "hop_interval",
  "up_mbps",
  "down_mbps",
  "idle_session_check_interval",
  "idle_session_timeout",
  "min_idle_session",
  // U7a — outbound hysteria2 1.14 fields promoted to dedicated controls (outbound/hysteria2.md).
  "hop_interval_max",
  "bbr_profile",
  "realm",
  ...dialSharedFields,
  ...quicSharedFields,
]);

// C17 (silent-unreachable guard): every key targeted by a dedicated inline control — i.e. every
// `updateField(ref, "<key>", …)` literal in the inbound/outbound/shared editors. A handled key not in
// this set AND not surfaced by any shared-field group would be excluded from the Advanced JSON fallback
// yet have no editor (the C1 transport / C3 tls.acme failure). Keep in sync with the inline controls;
// the guard's coverage check (structurallyCoveredKeys) unions this with the shared-group field paths.
export const INLINE_RENDERED_KEYS: ReadonlySet<string> = new Set([
  // DF2 — dns-server / endpoint inline controls the cross-kind set previously omitted (the C17 guard only
  // ran on inbound/outbound before, so these never needed listing): accept_default_resolvers /
  // accept_search_domain / inet4_range / inet6_range (dns-server) + relay_server_static_endpoints /
  // system_interface_mtu (tailscale endpoint). All have real `updateField(…)` literals (anti-drift test).
  "accept_default_resolvers", "accept_search_domain", "inet4_range", "inet6_range",
  "relay_server_static_endpoints", "system_interface_mtu",
  // U4 — tailscale endpoint controls (endpoint/tailscale.md); all have real updateField(entityRef, …) literals.
  "accept_routes", "ephemeral", "exit_node", "exit_node_allow_lan_access", "hostname", "relay_server_port",
  // U5 — WireGuard endpoint controls (endpoint/wireguard.md); listen_port / name (system-gated) / workers.
  "listen_port", "name", "workers",
  "address", "advertise_routes", "advertise_tags", "auth_key", "auth_str", "auth_timeout", "auto_detect_interface",
  "auto_redirect", "auto_route", "brutal_debug", "cache_capacity", "cache_file", "cache_path", "certificate",
  "certificate_directory_path", "certificate_path", "cipher", "client_subnet", "client_version", "clash_api",
  "config_path", "congestion_control", "control_url", "credential_path", "data_directory", "default",
  "default_interface", "default_mark", "detour", "disable_cache", "disable_expire", "disabled", "down_mbps",
  "download_detour", "enabled", "endpoint", "endpoint_independent_nat", "exclude_interface", "exclude_package",
  "exclude_uid_range", "executable_path", "extra_args", "extra_headers", "fakeip", "fallback",
  "fallback_for_alpn", "final",
  "find_process", "flow", "format", "grace_period", "ha_connections", "headers", "heartbeat", "home",
  "hop_interval", "hop_interval_max", "bbr_profile", "realm", "host_key", "host_key_algorithms", "idle_session_check_interval", "idle_session_timeout",
  "idle_timeout", "include_interface", "include_package", "include_uid_range", "independent_cache", "insecure_concurrency", "interface",
  "interface_name", "mtu",
  "interrupt_exist_connections", "interval", "kex_algorithm", "level", "loopback_address", "mac", "masquerade",
  "mesh_psk", "mesh_psk_file", "mesh_with", "method", "min_idle_session", "network", "obfs", "optimistic",
  "outbounds", "output", "override_address", "override_android_vpn", "override_port", "packet_encoding",
  "padding_scheme", "password", "path", "peers", "platform", "plugin", "plugin_opts", "post_quantum",
  "predefined", "prefer_go", "private_key", "private_key_passphrase", "private_key_path", "protocol",
  "quic", "quic_congestion_control", "region", "reverse_mapping", "route_address", "route_address_set",
  "route_exclude_address", "route_exclude_address_set", "rules", "security", "server", "server_port",
  "server_ports", "servers", "service", "set_system_proxy", "stack", "state_directory", "store", "strategy",
  "strict_route",
  "stun", "system", "system_interface", "system_interface_name", "timeout", "timestamp", "token", "tolerance", "torrc",
  "udp_over_stream", "udp_relay_mode", "up_mbps", "update_interval", "url", "usages_path", "user", "username",
  "users", "uuid", "verify_client_endpoint", "verify_client_url", "version", "zero_rtt_handshake",
]);

// C17: the set of keys a structured control covers for a given kind — the inline-control keys above plus
// every top-level key surfaced by a shared-field group any creatable type of that kind can carry. The
// guard asserts inbound/outbound handledFields ⊆ this set (channel-invariant in practice; computed per
// channel since shared-group membership can be channel-gated).
// Scope/limitation (by design, per C17): this proves a field DEFINITION / inline-control key EXISTS, not
// that it renders a *working* control, and INLINE_RENDERED_KEYS is a single cross-kind set — so it does
// not replace per-control coverage atomics (C1 transport, C3 tls.acme) and is a superset signal, not a
// full reachability proof. It catches the "handled key with no editor anywhere" class.
// DF2 — the guard now spans all five typed entity kinds (was inbound/outbound only). endpoint /
// dns-server / service have the same "handled key with no editor" hazard, so structurally proving their
// handledFields ⊆ covered closes that regression surface too.
export type C17CoverageKind = "inbound" | "outbound" | "endpoint" | "dns-server" | "service";
const CREATABLE_TYPES_BY_KIND: Record<C17CoverageKind, readonly string[]> = {
  inbound: CREATABLE_INBOUND_TYPES,
  outbound: CREATABLE_OUTBOUND_TYPES,
  endpoint: CREATABLE_ENDPOINT_TYPES,
  "dns-server": CREATABLE_DNS_SERVER_TYPES,
  service: CREATABLE_SERVICE_TYPES,
};
export function structurallyCoveredKeys(
  kind: C17CoverageKind,
  channel: SingBoxChannel,
): Set<string> {
  const covered = new Set<string>(["tag", "type"]);
  for (const key of INLINE_RENDERED_KEYS) covered.add(key);
  const types = CREATABLE_TYPES_BY_KIND[kind];
  const probeConfig = {} as SingBoxConfig;
  for (const type of types) {
    const ref = { kind, tag: "__probe__" } as EntityRef;
    for (const group of sharedGroupsForEntity(ref, type, channel)) {
      for (const definition of sharedFieldDefinitions(group, ref, type, probeConfig, channel)) {
        const head = definition.path[0];
        if (head) covered.add(head);
      }
    }
  }
  return covered;
}

const dnsServerHandledFields = new Set([
  "tag",
  "type",
  "address",
  "server",
  "server_port",
  "path",
  "endpoint",
  "service",
  "accept_default_resolvers",
  "accept_search_domain",
  "tls",
  "neighbor_domain",
  "prefer_go",
  "predefined",
  "inet4_range",
  "inet6_range",
  "headers",
  "interface",
  ...dialSharedFields,
]);
// On stable the `accept_search_domain` first-class toggle is hidden (it is 1.14+). Drop it from the
// handled set there so an imported stable value still falls through to the Advanced fallback and can be
// inspected/removed, rather than being invisible AND stuck.
const dnsServerHandledFieldsStable = new Set([...dnsServerHandledFields].filter((f) => f !== "accept_search_domain"));
export function dnsServerHandledFieldsForChannel(channel: string): Set<string> {
  return channel === "testing" ? dnsServerHandledFields : dnsServerHandledFieldsStable;
}
export const endpointHandledFields = new Set([
  "tag",
  "type",
  "address",
  "private_key",
  "peers",
  "detour",
  "state_directory",
  "control_url",
  "advertise_routes",
  "advertise_tags",
  "auth_key",
  "system",
  "system_interface",
  "system_interface_name",
  "system_interface_mtu",
  "relay_server_static_endpoints",
  // U4 — tailscale fields promoted to dedicated controls (endpoint/tailscale.md).
  "accept_routes",
  "ephemeral",
  "exit_node",
  "exit_node_allow_lan_access",
  "hostname",
  "relay_server_port",
  // U5 — WireGuard interface fields promoted to dedicated controls (endpoint/wireguard.md). Handled so a
  // value never double-renders in the Advanced fallback (the `name` control is system-gated).
  "listen_port",
  "name",
  "workers",
  ...dialSharedFields,
]);
export const serviceHandledFields = new Set([
  "tag",
  "type",
  "listen",
  "listen_port",
  "tls",
  "servers",
  "cache_path",
  "config_path",
  "verify_client_endpoint",
  "verify_client_url",
  "home",
  "mesh_with",
  "mesh_psk",
  "mesh_psk_file",
  "stun",
  "credential_path",
  "usages_path",
  "users",
  "headers",
  "detour",
  "idle_timeout",
  "keep_alive_period",
  "stream_receive_window",
  "connection_receive_window",
  "max_concurrent_streams",
  ...listenSharedFields,
]);
export const ruleSetHandledFields = new Set(["tag", "type", "format", "url", "path", "update_interval", "download_detour", "http_client", "rules"]);

// C2-B: fields the per-type certificate-provider editor renders structurally; the rest (e.g. http_client,
// dns01_challenge) fall through to the Advanced JSON sections. external_account is an object whose
// key_id/mac_key are rendered as nested controls, so the parent is handled here.
export const certificateProviderHandledFields = new Set([
  "tag",
  "type",
  "domain",
  "email",
  "provider",
  "data_directory",
  "key_type",
  "profile",
  "account_key",
  "external_account",
  "api_token",
  "origin_ca_key",
  "request_type",
  "requested_validity",
  "endpoint",
]);
