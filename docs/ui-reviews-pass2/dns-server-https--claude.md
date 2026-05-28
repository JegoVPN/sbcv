# dns-server-https — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

> Upstream authority: `docs/upstream/sing-box/testing/configuration/dns/server/https.md` (the NEW dialer-based DoH server, since 1.12.0; `material/new-box`). Official writable fields: `server` (**Required**), `server_port` (default `443`), `path` (default `/dns-query`, plain string), `headers` (map[string]string), `tls` (shared **outbound** TLS), + Dial Fields (`shared/dial.md`). The new server uses `domain_resolver`/`domain_strategy` from Dial Fields, NOT legacy `address_resolver`.

## Verdict (2-3 sentences)
This node is in good shape and the pass-1 review (`docs/ui-reviews/dns-server-https.md`) is now **substantially stale** — every pass-1 P0/P1 has been fixed: the spurious `address` template field is gone, `headers` has a structured key/value editor, the type carries `headers`, and both the required-`server` and domain-without-`domain_resolver` diagnostics now exist and cover `https`. All six official fields are exposed with the correct control types and the relationship model (dns-final / dns-rule inbound link / dial `detour` / `domain_resolver`) is complete and correct. Remaining issues are all P2 UX polish: a thin canvas subtitle, `"key" in entity` field-visibility gating that can hide `server`/`port`/`path` for imported configs, and the shared TLS card leaking server-only fields onto this client-only node.

## 1. Left Palette
- Entry present: `{ label: "HTTPS Server", kind: "dns-https", icon: Globe2, docsUrl: docs("dns/server/https/"), ready: true }` — `src/components/Palette.tsx:90`. Category "DNS" is correct.
- `ready: true` → status resolves to `add` (`Palette.tsx:263`); default action ADDs via `createFromPalette` → `createDnsServer`. Correct for a node whose initial state is implemented.
- Kind→type mapping `"dns-https": "https"` — `src/domain/protocols.ts:98`; preferred tag `remote-doh` — `protocols.ts:198`. Correct.
- Docs URL points to `dns/server/https/`. Correct.
- P2 cosmetic: `Globe2` icon is shared with Local/HTTP3/mDNS servers and the DNS Hub — no visual differentiation between DNS server types. Pre-existing, not node-specific.

## 2. Canvas Node
- Node kind `dns-server`; title = tag, subtitle = `` `${server.type} dns server` `` → "https dns server" — `src/canvas/graph.ts:542-543`.
- Ports derive from `portRelations` via `getPortSpecs`/`portEndpointsForNode` (`src/components/SbcNode.tsx:94-108`). For a plain `https` server:
  - Input `dns` (DNS final) — relation `dns-final`, `portRelationRegistry.ts:98`. Correct.
  - Input `dns-rule` (DNS rule target) — relation `dns-rule`, `portRelationRegistry.ts:101`. Correct.
  - Output `outbound` (dial `detour`) — relation `dns-server-detour`, `portRelationRegistry.ts:105`; only marked connected when `detour` set (`SbcNode.tsx:246-247`). Correct.
  - `endpoint` / `service` output ports are type-gated to `tailscale` / `resolved` and correctly DO NOT appear for `https` (`portRelationRegistry.ts:107,114`). Correct.
- No `domain_resolver` is shown as a port — correct, since the chosen DNS server tag is edited in the dial card, not a graph edge (the inverse `dns-server` reference port already covers dns-final / dns-rule).
- P2: subtitle omits `server:server_port` and `path`; two DoH nodes (e.g. Cloudflare vs Google, both `type:https`) are indistinguishable at a glance — `graph.ts:543`. Compare outbound nodes which show `${type} ${server}:${server_port}` (`graph.ts:401-402`).

## 3. Upstream/Downstream Links
Relationship model is complete and correct.
- Referenced by `dns.final`: relation `dns-final` (`portRelationRegistry.ts:98`); `replaceDnsServerRefs`/`removeDnsServerRefs` handle `/dns/final` (`referenceRegistry.ts:226,241`). OK.
- Referenced by DNS rule `server`: relation `dns-rule` (`portRelationRegistry.ts:101`); refs handled at `/dns/rules/*/server` (`referenceRegistry.ts:227,242`). OK.
- Referenced as a resolver by Dial `domain_resolver` and `route.default_domain_resolver`: referenceRegistry path `*/domain_resolver` + `/route/default_domain_resolver` (`referenceRegistry.ts:340`, replace/remove `228-237,243-252`). OK — covers this server being chosen as another entity's resolver.
- This server's own dial `detour` → outbound: relation `dns-server-detour` (`portRelationRegistry.ts:105`); outbound refs handle `/dns/servers/*/detour` (`referenceRegistry.ts:165,186,334`). OK.
- No missing/extra/wrong links for `https`. The tailscale-only `endpoint` and resolved-only `service` relations correctly exclude this type.

