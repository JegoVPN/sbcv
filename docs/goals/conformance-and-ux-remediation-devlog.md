# Conformance & UX Remediation — Dev Log

Living working journal for executing
[`conformance-and-ux-remediation.md`](conformance-and-ux-remediation.md). Update it **while** you
work, not after.

## How To Use

- **Running TODO** mirrors the Ordered Atomic Queue. Tick a box only when that atomic is merged and
  its issue gate has passed. Sub-bullets capture in-flight state for the atomic you are on.
- **Decision Log** is ADR-lite. Add an entry whenever you make a non-obvious call: a re-ordering, a
  scope cut, a finding re-classification, a divergence resolution. Newest at the bottom.
- **Milestone Notes** get one block per merged atomic (mirror the house style in
  `canvas-port-interaction-redesign-execution.md`: branch, what changed, frontend perf review,
  verification commands, official-check note) **plus the Codex review rounds (≤2) and their
  dispositions** — see the template at the bottom of this file.
- When a decision changes the queue, edit the goal doc too, then note the edit here.

## Running TODO

### Phase 0 — Guardrails (one PR)
- [x] A0 — guardrail tests W1–W5 + multi-edge-disconnect stub (`phase0-guardrail-tests`) — PR #36

### Phase 1 — Structural root-cause
- [x] A1 — shared TLS/multiplex/transport by direction (`shared-cards-by-direction`) — PR #37
- [x] A2a — rule-set local `format` inference + empty-group error + WireGuard/DERP-mesh required diagnostics, domain-only (`required-fields-diagnostics`) — PR #39
- [x] A2b — pre-export validation gate: confirm before downloading a config with error diagnostics (`required-markers-and-export-gate`) — PR #40
- [ ] A2c — deferred from A2a/A2b for per-finding upstream+fixture verification: presence diagnostics (inbound `listen` + credentials C0-16; dns-rule route/evaluate `server` C0-1, overlaps A10) **+ the paired required `aria-required`/`*` field markers**; may fold into A10/A20 (`required-presence-and-markers`)
- [x] A3 — JsonField parse safety + `rules` handled (`jsonfield-parse-safety`) — PR #38
- [x] A4a — type-change dial-detour scrub (C0-9 outbound + C0-8 dns-server detour), domain-only (`type-change-normalizer`) — PR #41
- [x] A4c — kv blank-row fixes (W13/C0-6): seed unique keys in torrc/http/naive/dns-h3 repeaters (`kv-no-empty-rows`) — PR #42
- [x] A4b — type-change confirm dialog (W7/T3): confirm before a destructive type change (`type-change-confirm`) — PR #43
- [ ] A4-rest — remaining type-change-safety, sub-atomic'd per don't-mix/budget when tackled: rule-action field normalizers (C0-3, domain), dns-server type-change dependency creation (C0-8, domain)
- [x] A5 — wire `version` into `validateConfig` (`version-aware-gating`) — PR #44; C2-2 (Inspector service dropdown filter) deferred; `system_interface` boolean predicate → A14
- [x] A6a — referenceRegistry completeness: 8 upstream-real tag refs, rename + delete (`reference-registry-completeness`) — PR #45
- [x] A6b — dial-detour port guards: exclude block/dns from `detour-target` input (W5a); selector/urltest kept as valid targets — **audit deviation** from `["block","selector","urltest","dns"]`, see note (`dial-detour-port-guards`) — PR #46
- [x] A7a — endpoint outbound-half (domain): endpoints join the outbound reference namespace — `getOutboundTags` + delete cascade; both WireGuard & Tailscale per migration.md (`endpoint-outbound-refs`) — PR #47
- [x] A7b — endpoint outbound-half (canvas): input ports on endpoint nodes (broaden the 5 outbound-target relations via `extraNodeKinds`) + graph edges + connect handlers (`endpoint-outbound-ports`) — PR #48
- [x] A8a — canvas-connect-legibility: W2 dead-chips — implement selector/urltest proxy chips via `outboundTypeForChipLabel` + attach as member, prune WireGuard/cert/service chips; port-icon (T7) already satisfied (`canvas-connect-legibility`) — PR #49
- [x] A8-multiedge — multi-edge aggregate-port disconnect (C1-7/8/23): mark the 8 writable array relations aggregate + suppress their ambiguous per-port disconnect (both ends); disconnect via per-edge remove / Inspector list (`multi-edge-disconnect`) — PR #50
- [x] A8b — confirmed icon set (`../ui-icon-set.md`): one shared type-aware registry across node card / Palette / chip picker / Inspector; v4 monograms + Lucide glyphs; status glyphs reserved (`node-icon-distinctness`) — PR #52
- [ ] A8b-brands — replace the WG/TO/TS interim monograms with the confirmed brand SVGs (WireGuard/Tor/Tailscale) after a license/bundle-size review (`node-brand-svgs`)
- [ ] A8b-ports — expand `PortIconId` + derive the v4 port-relation glyph vocabulary (IC-P2-5: ListOrdered/FlagTriangleRight/Flag/Target/Crosshair/Milestone/CornerDownRight/DownloadCloud/ShieldCheck …) (`port-relation-icons`)
- [x] A9 — warning glyph + `✓ N` relabel + edge-remove pointer-events (`validity-readability`) — PR #53

### Phase 2 — Residual node P0/P1
- [ ] A10 — dns-rule server settable + evaluate/respond ordering (`dns-rule-server-and-ordering`)
- [ ] A11 — rule-set-inline structured editor (`rule-set-inline-editor`)
- [ ] A12 — rule-set-remote http_client object form (`rule-set-http-client`)
- [ ] A13 — ccm/ocm detour control (`ccm-ocm-detour`)
- [ ] A14 — endpoint-tailscale system_interface bool (`endpoint-tailscale-system-interface`)
- [ ] A15 — dns-server-tailscale accept_search_domain (`dns-server-tailscale-fields`)
- [ ] A16 — hub-route default_network_type (`hub-route-network-type`)
- [ ] A17 — inbound-redirect platform banner (`inbound-redirect-banner`)
- [ ] A18 — inbound-vless TLS default (`inbound-vless-tls-default`)
- [ ] A19 — settings-experimental label (`settings-experimental-label`)
- [ ] A20 — residual node P1 batch, per category (`residual-node-p1-<category>`)
- [ ] A21 — cloudflared testing inbound (`inbound-cloudflared-testing`)
- [ ] A22 — HTTP Client capability (`http-client-capability`)

### Phase 3 — UX comprehension
- [ ] A23 — palette usability (`palette-usability`)
- [ ] A24 — canvas connect/disconnect discoverability + edge legend (`canvas-connect-discoverability`)
- [ ] A25 — mobile build path (`mobile-build-path`)
- [ ] A26 — import safety + onboarding (`import-safety-and-onboarding`)
- [ ] A27 — template placeholder secrets (`template-placeholder-secrets`)

