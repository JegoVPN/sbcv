# Canvas config-gen assessment — re-run #3 (2026-05-30, post V0–V10/R1–R5)
**Overall:** adequate(良好 / 6 维中 1 维 strong、5 维 adequate)
**Core verdict:** 是的,设计与实现总体合理且方向正确——配置即唯一真相(config-as-source-of-truth)、节点/边/端口由注册表驱动、单向 deriveGraph 投影,这套架构确实把 sing-box JSON "workflow 化"了。但"纯点击/拖拽/简单编辑即可生成完整有效配置"只在主流场景(约 85-90% 的真实配置)成立;高级 rule-set 内联匹配字段、若干多态嵌套对象、以及未默认化的协议调优标量字段仍被迫回退到外部 JSON 编辑后导入。更关键的是:导出闸门只能近似(而非证明)能通过 sing-box check——它是手写探针集,没有 JSON-Schema/解码器校验,且存在三处版本门遗漏会让所选版本的二进制拒绝一份本地 lint 通过的配置。综合评分:adequate(良好,接近 strong 但有真实的 JSON 尾巴与正确性近似的短板)。

## Dimension scores

### schema-coverage — **strong**
Coverage is broad and deep — far better than the digests' "gapsObserved" sections imply. Every upstream config SECTION and essentially every protocol TYPE is modeled and editable; the genuine boundaries are (a) a small set of correctly-excluded deprecated/removed types, (b) the Advanced fallback only surfacing already-present keys so a handful of never-defaulted scalar fields are reachable only via raw JSON, (c) the inline rule-set/headless editor modeling only 9 of ~30 match fields, and (d) scalar enum/type VALIDATION being limited to inbound/outbound. No upstream section is absent.

