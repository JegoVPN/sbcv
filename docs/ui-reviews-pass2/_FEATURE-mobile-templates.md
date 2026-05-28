# Feature UX review — Mobile & Templates/Onboarding
<!-- reviewer: principal PM + FE; lens: can a new mobile user understand & succeed; source: our code + UX principles -->

## Feature inventory

Mobile shell & breakpoint
- `useViewport` switches mobile/desktop at `(max-width: 768px)` — `src/components/useViewport.ts:3`
- Mobile shell renders only TopBar + Canvas + Inspector sheet; `Palette` is omitted — `src/App.tsx:13-22`
- Desktop shell renders Palette + Canvas + Inspector — `src/App.tsx:25-34`

Mobile top bar
- Brand button = "go home" (re-fits view, does NOT clear config) — `src/components/MobileTopBar.tsx:66-88`, `src/state/useProjectStore.ts:653-658`
- Center status pill opens diagnostics popover — `src/components/MobileTopBar.tsx:90-115`
- "Run check" icon button (FileCheck2) — `src/components/MobileTopBar.tsx:118-126`
- "Open menu" icon button (MoreHorizontal) — `src/components/MobileTopBar.tsx:128-138`

Bottom sheet primitive
- Snap points peek/mid/full = 25/55/92vh; drag handle; backdrop tap + Esc to close — `src/components/BottomSheet.tsx:7,90-116`
- Body scrolls ONLY at `full` snap (`--scroll` modifier); `overflow:hidden` otherwise — `src/components/BottomSheet.tsx:110`, `src/styles.css:2123-2133`

Mobile sheets
- Menu sheet: Target `<select>`, Templates, Import JSON, Export — `src/components/MobileMenuSheet.tsx:52-107`
- Templates sheet: 9 presets, label + `channel · version` — `src/components/MobileTemplatesSheet.tsx:19-37`
- Inspector sheet: opens when a node is selected; wraps `<Inspector compact />` in own scroll container — `src/components/MobileInspectorSheet.tsx:9-20`, `src/styles.css:2247-2251`

Canvas on touch
- Mobile disables node drag, edge focus, delete key; forces `panOnDrag`; hides minimap, zoom, select/pan/minimap controls — `src/components/CanvasWorkspace.tsx:130-178`
- Tap node → select → opens inspector sheet — `src/components/CanvasWorkspace.tsx:115`, `MobileInspectorSheet.tsx:11`
- Connecting = drag from a port `Handle` (40px hit area) — `src/components/SbcNode.tsx:326-337`, `src/styles.css:1191-1201`
- In-node actions (+compatible chip, delete) live in hover/selected-only toolbar — `src/components/SbcNode.tsx:392-465`, `src/styles.css:1362-1372`

Templates / first-run
- Initial config = full TUN split example (not empty) — `src/state/useProjectStore.ts:620,625`
- `TEMPLATE_PRESETS` (9) carry `label/channel/version/config/docsUrl` — `src/domain/templates.ts:1330-1403`
- No empty/onboarding canvas state exists (`.empty-state` is an Inspector-internal style only) — `src/styles.css:1648`

## UX findings (prioritized)

