// Declarative per-type schema table — the single place to edit when adding a protocol/field.
//
// This table is seeded verbatim from today's hand-written sources (protocols.ts palette/CREATABLE
// lists, commands.ts create*() factories, sharedFieldRegistry.ts group membership, diagnostics.ts
// proxy/tls/required Sets). Each consumer is then flipped, one slice at a time, to derive from this
// table with a byte-identical snapshot test — so a future field add is one row edit, not a sweep
// across 8-9 files.
//
// Type version-gating is NOT carried here: per-type minimum versions live in the curated minVersions.ts
// TYPE_MIN_VERSION table (which deliberately differs from a raw "since" — e.g. mDNS is gated in the
// palette but not badged on canvas), and whole-type deprecations live in nodeLabels NODE_BADGES +
// diagnostics. The old dead row-level versionAdded/deprecatedIn/removedIn markers (read by nothing but a
// tautological test) were removed in V10/G5 to leave those curated sources as the single source. Per-
// FIELD enum value gating still lives on SchemaFieldMeta.since/channel + SchemaEnumOption (V1 consumes it).

import type { SharedFieldGroupId } from "./sharedFieldRegistry";

export type Channel = "stable" | "testing";

export type SchemaEntityKind =
  | "inbound"
  | "outbound"
  | "dns-server"
  | "endpoint"
  | "service"
  | "rule-set";

/** Control kind for a leaf scalar field — drives the data-driven renderer (V0-S2) and V1 validation. */
export type ScalarFieldType = "string" | "number" | "boolean" | "enum";

/** One allowed value of an enum field, with optional UI label + version/channel gating. */
export interface SchemaEnumOption {
  /** The raw value written to the config (and validated by V1). */
  value: string;
  /** UI label when it differs from the raw value (e.g. "1 (no auth)"); the renderer falls back to value. */
  label?: string;
  /** Value introduced in this sing-box version (V1/V4 gate creation/import on it). */
  since?: string;
  /** Value removed/invalid from this version on. */
  until?: string;
  /** Value only valid on this channel (e.g. hysteria2 obfs `gecko` is testing-only, 1.14). */
  channel?: Channel;
  /** Legacy value kept for round-trip + validation, but not offered as a fresh choice. */
  deprecated?: boolean;
  /** Optgroup label for the data-driven renderer (e.g. shadowsocks methods grouped 2022/AEAD/Legacy). */
  group?: string;
}

/**
 * Per-field type/enum metadata for a leaf scalar field of a (kind,type). Seeded from the protocol
 * sub-docs (the `doc` is the single source of truth the markers test pins every value to). This is the
 * data底座 the V1 enum/type validation and the V0-S2 data-driven renderer both consume.
 */
export interface SchemaFieldMeta {
  /** Field path within the entity object, e.g. ["method"] or ["obfs","type"]. */
  path: string[];
  type: ScalarFieldType;
  /** Allowed values when type==="enum" (a closed set; empty/undefined config value = unset, never invalid). */
  enum?: SchemaEnumOption[];
  /** Field introduced in this sing-box version. */
  since?: string;
  /** Field only valid on this channel. */
  channel?: Channel;
  /** Upstream doc this field's type/enum is transcribed from, relative to `<channel>/configuration/`. */
  doc: string;
  /** V0-S2 data-driven renderer presentation: the control's display label (defaults to a title-cased path). */
  label?: string;
  /** The empty `<option>` text shown when the value is unset (defaults to "(default)"). */
  emptyLabel?: string;
  /** Coerce the chosen value to a Number on write (e.g. shadowtls `version` is a numeric enum). */
  numeric?: boolean;
}

export interface SchemaRow {
  kind: SchemaEntityKind;
  type: string;
  /** Offered in the palette (CREATABLE_*) vs reference-only (deprecated/removed types kept for round-trip). */
  creatable: boolean;
  /** Palette item key that maps to this type (protocols.ts *_PALETTE_TYPES); undefined when the kind has no palette map. */
  paletteKind?: string;
  /**
   * Only meaningful on this channel; undefined = available on every selectable target. Today the
   * live testing-only gating lives in Palette status flags + targets.ts, not one transcribable Set —
   * this is forward-looking metadata that a later slice consumes (the markers test asserts its values).
   */
  channel?: Channel;
  /** Byte-identical factory used by commands.create*(). */
  factory: (tag: string) => Record<string, unknown>;
  /** Channel-invariant shared-field groups for this (kind,type), in render order. */
  sharedGroups: SharedFieldGroupId[];
  /** Shared-field groups added only on the testing channel (e.g. rule-set remote http_client, 1.14). */
  testingSharedGroups?: SharedFieldGroupId[];
  /** Proxy outbound — needs a server + an in-range server_port (diagnostics). */
  proxy?: boolean;
  /** Requires tls.enabled=true or sing-box refuses to start (diagnostics). */
  tlsRequired?: boolean;
  /** Baseline required scalar fields beyond the universal type+tag (diagnostics), e.g. cloudflared token. */
  requiredFields?: string[];
  /** Per-field type/enum metadata for leaf scalar fields (V0-S1) — drives V1 validation + V0-S2 renderer. */
  fields?: SchemaFieldMeta[];
}

