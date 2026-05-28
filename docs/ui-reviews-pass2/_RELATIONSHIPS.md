# Node-Relationship Graph Audit (pass 2 consolidated)

Holistic audit of how sbc-ui nodes connect: canvas ports/edges (`portRelationRegistry.ts`,
`graph.ts`, `SbcNode.tsx`, connect/disconnect in `useProjectStore.ts`) and rename/delete
reference integrity (`referenceRegistry.ts`), measured against sing-box **testing 1.14**
(`docs/upstream/sing-box/testing/configuration/**`). Harvested from the 66 per-node
`## 3. Upstream/Downstream Links` sections; every claim re-verified in code.

Two registries express the model:
- **Canvas port relation** = a `PortRelation` in `portRelationRegistry.ts` → renders a port
  (`SbcNode.getPortSpecs`), an edge (`graph.ts`), and connect/disconnect handlers.
- **referenceRegistry entry** = rename/delete propagation only (no visual). A reference can be
  in one, both, or neither. "Neither" = invisible AND produces dangling refs on rename/delete.

---

## Intended relationship model (matrix)

Legend: Port = canvas port/edge present; Ref = referenceRegistry propagation present.
Y = yes/correct, N = no/missing, ~ = present-but-wrong/over-broad.

| # | Source kind (field) | → Target kind | Port | Ref | Notes |
|---|---|---|---|---|---|
| 1 | route (`final`) | outbound | Y | Y | `route-final` (portReg:93); ref `/route/final` (refReg:334). Endpoint tag as `final` not selectable (P2-c). |
| 2 | route-rule (`outbound`, route/bypass action) | outbound | Y | Y | `route-rule` (portReg:95); ref `/route/rules/*/outbound` (refReg:334). Tracks deprecated *top-level* key, not `action.outbound` (P2). |
| 3 | route-rule (`rule_set[]`) | rule-set | Y | Y | `route-rule-set` (portReg:96); ref refReg:358. |
| 4 | route-rule (`inbound[]` matcher) | inbound | Y | Y | `route-rule-inbound` (portReg:94); ref `/route/rules/*/inbound` (refReg:328). |
| 5 | route-rule (`resolve.server` action) | dns-server | **N** | **N** | Real 1.14 ref (`rule_action.md:320`); neither registry. Dangling on rename/delete. **P1**. |
| 6 | route (`default_domain_resolver`) | dns-server | **N** | Y | Ref `*/domain_resolver`+`/route/default_domain_resolver` (refReg:340); no edge. **P1 (visual)**. |
| 7 | route (`default_http_client`) | http-client | N | Y | Ref refReg:364. No http-client node on lane; acceptable. |
| 8 | dns (`final`) | dns-server | Y | Y | `dns-final` (portReg:98); ref `/dns/final` (refReg:340). |
| 9 | dns-rule (`server`, route/evaluate) | dns-server | Y | Y | `dns-rule` (portReg:101); ref `/dns/rules/*/server`. Uses deprecated *flat* `server`, not `action.server` (P1, rule-dns-rule). |
| 10 | dns-rule (`rule_set[]`) | rule-set | Y | Y | `dns-rule-set` (portReg:102); ref refReg:358. |
| 11 | dns-rule (`inbound[]` matcher) | inbound | Y | Y | `dns-rule-inbound` (portReg:99); ref refReg:328. |
| 12 | selector (`outbounds[]`) | outbound | Y | Y | `selector` (portReg:103); ref `/outbounds/*/outbounds`. |
| 13 | urltest (`outbounds[]`) | outbound | Y | Y | `urltest` (portReg:104); ref `/outbounds/*/outbounds`. |
| 14 | selector/urltest (`default`) | outbound | N | Y | Ref `/outbounds/*/default` (refReg:334). Inspector-gated; acceptable. |
| 15 | outbound (`detour`, dial) | outbound | Y | Y | `outbound-detour` (portReg:106); source excludes block/selector/urltest/dns. Target NOT excluded → can detour *through* block (P2-f). |
| 16 | dns-server (`detour`, dial) | outbound | ~ | Y | `dns-server-detour` (portReg:105) **has no type guard** → spurious port on fakeip/hosts/resolved/tailscale (P1-a). Ref `/dns/servers/*/detour`. |
| 17 | dns-server[tailscale] (`endpoint`) | endpoint | Y | Y | `dns-server-endpoint` (portReg:107); ref `/dns/servers/*/endpoint`. |
| 18 | dns-server[resolved] (`service`) | service | Y | Y | `dns-server-service` readonly (portReg:114); ref `/dns/servers/*/service`. |
| 19 | endpoint (`detour`, dial) | outbound | Y | Y | `endpoint-detour` (portReg:108); ref `/endpoints/*/detour`. |
| 20 | endpoint[wg/tailscale] AS route/selector/dns target | (outbound-namespace) | **N** | **N** | Endpoints share the outbound tag namespace but have no input ports and are not referent in `outbound` ref paths. **P1-b**. |
| 21 | service[ccm/ocm] (`detour`) | outbound | Y | Y | `service-detour-ccm/-ocm` (portReg:109-110); ref `/services/*/detour`. Duplicate Inspector control (P1-e). |
| 22 | service[derp] (`verify_client_endpoint[]`) | endpoint[tailscale] | Y | Y | `service-verify-endpoint` (portReg:112); ref `/services/*/verify_client_endpoint`. Toggle wipes array (P1-c). |
| 23 | service[derp] (`mesh_with[].detour`, `verify_client_url[].detour`) | outbound | N | **N** | Real outbound refs; not in any ref path. Dangling. **P2-b**. |
| 24 | service[ssm-api] (`servers` map) | inbound[shadowsocks] | Y | Y | `service-ssm-inbound` (portReg:113); ref `/services/*/servers`. |
| 25 | rule-set[remote] (`download_detour`) | outbound | Y | Y | `rule-set-download` (portReg:111); ref `/route/rule_set/*/download_detour`. Not channel-gated (1.14-deprecated). |
| 26 | rule-set[remote] (`http_client` tag) | http-client | N | Y | Ref `/route/rule_set/*/http_client` (refReg:364). |
| 27 | ntp (`detour`) | outbound | Y | Y | `settings-ntp-detour` readonly (portReg:115); ref `/ntp/detour`. |
| 28 | inbound (`detour`, listen) | inbound | **N** | **N** | `listen.md:144` "forwarded to specified inbound." Inspector select (Inspector.tsx:1449) but no port, no ref path. Dangling. **P1-b'**. |
| 29 | inbound[shadowtls] (`handshake.detour`, `handshake_for_server_name.*.detour`) | outbound | N | **N** | Dial Fields → outbound (`shadowtls.md:26,73`). Not in `outbound` ref paths (nested under `handshake`). Dangling. **P1-b''**. |
| 30 | tun (`route_address_set[]`, `route_exclude_address_set[]`) | rule-set | N | **N** | `tun.md:479,505` "the specified rule-sets." Not in rule-set ref paths. Dangling. **P1-d**. |
| 31 | any dial owner (`domain_resolver`) | dns-server | N | Y | Ref `*/domain_resolver` (refReg:340), resolver-object aware. No edge (P2 visual, multiple nodes). |
| 32 | inbound (`v2ray_api.stats.inbounds`) | inbound | N | Y | Ref refReg:328. Metadata; acceptable. |
| 33 | outbound (`v2ray stats`, `clash external_ui_download_detour`) | outbound | N | Y | Ref refReg:334. Acceptable (settings-side). |
| 34 | tls `certificate_provider` | certificate-provider | N | Y | Ref `*/tls/certificate_provider` (refReg:370). |
| 35 | certificate-provider[tailscale] (`endpoint`) | endpoint[tailscale] | **N** | Y | Ref `/certificate_providers/*/endpoint` (refReg:346); no port/edge and no node kind for cert-provider on canvas. **P2**. |

