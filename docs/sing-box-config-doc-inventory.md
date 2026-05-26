# sing-box 配置文档入口清单

本清单来自 sing-box 官方 Configuration 导航和 `#fields` 顶层字段，用于约束 SBC 的 schema registry、node registry、Inspector 表单和 fixture 覆盖。

要求：

- 每个配置模块、协议表单、共享字段表单都必须能追溯到本清单中的文档入口。
- stable 是默认校验通道；testing 是前瞻通道。
- 如果 stable / testing / 官方站点之间存在差异，最终以目标通道对应的 `sing-box check` 结果为准。
- 清单中的 URL 使用官方文档站点；实现时还必须对照 SagerNet/sing-box `stable` 和 `testing` 分支下的 `docs/configuration` 源文件。

## 顶层字段

| Key | Format | 官方入口 | SBC 表达方式 |
| --- | --- | --- | --- |
| `log` | Log | https://sing-box.sagernet.org/configuration/log/ | 独立 Settings 节点 + Inspector |
| `dns` | DNS | https://sing-box.sagernet.org/configuration/dns/ | DNS Hub 节点 + DNS 表格 |
| `ntp` | NTP | https://sing-box.sagernet.org/configuration/ntp/ | 独立 Settings 节点 + Inspector |
| `certificate` | Certificate | https://sing-box.sagernet.org/configuration/certificate/ | 独立 Settings 节点 + Inspector |
| `certificate_providers` | Certificate Provider | https://sing-box.sagernet.org/configuration/shared/certificate-provider/ | 资源列表/节点 |
| `http_clients` | HTTP Client | https://sing-box.sagernet.org/configuration/shared/http-client/ | 资源列表/节点 |
| `endpoints` | Endpoint | https://sing-box.sagernet.org/configuration/endpoint/ | Endpoint 节点 |
| `inbounds` | Inbound | https://sing-box.sagernet.org/configuration/inbound/ | Inbound 节点 |
| `outbounds` | Outbound | https://sing-box.sagernet.org/configuration/outbound/ | Outbound 节点 |
| `route` | Route | https://sing-box.sagernet.org/configuration/route/ | Route Hub 节点 + Route Rules 表 |
| `services` | Service | https://sing-box.sagernet.org/configuration/service/ | Service 列表/节点 |
| `experimental` | Experimental | https://sing-box.sagernet.org/configuration/experimental/ | 独立 Settings 节点 + Inspector |

## DNS

| Entry | 官方入口 | SBC 表达方式 |
| --- | --- | --- |
| DNS | https://sing-box.sagernet.org/configuration/dns/ | DNS Hub |
| DNS Server | https://sing-box.sagernet.org/configuration/dns/server/ | DNS Server 节点基类 |
| DNS Server / Legacy | https://sing-box.sagernet.org/configuration/dns/server/legacy/ | DNS Server 类型 |
| DNS Server / Local | https://sing-box.sagernet.org/configuration/dns/server/local/ | DNS Server 类型 |
| DNS Server / Hosts | https://sing-box.sagernet.org/configuration/dns/server/hosts/ | DNS Server 类型 |
| DNS Server / TCP | https://sing-box.sagernet.org/configuration/dns/server/tcp/ | DNS Server 类型 |
| DNS Server / UDP | https://sing-box.sagernet.org/configuration/dns/server/udp/ | DNS Server 类型 |
| DNS Server / TLS | https://sing-box.sagernet.org/configuration/dns/server/tls/ | DNS Server 类型 |
| DNS Server / QUIC | https://sing-box.sagernet.org/configuration/dns/server/quic/ | DNS Server 类型 |
| DNS Server / HTTPS | https://sing-box.sagernet.org/configuration/dns/server/https/ | DNS Server 类型 |
| DNS Server / HTTP3 | https://sing-box.sagernet.org/configuration/dns/server/http3/ | DNS Server 类型 |
| DNS Server / DHCP | https://sing-box.sagernet.org/configuration/dns/server/dhcp/ | DNS Server 类型 |
| DNS Server / mDNS | https://sing-box.sagernet.org/configuration/dns/server/mdns/ | DNS Server 类型 |
| DNS Server / FakeIP | https://sing-box.sagernet.org/configuration/dns/server/fakeip/ | DNS Server 类型 |
| DNS Server / Tailscale | https://sing-box.sagernet.org/configuration/dns/server/tailscale/ | DNS Server 类型 |
| DNS Server / Resolved | https://sing-box.sagernet.org/configuration/dns/server/resolved/ | DNS Server 类型 |
| DNS Rule | https://sing-box.sagernet.org/configuration/dns/rule/ | DNS Rules 表 |
| DNS Rule Action | https://sing-box.sagernet.org/configuration/dns/rule_action/ | DNS Rule action editor |
| DNS FakeIP | https://sing-box.sagernet.org/configuration/dns/fakeip/ | DNS / FakeIP 子表单 |

