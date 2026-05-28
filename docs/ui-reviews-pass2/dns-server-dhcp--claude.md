# dns-server-dhcp — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The `dhcp` DNS server node is now in solid shape across all four surfaces and the pass-1 reviews are almost entirely STALE: the `interface` field has a first-class Inspector control, an empty-interface diagnostic exists (with unit tests), and all 21 Dial Fields render as labeled controls. The upstream model is tiny (`type`, `tag`, `interface`, + Dial Fields) and every official writable field is exposed with a correct control type; TLS/server/path/headers are correctly type-gated away. Only minor polish remains: a dead `dhcp: 53` server-port default, `domain_resolver` cannot write its object form, and the canvas title leaks the internal `kind / type` string.

## 1. Left Palette

- Present: `{ label: "DHCP Server", kind: "dns-dhcp", icon: Network, docsUrl: docs("dns/server/dhcp/"), status: "setup" }` — `Palette.tsx:92`.
- Category "DNS" — correct (it is a `dns.servers[]` entry). Label "DHCP Server" matches the upstream type. Docs URL `dns/server/dhcp/` is correct.
- Default action: `status:"setup"` is actionable (`canActivate` returns true for `setup`, `Palette.tsx:279-287`); clicking adds the node via `createFromPalette("dns-dhcp")` (`Palette.tsx:474`). Kind→type maps `dns-dhcp → dhcp` (`protocols.ts:100`); `dhcp` is in `CREATABLE_DNS_SERVER_TYPES` (`protocols.ts:116`).
- Gating: no platform/version gate. DHCP exists since sing-box 1.12.0, so it is valid on both `stable` and `testing` channels — leaving it ungated is correct (unlike `mdns`, which is `gated`). OK.

## 2. Canvas Node

- Title bar renders `dns-server / dhcp` (`SbcNode.tsx:291`); bottom type pill renders `dhcp` (`SbcNode.tsx:410`). Node title = tag, subtitle = `"dhcp dns server"` (`graph.ts:542-543`). Status from `diagnosticStatus("/dns/servers/<i>")` (`graph.ts:544`). No node-level badge — fine (no deprecation).
- Ports (from `portRelationRegistry` via `getPortSpecs`):
  - Input `dns` "DNS final server" — connected when `config.dns.final === tag` (`SbcNode.tsx:150`). Relation `dns-final` (`portRelationRegistry.ts:98`). Correct.
  - Input `dns-rule` "DNS rule" — connected when any rule's `server === tag` (`SbcNode.tsx:147-149`). Relation `dns-rule` (`portRelationRegistry.ts:101`). Correct.
  - Output `outbound` "Detour outbound" — connected when `server.detour` set (`SbcNode.tsx:246-248`). Relation `dns-server-detour` (`portRelationRegistry.ts:105`); edge drawn in `graph.ts:551-553`. Correct.
- Correctly ABSENT for dhcp: `endpoint` port (tailscale-only, `nodeType:"tailscale"`, `portRelationRegistry.ts:107`) and `service` port (resolved-only, `:114`). dhcp has no remote `server`/TLS/path ports. Port semantics are correct.
- No port for `domain_resolver` even though it is a real cross-reference (see §3) — acceptable design choice; pass-1 (ui-reviews) wrongly listed "domain resolver fields" as a left-port reference. STALE.

## 3. Upstream/Downstream Links

Official relationship model for a `dhcp` server: (a) referenced by `dns.final`; (b) referenced by DNS rules `action:route → server`; (c) referenceable by `domain_resolver` (any dial owner) and `route.default_domain_resolver`; (d) its own Dial `detour` → outbound tag.

- `dns.final` ⇒ `dns-final` relation + tag rename/remove in `referenceRegistry.ts:226,241`. Present/correct.
- DNS rule `server` ⇒ `dns-rule` relation + rename/remove `referenceRegistry.ts:227,242`. Present/correct.
- `domain_resolver` / `route.default_domain_resolver` ⇒ dhcp is a valid `dialOwners` target; rename/remove handled `referenceRegistry.ts:228,236,243,251`. Present/correct (registry-level reference, intentionally no canvas port).
- Dial `detour` → outbound ⇒ `dns-server-detour` relation + rename/remove `referenceRegistry.ts:165,186`. Present/correct.
- No extra/wrong links for dhcp. `dns-server-endpoint` and `dns-server-service` relations exist but are `nodeType`-scoped to tailscale/resolved, so they never attach to dhcp (`endpointMatchesNode`, `portRelationRegistry.ts:157-160`). Clean.

No missing/extra/wrong links found for dhcp.

## 4. Right Inspector (fields)

`entityType` resolves to `"dhcp"`; `sharedGroupsForEntity` returns `["dial"]` only (dhcp ∈ `dnsServerDialTypes` `sharedFieldRegistry.ts:156`; ∉ `dnsServerTlsTypes` `:157`; not `local`), so TLS/neighbor groups are correctly suppressed. `interface` ∈ `dnsServerHandledFields` (`Inspector.tsx:258`) so it does not leak to Advanced fields.

