# Canvas Port Interaction Redesign Execution Plan

Run with:

```txt
/goal canvas port interaction redesign and data-integrity repair --spec docs/goals/canvas-port-interaction-redesign-execution.md
```

## Target Outcome

Canvas port interaction must behave like the expected four-frame flow:

1. Hovering a port only previews that it can start a relationship. It must not mutate canonical config.
2. Pressing or dragging from a port starts a dangling connection line. Compatible target handles and nodes highlight while the line is pending.
3. Releasing on empty canvas opens a chip picker at the drop point. The picker lists port-scoped compatible upstream/downstream node types.
4. Dropping on a compatible handle, or picking a chip, runs the same canonical domain relation command. The new or existing edge appears from derived `SingBoxConfig`.

This goal is not only a UI redesign. It is blocked by data-integrity repairs because current click paths can create/delete canonical config without confirmation and drag/click paths do not share the same command surface.

## Inputs Reviewed

- Repo instructions: `AGENTS.md`.
- Source-of-truth docs: `docs/sbc-react-flow-rd-plan.md`, `docs/sing-box-config-doc-inventory.md`, `docs/sing-box-canvas-configuration-guide.md`, `docs/sing-box-config-capability-audit.md`, `docs/goal-driven-development.md`.
- Frontend gate: `vercel-react-best-practices`.
- PR #1 `JegoVPN/sbcv#1`, head `7422d55ea00c5a2b291c9a13fc75e06249dc4ff6`; this execution plan supersedes the PR draft spec.
- Local code audit over `src/components/CanvasWorkspace.tsx`, `src/components/SbcNode.tsx`, `src/state/useProjectStore.ts`, `src/domain/commands.ts`, `src/canvas/graph.ts`, `src/domain/diagnostics.ts`, `src/domain/types.ts`, tests and e2e specs.

Count note: the PR comment says "40 findings", while the enumerated buckets are P0-1..P0-13, P1-1..P1-18, and P2-1..P2-20. Execution should track the enumerated IDs, not the prose count.

## Non-Negotiables

- `SingBoxConfig` / domain state remains the source of truth. React Flow nodes and edges stay derived.
- Port click, drag, chip creation, edge delete, node delete, tag rename, and type change all go through tested domain commands.
- `route.rules` and `dns.rules` order remains table-owned. Canvas may visualize rule references, but must not become the ordering source.
- A port click must never directly add/delete route rules, DNS rules, inbounds, outbounds, DNS servers, or group members.
- A visible edge must have either a working disconnect command or be marked readonly/non-deletable in the UI.
- `sharedFieldRegistry` remains an Inspector shared-field registry. Do not reuse it as the port compatibility source.
- Frontend work must use narrow Zustand selectors, avoid broad canvas rerenders during hover/drag, and defer expensive UI where practical.

## Cross-Comparison Summary

PR #1 correctly identifies the main data-loss class:

- destructive port clicks in `togglePortConnection`;
- incomplete `disconnectEdge`;
- incomplete tag rename/delete reference cascades;
- stale `selectedId`, `focusedNodeId`, and `layout.positions`;
- graph derivation bugs such as `diagnosticStatus` path prefix matching;
- broad subscriptions and drag-time graph re-derivation.

The local multi-slice frontend review adds two architectural corrections:

- PR #1 PR-9 says to reuse `graph.compatible` for the chip picker. That is insufficient. `graph.compatible` is node-scoped (`src/canvas/graph.ts` data field) and cannot answer which handle started the pending line, which target handle is legal, which relation command runs, or which chip type should create which node. The executable path must introduce a port-level relation registry before the click/drag redesign.
- PR #1 lists missing rename/delete reference cascades, but the executable path should not keep adding one-off branches. It needs a canonical reference registry first, because existing live refs such as `dns.servers[].detour`, `endpoints[].detour`, domain resolver object shapes, `route.default_http_client`, `dns.servers[].service`, `route.rule_set[].http_client`, and `experimental.v2ray_api.stats` must be renamed/deleted/type-scrubbed consistently.

The registry must replace scattered relationship knowledge across:

- UI port specs in `SbcNode.tsx:getPortSpecs`;
- React Flow validation in `CanvasWorkspace.tsx:matchesDirectedConnection`;
- creation and toggle branches in `useProjectStore.ts`;
- derived edge ids in `graph.ts`;
- inverse mutations in `commands.ts:disconnectEdge`.

## Code-Backed Audit

### React Flow Lifecycle

- `SbcNode.tsx:422-435` and `SbcNode.tsx:461-474` wrap handles in `<button>` elements whose `onClick` calls `togglePortConnection`. This is the opposite of the target flow: click commits immediately instead of starting a pending line.
- `SbcNode.tsx:437-448` and `SbcNode.tsx:476-487` render both source and target handles with the same `id` for each port. This makes every port bidirectional at the React Flow layer and pushes semantic direction recovery into ad hoc matching.
- `CanvasWorkspace.tsx:108-139` wires `onConnect` only. There is no `onConnectStart`, `onConnectEnd`, pending-port state, pane-drop detection, chip picker, or custom empty-drop cancellation.
- `CanvasWorkspace.tsx:114` only wires `onEdgesDelete`. There is no `onNodesDelete`, so Delete/Backspace on a focused node does not call `deleteEntity`.
- `CanvasWorkspace.tsx:84-87` blindly calls `setNodes(graph.nodes)` and `setEdges(graph.edges)` on every derived graph change. This can overwrite local React Flow drag state mid-drag.
- `CanvasWorkspace.tsx:130` sets `connectionDragThreshold={1}` with `connectionRadius={54}`, making accidental drags likely.

### Store And Domain Commands