## Route

| Entry | 官方入口 | SBC 表达方式 |
| --- | --- | --- |
| Route | https://sing-box.sagernet.org/configuration/route/ | Route Hub |
| GeoIP | https://sing-box.sagernet.org/configuration/route/geoip/ | Deprecated/version warning |
| Geosite | https://sing-box.sagernet.org/configuration/route/geosite/ | Deprecated/version warning |
| Route Rule | https://sing-box.sagernet.org/configuration/route/rule/ | Route Rules 表 |
| Rule Action | https://sing-box.sagernet.org/configuration/route/rule_action/ | Route Rule action editor |
| Protocol Sniff | https://sing-box.sagernet.org/configuration/route/sniff/ | Inbound/Route shared options |

## Rule Set

| Entry | 官方入口 | SBC 表达方式 |
| --- | --- | --- |
| Rule Set | https://sing-box.sagernet.org/configuration/rule-set/ | Rule Set 资源列表/节点 |
| Source Format | https://sing-box.sagernet.org/configuration/rule-set/source-format/ | Rule Set source editor |
| Headless Rule | https://sing-box.sagernet.org/configuration/rule-set/headless-rule/ | Rule Set rule editor |
| AdGuard DNS Filer | https://sing-box.sagernet.org/configuration/rule-set/adguard/ | Rule Set source type |

## Experimental

| Entry | 官方入口 | SBC 表达方式 |
| --- | --- | --- |
| Experimental | https://sing-box.sagernet.org/configuration/experimental/ | 独立 Settings 节点 + 折叠模块卡片 |
| Cache File | https://sing-box.sagernet.org/configuration/experimental/cache-file/ | Experimental 模块卡片 |
| Clash API | https://sing-box.sagernet.org/configuration/experimental/clash-api/ | Experimental 模块卡片 |
| V2Ray API | https://sing-box.sagernet.org/configuration/experimental/v2ray-api/ | Experimental 模块卡片 |

## Shared

共享配置通常不会单独生成画布节点，但会驱动多个 Inspector 子表单和 schema 片段。Shared 条目分成三类：

- **嵌入字段族**：不能直接添加到画布，必须在所属节点 Inspector 中编辑。
- **资源对象**：有顶层数组或可被其它对象引用，可以做独立资源节点/资源表。
- **版本门控字段**：stable/testing 文档差异明显，必须通过目标通道 binary 校验后再标记 ready。

| Entry | 官方入口 | SBC 表达方式 |
| --- | --- | --- |
| Listen Fields | https://sing-box.sagernet.org/configuration/shared/listen/ | Inbound Inspector 嵌入字段族 |
| Dial Fields | https://sing-box.sagernet.org/configuration/shared/dial/ | Outbound、Endpoint、NTP、Route、Rule Set、DNS Server detour Inspector 嵌入字段族 |
| TLS | https://sing-box.sagernet.org/configuration/shared/tls/ | Inbound/Outbound/TLS-capable DNS Server/Service/HTTP Client TLS 子表单 |
| HTTP Client | https://sing-box.sagernet.org/configuration/shared/http-client/ | `http_clients[]` 资源对象；testing ready、stable gated |
| HTTP2 Fields | https://sing-box.sagernet.org/configuration/shared/http2/ | HTTP/TLS 子表单字段族 |
| QUIC Fields | https://sing-box.sagernet.org/configuration/shared/quic/ | QUIC/Hysteria/TUIC 子表单字段族 |
| Certificate Provider | https://sing-box.sagernet.org/configuration/shared/certificate-provider/ | `certificate_providers[]` 资源对象；testing/stable gated |
| Certificate Provider / ACME | https://sing-box.sagernet.org/configuration/shared/certificate-provider/acme/ | Certificate Provider 类型 |
| Certificate Provider / Tailscale | https://sing-box.sagernet.org/configuration/shared/certificate-provider/tailscale/ | Certificate Provider 类型 |
| Certificate Provider / Cloudflare Origin CA | https://sing-box.sagernet.org/configuration/shared/certificate-provider/cloudflare-origin-ca/ | Certificate Provider 类型 |
| DNS01 Challenge Fields | https://sing-box.sagernet.org/configuration/shared/dns01_challenge/ | ACME Provider 子表单字段族 |
| Pre-match | https://sing-box.sagernet.org/configuration/shared/pre-match/ | Route Rule action 子表单 |
| Multiplex | https://sing-box.sagernet.org/configuration/shared/multiplex/ | Outbound/Endpoint Inspector 嵌入字段族 |
| V2Ray Transport | https://sing-box.sagernet.org/configuration/shared/v2ray-transport/ | VMess/VLESS/Trojan 等协议子表单 |
| UDP over TCP | https://sing-box.sagernet.org/configuration/shared/udp-over-tcp/ | Outbound/Inbound 协议子表单字段族 |
| TCP Brutal | https://sing-box.sagernet.org/configuration/shared/tcp-brutal/ | Outbound/Endpoint 传输子表单字段族 |
| Wi-Fi State | https://sing-box.sagernet.org/configuration/shared/wifi-state/ | Route Rule / DNS Rule 条件字段族 |
| Neighbor Resolution | https://sing-box.sagernet.org/configuration/shared/neighbor/ | Route/DNS rule 或 testing route 邻居解析字段族 |

