<!-- Re-assessment for the GUI-reachability ≥90% goal (docs/goals/gui-reachability-90-execution.md).
     Re-run harness: scripts/workflows/canvas-config-gen-review.workflow.js (66 agents, 40 findings, 39 confirmed, 1 rejected). -->

# Status header — GUI-reachability ≥90% goal re-assessment (V0–V9 landed)

- **Re-run date:** 2026-05-30 (post V0-S1 / V1 / V2-S1 / V3 / V4 / V5 / V6 / V9-S1 / V7-S1 merge)
- **Overall:** 3.5 / 5 (adequate). **Pure-GUI reachability ≈ 70-80%** (baseline 2026-05-30 post-remediation: ~60-70%). **Improved, but the ≥90% done-bar is NOT yet met.**
- **Six dimensions:** all `adequate`. ⚠️ **serialization fell strong→adequate** vs the baseline, caused by the pre-existing `renameTag` namespace-blind bug (M3) the deeper re-run surfaced — must be fixed to restore "serialization 维持 strong".

## Done-bar verdict (per goal §7)
| Criterion | State |
| --- | --- |
| 1. 纯 GUI 可达性 ≥90% | ❌ ~70-80% |
| 2. 主流构造零强制 JSON 回退 | ⚠️ mostly; M1 masquerade + M2 singleton/rule unmodeled keys still force JSON / are invisible |
| 3. 导出硬门(结构非法不可导出) | ⚠️ in place, but M4 (1.13 fields / removed types only `warning` on incompatible target) leaves a confirm-bypass hole for binary-rejected configs |
| 4. serialization 维持 strong + 六维无回退 | ❌ serialization adequate (M3) |
| 5. 无未解决 P0/P1 | ❌ M1/M3/M4 (P0), M2/G1 (P1) |

## Surfaced P0/P1 → next-atomic queue (per §7.6; overlaps the inspector-reliability goal)
- **M1** hysteria2 `masquerade` object-form handled-but-unrendered + data loss → enqueue as **R5** (object-form masquerade).
- **M2** log/ntp/certificate/experimental/route/dns singletons + route/dns rule inspectors lack `AdvancedNonScalarFields` fallback → unmodeled object keys invisible → enqueue as **R4** (type-driven visibility / Advanced fallback). **Highest reachability lever.**
- **M3** `renameTag` namespace-blind rename corrupts imported same-name inbound/outbound refs → new atomic **V10-S0** (namespace-scoped renameTag) — restores serialization=strong.
- **M4** 1.13 fields / removed types (`block`/`dns`/`wireguard` outbound, `tls.curve_preferences`, …) only `warning` on incompatible target → enqueue as **V4-S3** (warning→error, driven by `SchemaRow.removedIn` / `versionAdded`).
- **G1** missing reference edges/dropdowns (`resolve.server`, `listen.detour`, tun `address_set`, selector `default` dangling cleanup) → **V7-S3 / V8**.
- **M5** Inspector hand-written per-protocol JSX duplicates registry enums, no parity test → the deferred **V0-S2 data-driven scalar renderer** + enum-parity test. **Highest maintainability lever.**

---

# sbc-ui 最终评估报告:JSON 的 workflow 化是否成立?

## 1. 总体结论

**合理,方向正确,常用面已"真正实现",长尾/深层边缘仍是"近似实现"。总体评分:3.5 / 5(adequate)。**

直接回答用户的核心问题——「现在的设计与实现是否合理?能否仅通过点击、拖拽、简单编辑就生成 sing-box 配置文件,真正实现了 JSON 的 workflow 化?」:

- **设计合理**:这是一套真正健全、分层清晰的架构。单一规范化 `SingBoxConfig` 是唯一真相源,画布(React Flow 节点/边)与 JSON 草稿都是它的**单向纯投影**(`deriveGraph` 是 `useMemo` 派生,`jsonDraft = stringifyConfig(config)`),所有结构变更都经由纯命令层 `commands.ts` 漏斗回写 config。因此 graph→JSON **构造即有效**——画布只能表达 config 已合法包含的引用。
- **能否纯 GUI 生成配置**:对约 **70-80% 的主流配置**(tun/mixed 入站 + vless/vmess/trojan/ss/hysteria2 出站 + selector/urltest 分组 + DNS 服务器 + route/dns 规则 + TLS/reality/transport/multiplex),答案是**能**——调色板点击新增节点、端口点击/拖拽连线、深层结构化 Inspector 端到端覆盖,且导出硬门禁阻断结构无效输出。
- **是否"真正实现 workflow 化"**:在常用面**是**;在长尾/深层边缘**尚未完全达成**——少数 union/map 字段、六个单例的未建模键、规则的对象型匹配字段、几条合法引用,仍需回落到全局原始 JSON 文本框,或在画布上静默不可见。

---

## 2. 六维度评分表

| 维度 | 评分 | 一句话判断 |
|---|---|---|
| **Schema 覆盖** | adequate | 协议类型对稳定版覆盖近 100%,Inspector 比注册表丰富;真实缺口在 union/map 字段形态与单例的对象字段兜底。 |
| **图保真度** | adequate | 核心引用边忠实且类型/动作门控正确;边缘漏在几条无端口/无边的合法引用、装饰性 inbound→route 边、大规模视觉上限静默丢边。 |
| **交互完整度** | adequate | 主流协议面纯 GUI 可建;长尾构造(深层逻辑规则、对象型匹配字段、ssm-api 多路径、内联 http_client、六单例未建模键)被良好界定地逼到原始 JSON。 |
| **序列化正确性** | adequate | "config 即真相源"使 graph→JSON 构造即有效,round-trip 对未知字段无损,导出硬门禁有效;主要缺陷是 renameTag 跨命名空间盲改。 |
| **版本目标** | adequate | 类型级门控与 testing-only 资源门控正确(硬阻断);但一类字段级新增与已移除类型仅 warning,可绕过门禁导出目标二进制会拒绝的配置。 |
| **架构健全性** | adequate | 单向数据流、命令层、集中 schema 注册表 + 测试强制一致性都很扎实;主要债务是 Inspector 手写 per-protocol JSX 与注册表枚举重复且无守护。 |

---

## 3. 设计亮点(node/edge/port + registry 做对了什么)

1. **单一真相源 + 单向投影**。`commands.ts` 是约 40 个纯 `(config, args) -> config` 的 clone-then-mutate 变换,不 import store/canvas;`sync()` 重建 `{config, jsonDraft, diagnostics}` 作为约 60 处变更的统一漏斗;`deriveGraph(config,...)` 每次全量重建且不 import store。这条不变量使 graph 不可能表达非法引用。

2. **引用即 tag 字符串,边是投影而非一等数据**。跨对象引用统一建模为 PortRelation 注册表(`portRelationRegistry.ts:106-153`,32 条关系),每条声明 source/target 端点、`canonicalPath`(写入的 JSON 指针,如 `/outbounds/*/detour`)、`createTarget` 与类型门(`nodeType`/`nodeTypeExcludes`/`extraNodeKinds`)。节点端口不是存储的,而是由关系图反推(`portEndpointsForNode`),因此新增关系即新增端口,无需手工维护句柄。

3. **正确的类型与动作门控**。route-rule 的 outbound 端口仅在 action 为 `route`/`bypass` 时出现(`routeRuleAllowsOutbound`),dns-rule 的 server 端口仅在 `route`/`evaluate` 时出现(`dnsRuleAllowsServer`),与上游语义一致;endpoint 与 outbound 共享 tag 命名空间(`extraNodeKinds:["endpoint"]` + `outboundTargetNodeId`),`domain_resolver` 的 string|object 两种形态都解析为边。13 个专用锁套件(148 测试)护住这套骨架。

4. **集中 schema + 测试强制一致性**。`SCHEMA_ROWS`(`schemaRegistry.ts:128`)是单一真相源:`protocols.ts` 的可创建列表、`commands.ts` 的工厂、`sharedFieldRegistry` 的组成员、diagnostics 的成员集都从它派生;`registry-parity.test.ts` 断言每条可写引用路径要么有边、要么在 Inspector-only 白名单中(无静默漂移);`schema-field-enums.test.ts` 把枚举值钉到 `docs/upstream` 文档(防拼写/幻觉)。

