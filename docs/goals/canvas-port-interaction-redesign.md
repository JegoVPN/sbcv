# Canvas Port Interaction Redesign + Data-Integrity Repair

## Outcome

Two parallel tracks land:

1. **Data-integrity repair** — the canonical config never drifts from what the user can see and edit. Every gesture (port click, port drag, chip pick, inspector edit, JSON import, edge delete, tag rename, entity delete, entity type change) leaves the `SingBoxConfig` in a state that round-trips through `parseConfigJson → stringifyConfig → parseConfigJson` and passes `validateConfig` with no diagnostics that the user did not consciously introduce. References (`route.final`, `dns.final`, `outbound.detour`, `outbound.outbounds[]`, `outbound.domain_resolver`, `endpoint.detour`, `endpoint.domain_resolver`, `dns-server.detour`, `dns-server.endpoint`, `dns-server.service`, `dns-server.domain_resolver`, `service.detour`, `service.verify_client_endpoint`, `service.servers`, `rule-set.download_detour`, `rule-set.http_client`, `route.rules[].outbound/inbound/rule_set`, `dns.rules[].server/inbound/rule_set`, `route.default_domain_resolver`, `route.default_http_client`, `experimental.clash_api.external_ui_download_detour`, `experimental.v2ray_api.stats.inbounds/outbounds`, `ntp.detour`, `certificate_providers[].endpoint`) all stay consistent across delete, rename, and type-change cascades. Stale `selectedId` / `focusedNodeId` / `layout.positions` entries are scrubbed in lockstep.

2. **Port interaction redesign** — clicking a port pulls a dangling connection line that follows the cursor. The user drops it on a valid target Handle to connect, or in empty pane space to open a compatible-type picker that creates the target node and wires it. Click and drag converge on the same domain command for the same `(node.kind, port.key, target.kind)` pair so the same gesture produces the same canonical config mutation.

Once shipped:

- No port click silently auto-picks "first existing X" or auto-creates a placeholder rule/detour. The user always sees what is about to wire before the config mutates.
- Every port declared by `getPortSpecs` is reachable via both click and drag and resolves to a real, validated wiring (no inert ports).
- Every edge graph.ts emits has a working delete handler in `commands.ts` (`onEdgesDelete` actually disconnects).
- A vitest suite proves click and drag mutations are byte-identical for each port pair, and a fixture suite proves every fixture survives `delete → undo → rename → undo → type-change → undo` without losing entities or producing diagnostics.

## Scope

In scope (modified files):

- `src/components/SbcNode.tsx`, `CanvasWorkspace.tsx`, `Inspector.tsx`, `InspectorPanels.tsx`, `Palette.tsx`, `MobileInspectorSheet.tsx`
- `src/state/useProjectStore.ts`
- `src/canvas/graph.ts`
- `src/domain/commands.ts`, `indexes.ts`, `diagnostics.ts`, `diagnosticTargets.ts`, `serialization.ts`, `sharedFieldRegistry.ts`
- `tests/*.test.ts` and `e2e/*.spec.ts` — new suites per PR
- This file

Out of scope:

- New sing-box protocols or node kinds
- Inspector form rebuild beyond targeted rename / tagDraft fixes
- React Flow major-version upgrade
- Visual restyle beyond what the new interaction requires
- Mobile-only redesign (mobile keeps the existing inspector-sheet path; we just stop regressing it)
- Server-side / wrangler / container changes

## Source Docs

- [AGENTS.md](../../AGENTS.md) — non-negotiables (signed commits, small atomics, no silent validation gaps, no unrelated cleanup, React performance discipline)
- [Goal-Driven Development](../goal-driven-development.md)
- [SBC React Flow R&D Plan](../sbc-react-flow-rd-plan.md) — `SingBoxConfig` is the source of truth, canvas is derived
- [sing-box Canvas Configuration Guide](../sing-box-canvas-configuration-guide.md)
- `vercel-react-best-practices` skill — frontend skill gate applies
- React Flow `onConnectStart` / `onConnectEnd`: https://reactflow.dev/api-reference/types/on-connect-start
- React Flow `onNodesDelete` / `onEdgesDelete`: https://reactflow.dev/api-reference/types/react-flow-props

## Background — Comprehensive Audit (2026-05-28)

Cross-references `getPortSpecs` (SbcNode.tsx L66-217), `togglePortConnection` (useProjectStore.ts L773-1260), `connectPorts` (L762-771), `connectDirectedPortReference` (L362-479), `createCompatible` (L659-697), `connectOutboundReference` (L699-760), `disconnectEdge` (commands.ts L1189-1265), `deleteEntity` (commands.ts L1077-1187), `renameTag` (commands.ts L981-1075), `changeEntityType` (commands.ts L886-959), `updateEntityField` (commands.ts L832-884), `connectSelectorCandidate` (commands.ts L817-830), and the create* default-scaffold helpers.

Findings are graded P0 (data destruction or app un-functionality) / P1 (incorrect mutation, broken cascade, or visible UX defect) / P2 (latent fragility, cleanup, perf).

### P0 — destructive or non-functional

P0-1. **Destructive click on populated hub ports.** `togglePortConnection` for `route` → `route-rule` (L1057-1061) and `dns` → `dns-rule` (L1131-1135) deletes the LAST rule when rules already exist. Clicking the "+" affordance on a populated hub destroys data. Same shape on `outbound (selector/urltest)` → `outbound-member` (L1103-1113) which disconnects the last candidate.

