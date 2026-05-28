# inbound-mixed — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The `inbound-mixed` node is now in good shape and ships every official writable field: palette kind is `inbound-mixed`, the Inspector renders a structured `users[]` repeater with masked passwords plus a `set_system_proxy` toggle, and the full Listen Fields group is exposed. **Pass-1 (`docs/ui-reviews/inbound-mixed.md`) is almost entirely stale** — its three P0s (palette kind, missing `users[]`, missing `set_system_proxy`) and two P1s (`inboundHandledFields`, TUN-only `address`/`auto_route` leaking) are all fixed. Remaining gaps are minor: `listen` has no required marker/diagnostic, the canvas titlebar shows `inbound / mixed` instead of the human tag, and the `set_system_proxy` platform/privilege caveat (use `tun.platform.http_proxy` on Apple/Android) is only hinted, never warned.

## 1. Left Palette

- Present. `Palette.tsx:131` — `{ label: "Mixed", kind: "inbound-mixed", icon: RadioTower, docsUrl: docs("inbound/mixed/"), ready: true }`. Category **Inbounds**, label **Mixed**, docs URL correct.
- Kind now follows the `inbound-*` convention. `INBOUND_PALETTE_TYPES["inbound-mixed"] = "mixed"` (`protocols.ts:49`); `inboundTypeForPaletteKind` resolves to `"mixed"` and creation succeeds. **Pass-1 P0 (kind `"mixed"` breaks convention) is STALE — already renamed.**
- `ready: true` → status `add` → `canActivate` true → `createFromPalette("inbound-mixed")` → `createInbound("mixed", "mixed-in")` (`commands.ts:109-116`). Correct default action.
- No gating; multiple `mixed` inbounds are legal, so no singleton guard needed. Correct.

## 2. Canvas Node

- `graph.ts:214-240`: each inbound becomes one node — `kind: "inbound"`, `type: "mixed"`, `title: tag` (e.g. `mixed-in`), `subtitle: "mixed inbound"`, `status` from diagnostics, `compatible: ["Route"]`. One canonical object ↔ one node. Correct.
- Ports (`SbcNode.tsx:94-108` via `portEndpointsForNode`): outputs for `kind=inbound` resolve to `route` (decorative hub, `portRelationRegistry.ts:91`), `route-rule-match` (`route-rule-inbound` + `dns-rule-inbound` + `dns-inbound-query`, lines 94/99/100). The `service` output (line 113) is gated `nodeType:"shadowsocks"`, so it correctly does **not** render for `mixed`. No input ports. This matches sing-box semantics (an inbound is referenced by route/dns rules; it is a traffic source, not a target). Correct.
- **[P2] Titlebar shows internal identity, not the object name.** `SbcNode.tsx:291` renders `{`${data.kind} / ${data.type}`}` = `inbound / mixed`. The human tag (`data.title`) only appears in the summary block (`SbcNode.tsx:388`). Pass-1's "show object name first, internal type secondary" concern is partially unaddressed in the titlebar.

## 3. Upstream/Downstream Links

Official model: a `mixed` inbound is referenced **by tag** from `route.rules[].inbound` and `dns.rules[].inbound`. It emits no outbound tag reference of its own except the Listen-Fields `detour` (another inbound tag).

- `route-rule-inbound` writable, path `/route/rules/*/inbound` (`portRelationRegistry.ts:94`). Correct.
- `dns-rule-inbound` writable, path `/dns/rules/*/inbound` (line 99). Correct.
- `referenceRegistry` `inbound` entry (`referenceRegistry.ts:326-331`) handles `/route/rules/*/inbound`, `/dns/rules/*/inbound`, `/services/*/servers`, `/experimental/v2ray_api/stats/inbounds` for rename/remove. Rename + delete propagation correct.
- `inbound→route` (decorative, line 91) and `dns-inbound-query` (decorative, line 100) are presentation-only edges; no canonical write. Acceptable.
- **No missing/extra/wrong link for `mixed`.** The `service` (ssm-api) relation is shadowsocks-only and correctly excluded.
- **[P2] `detour` (Listen Field) reference is not modeled as a port.** `detour` is exposed only as an Inspector select (`Inspector.tsx:1449`), not a canvas edge. Pass-1 flagged this; it remains an Inspector-only reference. Low priority since the select is tag-validated, but the graph cannot visualize inbound→inbound detour chains.

## 4. Right Inspector (fields)

One row per official field (upstream `inbound/mixed.md` + `shared/listen.md`). entity resolved at `Inspector.tsx:1761`; type discriminator at `:1794`.

