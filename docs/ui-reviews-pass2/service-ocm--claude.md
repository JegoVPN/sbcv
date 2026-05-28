# service-ocm — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

OCM is wired across all four surfaces and its core fields round-trip, but it shares the exact CCM Inspector block (`entityType === "ccm" || "ocm"`) and therefore inherits the same two shipping-blockers: (P0-1) a stray "Inbound Detour" select from the shared Listen group writes the *same* `/services/*/detour` key as the correct "API Detour" outbound select, and since upstream redefines `detour` as an **outbound** tag, picking an inbound tag writes an invalid reference and silently stomps the user's API-detour choice; (P0-2) OCM is "Since sing-box 1.13.0" yet has no version gate, so it exports cleanly onto the `1.12-stable` ("1.12 Legacy") target that `sing-box-1.12` rejects. Worse than CCM: OCM has **no node-specific diagnostics at all** (no public-listen / no users-empty warning), even though it is an even more sensitive remote-Codex bearer-token proxy. Pass-1 (`docs/ui-reviews/service-ocm.md` + `docs/claude/service-ocm.md`) is now stale: its two P1s (raw-JSON `users`/`headers`) and its "tokens must be sensitive" P0 are RESOLVED (structured repeaters + masked token shipped), and every line number it cites is wrong (Inspector OCM block moved 1775→5056).

## 1. Left Palette

- Present, correct category/label/kind/docs: `{ label: "OCM", kind: "service-ocm", docsUrl: docs("service/ocm/"), status: "setup" }` at `src/components/Palette.tsx:199`, under the `Services` group (`src/components/Palette.tsx:192-202`). Pass-1 cited line 198 — stale (that is now CCM).
- Kind maps to canonical `ocm` and is creatable: `src/domain/protocols.ts:138`, `:142`. Preferred tag `ocm` (`src/domain/protocols.ts:225`).
- `status: "setup"` (deferred-action). Consistent with the other services (DERP/Resolved/SSM/CCM all `setup`). Acceptable.
- Gating gap: palette has no per-target gating, so OCM is offered on `1.12-stable` despite being 1.13.0+. Palette has no gating mechanism for any service, so this is a node-level diagnostic concern (Finding P0-2), not a palette-only regression. Pass-1's "disable OCM on 1.12 Legacy" remains unimplemented.

## 2. Canvas Node

- Title = service tag; subtitle = "OpenAI Codex multiplexer" (`src/canvas/graph.ts:781`). Correct/human-readable. Pass-1 cited graph.ts:693 — stale.
- Status badge derives from `/services/{index}` diagnostics (`src/canvas/graph.ts:668`) — but for OCM that only surfaces the generic missing-detour error; no security warnings exist to surface (see P1-1).
- Ports: exactly one **output** handle "API detour outbound", gated to `nodeType: "ocm"` via relation `service-detour-ocm` (`src/domain/portRelationRegistry.ts:110`; matching by `endpointMatchesNode` `src/domain/portRelationRegistry.ts:157-160`; surfaced by `portEndpointsForNode`/`getPortSpecs` `:196-205`, consumed in `src/components/SbcNode.tsx:277-278`). No input handle — correct: nothing in the upstream model references an OCM service `tag` (only `dns.servers[].service` references services, and that targets `resolved`).
- OCM does NOT also get the ccm-only `service-detour-ccm` port (its source is gated `nodeType: "ccm"`), so no duplicate port. Correct.
- Detour edge only drawn when `service.detour` set, using relation `service-detour-ocm` (`src/canvas/graph.ts:676-679`). Detoured outbound is pulled into the member layout column (`src/canvas/graph.ts:211`). Correct.
- Pass-1 (docs/ui-reviews) wishlist "summarize user count / TLS / usage / detour" and "warn when listening publicly" — cosmetic + see P1-1. [P2]

## 3. Upstream/Downstream Links

Official model: OCM references exactly one outbound via `detour` ("Outbound tag for connecting to the OpenAI API", ocm.md:87-89). Nothing references an OCM service tag.