P0-2. **Click adds unbounded duplicates without a disconnect path.** `route` ← `inbound` click (L778-781) and `dns` ← `inbound-query` click (L806-809) both call `addInbound("tun")` unconditionally. `isPortConnected` (SbcNode L244, 250) returns true the moment any inbound exists, so the port shows "connected" but every click adds another tun inbound. No code path disconnects.

P0-3. **`dns` → `dns-server` click creates a dangling server.** L1137-1141: `addDnsServer(config, "local")` but no `setDnsFinal`. The symmetric `route` → `outbound` click (L1063-1072) does call `setRouteFinal`. Asymmetry creates orphan dns servers each click.

P0-4. **`createCompatible(route:main, "Route")` silently overwrites `route.final`.** L673-675: when `kind === "Route"` no outbound is created, so `latestOutbound` is the pre-existing last outbound. `setRouteFinal(latestOutbound.tag)` replaces whatever final the user had. Same hazard at L682-684 for `dns:main` + `DNS Server` / `DNS Tailscale Server`.

P0-5. **`createCompatible` writes `outbounds[]` onto non-group outbounds.** L677-679 unconditionally calls `connectSelectorCandidate(sourceTag, latestTag)` when `sourceParts[0] === "outbound"`. `connectSelectorCandidate` (commands.ts L817-830) injects an `outbounds: [...]` field into any outbound type — including `http`, `direct`, `vmess`, etc. Currently `compatible` is empty for non-group outbounds so the bug is unreachable from the UI; a single future change to that policy exposes it.

P0-6. **Inspector tag rename clobbers selection and in-flight edits.** Inspector.tsx L2092 `onBlur` calls `renameTag(tagValue, tagDraft)`. After rename, `selectedId` still points to the OLD node id (`outbound:proxy`), the `entity` useMemo (L1754) returns null, `if (!ref || !entity) return null` (L1783) unmounts the entire inspector. Additionally the `useEffect` at L1778-1781 re-syncs `tagDraft` from `entity.tag` on EVERY config mutation, so typing a new tag while clicking any sibling control silently overwrites the typed value.

P0-7. **`renameTag` does not check tag uniqueness.** commands.ts L981 only early-returns on empty/identical input. Renaming `outbound:proxy` to a tag that already exists on another entity produces two entities with the same tag — invalid serialization, broken validators.

P0-8. **`deleteEntity` / `moveRouteRule` / `moveDnsRule` / `deleteRouteRule` / `deleteDnsRule` never adjust `selectedId`, `focusedNodeId`, or `layout.positions`.** useProjectStore.ts L1282 + L1289-1293. After deleting a selected node, `selectedId === "outbound:proxy"` persists; `Inspector.tsx:48-64 selectedRefFromId` does no existence check and returns a ref pointing at the deleted entity, so the inspector renders for ghost data. After `moveRouteRule(2, 1)` the selected rule visibly moves but `selectedId === "route-rule:2"` now points at the OTHER rule. After `deleteRouteRule(2)` every index > 2 shifts down — `selectedId === "route-rule:5"` silently inspects what was rule 6.

P0-9. **`disconnectEdge` silently no-ops on 11 edge id formats.** commands.ts L1189-1265 parses these relations: `route-final`, `route-rule`, `route-rule-inbound`, `selector`, `urltest`, `dns-final`, `dns-rule`, `dns-rule-inbound`, `route-rule-set`, `dns-rule-set`, `dns-server-endpoint`, `endpoint-detour`. graph.ts emits these ADDITIONAL formats that have no handler: `inbound` (L249 `edge:inbound:${tag}:route`), `route-rule-order` (L308), `outbound-detour` (L461), `rule-set-download` (L505), `dns-server-detour` (L561), `dns-server-service` (L572), `dns-rule-order` (L609), `service-detour` (L686), `service-verify-endpoint` (L692), `service-ssm-inbound` (L697), `settings-ntp-detour` (L709). `CanvasWorkspace.tsx:114` wires `onEdgesDelete={(deleted) => deleted.forEach((edge) => disconnectEdge(edge.id))}`. Selecting any of these edges and pressing Delete makes the edge vanish from React Flow local state, but the underlying config is unchanged, so the next derive puts it back.

P0-10. **`Delete` keypress on a focused node never deletes the entity.** CanvasWorkspace.tsx L138 sets `deleteKeyCode={isMobile ? null : ["Backspace", "Delete"]}` but does NOT wire `onNodesDelete`. React Flow removes the node from its local state, the next derive re-adds it.

P0-11. **`renameTag` misses at least 5 classes of references.** commands.ts L981-1075 rewrites the obvious tag fields (outbound tag, outbounds[], default, detour, route.final, route.rules[].outbound/inbound, dns.rules[].server/inbound, dns.final, services[].detour/verify_client_endpoint, dns-server[].detour/endpoint, endpoint.detour, rule-set.tag/download_detour). It does NOT rewrite:
- `dns-server[type=resolved].service` (referenced from `createDnsServer` defaults at L670, validator at diagnostics.ts L1101-1113)
- `rule-set[].http_client` (referenced from `templates.ts:604-619`)
- `outbound[].domain_resolver` (string or `{server: tag}` shape; templates.ts:1038-1109)
- `endpoint[].domain_resolver`
- `dns-server[].domain_resolver`
- `route.default_domain_resolver` (string or `{server: tag}`; templates.ts:547-549/685/734)
- `route.default_http_client`
- `experimental.v2ray_api.stats.inbounds[]` / `experimental.v2ray_api.stats.outbounds[]` (validator at diagnostics.ts L1353-1386)