---

## Gaps & bugs (prioritized)

### (a) Missing / incorrect canvas ports

- **P1-a — `dns-server-detour` has no per-type guard.** `portRelationRegistry.ts:105` target/source
  use generic `dns-server` with no `nodeTypeExcludes`, so a "Detour outbound" output port renders on
  EVERY dns-server type. Upstream gives Dial Fields (hence `detour`) only to local/tcp/udp/tls/https/quic/h3/dhcp;
  fakeip/hosts/resolved/tailscale have NONE (`dns/server/*.md`; and the app's own
  `sharedFieldRegistry.ts:156` `dnsServerDialTypes` already excludes hosts/fakeip/tailscale/resolved —
  the Inspector hides the dial group for them, but the canvas port still shows). Inconsistent canvas-vs-Inspector.
  Confirmed stale-clean for dhcp/tls/https/quic/etc. Fix: add `nodeTypeExcludes:["fakeip","hosts","resolved","tailscale"]`
  to both endpoints of relation `dns-server-detour`.
- **P1-b — endpoint "outbound half" has no input ports.** Endpoints (wireguard/tailscale) share the
  outbound tag namespace and are legal in `route.final`, `route.rules[].outbound`, selector/urltest
  `outbounds[]`, `dns.servers[].detour`. None of these accept an endpoint: connect handlers and the
  `outbound` reference kind resolve only `config.outbounds` (`useProjectStore.ts:544,608`;
  `referenceRegistry.ts:157-176`). So an endpoint cannot be wired as a route/selector/dns target on
  canvas, and a hand-authored `route.final = <endpoint-tag>` is never validated or cascaded.
  (endpoint-wireguard, endpoint-tailscale.)
