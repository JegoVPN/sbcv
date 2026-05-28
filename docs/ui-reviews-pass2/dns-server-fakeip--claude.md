# dns-server-fakeip — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The fakeip DNS-server node is now in good shape: the four official fields (`type`, `tag`, `inet4_range`, `inet6_range`) are all writable, the Inspector has a dedicated `entityType === "fakeip"` branch with correct serialised keys + default placeholders, the reference model is complete, and diagnostics already fire `dns-server-fakeip-range-missing` plus the `legacy-fakeip-deprecated` migration warning. The remaining gaps are quality-of-guidance: no CIDR-format validation (malformed ranges are written and exported silently), no 1.12.0+ version gate, a still-generic canvas subtitle, and a misleading "1" count pill on a node that has no compatible children. Most of pass-1's P0/P1 findings (dedicated section, handled-fields, deprecation label, Plus-button guard, range diagnostic) are now STALE — they have shipped.

## Official model (from `dns/server/fakeip.md`, since sing-box 1.12.0)

One object in `dns.servers[]` with `"type": "fakeip"`. Total writable fields = **4**:

| Field | Type | Required | Default (per doc example) | Notes |
| --- | --- | --- | --- | --- |
| `type` | string enum | required | `"fakeip"` | discriminant; must not be hand-editable |
| `tag` | string | optional (practically required to be referenced) | generated | how rules/`dns.final`/`*_domain_resolver` point at it |
| `inet4_range` | string CIDR | optional | `198.18.0.0/15` | IPv4 virtual pool |
| `inet6_range` | string CIDR | optional | `fc00::/18` | IPv6 virtual pool; doc heading typo says `inet6_address`, JSON key is `inet6_range` |

FakeIP is a virtual address allocator — it has NO `server`/`server_port`/`address`/`path`/`detour`/`endpoint`/`tls`/dial fields. Legacy top-level `dns.fakeip` (`enabled`/`inet4_range`/`inet6_range`) is REMOVED in 1.14 and is a separate concept.

## 1. Left Palette

`Palette.tsx:93` — `{ label: "FakeIP Server", kind: "dns-fakeip-server", icon: Blocks, docsUrl: docs("dns/server/fakeip/"), status: "setup" }`. Correct DNS category, correct doc link, `status:"setup"` adds a node draft (`canActivate`, `Palette.tsx:279-287`). Maps to `"fakeip"` via `DNS_SERVER_PALETTE_TYPES` (`protocols.ts:101`). Good.

Legacy entry `Palette.tsx:82` (`dns-fakeip` → `docs("dns/fakeip/")`) is now in `deprecatedKinds` (`Palette.tsx:252-256`), so `itemStatus` returns `"deprecated"` → "Legacy" badge + deprecation tooltip (`Palette.tsx:260,274`). This RESOLVES pass-1 F-PAL-1 / F-PAL-4 (now STALE).

Remaining: F-PAL-2 (both entries use the `Blocks` icon — no visual distinction) is still technically true but cosmetic-only [P2].

## 2. Canvas Node

`graph.ts:531-572` builds the node generically for all DNS servers:
- `kind:"dns-server"`, `type: server.type` → `"fakeip"`, `title`: tag, `status` from `/dns/servers/{index}`.
- `subtitle: \`${server.type} dns server\`` → "fakeip dns server" (`graph.ts:543`) — generic, doesn't signal "virtual address allocator" (pass-1 F-NODE-1 still valid) [P2].
- `compatible: []` (`graph.ts:545`) — correct (fakeip creates no downstream object).
- No detour edge (`server.detour` falsy for fakeip — `graph.ts:551`), no endpoint edge (tailscale-only — `graph.ts:554`), no service edge (resolved-only — `graph.ts:558`). All correct.

