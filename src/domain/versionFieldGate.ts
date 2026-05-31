import { DOC_FIELD_NAMES } from "./knownFields.generated";
import { STABLE_DOC_FIELD_SUPPLEMENT } from "./knownFieldsRegistry";

// VT3 — data-driven testing-only field gate. A top-level field that appears in testing's per-(kind,type)
// doc field set but NOT stable's is 1.14-only, so on a stable target it is an export-blocking error. This
// is the CLOSED-SET backstop behind the hand-written per-field gates (W8 / VT1): those stay as friendlier
// messages. U14 — scope: this catches 1.14-only TOP-LEVEL fields on the typed array-collection entity kinds
// the caller iterates (inbound/outbound/endpoint/dns-server/service/rule-set/certificate-provider). Singleton
// owners (dns/route/experimental) and nested under-object fields are NOT in that set — they are hand-gated.
//
// Two guards against M1-class false positives (gating a field stable actually accepts):
//  1. SUPPLEMENT exemption — `knownFieldsRegistry`'s STABLE_DOC_FIELD_SUPPLEMENT lists fields stable
//     accepts but its `#### header` doc omits (binary-verified). Subtract them: they are not testing-only.
//  2. Type-existence — a wholly-testing-only TYPE (cloudflared / mdns / hysteria-realm) has no stable doc,
//     so stable.byKind[kind][type] is undefined. Such types are gated at the TYPE level elsewhere; the
//     per-field gate skips them (returns empty) so it never double-reports the whole entity.
// The real binary remains the final arbiter: the spike + tests cross-check fixtures/stable for zero false
// positives, and each representative field is binary-confirmed (stable rejects, testing recognizes).

type ByKind = Record<string, Record<string, readonly string[]>>;
const DOC = DOC_FIELD_NAMES as Record<string, { byKind?: ByKind }>;

function supplementFor(kind: string, type: string): Set<string> {
  const byKind = STABLE_DOC_FIELD_SUPPLEMENT[kind];
  return new Set([...(byKind?.[type] ?? []), ...(byKind?.["*"] ?? [])]);
}

// The set of top-level field names that are valid on testing but rejected by stable for (kind, type).
// Empty when the type does not exist on stable (gated at the type level) or the type is unknown.
export function testingOnlyFields(kind: string, type: unknown): Set<string> {
  if (typeof type !== "string" || !type) return new Set();
  const stable = DOC.stable?.byKind?.[kind]?.[type];
  if (!stable || stable.length === 0) return new Set(); // type absent on stable → type-level gate covers it
  const testing = DOC.testing?.byKind?.[kind]?.[type];
  if (!testing) return new Set();
  const stableSet = new Set(stable);
  const exempt = supplementFor(kind, type);
  const out = new Set<string>();
  for (const field of testing) if (!stableSet.has(field) && !exempt.has(field)) out.add(field);
  return out;
}

// Full catalog (only non-empty entries), for the snapshot test — so a doc regen that changes the gated set
// is reviewed rather than silently shifting which configs are blocked. NOTE: a few keys here are doc-schema
// pseudo-types, not runtime entity types — e.g. `rule-set/headless-rule` (a rule_set entity's `.type` is
// inline/local/remote, never "headless-rule"), so `checkTestingOnlyFields` never matches it and that entry
// is NOT actually gated at runtime. Such nested-schema fields (package_name_regex lives in rule_set.rules[])
// remain the W9 unknown-field linter's concern; they are listed here only for catalog completeness.
export function allTestingOnlyFields(): Record<string, Record<string, string[]>> {
  const out: Record<string, Record<string, string[]>> = {};
  for (const kind of Object.keys(DOC.testing?.byKind ?? {})) {
    for (const type of Object.keys(DOC.testing!.byKind![kind] ?? {})) {
      const set = testingOnlyFields(kind, type);
      if (set.size) {
        (out[kind] ??= {})[type] = [...set].sort();
      }
    }
  }
  return out;
}
