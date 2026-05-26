<!-- Status: official-read. Source: stable experimental/{index,cache-file,clash-api,v2ray-api}.md + testing diff + docs/experimental-ui-review.md + Palette/SbcNode/Inspector grep. UI verification + implementation fixes still pending. -->
# Settings / Experimental UI Review (Claude Deep Review)

## Scope

- Editable node: `settings:experimental` (three sub-modules: `cache_file` / `clash_api` / `v2ray_api`)
- Official docs: `experimental/{index,cache-file,clash-api,v2ray-api}.md` (stable + testing)
- Source-of-truth: canonical sing-box JSON / domain state.
- Inherited conclusions from: `docs/experimental-ui-review.md` (must not be repeated verbatim; this document upgrades to atomic implementation tasks).

---

## Official Model

### Cache File (stable, since 1.8.0)

| Field | Type | Required | Default | Semantic | Notes |
| --- | --- | --- | --- | --- | --- |
| `enabled` | bool | optional | `false` | Enable the cache file | Master gate; all other fields meaningless when false |
| `path` | string | optional | `"cache.db"` | Path to the SQLite cache file | Empty string = `cache.db` in config dir |
| `cache_id` | string | optional | (none) | Namespace key within the file | Allows multiple configs sharing one file |
| `store_fakeip` | bool | optional | `false` | Persist FakeIP mappings across restarts | Stable field, no deprecation |
| `store_rdrc` | bool | optional | `false` | Persist rejected DNS response cache (RDRC) | Added 1.9.0; deprecated in 1.14.0 testing |
| `rdrc_timeout` | string (Duration) | optional | `"7d"` | TTL for RDRC entries | Only relevant when `store_rdrc` is true |

Total stable writable fields: **6**.

### Cache File (testing diff, 1.14.0+)

| Change | Field | Detail |
| --- | --- | --- |
| Deprecated | `store_rdrc` | Deprecated in 1.14; will be removed in 1.16. Migration: use `store_dns` instead. Linked to legacy Address Filter Fields. |
| New | `store_dns` | Added in 1.14. Stores DNS cache in the cache file. Replaces the RDRC concept with a broader DNS cache store. |

Total testing writable fields: **7** (6 stable + `store_dns`; `store_rdrc` deprecated but still serializable).

### Clash API (stable, updated 1.10.0)

#### Active fields

| Field | Type | Required | Default | Semantic | Notes |
| --- | --- | --- | --- | --- | --- |
| `external_controller` | string (host:port) | optional | (none / disabled) | RESTful API listen address | Empty = Clash API disabled; this is the enable gate |
| `external_ui` | string (path) | optional | (none) | Relative or absolute path to static UI files | Served at `http://{controller}/ui` |
| `external_ui_download_url` | string (URL) | optional | MetaCubeX Yacd-meta gh-pages ZIP | ZIP URL for auto-download if `external_ui` dir is empty | Default points to `https://github.com/MetaCubeX/Yacd-meta/archive/gh-pages.zip` |
| `external_ui_download_detour` | string (outbound tag) | optional | (default outbound) | Tag of outbound used to download the external UI | **Reference to an outbound tag — must use outbound select, not free text** |
| `secret` | string | optional | (none) | Bearer token for API authentication | Security-critical: must warn if controller binds `0.0.0.0` and secret is empty |
| `default_mode` | string (enum) | optional | `"Rule"` | Initial Clash mode | Valid values: `Rule`, `Global`, `Direct` — must be a select, not free text |
| `access_control_allow_origin` | string[] | optional | `["*"]` | CORS allowed origins | Added 1.10.0; `*` when empty |
| `access_control_allow_private_network` | bool | optional | `false` | Allow Clash API from private network by public websites | Added 1.10.0 |

Total active stable fields: **8**.

#### Deprecated fields (since 1.8.0 — must not appear in primary form)