## Endpoint

| Entry | 官方入口 | SBC 表达方式 |
| --- | --- | --- |
| Endpoint | https://sing-box.sagernet.org/configuration/endpoint/ | Endpoint 节点基类 |
| WireGuard | https://sing-box.sagernet.org/configuration/endpoint/wireguard/ | Endpoint 类型 |
| Tailscale | https://sing-box.sagernet.org/configuration/endpoint/tailscale/ | Endpoint 类型 |

## Inbound

| Entry | 官方入口 | SBC 表达方式 |
| --- | --- | --- |
| Inbound | https://sing-box.sagernet.org/configuration/inbound/ | Inbound 节点基类 |
| Direct | https://sing-box.sagernet.org/configuration/inbound/direct/ | Inbound 类型 |
| Mixed | https://sing-box.sagernet.org/configuration/inbound/mixed/ | Inbound 类型 |
| SOCKS | https://sing-box.sagernet.org/configuration/inbound/socks/ | Inbound 类型 |
| HTTP | https://sing-box.sagernet.org/configuration/inbound/http/ | Inbound 类型 |
| Shadowsocks | https://sing-box.sagernet.org/configuration/inbound/shadowsocks/ | Inbound 类型 |
| VMess | https://sing-box.sagernet.org/configuration/inbound/vmess/ | Inbound 类型 |
| Trojan | https://sing-box.sagernet.org/configuration/inbound/trojan/ | Inbound 类型 |
| Naive | https://sing-box.sagernet.org/configuration/inbound/naive/ | Inbound 类型 |
| Hysteria | https://sing-box.sagernet.org/configuration/inbound/hysteria/ | Inbound 类型 |
| ShadowTLS | https://sing-box.sagernet.org/configuration/inbound/shadowtls/ | Inbound 类型 |
| VLESS | https://sing-box.sagernet.org/configuration/inbound/vless/ | Inbound 类型 |
| TUIC | https://sing-box.sagernet.org/configuration/inbound/tuic/ | Inbound 类型 |
| Hysteria2 | https://sing-box.sagernet.org/configuration/inbound/hysteria2/ | Inbound 类型 |
| AnyTLS | https://sing-box.sagernet.org/configuration/inbound/anytls/ | Inbound 类型 |
| Tun | https://sing-box.sagernet.org/configuration/inbound/tun/ | Inbound 类型 |
| Redirect | https://sing-box.sagernet.org/configuration/inbound/redirect/ | Inbound 类型 |
| TProxy | https://sing-box.sagernet.org/configuration/inbound/tproxy/ | Inbound 类型 |
| Cloudflared | https://sing-box.sagernet.org/configuration/inbound/cloudflared/ | Inbound 类型 |

## Outbound

| Entry | 官方入口 | SBC 表达方式 |
| --- | --- | --- |
| Outbound | https://sing-box.sagernet.org/configuration/outbound/ | Outbound 节点基类 |
| Direct | https://sing-box.sagernet.org/configuration/outbound/direct/ | Outbound 类型 |
| Block | https://sing-box.sagernet.org/configuration/outbound/block/ | Outbound 类型 |
| SOCKS | https://sing-box.sagernet.org/configuration/outbound/socks/ | Outbound 类型 |
| HTTP | https://sing-box.sagernet.org/configuration/outbound/http/ | Outbound 类型 |
| Shadowsocks | https://sing-box.sagernet.org/configuration/outbound/shadowsocks/ | Outbound 类型 |
| VMess | https://sing-box.sagernet.org/configuration/outbound/vmess/ | Outbound 类型 |
| Trojan | https://sing-box.sagernet.org/configuration/outbound/trojan/ | Outbound 类型 |
| Naive | https://sing-box.sagernet.org/configuration/outbound/naive/ | Outbound 类型 |
| WireGuard | https://sing-box.sagernet.org/configuration/outbound/wireguard/ | Outbound 类型 |
| Hysteria | https://sing-box.sagernet.org/configuration/outbound/hysteria/ | Outbound 类型 |
| ShadowTLS | https://sing-box.sagernet.org/configuration/outbound/shadowtls/ | Outbound 类型 |
| VLESS | https://sing-box.sagernet.org/configuration/outbound/vless/ | Outbound 类型 |
| TUIC | https://sing-box.sagernet.org/configuration/outbound/tuic/ | Outbound 类型 |
| Hysteria2 | https://sing-box.sagernet.org/configuration/outbound/hysteria2/ | Outbound 类型 |
| AnyTLS | https://sing-box.sagernet.org/configuration/outbound/anytls/ | Outbound 类型 |
| Tor | https://sing-box.sagernet.org/configuration/outbound/tor/ | Outbound 类型 |
| SSH | https://sing-box.sagernet.org/configuration/outbound/ssh/ | Outbound 类型 |
| DNS | https://sing-box.sagernet.org/configuration/outbound/dns/ | Outbound 类型 |
| Selector | https://sing-box.sagernet.org/configuration/outbound/selector/ | Selector group 节点 |
| URLTest | https://sing-box.sagernet.org/configuration/outbound/urltest/ | URLTest group 节点 |