5. **导出硬门禁 + 全面引用诊断**。`exportConfigGated`(`exportConfig.ts:60-75`)在存在 `level:"error" && source:"semantic"` 诊断时无旁路阻断;悬空引用(route.final、rule outbound/server/rule_set、selector candidate、各类 detour、dns endpoint、ssm-api、derp、http_client)与命名空间感知的重复 tag 检测都很完整。

6. **Inspector 已从 5925 行巨文件解耦**(`Inspector.tsx` 现 316 行纯派发壳 + per-kind 组件),`fixture-node-coverage.test.ts` 对模板预设做 `validateConfig` 守护。

---

## 4. 关键差距与风险(按严重度分组)

### Major(影响 workflow 化承诺或可导出错误配置)

**M1 — hysteria2 masquerade 对象形"处理但不渲染",且有数据丢失**
唯一控件只渲染字符串形(`inboundSectionsB.tsx:466-473`:`value={typeof entity.masquerade === "string" ? entity.masquerade : ""}`)。因 `masquerade ∈ inboundHandledFields`(`handledFields.ts:73`),它被排除在 Advanced scalar 与 Advanced JSON 兜底之外,节点内**完全不可见**;`updateField` 整值替换,向空输入框键入会**销毁导入的对象**。C17 反漂移守护因 `masquerade` 在 `INLINE_RENDERED_KEYS`(`handledFields.ts:182`)且正则匹配到字符串形 `updateField` 调用而误判为已覆盖(测试 5/5 绿)。上游 `inbound/hysteria2.md:93-143` 明确 masquerade 为 string|object 联合(file/proxy/string)。
> **建议**:加 union 子编辑器(radio 切换 URL 字符串 vs 对象);廉价过渡方案:从 `inboundHandledFields` 移除 `masquerade`,让对象形至少回落到 Advanced JSON,而非彻底不可见。

**M2 — 六个单例 + 规则 Inspector 缺对象字段 Advanced 兜底,未建模键节点内不可见**
`settingsInspector.tsx`/`routeInspector.tsx`/`dnsInspector.tsx` 均**不 import** 任何 Advanced 组件;`ruleInspectors.tsx:239,387` 仅渲染 `AdvancedScalarFields`(scalar-only 过滤),从无 `AdvancedNonScalarFields`。后果:log/ntp/certificate/experimental 的未建模顶层键、route/dns 根标量、规则的对象/数组型匹配字段(如 `interface_address`、`network_interface_address` map,1.13 稳定)在节点内完全不可见,只能靠全局 JSON。这与 `advancedFields.tsx` 自身"保证无字段静默不可达"的不变量相矛盾(7 个 tagged Inspector 都有此兜底)。
> **建议**:给 SettingsInspector/RouteInspector/DnsInspector 加 `AdvancedScalarFields + AdvancedNonScalarFields`(按 section 限定 handledFields),给 route/dns 规则 Inspector 加 `AdvancedNonScalarFields`。

**M3 — renameTag 跨命名空间盲改,可损坏导入配置**(序列化正确性真实缺陷)
`renameTag`(`commands.ts:539-567`)按裸字符串跨全部 8 命名空间改名,并调用 `replaceRegisteredTagReferences` 跑每种 kind 的命名空间盲替换;冲突守护用**全局** `buildTagIndex`(`commands.ts:541`)。但 import/dedupe/diagnostics 是**命名空间感知**的,合法允许 inbound `foo` + outbound `foo` 并存。实测:重命名 outbound foo→bar 会把 inbound、outbound、route.rules[].inbound/outbound 全部改成 bar(两侧命名空间一起改坏),且重复 tag 诊断**不报警**,带病导出。仅咬 GUI 无法产生的导入/手编场景(GUI 生成的 tag 因同样全局索引不会触发)。
> **建议**:让 renameTag 命名空间限定——只改被重命名实体 kind(或其共享 outbound/endpoint 命名空间),并把命名空间传入 `replaceRegisteredTagReferences` 只改写同命名空间路径。

