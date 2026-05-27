# Canvas Port Interaction Redesign

## Outcome

Clicking a node port produces a dangling connection line that follows the cursor; the user drops it on a valid target node to connect, or in empty space to open a compatible-type picker that creates the target node and wires it. Click and drag converge on the same domain command for the same `(node.kind, port.key, target.kind)` pair, so the same gesture in either form yields the same canonical config mutation.

Once shipped:

- No port click silently auto-picks "the first existing X" or auto-creates a placeholder rule / detour. The user always sees what they are about to connect before the config mutates.
- Every port declared by `getPortSpecs` is reachable by both click and drag and ends in a real, validated wiring (no inert ports).
- `togglePortConnection` is reduced to disconnect-only behavior on already-connected ports (or removed in favor of an explicit "x" affordance, see Open Questions).
- `createCompatible` is gated on the source node's actual capability to host the new connection (no blind `connectSelectorCandidate` against non-group outbounds).
- A vitest suite proves that `click → drop on target` and `drag → drop on target` produce byte-identical `SingBoxConfig` mutations for every supported port pair.

## Scope

In scope:

- `src/components/SbcNode.tsx` — port DOM, click handlers, Handle wiring
- `src/components/CanvasWorkspace.tsx` — connection-start / connection-end events, dangling-line state, drop-on-empty popover host
- `src/state/useProjectStore.ts` — `togglePortConnection` reduction, `connectPorts`/`connectDirectedPortReference` symmetry, `createCompatible` source-type guard
- `src/canvas/graph.ts` — `compatible: string[]` policy (it may need to encode the port that created the dangling line, not just a flat list)
- `src/domain/commands.ts` — small guards inside `connectSelectorCandidate` and friends so they refuse invalid source types
- `tests/sbc-node-ports.test.ts` + new `tests/port-interaction-symmetry.test.ts`
- `e2e/editor.spec.ts` extension + new `e2e/port-click-redesign.spec.ts`
- `docs/goals/canvas-port-interaction-redesign.md` (this file)

Out of scope:

- New sing-box protocols or node kinds
- Inspector / rule-table redesign
- React Flow major-version upgrade
- Visual restyle of the chip card or popover beyond what the new flow requires
- Mobile-only redesign (mobile currently bypasses the port chips entirely via the inspector sheet — keep that behavior)

## Source Docs

- [AGENTS.md](../../AGENTS.md) — non-negotiables, frontend skill gate, signed commits
- [Goal-Driven Development](../goal-driven-development.md) — done-criteria contract
- [SBC React Flow R&D Plan](../sbc-react-flow-rd-plan.md) — canvas-is-not-source-of-truth invariant
- [sing-box Canvas Configuration Guide](../sing-box-canvas-configuration-guide.md) — what each port is supposed to represent
- `vercel-react-best-practices` skill — frontend skill gate applies
- React Flow `onConnectStart` / `onConnectEnd` reference: https://reactflow.dev/api-reference/types/on-connect-start
- React Flow `useConnection` hook: https://reactflow.dev/api-reference/hooks/use-connection

## Background — Audit of Current Behavior (2026-05-28)

The audit cross-references `getPortSpecs` (SbcNode.tsx L66-217), `togglePortConnection` (useProjectStore.ts L773-1260), `connectDirectedPortReference` (L362-479), and `createCompatible` (L659-697). Every entry below is grounded in those line ranges, not in source comments.

### Critical (data-destructive or non-functional)

1. **`route` → `route-rule` click deletes the last rule.** `togglePortConnection` L1057-1061 calls `deleteRouteRule(lastRuleIndex)` whenever any rule already exists. New rules cannot be added by clicking the port after the first one. Drag has no equivalent path.
2. **`dns` → `dns-rule` click deletes the last dns rule.** L1131-1135, same shape as #1.
3. **`settings:ntp` → `dial-detour` port is decorative.** `getPortSpecs` L213-215 declares it; `togglePortConnection` has no `node.kind === "settings"` branch and `connectDirectedPortReference` has no `(settings, …)` pair, so click and drag both do nothing.
4. **`dns` ← `inbound-query` port is decorative.** `togglePortConnection` L806-809 only calls `addInbound("tun")` without any "query source" wiring; the inbound output ports (`route`, `route-rule-match`, `dns-rule-match`, `service`) do not include a matching handle, so drag has no valid pair.

