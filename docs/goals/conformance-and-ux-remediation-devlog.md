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
- [x] A10a — dns-rule `server` settable for `evaluate` (not just route), Inspector half (C0-2) (`dns-rule-server-evaluate`) — PR #55
- [x] A10b — dns-rule `evaluate`/`respond` ordering + response-match diagnostics (C0-4), domain (`dns-rule-ordering-diagnostics`) — PR #56
- [x] A10c — action-aware dns-server canvas port + compatible chip: advertise the server port/chip only for server-bearing actions (claude P0) (`dns-rule-action-aware-port`) — PR #57
- [x] A10d — scrub a stale `server`/`outbound` on import for non-route rule actions (run `normalizeDnsRule`/`normalizeRouteRule` in serialization, not just add/update commands); an imported `{action:"reject",server:"x"}` was invisible on every surface but still exported (A10c review follow-up) — PR #83
  - [ ] A10d-rest — scrub the other action-gated rule fields on import too (reject `method`/`no_drop`, dns-predefined `rcode`, route-options `override_*`, sniff fields); recurse into nested logical rules (A10d review follow-up)
- [x] A11 — rule-set-inline structured editor (MVP: per-rule list + common match fields + JSON escape hatch) (`rule-set-inline-editor`) — PR #58
- [ ] A11-full — full headless-rule editor: all ~25 fields + logical and/or builder (deferred from A11 MVP; reachable today via JSON mode) (`rule-set-inline-editor-full`)
- [x] A12 — rule-set-remote http_client object-form preserved + testing-gated + stable diagnostic (W20/C2-5) (`rule-set-http-client`) — PR #59
- [x] A13 — ccm/ocm single correct (outbound) detour + 1.13 version gate (W21/C1-21/C2-1) (`ccm-ocm-detour`) — PR #60
- [x] A14 — endpoint-tailscale system_interface bool + name/mtu, version-gated (W22/C0-13) (`endpoint-tailscale-system-interface`) — PR #61
- [x] A15 — dns-server-tailscale accept_search_domain toggle (testing-gated) (W23/C1-5) (`dns-server-tailscale-fields`) — PR #62
- [x] A16 — hub-route default_network_type array shape + de-duplicated controls (W24) (`hub-route-network-type`) — PR #63
- [x] A16-norm — normalize a legacy raw-string `default_network_type`/`default_fallback_network_type` → `[string]` on import (in `normalizeConfig`); ~2-day pre-release shape, was stranding silently in the list control (A16 review follow-up) — PR #84
  - [ ] A16-norm-rest — the dial-group siblings `network_type`/`fallback_network_type` on outbounds/endpoints have the same legacy-string→list-control strand (untyped via the index signature, lower risk); coerce those on import too (A16-norm follow-up)
- [x] A17 — inbound-redirect platform banner (Linux + macOS) + de-duplicated (W25) (`inbound-redirect-banner`) — PR #64
- [x] A18 — inbound-vless does not seed tls:{enabled:true} (W26) (`inbound-vless-tls-default`) — PR #65
- [x] A19 — settings-experimental V2Ray build-tag label → `with_v2ray_api` (W27) (`settings-experimental-label`) — PR #66
- [~] A20 — residual node P1 batch, per category (`residual-node-p1-<category>`) — in progress
  - [x] A20-dns — fakeip inet4/inet6_range CIDR-shape validation (W28 dns-server) — PR #67
  - [x] A20-inbound (network de-dup) — add `network` to inboundHandledFields so it isn't rendered twice (W28 inbound) — PR #68
  - [ ] A20-inbound-rest — per-type version-gating + congestion/zero_rtt/auth_timeout + set_system_proxy leak + tun required fields (W28 inbound tail)
  - [x] A20-outbound (ssh port) — ssh server_port optional (defaults to 22), no false-positive error (W28 outbound) — PR #69
  - [ ] A20-outbound-rest — ssh private_key multiline + tor build-tag diag + hysteria server_ports + ss udp_over_tcp⇔multiplex (W28 outbound tail)
  - [x] A20-rule (bypass) — route-rule bypass exposes outbound + route-options (C1-1) — PR #72
  - [ ] A20-rule-rest — geo deprecation + resolve sub-fields + resolve.server ref registry/edge (C1-2) (W28 rule tail)
  - [x] A20-service (ssm-api key) — canvas connect uses a distinct servers path, not a hardcoded `/` (C1-13) — PR #70
  - [ ] A20-service-rest — derp verify-client-endpoint wipe + ssm-api orphan managed on toggle-off (W28 service tail)
  - [x] A20-misc (vless flow-no-TLS C1-10) — downgrade vless-flow-requires-tls error→warning — PR #71
  - [ ] A20-misc-rest — WireGuard peer schema C0-14, certificate-provider required C0-15/C1-14 (W28 cross-node tail)
- [x] A21 — cloudflared testing inbound: full testing support (creatable + Inspector + token/testing diagnostics; stable gated) (C1-22) (`inbound-cloudflared-testing`) — PR #73
- [x] A22 — HTTP Client capability (`http-client-capability`) — diag #74 + create #75
  - [x] A22-diag — dangling http_client reference diagnostic (C1-20): missing-http-client on route.default_http_client / rule_set / certificate_providers — PR #74
  - [x] A22-create — make http_clients[] creatable on testing + editable via shared TLS/HTTP2/Dial (C1-18/19, C2-4) — PR #75
  - [ ] A22-create-fields — add Advanced editing for the http_clients scalar fields engine/version/disable_version_fallback/headers (A22-create review follow-up; created config is valid + round-trips, these just lack a UI control)

### Phase 3 — UX comprehension
- [~] A23 — palette usability (`palette-usability`) — search slice landed
  - [x] A23-search — Add Library search covers Templates (W29) — PR #76
  - [ ] A23-rest — empty first-run state, remove dead "Docs" rows, de-jargon badges, Add-vs-Setup labels (W29 tail)
- [~] A24 — canvas connect/disconnect discoverability + edge legend (`canvas-connect-discoverability`) — legend slice landed
  - [x] A24-legend — desktop edge legend (configured link / animated traffic path / hover-✕ disconnect) (W30) — PR #77
  - [ ] A24-rest — drag affordance, invalid-drop toast, right-click disconnect (W30 tail)
- [~] A25 — mobile build path (`mobile-build-path`) — node-add slice landed
  - [x] A25-add — mobile node-add path: Palette in a bottom sheet via an "Add node" button (W31/T12) — PR #80
  - [ ] A25-rest — touch connect affordance; sheet scroll-trap fix; truly defer the Palette chunk on mobile (W31 tail)
- [~] A26 — import safety + onboarding (`import-safety-and-onboarding`) — import-confirm slice landed
  - [x] A26-confirm — confirm before import overwrites a non-empty config (desktop + mobile) (W32) — PR #79
  - [ ] A26-rest — import undo + success/error feedback toast; empty/first-run onboarding state (W32 tail)
- [x] A27 — template placeholder secrets: `placeholder-secret` warning on REPLACE_ME/change-me outbound/inbound secrets (W33) (`template-placeholder-secrets`) — PR #78
  - [x] A27-rest — extend the placeholder-secret scan to nested users[].password/uuid (review follow-up) — PR #85

### Phase 4 — Polish
- [~] A28 — diagnostics/labels polish (`diagnostics-labels-polish`) — titlebar de-jargon slice landed
  - [x] A28-titlebar — node titlebar reads `Outbound · Shadowsocks` (human label, shared helper, de-dups CanvasWorkspace) (W34) — PR #81
  - [ ] A28-rest — `Selected {id}` raw-id pill, goHome "return to home" mislabel, target glossary tooltip, message-over-code diagnostic hierarchy, mobile diagnostics focus, mobile 36px touch targets, round-trip-fidelity copy (W34 tail)
- [~] A29 — per-node P2 cleanup (`per-node-p2-cleanup`) — subtitle de-genericism slice landed
  - [x] A29-subtitle — inbound + dns-server subtitles carry real info (listen host:port / server host[:port]) instead of repeating the type (W35) — PR #82
  - [ ] A29-rest — icon mismatches, remaining subtitle genericism (route/settings/notice), export empty-string/array noise, deprecation hints, per-node copy accuracy (W35 tail)

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

### 2026-05-29 — Replace the 2-round Codex gate with a single best-suited expert review (from A10)
- **Context:** The 2026-05-28 "Claude + Codex, ≤2 rounds" gate (above) is too slow per atomic — two
  Codex CLI passes plus the round-2 turnaround dominate each atomic's wall-clock. User directive.
