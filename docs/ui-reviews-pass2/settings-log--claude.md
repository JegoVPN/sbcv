# settings-log — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

Upstream enumeration (`docs/upstream/sing-box/testing/configuration/log/index.md`): the top-level `log` object has exactly **4 writable fields** — `disabled` (bool), `level` (enum: `trace`/`debug`/`info`/`warn`/`error`/`fatal`/`panic`), `output` (file path string), `timestamp` (bool). No `tag`. No fields reference other nodes; no node references `log`. It is a singleton global-settings object at `config.log`.

## Verdict (2-3 sentences)
The `settings-log` node is correctly modeled across all four surfaces: all 4 official fields are now exposed in the Inspector with correct control types and clean round-trip, the Palette is a proper singleton (opens rather than re-adds once present), and the canvas node carries zero ports as the spec requires. The previous pass-1 P0 (missing `timestamp`) and both pass-1 P1s (output placeholder, singleton guard) are **all fixed** and now stale. Only minor polish remains: a generic canvas subtitle/titlebar and the absence of any `level`-enum diagnostic for hand-edited configs.

## 1. Left Palette
- Present and correct. `src/components/Palette.tsx:75` — `{ label: "Log Settings", kind: "settings-log", icon: Braces, docsUrl: docs("log/"), ready: true }`. Group title `"Log"` (`Palette.tsx:74`). `docsUrl` resolves to `.../configuration/log/` — correct.
- Singleton gating is implemented and correct (pass-1 P1 now STALE). `singletonsPresent` adds `settings-log` whenever `config.log` is a non-empty object (`Palette.tsx:300-309`); `itemStatus()` then returns `"open"` (`Palette.tsx:261`), the button label/tooltip becomes "already exists — click to open the Inspector" (`Palette.tsx:275`), and clicking selects `settings:log` (`Palette.tsx:445-446, 475`). No silent duplicate-add.
- Default action when absent: status falls through to `"add"` via `ready: true` (`Palette.tsx:263`), which is the correct affordance for placing the singleton the first time. `canActivate` allows both `add` and `open` (`Palette.tsx:280-287`).
- Note: `createFromPalette("settings-log")` is the add path; both the add and open paths set `setSelectedId("settings:log")`, so the Inspector opens in either state — good.

## 2. Canvas Node
- Node is built in `src/canvas/graph.ts:171-191` from `SETTINGS_NODE_IDS` (`graph.ts:29`), only when `config.log` is a non-array object (`graph.ts:173-174`). Placed in the isolated `settings` column `x=-300` (`graph.ts:31-38`).
- Ports: **zero**, correct. `kind: "settings"` (`graph.ts:179`) has no entry in `portEndpointsForNode`, so `getPortSpecs` returns `[]` for both directions (`SbcNode.tsx:94-108`); `compatible: []` (`graph.ts:185`) means no `+` add-button and no hover chips render (`SbcNode.tsx:392-405, 440-453`). Matches the singleton "no chainable handles" requirement.
- Status: driven by `diagnosticStatus("/log", diagnostics)` (`graph.ts:184`). Since no semantic rule emits a `/log` diagnostic (see §Findings), this is always `valid` in practice — acceptable but inert.
- Title/subtitle: `title` = `"Log"` (capitalized `path`, `graph.ts:182`); `subtitle` = the generic `"global settings"` (`graph.ts:183`), shared verbatim with `ntp`/`certificate`/`experimental`. Pass-1 P2 (differentiated subtitle) still stands.
- Titlebar: `SbcNode.tsx:291` renders `${data.kind} / ${data.type}` = `settings / log`. The bottom toolbar type pill (`SbcNode.tsx:408-411`) shows `log`. Functional, slightly redundant with the title.

## 3. Upstream/Downstream Links
- Confirmed: `log` has **no references** in either direction. `referenceRegistry.ts` contains zero `log`/`settings` producers or consumers (full-file grep: no matches across 382 lines). `portRelationRegistry.ts` has no `log`/`level`/`timestamp`/`output` relation; the only `settings`-kind relation is `settings-ntp-detour` for NTP (`portRelationRegistry.ts:115`), which does not apply to `log`.
- Missing links: none expected, none found. Extra links: none. Wrong links: none. This surface is fully correct and matches the official relationship model.