**M4 — 1.13 字段/已移除类型在 1.12-stable 目标下仅 warning,可绕过导出目标二进制会拒绝的配置**(版本目标)
1.13 新增字段(`tls.curve_preferences`/`kernel_tx`/`kernel_rx`/`client_authentication` 在 `diagnostics.ts:866-885`;route-rule bypass + interface_address 在 :277-296;local DNS prefer_go;tailscale advertise_tags)在 `!atLeast(version,"1.13")` 下仅 `warning`;已移除类型 `type:"dns"`/`"wireguard"`(`diagnostics.ts:744-764`)与 `type:"block"`(:2082-2092)是**无版本门控**的永久 warning。`exportConfigGated` 仅硬阻 error 级 semantic 诊断,warning 仅触发一次性 `window.confirm`。这与同类"unknown field"硬 error(cloudflared :1305、http_clients :1588)不一致,且与 `outboundInspector.tsx:145` 自己"1.13/1.14 会被拒绝"的横幅矛盾。1.12 Legacy 目标 GUI 可达。
> **建议**:把 1.13-字段-on-pre-1.13 与 block/dns/wireguard-on-1.13+ 从 warning 升级为 error(unknown field 是硬拒);removal 版本从 `SchemaRow.removedIn` 驱动而非字面量。

**M5 — Inspector 手写 per-protocol JSX 与注册表枚举重复且无一致性测试**(架构债务)
`src/components/` 下无任何文件 import `schemaRegistry`(grep 零命中);Inspector 叶字段是 `entityType ===` 链上的手写 JSX(共 59 处),Shadowsocks method `<select>`(`outboundInspector.tsx:408-441`)手工复制了注册表的 `SS_METHOD_ENUM`(`schemaRegistry.ts:103-122`)。注册表 header 承诺的"数据驱动标量渲染器"并不存在。新增协议仍需改(a)注册表行 +(b)1-2 个手写 Inspector 段 +(c)`protocols.ts` 调色板键。NETWORK_ENUM、congestion_control、VLESS_FLOW_ENUM 等也是重复模式,无测试守护"option 集 ⊆ 注册表枚举"。
> **建议**:交付承诺的数据驱动标量渲染器(Inspector 读 `fieldMetaFor(kind,type)` + `sharedGroups` 自动渲染 scalar/enum/boolean),手写 JSX 仅保留 users[]/peers[]/masquerade union 等真正定制控件——这是 GUI-as-source 目标上**单点杠杆最高**的重构。

### Minor / Moderate(便利性、可见性、长尾)

**G1 — 几条合法引用无端口/无边**(图保真度)
- selector/urltest `default`:真实 outbound 引用但无边,只能在 Inspector 下拉输入;断开某成员可留下悬空 `default`(`portReferenceAdapter.ts:353-361` 过滤成员但不清 default;删除路径 `referenceRegistry.ts:194-201` 会清,**断开成员路径不会**)。
- route-rule `resolve.server`:`/route/rules/*/server` 在 cascade 中(`referenceRegistry.ts:384`)但 `portRelationRegistry.ts` 只有 `/dns/rules/*/server`(:116),**无对应可写关系**,画布画不出、连不上,只能 Inspector 下拉。
- route `default_domain_resolver`、inbound `listen.detour`、tun `route_address_set`/`route_exclude_address_set`:cascade-only,无边;后两者甚至无悬空诊断(typo 既无边也无告警)。
> **建议**:为这些 top-level 引用增设可写 PortRelation(resolve-server 按 action=resolve 门控;ntp.detour/address_set 改为下拉/checklist)。

**G2 — 大规模视觉上限静默丢边/丢节点**(图保真度)
`MAX_VISUAL_RULE_NODES=24`、`MAX_VISUAL_RULE_SET_NODES=24`、`MAX_VISUAL_CANDIDATE_EDGES=96`、`MAX_OUTBOUND_DEPTH=2`(`graph.ts:34-41`)。route/dns 规则 >24 切片并出**可见**通知节点;但 rule_set >24 整体禁用(`visualizeRuleSets=false`)并连带丢掉其 download_detour/http_client 边——**无通知**(真静默);96 边上限与深度折叠也静默。数据不丢(config/JSON 仍在,Inspector/Rules 表完整可编辑)。
> **建议**:rule_set 上限独立于 24 路由规则上限并加可见通知;考虑每节点降级而非 all-or-nothing。

