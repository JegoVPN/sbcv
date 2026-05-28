# Conformance & UX Remediation Program

Run with:

```txt
/goal reconcile codex + pass-2 UI reviews into one conformance & UX remediation queue --spec docs/goals/conformance-and-ux-remediation.md
```

This is an **umbrella goal**. It reconciles two independent reviews of the sing-box visual
editor into a single, traceable atomic queue. It does **not** implement fixes itself: each row of
the Ordered Atomic Queue below becomes its own `docs/goals/<slug>.md` child goal, implemented
test-first as one atomic PR per `docs/goal-driven-development.md`.

The running TODO and decision log for executing this program live in
[`conformance-and-ux-remediation-devlog.md`](conformance-and-ux-remediation-devlog.md).

## Before You Start

Read both review reports before touching code. They carry the per-finding evidence (`file:line`)
this index omits, each split per node/feature:

1. **Codex** — `docs/ui-reviews-codex/README.md` (summary + `C0/C1/C2` matrix) plus 70 per-node/
   per-feature `docs/ui-reviews-codex/<node>--codex.md` files.
2. **Pass-2** — `docs/ui-reviews-pass2/README.md` (`T1–T14` themes, `W1–W35` work items, 14 atomics);
   start at `_SUMMARY.md`, then `_FIX-PLAN.md`; per node, `docs/ui-reviews-pass2/<node>--claude.md`.

**Per atomic, read both per-node files** for the node it touches — e.g. for A14, read
`docs/ui-reviews-pass2/endpoint-tailscale--claude.md` and
`docs/ui-reviews-codex/endpoint-tailscale--codex.md`. The icon work (A8b) follows the confirmed set
in [`../ui-icon-set.md`](../ui-icon-set.md), built from both icon audits
(`docs/ui-reviews-codex/icon-semantics-audit.md`, `docs/ui-reviews-pass2/_ICONS.md`) and the v4 preview.

**Re-verify against HEAD.** Both reviews are dated 2026-05-28, the same day the
`canvas-port-interaction-redesign-execution` atomics (PR-1..PR-12) landed. Some findings may already
be partly addressed (reference registry, port relation registry, disconnect groundwork). When you
open each child goal, confirm the finding still reproduces on current `main` before implementing.

## Target Outcome

When this program is done:

- Every confirmed P0 from **both** reviews is closed or explicitly marked not-applicable with a reason.
- The editor cannot export an invalid sing-box config through any node, shared card, or import path.
- Rename/delete/type-change leave no dangling tag references, and the canvas, diagnostics, and
  Inspector agree on what is valid.
- A newcomer can discover how to add, connect, and validate nodes — on desktop and mobile.
- Each fix landed as a small, test-first, signed atomic PR, traceable back to its `C-/T-/W-` ids.

## Inputs Reviewed

- Repo instructions: `AGENTS.md`, `docs/goal-driven-development.md`.
- Reviews: `docs/ui-reviews-codex/**`, `docs/ui-reviews-pass2/**`.
- Source-of-truth docs: `docs/sbc-react-flow-rd-plan.md`, `docs/sing-box-config-doc-inventory.md`,
  `docs/sing-box-canvas-configuration-guide.md`, `docs/sing-box-config-capability-audit.md`.
- Upstream mirror: `docs/upstream/sing-box/{stable,testing}/**` (sync via `scripts/sync-singbox-docs.mjs`).
- Frontend gate: `vercel-react-best-practices`.
- Prior related goal: `docs/goals/canvas-port-interaction-redesign-execution.md` (landed the
  `portRelationRegistry` + `referenceRegistry` foundations several atomics below build on).

## Non-Negotiables

- **Source of truth.** sing-box **testing 1.14** for conformance; validate stable fixtures against
  `sing-box-stable check` and testing fixtures against `sing-box-testing check`. Our own code + UX
  principles for the feature/comprehension pass.
- **Canonical config is the source of truth.** React Flow nodes/edges and Inspector views stay derived.
- **Test-first.** Land the Phase-0 guardrail tests first (red), then flip them green with the matching
  structural fix in the same or the next atomic. Pair each guardrail with its fix.
- **One atomic = one outcome.** Respect the don't-mix buckets from `goal-driven-development.md`:
  schema vs canvas, visual polish vs domain behavior, stable vs testing-gated, refactor vs feature,
  docs vs runtime.
- **Land via PR, not direct push to `main`.** Run the PR + main issue gates per
  `goal-driven-development.md` between atomics.