### Phase 4 — Polish
- [ ] A28 — diagnostics/labels polish (`diagnostics-labels-polish`)
- [ ] A29 — per-node P2 cleanup (`per-node-p2-cleanup`)

## Decision Log

### 2026-05-28 — Reconcile two reviews into one umbrella goal
- **Context:** Codex and Pass-2 reviewed the same codebase against sing-box upstream and overlap heavily.
- **Decision:** Build a single umbrella goal that cross-maps `C-id ↔ T/W/atomic`, then spawns one child
  goal per atomic; do not concatenate the reports or duplicate findings.
- **Reason:** Convergent findings are the highest-confidence work; the overlap is only useful once
  de-duplicated and ranked.
- **Affects:** all atomics.

### 2026-05-28 — Pass-2 five-phase backbone, convergence-first, Codex-grafted
- **Context:** Codex ships an 8-step plan; Pass-2 ships a 5-phase, test-first, 35-W-item plan.
- **Decision:** Use Pass-2's five phases as the spine (guardrails → structural → residual → UX →
  polish); order convergent findings first within a phase; graft Codex-unique items into the phase
  matching their don't-mix bucket.
- **Reason:** Pass-2's plan is the most granular and is test-first, which fits the repo's
  guardrail-then-fix discipline; nothing from Codex is dropped.
- **Affects:** queue ordering for all atomics.

### 2026-05-28 — Type-change: do both normalizer and confirm (A4)
- **Context:** Codex C0-3 wants central action-schema normalizers; Pass-2 T3/W7 wants a confirm +
  field preservation.
- **Decision:** Implement both in A4 — normalizer for correctness (no stale/invalid fields survive a
  type change) plus a confirm dialog for data-safety.
- **Reason:** They solve different problems (invalid export vs silent data loss) and are complementary.
- **Affects:** A4.

### 2026-05-28 — Split multi-edge disconnect (correctness) from disconnect discoverability (UX)
- **Context:** Codex C1-7/8/23 is a precise "removes the first edge, not the intended reference" bug;
  Pass-2 W30 is about making disconnect discoverable + an edge legend.
- **Decision:** Edge-specific multi-reference removal lands in A8 (canvas correctness); the
  discoverability affordance + legend lands in A24 (UX). A0 carries a failing stub for the former.
- **Reason:** Correctness vs polish is a don't-mix boundary.
- **Affects:** A0, A8, A24.

### 2026-05-28 — Docs in English to match repo house style
- **Context:** All existing `docs/goals/**` docs and both review reports are in English with English
  `C-/T-/W-` ids.
- **Decision:** Write this goal + devlog in English for consistency and workflow-fit; user-facing
  conversation stays in Simplified Chinese.
- **Reason:** The docs cross-reference English ids and feed an English review/issue workflow.
- **Affects:** documentation only.

### 2026-05-28 — Claude + Codex development with a 2-round Codex review gate
- **Context:** User directive: this program is built with Claude Code + Codex.
- **Decision:** Each atomic is implemented by Claude Code (test-first), then reviewed by Codex before
  merge. Cap at **two Codex review rounds**; after the second round, merge to `main` via PR. Findings
  not resolved within two rounds become a follow-up atomic, not a third round.
- **Reason:** Get a second-model review on every atomic while bounding the review loop so atomics
  still land promptly.
- **How to apply:** Per atomic — local checks → Codex review (≤2 rounds, fix actionable findings) →
  PR + merge → existing PR/main issue gates. Record the rounds in the milestone note below. Run
  `codex:setup` once to confirm the Codex CLI is ready.
- **Affects:** every atomic's review/merge step.

### 2026-05-28 — Codex split landed; created the confirmed icon-set doc; retargeted the goal
- **Context:** Codex split its review into 70 per-node/feature `<node>--codex.md` files; PR #32 carries
  the goal docs + the full codex review. The two icon audits + the confirmed v4 preview were ready.
- **Decision:** Created `docs/ui-icon-set.md` (final confirmed icon set, v4) as the A8b spec; retargeted
  the goal's "Before You Start" so each atomic reads both per-node files (`<node>--claude.md` +
  `<node>--codex.md`); A8b now points at the icon-set doc. Bundle goal docs + codex review + icon-set
  doc into PR #32 and **squash-merge** to `main`.
- **Reason:** Per-node codex files make per-atomic prep symmetric with pass-2; one confirmed icon doc
  feeds A8b; a single squash keeps `main` history clean.
- **How to apply:** `_icons-preview-v4.html` is the authoritative visual for exact glyphs — lift the
  proxy-protocol glyphs from there during A8b. Record any brand-SVG rejection or glyph change against
  `docs/ui-icon-set.md` here. Honor [[codex-review-gate]] and [[pr-over-commits]] for child atomics.
- **Affects:** A8b; the per-atomic reading workflow; the PR #32 merge.

### 2026-05-28 — Reconciliation-completeness audit: graft 4 unmapped Codex findings
- **Context:** A verification pass cross-checked every Codex `C-`/`IC-` id and Pass-2 `T-`/`W-`/atomic id
  against the Ordered Atomic Queue. All 35 W-items, 14 T-themes, 19 C0 P0s, the Pass-2 14-atomic queue,
  and the `IC-P*-*` icon findings were already mapped — but four Codex findings (`C1-1`, `C1-3`, `C1-6`,
  `C2-2`) had no row, silently breaking the "nothing from Codex is dropped" guarantee.
