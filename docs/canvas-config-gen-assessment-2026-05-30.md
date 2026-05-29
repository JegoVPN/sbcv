<!--
生成方式:多 agent workflow 评审(sbc-canvas-config-gen-review)
- 阶段:理解上游 schema(10 类别 digest)∥ 理解实现(9 子系统 digest)→ 六维评审 → 逐条对抗验证 → 综合
- 规模:73 agents,~360 万 token,1190 次工具调用
- 发现:47 条,44 条经独立验证确认,3 条被证伪剔除
- 主回合已抽查 G1/G2/G3/G9-G11 的 file:line 证据,全部命中真实代码
- 日期:2026-05-30
-->

# sbc-ui 最终架构评估:JSON 的 workflow 化是否真正实现?

## 1. 总体结论

**设计方向合理,核心架构扎实,但"纯点击/拖拽/简单编辑即可生成完整有效配置"的目标只达成约 60-70%。**

整体评分:**adequate(良好)**——接近 strong,被字段级覆盖缺口与版本门控精度问题拖住。

直接回答核心问题:

- **能否仅通过点击/拖拽/简单编辑生成 sing-box 配置?** 对**常见配置**(若干 inbound/outbound + selector/urltest 分组 + 路由规则 + 简单 DNS)——**能**,可全程 GUI 完成,这正是设计想覆盖的主路径。
- **是否真正实现了 JSON 的 workflow 化?** 在**结构骨架层面真正实现了**:配置对象本身就是唯一事实源,图/检查器/JSON 是它的单向投影,引用图被忠实建模为边,序列化是恒等构造。但在**字段细节层面有明确缺口**:一批主流构造(V2Ray 传输层 headers、inbound TLS 服务端 ACME、certificate_providers、嵌套逻辑规则)在 GUI 中完全不可达,只能落到整份配置的原始 JSON 文本框。
- **是否合理?** 合理。所有未建模的内容都会回退到原始 JSON 逃生口,因此**没有任何配置是不可表达的**;真正的问题是"不可表达"与"不必手写 JSON"之间的差距——后者尚未完全闭合。

一句话:**地基牢固、骨架可达,字段细节与版本精度是收尾工程,而非推倒重来。**

---

## 2. 六个维度评分

| 维度 | 评分 | 一句话判断 |
|------|------|-----------|
| **schema-coverage 协议覆盖** | adequate | 协议/章节覆盖广且基本准确(~17/18 inbound、18/20 outbound、12/14 DNS server、全部 endpoint/service/rule-set/规则动作),真正的洞在嵌套对象的**字段级**(尤以 transport 子字段为甚),以及两类"能编辑能校验却无创建入口"的实体。 |
| **graph-fidelity 图保真度** | adequate | 引用图主干(selector/urltest 成员、route/dns 规则、final、顶层 detour)忠实且双向,24 端口关系 1:1 映射规范指针;边缘漏水——一整类 dial 内嵌与嵌套引用(domain_resolver、selector.default、listen.detour、handshake/mesh detour、http_client、tun route_address_set)无法作为边表达,且校验只验结构成员、从不验语义合法性。 |
| **interaction-completeness 交互完整度** | adequate | **不能**全程 GUI。引用图与常见标量/凭证/列表覆盖良好,但 V2Ray 传输层 headers、inbound TLS ACME、certificate_providers、嵌套逻辑规则等主流非冷门构造离开整份 JSON 文本框就不可达。估计约 60-70% 真实配置可纯 GUI 完成。 |
| **serialization-correctness 序列化正确性** | **strong** | 以配置对象为中心、结构健全:graph→JSON 恒等构造,JSON 往返字节无损(220 样例验证),导出 prune 保意义;主要缺口是移动端导出未门控、全局作用域的 duplicate-tag 误报,以及 prune 后的导出从未再对真实二进制复检。 |
| **version-targeting 版本目标** | adequate | 常见路径端到端接线正确(setTarget 把 {channel, version} 线程进 validateConfig,节点徽章用 atLeast 做 1.13/1.14 类型门控),但 diagnostics.ts 几乎都按裸 `channel === "stable"` 判断而非线程化的 version,无法区分 1.12 与 1.13,使 1.13-only 构造在 1.12 Legacy 目标静默通过。 |
| **architecture-soundness 架构健全性** | adequate(趋向 strong) | 单一可变 config 对象即字面事实源、序列化恒等、图/检查器单向投影,GUI 数据层面无法与导出 JSON 漂移;端口/引用注册表是真正单源抽象;98 文件强测试网弥补无声明式 schema。两处结构性弱点:协议知识手工散落 8-9 文件、3700 行单体 Inspector 含约 60 内联类型分支——都抬高改动成本但不破坏设计。 |

