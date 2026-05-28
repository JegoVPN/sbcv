# dns-server-h3 — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

Single source of truth: `docs/upstream/sing-box/testing/configuration/dns/server/http3.md` (DoH3, since 1.12.0). Official writable fields: `server` (Required), `server_port` (default 443), `path` (default `/dns-query`), `headers` (object), `tls` (shared outbound TLS, `shared/tls.md#outbound`), plus all Dial Fields (`shared/dial.md`), plus `tag`/`type` ("h3").

## Verdict (2-3 sentences)
The h3 node is in good shape and every official field is now reachable: server/port/path are typed inputs, `headers` has a key/value repeater gated to `https || h3`, and TLS + Dial render as shared cards. Diagnostics now enforce both required-`server` and domain-without-`domain_resolver` for h3, so the two largest pass-1 risks are resolved. Remaining issues are minor: the headers repeater can persist an empty `{"": ""}` key, the canvas summary is generic, and there is no required-marker on the `server` input.

## 1. Left Palette
`src/components/Palette.tsx:91` — `{ label: "HTTP3 Server", kind: "dns-h3", icon: Globe2, docsUrl: docs("dns/server/http3/"), status: "setup" }`.
- Present, DNS group. Kind is now `dns-h3` (matches the official type string and sibling pattern `dns-tls`/`dns-quic`/`dns-https`). **Pass-1's P1 "dns-http3 naming inconsistency" is STALE** — the only `http3` spelling left is the docsUrl, which is correct because the upstream doc file is `http3.md`. `protocols.ts:99` maps `"dns-h3" -> "h3"`, `protocols.ts:199` preferred tag `h3-dns`.
- `status: "setup"` is correct (adds an incomplete draft). Label "HTTP3 Server" is acceptable; "DoH3" would track the official title more closely (P2).
- Gating: `dns-h3` is not in `deprecatedKinds`/singletons, so it resolves to a clickable Setup action via `canActivate` (`Palette.tsx:279-287`). Correct.

## 2. Canvas Node
`src/canvas/graph.ts:531-572`, `src/components/SbcNode.tsx:291,408-437`.
- Title bar `dns-server / h3` (`SbcNode.tsx:291`); card title = tag, subtitle = `h3 dns server` (`graph.ts:542-543`). Status from `diagnosticStatus("/dns/servers/{i}")`.
- Ports via `portEndpointsForNode` (`portRelationRegistry.ts`): inputs `dns` (dns-final, rel `dns-final` line 98) and `dns-rule` (rel `dns-rule` line 101); output `outbound` (rel `dns-server-detour` line 105). The `endpoint`/`service` outputs are nodeType-gated to tailscale/resolved so h3 correctly does not show them. **Correct and complete for h3.**
- `compatible: []` (`graph.ts:545`) → no `+` quick-add (correct, a DNS server is a leaf), but `sbc-node-primary` still prints `data.compatible.length || 1` = `1` (`SbcNode.tsx:436`). Cosmetic, not h3-specific (P2).
- Subtitle is just the type; it does not surface server/path/TLS/detour state. Same limitation across all dns-server types (P2).

## 3. Upstream/Downstream Links
Official model: a DoH3 server is referenced by `dns.final`, by `dns.rules[].server` (route/evaluate actions), and by any Dial `domain_resolver` / `route.default_domain_resolver`; it owns one downstream link `dns.servers[].detour` -> outbound. TLS/headers are inline (no separate nodes).
- `portRelationRegistry.ts`: `dns-final` (98), `dns-rule` (101), `dns-server-detour` (105) all present. No tailscale `endpoint` / resolved `service` links leak onto h3 (nodeType-gated).
- `referenceRegistry.ts` dns-server entry (339-343) covers `/dns/final`, `/dns/rules/*/server`, `/route/default_domain_resolver`, `*/domain_resolver`; rename/delete fan-out via `replaceDnsServerRefs`/`removeDnsServerRefs` (225-253) is complete. Outbound detour rename/remove on dns servers handled at `referenceRegistry.ts:165,186`.
- `graph.ts:551-553` emits the detour edge; `dns-final`/`dns-rule` edges at 619 / 606-608. **No missing, extra, or wrong links for h3.**