- **Frontend gate.** Any atomic that touches `src/components/**` or `src/state/**` is not
  review-complete until checked against `vercel-react-best-practices` (bundle, rerender scope,
  derived-state cost, data waterfalls, broad subscriptions).
- **Codex review gate before merge.** This program is built with Claude Code + Codex. Every atomic,
  once implemented and passing local checks, is reviewed by Codex before it merges. Cap at **two
  Codex review rounds**; after the second round, merge to `main` via PR. See Review Plan for the
  exact loop, and record the rounds in the devlog milestone note.

## Reconciliation Summary

Both reviews audited the **same** codebase against sing-box upstream, so they overlap heavily. The
value of this program is the reconciliation, not a concatenation: findings both reviews independently
flagged are the **highest-confidence** work; findings unique to one review are where each pass saw
deeper.

> Mapping note: the cross-map is derived from the two READMEs, `_SUMMARY.md`, and `_FIX-PLAN.md`.
> Treat per-row `C-/T-/W-` pairings as the authoritative starting point; confirm exact `file:line`
> against the per-node reports when you open each child goal.

### Convergent findings (both reviews — do first, highest confidence)

| Cluster | Codex | Pass-2 | Sev | Lands in |
|---|---|---|---|---|
| Shared TLS card not split by direction (client vs server fields) | C0-6 | T1 / W6 / atomic-1 | P0 | A1 |
| Multiplex shows outbound-only fields on inbound | C0-7 | T1 / W6 | P0/P1 | A1 |
| `JsonField` writes unparseable text into canonical state | C0-18 | T4 / W8 / atomic-3 | P0 | A3 |
| Required fields under-diagnosed + no pre-export gate | C0-1, C0-5, C0-10, C0-12, C0-16, C0-17 | T5 / W9 / atomic-2 | P0 | A2 |
| Type-change leaves stale/invalid action-scoped fields | C0-3, C0-8, C0-9 | T3 / W7 / atomic-4 | P0 | A4 |
| Version gating uses channel only, never `version` | C2-6 | T10 / W11 / atomic-5 | P0/P2 | A5 |
| `referenceRegistry` incomplete (rename/delete dangles) | C1-2, C1-4, C1-11, C1-16, C1-17, C1-20, C1-21 | T11 / W12 / atomic-6 | P1 | A6 |
| Dial-detour relations lack type guards | C0-9, C2-1 | T13 / W14 / atomic-6 | P1/P2 | A6 |
| Endpoints not modeled as dial/route targets | C0-11 | T14 / W17 / atomic-7 | P0/P1 | A7 |
| Dead `compatible` "+" chips (no `createCompatible` branch) | C1-9, C1-12, C1-15 | T8 / W16 / W2 / atomic-8 | P1 | A8 |
| Port icons inconsistent for the same relation | (icon audit) | T7 / W15 / atomic-8 | P0 | A8 |
| Node/icon semantics audit | `icon-semantics-audit.md` (IC-*) | `_ICONS.md` / atomic-8b | P1 | A8b |
| dns-rule `evaluate`/`route` server unsettable + action-blind port | C0-2 | W18 | P0 | A10 |
| WireGuard endpoint peer schema (`address`/`port` vs `server`*) | C0-14 | endpoint-wireguard / W28 | P0 | A20 |
| Tailscale `system_interface` is boolean, modeled as string | C0-13 | W22 | P0 | A14 |
| SSM API mapping + `/`-key collision + orphan `managed` | C0-17, C1-13 | ssm-api / W28 | P0/P1 | A20 |
| VLESS `flow` without TLS wrongly errors | C1-10 | outbound-vless (codex cross-check) | P1 | A20 |
| Edge remove button keeps `pointer-events` while invisible | C2-7 | canvas feature | P2 | A9 / A24 |

### Codex-unique (deeper upstream semantics — graft into the phase noted)

| Finding | Codex | Sev | Lands in |
|---|---|---|---|
| DNS `evaluate`/`respond` ordering + response-match preconditions unmodeled | C0-4 | P0 | A10 |
| Multi-edge disconnect removes the *first* edge, not the intended reference (selector/urltest, DNS server, inbound rule-match) | C1-7, C1-8, C1-23 | P1 | A8 / A24 |
| HTTP Client not creatable/graphable; no Inspector branch; stale-ref diagnostics missing | C1-16, C1-18, C1-19, C1-20 | P1 | A22 |
| `cloudflared` testing inbound: no creation/Inspector/token+dial diagnostics | C1-22 | P1 | A21 |
| Certificate-provider required-field + endpoint-type diagnostics | C0-15, C1-14 | P0/P1 | A20 |
| Rule Set local `format` inference for non-inferable paths | C0-19 | P0 | A2 |

