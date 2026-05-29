# Node-Card Redesign — Execution Plan

Run with:

```txt
/goal execute the node-card redesign --spec docs/goals/node-card-redesign-execution.md
```

A focused canvas-UX initiative addressing three concrete node-card problems the user raised, **planned first** (per request) and grounded in deep code + upstream-doc research (5 expert investigations, 2026-05-29). Sibling of [`ux-language-affordances-execution.md`](ux-language-affordances-execution.md); same process (test-first, one-pass senior-reviewer gate, squash-PR-per-atomic, devlog).

## The three problems (user, with screenshots)

1. **Port columns are noisy.** A node shows a long vertical strip of port SVGs on its edge — most are *unconnected* "available" ports. Want: **by default show only ports that HAVE a connection**, vertically centered on the card edge; reveal the other compatible ports **on demand** (during a connect-drag / on hover / via expand).
2. **Downstream candidate grid overflows.** Expanding a node's downstream "+" shows a large 2-column grid of `+ Direct / + Block / …` chips (e.g. 18 for a selector/urltest group) that overflows the card. Want: **unify into the existing searchable popover** (`ChipPickerPopover` — a drag-out search box with a scrollable icon+name list).
3. **Card chrome.** (a) The center "+" auto-links to `compatible[0]` — over-design; **remove it** (right-side ports + the picker already cover "add downstream"). (b) Bottom-toolbar typography is inconsistent — esp. the bottom-right count "18" is several sizes too big; **unify the type scale.**

## Research findings (grounding — full reports in the devlog/PR threads)

### Code mechanism (current)
- **Ports** (`SbcNode.tsx:118-159, 207-325`): derived per-render from `portEndpointsForNode(kind,type,dir)` — the FULL set of *possible* ports, with **no notion of connectivity** at render. Connectivity already exists in `data.connectedPorts` (computed by `annotateConnectedPorts` in `graph.ts:349-364`). Per-port `connected`/`isCompatible`/`isPending` flags already computed (`:209-212,269-272`). The left/right columns are **already vertically centered** (`styles.css:1080-1090`, `top:50%; translateY(-50%)`) — fewer children stay centered automatically.
- **React Flow constraint (load-bearing):** handles must stay in the DOM to anchor edges (the codebase never calls `updateNodeInternals`). So **connected ports must never be hidden**, and hidden (unconnected) ports should be **CSS-collapsed, not unmounted** — preserves edge anchoring, RF handle measurement, the `connectionRadius=54` snap, and existing test selectors (`tests/port-interaction-destructive.test.tsx` queries `[data-port-type]`).
- **Two pickers, no shared source:** (A) the overflowing grid is `sbc-node__actions`/`node-chip` (`SbcNode.tsx:386-399`, CSS `styles.css:1491-1535`), mapping `data.compatible: string[]` labels → `createCompatible(id,label)` (a label-switch in `useProjectStore.ts:1000-1071`). (B) `ChipPickerPopover.tsx` (search + scroll + icon list, bounded via `boundedPickerPlacement`) is already used for the **drag-to-empty-canvas** flow (`CanvasWorkspace.tsx:341-385,477-486`), feeding structured `chipCandidatesForPending` → `createNodeAndConnect`. B is the better path (port/handle-scoped, structured).
- **Center "+"**: `sbc-node__add` (`SbcNode.tsx:335-348`, CSS `styles.css:1416-1428`) — calls `createCompatible(id, data.compatible[0])`. No test/e2e references it. Fully redundant with the hover chips + the right-side ports.
- **Toolbar typography root cause:** `.sbc-node-primary` (`styles.css:1474-1484`) is the only toolbar control with explicit type — **`font-size:18px; font-weight:860`** — while the sibling pill texts inherit the **16px** browser default at weight 760. No font tokens exist anywhere. (Title 22/760, titlebar 13/760, subtitle 13, chip 11.)

