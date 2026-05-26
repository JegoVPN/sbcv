<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Service / derp — UI Review (Claude)

## Scope

- Node ID: `service:derp`
- Palette kind: `service-derp`
- Official stable: `service/derp.md` (sing-box 1.12.0+)
- Official testing: identical structure; `verify_client_url` object embeds `HTTP Client Fields` instead of `Dial Fields`
- Review shape: Left Add Library, Middle Canvas Node, Right Inspector

## Official Field Inventory (stable)

Top-level `services[]` object with `type: "derp"`. Total distinct official fields: **16**.

| Field | Kind | Required | Notes |
|---|---|---|---|
| `type` | string literal | yes | `"derp"` |
| `tag` | string | recommended | unique tag |
| Listen Fields | embedded | yes | `listen`, `listen_port`, `bind_interface`, `routing_mark`, `reuse_addr`, `netns`, `tcp_fast_open`, `udp_timeout` |
| `tls` | inbound TLS object | strongly recommended | DERP without TLS is not a useful production deployment |
| `config_path` | string | **Required** | DERP server key/config file path; example: `derper.key` |
| `verify_client_endpoint` | `string[]` | optional | Tailscale endpoint tags to verify clients |
| `verify_client_url` | `object[]` or `string[]` | optional | URL objects; stable embeds Dial Fields, testing embeds HTTP Client Fields |
| `home` | string | optional | `""` default page, `"blank"`, or redirect URL |
| `mesh_with` | `object[]` | optional | peer objects; each requires `server` + `server_port`; optional `host`, outbound TLS, Dial Fields |
| `mesh_psk` | string | optional | pre-shared key for mesh |
| `mesh_psk_file` | string | optional | pre-shared key file for mesh |
| `stun` | object or number | optional | `{enabled, listen, listen_port, …Listen Fields}`; numeric shorthand sets `listen_port` |

Stable vs testing delta: `verify_client_url` object format — stable uses `Dial Fields`, testing uses `HTTP Client Fields`. Structure and all other fields are identical.

## Implementation Inventory

### Palette (`Palette.tsx` line 194)

```
{ label: "DERP", kind: "service-derp", icon: Server, docsUrl: docs("service/derp/"), status: "setup" }
```

Status: `"setup"` is the action label shown to the user. Docs URL points to the correct official page.

### protocols.ts

- `"service-derp": "derp"` mapping present (line 134).
- `"derp"` included in `CREATABLE_SERVICE_TYPES` (line 142).

### sharedFieldRegistry.ts

- `serviceListenTypes` includes `"derp"` — Listen Fields shared group is activated.
- `serviceTlsTypes` includes `"derp"` — TLS shared group is activated.
- Both groups render via `SharedFieldCards` at bottom of Inspector.

### commands.ts — Default Object (lines 488–499)

```json
{
  "type": "derp",
  "tag": "<generated>",
  "listen": "127.0.0.1",
  "listen_port": 8443,
  "config_path": "derper.key",
  "home": "",
  "verify_client_endpoint": [],
  "mesh_with": [],
  "stun": { "enabled": false, "listen": "::", "listen_port": 3478 }
}
```

Issues: `tls` is not included in the default object. A newly created DERP node has no TLS configured. This is the direct consequence of the P0 TLS requirement gap.

### SbcNode.tsx — Ports

- `service:derp` exposes one output port: `verify-client-endpoint` → `endpoint:tailscale` (line 184–192).
- No input (route target) ports. Correct — DERP is not a route outbound.
- `isPortConnected` checks `service.verify_client_endpoint` refs (lines 352–354).

### graph.ts — Edge Generation (lines 656–659)

- Iterates `service.verify_client_endpoint` array.
- Creates edges `service:derp → endpoint:tailscale` with handles `verify-client-endpoint` / `derp-service`.

### useProjectStore.ts — Port Toggle

- `togglePortConnection` for `verify-client-endpoint` handle (lines 438–446, 1190–1202):
  - Add: appends tailscale endpoint tag to `verify_client_endpoint` array.
  - Remove: clears `verify_client_endpoint` to `undefined` (line 1195 — single-ref only when disconnecting).
  - `createCompatible` (lines 901–913): creates new tailscale endpoint and links via `verify_client_endpoint`.