---

## 3. 设计亮点:节点/边/端口 + 注册表设计做对了什么

### 3.1 配置对象即唯一事实源(最扎实的地基)

store 的 `config: SingBoxConfig`(useProjectStore.ts:132)就是逐字的 sing-box JSON 文档,以普通 JS 对象持有,**不存在独立的节点/边数据结构**。节点与边都由 `deriveGraph(config, layout, diagnostics)`(graph.ts:393)在每次渲染时从 config **纯派生**。因此:

- **graph→JSON 是恒等构造**:导出即 `JSON.stringify(config, null, 2)`(serialization.ts:87-89),图不可能与 JSON 漂移。
- **JSON 往返字节无损**:在 220 份真实样例上验证(external-fixtures.test.ts,fixtures/external/manifest.json),未建模/未知字段靠 `[key: string]: unknown` 索引签名 + structuredClone 逐字保留(types.ts:16,71,82,107,123;serialization.ts:63)。
- 唯一的非 config 状态是 layout(画布坐标),与 config 严格分离(types.ts:126-136)。

### 3.2 引用图被忠实且双向建模

跨对象引用(sing-box 中是标签字符串,非指针)被反向工程为边:24 个端口关系 1:1 映射到规范 JSON 指针(portRelationRegistry.ts:106-133)。selector/urltest 成员、route/dns 规则→outbound/server/rule_set/inbound、final、各类顶层 detour 都正确建模,且端点(endpoint)正确共享 outbound 命名空间(`outboundTargetNodeId` + extraNodeKinds,graph.ts:410),规则动作门控正确抑制非路由动作上的 outbound/server 边。

### 3.3 端口/引用注册表是真正的单源抽象

- 端口由 `portRelations` 派生而非硬编码(SbcNode.tsx:116-122);边身份、合法性、断开、createTarget 全部从这一个数组流出。
- 重命名/删除通过 `referenceRegistry`(8 种 ReferenceKind、40 条路径,referenceRegistry.ts:369-426)级联,**即使未绘制的引用**(domain_resolver、selector.default、handshake.detour)也保持一致——引用层是绘制层的**严格超集**。

### 3.4 异常强的测试网弥补了无声明式 schema

98 个测试文件,其中关键的几个具有"契约"性质:
- `config-doc-capability.test.ts:191-204` 遍历每份官方文档,断言每份都有矩阵行 + 非空实现 + palette 入口。
- `domain.test.ts:407-415` 断言引用覆盖用例 == referenceRegistry 路径(向注册表加路径会让测试失败直到补用例)——这是让引用层对活注册表防漂移的真正机制。
- `port-interaction-symmetry.test.ts:260-275` 断言覆盖的关系 == 每条可写注册表关系,且 chip 创建 == 拖拽连接收敛。

### 3.5 序列化与校验门控

- 导出 prune(`pruneExportNoise`,serialization.ts:96-116)保守、保意义、幂等:只删空字符串/空数组键,保留 false/0/null/空对象,从不删数组元素。
- 创建时种子化必填字段(commands.ts:101-455)**且**以 error 级强制(diagnostics.ts:636-724 等),使应用内创作的配置有意义地受校验门控。

---

## 4. 关键差距与风险(按严重度分组)

### 4.1 Major — 字段/实体级硬缺口(影响"纯 GUI 可达性")

