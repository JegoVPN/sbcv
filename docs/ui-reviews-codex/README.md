# Codex Independent Upstream-To-Code Review

Date: 2026-05-28

This review is an independent Codex pass over sing-box upstream documents and the SBC codebase.

## Input Firewall

Included inputs:

- `AGENTS.md`
- `docs/upstream/sing-box/**`
- Source-of-truth product docs listed in `AGENTS.md`
- `src/**`
- `tests/**` and `e2e/**` for behavior evidence

Excluded inputs:

- `docs/ui-reviews-pass2/**`
- `docs/claude/**`
- GitHub PR review summaries or Claude issue findings

The goal is to derive findings from upstream sing-box semantics and local code behavior, not from prior review reports.

## Review Method

Each node family must be reviewed with at least two independent shards:

1. A doc-only shard reads upstream markdown and produces a requirement matrix.
2. A code-only shard reads local implementation and produces a behavior matrix.
3. A verifier shard checks mismatches between upstream requirements, canonical config commands, references, diagnostics, graph edges, and UI affordances.

The review is performed in waves because the agent pool has a hard concurrency limit.

## Node Matrix

| Node family | Doc-only shard | Code-only shard | Verifier | Status |
| --- | --- | --- | --- | --- |
| Route Hub / Route Rule | complete | complete | complete | confirmed findings recorded |
| DNS Hub / DNS Rule | complete | complete | complete | confirmed findings recorded |
| Inbound | complete | complete | manual verifier | confirmed findings recorded |
| Outbound | complete | complete | complete | confirmed findings recorded |
| DNS Server | complete | complete | complete | confirmed findings recorded |
| Endpoint | complete | complete | complete | confirmed findings recorded |
| Service | complete | complete | complete | confirmed findings recorded |
| Rule Set | complete | complete | complete | confirmed findings recorded |
| Certificate Provider | manual doc pass | manual code pass | complete | confirmed findings recorded |
| HTTP Client | manual doc pass | manual code pass | complete | confirmed findings recorded |
| Settings | manual doc pass | manual code pass | complete | confirmed findings recorded |
| Canvas Connection UX | n/a | manual code pass | complete | confirmed findings recorded |
| SVG/Icon Semantics | complete | complete | complete | follow-up report recorded in `icon-semantics-audit.md` |

## Artifact Map

| File | What |
| --- | --- |
| `README.md` | Aggregate Codex review with confirmed findings, rejected suspicions, and execution order. |
| `icon-semantics-audit.md` | Focused SVG/icon semantics audit and verification plan. |
| `<node>--codex.md` | Per-node or per-feature cross-map from confirmed aggregate findings to implementation surfaces. |

Per-node cross-maps include the 66 pass-2 node surfaces plus four Codex-only surfaces:
`certificate-provider`, `http-client`, `inbound-cloudflared`, and `canvas-connection-ux`.
They are navigation artifacts; `README.md` and `icon-semantics-audit.md` remain the
authoritative finding text.

## Severity

- P0: Can export invalid canonical config, silently corrupt canonical config, lose user data, or break required source-of-truth reference integrity.
- P1: Blocks valid upstream behavior, leaves important references unmodeled, makes destructive UI reachable without clear intent, or creates major canvas workflow mismatch.
- P2: Usability, accessibility, performance, or coverage gap that does not usually corrupt exported config by itself.

Confirmed finding count: P0 19, P1 23, P2 7.

The icon audit uses separate `IC-*` finding ids in `icon-semantics-audit.md` and is not included in the schema/reference counts above.

## Confirmed Findings

This section only lists findings confirmed by a doc/code pair or by a verifier shard. Code-only suspicions stay out until verified against upstream.

### P0: Export Or Canonical Config Safety