- **[P0] No way to add a node on mobile.** Adding nodes requires either the `Palette` (`createFromPalette`, not rendered on mobile — `src/App.tsx:13-22`, `src/components/Palette.tsx:472-476`) or the in-node "+ compatible" chips, which are inside the hover/selected-only toolbar (`src/components/SbcNode.tsx:392-465`; opacity:0 unless `:hover`/`.is-selected` — `src/styles.css:1362-1372`). On touch there is no hover, and tapping a node opens the full inspector sheet rather than revealing the chips inline. A first-time mobile user can load a template but cannot build or extend a config from scratch. This is not communicated anywhere.
- **[P0] Connecting nodes on touch is effectively undiscoverable/unreliable.** Connections require dragging from a `Handle` (`src/components/SbcNode.tsx:326-337`), but the handle is `opacity:0` (`src/styles.css:1198`) and the visible port button swallows taps via `onClick stopPropagation` (`SbcNode.tsx:322-324,360-362`). Node dragging is disabled on mobile (`CanvasWorkspace.tsx:130`) but `panOnDrag` is forced true (`:134`), so a finger-drag starting on a port competes with canvas panning. There is no touch-friendly "connect" mode and no hint that the canvas is desktop-oriented.
- **[P0] No empty/first-run/onboarding state.** A brand-new user lands directly on the dense TUN-split graph (`src/state/useProjectStore.ts:620,625`) with ~10 interconnected nodes, no welcome, no "what is this / start here," and (per above) no obvious way to act. `goHome`/brand only re-fits the view; it never offers a clean start (`src/state/useProjectStore.ts:653-658`). First impression is "I'm looking at someone else's finished file," not "I can begin."
- **[P1] Menu & Templates sheets clip their content (scroll trap).** Both open at `mid` (55vh) — `MobileMenuSheet.tsx:53`, `MobileTemplatesSheet.tsx:20` — but `bottom-sheet__body` is `overflow:hidden` except at `full` snap (`src/styles.css:2123-2133`). The 9-item templates list (`src/domain/templates.ts:1330`) easily exceeds 55vh on a phone, so lower presets are clipped and unreachable unless the user happens to drag the sheet to full. Unlike the inspector sheet, these sheets have no inner scroll wrapper. Either default these to `full` or give them an always-scrollable body.
- **[P1] Templates give a newcomer no basis to choose.** Each row shows only a label + `channel · version` (`src/components/MobileTemplatesSheet.tsx:29-32`); desktop at least exposes a per-item "Docs" link (`src/components/Palette.tsx:482-486`) which mobile drops entirely. Labels like "official client bypass no leak" vs "...dns leak" are opaque, and the `docsUrl` already present on every preset (`src/domain/templates.ts:1330-1403`) is never surfaced on mobile. No "recommended for first-timers" hint.
- **[P1] Picking a template silently destroys the current config with no undo.** Header says "Pick one to replace the current config" (`MobileTemplatesSheet.tsx:23`) but selection fires `loadTemplatePreset` immediately with no confirm and no undo (`:14-17`, store `:684`). Same for menu Import (`MobileMenuSheet.tsx:38-50`). A curious newcomer tapping to "preview" loses their work.
- **[P2] Templates ship placeholder secrets with no guidance on mobile.** Loaded presets contain `REPLACE_ME_PASSWORD` / dummy SS password (`src/domain/templates.ts:116,128,108`). On mobile the user has no Palette/Docs context and the only edit path is selecting nodes one-by-one in the inspector sheet; nothing flags "you must replace these before export."
- **[P2] Hidden destructive feature parity gap is unacknowledged.** Mobile cannot delete nodes/edges (delete key null, edge focus off, hover toolbar hidden) — `CanvasWorkspace.tsx:131,136`, `SbcNode.tsx:454-464`. Combined with no add path, mobile is effectively view + template-swap + per-field edit + export only. That is a defensible scope, but it is never stated, so users will assume the editor is broken rather than read-mostly.
- **[P2] Stranded `Selected {id}` pill on mobile.** `canvas-selection-pill` renders the raw node id whenever something is selected (`CanvasWorkspace.tsx:181`); on mobile the inspector sheet already covers selection, so this leaks an internal id (e.g. `outbound:hk`) with no action attached.
- **[P2] Mobile top-bar touch targets are 36px.** Brand, run-check, and menu buttons are 36×36 (`src/styles.css:2016-2017,2046-2047`) and the status pill is 30px tall (`:2041`), all under the ~44px touch-target guideline; they sit close together inside a pill bar (`:2002-2004`).

## New-user verdict
A first-time user on a phone can open a template and export, but cannot add a node, cannot reliably connect anything, has no delete, and is dropped into a dense pre-built graph with no onboarding — so the app reads as a viewer with a "swap whole config" button rather than an editor. The core promise (a visual editor) is desktop-only on touch, and that limitation is nowhere acknowledged. Templates themselves are unexplained, destructive on tap, and clipped behind a scroll trap, leaving even the one viable mobile path (pick a starting point) confusing.

SUMMARY: 3 P0, 3 P1, 4 P2.