### Pass-2-unique (feature / new-user lens — Codex did not review these surfaces)

| Finding | Pass-2 | Sev | Lands in |
|---|---|---|---|
| Blank `{"":""}` kv repeater rows export as real empty keys | T6 / W13 | P0/P1 | A4 |
| Warning-state nodes show the green "valid" check; `✓ N` mislabeled | T9 / W10 | P1 | A9 |
| Add Library opens empty; dead "Docs" rows; jargon badges; search skips templates | W29 | P0 | A23 |
| Mobile cannot add or connect nodes (Palette not rendered; drag-only) | T12 / W31 | P0 | A25 |
| Import replaces config with no confirm/undo/feedback; no first-run state | W32 | P0 | A26 |
| Templates ship `REPLACE_ME` placeholder secrets | W33 | P2→ | A27 |
| Per-node residual P1/P2 tail across 66 nodes | W28 / W35 | P1/P2 | A20 / A29 |

### Divergence to resolve in implementation

- **Type-change strategy (A4).** Codex frames it as *central action-schema normalizers* that scrub
  stale fields (C0-3); Pass-2 frames it as a *confirm dialog + field preservation* (T3/W7). These are
  complementary — implement the normalizer (correctness) **and** the confirm (data-safety), and record
  the combined design in the A4 child goal.
- **Multi-edge disconnect (Codex C1-7/8/23) vs disconnect discoverability (Pass-2 W30).** Codex wants
  edge-specific removal when several references share a port; Pass-2 wants a discoverable disconnect
  affordance + edge legend. Do the precise multi-reference removal in A8 (canvas correctness) and the
  discoverability/legend in A24 (UX). Keep them in separate atomics (correctness vs polish).

## Ordered Atomic Queue

Backbone = Pass-2's five phases (guardrails → structural root-cause → residual node → UX
comprehension → polish). Within each phase, convergent findings come first. Codex-unique items are
grafted into the phase that matches their don't-mix bucket. Each row becomes one
`docs/goals/<slug>.md` child goal.

### Phase 0 — Guardrail tests (land first, as one PR)

| ID | Outcome | W / cross-ref | Child-goal slug |
|---|---|---|---|
| A0 | Red guardrail tests that print the blast radius and turn each structural fix into a red→green target: ref-registry completeness (W1), compatible-chip↔createCompatible coverage (W2), shared-card role correctness (W3), JsonField no-invalid-write (W4), port-guard + node-status-glyph (W5). Add a stub for multi-edge disconnect (C1-7/8/23). | W1–W5 / T1,T4,T8,T9,T11,T13 / C1-9/12/15, C0-6/18 | `phase0-guardrail-tests` |

### Phase 1 — Structural root-cause (each closes many findings)

| ID | Outcome | W / cross-ref | Don't-mix bucket | Child-goal slug |
|---|---|---|---|---|
| A1 | Shared TLS/multiplex/transport cards render correct fields per direction (`ref.kind`/role) | W6 (+W3) / C0-6, C0-7 / T1,T2 / atomic-1 | inspector field logic | `shared-cards-by-direction` |
| A2 | No node exports invalid config: required markers + pre-export validation gate; rule-set local `format` inference | W9 / C0-1/5/10/12/16/17, C0-19 / T5 / atomic-2 | diagnostics + export | `required-fields-and-export-gate` |
| A3 | `JsonField` never writes unparseable text (parse feedback + guard); `rules` becomes a handled field | W8 (+W4) / C0-18 / T4 / atomic-3 | inspector editor | `jsonfield-parse-safety` |
| A4 | Type-change is safe: central action-schema normalizers (scrub stale fields) + confirm dialog; kv repeaters never seed blank `{"":""}` rows | W7, W13 / C0-3, C0-8, C0-9 / T3, T6 / atomic-4 | inspector data-safety | `type-change-safety` |
| A5 | Version gating fires: pass `version` (not just `channel`) into `validateConfig` | W11 / C2-6 / T10 / atomic-5 | diagnostics/targets | `version-aware-gating` |
| A6 | Reference integrity holds on rename/delete: complete `referenceRegistry` + dial-detour type guards | W12, W14 (+W1) / C1-2/4/11/16/17/20/21, C0-9, C2-1 / T11,T13 / atomic-6 | domain reference/port graph | `reference-and-detour-guards` |
| A7 | Endpoints are first-class dial targets (outbound-half modeled) | W17 / C0-11 / T14 / atomic-7 (high risk; after A6) | domain reference/ports | `endpoint-outbound-half` |
| A8 | Canvas connect is legible & correct: port icon from relation, kill/preview dead "+" chips, edge-specific multi-reference disconnect | W15, W16 (+W2/W5) / C1-9/12/15, C1-7/8/23 / T7,T8 / atomic-8 | canvas/graph interaction | `canvas-connect-legibility` |
| A8b | Implement the confirmed icon set in [`../ui-icon-set.md`](../ui-icon-set.md): shared icon registry across node card/palette/picker/Inspector, `getNodeIcon` honours `type`, fix `CheckCircle2`/`Shield`/`Server`/`Network`/`GitBranch` clashes, add WireGuard/Tailscale/Tor/Shadowsocks/TUIC/Hysteria brand SVGs behind a license/bundle gate | `../ui-icon-set.md` / `_ICONS.md` / IC-* / atomic-8b | canvas + palette + inspector icons | `node-icon-distinctness` |
| A9 | Validity is readable: distinct warning glyph (not the green check) + relabel `✓ N`; edge-remove pointer-events fix | W10 / C2-7 / T9 / atomic-9 | canvas visual | `validity-readability` |

