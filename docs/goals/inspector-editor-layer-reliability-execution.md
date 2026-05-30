# Inspector Editor And Layer Reliability Remediation

## Outcome

Inspector controls are visually stable, editable, and semantically consistent across the current editable surfaces, and all top-level lazy UI layers fail gracefully instead of leaving the app blank or apparently black-screened. The completed goal should make the TUN Platform HTTP Proxy screenshot class of layout bugs impossible to reintroduce, make number/list controls predictable, and make mobile/desktop overlays show loading and failure states for delayed or failed chunks.

## Scope

In scope:

- Inspector form layout and shared fieldset styling.
- Inspector input placeholder/native-control styling where normal CSS can control it.
- Shared number/list/select parsing consistency for high-risk fields.
- Type-driven visibility for server/port/path-like fields that are currently hidden when imported configs omit the field.
- Action-aware rule table target controls that currently look editable but are scrubbed by domain normalization.
- Lazy layer reliability for mobile sheets and JSON viewer dialogs.
- Tests and E2E smoke coverage proving these paths are usable and do not blank the app.

Out of scope:

- Broad visual redesign of the canvas, topbar, or node cards.
- New sing-box node type support.
- Converting CodeMirror or native form controls to a large custom design system.
- Replacing Zustand, React Flow, Vite, or the current code-splitting strategy.
- Changing canonical JSON/domain state as the source of truth.

## Source Docs

- [AGENTS.md](../../AGENTS.md)
- [Goal-Driven Development](../goal-driven-development.md)
- [SBC React Flow R&D Plan](../sbc-react-flow-rd-plan.md)
- [sing-box Config Document Inventory](../sing-box-config-doc-inventory.md)
- [sing-box Canvas Configuration Guide](../sing-box-canvas-configuration-guide.md)
- [sing-box Config Capability Audit](../sing-box-config-capability-audit.md)
- `vercel-react-best-practices` skill for every frontend implementation/review session.

## Investigation Summary

### Inspector layout

The TUN Platform HTTP Proxy issue is not an isolated `server_port` bug. The fieldset uses `className="field field--checklist"` in `src/components/inspector/inboundInspector.tsx`, while `src/styles.css` defines `.field` as a two-column grid and has no dedicated `.field--checklist` override. As a result, the fieldset's legend, toggle row, nested labels, and nested inputs all become grid items.

Observed local reproduction:

- The TUN HTTP Proxy fieldset inherited `grid-template-columns: minmax(104px, 0.75fr) minmax(0px, 1fr)`.
- `Server port` collapsed to roughly `30px` wide.
- Programmatic `fill("8080")` worked, so the user-facing "cannot input / spinner does not work" behavior is primarily a hit-target and layout collapse problem.

Affected pattern:

- `src/components/inspector/sharedFields.tsx` object and key/value fieldsets.
- `src/components/inspector/inboundInspector.tsx` TUN Platform HTTP Proxy.
- `src/components/inspector/inboundSectionsB.tsx` fallback/users repeaters.
- `src/components/inspector/outboundSectionsB.tsx` headers/candidate/obfs repeaters.
- `src/components/inspector/dnsInspector.tsx` and `dnsServerInspector.tsx` nested editors.
- `src/components/inspector/ruleInspectors.tsx` route options and rule editors.

### Input styling

Inspector inputs do receive `.field input/select/textarea` styling, but placeholders, native number spinners, select popup internals, checkbox checkmarks, and password bullets are browser-native. The screenshot mostly shows placeholder examples, so the text appearing outside normal styling is partly missing `::placeholder` styling and partly native-control rendering.

### Number/list functionality

Several number paths immediately coerce with `Number(rawValue)`. This creates inconsistent or invalid states:

- Empty string may become `0` instead of clearing a field.
- Intermediate edits such as `-`, `.`, or `1e` can become `NaN` or be rejected by the controlled input.
- Port-like fields often lack `min=1`, `max=65535`, and integer semantics.
- `server_port` handling differs across TUN, DNS server, outbound, shared fields, and advanced fields.

High-risk locations include:

- `src/components/inspector/sharedFields.tsx`
- `src/components/inspector/advancedFields.tsx`
- `src/components/inspector/inboundInspector.tsx`
- `src/components/inspector/inboundSectionsB.tsx`
- `src/components/inspector/outboundInspector.tsx`
- `src/components/inspector/dnsInspector.tsx`
- `src/components/inspector/dnsServerInspector.tsx`