The validator only checks the forward tag map and never these reverse references, so the user gets a silently-broken config with no diagnostic.

P0-12. **`deleteEntity` cascades miss the same set.** commands.ts L1077-1187:
- `deleteEntity` for `dns-server` does NOT clear `outbound.domain_resolver` / `endpoint.domain_resolver` / `dns-server.domain_resolver` / `route.default_domain_resolver` references (L1144-1152).
- `deleteEntity` for `service` is a one-liner `filter` (no cascade) — does not clear `dns-server[type=resolved].service` (L1170+).
- `deleteEntity` for `endpoint` does not clear `services[].verify_client_endpoint` (L1153-1166) when called from change-type-from-tailscale.
- `EntityRef` (types.ts L136-147) has no `http-client` or `certificate-provider` arm; those entity types are indexed (indexes.ts L61-66) but cannot be deleted through the canonical command.

P0-13. **`diagnosticStatus` over-attributes diagnostics via `startsWith` without separator.** graph.ts L90-97 filters `diagnostics.filter(d => d.path.startsWith(pathPrefix))`. `/outbounds/1` is a prefix of `/outbounds/10`, `/outbounds/11`, … `/outbounds/19`. The node for `outbound[1]` inherits error/warning level from every two-digit-index sibling. Same for `route-rule:1` vs `route-rule:10..19`, every collection ≥ 10. Jego.json has 46 outbounds — every single-digit-index outbound inherits state from ≥ 1 two-digit-index sibling.

### P1 — incorrect mutation or visible UX defect

P1-1. **Graph re-derivation overwrites local node positions mid-drag.** CanvasWorkspace.tsx L84-87: `useEffect setNodes(graph.nodes)` fires on any `graph` reference change (any config / diagnostics / layout mutation, including async `runOfficialCheck` completion). The dragged node snaps back to layout-computed position and `onNodeDragStop` (L122) doesn't fire because the drag was visually interrupted. React Flow's selection state inside nodes is also reset.

P1-2. **`dial-detour` write does not check `supportsOutboundDetour`.** useProjectStore.ts L1116-1129 (click) and L473-475 (drag) call `updateEntityField(..., "detour", target)` unconditionally. `supportsOutboundDetour` (L304) exists but only `connectCreatedOutboundForSelection` (L305-348) consults it. Result: `{type: "selector", detour: "direct"}` is silently produced and sing-box rejects.

P1-3. **Route-rule `outbound` write ignores `rule.action`.** useProjectStore.ts L405-408 (drag) and L1074-1084 (click). Writing `outbound` onto a rule whose `action` is `reject` / `resolve` / `hijack-dns` is invalid sing-box. `graph.ts:312-315` filters edges by `routeRuleOutboundAllowed` but the mutation path itself doesn't.

P1-4. **`createDnsServer("tailscale")` ships without `endpoint`.** commands.ts L590-678 (helper for "tailscale" branch defaults). The validator at diagnostics.ts L1116-1124 emits error `dns-server-tailscale-endpoint-missing` immediately on creation. Palette "Add Tailscale DNS Server" produces a config that won't start.

P1-5. **`createRuleSet` fallback hardcodes `type: "remote"`.** commands.ts L688-711 — passing any unknown type yields a `remote` rule-set silently relabeled. `addRuleSet(config, "weird-type")` produces a misleading node.

P1-6. **`service:resolved ↔ dns-server:resolved` port pair is completely dead.** SbcNode.tsx L131-140 declares input on `service:resolved` with `nodeKind: "dns-server", nodeType: "resolved"`. SbcNode.tsx L187 declares output on `dns-server:resolved` with `nodeKind: "service", nodeType: "resolved"`. `connectDirectedPortReference` and `togglePortConnection` have ZERO branches for this pair. Both handles render with `+` but click does nothing; drag fails `isValidConnection`. Worse: graph.ts L568-580 DOES emit the edge when the dns-server has a `service` field — so users see an existing edge they can't disconnect or recreate.

P1-7. **`inbound` → `route-rule-match` / `dns-rule-match` click only disconnects FIRST referencing rule.** useProjectStore.ts L1015-1023, L1026-1034. `firstRouteRuleInboundIndex` returns one index; the toggle removes the inbound from that single rule. If the inbound appears in N rules, repeated clicks remove one at a time. The port still reads "connected" via `isPortConnected` until all N are clicked off.

P1-8. **Inspector subscribers are too broad — keystroke = full tree rerender.** Every node in the visualized graph subscribes to `state.config` (SbcNode.tsx L381). Each rerender runs `getPortSpecs` and `isPortConnected` for every port. For N nodes × P ports, every keystroke in any inspector field triggers O(N × P) full-config scans. `Inspector.tsx:1744`, `TopBar.tsx:27`, `Palette.tsx:299`, `RuleTables.tsx:69/169`, `MobileMenuSheet.tsx:22` all use the same broad selector. Per `vercel-react-best-practices`, replace with narrow selectors / `useShallow`.