Ports/handles (input side): a fakeip node correctly RECEIVES from `dns.final` (`graph.ts:618-619`, relation `dns-final` `portRelationRegistry.ts:98`) and from `dns.rules[].server` (`graph.ts:606-607`, relation `dns-rule` `portRelationRegistry.ts:101`). It emits NO output port — correct, since fakeip has no detour/endpoint/service.

`SbcNode.tsx:392-405` — the big `+` add button is now guarded by `data.compatible.length > 0`, so it is hidden for fakeip. This RESOLVES pass-1 F-NODE-2 / T-NODE-2 (now STALE). BUT the `sbc-node-primary` count pill (`SbcNode.tsx:427-437`) still renders unconditionally and shows `{data.compatible.length || 1}` = **"1"** for a node with zero compatible children — a misleading affordance that just opens the Inspector. Pass-1 T-NODE-3 is NOT done [P2].

## 3. Upstream/Downstream Links

Reference model (`referenceRegistry.ts:338-343`) for `kind:"dns-server"` covers paths: `/dns/final`, `/dns/rules/*/server`, `/route/default_domain_resolver`, `*/domain_resolver`. Replace/remove handlers (`referenceRegistry.ts:225-253`) update `dns.final`, every `dns.rules[].server`, `route.default_domain_resolver`, and `domain_resolver` on outbounds/dns-servers/endpoints/rule_sets/http_clients/ntp. This matches the official relationship model exactly — a fakeip server tag may be referenced anywhere a DNS server tag is valid, including as a `domain_resolver`. No missing/extra/wrong reference links found.

Port relations (`portRelationRegistry.ts`): `dns-final` (98) and `dns-rule` (101) feed a fakeip node; `dns-server-detour` (105), `dns-server-endpoint` (107), `dns-server-service` (114) are type-gated to outbound/tailscale/resolved and correctly never apply to fakeip. Tag rename/delete round-trips through `renameTag` (`commands.ts:985-990`). No findings.

## 4. Right Inspector (fields)

Branch: `Inspector.tsx:4215` (`ref.kind === "dns-server"`); fakeip-specific block `Inspector.tsx:4527-4546`. Entity init `commands.ts:654-661`.

| Official field | UI state | Verdict |
| --- | --- | --- |
| `type` | type switcher `<select>` over `CREATABLE_DNS_SERVER_TYPES` (`Inspector.tsx:2128-2135`); switching re-inits via `createDnsServer` and drops `inet4_range`/`inet6_range` (`commands.ts:921-933`) | OK |
| `tag` | rendered by shared tag editor for dns-server refs | OK |
| `inet4_range` | dedicated field, label "IPv4 Range (CIDR)", placeholder `198.18.0.0/15`, writes `updateField(ref,"inet4_range",value||undefined)` (`Inspector.tsx:4529-4536`); in `dnsServerHandledFields` (`Inspector.tsx:255`) so NOT double-rendered by `AdvancedScalarFields` | OK key/label; NO validation |
| `inet6_range` | dedicated field, label "IPv6 Range (CIDR)", placeholder `fc00::/18`, writes `inet6_range` (correct key, not `inet6_address`) (`Inspector.tsx:4537-4544`); handled (`Inspector.tsx:256`) | OK key/label; NO validation |

No leak of unrelated controls: `createDnsServer("fakeip",…)` sets only `type/tag/inet4_range/inet6_range`, so the `"address"/"server"/"server_port"/"path" in entity` guards (`Inspector.tsx:4269-4344`) are all false, and `sharedGroupsForEntity` injects no dial/tls/neighbor group (fakeip excluded at `sharedFieldRegistry.ts:156`, not in `dnsServerTlsTypes` `:157`). Pass-1 F-INS-1/F-INS-2/F-INS-3 are all STALE — the dedicated section + handled-fields shipped.

