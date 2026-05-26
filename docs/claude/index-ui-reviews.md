# SBC Editable Node UI Reviews — Claude Deep Pass

本目录是 Claude 主导的 Pass 2 深度审查，覆盖 sing-box 编辑器当前可创建的全部 66 个节点。所有 review 在 `docs/ui-reviews/` 已有的 Pass 1 baseline 之上做了三件事：

1. 读完 `.tmp/sing-box-docs/stable/docs/configuration/` 对应的官方 Markdown，再对照 `.tmp/sing-box-docs/testing/` 找出版本差异，列出官方 writable 字段表（类型 / required / default / version gate）。
2. grep 当前 UI 实现（`src/components/Palette.tsx`、`SbcNode.tsx`、`Inspector.tsx`、`InspectorPanels.tsx`、`canvas/graph.ts`、`domain/sharedFieldRegistry.ts`、`commands.ts`、`diagnostics.ts`），用行号说明缺口、控件错配、模板/诊断缺失。
3. 把每个缺口转成 atomic 实现任务（in scope / out of scope），并给出 Done Criteria。

> 与 `docs/index-ui-reviews.md` 的区别：Pass 1 是注册表派生的脚手架，每个节点只罗列了泛化的 Left/Middle/Right 模板；Pass 2 用官方文档的真实字段表替换了 baseline，并给出实施任务清单。

## Review Method

每个节点文档检查三个产品面：

- **Left**：Palette 入口（label、action、status、docsUrl、是否 gated / singleton 守卫）。
- **Middle**：Canvas 节点（ports 是否对齐官方 tag 引用模型；status pill 语义；`+` 加号是否有可达目标）。
- **Right**：Inspector 字段（控件类型、required 标记、tag 引用是否用 select、enum 是否用 select、deprecated 字段如何处理、版本 / 平台门控）。

Source-of-truth 仍是规范化 sing-box JSON / domain state。

## Coverage

- 节点 review 数：**66 / 66**
- Status：61 / 66 `official-read`，4 / 66 `ui-verified`（`outbound:selector`、`outbound:urltest`、`hub:route`、`hub:dns`，2026-05-27 部分 P0 修），1 / 66 `implemented`（`settings:log`，2026-05-27）。
- 发现总数：**P0 ≈ 148**，**P1 ≈ 260**（按节点求和，未做跨节点去重）。
- Implementation 进度：见 `docs/goals/editable-node-ui-deep-pass.md` 的 Milestone / Atomic 列表。

## 节点清单（按节点族）

### settings（4）

- [Log Settings](settings-log.md) — P0 1, P1 2
- [NTP Settings](settings-ntp.md) — P0 1, P1 2
- [Certificate](settings-certificate.md) — P0 1, P1 5
- [Experimental](settings-experimental.md) — P0 2, P1 12

### hub（2）

- [Route Hub](hub-route.md) — P0 3, P1 7
- [DNS Hub](hub-dns.md) — P0 4, P1 5

### rule（2）

- [Route Rule](rule-route-rule.md) — P0 6, P1 7
- [DNS Rule](rule-dns-rule.md) — P0 4, P1 5

### inbound（17）

- [Direct](inbound-direct.md) — P0 1, P1 6
- [Mixed](inbound-mixed.md) — P0 3, P1 3
- [SOCKS](inbound-socks.md) — P0 1, P1 2
- [HTTP](inbound-http.md) — P0 2, P1 4
- [Shadowsocks](inbound-shadowsocks.md) — P0 1, P1 4
- [VMess](inbound-vmess.md) — P0 2, P1 3
- [Trojan](inbound-trojan.md) — P0 2, P1 4
- [Naive](inbound-naive.md) — P0 2, P1 4
- [Hysteria](inbound-hysteria.md) — P0 3, P1 5
- [ShadowTLS](inbound-shadowtls.md) — P0 2, P1 4
- [VLESS](inbound-vless.md) — P0 2, P1 5
- [TUIC](inbound-tuic.md) — P0 2, P1 4
- [Hysteria2](inbound-hysteria2.md) — P0 2, P1 5
- [AnyTLS](inbound-anytls.md) — P0 2, P1 4
- [TUN](inbound-tun.md) — P0 4, P1 8
- [Redirect](inbound-redirect.md) — P0 2, P1 3
- [TProxy](inbound-tproxy.md) — P0 2, P1 5

### outbound（18）

