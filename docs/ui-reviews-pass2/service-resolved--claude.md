# service-resolved — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

<!-- Upstream authority read in full: docs/upstream/sing-box/testing/configuration/service/resolved.md
     + shared/listen.md + service/index.md. This is the RESOLVED *service* (services[]),
     NOT the dns-server resolved node (dns.servers[]). -->

## Verdict (2-3 sentences)

The resolved **service** node is in solid shape and most pass-1 gaps are now fixed: the Palette flags Linux-only, `createService` seeds the correct `127.0.0.53:53` defaults, the listen group renders all 14 listen fields incl. `detour`, an always-on platform diagnostic + Inspector PlatformBanner exist, and the `dns.servers[].service` relationship is fully modeled in `portRelationRegistry` + `referenceRegistry` (rename/remove propagate, edge renders). The one real defect: the `dns-server-service` relation is mode `"readonly"`, but `connectDirectedPortReference`/`isValidConnection` only accept `"writable"` relations, so the inbound `dns-server` handle on this node renders a clickable `+` that can never connect — a dead affordance (the very class of bug this branch targets). Secondary: no `required` marker on `listen`/`listen_port` and no `udp_timeout`/`tcp_keep_alive` default placeholders.

## 1. Left Palette

- Present. `src/components/Palette.tsx:196` — `{ label: "Resolved (Linux only)", kind: "service-resolved", icon: Server, docsUrl: docs("service/resolved/"), status: "setup" }`.
- Category **Services** — correct vs `service/index.md` taxonomy (`resolved` is one of 6 service types).
- Label now carries the "(Linux only)" qualifier (pass-1 flagged its absence — **now stale/fixed**).
- `status: "setup"` consistent with sibling service nodes; docs link resolves to the matching page.
- Distinct from the DNS-server variant `dns-resolved` ("Resolved Server (Linux only)", `Palette.tsx:96`). Both map to type `"resolved"` but in different arrays — no collision. Good.
- Verdict: correct. No findings.

## 2. Canvas Node

- Title bar shows `service / resolved` (`SbcNode.tsx:291`) — kind/type, addresses pass-1 "show human name + small type" intent (**stale**).
- Subtitle `"systemd-resolved service"` (`graph.ts:779`) — accurate and informative.
- Status badge = `diagnosticStatus(/services/{i})`; the always-on Linux warning (see §Findings) keeps it non-green, which is the intended platform signal.
- `compatible: []` for resolved (`graph.ts:669` ternary covers only ssm-api/derp) — no drag-to-create hint. Defensible: the only relationship is a *reverse/readonly* ref owned by the dns-server, so a create-pairing CTA here would be misleading. Pass-1 P1 recommending `["Resolved DNS Server"]` is **low value / optional** at best.
- Ports (auto-derived from `portRelations` via `getPortSpecs`): the resolved service gets exactly ONE input handle `dns-server` ("Upstream resolved DNS server") from relation `dns-server-service` (`portRelationRegistry.ts:114`), and no output handles. Semantically correct: a resolved service is a sink referenced by `dns.servers[].service`; it has no outbound type-specific peers.
- **Defect**: that input handle renders a `+` (not-connected) affordance (`SbcNode.tsx:340`) yet (a) `isPortConnected` has no `kind==="service" && portKey==="dns-server"` case so it is *always* shown disconnected even when wired, and (b) the relation is `readonly` so it can never be connected by drag. See P0/P1 in Findings.

## 3. Upstream/Downstream Links

Official model: the ONLY relationship is inbound — `dns.servers[].service` → this service's `tag` (resolved.md "See also: Resolved DNS Server"). No outbound peers (it is a fake systemd-resolved DBUS sink). `detour` is NOT a documented field for resolved (resolved.md lists only listen fields; `detour` is a generic listen field, valid but not type-specific).

| Link | Registry state | Verdict |
|---|---|---|
| `dns.servers[].service` → service:resolved (inbound) | `portRelationRegistry.ts:114` relation `dns-server-service` (readonly, disconnectable); `referenceRegistry.ts:351-352` kind `service`, path `/dns/servers/*/service` (replace/remove wired) | Present & correct |
| Canvas edge for the above | `graph.ts:558-571` builds `dns-server-service` edge when `server.type==="resolved" && server.service` | Present (pass-1 P0 **stale/fixed**) |
| Outbound type-specific peers | none defined | Correct (none should exist) |

- No missing links. No extra/wrong links. The model matches upstream exactly.
- Pass-1's three P0/P2 items about "canvas has no edge", "no input port spec", "DnsServerConfig lacks service", "no store handler" are **all stale** — edge, auto-derived port, ref registry, and generic store path now exist.
- Caveat (carried into Findings): the relation is `readonly`, so creation is only reachable from the **dns-server** Inspector (`Inspector.tsx:4235-4249`, a proper `<select>` of resolved-service tags) or raw JSON — never by canvas drag onto this node.

## 4. Right Inspector (fields)

Service block: `Inspector.tsx:4735`. Resolved path = PlatformBanner (`4737-4742`) → shared listen group (rendered via `SharedFieldCards`, defs at `1431-1450`) → `AdvancedScalarFields`/`AdvancedNonScalarFields` fall-through (`5260-5261`). `serviceListenTypes` includes `resolved` so the listen group shows (`sharedFieldRegistry.ts:158`); `resolved` is correctly absent from TLS/http2/quic/dial/multiplex owner sets (no spurious sections).

