# sing-box Canvas Configuration Guide

This is the product-level guide for turning the official sing-box configuration documents into a user-facing React Flow editor. It is written from a normal user's point of view: what they are trying to add, where they should click, what appears on the canvas, what belongs in the Inspector, and what must be validated before export.

## Source Coverage

Read sources:

- Local stable docs: `.tmp/sing-box-docs/stable/docs/configuration`, 94 English Markdown files.
- Local testing docs: `.tmp/sing-box-docs/testing/docs/configuration`, 105 English Markdown files.
- Coverage matrix: [sing-box Config Document Inventory](sing-box-config-doc-inventory.md) and [sing-box Configuration Readthrough Matrix](sing-box-doc-readthrough-matrix.md).

Testing-only docs compared with stable:

- `dns/server/mdns.md`
- `inbound/cloudflared.md`
- `service/hysteria-realm.md`
- `shared/certificate-provider/index.md`
- `shared/certificate-provider/acme.md`
- `shared/certificate-provider/tailscale.md`
- `shared/certificate-provider/cloudflare-origin-ca.md`
- `shared/http-client.md`
- `shared/http2.md`
- `shared/neighbor.md`
- `shared/quic.md`

The UI must target `1.13 stable` by default, keep `1.12 Legacy` explicit, and require an explicit switch for `1.14 testing`.

Readthrough contract:

- The exhaustive doc-by-doc ledger is [sing-box Configuration Readthrough Matrix](sing-box-doc-readthrough-matrix.md). It has one row for every English Markdown file in the testing configuration docs and records the product class for each doc.
- This guide is the global product rule for how normal users configure those docs in the canvas. It intentionally does not duplicate every field table from upstream sing-box docs.
- If a doc exists in the matrix but the Library item is `DOCS`, `PENDING`, or `GATED`, the UI must explain where that object will eventually be configured and why it is not writable yet.
- If this guide, the matrix, the Palette, or `pnpm audit:config-docs` disagree, fix the documentation before implementing more UI.

Current completeness checkpoint, from `pnpm audit:config-docs` on 2026-05-26:

- Official testing English docs: 105.
- Matrix rows: 105.
- Palette entries: 104.
- Remaining docs without a Palette surface: 8 base/resource-helper docs.
- Remaining writable docs without a complete write path: 12.

The remaining write-path gaps are intentional blockers, not permission to improvise JSON from the canvas. They are: DNS Legacy Server, Endpoint WireGuard/Tailscale, Outbound WireGuard/DNS migration entries, Rule Set, and Service resources.

## Product Principle

The canvas is a visual editor, not the configuration source. The source of truth is the canonical sing-box JSON/domain model.

Every user action must follow this path:

1. User clicks a template, Library item, port action, table action, or Inspector control.
2. A domain command updates canonical `SingBoxConfig`.
3. React Flow nodes and edges are re-derived from that canonical config.
4. JSON Preview renders the canonical config.
5. Semantic validation runs in the browser.
6. Official `sing-box check` validates fixtures/export through the target-matched binary.

Never infer final JSON from canvas node positions, edge order, or React Flow node data.

## Global Placement Algorithm

Use this decision tree for every official configuration doc before writing UI or schema:

1. If the doc owns a top-level object or array, expose it from Library or Templates, but keep the canonical JSON key as the write owner.
2. If the doc is a protocol/object under `inbounds[]`, `outbounds[]`, `dns.servers[]`, `endpoints[]`, or `services[]`, make it an addable setup node only after a domain create command, Inspector schema, graph derivation, fixture, and target binary check exist.
3. If the doc is an ordered list item, such as `route.rules`, `dns.rules`, or headless rule-set rules, edit it in an ordered table in the right Inspector. Canvas rule nodes are visual shortcuts only.
4. If the doc is a shared field group, such as Listen, Dial, TLS, Multiplex, V2Ray Transport, HTTP2, QUIC, DNS01, Wi-Fi State, or Neighbor Resolution, never add it as a standalone node. Put it inside the owning parent Inspector.
5. If the doc is a base/index page, use it as a Library group, hub node, or table entry. Do not create duplicate "base" objects when the concrete child types own the JSON.
6. If the doc is deprecated, removed, or superseded in the target, support import diagnostics and migration help first. Fresh creation stays `DOCS` or `MIGRATION/DOCS`.
7. If the doc is testing-only, mark it `TARGET GATED` outside `1.14 testing`.
8. If any write path is incomplete, the Library badge stays `PENDING` or `DOCS`; it must not emit JSON.