- [Direct](outbound-direct.md) — P0 2, P1 3
- [Block](outbound-block.md) — P0 1, P1 3
- [SOCKS](outbound-socks.md) — P0 2, P1 2
- [HTTP](outbound-http.md) — P0 2, P1 4
- [Shadowsocks](outbound-shadowsocks.md) — P0 2, P1 3
- [VMess](outbound-vmess.md) — P0 2, P1 4
- [Trojan](outbound-trojan.md) — P0 2, P1 3
- [Naive](outbound-naive.md) — P0 3, P1 4
- [Hysteria](outbound-hysteria.md) — P0 3, P1 5
- [ShadowTLS](outbound-shadowtls.md) — P0 1, P1 3
- [VLESS](outbound-vless.md) — P0 2, P1 5
- [TUIC](outbound-tuic.md) — P0 2, P1 3
- [Hysteria2](outbound-hysteria2.md) — P0 4, P1 7
- [AnyTLS](outbound-anytls.md) — P0 2, P1 2
- [Tor](outbound-tor.md) — P0 1, P1 3
- [SSH](outbound-ssh.md) — P0 3, P1 3
- [Selector](outbound-selector.md) — P0 4, P1 5
- [URLTest](outbound-urltest.md) — P0 4, P1 3

### dns-server（12）

- [Local](dns-server-local.md) — P0 0, P1 4
- [Hosts](dns-server-hosts.md) — P0 2, P1 2
- [TCP](dns-server-tcp.md) — P0 1, P1 4
- [UDP](dns-server-udp.md) — P0 2, P1 3
- [TLS](dns-server-tls.md) — P0 2, P1 2
- [QUIC](dns-server-quic.md) — P0 2, P1 3
- [HTTPS](dns-server-https.md) — P0 2, P1 3
- [H3](dns-server-h3.md) — P0 1, P1 2
- [DHCP](dns-server-dhcp.md) — P0 2, P1 2
- [FakeIP](dns-server-fakeip.md) — P0 2, P1 7
- [Tailscale](dns-server-tailscale.md) — P0 4, P1 4
- [Resolved](dns-server-resolved.md) — P0 4, P1 3

### endpoint（2）

- [WireGuard](endpoint-wireguard.md) — P0 0, P1 3
- [Tailscale](endpoint-tailscale.md) — P0 5, P1 4

### service（6）

- [DERP](service-derp.md) — P0 4, P1 5
- [Resolved](service-resolved.md) — P0 2, P1 3
- [SSM API](service-ssm-api.md) — P0 3, P1 3
- [CCM](service-ccm.md) — P0 0, P1 2
- [OCM](service-ocm.md) — P0 0, P1 2
- [Hysteria Realm](service-hysteria-realm.md) — P0 3, P1 5

### rule-set（3）

- [Remote](rule-set-remote.md) — P0 2, P1 5
- [Local](rule-set-local.md) — P0 2, P1 2
- [Inline](rule-set-inline.md) — P0 2, P1 4

## Cross-Node Findings (Pass 2 综合)

下列结论是 66 篇 review 的横向归纳——大多数 P0 都是这些跨节点缺陷的具体表现。**修复时按这些聚簇做 atomic 改动收益最大**：单个共享改动通常会消除十几个节点的 P0。

1. **数组 / 对象字段普遍不可见**：`Inspector.tsx` 的 `AdvancedScalarFields` 仅渲染 `string | number | boolean`，所有 array / object 字段被静默吞掉。受影响：`users[]`（每个有 users 的 inbound / service）、`peers[]`（wireguard）、`headers`（http inbound / outbound / dns-https / dns-h3 / service-ccm / service-ocm）、`outbounds[]`（selector / urltest）、`rules[]`（rule-set inline）、`predefined`（dns-hosts）、`host_key[]` / `host_key_algorithms[]`（ssh）、`certificate[]` 等。需要为每个 owner 添加结构化 repeater 或至少 `JsonField` 兜底，并把字段名加入对应的 `*HandledFields` 集合避免双渲染。