| Field | Type | Replaced by |
| --- | --- | --- |
| `store_mode` | bool | `cache_file.enabled` (auto-enabled when cache_file is on) |
| `store_selected` | bool | `cache_file.enabled` (auto-enabled when cache_file is on) |
| `store_fakeip` | bool | `cache_file.store_fakeip` |
| `cache_file` | string | `cache_file.enabled` + `cache_file.path` |
| `cache_id` | string | `cache_file.cache_id` |

Total deprecated fields: **5**.

### Clash API (testing diff)

No changes between stable and testing for `clash_api`. Both docs are identical at this surface.

### V2Ray API (stable + testing — identical)

| Field | Type | Required | Default | Semantic | Notes |
| --- | --- | --- | --- | --- | --- |
| `listen` | string (host:port) | optional | (none / disabled) | gRPC API listen address | Empty = V2Ray API disabled; this is the enable gate |
| `stats.enabled` | bool | optional | `false` | Enable traffic statistics service | |
| `stats.inbounds` | string[] | optional | `[]` | Inbound tags to count traffic for | Must reference real inbound tags |
| `stats.outbounds` | string[] | optional | `[]` | Outbound tags to count traffic for | Must reference real outbound tags |
| `stats.users` | string[] | optional | `[]` | User names to count traffic for | Not node tags — these are protocol-level user identifiers |

Total writable fields: **5** (or 6 counting `stats` as a group container).

**Build-tag gate**: V2Ray API is **not compiled in by default**. Requires a custom build with the `v2ray_api` build tag. Absence of this feature at runtime causes silent failure or a startup error, not a graceful no-op. This must be surfaced in the UI.

### Relationship Model

| Reference | From | To | Canvas edge needed? |
| --- | --- | --- | --- |
| `clash_api.external_ui_download_detour` | `settings:experimental` | outbound (by tag) | No canvas edge; Inspector outbound select |
| `v2ray_api.stats.inbounds` | `settings:experimental` | inbound tags | No canvas edge; Inspector multiselect |
| `v2ray_api.stats.outbounds` | `settings:experimental` | outbound tags | No canvas edge; Inspector multiselect |

`cache_file` has no tag references. `getPortSpecs` in `SbcNode.tsx` returns `[]` for `settings` kind nodes (line 199: `compatible: []`) — correct, no ports needed.

### Compat / Target Gate

| Item | Gate | Behavior |
| --- | --- | --- |
| `cache_file.store_rdrc` | stable ≤1.13 | Active field; show with note |
| `cache_file.store_rdrc` | testing 1.14+ | Deprecated; show only in migration/diagnostic panel |
| `cache_file.rdrc_timeout` | stable ≤1.13 | Conditionally visible when `store_rdrc` is true |
| `cache_file.store_dns` | testing 1.14+ | New field; gate on channel |
| `clash_api.access_control_*` | 1.10.0+ | Both stable and testing cover this; no additional gate needed |
| V2Ray API entire module | Any | Requires build tag; show static warning always when module is expanded |

---

## Left: Add Library

### Current implementation (Palette.tsx line 205)

```
{ label: "Experimental", kind: "settings-experimental", icon: FlaskConical,
  docsUrl: docs("experimental/"), status: "setup" }
```

A single entry for the parent node. Sub-modules (Cache File, Clash API, V2Ray API) have no individual Palette entries.

### Findings

- The single `Experimental SETUP` entry is correct for a global settings node.
- No separate sub-module entries exist (e.g., `Cache File OPEN`). The existing review in `docs/experimental-ui-review.md` recommends adding them; they remain unimplemented.
- The `FlaskConical` icon is correct and matches the "experimental" semantic.
- `docsUrl` points to `experimental/` (index page). Sub-module docs links would need `experimental/cache-file/`, etc.
- `status: "setup"` is the correct action label for a settings node (not `"add"`).

### Implementation tasks (Palette)