- portRelationRegistry: `service-detour-ocm` output(service,detour)→input(outbound,service-detour) at `/services/*/detour`, allowed create kinds `["outbound"]` (`src/domain/portRelationRegistry.ts:110`). Correct — matches the official outbound-detour relationship; no missing/extra link.
- referenceRegistry: `/services/*/detour` is registered under the **outbound** kind (`src/domain/referenceRegistry.ts:334`); rename propagates (`replaceOutboundRefs` → `src/domain/referenceRegistry.ts:167`) and delete clears it (`removeOutboundRefs` → `src/domain/referenceRegistry.ts:188`). Correct cascade.
- Edge-disconnect command clears `service.detour` for both detour relations (`src/domain/commands.ts:1166-1172`). Correct.
- OCM `detour` is correctly NOT registered as an inbound reference (absent from the `inbound` paths in referenceRegistry). Correct per the doc's override of the Listen-fields `detour`.
- Connect/disconnect/auto-create wiring is OCM-aware: drag-connect writes `detour` only for ccm/ocm (`src/state/useProjectStore.ts:600`); reverse-toggle from an outbound auto-creates an `ocm` service (`src/state/useProjectStore.ts:1044`); port toggle guarded to ccm/ocm (`src/state/useProjectStore.ts:1386`). Correct.
- Conclusion: the graph + reference model for OCM is **correct**. The only relationship-level defect is in the Inspector (the bogus Inbound-Detour control writing the outbound `detour` key — §4 / P0-1), not in the registries.

## 4. Right Inspector (fields)

Listen Fields render via the shared "listen" group and inbound TLS via the shared "tls" group: OCM is in both `serviceListenTypes` and `serviceTlsTypes` (`src/domain/sharedFieldRegistry.ts:158-159`). OCM-specific fields render in the `entityType === "ccm" || "ocm"` block (`src/components/Inspector.tsx:5056-5187`). `http2` group correctly NOT applied. Pass-1 cited Inspector lines 1775-1808 — all stale.