The normal user should never need to know this algorithm. They should see an obvious action: add a node, open a table, edit an Inspector section, switch target, or read migration docs.

## UI Status Vocabulary

The Library must tell the user what will happen before they click.

| Badge | Meaning | Click behavior |
| --- | --- | --- |
| `ADD READY` | Creates an immediately useful, minimal object | Add object to canonical JSON, show node, open Inspector |
| `ADD SETUP` | Creates a valid-shaped draft that needs real user values | Add object, show node, open Inspector with required-field checklist and diagnostics |
| `TABLE` | Ordered item, not a free canvas node | Open the owning route/DNS/rule-set table in the right Inspector |
| `INSPECTOR` | Shared or nested field group | Select or create the parent object, then edit this section in Inspector |
| `TARGET GATED` | Exists only in a different sing-box target | Show required target, allow switch, then enable |
| `MIGRATION/DOCS` | Deprecated, removed, or documentation-only | Open docs and show migration note; do not emit new JSON for stable |
| `PENDING` | Official doc is read but write path is not implemented | Disabled until domain command, Inspector schema, fixture, and validation exist |

`DOCS` must be a secondary link, not the main action for a type that users reasonably expect to add, such as HTTP, Shadowsocks, VMess, Trojan, Hysteria, or SSH outbounds.

## User Mental Model

Users do not think in JSON sections first. They think in these workflows:

1. "I need traffic to enter sing-box" -> add an Inbound.
2. "I need to decide where traffic goes" -> configure Route Rules.
3. "I need proxy/direct/block targets" -> add Outbounds and groups.
4. "I need DNS behavior" -> configure DNS servers and DNS Rules.
5. "I need global behavior" -> add settings such as Log, NTP, Certificate, Experimental.
6. "I need advanced resources" -> add Endpoints, Rule Sets, Services, HTTP Clients, Certificate Providers.

The product should present these workflows, while preserving the exact official top-level JSON structure.

## Editing Surfaces

SBC has five editing surfaces, each with a strict owner:

| Surface | What users do there | What it may mutate |
| --- | --- | --- |
| Templates | Start from curated stable/legacy/testing examples | Whole canonical config through template commands |
| Library | Add or reveal concrete objects | Top-level objects, array entries, resource entries |
| Canvas side icons | Add/remove compatible references near a selected node | Tag references, final/default refs, selector/urltest members, detours |
| Right Inspector | Edit fields for the selected object | The selected canonical object and its embedded shared fields |
| Ordered tables | Edit first-match order and rule rows | `route.rules`, `dns.rules`, rule-set rules |

The JSON Preview and advanced JSON editor are synchronization surfaces, not graph generation sources.

No selection means no Inspector. Selecting a node means the Inspector is the primary edit surface for that node.

## Canvas Object Classes

### Traffic Chain Nodes

These are real nodes because they participate in traffic or reference flow:

- `inbounds[]`
- `outbounds[]`
- `dns.servers[]`
- `endpoints[]`
- `services[]` when the service has a runtime identity
- `certificate_providers[]` and `http_clients[]` in testing targets

Each node has:

- A titlebar icon for its own type.
- Left-side icons for compatible upstream objects, not a copy of its own icon.
- Right-side icons for compatible downstream objects.
- Hover actions to add/remove compatible references through domain commands.
- A selected state that opens the right Inspector.

### Hub Nodes

These aggregate ordered or default references:

- `route`
- `dns`

Hub nodes may appear on the canvas, but their ordered lists are not controlled by canvas edge order.

### Ordered Tables

These must be edited as ordered tables:

- `route.rules`
- `dns.rules`
- `route.rule_set[].rules`
- Headless rule-set rules

The canvas may render compact rule nodes when the rule count is small, but the order must always come from the canonical array.

### Independent Settings

These are optional settings cards, not traffic nodes:

- `log`
- `ntp`
- `certificate`
- `experimental`

They have no ports. They are added from Library or revealed when imported JSON contains them.

### Shared Fields

Shared docs are not standalone nodes:

- Listen Fields
- Dial Fields
- TLS
- HTTP2 Fields
- QUIC Fields
- DNS01 Challenge Fields
- Pre-match
- Multiplex
- V2Ray Transport
- UDP over TCP
- TCP Brutal
- Wi-Fi State
- Neighbor Resolution

