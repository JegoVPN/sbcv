# Feature UX review — Diagnostics & Targets
<!-- reviewer: principal PM + FE; lens: can a new user understand & act; source: our code + UX principles -->

## Feature inventory
- Semantic validator producing error/warning `Diagnostic`s with `code`, `path`, `message` — `src/domain/diagnostics.ts:18` (`validateConfig`); ~140 distinct codes.
- Severity summary helper (valid/warning/error) — `src/domain/diagnostics.ts:1672` (`summarizeDiagnostics`).
- Diagnostic-path → canvas-node mapping for click-to-focus — `src/domain/diagnosticTargets.ts:12` (`nodeIdForDiagnosticPath`).
- Target catalog: `1.13 stable`, `1.12 Legacy`, `1.14 testing`, each with a `channel` (stable/testing) + `version` + binary — `src/domain/targets.ts:11`.
- Channel concept drives gating; only `stable`/`testing` is passed to the validator — `src/state/useProjectStore.ts:134` (`computeDiagnostics` → `validateConfig(config, channel)`).
- Target selector dropdown (desktop) + global status pill + Check/Export/Import — `src/components/TopBar.tsx:154` (select), `:172` (pill), `:199` (Export).
- Mobile status pill (no target selector here) — `src/components/MobileTopBar.tsx:91`.
- Diagnostics popover: sorted list (error→warning→info), per-row code/path/message, official badge, optional focus button — `src/components/DiagnosticsPopover.tsx:28`.
- Per-node status (valid/warning/error) derived from path prefix — `src/canvas/graph.ts:80` (`diagnosticStatus`); node badge/border render — `src/components/SbcNode.tsx:298`, `:386`, `:412`.
- Node footer "primary" chip: checkmark + a number — `src/components/SbcNode.tsx:427`.
- Official binary check (real sing-box for the selected version) — `src/state/useProjectStore.ts:1572` (`runOfficialCheck`).

## UX findings (prioritized)

- **[P0] Version is never validated; the selector lies.** `computeDiagnostics` passes only `channel` to `validateConfig`, never `version` — `src/state/useProjectStore.ts:134-135`. So `1.12 Legacy` and `1.13 stable` produce byte-identical diagnostics. The known gap is real: a config using 1.13+ fields exported onto **1.12** gets no warning. Worse, the inverse is a *false positive*: `endpoint-tailscale-advertise-tags-1-13-only` / `-system-interface-1-13-only` (`src/domain/diagnostics.ts:1180-1202`) and `settings-certificate-store-chrome-testing-only` (`:1060`) fire on **1.13 stable** even though 1.13 supports them — their own messages say "Stable 1.12 targets reject it", yet they warn on 1.13. A new user who picks the version expects validity to track that choice; it silently does not.

- **[P0] Warning-state nodes look valid at a glance.** The node summary icon and the footer status pill both render `status === "error" ? CircleAlert : CheckCircle2` — `src/components/SbcNode.tsx:386` and `:413`. So a node with deprecation/version warnings shows a green checkmark; only a subtle amber border distinguishes it (`.sbc-node--warning`, `src/styles.css:1037`), and the `sbc-node__status` chip stays green-on-error-only (`:1241`). A first-timer scanning the canvas cannot tell which nodes have warnings — the dominant signal says "fine".

- **[P1] The footer "✓ N" chip is not a validity count.** `src/components/SbcNode.tsx:436` renders `data.compatible.length || 1` behind a CheckCircle2 icon. The number is "how many node kinds you can add from here", but the green check + number reads as "N checks passed" / "N issues". This is the prompt's "valid / N" confusion: the glyph implies validity, the number means something unrelated, and there is no label.

- **[P1] Export has no validity gate or warning.** `exportConfig` (`src/components/TopBar.tsx:98`) and `createConfigExport` (`src/domain/serialization.ts`, no diagnostics import) download regardless of errors; the Export button has no `disabled`/confirm tied to `status`. A new user can export a config sing-box will refuse to start, with zero friction. There is no single "ready to export" affirmation beyond the small pill.

- **[P1] Mobile diagnostics aren't actionable.** `MobileTopBar` renders `DiagnosticsPopover` without `resolveFocusTarget`/`onFocus` — `src/components/MobileTopBar.tsx:108-113`. On mobile, rows are read-only; tapping an error does nothing, so "what's wrong / where" loses its only navigation. Desktop wires both (`TopBar.tsx:189-196`).

- **[P1] Official-validator findings can't be focused.** `runOfficialCheck` pushes diagnostics with `path: ""` (`src/state/useProjectStore.ts:1599`,`:1608`,`:1617`), and `nodeIdForDiagnosticPath("")` returns `null` (`diagnosticTargets.ts:13`), so the only check that runs the *real* binary for the selected version yields non-clickable rows. Also `runOfficialCheck` is a no-op when `VITE_OFFICIAL_CHECK_URL` is unset (`:1573-1574`) — most users' "Check" only runs the channel-gated local pass, compounding the P0.

- **[P2] No glossary for stable/testing/Legacy; labels are inconsistent.** Dropdown shows `1.13 stable`, `1.12 Legacy`, `1.14 testing` (`src/domain/targets.ts:12-14`) — mixed casing, and "Legacy" vs "stable" vs "testing" is never explained. A new user has no idea whether to pick 1.13 or 1.14, or that "testing" unlocks/forbids features. No tooltip or helper text accompanies the selector (`TopBar.tsx:154`).

- **[P2] `code` is the most prominent text per row; messages bury the action.** Each row leads with the raw code e.g. `endpoint-tailscale-advertise-tags-1-13-only` (`DiagnosticsPopover.tsx:124`) above the human message (`:132`). Many messages are actionable ("Migrate to…") but several only state the fact (e.g. `no-outbounds` "No outbounds are configured." `diagnostics.ts:1494`) without a next step, and the dev-facing code dominates the visual hierarchy.

- **[P2] Discoverability of diagnostics is thin.** The only entry point is the small status pill; when everything is "Valid" there's no hint a diagnostics surface exists, and the pill is non-interactive while checking (`TopBar.tsx:89`,`:181`). The empty-state copy also drifts ("the selected target" vs "the editor", `DiagnosticsPopover.tsx:102`), exposing the same channel-vs-target ambiguity.

## New-user verdict
A newcomer gets a friendly green/amber/red pill and a clickable error list on desktop, which is a solid start — but the canvas hides warnings behind a checkmark, the "✓ N" node chip is meaninglessly numeric, and nothing stops them exporting a broken config. Most damaging, the target selector implies version-aware validation that does not exist (1.12 vs 1.13 are identical, with both false negatives and false positives), so users can't trust that picking a version protects them. They would understand *that* something is wrong, but often not *where*, *how to fix it*, or *whether their chosen version is actually safe*.

SUMMARY: 2 P0, 4 P1, 3 P2.