### High (destructive without warning, or invalid mutation)

5. **`outbound` (selector/urltest) → `outbound-member` click disconnects the last candidate.** L1103-1113. Picking "remove" by clicking "+" is hostile; user cannot pick which candidate gets removed.
6. **`dns-server` → `outbound` click always creates a fresh `direct`.** L1187-1196. The same flow elsewhere uses `firstDirectOutboundTag` first; here it does not, so each click stacks another `direct-N` dangling outbound.
7. **`createCompatible` writes `outbounds[]` into any outbound source.** L677-679 unconditionally calls `connectSelectorCandidate(sourceTag, latestTag)` whenever the source id starts with `outbound:`. `connectSelectorCandidate` (commands.ts L817-830) silently injects an `outbounds: [...]` field into the source even if the source type is `http` / `direct` / `vmess` / etc. Today the public `compatible` array is empty for non-group outbounds so the bug is unreachable from the UI; a single future change to that policy would expose it.

### Medium (click vs drag diverge for the same port)

8. For every output port listed below, click runs a "smart create + connect default" while drag runs `updateEntityField` / `setRouteFinal` / `connectSelectorCandidate` against the dragged target. Same gesture, different mutation:

   - `route-rule → outbound` (L1074-1084 vs L405-408)
   - `route → outbound` (L1063-1072 vs L401-403)
   - `outbound → dial-detour` (L1116-1129 vs L473-475)
   - `dns-server → outbound` (L1187-1196 vs L435-437)
   - `rule-set → download-detour` (L1172-1185 vs L465-467)
   - `outbound (selector) → outbound-member` (L1103-1113 vs L469-472)
   - `outbound → route-rule` (L849-853 — note this fabricates `domain_suffix: ["example"]`)
   - `dns-server → dns-rule` (L833-836 — same fabrication)
   - `rule-set → route-rule` / `rule-set → dns-rule` (L987-1004 — same fabrication, plus sets `outbound: route.final` blindly)

   These are the "乱链接到其他节点" behaviors users hit: clicking a port quietly inserts a new rule keyed off a placeholder domain that no one asked for.

9. **`route` ← `inbound` and `dns` ← `inbound-query` click always add a new `tun` inbound.** L779-782, L806-809. Never reuses, never disconnects.

10. **"First X" pickers** in `togglePortConnection` (`firstDialableDnsServer`, `firstDirectOutboundTag`, `firstTailscaleEndpointTag`, `firstRuleSetTag`) attach the new connection to whatever the first matching entity is in document order. The choice is invisible to the user and frequently surprising.

### Low (latent / cosmetic)

11. **`createCompatible` parses source id with `sourceId.split(":")`** (L676). Tags containing `:` (e.g. `geosite:google`) silently break source tag recovery. `parseNodeId` (L156-159) already uses `slice(1).join(":")` to defend.
12. **Each port renders two `Handle` components with the same `id`** (SbcNode.tsx L437-448, L476-487). React Flow's behavior for duplicate-id handles is undefined; connection routing may pick the wrong one under heavy DOM nesting.
13. **Chip `+Selector` / `+URLTest` creates an empty group as a candidate** (commands.ts L429-441). Visually adds a dangling empty group inside the source selector.

## Approach

The fix is one architectural change plus targeted data-bug repairs.

### Architectural change: collapse click into drag

The canvas adopts React Flow's connection lifecycle as the single interaction model.

```
Port click → React Flow.connectionStart(handle) → cursor draws dangling line
  ├── drop on target Handle → onConnect → connectPorts → connectDirectedPortReference (no change)
  └── drop on empty pane   → onConnectEnd with no targetNode
                              → open ChipPickerPopover anchored at cursor
                              → user selects compatible type
                              → createNodeAndConnect(sourceId, handle, type)
                                ├── add{Outbound|Inbound|DnsServer|...}(type)
                                ├── pinLayout near cursor
                                └── connectDirectedPortReference(source, sourceHandle, newNode, dualHandle)
```