**G3 — inbound→route 边是装饰性虚构**(图保真度,minor)
`graph.ts:350-352` 对每个 inbound 都画 `route:main` 动画边(仅 `if(config.route)` 门控),与真实的 rule 级 `route-rule-inbound` 匹配边(`/route/rules/*/inbound`)并存,易被误读为可配置引用(非可写,无 canonicalPath,不影响 config)。
> **建议**:视觉区分(虚线/低透明,标注"流量"而非"引用")。

**G4 — ssm-api 多路径映射 / 内联 http_client 对象 需原始 JSON**(交互完整度,minor)
ssm-api `servers` 自定义路径键只能在 `serviceInspector.tsx:95` 的 "Endpoint Mapping JSON" 手编;`http_client` 内联对象形仅当值已是对象时才出现 JsonField(`sharedFields.tsx:534-537`),且无 GUI 入口把 tag 选择转为内联对象。`domain_resolver` 已有完整结构化子表单(不在此缺口内)。
> **建议**:为 ssm-api 加 path+inbound 重复行;为 http_client 加内联对象子表单。

**G5 — 内联 rule-set 匹配字段封顶 9 项**(覆盖/交互,可降为 minor)
`INLINE_RULE_LIST_FIELDS` 仅 9 项 + invert + 逻辑嵌套(深度封顶 3,`ruleControls.tsx:141-159`);headless-rule 其余字段(query_type、port_range、process_path*、wifi_ssid/bssid 等)仅 JSON 可编辑。route/dns 规则 Inspector 已覆盖完整集,故仅限内联 rule-set 编写路径。
> **建议**:复用 route/dns 的 RuleAdvancedFields 到内联编辑器。

**G6 — 导出文件名 sbcv_ 前缀误导**(序列化,minor)
`exportConfigGated` 丢弃 `createConfigExport` 声明的 `config.json`,改用 `createSbcvFileName()` 产出 `sbcv_YYYYMMDD_HHMMSS.json`(`exportConfig.ts:75`)。纯配置文件名带项目格式前缀,但内容仍是合法 sing-box JSON(仅命名困惑;`downloadProject` 已成孤儿无调用方)。
> **建议**:沿用声明的 `config.json`(或 `config_时间戳.json`),`sbcv` 标识保留给项目包。

**G7 — header/keyvalue map 编辑器仅支持字符串值**(交互,minor)
`sharedFields.tsx:567-621`、`dnsServerInspector.tsx:292-348` 只建模 string→string;sing-box header 是 `Listable[string]`(可数组)。导入的数组值渲染为 `"a,b"` 并在任意键入时**静默坍缩**为字符串,且因 `headers ∈ handledFields` 不会回落到 JSON 兜底——无任何应用内入口可编辑数组形 header。
> **建议**:按需加 per-row 值列表开关,或明确文档化 string-only 约束。

### Observation(正向确认,无需改动)
- 稳定版协议类型覆盖近 100%;round-trip 对未知字段无损,`pruneExportNoise` 仅删语义缺省的空串/空数组键(已核 clash_api 空数组等价);悬空引用与解析-tag 校验全面且命名空间正确;类型级版本门控与 testing-only 资源门控正确硬阻断;单向数据流与集中 schema + 测试一致性扎实。

---

## 5. "纯 GUI 可达性"专项分析

### ✅ 纯 GUI 可建(点击/拖拽/结构化编辑,无需 JSON)
- **入站**:全部 17 个稳定类型可调色板点击新增;vless/vmess/tuic 的 uuid、trojan/ss/shadowtls/hysteria2/anytls 的 password、vmess alterId、vless flow 枚举均为可编辑 per-user 重复行 + Generate UUID(`inboundSectionsB.tsx:27-129,518-600`)。
- **出站**:全部稳定类型;selector/urltest 成员 checklist + 上下移重排(`outboundSectionsB.tsx:378-462`)。
- **DNS 服务器**:13 typed 类型;predefined hosts 为 domain→IP 列表重复行(`dnsServerInspector.tsx:251-278`)。
- **Endpoint**:WireGuard peers 重复行(`endpointInspector.tsx:69-167`)。
- **TLS/共享**:reality(server/client 分角色)、ech、utls、内联 ACME(per-provider 门控的 dns01)、v2ray-transport 各变体(按 transport.type 门控)、multiplex/brutal/udp_over_tcp 全部结构化(`sharedFields.tsx:211-373`)。
- **引用连线**:端口点击/拖拽打开搜索式 picker,可创建并连接下游节点(`SbcNode.tsx:205-206`);route.final、rule outbound/server、selector 成员、detour、rule_set、domain_resolver(含对象子表单)均为边或下拉。
- **route/dns 规则**:专用结构化 Inspector + 动作门控控件 + 逻辑子规则递归编辑(深度 ≤2)+ 分页 Rules 表。
- **导出**:语义错误硬门禁阻断结构无效输出。

