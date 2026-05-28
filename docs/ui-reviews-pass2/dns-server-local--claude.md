# dns-server-local — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
The `local` DNS server node is in good shape across all four surfaces: present in the palette, correct canvas ports/title, correct reference model, and all four official writable fields (`type`, `tag`, `prefer_go`, `neighbor_domain`) plus the full Dial group are exposed in the Inspector. Both P1 findings from pass-1 (`prefer_go` buried in Advanced; `neighbor_domain` lacking a version guard) are now **resolved** — `prefer_go` is a first-class toggle with version copy (`Inspector.tsx:4217`) and a testing-only diagnostic fires for `neighbor_domain` (`diagnostics.ts:1167`). Remaining issues are minor: no `.`-prefix validation on `neighbor_domain` entries (upstream-mandated), and a couple of cross-node gaps (empty-tag, type-switch field loss).

## 1. Left Palette
- Present: `{ label: "Local Server", kind: "dns-local", icon: Globe2, docsUrl: docs("dns/server/local/"), ready: true }` — `Palette.tsx:84`.
- Category: under "DNS" group — correct.
- Default action: `ready: true` with no `status` override → `itemStatus` returns `"add"` (`Palette.tsx:263`), so the button reads "Add … to canvas" and is actionable (`canActivate`, `Palette.tsx:280`). Correct; `local` needs no setup draft.
- Docs link points to the official local server doc. Correct.
- Kind→type map `"dns-local" → "local"` is correct (`protocols.ts:92`).
- Nit (P2): icon `Globe2` is shared with DNS Hub / HTTPS / HTTP3 / mDNS servers — not distinctive, but acceptable.

## 2. Canvas Node
- Titlebar shows `dns-server / local` (`SbcNode.tsx:291`); card title = tag, subtitle = `"local dns server"` (`graph.ts:542-543`). Correct and tag-first in the card body.
- No deprecated badge (correct — only `outbound/block` gets one, `SbcNode.tsx:279`).
- Ports are now data-driven from `portRelationRegistry` via `portEndpointsForNode` (`SbcNode.tsx:94`), NOT hardcoded. For `dns-server` type `local` the effective ports are:
  - Left/input `dns` ("DNS final server") — from relation `dns-final` (`portRelationRegistry.ts:98`). Correct: `/dns/final`.
  - Left/input `dns-rule` ("DNS rule") — from relation `dns-rule` (`portRelationRegistry.ts:101`). Correct: `/dns/rules/*/server`.
  - Right/output `outbound` ("Detour outbound") — from relation `dns-server-detour` (`portRelationRegistry.ts:105`). Correct: `/dns/servers/*/detour`.
  - `endpoint` port (relation `dns-server-endpoint`) is `nodeType: "tailscale"`-gated and `service` port (`dns-server-service`) is `resolved`-gated — correctly NOT shown for `local`.
- No TLS / server-address ports surface for `local`. Correct per semantics.
- Gap (P2): the `domain_resolver` dial-field reference (a `local` server can itself point at another DNS server via Dial `domain_resolver`) is tracked in `referenceRegistry` (`*/domain_resolver`, `referenceRegistry.ts:340`) and editable in the Inspector, but has NO canvas port/edge — it is invisible on the graph. This is a consistent product decision across all dial owners, not local-specific.

## 3. Upstream/Downstream Links
Official model: a DNS server is *referenced by* `dns.final`, `dns.rules[].server`, `route.default_domain_resolver`, and any Dial `domain_resolver`; it *references out* to an outbound via Dial `detour`.
- `referenceRegistry` `dns-server` entry paths = `["/dns/final", "/dns/rules/*/server", "/route/default_domain_resolver", "*/domain_resolver"]` (`referenceRegistry.ts:340`). Complete and correct — rename/delete propagation covers every inbound reference.
- Outbound detour: `dns-server-detour` relation writes `/dns/servers/*/detour` (`portRelationRegistry.ts:105`); `outbound` reference registry includes `/dns/servers/*/detour` (`referenceRegistry.ts:334`). Correct.
- No missing/extra/wrong links for `local`. The tailscale-`endpoint` and resolved-`service` relations are correctly type-gated away.

## 4. Right Inspector (fields)
Rendered for `dns-server`/`local`: prefer_go toggle (`Inspector.tsx:4217`), tag + type (shared header/select), Dial card + Neighbor card via `SharedFieldCards` (`Inspector.tsx:5343`, groups from `sharedFieldRegistry.ts:188,190`), then Advanced spillover. `neighbor_domain` and `prefer_go` are both in `dnsServerHandledFields` (`Inspector.tsx:252-253`) so neither leaks into raw Advanced scalars.

