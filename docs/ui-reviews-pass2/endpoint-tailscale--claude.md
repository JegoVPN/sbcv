# endpoint-tailscale — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The node is present and correctly wired on all four surfaces, and the code has advanced well beyond pass-1: `auth_key` is now masked, `verify_client_endpoint` is a real checklist, and three new tailscale diagnostics exist. However a real **type bug** remains — `system_interface` (a boolean per upstream) is rendered and gated as a *string* TUN-name input, conflating it with the separate `system_interface_name` field, so a valid boolean value is uneditable, undiagnosable, and the true name field is unreachable. Six other official scalar fields (`ephemeral`, `hostname`, `accept_routes`, `exit_node`, `exit_node_allow_lan_access`, `advertise_exit_node`) plus the 1.13 relay/MTU fields and `udp_timeout` still have no first-class control on fresh nodes.

## 1. Left Palette

- Present: `src/components/Palette.tsx:124` — `{ label: "Tailscale (with_tailscale)", kind: "endpoint-tailscale", icon: Waypoints, docsUrl: docs("endpoint/tailscale/"), status: "setup" }`. Correct group ("Endpoints"), label names the `with_tailscale` build tag, docs URL correct, `Waypoints` icon consistent with the wireguard sibling and DERP/DNS-tailscale entries.
- Default action `setup` → `canActivate` true (`Palette.tsx:279-287`); click calls `createFromPalette("endpoint-tailscale")` → `addEndpoint(config,"tailscale")` (`commands.ts:460-465`). Correct: the node is created in `endpoints[]`.
- No channel gate on the palette item. Node exists since 1.12, so showing it on every channel is correct; the 1.13-only *fields* inside are handled (imperfectly) by diagnostics, not the palette. Acceptable.
- Pass-1 note "Add Tailscale setup draft" wording is unchanged and still accurate.

## 2. Canvas Node

- Title/subtitle: `graph.ts:629-646` renders `endpoint:<tag>`; titlebar shows `endpoint / tailscale` (`SbcNode.tsx:291`). Subtitle from `endpointSubtitle` (`graph.ts:765-769`) = `tailscale <hostname>` or `"tailscale endpoint"`. Accurate (note: `hostname` has no Inspector control, so the subtitle can only change via raw-JSON/Advanced edit).
- Status badge derives from diagnostics scoped to `/endpoints/<index>` (`graph.ts:80-87,640`). Correct.
- `compatible: ["DNS Tailscale Server"]` (`graph.ts:641`) drives the `+` quick-add and drag-highlight. Endpoints are dial-targets-and-listeners, but the only canvas "create compatible" offered is a DNS server; DERP service is reachable only from the DERP side. Acceptable given hybrid semantics.
- Ports (`portRelationRegistry.ts` + `SbcNode.tsx:94-107`): for `kind=endpoint type=tailscale`:
  - INPUT `dns-server` "Upstream Tailscale DNS server" (relation `dns-server-endpoint`, `portRelationRegistry.ts:107`). Correct — a tailscale DNS server references this endpoint.
  - INPUT `derp-service` "Upstream DERP service" (relation `service-verify-endpoint`, `portRelationRegistry.ts:112`). Correct.
  - OUTPUT `dial-detour` "Dial detour outbound" (relation `endpoint-detour`, `portRelationRegistry.ts:108`). Correct — control-plane dial detour only.
- Edges (`graph.ts:554-556, 647-649, 681-685`): `dns-server-endpoint`, `service-verify-endpoint`, `endpoint-detour` all drawn correctly. Connectivity dots resolved in `SbcNode.tsx:151-161, 252-254`.
- **Gap:** `certificate_providers[].endpoint` is a real reference (tracked in `referenceRegistry.ts:346, 260` and surfaced in the Inspector "Upstream certificate providers" line) but has **no canvas port and no edge** — see Links §3.

## 3. Upstream/Downstream Links

Official relationship model for a tailscale endpoint:
- Referenced BY (incoming): `dns.servers[].endpoint` (tailscale DNS server), `services[].verify_client_endpoint[]` (DERP), `certificate_providers[].endpoint` (tailscale cert provider).
- Its OWN dial target (outgoing): Dial Fields `detour` → outbound (control-plane only).
- NOT a route target: unlike wireguard, a tailscale endpoint is **not** a dialable outbound — it is never referenced by `route.final`, `route.rules[].outbound`, or selector/urltest `outbounds[]`. (The wireguard task note "referenced like outbounds" does NOT apply to tailscale; do not add such ports.)