### ⚠️ 可达但被逼到原始 JSON(全局 JSON 文本框可写,Current JSON 对话框只读)
- log/ntp/certificate/experimental/route/dns **六单例的未建模键**(无 Advanced 兜底,节点内不可见 → 全局 JSON)。
- route/dns 规则的**对象/数组型匹配字段**(curated 列表外,如 interface_address map;predefined 动作的 answer/ns/extra 记录)。
- 内联 rule-set 的 **headless 规则 9 字段以外**;逻辑规则嵌套 **>3 层**。
- **ssm-api 自定义多路径映射**;**内联 http_client 对象形**。
- header/DoH header 的**数组值**(且无应用内入口,事实上不可达)。

### ❌ 静默不可达 / 数据丢失(节点内既无控件也无可见兜底)
- **hysteria2 masquerade 对象形**(M1)——静默不可见,键入字符串销毁导入对象。
- 画布上不可见的引用:selector/urltest `default`、route-rule `resolve.server`、route `default_domain_resolver`、inbound `listen.detour`、tun `route_address_set`(只能 Inspector 文本输入或全局 JSON;部分连悬空诊断都没有)。
- 大规模下被视觉上限静默丢弃的 rule_set 节点及其边(G2,数据仍在 JSON,但画布不可见)。

**结论**:常用配置的每一个字段都能纯 GUI 编辑;"被逼 JSON"与"静默不可达"集中在深层 union/map、单例未建模键、对象型规则匹配,以及几条无边引用——均为长尾/边缘,且除 M1 外都不丢数据。

---

## 6. 改进路线建议(按优先级)

**P0(关闭数据丢失与可导出错误配置)**
1. **M1**:修 hysteria2 masquerade——加 union 子编辑器,或先从 `inboundHandledFields` 移除以回落 Advanced JSON,消除静默数据丢失。
2. **M3**:renameTag 命名空间限定,堵住导入配置跨命名空间引用损坏。
3. **M4**:1.13 字段 / 已移除类型在不兼容目标下从 warning 升级为 error,与 unknown-field 硬拒一致,removal 版本由 `SchemaRow.removedIn` 驱动。

**P1(关闭"静默不可见"类,兑现 workflow 化承诺)**
4. **M2**:给 SettingsInspector/RouteInspector/DnsInspector + route/dns 规则 Inspector 补 `AdvancedScalarFields/AdvancedNonScalarFields` 兜底,恢复"无字段静默不可达"不变量。
5. **G1**:为 resolve.server / listen.detour / tun address_set / selector default 增设可写 PortRelation 或下拉/checklist;断开成员时同步清理悬空 `default`。

**P2(可维护性与一致性,降低未来漂移)**
6. **M5**:交付数据驱动标量渲染器,让 Inspector 从 `fieldMetaFor` 自动渲染 scalar/enum/boolean,消除手写 JSX 与枚举重复;至少先加"Inspector option 集 ⊆ 注册表枚举"测试。
7. **G2**:rule_set 视觉上限独立化 + 可见溢出通知;G3 装饰性 inbound→route 边视觉区分。

**P3(长尾便利)**
8. **G4/G5/G7**:ssm-api 多路径重复行、内联 http_client 对象子表单、内联 rule-set 复用 route/dns 高级匹配、header 数组值开关;G6 导出文件名正名为 `config.json`。
9. 将 dns-server/endpoint/service/rule-set 行的闭合枚举回填 `fields` 元数据,使校验器与未来渲染器获得覆盖对等。