# sing-box Configuration Readthrough Matrix

This is the implementation gate for SBC. Do not mark a Library item as writable until its row here has a concrete owner, domain command, Inspector schema, fixture, and matching stable/testing CLI validation.

Sources read on 2026-05-26:

- `SagerNet/sing-box` `stable/docs/configuration`: 94 English Markdown docs.
- `SagerNet/sing-box` `testing/docs/configuration`: 105 English Markdown docs.
- Official configuration `#fields`: `log`, `dns`, `ntp`, `certificate`, `certificate_providers`, `http_clients`, `endpoints`, `inbounds`, `outbounds`, `route`, `services`, `experimental`.

Local source checkout used for this readthrough:

```bash
git clone --depth 1 --branch stable --filter=blob:none --sparse https://github.com/SagerNet/sing-box.git .tmp/sing-box-docs/stable
git -C .tmp/sing-box-docs/stable sparse-checkout set docs/configuration
git clone --depth 1 --branch testing --filter=blob:none --sparse https://github.com/SagerNet/sing-box.git .tmp/sing-box-docs/testing
git -C .tmp/sing-box-docs/testing sparse-checkout set docs/configuration
```

Testing-only docs versus stable:

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

## Product Mapping Rules

| Class | Meaning | Canvas behavior | Write path |
| --- | --- | --- | --- |
| `top-level-schema` | Root config object and target version rules | No node by itself | Import/export/schema registry |
| `independent-settings` | Top-level object that does not route traffic | Optional independent settings node, no ports | Inspector writes top-level object |
| `chain-hub` | Aggregates ordered rules or default/final refs | Hub node with limited ports | Inspector + ordered tables + domain commands |
| `ordered-rule` | Ordered first-match rule lists | Table-owned; compact configs may show visual rule nodes | Rule table commands; canvas only edits references |
| `chain-node` | Traffic object such as inbound/outbound | Node with typed ports | Domain add/update/delete/ref commands |
| `chain-resource` | Referenced traffic/resource object such as DNS server or endpoint | Node with typed ports when references exist | Domain add/update/delete/ref commands |
| `resource` | Reusable named resource | Resource node/table; no free traffic flow | Resource command + reference picker |
| `service-resource` | Long-running service object | Service node/table; no route flow unless docs define refs | Service command + Inspector |
| `embedded-shared-fields` | Shared field group reused inside other objects | Not addable as node | Embedded Inspector subform only |
| `inspector-subform` | Child structure under a parent object | Not addable as node | Parent Inspector section |
| `reference-data-or-subform` | Rule data, deprecated database, or helper behavior | Usually not a node | Rule/route Inspector or warning |

## Full English Doc Matrix