P1-9. **`outbound.outbounds[]` iteration not gated on `isOutboundGroup`.** graph.ts L444-457: `if (Array.isArray(outbound.outbounds))` allows imported JSON where a non-group outbound has `outbounds[]` to emit edges whose `targetHandle` is forced to `selector-group` / `urltest-group`. Those handles don't exist on non-group candidates — edges render orphaned.

P1-10. **Route rules > 24 silently drops every rule node and every derived edge.** graph.ts L273-323: the visualization cap `MAX_VISUAL_RULE_NODES = 24` skips the entire loop. Outbounds referenced by the dropped rules lose their `routeTargetY.set` anchor and collapse to the column fallback. The hub still says "N ordered rules" with no children — looks like data loss to the user.

P1-11. **`experimental.clash_api.external_ui_download_detour` has no edge.** graph.ts L702-718 only special-cases NTP. The validator at diagnostics.ts L1391-1399 already flags dangling references, but the user sees no visual link to delete/rename through.

P1-12. **`changeEntityType` (endpoint from tailscale → other) does not scrub `services[].verify_client_endpoint`.** commands.ts L919-934 cleans `dns-server.endpoint` and `certificate_providers[].endpoint` but leaves derp service's `verify_client_endpoint` array pointing at a now-non-tailscale endpoint. Validator demotes from error to warning, but the data persists.

P1-13. **`importJson` and `applyJsonDraft` diverge.** useProjectStore.ts L1313-1331 (importJson) resets `layout.positions`, `selectedId`, `globalPanelOpen`, bumps `freshLoadToken`. L1295-1312 (applyJsonDraft) only calls `sync()`. Same JSON content takes two different paths; applyJsonDraft leaves stale selection / layout pointing at entities that may not exist in the new config.

P1-14. **`setChannel`, `setTarget`, `loadTemplate*`, `loadMinimal`, `importJson` all leave `officialDiagnostics` stale.** Old binary's reported errors stay on screen for a freshly-loaded config. useProjectStore.ts L520-525, L526-534, L536-567, L1313-1331.

P1-15. **`validateNow` setTimeout has no cleanup or debounce.** useProjectStore.ts L1333-1352. Two rapid clicks queue two callbacks; both write back-to-back, racing. Last write wins for `checkNotice`. No cancellation on unmount.

P1-16. **`runOfficialCheck` has no concurrency guard or cancellation.** useProjectStore.ts L1353-1437. Three rapid clicks fire three fetches; the slowest response wins. The `config` captured at L1358 may not match current state by the time the response lands.

P1-17. **Decorative ports.** SbcNode.tsx L213-215 declares `settings:ntp` output `dial-detour`. `togglePortConnection` has no `node.kind === "settings"` branch and `connectDirectedPortReference` has no `(settings, …)` pair. SbcNode.tsx L75 declares `dns ← inbound-query` input; click handler L806-809 only calls `addInbound("tun")` with no wiring, and no inbound output port matches `inbound-query`.

P1-18. **`certificate_providers` has no edges in graph but `endpoint` field references endpoints.** graph.ts has no handling for `certificate_providers[].endpoint`. Similar to clash_api download detour above — silent reference.

### P2 — latent / cleanup / perf

P2-1. **Two duplicate ports per Handle.** SbcNode.tsx L437-448, L476-487 render `type="target"` AND `type="source"` Handle pair with the SAME `id` for each port. React Flow's behavior for duplicate-id handles is undefined; `connectionMode=Loose` (CanvasWorkspace L128) papers over it via `?? connectDirectedPortReference(target, …, source, …)` in `connectPorts` (L769).

P2-2. **`connectionDragThreshold=1` + `connectionRadius=54`.** CanvasWorkspace.tsx L128-130. On trackpads almost every mousedown produces 1px of motion before mouseup; legitimate clicks register as drag attempts. Either bump threshold to ≥4 or rely on the redesign in PR-9 to remove the need.

P2-3. **`getSelectedRef` dead code with bugs.** useProjectStore.ts L1449-1472. Not imported anywhere (Inspector defines its own at Inspector.tsx L48-64). Uses `[kind, rest] = split(":")` so colon-tags break. Also unguarded against missing entities.

P2-4. **`replaceTagRef` and `replaceRuleSetRef` are duplicates.** commands.ts L961-979. Two copies of the same function — refactor residue.

P2-5. **`addDnsServer` auto-sets `dns.final` to the new server.** commands.ts L445-452. Convenient for the first server, surprising for subsequent `fakeip` / `hosts` adds. No equivalent for `addOutbound`. Inconsistent.

P2-6. **`getUniqueTag` does not strip `-N` suffix.** indexes.ts L103-111. `getUniqueTag(cfg, "proxy-2")` when "proxy-2" exists yields "proxy-2-2", then "proxy-2-3". Naming hygiene.

P2-7. **`http_clients` / `certificate_providers` indexed but not deletable.** indexes.ts L61-66 indexes both; `EntityRef` (types.ts L136-147) has no arm; `deleteEntity` (commands.ts L1077-1187) cannot reach them.