- **P2-c — `route.final` cannot select an endpoint.** Subset of P1-b at the route hub (hub-route).

### (b) referenceRegistry gaps → dangling refs on rename/delete

- **P1-d — tun `route_address_set` / `route_exclude_address_set` (→ rule-set) unmodeled.**
  Not in `referenceRegistry` rule-set paths (`referenceRegistry.ts:357-361`). Editable as list inputs
  (`Inspector.tsx:2676-2696`). Renaming/deleting a rule-set leaves tun pointing at a stale tag with no
  diagnostic. (inbound-tun, rule-set-remote, rule-set-local, rule-set-inline all flagged.)
- **P1 — inbound listen `detour` (→ inbound) unmodeled.** No port, and NOT in inbound ref paths
  (`referenceRegistry.ts:328` = only `/route/rules/*/inbound`, `/dns/rules/*/inbound`, `/services/*/servers`,
  `/experimental/v2ray_api/stats/inbounds`). Reachable via Inspector "Inbound Detour" select
  (`Inspector.tsx:1449`). Renaming/deleting target inbound B leaves `inbounds[A].detour="B"` dangling.
  (inbound-direct flags P1; socks/http/hysteria/redirect/tproxy/mixed/vless flag the same as P2 — it is
  one cross-cutting gap.)
- **P1 — shadowtls `handshake.detour` / `handshake_for_server_name.*.detour` (→ outbound) unmodeled.**
  Dial Fields nesting under `handshake.*`; `replaceOutboundRefs`/`removeOutboundRefs` only touch
  top-level `detour` on outbounds/dns-servers/endpoints/services (`referenceRegistry.ts:163-167,184-188`).
  Reachable via Inspector (`Inspector.tsx:1471`). Dangling outbound ref. (inbound-shadowtls.)
- **P1 — route-rule `resolve.server` (→ dns-server) unmodeled.** `dns-server` ref paths
  (`referenceRegistry.ts:340`) list `/dns/rules/*/server` but NOT `/route/rules/*/server`.
  Renaming/deleting a dns-server leaves `resolve.server` dangling. (rule-route-rule.)
- **P2-b — derp `mesh_with[].detour` / `verify_client_url[].detour` (→ outbound) unmodeled.** Not in any
  ref path; renaming/deleting an outbound leaves stale detour tags inside DERP mesh peers. (service-derp.)
- **P2 — certificate-provider[tailscale] `endpoint` ref has no port/edge.** Ref-tracked
  (`referenceRegistry.ts:346`) so rename/delete is safe, but the relationship is invisible and uncreatable
  on canvas (no cert-provider node kind). (endpoint-tailscale.)