They must live inside the owning parent Inspector or ordered rule table.

## Top-Level Configuration Guidance

| JSON key | User-facing entry | Canvas behavior | Editing owner |
| --- | --- | --- | --- |
| `log` | Library > Settings > Log | Independent card | Log Inspector |
| `dns` | DNS Hub / template/import | DNS hub node | DNS Inspector + DNS Rules table |
| `ntp` | Library > Settings > NTP | Independent card | NTP Inspector with Dial Fields |
| `certificate` | Library > Settings > Certificate | Independent card | Certificate Inspector |
| `certificate_providers[]` | Library > Certificate Providers | Testing resource nodes | Provider Inspector, target gated |
| `http_clients[]` | Library > HTTP Clients | Testing resource nodes | HTTP Client Inspector, target gated |
| `endpoints[]` | Library > Endpoints | Resource/chain nodes | Endpoint Inspector |
| `inbounds[]` | Library > Inbounds | Traffic source nodes | Inbound Inspector |
| `outbounds[]` | Library > Outbounds | Traffic target/group nodes | Outbound Inspector |
| `route` | Route Hub / template/import | Route hub node | Route Inspector + Route Rules table |
| `services[]` | Library > Services | Service resource nodes | Service Inspector |
| `experimental` | Library > Settings > Experimental | Independent card | Experimental Inspector |

## Library Design

The left Library should stay collapsed by default:

- `Templates` pill: only curated, high-confidence templates.
- `Library` pill: grouped configuration object types.
- Search: searches all official config entries and shows their status.
- Docs link: always available for each official entry.

Templates should include:

- `1.13 Stable TUN Split`
- `1.12 Legacy Mixed Split`
- `1.14 Testing HTTP Client`

Library groups should be broad enough to scan and narrow enough to explain ownership:

- `Log`, `NTP`, `Certificate`, and `Experimental` are settings groups. Items create settings cards or open settings Inspectors.
- `DNS`, `Route`, and `Rule Set` are logic groups. Rules open ordered tables; hubs are add/reveal nodes.
- `Inbounds`, `Outbounds`, `DNS Server`, `Endpoints`, and `Services` are object groups. Writable items add nodes or setup drafts.
- `Certificate Providers` and `HTTP Clients` are target-gated resource groups until stable support is proven.
- `Shared` is an educational/index group. Its items open docs or highlight the owning Inspector section; they do not add standalone nodes.

## Inbounds

All official inbound docs should be discoverable under Library > Inbounds.

| Type | User action | Canvas behavior | Inspector sections |
| --- | --- | --- | --- |
| `tun` | `ADD READY` | Source node, commonly connects to Route | TUN fields, route integration, platform hints |
| `mixed` | `ADD READY` | Local mixed proxy source | Listen Fields, users, system proxy |
| `direct` | `ADD SETUP` | Source node | Listen Fields, override address/port |
| `socks` | `ADD SETUP` | Source node | Listen Fields, users |
| `http` | `ADD SETUP` | Source node | Listen Fields, users, TLS, system proxy |
| `shadowsocks` | `ADD SETUP` | Source node | Listen Fields, method/password/users, multiplex |
| `vmess` | `ADD SETUP` | Source node | Listen Fields, users, TLS, multiplex, transport |
| `trojan` | `ADD SETUP` | Source node | Listen Fields, users, TLS, fallback, multiplex, transport |
| `naive` | `ADD SETUP` | Source node | Listen Fields, users, TLS, QUIC |
| `hysteria` | `ADD SETUP` | Source node | Listen Fields, bandwidth, auth/users, TLS/QUIC |
| `shadowtls` | `ADD SETUP` | Source node | Listen Fields, version/password, handshake Dial Fields |
| `vless` | `ADD SETUP` | Source node | Listen Fields, users, TLS, multiplex, transport |
| `tuic` | `ADD SETUP` | Source node | Listen Fields, users, congestion, TLS/QUIC |
| `hysteria2` | `ADD SETUP` | Source node | Listen Fields, users, bandwidth, obfs, TLS/QUIC, masquerade |
| `anytls` | `ADD SETUP` | Source node | Listen Fields, users, TLS |
| `redirect` | `ADD SETUP` | Source node | Listen Fields |
| `tproxy` | `ADD SETUP` | Source node | Listen Fields, network |
| `cloudflared` | `TARGET GATED` | Testing source node | Token, protocol, HA connections, nested Dial Fields |

