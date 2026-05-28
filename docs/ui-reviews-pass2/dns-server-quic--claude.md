# dns-server-quic — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

Single source of truth: `docs/upstream/sing-box/testing/configuration/dns/server/quic.md` (DoQ, since 1.12.0). The ENTIRE official field set is: `server` (==Required==), `server_port` (default `853`), `tls` (shared outbound TLS, `shared/tls.md#outbound`), plus all Dial Fields (`shared/dial.md`), plus the implicit `tag` + `type` ("quic"). There is NO `path`, NO `headers`, NO `endpoint`/`service` for quic. Upstream notes: (a) "If domain name is used, `domain_resolver` must also be set"; (b) the new server uses the dialer (empty `direct` by default) instead of the legacy `detour`-default; (c) `domain_resolver`/`domain_strategy` replace legacy `address_resolver`/`address_strategy`. From `shared/tls.md`: "Only ECH is supported in QUIC" — so `utls`/`reality`/`fragment`/`record_fragment`/`kernel_tx/rx`/`spoof` do NOT apply to a DoQ TLS block.

## Verdict (2-3 sentences)
The quic node is in solid shape and every official writable field is reachable: `server`/`server_port` are typed inputs with a quic-correct `853` default, and `tls` + Dial render as shared cards (quic is in both `dnsServerTlsTypes` and `dnsServerDialTypes`). Diagnostics now enforce required-`server` and domain-without-`domain_resolver` for quic, and `domain_resolver`/`detour` are tag selects — so all four pass-1 P0s (`server_port` defaulting to 0, free-text `domain_resolver`, 12 dial fields falling through, missing resolver diagnostic) are STALE/fixed. Remaining issues are minor: no required marker on `server`, the TLS card exposes QUIC-incompatible fields (utls/reality/fragment) with no DoQ note, the `domain_resolver` select can pick the server's own tag, and the canvas summary is generic.

## 1. Left Palette
`src/components/Palette.tsx:89` — `{ label: "QUIC Server", kind: "dns-quic", icon: Plug, docsUrl: docs("dns/server/quic/"), status: "setup" }`.
- Present, DNS group. Kind `dns-quic` maps to type `"quic"` (`protocols.ts:97`), is creatable (`protocols.ts:113`), preferred tag `quic-dns` (`protocols.ts:197`). Label, category, and `docsUrl` are correct.
- `status: "setup"` is correct (adds an incomplete draft via Setup action; not a singleton/deprecated kind). Consistent with peers `dns-tls`/`dns-https`/`dns-h3`.
- Icon `Plug` is acceptable; `Shield` (used for `dns-tls`) would better signal the mandatory-TLS transport (P2, cosmetic). Pass-1 raised the same icon nit — still open but trivial.

## 2. Canvas Node
`src/canvas/graph.ts:531-572`, `src/components/SbcNode.tsx:291,408-437`.
- Title bar `dns-server / quic` (`SbcNode.tsx:291`); card title = tag, subtitle = `quic dns server` (`graph.ts:542-543`); type pill = `quic` (`SbcNode.tsx:408-411`). Status from `diagnosticStatus("/dns/servers/{i}")` (`graph.ts:544`).
- Ports via `portEndpointsForNode("dns-server","quic",dir)`: inputs `dns` (rel `dns-final`, `portRelationRegistry.ts:98`) and `dns-rule` (rel `dns-rule`, line 101); output `outbound` (rel `dns-server-detour`, line 105). The `endpoint` (line 107) and `service` (line 114) outputs are nodeType-gated to `tailscale`/`resolved`, so quic correctly does NOT show them. **Correct and complete for quic.**
- `compatible: []` (`graph.ts:545`) → no `+` quick-add (correct, a DNS server is a leaf), but `sbc-node-primary` still prints `data.compatible.length || 1` = `1` (`SbcNode.tsx:436`). Cosmetic, not quic-specific (P2).
- Subtitle does not surface `server:853` / TLS state / detour state (pass-1 recommendation). Limitation shared by all dns-server types (P2).
- No canvas edge for `domain_resolver` (dns-server -> dns-server): there is no `PortRelation` for it, so no handle and no edge even when set. Pass-1 flagged this; still open (P2 below).

## 3. Upstream/Downstream Links
Official model: a DoQ server is referenced by `dns.final`, by `dns.rules[].server` (route/evaluate actions per `dns/rule_action.md:37,110`), and by any Dial `domain_resolver` / `route.default_domain_resolver`; it owns one downstream link `dns.servers[].detour` -> outbound. TLS is inline (no separate node). quic has no endpoint/service link.
- `portRelationRegistry.ts`: `dns-final` (98), `dns-rule` (101), `dns-server-detour` (105) present; tailscale `endpoint`/resolved `service` correctly nodeType-gated off quic.
- `referenceRegistry.ts` dns-server entry (339-343) covers `/dns/final`, `/dns/rules/*/server`, `/route/default_domain_resolver`, `*/domain_resolver`; rename/delete fan-out (`replaceDnsServerRefs`/`removeDnsServerRefs`, lines 225-253) is complete and includes `domain_resolver` on all dial owners. Outbound `detour` rename/remove on dns servers handled at `referenceRegistry.ts:165,186`.
- `graph.ts:551-553` emits the detour edge; `dns-final` edge at `graph.ts:619`, `dns-rule` edge at `graph.ts:606-608` (gated to action `""`/`route`/`evaluate`, matching upstream). **No wrong or extra links for quic.** The one MISSING visualization is the `domain_resolver` edge (tracked by referenceRegistry for renames but never drawn) — P2.