## Service

| Entry | 官方入口 | SBC 表达方式 |
| --- | --- | --- |
| Service | https://sing-box.sagernet.org/configuration/service/ | Service 节点/列表基类 |
| DERP | https://sing-box.sagernet.org/configuration/service/derp/ | Service 类型 |
| Resolved | https://sing-box.sagernet.org/configuration/service/resolved/ | Service 类型 |
| SSM API | https://sing-box.sagernet.org/configuration/service/ssm-api/ | Service 类型 |
| CCM | https://sing-box.sagernet.org/configuration/service/ccm/ | Service 类型 |
| OCM | https://sing-box.sagernet.org/configuration/service/ocm/ | Service 类型 |
| Hysteria Realm | https://sing-box.sagernet.org/configuration/service/hysteria-realm/ | Service 类型 |

## Source 分支入口

| Source | URL |
| --- | --- |
| official configuration fields | https://sing-box.sagernet.org/configuration/#fields |
| official configuration navigation | https://sing-box.sagernet.org/configuration/ |
| stable configuration docs | https://github.com/SagerNet/sing-box/tree/stable/docs/configuration |
| testing configuration docs | https://github.com/SagerNet/sing-box/tree/testing/docs/configuration |

## Release-Critical Field Traceability

These fields are used by the first release template, fixtures, Inspector, and E2E path. Stable fields must pass `sing-box-stable check`; testing-only fields must pass `sing-box-testing check`.

| Config path / field | Official entry | SBC usage |
| --- | --- | --- |
| `inbounds[].type`, `inbounds[].tag` | https://sing-box.sagernet.org/configuration/inbound/ | Inbound node identity |
| `inbounds[type=tun].address`, `auto_route` | https://sing-box.sagernet.org/configuration/inbound/tun/ | TUN node stable template and Inspector |
| removed legacy `inbounds[].sniff` | https://sing-box.sagernet.org/configuration/shared/listen/ | Not emitted in stable templates; sniff belongs in route rule actions for 1.13+ |
| `dns.servers[type=local].tag` | https://sing-box.sagernet.org/configuration/dns/server/local/ | Local DNS Server node |
| `dns.servers[type=https].server`, `server_port`, `path` | https://sing-box.sagernet.org/configuration/dns/server/https/ | Remote DoH DNS Server node and Inspector |
| `dns.servers[].detour` | https://sing-box.sagernet.org/configuration/shared/dial/ | DNS server outbound detour reference |
| `dns.rules[].domain_suffix`, `server` | https://sing-box.sagernet.org/configuration/dns/rule/ | DNS Rules ordered table |
| `dns.final` | https://sing-box.sagernet.org/configuration/dns/ | DNS Hub final server reference |
| `outbounds[type=direct]` | https://sing-box.sagernet.org/configuration/outbound/direct/ | Direct outbound node |
| `outbounds[type=block]` | https://sing-box.sagernet.org/configuration/outbound/block/ | Block outbound node |
| `outbounds[type=socks].server`, `server_port` | https://sing-box.sagernet.org/configuration/outbound/socks/ | Proxy placeholder outbound node and Inspector |
| `outbounds[type=selector].outbounds`, `default` | https://sing-box.sagernet.org/configuration/outbound/selector/ | Selector group node candidate references |
| `outbounds[type=urltest].outbounds`, `url`, `interval` | https://sing-box.sagernet.org/configuration/outbound/urltest/ | URLTest group node candidate references |
| `route.rules[].domain_suffix`, `domain_keyword`, `outbound` | https://sing-box.sagernet.org/configuration/route/rule/ | Route Rules ordered table |
| `route.final`, `auto_detect_interface`, `default_domain_resolver` | https://sing-box.sagernet.org/configuration/route/ | Route Hub node and stable template |
| `http_clients[].tag`, `engine` | https://sing-box.sagernet.org/configuration/shared/http-client/ | testing channel fixture only |