| ID | Node family | Finding | Evidence | Development landing |
| --- | --- | --- | --- | --- |
| C0-1 | DNS Rule | `route` and `evaluate` require `server`, but diagnostics only check stale server refs when a value is already present. Missing required targets can pass SBC semantic validation. | Upstream `docs/upstream/sing-box/testing/configuration/dns/rule_action.md`; code `src/domain/diagnostics.ts`. | Add action-specific required-target diagnostics for DNS rules; test `route` and `evaluate` without server. |
| C0-2 | DNS Rule | Inspector clears and hides `server` for `evaluate`, although upstream requires it and domain/graph already allow it. | `src/components/Inspector.tsx`; `src/domain/commands.ts`. | Treat `route` and `evaluate` as server-bearing DNS actions in Inspector and store tests. |
| C0-3 | Route/DNS Rule | Action switches only clear one target field and leave stale action-scoped fields, for example route `resolve.server` after switching to `route`, or DNS `predefined.rcode` after switching to `route`. | Upstream route/DNS rule action docs; `src/components/Inspector.tsx`; `src/domain/commands.ts`. | Introduce central route/DNS action-schema normalizers and make Inspector call them. |
| C0-4 | DNS Rule | `evaluate` / `respond` ordering and response-match preconditions are not modeled. Upstream requires response matching after a top-level `evaluate`, and `respond` only works after that preceding evaluation. | `docs/upstream/sing-box/testing/configuration/dns/rule_action.md`; `docs/upstream/sing-box/testing/configuration/dns/rule.md`; `src/domain/diagnostics.ts`. | Add ordered DNS rule scan diagnostics for `respond`, `match_response`, and response fields. |
| C0-5 | Outbound | Selector/urltest require non-empty `outbounds`; SBC creates empty arrays, downgrades empty candidates to a warning, and disconnect can remove the last candidate. `sing-box-stable check` rejects empty lists. | `docs/upstream/sing-box/stable/configuration/outbound/selector.md`; `docs/upstream/sing-box/stable/configuration/outbound/urltest.md`; `src/domain/commands.ts`; `src/domain/diagnostics.ts`. | Make empty selector/urltest candidates blocking errors; decide whether UI prevents last removal or allows invalid drafts with blocking diagnostics. |
| C0-6 | Shared TLS | Inspector uses one mixed TLS editor for inbound, outbound, and DNS server TLS. Upstream has distinct inbound/server and outbound/client schemas; `sing-box-stable check` rejects invalid-role fields such as outbound `tls.key_path` and inbound `tls.utls`. | `docs/upstream/sing-box/stable/configuration/shared/tls.md`; `src/components/Inspector.tsx`; `tests/app.test.tsx`. | Split TLS fields by role and update UI tests so invalid-role fields are absent. |
| C0-7 | Shared Multiplex | Inspector shows outbound-only multiplex fields on inbound multiplex. Upstream inbound multiplex only has `enabled`, `padding`, and `brutal`; `sing-box-stable check` rejects inbound `multiplex.protocol`. | `docs/upstream/sing-box/stable/configuration/shared/multiplex.md`; `src/components/Inspector.tsx`. | Add role-scoped multiplex schemas; test inbound absence and outbound presence. |
| C0-8 | DNS Server | Changing DNS server type into `tailscale` or `resolved` does not create required endpoint/service dependencies, and type change can preserve hidden `detour` on non-dial DNS server types. | `docs/upstream/sing-box/stable/configuration/dns/server/tailscale.md`; `docs/upstream/sing-box/stable/configuration/dns/server/resolved.md`; `src/domain/commands.ts`; `src/canvas/graph.ts`. | Make DNS server type-change dependency-aware and scrub fields unsupported by the new type. |
| C0-9 | Outbound | `changeEntityType` preserves `detour` when changing to non-dialable outbound types such as `block`, `dns`, `selector`, or `urltest`; stable rejects selector `detour` as unknown. | `docs/upstream/sing-box/stable/configuration/outbound/block.md`; `docs/upstream/sing-box/stable/configuration/outbound/dns.md`; `src/domain/commands.ts`; `src/domain/sharedFieldRegistry.ts`. | Scrub `detour` unless the new outbound type supports Dial Fields; add type-change tests. |
| C0-10 | Service DERP | DERP `mesh_with` entries require `server` and `server_port`, but diagnostics do not validate either field and Inspector can create a row with an empty `server`. | `docs/upstream/sing-box/stable/configuration/service/derp.md`; `src/components/Inspector.tsx`; `src/domain/diagnostics.ts`. | Add DERP mesh peer required-field diagnostics; make the Inspector create a valid draft or show blocking validation immediately. |
| C0-11 | Endpoint / Route | Endpoints have inbound/outbound behavior upstream, but route target modeling only accepts `outbounds[]` for `route.final` and `route.rules[].outbound`. Valid endpoint route targets are rejected or unmodeled. | `docs/upstream/sing-box/stable/configuration/endpoint/index.md`; `docs/upstream/sing-box/stable/migration.md`; `src/domain/diagnostics.ts`; `src/domain/portRelationRegistry.ts`. | Add a route-target abstraction for outbound + endpoint tags; update diagnostics, references, graph/ports, and route tests. |
| C0-12 | Endpoint | WireGuard endpoint required fields can be removed silently. Upstream requires endpoint `address`, `private_key`, `peers`, and peer `public_key` / `allowed_ips`; diagnostics currently validate endpoint detours only. | `docs/upstream/sing-box/stable/configuration/endpoint/wireguard.md`; `src/domain/diagnostics.ts`; `src/components/Inspector.tsx`; `tests/app.test.tsx`. | Add WireGuard endpoint required-field diagnostics and UI/domain tests. |
| C0-13 | Endpoint | Tailscale `system_interface` is modeled as a string in UI/tests, but upstream defines `system_interface` as boolean and uses `system_interface_name` for the name. | `docs/upstream/sing-box/stable/configuration/endpoint/tailscale.md`; `src/components/Inspector.tsx`; `tests/app.test.tsx`. | Change UI to checkbox `system_interface` plus text `system_interface_name`; add type diagnostics and migration-aware tests. |
| C0-14 | Endpoint WireGuard | WireGuard endpoint peer schema uses upstream `address` / `port`, but SBC scaffold and Inspector write `server` / `server_port`, which belong to deprecated WireGuard outbound shape. | `docs/upstream/sing-box/stable/configuration/endpoint/wireguard.md`; `docs/upstream/sing-box/stable/migration.md`; `src/domain/commands.ts`; `src/components/Inspector.tsx`. | Change endpoint peer editor/scaffold to `address` / `port`; add migration/normalization for existing invalid drafts. |
| C0-15 | Certificate Provider | Required certificate-provider fields are not semantically validated: Tailscale provider requires a Tailscale endpoint, ACME/Cloudflare require `domain`, and Cloudflare credential conflicts are unchecked. | `docs/upstream/sing-box/testing/configuration/shared/certificate-provider/tailscale.md`; `docs/upstream/sing-box/testing/configuration/shared/certificate-provider/acme.md`; `docs/upstream/sing-box/testing/configuration/shared/certificate-provider/cloudflare-origin-ca.md`; `src/domain/diagnostics.ts`. | Add provider-type diagnostics and endpoint type checks; cover imported providers and provider nodes. |
| C0-16 | Inbound | Required inbound fields are under-diagnosed. Listen Fields mark `listen` required, Shadowsocks requires `method` and `password`, ShadowTLS requires `handshake`, and VMess/VLESS/Trojan/other authenticated inbounds require `users`; several of these can be cleared or imported without a blocking diagnostic. | `docs/upstream/sing-box/stable/configuration/shared/listen.md`; `docs/upstream/sing-box/stable/configuration/inbound/shadowsocks.md`; `docs/upstream/sing-box/stable/configuration/inbound/shadowtls.md`; `docs/upstream/sing-box/stable/configuration/inbound/vmess.md`; `src/components/Inspector.tsx`; `src/domain/diagnostics.ts`. | Add inbound type required-field diagnostics for listen/users/method/password/ShadowTLS handshake; include the `wildcard_sni=all` ShadowTLS server exception and tests for imported or manually-edited invalid inbounds. |
| C0-17 | Inbound / SSM API | SSM API `servers` is required and selected inbounds must be managed Shadowsocks, but SBC reports empty or non-managed/non-Shadowsocks mappings as warnings. Inbound type-change can leave an SSM service pointing at a now-invalid inbound while graph still renders the service edge. | `docs/upstream/sing-box/stable/configuration/service/ssm-api.md`; `src/domain/diagnostics.ts`; `src/domain/commands.ts`; `src/canvas/graph.ts`; `src/domain/portRelationRegistry.ts`. | Upgrade SSM mapping violations to blocking diagnostics; on inbound type-change away from managed Shadowsocks, either remove SSM mappings or keep them with blocking errors and type-gated graph edges. |
| C0-18 | Rule Set | Inline Rule Set `rules` is required to be a Headless Rule list, but `rules` is edited by both the safe inline editor and Advanced JSON because it is missing from `ruleSetHandledFields`. Advanced JSON writes raw invalid text into canonical state on parse failure, so `rules` can become a string and export invalid config. | `docs/upstream/sing-box/stable/configuration/rule-set/index.md`; `src/components/Inspector.tsx`. | Add `rules` to handled fields; change shared `JsonField` to preserve the previous canonical value on parse errors; add inline rule-set UI tests. |
| C0-19 | Rule Set | Local Rule Set `format` is required unless `path` ends with `.json` or `.srs`, but diagnostics only enforce missing/inferable `format` for remote URLs. Imported or advanced-edited local rule sets with non-inferable paths can miss `format` silently. | `docs/upstream/sing-box/stable/configuration/rule-set/index.md`; `src/domain/diagnostics.ts`. | Share remote/local format inference diagnostics and add tests for local non-inferable paths. |