- **T-PAL-1**: Add three sub-module Palette entries: `Cache File` (kind `settings-experimental`, action `open-module`, module `cache_file`), `Clash API` (module `clash_api`), `V2Ray API` (module `v2ray_api`). Each must call `ensureSettings(config, "experimental")` then set `selectedId = "settings:experimental"` and scroll/expand the corresponding ModuleCard.
- **T-PAL-2**: Update `docsUrl` for sub-entries: `docs("experimental/cache-file/")`, `docs("experimental/clash-api/")`, `docs("experimental/v2ray-api/")`.

---

## Middle: Canvas Node

### Current implementation (graph.ts lines 184–205, SbcNode.tsx)

- Node rendered by `SETTINGS_NODE_IDS` loop. `kind = "settings"`, `type = "experimental"`, `subtitle = "global settings"`.
- `compatible: []` — correct, no auto-add button should fire.
- Icon: `Braces` from `iconMap.settings` (SbcNode.tsx line 39). Not `FlaskConical` as used in Palette.
- Ports: `getPortSpecs` returns `[]` for `settings` kind with no output direction match — correct.
- Canvas node renders the generic `sbc-node__add` Plus button (SbcNode.tsx lines 480–490). It calls `createCompatible(id, data.compatible[0])` which is `undefined` because `compatible` is `[]`. This is a no-op but the button still renders visually.
- Bottom toolbar renders: type pill (`experimental`), status pill (`valid`/`error`), settings icon button (opens Inspector), primary button (shows count 1 from `data.compatible.length || 1`).

### Findings

- **F-CANVAS-1 (P1)**: Icon mismatch. Palette uses `FlaskConical`; canvas node uses `Braces`. Should be `FlaskConical` for consistency.
- **F-CANVAS-2 (P1)**: Plus button renders but is a no-op. `compatible` is `[]` so `data.compatible[0]` is `undefined`. The button should be hidden when `compatible` is empty.
- **F-CANVAS-3 (P2)**: Primary button shows `1` (from `data.compatible.length || 1 = 1`). This misleads users. For settings nodes it should not show a count.
- **F-CANVAS-4 (P2)**: No ports — correct. No canvas edges from `settings:experimental` to outbounds. The `external_ui_download_detour` reference does not need a canvas edge.
- **F-CANVAS-5 (P2)**: `subtitle` is hardcoded `"global settings"` for all settings nodes. More specific subtitle `"cache / api / stats"` would communicate module content.

### Implementation tasks (Canvas Node)

- **T-NODE-1**: In `graph.ts`, for `type === "experimental"`, set subtitle to `"cache / api / stats"` instead of `"global settings"`.
- **T-NODE-2**: In `SbcNode.tsx`, conditionally hide the `sbc-node__add` Plus button when `data.compatible.length === 0`.
- **T-NODE-3**: In `SbcNode.tsx`, conditionally hide the primary count button (or change it to a no-op open-inspector button) when `data.compatible.length === 0`.
- **T-NODE-4**: In `SbcNode.tsx getNodeIcon` or `graph.ts` node construction, use `FlaskConical` for `type === "experimental"` settings nodes.

---

## Right: Inspector

### Current implementation summary (Inspector.tsx lines 1358–1482)

Branch: `ref.kind === "settings" && ref.path === "experimental"`.

**Cache File card** (lines 1368–1399):
- Fields rendered: `enabled` (toggle), `path` (text), `cache_id` (text), `store_fakeip` (toggle).
- Missing: `store_rdrc`, `rdrc_timeout`, `store_dns`.

**Clash API card** (lines 1401–1455):
- Fields rendered: `external_controller` (text), `secret` (text), `default_mode` (text input — wrong control), `access_control_allow_origin` (text — comma-separated list), `access_control_allow_private_network` (toggle) in `<details>` Advanced CORS.
- Missing: `external_ui`, `external_ui_download_url`, `external_ui_download_detour`.
- Wrong control: `default_mode` is a text `<input>` — must be a select.
- `external_ui_download_detour` is an outbound tag reference — currently absent from the form entirely.
- No warning when `external_controller` starts with `0.0.0.0` and `secret` is empty.

