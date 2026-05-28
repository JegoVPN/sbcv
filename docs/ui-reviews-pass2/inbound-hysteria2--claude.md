# inbound-hysteria2 — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The node is registered, scaffolds with required TLS, has a structured Users editor, masks passwords, and is correctly referenced by route/dns rules — pass-1's two biggest P0s (no-TLS scaffold, users silently dropped) are now STALE/fixed. However the **rate/CC fields specific to Hysteria2 are not exposed for the inbound at all**: `up_mbps`, `down_mbps`, `ignore_client_bandwidth` fall through to the generic "Advanced fields" with no labels/conflict guidance, `obfs` is editable only as raw JSON (the structured salamander/gecko editor was built for the *outbound* only), and `masquerade` is URL-only with no object mode. The 1.14 fields `bbr_profile`/`realm` have no inbound UI and no inbound testing-only diagnostics (the outbound has them).

## 1. Left Palette

- Present and correct. `Palette.tsx:142` — `{ label: "Hysteria2", kind: "inbound-hysteria2", icon: Plug, docsUrl: docs("inbound/hysteria2/"), status: "setup" }`. Maps to type `hysteria2` (`protocols.ts:60`), is in `CREATABLE_INBOUND_TYPES` (`protocols.ts:81`), grouped under "Inbounds", default tag `hy2-in` (`protocols.ts:182`). Docs URL correct.
- `status: "setup"` renders as the "Setup" pill ("Add … setup draft to canvas", `Palette.tsx:269`) and is activatable (`Palette.tsx:281`). Consistent with sibling proxy inbounds (socks/trojan/tuic also use `setup`); not a defect — pass-1's "should say ADD" is a style nit only.

## 2. Canvas Node

- Title = tag, subtitle = `"hysteria2 inbound"`, compatible = `["Route"]` (`graph.ts:224-227`). Icon `RadioTower` for all inbounds (`SbcNode.tsx:37`); bottom pill shows the type (`SbcNode.tsx:408-411`). Correct and consistent.
- Ports (output only; no input — correct, inbounds are sources): Route hub (decorative), Route-rule matcher, DNS-rule matcher (`portRelationRegistry.ts:91,94,99`; surfaced via `getPortSpecs`/`portEndpointsForNode`). These are the only real tag references an inbound emits — correct.
- TLS-required state has **no canvas badge** (only `block` gets a deprecated badge, `SbcNode.tsx:292-296`); the missing-TLS error surfaces in node `status` via diagnostics, not as a dedicated chip. Summary does not show user-count / bandwidth / obfs / TLS state (polish gap, P2). No masquerade/realm port — correct (neither is a cross-node tag ref).

## 3. Upstream/Downstream Links

- `referenceRegistry.ts:327-331` (kind `inbound`): paths `/route/rules/*/inbound`, `/dns/rules/*/inbound`, `/services/*/servers`, `/experimental/v2ray_api/stats/inbounds`. Matches the official model (inbound matched by route + dns rule `inbound[]`; ssm-api manages an inbound). Rename/remove wired.
- `portRelationRegistry.ts`: `route-rule-inbound` (writable, `/route/rules/*/inbound`, :94) and `dns-rule-inbound` (writable, `/dns/rules/*/inbound`, :99) + decorative `inbound`→route (:91) and `dns-inbound-query` (:100). Correct.
- TLS is **required** but is an embedded inbound TLS section, not a node/edge — correct (no port expected); enforced by diagnostic (see §Findings). 
- Missing/extra: **none wrong**. `realm` (1.14) is a self-contained JSON object that references the *Hysteria Realm service* only by a shared `realm_id` string (not a sing-box `tag`), so no port is the right call today. Listen `detour` (inbound→inbound) is intentionally an Inspector select (`Inspector.tsx:1449`), not a port — acceptable.

## 4. Right Inspector (fields)

