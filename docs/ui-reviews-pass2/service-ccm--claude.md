# service-ccm — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

CCM is wired across all four surfaces and round-trips its core fields, but there is one shipping-blocker data-corruption bug: the Inspector renders a stray "Inbound Detour" select (from the shared Listen group) that writes the *same* `/services/*/detour` key as the correct "API Detour" outbound select — for CCM, upstream redefines `detour` as an **outbound** tag, so the Listen-group control lets the user write an inbound tag into a field that must be an outbound and silently stomps the real value. Second blocker: CCM is "Since sing-box 1.13.0" yet has **no version/channel gate**, so it exports happily onto the `1.12-stable` ("1.12 Legacy") target where `sing-box-1.12` rejects it. Otherwise the node (palette, canvas port, users/headers/credential/usages editors, sensitive token masking, outbound detour reference + rename/remove propagation) is correct. Pass-1 (`docs/ui-reviews/service-ccm.md`) is now stale on these specifics: it asserted "P0 service detour must be an outbound tag reference" as satisfied/aspirational but never caught the duplicate Inbound-Detour control, and it lacked the concrete `1.12-stable` target id.

## 1. Left Palette

- Present, correct category, label `CCM`, kind `service-ccm`, docs `service/ccm/`. `src/components/Palette.tsx:198` under the `Services` group (`src/components/Palette.tsx:192-202`).
- Type maps to canonical `ccm` and is creatable: `src/domain/protocols.ts:137`, `:142`. Preferred tag `ccm` (`src/domain/protocols.ts:224`).
- `status: "setup"` (deferred-action). Acceptable; matches sibling services (DERP/SSM/OCM all `setup`).
- Gating gap: palette does not disable/annotate CCM on the `1.12-stable` target even though CCM is 1.13.0+. The palette has no per-target gating for any service, so this is a node-level diagnostic concern (see Finding P0-2) rather than a palette regression. Pass-1's "disable CCM on 1.12 Legacy" remains unimplemented.

## 2. Canvas Node

- Title = service tag; subtitle = "Claude Code multiplexer" (`src/canvas/graph.ts:780`). Correct and human-readable.
- Status badge derives from `/services/{index}` diagnostics (`src/canvas/graph.ts:668`) — surfaces the users-empty / public-listen warnings. Good.
- Ports: exactly one **output** handle "API detour outbound", restricted to `nodeType: "ccm"` (`src/domain/portRelationRegistry.ts:109`; gating via `endpointMatchesNode` `src/domain/portRelationRegistry.ts:157-160`). No input handle — correct, since nothing in the upstream model references a CCM service `tag` (only `dns.servers[].service` references services, and that targets `resolved`, not `ccm`).
- The Listen-level `detour` (forward-to-inbound / "Injectable") correctly has **no** canvas port, because the CCM doc overrides `detour` to mean an outbound tag. So canvas port modeling is correct.
- Detour edge only drawn when `service.detour` set (`src/canvas/graph.ts:676-679`, relation `service-detour-ccm`). Correct.
- Minor: subtitle does not summarize user count / TLS / usage-tracking / detour state (pass-1 wishlist). Cosmetic, not a correctness defect. [P2]

## 3. Upstream/Downstream Links

Official model: CCM references exactly one outbound via `detour` (outbound tag for the Claude API). Nothing references a CCM service tag.

- portRelationRegistry: `service-detour-ccm` output(service,detour)→input(outbound) at `/services/*/detour`, allowed kinds `["outbound"]` (`src/domain/portRelationRegistry.ts:109`). Correct — matches the official outbound-detour relationship.
- referenceRegistry: `/services/*/detour` is registered under the `outbound` kind (`src/domain/referenceRegistry.ts:334`); rename propagates (`replaceOutboundRefs` → `src/domain/referenceRegistry.ts:167`) and delete clears it (`removeOutboundRefs` → `src/domain/referenceRegistry.ts:188`). Correct.
- Edge-disconnect command clears `service.detour` for `service-detour-ccm` (`src/domain/commands.ts:1166-1172`). Correct.
- No missing/extra inbound link: CCM `detour` is NOT registered as an inbound reference (it is absent from the `inbound` paths `src/domain/referenceRegistry.ts:328`). Correct per the doc's override.
- Conclusion: the graph/reference model for CCM is **correct**. The only relationship-level defect lives in the Inspector (the bogus Inbound-Detour control, §4 / Finding P0-1), not in the registries.