- **Decision:** Supersede it. The review gate is now **one pass by the best-suited senior Claude Code
  reviewer subagent** (dispatched via the Agent tool, expertise matched to the atomic — React /
  frontend-performance for `src/components|state` diffs applying `vercel-react-best-practices`;
  domain-correctness vs sing-box upstream for schema/diagnostics/commands; etc.). Fix the actionable
  findings from that one pass, then merge — no second round.
- **Reason:** Keep an independent second-set-of-eyes review on every atomic (and matched to the change's
  domain, which a generic gate is not) while removing the round-2 latency. A finding that shows the
  atomic's outcome is not met is still a failed step (fix or Stop Condition), not a deferral; non-blocking
  findings still become follow-up atomics.
- **Placement:** Goal-scoped — execution-plan Non-Negotiables + atomic-loop step 6 only. AGENTS.md stays
  model/tool-neutral about review (it never named Codex), so the repo-wide guide is unchanged.
- **How to apply:** From **A10** onward (A0–A9 already landed under the old Codex gate). Per atomic:
  local checks → one expert-review subagent pass (fix actionable findings) → squash PR → issue gates.
  Record the reviewer used + findings + dispositions in the milestone note. Honors [[pr-over-commits]];
  supersedes [[codex-review-gate]].
- **Affects:** every atomic's review/merge step from A10.

### 2026-05-29 — Split A10 into A10a (Inspector) + A10b (diagnostics) + A10c (canvas port)
- **Context:** A10 (`dns-rule-server-and-ordering`, W18 / C0-2, C0-4) spans three don't-mix buckets:
  Inspector server-gating (component), evaluate/respond ordering (domain diagnostics), and an
  action-aware dns-server port (canvas/port-registry structural change).
- **Decision:** Split — **A10a** Inspector server settable for `evaluate` (C0-2); **A10b** evaluate/
  respond ordering + response-match diagnostics (C0-4, domain-only); **A10c** action-aware dns-server
  canvas port (the port registry ignores action today — broader structural change).
- **Reason:** Same component-vs-domain-vs-canvas boundary the program split A2/A4/A8 on; keeps each
  atomic one-outcome and within the size budget.
- **Note:** C0-1 (required-server diagnostic for route/evaluate) stays with A2c per the A2a split, but
  A10b is its natural home and may absorb it — decide at A10b implementation time.
- **Affects:** A10 (now A10a + A10b + A10c).

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
- Expert review (one pass; A0–A9 used the legacy 2-round Codex gate):
  - Reviewer: <which senior subagent + why it fit this atomic>.
  - Findings → dispositions: <fixed … | clean>.
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

### A10a dns-rule-server-evaluate — DNS rule server settable for evaluate (Inspector, C0-2)
Status: implemented 2026-05-29 in `atomic/dns-rule-server-evaluate`; merged in PR #55.
First atomic under the new one-pass expert-review gate.

- What changed (C0-2): sing-box requires `server` for both `route` and `evaluate` DNS-rule actions
  (`dns/rule_action.md:37-41`, `:110-114`); the domain model + canvas edge already allowed evaluate,
  but the Inspector gated the Server `<select>` to `route` only and its action-change handler wiped
  `server` for every non-route action — so evaluate could never carry a server through the UI and
  route→evaluate silently dropped it. Fix: gate the Server control and the action-change scrub on the
  exported `dnsRuleAllowsServer` helper (single source of truth), so server shows/persists for
  route+evaluate and clears only for genuinely server-less actions.
- Frontend perf review (`vercel-react-best-practices`): render-time predicate + existing patch handler;
  no new subscriptions/waterfalls/bundle deps. Pass.
- Expert review (one pass): a senior frontend + sing-box-correctness reviewer subagent — chosen because
  the change is an Inspector gate with upstream-conformance implications. Verdict APPROVE. Confirmed
  `{route,evaluate}` is the complete server-bearing set vs upstream, the scrub logic is correct, and no
  regression (graph edge `graph.ts:794`, drag-connect guards, and `normalizeDnsRule` already treat
  evaluate as server-bearing). Two NITs applied this pass: reuse `dnsRuleAllowsServer` instead of two
  inline lists; add tests for Server-hidden-on-reject and the evaluate→route direction.
  - Deferred to follow-up atomic: A10b (ordering diagnostics C0-4), A10c (action-aware canvas port).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (708 passed | 1 todo), `pnpm build`.
  No e2e — Inspector form-gating, covered by component tests (`tests/dns-rule-server.test.tsx`).
- Official check: `sing-box-stable/testing check` not run — A10a changes Inspector field gating, not
  bundled fixture/exported config output.

### A10b dns-rule-ordering-diagnostics — evaluate/respond ordering (domain, C0-4)
Status: implemented 2026-05-29 in `atomic/dns-rule-ordering-diagnostics`; merged in PR #56.

- What changed (C0-4): a single ordered pass over `dns.rules[]` now flags the two upstream ordering
  preconditions SBC ignored (`dns/rule_action.md`): `action:"respond"` with no preceding top-level
  `evaluate` (`dns-rule-respond-without-evaluate`), and response matching — `match_response` OR any
  Response Match Field (`response_rcode/answer/ns/extra`) — with no preceding top-level `evaluate`
  (`dns-rule-match-response-without-evaluate`). A `precedingTopLevelEvaluate` flag is read for each
  rule's checks and flipped true only AFTER them, so a rule's own evaluate never satisfies its own
  precondition (matching runs before the action). Both errors are version-gated to `atLeast(version,
  "1.14")`.