### P1: Reference Integrity Or Valid Behavior Blocked

| ID | Node family | Finding | Evidence | Development landing |
| --- | --- | --- | --- | --- |
| C1-1 | Route Rule | `bypass` supports optional `outbound` and route-options, but Inspector only exposes outbound for `route` and route-options for `route` / `route-options`. | `docs/upstream/sing-box/stable/configuration/route/rule_action.md`; `src/components/Inspector.tsx`. | Show outbound and route-options for `bypass`; add component coverage. |
| C1-2 | Route Rule | `resolve.server` is a DNS server tag reference, but it is missing from DNS-server reference registry, rename/delete lifecycle, graph, and stale-ref diagnostics. | `docs/upstream/sing-box/stable/configuration/route/rule_action.md`; `src/domain/referenceRegistry.ts`; `src/domain/diagnostics.ts`. | Add `/route/rules/*/server` DNS-server reference handling, graph edge, diagnostics, and tests. |
| C1-3 | DNS Rule | Hover compatible chip can create a DNS server but does not connect it to the DNS rule; drag/picker create-connect already works. | `src/canvas/graph.ts`; `src/components/SbcNode.tsx`; `src/state/useProjectStore.ts`. | Add `source.kind === "dns-rule"` branch to compatible creation and test the chip path. |
| C1-4 | DNS Server | Legacy DNS server `address_resolver` is a DNS-server reference but is not renamed/deleted or diagnosed; `address_strategy` deprecation/shape is also not checked. | `docs/upstream/sing-box/stable/configuration/dns/server/legacy.md`; `src/domain/referenceRegistry.ts`; `src/domain/diagnostics.ts`. | Add registry and diagnostics coverage for legacy `address_resolver` / `address_strategy`. |
| C1-5 | DNS Server | Tailscale DNS server endpoint diagnostics check endpoint existence but not that the endpoint type is `tailscale`. | `docs/upstream/sing-box/stable/configuration/dns/server/tailscale.md`; `src/domain/diagnostics.ts`; `src/domain/indexes.ts`. | Validate endpoint type for DNS Tailscale servers. |
| C1-6 | DNS Server | Hosts `predefined` and HTTPS/H3 header maps can persist empty keys; diagnostics do not catch empty map keys. | `docs/upstream/sing-box/stable/configuration/dns/server/hosts.md`; `docs/upstream/sing-box/stable/configuration/dns/server/https.md`; `src/components/Inspector.tsx`; `src/domain/diagnostics.ts`. | Reject or delay empty map keys in Inspector and diagnostics. |
| C1-7 | Outbound / Canvas | Group-member port trash removes the first edge for an aggregate selector/urltest port, not the specific visible edge the user intended. | `src/canvas/graph.ts`; `src/components/CanvasWorkspace.tsx`; `src/components/SbcNode.tsx`. | Hide aggregate-port trash or require exact edge/relation choice; test multi-candidate selector/urltest behavior. |
| C1-8 | DNS Server / Canvas | DNS-server port disconnect has the same first-edge problem when multiple DNS rules target one server. | `src/canvas/graph.ts`; `src/components/CanvasWorkspace.tsx`; `src/components/SbcNode.tsx`. | Replace single `edgeByPort` lookup with multi-edge handling or edge-specific disconnect UI. |
| C1-9 | Outbound | Compatible outbound chips advertise many active types that `createCompatible` does not implement, so several “Add” paths are no-op. | `docs/upstream/sing-box/stable/configuration/outbound/index.md`; `src/canvas/graph.ts`; `src/state/useProjectStore.ts`. | Replace label switches with a typed compatible registry or hide unsupported chips; test HTTP/VLESS creation. |
| C1-10 | Outbound | VLESS `flow` without TLS is valid in upstream/stable, but SBC emits `vless-flow-requires-tls` as an error. | `docs/upstream/sing-box/stable/configuration/outbound/vless.md`; `src/domain/diagnostics.ts`. | Remove or downgrade that diagnostic; add a stable parity fixture. |
| C1-11 | Service DERP | DERP `verify_client_url[]` and `mesh_with[]` embed Dial Fields, including outbound `detour` and DNS `domain_resolver`, but these nested references are not in reference registry, graph edges, or stale-ref diagnostics. | `docs/upstream/sing-box/stable/configuration/service/derp.md`; `docs/upstream/sing-box/stable/configuration/shared/dial.md`; `src/domain/referenceRegistry.ts`; `src/domain/diagnostics.ts`; `src/canvas/graph.ts`. | Add nested DERP Dial Field reference helpers for rename/delete/diagnostics; decide whether to visualize nested detour/domain-resolver edges. |
| C1-12 | Service SSM API | Service node compatible chips advertise “Shadowsocks Inbound” for SSM API and “Tailscale Endpoint” for DERP, but `createCompatible` has no cases for either label, making the hover Add path no-op. | `docs/upstream/sing-box/stable/configuration/service/ssm-api.md`; `docs/upstream/sing-box/stable/configuration/service/derp.md`; `src/canvas/graph.ts`; `src/components/SbcNode.tsx`; `src/state/useProjectStore.ts`. | Move compatible creation to a typed registry shared by graph, picker, and store; test SSM/DERP hover chips. |
| C1-13 | Service SSM API | Drag-connecting multiple Shadowsocks inbounds to one SSM API service always writes `servers["/"]`, replacing the previous mapping even though upstream and Inspector support a mapping object with multiple HTTP endpoints. | `docs/upstream/sing-box/stable/configuration/service/ssm-api.md`; `src/state/useProjectStore.ts`; `src/components/Inspector.tsx`. | Allocate a unique path when `/` is already occupied, or open an explicit endpoint-path picker before connecting. |
| C1-14 | Certificate Provider / Endpoint | Tailscale certificate-provider endpoint missing/type diagnostics are absent, although upstream requires a Tailscale endpoint reference. | `docs/upstream/sing-box/testing/configuration/shared/certificate-provider/tailscale.md`; `src/domain/referenceRegistry.ts`; `src/domain/diagnostics.ts`. | Add certificate-provider endpoint diagnostics, diagnostic-target tests, and graph edge type guard. |
| C1-15 | Certificate Provider / Canvas | Tailscale certificate-provider nodes advertise a “Tailscale Endpoint” compatible chip, but `createCompatible` does not implement that label, so the hover Add path is a no-op. | `docs/upstream/sing-box/testing/configuration/shared/certificate-provider/tailscale.md`; `src/canvas/graph.ts`; `src/components/SbcNode.tsx`; `src/state/useProjectStore.ts`. | Use a typed compatible registry shared by graph, picker, and store; test the certificate-provider chip path. |
| C1-16 | HTTP Client | HTTP Client tag references are renamed/deleted by registry, but stale imported refs are not diagnosed for `route.default_http_client`, `route.rule_set[].http_client`, or `certificate_providers[].http_client`. | `docs/upstream/sing-box/testing/configuration/shared/http-client.md`; `docs/upstream/sing-box/testing/configuration/route/index.md`; `docs/upstream/sing-box/testing/configuration/rule-set/index.md`; `src/domain/referenceRegistry.ts`; `src/domain/diagnostics.ts`. | Add HTTP Client tag-index diagnostics for route default, remote rule-sets, and certificate providers. |
| C1-17 | Inbound TUN / Rule Set | TUN `route_address_set` and `route_exclude_address_set` are rule-set tag references, but they are raw text fields with no rule-set registry rename/delete, graph edges, or stale-ref diagnostics. | `docs/upstream/sing-box/stable/configuration/inbound/tun.md`; `src/components/Inspector.tsx`; `src/domain/referenceRegistry.ts`; `src/domain/diagnostics.ts`; `src/canvas/graph.ts`. | Add rule-set reference lifecycle for TUN address-set fields; optionally visualize TUN to Rule Set edges. |
| C1-18 | HTTP Client | Testing `http_clients[]` resources are graphable after import/templates but cannot be created from the Palette and cannot be edited beyond tag/delete. The Inspector has no `http-client` branch in `sharedGroupsForEntity`, despite product docs calling for an HTTP Client Inspector and upstream defining engine/version/headers/TLS/Dial fields. | `docs/upstream/sing-box/testing/configuration/index.md`; `docs/upstream/sing-box/testing/configuration/shared/http-client.md`; `docs/sing-box-canvas-configuration-guide.md`; `src/components/Palette.tsx`; `src/state/useProjectStore.ts`; `src/domain/sharedFieldRegistry.ts`; `src/components/Inspector.tsx`. | Add testing-gated `addHttpClient` / palette creation and expose HTTP Client shared groups for HTTP Client entities; keep stable creation disabled. |
| C1-19 | HTTP Client | HTTP Client nodes are isolated in the graph: there are no port relations or edges for `route.default_http_client`, `route.rule_set[].http_client`, `certificate_providers[].http_client`, or HTTP Client Dial/TLS refs such as `detour` and `domain_resolver`. Users cannot create/disconnect these canonical references from the canvas. | `docs/upstream/sing-box/testing/configuration/route/index.md`; `docs/upstream/sing-box/testing/configuration/rule-set/index.md`; `docs/upstream/sing-box/testing/configuration/shared/certificate-provider/acme.md`; `docs/upstream/sing-box/testing/configuration/shared/certificate-provider/cloudflare-origin-ca.md`; `src/canvas/graph.ts`; `src/domain/portRelationRegistry.ts`; `src/domain/referenceRegistry.ts`. | Add typed HTTP Client relations for route default, remote rule-set, ACME/Cloudflare provider, and HTTP Client detour/resolver where we choose to visualize them. |
| C1-20 | HTTP Client | Nested references inside `http_clients[]` are renamed/deleted by registry but not diagnosed when stale, and `tls.certificate_provider` is treated as a certificate-provider ref even though HTTP Client TLS is outbound/client TLS and upstream marks `certificate_provider` server-only. | `docs/upstream/sing-box/testing/configuration/shared/http-client.md`; `docs/upstream/sing-box/testing/configuration/shared/tls.md`; `docs/upstream/sing-box/testing/configuration/shared/dial.md`; `src/domain/referenceRegistry.ts`; `src/domain/diagnostics.ts`. | Add diagnostics for `http_clients[].detour`, `http_clients[].domain_resolver`, and invalid `http_clients[].tls.certificate_provider`; remove or guard certificate-provider registry behavior for HTTP Client TLS. |
| C1-21 | Inbound / Listen Fields | `Listen Fields.detour` is an inbound-tag reference, but inbound `detour` is not in inbound reference rename/delete or stale diagnostics. The shared Listen card also writes `detour` for services as an inbound detour, while service diagnostics/reference graph treat `service.detour` as outbound for all services. | `docs/upstream/sing-box/stable/configuration/shared/listen.md`; `docs/upstream/sing-box/stable/configuration/service/ccm.md`; `docs/upstream/sing-box/stable/configuration/service/ocm.md`; `src/components/Inspector.tsx`; `src/domain/referenceRegistry.ts`; `src/domain/diagnostics.ts`; `src/canvas/graph.ts`. | Add owner-aware Listen detour handling: inbound/service listen detour references inbound tags, CCM/OCM API detour references outbound tags, and diagnostics/graph must not conflate them. |
| C1-22 | Inbound Cloudflared | `cloudflared` is a testing/1.14 inbound with required `token` and nested control/tunnel Dial Fields, but SBC keeps it palette-gated/import-only, excludes it from creatable/type-select lists, and has no required-token or nested Dial Field diagnostics. | `docs/upstream/sing-box/testing/configuration/inbound/cloudflared.md`; `docs/upstream/sing-box/testing/configuration/inbound/index.md`; `src/domain/protocols.ts`; `src/components/Palette.tsx`; `src/state/useProjectStore.ts`; `src/domain/diagnostics.ts`; `src/components/Inspector.tsx`. | Keep stable gated, but add explicit testing-target support or downgrade the palette entry to docs-only; if supported, add creation, Inspector fields, and token/dial diagnostics. |
| C1-23 | Inbound / Canvas | The Inbound `route-rule-match` and `dns-rule-match` port trash controls use a single first-edge lookup. If multiple route or DNS rules reference the same inbound, the port action disconnects only the first edge instead of a specific chosen rule reference. | `docs/upstream/sing-box/stable/configuration/route/rule.md`; `docs/upstream/sing-box/stable/configuration/dns/rule.md`; `src/canvas/graph.ts`; `src/components/CanvasWorkspace.tsx`; `src/components/SbcNode.tsx`. | Replace aggregate port disconnect with edge-specific remove controls or a multi-reference chooser; add tests for two route rules and two DNS rules sharing one inbound. |

