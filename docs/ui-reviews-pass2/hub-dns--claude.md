# hub-dns — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
The DNS hub is in solid shape: it is a correctly-enforced singleton in the palette, the canvas node and port topology match the official relationship model (final -> dns-server, owns servers[] + rules[]), and the Inspector now exposes every official top-level scalar field with the right control types and a `final` select correctly sourced from `dns.servers[].tag`. Pass-1's headline "Inspector empty for all dns scalars" is now fully STALE — all eleven fields render (Inspector.tsx:1926-2084). Remaining gaps are quality-of-control issues: `optimistic` only supports the boolean form (not the `{enabled,timeout}` object), `cache_capacity`/`client_subnet` lack the doc-mandated helper/validation, and a leftover canvas hover delete button on the singleton is a dead no-op.

## 1. Left Palette
Entry present and correct: `{ label: "DNS Hub", kind: "dns-hub", icon: Globe2, docsUrl: docs("dns/"), ready: true }` (Palette.tsx:80). Category "DNS" is correct.
- Singleton handling is now correct (pass-1 P1 STALE): `singletonsPresent` adds `dns-hub` when `config.dns` exists (Palette.tsx:307), `itemStatus` returns `"open"` for present singletons (Palette.tsx:261), and the button label flips to "Open" with a focus-not-duplicate title (Palette.tsx:275). Clicking selects `dns:main` (Palette.tsx:455-456, 475).
- Creation is idempotent: `createFromPalette("dns-hub")` is `config.dns ? config : addDnsServer(config,"local")` (useProjectStore.ts:781) — a second click does not duplicate, and the hub is born with one `local` server (sensible default since `dns` with no servers is useless).
- Minor: label "DNS Hub" is fine; default action "Add"->"Open" is appropriate.

## 2. Canvas Node
Built in graph.ts:514-529. Title `"DNS"`, subtitle `` `${dnsRules.length} ordered rules` ``, status from `/dns` diagnostics, `compatible: ["DNS Server"]`. Titlebar text is `` `${data.kind} / ${data.type}` `` = "dns / dns" (SbcNode.tsx:291).
- Ports (via portEndpointsForNode, kind `dns`): input `inbound-query` (decorative, active when inbounds exist, SbcNode.tsx:141); outputs `dns-rule` (order-only, active when rules>0, SbcNode.tsx:233) and `dns-server` (writable `final`, active when `dns.final` set, SbcNode.tsx:234). The `dns-final` edge is drawn at graph.ts:618-620. This matches the doc: hub owns rules[] (order-only, not edge-driven) and references one final server.
- Titlebar/summary issues [P2]: the human title "DNS" is good, but the titlebar still prints the raw internal `dns / dns`, and the subtitle surfaces only the rule count — no badge/summary for `final`, `strategy`, cache state, or server count. A reader cannot tell from the node whether a `final` is set or which strategy is active.
- Dead control [P1]: the hover-actions block renders a delete button calling `deleteEntity(data.ref)` for the `{kind:"dns"}` ref (SbcNode.tsx:454-464, 460). `deleteEntity` has NO `dns` branch (commands.ts:1021-1059), so this trash icon is a silent no-op. The Inspector correctly hides delete for `dns` (Inspector.tsx:1816), so the canvas affordance is both inconsistent and misleading.

## 3. Upstream/Downstream Links
The relationship model is accurate and complete for the hub. No missing/extra/wrong links found for hub-dns itself.
- `dns.final -> dns server`: relation `dns-final` writable, `/dns/final`, createTarget `["dns-server"]` (portRelationRegistry.ts:98); reference path `/dns/final` under kind `dns-server` (referenceRegistry.ts:340, replaceDnsServerRefs:226 / removeDnsServerRefs:241); rename/remove + disconnect handled (commands.ts:1101). Correct: sources from DNS server tags, never outbound tags.
- `dns owns rules[]`: relation `dns-rule-order` mode `order-only` (portRelationRegistry.ts:97) — visualization only, order stays table-owned. Correct.
- `dns.rules[].server -> dns server`: relation `dns-rule` writable `/dns/rules/*/server` (portRelationRegistry.ts:101); ref path present (referenceRegistry.ts:340). Correct.
- `client_subnet` and `reverse_mapping`: correctly modeled as Inspector-only scalars with NO port/edge (they are not tag references). Correct — no link should exist.
- `fakeip`: correctly modeled as an embedded scalar/object, NOT a canvas node or edge. Correct per doc (and it is legacy/removed in 1.14).
- Adjacent (not the hub, but correct): `dns-rule-inbound`/`dns-inbound-query` (decorative inbound→dns), `dns-rule-set`, `dns-server-detour`, `dns-server-endpoint`, `dns-server-service` all present and well-formed.

## 4. Right Inspector (fields)
Rendered for `ref.kind === "dns"` at Inspector.tsx:1926-2084 (`servers`/`rules` are surfaced via the canvas + DnsRulesTable, not raw JSON). One row per official top-level field:

| Official field | UI control | Required | Default shown | Validation | Verdict |
|---|---|---|---|---|---|
| `servers` (list) | Canvas dns-server nodes + DnsRulesTable server selects | no | n/a | tag refs validated by diagnostics | OK (not a hub scalar) |
| `rules` (list) | `<DnsRulesTable/>` ordered table (Inspector.tsx:2084), full editor via DnsRuleInspector | no | n/a | per-rule | OK (table-owned order) |
| `final` (string) | select over `dns.servers[].tag`, "First DNS server" empty option (1930-1943) | no | empty=first | `missing-dns-final` error if dangling (diagnostics.ts:307) | OK — correct namespace |
| `strategy` (string) | enum select prefer_ipv4/prefer_ipv6/ipv4_only/ipv6_only + "(default)" (1947-1956) | no | "(default)" | enum-constrained | OK |
| `disable_cache` (bool) | checkbox (1959-1964), writes `undefined` when off | no | off | none | OK |
| `disable_expire` (bool) | checkbox (1967-1972) | no | off | none | OK |
| `independent_cache` (bool) | checkbox (1974-1983) | no | off | `deprecated-dns-independent-cache` warning on testing (diagnostics.ts:317) | PARTIAL — no inline deprecation note in Inspector |
| `cache_capacity` (int) | number input, value `Number(entity.cache_capacity ?? 0)` (1986-1990) | no | shows `0` when unset | none | WEAK — displays 0 for unset; no "values <1024 ignored" helper; `Number()||undefined` drops 0 correctly but UI implies 0 is stored |
| `optimistic` (bool\|object) | checkbox only (boolean) (2068-2075) | no | off | `dns-optimistic-testing-only` on stable (diagnostics.ts:1205) | INCOMPLETE — object form `{enabled,timeout:"3d"}` not editable; cannot set custom timeout |
| `timeout` (string) | text input, placeholder "5s" (2076-2083) | no | empty (doc default 10s) | `dns-timeout-testing-only` on stable (diagnostics.ts:1214) | OK (placeholder should be "10s" to match doc default) |
| `reverse_mapping` (bool) | checkbox (1992-1998) | no | off | none | OK |
| `client_subnet` (string) | plain text input (2000-2006) | no | empty | none | WEAK — no IP/prefix validation or helper ("/32 or /128 appended") |
| `fakeip` (object, legacy) | fieldset: enabled checkbox + inet4_range/inet6_range text (2008-2063) | no | off | `legacy-fakeip-deprecated` warning (diagnostics.ts:1012) | PARTIAL — editor works but no in-Inspector deprecation banner; writes valid object (no invalid-JSON risk) |

No invalid-JSON writes in the dns hub block (all controls write typed scalars/objects; fakeip clears keys cleanly). No UI fields present that are absent from the official model. Testing-only fields are flagged by an inline `PlatformBanner` (Inspector.tsx:2064-2067) — good UX, but it is informational only and not channel-conditional.

## Findings (prioritized)
- [P1] Canvas hover delete on the DNS hub is a dead no-op: SbcNode.tsx:460 calls `deleteEntity({kind:"dns"})` but commands.ts:1021-1059 has no `dns` branch. Either hide the delete button for `kind==="dns"` (mirror Inspector.tsx:1816) or make it clear `dns` (and cascade-clear `dns-server` refs). SbcNode.tsx:454-464.
- [P1] `optimistic` object form unsupported: doc allows `true` or `{enabled,timeout}` with default `3d` (dns/index.md:101-118). Inspector exposes only a boolean checkbox (Inspector.tsx:2068-2075), so a custom optimistic timeout cannot be set and an imported object value renders as a generic truthy checkbox that, if toggled, overwrites the object with `true`. Add an object editor (enabled + timeout) when expanded.
- [P2] `cache_capacity` UX: input shows `0` for unset and gives no hint that values <1024 are ignored (dns/index.md:90). Use `value={typeof entity.cache_capacity === "number" ? ... : ""}` + helper text; consider a diagnostic for 0 < value < 1024. Inspector.tsx:1986-1990.
- [P2] `client_subnet` has no validation/helper for IP-vs-prefix (doc says `/32`/`/128` auto-appended, dns/index.md:141-145). Add placeholder + format hint or a diagnostic. Inspector.tsx:2000-2006.
- [P2] No conflict diagnostic for `optimistic` vs `disable_cache`/`disable_expire` (doc: optimistic "Conflict with disable_cache and disable_expire", dns/index.md:99,107-108). Neither the Inspector nor diagnostics.ts flags setting both. Add a warning/error.
- [P2] Inline deprecation notes missing in Inspector for `independent_cache` (deprecated 1.14, dns/index.md:78-80) and `fakeip` (removed 1.14, dns/index.md:50). Diagnostics cover both but the Inspector controls render with no visual deprecation cue (Inspector.tsx:1974-1983, 2008-2063).
- [P2] Canvas node summary is thin: titlebar shows raw `dns / dns` and subtitle is rule-count only — no badge for `final`/`strategy`/cache/server-count (graph.ts:520-522, SbcNode.tsx:291). Add a richer summary/badges.
- [P2] `timeout` placeholder is "5s" but doc default is `10s` (dns/index.md:118). Cosmetic mismatch. Inspector.tsx:2080.

SUMMARY: 0 P0, 2 P1, 6 P2.
