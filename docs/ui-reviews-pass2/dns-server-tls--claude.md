# dns-server-tls — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

> Upstream authority: `docs/upstream/sing-box/testing/configuration/dns/server/tls.md` (the NEW dialer-based DoT server, since 1.12.0; `material/new-box`). Official writable fields: `server` (**Required**), `server_port` (default `853`), `tls` (shared **outbound** TLS, anchor `/configuration/shared/tls/#outbound`), + Dial Fields (`shared/dial.md`). Per the "Difference from legacy" note, this type uses `domain_resolver`/`domain_strategy` from Dial Fields, NOT legacy `address_resolver`/`address_strategy`; with no `detour` it dials like an empty `direct` outbound.

## Verdict (2-3 sentences)
The node is in good shape and the pass-1 review (`docs/ui-reviews/dns-server-tls.md`) is now **substantially stale**: its two P0s (`domain_resolver` free-text, `server_port` default `0`) and one P1 (`certificate_provider` free-text) are all fixed, and a required-`server` error diagnostic plus a domain-without-`domain_resolver` warning now exist and cover `tls`. All official writable fields are exposed with correct control types and the relationship model (dns-final / dns-rule / dial `detour` / `domain_resolver` resolver) is complete and correct. Remaining issues are P2 polish: the canvas titlebar prints internal `kind/type`, `"server"/"server_port" in entity` gating can hide fields on imported configs, the shared TLS card leaks server-only fields onto this client-only node, and a few 1.14 outbound-TLS fields are absent.

## 1. Left Palette
- Entry present: `{ label: "TLS Server", kind: "dns-tls", icon: Shield, docsUrl: docs("dns/server/tls/"), status: "setup" }` — `src/components/Palette.tsx:88`. Category "DNS" correct.
- `status: "setup"` → `canActivate` allows it (`Palette.tsx:280-287`); click ADDs a draft via `createFromPalette` → `createDnsServer`. The `setup` (vs `ready`) action label is defensible since the node needs a server address; it is consistent with the tcp/udp/quic siblings (`Palette.tsx:86-89`). Note the `https` sibling uses `ready:true` for the same field shape — minor inconsistency, not a defect.
- Kind→type map `"dns-tls": "tls"` — `src/domain/protocols.ts:96`; in `CREATABLE_DNS_SERVER_TYPES` (`protocols.ts:112`); preferred tag `tls-dns` (`protocols.ts:196`). Correct.
- Docs URL `dns/server/tls/` correct. **P2 cosmetic**: label "TLS Server" (vs "DoT Server / DNS over TLS") and the `Shield` icon is shared with several inbound/outbound TLS protocols; pre-existing, not node-specific.

## 2. Canvas Node
- Node kind `dns-server`; `data.title` = tag, `data.subtitle` = `` `${server.type} dns server` `` → "tls dns server" (`src/canvas/graph.ts:542-543`); status from `diagnosticStatus("/dns/servers/{i}", …)` (`graph.ts:544`).
- Ports derive from `portRelations` via `getPortSpecs`/`portEndpointsForNode` (`src/components/SbcNode.tsx:94-108`). For a `tls` server (verified by `tests/sbc-node-ports.test.ts:18`, the `https` peer with identical spec): inputs `dns` (DNS final) + `dns-rule`; output `outbound` (dial `detour`).
  - Input `dns` (DNS final) — relation `dns-final`, `portRelationRegistry.ts:98`. Correct.
  - Input `dns-rule` — relation `dns-rule`, `portRelationRegistry.ts:101`. Correct.
  - Output `outbound` (dial `detour`) — relation `dns-server-detour`, `portRelationRegistry.ts:105`; marked connected only when `server.detour` set (`SbcNode.tsx:246-247`). Correct for the dialer model.
  - `endpoint` (tailscale-only) and `service` (resolved-only) ports are type-gated and correctly DO NOT appear on `tls` (`portRelationRegistry.ts:107,114`). Correct.