- `useProjectStore.ts:659-697` implements `createCompatible` with node-level kind strings. It can set `route.final` or `dns.final` based on the latest pre-existing entity, and uses `sourceId.split(":")`, which is unsafe for tags containing `:`.
- `useProjectStore.ts:778-1263` implements dozens of port click branches. Many create or delete canonical objects directly: add TUN on route input, add TUN on DNS inbound-query, delete last rule, add/delete selector member, add DNS server without setting `dns.final`, and create detour targets.
- `useProjectStore.ts` inbound `route-rule-match` / `dns-rule-match` click-disconnect logic only removes the first matching rule reference. When multiple route or DNS rules reference the same inbound, the other rules continue to retain the inbound.
- `useProjectStore.ts:401-407` writes route-rule `outbound` without checking rule `action`; graph derivation only shows the edge when action allows routing.
- `useProjectStore.ts:469-475` and `commands.ts:817-830` allow selector candidate writes without guarding that the parent outbound is actually `selector` or `urltest`.
- `useProjectStore.ts:1449-1472` exports dead `getSelectedRef` logic and parses ids with `[kind, rest] = split(":")`, losing tag segments after the first colon.
- `commands.ts:981-1075` renames common refs, but misses documented references such as `dns-server.service`, `route.default_domain_resolver`, `route.default_http_client`, domain resolver shapes, rule-set `http_client`, and v2ray stats arrays.
- `commands.ts:981-1075` also misses existing live detour refs such as `dns.servers[].detour` and `endpoints[].detour` when an outbound tag is renamed.
- `commands.ts:961-979` keeps duplicate `replaceTagRef` and `replaceRuleSetRef` implementations, which should be collapsed when the canonical reference registry lands.
- `commands.ts:1077-1187` delete cascades miss several of the same references, including outbound deletion clearing endpoint detours, and `EntityRef` lacks `http-client` / `certificate-provider` arms (`types.ts:136-147`).
- `commands.ts:1189-1265` only disconnects a subset of edge ids emitted by `graph.ts`, so many visible edge deletes are no-ops.
- Store wrappers at `useProjectStore.ts:1281-1293` call sync directly and do not clean or remap `selectedId`, `focusedNodeId`, or `layout.positions`.
- `Inspector.tsx:1778-1781` overwrites `tagDraft` whenever the entity object changes, and `Inspector.tsx:2092` renames on blur without uniqueness validation or selection/layout remap.
- `serialization.ts` uses `stripUndefined` on update paths in a way that reconstructs objects and can reorder user JSON keys. `normalizeConfig` also accepts malformed top-level collection shapes such as `{ "outbounds": "string" }`, after which downstream list helpers silently treat the data as empty.

### Graph And Registry

- `graph.ts:90-93` uses `diagnostic.path.startsWith(pathPrefix)`, so `/outbounds/1` can inherit diagnostics from `/outbounds/10`.
- `graph.ts:25`, `graph.ts:236`, `graph.ts:266`, `graph.ts:302`, `graph.ts:414-437`, `graph.ts:533`, `graph.ts:603`, `graph.ts:650`, and `graph.ts:678` define `compatible` at node granularity only.
- `SbcNode.tsx:50-56` defines `PortSpec` with only `key`, label, compatible node kind/type, and icon. It has no relation id, read/write mode, create candidates, guard predicate, inverse command, or ordered-list semantics.
- `graph.ts:657` can emit endpoint detour edges targeting an outbound `detour-target` handle, and `useProjectStore.ts:443` has a command for endpoint detours, but `SbcNode.tsx:114` declares that handle as compatible with outbound sources only; drag validation can reject a command-supported relation.
- `graph.ts:444-458` emits group candidate edges for any outbound with an `outbounds` array, not only selector/urltest groups.
- `graph.ts:560-717` emits edges for DNS detour, DNS-server endpoint/service, endpoint detour, service detour, service verify endpoint, service SSM inbound, and settings NTP detour. Most are not invertible in current `disconnectEdge`.
- `SbcNode.tsx:75` exposes DNS inbound-query as a port even though the current click path only adds TUN and there is no sing-box DNS-hub inbound relation.
- `SbcNode.tsx:131-140` exposes `service:resolved` input for resolved DNS servers, but the store has no matching connect/toggle/disconnect branch.
- `Palette.tsx` exposes creatable types that currently no-op or are not fully wired, including cloudflared, wireguard outbound, DNS outbound, legacy DNS, and mDNS DNS.
- `graph.entityTag` returns `untagged-${kind}-${index+1}`, while `RuleTables.tsx:137,237` and `Inspector.tsx:1047,1281` display `untagged-${index+1}`. Diagnostic focus can jump to the long id while the table/Inspector display the short label.
- `CanvasWorkspace.tsx:183` renders the selection pill from raw node ids such as `outbound:my-tag` instead of the node title.
- `diagnostics.ts` can emit duplicate-tag diagnostics with multiple comma-separated paths even though `Diagnostic.path` is a single path. `indexes.ts` indexes `certificate-provider` and `http-client`, but `EntityRef` and diagnostic targeting cannot focus those resources.

### Tests And E2E

- `tests/app.test.tsx:47-55` explicitly asserts the old destructive side-port click behavior.
- `tests/app.test.tsx:204-216` asserts an unconnected outbound left-port click writes route final directly.
- `tests/app.test.tsx:326` expects a Tailscale endpoint port click to auto-create/link a DNS server, which must move to explicit picker/drag behavior.
- `tests/app.test.tsx:218-229` covers drag command convergence only for one reversed route-final case.
- `tests/sbc-node-ports.test.ts:12-53` locks the current port list, including DNS inbound-query and resolved service ports.
- No current test directly protects the worst destructive paths: route hub port deleting the last route rule, DNS hub port deleting the last DNS rule, and selector/urltest member port deleting the last candidate.
- No Playwright spec covers the expected flow: pending line, highlight compatible handles, empty-drop chip picker, chip create+connect, direct drop connect, and explicit disconnect.

### Performance Risks

- Broad config subscriptions exist in `CanvasWorkspace.tsx:49`, `SbcNode.tsx:381`, `Inspector.tsx:1744`, `RuleTables.tsx`, `Palette.tsx`, `TopBar.tsx`, and `MobileMenuSheet.tsx`.
- `SbcNode` recomputes port connection state by scanning full config per node/port. Port connection booleans should be precomputed in graph data or selected narrowly per node.
- `useViewport` registers a separate `matchMedia.addEventListener` per consumer. Shared viewport state should avoid redundant listeners when multiple responsive components mount.
- Frequent hover/drag state must not be stored in broad canonical config subscriptions. Pending connection state should stay local to `CanvasWorkspace` or a narrow UI slice.
- Graph derivation should remain memoized from canonical config/layout/diagnostics, but drag-time node positions must be protected from derived `setNodes` churn.
- `App.tsx` eagerly imports the canvas, inspector, palette, and mobile sheets. Optional heavy panels should be deferred where practical.
- `BottomSheet.tsx` updates React state during pointer movement. Mobile drag-height state should use refs/requestAnimationFrame or direct style updates where this affects inspector responsiveness.

## Execution Architecture

### Canonical Reference Registry

Add a canonical tag-reference registry before expanding rename/delete behavior. This is separate from the port relation registry.

The registry owns known tag reference sites and their operations:

- referenced entity kind: inbound, outbound, DNS server, endpoint, service, rule set, HTTP client, certificate provider;
- owning JSON path or path pattern;
- value shape: string, string array, object with `server`, map value, or typed nested object;
- rename operation;
- delete/scrub operation;
- type-change scrub operation when a target type no longer supports the reference;
- stable/testing gate and document-inventory trace.