### P2: UX, Graph Hygiene, Or Coverage

| ID | Node family | Finding | Evidence | Development landing |
| --- | --- | --- | --- | --- |
| C2-1 | Service | Graph treats any `service.detour` as an outbound ref and renders it as CCM unless type is OCM, but upstream documents top-level service `detour` only for CCM/OCM. | `docs/upstream/sing-box/stable/configuration/service/ccm.md`; `docs/upstream/sing-box/stable/configuration/service/ocm.md`; `src/canvas/graph.ts`; `src/domain/portRelationRegistry.ts`. | Gate service-detour graph edges to CCM/OCM and add unsupported-field diagnostics or import-only handling for other service types. |
| C2-2 | Service Hysteria Realm | Palette/store block creating `hysteria-realm` on stable, but the Service Inspector type dropdown still offers it on stable and relies on diagnostics after the mutation. | `docs/upstream/sing-box/testing/configuration/service/hysteria-realm.md`; `src/domain/protocols.ts`; `src/components/Inspector.tsx`; `src/domain/diagnostics.ts`. | Make type-change options channel-aware or require an explicit testing-target switch before selecting testing-only service types. |
| C2-3 | Endpoint | Endpoint compatible chips only advertise DNS Tailscale Server, while ports support DNS server, DERP service, and certificate-provider relations. | `src/canvas/graph.ts`; `tests/sbc-node-ports.test.ts`. | Make endpoint compatible labels match relation registry and cover chip creation. |
| C2-4 | HTTP Client | `route.default_http_client` import currently tolerates an inline object through generic reference helpers, but the route upstream page describes this field as a tag, unlike remote rule-set/provider `http_client` fields that explicitly allow string or object. | `docs/upstream/sing-box/testing/configuration/route/index.md`; `docs/upstream/sing-box/testing/configuration/shared/http-client.md`; `src/domain/referenceRegistry.ts`; `tests/domain.test.ts`. | Verify with `sing-box-testing check`; then either add a diagnostic for object-valued route default HTTP Client or document it as intentionally tolerated import compatibility. |
| C2-5 | Rule Set | In testing/1.14, `download_detour` is deprecated in favor of `http_client`, but the main Rule Set Inspector still foregrounds `download_detour` while `http_client` is only in shared fields. | `docs/upstream/sing-box/testing/configuration/rule-set/index.md`; `src/components/Inspector.tsx`; `src/domain/diagnostics.ts`. | Make Rule Set Inspector channel-aware: stable foregrounds `download_detour`; testing promotes `http_client` and demotes deprecated `download_detour`. |
| C2-6 | Settings Certificate | Stable upstream documents top-level `certificate` since sing-box 1.12, but diagnostics warn that the whole block is “testing-only” whenever channel is stable. | `docs/upstream/sing-box/stable/configuration/certificate/index.md`; `src/domain/diagnostics.ts`. | Replace channel-only warning with version-aware gates: `certificate` is stable 1.12+, Chrome store is stable 1.13+. |
| C2-7 | Canvas Connection UX | Edge remove buttons are hidden by opacity but keep `pointer-events: all`, so invisible remove targets can intercept canvas clicks and focus before the edge is visibly hovered. | `src/components/CanvasEdge.tsx`; `src/styles.css`. | Disable pointer events unless the remove button is visible or focused; add a canvas interaction test for hidden edge controls. |

