# service-ssm-api — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The node is in solid shape and pass-1's three P0s are now FIXED: canvas edge-draw sets `managed:true` (useProjectStore.ts:541), the Inspector filters/labels managed state via a checklist (Inspector.tsx:4743-4804), and the empty-`servers` case is covered by a diagnostic + add-flow that pre-wires `servers["/"]`. All four official fields (Listen, `servers`, `cache_path`, `tls`) are reachable. Remaining issues are correctness edge-cases: the raw-JSON escape hatch can write a string into `servers` (type-corruption), canvas connect hardcodes the `/` key (overwrites existing root mapping), and toggle-off leaves orphan `managed:true` on the inbound.

## 1. Left Palette

`Palette.tsx:197` — `{ label: "SSM API", kind: "service-ssm-api", icon: Server, docsUrl: docs("service/ssm-api/"), status: "setup" }`.
- Present under category "Services" (correct — it is a `services[]` resource, not a route target). Label "SSM API" is correct and matches the upstream page title.
- `docsUrl` resolves to `service/ssm-api/` — correct official path.
- `status: "setup"` renders as a badge; clicking runs `addService(config, "ssm-api")` (commands.ts:467-490) which auto-creates/reuses a `managed:true` shadowsocks inbound (method `2022-blake3-aes-128-gcm`, demo password) and pre-wires `servers["/"]`. Good guided add-flow.
- Maps to canonical type via `protocols.ts:136` and `protocols.ts:142` (`CREATABLE_SERVICE_TYPES` includes `ssm-api`). No gating — correct (SSM API is platform-agnostic, unlike `resolved`/`derp`).

## 2. Canvas Node

- Title = tag; subtitle = `ssm-api {N} managed servers` (`graph.ts:773-777`). Status from diagnostics (`graph.ts:668`). `compatible: ["Shadowsocks Inbound"]` (`graph.ts:669`).
- Ports: ONE input handle `managed-inbound`, ZERO output handles — verified by `tests/sbc-node-ports.test.ts:49` (`inputKeys:["managed-inbound"], outputKeys:[]`). No route/outbound/DNS ports — correct per semantics.
- Edges: for each `servers` entry, `graph.ts:687-691` emits `inbound:{inboundTag} → service:{tag}` (handles `service`/`managed-inbound`). Direction is correct: the shadowsocks inbound is the referenced upstream, the SSM service is downstream consumer.
- `SbcNode.tsx:187-190` reports the `managed-inbound` port as "connected" when `servers` is non-empty. `SbcNode.tsx:213-221` reports the inbound's `service` output as connected when any ssm-api service references it. Both correct.
- Subtitle counts endpoint paths, not distinct inbounds — fine, matches the map cardinality.

## 3. Upstream/Downstream Links

- `portRelationRegistry.ts:113` — `relation("service-ssm-inbound", "writable", output inbound/shadowsocks → input service/ssm-api, "/services/*/servers", ["inbound"])`. Type-restricted to `shadowsocks` (output `nodeType`) and `ssm-api` (input `nodeType`). Correct, and matches the upstream rule (servers values reference shadowsocks inbound tags only).
- `referenceRegistry.ts:328` — `/services/*/servers` is registered under inbound-tag references, so inbound rename cascades to `service.servers` values (useProjectStore.ts:131-134) and inbound delete strips the entry (useProjectStore.ts:149-150). Correct cascade.
- No EXTRA links: `servers` is not in the outbound/endpoint/dns reference path lists (`referenceRegistry.ts:334,346,352`). Correct — SSM API has no detour/outbound port.
- MISSING: none for the official `servers` model. (`detour` exists on ServiceConfig but is a ccm/ocm field; ssm-api never emits a detour edge — `graph.ts:677` only fires for ocm/ccm. Correct.)

## 4. Right Inspector (fields)

| Official field | Required | UI control | State |
|---|---|---|---|
| `type` (`"ssm-api"`) | yes | fixed (not editable) | Correct — set at create, never shown as input. |
| Listen Fields (shared) | yes | shared "listen" group | Wired via `sharedFieldRegistry.ts:198` → rendered from `Inspector.tsx:1431-1451` (listen, listen_port, bind_interface, reuse_addr, tcp/udp opts, detour). Correct. |
| `servers` | **yes** | checklist + raw JSON | `Inspector.tsx:4745-4795` checklist of shadowsocks inbounds; toggling sets the map AND `managed=true` (4766-4767). Plus `JsonField` multi-path escape hatch (4803). Functional but see P0/P1 below. |
| `cache_path` | no | text input | `Inspector.tsx:4796-4802` plain text, `undefined` on empty. Correct control type. |
| `tls` (inbound TLS) | no | shared "tls" group | Wired via `sharedFieldRegistry.ts:199` → rendered from `Inspector.tsx:1502-1547` (enabled, server_name, cert/key, reality, ech, utls...). Correct group; this is the inbound TLS section as required. |