Required initial coverage:

- inbound refs: `route.rules[].inbound`, `dns.rules[].inbound`, `services[].servers` map values, `experimental.v2ray_api.stats.inbounds[]`;
- outbound refs: `route.final`, `route.rules[].outbound`, selector/urltest `outbounds[]` and `default`, outbound/endpoint/DNS-server/service/rule-set/NTP/clash detours, `experimental.v2ray_api.stats.outbounds[]`;
- DNS server refs: `dns.final`, `dns.rules[].server`, outbound/endpoint/DNS-server `domain_resolver`, `route.default_domain_resolver`;
- endpoint refs: `dns.servers[].endpoint`, `services[].verify_client_endpoint`, `certificate_providers[].endpoint`;
- service refs: `dns.servers[type=resolved].service`;
- rule-set refs: `route.rules[].rule_set`, `dns.rules[].rule_set`;
- HTTP client refs: `route.default_http_client`, `route.rule_set[].http_client`;
- certificate provider refs once graph-managed.

Rename, delete, disconnect, and type-change commands should use this registry where practical. Avoid adding new independent reference-rewrite branches unless the registry cannot model the shape yet; document any exception in this file.

### Port Relation Registry

Add `src/domain/portRelationRegistry.ts` before the click redesign. It is the single place that defines semantic relations.

Minimum shape:

```ts
type PortEndpointSpec = {
  kind: SbcNodeKind;
  type?: string;
  handle: string;
  io: "input" | "output";
};

type PortRelation = {
  id: string;
  source: PortEndpointSpec;
  target: PortEndpointSpec;
  mode: "writable" | "readonly" | "decorative" | "order-only";
  canonicalPath: string;
  channelGate?: "stable" | "testing";
  edgePrefix: string;
  formatEdge: (args: RelationArgs) => { id: string; data: RelationEdgeData };
  parseEdge: (edge: RelationEdgeData) => RelationArgs | null;
  canConnect?: (config: SingBoxConfig, source: ParsedNodeId, target: ParsedNodeId) => boolean;
  connect: (config: SingBoxConfig, source: ParsedNodeId, target: ParsedNodeId) => SingBoxConfig | null;
  disconnect?: (config: SingBoxConfig, args: RelationArgs) => SingBoxConfig;
  createCandidates?: Array<{
    label: string;
    paletteKind?: string;
    create: (config: SingBoxConfig) => { config: SingBoxConfig; nodeId: string } | null;
  }>;
};
```

Registry consumers:

- `SbcNode.getPortSpecs` renders ports from relation endpoints.
- `CanvasWorkspace.isValidConnection` asks the registry, not local `specMatchesNode`.
- `graph.deriveGraph` emits structured edge metadata through registry helpers instead of relying on `edge.id.split(":")`.
- `useProjectStore.connectPorts`, `createNodeAndConnect`, and explicit disconnect call registry commands.
- Tests enumerate registry entries for connect/disconnect symmetry.

Do not use `graph.compatible` as the chip picker source. Either remove it or derive it from the active pending port relation list for display only.

Do not merge `sharedFieldRegistry` into this registry. Shared fields describe Inspector field groups; port relations describe graph-editable tag references.

### Pending Connection State

`CanvasWorkspace` owns transient pending connection state:

- `idle`;
- `pending({ nodeId, handleId, handleType, screenXY, flowXY })`;
- `picker({ source endpoint, dropXY, candidates })`.

Use React Flow lifecycle:

- `onConnectStart`: record pending endpoint and suppress direct mutation.
- `onConnect`: run registry `connect`.
- `onConnectEnd`: if pane drop, open chip picker; if invalid drop, cancel; if valid handle drop, let `onConnect` own mutation.
- `onClickConnectStart` / `onClickConnectEnd`: if React Flow click-connect is enabled, route literal click behavior through the same pending state as drag.
- `connectOnClick` should be disabled unless the click-connect callbacks are implemented and tested. The target UX can be satisfied by press/drag and by a click that enters the same local pending state without committing config.
- `onPaneClick` must not clear selection or close the picker when it is handling the same pointer release that opened the picker.
- Compatible target highlighting must be derived from the pending endpoint and registry relation guards. Invalid targets should not highlight.

### Creation Flow

Add `createNodeAndConnect(sourceId, sourceHandle, candidate, flowXY)` in the store or a domain command wrapper.

Requirements:

- Create the new canonical entity first.
- Connect it through the same registry relation command used by drag.
- Pin `layout.positions[newNodeId]` at the drop point, with optional column snap.
- Select/focus the new node after successful creation.
- If creation fails validation preconditions, show a disabled chip or inline picker message; do not create placeholder invalid config silently.

### Disconnect Flow

Replace click-to-toggle with explicit disconnect affordances:

- Connected handle shows a small disconnect control.
- Edge delete uses the registry inverse command.
- Informational/ordered visualization edges are readonly and cannot be deleted.

## Ordered PR Plan

### PR-1: Stop Destructive Port Clicks And Wire Node Delete

Fixes PR P0-1, P0-2, P0-3, P0-10 and removes tests that lock old behavior.

Files:

- `src/components/SbcNode.tsx`
- `src/components/CanvasWorkspace.tsx`
- `src/state/useProjectStore.ts`
- `tests/app.test.tsx`
- new `tests/port-interaction-destructive.test.ts`

Work:

- Remove direct `togglePortConnection` calls from port button clicks.
- Keep node selection separate from port interaction.
- Add `onNodesDelete` and route each deletable node through `deleteEntity`.
- Keep `togglePortConnection` temporarily only for explicit disconnect paths or mark it deprecated.
- Convert old click-mutation tests into no-mutation tests.

Acceptance:

- Clicking route, DNS, DNS-server, selector/urltest member, route-rule, and detour ports without a drop target does not change `SingBoxConfig`.
- Clicking inbound `route-rule-match` / `dns-rule-match` ports without a drop target leaves every referencing rule unchanged, including when multiple rules reference the same inbound.
- Delete/Backspace on a focused deletable node calls the same delete command as the visible delete button.

### PR-2: Canonical Reference Registry And Identity State Repair

Fixes PR P0-6, P0-7, P0-8, P0-11, P0-12, P1-12, P2-7, P2-12, P2-13.

Files:

- `src/state/useProjectStore.ts`
- `src/domain/commands.ts`
- new `src/domain/referenceRegistry.ts`
- `src/domain/types.ts`
- `src/domain/indexes.ts`
- `src/components/Inspector.tsx`
- `tests/domain.test.ts`
- `tests/app.test.tsx`

Work:

