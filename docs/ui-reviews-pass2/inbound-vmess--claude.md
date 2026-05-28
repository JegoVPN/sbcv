# inbound-vmess — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
The vmess inbound is in good shape on three of four surfaces: present in the palette, correct registry-driven canvas ports, and a complete/correct reference model. The protocol-specific Inspector is also strong now — a structured `users[]` editor (name / masked UUID + Generate / alterId number) plus diagnostics for missing-uuid, bad-uuid, empty-users, and `alterId>0` deprecation — so the pass-1 P0 "users invisible" and several P1s are now **stale/fixed**. The real remaining defects are all in the *shared* TLS / Multiplex / Transport sections, which are role-blind: inbound vmess is shown client-only TLS fields, outbound-only multiplex fields, a wrong `client_authentication` enum, and a flat non-type-aware transport card missing several official sub-fields.

## 1. Left Palette
- Present: `{ label: "VMess", kind: "inbound-vmess", icon: Shield, docsUrl: docs("inbound/vmess/"), status: "setup" }` — `Palette.tsx:135`. Under the "Inbounds" group. Correct category.
- Default action: `status:"setup"` → `itemStatus` returns `"setup"` (`Palette.tsx:262`), `canActivate` true (`Palette.tsx:280-287`); button reads "Add … setup draft to canvas". Appropriate — a vmess inbound needs a user credential before it is valid, so a setup draft (not a bare "add") is the right affordance.
- Docs link → official `inbound/vmess/`. Correct.
- Kind→type map `"inbound-vmess" → "vmess"` (`protocols.ts:53`); `vmess` ∈ `CREATABLE_INBOUND_TYPES` (`protocols.ts:73`). Correct.
- Nit (P2): icon `Shield` is shared with shadowsocks/trojan/vless/anytls/shadowtls inbounds — not distinctive, but acceptable.

## 2. Canvas Node
- Titlebar shows `inbound / vmess` (`SbcNode.tsx:291`); card body shows tag as title + subtitle (`graph.ts`). Pass-1's "human name first" critique applies only to the small titlebar — the card body is already tag-first, so this is cosmetic (P2).
- No deprecated badge (correct — only `outbound/block` gets one, `SbcNode.tsx:279`).
- Ports are data-driven from `portRelationRegistry` via `portEndpointsForNode` (`SbcNode.tsx:94-108`), not hardcoded. Effective ports for `inbound`/`vmess` (all output/right side):
  - `route` ("Route hub", decorative) — relation `inbound` (`portRelationRegistry.ts:91`).
  - `route-rule-match` ("Route rule matcher", writable) — relation `route-rule-inbound`, `/route/rules/*/inbound` (`portRelationRegistry.ts:94`). Correct.
  - `dns-rule-match` ("DNS rule matcher", writable) — relation `dns-rule-inbound`, `/dns/rules/*/inbound` (`portRelationRegistry.ts:99`); also feeds decorative `dns-inbound-query` (`:100`). Correct.
  - The `service` port (SSM-API, relation `service-ssm-inbound`) is `nodeType:"shadowsocks"`-gated (`portRelationRegistry.ts:113`) — correctly NOT shown for vmess.
- No left/input ports — correct: an inbound is a source of traffic, never a downstream target of a tag reference.
- Listen-field `detour` (inbound→inbound forwarding) has no canvas port/edge. This is consistent: `detour` requires an *injectable* target inbound and is editable only in the Inspector listen card; not vmess-specific (P2 / N/A).

## 3. Upstream/Downstream Links
Official model: an inbound is **referenced by tag** from `route.rules[].inbound`, `dns.rules[].inbound`, `services[].servers` (SSM), and `experimental.v2ray_api.stats.inbounds`; it does not reference other nodes by tag (its `detour` listen field points at another inbound but is intra-kind).
- `referenceRegistry` `inbound` entry paths = `["/route/rules/*/inbound", "/dns/rules/*/inbound", "/services/*/servers", "/experimental/v2ray_api/stats/inbounds"]` (`referenceRegistry.ts:327-331`). Complete and correct — rename (`replaceInboundRefs`, `:123-139`) and delete (`removeInboundRefs`, `:141-155`) propagation cover every inbound reference, including v2ray stats and SSM `servers` map.
- Port relations `route-rule-inbound` / `dns-rule-inbound` match the registry paths exactly; both are disconnectable via `disconnectEdge` (`commands.ts:1078-1084`, `:1112-1118`). Correct.
- No missing / extra / wrong links for vmess. The SSM `service-ssm-inbound` relation is correctly `shadowsocks`-gated away. Listen `detour` is intentionally not a cross-kind link.