## 4. Right Inspector (fields)
Rendered in the `ref.kind === "dns-server"` block (`Inspector.tsx:4215-4549`) plus shared cards (`SharedFieldCards`, `Inspector.tsx:1695-1745,5343`). `https ∈ dnsServerDialTypes` and `dnsServerTlsTypes` (`sharedFieldRegistry.ts:156-157`) → Dial + TLS cards render.

| Official field | Required | Default | UI control | State |
|---|---|---|---|---|
| `tag` | — | — | text rename (`Inspector.tsx:1814`, renameTag) | OK |
| `type` | — | — | select of `CREATABLE_DNS_SERVER_TYPES` | OK |
| `server` | **Yes** | — | text input, gated `"server" in entity` (`Inspector.tsx:4278`) | OK; seeded by template (`commands.ts:633`); required diag at `diagnostics.ts:1034-1046`. **P2**: hidden on import if key absent (see findings). |
| `server_port` | No | `443` | number input, default `443` shown (`Inspector.tsx:4287-4315`, `portDefaultByType.https=443`) | OK |
| `path` | No | `/dns-query` | text input, string-only coercion `typeof entity.path === "string"` (`Inspector.tsx:4342-4350`) | OK; correctly NOT array for https. **P2**: no `/dns-query` placeholder; gated `"path" in entity`. |
| `headers` | No | — | key/value repeater `dns-https-headers` (`Inspector.tsx:4468-4526`); in `dnsServerHandledFields` (`Inspector.tsx:257`); typed `headers?: Record<string,string>` (`types.ts:46`) | OK (pass-1 P0/P1 fixed) |
| `tls` (outbound) | No | — | shared TLS ModuleCard: enabled/server_name/insecure/alpn/min+max_version/cert fields (`Inspector.tsx:1502-1546`) | OK shape; **P2** over-exposes server-only fields. |
| Dial Fields | No | — | shared Dial ModuleCard: `detour` (select outbounds), `domain_resolver` (select dns servers), bind/timeout/network_* etc. (`Inspector.tsx:1476-1499`) | OK; `domain_resolver` requiredness for domain `server` warned at `diagnostics.ts:1137-1145`. |

No invalid-JSON writes for the core fields (headers uses a typed object writer, not raw JSON). `AdvancedNonScalarFields` (`Inspector.tsx:4548`) surfaces any stray imported object so nothing is silently dropped. No sensitive-masking applies (DoH has no secret fields; `headers` values are plain).

## Findings (prioritized)
- **[P2]** Canvas subtitle is only `"https dns server"`; add `server:server_port` (+ optional `path`) so multiple DoH nodes are distinguishable. `src/canvas/graph.ts:543`.
- **[P2]** `server`, `server_port`, `path` inputs are gated by `"key" in entity` (`Inspector.tsx:4278,4287,4316`) AND these keys are in `dnsServerHandledFields` (`Inspector.tsx:245-247`), so an imported `https` server that omits any of them (e.g. relying on default `path`/`server_port`) will show neither a first-class input nor an Advanced fallback — the field is uneditable without raw JSON. New nodes are fine (template seeds all three). Prefer gating these on `entityType === "https"/"h3"/...` instead of key-presence.
- **[P2]** Path field lacks a `/dns-query` placeholder, unlike the Port field which renders its default — minor inconsistency. `src/components/Inspector.tsx:4343-4350`.
- **[P2]** Shared TLS card renders server-only fields (Key, Key Path, Client Authentication, Reality handshake `server`/`server_port`/`private_key`) on this client-only DoH node. `src/components/Inspector.tsx:1521-1546`. Shared-card over-exposure (affects all client TLS owners), not specific to https; consider an outbound/client TLS field subset.

### Where pass-1 is now stale
- Pass-1 P0 "spurious `address` in https template" — **fixed**: `createDnsServer` https branch has no `address` (`commands.ts:629-637`).
- Pass-1 P0 "`headers` invisible / no editor" — **fixed**: structured repeater at `Inspector.tsx:4468-4526`, in `dnsServerHandledFields` (`:257`).
- Pass-1 P1 "`DnsServerConfig` missing `headers`" — **fixed**: `types.ts:46`.
- Pass-1 P1 "no required-`server` diagnostic" — **fixed**: `diagnostics.ts:1034-1046` (covers https).
- Pass-1 review-doc "domain-name server needs resolver" concern — **handled**: `diagnostics.ts:1137-1145` (`dns-server-domain-without-resolver`).

SUMMARY: 0 P0, 0 P1, 4 P2.