- No `tls` sub-node/port — correct; `tls` is embedded card metadata, not a graph node. No `domain_resolver` port — acceptable (the resolver tag is picked in the dial card; the inverse dns-server reference port already covers dns-final/dns-rule).
- **[P2]** Titlebar prints `` `${data.kind} / ${data.type}` `` = "dns-server / tls", exposing internal identifiers (`src/components/SbcNode.tsx:291`). Affects every node type, not just this one.
- **[P2]** Subtitle is only "tls dns server"; omits `server:server_port`, so two DoT nodes (e.g. `1.1.1.1` vs `8.8.8.8`, both `type:tls`) are indistinguishable at a glance (`graph.ts:543`). Compare outbound nodes which show `${type} ${server}:${server_port}` (`graph.ts:401-402` region).

## 3. Upstream/Downstream Links
Relationship model is complete and correct; no missing/extra/wrong links for `tls`.
- Referenced by `dns.final`: relation `dns-final` (`portRelationRegistry.ts:98`); `replaceDnsServerRefs`/`removeDnsServerRefs` handle `/dns/final` (`referenceRegistry.ts:226,241`) and `/dns/rules/*/server` (`227,242`). Registry path set at `referenceRegistry.ts:339-340`. OK.
- Referenced by DNS rule `server`: relation `dns-rule` (`portRelationRegistry.ts:101`); canvas edge built at `graph.ts:607`; connected-state at `SbcNode.tsx:147-148`. OK.
- Referenced as a resolver via Dial `domain_resolver` / `route.default_domain_resolver`: registry path `*/domain_resolver` + `/route/default_domain_resolver` (`referenceRegistry.ts:340`); resolver-aware replace/remove (`228-237,243-252`). OK — covers this server being chosen as another entity's resolver.
- This server's own dial `detour` → outbound: relation `dns-server-detour` (`portRelationRegistry.ts:105`); outbound refs handle `/dns/servers/*/detour` (`referenceRegistry.ts:165,186,334`); canvas edge `graph.ts:551-552`. OK.
- The tailscale-only `endpoint` and resolved-only `service` relations correctly exclude `tls`.

## 4. Right Inspector (fields)
Rendered in the `ref.kind === "dns-server"` block (`Inspector.tsx:4215-4549`) plus shared cards via `SharedFieldCards` (`Inspector.tsx:1695-1745`). `tls ∈ dnsServerDialTypes` and `dnsServerTlsTypes` (`sharedFieldRegistry.ts:156-157`), so `sharedGroupsForEntity` returns `["dial","tls"]` (`sharedFieldRegistry.ts:187-191`) → both ModuleCards render.

| Official field | Required | Default | UI control | State |
|---|---|---|---|---|
| `tag` | — | — | text rename (`Inspector.tsx:1814` region, `renameTag`) | OK |
| `type` | — | — | type select over `CREATABLE_DNS_SERVER_TYPES` | OK |
| `server` | **Yes** | — | text input, gated `"server" in entity` (`Inspector.tsx:4278-4285`); seeded `1.1.1.1` by factory (`commands.ts:621-627`) | OK value path; **required ERROR diagnostic exists** `dns-server-missing-server` covering `tls` (`diagnostics.ts:1034-1045`). **P2**: no inline visual `*`/required marker; field hidden on import if key absent (see findings). |
| `server_port` | No | `853` | number input; `portDefaultByType.tls=853` shown as value+placeholder (`Inspector.tsx:4287-4315`) | OK — **pass-1 "shows 0" is fixed** |
| `tls` (outbound) | No | — | shared TLS ModuleCard (`Inspector.tsx:1502-1547`): enabled / server_name / disable_sni / insecure / alpn / min+max_version (selects `1.0–1.3`) / cipher_suites / curve_preferences / certificate(+path) / cert_public_key_sha256 / certificate_provider (**select** of provider tags) / fragment(+fallback) / record_fragment / utls(+fingerprint, gated) / reality(+ech, gated) | OK shape & nested handling; list fields use `toList/fromList` not raw JSON (`Inspector.tsx:1683-1692`, `coerceSharedFieldValue:1627-1632`) → no invalid-JSON write. **P2 over-exposure + missing fields** below. |
| Dial Fields | No | — | shared Dial ModuleCard (`Inspector.tsx:1476-1499`): `detour` (select outbounds), `domain_resolver` (**select** of dns-server tags, `:1493`), bind_interface, inet4/6_bind, bind_address_no_port, routing_mark, reuse_addr, netns, connect_timeout, tcp_* , udp_fragment, network_strategy/type, fallback_*, domain_strategy(deprecated) | OK — **pass-1 "domain_resolver free-text" is fixed**; domain-without-resolver WARNING covers `tls` (`diagnostics.ts:1137-1145`) |