| Official field | Req | Default | UI control | State |
|---|---|---|---|---|
| `type` (`"resolved"`) | fixed | resolved | `<select>` of CREATABLE_SERVICE_TYPES (`2145`) | OK (type-switch preserves tag refs via referenceRegistry) |
| `tag` | yes | — | tag input (entity header) | OK |
| `listen` | **Required** | `127.0.0.53` | text (`1436`) | Present; **no required marker, no placeholder** — seeded default shows because `createService` writes it (`commands.ts:497`), but clearing it is silently allowed |
| `listen_port` | Required (per resolved.md) | `53` | number (`1437`) | Present; seeded default shown; no required marker |
| `bind_interface` | no | — | text (`1438`, "1.12+") | OK |
| `routing_mark` | no (Linux) | — | text (`1439`, "Linux") | OK — text correctly allows int or `"0x.."` hex per upstream |
| `reuse_addr` | no | — | boolean (`1440`, "1.12+") | OK |
| `netns` | no (Linux) | — | text (`1441`, "Linux,1.12+") | OK |
| `tcp_fast_open` | no | — | boolean (`1442`) | OK |
| `tcp_multi_path` | no | — | boolean (`1443`) | OK (pass-1 "missing" **stale**) |
| `disable_tcp_keep_alive` | no | — | boolean (`1444`, "1.13+") | OK (**stale**) |
| `tcp_keep_alive` | no | `5m` | text (`1445`, "1.13+") | Present; no `5m` default hint (**stale** as "missing field") |
| `tcp_keep_alive_interval` | no | `75s` | text (`1446`) | Present; no `75s` hint (**stale**) |
| `udp_fragment` | no | — | boolean (`1447`) | OK (**stale**) |
| `udp_timeout` | no | `5m` | text (`1448`) | Present; no `5m` hint |
| `detour` | no | — | `<select>` of inbound tags (`1449`, "Inbound Detour") | OK — correctly scoped to inbounds (Injectable), not outbounds |
| deprecated `sniff*`,`domain_strategy`,`udp_disable_domain_unmapping` | n/a | — | not surfaced | Correct to omit (deprecated 1.11) |

- No UI fields are exposed that are absent from the official model. No invalid-JSON write surface for this type (no `JsonField` on the resolved path; only ssm-api uses one). Unknown scalars would spill into `AdvancedScalarFields`, which is acceptable.
- Pass-1 "no dedicated Inspector copy / no platform warning" is **stale** — the PlatformBanner (`4737-4742`) is strong and accurate.
- Still absent (pass-1 P1, optional): a reciprocal "Add Resolved DNS server" action on this node. The pairing is fully reachable from the dns-server side, so this is a convenience-only gap.

## Findings (prioritized)

- **[P1] Dead `+` affordance on the inbound `dns-server` handle** — relation `dns-server-service` is mode `"readonly"` (`src/domain/portRelationRegistry.ts:114`), but both `connectDirectedPortReference` (`src/state/useProjectStore.ts:512-521`, filters `["writable"]`) and `isValidConnection` (`src/components/CanvasWorkspace.tsx:31-40`, filters `["writable"]`) reject readonly relations. The handle still renders a clickable `+` (`src/components/SbcNode.tsx:340`) whose `onClick` only `stopPropagation()`s — clicking and dragging both no-op. Either suppress the `+`/drag affordance for readonly handles or route creation to the dns-server `service` select. (Squarely in scope of branch `atomic/canvas-pr1-stop-destructive-clicks`.)

- **[P1] Inbound handle never shows "connected"** — `isPortConnected` has no `direction==="input" && kind==="service" && portKey==="dns-server"` case (`src/components/SbcNode.tsx:187-203`), so it falls to `return false` (`:203`) even when a `dns.servers[].service` points at this tag. Symmetric gap on the source side: no `kind==="dns-server" && portKey==="service"` output case (`:246-251` region), so the dns-server's `service` handle also always shows disconnected. The edge renders, but neither endpoint shows connected state. Add both cases (mirror `verify_client_endpoint` at `:261-263`).

- **[P2] `listen` / `listen_port` lack a required marker** — both are `==Required==` in resolved.md (`Inspector.tsx:1436-1437`, plain text/number, no required prop). `SharedFieldDefinition` (`Inspector.tsx:1356-1360`) has no `required` field at all. Defaults are seeded by `createService` so the happy path is fine, but a user clearing `listen` gets no marker and no diagnostic. Add a `required` flag + a diagnostic for empty `listen` on listen-owning services/inbounds.

- **[P2] No default-value placeholders for documented listen defaults** — `tcp_keep_alive` (`5m`), `tcp_keep_alive_interval` (`75s`), `udp_timeout` (`5m`) render as bare text inputs (`Inspector.tsx:1445,1446,1448`) with no placeholder, unlike many other inputs in this file that show example placeholders. Minor: surface the doc defaults as placeholders.

- **[P2] No reciprocal attach action on the service node** — the resolved service Inspector (`Inspector.tsx:4735-4742`, then fall-through) offers no "Add Resolved DNS server" CTA. Reachable from the dns-server side select (`Inspector.tsx:4235-4249`), so convenience-only.

### Stale pass-1 items (now fixed in code)
- Palette "(Linux only)" qualifier added (`Palette.tsx:196`).
- Canvas edge for dns-resolved → service:resolved exists (`graph.ts:558-571`).
- Port spec auto-derived; relation + reference registry + generic store path exist (`portRelationRegistry.ts:114`, `referenceRegistry.ts:351-352`).
- Inspector platform copy exists (`Inspector.tsx:4737-4742`).
- Listen group now renders all 14 fields incl. `tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, `udp_fragment`, `detour` (`Inspector.tsx:1431-1450`).
- Linux-only diagnostic present & always-on (`diagnostics.ts:218-226`); dns-server side missing/not-found service diagnostics present (`diagnostics.ts:1090-1115`).

SUMMARY: 0 P0, 2 P1, 3 P2.