| Doc | Channel | Class | SBC implementation |
| --- | --- | --- | --- |
| `index.md` | stable+testing | top-level-schema | Domain root, target selector, import/export |
| `log/index.md` | stable+testing | independent-settings | Settings node + Log Inspector |
| `ntp/index.md` | stable+testing | independent-settings | Settings node + NTP Inspector |
| `certificate/index.md` | stable+testing | independent-settings | Settings node + Certificate Inspector |
| `experimental/index.md` | stable+testing | independent-settings | Settings node + Experimental Inspector |
| `experimental/cache-file.md` | stable+testing | independent-settings | Experimental Inspector subform |
| `experimental/clash-api.md` | stable+testing | independent-settings | Experimental Inspector subform |
| `experimental/v2ray-api.md` | stable+testing | independent-settings | Experimental Inspector subform |
| `dns/index.md` | stable+testing | chain-hub | DNS hub node + DNS Inspector |
| `dns/rule.md` | stable+testing | ordered-rule | DNS Rules table + compact visual rule nodes |
| `dns/rule_action.md` | stable+testing | inspector-subform | DNS Rule action editor |
| `dns/fakeip.md` | stable+testing | inspector-subform | DNS FakeIP subform |
| `dns/server/index.md` | stable+testing | chain-resource | DNS Server node base |
| `dns/server/legacy.md` | stable+testing | chain-resource | DNS Server type |
| `dns/server/local.md` | stable+testing | chain-resource | DNS Server type |
| `dns/server/hosts.md` | stable+testing | chain-resource | DNS Server type |
| `dns/server/tcp.md` | stable+testing | chain-resource | DNS Server type |
| `dns/server/udp.md` | stable+testing | chain-resource | DNS Server type |
| `dns/server/tls.md` | stable+testing | chain-resource | DNS Server type |
| `dns/server/quic.md` | stable+testing | chain-resource | DNS Server type |
| `dns/server/https.md` | stable+testing | chain-resource | DNS Server type |
| `dns/server/http3.md` | stable+testing | chain-resource | DNS Server type |
| `dns/server/dhcp.md` | stable+testing | chain-resource | DNS Server type |
| `dns/server/fakeip.md` | stable+testing | chain-resource | DNS Server type |
| `dns/server/tailscale.md` | stable+testing | chain-resource | DNS Server type |
| `dns/server/resolved.md` | stable+testing | chain-resource | DNS Server type |
| `dns/server/mdns.md` | testing-only | chain-resource | DNS Server type, testing gated |
| `route/index.md` | stable+testing | chain-hub | Route hub node + Route Inspector |
| `route/rule.md` | stable+testing | ordered-rule | Route Rules table + compact visual rule nodes |
| `route/rule_action.md` | stable+testing | inspector-subform | Route Rule action editor |
| `route/sniff.md` | stable+testing | reference-data-or-subform | Route rule action/sniff subform |
| `route/geoip.md` | stable+testing | reference-data-or-subform | Deprecated/version warning + rule data |
| `route/geosite.md` | stable+testing | reference-data-or-subform | Deprecated/version warning + rule data |
| `rule-set/index.md` | stable+testing | resource | Rule Set resource table/node |
| `rule-set/source-format.md` | stable+testing | resource | Rule Set source editor |
| `rule-set/headless-rule.md` | stable+testing | resource | Rule Set rule editor |
| `rule-set/adguard.md` | stable+testing | resource | Rule Set AdGuard source editor |
| `endpoint/index.md` | stable+testing | chain-resource | Endpoint node base |
| `endpoint/wireguard.md` | stable+testing | chain-resource | Endpoint node type |
| `endpoint/tailscale.md` | stable+testing | chain-resource | Endpoint node type |
| `inbound/index.md` | stable+testing | chain-node | Inbound node base |
| `inbound/direct.md` | stable+testing | chain-node | Inbound node type |
| `inbound/mixed.md` | stable+testing | chain-node | Inbound node type |
| `inbound/socks.md` | stable+testing | chain-node | Inbound node type |
| `inbound/http.md` | stable+testing | chain-node | Inbound node type |
| `inbound/shadowsocks.md` | stable+testing | chain-node | Inbound node type |
| `inbound/vmess.md` | stable+testing | chain-node | Inbound node type |
| `inbound/trojan.md` | stable+testing | chain-node | Inbound node type |
| `inbound/naive.md` | stable+testing | chain-node | Inbound node type |
| `inbound/hysteria.md` | stable+testing | chain-node | Inbound node type |
| `inbound/shadowtls.md` | stable+testing | chain-node | Inbound node type |
| `inbound/vless.md` | stable+testing | chain-node | Inbound node type |
| `inbound/tuic.md` | stable+testing | chain-node | Inbound node type |
| `inbound/hysteria2.md` | stable+testing | chain-node | Inbound node type |
| `inbound/anytls.md` | stable+testing | chain-node | Inbound node type |
| `inbound/tun.md` | stable+testing | chain-node | Inbound node type |
| `inbound/redirect.md` | stable+testing | chain-node | Inbound node type |
| `inbound/tproxy.md` | stable+testing | chain-node | Inbound node type |
| `inbound/cloudflared.md` | testing-only | chain-node | Inbound node type, testing gated |
| `outbound/index.md` | stable+testing | chain-node | Outbound node base |
| `outbound/direct.md` | stable+testing | chain-node | Outbound node type |
| `outbound/block.md` | stable+testing | chain-node | Outbound node type |
| `outbound/socks.md` | stable+testing | chain-node | Outbound node type |
| `outbound/http.md` | stable+testing | chain-node | Outbound node type |
| `outbound/shadowsocks.md` | stable+testing | chain-node | Outbound node type |
| `outbound/vmess.md` | stable+testing | chain-node | Outbound node type |
| `outbound/trojan.md` | stable+testing | chain-node | Outbound node type |
| `outbound/naive.md` | stable+testing | chain-node | Outbound node type |
| `outbound/wireguard.md` | stable+testing | chain-node | Outbound node type |
| `outbound/hysteria.md` | stable+testing | chain-node | Outbound node type |
| `outbound/shadowtls.md` | stable+testing | chain-node | Outbound node type |
| `outbound/vless.md` | stable+testing | chain-node | Outbound node type |
| `outbound/tuic.md` | stable+testing | chain-node | Outbound node type |
| `outbound/hysteria2.md` | stable+testing | chain-node | Outbound node type |
| `outbound/anytls.md` | stable+testing | chain-node | Outbound node type |
| `outbound/tor.md` | stable+testing | chain-node | Outbound node type |
| `outbound/ssh.md` | stable+testing | chain-node | Outbound node type |
| `outbound/dns.md` | stable+testing | chain-node | Outbound node type |
| `outbound/selector.md` | stable+testing | chain-node | Selector group node |
| `outbound/urltest.md` | stable+testing | chain-node | URLTest group node |
| `service/index.md` | stable+testing | service-resource | Service table/node base |
| `service/derp.md` | stable+testing | service-resource | Service type |
| `service/resolved.md` | stable+testing | service-resource | Service type |
| `service/ssm-api.md` | stable+testing | service-resource | Service type |
| `service/ccm.md` | stable+testing | service-resource | Service type |
| `service/ocm.md` | stable+testing | service-resource | Service type |
| `service/hysteria-realm.md` | testing-only | service-resource | Service type, testing gated |
| `shared/listen.md` | stable+testing | embedded-shared-fields | Inbound Inspector only |
| `shared/dial.md` | stable+testing | embedded-shared-fields | Outbound/Endpoint/DNS Server Inspector only |
| `shared/tls.md` | stable+testing | embedded-shared-fields | Inbound/Outbound/Endpoint Inspector only |
| `shared/multiplex.md` | stable+testing | embedded-shared-fields | Outbound/Endpoint Inspector only |
| `shared/v2ray-transport.md` | stable+testing | embedded-shared-fields | Protocol Inspector only |
| `shared/udp-over-tcp.md` | stable+testing | embedded-shared-fields | Protocol Inspector only |
| `shared/tcp-brutal.md` | stable+testing | embedded-shared-fields | Transport Inspector only |
| `shared/pre-match.md` | stable+testing | embedded-shared-fields | Route/DNS Rule Inspector only |
| `shared/wifi-state.md` | stable+testing | embedded-shared-fields | Route/DNS Rule Inspector only |
| `shared/dns01_challenge.md` | stable+testing | embedded-shared-fields | ACME Provider Inspector only |
| `shared/http-client.md` | testing-only | resource | `http_clients[]` resource and embedded HTTP client object |
| `shared/http2.md` | testing-only | embedded-shared-fields | HTTP Client Inspector only |
| `shared/quic.md` | testing-only | embedded-shared-fields | HTTP Client/QUIC Inspector only |
| `shared/neighbor.md` | testing-only | embedded-shared-fields | Route/DNS local-neighbor fields |
| `shared/certificate-provider/index.md` | testing-only | resource | `certificate_providers[]` resource |
| `shared/certificate-provider/acme.md` | testing-only | resource | ACME provider type |
| `shared/certificate-provider/tailscale.md` | testing-only | resource | Tailscale provider type |
| `shared/certificate-provider/cloudflare-origin-ca.md` | testing-only | resource | Cloudflare Origin CA provider type |