- Add tag uniqueness enforcement in `renameTag`.
- Build the canonical reference registry and move rename/delete/type-change reference rewrites onto it for the required initial coverage.
- Collapse duplicate tag-reference replacement helpers into registry-driven operations.
- Remap `selectedId`, `focusedNodeId`, and `layout.positions` on tag rename.
- Clear stale selected/focused ids and layout positions on delete.
- Remap rule node selection after `moveRouteRule` / `moveDnsRule`.
- Scrub endpoint/service dependent refs on `changeEntityType`.
- Change Inspector `tagDraft` sync to update only when selected entity tag changes and the input is not focused.

Acceptance:

- Renaming a selected node keeps the inspector open on the renamed node.
- Duplicate tag rename is rejected before mutation.
- Deleted and moved rule nodes never leave ghost selection or stale layout.
- Renaming or deleting outbounds updates/clears `dns.servers[].detour`, `endpoints[].detour`, and every other registered outbound reference.

### PR-3: Port Relation Registry And Edge Id Parsing

Fixes the local architectural gap and prepares PR #1 PR-3/PR-9.

Files:

- new `src/domain/portRelationRegistry.ts`
- `src/domain/types.ts`
- `src/components/SbcNode.tsx`
- `src/components/CanvasWorkspace.tsx`
- `src/canvas/graph.ts`
- `tests/port-relation-registry.test.ts`

Work:

- Define every editable relation as a registry entry.
- Add structured node-id and edge-id parsing helpers that support tags containing `:`.
- Delete or replace dead `getSelectedRef` code with the same structured id helper.
- Generate `PortSpec` from registry endpoint metadata.
- Add explicit relation `mode`: `writable`, `readonly`, `decorative`, or `order-only`.
- Include canonical JSON owner/path, stable/testing gate, semantic guard, edge metadata formatter/parser, and create-target behavior in each writable relation.
- Keep readonly visualization edges separate from editable relation edges.
- Make `CanvasWorkspace.isValidConnection` registry-driven.

Acceptance:

- Every editable edge emitted by `graph.ts` has exactly one registry relation.
- Every registry relation can answer compatible target handles for a pending source port.
- Tags containing `:` do not break source/target/edge parsing.
- No local id parsing uses `split(":")` in a way that drops later tag segments.
- `isValidConnection` accepts exactly the same relation pairs that `connectPorts` can mutate, excluding readonly/order-only relations.

### PR-4: Complete Disconnect Coverage

Fixes PR P0-9 and P2-16.

Files:

- `src/domain/commands.ts`
- `src/domain/portRelationRegistry.ts`
- `src/canvas/graph.ts`
- `tests/domain.test.ts`
- `tests/port-disconnect-symmetry.test.ts`

Work:

- Invert every editable edge emitted by graph derivation:
  - route final;
  - route-rule outbound/inbound/rule-set;
  - DNS final;
  - DNS-rule server/inbound/rule-set;
  - selector/urltest member;
  - outbound detour;
  - DNS-server detour/endpoint/service;
  - endpoint detour;
  - service detour/verify endpoint/SSM inbound;
  - rule-set download detour;
  - settings NTP detour;
  - clash external UI download detour;
  - certificate provider endpoint.
- Mark order/informational edges readonly instead of pretending they are deletable.

Acceptance:

- Deleting any editable visible edge mutates canonical config exactly once.
- Deleting a readonly visual edge is not offered by UI or is a documented no-op.

### PR-5: Reference Rename/Delete Completeness Audit

Fixes PR P0-11, P0-12, P2-7.

Files:

- `src/domain/commands.ts`
- `src/domain/types.ts`
- `src/domain/indexes.ts`
- `tests/domain.test.ts`

Work:

- Add `EntityRef` support for `http-client` and `certificate-provider` if they are graph-managed or deletable.
- Audit and complete reference registry coverage for:
  - `dns.servers[].service`;
  - `route.rule_set[].http_client`;
  - `dns.servers[].detour`;
  - `endpoints[].detour`;
  - outbound/endpoint/DNS-server `domain_resolver`;
  - `route.default_domain_resolver`;
  - `route.default_http_client`;
  - `experimental.v2ray_api.stats.inbounds[]`;
  - `experimental.v2ray_api.stats.outbounds[]`;
  - `certificate_providers[].endpoint`;
  - already-covered NTP/clash/rule-set detours.

Acceptance:

- Parameterized tests cover every tag reference path in `diagnostics.ts` and every entry in `referenceRegistry`.
- After deleting any tagged entity, semantic diagnostics do not report stale references caused by missed cleanup unless the user intentionally kept an unknown raw field.

### PR-6: Source-Type Guards And Validator-Safe Scaffolds

Fixes PR P0-4, P0-5, P1-2, P1-3, P1-4, P1-5, P2-5, P2-6, P2-20.

Files:

- `src/domain/commands.ts`
- `src/state/useProjectStore.ts`
- `src/components/Palette.tsx`
- `src/domain/diagnostics.ts`
- tests for domain and app flows.

Work:

- Guard `connectSelectorCandidate` to selector/urltest parents only.
- Guard route-rule outbound writes by rule `action`.
- Guard dial detour writes with the same `supportsOutboundDetour` policy used by Inspector/shared-field metadata.
- `createCompatible` connects only entities created in that same action and uses parsed node ids.
- Remove, disable, or fully wire Palette entries that currently click to no-op or invalid resources: cloudflared, wireguard outbound, DNS outbound, legacy DNS, and mDNS DNS.
- `createRuleSet` rejects unknown types instead of falling back to remote.
- `createDnsServer("tailscale")` is gated until a Tailscale endpoint exists or creates a validator-safe guided placeholder with a visible required-field state.
- Audit every `create*` helper against semantic validation.

Acceptance:

- Any creatable palette/chip item either yields no error-level diagnostics immediately or is disabled with a clear precondition.
- Route/DNS final and group membership are never overwritten by stale "latest entity" logic.

### PR-7: Wire Or Remove Decorative Ports

Fixes PR P1-6, P1-17, P1-18 and local inert-port findings.

Files:

- `src/components/SbcNode.tsx`
- `src/domain/portRelationRegistry.ts`
- `src/state/useProjectStore.ts`
- `src/canvas/graph.ts`
- `tests/sbc-node-ports.test.ts`

Work:

- Remove DNS hub inbound-query unless a real sing-box semantic relation is defined.
- Wire settings NTP detour.
- Wire resolved DNS server to resolved service, or remove the port until it is supported.
- Add graph and command support for clash external UI download detour and certificate provider endpoint.
- Make visual order ports readonly.
- Replace raw selected-node id display with the selected node title or remove the selection pill if it is redundant.

Acceptance:

- No rendered port is inert.
- Every rendered editable port has at least one connect and one disconnect test.