// Reusable enum option sets (shared by reference — `fields` arrays are read-only metadata).
const NETWORK_ENUM: SchemaEnumOption[] = [{ value: "tcp" }, { value: "udp" }];
const PACKET_ENCODING_ENUM: SchemaEnumOption[] = [{ value: "packetaddr" }, { value: "xudp" }];
const VLESS_FLOW_ENUM: SchemaEnumOption[] = [{ value: "xtls-rprx-vision" }];
const SHADOWTLS_VERSION_ENUM: SchemaEnumOption[] = [
  { value: "1", label: "1 (no auth)" },
  { value: "2", label: "2 (single user)" },
  { value: "3", label: "3 (single user, server-side hash)" },
];
// shared/shadowsocks.md outbound method list: 2022 + AEAD + legacy stream ciphers (all round-trip-valid).
const SS_METHOD_ENUM: SchemaEnumOption[] = [
  { value: "2022-blake3-aes-128-gcm", group: "Shadowsocks 2022" },
  { value: "2022-blake3-aes-256-gcm", group: "Shadowsocks 2022" },
  { value: "2022-blake3-chacha20-poly1305", group: "Shadowsocks 2022" },
  { value: "aes-128-gcm", group: "AEAD" },
  { value: "aes-192-gcm", group: "AEAD" },
  { value: "aes-256-gcm", group: "AEAD" },
  { value: "chacha20-ietf-poly1305", group: "AEAD" },
  { value: "xchacha20-ietf-poly1305", group: "AEAD" },
  { value: "none", group: "Other" },
  { value: "aes-128-ctr", deprecated: true, group: "Legacy / Stream cipher" },
  { value: "aes-192-ctr", deprecated: true, group: "Legacy / Stream cipher" },
  { value: "aes-256-ctr", deprecated: true, group: "Legacy / Stream cipher" },
  { value: "aes-128-cfb", deprecated: true, group: "Legacy / Stream cipher" },
  { value: "aes-192-cfb", deprecated: true, group: "Legacy / Stream cipher" },
  { value: "aes-256-cfb", deprecated: true, group: "Legacy / Stream cipher" },
  { value: "rc4-md5", deprecated: true, group: "Legacy / Stream cipher" },
  { value: "chacha20-ietf", deprecated: true, group: "Legacy / Stream cipher" },
  { value: "xchacha20", deprecated: true, group: "Legacy / Stream cipher" },
];
// inbound/shadowsocks.md method table lists the modern AEAD/2022 set only — no legacy stream ciphers.
const SS_METHOD_MODERN_ENUM: SchemaEnumOption[] = SS_METHOD_ENUM.filter((option) => !option.deprecated);

const LISTEN_LOCAL = "127.0.0.1";