**V2Ray API card** (lines 1457–1478):
- Fields rendered: `listen` (text), `stats.enabled` (toggle).
- Missing: `stats.inbounds`, `stats.outbounds`, `stats.users`.
- Missing: build-tag warning banner.

### Cache File Inspector Findings

| Finding | Priority | Description |
| --- | --- | --- |
| F-CF-1 | P1 | `store_rdrc` is missing from the form. Must be added with stable/testing gate. |
| F-CF-2 | P1 | `rdrc_timeout` is missing. Must be conditionally shown only when `store_rdrc` is true. |
| F-CF-3 | P1 | `store_dns` is missing. Must be gated to `channel === "testing"`. |
| F-CF-4 | P2 | `store_rdrc` must show a deprecation notice when `channel === "testing"` (1.14+). |
| F-CF-5 | P2 | When `enabled` is false, non-enable fields could be visually dimmed/hidden to reduce noise. |

**Recommended Cache File field order and controls:**

```
Enable cache file            toggle    (always visible)
Path                         text      (show when enabled)
Cache ID                     text      (show when enabled)
Store FakeIP                 toggle    (show when enabled)
Store RDRC (stable / warn in testing)  toggle  (show when enabled; gate)
  RDRC Timeout               duration text  (show when store_rdrc is true)
Store DNS (1.14 testing only) toggle   (gated: channel === "testing")
```

### Clash API Inspector Findings

| Finding | Priority | Description |
| --- | --- | --- |
| F-CA-1 | P0 | `external_ui_download_detour` is completely absent. Must be added as an outbound select using the existing `outboundTags(config)` helper (see Inspector.tsx line 217–221). |
| F-CA-2 | P1 | `external_ui` is missing. Must be added as a text field. |
| F-CA-3 | P1 | `external_ui_download_url` is missing. Must be added as a text field (URL). |
| F-CA-4 | P1 | `default_mode` uses `<input type="text">`. Must be changed to `<select>` with options `Rule`, `Global`, `Direct`. |
| F-CA-5 | P1 | No `0.0.0.0` + empty secret warning. When `external_controller` starts with `0.0.0.0` and `secret` is empty, show a warning inline. |
| F-CA-6 | P2 | Deprecated fields (`store_mode`, `store_selected`, `store_fakeip`, `cache_file`, `cache_id`) must not appear in the main form. If present in imported JSON, surface only via diagnostics panel with migration guidance. |
| F-CA-7 | P2 | The `access_control_allow_origin` field uses a comma-joined text input via `toList`/`fromList`. This is functional but should have a note that `*` means "all origins". |
| F-CA-8 | P2 | Consider grouping `external_ui`, `external_ui_download_url`, `external_ui_download_detour` under an `<details>Advanced UI</details>` to keep primary fields minimal. |

**Recommended Clash API field order and controls:**

```
Controller (host:port)       text      (enable gate: non-empty = active)
Secret                       password text  (warning badge if 0.0.0.0 + empty)
Default Mode                 select: Rule / Global / Direct
--- Advanced UI (details) ---
  External UI (path)         text
  Download URL               text (URL)
  Download Detour            outbound select (uses outboundTags(config))
--- Advanced CORS (details, existing) ---
  Allowed Origins            text (comma-list, note: * = all)
  Allow Private Network      toggle
```

### V2Ray API Inspector Findings

| Finding | Priority | Description |
| --- | --- | --- |
| F-V2-1 | P0 | No build-tag warning. Must add a static banner at the top of the V2Ray API card: "V2Ray API is not included in default sing-box builds. Requires a custom build with the `with_v2ray_api` build tag." |
| F-V2-2 | P1 | `stats.inbounds` is missing. Must be added as a multiselect or comma-list of inbound tags (using `inboundTags(config)` helper at Inspector.tsx line 230). |
| F-V2-3 | P1 | `stats.outbounds` is missing. Must be added as a multiselect or comma-list of outbound tags (using `outboundTags(config)` helper). |
| F-V2-4 | P1 | `stats.users` is missing. Must be added as a text list. Note that these are protocol-level user names, not node tags. |
| F-V2-5 | P2 | When `stats.enabled` is false, `stats.inbounds`, `stats.outbounds`, `stats.users` can be hidden or dimmed. |

