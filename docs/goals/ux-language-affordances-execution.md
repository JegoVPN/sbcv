# UX Language, Node-Copy Accuracy & Affordances — Execution Plan

Run with:

```txt
/goal execute the UX language & affordances queue (L0–…) --spec docs/goals/ux-language-affordances-execution.md
```

Follow-on goal after **Conformance & UX Remediation** (A0–A29, complete — see
[`conformance-and-ux-remediation-devlog.md`](conformance-and-ux-remediation-devlog.md)). That goal closed
the correctness/conformance gaps and made the icon set faithful to the confirmed v4 set
(`docs/ui-reviews-pass2/_icons-preview-v4.html`). This goal is the remaining **UX-quality** backlog that
was deferred there, reorganized into one plan because it is too large to do piecemeal.

It collects three buckets the user explicitly scoped:
1. **Unified UX language** — copy/labels/badges, planned holistically (not one string at a time).
2. **Per-node copy accuracy** — audit every node's text against upstream sing-box docs.
3. **Affordance infrastructure** — toast/notification + undo, then the flows that need them.
…plus a **mechanical-cleanup** bucket (export noise, import normalization, subtitles, touch targets).

## Process (inherited from the prior goal — non-negotiable)

- **Canonical config is the source of truth.** React Flow nodes/edges + Inspector stay derived.
- **One atomic = one outcome.** Respect don't-mix buckets (copy vs behavior, infra vs feature, domain vs
  component, stable vs testing-gated). Slice large atomics; queue the tails.
- **Test-first.** A failing test before the change; migrate existing tests to the new correct behavior.
- **Land via squash PR, never direct push to `main`.** PR gate + main issue gate must be clean.
- **One-pass expert review before merge.** Dispatch a single senior Claude Code reviewer subagent (Agent
  tool) whose expertise best matches the atomic; apply its actionable findings in-pass, then merge.
- **Frontend gate** (`vercel-react-best-practices`) for any `src/components/**` or `src/state/**` diff.
- **Re-verify against HEAD** before each atomic. `tsc -b` + `pnpm test` + `pnpm build` + `pnpm e2e` green.
- **Devlog every atomic** in the Running TODO + a milestone note below.
- **Upstream truth:** sing-box docs in `.tmp/sing-box-docs/{stable,testing}/docs/configuration/**`
  (stable = 1.13, testing = 1.14). Conformance copy follows testing 1.14; gate version-specific text.

## Decisions (locked with the user, 2026-05-29)

- **D1 — Unify ALL language, don't patch strings ad hoc.** Phase 1 produces a single voice + terminology
  + badge-vocabulary spec first; every copy change conforms to it. (User: "需要继续深入整体规划，统一所有语言".)
- **D2 — `testing/gated` ≠ `legacy/deprecated`; they must read differently.** The user prefers the
  **legacy treatment as the quality bar** (a clear, *colored* badge — the orange `LEGACY` chip), while
  `gated`/`testing` is a distinct, muted state. A node is gated because the build target doesn't support
  it yet (creatable on the right target); a node is legacy because sing-box deprecated it. Different
  cause → different word + different color. Eliminate redundancy where a label already says the state
  (e.g. `Hysteria Realm (1.14 testing)` + a `GATED` badge double-states it).
- **D3 — Drop build-tag suffixes from palette labels.** `(with_tailscale)`, `(with_tor)` etc. are noise
  in the label; if surfaced at all, move to a tooltip/secondary line, not the primary name.
- **D4 — Keep the "docs-only" / legacy palette rows (former 1c).** 1.12 build stays online to help users
  check, and users pick whichever version they want. **Future:** per-version nodes / version-aware
  judgements — *shelved, revisit later.* Do NOT remove these rows now.
- **D5 — Node-copy accuracy is an agent-driven audit** against the upstream `.md` docs (per node
  kind/type), producing a findings table, then sliced fixes.
- **D6 — Toast + Undo are net-new infrastructure** and get their own phase/plan section here.
- **D7 — Export cleanup must keep the JSON sing-box-usable.** Trim only provably-inert noise
  (empty strings/arrays the schema treats as absent); never strip a semantically-meaningful empty.
  Verify round-trip + that a representative cleaned config still parses/loads.
