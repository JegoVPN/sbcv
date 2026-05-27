# Mobile Responsive Design — sbcv.app

Date: 2026-05-27
Status: Approved (per /goal directive)

## 1. Goal & Positioning

sbcv.app currently ships a single desktop-only layout. On phones the TopBar overflows past the viewport, nodes are unreadable, MiniMap covers a quarter of the canvas, and edit-heavy widgets (Add Library, Inspector) have no touch story. The site is reachable from mobile traffic but unusable for any task.

This spec defines a **responsive layout that switches automatically at ≤768px viewport** to a mobile-first experience positioned for **"view + lightweight editing"**:

- Users can browse the topology, inspect each node, change safe flat fields (enums / toggles / numbers / candidates), and run the same Check / Import / Export flows as desktop.
- Users **cannot** add new nodes from the Library, delete nodes, or hand-draw edges on mobile. These remain desktop-only.
- The same URL serves both layouts; layout flips live on viewport change (rotate / window resize). State in the zustand store survives the flip.

## 2. Decisions (from brainstorming Q&A)

| # | Decision | Value |
|---|---|---|
| 1 | Edit scope on mobile | **Lightweight**: enums, switches, numbers, candidates, template load; **no** Add Library / delete node / manual edge |
| 2 | Mobile viewport boundary | **`max-width: 768px`** (phone + iPad mini portrait) |
| 3 | URL / routing strategy | **Same URL, viewport-driven layout switch**; no router introduced |
| 4 | Canvas form on mobile | **React Flow, read-only** (pinch zoom + single-finger pan; `nodesDraggable=false`, no manual edge); MiniMap hidden |
| 5 | Inspector form on mobile | **Bottom sheet** with 3 snap heights (25 / 55 / 92 vh), drag-to-resize, drag-down-to-close |
| 6 | Palette on mobile | **Templates kept, Add Library hidden** (consistent with lightweight edit) |
| 7 | TopBar collapse | **`logo + status pill + Check + "···" menu`**; menu contains Target / Import / Export / Templates |
| 8 | Canvas toolbar on mobile | **Only Fit View button** (cursor/hand/+/−/map all hidden; pinch / single-finger pan / fit cover the rest) |
| 9 | Implementation path | **Single component tree + `useViewport()` hook + small set of mobile wrappers** sharing the existing business logic |

## 3. Architecture

### 3.1 Viewport hook

Single source of truth for "is this mobile?":

```ts
// src/components/useViewport.ts
export function useViewport(): { isMobile: boolean } {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined"
      && window.matchMedia("(max-width: 768px)").matches,
  );
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return { isMobile };
}
```

Mock via `window.matchMedia` stub in vitest jsdom and via `page.setViewportSize` in playwright.

### 3.2 Branch points (only 3)

1. **`App.tsx`** — picks the TopBar variant, the Inspector wrapper, and decides whether to render Palette.
2. **`CanvasWorkspace.tsx`** — disables `nodesDraggable` / `selectionOnDrag`, hides MiniMap, prunes the bottom toolbar to fit-view only when mobile.
3. **`Inspector.tsx`** — accepts a `compact?: boolean` prop; when true, hides destructive actions (trash icon, Add child row, JsonField raw editor).

Everything else — zustand store, all field renderers, `runCheck`, `exportConfig`, `importJson`, `loadTemplatePreset`, graph derivation, diagnostics, validation — stays untouched and shared.

### 3.3 New components

| File | Purpose |
|---|---|
| `src/components/useViewport.ts` | matchMedia hook returning `{ isMobile }` |
| `src/components/MobileTopBar.tsx` | Collapsed top bar: logo + status pill + Check + `···` menu |
| `src/components/MobileMenuSheet.tsx` | Bottom sheet rendered when `···` opens; contains Target selector + Import button + Export button + "Load template" entry that opens MobileTemplatesSheet |
| `src/components/MobileTemplatesSheet.tsx` | Bottom sheet listing TEMPLATE_PRESETS; tap → `loadTemplatePreset(id)` |
| `src/components/MobileInspectorSheet.tsx` | Bottom sheet wrapping `<Inspector compact />`, with 25/55/92vh snaps + drag handle |
| `src/components/BottomSheet.tsx` | Reusable shell used by MobileMenu / MobileTemplates / MobileInspector sheets; handles backdrop, snap heights, pointer drag, escape-to-close |

### 3.4 Modified components

- `App.tsx` — viewport branch (see §3.2)
- `CanvasWorkspace.tsx` — viewport branch (see §3.2)
- `Inspector.tsx` — add `compact?: boolean` prop, gate destructive + advanced UI behind it
- `styles.css` — add mobile-specific selectors prefixed `.mobile-…`; one defensive `@media (max-width: 768px)` block for cases the React branch missed (e.g. forcing `.diagnostics-popover` width)

## 4. Interaction matrix