## 4. Right Inspector (fields)
Rendered for `inbound`/`vmess`: tag input (`Inspector.tsx:2094`), type `<select>` over `CREATABLE_INBOUND_TYPES` (`:2113`), the structured users editor (`:3125-3236`, schema `:566-573`), then `SharedFieldCards` for groups `["listen","tls","multiplex","tcp-brutal","v2ray-transport"]` (`sharedFieldRegistry.ts:170-174`; rendered ~`:5343`), then Advanced spillover. `users`/`tls`/`multiplex`/`transport` + all listen fields are in `inboundHandledFields` (`Inspector.tsx:140-177`) so none leak into raw Advanced scalars.

| Official field | Req | Type | UI state |
|---|---|---|---|
| `type` (=`vmess`) | yes | enum | Type `<select>`, vmess in list (`Inspector.tsx:2113`). Correct. Switching type rebuilds via `createInbound` keeping tag (`commands.ts:908-911`); tag refs survive. |
| `tag` | yes | string | Tag input, rename-on-blur (`Inspector.tsx:2094-2106`). No empty-tag diagnostic (cross-node, P2). |
| `users[]` | **yes** | repeater | Structured editor (`Inspector.tsx:3125-3236`). Empty-array → `inbound-users-required` **error** (`diagnostics.ts:1604,1613-1624`). Correct. |
| `users[].name` | no | string | Text input (schema `:568`, `defaultUser` `name:"user{n}"` `:572`). Correct. |
| `users[].uuid` | **yes** | string(UUID) | `SensitiveTextField` (masked) + "Generate UUID" button using `crypto.randomUUID()` (`Inspector.tsx:3146-3168`; schema `:569`). Diagnostics: missing-uuid error + invalid-uuid warning vs canonical regex (`diagnostics.ts:639-666,920-926`). Strong. |
| `users[].alterId` | no | int | Number input (schema `:570`, default 0). `alterId>0` → `vmess-alterid-deprecated` warning (`diagnostics.ts:668-676`). Correct. Nit: no *inline* note in the row (P2). |
| `tls` | no | obj (inbound) | TLS ModuleCard via shared group (`Inspector.tsx:1502-1547`). **Role-blind — see P0 below.** Inbound-only fields (`kernel_tx/rx`, `client_certificate*`, `client_authentication`, `acme`, `handshake_timeout`, ech `key`/`key_path`) are **absent**; client-only fields are wrongly **present**. |
| `multiplex` | no | obj (inbound) | Multiplex ModuleCard (`Inspector.tsx:1559-1567`). Shows `enabled`/`padding`/`brutal` (correct) **plus** outbound-only `protocol`/`max_connections`/`min_streams`/`max_streams` (wrong for inbound — P1). |
| `multiplex.brutal` | no | obj | TCP Brutal card: `enabled`/`up_mbps`/`down_mbps` (`Inspector.tsx:1570-1575`). Correct. |
| `transport` | no | obj (v2ray) | V2Ray Transport card (`Inspector.tsx:1578-1586`). Type `<select>` over `["http","ws","quic","grpc","httpupgrade"]` (`:1365`) — correct set. But **flat, non-type-aware**, and missing sub-fields — see P1. |
| *(listen fields)* | mixed | — | Full active set in Listen card (`Inspector.tsx:1431-1450`): `listen`(req)/`listen_port`/`bind_interface`/`routing_mark`/`reuse_addr`/`netns`/`tcp_fast_open`/`tcp_multi_path`/`disable_tcp_keep_alive`/`tcp_keep_alive`/`tcp_keep_alive_interval`/`udp_fragment`/`udp_timeout`/`detour`(select over inbound tags). Complete; deprecated sniff/domain fields correctly omitted. |

Sensitive masking: UUID masked (`:3149`). No invalid-JSON write path on the structured users editor (allowlist schema; `alterId` coerced to Number `:3187`; empty `users` omitted `:3130`). `security` is **not** offered for inbound users (schema `:566-573` has no `security` key; the `Security` select at `:3692` is gated `entityType==="vmess"` inside the `ref.kind==="outbound"` branch, so it never renders for an inbound) — pass-1 P0 about `security` leaking onto inbound users is therefore not reproducible in normal editing (N/A).

No UI field absent from the official model in the *protocol-specific* area. The over-exposed fields are all in the shared TLS/multiplex sections (below).