| Official field (ocm.md / listen.md / tls.md#inbound) | UI state | Notes / file:line |
|---|---|---|
| `type` = `"ocm"` | discriminator, not a field | n/a |
| `listen` (listen.md ==Required==) | text, **no required marker**, no empty-validation | `src/components/Inspector.tsx:1436` [P1-2] |
| `listen_port` | number | `:1437` OK (default 8081, `src/domain/commands.ts:539`) |
| `bind_interface` (1.12+) | text | `:1438` OK |
| `routing_mark` (Linux) | text | `:1439` OK |
| `reuse_addr` (1.12+) | boolean | `:1440` OK |
| `netns` (Linux,1.12+) | text | `:1441` OK |
| `tcp_fast_open` | boolean | `:1442` OK |
| `tcp_multi_path` | boolean | `:1443` OK |
| `disable_tcp_keep_alive` (1.13+) | boolean | `:1444` OK |
| `tcp_keep_alive` (1.13+) | text | `:1445` OK |
| `tcp_keep_alive_interval` | text | `:1446` OK |
| `udp_fragment` | boolean | `:1447` OK |
| `udp_timeout` | text | `:1448` OK |
| `detour` (OCM: **outbound** tag) | TWO controls writing same key — **conflict** | "Inbound Detour" (inbound options, `:1449`) AND "API Detour" (outbound options, `:5072-5085`); both write `/services/*/detour` [P0-1] |
| `credential_path` | text | `:5058-5064` OK (optional; correct) |
| `usages_path` | text | `:5065-5071` OK (optional; correct) |
| `users[]` `.name` | text | `:5103-5109` OK |
| `users[]` `.token` | SensitiveTextField (masked, reveal toggle) | `:5110-5114` + `:639-668` OK — sensitive-masked, correct. Pass-1 "P0 tokens must be sensitive" RESOLVED |
| `headers{}` (string→string) | key/value repeater (rename + value + add/remove) | `:5126-5185` OK. Pass-1 "raw JSON" P1 RESOLVED |
| `tls{}` (==inbound== / server) | shared TLS group (mixed client+server editor) | `:1502-1547` — exposes client-only fields invalid for OCM's inbound TLS; wrong `client_authentication` enum [P1-3] |

Structured editors round-trip cleanly (`writeUsers`/`writeHeaders` drop to `undefined` when emptied, `:5089`/`:5130`; no invalid-JSON write path remains). TLS group specifics (inbound/server context) for OCM, `src/components/Inspector.tsx:1502-1547`:
- Invalid-for-inbound fields shown: `disable_sni` (1512), `insecure` (1513), `certificate_public_key_sha256` (1523), `fragment`/`fragment_fallback_delay`/`record_fragment` (1531-1533), `utls.*` (1534-1535), `reality.public_key`/`short_id` (1537-1538), `ech.config`/`config_path`/`query_server_name` (1540-1542) — all client-only per tls.md. [P1-3]
- `client_authentication` enum wrong: UI `["", "request", "require", "verify-if-given", "require-and-verify"]` (`:1524`) vs tls.md `no | request | require-any | verify-if-given | require-and-verify`. Offers non-existent `require`, lacks `require-any`. [P1-3]
- Missing inbound/server fields: `client_certificate`, `client_certificate_path`, `client_certificate_public_key_sha256`, `kernel_tx`/`kernel_rx` (1.13+), `handshake_timeout` (1.14+). Absent from the editor. [P2]
- No invented field beyond the official model in the OCM-specific block; all extras are confined to the shared TLS atom.

## Findings (prioritized)

- **[P0-1] Duplicate `detour` controls corrupt the field.** For an OCM node the Inspector renders both "Inbound Detour" (shared listen group, **inbound**-tag options) at `src/components/Inspector.tsx:1449` and "API Detour" (**outbound**-tag options) at `src/components/Inspector.tsx:5072-5085`; both call `updateField(ref, "detour", ...)` → `/services/*/detour`. Upstream ocm.md:87-89 redefines `detour` as an **outbound** tag, overriding the Listen-fields `detour`. Selecting an inbound tag writes an invalid outbound reference (caught only later by the missing-detour error) and silently overwrites the user's API-detour choice. Fix: drop `detour` from `listenSharedFields` (`src/components/Inspector.tsx:114`) and from the listen group builder (`src/components/Inspector.tsx:1449`) for services where the type redefines `detour` as outbound (ccm/ocm), or branch the listen renderer to skip it for those types.

- **[P0-2] No version gate for OCM on the 1.12 target.** OCM is "Since sing-box 1.13.0" (ocm.md:5). The app exposes target `1.12-stable` / "1.12 Legacy" (binary `sing-box-1.12`, version `1.12`) at `src/domain/targets.ts:13`. `validateConfig(config, channel)` (`src/domain/diagnostics.ts:18-21`, called `src/state/useProjectStore.ts:135`) receives only `channel`, and `1.12-stable`/`1.13-stable` share channel `"stable"` — so the validator cannot distinguish 1.12 from 1.13. There is also **no `service.type === "ocm"` diagnostics branch at all** (existing branches: ssm-api/derp/resolved/hysteria-realm/ccm — `src/domain/diagnostics.ts:134,167,218,228,279`). Result: OCM exports silently onto a 1.12 target that `sing-box-1.12` rejects. Fix: thread `version` (or the full target) into `validateConfig` and add a 1.12-only error + Inspector banner, mirroring hysteria-realm (`src/domain/diagnostics.ts:228-236`, banner `src/components/Inspector.tsx:5191-5198`).

- **[P1-1] OCM has zero security diagnostics (regression vs CCM).** CCM gets a users-empty warning and a public-listen warning (`src/domain/diagnostics.ts:279-302`); OCM has **no** such branch. OCM is an even more sensitive surface — a remote OpenAI-Codex proxy authenticated by bearer tokens — and ocm.md:65-66 says empty `users` means "no authentication is required", so a public `listen` (`0.0.0.0`/`::`/empty) with empty `users` exposes the local Codex subscription unauthenticated. Pass-1 flagged this as P0 ("public unauthenticated listen should warn"); it is unimplemented for OCM. Fix: add an `service.type === "ocm"` branch with a public-listen warning (and optionally an info-level users-empty note), reusing the CCM pattern.

- **[P1-2] `listen` not marked required and not validated.** ocm.md → listen.md marks `listen` ==Required==. UI control `src/components/Inspector.tsx:1436` has no required marker and there is no empty-`listen` diagnostic anywhere for OCM. Fix: mark required + add an error-level diagnostic when `listen` is empty.

- **[P1-3] Shared inbound TLS atom leaks client-only fields / wrong enum (affects OCM).** OCM's `tls` is inbound/server (tls.md#inbound) but the shared TLS group renders client-only fields (`src/components/Inspector.tsx:1512,1513,1523,1531-1538,1540-1542`) and a wrong `client_authentication` enum (`:1524`, has `require`, missing `require-any`). Shared-atomic — fix once with an inbound/server vs outbound/client variant. (Tracked in pass-1 Cross-Node Findings; re-confirmed to bite OCM.)

- **[P2-1] Missing inbound TLS 1.13/1.14 server fields** (`client_certificate(_path)`, `client_certificate_public_key_sha256`, `kernel_tx`, `kernel_rx`, `handshake_timeout`) — absent from the TLS group (`src/components/Inspector.tsx:1509-1547`). Shared-atomic, low impact for OCM.

- **[P2-2] Canvas subtitle is generic** ("OpenAI Codex multiplexer", `src/canvas/graph.ts:781`); does not summarize listen/users/TLS/usage/detour state. Cosmetic.

SUMMARY: 2 P0, 3 P1, 2 P2.