- **Decision:** Graft each into its exact-match atomic (no new atomics; the behavior was already covered
  by the row's W-item, only the `C-` id citation was missing):
  - `C1-1` (route-rule `bypass` must expose `outbound`/route-options) → **A20** (its W28 rule category
    already names "bypass-outbound select + resolve/route-options sub-fields").
  - `C1-3` (dns-rule compatible chip creates a DNS server but never connects it — missing
    `source.kind === "dns-rule"` branch in `createCompatible`) → **A8** (W16/T8 dead/no-op-chip cluster).
  - `C1-6` (hosts `predefined` + HTTPS/H3 header maps persist empty keys) → **A4** (W13 already scopes
    DoH-header/hosts empty-key prevention at the kv-repeater source).
  - `C2-2` (Service Inspector type dropdown still offers testing-only `hysteria-realm` on stable) →
    **A5** (channel/version-gating family; matches Codex exec-plan item 7). Its surface is
    `protocols.ts`/Inspector option gating, distinct from A5's `validateConfig` change — confirm at
    child-goal time whether it splits into a tiny follow-up.
- **Reason:** The umbrella goal's entire value is the traceable cross-map; an unmapped finding is a
  silent drop that no reader could trace by grepping its id.
- **How to apply:** Every Codex `C-` id is now greppable to exactly one atomic row. With `C2-2` homed,
  all `C2-*` ids are individually placed, so A28's "C2-* tail" was narrowed to "C2 label/copy residue."
- **Affects:** A4, A5, A8, A20, A28.

### 2026-05-28 — Split A2 into A2a (diagnostics) + A2b (markers + export gate)
- **Context:** A2 (`required-fields-and-export-gate`) is "Effort: L" and spans three concerns: domain
  diagnostics, component required-markers, and the export-UI gate.
- **Decision:** Split into **A2a** (diagnostics additions/upgrades + rule-set local `format` inference,
  `src/domain/diagnostics.ts` only) and **A2b** (`SharedFieldDefinition.required` + `aria-required`/`*`
  markers in `Inspector.tsx` + pre-export confirm gate in `TopBar.tsx`). Land A2a first so A2b's export gate
  has real error diagnostics to block on.
- **Reason:** (1) don't-mix bucket — domain/diagnostics vs component-render vs export-UI; (2) the
  `claude-review` pre-push gate budgets ~400 non-Markdown LOC per commit (AGENTS.md #8), and A2-as-one-commit
  would exceed it. Splitting keeps each atomic one-outcome and within the size budget.
- **Also:** A2a (as implemented) covers C0-19 (local rule-set `format`), C0-5 (empty selector/urltest
  group → error), C0-12 (WireGuard endpoint required fields), and C0-10 (DERP `mesh_with` server/port).
  The dns-rule route/evaluate `server` presence (C0-1) is deferred to A2c (overlaps A10's "evaluate hides
  server" C0-2 and the type-change scrub C0-3). The SSM-managed severity (C0-17) is left to A20, which
  owns the SSM mapping. The last-candidate-removal UI guard stays in A8.
- **Affects:** A2 (now A2a + A2b, + A2c for presence diagnostics deferred from A2a after implementation —
  inbound `listen`/credentials C0-16 and dns-rule route/evaluate `server` C0-1 need per-finding upstream +
  fixture verification; A2a shipped the low-false-positive subset: C0-19/C0-5/C0-12/C0-10); the umbrella A2
  row notes the split.

## Open Questions / Risks

- **Re-verify against HEAD.** Both reports and the `canvas-port-interaction-redesign-execution`
  atomics landed 2026-05-28. Some findings may already be partly fixed (reference/port registries,
  disconnect groundwork). Reproduce each finding on current `main` before implementing its child goal.
- **A7 (endpoint outbound-half)** is the single highest-risk atomic (touches reference resolution,
  ports, and connect handlers). Gate it behind a green `referenceRegistry`-completeness test (A0/A6).
- **A21 / A22 (cloudflared, HTTP Client):** unresolved product call — fully support the testing
  target now, or keep stable gated and ship docs-only? Decide before opening these child goals.
- **A20 batching:** keep strictly per node category; resist bundling to "save a PR."
- **Per-node `file:line` drift:** the cross-map's `C-/T-/W-` pairings are authoritative; the exact
  line numbers in the source reports may have drifted since 2026-05-28 — re-confirm when opening each
  child goal.
- **Official sing-box binaries:** if `sing-box-stable`/`sing-box-testing` are unavailable in the work
  environment, say so in the milestone note and distinguish browser semantic validation from official
  validation.

## Milestone Notes

One block per merged atomic. Template:

```md
### A<n> <slug> — <one-line outcome>
Status: implemented YYYY-MM-DD in `atomic/<branch>`; merged in PR #<n>.

- What changed: <bullet summary tied to the C-/T-/W- ids closed>.
- Frontend perf review (`vercel-react-best-practices`): <findings or "n/a — no src/components|state change">.
- Codex review:
  - Round 1: <findings → dispositions>.
  - Round 2 (if needed): <findings → dispositions, or "skipped — round 1 clean">.
  - Deferred to follow-up atomic: <none | A<x> tracking ...>.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test`, `pnpm build`, `pnpm e2e` (as applicable).
- Official check: `sing-box-stable/testing check` <ran on … | not run because …>.
```

### A0 phase0-guardrail-tests — Phase-0 guardrail suite (W1–W5 + multi-edge stub)
Status: implemented 2026-05-28 in `atomic/phase0-guardrail-tests`; merged in PR #36.

- What changed: tests + child goal doc only (`docs/goals/phase0-guardrail-tests.md`). Six guardrails turn
  each Phase-1 fix into a red→green target while keeping `pnpm test` green (red targets = `it.fails`; DOM
  guardrails = characterization that flips red on fix):
  - W1 `referenceRegistry` completeness on delete **and** rename for 5 code-verified refs (route-rule
    `resolve.server`, inbound `detour`, tun `route_address_set`, shadowtls `handshake.detour`, derp
    `mesh_with[].detour`; `_RELATIONSHIPS` rows 5/23/28/29/30) → A6.
  - W2 behavioral `createCompatible` coverage (16 dead chips: C1-9/12/15) → A8.
  - W3 shared TLS/multiplex card role-by-direction (C0-6/C0-7) → A1.
  - W4 `JsonField` parse safety (C0-18) → A3.
  - W5a `detour-target` input type guard for block/selector/urltest/dns (P2-f) → A6.
  - W5b warning-vs-valid node status glyph (T9/W10) → A9.
  - multi-edge aggregate-port disconnect characterization + `it.todo` (C1-7/8/23) → A8.
- Re-verify-against-HEAD: W5 dns-server-detour guard already landed in the canvas PR-7 atomic → shipped a
  green regression lock instead of a red target. Per-member selector disconnect already works from each
  member node's own input port; only the selector's aggregate output control is defective.
- Frontend perf review (`vercel-react-best-practices`): n/a — no `src/components`/`src/state` change.
- Codex review:
  - Round 1: 1 BLOCKER (W2 was a static handled-set mirror that wouldn't flip if A8 wired rather than
    pruned dead chips) + 3 SHOULD-FIX (W1 delete-only, W5a block-only, multi-edge brittle count assertion).
    All addressed: W2 → behavioral probe; W1 → rename cases; W5a → all four types; multi-edge → `it.todo`
    after discovering per-member disconnect already works.
  - Round 2: clean — findings resolved, no W2 false-positives, no new issues, `tsc` clean.
  - Deferred to follow-up atomic: none.
- Verification: `git diff --check`, `pnpm exec tsc -b --pretty false`, `pnpm test`
  (602 passed | 15 expected fail | 1 todo), `pnpm build`. `pnpm e2e` not run (no interaction change).
- Official check: `sing-box-stable/testing check` not run because A0 changes tests + docs only, not
  bundled fixture/exported config output.

### A1 shared-cards-by-direction — Split shared TLS/multiplex cards by role
Status: implemented 2026-05-28 in `atomic/shared-cards-by-direction`; merged in PR #37.

- What changed (C0-6 / C0-7 / W6 / T1-T2): `sharedFieldDefinitions` now partitions the TLS and multiplex
  shared cards by role.
  - TLS server role = inbound + service; client role = outbound + **dns-server** (dns-server[tls/https/
    quic/h3] dials a DoT/DoH upstream as a client — verified against `dns/server/{tls,https,quic,http3}.md`).
    Server-only: key/key_path/client_authentication/certificate_provider/reality server handshake/
    private_key/short_id(list)/max_time_difference/ech.key/ech.key_path. Client-only: disable_sni/insecure/
    certificate_public_key_sha256/fragment*/record_fragment/utls/reality public_key+short_id(text)/ech
    client config.
  - Fixed `client_authentication` enum to `no/request/require-any/verify-if-given/require-and-verify`.
  - Multiplex protocol/max_connections/min_streams/max_streams gated to outbound; inbound keeps
    enabled/padding (+brutal).
  - naive (outbound) TLS narrowed (no enable toggle; scaffold seeds enabled:true); dropped `tuic` from
    `outboundUdpOverTcpTypes` (uses `udp_over_stream`).
  - Flipped the A0 W3 guardrail to assert by-direction; rewrote the app.test single-card test into
    server/client cases; updated the config-doc tuic line.
- Scope deferrals (don't-mix): v2ray-transport per-type gating + a `headers` map control is by-TYPE not
  by-direction and needs a new `SharedFieldKind` → follow-up atomic; additive missing TLS fields
  (kernel_tx/rx, handshake_timeout, client mTLS client_certificate/client_key, engine/spoof) → A20/W28.
- Frontend perf review (`vercel-react-best-practices`): pure derived-during-render data
  (`rerender-derived-state-no-effect`); no new subscriptions, hooks, waterfalls, or bundle deps; returns
  fresh arrays as before (stable keys, no added rerender). Pass.
- Codex review:
  - Round 1: 1 BLOCKER (server `reality.short_id` dropped — regression; restored as a `list`) + 3
    SHOULD-FIX (server `ech.key`/`ech.key_path` added to avoid a dead ECH toggle; redundant naive
    `tls.enabled` toggle removed; `tuic` removed from the udp-over-tcp owners string). All addressed.
  - Round 2: clean.
  - Deferred to follow-up atomic: none from review (scope deferrals above are queue items, not findings).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (602 passed | 15 expected fail | 1
  todo), `pnpm build`, `pnpm e2e` (13 passed, Chromium).
- Official check: `sing-box-stable/testing check` not run — A1 changes Inspector field-list logic, not
  bundled fixture/exported config output.

### Soft checkpoint after A1 (queue re-evaluation)
A1 landed the role-split inside `sharedFieldDefinitions` without changing the shared-group registry shape
(`sharedFieldRegistry.ts` group membership is unchanged; only the per-group field lists became
role-aware). No re-ordering of later rows is required: A2/A3 (required+export gate, JsonField) and A6
(referenceRegistry+detour guards) are independent of the TLS/multiplex field-list internals. v2ray-transport
per-type work was split out as a follow-up (recorded above). Proceeding to A2 + A3 per the near-term order.

### A3 jsonfield-parse-safety — JsonField never writes unparseable text
Status: implemented 2026-05-28 in `atomic/jsonfield-parse-safety`; merged in PR #38.

- What changed (C0-18 / T4 / W8): `JsonField` now keeps a local draft + parse-error state — on a parse
  failure it keeps the last valid value and shows a `role="alert"`, only calling `onChange` on a
  successful `JSON.parse`; empty input clears the field. A `lastEmittedRef` separates our own valid edits
  (no reset / no mid-edit reformat) from external value changes, and each `JsonField` is keyed by entity
  identity so an entity switch resets draft/error (no stale draft can land on the next entity even when
  both share an identical value). The route-rule and dns-rule logical-group "rules" editors now use the
  existing safe `InlineRuleSetEditor`; `"rules"` was added to `ruleSetHandledFields` to avoid a duplicate
  advanced-JSON editor. Flipped the A0 W4 guardrail to assert the safe behavior.
- Frontend perf review (`vercel-react-best-practices`): controlled-input local state (draft/error + a
  ref); no new store subscriptions, waterfalls, or bundle deps. Pass.
- Codex review:
  - Round 1: keep last-valid + role="alert" (implemented); follow-up — reset draft/error on entity switch
    (added `lastEmittedRef`).
  - Round 2: entity switch with byte-identical values still kept the stale draft → keyed `JsonField` by
    entity identity so React remounts on switch. Plus minors (empty-input clear, refKey hoist, key-order
    consistency) addressed.
  - Deferred to follow-up atomic: none.
- Pre-push gate note: the local `claude-review` pre-push hook reviews each commit in isolation against the
  AGENTS.md #8 atomic budget, so the intermediate round-1/round-2 fix commits (whose first commit still
  carried the pre-fix JsonField) were **squashed into one clean signed commit** before push; the squashed
  commit passed the gate.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (604 passed | 15 expected fail | 1
  todo), `pnpm build`, `pnpm e2e` (port-click-redesign 6/6 on isolated re-run; one full-suite drag test
  was a headless flake — A3 changes no canvas code).
- Official check: `sing-box-stable/testing check` not run — A3 changes Inspector editor behavior, not
  bundled fixture/exported config output.

### A2a required-fields-diagnostics — flag more invalid configs before export (domain)
Status: implemented 2026-05-28 in `atomic/required-fields-diagnostics`; merged in PR #39.

- What changed (`src/domain/diagnostics.ts` + `tests/required-fields-diagnostics.test.ts`):
  - C0-19: local rule-set with no `format` and a non-inferable `path` (ext ≠ .json/.srs) → error
    (`rule-set-local-format-missing`); the local path is read as a filesystem path (no URL query/fragment
    stripping), distinct from the remote-url inference.
  - C0-5: empty selector/urltest `outbounds[]` group upgraded warning → error (`group-outbound-empty`).
  - C0-12: WireGuard endpoint requires `address`/`private_key`/≥1 `peers`; each peer requires
    `public_key`/`allowed_ips`.
  - C0-10: each DERP `mesh_with[]` peer requires `server` + numeric `server_port`.
- Scope: A2 was split (this devlog, 2026-05-28) into A2a (this) + A2b (markers + export gate) + A2c
  (deferred presence diagnostics). A2a shipped the low-false-positive subset; **A2c** still owns inbound
  `listen` + credential presence (C0-16) and dns-rule route/evaluate `server` (C0-1, overlaps A10).
- Frontend perf review: n/a — domain-only, no `src/components`/`src/state` change.
- Codex review:
  - Round 1: 1 should-fix (local `format` inference must not strip URL query/fragment from a filesystem
    path — fixed) + 1 nit (devlog C0-1 scope contradiction — fixed). All four diagnostics confirmed
    against sing-box testing 1.14 with no false positives (wireguard.md:56, selector.md:24, urltest.md:23,
    service/derp.md:96, rule-set/index.md).
  - Round 2: skipped — the two findings were trivial and locally verified by the passing test; the repo
    pre-push `claude-review` gate independently passed the squashed commit.
  - Deferred to follow-up atomic: A2c (presence diagnostics, above).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (613 passed | 15 expected fail | 1
  todo), `pnpm build`. No bundled fixture regressed from the new/upgraded diagnostics.
- Official check: `sing-box-stable/testing check` not run — A2a adds semantic diagnostics, not bundled
  fixture/exported config output.

### A2b required-markers-and-export-gate — pre-export validation gate (component)
Status: implemented 2026-05-28 in `atomic/required-markers-and-export-gate`; merged in PR #40.

- What changed (`src/components/TopBar.tsx` + `tests/export-gate.test.tsx` + `e2e/external-fixtures.spec.ts`):
  `exportConfig()` prompts a `window.confirm` when the config has error-level diagnostics and aborts the
  download on cancel (W9 pre-export gate). The gate reads semantic `diagnostics` (always current, never
  cleared mid-flight), not the combined pill status — closing the in-flight official-check race. Added an
  `export-button` testid; the external-fixtures e2e accepts the dialog so its round-trip still runs.
- Scope: A2b is the export gate only. Required-marker `aria-required`/`*` field hints were moved to A2c
  (they pair with the presence diagnostics A2c also owns).
- Frontend perf review (`vercel-react-best-practices`): adds a guard to an existing handler using
  already-subscribed `diagnostics`; no new subscriptions, waterfalls, or bundle deps. Pass.
- Codex review:
  - Round 1: 1 should-fix — gating on combined `status` could be raced by an in-flight official check
    (runOfficialCheck clears official diagnostics on start). Fixed by gating on semantic `diagnostics`.
  - Round 2: skipped — the fix directly implements the recommendation and is verified by unit + e2e; the
    repo pre-push `claude-review` gate passed the squashed commit.
  - Deferred to follow-up atomic: none (markers were a scope move to A2c, not a finding).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (616 passed | 15 expected fail | 1
  todo), `pnpm build`, `pnpm e2e` (external-fixtures + port-click specs 8 passed; an earlier port-click
  failure was a known headless-drag flake).
- Official check: `sing-box-stable/testing check` not run — A2b changes the export UI flow, not bundled
  fixture/exported config output.

### A4a type-change-normalizer — scrub dial detour on type change (domain)
Status: implemented 2026-05-28 in `atomic/type-change-normalizer`; merged in PR #41.

- What changed (`src/domain/commands.ts` `changeEntityType` + `tests/type-change-normalizer.test.ts`):
  preserve an outbound/dns-server dial `detour` on type change only when the new type can dial
  (`supportsOutboundDialFields` / `supportsDnsServerDialFields`). Drops the detour for non-dial outbound
  types (block/dns/selector/urltest, C0-9) and non-dial dns-server types (hosts/fakeip/tailscale/resolved,
  C0-8 detour part) instead of leaving a stale detour sing-box rejects.
- Scope: A4 split. **A4-rest** still owns the rule-action field normalizers (C0-3), dns-server
  type-change dependency creation (C0-8 create endpoint/service), the W7 confirm dialog, and the W13 kv
  blank-row fixes — to be sub-atomic'd per don't-mix / pre-push size budget.
- Frontend perf review: n/a — domain-only.
- Codex review:
  - Round 1: clean — dial-support gates confirmed correct against testing 1.14; no wrongful drop/keep;
    deferrals reasonable.
  - Deferred to follow-up atomic: A4-rest (above).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (620 passed | 15 expected fail | 1
  todo), `pnpm build`.
- Official check: `sing-box-stable/testing check` not run — A4a changes a domain command, not bundled
  fixture/exported config output.

### A4c kv-no-empty-rows — seed kv-repeater rows with a unique key (component)
Status: implemented 2026-05-28 in `atomic/kv-no-empty-rows`; merged in PR #42.

- What changed (`src/components/Inspector.tsx` + `tests/kv-no-empty-rows.test.tsx`): added
  `withUniqueBlankKey(map, base)` (returns the map plus a unique non-empty key with an empty value,
  base/base-2/…) and replaced the four `{ ...map, "": "" }` "Add" seeds — torrc (base "Option"), HTTP
  outbound headers, naive `extra_headers`, DNS HTTPS/H3 headers (base "X-Header"). A blank `{"":""}` key
  can no longer be committed/exported (W13 / C0-6). hosts `predefined` + ccm/ocm headers were already safe.
- Frontend perf review (`vercel-react-best-practices`): a pure helper + four onClick seed swaps; no new
  subscriptions, waterfalls, or bundle deps. Pass.
- Codex review:
  - Round 1: clean — no remaining empty-key seeds; `withUniqueBlankKey` correct; all three `writeHeaders`
    replacements in the right closure scope.
  - Deferred to follow-up atomic: A4-rest (rule-action normalizers C0-3, dns-server type-change deps C0-8,
    W7 confirm dialog).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (623 passed | 15 expected fail | 1
  todo), `pnpm build`, `pnpm e2e` (13 passed).
- Official check: `sing-box-stable/testing check` not run — A4c changes editor repeater UX, not bundled
  fixture/exported config output.

### A4b type-change-confirm — confirm before a destructive entity type change (component)
Status: implemented 2026-05-28 in `atomic/type-change-confirm`; merged in PR #43.

- What changed (`src/components/Inspector.tsx` + `tests/app.test.tsx`): a `requestTypeChange` handler now
  wraps all six entity-type `<select>`s. It `window.confirm`s before `changeEntityType` when the entity
  has meaningful (non-empty) own fields OR when the change would scrub references to it (endpoint leaving
  `tailscale` / service leaving `resolved`); declining leaves the entity unchanged (W7 / T3).
- Frontend perf review (`vercel-react-best-practices`): a local handler + six onChange rewires using the
  existing `entity`/`ref`/`changeEntityType`; no new subscriptions, waterfalls, or bundle deps. Pass.
- Codex review:
  - Round 1: 1 should-fix (the initial `>2 keys` heuristic could skip the confirm for a referenced-but-
    minimal entity whose type change scrubs references) + 1 nit (fresh scaffolds with empty defaults
    over-prompted). Both addressed by the meaningful-fields + scrubs-refs condition.
  - Round 2: skipped — directly implements the recommendation; verified by the UI confirm/decline tests;
    the repo pre-push `claude-review` gate passed the squashed commit.
  - Deferred to follow-up atomic: A4-rest (rule-action normalizers C0-3, dns-server type-change deps C0-8).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (624 passed | 15 expected fail | 1
  todo), `pnpm build`, `pnpm e2e` (13 passed).
- Official check: `sing-box-stable/testing check` not run — A4b changes the Inspector type-change UX, not
  bundled fixture/exported config output.

### A5 version-aware-gating — pass version into validateConfig (domain + store)
Status: implemented 2026-05-28 in `atomic/version-aware-gating`; merged in PR #44.

- What changed (W11 / C2-6): `validateConfig(config, channel, version?)` — version optional, default from
  channel (stable→1.13, testing→1.14). Threaded `state.version` through every store
  `sync`/`computeDiagnostics` call; `setTarget` passes `target.version`. Fixed 4 "1.13+" rules to gate on
  `atLeast(version,…)`: certificate block (1.12+), `store=chrome` (1.13+), tailscale `advertise_tags` /
  `system_interface` (1.13+). Added `compareVersions`/`atLeast` in `targets.ts`. "1.14+/testing-only"
  rules stay channel-gated.
- Deferrals: C2-2 (Inspector service-type dropdown channel filter) → separate component follow-up;
  `system_interface` boolean predicate (it's a boolean upstream, not a string) → A14 (C0-13), which
  migrates the field's control — A5 keeps the string predicate to match the current editor data.
- Frontend perf review (`vercel-react-best-practices`): the store change is mechanical version threading
  (one extra arg per existing call); no new subscriptions, rerenders, waterfalls, or bundle deps. Pass.
- Codex review:
  - Round 1: 1 BLOCKER — version threading was incomplete (18 store `sync`/`computeDiagnostics` calls with
    function-call first args still passed channel only, so a 1.12 target reverted to 1.13 after edits).
    Fixed by threading `state.version` through all of them + a store-level regression test. 1 should-fix
    (`system_interface` boolean) deferred to A14 with rationale.
  - Round 2: skipped — the fix is mechanical + verified by the new store test, and the pre-push
    `claude-review` gate passed the squashed commit.
  - Deferred to follow-up atomic: C2-2 (component option gating); `system_interface` predicate → A14.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (626 passed | 15 expected fail | 1
  todo), `pnpm build`, `pnpm e2e` (passed).
- Official check: `sing-box-stable/testing check` not run — A5 changes diagnostics gating, not bundled
  fixture/exported config output.

### A6a reference-registry-completeness — finish the canonical tag reference registry (domain)
Status: implemented 2026-05-28 in `atomic/reference-registry-completeness`; merged in PR #45.

- What changed (W1; _RELATIONSHIPS.md rows 5/23/28/29/30): completed both rename (`replace*`) and delete
  (`remove*`) paths for eight upstream-real refs — route-rule `resolve.server`→dns-server; inbound listen
  `detour`→inbound; tun `route_address_set`/`route_exclude_address_set`→rule-set (`type==="tun"` guarded);
  shadowtls `handshake.detour` + `handshake_for_server_name.*.detour`→outbound; derp `mesh_with[].detour`
  + `verify_client_url[].detour`→outbound; cloudflared `control_dialer`/`tunnel_dialer` `detour`→outbound.
  Flipped W1 (`it.fails`→`it`, +6 sibling cases); kept `referenceRegistry.paths` ⇄ domain
  `referenceCoverageCases.paths` in lockstep with an extended fixture + assertions.
- Codex review (2 rounds): round 1 found three sibling outbound-detour majors (shadowtls
  `handshake_for_server_name`, derp `verify_client_url`, cloudflared dialers) + one paths-metadata minor;
  all addressed in round 2 → clean. Pre-push `claude-review`: 0 critical/major, 1 accepted minor (an
  emptied tun array is left `[]` not `undefined`, consistent with the existing `removeStringArray` helper).
- Verification: `git diff --check`, `tsc -b`, `pnpm test` (642 passed | 5 expected fail | 1 todo),
  `pnpm build`. Domain-only; no `vercel-react` surface and no e2e (no interaction change).
- NOTE: this A6a note and the A6 TODO split below land in the A6b PR — #45 merged before the note was added.

### A6b dial-detour-port-guards — guard non-dialable detour targets (domain)
Status: implemented 2026-05-28 in `atomic/dial-detour-port-guards`; merged in PR #46.

- What changed (W5a; _RELATIONSHIPS.md P2-f): added `nodeTypeExcludes` to the three `detour-target` INPUT
  endpoints (`portRelationRegistry.ts:106/108/117` — outbound-detour, endpoint-detour, settings-ntp-detour),
  so a dead-chain detour into a non-dialable outbound can no longer be created on the canvas.
- DECISION — **narrowed the audit's exclude list** from `["block","selector","urltest","dns"]` to
  `["block","dns"]`. Upstream `dial.md` defines `detour` as "the tag of the upstream outbound" with no type
  restriction, and the canonical stable config (`createStableTunSplitConfig`) detours dns/endpoint/ntp
  through the `"proxy"` **selector** — so selector/urltest ARE valid detour targets (they dial through the
  selected member). Excluding them would break the canonical config's "every rendered edge is registry-
  explainable" invariant (`port-relation-registry.test.ts`) and block a valid, common workflow. Only
  `block` (drops traffic) and the special `dns` outbound are true dead chains. Flagged to the user as an
  audit deviation; reversible if a deliberate UX restriction was intended.
- W5a guardrail flipped: asserts block/dns drop the `detour-target` port + a positive lock that
  selector/urltest keep it.
- Verification: `git diff --check`, `tsc -b`, `pnpm test` (646 passed | 1 expected fail | 1 todo),
  `pnpm build`, `pnpm e2e`. Codex review and `vercel-react` (domain-only, no component surface) per PR.

### A7a endpoint-outbound-refs — endpoints join the outbound reference namespace (domain)
Status: implemented 2026-05-28 in `atomic/endpoint-outbound-refs`; merged in PR #47.

- What changed (A7 domain half; audit endpoint-wireguard P0-2 / _SUMMARY T14): an endpoint is "a protocol
  with inbound and outbound behavior", so its tag is a valid `route.final` / route-rule `outbound` /
  selector|urltest member / detour target. `getOutboundTags` (`indexes.ts`) now includes every endpoint
  tag, so diagnostics stop false-flagging an endpoint used as an outbound target. `deleteEntity`
  (`commands.ts`) now also runs the `outbound`-kind reference scrub for any endpoint delete, so deleting an
  endpoint no longer leaves dangling route/selector/detour refs.
- Re-verify-against-HEAD: rename already cascaded correctly (`replaceRegisteredTagReferences` runs every
  reference kind), so only DELETE and DIAGNOSTICS were broken on HEAD — confirmed test-first (red → green).
- DECISION — included BOTH WireGuard and Tailscale endpoints (no type gate). The pass-2 audit
  (endpoint-tailscale) claimed Tailscale is "not a route target", but `migration.md:221-223` explicitly
  says "A WireGuard or Tailscale endpoint used as an outbound" — the audit conflated Tailscale's own
  control-plane Dial Fields (`tailscale.md:151-155`) with being a detour/route TARGET. Surfaced to the
  user as an audit deviation (corrects the A7 question's premise); reversible.
- Codex review (2 rounds): round 1 [major] flagged the initial WireGuard-only gate vs `migration.md`
  (delete-scrub, rename, and callers all clean); fixed by dropping the type gate; round 2 confirmed.
- Verification: `git diff --check`, `tsc -b`, `pnpm test` (650 passed | 1 expected fail | 1 todo),
  `pnpm build`. Domain-only; no `vercel-react` surface, no e2e (canvas ports/edges/connect are A7b).
- A7b (canvas, next): input ports on endpoint nodes (broaden the five outbound-target relations to accept
  `nodeKind: endpoint`), graph edges, connect/disconnect handlers.

### A7b endpoint-outbound-ports — endpoint nodes are first-class outbound targets on canvas (canvas)
Status: implemented 2026-05-28 in `atomic/endpoint-outbound-ports`; merged in PR #48.

- What changed (A7 canvas half; audit endpoint-wireguard P0-2 / _SUMMARY T14): broadened the five
  outbound-target relations (route-final, route-rule, selector, urltest, dns-server-detour) so an endpoint
  node exposes the same input ports an outbound does. Mechanism: a new optional `extraNodeKinds` on
  `PortEndpoint` (matched by `endpointMatchesNode`), set to `["endpoint"]` on those five input endpoints —
  the "broaden existing relations" approach chosen at the A7 checkpoint (vs parallel endpoint relations).
- `graph.ts`: a new `outboundTargetNodeId(tag)` helper resolves route.final / route-rule outbound /
  selector|urltest member / dns-server detour edges to the `endpoint:<tag>` node when the tag is an
  endpoint, instead of a phantom `outbound:<tag>`.
- Connect handlers: the route-final / route-rule / dns-detour / selector-member branches in
  `applyConnection` now accept `inputNode.kind === "endpoint"`, and `connectSelectorCandidate` resolves a
  member tag against endpoints as well as outbounds. `disconnectEdge` is relation-id/path based and already
  endpoint-agnostic. The `detour-target` branch stays outbound-only — out of the approved 5-relation scope.
- Both WireGuard and Tailscale endpoints get the ports (consistent with A7a's namespace decision).
- Codex review: round 1 clean except one minor — endpoint outbound-target input ports were not marked
  connected (`isPortConnected` recognized only `kind === "outbound"`); fixed by broadening the five port
  checks (route, route-rule, selector-group, urltest-group, dns-detour) to also accept `kind === "endpoint"`
  so a wired endpoint reflects its connected state. `vercel-react` (touches `src/state` connect handlers):
  mechanical condition-broadening, no new subscriptions/rerenders/waterfalls.
- Verification: `git diff --check`, `tsc -b`, `pnpm test` (662 passed | 1 expected fail | 1 todo),
  `pnpm build`, `pnpm e2e` (13 passed — canvas connect interaction green).

### A8a canvas-connect-legibility — every advertised "+" chip creates something (W2 dead-chips)
Status: implemented 2026-05-28 in `atomic/canvas-connect-legibility`; merged in PR #49.

- What changed (W2; Pass-2 T8 / Codex C1-9/12/15): graph.ts advertised compatible "+" chips with no
  `createCompatible` branch, so clicking them was a silent no-op. Per the A8 checkpoint decision: the 14
  selector/urltest proxy chips are now IMPLEMENTED — `outboundTypeForChipLabel` (protocols.ts) maps the chip
  label to a creatable outbound type, `createCompatible`'s fallback creates it, and the existing
  outbound-source branch attaches it as a selector/urltest member. The chips needing a heavier creator are
  PRUNED: "WireGuard" (an endpoint, not a creatable outbound), "Tailscale Endpoint" (cert-provider/derp),
  "Shadowsocks Inbound" (ssm-api).
- W2 guardrail flipped `it.fails` -> `it`; sanity test updated (VMess now handled; the three pruned labels
  no longer advertised).
- A8 SPLIT: this is A8a (W2 dead-chips). A8's multi-edge aggregate-port disconnect (C1-7/8/23, still
  `it.todo` in `multi-edge-disconnect.test.tsx`) is a separate sub-atomic. Port-icons-from-relation (T7) was
  already satisfied (getPortSpecs derives the icon from the relation endpoint).
- Codex review: clean (see PR). `vercel-react` (touches `createCompatible` in `src/state`): mechanical
  label->type fallback, no new subscriptions/rerenders.
- Verification: `git diff --check`, `tsc -b`, `pnpm test` (663 passed | 1 todo), `pnpm build`. createCompatible
  is covered behaviorally by the W2 suite; no drag-interaction change beyond it.

### A8-multiedge multi-edge-disconnect — suppress the ambiguous aggregate-port disconnect (canvas)
Status: implemented 2026-05-29 in `atomic/multi-edge-disconnect`; merged in PR #50.

- What changed (C1-7/8/23): `CanvasWorkspace.edgeByPort` maps each port to the FIRST edge only, so the
  per-port disconnect control on a one-to-many ("aggregate") relation port could only ever remove the first
  reference. Declarative fix: `AGGREGATE_RELATION_IDS` (portRelationRegistry) marks the eight writable
  array-valued relations — selector, urltest, route-rule-inbound, route-rule-set, dns-rule-inbound,
  dns-rule-set, service-verify-endpoint, and service-ssm-inbound — and SbcNode suppresses the per-port
  disconnect button on those ports (both input and output ends, via `PortSpec.aggregate`). A specific
  reference is disconnected via the per-edge remove (rendered edges, `onEdgesDelete`) or the Inspector list
  editor (e.g. the selector "Candidates" checklist), which is complete and immune to the
  `MAX_VISUAL_CANDIDATE_EDGES` cap.
- DESIGN (user-approved): the Inspector-backed approach over removing the visual edge cap — the cap exists
  for canvas density/perf, and the Inspector already provides complete per-reference list editing.
- This completes A8 (A8a dead-chips #49 + A8-multiedge).
- Codex review: four cycles. The first two (on an edge-counting, output-only approach) found four majors —
  counting RENDERED (capped) edges, input-side multi-parent ambiguity, the capped-reference orphan, and the
  non-selector aggregate ports — which drove the re-architecture to this declarative, Inspector-backed
  approach. That approach's first review found two more — endpoint members were unremovable from the
  Inspector candidate checklist (A7a updated the domain `getOutboundTags` but not the Inspector's local
  `outboundTags`, so endpoint members read as stale), and two writable one-to-many service relations
  (`service-verify-endpoint`, `service-ssm-inbound`) were missing from the aggregate set — both fixed
  (endpoint-inclusive `outboundTags`; 8-relation aggregate set), then confirmed. `vercel-react`: one
  boolean per port spec, no new subscriptions/rerenders.
- Verification: `git diff --check`, targeted Vitest (51 passed), `tsc -b`, `pnpm test` (666 passed),
  `pnpm build`, `pnpm e2e` (13 passed).

### A8b node-icon-distinctness — one shared type-aware node-icon registry
Status: implemented 2026-05-29 in `atomic/node-icon-distinctness`; merged in PR #52.

- What changed (IC-P1-3 / `ui-icon-set.md` v4): the node card, Palette, chip picker, and Inspector each
  kept a separate icon map, so the same `{kind,type}` drifted (Radio vs RadioTower, Settings vs Server,
  Braces vs Shield) and `getNodeIcon` ignored `type` for every non-outbound kind (all inbounds →
  RadioTower; all dns-server/service → Server). `direct` and `notice` also borrowed the reserved status
  glyphs. New `src/canvas/iconRegistry.tsx` is the single source: `getNodeIcon(kind,type)` honours type
  for every kind. Proxy + DNS-transport protocols render a 2-letter monogram (S5/HT/SS/H2/TU/AT/ST,
  TC/UD/TL/HS/H3/QC); functional modes, hubs, rules, services, settings use distinct Lucide glyphs
  (direct imports). Status glyphs are reserved. SbcNode, ChipPickerPopover, Inspector, and the
  node-creating Palette items all resolve through it (Palette via `paletteNodeRef` reusing the existing
  `protocols.ts` palette-kind→type maps; non-node catalog entries keep their own icon).
- DECISION — v4 preview is authoritative over the `ui-icon-set.md` Lucide-name table: the preview
  finalises proxy/DNS-transport types as **2-letter monograms** (not Lucide glyphs), which is also the
  collision-free answer (the md table's `earth`/`network`/`shield-check` proposals double-booked). Brand
  protocols (wireguard/tor/tailscale) are the only brand-SVG cells; the rest stay Lucide.
- SCOPE SPLIT (don't-mix; recorded as queue rows): **A8b-brands** — brand SVGs deferred pending a
  license/bundle-size review; interim distinct monograms (WG/TO/TS) hold the collision guarantee.
  **A8b-ports** — the v4 port-relation glyph vocabulary (IC-P2-5) is a separate sub-atomic; port icons
  already derive from the referenced kind and stay as-is here. Palette migration was **not** deferred —
  Codex flagged it as outcome-critical to the single-source promise, so it landed in this atomic.
- Frontend perf review (`vercel-react-best-practices`): pure derived-during-render resolution;
  module-level monogram memoization (stable component identity, no remount); no new store subscriptions,
  waterfalls, or bundle deps; direct lucide imports retained; each surface loads fewer icon objects.
- Codex review:
  - Round 1: 1 [P2] — Inspector passed `entityType ?? ""` for settings nodes, but settings entities carry
    no canonical `type` (deriveGraph uses the ref path), so settings/log + settings/experimental headers
    fell back to `cog`. Fixed: Inspector uses `ref.path` for settings.
  - Round 2: 3 findings, all fixed (no round 3 per the 2-round gate): [P2] Palette still rendered its own
    icons → wired through the registry; [P2] settings/ntp + settings/certificate fell to `cog` → mapped to
    clock / file-badge2; [P3] legacy `outbound` type `wireguard` collided with the generic outbound icon →
    mapped to the WireGuard monogram.
  - Deferred to follow-up atomic: A8b-brands (brand SVGs), A8b-ports (port-relation vocab IC-P2-5).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (703 passed | 1 todo), `pnpm build`,
  `pnpm e2e` (13 passed). New `tests/icon-registry.test.tsx` locks the v4 mappings, status-glyph
  reservation, collision guarantee, and the chip-picker + Palette single-source paths.
- Official check: `sing-box-stable/testing check` not run — A8b changes icon rendering, not bundled
  fixture/exported config output.

### A9 validity-readability — readable node validity (warning glyph + ✓N relabel + edge pointer-events)
Status: implemented 2026-05-29 in `atomic/validity-readability`; merged in PR #53.

- What changed (Pass-2 T9/W10 + Codex C2-7): three fixes so validity reads honestly.
  - The node status glyph was a 2-way `error ? CircleAlert : CheckCircle2`, so a `warning` node showed
    the same green checkmark as a valid node. `statusIcon()` is now 3-way (error → CircleAlert, warning →
    TriangleAlert, valid → CheckCircle2), applied to both the summary glyph and the status pill, with a
    `.sbc-node--warning .sbc-node__status` amber (#f2bc4b) color override (previously only error overrode
    the lime default). Status glyphs stay reserved (A8b).
  - The compatible-count affordance reused the valid `CheckCircle2`, reading as a validity claim. It now
    uses `CirclePlus` + an aria-label (`N compatible connections`) and shows the real count (0, not a
    forced 1).
  - C2-7: the edge-remove button was `opacity:0` + `pointer-events:all`, so the invisible 32px control
    intercepted canvas clicks at every edge midpoint. Now `pointer-events:none` until visible (hover) or
    focused.
- Frontend perf review (`vercel-react-best-practices`): one derived `statusIcon` per node computed during
  render; no new subscriptions/waterfalls/bundle deps; the pointer-events change is CSS-only. Pass.
- Codex review:
  - Round 1: 2 [P2] — warning status inherited the lime valid color (only error had an override) →
    added the amber warning override; zero-compatible node displayed `1` via the `|| 1` fallback → show the
    real count. Both fixed.
  - Round 2: clean — no actionable correctness issues.
  - Deferred to follow-up atomic: none.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (705 passed | 1 todo), `pnpm build`,
  `pnpm e2e` (14 passed, incl. the new C2-7 hidden-edge-control interaction test).
- Official check: `sing-box-stable/testing check` not run — A9 changes status iconography + an edge
  control, not bundled fixture/exported config output.

### Phase 1 complete — checkpoint report (2026-05-29)
All Phase-1 structural rows are merged: A1, A2a/A2b, A3, A4a/A4b/A4c, A5, A6a/A6b, A7a/A7b, A8a/A8-multiedge,
A8b, A9 (PRs #37–#53). Deferred-but-tracked sub-atomics remain queued, not dropped: **A2c** (presence
diagnostics + required markers), **A4-rest** (rule-action normalizers C0-3, dns-server type-change deps
C0-8), **A8b-brands** (brand SVGs), **A8b-ports** (port-relation icon vocab IC-P2-5). C2-2 (Inspector
service-type channel filter) and `system_interface` boolean (→ A14) also remain. Next: Phase 2 (A10–A22).
A21/A22 are a hard checkpoint (product decision) — will pause for the user there. Proceeding to A10.
