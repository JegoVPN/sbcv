# settings-certificate — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

Upstream authority: `docs/upstream/sing-box/testing/configuration/certificate/index.md`.
Official model = the top-level `certificate` object with exactly **4 writable fields**: `store`, `certificate` (PEM line array), `certificate_path` (array), `certificate_directory_path` (array). No `tag`. No graph relationships. `store` enum = `system` (default) / `mozilla` / `chrome` (since 1.13.0) / `none`. Whole block since 1.12.0.

## Verdict (2-3 sentences)
The node is in solid shape and most pass-1 P0/P1 claims are now FIXED — the PEM textarea round-trips via blank-line block split (not comma), the `+` button and palette singleton guard exist, and version-gate diagnostics for both the block and `store=chrome` are implemented. Remaining issues are minor: the seed writes redundant defaults/empty arrays to exported JSON, path fields use comma-split single-line inputs with no auto-reload hint, and the two stable-channel diagnostics are over-broad (they fire on 1.13-stable where the block and `chrome` are actually supported). All 4 official fields are exposed with correct controls; there are no extra non-official fields and no invalid-JSON writes for the certificate panel.

## 1. Left Palette
- Present. `src/components/Palette.tsx:105` — group "Certificate", single item `{ label: "Certificate", kind: "settings-certificate", icon: FileKey2, docsUrl: docs("certificate/"), status: "setup" }`. Docs URL resolves to `…/configuration/certificate/` — correct.
- Category correct: its own "Certificate" group, separate from the "Certificate Providers" group (`Palette.tsx:107-114`) and the "Shared" duplicate providers (`Palette.tsx:221-224`). Correctly NOT conflated with `certificate_providers[]`.
- Singleton handling is now CORRECT (pass-1 P2 "no singleton guard" is STALE): `singletonsPresent` (`Palette.tsx:300-309`) adds `settings-certificate` once `config.certificate` is a non-empty object, and `itemStatus()` flips it to `"open"` (`Palette.tsx:261`), giving the "already exists — click to open the Inspector" tooltip (`Palette.tsx:275`). So the second-click no-op concern no longer applies.
- Minor: default action is `"setup"` ("Add Certificate setup draft to canvas", `Palette.tsx:269`) vs `settings-log`/`settings-ntp` which also use `"setup"` (`Palette.tsx:101`), so settings nodes are now internally CONSISTENT — pass-1's "`setup` vs `add` inconsistency with settings-log" claim is STALE (settings-log no longer uses `ready:true` here). `"setup"` is acceptable; no draft workflow actually exists, but it is harmless.

## 2. Canvas Node
- Node is built only when `config.certificate` is a present non-empty object (`src/canvas/graph.ts:171-191`, guard at line 174) — correct for a singleton that should not appear before it exists.
- `title` = "Certificate" (`graph.ts:182`), `subtitle` = "global settings" (`graph.ts:183`, generic, shared by all settings nodes), `type` pill = "certificate" (`graph.ts:181`), column far-left `COLUMNS.settings`.
- Ports: CORRECT — zero on both sides. The only `settings`-kind port relation is `settings-ntp-detour`, scoped to `nodeType: "ntp"` (`src/domain/portRelationRegistry.ts:115`); `portEndpointsForNode` filters by `(kind,type)` (`portRelationRegistry.ts:196-205`), so `settings/certificate` yields `[]` for both directions. `data.compatible = []` (`graph.ts:185`).
- `+` button: now CORRECTLY hidden when `data.compatible.length === 0` (`src/components/SbcNode.tsx:392`). Pass-1 P1 "+ button always visible but inert" is STALE.
- Header still shows the internal compound `"settings / certificate"` (`SbcNode.tsx:291`, `{data.kind} / {data.type}`) — pass-1 flagged this (it cited line 382; actual line is 291). Still valid but low priority.
- Count pill still shows `{data.compatible.length || 1}` = `1` for empty compatible (`SbcNode.tsx:436`) — pass-1 P2 still valid; spurious `1` on a node with nothing to add.

## 3. Upstream/Downstream Links
Official model: `certificate` is a singleton trust store with NO `tag` and is referenced by NO other node. It augments global TLS verification but is not part of the routing/reference graph.
- `portRelationRegistry.ts` (`relation(...)` at lines 91-115): no certificate relation — CORRECT.
- `referenceRegistry.ts` reference entries (lines 330-373): kinds are `outbound`, `dns-server`, `endpoint`, `service`, `rule-set`, `http-client`, `certificate-provider`. No entry targets the `certificate` trust store — CORRECT. Note `certificate-provider` (`referenceRegistry.ts:368-373`, path `*/tls/certificate_provider`) is a DIFFERENT object (`config.certificate_providers[]`) and is correctly separate from this node's `config.certificate`.
- TLS in nodes references `certificate_provider` (provider tag), `certificate`, `certificate_path`, etc. as inline node-local TLS fields (`Inspector.tsx:1519-1529`) — none of these reference the top-level trust store, matching upstream (the store has no tag to reference).
- Missing links: NONE. Extra/wrong links: NONE. The relationship model is correctly empty for this node.