Status: implemented on 2026-05-28 in `atomic/canvas-pr7-wire-decorative-ports`.

- Removed the decorative DNS hub `inbound-query` port because sing-box has no canonical DNS-hub inbound-query field; inbound-to-DNS matching remains represented by `dns.rules[].inbound`.
- Converted route/DNS rule ordering edges to readonly ports and made non-writable port UI non-connectable, so visual hubs/order lines remain inspectable but cannot start false drag writes.
- Wired previously readonly canonical references through drag/connect and disconnect paths: `ntp.detour`, `dns.servers[type=resolved].service`, `experimental.clash_api.external_ui_download_detour`, and `certificate_providers[type=tailscale].endpoint`.
- Added certificate provider graph nodes and endpoint edges, plus graph edge emission for Clash API external UI download detour.
- Removed unsupported DNS server detour ports/edges for non-dialable DNS server types by sharing the existing DNS server Dial Field guard.
- Replaced the floating canvas selected-id pill with the selected node title.
- Frontend performance review: the UI changes add only static port metadata and local DOM attributes; no new dependencies, async/data waterfalls, broad store subscriptions, or transient drag/hover global state were introduced. Existing broad canvas subscriptions and the Vite single-bundle warning remain PR-11 items.
- Verification passed locally: `git diff --check`, `pnpm exec tsc -b --pretty false`, `pnpm exec vitest run tests/sbc-node-ports.test.ts tests/port-relation-registry.test.ts tests/port-disconnect-symmetry.test.ts tests/app.test.tsx --reporter=dot`, `pnpm test`, `pnpm build`, `pnpm e2e`, and a browser smoke at `http://127.0.0.1:5174/`.
- `pnpm build` still reports the existing Vite >500 kB single chunk warning; this is tracked as PR-11 performance work.
- Official `sing-box-stable` / `sing-box-testing` checks were not run because this atomic changes editor graph/port interaction behavior and docs, not bundled fixture/exported config files.

### PR-8: Graph Derivation Correctness

Fixes PR P0-13, P1-9, P1-10, P2-8.

Files:

- `src/canvas/graph.ts`
- `src/domain/diagnosticTargets.ts`
- `tests/domain.test.ts`
- `tests/fixture-node-coverage.test.ts`

Work:

- Replace diagnostic prefix matching with strict segment matching.
- Split duplicate-tag diagnostics into targetable single-path diagnostics or add an explicit multi-path diagnostic shape that `diagnosticTargets` understands.
- Add diagnostic targets or intentional global buckets for `certificate_providers` and `http_clients`.
- Gate outbound candidate edges on selector/urltest group type.
- Align untagged display labels and graph ids so RuleTables, Inspector, diagnostics, and graph focus use the same fallback identity.
- Add top-level collection shape validation in `normalizeConfig` so malformed arrays are rejected instead of silently dropped.
- Preserve user JSON key order in update paths, or constrain `stripUndefined` to places where object reconstruction is intentional.
- Replace silent rule-node caps with a visible "+N rules not visualized" node or banner.
- Stabilize `ruleSetTargetY` ordering.

Acceptance:

- `/outbounds/1` diagnostics never affect `/outbounds/10`.
- Users are never surprised by silently missing rules when there are more than 24 rules.

Status: implemented on 2026-05-28 in `atomic/canvas-pr8-graph-correctness`.

- Replaced graph diagnostic prefix matching with strict segment matching, so diagnostics like `/outbounds/10/server` no longer mark `/outbounds/1`.
- Split duplicate-tag diagnostics into one targetable `/.../tag` diagnostic per referenced entity instead of a comma-joined multi-path string.
- Added diagnostic focus and graph node coverage for `certificate_providers[]` and `http_clients[]`, including shared fallback untagged ids.
- Mirrored domain selector/urltest guards in graph derivation so stale `outbounds[]` arrays on non-group outbounds do not render editable candidate edges or consume candidate-edge budget.
- Dense route and DNS rule lists now render the first 24 ordered rule nodes plus a visual overflow notice instead of silently hiding every rule node.
- Moved rule-set node derivation after DNS rule target positions are known, keeping DNS-only rule-set nodes ordered below route-referenced rule-set nodes when appropriate.
- `normalizeConfig` now rejects malformed top-level and nested collection shapes before graph/list helpers can silently treat them as empty, and `stringifyConfig` now preserves object key order by relying on native JSON omission of `undefined` instead of recursively rebuilding objects.
- Frontend performance review: the graph changes add no new subscriptions, async work, dependencies, or hover/drag state. Overflow notices are derived during the existing memoized graph build and are non-deletable visual nodes.
- Verification passed locally: `git diff --check`, `pnpm exec tsc -b --pretty false`, `pnpm exec vitest run tests/domain.test.ts tests/diagnostic-targets.test.ts tests/fixture-node-coverage.test.ts tests/config-doc-capability.test.ts --reporter=dot`, `pnpm test`, `pnpm build`, and `pnpm e2e`.
- `pnpm build` still reports the existing Vite >500 kB single chunk warning; this remains tracked as PR-11 performance work.
- Official `sing-box-stable` / `sing-box-testing` checks were not run because this atomic changes import validation, semantic diagnostics, and derived graph visibility, not bundled fixture/exported config files.

### PR-9: Pending Line And Chip Picker UX

Implements the user-visible expected flow.

Files:

- `src/components/CanvasWorkspace.tsx`
- `src/components/SbcNode.tsx`
- new `src/components/ChipPickerPopover.tsx`
- `src/state/useProjectStore.ts`
- `src/styles.css`
- `e2e/port-click-redesign.spec.ts`

Work:

- Add pending port state and React Flow `onConnectStart` / `onConnectEnd`.
- Implement literal click behavior with `onClickConnectStart` / `onClickConnectEnd` or explicitly disable `connectOnClick`.
- Suppress `onPaneClick` selection clearing while a connection release is opening the picker.
- Highlight compatible handles from `portRelationRegistry`.
- On empty drop, show chip picker at cursor/drop coordinates.
- `createNodeAndConnect` creates canonical entity, connects through registry, pins layout, and selects/focuses the result.
- Direct drop on an existing compatible handle calls the same registry command.
- Add explicit connected-handle disconnect affordance.
- Keep mobile flow through Inspector/palette; do not force desktop drag UX onto mobile.

Acceptance:

- E2E covers all four expected frames.
- Cancelled pending connection leaves canonical config unchanged.
- Chip-created node and manually created+drag-connected node produce equivalent `SingBoxConfig`.

Status: implemented on 2026-05-28 in `atomic/canvas-pr9-pending-chip-picker`.

