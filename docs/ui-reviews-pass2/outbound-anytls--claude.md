# outbound-anytls — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The `outbound:anytls` node is now in good shape across all four surfaces and the pass-1 review (`docs/ui-reviews/outbound-anytls.md`) is almost entirely stale: every P0/P1 it raised (password buried in Advanced, `tls` missing from the default template, idle-session fields buried) has been fixed. The Inspector exposes all seven official fields as first-class controls with sensitive masking on `password`, the default template seeds a valid `tls.enabled`, and diagnostics enforce server/server_port/tls. The only real residual gaps are: no `password`-required diagnostic (upstream marks it Required), and a template/`default` mismatch on `min_idle_session`.

## 0. Official field inventory (upstream `outbound/anytls.md`, since 1.12.0)

| Field | Type | Required | Default |
|---|---|---|---|
| `server` | string | Required | — |
| `server_port` | int | Required | — |
| `password` | string | Required | — |
| `idle_session_check_interval` | duration | optional | `30s` |
| `idle_session_timeout` | duration | optional | `30s` |
| `min_idle_session` | int | optional | `0` |
| `tls` | object | Required | — (outbound TLS, `shared/tls.md`) |
| Dial Fields | — | optional | per `shared/dial.md` |

No multiplex / transport / QUIC / udp_over_tcp on anytls (confirmed correct in `sharedFieldRegistry.ts`: anytls absent from `outboundMultiplexTypes`/`outboundTransportTypes`/`outboundQuicTypes`/`outboundUdpOverTcpTypes` lines 152-155).

## 1. Left Palette

Present and correct. `Palette.tsx:167` → `{ label: "AnyTLS", kind: "anytls-out", icon: Shield, docsUrl: docs("outbound/anytls/"), status: "setup" }`, in the **Outbounds** group. Mapped to type `anytls` via `protocols.ts:16`. Status `setup` IS clickable — `canActivate` allows `"setup"` (`Palette.tsx:279-287`), so pass-1's claim that the node "cannot be dragged or clicked" is **STALE/incorrect**. Docs URL is correct. Icon `Shield` is shared with other protocols (acceptable). No version gate for the 1.12.0 floor (low impact: anytls is a client outbound present in every channel the app targets — stable and testing are both ≥1.12).

## 2. Canvas Node

Correct. Generic `outbound` node (`graph.ts:383-433`): titlebar reads `outbound / anytls` (`SbcNode.tsx:291`), title = tag, subtitle = `anytls <server>:<port>` (`graph.ts:401-402`) — a real type-specific summary. Status comes from `/outbounds/{index}` diagnostics (`graph.ts:404`). `compatible` is `[]` for anytls (not a group), so the large `+` add affordance does NOT render (`SbcNode.tsx:392-405`) — no misleading "create next object" button. Ports come from `portEndpointsForNode("outbound","anytls",…)`: inputs = route-final, route-rule, selector-group, urltest-group, dns-detour, detour-target, service-detour, rule-set-download; output = `dial-detour` (anytls is allowed; relation excludes only block/selector/urltest/dns — `portRelationRegistry.ts:106`). Matches sing-box semantics exactly. TLS is correctly an Inspector section, not a port.

## 3. Upstream/Downstream Links

Complete and correct; no missing/extra/wrong links for anytls.

Referenced-by (input ports + reference/diagnostic coverage):
- route `final` — `portRelationRegistry.ts:93`, ref `referenceRegistry.ts:334`, diag `diagnostics.ts:49`.
- route rule `outbound` — `:95`, ref `:334`, diag `:72`.
- selector / urltest member — `:103-104`, ref `/outbounds/*/outbounds` + `/outbounds/*/default` `:334`.
- dns server `detour` — `:105`, ref+diag present.
- own dial `detour` (output) — `:106`, ref `/outbounds/*/detour`.
- endpoint `detour` — `:108`; service ccm/ocm `detour` — `:109-110`; rule-set `download_detour` — `:111`; ntp `detour` — `:115`.

`changeEntityType` preserves an existing `detour` when switching an outbound's type (`commands.ts:914-919`) and rename/delete fan-out is handled by `replaceOutboundRefs`/`removeOutboundRefs` (`referenceRegistry.ts:157-197`). No anytls-specific reference is missing.