**G1. V2Ray 传输层子字段完全不可达(最重要的单一交互缺口)**
- 证据:transport 编辑器只暴露 type/host/path/service_name/idle_timeout/ping_timeout 六项(Inspector.tsx:1776-1785),而 `transport` 同时在 inboundHandledFields/outboundHandledFields(Inspector.tsx:124,168);editableNonScalarFields 排除 handled 键(Inspector.tsx:324-331),导致整个 transport 对象既无结构控件、**也不落到 AdvancedNonScalarFields 的 JSON 回退**。
- 缺失字段(docs/upstream/.../shared/v2ray-transport.md):http.method、http/ws/httpupgrade.headers、ws.max_early_data、ws.early_data_header_name、grpc.permit_without_stream。
- 影响:CDN/Cloudflare 前置的 vmess/vless/trojan over ws/http 常需自定义 Host 与认证 headers,唯一出路是改整份配置 JSON。
- 建议:给 v2ray-transport 共享组加 headers 键值映射编辑器 + 缺失变体字段;或更省事地把 transport 移出 handledFields 让其落到 JSON 回退。同样审查 tls/multiplex/dial 的"枚举但不完整"子对象。

**G2. certificate_providers 任何通道都无法创建**
- 证据:palette 四项硬编码 `status: "gated"`(Palette.tsx:173-176);itemStatus 对 cert-provider 类无 testing 通道豁免,canActivate 排除 "gated"(Palette.tsx:348-356);提示语却说"切到 testing 即可创建"(Palette.tsx:341)——**误导**。commands.ts 无 addCertificateProvider,createFromPalette(useProjectStore.ts:972-1066)无 cert-provider 分支,sharedFieldDefinitions 对该组返回 []。
- 影响:已完整支持编辑/校验/重命名/删除/连边,却只能靠导入原始 JSON 创建。
- 建议:加 createCertificateProvider + createFromPalette 分支(按 channel==='testing' 门控)+ 按 provider 类型的结构编辑器;至少先把提示语改为"暂不可创建"而非"需要 1.14"。

**G3. cloudflared inbound 在 testing 通道死点击**
- 证据:testing 通道按钮可点(Palette.tsx:210,325-326,348-356),但 createFromPalette 的守卫 `inboundType && inboundType !== "cloudflared"`(useProjectStore.ts:998)为假,无其他分支匹配,返回未改 config 且无 toast——静默无效。且 tests/inbound-cloudflared.test.tsx 只断言按钮渲染、从不点击,使死点击在 CI 下逃逸。
- 建议:移除该排除项,改为按 channel==='testing' 门控(对齐 http-client/hysteria-realm),让已能编辑/校验的按钮真正创建节点。

**G4. inbound TLS 服务端 ACME 无结构编辑器**
- 证据:TLS 共享组无 acme 字段(Inspector.tsx:1696-1738);`tls` 在 handledFields 故整个 tls 对象(含 tls.acme)被排除出 Advanced JSON 回退;唯一的 ACME UI 是弃用横幅(Inspector.tsx:5618-5629)。其推荐替代 certificate_providers[] 也不可创建(见 G2)。
- 影响:ACME/Let's Encrypt 是公网 TLS 服务端的标准生产路径,GUI 零结构入口。
- 建议:给服务端 TLS 组加 acme 子段(domain 列表、email、provider 选择、data_directory)+ dns01-challenge 结构编辑器;至少把 tls.acme 排出门控让其落到 TLS 卡内的 JSON 回退。

**G5. 嵌套逻辑(and/or)规则仅 JSON 可达**
- 证据:顶层规则可切到 logical 并选 and/or(Inspector.tsx:1135-1159,1360-1384),但子规则编辑器 InlineRuleSetEditor 对 type==="logical" 的子项只显示提示"在 JSON 模式编辑其嵌套规则"(Inspector.tsx:824-825),并无"把子项转为嵌套逻辑规则"的控件;唯一出路是 InlineRulesJsonField 原始 JSON(Inspector.tsx:862-911)。
- 建议:让 InlineRuleSetEditor 递归化,为子逻辑规则渲染嵌套编辑器。