- Added local `CanvasWorkspace` pending-port state through React Flow `onConnectStart` / `onConnectEnd` and click-connect callbacks. This state stays out of canonical config/Zustand.
- Compatible existing handles are highlighted from `portRelationRegistry` while a line is pending; invalid targets do not highlight.
- Empty-canvas release opens a port-scoped chip picker at the drop point. Picking a chip creates a canonical entity, connects it through the same port command path as drag-connect, pins layout at the drop point, and selects/focuses the new node.
- Direct drop on an existing compatible node continues to call `connectPorts`; invalid drops and cancelled releases leave canonical config unchanged.
- Connected editable ports now expose an explicit disconnect affordance that removes the first visible deletable relation for that port through the same `disconnectEdge` command path as edge deletion.
- Added Playwright coverage for the four expected frames: pending line + compatible highlight + empty-drop picker, direct drop connect, invalid drop cancel/no mutation, and connected-handle disconnect.
- Frontend performance review: pending/hover/picker state is local to `CanvasWorkspace` and passed through a small context; no canonical config subscriptions or async waterfalls were added. The current context update can rerender visible nodes during a pending drag, which remains an optimization target for PR-11.
- Verification passed locally: `git diff --check`, `pnpm exec tsc -b --pretty false`, `pnpm exec vitest run tests/app.test.tsx tests/port-interaction-destructive.test.tsx tests/port-relation-registry.test.ts tests/sbc-node-ports.test.ts --reporter=dot`, `pnpm test`, `pnpm build`, and `pnpm e2e`.
- `pnpm build` still reports the existing Vite >500 kB single chunk warning; this remains tracked as PR-11 performance work.
- Official `sing-box-stable` / `sing-box-testing` checks were not run because this atomic changes editor interaction behavior, not bundled fixture/exported config files.

### PR-10: Stale Async And Validation State Cleanup

Fixes PR P1-1, P1-13, P1-14, P1-15, P1-16.

Files:

- `src/state/useProjectStore.ts`
- `src/components/CanvasWorkspace.tsx`
- tests for validation and import/apply paths.

Work:

- Unify `importJson` and `applyJsonDraft` state reset policy.
- Clear official diagnostics/check messages/focused node on channel, target, template, minimal, and import loads.
- Debounce `validateNow` with cleanup.
- Add official-check cancellation and stale-response discard.
- Defer derived `setNodes` while a node is being dragged.

Acceptance:

- No old official validator result is shown for a newer config.
- Dragging nodes is not interrupted by derived graph refresh.

Status: implemented on 2026-05-28 in `atomic/canvas-pr10-stale-validation-cleanup`.

- `importJson` and `applyJsonDraft` now share whole-document load behavior: successful loads clear selection, focused node, pinned layout, global panels, stale check notices, official diagnostics, and bump the fresh-load token.
- Channel, target, template, minimal, import, and failed JSON parse paths now reset semantic/official validation state so old validator output cannot remain attached to a newer config or target.
- `validateNow` is debounced through a cancellable timer/token, and any canonical config load/update cancels pending semantic notices before they can write stale `checkNotice` state.
- `runOfficialCheck` clears prior official diagnostics when it starts and discards late success/error responses if the config, channel, or version has changed since the request was sent.
- `CanvasWorkspace` now skips derived `setNodes(graph.nodes)` refreshes while a node drag is active, using a local ref so drag-time state stays outside canonical config and avoids extra render churn.
- Added store-level tests for import/apply validation reset, failed parse cleanup, semantic debounce cancellation, and official stale-response discard; added Playwright coverage proving a semantic validation refresh does not snap an active node drag.
- Frontend performance review: the canvas drag gate uses a ref instead of React state/Zustand, adds no new dependency or async waterfall, and only suppresses node replacement during active drag while still allowing edge updates. The existing Vite single-bundle warning remains tracked as PR-11 performance work.
- Verification passed locally: `git diff --check`, `pnpm exec tsc -b --pretty false`, `pnpm exec vitest run tests/validation-state.test.ts tests/app.test.tsx --reporter=dot`, `pnpm exec playwright test e2e/editor.spec.ts`, `pnpm test`, `pnpm build`, and `pnpm e2e`.
- Official `sing-box-stable` / `sing-box-testing` checks were not run because this atomic changes editor validation state handling and drag refresh behavior, not bundled fixture/exported config files.

### PR-11: React Performance Pass

Fixes PR P1-8, P2-14, P2-15, P2-17.

Files:

- `src/components/CanvasWorkspace.tsx`
- `src/components/SbcNode.tsx`
- `src/components/Inspector.tsx`
- `src/components/RuleTables.tsx`
- `src/components/Palette.tsx`
- `src/components/TopBar.tsx`
- `src/components/MobileMenuSheet.tsx`
- `src/state/useProjectStore.ts`

Work:

- Replace broad `state.config` subscriptions with narrow selectors or passed node data.
- Use `useShallow` for grouped primitive subscriptions.
- Precompute per-node/per-port connection booleans in graph data or expose narrow selectors, instead of scanning full config inside every `SbcNode` render.
- Keep pending port hover/drag state local or in a narrow UI-only store.
- Avoid calling `sync()` when a relation command returned no config change.
- Reduce repeated clone work in managed Shadowsocks service paths.
- Share `useViewport` media-query listeners across consumers instead of registering one listener per mounted component.
- Ensure optional heavy panels remain deferred where practical.
- Defer optional heavy imports such as Inspector/panels/mobile sheets where practical.
- Avoid React state updates on every BottomSheet pointer move if they cause mobile inspector rerenders.

Acceptance:

- Port hover/drag does not rerender the whole canvas.
- SbcNode render count stays bounded in an interaction smoke test.

### PR-12: Symmetry, Fixture Sweep, And Final Audit

Closes PR verification gap.

Files:

- `tests/port-interaction-symmetry.test.ts`
- `tests/fixture-node-coverage.test.ts`
- `e2e/port-click-redesign.spec.ts`
- goal doc update.

Work:

- For each registry relation, assert chip-create and drag-connect converge to the same canonical config when both flows are applicable.
- For every bundled fixture/template, derive graph, delete/rename/type-change every graph-managed entity in isolated copies, and assert no stale references/selection/layout remain.
- Re-run the PR #1 P0/P1/P2 audit list against HEAD and record unresolved P2s explicitly.

Acceptance:

- Zero remaining P0.
- No known P1 that causes incorrect mutation or visible UX defect.
- Any remaining P2 is documented with owner and follow-up.

## Near-Term Atomics

Only start with these three; do not pre-implement later phases until each one is reviewed.

