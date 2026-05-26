<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# rule-set:remote — Deep UI Review

<!-- Source: sing-box stable 1.8–1.13 + testing 1.14 docs; Palette.tsx, Inspector.tsx, SbcNode.tsx, sharedFieldRegistry.ts, canvas/graph.ts, domain/commands.ts, domain/diagnostics.ts -->

## 1. Official Field Model

### Stable (≤ 1.13)

| Field | Required | Notes |
|---|---|---|
| `type` | Yes | Fixed `"remote"` |
| `tag` | Yes | Unique identifier |
| `format` | Yes* | `"source"` or `"binary"`. Optional when `url` ends in `.json` or `.srs`. |
| `url` | Yes | Download URL |
| `download_detour` | No | Outbound tag to use for download. Default outbound used if empty. |
| `update_interval` | No | Duration string. Default `"1d"`. |

Total stable remote-specific fields: **6** (type, tag, format, url, download_detour, update_interval).

### Testing (1.14)

`http_client` replaces `download_detour` as the preferred download transport configuration.

| Field | Required | Notes |
|---|---|---|
| `type` | Yes | Fixed `"remote"` |
| `tag` | Yes | Unique identifier |
| `format` | Yes* | `"source"` or `"binary"`. Optional when `url` ends in `.json` or `.srs`. |
| `url` | Yes | Download URL |
| `http_client` | No | String (tag of a top-level `http_clients[]` entry) or inline HTTP Client object. Since 1.14. |
| `update_interval` | No | Duration string. Default `"1d"`. |
| `download_detour` | Deprecated | Deprecated in 1.14, removed in 1.16. Tag of outbound for download. |

Total testing remote-specific fields: **7** (type, tag, format, url, http_client, update_interval, download_detour-deprecated).

### Caching note

Remote rule-sets are cached on disk only when `experimental.cache_file.enabled` is `true`. Without cache, the rule-set is re-downloaded on every restart.

---

## 2. Palette Entry

**File:** `src/components/Palette.tsx` line 184

```
{ label: "Rule Set", kind: "rule-set", icon: Layers3, docsUrl: docs("rule-set/"), status: "setup" }
```

### Observations

- The single `"Rule Set"` palette entry dispatches `createFromPalette("rule-set")`, which always creates a `remote` type (see `useProjectStore.ts` line 572–575 and `commands.ts:addRuleSet` default `type = "remote"`). **There is no palette entry specifically for `rule-set:remote` vs `rule-set:local` vs `rule-set:inline`** — the user must switch type in the Inspector after creation.
- `status: "setup"` shows "Setup" badge. The tooltip reads "Add Rule Set setup draft to canvas". This is accurate because the node appears with a placeholder URL and requires editing.
- There is no subtype disambiguation in the palette. A user looking for "remote rule-set" specifically must know to click "Rule Set" and then change nothing (since remote is the default).
- `docsUrl` points to `rule-set/` (the index page), which covers all three types on one page. No direct link to the remote-specific section.

---

## 3. Canvas Node (`SbcNode.tsx`)

**Relevant code:** `src/components/SbcNode.tsx` lines 82–169, `src/canvas/graph.ts` lines 455–496.

### Subtitle

`graph.ts` line 467–471:
```ts
subtitle: ruleSet.type === "remote" && typeof ruleSet.url === "string"
  ? ruleSet.url
  : ruleSet.type === "local" && typeof ruleSet.path === "string"
    ? ruleSet.path
    : `${ruleSet.type} rule-set`,
```

For remote nodes the subtitle shows the full URL. This is correct and informative, but long URLs will be truncated by the node width with no visual affordance for the full value.

### Left ports (inputs from the node's perspective)

```ts
if (kind === "rule-set") {
  return [
    { key: "route-rule", label: "Upstream Route rule set", nodeKind: "route-rule", icon: GitBranch },
    { key: "dns-rule", label: "Upstream DNS rule set", nodeKind: "dns-rule", icon: GitBranch },
  ];
}
```

Correctly models that route rules and DNS rules reference rule-sets.

### Right ports (outputs)

```ts
if (kind === "rule-set") return [{ key: "download-detour", label: "Download detour", nodeKind: "outbound", icon: Network }];
```

One outbound edge for `download_detour`. The edge is only drawn in `graph.ts` when `ruleSet.download_detour` is a non-empty string (line 485). Port is shown even when `http_client` is used instead (testing channel) — the port is correct for stable but orphaned when `download_detour` is absent and `http_client` is an inline object.

### Status