Normal-user rule: after adding any inbound, the right Inspector must immediately show "what is missing" and "what can connect downstream". The user should not need to open docs to learn that `listen` and `listen_port` live under Listen Fields.

## Outbounds

Outbounds are the clearest source of the current usability gap. Users expect every proxy protocol in Library > Outbounds to be addable to the canvas.

| Type | User action | Canvas behavior | Inspector sections |
| --- | --- | --- | --- |
| `direct` | `ADD READY` | Target node | Override fields only if expanded |
| `block` | `ADD READY` | Target node | No required fields |
| `socks` | `ADD READY` or `ADD SETUP` | Target node | Server, port, version, auth, UDP over TCP, Dial Fields |
| `http` | `ADD SETUP` | Target node | Server, port, username/password, path, headers, TLS, Dial Fields |
| `shadowsocks` | `ADD SETUP` | Target node | Server, port, method, password, plugin, network, UDP over TCP, multiplex |
| `vmess` | `ADD SETUP` | Target node | Server, port, UUID, security, packet encoding, TLS, transport, multiplex |
| `trojan` | `ADD SETUP` | Target node | Server, port, password, network, TLS, transport, multiplex |
| `naive` | `ADD SETUP` | Target node | Server, port, auth, QUIC, TLS, Dial Fields |
| `wireguard` | `MIGRATION/DOCS` by default | Legacy display/import only on stable | Prefer Endpoint WireGuard; outbound WireGuard is deprecated/removed in newer targets |
| `hysteria` | `ADD SETUP` | Target node | Server/port or port range, bandwidth, obfs/auth, network, TLS/QUIC |
| `shadowtls` | `ADD SETUP` | Target node | Server, port, version, password, TLS |
| `vless` | `ADD SETUP` | Target node | Server, port, UUID, flow, network, TLS, packet encoding, transport, multiplex |
| `tuic` | `ADD SETUP` | Target node | Server, port, UUID, password, congestion, relay mode, TLS/QUIC |
| `hysteria2` | `ADD SETUP` | Target node | Server/realm, password, bandwidth, obfs, TLS/QUIC |
| `anytls` | `ADD SETUP` | Target node | Server, port, password, idle-session fields, TLS |
| `tor` | `ADD SETUP` | Target node | Executable/data directory/torrc, build-support warning |
| `ssh` | `ADD SETUP` | Target node | Server, port, user/password/key/host key, algorithms |
| `dns` | `MIGRATION/DOCS` by default | Legacy special outbound | Prefer rule actions; deprecated in 1.11+ |
| `selector` | `ADD READY` | Group node | Candidate outbounds, default candidate |
| `urltest` | `ADD READY` | Group node | Candidate outbounds, test URL, interval, tolerance |

Normal-user rule: when a Route node is selected and the user adds an outbound from Library, the product should offer "add unconnected" and "connect as route final" choices. When a Selector/URLTest is selected, adding an outbound should default to adding it as a candidate.

## Route

Route is a hub plus ordered rules.

| Entry | User action | Correct UI |
| --- | --- | --- |
| Route Hub | `ADD READY` | Creates/reveals `route` node |
| Route Rule | `TABLE` | Opens ordered Route Rules editor |
| Rule Action | `INSPECTOR` | Edited inside each route rule row |
| GeoIP | `MIGRATION/DOCS` | Removed in 1.12; support import diagnostics/migration only |
| Geosite | `MIGRATION/DOCS` | Removed in 1.12; support import diagnostics/migration only |
| Rule Set | `ADD SETUP` | Resource list/node, referenced by route rules |
| Protocol Sniff | `INSPECTOR` | Route rule action section, not a node |

Route rules must support common first-match fields first:

- domain, domain suffix, domain keyword, domain regex
- rule set
- IP CIDR and source IP CIDR
- port and source port
- network, protocol, process, package, user, client
- inbound tag
- action/outbound

Advanced route fields such as `auto_detect_interface`, default network strategy, default domain resolver, and target-specific fields belong on the Route Inspector.

## DNS

DNS is a hub plus servers plus ordered rules.