P2-8. **`ruleSetTargetY` race.** graph.ts L283 (route-rule write) and L468-470 (dns-rule write). First-write-wins, route-rule iteration runs first, so dns-rule's position is silently dropped. Stable for a fixed config; flipping iteration order would shift layout.

P2-9. **Palette types that no-op on click.** useProjectStore.ts L594-595 / L633-634 / L644. `cloudflared`, `wireguard` outbound (now endpoint), `dns` outbound (deprecated), `legacy` dns, `mdns` dns — palette surfaces them, click does nothing. Either drop from palette map or wire creation.

P2-10. **`entityTag` vs inspector display.** graph.ts L133-135 produces `untagged-${kind}-${index+1}`. RuleTables.tsx L137/237 and Inspector.tsx L1047/1281 render `untagged-${index+1}` (no kind). The "click diagnostic to focus" path lands on the long form; the inspector shows the short form. Cosmetic but visible.

P2-11. **`canvas-selection-pill` shows raw node id.** CanvasWorkspace.tsx L183: `Selected outbound:my-tag` instead of the title.

P2-12. **Memory growth in `layout.positions`.** No cleanup on `deleteEntity` / `renameTag` / `changeEntityType` (positions are per-id, ids change on rename) — long sessions accumulate stranded entries.

P2-13. **`focusedNodeId` is never reset.** useProjectStore.ts L504-510 sets it on `focusNode`; nothing clears it. After deleting the focused node, the next focus action re-fits view on a non-existent node.

P2-14. **`connectPorts` always calls `sync()` even when the inner command was a no-op.** Several `connectDirectedPortReference` branches return an unchanged config (`ensureRoute` on existing route, `config.dns ? config : addDnsServer(…)`). `sync()` is structured-clone + stringify + validate — expensive for no semantic change.

P2-15. **`ensureManagedShadowsocksInbound` clones the config four times in sequence.** useProjectStore.ts L284-294: one `addInbound` + three `updateEntityField` chained via cloneConfig. Should fold into a single mutation.

P2-16. **Edge id `:` separator vs colon-in-tag.** disconnectEdge L1191 uses `split(":")`; tag containing `:` would mis-parse. `renameTag` does not forbid `:` in user input.

P2-17. **`useViewport` per-component listeners.** Each consumer registers its own `matchMedia.addEventListener`. With many components, that's many redundant listeners.

P2-18. **`stripUndefined` reorders JSON keys.** serialization.ts L9-23. `delete` then re-`set` re-appends at insertion-order tail; user's original property order is not preserved across edits.

P2-19. **`normalizeConfig` accepts any object.** serialization.ts L25-30. Malformed shapes pass and silently turn into `[]` via downstream `listItems`.

P2-20. **`addService("ssm-api")` injects hardcoded shadowsocks password.** commands.ts L284-294. `"Q7WI7Eid7AOHSdFDw3bkdA=="` placeholder ships in user exports.

## Approach

Two parallel tracks. Data-integrity (P0 / most P1) lands as discrete PRs first. The interaction redesign lands as a single architectural PR behind a feature flag once the integrity floor is solid. Each PR is independently revertable; merging is squash-only so each PR contributes exactly one commit to `main`.

```
Data-integrity track (PRs 1-7):
  PR-1 stop destructive click + Delete key wiring
  PR-2 selection / layout sync on delete / rename / move / type-change
  PR-3 complete disconnectEdge for all 11 missing edge formats + onNodesDelete handler
  PR-4 reference scrubbing on delete + rename for domain_resolver / dns-server.service / http_client / cert_provider.endpoint / v2ray_api.stats
  PR-5 source-type guards on connectSelectorCandidate / updateEntityField(detour) / route-rule outbound / createCompatible
  PR-6 default scaffolds pass validator (createDnsServer tailscale, createRuleSet fallback, audit every create*)
  PR-7 wire / remove decorative ports + service:resolved pair + missing clash_api edge

Architectural track (PRs 8-9):
  PR-8 derivation correctness — diagnosticStatus path-prefix fix, outbound.outbounds[] guard, route-rules cap UX banner, ruleSetTargetY race, MAX_VISUAL cap visibility
  PR-9 click = pull-line + chip popover (behind VITE_PORT_CLICK_DRAGS flag)

Hygiene track (PRs 10-12):
  PR-10 stale state cleanup (officialDiagnostics on channel/import, validateNow debounce, runOfficialCheck cancellation, tagDraft useEffect, drag-mid-derive guard, focusedNodeId reset)
  PR-11 perf — narrow store subscriptions (SbcNode / Inspector / RuleTables / MobileMenuSheet)
  PR-12 symmetry test suite + final coverage audit
```

PR-1 through PR-7 do NOT depend on each other for ordering inside the data-integrity track; they share files (`commands.ts`, `useProjectStore.ts`) but in disjoint regions and are easy to rebase. PR-8 is largely independent. PR-9 depends on PR-1 through PR-6 being merged. PR-10 / PR-11 are independent. PR-12 depends on PR-9.

## Atomic Tasks (one PR each)

### PR-1 — Stop destructive click handlers + wire `onNodesDelete`

Fixes P0-1, P0-2, P0-3, P0-10.

