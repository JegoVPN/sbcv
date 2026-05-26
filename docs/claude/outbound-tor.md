<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Outbound / tor UI Review

<!-- Source: official stable + testing docs (identical), Palette.tsx, Inspector.tsx, sharedFieldRegistry.ts, commands.ts, protocols.ts -->

## Official Field Model

Stable and testing docs are identical. All fields:

| Field | Required | Type | Notes |
|---|---|---|---|
| `type` | yes | string | always `"tor"` |
| `tag` | yes | string | unique node identifier |
| `executable_path` | no | string | path to the Tor binary; if set, embedded Tor is ignored |
| `extra_args` | no | string[] | extra CLI args passed when starting the Tor instance |
| `data_directory` | no (recommended) | string | data directory for Tor; marked `==Recommended==`; each start is very slow without it |
| `torrc` | no | object (map) | key/value torrc options; values are any JSON scalar |
| dial fields | no | shared | standard Dial Fields group |

Total official fields: 5 Tor-specific + shared Dial group = **6** (excluding tag/type).

**Build-tag restriction:** The official doc states: "Embedded Tor is not included by default, see [Installation](/installation/build-from-source/#build-tags)." The `tor` outbound requires either an embedded Tor binary compiled with the `with_tor` build tag, or an external Tor binary on disk pointed to by `executable_path`. Standard release binaries from the sing-box download page do not include embedded Tor.

## Implementation Audit

### Palette (Left Panel)

- Entry: `{ label: "Tor", kind: "tor-out", icon: Network, docsUrl: docs("outbound/tor/"), status: "setup" }` (Palette.tsx:169).
- Kind `"tor-out"` maps to type `"tor"` via `OUTBOUND_PALETTE_TYPES` (protocols.ts:17). Correct.
- `status: "setup"` renders a SETUP action. Acceptable — adds the node with a default object.
- Docs URL points to `outbound/tor/`. Correct.
- **No build-tag caveat is shown.** The Palette entry looks identical to any other outbound. A user who adds a Tor node without a `with_tor` binary will produce a config that silently fails at runtime.

### Default Object (commands.ts createOutbound)

`commands.ts:404-413` generates:
```json
{
  "type": "tor",
  "tag": "tor-out",
  "executable_path": "/usr/bin/tor",
  "extra_args": [],
  "data_directory": "$HOME/.cache/tor",
  "torrc": { "ClientOnly": 1 }
}
```

Findings:
- `executable_path` is hardcoded to `/usr/bin/tor`. This is reasonable as a "use external Tor" default that works without the build tag. However, this path is Linux-specific; macOS users with Homebrew-installed Tor typically have `/opt/homebrew/bin/tor` or `/usr/local/bin/tor`.
- `extra_args: []` is technically fine but creates an empty array in the exported JSON. Official default is omitting the field entirely; an empty array is accepted but slightly noisy.
- `data_directory: "$HOME/.cache/tor"` matches the official example. Good.
- `torrc: { ClientOnly: 1 }` matches the official example. Reasonable client-safe default.
- No dial fields are included in the default. This is correct since they are all optional.

### sharedFieldRegistry

- `outboundDialTypes` (sharedFieldRegistry.ts:150) includes all `CREATABLE_OUTBOUND_TYPES` minus `block`, `dns`, `selector`, `urltest`. Since `"tor"` is in `CREATABLE_OUTBOUND_TYPES` (protocols.ts:39) and is not excluded, it is included in `outboundDialTypes`. The Dial shared group will be offered in the Inspector. **Correct per official spec.**
- `outboundTlsTypes` does NOT include `"tor"` — no TLS group offered. Correct; Tor outbound has no TLS field.
- `outboundMultiplexTypes` does NOT include `"tor"` — no Multiplex group offered. Correct.
- `outboundTransportTypes` does NOT include `"tor"` — no V2Ray Transport group offered. Correct.
- `outboundQuicTypes` does NOT include `"tor"` — no QUIC group offered. Correct.

### Inspector (Right Panel)

#### Fields presented first-class

The generic outbound block (Inspector.tsx:1505-1546) shows:
- `server` — present only if `"server" in entity`. The Tor default object has no `server` key; this field is not shown. Correct — Tor has no `server` field.
- `server_port` — same logic; not shown. Correct.
- `outbounds` / `default` — selector/urltest only; not applicable.

#### Fields falling to AdvancedScalarFields

`outboundHandledFields` (Inspector.tsx:128-141) lists: `tag`, `type`, `server`, `server_port`, `outbounds`, `default`, `tls`, `multiplex`, `transport`, `udp_over_tcp`, and all dial shared fields. It does NOT include: `executable_path`, `data_directory`, `extra_args`, or `torrc`.

Consequences per field:

- `executable_path` — falls through to `AdvancedScalarFields`. `editableScalarFields` (Inspector.tsx:205-211) surfaces it as a plain text `<input>` inside the collapsed "Advanced fields" `<details>` element. A path field is at least editable as text, but it is buried in Advanced rather than being first-class.
- `data_directory` — same treatment: plain text input in Advanced fields. The official doc marks this `==Recommended==`; placing it in a collapsed Advanced section contradicts its recommended status and may cause users to leave it unset (leading to very slow startups).
- `extra_args` — `editableScalarFields` only surfaces scalar values (`string | number | boolean`). `extra_args` is an array (`string[]`), so it is **completely hidden** from the Inspector. The value set in the default (`[]`) is never editable through the UI, and if a user imports a config with non-empty `extra_args`, those values are invisible and cannot be edited.
- `torrc` — `editableScalarFields` only surfaces scalars. `torrc` is an object (map), so it is also **completely hidden** from the Inspector. `torrc` options (e.g. `ClientOnly`, `Socks5Proxy`, `HiddenServiceDir`) are the primary way to configure Tor's behavior; they are fully inaccessible through the current UI.

