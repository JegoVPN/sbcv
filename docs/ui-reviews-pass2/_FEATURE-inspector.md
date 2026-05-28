# Feature UX review — Inspector / editing patterns
<!-- reviewer: principal PM + FE; lens: can a new user understand & use it; source: our code + UX principles -->

Scope: the reusable editing machinery shared by every node in the right Inspector — field
builders, sensitive fields, repeaters, JSON fallback, type-switch, shared cards, advanced
disclosures, diagnostics. (Per-node field conformance was reviewed in pass 1.)

## Feature inventory
- `Inspector` shell: header + kind/tag heading + delete button; Tag editor (debounced, commit on blur) `Inspector.tsx:1800-1821`, `2094-2107`; Type `<select>` for inbound/outbound/dns-server/endpoint/service/rule-set `Inspector.tsx:2109-2164`.
- `SensitiveTextField` — password input + Show/Hide reveal toggle `Inspector.tsx:639-673`. Auto-applied in Advanced scalar fields by name heuristic `SENSITIVE_FIELD_PATTERNS` `Inspector.tsx:620-637`, `705-714`.
- "Generate UUID" buttons (inbound users + vmess/vless/tuic outbound) `Inspector.tsx:3154-3168`, `3435-3446`. No generator for passwords / pre-shared keys.
- `AdvancedScalarFields` disclosure (auto-renders unhandled scalar fields) `Inspector.tsx:675-731`; `AdvancedNonScalarFields` disclosure wrapping `JsonField` `Inspector.tsx:820-848`.
- `JsonField` — textarea JSON fallback for unstructured objects/arrays `Inspector.tsx:794-818`.
- `InlineRuleSetEditor` — JSON textarea for inline rule-set with live parse error `Inspector.tsx:733-783`.
- Repeaters / list editors (add/remove rows), all hand-rolled per call site:
  - Inbound users (schema-driven) `Inspector.tsx:3125-3236`; ccm/ocm + hysteria-realm users `Inspector.tsx:5086-5125`, `5199-5256`.
  - WireGuard peers `Inspector.tsx:4588-4675`; DERP mesh peers + verify-client URLs `Inspector.tsx:4867-4979`.
  - Key/value maps: HTTP headers `Inspector.tsx:3747-3803`, naive extra_headers `3806-3864`, DoH headers `4468-4526`, torrc `3299-3361`, ccm/ocm headers `5126-5185`, hosts predefined `4380-4456`.
- Type-switch command (replaces entity) `commands.ts:902-968`; tag rename + reference remap `commands.ts:975+`.
- Shared field cards `SharedFieldCards`/`ModuleCard` (listen/dial/tls/multiplex/transport/quic/…) gated by `sharedGroupsForEntity` `Inspector.tsx:1695-1745`, `sharedFieldRegistry.ts:161-219`; field defs `Inspector.tsx:1420-1625`.
- `PlatformBanner` (platform / build-tag / deprecated / channel notes) `Inspector.tsx:786-792`.
- Diagnostics live in a *separate* panel/tab, not in the Inspector `InspectorPanels.tsx:83-105`.

## UX findings (prioritized)

- **[P0] Changing Type silently destroys all field data.** `changeEntityType` replaces the
  node with a fresh `createX(nextType)` and preserves only `tag` (plus `detour`/`endpoint`/
  `listen`/`listen_port` in a few kinds). `commands.ts:902-968`. A first-time user who picks
  the wrong protocol, fills in server/port/uuid/password/users/tls, then corrects the Type loses
  everything — no confirm dialog, no warning, no undo affordance in the Inspector. The Type
  `<select>` at `Inspector.tsx:2113` looks like a harmless dropdown. Needs a confirm step or a
  "this will reset fields" warning.

- **[P0] `JsonField` writes invalid JSON to the config as a raw string.** On parse failure it
  falls back to `onChange(event.target.value)` with no error shown. `Inspector.tsx:808-813`.
  So a half-typed object in any "Advanced JSON fields" row (or the ssm-api Endpoint Mapping
  `Inspector.tsx:4803`) silently coerces e.g. `{ "a":` into the string `'{ "a":'` and exports it.
  The user gets no feedback that the field is now a string, not an object. `InlineRuleSetEditor`
  already does this correctly (keeps last-valid value + shows a `role="alert"` hint,
  `Inspector.tsx:758-781`); `JsonField` should mirror that pattern.

- **[P0] No required-field markers or pre-export validation in the Inspector.** Nothing in the
  panel marks a field required or flags it empty. `server`/`server_port` render as plain inputs
  (`Inspector.tsx:3376-3414`, dns `4278-4315`) and `updateField(..., undefined)` is written when
  blank, so a brand-new outbound/dns-server with empty server, or a vmess/vless with empty UUID
  (`Inspector.tsx:3430-3433`), exports as an invalid-but-silent config. The new user only finds
  out by switching to the Diagnostics tab — if they know it exists. Add inline required markers +
  empty-state errors on the fields the protocol actually needs.