**G6. 无声明式协议 schema:协议知识手工散落 8-9 文件(架构)**
- 证据:无 PROTOCOL_SCHEMA/protocolRegistry;protocols.ts 仅 palette 映射 + CREATABLE 列表;每个协议(如 anytls)被 9 个源文件引用(iconRegistry/nodeLabels/Inspector/Palette/commands/diagnostics/protocols/sharedFieldRegistry/templates);commands.ts 65 处 `type ===`、diagnostics.ts 38 处、Inspector.tsx 约 60 处 `entityType ===`;必填性在 diagnostics 内以散落的局部 Set 重复编码。
- 影响:新增协议/字段是宽泛、手工、易漂移的改动,只能事后被测试兜住。
- 建议:引入单一声明式协议描述表(per type:默认值、必填字段、枚举、共享组成员、version-added、deprecated-in),从中派生工厂默认值、sharedGroupsForEntity、palette CREATABLE 列表与基础必填校验。这是面向目标的最高杠杆重构。

**G7. 三个跨对象引用无边可视化(图保真度)**
- domain_resolver(outbound/endpoint/dns-server→dns-server):无端口/边,仅作 dns-server 标签下拉框(Inspector.tsx:1624,1658),**1.14 起变为必填**,是最安全关键的跨对象引用——好在 diagnostics.ts:542-549/1364-1370 有 1.14 缺失警告兜底。
- detour 边指向 endpoint 渲染不出边:六个 dial 式 detour 硬编码 `outbound:${tag}`(graph.ts:684,857,944,973,998,1015),而 dns-server-detour 已用 outboundTargetNodeId 正确支持 endpoint——非对称,修复方案已存在却未传播。
- http_client 引用不可见:http-client 节点无任何端口、永远漂浮(portRelationRegistry.ts 仅第 13 行枚举出现);而它替代的 download_detour 反而被画成边——非对称。
- 建议:让所有 detour 边走 outboundTargetNodeId;给 domain_resolver/http_client 加可写端口关系。

**G8. 移动端导出绕过校验门控(序列化)**
- 证据:桌面导出有 error 级软门控(window.confirm,TopBar.tsx:144-163),移动端导出完全无门控(MobileMenuSheet.tsx:30-40)直接调 createConfigExport。
- 建议:抽出 error 门控为共享 helper,两条导出路径都调用。

**G9-G11. 版本目标三连(version-targeting)**
- **1.14 已移除的 legacy DNS server / dns.fakeip 仅警告非错误**:diagnostics.ts:498-509、1209-1221 是无版本门控的 warning,即使在 testing(1.14)目标下、即使自己的消息写着"removed in 1.14.0"。真实二进制在 1.14 会直接拒绝。建议:`atLeast(version,'1.14')` 时升为 error。
- **1.13-only naive outbound 在 1.12 Legacy 目标无诊断**:createFromPalette 任何目标都创建 naive outbound(useProjectStore.ts:1042-1043),diagnostics 无 atLeast 门控,仅标题徽章警告;summarizeDiagnostics 因无 error 而判 valid/warning 可导出,而 1.12 二进制会拒绝。建议:仿 ccm/ocm 模式加 `!atLeast(version,'1.13')` 错误。
- **普遍 `channel === "stable"` 门控无法区分 1.12 与 1.13**:diagnostics.ts:47 硬编码 `version = channel === "stable" ? "1.13" : "1.14"`;真正 1.13-added 字段(kTLS、client_authentication、curve_preferences、naive quic_congestion_control、dns prefer_go、route bypass、interface_address 族)无 1.12-vs-1.13 门控,在 1.12 Legacy 目标静默通过。建议:把粗粒度 channel 门控换成精确的 `!atLeast(version, 'X.Y')`。

### 4.2 Minor — 局部正确性/UX