### Upstream truth (for picker candidate correctness)
- The canvas `portRelationRegistry.ts` (~33 relations) is a **hand-picked subset**; `referenceRegistry.ts` (the rename/delete cascade model) is far more complete and closer to the 52-reference upstream model. Per-port candidate sets MUST follow upstream, esp. the **filtered** ones:
  - dial/detour ports → all outbounds **+ endpoints** (endpoints share the outbound namespace), minus self; suppress on no-dial kinds (block/dns/selector/urltest, hosts/fakeip).
  - resolver / `domain_resolver` ports → **DNS servers only** (a whole edge class the canvas currently doesn't draw).
  - rule_set ports → rule-sets only (list); inbound-matcher ports → inbounds only (list).
  - **`inbounds[*].detour` → only *injectable* inbounds**; **ssm-api `servers` → only `managed:true` shadowsocks inbounds**; **endpoint-typed ports → only `tailscale` endpoints**; **resolved `service` → only `resolved` services**; http_client/certificate_provider ports → string-tag OR inline object.
- **Legacy/deprecated** (for the legacy treatment, ties into the UX-language goal): removed-in-1.13 `dns`/`block`/`wireguard` outbounds; removed-in-1.14 legacy DNS server; `download_detour`→`http_client`; geoip/geosite. Editor `deprecatedKinds` currently misses `dns-out`/`wireguard-out`.

## Phases & Atomic Queue

### Phase N1 — Port column: connected-by-default, reveal-on-demand
> **Implemented as one coherent unit with N2-remove-grid (coupled). The plan's DN-1 mechanism changed
> during execution.** Connected ports render in the centered flow column; UNCONNECTED ports render in an
> absolute `.sbc-node__ports-extra` overlay, hidden until the node is hovered or the port is a live
> drop-target during a drag. **Key correction:** `updateNodeInternals` is NOT used (it was actively
> harmful — it raced the canvas initial fitView, throwing nodes off-screen in the heavy multi-import
> e2e). React Flow reads handle positions live at interaction time, so the absolute overlay (connected
> ports never move on reveal) needs no re-measure; reveal is pure CSS. Verified: 940 jsdom + 16/16
> Playwright e2e green (e2e is the only thing that can verify the visual collapse/reveal + fit — jsdom
> doesn't apply stylesheet CSS).
- [x] N1-connected-default — connected ports (per `data.connectedPorts`) render in the centered flow
  column; unconnected ports go to the hidden `.sbc-node__ports-extra` overlay; all ports stay mounted.
  dns-rule action suppression + aggregate disconnect rules preserved.
- [x] N1-reveal-on-drag — overlay ports with `is-compatible`/`is-pending` reveal during a connect-drag
  (pure CSS) so they're droppable; the picker's source port stays revealed while its picker is open
  (CanvasWorkspace keeps `pendingPortKey` on `chipPicker.source`).
- [x] N1-reveal-on-hover — `.sbc-node-shell:hover .sbc-node__ports-extra .sbc-port` reveals the overlay
  (pure CSS; subtree `:hover` covers the out-of-box ports). Outgoing-drag affordance from unconnected ports.
- [x] N1-tests — `tests/node-port-visibility.test.tsx` (connected→primary, unconnected→overlay) + migrated
  `e2e/port-click-redesign.spec.ts` to the reveal model (hover-to-reveal before drag; measure targets
  mid-drag; fit-then-reveal for the now-horizontal edge-remove button; node-body drop for invalid).

### Phase N2 — Unified searchable downstream picker
- [x] N2-picker-trigger — the unconnected-port "+" is now a button (`.sbc-port__add`) that opens the
  searchable `ChipPickerPopover` port-scoped, via a new `openPortPicker(nodeId, handleId)` channel on
  `canvasInteractionContext` (mirrors `disconnectPort`). CanvasWorkspace builds the pending port from the
  port's DOM rect → `chipCandidatesForPending` → anchors the picker just outside the node (left of an
  input port, right of an output), drawing the connector line; picking runs `createNodeAndConnect`. The
  open/placement needs RF's flow-coordinate system, so the click→pick→create flow is an e2e
  (`port-click-redesign.spec.ts`); a jsdom test guards the affordance + aria-label. — PR #131
- [x] N2-remove-grid — deleted the overflowing `sbc-node__actions`/`node-chip` candidate grid (+ CSS).
  The node-delete button moved into the toolbar (hover/selected-gated via `.sbc-node__delete` so it can't
  be clicked by accident). The count pill stays (DN-5). `createCompatible` dropped from SbcNode (store
  action + its coverage test stay for N2-compatible-retire). — shipped with N1
- [x] N2-candidate-correctness — an agent audit of the picker's candidate generator
  (`chipCandidatesForPending` → `candidatesForEndpoint`/`endpointMatchesNode` → `createNodeAndConnect`)
  found the per-port sets already **sound: 0 dead candidates, 0 upstream-invalid** — the filtering is
  correct (resolver→DNS-servers-only, rule_set→rule-sets-only, ssm-api→managed shadowsocks inbound,
  endpoint-typed→tailscale-only, resolved→resolved-only, dial/detour→full outbound namespace minus
  self/block; every offered kind is handled by `createNodeAndConnect`). No fix needed; the gap was that
  the generator was untested. Exported `chipCandidatesForPending`/`PendingPort` and added
  `tests/picker-candidate-correctness.test.ts` to guard the per-port filtering against regressions. — PR #132
- [ ] N2-compatible-retire — retire `data.compatible` string-label path + `createCompatible`/`outboundTypeForChipLabel` IF no longer used (or keep a count-only source for the toolbar pill); migrate `tests/compatible-chip-coverage.test.ts` + `tests/app.test.tsx` callers to `createNodeAndConnect`.

### Phase N3 — Card chrome cleanup + typography unification
- [x] N3-remove-center-plus — removed the center "+" (`sbc-node__add` JSX + CSS). — PR #97
- [x] N3-toolbar-typography — node type-scale custom props on `.sbc-node-shell` (`--node-title-size:22px`, `--node-secondary-size:13px`, `--node-micro-size:11px`, `--node-strong-weight:760`); `.sbc-node-pill` gets explicit `13px`; `.sbc-node-primary` `18px/860 → 13px/760` (fixes the oversized "18"); titlebar/title/subtitle/chip re-pointed at the tokens (value-neutral). — PR #98

### Phase N4 — (appendix / separate effort) connection-model completeness
The upstream study found the canvas relation set is missing whole edge classes (resolver/`domain_resolver`, http-client refs, inbound→inbound chain, selector/urltest `default`, certificate_provider TLS, inbound dialer detours, derp mesh/verify detours, tun rule-set sets, v2ray_api stats). **This is a larger correctness effort, NOT part of the visual redesign** — queued here for visibility; prioritize separately. `referenceRegistry.ts` already encodes most of these and is the blueprint; the one reference missing from both is `tls.reality.handshake.detour`.

## Decisions (recommended — confirm/adjust before N1/N2 execution)
- **DN-1 Hidden ports = CSS-collapse, kept in DOM** (not unmount). Preserves RF edge anchoring/measurement + test selectors. *Recommended; low-risk.*
- **DN-2 Reveal triggers = drag (required) + hover (CSS, cheap).** Explicit expand-chevron optional/deferred. *Recommended.*
- **DN-3 Picker = port-scoped** (one handle → its candidates), reusing the drag-to-empty machinery, opened by a port "+" click. *Recommended over node-scoped.*
- **DN-4 Center "+" removed; grid removed; picker is the single downstream-add path.** *Per user.*
- **DN-5 Keep the toolbar count pill** (informative "N compatible") but at the unified 13px/760; compute its count from the candidate generator if `data.compatible` is retired. **✅ CONFIRMED by user 2026-05-29** (keep count, unify font).
- **DN-6 Type scale = 22 title / 13 secondary (titlebar, subtitle, all toolbar pills incl. count) / 11 micro.** *Recommended.*
- **DN-7 Scope boundary:** N1–N3 are the visual redesign; N4 (relation completeness) is a separate goal. *Recommended — don't balloon the redesign.*

## Open questions for the user

### OQ-1 — Do unconnected editable ports still start an outgoing connect-drag, or is the picker the only add path?
Key nuance: there are **two distinct actions** a port supports — (a) **connect to an EXISTING node** (drag a wire from the port to another node) and (b) **create a NEW downstream node + connect** (the picker). The picker (N2) only does (b).
- **Option A — picker-only** (no drag from unconnected ports; "+" → picker is the sole add path).
  - Pros: simplest single mental model; hover-reveal becomes optional polish; fewest hidden-handle/measurement worries; scales to many candidates.
  - Cons: **loses "connect to an existing node by dragging a wire"** from a collapsed port — unless the picker is extended to also list existing nodes as targets (extra work). Drops a conventional canvas gesture.
- **Option B — hover/drag-reveal + picker** (unconnected ports reveal on hover → draggable to existing nodes; "+" → picker for new nodes). *Recommended.*
  - Pros: keeps BOTH gestures (wire-to-existing AND create-new); matches canvas conventions; the reveal is cheap CSS since handles stay mounted.
  - Cons: hover-reveal is then required (not optional); hidden handles must stay measured (already the DN-1 plan).

### OQ-2 — Do readonly/decorative structural ports (route↔inbound hub, rule order) also collapse by default?
Note: a readonly port's "connected" state already means *the structural relationship exists* (e.g. route↔inbound is "connected" when inbounds exist), so under a connected-only rule they appear exactly when relevant.
- **Option A — collapse them too** (show only when their structural link is live). *Recommended.*
  - Pros: one consistent rule; maximal de-noise; they still show whenever the structure actually exists.
  - Cons: the node's "shape/role" isn't always advertised when empty (minor — the titlebar already states kind·type).
- **Option B — always show structural ports** (collapse only editable ones).
  - Pros: stable structural affordance; node role always visible.
  - Cons: re-introduces the noise we're removing; two different rules (editable vs structural).

### OQ-3 — Toolbar count pill — RESOLVED ✅
User decision (2026-05-29): **keep the count pill, just unify its font** (DN-5 confirmed). Only the size was the problem.

## Running TODO
(Mirror of the queue; tick as merged.)

## Decision Log
- **2026-05-29 — DN-5 confirmed (user):** keep the toolbar compatible-count pill; the objection was its *size* (18px/860), not its presence. N3 unifies it to the secondary scale (13px/760) without removing it.
- **2026-05-29 — FULL PLAN APPROVED (user "全案你的推荐走"):** all recommendations adopted.
  **OQ-1 = Option B** (unconnected editable ports reveal on hover/drag → still draggable to existing
  nodes; the port "+" opens the searchable picker for new nodes — both gestures kept). **OQ-2 = Option
  A** (readonly/decorative structural ports also collapse by default; they reappear when their
  structural link is live). DN-1..DN-7 as recommended. The plan is now fully executable.

## Milestone Notes

### N3-remove-center-plus (canvas) — PR #97
Status: implemented 2026-05-29 in `atomic/node-remove-center-plus`; merged in PR #97. First node-card atomic.
- What changed: removed the big center "+" button (`sbc-node__add`) from the node card. It auto-linked
  to `data.compatible[0]` (over-design — silently picked the first candidate). The right-side downstream
  ports + the hover candidate affordance already cover "add downstream"; `Plus`/`createCompatible` stay
  used elsewhere (port affordance, hover chips) so no orphaned imports. Deleted the orphaned
  `.sbc-node__add` CSS.
- Tests: `tests/node-center-plus-removed.test.tsx` (no `.sbc-node__add` / no "Add from" button even for
  a node with compatible candidates).
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, clean — no blockers/should-fix.
  Confirmed the JSX removal is well-formed, `Plus`/`createCompatible` stay used (no orphaned imports),
  no dangling `.sbc-node__add` refs anywhere, no behavior regression (per-port "+" + hover chips cover
  add-downstream), and the test is non-tautological (the urltest node genuinely has compatible>0).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (874), `pnpm build`, `pnpm e2e` (14).

### N3-toolbar-typography (canvas CSS) — PR #98
Status: implemented 2026-05-29 in `atomic/node-toolbar-typography`; merged in PR #98.
- What changed: the bottom-toolbar count pill rendered `18px/860` while its neighbour pills inherited
  the 16px browser default (no font tokens existed) — the user's "18 字体大了好几号" complaint.
  Introduced a node type-scale via CSS custom props on `.sbc-node-shell`
  (`--node-title-size:22px`, `--node-secondary-size:13px`, `--node-micro-size:11px`,
  `--node-strong-weight:760`). The real fixes: `.sbc-node-pill` now sets explicit `13px` (was the
  accidental 16px inherit) and `.sbc-node-primary` drops to `13px/760` (was `18px/860`). Titlebar/
  title/subtitle/`.node-chip` re-pointed at the tokens (value-neutral — same sizes, now centralized).
  Leading-glyph sizes are JSX `size` props, left as-is.
- Tests: new e2e in `editor.spec.ts` measuring computed `font-size` — asserts the count pill is `13px`
  and equal to the type pill (jsdom can't compute font-size, so this is e2e). Testids/classnames
  preserved so `node-status-icon.test.tsx` / `external-fixtures.spec.ts` stay green.
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, clean — no blockers/should-fix.
  Verified value-neutrality byte-for-byte against main (only real changes: pill 16-inherit→13, primary
  18/860→13/760), custom-prop inheritance (all referencing elements are descendants of `.sbc-node-shell`,
  no portals), no regression to the pinned `.sbc-node-primary`/`node-bottom-toolbar` tests, and the e2e
  font-size assertion is non-flaky (route:main always renders both pills). Two optional nits (var()
  fallbacks; token coupling) deemed unnecessary.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (874), `pnpm build`, `pnpm e2e` (15).