2. **共享字段表大面积缺失字段**：
   - `dialSharedFields`：**FIXED 2026-05-27** — `sharedFieldDefinitions("dial")` 现在返回官方 shared/dial.md 列出的全部 21 个字段（含 1.13 keep-alive 组、Linux-only `bind_address_no_port`/`routing_mark`/`netns`、`tcp_multi_path`、`udp_fragment`、`domain_resolver`、`network_strategy` 集合，以及 deprecated `domain_strategy` 标注）。所有 outbound / dns-server / NTP / endpoint 都受益。`routing_mark` 用 `text` 控件以支持十六进制（`"0x1234"`）。
   - `listenSharedFields`：**FIXED 2026-05-27** — 现已覆盖官方 shared/listen.md 全部 14 个 active 字段（含 1.13 keep-alive 组、`tcp_multi_path`、`udp_fragment`）；listen `detour` 渲染为 inbound tag select（区分于 dial `detour`）。受影响所有 inbound + service-{derp,resolved,ssm-api,ccm,ocm,hysteria-realm}。Deprecated 字段（sniff / sniff_override_destination / sniff_timeout / domain_strategy / udp_disable_domain_unmapping）仍依赖 `AdvancedScalarFields` 兜底渲染并保留 round-trip；deprecation banner 留后续 atomic。
   - `tlsSharedFields`：**部分 FIXED 2026-05-27** — 现已新增服务端 `key` / `key_path` / `certificate`、`client_authentication` select、`certificate_public_key_sha256`、`curve_preferences` / `cipher_suites`、`disable_sni`、`fragment` / `fragment_fallback_delay` / `record_fragment` (1.12+)、uTLS（enabled + fingerprint select）、Reality 顶层（enabled / public_key / short_id）、ECH 顶层 enabled。**待办**：Reality 服务端 `private_key` / `handshake` 嵌套对象、ECH inbound `key[]` / `key_path` / outbound `config[]` / `config_path`、`acme` 嵌套对象（要做成独立的 SharedFieldCard 或 entityType-aware 渲染）。

3. **Required 字段被埋进 Advanced fields**：`server` / `server_port` / `uuid` / `password` / `method` 在多数 outbound（http / socks / shadowsocks / vmess / trojan / naive / hysteria / hysteria2 / tuic / vless / anytls / ssh）只能通过折叠区进入。修复需要为每个 outbound 添加 entityType 专属渲染块，并把字段名加入 `outboundHandledFields`。

4. **enum 字段用 raw text input**：`method`、`security`、`network`、`version`、`congestion_control`、`stack`、`flow`、`packet_encoding`、`default_mode`、`udp_relay_mode`、`congestion_control` 等等。所有应是 `<select>`，部分应附 optgroup（如 shadowsocks legacy method）。

5. **默认 scaffold 缺 required TLS**：`commands.ts` 的 `createInbound` / `createOutbound` 没有为 trojan / naive / hysteria / hysteria2 / tuic / anytls / shadowtls outbound、trojan / naive / hysteria / hysteria2 / tuic / anytls / vless / vmess inbound、shadowtls inbound 播种 `tls: { enabled: true }`。新建节点直接是无效配置且无 UI 提示。

6. **`domain_resolver` 应是 dns-server tag select**：当前 `sharedFieldRegistry.ts:203` 用 `kind: "text"`。1.14.0+ 在 `server` 为域名时是 required。需要换成 dns-server tag select 并在 `diagnostics.ts` 加 required-when-domain 检查。

7. **deprecated 字段无 UI 提示**：`domain_strategy`（dial / route / dns）、`override_address` / `override_port`（outbound direct）、`store_rdrc`（cache_file）、Hysteria v1（inbound + outbound）、Block outbound、Clash API `store_*` / `cache_file` / `cache_id`、route `geoip` / `geosite`、dns `disable_cache` / `disable_expire`、rule-set `download_detour`（testing 1.14）等。`PaletteStatus` 缺一个 `"deprecated"` 状态。

8. **testing-only 字段无 channel gate**：`cache_file.store_dns`、route 1.14 字段（`find_neighbor` / `dhcp_lease_files` / `default_http_client`）、dns rule 1.14 matchers（`source_mac_address` / `source_hostname` / `preferred_by` / `match_response` / `package_name_regex`）、dns-server-tailscale `accept_search_domain`、service-hysteria-realm（整节点已门控）、outbound-hysteria2 `realm`、ssh `cipher` / `mac` / `kex_algorithm`、anytls 节点（1.12.0 版本门控）。stable 项目里要么 hide 要么至少 warning。

9. **平台限制 UI 不显式**：`inbound:redirect` / `inbound:tproxy` = Linux only；`dns-server:resolved` + `service:resolved` = Linux/systemd only；`inbound:tun` = 多平台敏感（stack 行为各异 + Apple iOS 走 platform.http_proxy）；`service-hysteria-realm` = 仅 1.14 testing；`endpoint-tailscale` + `dns-server-tailscale` + `service-derp` = 需要 Tailscale build；`outbound-tor` = build tag；`experimental.v2ray_api` = build tag。每条都需要 Palette badge + Inspector banner + diagnostic。