## 4. Right Inspector (fields)
dns-server block `src/components/Inspector.tsx:4215-4549`; shared cards `:5343`; gating `sharedFieldRegistry.ts:156-189`.

| Official field | UI state |
|---|---|
| `type` ("h3") | Select over `CREATABLE_DNS_SERVER_TYPES` (`:2128-2135`); `changeEntityType` preserves `detour`. Correct. |
| `tag` | Text + `renameTag` on blur (`:2094-2107`). Correct. |
| `server` (Required) | Text input, `"server" in entity` (`:4278-4286`). Value present but **no required marker / placeholder**; emptiness is caught only by diagnostics. |
| `server_port` (def 443) | Number input gated `"server_port" in entity`; `portDefaultByType.h3 = 443`, shows 443 + `placeholder="443"`, clamps to >0 (`:4287-4315`). Correct — **pass-1's "shows 0 / no default" is STALE.** |
| `path` (def `/dns-query`) | Text input non-hosts branch (`:4342-4350`); value `typeof entity.path === "string" ? entity.path : ""`. Editable, round-trips, but **no `/dns-query` placeholder** (P2). Draft seeds it (`commands.ts:638-646`). |
| `headers` (object) | Key/value repeater gated `https || h3` (`:4468-4526`), writes object via `updateField`, drops to `undefined` when empty. **Pass-1's P0 "headers invisible/uneditable" is STALE.** Bug: "Add header" inserts `{"": ""}` and the empty entry can persist to JSON (see P1). |
| `tls` (shared outbound) | TLS card; `dnsServerTlsTypes` includes `h3` (`sharedFieldRegistry.ts:157`). Full outbound TLS field set incl. server_name/insecure/alpn/min-max/utls/reality/ech (`Inspector.tsx:1502-1547`). Correct. |
| Dial Fields | Dial card; h3 in `dnsServerDialTypes` (`sharedFieldRegistry.ts:156`). `detour` = outbound select, `domain_resolver` = DNS-server select (`:1478,1493`). Correct. |

Type backing: `DnsServerConfig` now has `headers?: Record<string,string>` and `path?: string | string[]` (`types.ts:44,46`); `headers`+`path` are in `dnsServerHandledFields` (`Inspector.tsx:247,257`) so they don't leak into Advanced fields. **No invalid-JSON write path for h3** (headers go through the structured editor; `JsonField`'s catch-all is not used for h3 because both object fields are handled). No UI fields exist that are absent from the official model for h3 (the `address`, `prefer_go`, `predefined`, `interface`, `service`, `inet*_range`, `accept_default_resolvers` branches are all type-gated to other dns-server types and never render for h3).

Diagnostics (`diagnostics.ts`): `dns-server-missing-server` error includes `h3` (`:1034-1046`) and `dns-server-domain-without-resolver` warning fires for any domain `server` lacking `domain_resolver` (`:1137-1146`). **Both pass-1 P0/P1 about missing server/resolver validation are STALE.**

## Findings (prioritized)
- **[P1]** Headers repeater can persist an empty key. `Inspector.tsx:4519` `onClick={() => writeHeaders({ ...headers, "": "" })}` inserts `{"": ""}`; the Name onChange blocks empty renames (`:4488 if (!newKey ...) return;`) but never prunes the blank entry, so an un-edited "Add header" click round-trips `"headers": {"": ""}` into exported JSON, which sing-box rejects. Prune empty keys on write (filter `key.trim()`).
- **[P2]** `server` input has no required affordance. `Inspector.tsx:4278-4286` renders a plain field; add a required marker/placeholder (and ideally surface the `dns-server-missing-server` diagnostic inline) so the requirement is visible before export, not only in the diagnostics panel.
- **[P2]** `path` input lacks the `/dns-query` default hint. `Inspector.tsx:4346` shows empty string when cleared; add `placeholder="/dns-query"` to match the `server_port` placeholder treatment.
- **[P2]** Canvas summary is generic. `graph.ts:543` subtitle is `"h3 dns server"`; it does not show `server`/`path`/TLS/detour state (shared by all dns-server types). Optional polish.
- **[P2]** `sbc-node-primary` badge shows `1` via `data.compatible.length || 1` (`SbcNode.tsx:436`) for a leaf node with no compatible quick-adds. Cosmetic, not h3-specific.

SUMMARY: 0 P0, 1 P1, 4 P2.