## 4. Right Inspector (fields)

Outbound block: `Inspector.tsx:3242+`. Shared cards (`tls`, `dial`) via `sharedGroupsForEntity` → anytls ∈ `outboundDialTypes` (`sharedFieldRegistry.ts:150`) and `outboundTlsTypes` (`:151`).

| Official field | UI control | State |
|---|---|---|
| `server` | text input, `Inspector.tsx:3376-3384` | OK. Shown via `"server" in entity`. No `*` required marker (convention only); diag `outbound-missing-server` (`diagnostics.ts:535-543`, anytls ∈ proxy set `:511`). |
| `server_port` | number input, `:3385-3414` | OK. Validates `>0`; writes `undefined` if invalid. No anytls default port (empty placeholder). diag `outbound-invalid-server-port` (`:545-553`). |
| `password` | `SensitiveTextField` (masked + reveal), `:3467-3473` (anytls in list) | OK, sensitive-masked. **No required diagnostic** (see P1 below). In `outboundHandledFields` (`:199`) so not duplicated in Advanced. |
| `idle_session_check_interval` | text input, fieldset `anytls-idle-session` `:3919-3928` | OK. Placeholder `30s`. Handled `:235`. |
| `idle_session_timeout` | text input, `:3929-3938` | OK. Placeholder `30s`. Handled `:236`. |
| `min_idle_session` | number input, `:3939-3952` | OK, validates `>=0`; placeholder "default 0". Handled `:237`. Template seeds `5` (mismatch — P2). |
| `tls` | shared TLS ModuleCard (`enabled`, `server_name`, SNI, ALPN, versions, cert/key, provider…), defs `:1509+` | OK. Required enforced by diag `outbound-missing-tls` (`:555-569`, anytls ∈ tls-required set `:520`). |
| Dial Fields | shared Dial ModuleCard, `detour` as outbound `select` (`:1478`) | OK — `detour` is a tag-select, not raw text (pass-1 P0 concern resolved). |

No invalid-JSON write path for anytls scalars (all dedicated typed controls). No UI field exposed that is absent from the official model. `AdvancedScalarFields`/`AdvancedNonScalarFields` (`:4210-4211`) only catch genuinely unhandled keys.

Test coverage exists: `tests/app.test.tsx:1170-1191` asserts the idle-session controls render for `anytls-out`; `tests/domain.test.ts:2394` asserts anytls in the tls-required outbound set.

## Findings (prioritized)

- **[P1] No `password`-required diagnostic for anytls.** Upstream marks `password` **Required**, but `diagnostics.ts` validates only server/server_port/tls for anytls — there is no `outbound-missing-password`. An anytls outbound with empty `password` shows a green/valid node yet the binary rejects it. Fix: add a password-empty error for anytls (and other password-required proxy types) near `diagnostics.ts:532-554`.
- **[P2] `min_idle_session` template/default mismatch.** `commands.ts:411` seeds `min_idle_session: 5`, but upstream default is `n`=0 and the Inspector placeholder says "default 0" (`Inspector.tsx:3944`). Harmless but inconsistent — either seed `0`/omit it, or drop the explicit seed and rely on the documented default.
- **[P2] No 1.12.0 version gate on the Palette entry.** `Palette.tsx:167` has no `minVersion`/tooltip for the "Since 1.12.0" floor. Very low impact (anytls is a client outbound available in all targeted channels), but a `Requires sing-box ≥ 1.12.0` tooltip would match the doc.
- **[P2] No explicit required-field markers in Inspector.** `server`/`server_port`/`password`/`tls` render without a visible `*` or required affordance; correctness is enforced only by diagnostics. Consider a required marker for first-run clarity (consistent gap across protocol outbounds, not anytls-specific).

Pass-1 stale items (now FIXED, for the record): password first-class+masked (was P0), `tls: {enabled:true}` in default template (`commands.ts:412`, was P0), idle-session group (`Inspector.tsx:3916-3953`, was P1), dial `detour` as select not raw text (was P0), palette item clickable (pass-1 mis-stated it as non-clickable).

SUMMARY: 0 P0, 1 P1, 3 P2.