Sensitive-masking: DoT `tls` has no secret scalar (server_name/cert paths/PEM are not masked anywhere, consistent across all TLS owners) — acceptable. `AdvancedScalarFields`/`AdvancedNonScalarFields` (`Inspector.tsx:4547-4548`, keyed off `dnsServerHandledFields` `:241-260`) surface any stray imported key so nothing is silently dropped.

## Findings (prioritized)
- **[P2]** Shared TLS card renders **server-only** fields on this client-only DoT node: `Key`/`Key Path` (`Inspector.tsx:1521-1522`), `Client Authentication` (`:1524`), `Certificate Provider` (`:1525-1530`, upstream marks `certificate_provider` ==Server only==), and Reality handshake `server`/`server_port`/`private_key`/`max_time_difference` (`:1543-1546`). For a `tls` DNS server `tls` is the **outbound** profile (upstream anchor `#outbound`), so these are not valid here. Shared-card over-exposure affecting all client TLS owners; consider an outbound/client field subset. `src/components/Inspector.tsx:1502-1547`.
- **[P2]** Shared TLS card is **missing several 1.14 outbound-TLS fields** present in the upstream `### Outbound` block: `engine` (1.14, client), `spoof`/`spoof_method` (1.14, client), `handshake_timeout` (1.14, default `15s`), `kernel_tx`/`kernel_rx` (1.13), and the 1.13 outbound client-cert set `client_certificate`/`client_certificate_path`/`client_key`/`client_key_path`. None are exposed in the `tls` group; they fall through only to raw Advanced editors if already present. `src/components/Inspector.tsx:1509-1547` vs `docs/upstream/sing-box/testing/configuration/shared/tls.md:111-158`.
- **[P2]** `server` (and `server_port`) inputs are gated by `"key" in entity` (`Inspector.tsx:4278,4287`) while also being in `dnsServerHandledFields` (`Inspector.tsx:245-246`). An imported `tls` server that omits `server` (invalid, but importable) shows neither the first-class input nor an Advanced fallback — uneditable except via raw JSON, and the only signal is the diagnostic. New nodes are fine (factory seeds both). Prefer gating on `entityType` membership in the server-required set rather than key-presence. `src/components/Inspector.tsx:4278,4287`.
- **[P2]** `server` field has no inline required marker (`*`/`aria-required`) despite upstream ==Required==; correctness is covered by the error diagnostic but discoverability is weak. `src/components/Inspector.tsx:4278-4285`. (Pass-1 raised this as P1; downgrade since the diagnostic now exists.)
- **[P2]** Canvas titlebar exposes internal `kind/type` ("dns-server / tls"); use a human label. `src/components/SbcNode.tsx:291`. Global, not node-specific.

### Where pass-1 is now stale
- Pass-1 **P0** "`domain_resolver` free-text" — **fixed**: now `kind:"select"` over dns-server tags (`Inspector.tsx:1493`).
- Pass-1 **P0** "`server_port` shows `0`" — **fixed**: defaults to `853` via `portDefaultByType` value+placeholder (`Inspector.tsx:4287-4315`).
- Pass-1 **P1** "`tls.certificate_provider` free-text" — **fixed**: now `kind:"select"` over `certificate_providers` tags (`Inspector.tsx:1525-1530`). (Note: upstream marks it ==Server only==, so it should ideally be hidden on this client node — see P2 over-exposure.)
- Pass-1 **P1** "`server` required, no indicator/diagnostic" — **partially stale**: required ERROR diagnostic `dns-server-missing-server` now covers `tls` (`diagnostics.ts:1034-1045`); only the inline visual marker remains (downgraded to P2).
- Pass-1 line refs (TLS fields "~894-905", dial "~881-892", server render "~1559-1604") are all **stale**; current locations are TLS `Inspector.tsx:1502-1547`, dial `1476-1499`, dns-server render `4215-4549`.
- Pass-1 (`docs/ui-reviews/dns-server-tls.md`) review-doc concern "domain-name server triggers a resolver diagnostic" — **handled**: `dns-server-domain-without-resolver` (`diagnostics.ts:1137-1145`).

SUMMARY: 0 P0, 0 P1, 5 P2.