- Frontend perf review: n/a — domain-only (`src/domain/diagnostics.ts`).
- Expert review (one pass): a senior sing-box domain-correctness reviewer subagent — chosen because this
  is a pure diagnostics/semantics change where false positives are the main risk. Verdict APPROVE.
  Confirmed top-level-only scoping is correct (logical sub-rules can't carry `evaluate`), the
  read-before-flip logic is sound, and no bundled template/fixture trips a false positive (TESTING_114
  + the external 1.14 fixture order evaluate immediately before respond/match_response). Two SHOULD-FIX
  applied this pass: gate the errors to 1.14 (avoid stable-channel double-reporting with the existing
  testing-only warning); extend the trigger to Response Match Fields per C0-4's "and response fields",
  not just `match_response`.
  - Deferred to follow-up atomic: A10c (action-aware canvas port). C0-1 required-server diagnostic
    still with A2c.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (715 passed | 1 todo), `pnpm build`.
- Official check: `sing-box-stable/testing check` not run — A10b adds semantic diagnostics, not bundled
  fixture/exported config output.

### A10c dns-rule-action-aware-port — dns-server port + chip gated by action (canvas)
Status: implemented 2026-05-29 in `atomic/dns-rule-action-aware-port`; merged in PR #57. Completes A10.

- What changed (claude P0): the dns-rule "DNS server" output port and the "DNS Server" compatible chip
  were advertised for every action, though the graph edge only emits for server-bearing actions — so a
  reject/respond/predefined/route-options rule showed a clickable server port that could never make a
  valid edge (and dragging it wrote a no-op `server`). `getPortSpecs` gained an optional `action` and
  drops the dns-rule `dns-server` output port when `!dnsRuleAllowsServer({action})`; `SbcNodeData.action`
  is threaded through SbcNode (+ portKeys memo dep) and the dns-rule node; the hardcoded
  `compatible: ["DNS Server"]` chip is gated the same way. `action` undefined keeps all ports
  (action-agnostic callers + the existing port test unchanged). All four dns-rule server surfaces
  (Inspector, port, chip, edge) now key off the one `dnsRuleAllowsServer` helper.
- Frontend perf review (`vercel-react-best-practices`): `getPortSpecs` stays pure; one added memo dep
  (`data.action`); no new subscriptions/waterfalls/bundle deps. Pass.
- Expert review (one pass): a senior React-canvas + sing-box-correctness reviewer subagent — chosen for
  the canvas-port + domain-consistency surface. Verdict APPROVE, no blockers. Confirmed all three
  canvas surfaces (edge, port, isPortConnected) agree for every action incl. the stale-server case (no
  orphan edge/port), connect/disconnect handlers already early-return on `!dnsRuleAllowsServer`, and the
  undefined-action keep-all is correct for every caller. Applied the one NIT this pass: collapse the
  last inlined edge-gate predicate to `dnsRuleAllowsServer(rule)`.
  - Deferred to follow-up atomic: A10d — imported stale `server` on a non-server action is now invisible
    on every surface but still exported; scrub it via `normalizeDnsRule` in serialization (out of scope
    for a port-visibility atomic).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (718 passed | 1 todo), `pnpm build`,
  `pnpm e2e` (14 passed).
- Official check: `sing-box-stable/testing check` not run — A10c changes canvas port/chip rendering, not
  bundled fixture/exported config output.

### A11 rule-set-inline-editor — structured editor for inline rules[] (Inspector, W19)
Status: implemented 2026-05-29 in `atomic/rule-set-inline-editor`; merged in PR #58.

- What changed (W19): the inline rule-set `rules[]` — the only required inline payload — was editable
  only as one raw JSON textarea. `InlineRuleSetEditor` now defaults to a structured per-rule list:
  add/remove/reorder rules; structured inputs for the common headless match fields (domain,
  domain_suffix, domain_keyword, domain_regex, ip_cidr, source_ip_cidr, port [numeric], network,
  process_name) + an invert checkbox; a per-rule patch-merge that preserves non-surfaced keys (logical/
  exotic rules are never clobbered — a logical rule shows a hint and is edited in JSON mode); and a
  parse-safe "Edit rules as JSON" escape hatch (`InlineRulesJsonField`). The component is shared by the
  inline rule-set inspector AND the route/dns-rule logical sub-rule groups, so all three gained it.
- DECISION (user-approved MVP scope): ship the common-field structured list + JSON fallback, not all
  ~25 headless fields or a visual and/or builder. The full editor is queued as **A11-full**; everything
  it would cover stays reachable via JSON mode, so there is no regression vs the old all-JSON editor.
- Frontend perf review (`vercel-react-best-practices`): local `mode` state; pure list transforms on
  edit; reuses `listishToText`/`textToRuleList`; no new store subscriptions/waterfalls/bundle deps.
- Expert review (one pass): a senior React/frontend + sing-box reviewer subagent. Verdict CHANGES
  REQUESTED → fixed this pass. 1 BLOCKER: the editor's local `mode`/JSON-draft leaked across entities
  (reconciled not remounted) — keyed it by entity identity at all three call sites (the A3 JsonField
  precedent). 1 SHOULD-FIX: a numeric field given all-non-numeric text stored `[]` — `textToRuleList`
  now clears it. Verified clean: clear-field key removal, no sibling mutation, logical round-trip
  preserved, port number[] parsing, JSON parse-safety, index-key acceptable (controlled inputs).
  - Deferred to follow-up atomic: A11-full (complete headless-rule editor).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (725 passed | 1 todo), `pnpm build`,
  `pnpm e2e` (14 passed).
- Official check: `sing-box-stable/testing check` not run — A11 changes the inline-rules Inspector
  editor, not bundled fixture/exported config output.

### A12 rule-set-http-client — preserve inline-object http_client + testing-gate (Inspector + domain, W20/C2-5)
Status: implemented 2026-05-29 in `atomic/rule-set-http-client`; merged in PR #59.

- What changed (W20/C2-5): a remote rule-set `http_client` may be a tag string OR an inline object
  (shared/http-client.md). The shared tag `<select>` rendered an object as "None" and wrote a bare
  string on any change — silently destroying the object. `SharedFieldControl` now renders the
  parse-safe `JsonField` whenever a select-kind shared field holds a non-null object, preserving and
  keeping the object editable (and convertible back to a tag); only http_client/default_http_client/
  domain_resolver are ever objects, so other selects are unaffected (this also fixes the same latent
  clobber for object `domain_resolver`). `http_client` is gated to the testing channel for remote
  rule-sets (was unconditional), matching the route `default_http_client` gating; and a
  `rule-set-http-client-testing-only` stable warning was added so an imported stable config carrying
  `http_client` is surfaced, not silently invisible.
- Frontend perf review (`vercel-react-best-practices`): reuses the existing parse-safe JsonField; no
  new subscriptions/waterfalls/bundle deps. Pass.
- Expert review (one pass): a senior React + sing-box-correctness reviewer subagent. Verdict APPROVE,
  no blockers. Verified the generic object-branch is safe for all 16 select shared fields (and is a
  latent fix for `domain_resolver`), JsonField empty-input emits `undefined` (clean key removal, no
  stray `null`), and the gating matches upstream (rule-set `http_client` is 1.14-only). Applied the
  recommended follow-up this pass: the stable diagnostic (closes the silent gap the gating opened) +
  generalized the code comment.
  - Deferred to follow-up atomic: `download_detour`↔`http_client` migration affordance + a
    missing-`http_client`-tag reference diagnostic (W20 tail / A28).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (730 passed | 1 todo), `pnpm build`.
- Official check: `sing-box-stable/testing check` not run — A12 changes Inspector field rendering +
  diagnostics, not bundled fixture/exported config output.

### A13 ccm-ocm-detour — single correct (outbound) detour + 1.13 gate (Inspector + domain, W21/C1-21/C2-1)
Status: implemented 2026-05-29 in `atomic/ccm-ocm-detour`; merged in PR #60.

- What changed (W21/C1-21/C2-1): ccm/ocm redefine `detour` as an OUTBOUND tag (the Claude/OpenAI API
  target, edited by the dedicated "API Detour" control), but they are in `serviceListenTypes`, so they
  also got the shared Listen group's "Inbound Detour" select — which writes the SAME `/services/*/detour`
  key with an inbound tag, silently stomping the outbound detour. The listen group now omits "Inbound
  Detour" for ccm/ocm (other listen services keep it — derp/resolved/ssm-api/hysteria-realm genuinely use
  an inbound detour per upstream). Added `service-ccm-ocm-version` (error) when a ccm/ocm service is
  present and version < 1.13 (ccm/ocm are "Since 1.13.0"); fires only on the 1.12 target, not default
  stable 1.13 / testing 1.14.
- Frontend perf review (`vercel-react-best-practices`): a render-time conditional in the shared field
  list; no new subscriptions/waterfalls/bundle deps. Pass.
- Expert review (one pass): a senior sing-box + React reviewer subagent. Verdict APPROVE, no blockers,
  no follow-ups. Confirmed `detour` is outbound-only for ccm AND ocm and inbound for the other listen
  services (so the targeted omission is exactly right), no value-stranding (the API Detour control can
  clear/repoint), 1.13 is the correct floor for both, `error` severity matches the type-level-rejection
  pattern, and no false positive on the bundled `fixtures/stable/service-ocm-ccm.json` (validated at the
  default 1.13).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (734 passed | 1 todo), `pnpm build`.
- Official check: `sing-box-stable/testing check` not run — A13 changes Inspector field gating +
  a diagnostic; the bundled ccm/ocm fixture is unchanged and still validates.

### A14 endpoint-tailscale-system-interface — system_interface boolean + name/mtu (Inspector + domain, W22/C0-13)
Status: implemented 2026-05-29 in `atomic/endpoint-tailscale-system-interface`; merged in PR #61.

- What changed (W22/C0-13): upstream models the tailscale endpoint `system_interface` as a BOOLEAN
  ("create a system TUN interface"), with the custom name in `system_interface_name` (string) and MTU
  in `system_interface_mtu` (number) — all 1.13+. SBC rendered `system_interface` as a text input
  (placeholder "tailscale0", really the name field) and stored a string into the boolean; name and mtu
  were unreachable; and the A5-deferred diagnostic predicate keyed on `typeof === "string"`, so it never
  fired for the real boolean. Now: `system_interface` is a checkbox; `system_interface_name` (text) +
  `system_interface_mtu` (number, finite-guarded) added; all three in `endpointHandledFields`; the
  `endpoint-tailscale-system-interface-1-13-only` warning fires on bool-true / name / mtu for version <
  1.13 (not on `system_interface:false`).
- Frontend perf review (`vercel-react-best-practices`): three render-time controls; no new
  subscriptions/waterfalls/bundle deps. Pass.
- Expert review (one pass): a senior sing-box + React reviewer subagent. Verdict APPROVE, no blockers.
  Confirmed the bool/string/number mapping vs upstream, the scaffold (`system_interface:false`) round-
  trips and doesn't trip the gate on default stable 1.13, uncheck→undefined matches the codebase
  convention, and severity (warning) matches the sibling advertise_tags gate. Applied the one SHOULD-FIX
  this pass: guard the MTU input with `Number.isFinite` (it was the only numeric field missing it, NaN
  would export as null). Left the `mtu:0`-flagged NIT as-is (the field key itself is 1.13+; reviewer
  concurred). Migrated 2 domain.test + 1 app.test case off the old string model.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (739 passed | 1 todo), `pnpm build`.
- Official check: `sing-box-stable/testing check` not run — A14 changes Inspector field controls + a
  diagnostic, not bundled fixture/exported config output.

### A15 dns-server-tailscale-fields — accept_search_domain toggle (Inspector, W23/C1-5)
Status: implemented 2026-05-29 in `atomic/dns-server-tailscale-fields`; merged in PR #62.

