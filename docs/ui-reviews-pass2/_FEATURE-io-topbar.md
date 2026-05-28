# Feature UX review — Import/Export & TopBar
<!-- reviewer: principal PM + FE; lens: can a new user understand & succeed; source: our code + UX principles -->

## Feature inventory
- Brand button "sbcv.app — return to home" — calls `goHome` — `src/components/TopBar.tsx:124-152`
- Target selector (channel+version dropdown) — `setTarget` — `src/components/TopBar.tsx:154-167`
- Check button (runs local `validateNow` + `runOfficialCheck`) — `src/components/TopBar.tsx:168-171`, `runCheck` at `:93-96`
- Status pill (valid/warning/invalid/checking; opens DiagnosticsPopover) — `src/components/TopBar.tsx:172-198`
- Export button (download config as `sbcv_<date>_<time>.json`) — `exportConfig` `src/components/TopBar.tsx:98-107`, `:199-202`
- Import button (hidden file input, `accept=.json`, 10MB cap) — `handleImport` `src/components/TopBar.tsx:109-120`, `:203-214`
- Mobile equivalents: Import/Export/Templates — `src/components/MobileMenuSheet.tsx:26-50,75-106`
- Serialization: `createConfigExport`/`stringifyConfig` (strips `undefined`, 2-space JSON) — `src/domain/serialization.ts:32-42`
- Import parse: `parseConfigJson` → `normalizeConfig` (`structuredClone`, must be a JSON object) — `src/domain/serialization.ts:25-46`
- Store import: `importJson` (replaces config, wipes layout, resets selection) — `src/state/useProjectStore.ts:1532-1550`
- JSON panel "Apply"/"Refresh" (alt import/export-to-textarea path) — `src/components/InspectorPanels.tsx:59-82`; `applyJsonDraft` `useProjectStore.ts:1514-1531`
- Templates/presets + minimal config (full-config replacement) — `useProjectStore.ts:675-706`
- Official validator call (`VITE_OFFICIAL_CHECK_URL`/check) — `useProjectStore.ts:1572-1656`

## UX findings (prioritized)

- **[P0] Import silently destroys all current work — no confirmation.** `importJson` replaces the entire config and wipes `layout` (`useProjectStore.ts:1532-1535`); the Import button fires the file picker directly (`TopBar.tsx:203-206`) with no "this replaces your current config" guard. A first-time user who has built nodes and clicks Import to "add" a file loses everything. Same for mobile (`MobileMenuSheet.tsx:84-89`) and Templates ("Replace config with a preset", `MobileMenuSheet.tsx:80`). No undo exists (no undo/redo action in the store) — the loss is permanent.

- **[P0] Import success/failure is essentially invisible — no toast/feedback.** There is no toast/notification/`aria-live` surface anywhere in `src/`. On a *successful* import the view re-fits (`freshLoadToken`, `CanvasWorkspace.tsx:87-89`); but on a *parse error* `importJson` only injects one diagnostic and does NOT bump `freshLoadToken` (`useProjectStore.ts:1536-1549`) — so the canvas doesn't move, no message appears, and the only signal is the status pill quietly turning red (`TopBar.tsx:78`). A new user who pastes a malformed/non-JSON file gets no clear "import failed" message and may think nothing happened. The single `alert()` exists only for the 10MB size cap (`TopBar.tsx:114`).

- **[P1] No validation gate before Export.** `exportConfig` downloads whatever is in state regardless of diagnostics (`TopBar.tsx:98-107`); there is no error count check. A user can export an invalid config (pill red) and not realize it until sing-box rejects it. At minimum, warn-on-export when `diagnostics` contains errors.

- **[P1] "Export" labeling/discoverability is generic and the filename is opaque.** The button is just "Export" with a download icon (`TopBar.tsx:199-202`); a new user may not know it yields a sing-box `config.json`. The downloaded name is `sbcv_20260528_120102.json` (`createSbcvFileName`, `TopBar.tsx:16-20`) — branded but not obviously the runnable `config.json` sing-box expects. Consider "Export config.json" / tooltip.

- **[P1] Cold start has no onboarding — user can't tell "import vs. build".** Initial state loads a populated `STABLE_TUN_SPLIT_CONFIG` template (`useProjectStore.ts:620`, `commands.ts:27-29`); there is no empty/welcome state and no hint pointing at Import or Templates. A first-time user lands on a pre-built graph with no explanation of whether it's theirs, an example, or how to start fresh. There is also no "New / Clear" action — the only ways to reset are Templates or Import (both unguarded, see P0).

- **[P2] "Return to home" is misleading — it only re-fits the viewport.** `goHome` clears selection and bumps `freshLoadToken` to fit-view (`useProjectStore.ts:653-658`); it does not return to any home/landing screen or reset the project. Users expecting a home/dashboard (or a reset) will be confused. Rename to "Fit to view" or give it real home semantics.

- **[P2] Round-trip fidelity is good but undocumented.** `normalizeConfig` does `structuredClone` of the parsed object (`serialization.ts:29`), so fields/types the editor doesn't model are preserved through export (only `undefined` keys are stripped, `serialization.ts:9-23`). This is the right behavior, but nothing tells the user "unknown fields are preserved", and the JSON panel only says "Layout metadata is never exported" (`InspectorPanels.tsx:64`). A short reassurance ("unrecognized fields are kept on export") would build trust for users importing hand-written configs.

- **[P2] Two parallel import/export paths can confuse.** TopBar Import/Export (file-based) and the JSON panel Apply/Refresh (textarea-based, `InspectorPanels.tsx:66-80`) do overlapping things with different words ("Apply" vs "Import", "Refresh" vs "Export"). A new user won't connect that the JSON panel is also an import/export surface.

## New-user verdict
A first-timer can get valid JSON out (Export works, round-trip fidelity is actually solid), but the entry experience is risky and quiet: Import wipes all current work with no confirmation and no undo, and both success and failure are nearly invisible because there's no toast — failed imports give almost no feedback. With no onboarding and a "home" button that only re-fits the view, a new user can't tell whether to import or build, and can destroy their config in one misread click.

SUMMARY: 2 P0, 4 P1, 3 P2.