Remaining Inspector gaps:
- No CIDR/format validation on either range; `onChange` writes the raw string verbatim and export keeps it. diagnostics.ts only checks presence, not shape (see below) [P1].
- No 1.12.0+ version/channel banner for the fakeip type, even though sibling types render platform/build-tag banners (`resolved` `Inspector.tsx:4231`, `tailscale` `:4264`) and dial fields carry "(1.12+)" labels [P1].
- No descriptive hint that fakeip is a virtual allocator and that persistence is controlled by `cache_file.store_fakeip` in Settings→Experimental (toggle exists `Inspector.tsx:2350`). Pass-1 F-INS-4/F-INS-7 still open [P2].

## Findings (prioritized)

- **[P1] No CIDR-shape validation for `inet4_range`/`inet6_range`.** Inspector writes raw strings (`src/components/Inspector.tsx:4534`, `:4542`) and diagnostics only checks string-presence, never format (`src/domain/diagnostics.ts:1022-1023`). A malformed value like `198.18.0/40` or an IPv6 in the v4 field is accepted and exported; sing-box will reject at start with no in-UI signal. Add a CIDR-format diagnostic at `/dns/servers/{i}/inet4_range` and `/inet6_range`.
- **[P1] No sing-box 1.12.0+ version gate for the fakeip server type.** The Inspector fakeip branch (`src/components/Inspector.tsx:4527-4546`) shows no channel/version banner, unlike `resolved`/`tailscale` (`src/components/Inspector.tsx:4231`, `:4264`). Targeting a pre-1.12 binary lets users author an unsupported server with no warning. Add an info banner (and/or a diagnostic) when this type is used.
- **[P2] Misleading "1" count pill on a zero-child node.** `src/components/SbcNode.tsx:427-437` renders `sbc-node-primary` unconditionally with `{data.compatible.length || 1}`; for fakeip (`graph.ts:545` `compatible:[]`) this shows "1" and only opens the Inspector. Guard it like the add button (`SbcNode.tsx:392`) or hide the count when `compatible.length === 0`. (Pass-1 T-NODE-3, not done.)
- **[P2] Generic canvas subtitle.** `src/canvas/graph.ts:543` emits "fakeip dns server"; should communicate the virtual-allocator role (e.g. "FakeIP address pool"). (Pass-1 F-NODE-1, still valid.)
- **[P2] No allocator/persistence guidance in Inspector.** fakeip branch (`src/components/Inspector.tsx:4527-4546`) has no description line and no cross-link to `cache_file.store_fakeip` (`src/components/Inspector.tsx:2350`). (Pass-1 F-INS-4/F-INS-7.)
- **[P2] Palette icon collision.** `dns-fakeip` (`src/components/Palette.tsx:82`) and `dns-fakeip-server` (`src/components/Palette.tsx:93`) both use `Blocks`; no visual distinction between the removed legacy concept and the active server. (Pass-1 F-PAL-2.)

### Where pass-1 is now STALE (shipped since 2026-05-27)
- F-INS-1/F-INS-2/F-INS-3 (T-INS-1/T-INS-2): dedicated fakeip Inspector section + `inet4_range`/`inet6_range` added to `dnsServerHandledFields` — done (`Inspector.tsx:4527-4546`, `:255-256`).
- F-PAL-1/F-PAL-4 (T-PAL-1): legacy `dns-fakeip` now flagged deprecated — done (`Palette.tsx:252-256`).
- F-NODE-2 (T-NODE-2): big `+` button guarded for `compatible:[]` — done (`SbcNode.tsx:392`).
- T-DIAG-1: `dns-server-fakeip-range-missing` (both ranges absent) — done (`diagnostics.ts:1020-1032`).
- T-DIAG-3: top-level `dns.fakeip` coexistence/migration warning — done as `legacy-fakeip-deprecated` (`diagnostics.ts:1007-1016`).
- Pass-1's worry about `inet6_address` export key is moot: init and Inspector both use `inet6_range` (`commands.ts:659`, `Inspector.tsx:4542`).

SUMMARY: 0 P0, 2 P1, 4 P2.