| Link | Registry | Canvas edge | Status |
|---|---|---|---|
| dns-server `endpoint` → endpoint | `referenceRegistry.ts:256,264` + `portRelationRegistry.ts:107` | `graph.ts:554-556` | OK |
| DERP `verify_client_endpoint[]` → endpoint | `referenceRegistry.ts:257-259,265-267` + `portRelationRegistry.ts:112` | `graph.ts:681-685` | OK |
| cert-provider `endpoint` → endpoint | `referenceRegistry.ts:260,268` (rename/remove only) | **none** | **MISSING port + edge** |
| endpoint `detour` → outbound | `referenceRegistry.ts:166,187` + `portRelationRegistry.ts:108` | `graph.ts:647-649` | OK |

- Disconnect handlers exist for all three present relations (`commands.ts:1133-1141 dns-server-endpoint`, `1173-1184 service-verify-endpoint`, `1157-1165 endpoint-detour`).
- `changeEntityType` away from tailscale calls `removeRegisteredTagReferences(next,"endpoint",tag)` (`commands.ts:942`), so all three incoming refs (including cert-provider) are cleaned on type-switch/delete. Correct.
- No extra/wrong links. The only defect is the **missing certificate-provider port/edge** (P1): the Inspector advertises the relationship but the canvas cannot show or create it.

## 4. Right Inspector (fields)

Tailscale block: `Inspector.tsx:4678-4728`; handled-set `endpointHandledFields` `Inspector.tsx:261-276`; Dial group via `sharedGroupsForEntity` `sharedFieldRegistry.ts:193-195`; seed `createEndpoint` `commands.ts:579-592`.

| Official field | Type | UI state | Verdict |
|---|---|---|---|
| `type` | const | type `<select>` `Inspector.tsx:2145-2153`, handled | OK |
| `tag` | string,req | tag editor (rename) | OK |
| `state_directory` | string | text `4690-4696`, handled | OK (no default placeholder; seed sets `$HOME/.tailscale`) |
| `auth_key` | string,sensitive | `SensitiveTextField` masked+reveal `4684-4689` (def `639-673`), handled `272` | OK — pass-1 P0 RESOLVED |
| `control_url` | string | text `4697-4703`, handled | OK |
| `ephemeral` | boolean | none first-class → Advanced only if present; not seeded | **MISSING** |
| `hostname` | string | none first-class → Advanced only if present; not seeded | **MISSING** |
| `accept_routes` | boolean | none first-class → Advanced (seed sets `false`, so shows as checkbox in Advanced) | **MISSING first-class** |
| `exit_node` | string | none first-class → Advanced only if present | **MISSING** |
| `exit_node_allow_lan_access` | boolean | none first-class → Advanced only if present | **MISSING** |
| `advertise_routes` | string[] | comma text `4704-4710` via `toList`/`fromList`, handled | OK |
| `advertise_exit_node` | boolean | none first-class → Advanced (seed sets `false`) | **MISSING first-class** |
| `advertise_tags` (1.13) | string[] | comma text `4711-4717`, handled, labeled "(since 1.13.0)", diag `diagnostics.ts:1184-1192` | OK |
| `relay_server_port` (1.13) | number | none; not handled, not seeded; no diag | **MISSING + ungated** |
| `relay_server_static_endpoints` (1.13) | string[] | **in handled-set `274` but NO control** → silently suppressed from Advanced | **HIDDEN/uneditable** |
| `system_interface` (1.13) | **boolean** | rendered as **string** TUN-name input `4718-4727` (`typeof===\"string\"`, placeholder `tailscale0`); seed sets boolean `false` `commands.ts:589` | **WRONG TYPE** |
| `system_interface_name` (1.13) | string | none; conflated into the `system_interface` control above | **MISSING (conflated)** |
| `system_interface_mtu` (1.13) | number | none; not handled, not seeded; no diag | **MISSING + ungated** |
| `udp_timeout` | string(duration) | none first-class; only in `listenSharedFields` (`Inspector.tsx:113,1448`) which does not apply to endpoints; seed sets `"5m"` → falls to Advanced plain text | **MISSING first-class** |
| Dial Fields | group | rendered for endpoint via `sharedGroupsForEntity` `sharedFieldRegistry.ts:193-195` | OK type, but no "control-plane only" note (P1) |

Connections card (read-only): `Inspector.tsx:4554-4572` lists tailscale DNS servers, DERP services, certificate providers via `endpointReferences` (`342-368`). Accurate but no attach/detach.

Cross-direction Inspectors:
- Tailscale DNS server `endpoint` `<select>` `Inspector.tsx:4352-4367` + blank-and-dangling diagnostics (`diagnostics.ts:1116-1124` blank, `420-428` dangling). Pass-1 P0 RESOLVED.
- DERP `verify_client_endpoint` checklist with stale/missing markers `Inspector.tsx:4820-4858`; diagnostics `diagnostics.ts:186-202`. Pass-1 P0 RESOLVED.