**Recommended V2Ray API field order and controls:**

```
[Warning banner] Requires sing-box build with V2Ray API support.
Listen (host:port)           text      (enable gate: non-empty = active)
Enable stats                 toggle
  Stats Inbounds             multiselect from inboundTags(config)
  Stats Outbounds            multiselect from outboundTags(config)
  Stats Users                text list (not tag refs)
```

### Diagnostics coverage

`diagnostics.ts` currently has **zero** checks on `config.experimental`. The following are missing:

| Missing diagnostic | Code | Level | Path |
| --- | --- | --- | --- |
| `external_ui_download_detour` references non-existent outbound | `missing-clash-api-download-detour` | error | `/experimental/clash_api/external_ui_download_detour` |
| V2Ray API `stats.inbounds` tag not found | `missing-v2ray-stats-inbound` | error | `/experimental/v2ray_api/stats/inbounds/{i}` |
| V2Ray API `stats.outbounds` tag not found | `missing-v2ray-stats-outbound` | error | `/experimental/v2ray_api/stats/outbounds/{i}` |
| `clash_api.store_rdrc` deprecated in testing | `deprecated-cache-file-store-rdrc` | warning | `/experimental/cache_file/store_rdrc` |
| `clash_api` deprecated sub-fields present | `deprecated-clash-api-fields` | warning | `/experimental/clash_api/{field}` |
| Clash API `0.0.0.0` + no secret | `clash-api-insecure-listen` | warning | `/experimental/clash_api/secret` |
| V2Ray API enabled but no build tag advisory | `v2ray-api-build-tag-required` | warning | `/experimental/v2ray_api` |

---

## Tag Reference Surfaces

| Field | Kind | Control | Diagnostic needed |
| --- | --- | --- | --- |
| `clash_api.external_ui_download_detour` | outbound tag | `<select>` using `outboundTags(config)` | Yes: `missing-clash-api-download-detour` |
| `v2ray_api.stats.inbounds` | inbound tags[] | multiselect/list using `inboundTags(config)` | Yes: `missing-v2ray-stats-inbound` |
| `v2ray_api.stats.outbounds` | outbound tags[] | multiselect/list using `outboundTags(config)` | Yes: `missing-v2ray-stats-outbound` |

`cache_file` has no tag references.

---

## Priority Findings

### P0

| ID | Module | Finding |
| --- | --- | --- |
| F-CA-1 | Clash API | `external_ui_download_detour` is entirely absent from Inspector. Outbound tag reference with no UI surface and no diagnostic. |
| F-V2-1 | V2Ray API | No build-tag warning. Users enabling V2Ray API without the right binary will get a silent runtime failure with no UI-level hint. |

### P1

| ID | Module | Finding |
| --- | --- | --- |
| F-CF-1 | Cache File | `store_rdrc` missing from Inspector form. |
| F-CF-2 | Cache File | `rdrc_timeout` missing from Inspector form. |
| F-CF-3 | Cache File | `store_dns` missing; should be gated on `testing` channel. |
| F-CA-2 | Clash API | `external_ui` field missing. |
| F-CA-3 | Clash API | `external_ui_download_url` field missing. |
| F-CA-4 | Clash API | `default_mode` uses free text input instead of select. |
| F-CA-5 | Clash API | No warning for insecure `0.0.0.0` listen without secret. |
| F-V2-2 | V2Ray API | `stats.inbounds` missing. |
| F-V2-3 | V2Ray API | `stats.outbounds` missing. |
| F-V2-4 | V2Ray API | `stats.users` missing. |
| F-CANVAS-1 | Canvas | Icon mismatch: Palette uses `FlaskConical`, node uses `Braces`. |
| F-CANVAS-2 | Canvas | Plus button renders for settings node despite `compatible: []`. |

