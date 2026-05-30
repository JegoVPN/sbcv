import { CREATABLE_INBOUND_TYPES, CREATABLE_OUTBOUND_TYPES } from "../../domain/protocols";
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
  "fallback",
  "fallback_for_alpn",
  "override_address",
  "override_port",
  "network",
  "token",
  "ha_connections",
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
  ...dialSharedFields,
  ...quicSharedFields,
]);

// C17 (silent-unreachable guard): every key targeted by a dedicated inline control — i.e. every
// `updateField(ref, "<key>", …)` literal in the inbound/outbound/shared editors. A handled key not in
// this set AND not surfaced by any shared-field group would be excluded from the Advanced JSON fallback
// yet have no editor (the C1 transport / C3 tls.acme failure). Keep in sync with the inline controls;
// the guard's coverage check (structurallyCoveredKeys) unions this with the shared-group field paths.
export const INLINE_RENDERED_KEYS: ReadonlySet<string> = new Set([
  "address", "advertise_routes", "advertise_tags", "auth_key", "auth_str", "auto_detect_interface",
  "auto_redirect", "auto_route", "brutal_debug", "cache_capacity", "cache_file", "cache_path", "certificate",
  "certificate_directory_path", "certificate_path", "cipher", "client_subnet", "client_version", "clash_api",
  "config_path", "congestion_control", "control_url", "credential_path", "data_directory", "default",
  "default_interface", "default_mark", "detour", "disable_cache", "disable_expire", "disabled", "down_mbps",
  "download_detour", "enabled", "endpoint", "endpoint_independent_nat", "exclude_interface", "exclude_package",
  "exclude_uid_range", "executable_path", "extra_args", "extra_headers", "fakeip", "fallback",
  "fallback_for_alpn", "final",
  "find_process", "flow", "format", "grace_period", "ha_connections", "headers", "heartbeat", "home",
  "hop_interval", "host_key", "host_key_algorithms", "idle_session_check_interval", "idle_session_timeout",
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
  "stun", "system_interface", "system_interface_name", "timeout", "timestamp", "token", "tolerance", "torrc",
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
export function structurallyCoveredKeys(
  kind: "inbound" | "outbound",
  channel: SingBoxChannel,
): Set<string> {
  const covered = new Set<string>(["tag", "type"]);
  for (const key of INLINE_RENDERED_KEYS) covered.add(key);
  const types = kind === "inbound" ? CREATABLE_INBOUND_TYPES : CREATABLE_OUTBOUND_TYPES;
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
  "system_interface",
  "system_interface_name",
  "system_interface_mtu",
  "relay_server_static_endpoints",
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