export const SCHEMA_ROWS: SchemaRow[] = [
  // ── Inbounds ───────────────────────────────────────────────────────────────────────────────────
  {
    kind: "inbound",
    type: "direct",
    creatable: true,
    paletteKind: "inbound-direct",
    factory: (tag) => ({ type: "direct", tag, listen: LISTEN_LOCAL, listen_port: 2081 }),
    sharedGroups: ["listen"],
    fields: [{ path: ["network"], type: "enum", enum: NETWORK_ENUM, doc: "inbound/direct.md" }],
  },
  {
    kind: "inbound",
    type: "mixed",
    creatable: true,
    paletteKind: "inbound-mixed",
    factory: (tag) => ({ type: "mixed", tag, listen: LISTEN_LOCAL, listen_port: 2080, set_system_proxy: false }),
    sharedGroups: ["listen"],
  },
  {
    kind: "inbound",
    type: "socks",
    creatable: true,
    paletteKind: "inbound-socks",
    factory: (tag) => ({
      type: "socks",
      tag,
      listen: LISTEN_LOCAL,
      listen_port: 2080,
      users: [{ username: "user", password: "change-me" }],
    }),
    sharedGroups: ["listen"],
  },
  {
    kind: "inbound",
    type: "http",
    creatable: true,
    paletteKind: "inbound-http",
    factory: (tag) => ({
      type: "http",
      tag,
      listen: LISTEN_LOCAL,
      listen_port: 2080,
      users: [{ username: "user", password: "change-me" }],
      set_system_proxy: false,
    }),
    sharedGroups: ["listen", "tls"],
  },
  {
    kind: "inbound",
    type: "shadowsocks",
    creatable: true,
    paletteKind: "inbound-shadowsocks",
    factory: (tag) => ({
      type: "shadowsocks",
      tag,
      listen: LISTEN_LOCAL,
      listen_port: 2080,
      method: "aes-128-gcm",
      password: "change-me",
    }),
    sharedGroups: ["listen", "multiplex", "tcp-brutal"],
    fields: [
      { path: ["method"], type: "enum", enum: SS_METHOD_MODERN_ENUM, doc: "inbound/shadowsocks.md" },
      { path: ["network"], type: "enum", enum: NETWORK_ENUM, doc: "inbound/shadowsocks.md" },
    ],
  },
  {
    kind: "inbound",
    type: "vmess",
    creatable: true,
    paletteKind: "inbound-vmess",
    factory: (tag) => ({
      type: "vmess",
      tag,
      listen: LISTEN_LOCAL,
      listen_port: 2080,
      users: [{ name: "user", uuid: "bf000d23-0752-40b4-affe-68f7707a9661", alterId: 0 }],
    }),
    sharedGroups: ["listen", "tls", "multiplex", "tcp-brutal", "v2ray-transport"],
  },
  {
    kind: "inbound",
    type: "trojan",
    creatable: true,
    paletteKind: "inbound-trojan",
    tlsRequired: true,
    factory: (tag) => ({
      type: "trojan",
      tag,
      listen: LISTEN_LOCAL,
      listen_port: 2080,
      users: [{ name: "user", password: "change-me" }],
      tls: { enabled: true, server_name: "" },
    }),
    sharedGroups: ["listen", "tls", "multiplex", "tcp-brutal", "v2ray-transport"],
  },
  {
    kind: "inbound",
    type: "naive",
    creatable: true,
    paletteKind: "inbound-naive",
    tlsRequired: true,
    factory: (tag) => ({
      type: "naive",
      tag,
      listen: LISTEN_LOCAL,
      listen_port: 2080,
      users: [{ username: "user", password: "change-me" }],
      tls: { enabled: true, server_name: "" },
    }),
    sharedGroups: ["listen", "tls"],
    fields: [
      { path: ["network"], type: "enum", enum: NETWORK_ENUM, doc: "inbound/naive.md" },
      {
        path: ["quic_congestion_control"],
        type: "enum",
        since: "1.13",
        doc: "inbound/naive.md",
        enum: [
          { value: "bbr" },
          { value: "bbr_standard" },
          { value: "bbr2" },
          { value: "bbr2_variant" },
          { value: "cubic" },
          { value: "reno" },
        ],
      },
    ],
  },
  {
    kind: "inbound",
    type: "hysteria",
    creatable: true,
    paletteKind: "inbound-hysteria",
    tlsRequired: true,
    factory: (tag) => ({
      type: "hysteria",
      tag,
      listen: LISTEN_LOCAL,
      listen_port: 2080,
      up_mbps: 100,
      down_mbps: 100,
      users: [{ name: "user", auth_str: "change-me" }],
      tls: { enabled: true, server_name: "" },
    }),
    sharedGroups: ["listen", "tls", "quic"],
  },
  {
    kind: "inbound",
    type: "shadowtls",
    creatable: true,
    paletteKind: "inbound-shadowtls",
    factory: (tag) => ({
      type: "shadowtls",
      tag,
      listen: LISTEN_LOCAL,
      listen_port: 2080,
      version: 3,
      users: [{ name: "user", password: "change-me" }],
      handshake: { server: "google.com", server_port: 443 },
    }),
    sharedGroups: ["listen", "dial"],
    fields: [
      // version is stored numeric (factory `version: 3`); V1 compares String(value) against these.
      { path: ["version"], type: "enum", enum: SHADOWTLS_VERSION_ENUM, numeric: true, doc: "inbound/shadowtls.md" },
      {
        path: ["wildcard_sni"],
        type: "enum",
        since: "1.12",
        doc: "inbound/shadowtls.md",
        enum: [{ value: "off" }, { value: "authed" }, { value: "all" }],
      },
    ],
  },
  {
    kind: "inbound",
    type: "vless",
    creatable: true,
    paletteKind: "inbound-vless",
    factory: (tag) => ({
      type: "vless",
      tag,
      listen: LISTEN_LOCAL,
      listen_port: 2080,
      users: [{ name: "user", uuid: "bf000d23-0752-40b4-affe-68f7707a9661" }],
    }),
    sharedGroups: ["listen", "tls", "multiplex", "tcp-brutal", "v2ray-transport"],
  },
  {
    kind: "inbound",
    type: "tuic",
    creatable: true,
    paletteKind: "inbound-tuic",
    tlsRequired: true,
    factory: (tag) => ({
      type: "tuic",
      tag,
      listen: LISTEN_LOCAL,
      listen_port: 2080,
      users: [{ name: "user", uuid: "059032a9-7d40-4a96-9bb1-36823d848068", password: "change-me" }],
      congestion_control: "cubic",
      auth_timeout: "3s",
      zero_rtt_handshake: false,
      heartbeat: "10s",
      tls: { enabled: true, server_name: "" },
    }),
    sharedGroups: ["listen", "tls", "quic"],
  },
  {
    kind: "inbound",
    type: "hysteria2",
    creatable: true,
    paletteKind: "inbound-hysteria2",
    tlsRequired: true,
    factory: (tag) => ({
      type: "hysteria2",
      tag,
      listen: LISTEN_LOCAL,
      listen_port: 2080,
      up_mbps: 100,
      down_mbps: 100,
      users: [{ name: "user", password: "change-me" }],
      ignore_client_bandwidth: false,
      tls: { enabled: true, server_name: "" },
    }),
    sharedGroups: ["listen", "tls", "quic"],
  },
  {
    kind: "inbound",
    type: "anytls",
    creatable: true,
    paletteKind: "inbound-anytls",
    tlsRequired: true,
    factory: (tag) => ({
      type: "anytls",
      tag,
      listen: LISTEN_LOCAL,
      listen_port: 2080,
      users: [{ name: "user", password: "change-me" }],
      tls: { enabled: true, server_name: "" },
    }),
    sharedGroups: ["listen", "tls"],
  },
  {
    kind: "inbound",
    type: "tun",
    creatable: true,
    paletteKind: "inbound-tun",
    factory: (tag) => ({
      type: "tun",
      tag,
      address: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"],
      auto_route: true,
    }),
    sharedGroups: ["listen"],
    fields: [
      {
        path: ["stack"],
        type: "enum",
        doc: "inbound/tun.md",
        enum: [{ value: "system" }, { value: "gvisor" }, { value: "mixed" }],
      },
    ],
  },
  {
    kind: "inbound",
    type: "redirect",
    creatable: true,
    paletteKind: "inbound-redirect",
    factory: (tag) => ({ type: "redirect", tag, listen: LISTEN_LOCAL, listen_port: 2080 }),
    sharedGroups: ["listen"],
  },
  {
    kind: "inbound",
    type: "tproxy",
    creatable: true,
    paletteKind: "inbound-tproxy",
    factory: (tag) => ({ type: "tproxy", tag, listen: LISTEN_LOCAL, listen_port: 2080 }),
    sharedGroups: ["listen"],
    fields: [{ path: ["network"], type: "enum", enum: NETWORK_ENUM, doc: "inbound/tproxy.md" }],
  },
  {
    kind: "inbound",
    type: "cloudflared",
    creatable: true,
    paletteKind: "inbound-cloudflared",
    channel: "testing",
    requiredFields: ["token"],
    factory: (tag) => ({ type: "cloudflared", tag, token: "" }),
    sharedGroups: ["listen"],
  },

  // ── Outbounds ──────────────────────────────────────────────────────────────────────────────────
  {
    kind: "outbound",
    type: "direct",
    creatable: true,
    paletteKind: "direct",
    factory: (tag) => ({ type: "direct", tag }),
    sharedGroups: ["dial"],
  },
  {
    kind: "outbound",
    type: "block",
    creatable: true,
    paletteKind: "block",
    factory: (tag) => ({ type: "block", tag }),
    sharedGroups: [],
  },
  {
    kind: "outbound",
    type: "socks",
    creatable: true,
    paletteKind: "socks",
    proxy: true,
    factory: (tag) => ({ type: "socks", tag, server: LISTEN_LOCAL, server_port: 1080 }),
    sharedGroups: ["dial", "udp-over-tcp"],
    fields: [
      {
        path: ["version"],
        type: "enum",
        doc: "outbound/socks.md",
        enum: [{ value: "4" }, { value: "4a" }, { value: "5" }],
      },
      { path: ["network"], type: "enum", enum: NETWORK_ENUM, doc: "outbound/socks.md" },
    ],
  },
  {
    kind: "outbound",
    type: "http",
    creatable: true,
    paletteKind: "http-out",
    proxy: true,
    factory: (tag) => ({
      type: "http",
      tag,
      server: LISTEN_LOCAL,
      server_port: 1080,
      username: "user",
      password: "change-me",
    }),
    sharedGroups: ["dial", "tls"],
  },
  {
    kind: "outbound",
    type: "shadowsocks",
    creatable: true,
    paletteKind: "ss-out",
    proxy: true,
    factory: (tag) => ({
      type: "shadowsocks",
      tag,
      server: LISTEN_LOCAL,
      server_port: 1080,
      method: "aes-128-gcm",
      password: "change-me",
    }),
    sharedGroups: ["dial", "multiplex", "tcp-brutal", "udp-over-tcp"],
    fields: [
      { path: ["method"], type: "enum", enum: SS_METHOD_ENUM, doc: "outbound/shadowsocks.md" },
      { path: ["network"], type: "enum", enum: NETWORK_ENUM, doc: "outbound/shadowsocks.md" },
    ],
  },
  {
    kind: "outbound",
    type: "vmess",
    creatable: true,
    paletteKind: "vmess-out",
    proxy: true,
    factory: (tag) => ({
      type: "vmess",
      tag,
      server: LISTEN_LOCAL,
      server_port: 1080,
      uuid: "bf000d23-0752-40b4-affe-68f7707a9661",
      security: "auto",
      alter_id: 0,
    }),
    sharedGroups: ["dial", "tls", "multiplex", "tcp-brutal", "v2ray-transport"],
    fields: [
      {
        path: ["security"],
        type: "enum",
        doc: "outbound/vmess.md",
        enum: [
          { value: "auto" },
          { value: "none" },
          { value: "zero" },
          { value: "aes-128-gcm" },
          { value: "chacha20-poly1305" },
          { value: "aes-128-ctr", label: "aes-128-ctr (legacy)", deprecated: true },
        ],
      },
      { path: ["packet_encoding"], type: "enum", enum: PACKET_ENCODING_ENUM, doc: "outbound/vmess.md" },
      { path: ["network"], type: "enum", enum: NETWORK_ENUM, doc: "outbound/vmess.md" },
    ],
  },
  {
    kind: "outbound",
    type: "trojan",
    creatable: true,
    paletteKind: "trojan-out",
    proxy: true,
    tlsRequired: true,
    factory: (tag) => ({
      type: "trojan",
      tag,
      server: LISTEN_LOCAL,
      server_port: 1080,
      password: "change-me",
      tls: { enabled: true, server_name: "" },
    }),
    sharedGroups: ["dial", "tls", "multiplex", "tcp-brutal", "v2ray-transport"],
    fields: [{ path: ["network"], type: "enum", enum: NETWORK_ENUM, doc: "outbound/trojan.md" }],
  },
  {
    kind: "outbound",
    type: "naive",
    creatable: true,
    paletteKind: "naive-out",
    proxy: true,
    tlsRequired: true,
    factory: (tag) => ({
      type: "naive",
      tag,
      server: LISTEN_LOCAL,
      server_port: 1080,
      username: "user",
      password: "change-me",
      tls: { enabled: true, server_name: "" },
    }),
    sharedGroups: ["dial", "tls", "udp-over-tcp"],
    fields: [
      {
        path: ["quic_congestion_control"],
        type: "enum",
        doc: "outbound/naive.md",
        enum: [{ value: "bbr" }, { value: "bbr2" }, { value: "cubic" }, { value: "reno" }],
      },
    ],
  },
  {
    kind: "outbound",
    type: "wireguard",
    creatable: false,
    paletteKind: "wireguard-out",
    factory: (tag) => ({ type: "wireguard", tag }),
    sharedGroups: ["dial"],
  },
  {
    kind: "outbound",
    type: "hysteria",
    creatable: true,
    paletteKind: "hysteria-out",
    proxy: true,
    tlsRequired: true,
    factory: (tag) => ({
      type: "hysteria",
      tag,
      server: LISTEN_LOCAL,
      server_port: 1080,
      up_mbps: 100,
      down_mbps: 100,
      auth_str: "change-me",
      tls: { enabled: true, server_name: "" },
    }),
    sharedGroups: ["dial", "tls", "quic"],
    fields: [{ path: ["network"], type: "enum", enum: NETWORK_ENUM, doc: "outbound/hysteria.md" }],
  },
  {
    kind: "outbound",
    type: "shadowtls",
    creatable: true,
    paletteKind: "shadowtls-out",
    proxy: true,
    tlsRequired: true,
    factory: (tag) => ({
      type: "shadowtls",
      tag,
      server: LISTEN_LOCAL,
      server_port: 1080,
      version: 3,
      password: "change-me",
      tls: { enabled: true, server_name: "" },
    }),
    sharedGroups: ["dial", "tls"],
    fields: [{ path: ["version"], type: "enum", enum: SHADOWTLS_VERSION_ENUM, numeric: true, doc: "outbound/shadowtls.md" }],
  },
  {
    kind: "outbound",
    type: "vless",
    creatable: true,
    paletteKind: "vless-out",
    proxy: true,
    factory: (tag) => ({
      type: "vless",
      tag,
      server: LISTEN_LOCAL,
      server_port: 1080,
      uuid: "bf000d23-0752-40b4-affe-68f7707a9661",
      tls: { enabled: true, server_name: "" },
    }),
    sharedGroups: ["dial", "tls", "multiplex", "tcp-brutal", "v2ray-transport"],
    fields: [
      { path: ["flow"], type: "enum", enum: VLESS_FLOW_ENUM, doc: "outbound/vless.md" },
      { path: ["packet_encoding"], type: "enum", enum: PACKET_ENCODING_ENUM, doc: "outbound/vless.md" },
      { path: ["network"], type: "enum", enum: NETWORK_ENUM, doc: "outbound/vless.md" },
    ],
  },
  {
    kind: "outbound",
    type: "tuic",
    creatable: true,
    paletteKind: "tuic-out",
    proxy: true,
    tlsRequired: true,
    factory: (tag) => ({
      type: "tuic",
      tag,
      server: LISTEN_LOCAL,
      server_port: 1080,
      uuid: "2dd61d93-75d8-4da4-ac0e-6aece7eac365",
      password: "change-me",
      congestion_control: "cubic",
      udp_relay_mode: "native",
      tls: { enabled: true, server_name: "" },
    }),
    sharedGroups: ["dial", "tls", "quic"],
    fields: [
      {
        path: ["congestion_control"],
        type: "enum",
        doc: "outbound/tuic.md",
        enum: [{ value: "cubic" }, { value: "new_reno" }, { value: "bbr" }],
      },
      {
        path: ["udp_relay_mode"],
        type: "enum",
        doc: "outbound/tuic.md",
        enum: [{ value: "native" }, { value: "quic" }],
      },
      { path: ["network"], type: "enum", enum: NETWORK_ENUM, doc: "outbound/tuic.md" },
    ],
  },
  {
    kind: "outbound",
    type: "hysteria2",
    creatable: true,
    paletteKind: "hysteria2-out",
    proxy: true,
    tlsRequired: true,
    factory: (tag) => ({
      type: "hysteria2",
      tag,
      server: LISTEN_LOCAL,
      server_port: 1080,
      password: "change-me",
      up_mbps: 100,
      down_mbps: 100,
      tls: { enabled: true, server_name: "" },
    }),
    sharedGroups: ["dial", "tls", "quic"],
    fields: [
      {
        path: ["obfs", "type"],
        type: "enum",
        doc: "outbound/hysteria2.md",
        enum: [{ value: "salamander" }, { value: "gecko", since: "1.14", channel: "testing" }],
      },
      { path: ["network"], type: "enum", enum: NETWORK_ENUM, doc: "outbound/hysteria2.md" },
    ],
  },
  {
    kind: "outbound",
    type: "anytls",
    creatable: true,
    paletteKind: "anytls-out",
    proxy: true,
    tlsRequired: true,
    factory: (tag) => ({
      type: "anytls",
      tag,
      server: LISTEN_LOCAL,
      server_port: 1080,
      password: "change-me",
      idle_session_check_interval: "30s",
      idle_session_timeout: "30s",
      min_idle_session: 5,
      tls: { enabled: true, server_name: "" },
    }),
    sharedGroups: ["dial", "tls"],
  },
  {
    kind: "outbound",
    type: "tor",
    creatable: true,
    paletteKind: "tor-out",
    factory: (tag) => ({
      type: "tor",
      tag,
      executable_path: "/usr/bin/tor",
      extra_args: [],
      data_directory: "$HOME/.cache/tor",
      torrc: { ClientOnly: 1 },
    }),
    sharedGroups: ["dial"],
  },
  {
    kind: "outbound",
    type: "ssh",
    creatable: true,
    paletteKind: "ssh-out",
    proxy: true,
    factory: (tag) => ({
      type: "ssh",
      tag,
      server: LISTEN_LOCAL,
      server_port: 22,
      user: "root",
      password: "change-me",
    }),
    sharedGroups: ["dial"],
  },
  {
    kind: "outbound",
    type: "dns",
    creatable: false,
    paletteKind: "dns-out",
    factory: (tag) => ({ type: "dns", tag }),
    sharedGroups: [],
  },
  {
    kind: "outbound",
    type: "selector",
    creatable: true,
    paletteKind: "selector",
    factory: (tag) => ({ type: "selector", tag, outbounds: [], default: undefined }),
    sharedGroups: [],
  },
  {
    kind: "outbound",
    type: "urltest",
    creatable: true,
    paletteKind: "urltest",
    factory: (tag) => ({
      type: "urltest",
      tag,
      outbounds: [],
      url: "https://www.gstatic.com/generate_204",
      interval: "3m",
      tolerance: 50,
      idle_timeout: "30m",
      interrupt_exist_connections: false,
    }),
    sharedGroups: [],
  },

  // ── DNS servers ────────────────────────────────────────────────────────────────────────────────
  {
    kind: "dns-server",
    type: "legacy",
    creatable: false,
    paletteKind: "dns-legacy",
    // creatable:false is code-encoded (absent from CREATABLE_DNS_SERVER_TYPES). Reference-only, kept for
    // round-trip; its deprecation (1.12→removed 1.14) is enforced by the diagnostics legacy-DNS gate, not here.
    factory: (tag) => ({ type: "legacy", tag, address: "8.8.8.8", strategy: "prefer_ipv4" }),
    sharedGroups: [],
  },
  {
    kind: "dns-server",
    type: "local",
    creatable: true,
    paletteKind: "dns-local",
    factory: (tag) => ({ type: "local", tag }),
    sharedGroups: ["dial", "neighbor"],
  },
  {
    kind: "dns-server",
    type: "hosts",
    creatable: true,
    paletteKind: "dns-hosts",
    factory: (tag) => ({ type: "hosts", tag, path: "/etc/hosts" }),
    sharedGroups: [],
  },
  {
    kind: "dns-server",
    type: "tcp",
    creatable: true,
    paletteKind: "dns-tcp",
    factory: (tag) => ({ type: "tcp", tag, server: "1.1.1.1", server_port: 53 }),
    sharedGroups: ["dial"],
  },
  {
    kind: "dns-server",
    type: "udp",
    creatable: true,
    paletteKind: "dns-udp",
    factory: (tag) => ({ type: "udp", tag, server: "1.1.1.1", server_port: 53 }),
    sharedGroups: ["dial"],
  },
  {
    kind: "dns-server",
    type: "tls",
    creatable: true,
    paletteKind: "dns-tls",
    factory: (tag) => ({ type: "tls", tag, server: "1.1.1.1", server_port: 853 }),
    sharedGroups: ["dial", "tls"],
  },
  {
    kind: "dns-server",
    type: "quic",
    creatable: true,
    paletteKind: "dns-quic",
    factory: (tag) => ({ type: "quic", tag, server: "1.1.1.1", server_port: 853 }),
    sharedGroups: ["dial", "tls"],
  },
  {
    kind: "dns-server",
    type: "https",
    creatable: true,
    paletteKind: "dns-https",
    factory: (tag) => ({ type: "https", tag, server: "1.1.1.1", server_port: 443, path: "/dns-query" }),
    sharedGroups: ["dial", "tls"],
  },
  {
    kind: "dns-server",
    type: "h3",
    creatable: true,
    paletteKind: "dns-h3",
    factory: (tag) => ({ type: "h3", tag, server: "1.1.1.1", server_port: 443, path: "/dns-query" }),
    sharedGroups: ["dial", "tls"],
  },
  {
    kind: "dns-server",
    type: "dhcp",
    creatable: true,
    paletteKind: "dns-dhcp",
    factory: (tag) => ({ type: "dhcp", tag, interface: "auto" }),
    sharedGroups: ["dial"],
  },
  {
    kind: "dns-server",
    type: "fakeip",
    creatable: true,
    paletteKind: "dns-fakeip-server",
    factory: (tag) => ({ type: "fakeip", tag, inet4_range: "198.18.0.0/15", inet6_range: "fc00::/18" }),
    sharedGroups: [],
  },
  {
    kind: "dns-server",
    type: "mdns",
    creatable: false,
    paletteKind: "dns-mdns",
    channel: "testing",
    // mdns is 1.14 testing-only; it is gated in the palette (TESTING_RESOURCE_MIN_VERSION) but deliberately
    // NOT in TYPE_MIN_VERSION, so it carries no canvas "needs 1.14" badge (see minVersions.ts).
    factory: (tag) => ({ type: "mdns", tag, interface: [] }),
    sharedGroups: ["dial"],
  },
  {
    kind: "dns-server",
    type: "tailscale",
    creatable: true,
    paletteKind: "dns-tailscale",
    factory: (tag) => ({ type: "tailscale", tag, accept_default_resolvers: false }),
    sharedGroups: [],
  },
  {
    kind: "dns-server",
    type: "resolved",
    creatable: true,
    paletteKind: "dns-resolved",
    factory: (tag) => ({ type: "resolved", tag, service: "resolved", accept_default_resolvers: false }),
    sharedGroups: [],
  },

  // ── Endpoints ──────────────────────────────────────────────────────────────────────────────────
  {
    kind: "endpoint",
    type: "wireguard",
    creatable: true,
    paletteKind: "endpoint-wireguard",
    factory: (tag) => ({
      type: "wireguard",
      tag,
      system: false,
      name: "wg0",
      mtu: 1408,
      address: ["172.16.0.2/32"],
      private_key: "EEKlAzKfS87ShJPnvEF3AiJjGS9JHEzgn2jB3J7yMkY=",
      peers: [
        {
          address: "127.0.0.1",
          port: 51820,
          public_key: "tM4NaeCZrzxQ6BfhyeuQMy5jDReji4o8h5LVAGpI1HQ=",
          allowed_ips: ["0.0.0.0/0"],
        },
      ],
      udp_timeout: "5m",
    }),
    sharedGroups: ["dial"],
  },
  {
    kind: "endpoint",
    type: "tailscale",
    creatable: true,
    paletteKind: "endpoint-tailscale",
    factory: (tag) => ({
      type: "tailscale",
      tag,
      state_directory: "$HOME/.tailscale",
      control_url: "https://controlplane.tailscale.com",
      accept_routes: false,
      advertise_routes: [],
      advertise_exit_node: false,
      advertise_tags: [],
      system_interface: false,
      udp_timeout: "5m",
    }),
    sharedGroups: ["dial"],
  },

  // ── Services ───────────────────────────────────────────────────────────────────────────────────
  {
    kind: "service",
    type: "derp",
    creatable: true,
    paletteKind: "service-derp",
    factory: (tag) => ({
      type: "derp",
      tag,
      listen: "::",
      listen_port: 8443,
      config_path: "derper.key",
      home: "",
      verify_client_endpoint: [],
      mesh_with: [],
      stun: { enabled: false, listen: "::", listen_port: 3478 },
      tls: { enabled: true, server_name: "" },
    }),
    sharedGroups: ["listen", "tls"],
  },
  {
    kind: "service",
    type: "resolved",
    creatable: true,
    paletteKind: "service-resolved",
    factory: (tag) => ({ type: "resolved", tag, listen: "127.0.0.53", listen_port: 53 }),
    sharedGroups: ["listen"],
  },
  {
    kind: "service",
    type: "ssm-api",
    creatable: true,
    paletteKind: "service-ssm-api",
    factory: (tag) => ({ type: "ssm-api", tag, listen: LISTEN_LOCAL, listen_port: 9090, servers: {}, cache_path: "" }),
    sharedGroups: ["listen", "tls"],
  },
  {
    kind: "service",
    type: "ccm",
    creatable: true,
    paletteKind: "service-ccm",
    factory: (tag) => ({ type: "ccm", tag, listen: LISTEN_LOCAL, listen_port: 8080, users: [] }),
    sharedGroups: ["listen", "tls"],
  },
  {
    kind: "service",
    type: "ocm",
    creatable: true,
    paletteKind: "service-ocm",
    factory: (tag) => ({
      type: "ocm",
      tag,
      listen: LISTEN_LOCAL,
      listen_port: 8081,
      credential_path: "",
      usages_path: "",
      users: [],
      headers: {},
    }),
    sharedGroups: ["listen", "tls"],
  },
  {
    kind: "service",
    type: "hysteria-realm",
    creatable: true,
    paletteKind: "service-hysteria-realm",
    channel: "testing",
    factory: (tag) => ({
      type: "hysteria-realm",
      tag,
      listen: LISTEN_LOCAL,
      listen_port: 8444,
      users: [{ name: "user", token: "change-me", max_realms: 1 }],
    }),
    sharedGroups: ["listen", "tls", "http2"],
  },

  // ── Rule sets ──────────────────────────────────────────────────────────────────────────────────
  {
    kind: "rule-set",
    type: "remote",
    creatable: true,
    factory: (tag) => ({
      type: "remote",
      tag,
      format: "source",
      url: "https://example.com/rules.json",
      update_interval: "1d",
    }),
    sharedGroups: [],
    // http_client is a sing-box 1.14 field; only surfaced on the testing channel.
    testingSharedGroups: ["http-client"],
  },
  {
    kind: "rule-set",
    type: "local",
    creatable: true,
    factory: (tag) => ({ type: "local", tag, format: "source", path: "./rules.json" }),
    sharedGroups: [],
  },
  {
    kind: "rule-set",
    type: "inline",
    creatable: true,
    factory: (tag) => ({ type: "inline", tag, rules: [{ domain_suffix: ["example.com"] }] }),
    sharedGroups: [],
  },
];

