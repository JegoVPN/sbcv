import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  INLINE_RENDERED_KEYS,
  inboundHandledFields,
  outboundHandledFields,
  structurallyCoveredKeys,
} from "../src/components/Inspector";
import {
  dnsServerHandledFieldsForChannel,
  endpointHandledFields,
  serviceHandledFields,
  type C17CoverageKind,
} from "../src/components/inspector/handledFields";

// C17 — silent-unreachable guard. A key in inbound/outbound `handledFields` is excluded from the Advanced
// JSON fallback (editableScalarFields/editableNonScalarFields skip it), on the assumption a structured
// control renders it. If no control covers it, the field becomes silently unreachable — the exact C1
// (v2ray transport) / C3 (tls.acme) root cause. This guard asserts every handled key is structurally
// covered, on both channels (the invariant is channel-invariant; 1.14 additions are gated elsewhere).
// Source: shared/{v2ray-transport,tls,multiplex,dial}.md. Guard/test infra only — per-field coverage fixes
// are separate atomics.

// A handled key is reachable if a control covers it on EITHER channel — channel-gated fields (e.g. the
// 1.14-removed `domain_strategy`, rendered only on stable; or 1.14-added fields, only on testing) are
// legitimately covered on just one channel. Unreachable = covered on neither.
function coveredOnAnyChannel(kind: C17CoverageKind): Set<string> {
  return new Set([
    ...structurallyCoveredKeys(kind, "stable"),
    ...structurallyCoveredKeys(kind, "testing"),
  ]);
}

// DF2 — handledFields per kind (dns-server is channel-gated, so union both channels). The union is the
// correct "ever handled" set: a field handled only on one channel must still be covered on that channel.
function handledFieldsForKind(kind: C17CoverageKind): Set<string> {
  switch (kind) {
    case "inbound":
      return new Set(inboundHandledFields);
    case "outbound":
      return new Set(outboundHandledFields);
    case "endpoint":
      return new Set(endpointHandledFields);
    case "dns-server":
      return new Set([
        ...dnsServerHandledFieldsForChannel("stable"),
        ...dnsServerHandledFieldsForChannel("testing"),
      ]);
    case "service":
      return new Set(serviceHandledFields);
  }
}

function uncoveredKeys(kind: C17CoverageKind): string[] {
  const handled = handledFieldsForKind(kind);
  const covered = coveredOnAnyChannel(kind);
  return [...handled].filter((key) => !covered.has(key)).sort();
}

describe("C17 — no silently-unreachable handled fields", () => {
  for (const kind of ["inbound", "outbound", "endpoint", "dns-server", "service"] as const) {
    it(`${kind} handledFields are all structurally covered on some channel`, () => {
      expect(uncoveredKeys(kind)).toEqual([]);
    });
  }

  it("covers a known structurally-rendered key so a deleted control would surface", () => {
    // Positive anchor: `transport` is rendered by the v2ray-transport shared card. If that group/control
    // were removed, this drops out of coverage and (being in outboundHandledFields) the kind guard above
    // would fail — directly exercising the "deleting a control" half of the acceptance.
    expect(structurallyCoveredKeys("outbound", "testing").has("transport")).toBe(true);
  });

  it("INLINE_RENDERED_KEYS claims no coverage without a real inline control (anti-drift)", () => {
    // The hand-maintained inline set is the guard's one drift risk: a fabricated entry would falsely mark
    // a handled key covered. Assert every entry corresponds to an actual `updateField(<ref>, "<key>", …)`
    // literal in the Inspector source, so coverage can never be invented (the set may be a subset — extra
    // source literals for other kinds are harmless). C14 extracted the per-family blocks into
    // src/components/inspector/* (where the entity ref is named `entityRef`), so scan the shell AND those
    // modules, matching either parameter name — a fabricated key still has no literal in ANY of them.
    const inspectorDir = "src/components/inspector";
    const files = [
      "src/components/Inspector.tsx",
      ...readdirSync(inspectorDir)
        .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
        .map((name) => `${inspectorDir}/${name}`),
    ];
    const source = files.map((file) => readFileSync(file, "utf8")).join("\n");
    // DF2: keys can contain digits (inet4_range / inet6_range), so the literal-scan char classes include
    // 0-9 — `[a-z_]+` would silently truncate `inet4_range` to `inet` and miss the real control.
    // `\(\s*` also matches the multi-line `updateField(\n  entityRef,\n  "key",` form (system_interface_mtu).
    const literals = new Set<string>(
      [...source.matchAll(/updateField\(\s*(?:ref|entityRef),\s*"([a-z0-9_]+)"/g)].map((match) => match[1]!),
    );
    // V0/M5: an enum field rendered by `<SchemaEnumField field="x" …>` is a real (data-driven) control —
    // its write goes through updateField inside schemaEnumField.tsx via a variable, so recognize the
    // field prop literal instead. Nested fields (field="obfs.type") map to their top-level handled key.
    for (const match of source.matchAll(/field="([a-z0-9_.]+)"/g)) literals.add(match[1]!.split(".")[0]!);
    const fabricated = [...INLINE_RENDERED_KEYS].filter((key) => !literals.has(key)).sort();
    expect(fabricated).toEqual([]);
  });

  it("flags an injected silently-unreachable key (negative case proves the guard bites)", () => {
    // A synthetic key rendered by no control and no shared group: if it were added to a handledFields set
    // it would be excluded from the Advanced fallback yet have no editor → unreachable. The guard's
    // coverage set must NOT claim to cover it on either channel.
    const covered = coveredOnAnyChannel("outbound");
    expect(covered.has("__synthetic_uncovered_field__")).toBe(false);
    const injectedHandled = new Set([...outboundHandledFields, "__synthetic_uncovered_field__"]);
    const uncovered = [...injectedHandled].filter((key) => !covered.has(key));
    expect(uncovered).toEqual(["__synthetic_uncovered_field__"]);
  });
});