| User action | Behaviour |
|---|---|
| Tap node | `MobileInspectorSheet` opens at 55vh mid-snap, pre-selected node id pushed into store |
| Drag sheet handle up/down | Snap to nearest of {25, 55, 92}vh; pointer release past 25vh with downward velocity → close sheet |
| Tap sheet backdrop | Close sheet (deselect node) |
| Edit a flat field in sheet | Same store action as desktop; canvas re-derives; status pill goes stale until next Check |
| Tap "···" in TopBar | `MobileMenuSheet` opens at ~50vh with Target / Templates / Import / Export rows |
| Tap Target → option | `setTarget` action; menu sheet stays open so user can adjust then close manually |
| Tap Templates → preset | `MobileMenuSheet` closes, `MobileTemplatesSheet` opens; selecting a preset calls `loadTemplatePreset` and closes both sheets |
| Tap Import | Trigger hidden `<input type="file">`; on file pick run `importJson`; close menu sheet |
| Tap Export | `exportConfig` triggers download; close menu sheet |
| Tap Check | `validateNow()` + `runOfficialCheck()` in parallel — same as desktop |
| Tap status pill | Open existing `<DiagnosticsPopover>`; on mobile the popover should anchor under the pill and clamp to `width: calc(100vw - 24px)` |
| Pinch on canvas | React Flow native zoom |
| Single-finger drag on canvas | React Flow native pan |
| Tap Fit View button | `flowRef.current.fitView({ padding: 0.2 })` |
| Tap brand logo | Existing `goHome` action (same as desktop) |
| Rotate device past 768px | `useViewport()` flips `isMobile`; React unmounts `MobileInspectorSheet` and mounts desktop `<Inspector>`; store state (selected node, config, diagnostics) preserved |

## 5. Bottom sheet mechanics

- **Snap heights:** 25vh (peek — shows tag/type/status only), 55vh (default — main fields), 92vh (almost full screen — long forms like Rule Tables, Inspector sub-tabs)
- **Drag handle:** 4px × 36px pill at top center, 16px above content
- **Backdrop:** `rgba(0,0,0,0.35)` with `backdrop-filter: blur(3px)`, dismissable
- **Pointer handling:** `onPointerDown` on handle starts drag, `onPointerMove` updates current sheet height, `onPointerUp` snaps. Use `setPointerCapture` so drag survives finger leaving handle.
- **Scroll inside sheet:** body uses `overflow: auto`, but only scrollable when sheet is at 92vh snap (avoid conflict between sheet drag and content scroll at lower snaps).
- **Escape key:** closes sheet (parity with existing diagnostics popover behavior).
- **Animation:** transform/height transitions at 220ms cubic-bezier(0.3, 0, 0, 1).

## 6. Compact Inspector rules

When `<Inspector compact />`:

- Hide the trash icon in the header (delete-node)
- Hide every "Add X" inline button (Add user, Add peer, Add rule, Add candidate)
- Hide JsonField raw-edit components (anything that renders `<JsonField>`)
- Hide AdvancedScalarFields collapsible (the "advanced" group)
- Keep: tag rename (existing store actions already cascade tag references; mobile is no different), all flat scalar fields (text/number/enum/boolean), candidates checklist, status badges, deprecated banners

Implementation: thread `compact` prop down from `<Inspector>` into the few sub-renderers that produce these elements. Where threading is too deep (>3 levels), use a `CompactContext` (React context).

## 7. Testing

### 7.1 Unit (vitest)

- `tests/use-viewport.test.tsx` — mocked `matchMedia`, hook flips on change event
- `tests/mobile-layout.test.tsx` —
  - desktop viewport → `<TopBar>`, `<Palette>`, `<Inspector>` mount
  - mobile viewport → `<MobileTopBar>`, `<MobileInspectorSheet>` mount; `<Palette>` and desktop `<TopBar>` do not mount
  - Inspector `compact` prop → trash icon / JsonField / Add row hidden

### 7.2 E2E (playwright)

- `e2e/mobile.spec.ts` (viewport 390 × 844, iPhone-like):
  1. Load app, wait for canvas
  2. Open "···" menu → tap Templates → select 1.13 community → confirm config replaced
  3. Tap Check → wait for status pill to show "Valid" or "Warning"
  4. Tap a node on the canvas → MobileInspectorSheet appears at 55vh
  5. Change one enum field → store updates
  6. Drag sheet down past threshold → sheet closes
  7. Open "···" → Export → assert download fired with correct filename pattern

- Existing desktop e2e (`e2e/editor.spec.ts`) keeps running at 1280 × 800 unchanged.

### 7.3 Manual checks

- Real iOS Safari on a 390×844 iPhone (rotate to landscape — should flip to desktop layout if width > 768px)
- Real iPad Safari (portrait 1024 → desktop; landscape 1366 → desktop; both unaffected)
- DevTools Responsive 360 / 414 / 540 / 768 / 769 sizes

## 8. Out of scope (YAGNI)

- Manual "request desktop site" toggle
- Dedicated `/m/*` mobile route
- PWA / service worker / install banner
- List view (user picked React Flow canvas)
- Node drag / manual edge support on mobile (lightweight-edit prohibits)
- Right-side drawer Inspector on mobile (we picked bottom sheet)
- Bottom sheet animations beyond a simple height transition (no spring physics, no momentum scrolling)
- Hover styling on touch devices (rely on `:active` instead)

## 9. Rollout

Single deploy; no feature flag. Cloudflare Workers Builds picks up the merge and ships. Desktop users see zero behaviour change because every branch is gated on `isMobile`. Mobile users gain the full new layout in one shot.

## 10. Open follow-ups (post-launch, not in this spec)

- iOS Safari `100vh` quirk on the bottom sheet (will probably need `100svh` or `--vh: 1%` JS fallback if reports come in)
- Touch hit-target audit on existing buttons (44pt iOS minimum) — may surface once first mobile users try editing
- Keyboard overlap when input focused at low snap — may need scroll-into-view shim