- **D8 — A8b-brands already fixed the "WireGuard/Tailscale identical icon" bug** (PR #86): the palette
  routes icons through the same registry (`paletteIcon → getNodeIcon`), so both surfaces now show the
  real distinct brand logos. (The user's screenshot was pre-deploy.) No action needed beyond verifying
  on the live site after the Cloudflare deploy.

## Phases & Atomic Queue

Phase 4 (mechanical cleanups) is **greenlit to run first / in parallel** — it needs no wording decisions.
Phase 1 must produce its language spec (L1-vocab) before its copy atomics. Phases run roughly 4 → 1 → 2
→ 3, but Phase 4 can interleave.

### Phase 1 — Unified UX language (bucket 1)
- [ ] L1-vocab — **the language spec**: a canonical voice + terminology glossary + badge vocabulary
  table (state name, when it applies, word, color/treatment) honoring D2. The artifact every later copy
  atomic conforms to. Lives in a new `docs/ui-language.md`. (planning atomic — no runtime change)
- [ ] L1-badges — re-label + re-treat the palette status badges per L1-vocab (Add / Setup→? / Table→? /
  Inspector→? / Docs→? / Gated→? / Pending→? / Legacy / Open). Migrate the ~15 `name:"Setup X"` test
  assertions. De-duplicate the `(1.14 testing)`-label-plus-`GATED`-badge double-statement (D2).
- [ ] L1-buildtags — drop `(with_tailscale)`/`(with_tor)` suffixes from palette labels (D3); if useful,
  surface the build tag as a tooltip/secondary line.
- [ ] L1-brandbtn — fix the brand-logo button label `"sbcv.app — return to home"`: `goHome` only
  deselects + closes the global panel + re-fits the canvas (no navigation, no reset). Relabel to match
  (e.g. "Reset view" / "Deselect & fit").
- [ ] L1-target-glossary — target/channel/version tooltip (what stable 1.13 vs testing 1.14 means).
- [ ] L1-diag-hierarchy — diagnostics read message-first, code secondary (human-readable hierarchy).
- [ ] L1-roundtrip-copy — a one-line "import→export normalizes fields" note where round-trip matters.

### Phase 2 — Per-node copy accuracy audit (bucket 1d / D5)
- [ ] L2-audit — agent-driven sweep: for each node kind/type, compare title / subtitle / field labels /
  hints against the upstream `.md` (`.tmp/sing-box-docs/**`). Output a findings table (node → wrong
  copy → upstream-correct copy → severity). No runtime change.
- [ ] L2-fix-* — apply corrections, sliced per node group (inbound / outbound / dns / endpoint / service
  / route / rule-set / settings). One PR per group.

### Phase 3 — Affordance infrastructure (bucket 2 / D6)
- [ ] L3-toast-infra — a minimal toast/notification host (store slice + a portal component, a11y-live).
- [ ] L3-undo-infra — an undo/history snapshot stack in the store (bounded; snapshots the canonical
  config at mutation boundaries).
- [ ] L3-import-feedback — import success/error toast (uses L3-toast-infra).
- [ ] L3-import-undo — one-tap undo after an import overwrite (uses L3-undo-infra; pairs with the
  existing A26 import-confirm).
- [ ] L3-invalid-drop — invalid drag-drop feedback toast (uses L3-toast-infra).
- [ ] L3-rightclick-disconnect — (optional) right-click an edge/port to disconnect (context menu).
- [ ] L3-drag-affordance — (optional) clearer in-drag visual hint (CSS/interaction).

### Phase 4 — Mechanical cleanups (bucket 3 — greenlit, no wording) 
- [ ] L4-export-noise — trim provably-inert empty-string/empty-array export noise. **D7: keep
  sing-box-usable** — test round-trip + that a representative cleaned config still parses; never strip a
  meaningful empty.
- [x] L4-dial-network-type — A16-norm-rest: coerce legacy raw-string `network_type` /
  `fallback_network_type` on outbounds/endpoints (dial group) at import (same shape as A16-norm). — PR #90
- [ ] L4-dial-network-type-2 — extend the same coercion to the remaining `kind:"list"` network-type
  carriers (dns-servers, ntp settings, http_clients, shadowtls nested dial) (L4-dial-network-type
  review follow-up)
- [ ] L4-rule-field-scrub — A10d-rest: scrub other action-gated rule fields on import (reject
  `method`/`no_drop`, dns-predefined `rcode`, route-options `override_*`); optionally recurse logical
  rules.
- [ ] L4-subtitle-degeneric — route / settings / notice node subtitles carry real info (extend the
  A29-subtitle pattern to the remaining generic ones).
- [ ] L4-mobile-touch — mobile controls meet a ≥36px touch-target minimum (CSS).
- [ ] L4-mobile-palette-defer — A25-rest: actually defer the Palette chunk on mobile (today App eagerly
  imports it for desktop).

## Running TODO
Mirror of the queue above; tick as merged. (Populated during execution.)

## Decision Log
(Append dated entries as decisions are made during execution.)

## Milestone Notes

### L4-dial-network-type dial-network-type-import-normalize (domain) — PR #90
Status: implemented 2026-05-29 in `atomic/dial-network-type-import-normalize`; merged in PR #90.
- What changed: A16-norm coerced the route `default_network_type` / `default_fallback_network_type`
  legacy raw-string → `[string]` on import. This extends the same coercion to the dial-group siblings
  `network_type` / `fallback_network_type` on outbounds and endpoints (they render through the same
  `kind:"list"` control and had the same legacy-string strand). Generalized the A16-norm helper into
  `coerceStringList(record, key)` (drops `RouteConfig` import); `normalizeConfig` now runs it over the
  route defaults plus each outbound/endpoint. Non-string values pass through untouched.
- Tests: `tests/dial-network-type-import-normalize.test.ts` (outbound/endpoint network_type +
  fallback_network_type string→array, empty→[], array + non-string passthrough, route regression guard).
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, no blockers, no should-fix.
  Confirmed the helper rename is behavior-preserving, the clone (not input) is mutated, no item shape
  throws (array items survive the object guard but only string values are rewritten), `RouteConfig`
  import removal is safe, and — per sing-box docs — `network_type` is always `string[]` (1.11+), never
  legitimately a bare string, so arrayifying is always correct. Two NITs, both non-blocking: redundant
  `as Record` casts (left as explicit-boundary); the same `kind:"list"` control also renders on
  dns-servers/ntp/http_clients/shadowtls nested dial → queued as L4-dial-network-type-2.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (852), `pnpm build`, `pnpm e2e` (14).
