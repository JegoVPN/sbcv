<!-- Source: official stable + testing docs (identical), Palette.tsx, Inspector.tsx, SbcNode.tsx, sharedFieldRegistry.ts, diagnostics.ts, commands.ts, canvas/graph.ts. Baseline: docs/ui-reviews/endpoint-tailscale.md -->
# Endpoint / tailscale UI Review

## Scope

- Node ID: `endpoint:tailscale`
- Palette kind: `endpoint-tailscale`
- Official docs: `endpoint/tailscale.md` — stable and testing docs are **identical**
- Available since: sing-box 1.12.0
- 1.13.0 additions: `relay_server_port`, `relay_server_static_endpoints`, `system_interface`, `system_interface_name`, `system_interface_mtu`, `advertise_tags`

## Official Field Model

Stable and testing docs are identical. All official fields:

| Field | Type | Required | Since | Notes |
|---|---|---|---|---|
| `type` | string | yes | 1.12 | always `"tailscale"` |
| `tag` | string | yes | 1.12 | node identifier |
| `state_directory` | string | no | 1.12 | default `"tailscale"` |
| `auth_key` | string | no | 1.12 | sensitive; omit to use login URL |
| `control_url` | string | no | 1.12 | default `https://controlplane.tailscale.com` |
| `ephemeral` | boolean | no | 1.12 | register as ephemeral node |
| `hostname` | string | no | 1.12 | default: system hostname |
| `accept_routes` | boolean | no | 1.12 | accept routes from other nodes |
| `exit_node` | string | no | 1.12 | exit node name or IP |
| `exit_node_allow_lan_access` | boolean | no | 1.12 | route LAN traffic directly |
| `advertise_routes` | string[] | no | 1.12 | CIDR prefixes to advertise |
| `advertise_exit_node` | boolean | no | 1.12 | advertise self as exit node |
| `advertise_tags` | string[] | no | 1.13 | ACL tags, e.g. `["tag:server"]` |
| `relay_server_port` | number | no | 1.13 | port for relay connections |
| `relay_server_static_endpoints` | string[] | no | 1.13 | static relay endpoint advertisements |
| `system_interface` | boolean | no | 1.13 | create a system TUN interface |
| `system_interface_name` | string | no | 1.13 | TUN name; default `tailscale` / `utun` on macOS |
| `system_interface_mtu` | number | no | 1.13 | TUN MTU override |
| `udp_timeout` | string | no | 1.12 | UDP NAT expiry; default `"5m"` |
| Dial Fields | — | no | 1.12 | only affect control-plane connectivity |

Total official fields: 19 protocol-specific + 1 shared Dial Fields group = **20 fields**.

## Cross-Node Relationship Model

- A Tailscale DNS server (`dns.servers[].type === "tailscale"`) references this endpoint via `server.endpoint`.
- A DERP service (`services[].type === "derp"`) references this endpoint via `service.verify_client_endpoint[]`.
- A Tailscale certificate provider (`certificate_providers[].type === "tailscale"`) references this endpoint via `provider.endpoint`.
- Dial Fields `detour` points to an outbound for control-plane routing only; it does not route user traffic.

## What the UI Does Today

### Left: Palette

- Entry at `Palette.tsx` line 125: `{ label: "Tailscale", kind: "endpoint-tailscale", icon: Waypoints, docsUrl: docs("endpoint/tailscale/"), status: "setup" }`.
- Status is `"setup"` — the Palette tooltip reads "Add Tailscale setup draft to canvas". This is appropriate given that authentication is required.
- `canActivate` returns `true` for `"setup"`, so clicking does add the node. The node is added via `createEndpoint("tailscale", tag)` in `commands.ts`.
- Docs link is correctly pointed to `endpoint/tailscale/`.
- No target gate on the Palette entry itself — the item appears regardless of the selected sing-box channel (1.12, 1.13, testing). The node itself was introduced in 1.12, so this is correct. However 1.13-only fields within the node are not gated either (see Inspector findings below).

### Middle: Canvas Node