## 4. Right Inspector (fields)
Branch: `src/components/Inspector.tsx:2166-2211` (`ref.kind === "settings" && ref.path === "log"`). Entity resolved at `Inspector.tsx:1775-1780`; writes via `updateField` -> `updateEntityField` settings path (`src/domain/commands.ts` `updateEntityField`, settings branch: `{ ...objectValue, [field]: value }`). Export prunes `undefined` via `stripUndefined` before `JSON.stringify` (`src/domain/serialization.ts:33`), so `value || undefined` writes round-trip cleanly.

| Official field | Type | UI control | Inspector line | Default | Validation | State |
| --- | --- | --- | --- | --- | --- | --- |
| `disabled` | bool | checkbox, writes `checked || undefined` | 2168-2175 | unset (off) | n/a (bool) | Correct |
| `level` | enum | `<select>` with all 7 values trace…panic | 2176-2191 | falls back to `"info"`; create-default seeds `level:"info"` (`commands.ts:37-42`) | enum-constrained by UI | Correct |
| `output` | string | text input, writes `value || undefined`, placeholder "file path (omit to use console)" | 2192-2200 | unset (console) | none | Correct (pass-1 placeholder P1 now STALE) |
| `timestamp` | bool | checkbox, writes `checked || undefined` | 2201-2209 | unset (off) | n/a (bool) | Correct (pass-1 P0 now STALE — field IS present) |

- All 4 official fields present, none missing. No extra/non-official fields are rendered: the settings branch does NOT invoke `AdvancedScalarFields`/`AdvancedNonScalarFields` (those run only for route-rule/dns-rule, `Inspector.tsx:1185,1327`), so there is no free-form/JSON write surface and no invalid-JSON write risk for `log`.
- UX polish: `level`, `output`, and `timestamp` are correctly disabled when `disabled` is checked (`Inspector.tsx:2181,2198,2206`); `disabled` toggle is rendered first (pass-1 P2 ordering now STALE). The values persist (not deleted) while greyed, so unchecking `disabled` restores them — good.
- Header shows generic `ref.kind` = "settings" as the title (`Inspector.tsx:1805,1813-1814`) because `log` has no `tag`; minor, consistent with other tagless singletons.

## Findings (prioritized)
- **[P1]** No semantic diagnostic validates `log.level`. A hand-edited/imported config with an invalid level (e.g. `"verbose"`) is silently accepted: the `<select>` renders the bad value as its controlled value with no matching option (`Inspector.tsx:2178-2190`) and nothing in `src/domain/diagnostics.ts` keys on `/log` (grep: zero `/log` rules). Add a semantic check so the canvas node turns `warning`/`error` and the user is warned. (`src/domain/diagnostics.ts`; node status wiring at `src/canvas/graph.ts:184`.)
- **[P2]** Canvas subtitle is the generic `"global settings"`, identical for all four settings nodes; reads as `Log / global settings`. Differentiate to `"log settings"` for denser canvases. (`src/canvas/graph.ts:183`.)
- **[P2]** Titlebar `settings / log` (`src/components/SbcNode.tsx:291`) duplicates the `Log` title and the `log` type pill (`SbcNode.tsx:408-411`); cosmetic redundancy only.

Pass-1 staleness: `docs/ui-reviews/settings-log.md` and `docs/ui-reviews-pass2/`-predecessor `docs/ui-reviews/settings-log.md`'s headline items are obsolete. Specifically STALE now: pass-1 **P0 timestamp-missing** (field present at `Inspector.tsx:2201-2209`), pass-1 **P1 output-placeholder** (corrected at `Inspector.tsx:2197`), pass-1 **P1 Palette singleton guard** (implemented at `Palette.tsx:261,300-309`), and pass-1 **P2 disabled-ordering** (disabled now first at `Inspector.tsx:2168`). The only pass-1 item still valid is the P2 generic-subtitle note.

SUMMARY: 0 P0, 1 P1, 2 P2.