- `useProjectStore.togglePortConnection`:
  - `route → route-rule` (L1057), `dns → dns-rule` (L1131): if rules exist, return state unchanged. Adding rules moves to the rule table panel; deletion is explicit there.
  - `outbound (selector/urltest) → outbound-member` (L1103): if candidates exist, return state unchanged.
  - `route ← inbound` (L778) and `dns ← inbound-query` (L806): if any inbound exists, return state unchanged. Adding inbounds is the palette's job.
  - `dns → dns-server` (L1137): if no `dns.final`, addDnsServer THEN setDnsFinal — mirror the `route → outbound` symmetric handler at L1063.
- `CanvasWorkspace.tsx`: add `onNodesDelete={(deleted) => deleted.forEach((n) => { const ref = refFromId(n.id); if (ref) deleteEntity(ref); })}` so Delete on a focused node actually removes the entity.
- New test file `tests/port-interaction-destructive.test.ts` exercises each line above and asserts no mutation occurs on the destructive path.

### PR-2 — Selection / layout / focus sync on delete, rename, move, type-change

Fixes P0-6, P0-7, P0-8, P1-12.

- Wrap `deleteEntity`, `deleteRouteRule`, `deleteDnsRule`, `renameTag`, `changeEntityType` in store-level reducers that:
  - Clear `selectedId` / `focusedNodeId` if they point at the deleted entity.
  - Re-point `selectedId` / `focusedNodeId` at the renamed entity when the rename succeeds.
  - Scrub `layout.positions[oldId]` and copy to `layout.positions[newId]` on rename (where applicable).
  - For `moveRouteRule` / `moveDnsRule`: if `selectedId === "route-rule:${oldIndex}"`, update to the new index.
- `Inspector.tsx`:
  - Add tag-uniqueness check before calling `renameTag` (use `getTaggedEntities` from indexes.ts). Surface inline error; do NOT call rename if duplicate.
  - Remove the `useEffect (L1778-1781)` that overwrites `tagDraft` on every config change. Only re-sync `tagDraft` when `entity.tag` changes AND the input is not focused.
- `commands.renameTag`: add a return value or thrown error on uniqueness violation; store wrapper handles surfacing.
- New tests in `tests/domain.test.ts` for rename uniqueness; new tests in `tests/app.test.tsx` for selection survival across delete/rename/move/type-change.

### PR-3 — Complete `disconnectEdge` for every edge graph.ts emits

Fixes P0-9.

- Enumerate every `makeEdge(...)` site in `graph.ts` (~17 distinct prefixes). For each not currently handled by `disconnectEdge` (commands.ts L1189-1265), add a handler that performs the inverse mutation:
  - `edge:outbound-detour:${tag}:${detour}` → clear `outbound[tag].detour`
  - `edge:rule-set-download:${tag}:${detour}` → clear `rule-set[tag].download_detour`
  - `edge:dns-server-detour:${tag}:${detour}` → clear `dns-server[tag].detour`
  - `edge:dns-server-service:${tag}:${service}` → clear `dns-server[tag].service`
  - `edge:service-detour:${tag}:${detour}` → clear `service[tag].detour`
  - `edge:service-verify-endpoint:${tag}:${endpoint}` → remove `endpoint` from `service[tag].verify_client_endpoint[]`
  - `edge:service-ssm-inbound:${tag}:${path}:${inbound}` → remove path from `service[tag].servers`, clear `inbound[inbound].managed`
  - `edge:settings-ntp-detour:${detour}` → clear `ntp.detour`
  - `edge:route-rule-order:${i}` / `edge:dns-rule-order:${i}` / `edge:inbound:${tag}:route` are informational; either skip silently (document) or remove the edge id entirely.
- Refactor disconnectEdge into a small table keyed by relation prefix; one tested function per relation.
- New tests in `tests/domain.test.ts` covering each disconnect.

### PR-4 — Reference scrubbing on delete + rename

Fixes P0-11, P0-12, P2-7.

- `commands.renameTag` rewrites ADDITIONAL reference sites:
  - `dns-server[].service`
  - `rule-set[].http_client`
  - `outbound[].domain_resolver` (string OR `{server: tag}` shape)
  - `endpoint[].domain_resolver`
  - `dns-server[].domain_resolver`
  - `route.default_domain_resolver` (string OR `{server: tag}`)
  - `route.default_http_client`
  - `experimental.v2ray_api.stats.inbounds[]` / `stats.outbounds[]`
- `commands.deleteEntity`:
  - `dns-server`: scrub all `domain_resolver` references across outbounds/endpoints/dns-servers/route.default.
  - `service`: scrub `dns-server[type=resolved].service` references.
  - `endpoint`: scrub `services[].verify_client_endpoint`.
  - Add new arms for `kind: "http-client"` and `kind: "certificate-provider"` (add to `EntityRef` union in types.ts).
- New tests in `tests/domain.test.ts` parameterized over every reference site.

### PR-5 — Source-type guards on connect / update functions

Fixes P0-4, P0-5, P1-2, P1-3.

- `commands.connectSelectorCandidate` (L817): early-return unchanged when `selectorTag`'s outbound type is not `selector` / `urltest`.
- `useProjectStore.createCompatible` (L673-679):
  - For `kind === "Route"` / `"DNS Server"` / `"DNS Tailscale Server"`: do NOT call `setRouteFinal` / `setDnsFinal` against pre-existing entities. Only when an entity was newly created in the same action.
  - For `sourceId outbound`: only call `connectSelectorCandidate` when the source is `selector` / `urltest`.
  - Replace `sourceId.split(":")` with `parseNodeId(sourceId)` so colon-tags work.