Driven by `diagnosticStatus("/route/rule_set/${index}", diagnostics)`. Status goes `error`/`warning`/`valid`. No dedicated remote-specific diagnostic fires on the rule-set node itself (see Section 5).

---

## 4. Inspector (`Inspector.tsx`)

**Remote-specific block:** lines 1832–1862.

### Rendered fields for `type === "remote"`

1. **Format** (select: `source` / `binary`) — shown for both remote and local.
2. **URL** (text input) — remote only.
3. **Update Interval** (text input) — remote only.
4. **Download Detour** (select from all outbound tags) — remote only.

### Handled fields set

```ts
const ruleSetHandledFields = new Set(["tag", "type", "format", "url", "path", "update_interval", "download_detour", "http_client"]);
```

`http_client` is in the handled set, so it does not leak into `AdvancedScalarFields`.

### `http_client` exposure

`http_client` is exposed via the shared field card mechanism:

```ts
// sharedFieldRegistry.ts line 199
if (ref.kind === "rule-set" && entityType === "remote") groups.push("http-client");
```

The http-client shared group renders:
```ts
if (group === "http-client") {
  return ref.kind === "rule-set"
    ? [{ label: "HTTP Client", path: ["http_client"], kind: "select", options: httpClientOptions }]
    : ...
}
```

This renders `http_client` as a **select** picking from `config.http_clients[]` tags — correct for the "string reference" form. However, the `http_client` field also accepts an **inline object** (per testing docs). The inline object form is not editable through the Inspector; only the tag reference form is supported.

### Channel awareness

The Inspector does **not** read `channel` from the store. `download_detour` is shown to all users regardless of target channel, with no deprecation warning for testing (1.14) targets. The deprecation message from the official docs ("deprecated in 1.14, removed in 1.16") has no UI representation.

### Type switch

The type selector for rule-set uses `CREATABLE_RULE_SET_TYPES = ["remote", "local", "inline"]`. Switching type calls `changeEntityType`, which runs `createRuleSet(nextType, ref.tag)`. When switching away from remote, only `download_detour` is preserved if switching back to remote (line 950–951). All other remote fields (url, update_interval, http_client) are lost on type switch. This is intentional behavior via `createRuleSet`, not a bug, but users are not warned.

---

## 5. Diagnostics (`diagnostics.ts`)

### Existing rule-set diagnostics

- `missing-route-rule-set` (error): route rule references a tag that does not exist in `route.rule_set`.
- `missing-dns-rule-set` (error): DNS rule references a missing rule-set tag.
- `stable-version-gated-http-clients` (warning): fires if any `http_clients[]` entries exist on a stable target. Indirectly protects `http_client` references.

### Missing diagnostics (gaps)

| Missing check | Severity | Description |
|---|---|---|
| `url` empty or missing on remote rule-set | Error | `type=remote` with no `url` is an invalid config |
| `format` missing on remote rule-set | Error | `format` is required for remote when URL has no `.json`/`.srs` extension |
| `download_detour` references missing outbound | Error | No check validates that `download_detour` tag exists in `config.outbounds` |
| `download_detour` deprecated on testing channel | Warning | No deprecation warning when `download_detour` is set and channel is `testing` |
| `http_client` string references missing `http_clients[]` entry | Error | No validation that the tag in `http_client` resolves |

---

## 6. Priority Findings

### P0 — Correctness Bugs

**P0-A: `download_detour` reference not validated**

`diagnostics.ts` validates outbound references for route finals, DNS server detours, endpoint detours, and service detours — but not `route.rule_set[].download_detour`. A user can set `download_detour: "nonexistent"` and the UI will show `valid` status on the node while the config would fail at runtime.

Affected file: `src/domain/diagnostics.ts`
Fix: iterate `config.route?.rule_set` and push `missing-rule-set-download-detour` error when `download_detour` is set but not in `outboundTags`.

**P0-B: `url` empty is not caught**

`createRuleSet` inserts `url: "https://example.com/rules.json"` as placeholder. If the user clears the URL field, there is no validation error. `type=remote` with `url: ""` is an invalid sing-box config.

Affected file: `src/domain/diagnostics.ts`
Fix: push `missing-rule-set-url` error when `ruleSet.type === "remote"` and `!ruleSet.url`.

### P1 — Functional Gaps

**P1-A: No deprecation warning for `download_detour` on testing channel**

On `channel === "testing"`, using `download_detour` is deprecated since 1.14 and scheduled for removal in 1.16. The Inspector renders the Download Detour field identically regardless of channel. There is no warning badge, tooltip, or diagnostic.

