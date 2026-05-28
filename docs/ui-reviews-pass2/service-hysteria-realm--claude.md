# service-hysteria-realm — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

Pass-1's three P0s are now largely resolved: the Inspector ships a structured `users[]` repeater with sensitive token masking (`Inspector.tsx:5199-5256`), an always-on channel banner (`Inspector.tsx:5191-5198`), and diagnostics enforce required `users`/`name`/`token` plus a placeholder-token warning (`diagnostics.ts:237-276`). The node is correctly testing-gated across Palette, store add-path, and diagnostics. Remaining issues are smaller: the inline TLS/HTTP2/Listen "Shared Configuration" cards render *after* the users editor and Advanced fields (wrong order vs the doc), no required-marker on `users`/`listen`, and one latent cross-surface bug where the listen-level `detour` (an inbound ref per the doc) is mis-modeled as an outbound edge.

## 1. Left Palette

- Present: `Palette.tsx:200` — `{ label: "Hysteria Realm (1.14 testing)", kind: "service-hysteria-realm", icon: Plug, docsUrl: docs("service/hysteria-realm/"), status: "setup" }`. Sits under the `title: "Services"` category (`Palette.tsx:193`) — correct taxonomy; the official doc lives under `configuration/service/`.
- Channel gate: `Palette.tsx:259` returns `"gated"` when `channel !== "testing"`. Correct and must be preserved (stable/legacy must never add this testing-only service). Store add-path is also gated at `useProjectStore.ts:767`, so even a forced palette click cannot create it off-testing. Good defense-in-depth.
- Label now names the version inline ("(1.14 testing)") — this resolves pass-1 P1 about the version not being surfaced. The gated *tooltip* itself is still generic (`statusTitle("gated", ...)` → "…is target-gated and needs matching sing-box validation", `Palette.tsx:272`) but the label compensates, so this is now cosmetic at most.
- `docsUrl` → `service/hysteria-realm/` correct; `icon: Plug` acceptable.

## 2. Canvas Node

- Title = tag, subtitle = `serviceSubtitle()` → "hysteria2 realm service" (`graph.ts:782`). Accurate and human-readable.
- Node built generically as a `service` node (`graph.ts:659-674`) in the `entry` column. `compatible: []` for hysteria-realm (`graph.ts:669`, only ssm-api/derp get drag targets) — correct: the official schema defines no tag reference, so no drag affordance and no spurious left/right ports. Pass-1's "standalone island" observation still holds and is semantically accurate.
- No edges fire for hysteria-realm in normal use: `verify_client_endpoint` (`graph.ts:681-685`) and `servers` (`graph.ts:687-691`) are DERP/ssm-api-only and absent from this schema. Correct.
- BUG (latent): `graph.ts:676-678` — `if (service.detour) { … makeEdge(… outbound:${service.detour} …) }` treats ANY service `detour` as an **outbound** edge (ccm fallback relation). But hysteria-realm carries Listen Fields whose `detour` "connections will be forwarded to the specified **inbound**" (upstream `shared/listen.md:144-148`). So if a user sets the listen `detour` (the Inspector offers it as inbound options, `Inspector.tsx:1449`), the canvas would draw an edge to a non-existent `outbound:<inboundTag>`. Edge case (the rendezvous control plane rarely uses listen-detour) but it is a correctness mismatch between Inspector and graph.

## 3. Upstream/Downstream Links

Official relationship model (upstream `hysteria-realm.md` whole-doc read): Hysteria Realm carries **control-plane signaling only**; once hole-punching succeeds, proxy traffic flows directly client↔server. The doc defines **no `tag` cross-reference** to/from inbounds or outbounds. Hysteria2 inbounds/outbounds authenticate via the `users[].token` bearer value (`hysteria-realm.md:65-69`) — a runtime credential, not a config tag.

- `portRelationRegistry.ts` (`:96-115`): no `service-detour-hysteria-realm`, no verify/servers/dns-server relation touches hysteria-realm. Correct — no link should exist.
- `referenceRegistry.ts`: grep finds zero hysteria-realm references; consistent with "no tag refs."
- Net: **no missing, extra, or wrong links** at the registry level. The only defect is the graph-edge generation noted in §2 (`graph.ts:676-678`), which is a code path issue, not a registry-relationship issue.

## 4. Right Inspector (fields)

Render path: `entityType === "hysteria-realm"` block at `Inspector.tsx:5189-5258` (banner + users editor), then `AdvancedScalarFields`/`AdvancedNonScalarFields` (`:5260-5261`), then `<SharedFieldCards>` Listen/TLS/HTTP2 at `:5343-5350`. Groups resolved by `sharedGroupsForEntity` → listen+tls+http2 (`sharedFieldRegistry.ts:198-200`).