| Official field | Req | Type | UI state |
|---|---|---|---|
| `type` (=`local`) | yes | enum | Type `<select>` over `CREATABLE_DNS_SERVER_TYPES` (`local` first). Correct. |
| `tag` | yes | string | Tag input in shared header (`Inspector.tsx:1814`). Editable; no required marker / empty-tag error (see P1). |
| `prefer_go` (1.13.0) | no | bool | First-class toggle gated on `entityType==="local"`, copy "since sing-box 1.13.0; bypasses platform-native DNS" (`Inspector.tsx:4217-4227`). Writes `undefined` when false (clean omit). Correct — pass-1 P1 now stale. |
| `neighbor_domain` (1.14.0) | no | string[] | "Neighbor Domain" `kind:"list"` in Neighbor card, local-only (`sharedFieldRegistry.ts:1620`). Testing-only **diagnostic** fires (`diagnostics.ts:1167-1178`). Missing per-entry `.`-prefix validation (P1) and label has no "1.14/testing" suffix (P2). |
| Dial: `detour` | no | string (outbound) | `select` over outbound tags (`Inspector.tsx:1478`). Correct; resolves as a real ref + canvas edge. |
| Dial: `bind_interface` | no | string | text (`:1479`). OK. |
| Dial: `inet4_bind_address` / `inet6_bind_address` | no | string | text (`:1480-1481`). OK. |
| Dial: `bind_address_no_port` (1.13) | no | bool | toggle, labelled "(Linux, 1.13+)" (`:1482`). OK. |
| Dial: `routing_mark` | no | int/hex-string | text (`:1483`). OK (string passthrough). |
| Dial: `reuse_addr` | no | bool | toggle (`:1484`). OK. |
| Dial: `netns` (1.12) | no | string | text "(Linux, 1.12+)" (`:1485`). OK. |
| Dial: `connect_timeout` | no | duration | text (`:1486`). OK (no duration-format validation; cross-node). |
| Dial: `tcp_fast_open` | no | bool | toggle (`:1487`). OK. |
| Dial: `tcp_multi_path` | no | bool | toggle (`:1488`). OK. |
| Dial: `disable_tcp_keep_alive` (1.13) | no | bool | toggle (`:1489`). OK. |
| Dial: `tcp_keep_alive` (1.13) | no | duration | text (`:1490`). OK. |
| Dial: `tcp_keep_alive_interval` (1.13) | no | duration | text (`:1491`). OK. |
| Dial: `udp_fragment` | no | bool | toggle (`:1492`). OK. |
| Dial: `domain_resolver` | no | string OR obj | `select` over dns-server tags (`:1493`). Partial: upstream allows a string OR a route-rule-action object (server/strategy/etc.); UI only writes the string form. Acceptable for common case (P2, cross-node). |
| Dial: `network_strategy` (1.11) | no | enum | `select` (`:1494`). OK. |
| Dial: `network_type` (1.11) | no | string[] | list (`:1495`). OK. |
| Dial: `fallback_network_type` (1.11) | no | string[] | list (`:1496`). OK. |
| Dial: `fallback_delay` (1.11) | no | duration | text (`:1497`). OK. |
| Dial: `domain_strategy` (deprecated 1.12) | no | enum | text "(deprecated 1.12+)" (`:1498`) + deprecation diagnostic (`diagnostics.ts:1515-1525`). Correct — import/legacy only. |

No TLS card, no server-address/port/path fields render for `local` (those blocks are `"… in entity"`-guarded, `Inspector.tsx:4269-4546`) — correct. No UI field absent from the official model. No invalid-JSON write path observed (`prefer_go`/booleans omit on false; numbers coerce; lists trim/drop empties via `fromList`, `Inspector.tsx:93`). `local` carries no sensitive/secret fields, so masking is N/A.

## Findings (prioritized)
- [P1] `neighbor_domain` entries are not validated to start with `.` as upstream mandates ("Each entry must start with `.`"; e.g. `[".", ".lan"]`). The list editor (`fromList`, `Inspector.tsx:93`) only trims/dedupes; no diagnostic enforces the prefix (`diagnostics.ts:1167-1178` only flags testing-only). A user can write `neighbor_domain: ["lan"]`, which sing-box rejects. Add a `warning`/`error` diagnostic for entries missing a leading `.`.
- [P1] No empty/missing-`tag` diagnostic for dns-servers. `tag` is functionally required (it is the only way `dns.final`/`dns.rules[].server`/`domain_resolver` can reference this server), yet only `duplicate-tag` is checked (`diagnostics.ts:25-35`); an untagged `local` server passes validation silently. Cross-node, but it lands on `local` too. Add a "missing tag" error for all tagged DNS servers.
- [P2] `neighbor_domain` field label is plain "Neighbor Domain" (`sharedFieldRegistry.ts:1620`) with no inline "since 1.14.0 / testing" suffix; the only signal is the runtime diagnostic. Other dial fields carry inline version hints (e.g. "(1.13+)"). Add a label suffix for parity.
- [P2] `prefer_go` is not preserved across a type switch away-and-back to `local` (`changeEntityType` keeps only `detour`/`endpoint`, `commands.ts:921-933`). Minor data-loss on round-trip type churn; acceptable but worth a note.
- [P2] Dial `domain_resolver` only supports the string form in the UI (`Inspector.tsx:1493`); upstream also allows the structured route-rule-action object. Cross-node; advanced users lose the object form. Canvas also shows no port for the `local`→server `domain_resolver` edge (graph-only gap).
- [P2] Palette icon `Globe2` is non-distinctive (shared with several DNS server kinds) (`Palette.tsx:84`).

Where pass-1 is now stale: pass-1 (`docs/ui-reviews/dns-server-local.md` + `docs/claude/dns-server-local.md`) lists two P1s — `prefer_go` buried in AdvancedScalarFields, and `neighbor_domain` with no version guard. Both are FIXED: `prefer_go` is a first-class versioned toggle (`Inspector.tsx:4217`, in `dnsServerHandledFields` `:253`) and a testing-only diagnostic exists for `neighbor_domain` (`diagnostics.ts:1167`). The pass-1 `commands.ts` citations are off (createDnsServer is now `:597` not `585`; changeEntityType is `:921-933` not `901-913`), and its claim that ports are hardcoded at `SbcNode.tsx:88-93` is obsolete — ports are now registry-driven.

SUMMARY: 0 P0, 2 P1, 5 P2.