## Addability And UI Semantics

The left Library is an add surface only when the entry can create or reveal a concrete top-level/domain object. It must not imply that every official doc page is directly addable to the canvas.

| UI badge | Meaning | User action | Required write path before badge can be `ADD` |
| --- | --- | --- | --- |
| `ADD` | Creates a concrete object in canonical config | Add node/resource/settings object | Domain command + Inspector schema + fixture + matching CLI check |
| `TABLE` | Adds or edits an ordered list item | Open rules/resource table | Rule/resource table command + ordering tests |
| `INSPECTOR` | Embedded field group, not a standalone object | Select parent node, edit section | Parent Inspector schema + parent fixture |
| `DOCS` | Documentation reference only | Open docs/read mapping | No config mutation |
| `GATED` | Exists only in a target channel/version | Switch target or keep disabled | Target metadata + versioned fixture + channel CLI check |
| `PENDING` | Official docs read, implementation not complete | No write action | Must not emit JSON |

Initial product rule:

- Top-level modules with object/array ownership may appear in Library.
- Shared field docs appear under a collapsed "Shared Inspector Fields" area with `INSPECTOR`/`DOCS`, not as addable nodes.
- Rule docs expose `TABLE`, because ordered tables own `route.rules`, `dns.rules`, and rule-set rules.
- `http_clients[]` and `certificate_providers[]` are testing-only top-level resources. They may show in Library only under target `1.14 testing`, or as `GATED` in stable targets.

