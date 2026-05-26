<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Rule Set / Inline — Deep UI Review

Status: official-read. Sources: stable `rule-set/index.md` + `rule-set/headless-rule.md`, testing `rule-set/index.md` + `rule-set/headless-rule.md`, Palette.tsx, SbcNode.tsx, Inspector.tsx, commands.ts, diagnostics.ts, graph.ts.

## Scope

- Node ID: `rule-set:inline`
- Palette kind: `rule-set` (status `setup`), shared with local and remote types
- Official docs: `rule-set/index.md`, `rule-set/headless-rule.md`
- Version gate: requires sing-box 1.10+
- This node writes one object in `route.rule_set[]` with `type: "inline"`.

---

## Official Model

### Top-level Fields

| Field | Required | Notes |
|---|---|---|
| `type` | Optional | Value must be `"inline"`. Docs say "optional" but CREATABLE_RULE_SET_TYPES enforces explicit selection. |
| `tag` | Required | Unique identifier referenced by route rules and DNS rules. |
| `rules` | Required | Array of Headless Rule objects (see below). |

No other top-level fields. `format`, `url`, `path`, `download_detour`, `update_interval`, `http_client` are all **not valid** for inline type.

### Headless Rule Fields (per entry in `rules[]`)

**Default rule shape (stable + testing):**

| Field | Since | Notes |
|---|---|---|
| `query_type` | - | DNS query type; integer or name string. Testing 1.14: also applies to internal domain resolution without specific server. |
| `network` | - | `tcp` or `udp`. |
| `domain` | - | Full domain match. |
| `domain_suffix` | - | Domain suffix match. |
| `domain_keyword` | - | Domain keyword match. |
| `domain_regex` | - | Domain regex match. |
| `source_ip_cidr` | - | Source IP CIDR. |
| `ip_cidr` | - | IP CIDR. Alias for `source_ip_cidr` when `rule_set_ipcidr_match_source` is enabled. |
| `source_port` | - | Source port. |
| `source_port_range` | - | Source port range. |
| `port` | - | Port. |
| `port_range` | - | Port range. |
| `process_name` | - | Linux/Windows/macOS only. |
| `process_path` | - | Linux/Windows/macOS only. |
| `process_path_regex` | 1.10 | Linux/Windows/macOS only. Regex match. |
| `package_name` | - | Android package name. |
| `package_name_regex` | 1.14 testing | Android package name regex. |
| `network_type` | 1.11 | `wifi`/`cellular`/`ethernet`/`other`. Graphical clients on Android + Apple only. |
| `network_is_expensive` | 1.11 | Metered/expensive network. Graphical clients on Android + Apple only. |
| `network_is_constrained` | 1.11 | Low Data Mode. Apple graphical clients only. |
| `network_interface_address` | 1.13 | Map of network_type -> CIDR list. Graphical clients on Android + Apple only. |
| `default_interface_address` | 1.13 | CIDR list for default interface. Linux/Windows/macOS only. |
| `wifi_ssid` | - | Android/Apple graphical clients only. |
| `wifi_bssid` | - | Android/Apple graphical clients only. |
| `invert` | - | Invert match result. |

**Logical rule shape:**

- `type: "logical"`, `mode: "and" | "or"` (required), `rules[]` (nested default rules), `invert`.

**Matching logic:**

`(domain || domain_suffix || domain_keyword || domain_regex || ip_cidr) && (port || port_range) && (source_port || source_port_range) && other fields`

Total canonical headless rule fields: **26 stable** (default + logical), **2 additional testing** (`package_name_regex`, plus `query_type` behavior change).

---

## Version Gate Summary

| Feature | Min Version |
|---|---|
| `type: "inline"` | 1.10 stable |
| `process_path_regex` in headless rules | 1.10 |
| `network_type`, `network_is_expensive`, `network_is_constrained` | 1.11 |
| `network_interface_address`, `default_interface_address` | 1.13 |
| `package_name_regex` | 1.14 testing only |
| `query_type` cross-domain behavior change | 1.14 testing |

The supported targets in the UI are 1.12-stable, 1.13-stable, 1.14-testing. All three support `type: "inline"` without restriction. The UI targets the minimum supported version at 1.12, so inline is universally available in all configured targets.

---

## Relationship Model

```
rule-set:inline
  ├── route.rule_set[]     →  canonical JSON location (shared with local/remote)
  ├── route.rules[].rule_set →  route rules reference this tag (left input port)
  ├── dns.rules[].rule_set   →  DNS rules reference this tag (left input port)
  └── download_detour        →  NOT applicable for inline type
```

---

## Left: Palette / Library

**Current state:**

- Single entry: `{ label: "Rule Set", kind: "rule-set", status: "setup" }`.
- `createFromPalette("rule-set")` always calls `addRuleSet(config, "remote", preferredRuleSetTag("remote"))`. Creates a `remote` type node, never an `inline`.
- The user must then open Inspector and switch `type` to `inline` via the type dropdown.