### Hidden or dead controls

Multiple inspectors render controls based on whether a field exists in the imported object rather than based on the entity type/schema. If imported configs omit `server`, `server_port`, or `path`, users can lose the first-class editor for exactly the field needed to fix diagnostics.

Rule tables also expose target controls that are action-blind. Route/DNS table target selects may appear editable for actions where domain commands later scrub the field, creating dead controls.

### Lazy layer black/blank screen

Mobile topbar sheets and the desktop/mobile JSON viewer are lazy-loaded with `Suspense fallback={null}`. There is no error boundary around these lazy layers.

Local reproduction:

- Blocking `MobileNodeSheet` dynamic import then tapping mobile `+` produced `Failed to fetch dynamically imported module` and cleared `#root`.
- Blocking `ConfigJsonViewerDialog` dynamic import then clicking desktop `View JSON` produced the same root-clearing failure.
- Simulated slow chunks produced no visible loading layer: the triggering button moved to an expanded/open state, but no dialog/sheet appeared until the chunk arrived.

Primary locations:

- `src/components/MobileTopBar.tsx`
- `src/components/TopBar.tsx`
- `src/components/ConfigJsonViewerDialog.tsx`
- `src/components/BottomSheet.tsx`

## Optimal Path

Architecture decision:

- Fix the fieldset layout globally first, because it removes the biggest visible regression without touching domain behavior.
- Add lazy layer loading/error infrastructure before expanding editor work, because it prevents app-wide blank screens during normal interaction.
- Then unify low-level control semantics, starting with numbers/ports/lists, so protocol-specific fixes can reuse one parser/control instead of multiplying one-off handlers.
- Finally address type-driven visibility and rule-table dead controls, because those touch domain/schema semantics and need narrower tests.

Why this is the best path for SBC:

- It preserves canonical JSON/domain state as source of truth.
- It keeps UI polish and domain semantics in separate atomics.
- It avoids a broad Inspector rewrite.
- It aligns with `vercel-react-best-practices`: CSS-first where possible, narrow leaf components for controls, no new broad global state, and no heavy editor bundles on first mobile load.

Alternatives rejected:

- Fix only the TUN HTTP Proxy JSX: too narrow; the same `.field--checklist` bug affects many repeaters.
- Eager-load all lazy layers: avoids chunk failure timing but regresses mobile bundle size and still needs error handling.
- Replace all native inputs with custom controls: too large for this goal and unnecessary for the immediate bugs.
- Batch all 66 surfaces in one PR: too risky and violates small atomic constraints.

Risk controls:

- One atomic per concern.
- Use a new worktree/branch for implementation; do not occupy or rewrite `main`, and do not touch locked Claude worktrees.
- Add Playwright checks for actual browser layout and lazy chunk failure. jsdom alone cannot catch these bugs.
- Keep every config mutation through existing domain/store commands.

## Implementation Plan

### Atomic 1 -- Inspector fieldset layout and placeholder polish

Outcome:

- `.field--checklist` no longer inherits normal `.field` two-column layout.
- Nested fieldsets and repeaters have stable width, rounded borders, no horizontal overflow, and predictable nested `.field` rows.
- Placeholder text is styled intentionally.

Likely files:

- `src/styles.css`
- Minimal touched component files only if markup needs a small class modifier.

Implementation notes:

- Add dedicated `.field--checklist` layout with `display: grid`, `grid-template-columns: 1fr`, `min-inline-size: 0`, full-width legend, and scoped nested row rules.
- Add `.field input::placeholder`, `.field textarea::placeholder`, and width/min-width guardrails.
- Avoid changing the existing dark menu palette unless required by the fieldset fix.

Tests:

- Add Playwright smoke for TUN Platform HTTP Proxy:
  - open mobile/desktop app;
  - select TUN;
  - assert `Server port` input width is usable;
  - fill `8080`;
  - assert no horizontal overflow in the fieldset.
- Add at least one representative shared key/value or DNS fieldset layout check.

### Atomic 2 -- Lazy layer loading and failure states

Outcome:

- Mobile `+`, mobile `...`, templates sheet, and JSON viewer show visible loading UI while chunks load.
- Dynamic import failure displays a recoverable error state instead of clearing `#root`.
- Users can close the failed layer and continue using the app.

Likely files:

- `src/components/MobileTopBar.tsx`
- `src/components/TopBar.tsx`
- New `src/components/LazyLayerBoundary.tsx` or equivalent.
- Possibly `src/components/BottomSheet.tsx` for reusable loading/error body.
- `src/styles.css`

Implementation notes:

- Replace `Suspense fallback={null}` with visible sheet/dialog skeletons.
- Add a small error boundary scoped to layer slots, not the entire app.
- Add retry support where practical by remounting the lazy child with a retry key.
- Preload high-use layers on `pointerenter`, `focus`, or `touchstart` without moving CodeMirror into the initial bundle.

Tests:

- Playwright route abort for `MobileNodeSheet` chunk: app remains mounted and shows a layer error.
- Playwright route abort for `ConfigJsonViewerDialog` chunk: app remains mounted and shows a dialog error.
- Playwright route delay: loading fallback is visible before the real layer appears.

### Atomic 3 -- Shared number, port, and list parsing

Outcome:

- Number fields can be cleared without becoming `0`.
- Invalid intermediate input does not write `NaN` into canonical state.
- Port fields share `1..65535` integer semantics.
- List fields clear to `undefined` where that matches existing pruning semantics, not noisy empty arrays.

Likely files:

- `src/components/inspector/controls.tsx`
- `src/components/inspector/sharedFields.tsx`
- `src/components/inspector/advancedFields.tsx`
- Targeted inbound/outbound/DNS inspectors for first migration.

Implementation notes:

- Introduce a reusable optional number/port control or parser.
- Keep local draft state only inside leaf controls; do not add broad store state.
- Start with highest-risk fields: TUN HTTP Proxy port, shared `server_port`, Advanced number, DNS server port, outbound server port.

Tests:

- Clear, invalid, zero, negative, fractional, and `65536` cases.
- Confirm valid values still update canonical config.
- Confirm no `NaN` appears in exported JSON/draft.

### Atomic 4 -- Type-driven visibility and dead-control cleanup

Outcome:

- Required repair fields render based on entity type/schema, not only field presence.
- Missing `server/server_port/path` can be fixed from Inspector after import.
- Route/DNS rule tables do not show target selects for actions where the target is scrubbed.

Likely files:

- `src/components/inspector/outboundInspector.tsx`
- `src/components/inspector/dnsServerInspector.tsx`
- `src/components/inspector/ruleInspectors.tsx`
- `src/components/RuleTables.tsx`
- Existing domain helpers in `src/domain/commands.ts` or rule action helpers.

Implementation notes:

- Use existing entity type/schema knowledge before adding new metadata.
- Keep action gating aligned with domain normalizers.
- Route rule target options should include endpoint tags where sing-box allows outbound target semantics.

Tests:

- Import outbound/DNS server missing server/port/path, then edit from Inspector.
- Route reject/predefined/respond rows do not expose dead target controls.
- Route/evaluate rows still expose valid target controls.
- Endpoint target selection round-trips.

### Atomic 5 -- Focused long-tail editor correctness

Outcome:

- Address the most visible hidden or lossy editor gaps found during the scan.
- Do not attempt complete 66-surface coverage in one PR.

Initial candidates:

- `shadowsocks.network` hidden by handled fields but not rendered.
- Object-form `hysteria2.masquerade`.
- `cloudflared.control_dialer` / `cloudflared.tunnel_dialer`.
- TLS PEM/list fields currently forced through CSV-like inputs.
- DNS Hub `optimistic` object and testing-gated fields.

Tests:

- One focused behavior test per field group.
- Round-trip import/edit/export where field shapes are object or list-like.

## Review Plan

Self-review focus:

- No unrelated cleanup.
- CSS-only atomic does not alter canonical config.
- Lazy error boundary does not swallow unrelated errors silently.
- Control parsing never writes `NaN` or unintended `0`.
- Field visibility changes do not create invalid stable defaults.
- Rule table UI matches command-layer normalization.

Source-of-truth checks:

- Any schema/field behavior change maps back to `docs/sing-box-config-doc-inventory.md`.
- If official behavior is ambiguous, verify with target-matched `sing-box check` before claiming validity.