## Top-Level Ownership Decisions

| Config area | Stable docs | Testing docs | Add surface | Canvas role | Editing owner |
| --- | --- | --- | --- | --- | --- |
| `log` | yes | yes | Library > Settings > Log | Optional independent settings card, no ports | Log Inspector writes `config.log` |
| `dns` | yes | yes | Template/import, DNS Library helpers | DNS hub node with DNS server/rule refs | DNS Inspector + DNS Rules table |
| `ntp` | yes | yes | Library > Settings > NTP | Optional independent settings card, no ports | NTP Inspector writes `config.ntp`; embeds Dial fields |
| `certificate` | yes | yes | Library > Settings > Certificate | Optional independent settings card, no ports | Certificate Inspector writes `config.certificate` |
| `certificate_providers[]` | no | yes | Library > Resources, target `1.14 testing` | Resource node/list, no traffic flow | Certificate Provider Inspector |
| `http_clients[]` | no | yes | Library > Resources, target `1.14 testing` | Resource node/list, referenced by route/rule-set/providers | HTTP Client Inspector |
| `endpoints[]` | yes | yes | Library > Endpoint | Chain/resource node | Endpoint Inspector; embeds Dial/TLS/etc. by type |
| `inbounds[]` | yes | yes | Library > Inbound | Traffic source node | Inbound Inspector; embeds Listen/TLS/etc. by type |
| `outbounds[]` | yes | yes | Library > Outbound | Traffic target/group node | Outbound Inspector; embeds Dial/TLS/Mux/Transport/etc. |
| `route` | yes | yes | Template/import, Route Library helper | Route hub node | Route Inspector + Route Rules table |
| `services[]` | yes | yes | Library > Service | Service resource card/list | Service Inspector; embeds TLS/Dial by type |
| `experimental` | yes | yes | Library > Settings > Experimental | Optional independent settings card, no ports | Experimental Inspector subforms |

## Shared Field Ownership Decisions

These docs were read specifically to prevent the Library from treating shared field groups as standalone nodes.

| Shared doc | Channel | Field shape | Correct owner | Add behavior | Implementation note |
| --- | --- | --- | --- | --- | --- |
| `shared/listen.md` | stable+testing | `listen`, `listen_port`, bind/reuse/netns/TCP/UDP/deprecated sniff fields | Inbound types that listen | `INSPECTOR` only | Do not create a Listen node; expose as "Listen Fields" section in inbound Inspector |
| `shared/dial.md` | stable+testing | detour, bind addresses, netns, timeout, TCP, `domain_resolver`, network strategy | Outbound, Endpoint, NTP, DNS server detour/dialing parents | `INSPECTOR` only | `detour` is a tag ref; canvas edge can visualize it, but Inspector/domain command owns the field |
| `shared/tls.md` | stable+testing | inbound server TLS, outbound client TLS, ECH, Reality, uTLS, certificate provider refs | Inbound/Outbound/Endpoint/Service protocol parents | `INSPECTOR` only | Testing adds provider-oriented fields; certificate provider ref must be target-gated |
| `shared/multiplex.md` | stable+testing | inbound/outbound mux fields plus TCP Brutal subform | Protocol parents that support multiplex | `INSPECTOR` only | Outbound/endpoint Inspector subform; no mux node |
| `shared/v2ray-transport.md` | stable+testing | transport `type`: http/ws/quic/grpc/httpupgrade plus type fields | VMess/VLESS/Trojan/Shadowsocks protocol parents | `INSPECTOR` only | Type switcher inside protocol Inspector |
| `shared/udp-over-tcp.md` | stable+testing | boolean or object with `enabled`, `version` | SOCKS/Shadowsocks/Naive/TUIC compatible parents | `INSPECTOR` only | Inline protocol field; no UoT node |
| `shared/tcp-brutal.md` | stable+testing | `enabled`, `up_mbps`, `down_mbps` | Multiplex/transport parents that expose Brutal | `INSPECTOR` only | Nested subform under mux/transport |
| `shared/pre-match.md` | stable+testing | behavior doc for route pre-match actions | Route Rule action editor | `TABLE`/`INSPECTOR` | Not a field group node; informs which actions are legal before connection establishment |
| `shared/wifi-state.md` | stable+testing | platform behavior for `wifi_ssid`, `wifi_bssid` rule fields | Route/DNS rule tables | `TABLE`/`INSPECTOR` | Rule matcher fields with platform hints |
| `shared/dns01_challenge.md` | stable+testing | provider-specific DNS01 challenge object | ACME certificate provider / TLS ACME | `INSPECTOR` only | Subform under ACME provider/challenge |
| `shared/http-client.md` | testing-only | string tag ref or object; top-level `http_clients[]` | HTTP Client resource, route default, rule-set, certificate providers | `GATED` resource + `INSPECTOR` embedded object | Stable target must not emit top-level `http_clients[]` unless binary proves support |
| `shared/http2.md` | testing-only | HTTP2 flow-control/keepalive fields | HTTP Client `version=2` | `INSPECTOR` only | Testing-only nested section |
| `shared/quic.md` | testing-only | QUIC packet/PMTU plus HTTP2 fields | HTTP Client `version=3` / QUIC parents | `INSPECTOR` only | Testing-only nested section |
| `shared/neighbor.md` | testing-only | behavior for `source_mac_address`, `source_hostname`, `route.find_neighbor`, local DNS neighbor domain | Route/DNS rules, Route settings, Local DNS server | `TABLE`/`INSPECTOR` | Testing-only; never an addable node |
| `shared/certificate-provider/index.md` | testing-only | top-level `certificate_providers[]` base with `type`, `tag` | Certificate Provider resource | `GATED` resource | Addable only as resource when target is `1.14 testing` |
| `shared/certificate-provider/acme.md` | testing-only | ACME provider fields, DNS01 challenge, `http_client` | Certificate Provider resource type | `GATED` resource type | Requires provider Inspector and fixture |
| `shared/certificate-provider/tailscale.md` | testing-only | `endpoint` ref | Certificate Provider resource type | `GATED` resource type | Endpoint tag picker; visual edge can show reference |
| `shared/certificate-provider/cloudflare-origin-ca.md` | testing-only | Cloudflare Origin CA fields, `http_client` | Certificate Provider resource type | `GATED` resource type | HTTP client ref picker |