**Issues:**

**P1-L1 — Palette always creates remote, never inline.**
Clicking "Rule Set" in the Library produces a `remote` type rule-set. There is no Palette path to directly create an `inline` rule-set. The user must add remote, open Inspector, change type, which silently destroys the remote-specific fields. The Palette should support type selection or provide a separate entry for inline.

**P1-L2 — No version gate hint for inline.**
The Palette entry does not indicate that `type: "inline"` requires 1.10+. Since the UI minimum target is 1.12, all current targets support inline; however, if a legacy target is ever added (1.8 or 1.9), there is no gating mechanism in place. No `itemStatus` gate exists for inline in either `Palette.tsx` or `commands.ts`.

---

## Middle: Canvas Node

**Current state (from SbcNode.tsx `getPortSpecs`, `isPortConnected`, `graph.ts`):**

Left ports (inputs):
- `route-rule` — "Upstream Route rule set" → nodeKind `route-rule`
- `dns-rule` — "Upstream DNS rule set" → nodeKind `dns-rule`

Right ports (outputs):
- `download-detour` — "Download detour" → nodeKind `outbound`

Subtitle logic (`graph.ts`):
- `remote` type: shows URL.
- `local` type: shows path.
- Any other type (including `inline`): shows `"inline rule-set"` (the fallback `${ruleSet.type} rule-set`).

Edge emission: the `download-detour` edge is only created when `ruleSet.type === "remote"`. For inline type no edge is emitted, but the output port handle is still rendered on every rule-set node regardless of type.

Compatible array: `compatible: []` — no `+` button behavior is implemented for rule-set nodes.

**Issues:**

**P1-C1 — `download-detour` output port shown for inline type.**
`getPortSpecs` returns `[{ key: "download-detour", ... }]` for all rule-set nodes unconditionally. For inline type, `download_detour` is not a valid field and serves no purpose. The port is rendered, is interactive, and its click handler (`togglePortConnection`) can attempt to wire an outbound to an inline rule-set. The `isPortConnected` check (`Boolean(ruleSet.download_detour)`) will always be false for inline, so the port shows as disconnected but is still fully clickable. This is misleading and creates a dead UI affordance.

**P2-C2 — Subtitle `"inline rule-set"` is weak.**
The canvas subtitle for inline type falls through to the generic fallback. A more informative subtitle would show the rule count: e.g. `"inline · N rules"`.

**P2-C3 — Node titlebar shows `rule-set / inline`, not the tag.**
The titlebar text is `${data.kind} / ${data.type}` — always literal kind/type strings. The tag (which is the user-visible name) only appears in the summary area. Compare with how the user experience would benefit from tag-first display.

---

## Right: Inspector

**Current state (Inspector.tsx lines 1818–1888):**

Rendered for `ref.kind === "rule-set"`:
1. Format select — shown when `entity.type === "remote" || entity.type === "local"`. Not shown for inline. Correct.
2. URL + Update Interval + Download Detour select — shown when `entity.type === "remote"`. Not shown for inline. Correct.
3. Path input — shown when `entity.type === "local"`. Not shown for inline. Correct.
4. **Rules JSON textarea** — shown when `entity.type === "inline"`. Renders `JSON.stringify(entity.rules ?? [], null, 2)`. On change, attempts `JSON.parse`; on failure, stores the raw string value. This is the only editing surface for `rules[]`.
5. Type dropdown — `CREATABLE_RULE_SET_TYPES` = `["remote", "local", "inline"]`. Available for all rule-set nodes. Switching to `inline` calls `createRuleSet("inline", tag)` which seeds `rules: [{ domain_suffix: ["example.com"] }]`.
6. `AdvancedScalarFields` catch-all — uses `ruleSetHandledFields`. The `rules` field is **not** in `ruleSetHandledFields`, but since `rules` is an array, `editableScalarFields` filters it out (only `typeof value === "string" || "number" || "boolean"` pass). So `rules` does not appear in the advanced catch-all. This means there is no double-rendering of `rules`.

`ruleSetHandledFields`: `{ "tag", "type", "format", "url", "path", "update_interval", "download_detour", "http_client" }`.

**Issues:**

**P0-I1 — `rules[]` is edited via a raw JSON textarea with no structure.**
The entire `rules[]` array — which can contain complex headless rule objects with 26+ matcher fields — is presented as a freeform JSON textarea. There is:
- No per-rule add/remove affordance.
- No per-field validation or type-specific inputs.
- No schema hint or field autocomplete.
- No error display when the textarea content fails JSON.parse (the raw string is stored instead, silently corrupting the config).
- No rule count shown.

This is the primary editing surface for inline rule-sets and is inadequate for users who need to author, inspect, or modify individual rules.