// ── Typed selectors ────────────────────────────────────────────────────────────────────────────────

const rowIndex = new Map<string, SchemaRow>(SCHEMA_ROWS.map((row) => [`${row.kind}:${row.type}`, row]));

export function schemaRow(kind: SchemaEntityKind, type: string): SchemaRow | undefined {
  return rowIndex.get(`${kind}:${type}`);
}

export function rowsForKind(kind: SchemaEntityKind): SchemaRow[] {
  return SCHEMA_ROWS.filter((row) => row.kind === kind);
}

/** Creatable type list for a kind, in palette/CREATABLE order (drives protocols.ts CREATABLE_*). */
export function creatableTypes(kind: SchemaEntityKind): string[] {
  return rowsForKind(kind)
    .filter((row) => row.creatable)
    .map((row) => row.type);
}

/** Palette-key → type map for a kind (drives protocols.ts *_PALETTE_TYPES). */
export function paletteTypeMap(kind: SchemaEntityKind): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rowsForKind(kind)) {
    if (row.paletteKind) map[row.paletteKind] = row.type;
  }
  return map;
}

/** Byte-identical factory output for a (kind,type), or undefined when the type is unknown. */
export function factoryFor(kind: SchemaEntityKind, type: string, tag: string): Record<string, unknown> | undefined {
  return schemaRow(kind, type)?.factory(tag);
}