## Ordered Object Decisions

| Ordered area | Source docs | Ordering owner | Canvas behavior | Add behavior |
| --- | --- | --- | --- | --- |
| `route.rules[]` | `route/rule.md`, `route/rule_action.md`, `shared/pre-match.md`, `shared/wifi-state.md`, `shared/neighbor.md` | Route Rules table | May show compact rule nodes and edges to outbounds, but order stays in table | `TABLE`: add rule row, then optional visual node |
| `dns.rules[]` | `dns/rule.md`, `dns/rule_action.md`, `shared/wifi-state.md`, `shared/neighbor.md` | DNS Rules table | May show compact DNS rule nodes and edges to DNS servers, but order stays in table | `TABLE`: add rule row, then optional visual node |
| `route.rule_set[]` / rule-set files | `rule-set/index.md`, `rule-set/source-format.md`, `rule-set/headless-rule.md`, `rule-set/adguard.md` | Rule Set resource editor | Resource node/list if referenced | `TABLE`/resource editor |
| Selector candidates | `outbound/selector.md` | `outbounds[]` order inside selector object | Edges visualize member refs | Add/remove via selector Inspector or compatible port |
| URLTest candidates | `outbound/urltest.md` | `outbounds[]` order inside urltest object | Edges visualize member refs | Add/remove via urltest Inspector or compatible port |

## Release Readiness Gate

An entry is not release-ready until all items below exist and are linked back to this matrix:

1. Domain type shape for the exact stable/testing target.
2. Domain command for create/update/delete/reference rewrite.
3. Inspector schema or table schema.
4. Import round-trip test from canonical JSON to graph and back to canonical JSON.
5. Fixture generated from the command path.
6. Correct official CLI validation:
   - `sing-box-stable check` for `1.13 stable` and `1.12 Legacy`.
   - `sing-box-testing check` for `1.14 testing`.
7. E2E path proving the UI badge does what it says.

Until then, the Library must show `DOCS`, `INSPECTOR`, `TABLE`, `GATED`, or `PENDING`; it must not show a misleading add action.

## Implementation Consequences

- `Pending` entries must not silently write JSON. They remain docs-only until this matrix has a matching command, Inspector schema, fixture, and CLI gate.
- Shared docs are not addable nodes unless they define top-level arrays (`http_clients`, `certificate_providers`) or are part of a concrete entity type.
- `route.rules` and `dns.rules` stay table-owned. Canvas rule nodes are visual/edit shortcuts only.
- testing-only docs require target `1.14 testing` and `sing-box-testing check`; stable target must disable or warn.