### Phase 2 — Residual node P0/P1 (one atomic per node/tight cluster; do not batch across categories)

| ID | Outcome | W / cross-ref | Child-goal slug |
|---|---|---|---|
| A10 | dns-rule `route`/`evaluate` server settable + action-aware port; `evaluate`/`respond` ordering + response-match modeled | W18 / C0-2, C0-4 | `dns-rule-server-and-ordering` |
| A11 | rule-set-inline `rules[]` structured editor | W19 | `rule-set-inline-editor` |
| A12 | rule-set-remote `http_client` object-form preserved; target-aware `download_detour`↔`http_client` | W20 / C2-5 | `rule-set-http-client` |
| A13 | ccm/ocm single correct detour control (outbound), gated graph edge | W21 / C1-21, C2-1 | `ccm-ocm-detour` |
| A14 | endpoint-tailscale `system_interface` checkbox + `system_interface_name` text (version-gated) | W22 / C0-13 | `endpoint-tailscale-system-interface` |
| A15 | dns-server-tailscale `accept_search_domain` control + endpoint-type check | W23 / C1-5 | `dns-server-tailscale-fields` |
| A16 | hub-route `default_network_type` array shape + de-duplicated controls | W24 | `hub-route-network-type` |
| A17 | inbound-redirect platform banner (Linux + macOS) + de-duplicated | W25 | `inbound-redirect-banner` |
| A18 | inbound-vless does not seed `tls:{enabled:true}` | W26 | `inbound-vless-tls-default` |
| A19 | settings-experimental v2ray build-tag label (`with_v2ray_api`) | W27 | `settings-experimental-label` |
| A20 | Residual node P1 batch, split per category (dns-server / inbound / outbound / rule / service); includes WireGuard peer schema, SSM `/`-key collision + orphan `managed`, VLESS flow-no-TLS, certificate-provider required fields | W28 / C0-14, C0-15, C1-10, C1-13, C1-14 | `residual-node-p1-<category>` (one per category) |
| A21 | `cloudflared` testing inbound: creation + Inspector + token/dial diagnostics (stable stays gated) | C1-22 | `inbound-cloudflared-testing` |
| A22 | HTTP Client: testing-gated creation/palette + Inspector branch + graph relations + stale-ref diagnostics | C1-16, C1-18, C1-19, C1-20 / C2-4 | `http-client-capability` |

### Phase 3 — UX comprehension (mostly Pass-2-unique)

| ID | Outcome | W / cross-ref | Child-goal slug |
|---|---|---|---|
| A23 | Add Library usable: open sections, real labels, no fake "Docs" rows, search covers templates | W29 | `palette-usability` |
| A24 | Canvas connect/disconnect discoverable: drag affordance, invalid-drop toast, edge legend, hover-x/right-click disconnect | W30 | `canvas-connect-discoverability` |
| A25 | Mobile can build a config: node-add path + touch connect affordance + scrollable sheets | W31 / T12 | `mobile-build-path` |
| A26 | Safe & guided start: import/template confirm + undo + feedback; empty/first-run state | W32 | `import-safety-and-onboarding` |
| A27 | Strip/flag template `REPLACE_ME` secrets + warning diagnostic | W33 | `template-placeholder-secrets` |

### Phase 4 — P2 polish (batched by surface)