Affected files: `src/components/Inspector.tsx`, `src/domain/diagnostics.ts`
Fix: add `"warning"` diagnostic `deprecated-rule-set-download-detour` when `channel === "testing"` and `ruleSet.download_detour` is set.

**P1-B: `http_client` inline object form not supported**

The `http_client` field accepts both a string tag reference and an inline object with `engine`, `version`, `headers`, dial fields, and TLS fields. The Inspector only exposes the string-reference select. Saving an inline object (e.g. imported from a real config) is preserved in the raw store but cannot be edited. The field appears as empty in the select if the value is an object.

Affected file: `src/components/Inspector.tsx`
Fix (minimal): detect `typeof entity.http_client === "object"` and render a JSON textarea fallback instead of the select, so inline objects are at least visible and editable.

**P1-C: `format` field not validated for remote rule-sets**

`format` is required unless the URL ends with `.json` or `.srs`. The UI always defaults `format` to `"source"` via `String(entity.format ?? "source")` in the select rendering, so the visual default is correct, but if an imported config has no `format` field and a non-standard URL extension, there is no error diagnostic.

Affected file: `src/domain/diagnostics.ts`
Fix: push `missing-rule-set-format` warning when `ruleSet.type !== "inline"` and `!ruleSet.format` and the path/url does not end with `.json` or `.srs`.

**P1-D: Canvas port shows `download-detour` for all remote nodes regardless of channel**

On the testing channel where `http_client` replaces `download_detour`, the right port labeled "Download detour" is still drawn. If a user connects an outbound via the canvas, it sets `download_detour`, which is deprecated. The port has no channel-conditional logic.

Affected file: `src/components/SbcNode.tsx` (right port logic, line 169)
Fix: conditionally label this port "Download detour (deprecated)" on testing channel, or suppress the port entirely and surface `http_client` instead.

**P1-E: Palette `"Rule Set"` entry creates remote by default with no label distinction**

The palette entry is `{ label: "Rule Set", kind: "rule-set", status: "setup" }`. It always creates a `remote` type node. A user looking for a local or inline rule-set must click "Rule Set", wait for the node to appear, then switch type in the Inspector. The palette gives no hint that "Rule Set" means "remote rule-set by default".

Affected file: `src/components/Palette.tsx`
Options: rename to "Remote Rule Set" (simplest), or add three palette entries (remote/local/inline), or show the subtype in the setup tooltip.

---

## 7. Implementation Tasks

### Priority order

1. **[P0-A]** Add `missing-rule-set-download-detour` diagnostic in `diagnostics.ts` — validate `download_detour` against `outboundTags`.
2. **[P0-B]** Add `missing-rule-set-url` diagnostic — error when `type=remote` and `url` is falsy.
3. **[P1-A]** Add `deprecated-rule-set-download-detour` warning in `diagnostics.ts` for `channel === "testing"`.
4. **[P1-D]** Update SbcNode right-port label for `rule-set` to reflect deprecation on testing channel.
5. **[P1-B]** Handle `http_client` inline object in Inspector — fallback textarea or structured editor.
6. **[P1-C]** Add `missing-rule-set-format` warning for non-standard URL extension without explicit `format`.
7. **[P1-E]** Clarify palette entry label or split into subtype entries.

### Low-priority / nice-to-have

- Show a visual "cache disabled" hint on the canvas node when `experimental.cache_file.enabled` is not set and `type=remote` (runtime behavior note, not a config error).
- Truncated URL subtitle: add a title attribute or tooltip on hover to show the full URL.
- `update_interval` input has no format validation; a duration validator (e.g. regex `\d+[smhd]`) would prevent malformed intervals.

---

## 8. Field Coverage Summary

| Field | stable | testing | Palette | Canvas | Inspector | Diagnostic |
|---|---|---|---|---|---|---|
| `tag` | req | req | auto-generated | title | rename input | duplicate-tag |
| `type` | req | req | fixed remote | type label | select (all 3) | — |
| `format` | req* | req* | hardcoded "source" | — | select source/binary | missing (P1-C) |
| `url` | req | req | placeholder URL | subtitle | text input | missing (P0-B) |
| `download_detour` | optional | deprecated | — | edge to outbound | select (all channels) | missing ref check (P0-A), missing deprecation warn (P1-A) |
| `update_interval` | optional | optional | hardcoded "1d" | — | text input | — |
| `http_client` (string) | n/a | optional | — | — | shared select | — |
| `http_client` (object) | n/a | optional | — | — | not editable (P1-B) | — |