`togglePortConnection` shrinks to:
- If port is already connected → disconnect (single, explicit gesture).
- If port is unconnected → never auto-create. Click is intercepted at the React Flow layer and forwarded to `onConnectStart`.

`createCompatible` is replaced by `createNodeAndConnect(sourceId, sourceHandle, type)`. It always knows which port it is wiring up, so it can pick the right domain command instead of guessing from `sourceParts[0]`.

The chip card surfaced on node hover stays as a discoverability affordance, but its click handler routes through the same `createNodeAndConnect` path so chip and drag-onto-empty produce identical results.

### Data-bug repairs (must land regardless of UX redesign)

The destructive bugs (#1, #2, #5 above) cannot wait on the architecture work — they actively destroy user data. They land first as a small PR.

`createCompatible`'s unconditional `connectSelectorCandidate` (#7) and `connectSelectorCandidate` itself gain a runtime guard that refuses to write `outbounds[]` into outbound types that are not `selector` / `urltest`. A vitest case asserts the guard.

`getPortSpecs` is audited for `(kind, port)` pairs that have no matching `connectDirectedPortReference` entry. The decorative ports (#3, #4) are either wired up or removed.

## Atomic Tasks

Each task is one PR. Each PR includes failing tests written first, then the implementation, then a passing run of `pnpm release:check` locally. PR titles are imperative; PR bodies link back to this spec.

### PR 1 — Stop destructive click handlers (critical bugs #1, #2, #5)

- `useProjectStore.togglePortConnection` for `route → route-rule` (L1057), `dns → dns-rule` (L1131), and `outbound (selector/urltest) → outbound-member` (L1103): when the port already has connected children, return state unchanged instead of deleting / disconnecting. The "delete last rule" affordance moves to the RuleTables panel where it already lives.
- Add `tests/port-interaction-destructive.test.ts` with one case per branch confirming that the existing state survives a click on a populated parent.
- Touches: useProjectStore.ts, tests/, no UI changes required.

### PR 2 — Reject invalid `connectSelectorCandidate` writes (bug #7)

- Inside `connectSelectorCandidate` (commands.ts L817-830), early-return the unchanged config when the target tag's outbound type is not `selector` / `urltest`.
- Inside `createCompatible` (useProjectStore.ts L677-679), short-circuit the same way when `sourceParts[0] === "outbound"` but the source is not a group type.
- Switch `sourceId.split(":")` to `parseNodeId(sourceId)` so colon-containing tags survive (bug #11).
- Add `tests/domain.test.ts` cases for both guards.

### PR 3 — Wire the decorative ports or delete them (bugs #3, #4)

Decide per port:
- `settings:ntp → dial-detour`: implement click + drag pair updating `ntp.detour`. Add an inspector hint if no outbounds exist yet.
- `dns ← inbound-query`: this port has no clear sing-box semantic (inbound → dns is expressed via dns rules, not the hub). Remove the port from `getPortSpecs`. Update `tests/sbc-node-ports.test.ts` to assert the port is gone.
- Audit every other `(kind, port.key)` declared by `getPortSpecs` against `togglePortConnection` and `connectDirectedPortReference`; document any other inert ports and either wire or remove them.

### PR 4 — Replace `togglePortConnection` create-paths with React Flow connection lifecycle

This is the architectural change. It is one PR but lands behind a feature flag (`VITE_PORT_CLICK_DRAGS`, default true in dev / false in prod for one release) so it can be reverted from the dashboard if necessary.

- In `CanvasWorkspace.tsx`, supply `onConnectStart` to remember the source `(nodeId, handle, type)`, and `onConnectEnd` to detect drops on the pane (no `target` in the event).
- Add a new component `<ChipPickerPopover anchorScreenXY source ...>` that mounts at the drop coordinates when `onConnectEnd` lands in empty space. It renders the same chip list `graph.compatible` does today.
- Selection in the popover calls a new store action `createNodeAndConnect(sourceId, sourceHandle, kind)`. Internals:
  - Use the registry tables (a new `src/domain/portRegistry.ts`) keyed on `(sourceKind, sourceHandle, targetKind, targetHandle)` to look up `(create, connect)` callables.
  - `create` calls the relevant `add*` domain command and returns the new tag.
  - `connect` calls the same `connectDirectedPortReference` arm that drag uses, so drag and click converge.
  - `pinLayout` near the drop coordinates so the new node materializes where the user dropped, not in a far column.
- Remove the create-branches from `togglePortConnection`. Keep only the disconnect branches. Rename to `disconnectPortConnection`.
- Update `SbcNode.tsx` to not call `togglePortConnection` on connected ports — instead a small `×` overlay on the port handle handles disconnect, leaving the port itself as a connection-start surface.

### PR 5 — Symmetry test suite

- `tests/port-interaction-symmetry.test.ts`: for every `(sourceKind, sourceHandle, targetKind, targetHandle)` entry in the new registry, run a click-equivalent path (`createNodeAndConnect`) and a drag-equivalent path (`connectPorts`) against the same starting config and assert the resulting `SingBoxConfig` is deep-equal.
- Extend `e2e/editor.spec.ts` with a single happy-path scenario: load a minimal config, click a port, drop on the pane, pick a chip, observe the new node + edge appear, save, reload, observe persistence.

### PR 6 — Documentation + cleanup

- Mark all previously inert ports as wired or removed in `docs/sing-box-canvas-configuration-guide.md`.
- Add a one-paragraph entry in `docs/sbc-react-flow-rd-plan.md` describing the new port lifecycle.
- Drop the feature flag from PR 4 once Cloudflare metrics show one full week without rollbacks.

## Testing Strategy

- **Unit (vitest)**: each PR ships failing tests first. Coverage targets: `togglePortConnection` (now `disconnectPortConnection`) branches, `createNodeAndConnect` registry entries, guard functions in `commands.ts`.
- **Round-trip**: extend `tests/fixture-node-coverage.test.ts` so every fixture survives a synthetic "click on each port, drop on pane, pick first chip, undo, re-export" loop without diverging from the original config.
- **E2E (Playwright)**: `e2e/port-click-redesign.spec.ts` covers click-start, drag-to-target, drop-on-pane, and disconnect for at least three representative kinds (route hub, selector outbound, dns hub).
- **Manual smoke on Jego.json + Gougou.json** before each PR merge.

## Verification / Done Criteria

A PR is done when:

1. `pnpm release:check` passes locally.
2. New tests added in the PR fail without the PR's source changes and pass with them.
3. The PR description includes a before/after Playwright screenshot for any visible behavior change.
4. CI signs off (no skipped or pending checks).
5. Merge target is `main`; merge style is squash so each PR contributes exactly one commit to history. Cloudflare Workers Builds auto-deploys on merge.

The goal is done when:

1. All six PRs above are merged.
2. The auditor (`general-purpose` agent) re-runs the cross-reference at the top of this doc against `main` and reports zero remaining items in the Critical or High sections.
3. The "click != drag" finding (medium #8) shows zero entries in `tests/port-interaction-symmetry.test.ts`.
4. Manual sweep of Jego.json + Gougou.json + all 9 templates shows no surprise nodes / placeholder rules created by single clicks.

## Open Questions

- **Disconnect affordance**: should disconnect live on a tiny `×` overlay on a connected handle, on right-click, on a "selected port → Delete" keystroke, or on all three? Default plan above picks the overlay. Decide before PR 4.
- **Chip popover trigger position**: anchor to the drop coordinates (cursor-following) or to the source port? Default: drop coordinates so the new node materializes where the user expects.
- **Layout placement for newly created nodes**: should the new node use `pinLayout` at the drop coordinates, or fall through to `deriveGraph`'s column-based fallback? Default: pin at drop, fall back to column if drop is inside an existing column band.
- **Mobile**: the redesign assumes mouse interaction. The mobile flow already routes everything through the inspector sheet — confirm we are not regressing it before PR 4 ships.
- **Telemetry**: do we want to log "drop in empty space → cancelled" vs "drop in empty space → picked X" so we can measure whether the chip popover is useful? Out of scope for this goal; capture as a follow-up if the redesign feels useful.