- **duplicate-tag 全局作用域误报**:buildTagIndex(indexes.ts:73-81)仅以标签字符串为键,跨命名空间(inbound 与 outbound 同名)被误报为 error,触发桌面导出软门控;而 sing-box 实际接受跨命名空间复用。建议:按引用命名空间分别检测。
- **proxy server_port 必填检查在 hysteria 端口跳跃(server_ports)上误报**(diagnostics.ts:643-656):仅 ssh 有例外,其他 type 缺标量 server_port 即报 error,但 server_ports-only 是合法的。建议:仿 ssh 例外,存在非空 server_ports 时跳过。
- **嵌套 dial 引用、selector.default、preferred_by/auth_user、规则 map 值字段(interface_address)** 仅作字段编辑、不可作边,部分 rename 未跟踪(referenceRegistry 不含 auth_user/preferred_by 路径,会产生静默悬挂引用)。
- **画布坐标在普通 JSON 导出/导入时静默丢失**(SbcProject 包装类型定义了但从未序列化,types.ts:130-136)。建议:提供项目级 save/load 同时序列化 config+layout。
- **无 cycle/duplicate 检测**:isValidConnection(CanvasWorkspace.tsx:269-279)纯结构验证,多跳 detour/selector 环可干净连接,拒绝 toast 文案泛化、从不说明失败约束。

### 4.3 Minor — 架构维护热点

- **两套手工开关影子化注册表 canonicalPath**:写路径 connectDirectedPortReference(useProjectStore.ts:632-787)与读路径 isPortConnected(graph.ts:200-373)各自手写映射,canonicalPath 字段实为惰性(无消费者)。每加一条可写关系需协调编辑 4 处。建议:从注册表 canonicalPath + 小适配器驱动两路。
- **Inspector.tsx 单体**(5641 行,主组件 1957-5641 约 3684 行,约 60 内联类型分支)。建议:按实体种类拆分组件,配合声明式描述表让标量/枚举字段从数据渲染。

---

## 5. "纯 GUI 可达性" 专项分析

### 5.1 可纯 GUI 构建(无需手写 JSON)

- **节点创建与连线**:从 palette 点击创建 inbound/outbound/dns-server/endpoint/service/rule-set/规则;端口拖拽或点 "+" 经 chip picker 创建并连接。
- **引用图接线**:selector/urltest 成员(多选清单)、route/dns 规则→outbound/server/rule_set/inbound、final、顶层 detour(下拉框/清单)、endpoint 检测、ssm-api 托管映射——全部边/字段可达,重命名级联无损。
- **凭证与重复行编辑**:Add user(13+ 协议,Inspector.tsx:3374-3473,含 Generate UUID、vless flow 枚举)、Add peer(WireGuard,Inspector.tsx:4855-4932,可加第二个 peer)、SensitiveTextField 密钥。
- **共享块**:tls(服务端/客户端拆分)、dial、listen、multiplex、brutal、QUIC、http2 的枚举字段(min/max_version、client_authentication、utls fingerprint、congestion_control 等)。
- **常见标量/枚举**:ss method、vless flow、resolve strategy、network_strategy、tuic congestion_control、dns rcode 等。
- **导出**:prune-on-export 保意义、error 级软门控(桌面)。

**结论:一份典型配置(几个 inbound/outbound + 一个 selector/urltest + 几条路由规则 + 简单 DNS)可全程 GUI 完成。**

### 5.2 被迫落到原始 JSON 或完全不可达

| 构造 | 状态 | 唯一出路 |
|------|------|---------|
| V2Ray 传输层 headers / ws max_early_data / http method / grpc permit_without_stream | 完全不可达(无控件无 JSON 回退) | 整份配置 JSON 文本框 |
| inbound TLS 服务端 ACME(自动签证) | 仅弃用横幅,无编辑器 | 整份配置 JSON 导入 |
| certificate_providers(声明、门控、但永不可创建) | 无创建命令,palette 误导 | 整份配置 JSON 导入 |
| 嵌套逻辑(and/or)规则 | 顶层可,嵌套子规则 JSON-only | 规则 JSON 模式 |
| dns01-challenge / ACME 结构编辑 | sharedFieldDefinitions 返回 [] | 原始 JSON |
| 共享对象内未枚举子键(tls/multiplex/dial) | 父键 handled,子键无控件无回退 | 整份配置 JSON |
| 规则 map 值字段(interface_address / network_interface_address) | 无控件,规则检查器不调 AdvancedNonScalarFields | 外部编辑后重导入 |
| 任意未建模字段 | 落到 AdvancedNonScalarFields 的 JSON 回退(per-node) | per-node JSON 字段(部分) |