- **[P0] "Add" inserts a blank `{"": ""}` row that exports as a real empty key.** Every key/value
  repeater seeds a new row with an empty key: headers `Inspector.tsx:3797`, naive extra_headers
  `3857`, DoH headers `4519`, torrc `3355`. Because writers persist the object whenever it has
  keys (e.g. `Object.keys(next).length`), an untouched added row ships `{"": ""}` in the export.
  Rename is also blocked while the key is empty (`if (!newKey || newKey === key) return`,
  `Inspector.tsx:3765`), so the row looks editable but the Name field silently no-ops until you
  type — confusing, and the empty entry persists if you give up. (Contrast: hosts `addRow`
  `Inspector.tsx:4413-4424` and ccm/ocm `addHeader` `5150-5157` seed a real placeholder key —
  the correct pattern.) Seed a placeholder key and/or drop empty-key rows on export.

- **[P1] Diagnostics are not shown next to the offending field.** All semantic errors render in a
  separate Diagnostics tab as `code / path / message` rows `InspectorPanels.tsx:83-105`; the
  Inspector has zero diagnostic surface (only the InlineRuleSetEditor JSON hint at
  `Inspector.tsx:778`). A new user editing a node never sees "this is wrong" where they are
  looking. At minimum, surface diagnostics whose `path` maps to the selected entity inline in the
  Inspector header.

- **[P1] Shared TLS card mixes client-only and server-only fields with no role split.** The single
  TLS `ModuleCard` lists "Insecure (client only)", "Disable SNI (client only)", "Key Path
  (server)", "Client Authentication (server)", Reality "server-only" handshake, etc., all in one
  flat list regardless of whether the selected node is an inbound (server) or outbound (client)
  `Inspector.tsx:1509-1547`. A first-time user can't tell which half applies to their node and can
  set contradictory options (e.g. `insecure` on a server inbound). Group/hide by direction.

- **[P1] Repeater "Add" buttons are visually weak and rows give no completeness cue.** Add actions
  use the small `palette-action` link-button at the bottom of a fieldset (e.g. peers
  `Inspector.tsx:4670`, users `3231`); incomplete rows (blank public_key, blank UUID, blank header
  value) carry no error/empty styling. Empty-state hints exist ("No peers… Click Add",
  `Inspector.tsx:4610`) which is good, but once a row exists there's no signal it's still invalid.

- **[P2] Advanced disclosures can bury fields a node actually needs, and surface noise.**
  `AdvancedScalarFields`/`AdvancedNonScalarFields` auto-dump *every* unhandled scalar/object field
  into collapsed `<details>` `Inspector.tsx:686-690`, `831-835`. Useful as a catch-all, but for a
  new user (a) important-but-unmodeled fields hide behind "Advanced fields N", and (b) imported
  configs can show cryptic raw keys with no labels/help. The count badge helps; consider promoting
  known-important keys out of Advanced.

- **[P2] Sensitive fields: reveal is discoverable but no copy + uneven "generate".** `Show/Hide`
  is clear `Inspector.tsx:662-669`, but there's no copy-to-clipboard, and "Generate" exists only
  for UUIDs — passwords, Reality keys, pre-shared keys, mesh PSK, tokens have no generator
  (`Inspector.tsx:4636`, `4981-4985`, `5110-5113`), so users hand-roll secrets. Also the
  name-heuristic masking (`SENSITIVE_FIELD_PATTERNS`, `Inspector.tsx:620-637`) only covers
  Advanced scalar fields — a sensitive value surfaced via `JsonField` is shown in cleartext.

- **[P2] Tag rename has no inline uniqueness/empty feedback.** Commit-on-blur calls `renameTag`,
  which silently no-ops on empty or duplicate (`commands.ts:975-976`), so the field just snaps
  back with no message `Inspector.tsx:2101-2104`. A new user typing a blank/dup tag sees the edit
  "disappear" with no explanation.

## New-user verdict
The Inspector is feature-complete and consistent in *structure* (every node gets tag/type, shared
cards, advanced disclosures), but it trusts the user far too much: it never marks required fields,
never validates before export, silently turns bad JSON into strings, ships blank `{"":""}` rows,
and — most dangerously — wipes a node's data on a Type change with no warning. A first-time user
can produce an invalid or unintentionally-emptied config without a single visible cue, because the
only error surface lives in a separate Diagnostics tab. The reusable plumbing is solid; the missing
piece is inline, field-level safety and feedback.

SUMMARY: 4 P0, 4 P1, 3 P2.