## 4. Right Inspector (fields)
Panel: `Inspector.tsx:2262-2311` (`ref.kind === "settings" && ref.path === "certificate"`). `entity = config.certificate` (`Inspector.tsx:1775-1779`). Writes via `updateField` → `next[ref.path] = { ...objectValue, [field]: value }` (`src/domain/commands.ts:893-898`) — pure object merge, no invalid-JSON risk.

| Official field | Type | Required | Default | UI control | Validation / write | State |
| --- | --- | --- | --- | --- | --- | --- |
| `store` | enum string | optional | `system` | `<select>` w/ system/mozilla/chrome/none (`Inspector.tsx:2266-2274`) | writes raw string; fallback `?? "system"` (`:2267`) | CORRECT (all 4 values, default right) |
| `certificate` | string[] (PEM) | optional | `[]` | `<textarea rows=8>` (`:2278-2294`) | split on `/\n{2,}/` blank-line → trimmed blocks; empty → `undefined` (`:2283-2291`) | CORRECT — multi-line PEM safe; pass-1 P0 comma-split is STALE/FIXED |
| `certificate_path` | string[] | optional | `[]` | single-line `<input>` (`:2298-2301`) | `toList`/`fromList` comma-split (`Inspector.tsx:89-98`) | works; comma-split OK for paths but no auto-reload hint, no multiline |
| `certificate_directory_path` | string[] | optional | `[]` | single-line `<input>` (`:2305-2308`) | same comma-split | same as above |

- No missing official fields. No extra/non-official fields. No required markers needed (all optional per upstream).
- Write asymmetry: empty PEM writes `undefined` (key removed) (`:2284`), but clearing a path field writes `[]` via `fromList("")` (`Inspector.tsx:93-98`) instead of removing the key — leaves an empty array behind (see P2 below).
- Diagnostics for this panel now EXIST (`src/domain/diagnostics.ts:1050-1069`): block-testing-only warning at `/certificate`, and `store=chrome` warning at `/certificate/store`. Pass-1 "no diagnostic" P1s are STALE/FIXED. Accuracy caveat below.

## Findings (prioritized)

- [P1] Seeded defaults + empty arrays are exported verbatim as JSON noise. `createFromPalette`/seed writes `{ store: "system", certificate: [], certificate_path: [], certificate_directory_path: [] }` (`src/domain/commands.ts:52-59`), and `stripUndefined` only removes `undefined`, never empty arrays or default-equal scalars (`src/domain/serialization.ts:9-23,32-34`). Result: a freshly placed certificate node always exports the redundant default `store:"system"` plus three empty arrays, polluting `config.json`. Prune empty arrays and the default `store` on export, or seed with `undefined` fields.

- [P2] Stable-channel diagnostics are over-broad / can false-positive. `diagnostics.ts:1050-1068` fires for ANY `channel === "stable"`, but the repo's stable targets include `1.13-stable` (`src/domain/types.ts:11`). The block is valid since 1.12.0 and `store=chrome` since 1.13.0, so on a 1.13-stable target both warnings are false positives (block fully supported; chrome supported). Gate by actual target version, not just `channel === "stable"`. (Messages do hedge with "verify with sing-box-stable", so impact is soft.)

- [P2] Path fields lack the upstream "auto-reload on file modification" hint. Upstream notes both `certificate_path` and `certificate_directory_path` reload when files change; the inputs (`Inspector.tsx:2296-2308`) show no helper text. Add a `field-hint`.

- [P2] Path fields are single-line comma-split inputs for `string[]`. `Inspector.tsx:2298-2308` uses `<input>` + `toList`/`fromList` comma-split; multiple/long paths are hard to read. A `<textarea>` (newline-split, matching the PEM field) would be better and consistent.

- [P2] Clearing a path field writes `[]` rather than removing the key. `fromList("")` returns `[]` (`Inspector.tsx:93-98`) so the empty array persists in state/export, unlike the PEM field which writes `undefined` (`Inspector.tsx:2284`). Normalize empty path input to `undefined`.

- [P2] Canvas count pill shows spurious `1` for empty-compatible node. `SbcNode.tsx:436` (`{data.compatible.length || 1}`). Meaningless for a settings singleton; show `0` or hide.

- [P2] Node header exposes internal kind string `"settings / certificate"`. `SbcNode.tsx:291`. Prefer a human-readable label. (pass-1 cited line 382; actual is 291.)

- [P2] Generic subtitle "global settings". `graph.ts:183`. A specific "certificate trust store" would aid disambiguation when multiple settings nodes are visible.

SUMMARY: 0 P0, 1 P1, 7 P2.
