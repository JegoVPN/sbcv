import { DOC_FIELD_NAMES } from "./knownFields.generated";
import { schemaRow, type SchemaEntityKind } from "./schemaRegistry";

// W9 — the valid top-level field allowlist per (kind, type), for the unknown-field linter. Domain-only
// (no component imports — preserves the domain↛canvas layering). Sourced from the generated upstream-doc
// field names UNIONED across BOTH channels: a field valid on either stable or testing is a real sing-box
// field, so it is never "unknown" — version-specific fields are caught by the version-gate checks
// (checkQuic114Fields / the testing-only field gates), not here. This linter only flags names that are
// not a sing-box field on ANY version (typos, Clash.Meta extensions like filter/providers, Xray fields
// like streamSettings/mux, removed legacy fields).
//
// The docs' `#### header` lists occasionally omit a field the binary actually accepts; SUPPLEMENT carries
// those (each verified against .tools/bin/sing-box-*). Keyed by kind → type ("*" = every type of the kind).

// Exported so the VT3 data-driven version gate (versionFieldGate.ts) can reuse it as an EXEMPTION set:
// a field stable accepts but the stable doc omits would otherwise look "testing-only" in the byKind diff.
export const STABLE_DOC_FIELD_SUPPLEMENT: Record<string, Record<string, readonly string[]>> = {
  outbound: {
    "*": ["domain_strategy", "fallback_delay", "udp_over_tcp"],
    tuic: ["zero_rtt_handshake"],
    hysteria: ["up_mbps", "down_mbps"],
    hysteria2: ["up_mbps", "down_mbps"],
  },
  inbound: {
    hysteria: ["up_mbps", "down_mbps"],
    hysteria2: ["up_mbps", "down_mbps"],
  },
  "dns-server": {
    fakeip: ["inet4_range", "inet6_range"],
  },
  endpoint: {
    // binary-verified valid on stable + testing; omitted from the `#### header` list in endpoint/wireguard.md
    wireguard: ["listen_port"],
  },
};

// Shared-group id (as used in SCHEMA_ROWS sharedGroups / testingSharedGroups) → generated `shared` doc key
// (the doc basename). Must cover EVERY group any row carries, incl. testing-only groups (http2 / http-client
// / quic / neighbor are 1.14), or that group's fields would be wrongly flagged as unknown.
const SHARED_GROUP_DOC_KEY: Record<string, string> = {
  dial: "dial",
  listen: "listen",
  tls: "tls",
  "http-client": "http-client",
  http2: "http2",
  quic: "quic",
  multiplex: "multiplex",
  "v2ray-transport": "v2ray-transport",
  "udp-over-tcp": "udp-over-tcp",
  "tcp-brutal": "tcp-brutal",
  "wifi-state": "wifi-state",
  neighbor: "neighbor",
  "dns01-challenge": "dns01_challenge",
  "pre-match": "pre-match",
};

function docFields(kind: string, type: string): { fields: string[]; found: boolean } {
  const fields: string[] = [];
  let found = false;
  for (const channel of ["stable", "testing"] as const) {
    const byKind = (DOC_FIELD_NAMES as Record<string, { byKind: Record<string, Record<string, readonly string[]>> }>)[channel]?.byKind;
    const list = byKind?.[kind]?.[type];
    if (list) {
      found = true;
      fields.push(...list);
    }
  }
  return { fields, found };
}

function sharedFields(group: string): string[] {
  const key = SHARED_GROUP_DOC_KEY[group];
  if (!key) return [];
  const out: string[] = [];
  for (const channel of ["stable", "testing"] as const) {
    const shared = (DOC_FIELD_NAMES as Record<string, { shared: Record<string, readonly string[]> }>)[channel]?.shared;
    if (shared?.[key]) out.push(...shared[key]);
  }
  return out;
}

// Returns the set of valid top-level field names for (kind, type), or null when the type has no upstream
// doc (then the linter must skip it — it cannot judge what is unknown).
export function knownFieldsFor(kind: string, type: unknown): Set<string> | null {
  if (typeof type !== "string" || !type) return null;
  const { fields, found } = docFields(kind, type);
  if (!found) return null;
  const set = new Set<string>(["tag", "type", ...fields]);
  const row = schemaRow(kind as SchemaEntityKind, type);
  for (const g of [...(row?.sharedGroups ?? []), ...(row?.testingSharedGroups ?? [])]) for (const f of sharedFields(g)) set.add(f);
  for (const f of (row?.fields ?? []).map((field) => field.path[0]).filter(Boolean) as string[]) set.add(f);
  for (const f of STABLE_DOC_FIELD_SUPPLEMENT[kind]?.[type] ?? []) set.add(f);
  for (const f of STABLE_DOC_FIELD_SUPPLEMENT[kind]?.["*"] ?? []) set.add(f);
  return set;
}