### P2

| ID | Module | Finding |
| --- | --- | --- |
| F-CF-4 | Cache File | `store_rdrc` needs deprecation notice in testing channel. |
| F-CF-5 | Cache File | Non-enabled fields could be dimmed when `enabled` is false. |
| F-CA-6 | Clash API | Deprecated fields in imported JSON need migration diagnostics only, not form fields. |
| F-CA-7 | Clash API | `access_control_allow_origin` free-text needs origin semantics note. |
| F-CA-8 | Clash API | `external_ui`/download fields should be under Advanced UI `<details>`. |
| F-V2-5 | V2Ray API | Stats sub-fields should be hidden when `stats.enabled` is false. |
| F-CANVAS-3 | Canvas | Primary button shows `1` (fallback); meaningless for settings node. |
| F-CANVAS-5 | Canvas | Subtitle `"global settings"` too generic; `"cache / api / stats"` is clearer. |

---

## Implementation Tasks

### Inspector — Cache File

- **T-CF-1**: Add `store_rdrc` toggle below `store_fakeip`. Render when `enabled` is true. Add stable-only note or testing deprecation badge based on `channel` prop.
- **T-CF-2**: Add `rdrc_timeout` text field (Duration input). Render only when `store_rdrc` is true.
- **T-CF-3**: Add `store_dns` toggle. Gate with `channel === "testing"` condition. Position after `rdrc_timeout`.
- **T-CF-4**: Add deprecation inline badge on `store_rdrc` when `channel === "testing"`.

### Inspector — Clash API

- **T-CA-1 (P0)**: Add `external_ui_download_detour` as `<select>` using `outboundTags(config)`. Place inside Advanced UI `<details>`. Value must round-trip via `updateField(ref, "clash_api", { ...clashApi, external_ui_download_detour: value || undefined })`.
- **T-CA-2**: Add `external_ui` text field inside Advanced UI `<details>`.
- **T-CA-3**: Add `external_ui_download_url` text field (URL) inside Advanced UI `<details>`.
- **T-CA-4**: Replace `default_mode` `<input type="text">` with `<select>` offering `Rule`, `Global`, `Direct` (empty option maps to omit/default).
- **T-CA-5**: Add inline warning element: when `clashApi.external_controller?.startsWith("0.0.0.0") && !clashApi.secret`, render a `<p className="field-warning">` with security notice.
- **T-CA-6**: Wrap `external_ui`, `external_ui_download_url`, `external_ui_download_detour` in `<details className="advanced-fields"><summary>Advanced UI <span>3</span></summary>...</details>`.

### Inspector — V2Ray API

- **T-V2-1 (P0)**: Add static build-tag warning banner at the top of V2Ray API `ModuleCard` body. Use a distinct `<div className="module-warning">` element. Text: "V2Ray API requires a custom sing-box build with the `with_v2ray_api` build tag. Not available in default releases."
- **T-V2-2**: Add `stats.inbounds` as a comma-list field (`toList`/`fromList`) or tag multiselect using `inboundTags(config)`. Visible when `stats.enabled` is true.
- **T-V2-3**: Add `stats.outbounds` as a comma-list / multiselect using `outboundTags(config)`. Visible when `stats.enabled` is true.
- **T-V2-4**: Add `stats.users` as a text list (`toList`/`fromList`). Add note: "Protocol-level user names — not node tags." Visible when `stats.enabled` is true.

### Diagnostics (diagnostics.ts)