## Findings (prioritized)
- [P0] **Inbound TLS card renders client-only fields and omits inbound/server-only ones.** `sharedFieldDefinitions(group==="tls")` (`Inspector.tsx:1502-1547`) is shared by inbound + outbound with no `ref.kind` branch. For inbound vmess it wrongly shows `disable_sni` (`:1512`), `insecure` (`:1513`), `certificate_public_key_sha256` (`:1523`), `fragment`/`fragment_fallback_delay`/`record_fragment` (`:1531-1533`), `utls.*` (`:1534-1535`), and Reality client `public_key` (`:1537`) — all `==Client only==` per `shared/tls.md`. It also **omits** inbound/server-only fields: `kernel_tx`/`kernel_rx`, `client_certificate`/`client_certificate_path`/`client_certificate_public_key_sha256`, `acme` (deprecated but inbound-only), `handshake_timeout`, and ech server `key`/`key_path` (the card only exposes ech `config`/`config_path`, which are client-only). Writing `insecure`/`utls`/`fragment` onto an inbound produces a config sing-box rejects. Split the TLS definitions by role (inbound vs outbound).
- [P1] **`client_authentication` enum values are wrong.** `options: ["", "request", "require", "verify-if-given", "require-and-verify"]` (`Inspector.tsx:1524`). Upstream values are `no` / `request` / `require-any` / `verify-if-given` / `require-and-verify` (`shared/tls.md` §client_authentication). `require` is not a valid value (should be `require-any`) and `no` (the default) is missing. (This is moot for inbound vmess until the TLS card is role-split, since the field is server-only — but it is emitted today.)
- [P1] **Multiplex card shows outbound-only fields on an inbound.** `sharedFieldDefinitions(group==="multiplex")` (`Inspector.tsx:1559-1567`) always renders `protocol`/`max_connections`/`min_streams`/`max_streams`, which `shared/multiplex.md` lists under **Outbound Fields** only; inbound multiplex is just `enabled`/`padding`/`brutal`. Gate these four to `ref.kind==="outbound"`.
- [P1] **Transport card is flat and not type-aware, and is missing official sub-fields.** `group==="v2ray-transport"` (`Inspector.tsx:1578-1586`) exposes only `type`/`host`/`path`/`service_name`/`idle_timeout`/`ping_timeout` for all types. Missing per `shared/v2ray-transport.md`: `method` + `headers` (http), `headers`/`max_early_data`/`early_data_header_name` (ws), `headers` (httpupgrade), `permit_without_stream` (grpc). Also `host` is always `kind:"list"`, but `httpupgrade` `host` is a single string. Selecting a type should drive the visible sub-fields (and `host` shape). Pass-1's "transport type must drive nested fields" P0 is only **partially** addressed (type selector + 6 shared fields exist; the type-gating + remaining fields do not).
- [P2] Titlebar reads `inbound / vmess` (`SbcNode.tsx:291`) — internal kind/type rather than the human tag first (card body already shows the tag). Cosmetic.
- [P2] `alterId` has a runtime diagnostic but no inline warning in the users-editor row when `>0` (`Inspector.tsx:3180-3190`); add inline copy ("legacy MD5 auth — not recommended").
- [P2] No empty/missing-`tag` diagnostic for inbounds (only duplicate-tag is checked, `diagnostics.ts:25-35`); cross-node.
- [P2] Palette `Shield` icon non-distinctive (shared across TLS-ish inbounds), `Palette.tsx:135`.

Where pass-1 is now stale: `docs/ui-reviews/inbound-vmess.md` + `docs/claude/inbound-vmess.md` are largely obsolete. (a) Pass-1 P0 "users array invisible in Inspector" is FIXED — structured editor at `Inspector.tsx:3125-3236` with vmess schema `:566-573`. (b) Pass-1 P0 "`security` must not appear on inbound users" is N/A — the inbound users schema is an allowlist with no `security`, and the outbound `Security` select is inside the `outbound` branch (`:3692`). (c) Pass-1 P1 "`alterId` warning not surfaced" is FIXED — `vmess-alterid-deprecated` diagnostic (`diagnostics.ts:668-676`). (d) Pass-1 P1 "`listenSharedFields` incomplete" is FIXED — all active listen fields present (`Inspector.tsx:100-115`, `1431-1450`). (e) Pass-1 P1 "Palette kind / reverse-map mismatch (`vmess:"vmess-in"`)" is **WRONG**: `protocols.ts:175` is `preferredInboundTags`, a default-**tag** generator (`vmess-in` is the intended tag string), not a palette-kind reverse map — no bug. The genuinely valid pass-1 concerns that remain are the inbound-vs-outbound TLS shape (P0 here) and type-aware transport (P1 here).

SUMMARY: 1 P0, 3 P1, 4 P2.
