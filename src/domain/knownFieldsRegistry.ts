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

const SUPPLEMENT: Record<string, Record<string, readonly string[]>> = {
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
};

const SHARED_GROUP_DOC_KEY: Record<string, string> = {
  dial: "dial",
  listen: "listen",
  tls: "tls",
  multiplex: "multiplex",
  "v2ray-transport": "v2ray-transport",
  quic: "quic",
  "udp-over-tcp": "udp-over-tcp",
  "tcp-brutal": "tcp-brutal",
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
  for (const g of row?.sharedGroups ?? []) for (const f of sharedFields(g)) set.add(f);
  for (const f of (row?.fields ?? []).map((field) => field.path[0]).filter(Boolean) as string[]) set.add(f);
  for (const f of SUPPLEMENT[kind]?.[type] ?? []) set.add(f);
  for (const f of SUPPLEMENT[kind]?.["*"] ?? []) set.add(f);
  return set;
}
