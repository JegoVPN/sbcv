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
- Status：0 / 66 `official-read`，65 / 66 `ui-verified`（覆盖全部 inbound / outbound / dns-server / endpoint / service / rule-set / hub / rule / settings except `settings:log`），1 / 66 `implemented`（`settings:log`，2026-05-27）。Shared atomics（共享字段表、JsonField 兜底、结构化 users / peers / hosts / CCM/OCM / realm 编辑器、TLS 默认 scaffold、敏感字段 mask、action-gated rule sub-forms、平台 / channel / build-tag banner、domain_resolver select、cache_file 1.13/1.14、Clash API external_ui、outbound enum select、route/dns hub 顶层字段、selector default cascade、vmess/vless/tuic 凭证诊断、rule-set/dns-server 诊断）已经全部 ship。每个节点剩余的专属 P0/P1 仍在各自 review doc 顶部 header 追踪。
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
   - `tlsSharedFields`：**FIXED 2026-05-27** — 现已新增服务端 `key` / `key_path` / `certificate`、`client_authentication` select、`certificate_public_key_sha256`、`curve_preferences` / `cipher_suites`、`disable_sni`、`fragment` / `fragment_fallback_delay` / `record_fragment` (1.12+)、uTLS（enabled + fingerprint select，fingerprint 由 enabled gated）、Reality 客户端 + 服务端（enabled / public_key / short_id / handshake.server / handshake.server_port / private_key / max_time_difference，子字段由 enabled gated）、ECH（enabled / config / config_path / query_server_name，子字段由 enabled gated）。`SharedFieldDefinition.gatedBy` 路径检查使 sub-fields 仅在 parent enable 为真时显示。`diagnostics.ts` 同步新增 `reality-public-key-missing` / `reality-short-id-missing` / `reality-short-id-invalid` / `reality-private-key-missing` / `reality-handshake-server-missing`。**待办**：`acme` 嵌套对象（要做成独立的 SharedFieldCard 或 entityType-aware 渲染）。

3. **Required 字段被埋进 Advanced fields**：`server` / `server_port` / `uuid` / `password` / `method` 在多数 outbound（http / socks / shadowsocks / vmess / trojan / naive / hysteria / hysteria2 / tuic / vless / anytls / ssh）只能通过折叠区进入。修复需要为每个 outbound 添加 entityType 专属渲染块，并把字段名加入 `outboundHandledFields`。

4. **enum 字段用 raw text input**：**部分 FIXED 2026-05-27** — Outbound 主区域现在为所有 entityType 渲染 `network` select (tcp / udp / both)，并按 protocol 加专属 enum：shadowsocks `method` select（含 2022-blake3 / AEAD / legacy 三 optgroup）、`plugin` select（obfs-local / v2ray-plugin + 条件 `plugin_opts`）、vmess `security`、vless `flow`、tuic `congestion_control`、socks `version`、vmess/vless `packet_encoding`（packetaddr / xudp / disabled）、tun `stack`（system / gvisor / mixed）。所有字段名加入 `outboundHandledFields` / `inboundHandledFields` 避免 AdvancedScalarFields 双渲染。**待办**：inbound 侧的 mixed/socks/http 用户名密码已通过 INBOUND_USER_SCHEMAS 一次性 handled、`default_mode`（clash_api）、`udp_relay_mode`（tuic）、`udp_over_stream`（tuic）、hysteria2 obfs.type、shadowtls version select 等。

5. **默认 scaffold 缺 required TLS**：**FIXED 2026-05-27** — `commands.ts` 现在为 trojan / naive / hysteria / hysteria2 / tuic / anytls / vless inbound、trojan / naive / hysteria / hysteria2 / tuic / anytls / shadowtls / vless outbound 播种 `tls: { enabled: true, server_name: "" }`；shadowtls inbound 额外播种 `handshake: { server: "google.com", server_port: 443 }` 并移除 v2-only `password`。Outstanding: vmess inbound/outbound 不强制 TLS（按官方推荐保持可选），不在本批改动；Reality / ACME / ECH 嵌套对象由后续 atomic 引入结构化编辑。

6. **`domain_resolver` 应是 dns-server tag select**：**FIXED 2026-05-27** — Inspector dial 字段表（含 route hub 的 `default_domain_resolver`）现在使用 `<select>`，options 来自 `config.dns.servers[].tag` 加空 "None"。`diagnostics.ts` 新增 `outbound-domain-without-resolver` 和 `dns-server-domain-without-resolver` 两条 warning，当 outbound/dns-server 的 server 像域名（含字母、不是 IPv4/IPv6）且未填 `domain_resolver` 时触发。**待办**：对象形态的 `domain_resolver`（带 strategy / cache 等子字段）UI 尚未做结构化编辑器，目前依赖 AdvancedNonScalarFields 兜底。

