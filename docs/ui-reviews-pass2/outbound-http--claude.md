# outbound-http — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The `outbound-http` node is in good shape and pass-1 (`docs/ui-reviews/outbound-http.md`) is now badly stale: every pass-1 P0/P1 has shipped. All official protocol-specific fields (`server`, `server_port`, `username`, `password`, `path`, `headers`) are first-class in the Inspector with correct controls, password masking, and a key/value header repeater; TLS + Dial shared cards render with the full outbound surface; and diagnostics enforce required `server`/`server_port`. Remaining issues are minor: the Palette is still a non-shipping `setup` badge, the `server` input writes an empty string instead of clearing, and the TLS card is missing an explicit `enabled` required-with-TLS hint.

## 1. Left Palette

- Present, correct category. `Outbounds` group → `{ label: "HTTP", kind: "http-out", icon: Globe2, docsUrl: docs("outbound/http/"), status: "setup" }` (`src/components/Palette.tsx:156`).
- Kind→type map correct: `"http-out": "http"` (`src/domain/protocols.ts:5`); `"http"` is in `CREATABLE_OUTBOUND_TYPES` (`protocols.ts:28`); preferred tag `http-out` (`protocols.ts:150`).
- `status: "setup"` → the button is actionable (`canActivate` allows `setup`, `Palette.tsx:279-287`) and calls `createFromPalette("http-out")`, so click-to-create DOES work. But the badge text reads "Setup" and the tooltip says "Add … setup draft to canvas" (`Palette.tsx:269`), signalling an unfinished node even though the Inspector/diagnostics are now complete. Pass-1's "non-clickable status badge / no add action" claim (lines 87, 41-43 of pass-1) is STALE — it is clickable.
- `icon: Globe2` is shared with HTTP inbound, several DNS servers, and HTTP clients — no inbound/outbound differentiation. Cosmetic only.

## 2. Canvas Node

- Node kind `outbound`, type `http`. Titlebar renders `outbound / http` (`src/components/SbcNode.tsx:291`). Icon = `Shield` (default branch of `outboundIcon`, `SbcNode.tsx:52-58`) — shared with most proxy types; acceptable.
- Subtitle now shows `http <server>:<server_port>` via `graph.ts:401-402` (`outbound.server ? \`${type} ${server}:${server_port ?? ""}\``). Pass-1's "no server:port on canvas" gap (line 124) is STALE / RESOLVED.
- Status pill reflects per-node diagnostics (`status: diagnosticStatus("/outbounds/${index}")`, `graph.ts:404`), so a missing `server`/`server_port` now flips the node to `error` (see §Findings). Pass-1's "status not HTTP-specific" note (line 125) is STALE.
- `compatible` is `[]` for a plain http outbound (`graph.ts:405-428` only populates groups), so the big `+` affordance and chip row are correctly absent for http. Good.
- Ports — correct (see §3): http is not in the `["block","selector","urltest","dns"]` exclude set, so the left input ports + the single right `dial-detour` output render.

## 3. Upstream/Downstream Links

Official relationship model for an `http` outbound: referenced by route `final`, route `rules[].outbound`, selector/urltest `outbounds[]`, dns `servers[].detour`, other outbound/endpoint/service/ntp `detour`, rule_set `download_detour`, clash external-ui detour, v2ray stats; and it emits its own outbound `detour` (Dial Fields).

Input endpoints generated for `outbound` (`portRelationRegistry.ts`, via `portEndpointsForNode`): `route` (route-final), `route-rule`, `selector-group`, `urltest-group`, `dns-detour`, `detour-target` (shared by outbound-detour/endpoint-detour/ntp-detour), `service-detour` (ccm/ocm), `rule-set-download`. Output: `dial-detour` (outbound-detour, excludes block/selector/urltest/dns, `portRelationRegistry.ts:106`).

- All canonical reference edges present and correctly typed. No extra/phantom links.
- `referenceRegistry` outbound paths (`referenceRegistry.ts:334`) cover `/route/final`, `/route/rules/*/outbound`, `/outbounds/*/outbounds`, `/outbounds/*/default`, `/outbounds/*/detour`, `/dns/servers/*/detour`, `/endpoints/*/detour`, `/services/*/detour`, `/route/rule_set/*/download_detour`, `/ntp/detour`, clash external-ui detour, v2ray stats, and inline http_client detour (`replaceInlineHttpClientOutboundRefs`). Rename/delete correctly cascade.
- Minor: `service-detour` input port only matches services of type `ccm`/`ocm` (`portRelationRegistry.ts:109-110`); `derp` uses `verify_client_endpoint` (endpoint ref, not outbound) so that is correct, but other service types that take a plain `detour` (e.g. resolved/ssm-api) have no port. Systemic across all outbounds, not http-specific. [P2]
- `isPortConnected` for `detour-target` excludes self (`outbound.tag !== value`, `SbcNode.tsx:177`) — correct, prevents an http outbound showing as its own detour.

