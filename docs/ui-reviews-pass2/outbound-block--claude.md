# outbound-block — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The `block` outbound is implemented correctly and faithfully to the upstream doc: only `type` + `tag` are written, no protocol/dial/TLS fields exist, it has no dial-detour OUTPUT (cannot be a detour source), and it is referenceable as a routing target. Deprecation is now surfaced on three surfaces (Palette "Legacy" status, canvas "deprecated" badge, Inspector deprecation banner) plus a `diagnostics.ts` warning — so the entire pass-1 P0/P1 list ("nothing communicates deprecation") is now STALE/RESOLVED. One genuine residual gap remains: the canvas exposes a `detour-target` INPUT port on block, letting another outbound be wired to detour *through* block (a meaningless `socks.detour = block` chain) with no diagnostic.

## 1. Left Palette

- Present, correct group ("Outbounds"), correct icon `Ban`, correct docs URL `outbound/block/`. `Palette.tsx:154`.
- Deprecation IS surfaced. `block` is in `deprecatedKinds` (`Palette.tsx:252-256`), so `itemStatus` returns `"deprecated"` (`Palette.tsx:260`), the chip label renders **"Legacy"** (`statusLabel.deprecated`, `Palette.tsx:248`), and the tooltip reads "Block is deprecated by sing-box; new configs should use the recommended replacement" (`statusTitle`, `Palette.tsx:274`). aria-label becomes "Legacy Block".
- Still activatable for import/add compatibility: `canActivate` allows `"deprecated"` (`Palette.tsx:281-287`). Correct — clicking calls `createFromPalette("block")` → store maps `"Block"`/`block` → `addOutbound(config,"block")`.
- Covered by tests: `tests/app.test.tsx:2089-2096` ("Legacy Block", title matches /deprecated/i).
- Pass-1 STALE: pass-1 P0 "palette promotes deprecated node as first-class ADD / `PaletteStatus` lacks a deprecated variant" is resolved — the `"deprecated"` variant now exists (`Palette.tsx:43`) and is applied.

## 2. Canvas Node

- Icon `Ban` via `outboundIcon` (`SbcNode.tsx:54`). Title = tag, subtitle = `"block outbound"` (no server/candidates branch hit) — `graph.ts:395-403`. Correct.
- Deprecation badge IS rendered: `isDeprecated = kind==="outbound" && type==="block"` (`SbcNode.tsx:279`) drives `sbc-node-shell--deprecated` (`:283`) and a "deprecated" pill with title "Deprecated since sing-box 1.11 — use route action=reject" (`SbcNode.tsx:292-296`). Test: `tests/app.test.tsx:1011-1020`.
- Ports — INPUT (left): block matches the generic-outbound input endpoints (no `nodeType` restriction): `route` (route-final), `route-rule`, `selector-group`, `urltest-group`, `dns-detour`, `detour-target`, `service-detour`, `rule-set-download`. Derived via `portEndpointsForNode` (`portRelationRegistry.ts:196-205`).
- Ports — OUTPUT (right): NONE. block carries no group `outbound-member` output (gated to selector/urltest, `portRelationRegistry.ts:103-104`) and is explicitly excluded from the `dial-detour` SOURCE via `nodeTypeExcludes: ["block","selector","urltest","dns"]` (`portRelationRegistry.ts:106`). So block correctly cannot be a detour source. Verified by `tests/config-doc-capability.test.ts:124` semantics.
- Compatible/`+` affordance: `compatible: []` for non-group outbounds (`graph.ts:405-...`), so no spurious "+ create" button. Correct.
- ISSUE (minor): the `detour-target` INPUT is semantically wrong for block (see §3 / Findings P2). Pass-1 "P1 no canvas deprecation indicator" is now STALE/RESOLVED.

## 3. Upstream/Downstream Links

Official relationship model for block: it is an outbound *tag* that can be referenced by `route.final`, `route.rules[].outbound`, and `selector`/`urltest` `outbounds[]` member lists. It has NO outgoing reference of its own (no `detour`, no `outbounds`).

INPUT relations where block legitimately participates (all generic-outbound, correct):
- `route-final` (`/route/final`) — `portRelationRegistry.ts:93`
- `route-rule` (`/route/rules/*/outbound`) — `:95`
- `selector` candidate (`/outbounds/*/outbounds`) — `:103`
- `urltest` candidate (`/outbounds/*/outbounds`) — `:104`
- `dns-server-detour` (`/dns/servers/*/detour`) — `:105` (DNS detour can legally point at any outbound tag, including block)

OUTPUT relations — correctly NONE:
- `outbound-detour` SOURCE excludes block (`:106`) → no dial-detour output. CORRECT (block is not a detour source).
- `selector`/`urltest` member outputs are type-gated → not on block. CORRECT.