## Rejected Suspicions

| Suspicion | Result |
| --- | --- |
| Top-level `dns.fakeip` editing is necessarily a product bug. | Rejected. Stable still documents it as deprecated, code marks it legacy, provides modern FakeIP Server path, and emits a deprecation warning. |
| DNS rule drag/picker create-connect fails. | Rejected. Drag/picker uses canonical `createNodeAndConnect`; only the hover compatible-chip path is missing. |
| Route/DNS empty `inbound` / `rule_set` arrays after disconnect are confirmed invalid. | Rejected for this shard. Checked targets accepted empty arrays and stale tag refs are removed. |
| mDNS DNS server creatable gating is wrong. | Rejected. Stable lacks mDNS, testing 1.14 adds it, and code gates it accordingly. |
| Endpoint/service type-change cleanup is broadly missing. | Rejected for endpoint/service refs; the confirmed type-change dependency issue is DNS server changing into `tailscale` / `resolved`. |
| HTTPS/H3 `path` must start with `/`. | Not confirmed from upstream docs alone; requires binary validation before filing as a finding. |
| Blanket “VLESS requires TLS”. | Rejected. Only the flow-specific diagnostic is stricter than upstream/stable. |
| Plain side-port click is destructive. | Rejected. Existing tests cover no mutation on plain side-port click; the confirmed issue is explicit trash on aggregate ports. |
| OCM needs the same empty-users warning as CCM. | Rejected. Upstream says empty OCM users means no authentication is required; this is not a validity gap. |
| Disconnecting an SSM API edge must also clear `managed` on the Shadowsocks inbound. | Rejected. Upstream requires selected SSM inbounds to be managed, but does not require every managed Shadowsocks inbound to be selected by an SSM API service. The canonical mapping removal is still required and already happens. |
| DERP `verify_client_url.url` is definitely required. | Not confirmed from upstream docs alone; the object format includes `url`, but it is not marked `Required` like `mesh_with.server` / `server_port`. |
| DERP `verify_client_endpoint: []` is upstream-invalid after disconnect. | Rejected. Upstream shows an empty list and does not mark it required; this is only a canonical-minimal cleanup concern if we choose to normalize empty arrays away. |
| Rule Set Source Format, Headless Rule, and AdGuard palette entries must become standalone canvas nodes. | Rejected for now. Source Format is an external rule-set file format, Headless Rule is the item schema inside inline/source rule sets, and AdGuard requires CLI conversion to binary rule-set rather than a `route.rule_set[].type`. Current docs/inspector-only semantics are acceptable unless product explicitly adds rule-set authoring/conversion workflows. |
| Remote Rule Set `download_detour` should be removed from stable flows. | Rejected. Stable documents `download_detour`; testing deprecates it in favor of `http_client`. The fix is target-aware UI/graph, not removing the stable field. |
| Rule Set type change must preserve every advanced field. | Not filed as an upstream mismatch. Rebuilding when changing between remote/local/inline intentionally drops fields that do not belong to the new type; only fields with clear cross-type semantics should be considered for preservation in a separate UX pass. |
| HTTP Clients should be creatable on stable targets. | Rejected. Stable top-level config does not include `http_clients`, product docs mark HTTP Client resources target-gated/testing-ready, and current stable diagnostics warn if imported stable config contains them. |
| HTTP Client rename/delete lifecycle is absent. | Rejected. The reference registry already updates string refs from route, remote rule-set, and certificate providers, plus nested outbound/DNS/certificate refs inside HTTP Client objects. The confirmed gap is missing stale-ref diagnostics and missing graph/Inspector affordances. |
| Cloudflared should be creatable on stable targets. | Rejected. Stable inbound docs do not list `cloudflared`; testing 1.14 adds it. The finding is missing explicit testing support or clearer docs-only gating, not stable enablement. |
| Cloudflared is a broken clickable palette no-op. | Rejected. The current Palette marks it `gated` and disables activation; the remaining issue is the testing-target capability gap recorded as C1-22. |
| Inbound V2Ray transport fields are missing for VMess/Trojan/VLESS. | Rejected. Upstream exposes `transport` for all three, and SBC exposes `v2ray-transport` shared fields for those inbound types. |
| Trojan fallback is completely missing. | Rejected. SBC has a structured `fallback.server` / `fallback.server_port` editor and keeps `fallback_for_alpn` as Advanced JSON; no upstream-required field is blocked by that split. |