| ID | Outcome | W / cross-ref | Child-goal slug |
|---|---|---|---|
| A28 | Diagnostics/labels/copy polish batch | W34 / C2-* tail | `diagnostics-labels-polish` |
| A29 | Per-node P2 cleanup batch (icons, subtitles, export noise, deprecation hints) | W35 / IC-* tail, C2-3 | `per-node-p2-cleanup` |

## Near-Term Atomics

Only start these; re-evaluate the queue against the actual code after A1 lands, since the
structural shape of A1/A6 affects later rows.

1. **A0** — Phase-0 guardrail tests (one PR; red).
2. **A1** — shared cards by direction (the single biggest conformance lever; flips W3 green).
3. **A2 + A3** — the "silent invalid export" class (required+gate, JsonField parse safety).

Do not pre-implement Phase 2+ until A1, A2, A3, A6 are merged and the issue gate has passed.

## Review Plan

- Self-review focus: every changed field/diagnostic maps to an upstream doc line and a `C-/T-/W-` id.
- Source-of-truth checks: `sing-box-stable check` (stable fixtures), `sing-box-testing check`
  (testing fixtures) whenever fixture/export output changes.
- Diff scope checks: one outcome per atomic; no don't-mix violations.
- Frontend skill gate: `vercel-react-best-practices` for any `src/components/**` or `src/state/**` diff.

### Codex Review Gate (per atomic, before merge)

This program is developed with Claude Code + Codex. Run `codex:setup` once to confirm the Codex CLI
is ready. For each atomic:

1. Claude Code implements the atomic test-first and passes local checks (`git diff --check`,
   `pnpm exec tsc -b`, `pnpm test`, `pnpm build`, and `pnpm e2e` where interaction changed).
2. Hand the atomic diff to Codex for review (via the `codex` plugin / `codex:rescue` runtime).
3. Address actionable findings, then optionally re-review with Codex.
4. **Maximum two Codex review rounds.** After the second round (or sooner if Codex is clean), open
   the PR and merge to `main`. Do not loop past two rounds — record any deferred finding as a
   follow-up atomic instead.
5. Run the existing PR + main issue gates from `goal-driven-development.md`.

Record each atomic's Codex rounds (findings + dispositions) in the devlog milestone note.

## E2E Plan

- Per atomic, prove the user-facing path it claims (e.g., A1: an inbound TLS card renders no
  client-only field in the running app; A26: import shows a confirm + undo + toast).
- Tooling: `pnpm e2e` (Playwright) for interaction changes; component/unit tests otherwise.
- Fallback: if a path cannot be E2E-tested, state so explicitly in the child goal's milestone note.

## Validation Matrix

| Case | Check |
|---|---|
| Lint/format | `git diff --check` |
| Types | `pnpm exec tsc -b --pretty false` |
| Unit/component | `pnpm test` (or scoped `pnpm exec vitest run <files>`) |
| Build | `pnpm build` |
| Interaction | `pnpm e2e` |
| Config-doc coverage | `pnpm audit:config-docs` (when fixtures/export change) |
| stable config | `sing-box-stable check -c <stable-fixture>` |
| testing config | `sing-box-testing check -c <testing-fixture>` |

## Done Definition

This program is complete when:

- Every convergent and Codex-unique P0 above is closed or marked not-applicable with a reason.
- Each Pass-2 P0 (`W9`/`W31`/`W32` class and the per-node P0s) is closed.
- No node, shared card, or import path can export an invalid config (A1–A4 + A20 landed).
- Rename/delete/type-change leave no dangling known references (A6–A7 landed).
- Desktop and mobile both have a discoverable add → connect → validate path (A23–A26 landed).
- Every child goal merged via PR with a passing PR + main issue gate, or is explicitly deferred
  with a reason recorded in the devlog.

## Open Decisions

- **cloudflared / HTTP Client (A21/A22):** stable stays gated; confirm whether to fully support the
  testing target now or downgrade to docs-only. Both reviews lean "support testing or document the
  gate clearly," not "enable on stable."
- **Endpoint outbound-half (A7):** highest-risk atomic; confirm it lands after A6 and after a
  `referenceRegistry`-completeness test is green.
- **Per-node P1 batching (A20):** split strictly per category (dns-server / inbound / outbound / rule /
  service) to honour the don't-mix rule; do not bundle across categories.

## Notes And Deviations

Running TODO, decision log (ADR-lite), and per-atomic milestone notes live in
[`conformance-and-ux-remediation-devlog.md`](conformance-and-ux-remediation-devlog.md). Record any
deviation from this queue (re-ordering, scope change, finding re-classification) there with a date
and reason, then reflect the change back into this file.
