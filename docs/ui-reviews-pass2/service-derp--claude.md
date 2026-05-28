# service-derp — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The DERP node is now substantially complete and most pass-1 P0s are STALE: TLS is seeded in the default object, `config_path`/verify-endpoint/TLS all have diagnostics, and the Inspector ships structured editors (endpoint checklist, verify-URL repeater, mesh-peer repeater, STUN toggle/port form) — not the raw-JSON textareas pass-1 described. Two real defects remain: the DERP node's own `verify-client-endpoint` port toggle wipes the entire endpoint array instead of splicing one (asymmetric with the edge-drop path), and the canvas `+` / "Tailscale Endpoint" compatible chip is a dead button because `createCompatible` has no handler for it. Lower-priority gaps: `mesh_with` is missing outbound TLS + Dial Fields, mesh/verify-URL `detour` are unmanaged references, and `config_path` has no required marker on its label.

## 1. Left Palette

Present and correct. `Palette.tsx:195` — `{ label: "DERP (with_tailscale)", kind: "service-derp", icon: Server, docsUrl: docs("service/derp/"), status: "setup" }`. Category "Services" is right (DERP writes one `services[]` object). Label now carries the `(with_tailscale)` build-tag hint (pass-1's "DERP" label is STALE). `status: "setup"` is actionable (`canActivate`, `Palette.tsx:279`) and creates the node via `createFromPalette`. Mapping `service-derp → derp` and creatability are in `protocols.ts:134,142`. No gating issue — DERP is creatable on both channels; the build-tag caveat is surfaced in the Inspector banner, which is the right place. No findings.

## 2. Canvas Node

Title = tag, subtitle = "tailscale derp service" (`graph.ts:778`). Status pill is diagnostic-derived (`graph.ts:668`). Ports: exactly one output `verify-client-endpoint → endpoint:tailscale` and zero inputs (DERP is not a route target) — correct per upstream. Ports come from `portRelations` `service-verify-endpoint` (`portRelationRegistry.ts:112`) via `getPortSpecs`/`portEndpointsForNode` (`SbcNode.tsx:94`). `isPortConnected` for the `verify-client-endpoint` handle checks `verify_client_endpoint` refs (`SbcNode.tsx:261-263`) — correct.

Defect: the compatible chip is `["Tailscale Endpoint"]` (`graph.ts:669`). Both the large `+` button (`SbcNode.tsx:400`) and the hover chip (`SbcNode.tsx:448`) call `createCompatible(id, "Tailscale Endpoint")`, but `createCompatible` only branches on Route/Direct/Block/Selector/URLTest/SOCKS/DNS Server/DNS Tailscale Server (`useProjectStore.ts:801-808`) — there is no `"Tailscale Endpoint"` branch, so the click is a no-op (no endpoint created, no link). See [P1] below. (SSM-API's `["Shadowsocks Inbound"]` chip has the same dead-button class; out of scope here but worth a shared fix.)

## 3. Upstream/Downstream Links

Official relationship model for DERP:
- `verify_client_endpoint[]` → references `endpoint:tailscale` tags (downstream ref).
- `verify_client_url[].detour` and `mesh_with[].detour` (Dial Fields) → reference `outbounds[]` tags.
- DERP is referenced by nothing (not a route/dns target).

Implemented:
- `portRelationRegistry.ts:112` `service-verify-endpoint` writable, `service(derp).verify-client-endpoint → endpoint(tailscale).derp-service`, canonicalPath `/services/*/verify_client_endpoint`, createTarget `["endpoint"]`, disconnectable (mode writable). Correct.
- `referenceRegistry.ts:346` endpoint kind includes `/services/*/verify_client_endpoint`; replace/remove use `removeTagRefValue`/`replaceTagRefValue` (splice-aware) — correct (`referenceRegistry.ts:255-269`). Rename/delete of a tailscale endpoint updates DERP correctly.
- Edge generation `graph.ts:681-685` iterates `verify_client_endpoint` and emits one edge per ref. Correct.

Missing/wrong:
- MISSING: `mesh_with[].detour` and `verify_client_url[].detour` are outbound references but are NOT in any `referenceRegistry` path. `removeOutboundRefs`/`replaceOutboundRefs` touch `/services/*/detour` only (`referenceRegistry.ts:167,188`), which DERP does not use. Renaming/deleting an outbound silently leaves stale detour tags inside DERP mesh peers / verify URLs. See [P2].
- No extra/incorrect links. DERP correctly does NOT appear in `service-detour-ccm`/`service-detour-ocm` (those are ccm/ocm only, `portRelationRegistry.ts:109-110`).

## 4. Right Inspector (fields)

DERP section is `Inspector.tsx:4807-5054`; shared Listen + TLS cards render afterward at `Inspector.tsx:5343` via `SharedFieldCards` (groups from `sharedFieldRegistry.ts:198-199`: derp ∈ serviceListenTypes ∩ serviceTlsTypes).

| Official field | UI control | Required marker | Default | Validation | Notes / state |
|---|---|---|---|---|---|
| Listen Fields (`listen`, `listen_port`, …) | SharedFieldCards "listen" group (`Inspector.tsx:5343`) | n/a | `listen:"::"`, `listen_port:8443` (`commands.ts:505-506`) | shared-group | Default `::` correct for a server (pass-1's 127.0.0.1 P1 is STALE). |
| `tls` (inbound) | SharedFieldCards "tls" group | none, but diagnostic | `{enabled:true, server_name:""}` (`commands.ts:512`) | `derp-service-needs-tls` warning when disabled (`diagnostics.ts:205-215`) | Seeded enabled (pass-1 "TLS not default" P0 is STALE). Renders at bottom, below all DERP fields — ordering nit. |
| `config_path` (**Required**) | text input (`Inspector.tsx:4815-4818`) | NO label marker | `"derper.key"` (`commands.ts:507`) | `derp-config-path-missing` error when empty (`diagnostics.ts:171-178`) | Diagnostic exists (pass-1 "no validation" P0 STALE), but label lacks a required asterisk. See [P2]. |
| `verify_client_endpoint` (string[]) | checklist over `endpointTags(config,"tailscale")` w/ stale-tag rows (`Inspector.tsx:4820-4858`) | n/a | `[]` | `missing-derp-verify-endpoint` error + `…not-tailscale` warning (`diagnostics.ts:180-203`) | Now a real multiselect (pass-1 "plain text input" P0 STALE). Empty-state hint guides creating an endpoint. |
| `verify_client_url` (object[]/string[], HTTP Client Fields) | structured repeater: `url` + `detour` inputs (`Inspector.tsx:4867-4914`) | none | none | none | Only `url`+`detour` exposed; other HTTP Client Fields absent; string-shorthand form not offered. `detour` is unmanaged (see §3). |
| `home` (string) | text input, placeholder "blank or redirect URL" (`Inspector.tsx:4859-4866`) | n/a | `""` | none | Free text; `"blank"`/URL not enum-validated — acceptable. |
| `mesh_with` (object[]) | structured repeater: `server`*, `server_port`*, `host` (`Inspector.tsx:4915-4979`) | "(required)" labels on server/server_port | `[{server:"",server_port:8443}]` on add | port coerced to positive number | MISSING `tls` (outbound TLS) and Dial Fields per upstream `mesh_with` object. See [P2]. |
| `mesh_psk` (string) | text input (`Inspector.tsx:4980-4986`) | n/a | none | none | Not sensitive-masked (it is a pre-shared key — minor). |
| `mesh_psk_file` (string) | text input (`Inspector.tsx:4987-4993`) | n/a | none | none | OK. |
| `stun` (object/number) | toggle + listen + listen_port form (`Inspector.tsx:4994-5052`) | n/a | `{enabled:false, listen:"::", listen_port:3478}` (`commands.ts:511`) | port coerced positive | Reads numeric shorthand (`:4996-4999`); writes canonical object. Other Listen Fields for STUN absent (acceptable). Pass-1 "raw JSON" P1 STALE. |

No invalid-JSON write paths remain in the DERP section (all `JsonField` usages are gone — pass-1's three raw-JSON findings are STALE). No UI field is absent from the official model. Tests cover the checklist, repeaters, and STUN form (`tests/app.test.tsx:1517-1579`).

## Findings (prioritized)

**[P1] DERP `verify-client-endpoint` node port toggle wipes ALL endpoints** — `useProjectStore.ts:1367-1382`. When `refs.length > 0`, line 1372 sets `verify_client_endpoint` to `undefined`, clearing every linked endpoint. This is asymmetric with the edge-drop disconnect (`commands.ts:1173-1183`) which correctly splices via `removeTagRef`, and with the endpoint-side `derp-service` toggle (`useProjectStore.ts:1070-1080`) which also splices. `tests/port-disconnect-symmetry.test.ts:143-144` only exercises the edge path, so the node-port wipe is untested. Fix: mirror the edge-drop logic — splice the specific tag (or, if the toggle is intentionally all-or-nothing, document and test it). Pass-1 flagged this at line 1195, which is now STALE — the live offending line is 1372.

**[P1] Canvas `+` / "Tailscale Endpoint" compatible chip is a dead no-op** — `graph.ts:669` sets `compatible: ["Tailscale Endpoint"]`, but `createCompatible` (`useProjectStore.ts:798-836`) has no `"Tailscale Endpoint"` branch, so `SbcNode.tsx:400` and `SbcNode.tsx:448` do nothing. Users get a visible `+` button and chip that silently fail. Fix: add a branch that creates/links a tailscale endpoint (or drop the chip and rely on the working port-drag + Inspector checklist).

**[P2] `mesh_with` repeater omits outbound TLS and Dial Fields** — `Inspector.tsx:4915-4979` exposes only `server`/`server_port`/`host`. Upstream `mesh_with` object also supports `tls` (outbound TLS) and Dial Fields (incl. `detour`). Add expandable TLS + dial subsections, or at minimum a note.

**[P2] mesh/verify-URL `detour` are unmanaged outbound references** — `mesh_with[].detour` and `verify_client_url[].detour` (`Inspector.tsx:4894,4896`) are outbound tags but are absent from `referenceRegistry.ts` outbound paths (`:334`). Renaming/deleting an outbound leaves stale detour tags in DERP. Add `/services/*/mesh_with/*/detour` and `/services/*/verify_client_url/*/detour` handling, or surface a diagnostic.

**[P2] `config_path` label lacks a required marker** — `Inspector.tsx:4813-4818` renders a plain label with no asterisk/`field--required`, despite being `==Required==` upstream. The empty-value diagnostic exists (`diagnostics.ts:171-178`), but the field should also be visually marked required. (TLS card ordering — rendered at `Inspector.tsx:5343`, below all DERP fields — is a related minor nit; consider hoisting TLS/Listen above optional mesh fields for DERP.)

SUMMARY: 0 P0, 2 P1, 3 P2.