referenceRegistry parity (`referenceRegistry.ts:332-337`): the `outbound` entry's rename/remove paths include `/route/final`, `/route/rules/*/outbound`, `/outbounds/*/outbounds`, `/outbounds/*/default`, `/outbounds/*/detour`, `/dns/servers/*/detour`, `/endpoints/*/detour`, `/services/*/detour`, `/route/rule_set/*/download_detour`, `/ntp/detour`, clash external_ui_download_detour. These are the union of *all* outbound references; for block specifically the relevant subset (final, rules, selector/urltest member, dns detour) is covered, and delete/rename correctly cascade. No missing link for block.

WRONG/EXTRA link (the one real port issue): block is offered as a `detour-target` INPUT through 3 relations whose target endpoint is generic `outbound` with NO `nodeTypeExcludes`:
- `outbound-detour` target (`portRelationRegistry.ts:106`)
- `endpoint-detour` target (`:108`)
- `settings-ntp-detour` target (`:115`)
This advertises block as a valid place to detour *through*. It is not: `detour` chains a connection through another dialable outbound, and block drops traffic. Activating block's `detour-target` port creates a fresh `socks` outbound with `socks.detour = <block-tag>` (`useProjectStore.ts:1024-1035`), producing a config sing-box would treat as a dead chain. No diagnostic guards `detour → block` (diagnostics only check the detour target *exists*, `diagnostics.ts:112-130,411-417`). Recommend excluding `block` (and arguably `selector`/`urltest`/`dns`, mirroring the SOURCE exclude at `:106`) from these `detour-target` targets, or adding a semantic warning. See Findings P2.

## 4. Right Inspector (fields)

block writable object = `{ type, tag }` only. Inspector renders ONLY the deprecation banner; both fields are handled atomics (suppressed from the advanced fallback because they live in `outboundHandledFields`, `Inspector.tsx:179-180`).

| Official field | Type | UI state |
|---|---|---|
| `type` (fixed `"block"`) | string | Exposed via type chip/selector at node+inspector level; in `outboundHandledFields` so not duplicated in advanced fallback. Correct. |
| `tag` | string | Exposed as the entity name/tag field (shared outbound tag editor); in `outboundHandledFields`. Correct. |

No spurious fields. Verified:
- Shared field groups: `sharedGroupsForEntity` returns `[]` for block — `outboundDialTypes` explicitly excludes block (`sharedFieldRegistry.ts:150`), and block is absent from TLS/QUIC/multiplex/transport/udp-over-tcp sets (`:151-155`). So NO dial/TLS/multiplex/transport cards render (`SharedFieldCards`, `Inspector.tsx:5343-5350`). Test: `tests/config-doc-capability.test.ts:241-247`.
- `"server" in entity` / `"server_port" in entity` / `"outbounds" in entity` / `entityType === "selector"|"urltest"|"shadowtls"|"tor"|"hysteria"|"ssh"` branches all SKIP block (`Inspector.tsx:3376-3385`, `4126-4209`) — block has none of those keys/types.
- Advanced fallback `AdvancedScalarFields`/`AdvancedNonScalarFields` (`Inspector.tsx:4210-4211`) find nothing to render (only `type`+`tag`, both handled).
- Deprecation banner present: `entityType === "block"` → `PlatformBanner kind="deprecated"` "Deprecated: outbound type `block` is superseded by route action `reject` from sing-box 1.11+…" (`Inspector.tsx:3364-3369`). Test: `tests/app.test.tsx:1782-1787`.
- `createOutbound("block")` returns exactly `{ type, tag }` (`commands.ts:283`) — no injected fields. Import round-trip safe.
- Pass-1 STALE: pass-1 P0 "must not expose generic dial/server/TLS", P0 "downstream ports hidden", P1 "Inspector shows no deprecation notice" are all RESOLVED.

## Findings (prioritized)

- **[P2]** `detour-target` INPUT port offered on block (and selector/urltest/dns) lets a real outbound/endpoint/NTP be wired to detour *through* block, yielding a meaningless `detour = <block>` chain with no diagnostic. Source endpoints already exclude these types; the *target* endpoints do not. Mirror the exclusion or add a warning. `src/domain/portRelationRegistry.ts:106` (also `:108`, `:115`); activation at `src/state/useProjectStore.ts:1024-1035`; missing guard around `src/domain/diagnostics.ts:112-130`.
- **[P2]** No diagnostic flags an outbound/endpoint/NTP `detour` that points at a non-dialable target (block/selector/urltest/dns). `diagnostics.ts` validates only existence of the detour tag (`src/domain/diagnostics.ts:112-130`, `:411-417`, `:1312-1319`), not dialability. Low impact; pairs with the P2 above.
- **[P2]** Inspector deprecation banner is informational only — no one-click "Migrate to route action=reject" affordance (delete block + flip referencing `route.rules[].outbound` to `action:"reject"`). Nice-to-have, not required for correctness. `src/components/Inspector.tsx:3364-3369`.

SUMMARY: 0 P0, 0 P1, 3 P2.