7. **deprecated 字段无 UI 提示**：**部分 FIXED 2026-05-27** — Inspector 为 `outbound:block`、`outbound:hysteria`（v1）渲染 deprecated banner；dial 字段表把 `domain_strategy` 标注为 `(deprecated 1.12+)`。`diagnostics.ts` 新增 `direct-override-deprecated`、`cache-file-store-rdrc-deprecated`、`legacy-fakeip-deprecated`。`PaletteStatus` 新增 `deprecated`，应用到 `block` / `hysteria-out` / `dns-fakeip`（顶层 legacy fakeip），label 显示 "Legacy"，title 显示 "deprecated by sing-box"。**待办**：Clash API `store_*` / `cache_file` / `cache_id`、route `geoip` / `geosite`、rule-set `download_detour`（testing 1.14）；deprecation banner 视觉样式（红/黄）和 Palette 视觉区分由 styles.css 后续 atomic 实装。

8. **testing-only 字段无 channel gate**：**FIXED 2026-05-27** — `diagnostics.ts` 在 channel === "stable" 时新增 warning：`hysteria2-realm-testing-only` / `hysteria2-bbr-profile-testing-only` / `hysteria2-hop-interval-max-testing-only`、`tun-dns-mode-testing-only` / `tun-dns-address-testing-only` / `tun-mac-address-filter-testing-only`、`ssh-cipher-testing-only` / `ssh-mac-testing-only` / `ssh-kex-algorithm-testing-only`、`dns-server-tailscale-accept-search-domain-testing-only`、`cache-file-store-dns-testing-only`、`route-find-neighbor-testing-only` / `route-dhcp-lease-files-testing-only` / `route-default-http-client-testing-only`、`dns-rule-{source-mac-address,source-hostname,preferred-by,match-response,package-name-regex}-testing-only`。整节点门控的 `service:hysteria-realm` 已经渲染 `<PlatformBanner kind="channel">`。Anytls 节点是 1.12.0 stable，无需 testing gate。

9. **平台限制 UI 不显式**：**FIXED 2026-05-27** — Inspector 现在为 `inbound:redirect`（Linux）、`inbound:tproxy`（Linux）、`inbound:tun`（多平台敏感）、`outbound:tor`（build tag）、`outbound:block`（deprecated）、`outbound:hysteria`（v1 deprecation）、`experimental.v2ray_api`（build tag）、`service:resolved` + `dns-server:resolved`（Linux/systemd）、`service:hysteria-realm`（1.14 testing channel）、`endpoint:tailscale` + `dns-server:tailscale` + `service:derp`（with_tailscale build tag）渲染 `<PlatformBanner>`，分 platform / build-tag / deprecated / channel 四种语义颜色。**待办**：Palette badge / icon 反映 gate（视觉层增强）、跨 channel 切换时的诊断仍依赖 `validateConfig(channel)`。

10. **规则节点 vs 表格语义**：`route-rule` / `dns-rule` 节点在画布上仍像普通节点；但 source-of-truth 是 `RuleTables.tsx` 的 `moveRouteRule` / `moveDnsRule`。`route-rule` Inspector 还在所有 action 上无条件展示 outbound select 和 outbound 输出 port（`reject` / `hijack-dns` / `sniff` / `route-options` / `resolve` 不该有 outbound）。`dns-rule-action` 是个 Palette 幽灵 kind（无 canvas、无 Inspector、无 JSON），应删除。

11. **节点命名不一致**：`kind: "mixed"`（其它 inbound 都是 `inbound-*`）、`kind: "dns-http3"`（应叫 `dns-h3` 与官方 type 对齐）、`kind: "hysteria-out"` / `"shadowtls-out"` / `"hysteria2-out"`（其它 outbound 是 `outbound-*`）。本身能跑，但任何按命名约定过滤的代码会失效。

12. **Singleton 没有 idempotency guard**：**FIXED 2026-05-27** — Palette 新增 `open` status；当 `config.log` / `config.ntp` / `config.certificate` / `config.experimental` / `config.route` / `config.dns` 非空时，对应 Library 按钮显示 "Open" 而非 "Add" / "Setup"，title 提示 "<label> already exists — click to open the Inspector"，点击会同时调用幂等的 `createFromPalette` + `setSelectedId` 跳转到 Inspector。

13. **canvas `+` 加号在 `compatible: []` 时仍渲染但不工作**：**FIXED 2026-05-27** — `SbcNode.tsx` 现在仅在 `data.compatible.length > 0` 时渲染 `+` 按钮，settings / hub / 无下游的 service 节点不再渲染失效的按钮。

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