| Entry | User action | Correct UI |
| --- | --- | --- |
| DNS Hub | `ADD READY` | Creates/reveals `dns` node |
| DNS Rule | `TABLE` | Opens ordered DNS Rules editor |
| DNS Rule Action | `INSPECTOR` | Edited inside each DNS rule row |
| FakeIP | `INSPECTOR` | DNS Inspector subform |
| Legacy Server | `MIGRATION/DOCS` | Import/support oriented; do not create fresh stable configs by default |
| Local Server | `ADD READY` | DNS server node |
| Hosts Server | `ADD SETUP` | DNS server node |
| TCP/UDP/TLS/QUIC/HTTPS/HTTP3 Server | `ADD SETUP` | DNS server node |
| DHCP Server | `ADD SETUP` | DNS server node |
| mDNS Server | `TARGET GATED` | Testing DNS server node |
| FakeIP Server | `ADD SETUP` | DNS server node |
| Tailscale Server | `ADD SETUP` | DNS server node referencing endpoint |
| Resolved Server | `ADD SETUP` | DNS server node referencing service/default resolver behavior |

DNS Rules are ordered just like Route Rules. Canvas edges may show `dns.rules[].server` and `dns.final`, but the table owns rule order.

Normal-user rule: DNS Server items are addable because they create concrete `dns.servers[]` entries. DNS FakeIP is not a server; it is a DNS Inspector subform. DNS Rule Action is not a node; it is the action section inside a DNS Rule row.

## Endpoints

Endpoints are resource/chain nodes, not ordinary outbounds.

| Type | User action | Correct UI |
| --- | --- | --- |
| WireGuard endpoint | `ADD SETUP` | Endpoint node; preferred replacement for deprecated WireGuard outbound |
| Tailscale endpoint | `ADD SETUP` | Endpoint node; can be referenced by DNS server/certificate provider |

Endpoint Inspector owns Dial/TLS-like shared sections where supported.

Current implementation rule: until endpoint graph derivation and reference commands are implemented, endpoint docs stay `DOCS` even though the target product action is `ADD SETUP`. Do not create endpoint JSON from a generic placeholder.

## Services

Services are runtime resources. They should not be shown as if they are route outbounds unless the official docs define a tag reference from another object.

| Type | User action | Correct UI |
| --- | --- | --- |
| DERP | `ADD SETUP` | Service card/node, Listen Fields, TLS, mesh/STUN fields |
| Resolved | `ADD SETUP` | Service card/node, Listen Fields |
| SSM API | `ADD SETUP` | Service card/node, Listen Fields, servers, TLS |
| CCM | `ADD SETUP` | Service card/node, Listen Fields, users, headers, detour, TLS |
| OCM | `ADD SETUP` | Service card/node, Listen Fields, users, headers, detour, TLS |
| Hysteria Realm | `TARGET GATED` | Testing service card/node, Listen Fields, HTTP2, users |

Current implementation rule: services are runtime resources, not route targets. They stay `DOCS` until service create/update/delete commands and Inspector schemas exist. Hysteria Realm is additionally target-gated because it is testing-only.

## Settings And Advanced Resources

| Area | User action | Correct UI |
| --- | --- | --- |
| Log | `ADD READY` | Independent settings card; level/output/timestamp/disabled |
| NTP | `ADD SETUP` | Independent settings card; enabled/server/port/interval plus Dial Fields |
| Certificate | `ADD SETUP` | Independent settings card; store/certificate paths |
| Experimental cache file | `INSPECTOR` | Experimental settings section |
| Clash API | `INSPECTOR` | Experimental settings section |
| V2Ray API | `INSPECTOR` | Experimental settings section |
| HTTP Client | `TARGET GATED` | Testing top-level resource or embedded object |
| Certificate Provider | `TARGET GATED` | Testing top-level resource |

Certificate providers:

- ACME owns DNS01 Challenge and optional HTTP Client fields.
- Tailscale provider references a Tailscale endpoint.
- Cloudflare Origin CA owns API/origin CA fields and optional HTTP Client fields.

Current implementation rule: Log, NTP, Certificate, and Experimental are writable independent settings cards. Experimental defaults must stay stable-safe; testing-only fields such as cache-file `store_dns` require target-gated handling before emission.

## Shared Field Placement

| Shared doc | User-facing location |
| --- | --- |
| Listen Fields | Inbound and Service Inspectors |
| Dial Fields | Outbound, Endpoint, NTP, DNS Server, and some nested handshake Inspectors |
| TLS | Inbound, Outbound, Endpoint, Service, and Certificate-related Inspectors |
| HTTP2 Fields | HTTP Client and Hysteria Realm Inspectors |
| QUIC Fields | QUIC-capable protocol Inspectors |
| DNS01 Challenge Fields | ACME Certificate Provider Inspector |
| Pre-match | Route/DNS rule action help, not a node |
| Multiplex | Protocol parent Inspector |
| V2Ray Transport | VMess/VLESS/Trojan/Shadowsocks parent Inspector |
| UDP over TCP | SOCKS/Shadowsocks/Naive/TUIC compatible parent Inspector |
| TCP Brutal | Multiplex/transport nested subform |
| Wi-Fi State | Route/DNS rule matcher fields |
| Neighbor Resolution | Testing route/DNS/local-neighbor fields |