- `useProjectStore.togglePortConnection` for `dial-detour` (L1116) and `connectDirectedPortReference` for `dial-detour` (L473): early-return when target's outbound type is in `{block, selector, urltest, dns}` (i.e., `supportsOutboundDetour` is false).
- Same for route-rule `outbound` writes (L405, L1074): refuse when `rule.action` is in `{reject, sniff, resolve, hijack-dns}` (mirror the `routeRuleOutboundAllowed` filter from graph.ts).
- New tests for each guard.

### PR-6 — Default scaffolds pass validator

Fixes P1-4, P1-5.

- `commands.createDnsServer("tailscale")`: scaffold with a placeholder `endpoint` field that is `null` AND surface an inline inspector error explaining the user must wire an endpoint. Better: do NOT allow palette create until a tailscale endpoint exists (gate the palette item).
- `commands.createRuleSet`: throw on unknown type instead of silently relabeling to remote.
- Audit every `create*` helper in commands.ts against diagnostics.ts. Any default that fires an error or warning out of the box gets either:
  - Fixed scaffold (add the missing field with a sensible default).
  - Palette gating (the item is disabled until a precondition is met, with a tooltip).
- New tests in `tests/domain.test.ts` per type: `validateConfig(addX(emptyConfig, type), channel)` returns no `error`-level diagnostic for any creatable type.

### PR-7 — Wire or remove decorative ports

Fixes P1-6, P1-17, P1-18.

- Remove `dns ← inbound-query` from `getPortSpecs` (SbcNode.tsx L75). No sing-box semantic for inbound → dns hub.
- Wire `settings:ntp → dial-detour`: add `togglePortConnection` and `connectDirectedPortReference` branches that set `ntp.detour`.
- Implement `service:resolved ↔ dns-server:resolved` pair: add the missing connect/toggle/disconnect branches. Verify `graph.ts:567` edge can be created, modified, and removed via the new handlers.
- Implement the missing edges in `graph.ts`:
  - `experimental.clash_api.external_ui_download_detour` → outbound
  - `certificate_providers[].endpoint` → endpoint
- New tests for each newly-wired port; remove tests of the deleted port.

### PR-8 — Derivation correctness

Fixes P0-13, P1-9, P1-10, P2-8.

- `graph.diagnosticStatus`: change filter from `diagnostic.path.startsWith(pathPrefix)` to a strict-segment match. Use `(diagnostic.path === pathPrefix || diagnostic.path.startsWith(pathPrefix + "/"))`. Add regression tests parameterized over `/outbounds/1` vs `/outbounds/10..19` and friends.
- `graph.ts:444-457`: gate `outbound.outbounds[]` iteration on `isOutboundGroup(outbound)` (mirror the subtitle check at L408).
- `graph.ts:273-323`: when `routeRules.length > MAX_VISUAL_RULE_NODES`, still emit a "+N rules not visualized — open Rule Table" banner node OR keep visualizing but emit only one composite "many rules" node with a click-through. User must not see silent disappearance.
- `graph.ts:283` and L468-470 ruleSetTargetY race: document the iteration order (route-rule first, then dns-rule wins on tie) OR make it stable via second-writer-wins explicitly.

### PR-9 — Click = pull-line + chip popover (architectural)

Fixes the underlying UX root cause for P0-1 / P0-2 / P0-3 / P0-4 / P0-5 / P0-9-related click hostility.

- Land behind `VITE_PORT_CLICK_DRAGS` feature flag, default `true` in dev / `false` in prod for one release window.
- `CanvasWorkspace.tsx`:
  - Supply `onConnectStart` to record source `(nodeId, handle, type)`.
  - Supply `onConnectEnd` to detect drops on the pane (no `target` in event).
  - When drop is on a target Handle: existing `onConnect` → `connectPorts` (unchanged).
  - When drop is on empty pane: mount `<ChipPickerPopover>` at the cursor coordinates with the list of compatible types (reuse `graph.compatible`).
- `<ChipPickerPopover>`: same chip styling as the right-side card; selection calls a new store action `createNodeAndConnect(sourceId, sourceHandle, kind, dropXY)`.
- `useProjectStore.createNodeAndConnect`:
  - Build a registry table `src/domain/portRegistry.ts` keyed on `(sourceKind, sourceHandle, targetKind, targetHandle)` mapping to `{ create: (cfg) => [cfg, newTag], connect: (cfg) => cfg }`. The `connect` arm reuses the same callable as `connectDirectedPortReference`.
  - `pinLayout(newTag, dropXY)` so the new node materializes where the user dropped.
- Strip create-branches from `togglePortConnection`. Keep only disconnect branches. Rename action to `disconnectPortConnection`.
- `SbcNode.tsx`:
  - Remove the per-port click handler that called `togglePortConnection`. The Handle's natural drag start replaces it.
  - Render a small `×` overlay on connected port handles for explicit disconnect.
- New `e2e/port-click-redesign.spec.ts` covers: click-start, drag-to-target, drop-on-pane → chip pick → new node + edge, click-x → disconnect.

### PR-10 — Stale state cleanup

Fixes P1-1, P1-13, P1-14, P1-15, P1-16, P2-13.