| Official field | Required | In Inspector? | Control | Notes |
|---|---|---|---|---|
| `type` | yes | yes | select | Type selector. Correct. |
| `tag` | yes | yes | text | Correct. |
| `interface` | no (default iface) | yes | text, placeholder `auto (system default)` | `Inspector.tsx:4458-4467`, gated `entityType==="dhcp"`. Round-trips; empty string cleared to `undefined`. Default template writes `"auto"` (`commands.ts:647-652`). |
| `detour` (dial) | no | yes | select(outbounds) | `Inspector.tsx:1478`. Correct. |
| `bind_interface` | no | yes | text | `:1479`. |
| `inet4_bind_address` | no | yes | text | `:1480`. |
| `inet6_bind_address` | no | yes | text | `:1481`. |
| `bind_address_no_port` | no | yes | boolean | `:1482`. |
| `routing_mark` | no | yes | text | `:1483`. Text allows `"0x1234"` + ints. OK. |
| `reuse_addr` | no | yes | boolean | `:1484`. |
| `netns` | no | yes | text | `:1485`. |
| `connect_timeout` | no | yes | text | `:1486`. |
| `tcp_fast_open` | no | yes | boolean | `:1487`. |
| `tcp_multi_path` | no | yes | boolean | `:1488`. |
| `disable_tcp_keep_alive` | no | yes | boolean | `:1489`. |
| `tcp_keep_alive` | no | yes | text | `:1490`. |
| `tcp_keep_alive_interval` | no | yes | text | `:1491`. |
| `udp_fragment` | no | yes | boolean | `:1492`. |
| `domain_resolver` | no | yes | select(dns tags) | `:1493`. String-tag only; cannot author the object form (P2). |
| `network_strategy` | no | yes | select | `:1494`. |
| `network_type` | no | yes | list | `:1495`. |
| `fallback_network_type` | no | yes | list | `:1496`. |
| `fallback_delay` | no | yes | text | `:1497`. |
| `domain_strategy` (deprecated) | no | yes | text | `:1498`, labeled "deprecated 1.12+". In handled set. OK (import + edit). |

No required-marker UI on `tag`/`type`, but that is shared across all nodes (not dhcp-specific). No sensitive/secret fields exist on dhcp, so masking is N/A. No invalid-JSON write paths found: `interface` and dial text fields coerce `""→undefined`; booleans/lists coerce correctly (`coerceSharedFieldValue`, `Inspector.tsx:1627-1632`). No UI-only fields absent from the official model.

## Findings (prioritized)

- [P2] Dead/misleading `dhcp: 53` entry in `portDefaultByType` — `Inspector.tsx:4292`. dhcp has no `server_port` field; the `"server_port" in entity` guard (`:4287`) means it never renders for a normal dhcp node, but the map entry implies a default port that does not exist in the upstream model. Remove `dhcp: 53` to avoid future confusion / accidental exposure.
- [P2] `domain_resolver` control is a string-only `select` — `Inspector.tsx:1493`. Upstream allows a string tag OR an object (route DNS rule action without `action`). Object form cannot be authored in-UI. Shared across all dial owners, low impact for dhcp (interface-derived address has no domain to resolve). Consider a "structured" escape hatch later.
- [P2] Canvas title bar exposes internal `dns-server / dhcp` — `SbcNode.tsx:291`. Cosmetic jargon leak; shared across all DNS server types. Consider showing the friendly "DHCP Server" label.

### Where pass-1 is now STALE
- pass-2 source docs/ui-reviews/dns-server-dhcp.md and docs/claude/dns-server-dhcp.md both predate the current code.
- STALE P0 "`interface` has no first-class control / falls to AdvancedScalarFields" — now rendered as a labeled front-panel input (`Inspector.tsx:4458`) and is in `dnsServerHandledFields` (`:258`).
- STALE P1 "no diagnostic for empty interface" — implemented as `dns-server-dhcp-interface-empty` (`diagnostics.ts:1226-1239`) with passing unit tests (`tests/domain.test.ts:2114-2161`).
- STALE P1 "`dialSharedFields` missing several dial fields" — all 21 dial fields (incl. `routing_mark`, `reuse_addr`, `netns`, `tcp_fast_open`, `tcp_multi_path`, keep-alive trio, `udp_fragment`, bind addresses, `bind_address_no_port`, `domain_strategy`) now have labeled controls (`Inspector.tsx:1476-1499`).
- STALE (ui-reviews) "DHCP must not show remote server/TLS/path/headers" — already satisfied: those controls are type-gated (`tailscale`/`hosts`/`https|h3`) and TLS group excluded for dhcp (`sharedFieldRegistry.ts:157`).
- Pass-1 line numbers (Inspector ~1548-1605, handled set ~142-153) no longer match the file.

SUMMARY: 0 P0, 0 P1, 3 P2.