- `graph.ts` places `endpoint:tailscale` nodes in the DNS lane column (`COLUMNS.member`) at a y-position aligned to any DNS server that references this endpoint (`endpointTargetY`), or after other endpoints/dns-servers if no reference exists.
- `compatible: ["DNS Tailscale Server"]` is set on the endpoint canvas node data — this drives drag-compatibility highlighting on the canvas. The DERP service node has `compatible: ["Tailscale Endpoint"]`.
- Subtitle from `endpointSubtitle`: shows `tailscale ${endpoint.hostname}` if `hostname` is set, otherwise `"tailscale endpoint"`. Accurate.
- Canvas node `kind === "endpoint"`, `type === "tailscale"` renders two **input** ports (sources that attach to this node):
  - `dns-server` port (key `"dns-server"`, label "Upstream Tailscale DNS server") — correct; drag from a tailscale DNS server onto this node.
  - `derp-service` port (key `"derp-service"`, label "Upstream DERP service") — correct; drag from a DERP service onto this node.
- One **output** port at `kind === "endpoint"` (bottom of `outgoingPorts`):
  - `dial-detour` port (label "Dial detour outbound") — connects to an outbound for control-plane routing.
- Edges from `graph.ts`:
  - `edge:dns-server-endpoint` from `dns-server:${tag}` → `endpoint:${tag}`, edge type `"dns-server"`. Correct.
  - `edge:service-verify-endpoint` from `service:${tag}` → `endpoint:${tag}`, edge type `"verify-client-endpoint"`. Correct.
  - `edge:endpoint-detour` from `endpoint:${tag}` → `outbound:${detour}`, edge type `"dial-detour"`. Correct.

### Right: Inspector

#### Connections section (lines 1611–1626)

When a tag is set, the Inspector shows a "Connections" card with three reference lists:
- "Upstream Tailscale DNS servers" — computed by `endpointReferences()` as dns servers where `server.type === "tailscale" && server.endpoint === tag`. Correct.
- "Upstream DERP services" — computed from `services` where `verify_client_endpoint` includes tag. Correct.
- "Upstream certificate providers" — computed from `certificate_providers` where `provider.endpoint === tag`. Correct.

These are read-only display fields. There are no attach/detach buttons; the user must navigate to the DNS server or DERP service Inspector to change the reference.

#### First-class Tailscale fields rendered (lines 1659–1690)

The `{entityType === "tailscale" ? ... : null}` block renders only four fields:

| Rendered field | Control | Note |
|---|---|---|
| `state_directory` | text input | shown unconditionally |
| `control_url` | text input | shown unconditionally |
| `advertise_routes` | text input (comma list via `toList`/`fromList`) | shown unconditionally |
| `advertise_tags` | text input (comma list) | shown unconditionally; **no 1.13 gate** |

These four fields are also listed in `endpointHandledFields` so they do not double-render.

#### Fields in endpointHandledFields but NOT first-class rendered

`endpointHandledFields` (lines 154–167) also includes: `tag`, `type`, `address`, `private_key`, `peers`, `detour`, `relay_server_static_endpoints`, and all `dialSharedFields`. Of these, only the dial-shared fields and `detour` get structured Inspector controls (via the shared `dial` group). `relay_server_static_endpoints` is in the set (preventing AdvancedScalarFields from showing it) but has **no first-class UI** — so it is silently suppressed with no UI path to edit it.

#### Fields NOT in endpointHandledFields (fall through to AdvancedScalarFields)

The following official Tailscale fields are neither in `endpointHandledFields` nor rendered explicitly. If they exist on an imported entity they appear as generic inputs in the collapsible "Advanced fields" section; if the node was freshly created they are absent and unreachable without raw JSON editing:

- `auth_key` — sensitive credential, **completely absent from the Inspector**. Imported nodes show it as a plain text input in Advanced fields with no masking.
- `ephemeral` — boolean; would appear as a checkbox in Advanced fields if present on entity.
- `hostname` — text; in Advanced fields if present.
- `accept_routes` — boolean; in Advanced fields if present.
- `exit_node` — text; in Advanced fields if present.
- `exit_node_allow_lan_access` — boolean; in Advanced fields if present.
- `advertise_exit_node` — boolean; in Advanced fields if present.
- `relay_server_port` — number; in Advanced fields if present.
- `system_interface` — boolean; in Advanced fields if present.
- `system_interface_name` — text; in Advanced fields if present.
- `system_interface_mtu` — number; in Advanced fields if present.
- `udp_timeout` — text; **this field is in `listenSharedFields`** (line 103), not in `endpointHandledFields`. However `listenSharedFields` only applies to `inbounds[]` and `services[]`, so `udp_timeout` on an endpoint falls through to AdvancedScalarFields and appears as a plain text input when the field is present on the entity. The `createEndpoint` seed sets `udp_timeout: "5m"`, so it IS present in fresh nodes and WILL appear in Advanced fields — but only as an unstyled text field with no duration hint.

#### Dial Fields shared group

`sharedGroupsForEntity` for `ref.kind === "endpoint"` and any type in `CREATABLE_ENDPOINT_TYPES` (which includes `"tailscale"`) pushes `"dial"`. The Dial group renders Detour (select), Bind Interface, Connect Timeout, Domain Resolver, Network Strategy, Network Type, Fallback Network, Fallback Delay. These are correct per the official note that Dial Fields only control control-plane connectivity. However the Inspector does **not** show any label or warning explaining that these fields apply only to the Tailscale control-plane connection, not to user traffic routing — the group renders identically to any other dial section.

#### Diagnostics

`diagnostics.ts` has one tailscale-endpoint check: if a DERP service references an endpoint and that endpoint exists but its `type !== "tailscale"`, a warning `"derp-verify-endpoint-not-tailscale"` is pushed. There is also `"missing-derp-verify-endpoint"` if the referenced endpoint tag does not exist at all. No diagnostics exist for:
- Missing or blank `auth_key` when `state_directory` is fresh (no existing state).
- `exit_node_allow_lan_access: true` without `exit_node` set.
- `advertise_tags` or `relay_server_port` used with a target < 1.13.
- `system_interface: true` used with a target < 1.13.

## Priority Findings

### P0 — DERP/DNS endpoint references have no one-click attach/detach (carried from baseline)

**Severity:** UX blocker for cross-node wiring.

The Connections card in the Inspector shows which DNS servers and DERP services reference this endpoint but provides only read-only text. There are no buttons to attach a new Tailscale DNS server or DERP service, and no one-click detach. Users must navigate to the other node's Inspector, find the endpoint select/field, and manually change the reference. The canvas ports do support drag-to-connect from the other node, but discovery is poor.

**Fix:** Add "Attach DNS server" and "Attach DERP service" action buttons or selects directly in the Connections card. Each should create or update the reference in the canonical JSON. The select list for DNS attach should enumerate existing `dns-server:tailscale` nodes; the DERP select should enumerate existing `service:derp` nodes. Detach should clear the corresponding `endpoint` or `verify_client_endpoint` field on the referenced node.

### P0 — Tailscale DNS server `endpoint` must be a required tag select (carried from baseline)

**Severity:** Correctness — a tailscale DNS server without a valid `endpoint` reference exports broken JSON.

The DNS server Inspector (lines 1587–1601) does render a `<select>` for `endpoint` populated from `endpointTags(config, "tailscale")`. However the select has a placeholder `"Create or select endpoint"` and allows submitting with `value === ""` (which writes `endpoint: undefined`). There is no diagnostic that catches a tailscale DNS server with a missing or dangling endpoint. The matching diagnostic only exists in the DERP→endpoint direction, not the DNS server→endpoint direction.

**Fix:** Add a diagnostic error for `dns.servers[type=tailscale]` when `server.endpoint` is blank or references a nonexistent endpoint tag. The DNS server Inspector should show this field prominently as required, not as an optional select.

### P0 — DERP `verify_client_endpoint[]` is a plain text input, not a multiselect/port attachment (carried from baseline)

**Severity:** UX and correctness — the field accepts a comma string and converts it with `textToRuleList`, which may produce unintended values. Users get no visibility into which endpoint tags are available.