## Canvas Interaction Rules

1. Default load should show the whole graph and select nothing.
2. Selecting a node opens the right Inspector. No selection means no Inspector.
3. Topbar floats over the canvas and uses the same dark button style as the toolbar.
4. Toolbar floats bottom-center. Palette must not cover it.
5. Palette is an overlay; clicking outside it must remain usable for canvas panning/selection.
6. Node side icons are relation icons:
   - left side: compatible upstream source/reference types;
   - right side: compatible downstream target/reference types.
7. Hovering a side icon should reveal add/remove behavior. Add creates the missing compatible object or reference through a domain command. Remove deletes only the reference unless the user explicitly deletes the node.
8. Ordered tables live in the right Inspector, not in a confusing bottom panel.
9. Edge labels should be semantic: `route final`, `rule outbound`, `selector candidate`, `dns final`, `dns rule server`, not generic `candidate` everywhere.
10. Large imported configs should auto-layout by semantic columns: inbounds, hubs, ordered rules, primary outbounds, group members, resources/settings.

## Normal User Flows

### Add A Proxy Outbound

1. Open `Library`.
2. Choose `Outbounds`.
3. Click `ADD SETUP` on HTTP/Shadowsocks/VMess/Trojan/etc.
4. A node appears on the canvas and the Inspector opens.
5. Fill server, port, auth, TLS, and shared Dial fields.
6. Connect it from Route, Route Rule, Selector, or URLTest using side icons or Inspector pickers.
7. Run diagnostics and official validation.

### Add Log Settings

1. Open `Library`.
2. Choose `Log`.
3. Click `ADD READY`.
4. A settings card appears with no ports.
5. Edit level/output/timestamp in Inspector.

### Add A Route Rule

1. Select Route.
2. Open Route Rules in the right Inspector.
3. Add a row.
4. Fill matchers and outbound/action.
5. Reorder rows in the table. Do not drag canvas edges to reorder.

### Add DNS Behavior

1. Add/reveal DNS Hub.
2. Add DNS Server nodes from Library.
3. Select DNS and set final server.
4. Add DNS Rules through the DNS Rules table.
5. Shared DNS behavior such as FakeIP stays in DNS Inspector.

### Use Shared TLS

1. Select an inbound/outbound/endpoint/service that supports TLS.
2. Open the TLS section in its Inspector.
3. Fill server name, certificate, ECH, Reality, or provider reference based on target support.
4. Do not add a standalone TLS node.

## Implementation Gate For Every Official Doc

Before changing an item from `PENDING`, `DOCS`, or `TARGET GATED` to a writable state, complete all of this:

1. Matrix row maps the official doc to a product class.
2. Domain command exists and mutates only canonical JSON/domain state.
3. Inspector schema covers required fields, target-gated fields, deprecated fields, and shared-field placement.
4. Diagnostics catch missing required references, duplicate tags, removed fields, and target/version conflicts.
5. At least one stable fixture or testing fixture exists for the write path.
6. Matching official binary check runs:
   - stable/legacy with `sing-box-stable` or the explicit legacy binary when applicable;
   - testing with `sing-box-testing`.
7. React Flow graph derives from JSON and renders the node/edge relation.
8. E2E imports, edits, exports, reimports, and inspects the result.
9. Docs and UI labels tell normal users where to configure the object.

## Known Design Risks

- A long Library list can overwhelm users. Keep groups collapsed and search-first.
- `ADD SETUP` objects may not pass official validation until required fields are filled. The UI must say this plainly.
- Deprecated objects such as GeoIP/Geosite and legacy special outbounds should support import/migration, not fresh stable creation.
- Shared fields are numerous and nested. If they appear as standalone nodes, users will build invalid mental models.
- Selector and URLTest can reference other group outbounds; port handles must support group-to-group membership.
- Imported subscription templates may contain placeholders or provider extensions. They can be display-compatible without being official-check-compatible; diagnostics must distinguish these states.