## Follow-Up Research

The independent global SVG/icon semantics audit is complete:

- Report: [`icon-semantics-audit.md`](icon-semantics-audit.md)
- Scope: all node card icons, Palette creation icons, compatible picker icons, Inspector icons, port icons, edge/remove affordances, and related SVG interaction paths.
- Result: confirmed recognition risks around duplicated icon maps, kind-only picker icons, outbound protocol collapse to `Shield`, URLTest storage/shuffle metaphors, WireGuard/Tailscale identity collapse, certificate-provider drift, and narrow port icon vocabulary.
- Confirmed icon set: the cross-engine agreed target icons are visualized in [`../ui-reviews-pass2/_icons-preview-v4.html`](../ui-reviews-pass2/_icons-preview-v4.html) — every node + port icon at real sizes and canvas colors: 2-letter proxy/DNS monograms (VL/VM/TR/H2/SS · TC/UD/TL/HS/H3/QC), WireGuard/Tor/Tailscale brand marks, functional Lucide for control/structural nodes, and port icons by relationship semantics. When implementing the icon pass (item 8 below and the `IC-*` findings), **conform to this set; do not invent ad-hoc icons.**

## Development Execution Plan

Implement in this order; each item is intended to be one PR unless the diff exceeds the repo atomic limit.

1. Validation gate for invalid exports: `C0-1` through `C0-5`, `C0-10`, `C0-12`, `C0-15` through `C0-18`.
2. Inspector schema conformance: `C0-2`, `C0-3`, `C0-6`, `C0-7`, `C0-13`, `C0-14`, plus `JsonField` parse safety from `C0-18`.
3. Reference registry completeness: `C1-2`, `C1-4`, `C1-11`, `C1-16`, `C1-17`, `C1-20`, `C1-21`.
4. Route target abstraction for endpoints: `C0-11`, then update graph, diagnostics, commands, tests, and node chips together.
5. Canvas connect/disconnect correctness: `C1-7`, `C1-8`, `C1-12`, `C1-13`, `C1-15`, `C1-23`, `C2-3`, `C2-7`.
6. HTTP Client and certificate-provider capability pass: `C1-14`, `C1-18`, `C1-19`, `C2-4`, with stable/testing gates.
7. Target-aware UI and version gates: `C1-10`, `C1-22`, `C2-1`, `C2-2`, `C2-5`, `C2-6`.
8. Icon semantics pass: shared icon registry, type-aware compatible picker icons, protocol-accurate node icons, expanded port icon vocabulary, and tests from `icon-semantics-audit.md`.