/**
 * Shared-field groups for a typed entity (inbound/outbound/dns-server/endpoint/service/rule-set),
 * reproducing sharedFieldRegistry.sharedGroupsForEntity for those kinds. Non-typed kinds
 * (route/route-rule/dns-rule/settings/http-client) are not table rows and stay inline there.
 */
export function sharedGroupsFromTable(
  kind: SchemaEntityKind,
  type: string | null | undefined,
  channel: Channel = "testing",
): SharedFieldGroupId[] {
  const row = schemaRow(kind, type ?? "");
  if (!row) return [];
  const groups = [...row.sharedGroups];
  if (channel === "testing" && row.testingSharedGroups) groups.push(...row.testingSharedGroups);
  return groups.filter((group, index) => groups.indexOf(group) === index);
}

/** Proxy outbound types (diagnostics: needs server + server_port). */
export function proxyOutboundTypes(): Set<string> {
  return new Set(SCHEMA_ROWS.filter((row) => row.kind === "outbound" && row.proxy).map((row) => row.type));
}

/** Types that require tls.enabled=true, for a given kind (diagnostics). */
export function tlsRequiredTypes(kind: SchemaEntityKind): Set<string> {
  return new Set(rowsForKind(kind).filter((row) => row.tlsRequired).map((row) => row.type));
}

/** Baseline required scalar fields for a (kind,type) beyond the universal type+tag (diagnostics). */
export function requiredFieldsFor(kind: SchemaEntityKind, type: string): string[] {
  return schemaRow(kind, type)?.requiredFields ?? [];
}

/** Per-field type/enum metadata for a (kind,type) — consumed by V1 validation + V0-S2 renderer. */
export function fieldMetaFor(kind: SchemaEntityKind, type: string): SchemaFieldMeta[] {
  return schemaRow(kind, type)?.fields ?? [];
}

/**
 * R4: the canonical top-level field keys a freshly-created (kind,type) entity carries, derived from
 * its factory. This is the single source for type-driven Inspector visibility — render a required
 * identity field (e.g. server / server_port / path) even when an IMPORTED config omitted it, so it
 * can be repaired from the GUI instead of forcing a JSON edit. Falls back to an empty set for unknown
 * types or a throwing factory.
 */
export function defaultFieldKeysFor(kind: SchemaEntityKind, type: string | null | undefined): Set<string> {
  const row = type ? schemaRow(kind, type) : undefined;
  if (!row) return new Set();
  try {
    return new Set(Object.keys(row.factory("_") as Record<string, unknown>));
  } catch {
    return new Set();
  }
}