**结论:约 60-70% 真实配置可 100% 纯 GUI;其余至少有一个字段必须落到原始 JSON 逃生口。**

### 5.3 关键安全注意

GUI 可表达 ≠ sing-box 接受。无 JSON-schema/必填强校验(serialization 仅做容器形状断言),validateConfig 是约 2000 行手写顾问式 linter(从不阻断,仅桌面软 confirm);唯一权威门是可选的、env 门控的官方二进制检查(VITE_OFFICIAL_CHECK_URL,生产 .env 已配 https://api.sbcv.app)。且 prune 后的导出从未再喂给二进制(任何代码路径都喂的是 live config 而非 pruned export)。

---

## 6. 改进路线建议(按优先级)

### P0 — 最高杠杆(直接闭合 GUI 可达性缺口 + 降低改动成本)

1. **引入声明式协议描述表**(G6):per type 的默认值/必填/枚举/共享组成员/version-added/deprecated-in,从中派生工厂、sharedGroupsForEntity、CREATABLE 列表、基础必填诊断。让 config-doc-capability 测试对数据而非散落代码断言。这同时降低后续每一项的实施成本。
2. **修复 transport headers 等子字段**(G1):加 headers 键值映射编辑器 + method/early-data/permit_without_stream 控件;或先把 transport 移出 handledFields 作为廉价过渡。
3. **加 certificate_providers 创建路径 + ACME 结构编辑器**(G2、G4):createCertificateProvider + createFromPalette 分支(testing 门控)+ 按 provider 类型编辑器;给服务端 TLS 加 acme 子段。

### P1 — 正确性收敛

4. **版本门控精确化**(G9-G11):把 `channel === "stable"` 粗门控换成 `!atLeast(version, 'X.Y')`;1.14 已移除的 legacy DNS/fakeip 在 1.14 目标升为 error;补 naive outbound 的 1.13 门控。复用 nodeLabels.MIN_VERSION 作为单一事实源,消除徽章/linter 分歧。
5. **修死点击 + 误导提示**(G3):移除 cloudflared 排除项;补点击断言测试。
6. **统一导出门控**(G8):抽共享 helper,移动端复用。
7. **修 duplicate-tag 跨命名空间误报、hysteria server_ports 误报**(4.2)。

### P2 — 结构与体验

8. **detour/domain_resolver/http_client 改为可写端口关系**(G7):全走 outboundTargetNodeId,消除 endpoint 目标渲染不出边的非对称。
9. **递归化逻辑规则编辑器**(G5)。
10. **从注册表驱动读/写两路开关**(4.3):消除 connectDirectedPortReference 与 isPortConnected 的并行漂移面。
11. **拆分 Inspector 单体**(4.3),配合 P0 描述表让多数字段从数据渲染。
12. **CI 加一步**:对内部 fixtures 跑 createConfigExport 并把 **pruned 导出**喂给真实 sing-box 二进制,闭合"应用实际输出 ↔ 二进制接受"的回路。
13. **项目级 save/load** 保留画布坐标(4.2)。

---

**总评:这是一个方向正确、地基异常牢固的实现——配置即事实源 + 引用注册表 + 强测试网,使"JSON workflow 化"在结构骨架层面货真价实。剩下的是收尾工程:把字段级覆盖洞补齐、把版本门控做精确、把两三个静默缺陷修掉。完成后即可从 adequate 稳步迈入 strong,真正逼近"绝大多数配置纯 GUI 可达"。**