Issue (P1): disconnect logic at line 1195 sets `verify_client_endpoint` to `undefined` (entire field cleared), not array splice. If multiple endpoint tags are present, all are lost on single disconnect toggle.

### Inspector.tsx — DERP Section (lines 1724–1771)

Fields rendered for `entityType === "derp"`:

| UI Label | Field | Control Type |
|---|---|---|
| Config Path | `config_path` | text input |
| Verify Tailscale Endpoints | `verify_client_endpoint` | text input (comma-separated) |
| Home | `home` | text input |
| Verify Client URL JSON | `verify_client_url` | `JsonField` (raw JSON) |
| Mesh With JSON | `mesh_with` | `JsonField` (raw JSON) |
| Mesh PSK | `mesh_psk` | text input |
| Mesh PSK File | `mesh_psk_file` | text input |
| STUN JSON | `stun` | `JsonField` (raw JSON) |

Listen Fields and TLS shared cards are appended after via `SharedFieldCards` (lines 1892–1899).

**Field order issue**: `config_path` (required) and Listen Fields appear in an inconvenient split: `config_path` first via explicit section, then TLS and listen at the bottom of the panel via SharedFieldCards. The required `config_path` renders above optional `home`, which is correct, but TLS status is buried after all DERP-specific fields rather than appearing near the top.

**verify_client_endpoint control**: Renders as a plain text input with `placeholder={endpointTags(config, "tailscale").join(", ")}`. Comma-separated text, not a multiselect. Users must know exact endpoint tags and type them manually. The canvas port toggle does create/link from the node view, but the Inspector control does not guide this.

## Priority Findings

### P0 — TLS Not Configured by Default

**What**: The default object created by `commands.ts` for a new DERP node does not include `tls`. SharedFieldCards renders the TLS group, but the `tls.enabled` toggle starts unchecked/absent.

**Why critical**: DERP is a Tailscale relay server. Running it without TLS is not a production-valid configuration. There is no visual warning, badge, or diagnostic that flags missing/disabled TLS before the user presses any check/export action.

**Where**: `commands.ts` line 488 default object; Inspector TLS shared card has no required marker for DERP context.

**Fix**: Initialize `tls: { enabled: true }` (or at minimum `tls: {}`) in the DERP default object. Add a visible "TLS required for DERP" indicator in the Inspector panel when `tls.enabled` is absent or false for `entityType === "derp"`.

### P0 — config_path Has No Required Validation

**What**: `config_path` is marked `==Required==` in official docs. The Inspector renders it as a plain text `<input>` with default prefill `"derper.key"` from the default object. No validation, no error state, no required badge.

**Why critical**: If `config_path` is empty or wrong, the DERP service fails to start. The UI gives no indication.

**Where**: `Inspector.tsx` line 1729; `commands.ts` line 493 (default prefill exists but user can clear it).

**Fix**: Show required indicator on the Config Path label. Add a diagnostic when the value is empty.

### P0 — verify_client_endpoint Inspector Control Is a Text Input, Not a Multiselect

**What**: The Inspector field for `verify_client_endpoint` is a plain `<input>` with a comma-separated placeholder listing existing tailscale endpoint tags. Editing it requires knowing exact tags and typing them. There is no inline create shortcut.

**Why critical**: This field represents a structured reference to `endpoint:tailscale` nodes. Mistyped tags produce silent misconfiguration. The canvas port toggle does work correctly, but users who interact only via Inspector have no guided path.

**Where**: `Inspector.tsx` lines 1736–1740.

**Fix**: Replace with a multiselect or token-input over `endpointTags(config, "tailscale")` with an inline "create tailscale endpoint" shortcut (matching the pattern used for other tag reference fields in the Inspector).

### P0 — verify_client_endpoint Disconnect Clears Entire Array

**What**: In `useProjectStore.ts` line 1195, toggling off the `verify-client-endpoint` port sets `verify_client_endpoint` to `undefined`, not a splice of the one removed tag. If a DERP node references multiple tailscale endpoints, toggling disconnect on any one canvas port removes all references.

**Where**: `useProjectStore.ts` lines 1190–1202.

**Fix**: Use `removeTagRef` (already used in the rename and delete paths at lines 901, 1095) instead of setting `undefined`.

## P1 Findings

### P1 — verify_client_url Embeds Dial Fields (stable) / HTTP Client Fields (testing); Both Are Raw JSON