Frontend skill gate:

- Load and apply `vercel-react-best-practices` before frontend implementation.
- Review bundle size: keep CodeMirror lazy; prefer preloading over eager loading.
- Review rerender scope: keep draft states local to leaf controls.
- Review async/data waterfalls: lazy layers should have explicit loading/error UI, not blocking blank states.
- Review derived state cost: memoize expensive tag option lists if expanded.

Diff scope checks:

- Each atomic should remain reviewable independently.
- If an atomic exceeds roughly 400 logical lines, split it.
- Do not mix CSS fieldset repair with number parser or domain visibility changes.

## E2E Plan

User paths:

- Desktop: open brand menu -> View JSON -> JSON dialog appears, scrolls, closes.
- Desktop: simulate JSON viewer chunk failure -> app remains usable and shows error dialog.
- Mobile: tap `+` -> Add node sheet appears with palette content.
- Mobile: simulate node sheet chunk failure -> app remains usable and shows error sheet.
- Mobile: tap `...` -> View JSON -> JSON dialog appears or loading state is visible while chunk loads.
- Inspector: select TUN -> Platform HTTP Proxy fields are usable and do not collapse.

Tooling:

- `pnpm e2e` for Playwright checks.
- Targeted Playwright specs for chunk failure/delay with `page.route`.
- Vitest for control parsing and domain write behavior.

Expected evidence:

- Screenshots/traces only on failure.
- Browser assertions for actual bounding boxes and overflow.
- Canonical config assertions for field writes.

Fallback if full E2E is not possible:

- Run targeted Playwright spec locally and record the skipped full-suite reason.
- Do not mark the goal complete without at least one real browser check for layout and one real browser check for lazy failure.

## Acceptance Criteria

- TUN Platform HTTP Proxy `server_port` has a usable width and can be edited by pointer/keyboard.
- `.field--checklist` fieldsets no longer lay out children as accidental two-column grid items.
- Placeholder styling is intentional and consistent in Inspector inputs.
- Dynamic import failure for mobile sheets or JSON viewer does not blank the app.
- Slow dynamic import shows loading UI rather than no feedback.
- Number controls support clear/invalid intermediate states without corrupting canonical JSON.
- High-risk port fields enforce integer `1..65535` semantics.
- Imported configs with missing repair fields can be fixed from Inspector.
- Rule tables do not expose target controls that command normalization discards.

## Validation Matrix

| Case | Check |
| --- | --- |
| CSS/layout atomic | `pnpm e2e -- mobile.spec.ts editor.spec.ts` or targeted Playwright specs |
| Lazy layer reliability | Playwright chunk abort/delay tests for `MobileNodeSheet` and `ConfigJsonViewerDialog` |
| Control parsing | Vitest targeted tests for number/list controls |
| Domain visibility changes | Vitest + targeted E2E import/edit/export checks |
| App code | `pnpm build` and `pnpm test` before PR |
| Diff hygiene | `git diff --check` |
| Stable fixture impact | `pnpm validate:fixtures` when emitted config behavior changes |
| Official validation | `sing-box-stable check` / `sing-box-testing check` when fixtures or export semantics change |

## Done Definition

- Implementation complete for all accepted atomics.
- Frontend diff reviewed against `vercel-react-best-practices`.
- Playwright proves layout and lazy-failure user paths.
- Unit tests cover parsing and domain write behavior.
- No unrelated worktree, branch, or locked Claude worktree was modified.
- PR opened after local checks pass.
- Post-merge GitHub issue gate recorded before the next atomic begins.

## Notes And Deviations

- Date: 2026-05-30
- Decision: Use `docs/goals/` rather than `docs/goal/` because the repository's goal convention and existing documents use the plural directory.
- Decision: Do not spawn 66 agents for implementation planning. The editable surfaces count is around that size, but the bugs concentrate in fewer shared render paths.
- Decision: Keep CodeMirror lazy. Reliability should be fixed with loading/error boundaries and preloading, not by adding the JSON viewer to the initial bundle.
- Risk: Some native control internals cannot be fully styled with ordinary CSS. This goal only promises controlled styling for placeholders, dimensions, hit targets, and app-owned wrappers unless a later atomic explicitly introduces custom controls.