10. **规则节点 vs 表格语义**：`route-rule` / `dns-rule` 节点在画布上仍像普通节点；但 source-of-truth 是 `RuleTables.tsx` 的 `moveRouteRule` / `moveDnsRule`。`route-rule` Inspector 还在所有 action 上无条件展示 outbound select 和 outbound 输出 port（`reject` / `hijack-dns` / `sniff` / `route-options` / `resolve` 不该有 outbound）。`dns-rule-action` 是个 Palette 幽灵 kind（无 canvas、无 Inspector、无 JSON），应删除。

11. **节点命名不一致**：`kind: "mixed"`（其它 inbound 都是 `inbound-*`）、`kind: "dns-http3"`（应叫 `dns-h3` 与官方 type 对齐）、`kind: "hysteria-out"` / `"shadowtls-out"` / `"hysteria2-out"`（其它 outbound 是 `outbound-*`）。本身能跑，但任何按命名约定过滤的代码会失效。

12. **Singleton 没有 idempotency guard**：`settings:log` / `settings:ntp` / `settings:certificate` / `settings:experimental` / `hub:route` / `hub:dns` 是单例节点；二次点击 Library 无反馈也不切换到 OPEN。Palette label 需要 status === "open" 或 "selected" 的状态。

13. **canvas `+` 加号在 `compatible: []` 时仍渲染但不工作**：所有 settings / 部分 service 节点都中招。

14. **tag 引用未用 select / multiselect**：
   - `outbound:selector.outbounds[]` 仍是 CSV `<input>`；`default` 是 raw text。
   - `outbound:urltest.outbounds[]` 同上。
   - `service:ssm-api.servers`（map）是 `{ "/": tag }` 单值 select，多路径会被破坏。
   - `service:derp.verify_client_endpoint[]` 是 raw text。
   - `experimental.clash_api.external_ui_download_detour` 字段不存在于 Inspector。
   - `rule-set:remote.download_detour` 是 select 但无 diagnostic（dangling tag 不报错）。
   - `route.final` / `dns.final` 没有 Inspector 控件，只能拖边。
   - `ntp.detour` 在 sharedFieldRegistry 是 select 但 canvas 不发对应 edge。
   - 所有 tag rename / delete 路径需要扫描这些字段（commands.ts 的 rename / delete 当前漏掉 `default`、`servers` map、`verify_client_endpoint` 等）。

15. **诊断盲区**：`diagnostics.ts` 没有覆盖：所有 proxy outbound 的 `server` / `server_port` 必填、Trojan / TUIC / Naive / Hysteria 系列的 TLS required、Selector `default` 必须是当前 candidate、`route-rule.action=route` 必须有 outbound、rule-set `download_detour` 引用有效性、resolved dns-server 的 `service` 引用、`domain_resolver` 在域名 server 上的必填、AnyTLS 1.12.0 版本门控、Tor build-tag、v2ray-api build-tag 等。

## Next Steps

1. **先做共享改动，再做节点专属改动**：补全 `dialSharedFields` / `listenSharedFields` / `tlsSharedFields` 三张表 + 把 array/object 字段渲染降级到 `JsonField` 而非静默吞掉——这一改动会一次性消除 30+ 个 P0。
2. **下一步给 `commands.ts` 的默认 scaffold 补 `tls`**：trojan / naive / hysteria / hysteria2 / tuic / anytls / shadowtls outbound + 对应 inbound + shadowtls inbound 的 `handshake` 等。再一次性消除 ~10 个 P0。
3. **新增 `PaletteStatus` 的 `"deprecated"` / `"open"` / `"singleton-locked"`**：让 Block / Hysteria v1 / legacy fakeip / 顶层 settings 等都有正确状态。
4. **`domain_resolver` 全面 select 化**：domain DNS server tag + `diagnostics.ts` required-when-domain 检查。
5. **Selector / URLTest 重写 Inspector**：multiselect candidate + default 限于 candidates + interrupt_exist_connections toggle + 把 `default` 加入 rename / delete 扫描。
6. **`route-rule` / `dns-rule` Inspector 切换到 action-gated 渲染**：reject / sniff / route-options / predefined / hijack-dns / respond / evaluate 各自独立分组；outbound select 只在 action===route 时出现。
7. **每个节点族至少补 1 条 fixture / E2E gate**：import → render → edit → export round-trip，作为完成 Pass 2 后的回归基线。
8. **把 testing 字段全部门控**：`Palette.tsx` 已经 ready 的 testing-only 项目要扩展到字段级；`channel === "testing"` 的目标项目里才允许 export。