| Official field | UI state |
|---|---|
| `type` | infra; fixed, not user-edited. OK |
| `tag` | top-of-inspector tag editor. OK |
| `listen` ==Required== | Listen card text input (`Inspector.tsx:1436`). Present, but **no required marker** and **no empty-listen diagnostic** for services. P2 |
| `listen_port` | Listen card number (`:1437`). OK |
| `bind_interface` | Listen card (`:1438`). OK |
| `routing_mark` | Listen card text (`:1439`); upstream allows int or `"0x.."` hex string → text input is correct |
| `reuse_addr` | Listen boolean (`:1440`). OK |
| `netns` | Listen text (`:1441`). OK |
| `tcp_fast_open` | Listen boolean (`:1442`). OK |
| `tcp_multi_path` | Listen boolean (`:1443`). OK |
| `disable_tcp_keep_alive` | Listen boolean (`:1444`). OK |
| `tcp_keep_alive` | Listen text (`:1445`). OK |
| `tcp_keep_alive_interval` | Listen text (`:1446`). OK |
| `udp_fragment` | Listen boolean (`:1447`). OK |
| `udp_timeout` | Listen text (`:1448`). OK |
| `detour` (→ inbound) | Listen select over **inbound** options (`:1449`). Control correct per `shared/listen.md:144-148`; but graph mis-renders it as an outbound edge (see §2). P2 |
| `tls{}` (inbound) | TLS card, full inbound TLS object (`:1502-1548`), nested enabled/server_name/cert/key/reality/ech/etc. Embedded inline, not a node. OK |
| HTTP2 `idle_timeout` | HTTP2 card text (`:1604`). OK |
| HTTP2 `keep_alive_period` | HTTP2 card text (`:1605`). OK |
| HTTP2 `stream_receive_window` | HTTP2 card text (`:1606`); memory-size string ("64 MB") → text correct |
| HTTP2 `connection_receive_window` | HTTP2 card text (`:1607`). OK |
| HTTP2 `max_concurrent_streams` | HTTP2 card number (`:1608`). OK |
| `users[]` ==Required== | Structured repeater (`:5199-5256`), add/remove rows; writes `undefined` when emptied (`:5202`). No inline required marker, but diagnostics cover it (`diagnostics.ts:240-248`). OK |
| `users[].name` ==Required== | Text input (`:5215-5221`). Diagnostic enforces non-empty (`diagnostics.ts:250-258`). OK |
| `users[].token` ==Required== | `SensitiveTextField` password+reveal (`:5222-5226`, masking `:639-672`). Required + placeholder diagnostics (`diagnostics.ts:259-276`). OK |
| `users[].max_realms` | Number input, coerces `<=0`/non-finite → `undefined` (`:5227-5240`), placeholder "0 = unlimited". Reasonable; doc gives no default and does not define 0 semantics, so omitting on 0 is safe |

No UI fields exist that are absent from the official model. `serviceHandledFields` (`Inspector.tsx:277-304`) marks `users`, `tls`, all listen fields, and all five http2 fields as handled, so none leak into the Advanced fallback. No raw-JSON write path remains for `users` (pass-1 P0 resolved). Note: `AdvancedScalarFields`/`AdvancedNonScalarFields` (`:5260-5261`) still render generic editors for any unknown key, which is the standard escape hatch (not hysteria-realm-specific).

## Findings (prioritized)

- [P1] Inspector section order wrong vs upstream. Doc order is Listen → HTTP2 → TLS → users (`hysteria-realm.md:37-57`); UI renders banner+users first (`Inspector.tsx:5189-5256`), then Advanced (`:5260`), then the Listen/TLS/HTTP2 "Shared Configuration" cards last (`:5343`). Listen/TLS/HTTP2 — the bulk of the object — appear below `users` and below the Advanced disclosure, which is disorienting. Move `<SharedFieldCards>` above the per-type block, or hoist the users editor below the shared cards. (Pass-1 claimed order "matches the official doc order" — now STALE/wrong: it never accounted for `SharedFieldCards` rendering at the end at `:5343`.)
- [P2] No required-field affordance or diagnostic for `listen`. `shared/listen.md:56-60` marks `listen` ==Required==, but the Listen field has no required marker (`Inspector.tsx:1436`) and `diagnostics.ts` has no listen-empty error for services (the only listen check is the ccm-specific public-listen warning, `diagnostics.ts:291-302`). An empty `listen` exports silently. Add a generic service `listen`-required diagnostic or a UI required marker.
- [P2] Listen `detour` ↔ canvas edge mismatch. `Inspector.tsx:1449` correctly offers inbound tags (per `shared/listen.md:144-148`), but `graph.ts:676-678` renders any `service.detour` as an `outbound:<tag>` edge via the ccm/ocm relation. For hysteria-realm a set listen-detour would draw a dangling/incorrect outbound edge. Guard the edge by service.type (only ccm/ocm) or model the listen-detour→inbound relation.
- [P2] Gated tooltip text still generic. `statusTitle` for `"gated"` (`Palette.tsx:272`) does not name 1.14; mitigated because the label already says "(1.14 testing)" (`Palette.tsx:200`). Optional polish.

Pass-1 staleness summary: pass-1's three P0s (raw `users` JSON, no channel banner, no users diagnostics) are all FIXED in current code (`Inspector.tsx:5199-5256`, `:5191-5198`, `diagnostics.ts:237-276`) and the placeholder-token P1 is also implemented (`diagnostics.ts:267-275`). Pass-1's "section order matches doc" claim is now incorrect. The pass-1 worry that `max_realms: 0` might mean unlimited is handled defensively (omitted on 0, `Inspector.tsx:5235`).

SUMMARY: 0 P0, 1 P1, 3 P2.