### (c) Connect/disconnect asymmetries & data-loss

- **P1-c — derp `verify_client_endpoint` output toggle wipes the WHOLE array.**
  `useProjectStore.ts:1372` sets `verify_client_endpoint = undefined` when refs exist, discarding every
  endpoint. The edge-drop path (`commands.ts:1180`) and the endpoint-side `derp-service` input toggle
  (`useProjectStore.ts:1079`) both use `removeTagRef(...)` → remove exactly one. Output toggle is the
  outlier and silently loses data when 2+ endpoints are wired. (service-derp.)
- **P2 — `detour-target` reverse toggle is order/owner ambiguous.** From an outbound's `detour-target`
  input, `useProjectStore.ts:1024-1037` clears the *first* outbound or endpoint detouring through it; with
  both present it only clears one and the choice is implicit. Minor.

### (d) Dead / no-op compatible chips

- **P1-d(chip) — "Tailscale Endpoint" chip on derp service is dead.** `graph.ts:669` advertises
  `compatible:["Tailscale Endpoint"]` for derp, but `createCompatible` (`useProjectStore.ts:801-808`)
  has NO branch for "Tailscale Endpoint" → clicking the chip is a silent no-op. (service-derp.)
- **P1 — "Shadowsocks Inbound" chip on ssm-api service is dead.** `graph.ts:669` advertises
  `compatible:["Shadowsocks Inbound"]` for ssm-api, but `createCompatible` has no matching branch either
  → silent no-op. (service-ssm-api; previously unflagged — found during this audit.)
  Handled chip kinds are exactly: Route, Direct, Block, Selector, URLTest, SOCKS, DNS Server,
  DNS Tailscale Server.

### (e) Wrong-direction or duplicate controls

- **P1-e — ccm/ocm have a duplicate, mislabeled `detour` control.** `ccm`/`ocm` are in
  `serviceListenTypes` (`sharedFieldRegistry.ts:158`), so the Inspector renders the listen-group
  "Inbound Detour" select (`Inspector.tsx:1449`, `path:["detour"]`) AND the dedicated API-outbound
  detour (canvas `service-detour-*` port). Both write `/services/*/detour`. The listen-group label
  ("Inbound Detour") is wrong for ccm/ocm — upstream `ccm.md:89`/`ocm.md:87` define `detour` as the
  *outbound* tag for the Claude/OpenAI API. Two controls, one key, misleading label. (service-ccm, service-ocm.)
- **P1 — hysteria-realm listen `detour` is mis-rendered as an OUTBOUND edge.** `graph.ts:676-678` draws
  a `service.detour` edge to `outbound:${detour}` for any non-ocm service (ccm fallback relation). But
  hysteria-realm's `detour` comes from Listen Fields (`hysteria-realm.md:37-39` → `shared/listen.md:144`,
  an *inbound* ref), not an outbound. The edge points to the wrong kind. Also the listen-group control
  surfaces it (serviceListenTypes includes hysteria-realm). (service-hysteria-realm.)
- **P2-f — `block` (and selector/urltest/dns) is offered as a `detour-target` INPUT.** Relations
  `outbound-detour` (:106), `endpoint-detour` (:108), `settings-ntp-detour` (:115) all target generic
  `outbound` with no `nodeTypeExcludes`, so block exposes a detour-target port. Activating it creates a
  `socks` outbound with `socks.detour=<block>` (`useProjectStore.ts:1024-1035`) — a dead chain.
  Note the SOURCE side of `outbound-detour` already excludes block/selector/urltest/dns; the TARGET side
  should mirror that, or a diagnostic should warn. (outbound-block.)

### (f) Missing target-validity diagnostics

- **P2 — no "detour through non-dialable outbound" diagnostic.** Diagnostics only check the detour target
  *exists* (`diagnostics.ts:112-130,411-419`), never that it is dialable. `detour → block` (and
  `→ selector/urltest/dns`) passes validation silently. Pairs with P2-f.