**P1-I2 — Silent corruption on parse failure.**
When the user types invalid JSON in the Rules JSON textarea, `JSON.parse` throws and the catch block stores the raw string as `entity.rules`. The config now has `rules: "<invalid json string>"`. This passes `AdvancedScalarFields` filtering (array → filtered) but the value is invalid. The diagnostic system does not detect this condition. There is no error banner, no field-level indicator, and no impediment to exporting a corrupted config.

**P1-I3 — No diagnostic for `rules: []` (empty inline rule-set).**
An inline rule-set with an empty `rules` array is technically invalid — it would never match anything and the official doc says `rules` is required. The diagnostic system (`diagnostics.ts`) does not check for empty `rules` on inline rule-sets. There is no P-path `route/rule_set/${index}/rules` check.

**P1-I4 — Type switch from inline to remote does not warn about rules loss.**
`changeEntityType` for rule-set calls `createRuleSet(nextType, ref.tag)`, which for `remote` returns `{ type: "remote", tag, format: "source", url: "...", update_interval: "1d" }`. The existing `rules[]` array is dropped silently. There is no confirmation dialog, undo affordance, or warning. Note that switching back from remote to inline reseeds `rules: [{ domain_suffix: ["example.com"] }]` — the original inline content is not recoverable.

**P2-I5 — `download_detour` shown in type dropdown but field does not exist for inline.**
When `entity.type === "inline"`, the type dropdown still offers switching back to `"remote"`. This is by design (correct). However, `ruleSetHandledFields` includes `"download_detour"`. If somehow `download_detour` is present on an inline entity (e.g. imported from JSON with the field set), `AdvancedScalarFields` will silently suppress it. The field will not appear in the Inspector and will persist invisibly in the exported config.

---

## Diagnostics Gap

**Current checks in `diagnostics.ts`:**
- Missing route rule rule-set tag reference.
- Missing DNS rule rule-set tag reference.
- Stable version gate for `certificate_providers` and `http_clients`.

**Missing checks for inline:**

| Missing Check | Severity |
|---|---|
| `rules` is empty array on inline type | warning |
| `rules` is not an array (parse failure stored as string) | error |
| `download_detour` present on inline type (field is illegal for this type) | warning |
| `format` present on inline type (illegal field) | warning |

---

## Implementation Tasks

### P0

**T-P0-1: Add a structured repeater for `rules[]` in the inline Inspector.**

Replace the raw JSON textarea with a repeater component that:
- Lists each rule entry with an index and a condensed label (e.g. first non-empty field key + value count).
- Provides add-rule and delete-rule buttons per entry.
- Shows per-entry editing, at minimum: textarea-per-entry (step 1), then field-by-field inputs for each known headless rule field (step 2).
- Shows rule count in the Inspector heading.
- Shows an error indicator when a rule entry fails validation.

**T-P0-2: Fix silent JSON parse failure in the Rules textarea.**

Until a structured repeater exists: when `JSON.parse` throws, do not store the raw string. Instead, keep the previous valid value and show an inline error label ("Invalid JSON — changes not applied").

### P1

**T-P1-1: Add diagnostic for empty or non-array `rules` on inline type.**

In `diagnostics.ts`, for each `route.rule_set` entry where `type === "inline"`:
- Error if `!Array.isArray(rules)`.
- Warning if `Array.isArray(rules) && rules.length === 0`.

**T-P1-2: Add confirmation or undo for type switch that destroys `rules[]`.**

When switching an inline rule-set to any other type, detect that `rules` is a non-empty array and surface a warning: "Switching type will discard inline rules. Continue?". Alternatively, preserve `rules` in a side channel for undo.

**T-P1-3: Gate `download-detour` output port on entity type.**

In `SbcNode.tsx`, `getPortSpecs` for `kind === "rule-set"`: return the `download-detour` port only when `type !== "inline"` (and for `type !== "local"` as well, since `download_detour` is remote-only). For inline type, return `[]`.

**T-P1-4: Palette entry for inline or type-aware creation flow.**

Either:
- Add a dedicated Palette entry `{ label: "Inline Rule Set", kind: "rule-set-inline", status: "setup" }` that calls `addRuleSet(config, "inline", ...)`.
- Or: on clicking "Rule Set", show a sub-menu selecting remote/local/inline before committing.

### P2

**T-P2-1: Improve inline node subtitle in `graph.ts`.**

Change the `inline` fallback subtitle from `"inline rule-set"` to `"inline · N rules"` where N is `(Array.isArray(ruleSet.rules) ? ruleSet.rules.length : 0)`.

**T-P2-2: Add fixture or e2e coverage for inline rule-set round-trip.**

One external fixture with an inline rule-set exists (`baiyian-sing-box-config-template-1.11.x-qcy_op_fakeip_mi.json-b6f66d79.json`, 1 inline rule-set). Add it or a similar fixture to the external-fixtures spec to cover import + render + export for inline type.