**What**: `verify_client_url` renders as `JsonField` (raw JSON textarea). In stable docs the object embeds Dial Fields; in testing docs it embeds HTTP Client Fields. Neither is a structured repeater.

**Fix (near-term)**: Add a note in the label explaining the format (`[{"url": "...", ...Dial Fields}]`). Structured repeater is a longer-term improvement.

**Testing note**: When targeting testing builds, `verify_client_url` objects use HTTP Client Fields, not Dial Fields. This may require separate handling once the testing branch ships.

### P1 — mesh_with Is Raw JSON

**What**: `mesh_with` renders as `JsonField`. Each peer object requires `server` (required) and `server_port` (required) plus optional `host`, outbound TLS, and Dial Fields. No structured repeater.

**Fix**: Add a structured repeater with at least `server` and `server_port` as required text/number inputs, `host` as optional text, and TLS/Dial as expandable subsections.

### P1 — stun Is Raw JSON With Confusing Numeric Shorthand

**What**: `stun` renders as `JsonField` initialized to `{ enabled: false, listen: "::", listen_port: 3478 }`. The official numeric shorthand (`stun: 3478` meaning `{enabled: true, listen_port: 3478}`) is not explained in the UI.

**Fix**: Replace with a structured toggle+port form. Explain the shorthand or normalize to canonical object form on export.

### P1 — Inspector Field Order: TLS After Optional Fields

**What**: TLS is rendered via `SharedFieldCards` at the bottom of the Inspector, after `verify_client_url`, `mesh_with`, `mesh_psk`, `mesh_psk_file`, and `stun`. For DERP, TLS is more critical than any of those fields and should appear near the top, after `config_path`.

**Fix**: Either reorder `SharedFieldCards` groups to render `tls` first for `entityType === "derp"`, or duplicate a TLS status summary near the `config_path` field.

### P1 — Default listen Address Is 127.0.0.1 for a Server

**What**: The default object sets `listen: "127.0.0.1"` for DERP. A DERP server must accept connections from external Tailscale clients; loopback is not a useful default for production.

**Fix**: Default to `"::"` or `"0.0.0.0"` for DERP, or at minimum show a warning when `listen` is a loopback address on a server-type service.

## Implementation Tasks

1. **commands.ts**: Add `tls: { enabled: true }` to DERP default object. Change default `listen` from `"127.0.0.1"` to `"::"`.
2. **Inspector.tsx** (DERP section): Add a visible warning banner/indicator when `entityType === "derp"` and `entity.tls?.enabled` is absent/false: e.g., `"TLS is required for DERP production use"`.
3. **Inspector.tsx** (DERP section): Add required visual marker to Config Path label; add empty-value diagnostic.
4. **Inspector.tsx** (DERP section): Replace `verify_client_endpoint` text input with multiselect/token-input over `endpointTags(config, "tailscale")` plus inline create shortcut.
5. **useProjectStore.ts** (line 1195): Replace `undefined` assignment with `removeTagRef(service.verify_client_endpoint, endpointTag)` to support multi-endpoint scenarios.
6. **Inspector.tsx** (DERP section, P1): Restructure `stun` from `JsonField` to a toggle+port form.
7. **Inspector.tsx** (DERP section, P1): Move TLS shared card above DERP-specific optional fields, or render a TLS summary before `verify_client_endpoint`.
8. **Inspector.tsx** (DERP section, P1): Add structured repeater for `mesh_with` with required `server`/`server_port` inputs.
9. **Inspector.tsx** (DERP section, P1): Annotate `verify_client_url` JsonField label with format hint; defer structured repeater to a follow-up.

## Done Criteria

- New DERP node default includes `tls: { enabled: true }` and `listen: "::"`.
- Inspector shows a visible TLS warning for DERP when TLS is disabled/absent.
- `config_path` shows required indicator and empty-value diagnostic.
- `verify_client_endpoint` Inspector control is a multiselect/token-input over tailscale endpoint tags.
- Port disconnect on `verify-client-endpoint` removes only the toggled tag, not all tags.
- Canvas ports for DERP remain limited to `verify-client-endpoint → endpoint:tailscale`; no route/outbound ports.
- Smoke coverage: import a DERP config, render node, edit `config_path`, link a tailscale endpoint via Inspector and via canvas port, export and round-trip JSON.
