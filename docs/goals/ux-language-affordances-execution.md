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
- [x] L1-vocab — language spec `docs/ui-language.md` **SIGNED OFF** (badge words = full proposed set incl. setup→Add; Hysteria v1 keeps Legacy but drops false-upstream wording; de-dup keeps badge drops label suffix). — PR #109
- [~] L1-badges — re-label + re-treat the palette status badges per L1-vocab (split for size):
  - [x] L1-badges-words — statusLabel words: Setup→Add, Table→List, Inspector→In parent, Docs→Reference,
    Gated→Needs 1.14, Pending→Soon (Add/Legacy/Open kept); statusTitle tooltips aligned; 20 test
    assertions migrated. — PR #112
  - [x] L1-badges-treatment — gated badge → muted cool slate (was warm amber, too close to Legacy);
    Legacy stays the warm-orange colored bar (already correct). De-dup'd the "Hysteria Realm (1.14
    testing)" suffix → bare label (the `Needs 1.14` badge carries it). — PR #113
  - [ ] L1-badges-a11y — (L1-badges-words NIT) under active search a setup-draft + ready-add of the same
    protocol share the accessible name "Add X"; consider node-kind in the aria-label. (deferred follow-up)
- [x] L1-buildtags — dropped `(with_tailscale)`/`(with_tor)` suffixes from the 4 palette labels (dns
  Tailscale Server, endpoint Tailscale, Tor outbound, DERP service); the build-tag requirement stays on
  the Inspector banner. (D3) — PR #111
- [x] L1-brandbtn — relabeled both brand buttons (desktop + mobile) `aria-label` from "…return to home"
  → "sbcv.app — reset view (deselect and fit the canvas)" (goHome only deselects + re-fits). — PR #110
- [x] L1-target-glossary — target selector tooltip explaining stable 1.13 (released) vs testing 1.14 (newer features). — PR #115
- [x] L1-diag-hierarchy — reordered the diagnostics-popover item body so the human `message` is the
  headline (bright `#eef2f4`, weight 600, first) and the machine `code`/`path` drop to a muted monospace
  secondary line (`#8a96a3`, 11px) below it — was code-first/bold with the message buried last. — PR #116