- **T-DIAG-1**: After the `services` loop, add `experimental` block. Check `config.experimental?.clash_api?.external_ui_download_detour` against `outboundTags`; push `missing-clash-api-download-detour` error if not found.
- **T-DIAG-2**: Check `config.experimental?.v2ray_api?.stats?.inbounds` array entries against `inboundTags`; push `missing-v2ray-stats-inbound` errors.
- **T-DIAG-3**: Check `config.experimental?.v2ray_api?.stats?.outbounds` array entries against `outboundTags`; push `missing-v2ray-stats-outbound` errors.
- **T-DIAG-4**: If `channel === "testing"` and `config.experimental?.cache_file?.store_rdrc`, push `deprecated-cache-file-store-rdrc` warning.
- **T-DIAG-5**: If any of `clash_api.{store_mode,store_selected,store_fakeip,cache_file,cache_id}` are present (non-undefined), push `deprecated-clash-api-fields` warning per field.
- **T-DIAG-6**: If `clash_api.external_controller` starts with `0.0.0.0` and `secret` is empty/absent, push `clash-api-insecure-listen` warning.
- **T-DIAG-7**: If `v2ray_api.listen` is non-empty (V2Ray API enabled), push `v2ray-api-build-tag-required` info/warning.

### Canvas / Graph

- **T-NODE-1**: In `graph.ts` loop for settings nodes, specialise subtitle for `path === "experimental"` to `"cache / api / stats"`.
- **T-NODE-2**: In `SbcNode.tsx`, wrap `sbc-node__add` Plus button in `{data.compatible.length > 0 ? (...) : null}`.
- **T-NODE-3**: In `SbcNode.tsx`, guard primary button `sbc-node-primary` with `{data.compatible.length > 0 ? (...) : null}` or change to a plain inspector-open button for settings nodes.
- **T-NODE-4**: In `SbcNode.tsx getNodeIcon`, or in `graph.ts` before `makeNode`, override icon for `kind === "settings" && type === "experimental"` to use `FlaskConical`.

### Palette

- **T-PAL-1**: Add sub-module entries (see Palette section above) once the Inspector supports `openModule` navigation.
- **T-PAL-2**: Add per-module `docsUrl` links for `cache-file/`, `clash-api/`, `v2ray-api/`.

### Tests / Fixtures

- **T-TEST-1**: Add e2e fixture for `settings:experimental` round-trip: JSON with `cache_file.enabled=true`, `clash_api.external_controller`, `v2ray_api.listen`. Import, verify node renders, verify export equals input.
- **T-TEST-2**: Add e2e assertion that `external_ui_download_detour` referencing a non-existent outbound produces an error diagnostic node status.
- **T-TEST-3**: Add unit test in `diagnostics.ts` for `missing-clash-api-download-detour` and `clash-api-insecure-listen`.

---

## Done Criteria

- [ ] All three modules (cache_file, clash_api, v2ray_api) Inspector -> JSON round-trip verified by e2e fixture.
- [ ] Deprecated Clash API fields (`store_mode`, `store_selected`, `store_fakeip`, `cache_file`, `cache_id`) do not appear in the primary Inspector form.
- [ ] `external_ui_download_detour` uses an outbound `<select>` populated from `outboundTags(config)`.
- [ ] V2Ray API ModuleCard shows the build-tag warning banner when expanded.
- [ ] `default_mode` uses `<select>` with `Rule`, `Global`, `Direct` options.
- [ ] `clash-api-insecure-listen` warning fires when controller is `0.0.0.0:*` and secret is empty.
- [ ] `store_rdrc` visible in stable channel; deprecation badge visible in testing channel.
- [ ] `store_dns` field present and gated to `channel === "testing"`.
- [ ] `stats.inbounds`, `stats.outbounds`, `stats.users` fields present in V2Ray API card.
- [ ] Diagnostics cover `missing-clash-api-download-detour`, `missing-v2ray-stats-inbound`, `missing-v2ray-stats-outbound`.
- [ ] Plus button and primary count button hidden for settings nodes with `compatible: []`.
- [ ] At least one fixture test and one diagnostic unit test added.
- [ ] Both stable and testing docs confirmed read (this document).