## 4. Right Inspector (fields)

Listen Fields render via the shared "listen" group; inbound TLS via the shared "tls" group (`src/domain/sharedFieldRegistry.ts:158-159`, `:197-200`). CCM-specific fields render in the `entityType === "ccm" || "ocm"` block (`src/components/Inspector.tsx:5056-5187`).

| Official field (ccm.md / listen.md / tls.md inbound) | UI state | Notes / file:line |
|---|---|---|
| `listen` ==Required== | text input, **no required marker** | shared listen `src/components/Inspector.tsx:1436`. Not marked required; no diagnostic if empty. [P1] |
| `listen_port` | number | `src/components/Inspector.tsx:1437` OK |
| `bind_interface` (1.12+) | text | `:1438` OK |
| `routing_mark` (Linux) | text (accepts int or `0x` hex) | `:1439` OK |
| `reuse_addr` (1.12+) | boolean | `:1440` OK |
| `netns` (Linux,1.12+) | text | `:1441` OK |
| `tcp_fast_open` | boolean | `:1442` OK |
| `tcp_multi_path` | boolean | `:1443` OK |
| `disable_tcp_keep_alive` (1.13+) | boolean | `:1444` OK |
| `tcp_keep_alive` (1.13+) | text | `:1445` OK |
| `tcp_keep_alive_interval` | text | `:1446` OK |
| `udp_fragment` | boolean | `:1447` OK |
| `udp_timeout` | text | `:1448` OK |
| `detour` (CCM: **outbound** tag) | TWO controls writing same key — **conflict** | "Inbound Detour" (inbound tags, `src/components/Inspector.tsx:1449`) AND "API Detour" (outbound tags, `src/components/Inspector.tsx:5072-5085`). Both write `/services/*/detour`. [P0] |
| `credential_path` | text | `src/components/Inspector.tsx:5058-5064` OK |
| `usages_path` | text | `:5065-5071` OK |
| `users[]` `.name` | text | `:5103-5109` OK |
| `users[]` `.token` | SensitiveTextField (masked) | `:5110-5114` OK — sensitive-masked, correct |
| `headers{}` | key/value repeater (string values) | `:5126-5185` OK |
| `tls{}` (==inbound== / server) | shared TLS group (mixed inbound+outbound editor) | `src/components/Inspector.tsx:1502-1547`. Exposes many **client-only** fields invalid for CCM's inbound TLS; omits some inbound 1.13/1.14 server fields. [P1] (shared-atomic) |

TLS group specifics for CCM (inbound/server context), `src/components/Inspector.tsx:1502-1547`:
- Invalid-for-inbound fields shown: `disable_sni` (1512), `insecure` (1513), `certificate_public_key_sha256` (1523), `fragment`/`fragment_fallback_delay`/`record_fragment` (1531-1533), `utls.*` (1534-1535), `ech.config`/`config_path`/`query_server_name` (1540-1542), `reality.public_key` (1537). These are client-only per `tls.md`. Writing them onto a CCM service produces config a server-side TLS will reject. [P1]
- Missing inbound/server 1.13+ fields: `client_certificate`, `client_certificate_path`, `client_certificate_public_key_sha256`, `kernel_tx`, `kernel_rx` (1.13+), `handshake_timeout` (1.14+). Absent from the editor. [P2]
- `client_authentication` enum wrong: UI options `["", "request", "require", "verify-if-given", "require-and-verify"]` (`src/components/Inspector.tsx:1524`) but `tls.md` defines `no | request | require-any | verify-if-given | require-and-verify`. UI offers non-existent `"require"` and lacks `require-any`. [P1] (shared-atomic)
- No UI field is invented beyond the official model in the CCM-specific block; all extras are confined to the shared TLS atom.