- [x] L1-roundtrip-copy — surfaced the import→export normalization at the two round-trip touchpoints:
  the desktop Export button now has a `title` tooltip ("Downloads a normalized config: empty fields are
  dropped and shorthand values are expanded to sing-box's canonical form, so a re-imported file may
  differ textually from your original but sing-box reads it identically"), and the mobile Export row
  caption changed from "Download current config as .json" → "Normalized .json — empty fields dropped,
  shorthands expanded". — PR #117

**Phase 1 complete** (L1-badges-a11y + L1-hysteria-tooltip remain as explicitly-deferred follow-ups).

### Phase 2 — Per-node copy accuracy audit (bucket 1d / D5)
- [x] L2-audit — agent-driven sweep (3 parallel auditors vs `docs/upstream/sing-box/testing/**`).
  Findings table in `docs/ui-copy-audit.md` (9 HIGH incl. invalid-export bugs + a MED list). — PR #101
- [ ] L2-fix-* — apply corrections, sliced. HIGH queue (from the audit):
  - [x] L2-fix-route-strategy — H2: route-options Network Strategy select offered invalid `wifi/cellular/
    ethernet` → restricted to `default/hybrid/fallback`. — PR #102
  - [x] L2-fix-wireguard-peer — H1: peer `server`/`server_port` → upstream `address`/`port` (Inspector +
    createEndpoint seed); was producing invalid exports. (DERP mesh peer correctly keeps server/port.) — PR #103
  - [x] L2-fix-ss-inbound-ciphers — H3: dropped legacy stream ciphers from the shadowsocks INBOUND method
    select (kept 2022/AEAD/`none`); outbound select keeps them (valid). — PR #105
  - [x] L2-fix-shadowtls-version — H7: version default label `(default — 3)` → `(default — 1)` (both
    inbound + outbound; upstream omitted-version default is v1). — PR #104
  - [x] L2-fix-hysteria-mbps — H4: Hysteria v1 outbound up/down Mbps placeholder "empty = no rate limit"
    → "required (Mbps)" (upstream marks them Required). — PR #106
  - [x] L2-fix-hysteria-deprecated-stance (H5/H6) — RESOLVED via L1-hysteria-wording per user sign-off:
    KEEP the Legacy treatment (pill + banner + diagnostic codes) but drop the literal-false "deprecated
    upstream / official docs recommend" wording from the banners + diagnostic messages. — PR #114
  - [x] L2-fix-dns-hints — H8: tailscale + resolved `accept_default_resolvers` now read as "accept for
    fallback (in addition to MagicDNS/matching domains; off ⇒ NXDOMAIN)" — was "forward to MagicDNS
    chain"/bare. (Other MED dns hints — local `prefer_go`, dhcp placeholder — folded into L2-fix-med-copy.) — PR #107
  - [x] L2-fix-rule-set-deprecation — H9: a deprecation banner now appears when a remote rule-set's
    `download_detour` is set (deprecated 1.14 → `http_client`, removed 1.16). — PR #108
  - [~] L2-fix-med-copy — the MED list, re-verified vs current code + upstream (agent pass) and sliced
    into copy vs behavior atomics. App has only stable/testing channels (no 1.12), which decides the
    version findings. `accept_default_resolvers` (MED #5) was already fixed under H8. Structural V2Ray
    transport per-type fields (MED #15) are out of the copy remit → deferred as a structural follow-up.
    - [x] L2-med-rules-copy — rule match/action copy: "Rule Set" match field → "Match rule-set" (node
      inspector ×2 + table editor ×2) and reject `no_drop` "(only return)" → "(else method falls back to
      drop after 50 hits in 30s)" per upstream's 50-triggers/30s throttle. — PR #118
    - [x] L2-med-dns-server-copy — DNS server/cache copy: local `prefer_go` "bypasses platform-native DNS"
      → "skips Apple getaddrinfo / Linux systemd-resolved — Android platform DNS and macOS DHCP still
      apply"; dhcp interface placeholder "auto (system default)" → "(default interface)" (`auto` is the
      legacy address form); store_rdrc banner rewritten to distinguish the caches (store_rdrc = rejected/
      address-filter results only; store_dns = full DNS cache) + name the 1.16 removal; toggle label
      "(DNS cache reasons)" → "(rejected-response cache)". — PR #119
    - [ ] L2-med-banners-copy — protocol/build-tag banner copy: tuic 0-RTT replay wording,
      tailscale/derp "stock binaries omit" → default-build softening (×3), V2Ray API tag citation,
      block-outbound banner (removed in 1.13, rejected on both channels).
    - [ ] L2-med-dial-fields (BEHAVIOR) — gate dial `domain_strategy` off on testing (removed 1.14) +
      add value/platform hints to Network Type / Fallback Network (needs a hint slot in the shared dial
      field descriptor/renderer).
    - [ ] L2-med-naive-banner (BEHAVIOR) — add the naive platform-support banner (Apple/Android/Windows/
      libcronet-Linux only).
    - [ ] L2-med-dns-rule-actions (BEHAVIOR) — evaluate/respond hints + channel-gate those two options to
      testing (1.14-only actions).

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
- [x] L4-export-noise — the DOWNLOAD (`createConfigExport` only — not the editable draft) prunes inert
  empty-string/empty-array object keys; keeps empty objects/`false`/`0`/`null` and never drops array
  elements. Verified semantics-preserving (identical diagnostics) + idempotent across all ≥200 fixtures.
  **D7 honored.** — PR #93
- [x] L4-dial-network-type — A16-norm-rest: coerce legacy raw-string `network_type` /
  `fallback_network_type` on outbounds/endpoints (dial group) at import (same shape as A16-norm). — PR #90
- [ ] L4-dial-network-type-2 — extend the same coercion to the remaining `kind:"list"` network-type
  carriers (dns-servers, ntp settings, http_clients, shadowtls nested dial) (L4-dial-network-type
  review follow-up)
- [x] L4-rule-field-scrub — A10d-rest: scrub the *unambiguously* action-exclusive rule fields on import
  (dns/route reject-only `method`/`no_drop`; dns predefined-only `rcode`/`answer`/`ns`/`extra`). Shared
  route-options fields (`override_*`/`network_*`) intentionally NOT scrubbed — valid on
  route/bypass/route-options. — PR #92
- [x] L4-subtitle-degeneric — settings node subtitles carry real info (route/dns hubs already show rule
  counts; notices already informative — only the four settings nodes were generic). — PR #91
- [x] L4-mobile-touch — mobile controls meet a ≥36px touch-target minimum: the mobile topbar status
  pill was 30px (brand/icon-buttons already 36px) → bumped to 36px. — PR #99
- [x] L4-mobile-palette-defer — A25-rest: App now `lazy`-loads the desktop Palette, so it code-splits
  into its own 19KB chunk (was in the main bundle); the mobile shell never renders it (lazy via
  MobileNodeSheet on demand), so mobile no longer downloads it on first load. — PR #100

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

### L4-subtitle-degeneric settings-node-subtitle (canvas) — PR #91
Status: implemented 2026-05-29 in `atomic/settings-node-subtitle`; merged in PR #91.
- What changed: all four settings nodes (log/ntp/certificate/experimental) showed the same generic
  "global settings" subtitle. New `settingsSubtitle(path, entity)` helper gives each real info: log →
  `log level <level>` / `logging disabled`; ntp → `time sync · <server>`; certificate → `certificate
  store · <store>` / `TLS certificates`; experimental → the enabled subsystems joined (`Clash API ·
  V2Ray API · cache file`). Falls back to a meaningful per-section label, never "global settings" for
  the known paths. (route/dns hubs already show `N ordered rules`; notice nodes already informative.)
- Tests: `tests/settings-node-subtitle.test.tsx` (log level, log disabled, ntp server, experimental
  subsystems, certificate fallback, ntp-empty fallback).
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, clean. Verified the field names
  against the upstream sing-box docs (log `level`/`disabled`, ntp `server`, certificate `store`,
  experimental `clash_api`/`v2ray_api`/`cache_file` objects), the guarded cast, the single subtitle
  consumer, and idiom-consistency with the sibling helpers. Applied both optional nits in-pass: typed
  the param `path: SettingsPath` (makes the `"global settings"` fallback provably-unreachable / catches a
  future typo'd path) and added an ntp-empty fallback test.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (858), `pnpm build`, `pnpm e2e` (14).

### L4-rule-field-scrub rule-action-field-scrub (domain) — PR #92
Status: implemented 2026-05-29 in `atomic/rule-action-field-scrub`; merged in PR #92.
- What changed: extends the A10d import-boundary scrub (server/outbound) to the other *unambiguously*
  action-exclusive rule-output fields, verified against the sing-box 1.14 `rule_action` docs: dns &
  route reject-only `method`/`no_drop`; dns predefined-only `rcode`/`answer`/`ns`/`extra`. A stale
  `{action:"route", rcode:"…"}` etc. was invisible on every surface yet re-exported; now scrubbed.
  `normalizeDnsRule`/`normalizeRouteRule` (run on both add/update and import via A10d) gained a shared
  `dropRuleKeys(rule, keys)` that drops only present keys and keeps the no-op identity fast-path.
- **Deliberately NOT scrubbed (D7 spirit — don't drop valid config):** the route-options fields
  (`override_address`/`override_port`/`network_strategy`/`network_type`/`tls_*`/`udp_*`) are valid on
  `route`, `bypass`, AND `route-options` actions, so they are shared, not exclusive. Sniff/resolve
  action fields likewise left (entangled). Conservative scope = only the provably-exclusive fields.
- Tests: `tests/rule-action-field-scrub.test.ts` (dns reject/predefined scrub + retention, route
  reject scrub + retention, shared-route-options-kept, cross-field reject-keeps-method-drops-rcode,
  no-re-export); A10d + bypass regressions green.
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, clean, no blockers/should-fix.
  Rigorously verified field-exclusivity against the upstream 1.14 docs — `method`/`no_drop` reject-only
  (both dns+route), `rcode`/`answer`/`ns`/`extra` predefined-only (dns); critically confirmed the bare
  output names don't collide with the `response_*`-prefixed dns *match* fields (so no match condition is
  scrubbed), and the shared route-options fields are correctly left. Verified no add/update regression
  (templates/Inspector/store never set an output field on a mismatched action). Applied the one optional
  nit in-pass (cross-field reject-keeps-method-but-drops-stale-rcode test). Logical sub-rule recursion
  remains an explicit future follow-up (matches A10d).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (867), `pnpm build`, `pnpm e2e` (14).

### L4-export-noise export-prune-empty (domain) — PR #93
Status: implemented 2026-05-29 in `atomic/export-prune-empty`; merged in PR #93.
- What changed: the downloaded config (`createConfigExport` only) now recursively drops object keys
  whose value is an empty string `""` or empty array `[]` — sing-box treats both as absent, so the file
  is cleaner with identical meaning. Conservative per D7: keeps empty objects (`clash_api:{}` etc.),
  `false`, `0`, `null`, and never drops array *elements* (only object keys). `pruneExportNoise` operates
  on a fresh copy (no input mutation). Applied ONLY to the download — the editable live JSON draft
  (`stringifyConfig`/`jsonDraft`) is untouched, so in-editor fidelity is preserved.
- D7 verification: changed the external-fixtures round-trip assertion from byte-identity
  (`exportedRoundTrip === config`) to the stronger, meaning-focused pair — re-imported export yields
  **identical diagnostics** (semantics preserved) AND re-export is **byte-stable** (idempotent, no
  progressive loss). All ≥200 real fixtures pass both. (The old byte-identity also OOM'd on large-config
  diffs; the diagnostics/idempotency compare is small.)
- Tests: `tests/export-prune-empty.test.ts` (drop empties; keep 0/false/{}/non-empty; deep nested prune;
  never drop array elements; diagnostics-preserving round-trip; no input mutation) + the updated
  external-fixtures corpus check.
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, clean — no blockers/should-fix.
  Ran an exhaustive D7 audit against `.tmp/sing-box-docs/**`: no field treats `""`/`[]` as distinct from
  absent. Checked the scariest candidates — auth `users:[]` ("no auth if empty"), `sniffer:[]` ("all
  sniffers"), `cipher_suites:[]`/`alpn:[]` ("safe default"/"not negotiated"), clash `access_control_
  allow_origin:[]` ("* if empty"), `certificate.store`/`derp.home` — all default to permissive/safe ==
  absent; the genuinely-distinct behaviors use non-empty literal sentinels (`"none"`/`"blank"`/`"deny"`)
  which are never pruned. No preserve-list needed. Confirmed no input mutation, array-elements never
  dropped, draft path untouched, and that diagnostics-equivalence + idempotency soundly replaces
  byte-identity (does not mask a regression).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (873), `pnpm build`, `pnpm e2e` (14).

### L4-mobile-touch (canvas CSS) — PR #99
Status: implemented 2026-05-29 in `atomic/mobile-touch-targets`; merged in PR #99.
- What changed: audited mobile interactive controls — the mobile brand button, the topbar icon buttons
  (Add/Check/Menu), and the menu-field selects/row-buttons are already ≥36px; the one violator was the
  mobile topbar status/check pill (`.mobile-topbar__center .status-pill`) at `min-height:30px`. Bumped
  to 36px (font-size 11px kept — legibility ≠ tap target).
- Tests: new e2e in `mobile.spec.ts` (390×844) asserting the mobile topbar controls (status pill, brand,
  add-node, run-check, menu) all have `boundingBox().height ≥ 36`. (jsdom can't compute layout, so e2e.)
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, clean — no blockers/should-fix/
  nits. Confirmed isolation (only the mobile rule changed; desktop `.status-pill` untouched), the audit
  (no other in-scope mobile control <36px), valid + non-flaky selectors, and no layout break (pill now
  matches the 36px brand/icon row).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (874), `pnpm build`, `pnpm e2e` (16).

### L4-mobile-palette-defer (code-split) — PR #100. **Phase 4 core complete (6/6).**
Status: implemented 2026-05-29 in `atomic/mobile-palette-defer`; merged in PR #100.
- What changed: `App.tsx` now `React.lazy`-loads the desktop `Palette` (Suspense fallback = an
  `aria-hidden` layout placeholder). The bundler splits it into `Palette-*.js` (19KB / 5KB gzip) — it
  was previously bundled into the main entry. The mobile shell never renders `<Palette/>` (the node-add
  path lazy-loads it via `MobileNodeSheet` on demand), so mobile's first load no longer ships the
  Palette chunk. Main `index` chunk dropped ~9KB.
- Test migration: lazy-loading made 6 desktop tests that synchronously queried the Palette fail (the
  first such test per file, since vitest isolates module graphs and `React.lazy` resolves on a
  microtask). Migrated each to `await screen.findByLabelText("Node palette")` / `await findByRole(...)`
  — the correct pattern for lazy content. The Suspense fallback is `aria-hidden` (no "Node palette"
  label) so those awaits resolve only on the real Palette.
- Tests: full suite 874 green; `editor.spec.ts` (Playwright auto-waits on the now-lazy palette) green.
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, clean — no blockers/should-fix.
  Verified the named-export lazy form + Suspense (wraps only Palette), the aria-hidden fallback (no label
  collision), that mobile renders no Palette + no other static importer (chunk truly split), the
  test-migration soundness, and — checking all 29 App-rendering test files — that no unmigrated test is
  left flaky. e2e safe (Playwright auto-waits). One nit: unused `data-testid="palette-loading"` (kept as
  harmless instrumentation).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (874), `pnpm build` (Palette chunk
  split confirmed), `pnpm e2e` (16; one unrelated drag-path flake, 7/7 on isolated re-run).

### L2-fix-route-strategy (audit H2) — PR #102
Status: implemented 2026-05-29 in `atomic/l2-fix-route-strategy`; merged in PR #102. First L2-fix slice.
  Expert review APPROVE, clean — upstream confirmed (dial.md: network_strategy = default/hybrid/fallback;
  wifi/cellular/ethernet are network_type), no data loss (option-list only; existing values not mutated),
  now consistent with the route-hub/outbound selects.
- What changed: the route-rule route-options **Network Strategy** `<select>` (Inspector.tsx ~1292)
  offered `wifi`/`cellular`/`ethernet` — those are `network_type` values; `network_strategy` accepts
  ONLY `default`/`hybrid`/`fallback` (shared/dial.md). Selecting one wrote an invalid `network_strategy`.
  Removed the three invalid options (kept unset/default/hybrid/fallback — matching the route-hub +
  outbound network_strategy selects which already used `networkStrategyOptions`).
- Tests: `tests/route-options-network-strategy.test.tsx` (the select's option values are exactly
  `["", default, hybrid, fallback]`; none of wifi/cellular/ethernet).
- Expert review (one pass): a senior reviewer subagent. Verdict + any in-pass fixes recorded below.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (875), `pnpm build`, `pnpm e2e` (16).

### L2-fix-wireguard-peer (audit H1) — PR #103
Status: implemented 2026-05-29 in `atomic/l2-fix-wireguard-peer`; merged in PR #103.
- What changed: a WireGuard endpoint **peer** used the keys `server`/`server_port`, but upstream
  (`endpoint/wireguard.md`) defines a peer as `address`/`port` — so a created/edited peer exported an
  invalid config (sing-box doesn't recognize peer `server`). Fixed THREE sites: the `createEndpoint`
  wireguard seed (`commands.ts`), the Inspector peer row (`Inspector.tsx` — label "Server"→"Address",
  reads/writes `address`/`port`), and the **Add-peer button seed** (`Inspector.tsx` addPeer). The DERP
  service `mesh_with` peer (a different control) correctly keeps `server`/`server_port` per
  `service/derp.md` — left untouched.
- Tests: `tests/wireguard-peer-address.test.tsx` (seed + Inspector read/write); migrated the existing
  `app.test.tsx` Add-peer assertion from `server` to `address`/`port`.
- Expert review (one pass): a senior reviewer subagent. Verdict CHANGES-REQUESTED → fixed → clean.
  BLOCKER it caught: the Add-peer button still seeded `server`/`server_port` (a third write site I
  missed) and `app.test.tsx:1592` pinned the buggy value (passing only because of the bug). Fixed the
  addPeer seed + the test assertion in-pass. Reviewer also confirmed DERP mesh_with correctly untouched,
  no other peer `server` reads, and that no import migration is warranted (old exports were already
  invalid; address/port aren't upstream-required).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (877), `pnpm build`, `pnpm e2e` (16).

### L2-fix-shadowtls-version (audit H7) — PR #104
Status: implemented 2026-05-29 in `atomic/l2-fix-shadowtls-version`; merged in PR #104.
- What changed: the ShadowTLS Version `<select>` (inbound + outbound) labeled its empty option
  `(default — 3)`, but per `inbound/outbound shadowtls.md` the version table marks **`1`** as the
  default when version is omitted. Relabeled both to `(default — 1)`. (The create seed still sets
  version:3 explicitly, so a new node delivers v3 via the seed; the empty option only shows when a
  user clears it, where sing-box's omitted default is genuinely v1.)
- Tests: `tests/shadowtls-version-default.test.tsx` (the empty Version option reads `(default — 1)`).
- Expert review (one pass): a senior reviewer subagent. Verdict CLEAN/APPROVE, no findings — upstream
  confirmed, both sites changed, no seed contradiction.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (878), `pnpm build` (label-only; no
  e2e path).

### L2-fix-ss-inbound-ciphers (audit H3) — PR #105
Status: implemented 2026-05-29 in `atomic/l2-fix-ss-inbound-ciphers`; merged in PR #105.
- What changed: the shadowsocks **inbound** Method `<select>` (Inspector.tsx ~3099) offered a "Legacy /
  Stream cipher" optgroup (aes-*-ctr/cfb, rc4-md5, chacha20-ietf, xchacha20) that a shadowsocks inbound
  rejects — those are outbound-only (`inbound/shadowsocks.md` lists only 2022 + AEAD + `none`). Removed
  the stream ciphers from the inbound select, keeping the valid `none` (relabeled the group "Other").
  The separate **outbound** shadowsocks Method select (Inspector.tsx ~3850) keeps stream ciphers — valid
  per `outbound/shadowsocks.md` — untouched.
- Tests: `tests/shadowsocks-inbound-ciphers.test.tsx` (inbound drops stream ciphers, keeps 2022/AEAD/none;
  outbound still offers them).
- Expert review (one pass): a senior reviewer subagent. Verdict CLEAN/APPROVE, no findings — upstream
  confirmed, scope limited to the inbound select (outbound keeps stream ciphers), `none` retained, no
  data loss (controlled select doesn't wipe an imported invalid method).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (880), `pnpm build` (select-options only).

### L2-fix-hysteria-mbps (audit H4) — PR #106
Status: implemented 2026-05-29 in `atomic/l2-fix-hysteria-copy`; merged in PR #106. Expert review CLEAN/APPROVE
(upstream confirms up/down Required; hysteria2 untouched; banners confirmed reverted; deferral of H5/H6
validated — the stance is entangled with diagnostics.ts hysteria-v1-deprecated + domain.test.ts).
- What changed: the Hysteria **v1** outbound `up_mbps`/`down_mbps` inputs had placeholder
  "empty = no rate limit", but `outbound/hysteria.md` marks both **Required**. Relabeled both to
  "required (Mbps)".
- Scope note: H5 (banner "deprecated upstream" wording) + H6 (Palette `deprecatedKinds` membership) were
  investigated but **deferred** — the "v1 is deprecated" stance is entangled across Inspector banners,
  the Palette pill, AND diagnostics (`hysteria-v1-deprecated`), plus tests; whether sbcv treats v1 as
  deprecated is a product decision (upstream doesn't formally deprecate it) overlapping D2. Banner edits
  were reverted to keep the editor's stance internally consistent pending that decision.
- Tests: `tests/hysteria-mbps-required.test.tsx`.
- Expert review (one pass): a senior reviewer subagent. Verdict + any in-pass fixes recorded below.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (881), `pnpm build`.

### L2-fix-dns-hints (audit H8) — PR #107
Status: implemented 2026-05-29 in `atomic/l2-fix-dns-hints`; merged in PR #107.
- What changed: the tailscale DNS-server `accept_default_resolvers` toggle was labeled "(forward queries
  to MagicDNS chain)" — wrong; upstream accepts the system DEFAULT resolvers for FALLBACK queries in
  addition to MagicDNS (off ⇒ NXDOMAIN for non-Tailscale domains). Relabeled both it and the resolved
  server's bare label to the accurate fallback semantics.
- Tests: `tests/dns-accept-default-resolvers-hint.test.tsx`.
- Expert review (one pass): a senior reviewer subagent. Verdict CLEAN/APPROVE — upstream confirmed
  (accept for fallback in addition to MagicDNS/matching; off⇒NXDOMAIN), minimal diff, non-tautological
  test. One NIT (label length) left as-is.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (883), `pnpm build`.

### L2-fix-rule-set-deprecation (audit H9) — PR #108
Status: implemented 2026-05-29 in `atomic/l2-fix-rule-set-deprecation`; merged in PR #108. **Clears the
actionable Phase 2 HIGH queue** (H1–H4, H7, H8, H9 done; H5/H6 deferred as a product decision).
- What changed: a remote rule-set's `download_detour` is deprecated in sing-box 1.14 (→ `http_client`,
  removed 1.16; `rule-set/index.md` marks it `:material-delete-clock:`), but the Inspector showed no
  signal. Added a `PlatformBanner kind="deprecated"` shown when `download_detour` is set (mirrors the
  store_rdrc banner pattern), pointing to HTTP Client.
- Tests: `tests/rule-set-download-detour-deprecation.test.tsx` (banner when set; absent when unset).
- Expert review (one pass): a senior reviewer subagent. Verdict + any in-pass fixes recorded below.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (885), `pnpm build`.

### L1-brandbtn (canvas/topbar copy) — PR #110
Status: implemented 2026-05-29 in `atomic/l1-brandbtn`; merged in PR #110. First Phase-1 (post-sign-off) atomic.
- What changed: the brand-logo button's `aria-label` (desktop TopBar + mobile MobileTopBar) said
  "sbcv.app — return to home", but `goHome` only deselects + closes the global panel + re-fits the canvas
  (no navigation, no config reset). Relabeled both → "sbcv.app — reset view (deselect and fit the canvas)".
- Tests: `tests/brand-button-label.test.tsx` (aria-label reads "reset view", not "return to home"). The
  `brand-home` testid is unchanged so existing tests/e2e stay green.
- Expert review (one pass): a senior reviewer subagent. Verdict CLEAN/APPROVE — goHome confirmed
  (deselect + close panel + re-fit, no nav/reset), both buttons relabeled, testid/onClick unchanged, no
  old-label test refs. Two NITs (mobile-variant direct coverage; doc PR# optimism) left.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (887), `pnpm build`.

### L1-buildtags (palette copy / D3) — PR #111
Status: implemented 2026-05-29 in `atomic/l1-buildtags`; merged in PR #111.
- What changed: dropped the `(with_tailscale)` / `(with_tor)` build-tag suffixes from the 4 palette
  labels (DNS "Tailscale Server", endpoint "Tailscale", outbound "Tor", service "DERP") → the bare
  protocol names. The build-tag requirement is still conveyed by the Inspector build-tag banner.
- Tests: `tests/palette-buildtag-suffix.test.tsx` (endpoint Tailscale + Tor outbound suffix-free);
  migrated `app.test.tsx`'s "Setup Tailscale (with_tailscale)" → "Setup Tailscale".
- Expert review (one pass): a senior reviewer subagent. Verdict + any in-pass fixes recorded below.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (889), `pnpm build`.

### L1-badges-words (palette copy) — PR #112
Status: implemented 2026-05-29 in `atomic/l1-badges-words`; merged in PR #112.
- What changed: per the signed-off L1-vocab, renamed the palette `statusLabel` words — `setup→Add`,
  `table→List`, `inspector→In parent`, `docs→Reference`, `gated→Needs 1.14`, `pending→Soon` (Add /
  Legacy / Open unchanged) — and aligned the `statusTitle` tooltips (the setup "draft" nuance moves to
  the tooltip). The colored-legacy / muted-gated visual treatment + the "(1.14 testing)" label de-dup
  are the sibling L1-badges-treatment slice.
- Tests: migrated 20 assertions — 17 `name:"Setup X"` → `"Add X"` (app/inbound-cloudflared/
  http-client-create/palette-buildtag-suffix) + 3 `"X: Docs"` → `"X: Reference"` (the disabled
  reference-row test).
- Expert review (one pass): a senior reviewer subagent. Verdict CLEAN/APPROVE — all 9 words match the
  signed-off spec, tooltips consistent, migration complete (20 assertions, none stale), aria-label forms
  correct, no logic change. NIT (deferred to L1-badges-treatment): the `setup→Add` merge means under
  active *search* a setup-draft and a ready-add of the same protocol (e.g. inbound vs outbound "Direct")
  share the accessible name "Add Direct" — spec-intended + harmless today, but the treatment slice should
  confirm the muted-vs-neutral visual is a sufficient a11y differentiator (or add the node-kind to the
  aria-label).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (889), `pnpm build`, `pnpm e2e` (16).

### L1-badges-treatment (palette CSS + de-dup / D2) — PR #113
Status: implemented 2026-05-29 in `atomic/l1-badges-treatment`; merged in PR #113.
- What changed (D2 — legacy ≠ testing/gated must LOOK different): the `gated` badge was warm amber
  (#f5c76b), too close to the `Legacy` warm-orange — now muted cool slate (#8794a0) so it recedes as
  "needs a newer target" (informational), while `Legacy` (#ff8c69 + dark-red border) stays the colored
  quality bar. Also de-dup'd the "Hysteria Realm (1.14 testing)" label → bare "Hysteria Realm" (the
  `Needs 1.14` gated badge carries the version).
- Tests: `tests/palette-hysteria-realm-dedup.test.tsx` (bare label + gated `Needs 1.14` badge on stable).
- Deferred: L1-badges-a11y (the setup-vs-add same-name-under-search NIT).
- Expert review (one pass): a senior reviewer subagent. Verdict CLEAN/APPROVE — HSL-measured: gated now
  hue 209/sat 12% (cool, muted) vs Legacy hue 14/sat 100% (warm, the colored bar) — genuinely distinct
  per D2; Legacy unchanged; de-dup isolated; test sound. NIT: the muted family (gated/pending/docs/
  inspector) is color-undifferentiated by design (the word differentiates; only Legacy owns color).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (890), `pnpm build`.

### L1-hysteria-wording (resolves L2 H5/H6) — PR #114
Status: implemented 2026-05-29 in `atomic/l1-hysteria-wording`; merged in PR #114.
- What changed (per the L1-vocab sign-off "keep Legacy, fix wording"): the 2 Inspector banners + the 2
  `hysteria-v1-deprecated`/`inbound-hysteria-v1-deprecated` diagnostic messages claimed Hysteria v1 was
  "deprecated upstream" / "the official docs recommend migrating" — false (upstream `deprecated.md`
  doesn't formally deprecate v1). Reworded to sbcv's accurate opinionated stance: "Hysteria v1 is legacy
  — prefer `hysteria2` for new deployments." The Legacy TREATMENT is intentionally KEPT: the diagnostic
  CODES, the Palette `deprecatedKinds` pill, and the banner `kind="deprecated"` visual are unchanged.
- Tests: migrated the `app.test.tsx` banner assertion (`/Hysteria v1 is deprecated/`→`/legacy/`); the
  `domain.test.ts` diagnostic-CODE assertions are unchanged (codes kept).
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE/clean — false attribution gone
  from both banners + both diagnostic messages, Legacy treatment (codes/pill/banner-kind) intentionally
  kept, tests consistent. NIT (deferred follow-up L1-hysteria-tooltip): the GENERIC `deprecated`-status
  Palette tooltip still says "deprecated by sing-box" — accurate for block/dns-fakeip (upstream-deprecated)
  but the same false-upstream class for hysteria-out; a fix needs a kind-aware tooltip (out of this
  banner+diagnostic-scoped atomic).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (890), `pnpm build`.

### L1-target-glossary (topbar copy) — PR #115
Status: implemented 2026-05-29 in `atomic/l1-target-glossary`; merged in PR #115.
- What changed: the "Sing-box target" selector had no explanation. Added a `title` tooltip: "Stable
  (1.13) is the released version; testing (1.14) has newer features not yet in stable — pick the one
  your sing-box binary runs."
- Tests: `tests/target-glossary-tooltip.test.tsx` (tooltip mentions stable/1.13 + testing/1.14).
- Expert review (one pass): a senior reviewer subagent. Verdict CLEAN/APPROVE — tooltip accurate vs the
  channel/target model (targets.ts/useProjectStore), title-only (no logic), non-tautological test. FYI:
  omits the 1.12-Legacy option (reasonable — explains the two main channels).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (891), `pnpm build`.
