# Pass-2 UI Review — index & remediation backlog

Entry point for the second-pass review of the sing-box visual editor. Read this, then
`_SUMMARY.md`, then pick an atomic from the **Remediation Goals Queue** below.

- **Source of truth:** sing-box **testing 1.14** (`docs/upstream/sing-box/testing/`) for conformance;
  our own code + UX principles for the feature pass.
- **Shape:** three passes — per-node conformance, relationship/reference integrity, and feature UX.
- **Use:** each queue row is sized to become one `docs/goals/<slug>.md` atomic per
  `docs/goal-driven-development.md` (one outcome, small file scope, matching tests, signed commit,
  post-merge issue gate). The queue respects the "avoid mixing in one atomic" rules
  (schema vs canvas, visual polish vs domain behavior, stable vs testing-gated, refactor vs feature,
  docs vs runtime).

## Totals (reconciled)

| Pass | Artifact(s) | P0 | P1 | P2 |
|---|---|---|---|---|
| A. Node conformance (66 nodes) | `<node>--claude.md` | 21 | 154 | 234 |
| B. Relationship / reference audit | `_RELATIONSHIPS.md` | 0 | 11 | 10 |
| C. Feature UX (6 areas) | `_FEATURE-*.md` | 17 | 26 | 20 |

> The authoritative node-conformance P0 total is **21** (sum of the per-file `SUMMARY:` lines).
> `outbound-naive`'s four `[P0]` lines are marked STALE/fixed in its own review and are **not** counted.
> Counts overlap across passes (one root cause is reported per-node and again as a theme); the
> **systemic themes T1–T14 in `_SUMMARY.md`** matter more than the raw totals.

## Artifact map

| File | What |
|---|---|
| `_SUMMARY.md` | **Start here.** De-duplicated systemic issues (T1–T14) + highest-leverage fixes. |
| `_FIX-PLAN.md` | 35 work items (W1–W35) across 5 phases; every P0 mapped. The queue below indexes these. |
| `_RELATIONSHIPS.md` | Canvas port/edge model + reference-integrity audit + the port-icon-consistency finding. |
| `_FEATURE-palette.md` | Left "Add Library" discoverability/labels. |
| `_FEATURE-canvas.md` | Ports/edges/chips/node cards/connect interactions. |
| `_FEATURE-inspector.md` | Editing patterns (masking, repeaters, JSON fallback, type-switch). |
| `_FEATURE-diagnostics.md` | Validity surfacing + target/channel (version) gating. |
| `_FEATURE-io-topbar.md` | Import/export/round-trip + TopBar. |
| `_FEATURE-mobile-templates.md` | Mobile sheets + templates/onboarding. |
| `<category>-<type>--claude.md` | 66 per-node conformance reviews (dns-server ×12, endpoint ×2, hub ×2, inbound ×17, outbound ×18, rule ×2, rule-set ×3, service ×6, settings ×4). |
| `outbound-vless--codex.md` | One Codex cross-check of `outbound-vless` (independent second opinion). |

## Remediation Goals Queue

Ordered for leverage and dependency. Each row is one atomic goal: write `docs/goals/<slug>.md`,
implement test-first, open an atomic PR, run the post-merge issue gate. "Closes" counts are
approximate and de-duplicated against the themes.

| # | Atomic goal (outcome) | W-items | Theme | Closes | Don't-mix bucket | Source |
|---|---|---|---|---|---|---|
| 1 | TLS/multiplex/transport cards render the correct fields per direction (inbound vs outbound) | W6 (+W3 test) | T1/T2 | ~6 P0, ~30 P1 | domain/inspector field logic | `_SUMMARY` T1; many `inbound-*`, `outbound-*`, `_FEATURE-inspector` |
| 2 | No node can export an invalid config: required markers + pre-export validation gate | W9 | T5 | export-safety class | diagnostics + export | `_FEATURE-inspector`, `_FEATURE-io-topbar` |
| 3 | `JsonField` never writes unparseable text (parse feedback + guard) | W8 (+W4 test) | T4 | invalid-JSON class | inspector editor | `_FEATURE-inspector`, `inbound-shadowtls` |
| 4 | Destructive edits are guarded: type-switch confirm + no blank `{"":""}` rows | W7, W13 | T3/T6 | data-loss class | inspector data-safety | `_FEATURE-inspector` |
| 5 | Version gating actually fires: pass `version` (not just `channel`) to `validateConfig` | W11 | T10 | gating false-pos + miss | diagnostics/targets | `_FEATURE-diagnostics`, `service-ccm`/`ocm` |
| 6 | Reference integrity holds on rename/delete: complete `referenceRegistry` + dial-detour type guards | W12, W14 (+W1 test) | T11/T13 | dangling-ref + spurious ports | domain reference/port graph | `_RELATIONSHIPS`, `inbound-direct`, `dns-server-resolved` |
| 7 | Endpoints are first-class dial targets (outbound-half modeled) | W17 | T14 | endpoint link gap | domain reference/ports | `_RELATIONSHIPS`, `endpoint-*` |
| 8 | Canvas connect is legible: port icon from relation + kill dead "+" chips + previewed "+" | W15, W16 (+W2/W5 tests) | T7/T8 | icon mismatch + 16 dead chips | canvas/graph interaction | `_FEATURE-canvas`, `_RELATIONSHIPS` addendum |
| 9 | Validity is readable: distinct warning icon + relabel the "✓ N" chip | W10 (glyph) | T9 | warning-invisible | canvas visual | `_FEATURE-canvas`, `_FEATURE-diagnostics` |
| 10 | Add Library is usable: open sections, real labels, no fake "Docs" rows, search covers templates | W29 | feature | palette comprehension | palette UX | `_FEATURE-palette` |
| 11 | Mobile can build a config: node-add path + connect affordance | W31/W32 | feature | mobile-unusable P0s | mobile interaction | `_FEATURE-mobile-templates` |
| 12 | Safe & guided start: import confirm+undo+feedback, empty/first-run state, strip template `REPLACE_ME` | W30/W33 | feature | import-safety + onboarding | io + onboarding | `_FEATURE-io-topbar`, `_FEATURE-mobile-templates` |
| 13 | Per-node residual correctness (one atomic per node/tight cluster) | W18–W28 | node | residual node P0/P1 | per node, do not batch across categories | the relevant `<node>--claude.md` |
| 14 | P2 polish sweep (labels/copy/markers), batched by surface | W34–W35 | polish | P2 tail | docs/visual polish | all reports |

**Recommended order:** 1 → 2 → 3 → 4 land the highest-leverage correctness fixes (atomic 1 alone
clears most node P0s); 5 → 6 → 7 close the gating/reference-integrity gaps; 8 → 9 → 10 → 11 → 12 are
the comprehension/usability fixes that answer "users can't tell how to use it"; 13 mops up per-node
residuals; 14 is polish. Pair each Phase-0 guardrail test (W1–W5) with its fix in the same atomic
(test-first), per `_FIX-PLAN.md`.

> This review set was committed as a single docs-only change (~5.6k lines of Markdown). It
> intentionally exceeds the ~400-line atomic guideline because it is one indivisible review artifact,
> not feature work; the remediation that follows is what gets split into the atomics above.