## 4. Right Inspector (fields)

Block gated on `ref.kind === "outbound"` (`Inspector.tsx:3242`); http-specific UI at `Inspector.tsx:3737-3805`. `outboundHandledFields` now includes `username`, `password`, `path`, `headers` (`Inspector.tsx:198-227`), so nothing falls through to the Advanced accordion.

| Official field | Required | UI control | State |
|---|---|---|---|
| `server` | Yes | text input (`Inspector.tsx:3376-3384`, gated `"server" in entity`) | OK; but clear writes `""` not `undefined` (line 3381) |
| `server_port` | Yes | number input w/ per-type default placeholder 8080 (`3385-3414`) | OK; coerces non-positive → undefined |
| `username` | No | text input (`3449-3457`, gated `["http","socks","naive"]`) | OK; empty→undefined |
| `password` | No | `SensitiveTextField` masked + reveal (`3458-3464`) | OK; masked, empty→undefined |
| `path` | No | text input (`3739-3746`, `data-testid=outbound-http-path`) | OK; empty→undefined |
| `headers` | No | key/value repeater fieldset (`3747-3803`, `data-testid=outbound-http-headers`), add/rename/remove | OK; object, prunes to undefined when empty |
| `tls` | No (object) | shared TLS ModuleCard; http ∈ `outboundTlsTypes` (`sharedFieldRegistry.ts:151,180`) | OK; full outbound surface incl. utls/ech/reality/fragment (`Inspector.tsx:1509-1547`) |
| Dial Fields | No | shared Dial ModuleCard; http ∈ `outboundDialTypes` (`sharedFieldRegistry.ts:150,179`) | OK; all dial fields incl. detour-as-select (`Inspector.tsx:1476-1500`) |

Pass-1 §"Gap analysis" (lines 160-200) and its P0/P1 (headers invisible, missing server/port diagnostics, username/password unlabeled, path not surfaced) are ALL STALE — every item shipped. Pass-1 P1 "headers needs structured editor" is satisfied by the repeater.

Notes:
- `tls.enabled` toggle present (`Inspector.tsx:1510`); TLS is the outbound shape (client-only fields labelled "client only", server/reality fields labelled "server-only" and gated by `reality.enabled`). No inbound-only leakage that would write an invalid http outbound. Matches `shared/tls.md` Outbound section.
- `headers` value editor coerces every value to string (`3776-3777`) — correct for `map[string]string`.
- No raw-JSON write path for http (the generic `AdvancedNonScalarFields` is skipped because `headers` is handled), so the pass-1 "invalid-JSON write" risk does not apply here.

## Findings (prioritized)

- [P1] Palette still presents http as `status: "setup"` (`src/components/Palette.tsx:156`); badge reads "Setup" and tooltip implies a draft, despite Inspector + diagnostics being complete. Promote to `ready: true` so the badge reads "Add" and matches socks/selector/urltest. (socks is already `ready: true` at `Palette.tsx:155` with identical field completeness — http is inconsistent.)
- [P2] `server` input writes empty string on clear instead of `undefined` (`src/components/Inspector.tsx:3381`: `onChange={(e) => updateField(ref, "server", e.target.value)}`). Diagnostics still flag the empty value (so no silent invalid export), but it is inconsistent with `path`/`username` (`|| undefined`) and leaves a `"server": ""` key in the exported JSON. Use `event.target.value || undefined`.
- [P2] `service-detour` input port matches only `ccm`/`ocm` services (`src/domain/portRelationRegistry.ts:109-110`); service types that take a plain `detour` outside those (systemic, not http-specific) cannot link to this outbound on canvas, though `referenceRegistry` (`referenceRegistry.ts:334` `/services/*/detour`) still rename/delete-cascades them.
- [P2] Dial card shows all dial fields even when `detour` is set, but `shared/dial.md:71` states "If [detour is] enabled, all other fields will be ignored." No hint/disable when detour is non-empty (systemic across all dial owners). Consider dimming non-detour dial fields when `detour` is set.

SUMMARY: 0 P0, 1 P1, 3 P2.