| Official field | Type | Req | Exposed? | Control / file:line | Status |
| --- | --- | --- | --- | --- | --- |
| `type` | enum `mixed` | yes | Yes | Select over `CREATABLE_INBOUND_TYPES` (`:2112-2119`) | OK (type-switch via `changeEntityType`) |
| `tag` | string | — | Yes | Text + `renameTag` on blur (`:2094-2106`) | OK |
| `users[]` | array{username,password} | no | Yes | Structured repeater (`:3125-3236`), schema `mixed`→username + password(sensitive) (`:531-537`) | OK — password masked via `SensitiveTextField`; empty omits field (`:3130`) |
| `users[].username` | string | — | Yes | Text input (`:3211-3218`) | OK |
| `users[].password` | string (secret) | — | Yes | `SensitiveTextField` (`:3171-3178`) | OK — masked |
| `set_system_proxy` | bool | no | Yes | Toggle gated `mixed/http/socks` (`:2950-2961`); writes `checked||undefined` | OK value-wise; see [P1] caveat |
| `listen` (shared) | string | **yes** | Yes | Listen Fields text (`:1436`) | Exposed but **no required marker** — [P1] |
| `listen_port` (shared) | int | no | Yes | Listen Fields number (`:1437`) | OK |
| `bind_interface` (1.12) | string | no | Yes | `:1438` | OK |
| `routing_mark` (Linux) | int/hex | no | Yes | text `:1439` | OK (accepts hex string) |
| `reuse_addr` (1.12) | bool | no | Yes | `:1440` | OK |
| `netns` (Linux,1.12) | string | no | Yes | `:1441` | OK |
| `tcp_fast_open` | bool | no | Yes | `:1442` | OK |
| `tcp_multi_path` | bool | no | Yes | `:1443` | OK |
| `disable_tcp_keep_alive` (1.13) | bool | no | Yes | `:1444` | OK |
| `tcp_keep_alive` (1.13) | duration | no | Yes | text `:1445` | OK |
| `tcp_keep_alive_interval` | duration | no | Yes | text `:1446` | OK |
| `udp_fragment` | bool | no | Yes | `:1447` | OK |
| `udp_timeout` | duration | no | Yes | text `:1448` | OK |
| `detour` (shared) | inbound tag | no | Yes | Select of inbound tags (`:1449`) | OK — not raw text |
| deprecated `sniff*`,`domain_strategy`,`udp_disable_domain_unmapping` | — | — | Not offered | `inboundHandledFields` excludes them → surface only via `AdvancedScalarFields` if imported (`:3237`) | Acceptable (import round-trip only) |

UI fields NOT in the official `mixed` model: **none leak into `mixed`.** `address`/`auto_route` are now gated `entityType === "tun"` (`:2603,2609-2627`). **Pass-1 P1 (address/auto_route shown for mixed) is STALE — fixed.** `inboundHandledFields` now contains `users` (`:145`) and `set_system_proxy` (`:167`), so they are no longer double-rendered by the Advanced fallback. **Pass-1 P1 STALE — fixed.**

## Findings (prioritized)

- **[P1]** `listen` is `==Required==` upstream (`shared/listen.md:56-60`) but the Inspector renders it as a plain optional text input with no required marker and there is **no diagnostic** for an empty/missing `listen` on a `mixed` inbound. `Inspector.tsx:1436` (no `required` flag); `diagnostics.ts` has no `inbound-listen-required` rule (the only inbound `listen`-shape check is for services at `diagnostics.ts:292-299`). A user can create/export a `mixed` inbound with blank `listen` and get no warning. Add a required indicator + semantic diagnostic. (`createInbound` does seed `listen: "127.0.0.1"` at `commands.ts:113`, so new nodes are valid — the gap is editing it blank.)
- **[P1]** `set_system_proxy` platform/privilege caveat is under-communicated. Upstream warns it is only supported on Linux/Android/Windows/macOS **and** that Apple/Android without privileges must use `tun.platform.http_proxy` instead (`mixed.md:36-42`). The UI shows only an inline label "Set System Proxy (Linux / Android / Windows / macOS)" (`Inspector.tsx:2959`) — no `PlatformBanner`, no mention of the `tun.platform.http_proxy` alternative, and no diagnostic. Pass-1 P0 "needs platform/privilege guidance" is only half-addressed.
- **[P2]** Canvas titlebar shows `inbound / mixed` (internal kind/type) rather than leading with the human tag. `SbcNode.tsx:291`. Cosmetic/IA; the tag is still visible in the summary (`SbcNode.tsx:388`).
- **[P2]** Listen-Fields `detour` is an Inspector-only inbound→inbound reference with no canvas edge representation. `Inspector.tsx:1449`; no relation in `portRelationRegistry.ts`. Inbound detour chains are invisible on the graph.

SUMMARY: 0 P0, 2 P1, 2 P2.