- `useProjectStore.setChannel`, `setTarget`, `loadTemplate*`, `loadMinimal`, `importJson`, `applyJsonDraft`: all reset `officialDiagnostics`, `officialValidationMessage`, `checkNotice`, `focusedNodeId`.
- Unify `importJson` and `applyJsonDraft` — both should reset layout/selection equally.
- `validateNow`: debounce to 250ms; cancel previous timeout on new call.
- `runOfficialCheck`: add `AbortController`; if `isOfficialChecking` is true, abort the in-flight request before starting a new one. Compare `config` at response time to current `config`; discard stale results.
- `Inspector.tsx`: remove the `tagDraft` overwrite useEffect (already in PR-2 — keep here as the more explicit fix if PR-2 didn't fully resolve).
- `CanvasWorkspace.tsx:84-87`: do not call `setNodes(graph.nodes)` while a node is being dragged. Track drag state via `onNodeDragStart` / `onNodeDragStop` and defer the setNodes until drag ends.

### PR-11 — Perf: narrow store subscriptions

Fixes P1-8, P2-14, P2-15, P2-17.

- Replace `useProjectStore((state) => state.config)` with the narrowest possible selector per consumer:
  - `SbcNode.tsx`: pass `nodeData` down from `CanvasWorkspace` via React Flow `data` prop (already done — confirm no broad subscription). Subscribe to JUST what `isPortConnected` needs (a per-port-key boolean memo).
  - `Inspector.tsx`: select `state.config[entityArrayFor(ref.kind)]` only (e.g., `state.config.outbounds` for an outbound ref).
  - `TopBar.tsx`, `Palette.tsx`, `RuleTables.tsx`, `MobileMenuSheet.tsx`: similarly narrow.
- Use `useShallow` from `zustand/react/shallow` where multiple primitive values are read.
- `useProjectStore.connectPorts`: skip `sync()` if `connectDirectedPortReference` returned a structurally-equal config (cheap object identity check is fine since `cloneConfig` would return a new reference).
- Consolidate `ensureManagedShadowsocksInbound` to a single mutation.

### PR-12 — Symmetry test suite + final coverage audit

Fixes the verification gap.

- `tests/port-interaction-symmetry.test.ts`: for every `(sourceKind, sourceHandle, targetKind, targetHandle)` entry in `src/domain/portRegistry.ts` (from PR-9), assert that:
  - click-equivalent path: `createNodeAndConnect(sourceId, sourceHandle, kind)` produces the same `SingBoxConfig` as
  - drag-equivalent path: `connectPorts({source, sourceHandle, target, targetHandle})` after creating the target manually.
- Extend `tests/fixture-node-coverage.test.ts` with a "delete every entity then undo" round-trip that asserts no entity is leaked and `selectedId` / `layout.positions` are cleaned.
- Final audit script: re-run the cross-reference from the Background section against `main` HEAD; fail if any P0 finding still applies.

## Testing Strategy

- **Unit (vitest)**: every PR ships failing tests first. New test files per PR scope. Cover happy paths and edge cases (empty arrays, missing tags, colon-in-tag, two-digit indices).
- **Round-trip coverage**: `tests/fixture-node-coverage.test.ts` grows to cover delete / rename / type-change / undo for every fixture.
- **E2E (Playwright)**: `e2e/port-click-redesign.spec.ts` after PR-9; existing specs continue to pass at every PR.
- **Manual smoke on Jego.json + Gougou.json** before each PR merge — at minimum import, hover all nodes, run Check, click 3 diagnostics to focus, attempt 3 disconnects on previously-broken edges.

## Verification / Done Criteria

A PR is done when:

1. `pnpm release:check` passes locally.
2. New tests added in the PR fail without the PR's source changes and pass with them.
3. PR description links to the relevant P0/P1/P2 finding numbers in this doc.
4. Before/after Playwright screenshot for any visible behavior change.
5. CI is green; merge is squash; one commit lands on `main` per PR.

The goal is done when:

1. All 12 PRs are merged.
2. PR-12's audit script reports zero remaining P0 findings.
3. `tests/port-interaction-symmetry.test.ts` shows click and drag converge for every registered port pair.
4. Manual sweep of Jego.json + Gougou.json + all 9 templates shows no surprise nodes / placeholder rules / silently-broken references created by any single user gesture.

## Open Questions

- **Disconnect UX after PR-9**: tiny `×` overlay on a connected handle, right-click menu, "selected port → Delete" keystroke, or all three? Default plan picks the overlay; decide before PR-9.
- **Chip popover anchor**: cursor coordinates (drop XY) or source port? Default: cursor.
- **Auto-pin layout on createNodeAndConnect**: pin at drop XY exactly, snap to nearest column, or hybrid? Default: snap to nearest column if drop is inside a column band, else pin at drop.
- **Mobile**: the redesign assumes mouse interaction. The mobile flow already routes everything through the inspector sheet — confirm we are not regressing it before PR-9 ships.
- **Telemetry**: do we want to log "drop in empty space → cancelled" vs "drop in empty space → picked X"? Out of scope; capture as a follow-up.
- **`certificate_providers` / `http_clients` deletion**: gain a canvas node + EntityRef arm (PR-4) but no inspector form yet. Acceptable for this goal or block on inspector work? Default: ship without inspector form, list as a known gap.