- What changed (W23/C1-5 P0): the dns-server `tailscale` `accept_search_domain` field (bool, sing-box
  1.14.0) had no first-class control and was never seeded, so a testing-channel user couldn't enable the
  one new field of the 1.14 doc revision. Added a testing-gated "Accept search domain (since sing-box
  1.14.0)" toggle next to accept_default_resolvers, and added `accept_search_domain` to
  `dnsServerHandledFields`. Re-verified the rest of W23 is already satisfied on HEAD: the endpoint select
  is type-gated to tailscale (C1-5) and the spurious dns-server detour port for tailscale was already
  removed (locked by `tests/sbc-node-ports.test.ts`).
- Frontend perf review (`vercel-react-best-practices`): one render-time gated toggle; no new
  subscriptions/waterfalls/bundle deps. Pass.
- Expert review (one pass): a senior sing-box + React reviewer subagent. Verdict APPROVE. Confirmed
  upstream (bool/1.14), channel-in-scope, uncheck→undefined convention, and the re-verification claims.
  Applied the one SHOULD-FIX in-pass (a gap this atomic introduced): adding the field to
  `dnsServerHandledFields` unconditionally hid an imported stable value from BOTH the testing-only toggle
  AND the Advanced fallback — so the handled set is now channel-gated (stable drops the field → it stays
  removable via Advanced).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (742 passed | 1 todo), `pnpm build`.
- Official check: `sing-box-stable/testing check` not run — A15 changes an Inspector toggle, not bundled
  fixture/exported config output.

### A16 hub-route-network-type — de-duplicate default_network_* + array shape (Inspector + types, W24)
Status: implemented 2026-05-29 in `atomic/hub-route-network-type`; merged in PR #63.

- What changed (W24): the route hub rendered `default_network_strategy` (select) and
  `default_network_type` TWICE — a hardcoded block plus the shared Dial-group controls. The hardcoded
  `default_network_type` was a text input writing a raw STRING into a `string[]` field (invalid JSON),
  and the hardcoded strategy select wrongly mixed network_type values (wifi/cellular/ethernet) into the
  strategy enum. Removed both hardcoded controls; the Dial-group controls (strategy select with the
  correct `default|hybrid|fallback` enum + a `list`→string[] type control) are the single source.
  `RouteConfig.default_network_type` is now `string[]` (+ added `default_fallback_network_type: string[]`
  and `default_fallback_delay: string`, previously only in the index signature).
- Frontend perf review (`vercel-react-best-practices`): removes two controls; no new
  subscriptions/waterfalls/bundle deps. Pass.
- Expert review (one pass): a senior React + sing-box reviewer subagent. Verdict APPROVE, no blockers.
  Confirmed the Dial group renders these on all channels (not channel-gated), the list writes string[],
  the kept strategy enum is the CORRECT upstream set (the removed hardcoded one was a latent bug), the
  type additions match upstream, and the dropped "(1.13+)" label was inaccurate (these are 1.11+ fields)
  so no real version signal was lost.
  - Deferred to follow-up atomic: A16-norm — a legacy raw-string `default_network_type` (the ~2-day
    pre-release buggy shape, ≈no real configs) strands silently in the list control; one-time import
    normalization or a string-tolerant list read path.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (744 passed | 1 todo), `pnpm build`.
- Official check: `sing-box-stable/testing check` not run — A16 removes duplicate Inspector controls +
  a type, not bundled fixture/exported config output.

### A17 inbound-redirect-banner — correct + de-duplicated platform banner (Inspector + Palette, W25)
Status: implemented 2026-05-29 in `atomic/inbound-redirect-banner`; merged in PR #64.

- What changed (W25): the redirect inbound rendered TWO platform banners, both wrongly stating "Linux
  only". Upstream: redirect is supported on **Linux and macOS** (Linux iptables REDIRECT / macOS pf);
  only tproxy is Linux-only. Fixed the dedicated redirect banner copy and deleted the duplicate
  `tproxy || redirect` "Linux-only inbound" banner (it double-stated tproxy and was wrong for redirect).
  Both nodes now show exactly one platform banner. Palette label "Redirect (Linux only)" →
  "Redirect (Linux / macOS)".
- Frontend perf review (`vercel-react-best-practices`): removes a banner + copy change; no new
  subscriptions/waterfalls/bundle deps. Pass.
- Expert review (one pass): a senior sing-box + React reviewer subagent. Verdict APPROVE, no blockers.
  Verified the load-bearing upstream facts (redirect.md "Only supported on Linux and macOS"; tproxy.md
  "Only supported on Linux"), exactly-one-banner-each after the de-dup, no collateral deletion (tproxy
  network enum intact), and no stale references. The optional platform-constraint diagnostic is correctly
  out of W25's banner scope (runtime, not config-validity, constraint).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (746 passed | 1 todo), `pnpm build`.
- Official check: `sing-box-stable/testing check` not run — A17 changes banner copy + a Palette label,
  not bundled fixture/exported config output.

### A18 inbound-vless-tls-default — VLESS inbound TLS is optional (domain, W26)
Status: implemented 2026-05-29 in `atomic/inbound-vless-tls-default`; merged in PR #65.