### graph-fidelity — **adequate**
Sound and faithful for the high-traffic reference set: selector/urltest members, route-rule to outbound, route-rule resolve to server, dns-rule to server, all detour variants, route.final, dns.final, dns-server to endpoint/service, domain_resolver, and SSM/verify-endpoint maps all derive as directed edges from canonical paths; endpoints share the outbound namespace; a dangling pseudo-node makes broken tags visible. Flat rule-level action/server/outbound modeling is CORRECT (matches sing-box's flattened rule_action). Leaks are bounded: several real references are Inspector-only with no edge (inbound listen.detour, handshake.detour, tun route_address_set, selector.default), plus one integrity hole: legacy DNS server address_resolver is tracked nowhere so a rename silently breaks it. Visual caps also hide edges past 24 rules/rule-sets/96 candidates.

### interaction-completeness — **adequate**
Mainstream proxy/DNS/route configs (~85-90% of real-world configs) are fully authorable GUI-only — the inspector schematizes far more than the digests claimed (TLS incl. reality/ech/utls/acme/dns01, V2Ray transport per-variant, multiplex, QUIC, dial/listen, inbound users[], WireGuard peers[], v2ray_api.stats, rule actions + match fields all have structured controls). A minority of configs still force raw-JSON: the `inline` rule-set / logical rule body (only 9 of ~25 match fields structured), hysteria2 masquerade object form, ssm-api multi-path servers map, cloudflared control_dialer/tunnel_dialer, and arbitrary unmodeled keys. Score: adequate (strong for common cases, with a real JSON-only tail for advanced rule-sets and a few niche objects).

### serialization-correctness — **adequate**
Config-as-source-of-truth is the right architecture: the canvas never assembles JSON from nodes/edges — it mutates a typed SingBoxConfig through normalized command writers and JSON.stringify exports it verbatim, so structural shape, array ordering (rules stay positional), and unknown fields all round-trip losslessly. Generated tags and namespace-aware reference resolution (endpoints sharing the outbound namespace) are correct, and a hard export gate blocks any error-level semantic diagnostic. The real weakness is that the gate's guarantee of sing-box acceptance is approximate, not proven: validation is a hand-written probe set with NO JSON-Schema/decoder pass, enum/type checks fire only for inbound/outbound rows (dns-server/endpoint/service/rule-set are no-ops), and several genuinely-required fields (shadowsocks/trojan method/password, tuic outbound uuid) are unchecked — so a structurally-incomplete config can pass the gate and be rejected by the real binary. Round-trip is lossless for the config payload but lossy for canvas layout (wiped on every bare-config import/JSON-apply) and silently scrubs action-mismatched rule keys on import.

### version-targeting — **adequate**
Version targeting is mostly correct and well-engineered for the three configured targets (1.12-stable Legacy / 1.13-stable default / 1.14-testing): the channel↔version coupling is sound, deprecation ladders are version-aware and binary-verified, and the headline 1.14 testing-only sections (cloudflared, http_clients, certificate_providers, dns.optimistic/timeout, respond/evaluate rule actions, neighbor/tailscale fields) all hard-error on incompatible targets. But the gating is enumerated, not systematic, and three concrete holes let the editor emit a config the selected-version binary rejects while the linter passes and export succeeds: (1) field-level `since` metadata is never enforced (the naive-inbound `quic_congestion_control` field, since 1.13, slips onto the 1.12 Legacy target); (2) the 1.14-only `mdns` DNS-server type has no version gate (cloudflared was gated, its DNS-server analogue was missed); (3) the since-1.13 `certificate.store:"chrome"` value is only a bypassable warning on 1.12. None block export because they never become semantic errors; the real backstop is the optional official binary check, which is advisory-only.

### architecture-soundness — **adequate**
The core architecture is sound and notably well-disciplined: config is the single source of truth, the graph/JSON are pure one-way derivations through a single sync() canonicalization step, and the 5641-line Inspector monolith has genuinely been split into a 318-line shell + focused per-kind modules. The schema-registry consolidation is real (factories, creatable lists, proxy/tls/required flags, shared-field-group membership, and enum validation all derive from SCHEMA_ROWS), and parity tests bind the two reference registries and prove templates lint clean. But "single source of truth" is achieved only partially: per-protocol Inspector UI is still hand-written bespoke JSX with inline-duplicated enums, the reference graph is enumerated independently in THREE places (referenceRegistry walker, portRelationRegistry, and diagnostics), only two of which are parity-tested; field-level required-ness and version gating remain scattered hand-coded checks; and a 500-line/124-branch togglePortConnection dispatch re-encodes relation knowledge the registry already holds. Adding a new field touches 3-5 files and adding a protocol 5-8; the registry made this far better than a blind sweep but did not reduce it to "one row edit." Maintainable and reasonable for the goal, with concrete consolidation debt that is contained by an unusually strong test net.

## Top strengths
- 配置即唯一真相 + 单向投影:deriveGraph 是纯函数(graph.ts:249),无任何 graph→JSON 序列化器,全部变更经 commands.ts 不可变写入再过单一 sync() 规范化(useProjectStore.ts:211-223),结构形状/数组顺序/未知字段无损往返
- Schema 覆盖到顶:每个上游 section + 几乎每个协议 type 都已建模可编辑(schemaRegistry.ts:138-1068),深层 TLS/transport/multiplex/QUIC/users[]/peers[] 全有结构化控件,远超数字摘要的判断
- 注册表驱动的端口/边模型:33 个 PortRelation + 引用级联 + 命名空间感知(endpoint 与 outbound 共享命名空间),由 canonicalPath 把 canvas 边与数据层引用级联绑定,parity 测试守护
- 异常强的测试网:no-silent-unreachable-fields 防虚构守卫 + 模板 lint-clean + registry-parity + reference-visitor-op-parity,把'无字段静默不可达'变成可证明的属性
- 导出硬闸门:任何 error 级语义诊断阻断导出(exportConfig.ts:41),生成 tag 与命名空间感知引用解析正确

## Top gaps
- 导出闸门只近似而非证明能过 sing-box check:无 JSON-Schema/解码器,枚举/类型校验仅对 inbound/outbound 生效,且 shadowsocks/trojan/tuic 等必填凭证未校验,结构不完整的配置可过闸门却被二进制拒绝(diagnostics.ts:122-153, 816-846)
- 三处版本门遗漏让所选版本二进制拒绝一份 lint 通过的配置:naive quic_congestion_control 字段级 since 未强制(diagnostics.ts:84-120)、1.14-only 的 mdns DNS-server 零版本门(diagnostics.ts 全文无 mdns)、certificate.store:chrome 在 1.12 仅可绕过的警告(diagnostics.ts:1513-1521)
- 内联 rule-set/逻辑规则只结构化约 10/24 个 headless 匹配字段(ruleControls.ts:141-151),社区模板大量依赖 geosite/geoip rule-set,其余匹配字段被迫走 JSON 模式
- 若干未默认化标量字段纯 GUI 不可达:vmess global_padding/authenticated_length、hysteria/tuic recv_window/rtt 等只在已存在该键时才渲染控件(helpers.ts:56-72),从零建节点必须靠外部 JSON 导入
- legacy DNS server address_resolver 引用全程未追踪:rename 不重写、delete 不清扫,改名静默断链(referenceRegistry.ts:319-323,src 中零处 address_resolver)
- 可视化上限静默丢边:>24 rule-set 整体隐藏(含 1.14 社区模板的 30 条 rule_set,graph.ts:272)、选择器候选边 >96 静默丢弃,无溢出提示节点

## Stats
{"upstreamDigests": 10, "implDigests": 9, "findings": 36, "confirmed": 35, "rejected": 1}

---

# sbc-ui 最终架构评估:JSON 的 Workflow 化是否成立?

> 评估对象:一个以 React-Flow 画布为载体、目标是"仅靠点击/拖拽/简单结构化编辑即可生成 sing-box JSON 配置"的工具。
> 评估方法:六维打分 + 逐条已核实发现 + 上游引用图比对 + 实现摘要,关键论断已对实际代码二次验证。

---

## 1. 总体结论

**直接回答:设计与实现是合理的,方向正确,JSON 的 workflow 化在主流场景(约 85-90% 的真实配置)已经真正落地;但"纯 GUI 即可生成完整有效配置"尚未做到 100%,且"保证能过 sing-box check"这一 done-bar 目前是近似实现、而非已证明。**

核心架构判断站得住:
- **配置即唯一真相**——画布从不由节点/边反向拼装 JSON。`deriveGraph(config, layout, diagnostics, channel)` 是纯函数(`src/canvas/graph.ts:249`),全代码库**不存在任何 graph→JSON 序列化器**;一切变更经 `commands.ts` 的不可变写入,再过单一 `sync()` 规范化(`src/state/useProjectStore.ts:211-223),结构形状、数组顺序、未知字段都无损往返。
- **节点/边/端口由注册表驱动**——33 个 `PortRelation` 配合引用级联,`canonicalPath` 把 canvas 边与数据层引用绑定;endpoint 与 outbound 共享命名空间。
- **巨石已拆**——5641 行的 Inspector 已确实拆成 **318 行壳**(已核实 `Inspector.tsx` 行数=318)+ 按 kind 的子模块。

**综合评分:`adequate`(良好)。** 六维中 Schema 覆盖为 `strong`,其余五维 `adequate`。它"对常见场景近乎 strong,对高级 rule-set 与少数多态对象有真实的 JSON 尾巴,且正确性保证是近似而非证明"。

---

## 2. 六维评分表

| 维度 | 评分 | 一句话判断 |
|---|---|---|
| Schema 覆盖 | **strong** | 每个上游 section、几乎每个协议 type 都已建模可编辑;深层 TLS/transport/multiplex/QUIC/users[]/peers[] 全有结构化控件,远超数字摘要的判断。 |
| 图保真度 | adequate | 高频引用集(selector 成员、route/dns 规则、各类 detour、domain_resolver、final、SSM/verify 映射)忠实派生为有向边;漏点有界,但 legacy DNS `address_resolver` 全程未追踪是一处完整性漏洞,且可视化上限会静默丢边。 |
| 交互完整度 | adequate | 主流代理/DNS/路由配置可纯 GUI 完成;少数被迫回退 JSON:内联 rule-set/逻辑规则体、hysteria2 masquerade 对象、ssm-api 多路径 servers、cloudflared 双 dialer。 |
| 序列化正确性 | adequate | 架构正确(config 即源,逐字导出);弱点是导出闸门**只近似而非证明**能过 sing-box check——无 JSON-Schema/解码器,枚举/类型校验仅 inbound/outbound,部分必填字段未检。 |
| 版本目标 | adequate | 三目标(1.12/1.13/1.14)耦合正确、废弃阶梯版本感知;但三处门是枚举式而非系统化的漏洞,可让所选版本二进制拒绝一份 lint 通过的配置。 |
| 架构健壮性 | adequate | 单向数据流、schema 注册表整合、强测试网都真实;但引用图在三处独立枚举(仅两处 parity 绑定),Inspector 仍是手写 JSX,500 行/124 分支的 `togglePortConnection` 重复编码了注册表已有的关系知识。 |

---

## 3. 设计亮点(节点/边/端口 + 注册表设计做对了什么)

1. **彻底的单向数据流(config-as-source-of-truth)。** `deriveGraph` 纯投影、`sync()` 单一规范化漏斗(~66 处调用)、`stringifyConfig(pruneExportNoise(config))` 逐字导出(`serialization.ts:88-117`)。store 几乎不含领域逻辑,所有结构性变更委托给 `commands.ts` 的 `cloneConfig` 纯函数。这是"JSON workflow 化"最关键的正确决策:**生成的配置是否有效 ≈ config 本身是否有效**,而不是脆弱的节点拼装。

2. **引用即有向边,命名空间感知。** 跨对象引用以 tag 字符串存于实体内,`makeEdge`/`formatEdgeId` 投影为边;`relationForHandles(...,["writable"])` 表驱动判定连线合法性;`extraNodeKinds:["endpoint"]` 让 endpoint 满足任意 outbound 目标(共享命名空间)。改名经 `renameTag` 级联重写所有引用并重映射选区/布局键;删除经 `removeRegisteredTagReferences` 清扫。

3. **Schema 覆盖到顶。** 已核实:inbound 18、outbound 20(wireguard/dns 正确设为 `creatable:false` 仅供导入)、dns-server 14、endpoint 2、service 6、rule-set 3,与上游 doc 树逐一对应。深层嵌套对象(reality/ech/utls/acme/dns01 三家 provider、V2Ray transport 按变体 gated、multiplex+tcp-brutal、QUIC、tun route_address_set、settings 全树)均有结构化控件——`schemaRegistry.ts` 只声明组**名称**,真正的字段 schema 在 `sharedFields.tsx`,这是数字摘要误判"仅 JSON"的根因。

4. **异常强的测试网。** `no-silent-unreachable-fields.test.tsx` 含**防虚构**断言(每个 `INLINE_RENDERED_KEYS` 必须对应真实 `updateField(...)` 字面量)与咬合的负例;`domain.test.ts` 断言 9 个模板按 channel 零 error 诊断;`registry-parity`/`reference-visitor-op-parity` 绑定两套引用注册表。把"无字段静默不可达"提升为**可证明属性**。

5. **导出硬闸门 + 字段级敏感处理。** 任何 `level==="error" && source==="semantic"` 诊断阻断导出(已核实 `exportConfig.ts:41`);敏感键(password/uuid/token/...)自动用 `SensitiveTextField` 遮蔽。

---

## 4. 关键差距与风险(按严重度分组)

### 🔴 Major(影响"能过 sing-box check"这一核心 done-bar)

**M1. 导出闸门只近似、未证明能通过 sing-box check。**
- 证据:`exportConfig.ts:41`(只阻断 semantic error);`diagnostics.ts:194` 起约 2000 行手写探针;**全代码库无 ajv/json-schema/解码器**(grep 零命中);`validateScalarFields` 只迭代有 `fields[]` 的行——`diagnostics.ts:122-153`。
- 风险:拼错的顶层键、未建模字段、错形嵌套对象均不被捕获,过闸门 ≠ 二进制接受。
- 建议:当 `VITE_OFFICIAL_CHECK_URL` 配置时,把官方二进制 check 升为权威预导出校验(其 error 也阻断导出,按目标 OS 限定);未配置时在 UX 文案明示"仅启发式校验"。中期由 doc 树生成 JSON-Schema 做确定性 unknown-key/shape 校验。

**M2. 枚举/类型校验仅覆盖 inbound/outbound;dns-server/endpoint/service/rule-set 是有意 no-op。**
- 证据:`diagnostics.ts:122-127` 注释 + `validateScalarFields`;16 处 `fields:` 全在 inbound(141-431)/outbound(433-799)块内,后四类 0 处(已核实)。
- 风险:这四类实体上的错枚举/错类型标量(如 `server_port:"853"` 字符串)在本地 lint 通过却被二进制拒绝;主要在导入/手写 JSON 时触发(GUI 工厂总产出正确类型)。
- 建议:为高价值行补 `fields[]`(dns-server `server_port` number / `type` enum / `strategy` enum 等),渲染器与校验器已能消费。

**M3. 必填凭证字段未校验——导入时假通过。**
- 证据:`diagnostics.ts:816-846` 只检 server/server_port;`:1062-1093` 仅 vmess/vless uuid;**无** shadowsocks(method/password)、trojan(password)、tuic-out(uuid)必填检;`requiredFields` 机制仅 cloudflared `token` 在用(`schemaRegistry.ts:426`)。
- 风险:导入缺凭证的配置过闸门、被二进制拒绝(GUI 新建节点有工厂默认值,故主要影响导入/清空场景)。
- 建议:仿 vmess/vless uuid 检,把上述必填以声明式 `requiredFields` 落到注册表。

**M4. 字段级 `since` 从不强制——naive `quic_congestion_control`(since 1.13)漏到 1.12 Legacy 目标。**
- 证据:`SchemaFieldMeta.since` 存在(`schemaRegistry.ts:60-63`)但 `validateFieldMeta`(`diagnostics.ts:84-120`)只看 option 级 `since`,从不读 `meta.since`;已核实该字段 `schemaRegistry.ts:253` 声明 `since:"1.13"`,Inspector 无条件渲染。
- 建议:在 `validateFieldMeta` 增加 `meta.since`/`meta.channel` 检查,补 `version-gate-validity-gaps.test.ts` 回归。

**M5. 1.14-only 的 `mdns` DNS-server 类型零版本门。**
- 证据:已核实 `diagnostics.ts` 全文 `mdns` 0 次命中;`schemaRegistry.ts:887-896` 标 `creatable:false`+`channel:"testing"`(GUI 不可建),但导入路径 `normalizeConfig` 不校验/不剥离 `type`,导出干净。
- 风险:导入带 `type:"mdns"` 的配置在 1.12/1.13 stable 目标零诊断、导出干净、被二进制拒绝;与已正确 gated 的 cloudflared(`diagnostics.ts:1326`)形成不一致。
- 建议:仿 cloudflared 加 dns-server 类型版本门;更好是用 `TYPE_MIN_VERSION` 跑一个通用循环,覆盖所有可选 kind/type。

### 🟡 Minor

**m1. legacy DNS server `address_resolver` 引用全程未追踪——改名静默断链。**
- 证据:上游 `dns/server/legacy.md:75-79` 定义其为 dns-server→dns-server 引用;**src 中 `address_resolver` 0 次命中**(已核实,仅有 `domain_resolver`);不在 `referenceRegistry`、`handledFields`、`portRelations`、`graph.ts` 边。rename/delete 级联完全依赖注册表,故该引用既不重写也不清扫。
- 注:legacy 已是 `creatable:false`、1.14 移除,仅影响导入的 stable/oldstable 配置;字段仍可在 Advanced 回退编辑(非静默不可达)。
- 建议:把 `*/address_resolver` 加入 `visitDnsServerRefs`,legacy 分支加 Address Resolver 选择器。

**m2. 可视化上限静默丢边;rule-set >24 整体隐藏。**
- 证据:`graph.ts:35-37,272`——`MAX_VISUAL_RULE_SET_NODES=24`,`visualizeRuleSets=ruleSets.length<=24` gate 掉整个 rule-set 节点/边块;候选边 `MAX_VISUAL_CANDIDATE_EDGES=96` 静默丢弃,无溢出提示节点。
- 影响:内置的 **1.14 社区模板含 30 条 rule_set**(`templates.ts`),一次套用即静默丢掉全部 30 个 rule-set 节点及其边(route/dns 规则上限有"+N not visualized"提示,rule-set 没有)。配置生成本身不受影响(规则仍在表中正确序列化)。
- 建议:提高/移除 rule-set 上限,或显示被抑制边的聚合计数 + 每规则未绘制 `rule_set` 徽标。

**m3. 数处真实引用 Inspector-only、无拖拽连线。**
- 证据:`referenceRegistry`(40 路径)与 `portRelationRegistry`(29 路径)集合差:`inbounds/*/detour`、`handshake/detour`、`mesh_with/*/detour`、`tun route_address_set`、`route/default_domain_resolver`、`selector/*/default`、`v2ray_api.stats.*` 均级联安全但无边。
- 建议:对高价值者(`route.default_domain_resolver`、`tun route_address_set→rule-set`)补 PortRelation;深层 handshake/mesh detour 保持 Inspector-only 并在图例说明。

**m4. 时长/尺寸/地址标量为无校验自由文本。**
- 证据:`ruleInspectors.tsx:132-135`(Sniff Timeout)、`endpointInspector.tsx:130-141`(Persistent Keepalive)等均为裸 `<input type="text">`;`diagnostics.ts` 无通用 duration/host/URL 格式校验(grep 零命中 ParseDuration)。
- 建议:加轻量 Go-duration/byte-size 格式校验(warning 级),并在 UX 文案把官方二进制 check 标为真正兜底。

**m5. 内联 JSON-apply/裸 config 导入丢失画布布局。**
- 证据:`useProjectStore.ts:1662,1708` 用 `freshLayoutState` 清空 `layout.positions`;仅 `.sbcv` 路径(`serialization.ts:166`)保留。注:原始 JSON 标签页 Apply 路径已是死代码,`.sbcv` 的 UI 也已在 #197 移除,故实际可达的只有"重新导入裸 config 丢手动布局",影响窄。
- 建议:Apply 时对结构未变的存活节点 id 保留位置,仅真正结构替换/文件导入才全量重置。

### ℹ️ Observation(正向/已知设计缝)

- **扁平 rule-level action/server/outbound 建模是正确的**——匹配 sing-box 的 flattened `rule_action`(`commands.ts:233-278` 的 action-gate 正确)。
- **导入时静默清洗 action-不匹配的规则键**(`serialization.ts:68-71`)是 A10d 有意边界裁剪,只影响手写畸形配置,无有效数据丢失。
- **裸 config 以 `sbcv_` 前缀文件名下载**、`createConfigExport` 声明的 `fileName:"config.json"` 运行时未用(仅被单测引用)——命名混淆,非正确性缺陷。
- **dial `domain_strategy` 在 1.14 仅警告**——上游信号矛盾(doc 说"将在 1.14 移除"但 schema 仍保留),保持警告合理。

---

## 5. "纯 GUI 可达性"专项分析

**核心问题:一个用户不碰任何手写 JSON,能构建 sing-box 配置的哪些部分?**

### ✅ 纯 GUI 可完整构建(点击/拖拽/结构化编辑)

- **全部协议节点的创建与基本字段**:18 inbound / 18 可建 outbound / 12 可建 dns-server / 2 endpoint / 6 service / 3 rule-set,均经 Palette **点击添加**(注:**无 HTML5 拖放**,Palette 零 drag 处理器,已核实;"拖拽"仅指画布上端口→端口连线)。
- **深层嵌套对象**:TLS(含 reality/ech/utls/acme + 三家 dns01 provider)、V2Ray transport(按变体 gated)、multiplex+tcp-brutal、QUIC、dial/listen、inbound `users[]`(13 种协议含 Generate-UUID)、WireGuard `peers[]`(含 reserved 3 字节校验)、`v2ray_api.stats`、tun 全字段、log/ntp/certificate/experimental 全树——**全部结构化**(`sharedFields.tsx:211-320` 等)。
- **跨对象引用**:selector/urltest 成员、route/dns 规则的 outbound/server/inbound/rule_set、各类 detour、domain_resolver、route.final/dns.final——既可**画布拖拽连线**也可 **Inspector 选择器**设置。
- **顶层 route/dns 规则的完整匹配集**:`RuleAdvancedFields` 渲染 28-31 个匹配器(`ruleControls.tsx:73-136`)。
- **覆盖保证**:任何未被结构化控件认领的键都落到 Advanced 回退(标量→可编辑输入,对象/数组→parse-safe JSON 子编辑器),由 C17 守卫证明**无字段静默不可达**。

### ⚠️ 被迫回退到 JSON(子编辑器内手写,但可往返)

- **内联 rule-set / 逻辑规则体**:只结构化约 **10/24** 个 headless 匹配字段(`ruleControls.ts:141-151`);其余(`source_port_range`、`process_path`、`package_name`、`network_type`、`wifi_ssid` 等)与深度 >3 的逻辑嵌套只能走"Edit rules as JSON"。**这是最大的 JSON 尾巴**,因为社区模板重度依赖 geosite/geoip rule-set。
- **多态/嵌套对象**:hysteria2 `masquerade` 对象形态(`inboundSectionsB.tsx:431-447`)、ssm-api 多路径 `servers` 映射(`serviceInspector.tsx:95`)、cloudflared `control_dialer`/`tunnel_dialer`、内联对象形态 `http_client`。

### ❌ 纯 GUI 完全不可达(必须外部编辑 JSON 后导入)

- **未默认化的协议调优标量**:vmess `global_padding`/`authenticated_length`、hysteria/tuic `recv_window*`/`disable_mtu_discovery` 等——Advanced 回退**只渲染实体上已存在的键**(`helpers.ts:56-72`),工厂不种这些键,故从零建节点时**无任何 GUI 控件**;且**应用内无可写 JSON 编辑器**(`ConfigJsonViewerDialog` 只读),唯一入口是外部编辑器写好后 Import。
- **`creatable:false` 类型**:wireguard/dns outbound、legacy/mdns dns-server——仅能通过导入既有配置存在。

**结论量化:主流代理/DNS/路由配置(约 85-90% 真实配置)可纯 GUI 完成;剩余尾巴是高级 rule-set 匹配字段、几个 niche 多态对象、以及少数从未默认化的调优标量。**

---

## 6. 改进路线建议(按优先级)

### P0 — 收紧"能过 check"的正确性保证(直击 done-bar)
1. **把官方二进制 check 升为权威闸门**:配置了 `VITE_OFFICIAL_CHECK_URL` 时,其 error 也按目标 OS 阻断导出(M1);未配置时 UX 明示"仅启发式校验"。
2. **补必填凭证校验**:shadowsocks(method/password)、trojan(password)、tuic-out(uuid),驱动自声明式 `requiredFields`(M3)。
3. **修三处版本门**:`validateFieldMeta` 强制 `meta.since`/`meta.channel`(M4);`mdns` 加入 `TYPE_MIN_VERSION` 并加通用类型版本门循环(M5);`certificate.store:"chrome"` 在 1.12 升为 error。

### P1 — 把最大的 JSON 尾巴变成结构化编辑
4. **内联 rule-set 复用 `RuleAdvancedFields`/`SharedRuleFields`**(代码已存在,top-level 规则已验证),让内联/逻辑规则体获得同样的匹配字段覆盖,并提高/移除 `MAX_INLINE_RULE_DEPTH=3`(M2 之交互面)。
5. **为后四类实体补 `fields[]`**(dns-server/endpoint/service/rule-set),一次性把 enum/type 校验扩展到这些 kind(M2)。

### P2 — 补图保真度与可视化
6. **修 `address_resolver` 完整性漏洞**(m1):加入 `visitDnsServerRefs` + legacy 分支选择器。
7. **提高/移除 rule-set 24 上限或加溢出提示节点 + 未绘制 rule_set 徽标**(m2)。
8. **为高价值 Inspector-only 引用补 PortRelation 边**:`route.default_domain_resolver`、`tun route_address_set→rule-set`(m3)。

### P3 — 补未默认化标量与体验
9. **Advanced 回退改为"已存在键 ∪ 上游 doc 字段表"驱动**,为每个文档标量渲染可添加的空控件,或扩工厂/结构化控件覆盖剩余调优标量(消除"从零不可达"尾巴)。
10. **加 duration/byte-size 格式校验(warning)**(m4);Apply 时对结构未变节点保留布局位置(m5)。

### P4 — 架构整合债(强测试网已遏制,非紧急)
11. **引用图三处枚举收敛为一处**:让 diagnostics 的 missing-* 检查由 `referenceRegistry.paths` + 命名空间 tag 索引通用驱动,或加第三条 parity 断言。
12. **`togglePortConnection`(500 行/124 分支)改为查 `portRelations` + 复用 `adapterConnect`**,加 toggle 路径的 symmetry 测试,使其与拖拽路径不再分叉。
13. **Inspector 闭合枚举/简单标量收进 `SCHEMA_ROWS.fields` 并数据驱动渲染**,既去重内联枚举又免费扩展校验覆盖。

---

**一句话总评:** 这是一份架构纪律良好、覆盖到顶、被强测试网保护的实现——JSON 的 workflow 化对主流配置已经成立。要把"纯 GUI 生成任意有效配置 + 保证过 check"从 85-90% 推到接近完整,关键不在推倒重来,而在 P0 收紧正确性保证(官方 check 升权威闸门 + 必填/版本门补洞)与 P1 把内联 rule-set 这条最大 JSON 尾巴结构化——这两步都能复用已有机制,代价可控。