Inbound render block is `Inspector.tsx:2583-3240`; hysteria2-specific sub-block `3071-3092`; shared Users editor `3125-3236`; shared groups (listen/tls/quic) via `sharedGroupsForEntity` (`sharedFieldRegistry.ts:169-176`, hysteria2 ∈ tls+quic sets :144-145). `inboundHandledFields` = `Inspector.tsx:140-177`.

| Official field | UI state |
|---|---|
| `type` | Select (`Inspector.tsx:2113`); hysteria2 listed. OK |
| `tag` | Text input (shared). OK |
| Listen Fields (`listen`, `listen_port`, `bind_interface`, `routing_mark`, `reuse_addr`, `netns`, `tcp_fast_open`, `tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, `udp_fragment`, `udp_timeout`, `detour`) | Full Listen panel `Inspector.tsx:1436-1450`. OK — pass-1 "missing 6 listen fields" is **STALE**. |
| `up_mbps` | **No dedicated control.** Not in `inboundHandledFields` → renders as generic number under "Advanced fields" (`AdvancedScalarFields`, :3237). No label semantics, no "empty = unlimited" hint. The labelled Up/Down inputs at :3481-3516 are in the **outbound** block. [P1] |
| `down_mbps` | Same as above — Advanced-fields fallback only. [P1] |
| `obfs.type` (`salamander`/`gecko`) | **No structured inbound control.** `obfs` is NOT in `inboundHandledFields` and is a non-scalar → editable only as raw JSON via `AdvancedNonScalarFields` (:3238). The salamander/gecko select + masked password editor (`hysteria2-obfs`, :3955-3990) is gated to the **outbound** section. [P1] |
| `obfs.password` | Inbound: raw JSON only (see above). (Outbound editor masks it; inbound does not.) [P1] |
| `obfs.min_packet_size` / `max_packet_size` (1.14, gecko) | Not exposed anywhere (even outbound editor omits them). Raw JSON only. [P2] |
| `users[]` / `users[].name` / `users[].password` | Structured repeater with Add/Remove, name text + masked password (`INBOUND_USER_SCHEMAS.hysteria2` :604-610; editor :3125-3236). Writes `undefined` when emptied. OK — pass-1 "uneditable/silently dropped" is **STALE**. (Minor: upstream `userpass`-alias warning copy absent — P2.) |
| `ignore_client_bandwidth` | **No dedicated control / no conflict guidance.** Not in `inboundHandledFields` → generic boolean toggle under "Advanced fields". Conflict with `up_mbps`/`down_mbps` not communicated or diagnosed. [P1] |
| `tls` (==Required==) | Full embedded TLS panel incl. server `key`/`key_path`/`certificate` (`Inspector.tsx:1509-1527`). Scaffold sets `tls:{enabled:true,server_name:""}` (`commands.ts:241`). Missing-TLS error diagnostic fires (`diagnostics.ts:523-590`). OK — pass-1 "no TLS scaffold / no key_path / no diagnostic" all **STALE**. |
| QUIC Fields (`initial_packet_size`, `disable_path_mtu_discovery`, `idle_timeout`, `keep_alive_period`) | QUIC panel applied (`sharedFieldRegistry.ts:145`; defs at the shared `quic` group). OK. |
| `masquerade` (string) | URL text input (`inbound-hysteria2-masquerade`, :3073-3080). OK for string mode. |
| `masquerade.type` object mode (`file`/`proxy`/`string` + `directory`/`url`/`rewrite_host`/`status_code`/`headers`/`content`) | **Not supported and not editable.** `masquerade` IS in `inboundHandledFields` (:162) so an imported object form does NOT reach the JSON fallback — it is silently uneditable, and the URL `<input>` shows blank for an object value (`typeof === "string"` guard, :3076). Mutually-exclusive string-vs-object modes not modelled. [P1] |
| `bbr_profile` (1.14, `conservative`/`standard`/`aggressive`) | **No inbound control.** Not in `inboundHandledFields` → Advanced-fields text fallback; no enum, no testing-only banner/diagnostic. (Outbound gets a stable-channel diagnostic at `diagnostics.ts:852-858`; inbound has none.) [P2] |
| `brutal_debug` | Dedicated toggle (`inbound-hysteria2-brutal-debug`, :3081-3090). OK. |
| `realm{}` (1.14: `server_url`*, `token`, `realm_id`*, `stun_servers`*, `stun_domain_resolver`, `http_client`) | **No inbound control.** Not in `inboundHandledFields` → raw JSON via `AdvancedNonScalarFields`. Required sub-fields not validated; no testing-only diagnostic for inbound. [P2] |

Invalid-JSON write risk: `AdvancedNonScalarFields`/`JsonField` (`Inspector.tsx:794-818`) writes the raw **string** back into the config on parse failure (no error state, unlike `InlineRuleSetEditor`). Since inbound `obfs`/`realm` rely on this path, a malformed edit silently corrupts the entity to a string. [P2]

## Findings (prioritized)

- [P1] Inbound `up_mbps`/`down_mbps` have no dedicated, labelled control — only the generic "Advanced fields" fallback. `Inspector.tsx:140-177` (absent from `inboundHandledFields`), fallback at `Inspector.tsx:3237`. Add labelled number inputs (empty = unlimited) in the inbound hysteria2 block (mirror outbound `:3481-3516`).
- [P1] Inbound `obfs` (type+password) is editable only as raw JSON; the structured salamander/gecko + masked-password editor is gated to the outbound section. `Inspector.tsx:3955-3990` (outbound-only), inbound fallback `Inspector.tsx:3238`. Reuse the editor for `ref.kind === "inbound" && entityType === "hysteria2"` and add `"obfs"` to `inboundHandledFields`.
- [P1] `ignore_client_bandwidth` has no dedicated toggle and the conflict with `up_mbps`/`down_mbps` is neither shown nor diagnosed. `Inspector.tsx:140-177`; no rule in `diagnostics.ts` (cf. inbound TLS rule `:573-590`). Add a toggle that dims `up/down_mbps` when true + a warning diagnostic.
- [P1] `masquerade` object mode (`type` file/proxy/string + sub-fields) is unsupported AND silently uneditable when imported, because `masquerade` is in `inboundHandledFields` (`Inspector.tsx:162`) yet only the URL-string input exists (`Inspector.tsx:3073-3080`). Add a mode selector (none/URL/object) or at minimum let object values reach a `JsonField`.
- [P2] 1.14 `bbr_profile` (enum) and `realm{}` (required `server_url`/`realm_id`/`stun_servers`) have no inbound controls and no inbound testing-only diagnostics, unlike the outbound (`diagnostics.ts:841-868`). Add an enum select + a structured/JSON `realm` editor and matching channel diagnostics. `Inspector.tsx:140-177`.
- [P2] Raw-JSON fallback (`JsonField`, `Inspector.tsx:805-816`) writes the unparsed string into config on invalid JSON with no error UI; this is the only editor for inbound `obfs`/`realm`. Mirror `InlineRuleSetEditor`'s last-valid-value + error pattern (`Inspector.tsx:733-783`).
- [P2] Polish: canvas node summary omits user-count/bandwidth/obfs/TLS state (`graph.ts:224-227`); `obfs.min_packet_size`/`max_packet_size` (gecko, 1.14) unexposed even on outbound; upstream `userpass`-alias caveat not surfaced near the Users editor (`Inspector.tsx:3125-3236`).

Pass-1 staleness: pass-1 P0 "scaffold created without TLS" (now `commands.ts:241`), P0 "users/obfs/masquerade silently dropped by AdvancedScalarFields" (users now structured; masquerade/brutal_debug now handled), P1 "TLS panel missing key_path/inline PEM" (now `Inspector.tsx:1521-1522`), P1 "listen panel missing 6 fields" (now `:1436-1450`), and "no diagnostic warns about TLS" (now `diagnostics.ts:573-590`) are all STALE. Pass-1's bandwidth-conflict P1 and bbr_profile/realm P1 remain valid but are downgraded here (P1/P2) given the structured-editor and diagnostic infrastructure now exists and only needs wiring to the inbound.

SUMMARY: 0 P0, 4 P1, 3 P2.