- **P2 — dangling refs from (b) have no diagnostics.** tun `route_address_set` → missing rule-set,
  inbound `detour` → missing inbound, shadowtls `handshake.detour` → missing outbound,
  route-rule `resolve.server` → missing dns-server: none are validated, so the dangling refs left after a
  rename/delete are also invisible to the diagnostics panel.

---

## Cross-cutting recommendations

1. **Add type guards to `dns-server-detour` and the `detour-target` inputs.** Set
   `nodeTypeExcludes:["fakeip","hosts","resolved","tailscale"]` on relation `dns-server-detour`
   (portReg:105) and `nodeTypeExcludes:["block","selector","urltest","dns"]` on the `detour-target`
   target endpoints (portReg:106,108,115). One change closes P1-a + P2-f and re-aligns the canvas with
   `sharedFieldRegistry`'s `dnsServerDialTypes`/`outboundDialTypes` (the single source of "what dials").

2. **Add a referenceRegistry-completeness test driven by the upstream tag-reference list.** A unit test
   asserting every cross-reference path (matrix col "Ref") is present would have caught all of (b):
   inbound `detour`, shadowtls `handshake.detour`, tun `route_*_set`, route-rule `resolve.server`,
   derp `mesh_with/verify_client_url detour`. Add the missing paths: `/inbounds/*/detour` (inbound kind),
   `/route/rules/*/server` (dns-server kind), tun `route_address_set`/`route_exclude_address_set`
   (rule-set kind), and nested-detour scanning for shadowtls/derp under the outbound kind.

3. **Make the outbound reference kind endpoint-aware (unify the dialable-target namespace).** Treat
   endpoint tags as valid referents in `route.final`/`route.rules[].outbound`/selector-urltest
   `outbounds[]`/`dns.servers[].detour`, give endpoints the matching input ports, and validate them.
   Resolves P1-b + P2-c and matches sing-box's shared inbound/outbound tag namespace for endpoints.

4. **Validate compatible chips against `createCompatible` at build/test time.** Every string in a
   `graph.ts` `compatible:[...]` array must have a branch in `createCompatible`
   (`useProjectStore.ts:798-836`). A trivial test over the union of advertised kinds kills the dead
   "Tailscale Endpoint" and "Shadowsocks Inbound" chips (d) and prevents regressions.

5. **Don't let the listen-group `detour` control bleed onto service types where `detour` means something
   else.** ccm/ocm `detour` is an *outbound* field (own port already), and hysteria-realm/derp `detour`
   is a listen (inbound) field; remove ccm/ocm/hysteria-realm/derp from the listen-group `detour`
   rendering (or relabel + route to the correct edge). Fixes P1-e and the hysteria-realm mis-rendered
   outbound edge in (e). Also gate `graph.ts:676-678` so the outbound `service-detour` edge fires only
   for `ccm`/`ocm`.

## Addendum — port-icon semantics are inconsistent across an edge's two ends

- [P2] A port handle's glyph comes straight from a per-endpoint literal `icon` field in
  `portRelationRegistry.ts` (rendered verbatim at `SbcNode.tsx:104` via `portIconMap[endpoint.icon]`).
  There is no convention that (a) the two ends of one edge share an icon, or (b) ports that reference
  the same node-kind share an icon. Concretely, both `route-final` (`portRelationRegistry.ts:93`) and
  `route-rule` (`:95`) use `icon:"network"` on their **source** (so a Route hub and a Route-Rule show an
  identical output glyph), but their **target** ports on the outbound differ — `route-final` → `"route"`,
  `route-rule` → `"git-branch"`. So the same logical fact ("an outbound is referenced from upstream") is
  drawn with 7 different input-side glyphs on an outbound node: `route`(:93), `git-branch`(:95),
  `shuffle`(:103 selector), `database`(:104 urltest), `server`(:105/109/110 dns/service detour),
  `network`(:106 dial detour), `layers`(:111 rule-set download). Recommendation: derive input-port icon
  from the *referenced node-kind* (one icon per target kind), and/or make an edge's two ends share a
  single relation icon. Pure visual-consistency; no functional/JSON impact.

SUMMARY: 0 P0, 11 P1, 10 P2.