## 4. Right Inspector (fields)
dns-server block `src/components/Inspector.tsx:4215-4549`; shared field defs `:1420-1548`; gating `sharedFieldRegistry.ts:156-191`.

| Official field | UI state |
|---|---|
| `type` ("quic") | Select over `CREATABLE_DNS_SERVER_TYPES` (`:2128-2135`); `changeEntityType` recreates via `createDnsServer` preserving tag. Correct. |
| `tag` | Text + `renameTag` on blur (`:2094-2107`). Correct. |
| `server` (==Required==) | Text input, gated `"server" in entity` (`:4278-4286`). Value round-trips, but **no required marker / placeholder**; emptiness caught only by the diagnostics panel (see P2). |
| `server_port` (def `853`) | Number input gated `"server_port" in entity`; `portDefaultByType.quic = 853` (`:4293`), shows 853 + `placeholder="853"`, clamps `>0` else writes `undefined` (never `0`) (`:4287-4315`). Correct — **pass-1 P0 "fallback 0 / wrong default" is STALE.** Draft seeds 853 (`commands.ts:621-627`). |
| `tls` (shared outbound) | TLS card; `dnsServerTlsTypes` includes `quic` (`sharedFieldRegistry.ts:157`) → `sharedGroupsForEntity` returns `["dial","tls"]` (`:187-189`). Full outbound TLS set incl. `enabled`/`server_name`/`disable_sni`/`insecure`/`alpn`/`min`-`max`/`cipher_suites`/`curve_preferences`/`certificate(+_path)`/`certificate_public_key_sha256`/`client_authentication`/`certificate_provider`/`ech.*`/`utls.*`/`reality.*` (`Inspector.tsx:1502-1547`). **pass-1 "disable_sni missing" is STALE.** Caveat: utls/reality/fragment/record_fragment are shown but are NOT valid in QUIC TLS ("Only ECH is supported in QUIC") — no DoQ note (P2). `tls` is in `dnsServerHandledFields` (`:251`) so it never leaks to Advanced. |
| Dial Fields (full set) | Dial card; quic in `dnsServerDialTypes` (`sharedFieldRegistry.ts:156`). `:1476-1500` renders all 21 dial fields with correct kinds: `detour` & `domain_resolver` = selects (`:1478,1493`), booleans (`bind_address_no_port`/`reuse_addr`/`tcp_fast_open`/`tcp_multi_path`/`disable_tcp_keep_alive`/`udp_fragment`) = `boolean`, durations/`routing_mark` = `text`, `network_type`/`fallback_network_type` = `list`. **pass-1 P0/P1 "domain_resolver is free text" and "12 dial fields fall to AdvancedScalarFields as text" are BOTH STALE** — `dialSharedFields` (`:116-138`) and the dial defs now cover them all. |

No invalid-JSON write path for quic: every official field is structured (numbers, selects, booleans, lists); the catch-all `AdvancedScalarFields`/`AdvancedNonScalarFields` (`:4547-4548`) only catch fields outside `dnsServerHandledFields`, and quic has no extra official scalar/object fields beyond what is handled. No UI field renders for quic that is absent from the official model — `address`/`path`/`headers`/`prefer_go`/`predefined`/`interface`/`service`/`inet*_range`/`accept_default_resolvers`/tailscale-endpoint branches are all type-gated to other dns-server types and never appear for quic.

Diagnostics (`src/domain/diagnostics.ts`): `dns-server-missing-server` ERROR includes `quic` (`:1034-1046`); `dns-server-domain-without-resolver` WARNING fires for any domain `server` lacking `domain_resolver` (`:1137-1146`), directly satisfying quic.md's "domain_resolver must be set"; `dial-domain-strategy-deprecated` WARNING fires on dns servers using `domain_strategy` (`:1515-1525`). **pass-1 P0 "no missing-domain-resolver diagnostic" and P0 "no required-server enforcement" are STALE/fixed.**

## Findings (prioritized)
- **[P2]** `server` has no required affordance. `Inspector.tsx:4278-4286` is a plain field with no marker/placeholder; the `dns-server-missing-server` error (`diagnostics.ts:1041`) only surfaces in the panel. Add a required marker/placeholder and ideally inline the diagnostic so the requirement is visible before export.
- **[P2]** TLS card exposes QUIC-incompatible fields with no DoQ note. `Inspector.tsx:1531-1546` renders `fragment`/`record_fragment`/`utls.*`/`reality.*` for quic, but `shared/tls.md` states "Only ECH is supported in QUIC". Add a quic-scoped note (or hide those rows when the parent dns-server `type === "quic"`) so users do not set fields sing-box ignores.
- **[P2]** `domain_resolver` select can choose the server's own tag. `Inspector.tsx:1453-1455` builds `dnsServerOptions` from all server tags without excluding `ref.tag`, allowing a self-referential resolver. Filter out the current entity's tag (same as `listen` group does for inbounds at `:1432-1434`).
- **[P2]** No canvas edge for `domain_resolver`. `portRelationRegistry.ts` has no dns-server -> dns-server relation, so `graph.ts:531-572` draws no resolver edge even though `referenceRegistry.ts:340` tracks `*/domain_resolver`. The dependency is invisible on canvas (mitigated by the missing-resolver diagnostic). Shared by all dns-server types.
- **[P2]** Canvas subtitle is generic (`graph.ts:543` `"quic dns server"`) and the leaf `sbc-node-primary` badge shows `1` (`SbcNode.tsx:436`). Cosmetic, shared by all dns-server types.

SUMMARY: 0 P0, 0 P1, 5 P2.
