<!-- 2nd re-assessment for the GUI-reachability ≥90% goal, after V0–V10 + M1–M4 + R1/R1b/R2.
     Harness: scripts/workflows/canvas-config-gen-review.workflow.js (69 agents, 40 findings). -->

# Status header — GUI-reachability ≥90% re-assessment #2

- **Date:** 2026-05-30 (after V0-S1/V1/V2-S1/V3/V4(S1-S3)/V5/V6/V9-S1/V7-S1 + M1/M2/M3 + R1/R1b/R2)
- **Overall:** 7.5 / 10. **Pure-GUI reachability ≈ 85%+** (baseline ~60-70% → re-run#1 ~70-80% → now ~85%+).
- **Six dimensions:** coverage **strong**, graph-fidelity **strong**, interaction-completeness **strong** (↑ from adequate), serialization **adequate**, version-targeting **adequate**, architecture **adequate**.

## Progress vs baseline
3 of 6 dimensions rose adequate→**strong**; reachability +~20pts. The validity ceiling (V1/V2/V3/V4) + long-tail editors (V5/V6/V9) + Advanced fallback (M2) + masquerade data-loss (M1) + namespace renameTag (M3) + version-gate severity (M4) all landed.

## Remaining (held the 3 adequate dimensions back) → next-atomic queue (§7.6)
- **G1** validity guarantee = manual `semantic` linter only; binary check optional/excluded → some sing-box-rejected configs can still export. (serialization)
- **G2** 1.14 target: bare-IP / `local` / `fakeip` legacy DNS servers not detected (regex needs `scheme://`) → exportable but 1.14 rejects. (version-targeting) **→ V4-S4**
- **G3** more testing-only fields (`route.default_http_client`, `find_neighbor`/`dhcp_lease_files`, `dns.optimistic`/`timeout`, `rule_set.http_client`) are warning, not error, on incompatible targets. **→ V4-S4**
- **G4** DNS `respond`/`evaluate` (1.14) + several 1.13 dial/TLS fields not gated on stable. **→ V4-S4**
- **G5** double-schema not converged (schemaRegistry enums vs sharedFields ~166 defs); reference position coded 3×; registry `version` markers dead. **→ V10 / M5 (data-driven renderer)**
- **G6** a few exotic structures still raw-JSON: ssm servers map, inline-object http_client, >3-level logical rules, reality.handshake nested dial, hysteria2 object masquerade (now a JSON editor, not a structured union). **→ R5 follow-ups**

DONE-bar (§7) not yet a clean pass: reachability ~85% (target ≥90%), serialization adequate (target strong). Path: close G2/G3/G4 (validity), converge schema (G5/V10). The exotic G6 edges are diminishing-returns long-tail; the binary/official advisory layer (V2-S2) is the robust validity backstop for them.

---

# sbc-ui 终评:JSON 的 workflow 化是否真正实现?

## 1. 总体结论

**直接回答:基本实现了,且实现质量在同类工具里属于上乘——但"纯 GUI 即可生成一份保证被 sing-box 接受的配置"这一更强承诺尚未完全达成。**

- **能否仅靠点击/拖拽/简单编辑生成配置?** 能,且覆盖绝大多数真实配置。每种可创建节点都通过 Palette 点击添加(`Palette.tsx:620` → `createFromPalette` `useProjectStore.ts:834`),跨对象引用通过拖拽端口或端口"+"选择器建立(`CanvasWorkspace.tsx:414` → `createNodeAndConnect`),所有常见字段面在 Inspector 里都有结构化控件。估计纯 GUI 可达性约 **85%+**。
- **是否真正"workflow 化"了 JSON?** 是。架构上 `config` 对象本身就是被编辑、被导出的真相;canvas 是它的纯只读投影(`deriveGraph`,`canvas/graph.ts:248`),不存在脆弱的"图→JSON 重组"。这是该设计最正确的一步。
- **不牢的地方在哪?** 一是少量异形嵌套结构(ssm servers map、inline 对象形 http_client、>3 层 logical 规则、reality.handshake 内嵌 dial)被迫回退原始 JSON;二是更关键的——**导出有效性只由一个手工维护的语义 linter 兜底**,已证实存在漏网,会放行 sing-box 实际会拒绝的配置。

**综合评分:7.5 / 10。** 强基础(单一真相源 + 完整覆盖 + 真实测试网)+ 中等结构债(双 schema 未收敛)+ 可被绕过的有效性保证。

---

## 2. 六个维度评分

| 维度 | 评分 | 一句话判断 |
|---|---|---|
| **Coverage(schema 覆盖)** | **strong** | 63/63 上游实体类型均有 schema 行 + 结构化 Inspector,所有重型共享块与顶层单例可结构化编辑,无任何上游小节真正缺失;残余是少数深嵌引用与已弃用类型。 |
| **Graph Fidelity(图保真度)** | **strong** | 对高频边是命名空间正确的忠实投影,endpoint 正确并入 outbound 命名空间;残余是若干"在级联里但无连线"的 tag-string-only 引用,以及 route.default_domain_resolver 在 hub 端缺边的不对称。 |
| **Interaction Completeness(交互完整度)** | **strong** | 绝大多数真实配置可纯 GUI 完成;强制 JSON 仅限一小撮异形嵌套结构 + 四个版本策略性排除的弃用类型。 |
| **Serialization(序列化正确性)** | **adequate** | 架构正确(config 即产物,往返近乎无损,顺序保留);弱点是有效性"保证"完全依赖手工 linter,已证实有漏网配置能通过导出门。 |
| **Version Targeting(版本目标化)** | **adequate** | 三目标(1.12/1.13/1.14)+ 共享 TYPE_MIN_VERSION + 创建时门控正确;但诊断层有系统性 severity 不一致与若干 1.13/1.14 字段未覆盖,"保证通过 sing-box check"会被打破。 |
| **Architecture(架构合理性)** | **adequate** | 单一真相源 + 纯投影 + 严格分层 + 真实防漂移测试网,异常自律;但 schema 中心化只完成一半,字段面分裂为两套并行系统,引用位置三处重复,版本门控散落且 registry 自带 version 标记为死代码。 |

---

## 3. 设计亮点

节点/边/端口 + registry 这套设计做对的关键点:

1. **`config` 即真相、canvas 即只读投影。** `stringifyConfig` 就是 `JSON.stringify(config, null, 2)`(`serialization.ts:88-90`),`jsonDraft` 每次变更经 `sync()` 从 config 重算(`useProjectStore.ts:211-223`)。`deriveGraph` 只读 config 产出 `{nodes, edges}`,全仓无任何反向写回(grep `fromGraph/graphToConfig/toConfig` 为空)。这消灭了图与 JSON 漂移的可能性,是 workflow 化最核心的正确决策。

2. **引用 = 落在 config 字段上的 tag 字符串,边 = 对它的投影。** 端口由 `(nodeKind, portKey, direction)` 标识,连线合法性由 `relationForHandles` 对 `portRelationRegistry` 解析(`portRelationRegistry.ts:106-153`);每个 PortRelation 绑定一个 `canonicalPath`(JSON 指针),既是读(deriveGraph)也是写(adapter)的单一来源。建边 = 往引用字段写 tag,删边 = 移除该 tag。隐喻自洽,不漏。

3. **命名空间正确。** endpoint 通过 `namespaceForKind` 并入 outbound 命名空间(`indexes.ts:86-88`),`getOutboundTags` 含 endpoint tag(`indexes.ts:101-108`),`outboundTargetNodeId` 把指向 endpoint 的 outbound 引用正确重定向到 `endpoint:<tag>`(`canvas/graph.ts:267-270`)。rename/delete 级联、去重索引、诊断全部走同一三元组,被 23/23 专项测试覆盖。

4. **覆盖面完整。** `SCHEMA_ROWS` 63 行(18 inbound + 20 outbound + 14 dns-server + 2 endpoint + 6 service + 3 rule-set,`schemaRegistry.ts:128-1073`),与上游 testing 通道目录 1:1。`settingsInspector.tsx` 对 log/ntp/certificate/experimental 全部提供结构化编辑器(`settingsInspector.tsx:36-451`)——此前 digest 称这四者"opaque Record" 是错误的。

5. **真实的防漂移测试网 + 严格分层。** `schema-registry` / `protocols-creatable-frozen` / `no-silent-unreachable-fields`(C17)三组守卫真实存在并通过;`src/domain` 对 canvas/components 零 import(`minVersions.ts:4` 注释明示)。导出对 error 级语义诊断硬门控不可绕过(`exportConfig.ts:40-62`)。

---

## 4. 关键差距与风险

### 🔴 Major(影响"导出即合法"的核心承诺)

**G1 · 导出有效性保证完全依赖手工 linter,二进制检查既可选又被排除。**
导出硬门只过滤 `level==="error" && source==="semantic"`(`exportConfig.ts:40-42`)。官方二进制检查诊断带 `source:"official"`,被该过滤显式排除;且 `runOfficialCheck` 在 `VITE_OFFICIAL_CHECK_URL` 未设时直接 `return`(`useProjectStore.ts:1792-1793`),浏览器默认部署里是 no-op。linter 自述"非完整 RFC 解析器"(`diagnostics.ts:26`),无 JSON-schema/整文档结构校验。
→ **建议:** 在未配置二进制检查时,在 Export 处显著提示"仅语义校验";或把明显结构性的 `source:"official"` error 设为可阻断。用真实 config 语料持续测 linter 覆盖率。

**G2 · 1.14 目标下裸 IP / local / fakeip 形式的 legacy DNS server 不被检出。**
removed-in-1.14 检测正则 `/^[a-z0-9+]+:\/\//i` 要求 `scheme://` 前缀(`diagnostics.ts:687`),已实测 `8.8.8.8`(legacy UDP)、`local`(System)、`fakeip` 产生 0 诊断,导出放行而 sing-box 1.14 会拒绝。legacy 工厂本身就产出裸 `address:"8.8.8.8"`(`schemaRegistry.ts:805`)。
→ **建议:** 结构性检测——凡 `dns.servers[]` 含 `address` 且无 typed `type` 即按 legacy 形识别,1.14 目标上升级为 error。

**G3 · testing-only 字段被判为可绕过的 warning,而结构等价者却是 error,导出门控不一致。**
`http_clients`/`certificate_providers` 在 stable 通道是 error(`diagnostics.ts:1579-1596`),但引用同一 1.14 特性的 `route.default_http_client`、`find_neighbor`/`dhcp_lease_files`、`dns.optimistic/timeout`、`rule_set.http_client` 等只是 warning(`diagnostics.ts:1698-1715` 等),仅 `channel==="stable"` 门控、无 version 子分层。sing-box 严格解码器对这些未知字段一律启动即拒,却能绕 confirm 导出。
→ **建议:** 把所有"该目标上的未知字段"门控统一升为 error;warning 仅留给仍被接受的真弃用项(store_rdrc/download_detour 等)。

**G4 · DNS action `respond`/`evaluate`(1.14-only)在 stable 目标上不被门控,且注释误导。**
两者全部处理被包在 `if (atLeast(version,"1.14"))`(`diagnostics.ts:655-680`),stable(1.13/1.12)永不进入;`diagnostics.ts:652-654` 注释声称 stable 已 flag 它们为 testing-only,实为 false。导入或切目标后携 `action:"respond"` 静默导出,sing-box stable 拒绝。
→ **建议:** stable/<1.14 目标上对 `dns.rules[].action ∈ {respond,evaluate}` 报 error;修正误导注释。

**G5 · 若干 1.13 dial/TLS 客户端字段在所有目标上暴露却从不版本门控。**
Inspector 在所有目标渲染 `disable_tcp_keep_alive`/`tcp_keep_alive`/`tcp_keep_alive_interval`/`bind_address_no_port`(1.13)与 `certificate_public_key_sha256`(1.13)(`sharedFields.tsx:147-149,187,194-196,265`),而诊断 1.13 门控只覆盖 `kernel_tx/kernel_rx/curve_preferences/client_authentication`(`diagnostics.ts:870-891`)。1.12 Legacy 目标可选,这些字段过门而 sing-box 1.12 当未知字段拒绝。
→ **建议:** 扩展该门控覆盖上述字段,并以共享 FIELD_MIN_VERSION 表驱动(与 Inspector 的"(1.13+)"标签共用一源)。

**G6 · 字段 schema 分裂为两套并行系统,registry 只集中约 10-25% 字段面。**
`schemaRegistry` 仅 16/63 行带 `fields`,且全在 inbound/outbound(`schemaRegistry.ts:137-697`),且 19 个字段元全是 `type:"enum"`;真正字段主体(dial/tls/multiplex/transport/quic 等 ~166 个定义)在 `sharedFields.tsx:22-45,118-398`,与 registry 零交叉引用。diagnostics 的 enum/type 校验对 dns-server/endpoint/service/rule-set 是"deliberate no-op"(`diagnostics.ts:122-154`)。新增协议仍触及 5-8 个文件。
→ **建议:** 把 SharedFieldDefinition 与 SchemaFieldMeta 视为同一概念收敛——将共享组字段表上移为 domain 声明式数据,供 Inspector/diagnostics/渲染器共同消费。这是面向"GUI 输出即合法"目标的最高杠杆重构(悬空引用正是破坏合法性的元凶)。

**G7 · 引用位置三处(实为五处)重复编码,diagnostics 一侧无 parity 守卫。**
`referenceRegistry` 的 `replaceOutboundRefs`/`removeOutboundRefs` 近重复双 walker(`referenceRegistry.ts:160-228`)+ 每实体 `paths` 数组(`:370-419`);`portRelationRegistry` 的 `canonicalPath`(`:106-153`);`diagnostics` 手写逐点游走(`:230,254,327,339,701` 等)。`registry-parity.test.ts` 只绑定 paths↔canonicalPath,diagnostics 与 walker↔paths 一致性无测试守卫。新增引用点需手动同步多处。
→ **建议:** 引入单一声明式引用目录(kind、from-path、to-namespace、cardinality、shape),三个消费者(级联 walker、端口 canonicalPath、悬空引用诊断)全部派生;先把 replace/remove 双 walker 合并为单 visitor。

**G8 · 版本门控散落 4+ 处,registry 自带 version 标记是死代码。**
`SchemaRow.versionAdded/deprecatedIn/removedIn`(`schemaRegistry.ts:77-80`)分布于 ~20 行,但全仓零读取(仅 tautological 测试断言其字面值);真实类型门控在并行的 `minVersions.ts`。同一字段引入版本可在 registry 标记、Inspector 标签串、diagnostics 字面量三处独立声明而静默分叉。
→ **建议:** 让 registry 的 version 标记成为 load-bearing——diagnostics 与 Inspector 可见性从 metadata 读取;删除或接上死标记。

### 🟡 Minor(局部缺口 / 一致性)

- **inbound.detour(listen→inbound)有级联无端口**,只能输入 tag(`referenceRegistry.ts:131,150,373` 有,`portRelationRegistry.ts:106-153` 无对应关系)。建议加 `listen-detour` PortRelation 或在 Inspector 显式做成标签 select。
- **route.default_domain_resolver 在每实体 dial 端有边、route hub 端无边**,不对称(`portRelationRegistry.ts:140-142` 有三个每实体 resolver,无 route hub 版),而 `route.default_http_client` 却有 hub 边(`canvas/graph.ts:930-932`)。建议加 `route-default-domain-resolver` 关系复用现有 guard。
- **域名出站/服务器缺 domain_resolver 在 1.14 仅 warning**(`diagnostics.ts:731-742,1568-1574`),无 `atLeast(version,"1.14")` 守卫——1.14 上漏过非法、1.12/1.13 上误报噪声(可考虑升为 moderate)。建议:1.14 且多 DNS server 且无 route.default_domain_resolver 时升为 error。
- **dns-server/endpoint/service/rule-set 标量枚举/类型不校验**(`diagnostics.ts:122-154`;这些行无 `fields`)。如 legacy DNS `strategy:"prefer_ipv4"`、rule-set `format:"source"` 等闭集枚举无验证。建议给这些行补 `fields` 枚举元数据。
- **mDNS DNS server 类型(1.14-only)在诊断里不版本门控**(grep `mdns` 在 diagnostics.ts 为空;`minVersions.ts` 无 dns-server 键)。仅导入路径可达。建议加入 TYPE_MIN_VERSION。
- **reality.handshake 内嵌 dial(detour/domain_resolver)无结构化编辑器**,仅整 config JSON 可达(`sharedFields.tsx:253-261` 不含 handshake.detour;而 shadowtls 的 handshake.detour 已建模于 `:176`)。且该引用未进 referenceRegistry 级联,是 rename/delete 一致性的潜在隐患。建议照 shadowtls 补两个 select。
- **移除于 1.12 的 geosite/geoip/source_geoip 仍在高级 matcher 列表可编辑且无任何弃用警告**(`ruleControls.ts:79-81,109-111`;diagnostics grep 为空)。所有可选目标都已移除它们,建议从列表删除或加 removed-in-1.12 诊断。

### ⚪ Observation(非缺陷,记录)

- 圆环往返导入有意"有损"于三轴(string→array 强转、scrub action-不兼容的 rule 键、dedupeTags),这些 scrub 实际提升合法性。
- index-based 规则身份(`route-rule:<index>`/`dns-rule:<index>`)相对其余 tag 身份脆弱,但 sing-box 规则本就是 tagless 有序数组,largely unavoidable;remap 逻辑集中。
- 无 drag-from-palette、JSON viewer 只读、import 整体替换——纯人体工学,不影响完整度(端口"+"选择器可创建任意引用节点)。

---

## 5. "纯 GUI 可达性"专项分析

### ✅ 纯 GUI 可建(点击 + 拖拽 + 表单)

| 部分 | 路径 |
|---|---|
| 全部 17 inbound / 18 outbound / 12+ DNS-server / 2 endpoint / 5 service / 3 rule-set 类型节点 | Palette 点击 `createFromPalette` |
| selector/urltest 成员、route/dns 规则 outbound/server、各类 *.detour、dial domain_resolver、rule_set/inbound 引用 | 拖拽端口 / 端口"+"选择器 → 落到 canonicalPath |
| TLS(含 reality/ech/utls/acme/dns01)、dial/listen、multiplex/brutal、v2ray-transport、quic、http2、udp-over-tcp | Inspector `SharedFieldCards`(`sharedFields.tsx:118-398`) |
| 代理协议字段、users[]、wireguard peers[]、trojan fallback map、selector/urltest 成员复选+重排 | 各 per-kind Inspector 模块 |
| **route/DNS 规则 matcher 字段**(domain_suffix/keyword/regex、ip_cidr、port、network、process_name、rule_set 等) | `ruleInspectors.tsx:67-75,293-301` + `RuleAdvancedFields`(此前 digest 称"最大 schema gap"系错误) |
| route/DNS 规则 action(sniff/hijack-dns/resolve/reject/predefined) + inline rule-set(≤3 层) | 结构化 + 递归编辑器 |
| log/ntp/certificate/experimental(cache_file/clash_api/v2ray_api stats) | `settingsInspector.tsx`(结构化,非 opaque) |
| inbound.detour、shadowtls handshake.detour、tun route_address_set、derp mesh_with/verify_client_url、ntp.detour | Inspector 控件可达(但**无 canvas 边**——这是图保真度问题,非完整度问题) |

### ⚠️ 强制原始 JSON(结构化编辑器缺失,经清晰标注的逃生口)

| 部分 | 证据 |
|---|---|
| ssm-api `servers`(path→inbound 映射) | `serviceInspector.tsx:95` JsonField |
| inline / 对象形 `http_client` / `default_http_client`(1.14 testing) | `sharedFields.tsx:535-536`(对比 domain_resolver 的 objectForm) |
| outbound `plugin_opts` 对象/数组值 | `outboundInspector.tsx:106-111`(值被 stringify 进文本框) |
| logical(and/or)规则嵌套 > 3 层 | `ruleControls.ts:159,249-251`("nested too deep — edit in JSON") |
| inline rule-set 内 9 字段之外的 headless matcher(process_path/package_name 等) | `ruleControls.ts:141-159` |
| reality.handshake 内嵌 dial(detour/domain_resolver) | `sharedFields.tsx:253-261` 不渲染 |
| predefined DNS action 的 answer/ns/extra 记录 | `ruleControls.ts:54-71`(仅 rcode 是结构化 picker) |
| hysteria2 对象形 masquerade、anytls padding_scheme、certificate PEM | 各为 JsonField / 自由多行文本 |

### 🚫 完全不可纯 GUI 创建(版本策略性排除)

| 类型 | 说明 |
|---|---|
| wireguard 出站、dns 出站(1.13 移除) | `useProjectStore.ts:922` 排除;import-only,有迁移诊断,无一键转换 |
| legacy DNS server、mdns DNS server | `useProjectStore.ts:932` 排除;legacy docs-only,mdns gated |

**结论:** 常见配置(代理出/入站 + DNS + 路由规则 + selector/urltest + TLS/transport)可 **100% 纯 GUI** 完成。逃生到 JSON 的全是低频异形结构,且都有清晰标注、parse-safe、无数据丢失。真正不可达的只有四个按版本策略排除的弃用类型(对受支持的当前 sing-box 版本而言合理)。

---

## 6. 改进路线建议(按优先级)

**P0 — 让"导出即合法"可信(直接补 Serialization / Version-targeting 漏洞):**
1. G2 结构性检测裸 IP/local/fakeip legacy DNS,1.14 升 error。
2. G3 把所有"该目标未知字段"门控统一升 error;warning 仅留真弃用项。
3. G4 stable 目标上对 DNS `respond`/`evaluate` 报 error,修正误导注释。
4. G5 扩展 1.13 dial/TLS 字段门控。
5. G1 未配置二进制检查时在 Export 处显著提示"仅语义校验",或把结构性 official-error 设为可阻断。

**P1 — 收敛结构债(降低未来漂移,提升 Architecture):**
6. G6 收敛双 schema:把 SharedFieldDefinition 上移为 domain 声明式字段表,Inspector/diagnostics/渲染器共消费。
7. G7 引入单一声明式引用目录,三个消费者派生;先合并 replace/remove 双 walker。
8. G8 让 registry version 标记 load-bearing,删除死标记;建立 FIELD_MIN_VERSION/ACTION_MIN_VERSION 共享表,消除 Inspector↔linter 门控分叉。

**P2 — 补图保真度与覆盖细节(Minor):**
9. 加 inbound.detour、route.default_domain_resolver、reality.handshake.detour 的 PortRelation,关闭"有引用无边"的视觉不对称。
10. 给 dns-server/service/endpoint/rule-set 行补 `fields` 枚举元数据,让现有 validateFieldMeta 机制零新代码生效。
11. 从高级 matcher 列表删除已移除的 geosite/geoip/source_geoip(或加 removed-in-1.12 诊断)。
12. 加 mdns 进 TYPE_MIN_VERSION。

**P3 — 人体工学(不影响完整度,可延后):**
13. drag-from-palette、可编辑 JSON 面板、为 predefined answer/ns/extra 与 ssm servers map 补轻量结构化编辑器、为 imported legacy 节点加"一键迁移"。

---

**一句话收尾:** 设计合理、方向正确,JSON 的 workflow 化在常见配置面已经成立、可生成;若要把"纯 GUI 生成的配置一定能被 sing-box 接受"变成可信承诺,核心工作不在"加更多控件",而在补齐手工 linter 与版本门控、并收敛已半迁移的双 schema/三处引用编码。