1. PR-1: stop destructive port clicks and wire `onNodesDelete`.
2. PR-2: canonical reference registry plus identity state repair for rename/delete/move/type-change.
3. PR-3: introduce `portRelationRegistry` and structured id parsing.

After PR-3, revisit the remaining plan with the actual registry shape before continuing PR-4 onward.

## Test Plan

Unit and component tests:

- `tests/port-interaction-destructive.test.ts`: click on every old destructive port path leaves config unchanged.
- Include explicit no-mutation regressions for route hub deleting the last route rule, DNS hub deleting the last DNS rule, selector/urltest member deleting the last candidate, and Tailscale endpoint port auto-creating a DNS server.
- Include explicit no-mutation regression for inbound `route-rule-match` / `dns-rule-match` clicks when multiple route or DNS rules reference the same inbound.
- `tests/reference-registry.test.ts`: rename/delete/type-change covers every registered tag reference path.
- `tests/port-relation-registry.test.ts`: all rendered ports and emitted editable edges map to registry entries.
- Add structured id parser regressions for tags containing `:` and remove any dead raw `split(":")` helpers.
- `tests/port-disconnect-symmetry.test.ts`: every editable edge inverse command removes only the intended canonical reference.
- `tests/port-interaction-symmetry.test.ts`: chip-create path and drag-connect path converge.
- Existing `tests/app.test.tsx` old click-mutation tests must be rewritten.
- Existing `tests/sbc-node-ports.test.ts` must be updated after removing or wiring inert ports.
- Add Palette audit coverage so every exposed item either creates a wired entity, is disabled with a precondition, or is removed.
- Add serialization tests for malformed top-level collection shapes and update-path key-order preservation.
- Add diagnostic targeting tests for `/x/1` versus `/x/10`, duplicate-tag multi-path handling, and every semantic diagnostic path resolving to a node or intentional global bucket.

E2E:

- Add `e2e/port-click-redesign.spec.ts`.
- Desktop viewport:
  - hover port shows start affordance without config mutation;
  - press/drag shows pending line;
  - compatible handles highlight;
  - invalid targets do not highlight;
  - empty drop opens chip picker;
  - chip pick creates and connects;
  - drop on existing target connects;
  - connected-handle disconnect removes the relation;
  - invalid drop cancels without mutation.
- Mobile viewport:
  - no forced drag-only interaction;
  - Inspector/palette paths remain usable.

Manual smoke:

- Import representative external configs if available, including `Jego.json` and `Gougou.json`.
- Hover all node types.
- Run browser semantic Check.
- If official validator endpoint/binaries are available, run target-matched official check.
- Delete at least one relation from each editable edge family.

## Verification Commands

Run at each PR:

```bash
git diff --check
pnpm test
pnpm build
```

Run when UI interaction changes:

```bash
pnpm e2e
```

Run when fixtures or export behavior change:

```bash
pnpm audit:config-docs
```

Run target-matched official validation when fixture/config output changes and binaries are available:

```bash
sing-box-stable check -c <stable-fixture>
sing-box-testing check -c <testing-fixture>
```

If an official check cannot run, the final milestone report must say so and distinguish browser semantic validation from official sing-box validation.

## Done Definition

This goal is complete only when:

- All PR-1 through PR-12 work is merged or explicitly marked not applicable with a reason.
- The expected four-frame port flow passes Playwright on desktop.
- Mobile retains an accessible inspector/palette path.
- Every editable graph edge has connect and disconnect symmetry tests.
- Tag rename/delete/type-change leaves no stale known references.
- `selectedId`, `focusedNodeId`, and `layout.positions` do not point at deleted or renamed ids.
- Broad frontend subscriptions are narrowed enough that hover/drag does not rerender unrelated panels/nodes.
- `pnpm test`, `pnpm build`, and applicable e2e/official checks pass.
- The final milestone report records deviations, unresolved P2s, and official validation availability.

## Milestone Notes

### PR-1 Stop Destructive Port Clicks

Status: implemented on 2026-05-28 in `atomic/canvas-pr1-stop-destructive-clicks`.

- Port button clicks no longer mutate canonical `SingBoxConfig` directly. Pending line, compatible highlight, empty-drop chip picker, and direct-drop connection remain scoped to PR-9.
- Node deletion through React Flow keyboard deletion is wired to `deleteEntity`.
- Regression coverage includes old route/DNS/rule/group/detour destructive click paths and the P1-7 multi-rule inbound reference case.
- Verification passed locally: `git diff --check`, `pnpm test`, `pnpm build`, and `pnpm e2e`.
- Official `sing-box-stable` / `sing-box-testing` checks were not run because this atomic does not change fixture/exported config output.

### PR-2 Canonical Reference Registry And Identity State Repair

Status: implemented on 2026-05-28 in `atomic/canvas-pr2-reference-registry`.

- Added a canonical reference registry for known tag reference replacement/removal, including inbound, outbound, DNS server, endpoint, service, rule-set, HTTP client, and certificate provider references.
- `renameTag` now rejects duplicate target tags before mutation and uses the registry for cascading references.
- `deleteEntity` and `changeEntityType` now scrub registered dependent references instead of relying on scattered command branches.
- Store command wrappers remap or clear `selectedId`, `focusedNodeId`, and `layout.positions` after tag rename, entity delete, and ordered rule move/delete.
- Inspector tag editing no longer overwrites a focused draft when unrelated entity fields update.
- Frontend performance review: identity repair is kept in store command callbacks; no new broad subscriptions or drag/hover global state were added. The registry is command-path code with no new dependency.
- Verification passed locally: `git diff --check`, `pnpm exec vitest run tests/domain.test.ts tests/app.test.tsx`, `pnpm test`, `pnpm build`, and `pnpm e2e`.
- Official `sing-box-stable` / `sing-box-testing` checks were not run because this atomic does not change bundled fixture/exported config output.

### PR-3 Port Relation Registry And Structured Ids

Status: implemented on 2026-05-28 in `atomic/canvas-pr3-port-relation-registry`.