## Findings (prioritized)

- **[P0] `system_interface` wrong type — string instead of boolean, conflated with `system_interface_name`.** `Inspector.tsx:4718-4727` renders a TUN-name text input bound to `system_interface` (`typeof entity.system_interface === "string"`), but upstream defines `system_interface` as boolean "Create a system TUN interface". The seed writes boolean `false` (`commands.ts:589`), so the field renders blank and any boolean value is uneditable; the actual `system_interface_name` (string) has no control at all. Fix: make `system_interface` a checkbox; add a separate `system_interface_name` text input (gated/labeled 1.13); add `system_interface_name` to `endpointHandledFields`.
- **[P0] 1.13 `system_interface` gate diagnostic never fires for the real boolean value.** `diagnostics.ts:1193-1201` only warns when `system_interface` is a non-empty *string*. Because the canonical value is boolean, a 1.12/stable target exporting `"system_interface": true` is **not** caught. Fix: gate on `system_interface === true` (boolean) once the control is corrected.
- **[P1] `relay_server_static_endpoints` is hidden and uneditable.** Listed in `endpointHandledFields` (`Inspector.tsx:274`) which suppresses it from `AdvancedScalarFields`, but no first-class control exists → imported values cannot be edited and the field never appears. Fix: add a 1.13-gated comma/JSON control, or remove from the handled-set so it surfaces in Advanced.
- **[P1] Certificate-provider → endpoint reference has no canvas port/edge.** `referenceRegistry.ts:260,268` and the Inspector Connections card (`Inspector.tsx:4567-4569`) both acknowledge `certificate_providers[].endpoint`, but there is no `endpoint` input port for it and no edge in `graph.ts`. Fix: add a port relation + edge (mirror `dns-server-endpoint`), or document why it is intentionally Inspector-only.
- **[P1] Six official scalar fields unreachable on fresh nodes.** `ephemeral`, `hostname`, `exit_node`, `exit_node_allow_lan_access` are never seeded (`commands.ts:579-592`) and have no first-class control (`Inspector.tsx:4678-4728`); `accept_routes` and `advertise_exit_node` are seeded but only editable as raw Advanced checkboxes. Standard use cases (exit node, ephemeral, custom hostname, LAN access) require leaving the structured UI. Fix: add first-class controls and add all to `endpointHandledFields`.
- **[P1] `relay_server_port` and `system_interface_mtu` (1.13 numbers) have no control and no version gate.** Not in `endpointHandledFields`, not seeded; if imported they show as Advanced inputs, and no diagnostic flags them on a 1.12/stable target (unlike `advertise_tags`/`system_interface`). Fix: add 1.13-gated number inputs + matching stable-channel diagnostics.
- **[P1] `udp_timeout` not a first-class field on endpoints.** Seed sets `"5m"` (`commands.ts:590`) but `udp_timeout` is only in `listenSharedFields` (`Inspector.tsx:113`), which is not applied to endpoints, so it falls through to `AdvancedScalarFields` as an unlabeled plain text box. Fix: add a labeled duration input to the tailscale block and to `endpointHandledFields`.
- **[P2] Dial Fields lack the "control-plane only" annotation.** Upstream explicitly warns Dial Fields here only affect the control-plane connection, not user traffic; the dial group renders identically to a normal outbound (`sharedFieldRegistry.ts:193-195`). Fix: add a `<small>`/banner above the endpoint dial group.
- **[P2] No attach/detach in Connections card.** `Inspector.tsx:4554-4572` is read-only; wiring still requires the other node's Inspector or a canvas drag. Lower priority now that the DERP checklist and DNS select exist. (Pass-1 marked this P0; it is now P2.)
- **[P2] `state_directory` shows no default placeholder.** `Inspector.tsx:4690-4696` has no placeholder; upstream default is `tailscale`. Minor.

Where pass-1 is now STALE: pass-1 P0 "auth_key plain text" — RESOLVED (now `SensitiveTextField`). Pass-1 P0 "DNS server endpoint not required / no diagnostic" — RESOLVED (`diagnostics.ts:1116-1124,420-428`). Pass-1 P0 "DERP verify_client_endpoint plain text" — RESOLVED (checklist `Inspector.tsx:4820-4858`). Pass-1 claim "advertise_tags ungated, no diagnostic" — STALE (diagnostic `diagnostics.ts:1184-1192` now exists; control labeled 1.13). Pass-1 missed the `system_interface` string-vs-boolean type bug entirely.

SUMMARY: 2 P0, 5 P1, 3 P2.