## Findings (prioritized)

- **[P0-1] Duplicate `detour` controls corrupt the field.** For a CCM node the Inspector renders both "Inbound Detour" (shared listen group, inbound-tag options) at `src/components/Inspector.tsx:1449` and "API Detour" (outbound-tag options) at `src/components/Inspector.tsx:5072-5085`; both `updateField(ref, "detour", ...)` → `/services/*/detour`. Upstream `service/ccm.md` (detour = "Outbound tag for connecting to the Claude API") overrides the listen-fields `detour`. Selecting an inbound tag writes an invalid outbound reference and silently overwrites the user's API-detour choice. Fix: suppress the listen-group `detour` row for services where the type redefines `detour` as outbound (ccm/ocm) — drop `detour` from the listen field list for those types or branch the listen renderer. Listen field list source: `src/components/Inspector.tsx:114`.

- **[P0-2] No version gate for CCM on the 1.12 target.** CCM is "Since sing-box 1.13.0" (ccm.md:5). The app exposes target `1.12-stable` / "1.12 Legacy" (`src/domain/targets.ts:13`, `src/domain/types.ts:11`). `validateConfig` emits no diagnostic for a `ccm` service on a 1.12 target (CCM block at `src/domain/diagnostics.ts:279-303` has no channel/version check), unlike `hysteria-realm` which gates at `src/domain/diagnostics.ts:228-236` and shows an Inspector banner at `src/components/Inspector.tsx:5191-5198`. Result: silent export of a config `sing-box-1.12` rejects. Fix: add a 1.12-only diagnostic (the validator must consult `version`, not just `channel`; today `validateConfig(config, channel)` at `src/state/useProjectStore.ts:135` receives only channel) and/or an Inspector banner mirroring hysteria-realm.

- **[P1-1] `listen` not marked required and not validated.** ccm.md → listen.md marks `listen` ==Required==. UI control `src/components/Inspector.tsx:1436` has no required marker and there is no empty-`listen` diagnostic; note the `ccm-public-listen` check (`src/domain/diagnostics.ts:291-302`) even treats empty string as merely a public-listen warning, masking the missing-required case. Fix: mark required + add an error-level diagnostic when `listen` is empty.

- **[P1-2] Shared inbound TLS atom leaks client-only fields / wrong enum (affects CCM).** Client-only TLS fields are rendered for CCM's server-side TLS (`src/components/Inspector.tsx:1512,1513,1523,1531-1537,1540-1542`); `client_authentication` enum is wrong (`:1524`, has `require`, missing `require-any`). Shared-atomic — fix once in the TLS group with an inbound/server vs outbound/client variant. (Pass-1 Cross-Node Findings already track the TLS atom; this re-confirms it bites CCM.)

- **[P1-3] `ccm-users-empty` severity may be too strong.** `src/domain/diagnostics.ts:282-290` warns when `users` is empty, but ccm.md:67 says "If empty, no authentication is required" — a deliberately valid local/dev config. Warning text ("clients will be rejected") is misleading; consider info-level or scope to public-listen only. Minor correctness/UX. 

- **[P2-1] Missing inbound TLS 1.13/1.14 server fields** (`client_certificate(_path)`, `client_certificate_public_key_sha256`, `kernel_tx`, `kernel_rx`, `handshake_timeout`) — not in the TLS group (`src/components/Inspector.tsx:1509-1547`). Shared-atomic, low impact for CCM.

- **[P2-2] Canvas subtitle is generic** ("Claude Code multiplexer", `src/canvas/graph.ts:780`); does not summarize listen/users/TLS/detour. Cosmetic.

SUMMARY: 2 P0, 3 P1, 2 P2.