- Added `portRelationRegistry` as the shared registry for port endpoints, relation mode (`writable`, `readonly`, `decorative`, `order-only`), structured node id parsing, and encoded edge id formatting/parsing.
- `deriveGraph` now emits edge ids through `formatEdgeId`, so tags containing `:` round-trip through graph edges and disconnect parsing without truncation.
- `SbcNode` port specs are derived from registry endpoints instead of local branching, and `CanvasWorkspace.isValidConnection` now accepts only registry-backed writable relations.
- Removed the dead `getSelectedRef` helper and replaced remaining local node id parsing in touched paths with structured helpers or first-colon parsing.
- Added `tests/port-relation-registry.test.ts` coverage for colon-tag node/edge ids, graph edge registry mapping, visual-only relation exclusion from writable validation, and disconnect parsing for encoded ids.
- Frontend performance review: no hover/drag state was introduced; Canvas connection validation now performs a small registry lookup instead of recomputing port specs for both nodes; no new dependency or async/data waterfall was added. The existing single-bundle Vite warning remains a broader PR-11/code-splitting concern.
- Verification passed locally: `git diff --check`, `pnpm exec tsc -b --pretty false`, `pnpm exec vitest run tests/port-relation-registry.test.ts tests/port-interaction-destructive.test.tsx tests/app.test.tsx tests/sbc-node-ports.test.ts tests/config-doc-capability.test.ts`, `pnpm test`, `pnpm build`, and `pnpm e2e`.
- Official `sing-box-stable` / `sing-box-testing` checks were not run because this atomic does not change bundled fixture/exported config output.

### PR-4 Complete Disconnect Coverage

Status: implemented on 2026-05-28 in `atomic/canvas-pr4-disconnect-coverage`.

- Added disconnectability metadata to the port relation registry, separate from connectability. Writable relations remain disconnectable by default; readonly-but-canonical visual edges such as resolved DNS service and settings NTP detour are deletable without becoming drag-connect targets.
- Derived graph edges now set React Flow `deletable` from registry disconnectability, so route/DNS order and decorative inbound hub edges are non-deletable visual edges.
- `disconnectEdge` now no-ops by identity for readonly/order-only/decorative relations and covers outbound detour, DNS-server detour/service, service detour, service verify endpoint, service SSM inbound, rule-set download detour, and settings NTP detour in addition to the previously covered route/DNS/rule-set/endpoint edges.
- Added `tests/port-disconnect-symmetry.test.ts` with a broad canonical fixture that asserts every emitted deletable relation family has a working inverse and every visual-only family is non-deletable/no-op.
- Frontend performance review: edge deletability is derived during graph construction from a small registry lookup; no hover/drag state, broad subscriptions, or async waterfall were introduced. The existing single-bundle Vite warning remains a broader PR-11/code-splitting concern.
- Verification passed locally: `git diff --check`, `pnpm exec tsc -b --pretty false`, `pnpm exec vitest run tests/port-disconnect-symmetry.test.ts tests/port-relation-registry.test.ts tests/domain.test.ts tests/sbc-node-ports.test.ts`, `pnpm test`, `pnpm build`, and `pnpm e2e`.
- Official `sing-box-stable` / `sing-box-testing` checks were not run because this atomic changes editor commands and derived graph metadata, not bundled fixture/exported config output.

### PR-5 Reference Rename/Delete Completeness Audit

Status: implemented on 2026-05-28 in `atomic/canvas-pr5-reference-coverage`.

- Added registry-aligned parameterized tests that enumerate every `referenceRegistry` kind/path and assert both rename and delete behavior from canonical `SingBoxConfig`.
- The coverage fixture exercises inbound, outbound, DNS server, endpoint, service, rule-set, HTTP client, and certificate provider references, including DNS server `domain_resolver`, NTP/clash/rule-set detours, v2ray stats arrays, resolved service links, and TLS certificate provider references across supported owners.
- Delete tests assert that semantic diagnostics do not report stale known references after `deleteEntity` scrubs the removed entity's registered references.
- Follow-up review fixes in this atomic remove an untraced `services[].http_client` registry path, scrub `domain_resolver` objects when their server tag is removed, avoid treating HTTP client `domain_resolver` as an outbound detour reference, and make service detour relation ids unique.
- Frontend performance review: the only frontend touch is a static `SbcNode` icon-map addition for `certificate-provider` / `http-client` ids; no new subscription, async path, drag state, or render-time derived graph work was added.
- Verification passed locally: `git diff --check`, `pnpm exec tsc -b --pretty false`, `pnpm exec vitest run tests/domain.test.ts tests/port-disconnect-symmetry.test.ts tests/port-relation-registry.test.ts tests/config-doc-capability.test.ts --reporter=dot`, `pnpm test`, `pnpm build`, and `pnpm e2e`.
- Official `sing-box-stable` / `sing-box-testing` checks were not run because this atomic does not change bundled fixture/exported config output.

### PR-6 Source-Type Guards And Validator-Safe Scaffolds

Status: implemented on 2026-05-28 in `atomic/canvas-pr6-source-guards`.

- `connectSelectorCandidate` now writes only to existing selector/urltest parents with existing child outbounds, so command paths cannot inject candidates into arbitrary outbound objects or create missing-candidate diagnostics.
- Route rule outbound writes and DNS rule server writes are normalized by rule `action` in the domain command layer, with store connection paths prechecking the same guards before creating helper resources.
- Dial detour writes now share the same outbound/DNS-server Dial Field eligibility used by `sharedFieldRegistry`, so selector/urltest/block/DNS outbounds and non-dialable DNS server types are not mutated by canvas/store helpers.
- `createCompatible` tracks the entity created by the current action and connects only that entity; it no longer reads stale latest outbound/DNS server entries and overwrites route/DNS finals or group membership.
- Palette migration/documentation resources for legacy DNS server, legacy WireGuard outbound, and DNS outbound are explicitly non-actionable `Docs` entries; cloudflared and mDNS remain disabled gates.
- `addDnsServer("tailscale")` and `addDnsServer("resolved")` create validator-safe dependent endpoint/service scaffolds, while `createRuleSet` now rejects unknown types instead of silently falling back to remote.
- Frontend performance review: Palette changes are static metadata/status changes and tests only; no new subscriptions, render-time graph work, async/data waterfall, or bundle dependency was added. The existing Vite single-bundle warning remains a PR-11 performance item.
- Verification passed locally: `git diff --check`, `pnpm exec tsc -b --pretty false`, `pnpm exec vitest run tests/domain.test.ts tests/app.test.tsx --reporter=dot`, `pnpm test`, `pnpm build`, and `pnpm e2e`.
- Official `sing-box-stable` / `sing-box-testing` checks were not run because this atomic changes editor command scaffolds and guard behavior, not bundled fixture/exported config files.

## Open Decisions

- Disconnect affordance: default to connected-handle small `x`; edge context menu and keyboard delete are optional additions.
- Feature flag: ship the pending-line/chip picker behind a dev-enabled flag only if PR-9 cannot land atomically. Do not use the flag to keep destructive click paths alive.
- Chip anchor: default to drop/cursor coordinates.
- Layout pinning: default to drop coordinates with column snap when the drop is inside a known relation column.
- HTTP client and certificate provider nodes: PR-5 may add `EntityRef` support before full Inspector forms. If forms are not ready, keep them graph-managed but clearly documented as resource nodes with limited editing.