Field-model conformance: every official field is exposed; no UI field is invented beyond the official model (cache_path/servers/tls/listen only). `serviceHandledFields` (`Inspector.tsx:283-284`) lists `servers`/`cache_path`/`tls`, so the generic Advanced editors do NOT double-render them.

## Findings (prioritized)

- **[P1] Invalid JSON in the `servers` escape hatch corrupts the field to a string.** `Inspector.tsx:806-814` (`JsonField`): on `JSON.parse` failure it falls back to `onChange(event.target.value)`, writing a raw string into `entity.servers`. `servers` is typed `Record<string,string>` (`types.ts:60`); a string value breaks `Object.entries(service.servers)` consumers (graph.ts:688, diagnostics.ts:145, referenceRegistry.ts:132) until corrected. The checklist guards (`objectField` coerces non-objects to `{}` at read, Inspector.tsx:4752), so the canvas/diagnostics tolerate it, but the persisted JSON is invalid. Fix: in the ssm-api JsonField `onChange`, ignore writes that don't parse to a plain object, or keep last-valid value.

- **[P1] Canvas connect hardcodes the `/` key, silently overwriting an existing root mapping.** `useProjectStore.ts:540` (`connectDirectedPortReference`): `{ ...currentServers, "/": outputNode.value }`. If `servers["/"]` already points at inbound A, dragging an edge from inbound B re-points `/` to B and drops A's only mapping (A keeps `managed:true` orphaned — see next). The Inspector checklist avoids this by using `/${tag}` for the 2nd+ entry (Inspector.tsx:4763), so the two add-paths are inconsistent. Fix: on canvas connect, allocate a non-colliding key (mirror the checklist's `/` vs `/${tag}` logic) instead of always `/`.

- **[P1] Toggle-off / clear leaves orphan `managed:true` on the inbound.** `useProjectStore.ts:1116-1117` (`togglePortConnection`, port off) resets `service.servers` to `{}` but never reverts `inbound.managed`. Same asymmetry on the Inspector checklist for the *displaced* tag: `toggleManaged` (Inspector.tsx:4756-4768) only flips `managed` for the clicked tag, so the canvas connect that set `managed:true` (line 541) is never undone when the mapping is cleared via the port toggle. Result: a shadowsocks inbound stays `managed:true` with no SSM service consuming it (changes its wire protocol with no manager). Fix: when removing the last `servers` entry for an inbound, set `managed` back to `undefined` (guard: only if no other ssm-api service references it).

- **[P2] `cache_path` is written but absent from the `ServiceConfig` type.** `types.ts:55-61` omits `cache_path`; `Inspector.tsx:4799` writes it via the untyped index path. Works at runtime but loses type safety / autocompletion and is invisible to type-level consumers. Fix: add `cache_path?: string` to `ServiceConfig`.

- **[P2] Endpoint-path semantics are opaque in the UI.** The checklist hides the HTTP endpoint path entirely (auto-assigns `/` or `/${tag}`, Inspector.tsx:4763); only the raw JSON exposes it. Upstream documents the key as an HTTP endpoint path (default example `/`). Acceptable as a simplification, but a user importing `{"/":"a","/v2":"b"}` sees two checkboxes with no path labels, and editing paths requires the raw JSON. Fix (future): structured repeater of `{path input | inbound select}`, or at least show the current path next to each checked row.

- **[P2] No live "not managed" warning for externally-unmanaged referenced inbounds.** The checklist only shows `(sets managed=true)` for a *selected-but-not-yet-managed* row (Inspector.tsx:4788). If an inbound is referenced by `servers` but later has `managed` removed elsewhere, the Inspector shows no inline cue (only the global diagnostic `ssm-api-inbound-not-managed-shadowsocks`, diagnostics.ts:155-163, fires). Minor; the diagnostic covers correctness.

### Where pass-1 is now stale
- Pass-1 P0 "select does not filter for managed" — STALE. Inspector now computes `managedTags` and labels unmanaged rows (Inspector.tsx:4749-4751, 4788).
- Pass-1 P0 "servers can be left empty (None option)" — STALE for the control (checklist has no `None` option; empty state shows a hint at 4772-4774) and is covered by diagnostic `ssm-api-no-managed-inbound` (diagnostics.ts:136-144).
- Pass-1 P0 "edge draw does not set managed:true" — STALE/FIXED at useProjectStore.ts:541 (and tested in app.test.tsx:805).
- Pass-1 P1 "select overwrites multi-path on change" — PARTIALLY STALE: the checklist now preserves other entries (Inspector.tsx:4758-4765), but the canvas-connect path still hardcodes `/` (new P1 above).
- Pass-1 P1 "no managed status feedback" — STALE (now labeled). Pass-1 "multi-path only via raw JSON" — still true (downgraded to P2 here; checklist covers the common case).

SUMMARY: 0 P0, 3 P1, 3 P2.