The DERP service Inspector renders `verify_client_endpoint` as a plain `<input>` with a placeholder of `endpointTags(config, "tailscale").join(", ")`. This is a hint, not a selector. There is no multiselect and no enforcement that the entered values match actual endpoint tags. The canvas edge `edge:service-verify-endpoint` is drawn from the DERP service to the endpoint, which is correct, but the canvas drag does not update the field (there is no edge-drop handler that writes `verify_client_endpoint`).

**Fix:** Replace the plain text input with a token/chip multiselect that enumerates available `endpoint:tailscale` tags. Alternatively, add a port-drop handler that writes the dragged endpoint's tag into `verify_client_endpoint`. Add a diagnostic error when a listed tag does not match any known endpoint.

### P0 — 1.13-only fields have no target gate

**Severity:** Correctness — exporting `advertise_tags`, `relay_server_port`, `relay_server_static_endpoints`, `system_interface`, `system_interface_name`, `system_interface_mtu` with a 1.12 target will fail validation.

`advertise_tags` is rendered as a first-class comma-list input in the Inspector with no gating. `system_interface` is in the `createEndpoint` seed object — fresh nodes are always seeded with `system_interface: false`. On a 1.12 target this would export `"system_interface": false` into the JSON, which is an unknown field for 1.12.

**Fix:**
1. Remove `system_interface`, `advertise_tags`, `relay_server_port`, `relay_server_static_endpoints` from the `createEndpoint` seed unless the active channel is `>= 1.13`.
2. Add `advertise_tags` and `relay_server_static_endpoints` to `endpointHandledFields` only conditionally, or always add them and gate the Inspector controls behind a channel check.
3. Add diagnostics that error when these fields are non-empty/non-default on a 1.12 channel.

### P0 — `auth_key` is exposed as plain text in Advanced fields with no masking

**Severity:** Security — credential leakage via screenshot, log copy, or over-shoulder.

`auth_key` is not in `endpointHandledFields` and not rendered as a first-class field. If a node is imported from JSON with `auth_key` set, the AdvancedScalarFields section renders it as `<input type="text">` — the value is visible in plaintext. There is no masking, no "show/hide" toggle, and no warning.

**Fix:** Add `auth_key` as a first-class field in the `{entityType === "tailscale" ? ...}` block. Render it as `<input type="password">` with a show/hide toggle. Add `auth_key` to `endpointHandledFields` so it does not also appear in AdvancedScalarFields. Add an inline note: "Auth key is only used for initial node registration; omit to use the login URL shown in logs."

### P1 — Eight protocol fields unreachable in fresh tailscale nodes

**Severity:** Protocol coverage — standard use cases like exit nodes, ephemeral mode, and LAN access control require leaving the UI.

`createEndpoint` seeds only: `type`, `tag`, `state_directory`, `control_url`, `accept_routes`, `advertise_routes`, `advertise_exit_node`, `advertise_tags`, `system_interface`, `udp_timeout`. The following fields are never seeded:

- `auth_key` — no UI path to add from a fresh node
- `ephemeral` — no UI path to enable ephemeral mode
- `hostname` — no UI path to set a custom hostname
- `exit_node` — no UI path to configure an exit node
- `exit_node_allow_lan_access` — no UI path
- `relay_server_port` — no UI path
- `system_interface_name` — no UI path
- `system_interface_mtu` — no UI path

Because `AdvancedScalarFields` only surfaces fields already present on the entity object, these eight fields are invisible for fresh nodes.

**Fix:** Add first-class Inspector controls for at minimum `auth_key` (P0 above), `ephemeral` (boolean toggle), `hostname` (text), `exit_node` (text), and `exit_node_allow_lan_access` (boolean). Add all of these to `endpointHandledFields`. The 1.13 relay/interface fields can be deferred until the channel gate is implemented.

### P1 — Dial Fields lack "control-plane only" label

**Severity:** User confusion — Dial Fields for this endpoint look identical to other dial sections, but the official doc explicitly states they only affect control-plane connectivity, not user traffic.

**Fix:** Add a note or `<small>` annotation to the Dial Fields shared group rendering for `ref.kind === "endpoint"`: "These settings only affect how this endpoint connects to the Tailscale control plane. They do not route user traffic through this endpoint."

### P1 — `udp_timeout` seeded but not rendered as a first-class field