- What changed (W26): VLESS TLS is optional upstream (inbound/vless.md — `tls` has no `==Required==`
  marker), but the scaffold seeded `tls: { enabled: true, server_name: "" }`, forcing a server-cert
  setup on every new VLESS inbound. Dropped the tls seed from the VLESS inbound scaffold. Scope is
  inbound-only (per W26): the VLESS outbound keeps its TLS-on client default (connecting to a TLS server
  is the common client case, and `tlsRequiredOutboundTypes` doesn't enforce it for vless either way).
- Frontend perf review: n/a — domain-only scaffold change.
- Expert review (one pass): a senior sing-box domain-correctness reviewer subagent. Verdict APPROVE, no
  blockers. Confirmed vless inbound tls is optional upstream (vs tuic/hysteria* which are Required), the
  scaffold/diagnostic lists are aligned (`tlsRequiredInboundTypes` excludes vless, so nothing fires), a
  fresh VLESS inbound is valid + round-trips losslessly, and the inbound/outbound asymmetry is
  internally consistent. Two NITs were pre-existing/out-of-scope (a stale test comment; a doc-marker
  reconciliation for trojan/naive/anytls).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (748 passed | 1 todo), `pnpm build`.
- Official check: `sing-box-stable/testing check` not run — A18 changes a domain scaffold; the full
  suite (incl. fixture round-trips) stays green.

### A19 settings-experimental-label — correct V2Ray API build-tag (Inspector copy, W27)
Status: implemented 2026-05-29 in `atomic/settings-experimental-label`; merged in PR #66.

- What changed (W27): the V2Ray API build-tag banner told users to compile sing-box "with the
  `v2rayapi` tag", but the upstream build tag is `with_v2ray_api`
  (installation/build-from-source.md:57) — following the wrong copy yields a binary that still lacks
  V2Ray API. Fixed the banner text.
- Frontend perf review: n/a — banner copy only.
- Expert review (one pass): a reviewer subagent. Verdict APPROVE, no blockers. Verified the upstream tag
  is `with_v2ray_api` (both channels), no other stale `v2rayapi` copy exists, and the other build-tag
  banners (tor/tailscale/derp; clash_api correctly has none since `with_clash_api` is default-on) name
  correct tags.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (749 passed | 1 todo), `pnpm build`.
- Official check: `sing-box-stable/testing check` not run — A19 is a banner copy change.

### A20-dns residual-dns-server-cidr — fakeip CIDR-shape validation (domain, W28 dns-server)
Status: implemented 2026-05-29 in `atomic/residual-dns-server-cidr`; merged in PR #67. First slice of the
per-category A20 batch.

- What changed (W28 dns-server): the fakeip DNS server wrote inet4_range/inet6_range as raw strings;
  diagnostics only checked presence. A malformed CIDR / out-of-range octet-or-prefix / wrong IP family
  (IPv6 in the v4 field) was accepted and exported, and sing-box rejects it at start with no UI signal.
  Added pragmatic `isIpv4Cidr`/`isIpv6Cidr` validators + error `dns-server-fakeip-range-invalid` on
  `/dns/servers/{i}/inet4_range` and `/inet6_range`, disjoint from the existing range-missing error.
- Frontend perf review: n/a — domain-only.
- Expert review (one pass): a reviewer subagent. Verdict APPROVE, no blockers. Confirmed the validators
  accept all genuinely-valid forms and the bundled fakeip ranges, the missing/invalid errors are
  structurally disjoint, and the v6 validator errs toward leniency (never false-positives a real fakeip
  pool — the only over-strict case, embedded-IPv4 v6, is irrelevant to a synthetic FakeIP range).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (754 passed | 1 todo), `pnpm build`.
- Official check: `sing-box-stable/testing check` not run — adds a semantic diagnostic, not bundled
  fixture/exported config output. Remaining A20 categories (inbound/outbound/rule/service/misc) queued.

### A20-inbound residual-inbound-network-dedup — de-duplicate the network control (Inspector, W28 inbound)
Status: implemented 2026-05-29 in `atomic/residual-inbound-network-dedup`; merged in PR #68.

- What changed (W28 inbound): `network` rendered TWICE for tproxy/direct (and naive/shadowsocks) — the
  dedicated tcp/udp select PLUS the Advanced-fields fallback, because `"network"` was missing from
  `inboundHandledFields`. Added it so the dedicated selects are the single source. The reviewer confirmed
  all four inbound types that have a `network` field (tproxy/direct/naive/shadowsocks) have a dedicated
  select, so none loses its editor.
- Frontend perf review: n/a — removes a duplicate control.
- Expert review (one pass): a reviewer subagent. Verdict APPROVE, no findings. Verified coverage (4
  dedicated selects), single-source semantics, red-then-green test, no regression.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (756 passed | 1 todo), `pnpm build`.
- Official check: n/a — Inspector de-dup. Remaining inbound W28 items (version-gating, set_system_proxy
  leak, tun required fields) are queued as A20-inbound-rest.

### A20-outbound residual-outbound-ssh-port — ssh server_port optional (domain, W28 outbound)
Status: implemented 2026-05-29 in `atomic/residual-outbound-ssh-port`; merged in PR #69.

- What changed (W28 outbound): SSH defaults server_port to 22 when empty (ssh.md), so it is optional —
  but the mandatory-port check treated ssh like every other proxy type and raised a spurious BLOCKING
  `outbound-invalid-server-port` error when the port was cleared, flipping the canvas node to error on a
  legal config. For ssh, an absent port is now legal; only a present-but-out-of-range value is flagged.
- Frontend perf review: n/a — domain-only.
- Expert review (one pass): a reviewer subagent. Verdict APPROVE, no blockers. Confirmed upstream (ssh
  "22 if empty"), the ternary handles all cases (incl. string port still flagged), server still required,
  and ssh is the SOLE default-port proxy type (all others are `==Required==`, so no analogous bug).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (759 passed | 1 todo), `pnpm build`.
- Official check: n/a — semantic diagnostic. Remaining outbound W28 items queued as A20-outbound-rest.

### A20-service residual-service-ssm-key — ssm-api connect distinct path (state, C1-13)
Status: implemented 2026-05-29 in `atomic/residual-service-ssm-key`; merged in PR #70.

- What changed (W28 service / C1-13): connecting a shadowsocks inbound to an SSM-API service on the
  canvas hardcoded `servers["/"]`, so wiring a SECOND inbound silently overwrote the first's root
  mapping. `servers` is a path→inbound map needing distinct paths. Added `uniqueServerPath` ("/" if free,
  else "/<tag>" suffixed) and used it in both the drag-connect handler and the inbound-side toggle path;
  reuses the existing entry if the inbound is already mapped (no duplicate on reconnect).
- Frontend perf review (`vercel-react-best-practices`): connect-handler logic only; no new
  subscriptions/waterfalls/bundle deps. Pass.
- Expert review (one pass): a reviewer subagent. Verdict APPROVE, no blockers. Confirmed the bug was real,
  the fix is correct (first→"/", second→distinct, reconnect→no-op), "/<tag>" is a valid SSM path, no
  infinite loop, and the disconnect side is already path-aware (per-edge remove encodes the path).
  Applied the reviewer's NIT in-pass: the sibling inbound-side toggle path (line ~1439) had the same
  hardcoded-"/" clobber risk → now uses `uniqueServerPath` too.
  - Deferred to follow-up atomic: A20-service-rest (derp verify-client-endpoint wipe, ssm-api orphan
    managed on toggle-off).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (761 passed | 1 todo), `pnpm build`,
  `pnpm e2e` (port-click 7 passed).
- Official check: n/a — canvas connect-handler logic, not bundled fixture/exported config output.

### A20-misc residual-vless-flow-tls — vless flow-no-TLS is a warning (domain, C1-10)
Status: implemented 2026-05-29 in `atomic/residual-vless-flow-tls`; merged in PR #71.

- What changed (W28 cross-node / C1-10): SBC raised `vless-flow-requires-tls` as an ERROR for
  flow=xtls-rprx-vision without tls.enabled, but sing-box accepts that at check-time (it just won't
  function), so the error wrongly blocked export and flipped the node to error on a config the binary
  accepts. Downgraded to a warning (keeps the guidance; Reality counts as TLS since reality requires
  tls.enabled). The flow⇔multiplex mutual exclusion stays a hard error.
- Frontend perf review: n/a — domain-only.
- Expert review (one pass): a reviewer subagent. Verdict APPROVE, no blockers. Adjudicated the Codex (C1-10)
  vs pass-2 divergence against upstream: sing-box does NOT reject flow-without-tls (no "refuse to start"
  basis, unlike the genuinely-TLS-required protocols), so the blocking error was a false positive →
  downgrade is correct. Reality coverage confirmed, multiplex error preserved, no regression.
  - Deferred to follow-up atomic: A20-misc-rest (WireGuard peer schema C0-14, certificate-provider
    required C0-15/C1-14); inbound users[].flow checks (out of C1-10's outbound scope).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (763 passed | 1 todo), `pnpm build`.
- Official check: n/a — semantic diagnostic severity change.

### A20-rule residual-rule-bypass-options — bypass exposes outbound + route-options (Inspector, C1-1)
Status: implemented 2026-05-29 in `atomic/residual-rule-bypass-options`; merged in PR #72.

- What changed (W28 rule / C1-1): the route-rule `bypass` action supports an optional `outbound` and
  route-options fields (rule_action.md), but the Inspector only exposed Outbound for `route` and
  route-options for `route`/`route-options`. The Outbound select now gates on `routeRuleAllowsOutbound`
  (route + bypass + default) and route-options renders for route/route-options/bypass — so a bypass rule
  can set both. The Inspector now matches the canvas (which already gates the outbound edge on
  `routeRuleAllowsOutbound`).
- Frontend perf review (`vercel-react-best-practices`): render-time gate predicates; no new
  subscriptions/waterfalls/bundle deps. Pass.
- Expert review (one pass): a reviewer subagent. Verdict APPROVE, no findings. Confirmed upstream bypass
  supports outbound + route-options, the default-action route-options now-showing is correct (default IS
  route), no behavior loss for route/default, the action-change handler preserves outbound for bypass,
  and the Inspector/canvas are now consistent.
  - Deferred to follow-up atomic: A20-rule-rest (geo deprecation, resolve sub-fields, resolve.server ref
    registry/edge C1-2).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (766 passed | 1 todo), `pnpm build`.
- Official check: n/a — Inspector control gating.

This completes the A20 per-category representative slices (dns/inbound/outbound/rule/service/misc); the
`*-rest` tails remain queued as P1/P2 follow-ups.

### A21 inbound-cloudflared-testing — full testing support for the cloudflared inbound (C1-22)
Status: implemented 2026-05-29 in `atomic/inbound-cloudflared-testing`; merged in PR #73. Resolves the
former A21 hard checkpoint per the user's decision: fully support the testing target now; stable gated.

- What changed (C1-22): the cloudflared inbound (embedded Cloudflare Tunnel client, sing-box 1.14+) was
  Palette-listed but not creatable, with no Inspector or diagnostics. Wired end-to-end:
  CREATABLE_INBOUND_TYPES + a `{type,tag,token:""}` scaffold; Palette creatable on testing / gated on
  stable (itemStatus channel gate mirroring service-hysteria-realm); an Inspector branch
  (token[sensitive,Required], ha_connections, protocol quic/http2, post_quantum, region, grace_period;
  added to inboundHandledFields); diagnostics `inbound-cloudflared-token-missing` (error) +
  `inbound-cloudflared-testing-only` (warning when version < 1.14). control_dialer/tunnel_dialer detour
  refs already cascade via A6a.
- Frontend perf review (`vercel-react-best-practices`): a render-time inbound branch + finite-guarded
  number input; no new subscriptions/waterfalls/bundle deps. Pass.
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, no blockers. Verified upstream
  fidelity (token the sole Required field, correct field types, 1.14+), a created node is valid on testing
  with no spurious errors (not in tls/users/listen-required sets), Palette/create wiring complete,
  canvas/cascade fine, and the handledFields additions hide nothing on other inbound types (cloudflared
  is the only inbound with those top-level keys). NIT: edge_ip_version/datagram_version omitted (fall to
  Advanced) — acceptable.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (773 passed | 1 todo), `pnpm build`,
  `pnpm e2e` (editor 3 passed).
- Official check: `sing-box-testing check` not run in this env, but a created cloudflared inbound matches
  the upstream schema (token required); no bundled fixture changed.

### A22-diag http-client-missing-ref — dangling http_client reference diagnostic (domain, C1-20)
Status: implemented 2026-05-29 in `atomic/http-client-missing-ref`; merged in PR #74. First slice of A22.

- What changed (C1-20): a string `http_client` reference must point to an existing top-level
  http_clients[] tag, but SBC had no missing-reference check — a dangling ref exported silently.
  Added `getHttpClientTags(config)` + error `missing-http-client` on the three string-ref sites the
  referenceRegistry already tracks: route.default_http_client, route.rule_set[].http_client, and
  certificate_providers[].http_client. Inline object-form (no tag) is skipped.
- Frontend perf review: n/a — domain-only.
- Expert review (one pass): a reviewer subagent. Verdict APPROVE, no blockers. Confirmed scope vs upstream,
  object-vs-string gating, no false positives (bundled template's http_client:"default" resolves),
  channel-agnostic error severity is right (a dangling ref is invalid on any channel; co-located
  testing-only warning is orthogonal). Applied the reviewer's follow-up in-pass: added the third
  certificate_providers site + the Array-guard NIT.
  - Deferred to follow-up atomic: A22-create (make http_clients[] creatable + Inspector branch + Palette
    gating, C1-18/19, C2-4).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (778 passed | 1 todo), `pnpm build`.
- Official check: n/a — semantic diagnostic.

### A22-create http-client-create — http_clients[] creatable + editable on testing (C1-18/19, C2-4)
Status: implemented 2026-05-29 in `atomic/http-client-create`; merged in PR #75. Completes A22 (with #74).

- What changed: the top-level http_clients[] node had a canvas node + update/rename + reference cascade
  but was not creatable and had no editor surface. Per the resolved A22 decision (fully support testing;
  stable gated): `addHttpClient` command; `createFromPalette` creates + selects one on testing only;
  Palette status setup + itemStatus channel gate (creatable on testing / gated on stable);
  `sharedGroupsForEntity` gives an http-client entity its shared TLS / HTTP2 / Dial cards;
  shared/http-client.md is now a writable doc with smoke coverage.
- Frontend perf review (`vercel-react-best-practices`): reuses the shared-group + add-command machinery;
  no new subscriptions/waterfalls/bundle deps. Pass.
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, no blockers. Verified a bare
  `{tag}` is a valid http_clients entry (all object fields optional) with zero spurious diagnostics on
  testing, channel gating is defense-in-depth (itemStatus + createFromPalette guard), the `dial` group
  returns the correct generic Dial Fields for http-client (not route-only), the entity renders without a
  type selector (header + Tag + TLS/HTTP2/Dial cards, no crash/empty), getUniqueTag dedupes, and the
  canvas node renders. One SHOULD-FIX (non-blocking): engine/version/disable_version_fallback/headers
  have no Advanced editing surface yet → queued as **A22-create-fields** (the created config is valid and
  round-trips; only a UI control is missing, and composing the handled-fields to avoid double-rendering
  the shared-group fields warrants a careful follow-up).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (781 passed | 1 todo), `pnpm build`,
  `pnpm e2e` (editor 3 passed).
- Official check: `sing-box-testing check` not run in this env; a created http_clients[] entry matches
  the upstream schema (tag + optional object fields).

Both former A21/A22 hard checkpoints now fully support the testing target (stable gated), per the user's
2026-05-29 decision.

### Phase 2 complete — checkpoint report (2026-05-29)
All Phase-2 rows have landed at least their primary slice: A10 (a/b/c), A11, A12, A13, A14, A15, A16,
A17, A18, A19, A20 (dns/inbound/outbound/rule/service/misc representative slices), A21, A22 (diag +
create) — PRs #55–#75. Both former hard checkpoints (A7 in Phase 1, A21/A22 here) are resolved. Queued
P1/P2 tails (not blocking phase completion): A20-{dns,inbound,outbound,rule,service,misc}-rest,
A22-create-fields, plus the standing deferrals A2c, A4-rest, A8b-brands, A8b-ports, A10d, A11-full,
A16-norm, A20-* rests. All work this session ran under the new one-pass expert-review gate (from A10).
Next: Phase 3 (A23 palette usability → A24 connect/disconnect discoverability + edge legend → A25 mobile
build path → A26 import safety + onboarding → A27 template placeholder secrets), then Phase 4 (A28–A29).
A25 may add a build target/dependency (user-authorized); A27 uses the existing `****` placeholder-secret
masking (user-confirmed). Proceeding to A23.

### A23-search palette-search-templates — Add Library search covers Templates (W29)
Status: implemented 2026-05-29 in `atomic/palette-search-templates`; merged in PR #76. First A23 slice.

- What changed (W29): the Add Library search filtered only the library groups; the Templates group showed
  only when NOT searching, so a query could never surface a template preset. Added a memoized
  `filteredTemplateGroup` rendered as a PaletteSection above the filtered library groups when a query is
  active (same matcher as the library; loaded-template tracking preserved).
- Frontend perf review (`vercel-react-best-practices`): one query-keyed memo; no new
  subscriptions/waterfalls/bundle deps. Pass.
- Expert review (one pass): a reviewer subagent. Verdict APPROVE, no blockers. Confirmed correct
  filtering, the two template-render paths are mutually exclusive (no duplicate), loaded-template tracking
  works, memo deps complete, and no regression.
  - Deferred to follow-up atomic: A23-rest (empty first-run state, dead "Docs" rows, jargon badges,
    Add-vs-Setup labels).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (783 passed | 1 todo), `pnpm build`.
- Official check: n/a — palette UI.

### A24-legend canvas-edge-legend — desktop edge legend (W30)
Status: implemented 2026-05-29 in `atomic/canvas-edge-legend`; merged in PR #77. First A24 slice.

- What changed (W30): the canvas had no key for the edge rendering or the disconnect affordance. Added a
  desktop-only legend (bottom-left, pointer-events:none): solid lime = a configured link/reference;
  animated dashed lime = the traffic path (entry → route → final, the only `animated` edges); hover a
  writable edge → ✕ to disconnect. Hidden on mobile.
- Frontend perf review (`vercel-react-best-practices`): static desktop-only overlay; no new
  subscriptions/waterfalls/bundle deps. Pass.
- Expert review (one pass): a reviewer subagent. Verdict CHANGES REQUESTED → fixed. 1 BLOCKER: the first
  draft invented a grey/active-vs-reference colour code the canvas does not implement (all committed
  edges render lime; grey-dashed is only the transient drag line; route-final is animated dashed lime).
  Rewrote the legend to describe what actually renders (solid link / animated traffic path / hover-✕),
  per the reviewer's documented edge model. Placement/overlap, mobile-hidden, a11y all passed.
  - Deferred to follow-up atomic: A24-rest (drag affordance, invalid-drop toast, right-click disconnect).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (784 passed | 1 todo), `pnpm build`,
  `pnpm e2e` (editor 3 passed).
- Official check: n/a — canvas overlay UI.

### A27 template-placeholder-secrets — placeholder-secret warning (domain, W33)
Status: implemented 2026-05-29 in `atomic/template-placeholder-secrets`; merged in PR #78.

- What changed (W33): templates/scaffolds ship dummy secrets like REPLACE_ME_PASSWORD (templates.ts) /
  change-me with no guidance, so a user could export/expose a config still carrying a placeholder
  credential. Per the user's confirmed approach (the masked `****` display already exists), added the
  missing `placeholder-secret` WARNING: scans outbound/inbound entity-level secret fields (password,
  auth_key, token, private_key, psk, uuid, secret_key) for `^REPLACE_ME…` / `^change[-_]?me…`.
- Frontend perf review: n/a — domain-only.
- Expert review (one pass): a reviewer subagent. Verdict APPROVE, no blockers. Verified the
  start-anchored regex has no realistic false positives (real random/base64 secrets + real UUIDs never
  match), the now-warning bundled templates break no preset-validity test (it counts errors, not
  warnings), and there's no double-report with the existing hysteria-realm change-me check (disjoint
  paths). Two NITs (nested users[] secrets not scanned → A27-rest; cosmetic trim).
  - Deferred to follow-up atomic: A27-rest (nested users[].password/uuid placeholder scan).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (787 passed | 1 todo), `pnpm build`.
- Official check: n/a — semantic diagnostic.

### A26-confirm import-safety-confirm — confirm before import overwrites a non-empty config (W32)
Status: implemented 2026-05-29 in `atomic/import-safety-confirm`; merged in PR #79. First A26 slice.

- What changed (W32): importing JSON replaced the whole config with no confirm, silently clobbering work
  (the app boots with a non-empty default). Added an overwrite confirm on both import paths (desktop
  TopBar + mobile MobileMenuSheet) via the exported `configHasContent(config)` helper; an empty config
  imports with no prompt. The importing e2e specs got a file-level dialog-accept beforeEach.
- Frontend perf review (`vercel-react-best-practices`): one extra subscribed `config` read in the topbar;
  no new waterfalls/bundle deps. Pass.
- Expert review (one pass): a reviewer subagent. Verdict APPROVE, no blockers. Confirmed both file-import
  paths guarded (no third path; drag-drop import doesn't exist), correct cancel semantics, the mobile
  getState() read is right, and the e2e dialog handling is single-registered. Applied the SHOULD-FIX
  in-pass: extended `configHasContent` to also count settings-only nodes (log/ntp/certificate/
  experimental), route/dns `final`, and certificate_providers/http_clients — so those no longer silently
  clobber.
  - Deferred to follow-up atomic: A26-rest (import undo + success/error toast; empty/first-run state).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (790 passed | 1 todo), `pnpm build`,
  `pnpm e2e` (14 passed).
- Official check: n/a — import-flow UX.

### A25-add mobile-build-path — mobile node-add path (W31/T12)
Status: implemented 2026-05-29 in `atomic/mobile-build-path`; merged in PR #80. First A25 slice.

- What changed (W31/T12): the mobile shell rendered no Palette, so a user could not add any node on
  touch (P0 "mobile cannot build a config"). Added a mobile "Add node" (Plus) button in MobileTopBar
  that opens a lazy-loaded `MobileNodeSheet` hosting the existing `<Palette/>` (which already carries
  every node entry + `createFromPalette`) inside the shared BottomSheet; a `.mobile-node-sheet .palette`
  CSS override flows it in the sheet. On add, the node-selection auto-closes the sheet so it doesn't
  stack over the inspector sheet.
- Frontend perf review (`vercel-react-best-practices`): MobileNodeSheet is lazy-loaded; one selectedId
  subscription for the auto-close.
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, no blockers. Verified end-to-end
  that a mobile user can add a node (createFromPalette is viewport-agnostic), layout/a11y/topbar-crowding
  are acceptable, and no regression. Applied one SHOULD-FIX in-pass: auto-close the node sheet on add
  (the reviewer's probe found dual stacked sheets). The other SHOULD-FIX (the lazy wrapper doesn't truly
  defer the Palette chunk because App eagerly imports Palette for desktop) is recorded accurately and
  queued as A25-rest, not over-claimed.
  - Deferred to follow-up atomic: A25-rest (touch connect affordance, sheet scroll-trap, real
    Palette-chunk deferral on mobile).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (792 passed | 1 todo), `pnpm build`,
  `pnpm e2e` (mobile passed).
- Official check: n/a — mobile UI.

### Phase 3 complete — checkpoint report (2026-05-29)
Phase 3 (UX comprehension) primary slices are all landed: A23-search (Palette search covers Templates,
#76), A24-legend (desktop edge legend, #77), A25-add (mobile node-add path, #80), A26-confirm (import
overwrite confirm, #79), A27 (placeholder-secret warning, #78). The P0 in this phase — "mobile cannot
build a config" — is closed (A25-add). Each remaining `*-rest` tail (A23/A24/A25/A26/A27) is a P1/P2
enhancement, not a blocker, and is queued in the Running TODO. Convergence-first ordering held: every
phase's correctness work (Phases 0–2) preceded its comprehension/polish work, so no polish slice masked
a correctness gap. Moving to Phase 4 (polish: A28 diagnostics/labels, A29 per-node P2 cleanup).

### A28-titlebar diagnostics-labels-polish — node titlebar reads a human label (W34)
Status: implemented 2026-05-29 in `atomic/diagnostics-labels-polish`; merged in PR #81. First A28 slice.

- What changed (W34): the canvas node titlebar rendered raw machine enums — `outbound / shadowsocks`,
  `dns-server / tailscale`, and the redundant `route / route`. It now reads a human label —
  `Outbound · Shadowsocks`, `DNS Server · Tailscale` — and collapses to a single word for singleton
  nodes whose type duplicates their kind (route/route-rule/dns/dns-rule) so it never reads "Route ·
  Route". Extracted a shared `src/canvas/nodeLabels.ts` (`typeLabels` + `labelForNodeKind`/
  `labelForNodeType`/`nodeTitlebarLabel`, with a `titleCase` fallback so unknown enums still read as
  words, e.g. `Some New Proto`). De-duplicated CanvasWorkspace by importing the shared `typeLabels`
  (its `candidateLabel` selection helper keeps its exact prior fallback). Added `wireguard → WireGuard`
  to the shared map (previously missing on both surfaces).
- Tests: `tests/node-titlebar-label.test.tsx` — unit tests for the helper (known/unknown kind+type,
  the kind·type combine, the singleton collapse) plus a component test asserting the SbcNode titlebar
  shows `Outbound · Shadowsocks` and never the raw `outbound / shadowsocks`. Migrated the e2e route-node
  heuristic in `external-fixtures.spec.ts` from `startsWith("route /")` to `=== "Route"` so it keeps
  firing under the new label (it was a guard, would have silently dropped coverage otherwise).
- Side effect (intended, called out per review): de-duping the map means the canvas WireGuard-endpoint
  connect chip's `candidateLabel` now reads "WireGuard" instead of the old ugly fallback
  "wireguard endpoint" (Tailscale was already mapped; this just makes the pair consistent).
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE-WITH-NITS, no blockers, no
  should-fix. Verified the collapse logic across all 14 PORT_NODE_KINDS, the faithful candidateLabel
  de-dup (byte-identical fallback, sole consumer), the typeLabels diff (only `wireguard` added), the
  non-tautological test, the precise e2e `=== "Route"` migration, and noUncheckedIndexedAccess safety.
  Applied both NITS in-pass: (1) documented the intended WireGuard-chip side effect above; (2) added
  acronym-correct map entries `ntp → NTP`, `route-rules → Route Rules`, `dns-rules → DNS Rules` so
  settings/notice titlebars don't read "Settings · Ntp" / "Notice · Dns Rules" (pinned by a new test
  assertion). Did not add `acme → ACME` — cert-provider `type` is `provider.type` (e.g. "tailscale"),
  not verified to ever be "acme", so no dead key.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (798 passed), `pnpm build`,
  `pnpm e2e` (port-click-redesign flaked once on a drag connection-path assertion, unrelated to this
  change — passed 7/7 on isolated re-run; titlebar touches no port-drag code).
- Official check: n/a — canvas label copy.
- Deferred to follow-up atomic: A28-rest (`Selected {id}` raw-id pill, goHome "return to home"
  mislabel, target glossary tooltip, message-over-code diagnostic hierarchy, mobile diagnostics focus,
  mobile 36px touch targets, round-trip-fidelity copy).

### A29-subtitle per-node-p2-cleanup — informative inbound + dns-server subtitles (W35)
Status: implemented 2026-05-29 in `atomic/per-node-p2-cleanup`; merged in PR #82. First A29 slice.

- What changed (W35): two node subtitles were generic type-repeats — `socks inbound`, `tls dns server`
  — which, now that the A28 titlebar reads "Inbound · SOCKS" / "DNS Server · TLS DNS", are pure
  duplication. They now carry real connection info like the endpoint/outbound/service subtitles already
  do: inbound shows `listen <host>:<port>` (or `listen :<port>` / `listen <host>`, falling back to
  `<type> inbound` for listen-less inbounds like tun); dns-server shows the structured `server`
  host[:port] (or the legacy `address` URL, or `via <endpoint>` for tailscale), falling back to
  `<type> dns server` for local/fakeip/hosts which have no host. Added `inboundSubtitle` /
  `dnsServerSubtitle` next to the existing subtitle helpers in `src/canvas/graph.ts`.
- Tests: `tests/node-subtitle.test.tsx` — renders App and asserts the rendered `.sbc-node__subtitle`:
  inbound host:port, port-only, the listen-less tun fallback, dns-server remote host:port, and the
  local-server fallback.
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, no blockers, no should-fix.
  Verified both helpers across every branch and all 14 dns-server types (no `undefined`/blank/crash),
  the `port != null` guard (correct — `listen_port: 0` is a legitimate OS-assigned ephemeral port that
  truthiness would have dropped), preserved fallbacks (tun, local), correct call-site wiring, and
  non-tautological tests. Applied both NITS in-pass: (1) narrowed `listen_port` with `typeof === "number"`
  before interpolating (it reaches InboundConfig via the TaggedConfig index signature as `unknown`, so a
  malformed import could otherwise render `listen :true`); (2) added the two missing dns-branch test
  assertions — the legacy 1.11 `address` URL form and the tailscale `via <endpoint>` branch.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (805 passed), `pnpm build`,
  `pnpm e2e` (14 passed).
- Official check: n/a — canvas subtitle copy.
- Deferred to follow-up atomic: A29-rest (icon mismatches, remaining subtitle genericism for
  route/settings/notice, export empty-string/array noise, deprecation hints, per-node copy accuracy).

### A0–A29 primary queue complete — checkpoint report (2026-05-29)
Every atomic A0 through A29 now has its primary, finding-closing work landed and merged to `main`
(A28-titlebar #81, A29-subtitle #82 close Phase 4's first slices). The five-phase backbone is fully
exercised: Phase 0 guardrails, Phase 1 canvas correctness/legibility, Phase 2 per-kind conformance
(incl. the cloudflared + HTTP Client testing-target capabilities), Phase 3 UX comprehension, Phase 4
labels/subtitle polish. Both former hard checkpoints (A21 cloudflared, A22 HTTP Client) were resolved
under the user's "fully support testing (1.14)" decision. Convergence-first ordering held end to end —
no comprehension/polish slice ran ahead of its phase's correctness work.

What remains is the explicitly-split backlog of `*-rest` / deferred tails recorded above in the Running
TODO (each created during execution as a scope-management split, logged in the Decision Log). These are
P1/P2 follow-ups, not part of the core A0–A29 findings. Continuing through them in value order — the
correctness tails first (A10d stale dns-rule `server` on import; A16-norm legacy network-type
normalize; A27-rest nested-secret scan), then UX (A26-rest, A23-rest), then the cosmetic batches
(A29-rest, A8b-brands which is blocked on sourcing licensed brand SVGs).

### A10d dns-rule-import-normalize — scrub stale rule fields on import (domain, A10c follow-up)
Status: implemented 2026-05-29 in `atomic/dns-rule-import-normalize`; merged in PR #83.

- What changed: `normalizeDnsRule` (scrub `server` when the dns-rule action isn't ``/`route`/`evaluate`)
  and `normalizeRouteRule` (scrub `outbound` when the route-rule action isn't ``/`route`) ran only in
  the add/update commands. An imported config carrying `{action:"reject",server:"x"}` (or
  `{action:"reject",outbound:"x"}`) kept the stale field — invalid for that action, invisible on every
  editor surface, yet re-exported verbatim. Root-cause fix: `normalizeConfig` (the single import
  boundary, `src/domain/serialization.ts`) now maps both normalizers over `dns.rules` / `route.rules`
  after the structural clone. Exported both normalizers from `commands.ts` (no import cycle —
  serialization had no prior dependency on commands, and none of commands' deps import serialization).
- Scope note: the ticket was dns-rule only, but the route-rule sibling is the identical latent bug with
  the identical root cause (normalizers not run on import); a single import hook fixes both, so excluding
  route-rule would have been artificial. Both ride this atomic.
- Tests: `tests/dns-rule-import-normalize.test.ts` — reject-rule scrub, route/implicit-rule retention,
  no-re-export-of-the-stale-value (export fidelity), the route-rule sibling cases, and (added in-pass)
  the full import-path allow-list locks: `evaluate` keeps `server`, `bypass` keeps `outbound`.
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, no blockers, no should-fix.
  Confirmed no ESM cycle (serialization→commands is one-way; no transitive dep imports serialization),
  the predicates' allow-lists are right and codebase-consistent (route allows ``/`route`/`bypass`; dns
  allows ``/`route`/`evaluate`; `route-options`/`predefined` correctly excluded), no over-scrubbing,
  clone-before-mutate, and type-safety under noUncheckedIndexedAccess. Applied the reviewer's two
  optional assertions in-pass (above). Two NITS noted as known gaps, both matching existing add/update
  command behavior (not regressions): see A10d-rest.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (812 passed), `pnpm build`,
  `pnpm e2e` (14 passed, incl. the import→export→re-import round-trip fixture test).
- Official check: n/a — domain import normalization.
- Deferred to follow-up atomic: A10d-rest — the normalizers scrub only the single action-gated field
  (`server`/`outbound`); other action-gated fields (`method`/`no_drop` on reject, `rcode` on dns
  predefined, `override_address`/`override_port` on route-options, sniff fields) still survive import.
  Also: nested logical-rule recursion (currently top-level only — inert today since nested rules carry
  no action/outbound/server, but worth revisiting if logical-rule conformance becomes a goal).

### A16-norm route-network-type-import-normalize — coerce legacy raw-string network type (domain)
Status: implemented 2026-05-29 in `atomic/route-network-type-import-normalize`; merged in PR #84.

- What changed: A16 declared `route.default_network_type` / `default_fallback_network_type` as
  `string[]`, but a legacy/pre-release config carrying the raw-string form (`default_network_type:
  "tcp"`) imported a bare string into a `string[]`-typed field. That type-lie stranded silently in the
  `kind: "list"` control (the user could neither see nor edit it) and risked `.length`/`.includes`
  operating on the string elsewhere. Same root-cause shape as A10d: `normalizeConfig` (the single import
  boundary) now coerces a raw-string value to a single-element array (`"tcp" → ["tcp"]`, `"" → []`),
  leaving already-array values untouched.
- Tests: `tests/route-network-type-import-normalize.test.ts` — string→array for both fields, empty
  string→`[]`, array passthrough, a no-network-type route left alone, and (added in-pass) a non-string
  element passthrough pinning the strings-only contract.
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, no blockers, no should-fix.
  Trace-verified the coercion across all value types (strings rewritten; number/array-of-non-strings/
  null/object/undefined pass through), the `value: unknown` typeof-narrowing idiom, clone-not-input
  mutation, write-side type-safety under strict + noUncheckedIndexedAccess, and zero interaction with
  the adjacent A10d rule-normalizer (disjoint config subtrees). Confirmed `""→[]` matches the list
  control's own `fromList`/`toList` behavior. Agreed the dial-group siblings are correctly deferred
  (untyped via the index signature → no type-lie). Applied the one optional nice-to-have in-pass (the
  non-string passthrough assertion).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (818 passed), `pnpm build`,
  `pnpm e2e` (14 passed, incl. the round-trip fixture test).
- Official check: n/a — domain import normalization.
- Deferred to follow-up atomic: A16-norm-rest — the dial-group siblings `network_type` /
  `fallback_network_type` on outbounds/endpoints share the legacy-string strand (untyped via the index
  signature, so lower type-lie risk); coerce those on import too.

### A27-rest placeholder-secret-nested-users — scan per-user secrets (domain, A27 follow-up)
Status: implemented 2026-05-29 in `atomic/placeholder-secret-nested-users`; merged in PR #85.

- What changed: A27's `placeholder-secret` scan only inspected the entity top level, so an inbound's
  `users[].password` / `users[].uuid` (where trojan/vmess/vless/hysteria2/tuic actually carry their
  credentials) escaped the check — a scaffold `change-me` / `REPLACE_ME` could ship invisibly. The
  A27 test even documented the gap (built a nested config but `void`-ed it). Refactored the field scan
  into `scanSecretFields(record, path, label)` and had `scanPlaceholders` also descend into `users[]`,
  emitting `placeholder-secret` warnings at `/<entity>/users/<i>/<field>` with the user name/index in
  the message. Reuses the same regex + secretFields list (password/uuid/psk/…).
- Tests: extended `tests/placeholder-secret.test.ts` — un-`void`-ed the nested case to a real assertion,
  added a nested-uuid case, a nested-path assertion (`/inbounds/0/users/0/password`), a real-nested-secret
  negative, plus (in-pass) a hysteria `auth_str` case and a malformed-`users`-shape guard test.
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE-WITH-NITS. Confirmed the refactor
  is byte-identical for the top level, the nested scan handles non-array/non-object/missing-field/multi-user
  and the name→username→index label fallback, no over-scan, correct JSON-pointer paths, and type-safety.
  Applied the SHOULD-FIX in-pass: added `auth_str` to `secretFields` — the scaffold generator literally
  emits `auth_str: "change-me"` for hysteria (commands.ts), so without it a freshly-scaffolded hysteria
  inbound/outbound still shipped an unflagged placeholder — the exact bug class this atomic closes. Also
  applied the NIT (malformed-`users`-shape guard test). No false-positive risk (`auth_str` is only ever a
  credential); full suite unaffected.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (824 passed), `pnpm build`,
  `pnpm e2e` (14 passed).
- Official check: n/a — domain diagnostic.