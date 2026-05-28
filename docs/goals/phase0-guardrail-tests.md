# A0 — Phase-0 Guardrail Tests

Child goal of [`conformance-and-ux-remediation.md`](conformance-and-ux-remediation.md) (queue row **A0**),
executed under [`conformance-and-ux-remediation-execution.md`](conformance-and-ux-remediation-execution.md).

## Outcome

A cheap, test-first guardrail suite that turns each Phase-1 structural fix into a red→green target and
prints the blast radius of the five Pass-2 root causes (W1–W5) plus the Codex multi-edge-disconnect
cluster (C1-7/8/23). No production code changes: this atomic ships **tests + this goal doc only**.

Each guardrail encodes the *post-fix* contract. The suite stays green today (so `pnpm test` passes) by
one of two mechanisms, chosen per guardrail for robustness:

- **`it.fails(...)`** — asserts the desired post-fix behavior; the assertion throws today, so `it.fails`
  reports the case as passing. When the owning fix lands, the assertion passes, `it.fails` flips red, and
  the implementer converts `it.fails` → `it`. Used where the assertion is a single precise check (domain
  guardrails) so a green result can only mean "the documented bug still reproduces".
- **characterization `it(...)`** — asserts the *current buggy* behavior. Green today; turns red when the
  fix lands, forcing the implementer to update it to the new behavior. Used for DOM guardrails where an
  `it.fails` could pass for the wrong reason (a harness/render error also throws). Each characterization
  `it` is paired with a companion assertion proving the surface is reachable.

## Scope

- In scope: new/extended Vitest guardrails for W1–W5 + the multi-edge-disconnect stub; this goal doc.
- Out of scope: the fixes themselves (A1/A3/A6/A8/A9), any `src/**` change.

## Source Docs

- `docs/ui-reviews-pass2/_FIX-PLAN.md` (W1–W5 prescriptions), `docs/ui-reviews-pass2/_RELATIONSHIPS.md`
  (the code-verified reference/port matrix).
- `docs/ui-reviews-codex/README.md` (C1-7/8/23 multi-edge disconnect).
- Upstream truth: sing-box testing 1.14.

## Guardrails

| ID | File | Encodes | Mechanism | Flips green in |
|---|---|---|---|---|
| W1 | `tests/reference-registry-completeness.test.ts` | `referenceRegistry` drops 5 code-verified refs on **both delete and rename**: route-rule `resolve.server`, inbound listen `detour`, tun `route_address_set`, shadowtls `handshake.detour`, derp `mesh_with[].detour` (`_RELATIONSHIPS` rows 5/28/29/30/23) | `it.fails` delete + rename + green sanity | A6 |
| W2 | `tests/compatible-chip-coverage.test.ts` | every advertised `graph.ts` `compatible:[...]` chip mutates config via `createCompatible`; 16 are dead no-ops (14 selector/urltest proxy types + "Shadowsocks Inbound" + "Tailscale Endpoint") | `it.fails` **behavioral probe** (invokes `createCompatible`, detects no-op) + green sanity | A8 |
| W3 | `tests/shared-field-role.test.tsx` | inbound TLS/multiplex cards must not render client/outbound-only fields (`sharedFieldDefinitions` ignores `ref.kind`) | characterization + companion | A1 |
| W4 | `tests/json-field-parse.test.tsx` | `JsonField` must not write unparseable text into canonical config (it currently writes the raw string on parse failure) | characterization + companion | A3 |
| W5a | `tests/sbc-node-ports.test.ts` (extend) | outbound `block`/`selector`/`urltest`/`dns` must not expose a `detour-target` input (`detour-target` endpoints lack `nodeTypeExcludes`) | `it.fails` per type | A6 |
| W5b | `tests/node-status-icon.test.tsx` | a `warning` node must render a glyph distinct from a valid node (both render `CheckCircle2` today) | characterization + companion | A9 |
| stub | `tests/multi-edge-disconnect.test.tsx` | the AGGREGATE selector member port removes only the first edge (`CanvasWorkspace.edgeByPort` keeps the first edge per port); per-member disconnect already exists from each member's own input port | characterization + `it.todo` | A8 |

## Re-verification Against HEAD (queue step 2)

- **W5 dns-server detour guard is already fixed.** `_FIX-PLAN.md` W5 also asks for
  `dns-server` fakeip/hosts/resolved/tailscale to exclude the detour `outbound` output port, but
  `portRelationRegistry.ts:105` already carries `nodeTypeExcludes: ["hosts","fakeip","tailscale","resolved"]`
  on the `dns-server-detour` source (landed by the `canvas-pr7-wire-decorative-ports` atomic). So A0 ships
  a **green regression lock** for that, not a red target. The still-open W5 port-guard is the
  `detour-target` *input* on non-dialable outbounds (block/selector/urltest/dns), which A6 closes.
- W1's 5 missing reference paths and the multi-edge first-edge mapping were each re-confirmed in current
  `referenceRegistry.ts` / `CanvasWorkspace.tsx`.

## Acceptance Criteria

- New guardrails run under `pnpm test` and the suite stays green (every red target is an `it.fails`;
  every characterization asserts current behavior).
- Each guardrail names its finding id(s) and the owning fix atomic in its title/comment.
- `git diff --check`, `pnpm exec tsc -b`, `pnpm test`, `pnpm build` pass.

## Validation Matrix

| Case | Check |
|---|---|
| Lint | `git diff --check` |
| Types | `pnpm exec tsc -b --pretty false` |
| Unit/component | `pnpm test` (scoped: the 6 guardrail files) |
| Build | `pnpm build` |

No fixture/export output changes, so official `sing-box` checks are not applicable to A0.

## Notes And Deviations

- Date: 2026-05-28. Decision: hybrid `it.fails` (domain) + characterization (DOM) instead of uniform
  `it.fails`, because `it.fails` on a DOM test can pass for the wrong reason (render/query error). Reason:
  keep `pnpm test` green (execution-plan step 5) while guaranteeing each guardrail is a faithful tripwire.
- Date: 2026-05-28. Deviation: W5 dns-server-detour part shipped as a regression lock (already fixed by
  the canvas PR-7 atomic), per the re-verification note above.
- Date: 2026-05-28. Codex round-1 hardening: W2 became a behavioral probe (invokes `createCompatible`,
  detects no-op) instead of a static handled-set mirror, so it flips red whether A8 wires or prunes the
  dead chips; W1 gained rename cases (the `replaceRegisteredTagReferences` path is separate from delete);
  W5a covers all four non-dialable outbound types. The multi-edge stub was downgraded to `it.todo` after
  discovering per-member disconnect already works from each member node's `selector-group` input — only
  the selector's aggregate output control is defective, and its corrected affordance is A8's design call.