**Severity:** UX inconsistency — the seed sets `udp_timeout: "5m"` so it is always present in Advanced fields as a plain text input, but it deserves a labeled duration input with a placeholder showing the default.

**Fix:** Add `udp_timeout` as a first-class text input in the tailscale Inspector section. Add it to `endpointHandledFields` (it is currently only in `listenSharedFields`, which does not cover endpoints).

### P1 — `relay_server_static_endpoints` is in `endpointHandledFields` but has no UI

**Severity:** Hidden field — the array field is suppressed from AdvancedScalarFields by being in the handled set, but no first-class control exists. If imported JSON contains this field, the user has no way to edit it.

**Fix:** Either add a JSON textarea or comma-list input for `relay_server_static_endpoints` behind a 1.13 gate, or remove it from `endpointHandledFields` so imported values surface in AdvancedScalarFields. Currently it is truly invisible.

## Implementation Tasks

1. **Add first-class Inspector controls for `auth_key`**
   - Render `<input type="password">` with show/hide toggle in the `{entityType === "tailscale"}` block.
   - Add `"auth_key"` to `endpointHandledFields`.
   - Add inline hint about auth key only being used for initial registration.

2. **Add first-class Inspector controls for routing/identity fields**
   - `ephemeral` — boolean `<input type="checkbox">` toggle.
   - `hostname` — text `<input>`.
   - `exit_node` — text `<input>` (or select populated from known tailscale peers if available).
   - `exit_node_allow_lan_access` — boolean toggle, shown when `exit_node` is non-empty.
   - Add all four to `endpointHandledFields`.
   - Seed `ephemeral: false` and `exit_node_allow_lan_access: false` in `createEndpoint` or rely on explicit first-class controls.

3. **Add first-class control for `udp_timeout` and move out of listenSharedFields scope**
   - Add a labeled text input for `udp_timeout` in the tailscale section with placeholder `"5m"`.
   - Add `"udp_timeout"` to `endpointHandledFields`.
   - Note: `listenSharedFields` inclusion of `udp_timeout` does not affect endpoints (listen group is only pushed for inbounds and services), so there is no double-render risk.

4. **Gate 1.13-only fields behind channel check**
   - Wrap the `advertise_tags` text input in a `{channel >= "1.13" ? ... : null}` guard (or equivalent channel comparison).
   - Add first-class controls for `relay_server_port` (number), `relay_server_static_endpoints` (JSON textarea or comma-list), `system_interface` (boolean toggle), `system_interface_name` (text, shown when `system_interface` is true), `system_interface_mtu` (number) — all behind the 1.13 gate.
   - Remove `system_interface: false` from the `createEndpoint` seed, or gate the seed field on channel >= 1.13.
   - Add diagnostics that push errors when these fields are present and non-default on a channel < 1.13 target.

5. **Improve Connections card with attach/detach actions**
   - Add an "Attach Tailscale DNS server" select/button that, on selection, writes `dns.servers[selected].endpoint = this.tag`.
   - Add an "Attach DERP service" select/button that adds this tag to `services[selected].verify_client_endpoint`.
   - Add a detach (×) control next to each listed reference that clears the corresponding field.

6. **Replace DERP `verify_client_endpoint` plain text with token multiselect**
   - Render each known `endpoint:tailscale` tag as a selectable chip.
   - On remove, update `verify_client_endpoint` to the remaining list.
   - Add diagnostic error for dangling tag references.

7. **Add diagnostic for tailscale DNS server missing endpoint**
   - In `diagnostics.ts`, iterate `config.dns?.servers` and push an error for any server where `type === "tailscale" && !server.endpoint`.
   - Add a check for `server.endpoint` referencing a nonexistent tag (analogous to the existing DERP check).

8. **Add "control-plane only" note to Dial Fields for endpoints**
   - Modify the shared dial group rendering block in Inspector to detect `ref.kind === "endpoint"` and render an annotation above the dial fields.

9. **Fix `relay_server_static_endpoints` suppression**
   - Either add a JSON textarea for this field in the 1.13-gated section, or remove it from `endpointHandledFields` until a first-class control is added so imported values remain accessible.