#### Dial section

Offered via `outboundDialTypes`. Provides: detour, bind_interface, connect_timeout, domain_resolver, network_strategy, network_type, fallback_network_type, fallback_delay. Correct and complete per spec.

### Canvas Node (SbcNode)

- No Tor-specific port or node logic is present in `graph.ts` or `SbcNode.tsx`. Tor is treated as a plain outbound node. This is correct: Tor has no server-style ports, no multiplex, no selector group membership beyond what the generic outbound receives.
- Tor outbound nodes can be added as selector/URLTest candidates and as dial detour targets via the generic selector-group port mechanism. No issues.

### Fixtures

No existing fixture file contains a `"type": "tor"` outbound. There is no import/export smoke test coverage for this node type.

## Priority Findings

### P0

**P0-1: No build-tag warning anywhere in the UI.**
The `tor` outbound requires either a build with the `with_tor` tag or an external Tor binary. Standard sing-box binaries from the project's release page ship without embedded Tor. A user who creates a Tor node using the default template (which sets `executable_path: "/usr/bin/tor"`) will produce a config that silently fails at runtime if Tor is not installed at that path. The UI has no diagnostic, tooltip, warning badge, or documentation note surfaced to the user. This is the most critical UX hazard for this node type.

### P1

**P1-1: `torrc` map is completely invisible in the Inspector.**
`torrc` is an object (map of torrc options). `editableScalarFields` only processes `string | number | boolean` values, so `torrc` is never surfaced. The user cannot add, edit, or remove any torrc option through the UI. If a user imports a config with a populated `torrc` object, those values survive round-trip (they are stored in the domain state) but cannot be inspected or changed. A key-value repeater (or at minimum a raw JSON textarea for this object field) is needed.

**P1-2: `extra_args` array is completely invisible in the Inspector.**
`extra_args` is a `string[]`. `editableScalarFields` skips arrays. Any imported `extra_args` values are invisible and uneditable. The field must be promoted to a first-class list input or at minimum handled by an AdvancedScalarFields array path.

**P1-3: `executable_path` and `data_directory` are buried in Advanced fields.**
Both fields fall through to `AdvancedScalarFields`. `data_directory` is marked `==Recommended==` in the official doc and directly affects startup performance (very slow without it). Neither field is in `outboundHandledFields`, so they appear under the collapsed "Advanced fields" disclosure rather than as first-class controls. They should be promoted to first-class text inputs in the Tor-specific Inspector branch.

## Implementation Tasks

1. **Palette.tsx or a shared diagnostics layer** — add a build-tag warning for kind `"tor-out"`. Options: inline tooltip text on the Palette entry ("Requires Tor binary or with_tor build"), or a `"gated"` status variant with a human-readable message, or a diagnostic emitted when the outbound type is `"tor"`. At minimum the Docs link must lead users to the build-from-source page (P0-1).

2. **Inspector.tsx** — in the `ref.kind === "outbound"` block, add a type-specific branch for `entityType === "tor"`:
   - Render `executable_path` as a first-class text input with placeholder `/usr/bin/tor` and a helper note: "Leave empty to use embedded Tor (requires with_tor build tag)."
   - Render `data_directory` as a first-class text input with placeholder `$HOME/.cache/tor` and a helper note: "Recommended — startup will be slow without this."
   - Render `extra_args` as a list input (comma-separated, round-tripped as `string[]`). This is the same pattern used for address fields elsewhere.
   - Render `torrc` as a key-value repeater widget (add key + value row, remove row) or, if a repeater is not yet available, as a raw JSON textarea that serializes/deserializes the `torrc` object.

3. **Inspector.tsx** — add `"executable_path"`, `"data_directory"`, `"extra_args"`, and `"torrc"` to `outboundHandledFields` so they no longer appear (or would appear) in AdvancedScalarFields once the first-class controls are implemented.

4. **commands.ts** — optionally change `extra_args: []` default to omit the field (set to `undefined`) so the default exported JSON is cleaner and matches the official structure more closely.

5. **Fixtures** — add a minimal smoke fixture with `"type": "tor"` to confirm import, canvas render, Inspector display, and export round-trip.

## Done Criteria

- Adding Tor outbound from Palette produces a valid default object and shows a build-tag caveat before or at creation time.
- Inspector shows `executable_path` and `data_directory` as first-class text inputs (not buried in Advanced fields).
- Inspector shows `extra_args` as an editable list.
- Inspector shows `torrc` as an editable key-value structure or JSON textarea.
- `executable_path`, `data_directory`, `extra_args`, `torrc` are absent from the "Advanced fields" collapse.
- Dial shared group is present and functional.
- Round-trip: import config with non-trivial `torrc` and `extra_args` → edit → export preserves all values correctly.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported without data loss.
