import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  INLINE_RENDERED_KEYS,
  inboundHandledFields,
  outboundHandledFields,
  structurallyCoveredKeys,
} from "../src/components/Inspector";

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
function coveredOnAnyChannel(kind: "inbound" | "outbound"): Set<string> {
  return new Set([
    ...structurallyCoveredKeys(kind, "stable"),
    ...structurallyCoveredKeys(kind, "testing"),
  ]);
}

function uncoveredKeys(kind: "inbound" | "outbound"): string[] {
  const handled = kind === "inbound" ? inboundHandledFields : outboundHandledFields;
  const covered = coveredOnAnyChannel(kind);
  return [...handled].filter((key) => !covered.has(key)).sort();
}

describe("C17 — no silently-unreachable handled fields", () => {
  for (const kind of ["inbound", "outbound"] as const) {
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
    const literals = new Set(
      [...source.matchAll(/updateField\((?:ref|entityRef),\s*"([a-z_]+)"/g)].map((match) => match[1]),
    );
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
