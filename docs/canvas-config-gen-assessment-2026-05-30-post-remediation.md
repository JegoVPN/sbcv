# Canvas config-gen 重评估(C0–C17 remediation 之后)

> **日期:** 2026-05-30(remediation 后复测;基线见 [canvas-config-gen-assessment-2026-05-30.md](./canvas-config-gen-assessment-2026-05-30.md))
> **方式:** 重跑 scripts/workflows/canvas-config-gen-review.workflow.js(62 agents;upstreamDigests 10 / implDigests 9 / findings 36, confirmed 35 / rejected 1)
> **代码状态:** origin/main @ C14 完成(Inspector.tsx 316 行,inspector/* 18 模块)

## 复测裁决(机器评估返回)

- **overallScore:** adequate(良好但未达强;6 维全部为 adequate,核心校验缺口是封顶项)
- **coreVerdict:** 基本合理,但"纯点击/拖拽/简单编辑即可生成完整有效 sing-box 配置"只做到约 60-70%。绝大多数真实拓扑(inbound/outbound/DNS/route/rule-set/endpoint/service 以及 TLS/REALITY/transport/multiplex/dial 等深层共享块)确实能在画布+Inspector 中端到端结构化构建,JSON 的 workflow 化在主干上是成立的;但有两类硬伤决定了它还不是"真正的"纯 GUI 生成器:(1) 没有任何 JSON-Schema/枚举/类型校验层,导出只是 JSON.stringify + 一个可被绕过的 confirm(),输出永远无法保证通过 sing-box check;(2) 仍有一条可枚举的"长尾"字段(tun mtu/strict_route、ss relay destinations、trojan fallback_for_alpn、wireguard peer reserved、对象形态 domain_resolver/http_client、深层逻辑规则、数组重排序等)必须回退到原始 JSON。因此设计方向正确、骨架健壮,但"完整且有效"这一最后一公里尚未闭合。

### 六维评分(结构化返回)
- **schema-coverage**: adequate — Coverage is broad: 59 of 63 typed schema rows are creatable (18/18 inbound, 18/20 outbound, 12/14 dns-server, 2/2 endpoint, 6/6 service, 3/3 rule-set; omissions are deprecated wireguard/dns/legacy/mdns kept reference-only). The Inspector structurally edits the nested blocks the digests called opaque (full TLS incl reality/ech/utls/acme/dns01, v2ray transport, multiplex, dial, listen, quic) plus repeaters, and certificate_providers/http_clients are creatable. All route/dns rule actions and match conditions are editable. The real gaps are a raw-JSON tail of advanced fields and the absence of any JSON-Schema/enum/structural validator, so export is never guaranteed to pass sing-box check. Adequate not strong because that validation gap is material for a pure-GUI generator.
- **graph-fidelity**: adequate — Core reference graph is faithful: high-traffic edges (selector/urltest members, rule outbound/server, rule_set, inbound matcher, detour chains, route/dns final, domain_resolver) are typed, draggable, registry-driven edges with correct cardinality, namespace sharing, and action gating. Config is the single source of truth; edges derive from tag strings and write back via the same canonical paths, so the metaphor is consistent and round-trip-safe. The leaks are peripheral: several real reference edges exist only in the rename and delete cascade and never become canvas edges, so for those the user types a tag in the Inspector with no visual link. Two weaknesses compound this: edges carry no textual label so different relation kinds between the same node pair look identical, and dangling references render as no edge (mitigated by diagnostics reddening the node, not solved). None misrepresent the schema; they are omissions and under-rendering. The metaphor is sound but leaky at the edges.
- **interaction-completeness**: adequate — GUI-only authoring is genuinely strong: the overwhelming majority of real-world configs (proxy/inbound/outbound/DNS/route/rule-set/endpoint/service topologies, plus deep shared blocks like TLS/REALITY/transport/multiplex/dial and full protocol field sets) are buildable end-to-end with structured controls and enum dropdowns — but it is NOT 100%: a handful of specific constructs force raw JSON, and (the bigger issue) nothing guarantees the GUI-only output passes `sing-box check`.
- **serialization-correctness**: adequate — Round-trip import/export is structurally lossless and the config-is-source-of-truth model means refs and ordering serialize faithfully, but the export is NOT validity-guaranteed: it is a raw JSON.stringify with no schema/AJV/binary gate by default, and the one guard (a confirm() on error-level semantic diagnostics) is bypassable and blind to entire field classes — most notably it never flags an entity missing a tag, so a referenced-but-untagged or duplicate-namespace config can export and be rejected by sing-box.
- **version-targeting**: adequate — Version targeting is implemented with real care and is largely correct: the active (channel, version) is threaded consistently into the linter, version-gated TYPES error correctly, deprecated/removed fields are warned (legacy DNS address and top-level fakeip correctly escalate warning to error at 1.14), and the 1.12-vs-1.13 distinction is genuinely modeled by ~6 field-level 1.13 gates. The gaps are consistency-not-correctness: some testing-only constructs (cloudflared type, http_clients/certificate_providers sections) only warn while siblings (hysteria-realm, naive, ccm, ocm) error, so a stable export can carry 1.14-only sections the stable binary rejects with only a soft warning; the palette gates by channel only so 1.12-stable still offers naive/ccm/ocm as creatable; and a latent setChannel bug drops the version. No path emits a silently-wrong config without at least a warning.
- **architecture-soundness**: adequate — Sound config-source-of-truth spine; knowledge re-encoded in parallel places, one drifted; tests de-risk to adequate.

### Top 优势
- config 即唯一真相源:无 graph→JSON 反序列化步骤,节点/边每次 render 从 config 纯投影,导入导出结构无损、未建模字段原样往返(serialization.ts structuredClone)
- 声明式 portRelations 注册表(34 条关系)驱动端口/边/连接合法性/规范写回路径,边自描述可逆(formatEdgeId/parseEdgeId),引用语义单点定义
- 覆盖广且准确:59/63 类型化行可创建,TLS(reality/ech/utls/acme/dns01)、v2ray-transport、multiplex、dial、listen、quic 等深层共享块均可结构化编辑(sharedFields.tsx:203)
- rename/delete 级联完整(referenceRegistry 覆盖约 40 条引用路径),改名/删除自动重写所有引用,避免悬空
- 版本门控用心:active(channel,version) 一致贯穿 linter,类型级与字段级 1.13 门控真实建模,deprecated/removed 字段按版本升级告警
- Inspector 结构化编辑器丰富:users[]/wireguard peers[]/hosts map/递归 inline rule-set(到深度 3)/selector 候选清单等均有专用 repeater,非画布字段大量被结构化覆盖

### Top 差距
- 无 JSON-Schema/AJV/枚举/类型校验层(schemaRegistry.ts:11-12 明确枚举出范围),导出仅 JSON.stringify,无法保证通过 sing-box check
- 导出软门控:confirmAndExportConfig 仅对 error 级语义诊断弹一次 confirm() 且可绕过(exportConfig.ts:39-46);官方 binary check 需配置 VITE_OFFICIAL_CHECK_URL 才生效(useProjectStore.ts:1779)
- 无任何'实体缺 tag/空 tag'诊断,仅有 duplicate-tag(diagnostics.ts:63);导入/手改 JSON 产生的无 tag 引用目标可静默导出并被 sing-box 拒绝
- 可枚举长尾字段强制原始 JSON:tun mtu/strict_route/interface_name、ss relay destinations[]、trojan fallback_for_alpn(inboundSectionsB.tsx:370)、wireguard peer reserved、对象形态 domain_resolver/http_client、深度>3 逻辑规则
- 数组顺序不可 GUI 重排:仅 route/dns rules 有 move 命令(commands.ts:319/333),selector/urltest 成员及所有顶层数组重排序需原始 JSON
- 悬空引用在画布上无边无错误节点(graph.ts outboundTargetNodeId 不校验存在性),仅诊断面板反映;边无文字标签,同一对节点间不同关系视觉无法区分(CanvasEdge.tsx:44-78)
- 版本门控一致性瑕疵:cloudflared/http_clients/certificate_providers 在 stable 仅 warn,而 hysteria-realm/naive/ccm/ocm 却 error;palette 仅按 channel 门控,1.12-stable 仍把 1.13 类型(naive/ccm/ocm)列为可创建
- 架构债务:两套引用注册表无 parity 测试(latent drift),togglePortConnection 39 分支硬编码梯子复制注册表知识(useProjectStore.ts:1044-1541),schemaRegistry 版本列休眠未消费

---

# sbc-ui 终审报告:能否仅靠点击/拖拽/简单编辑生成 sing-box 配置?

## 1. 总体结论

**评分:adequate(良好,未达 strong)——六个维度全部为 adequate。**

**直接回答:设计方向与实现骨架是合理的,但"仅通过点击、拖拽、简单编辑就生成完整有效的 sing-box 配置"目前只做到约 60-70%,尚未真正闭合"JSON workflow 化"的最后一公里。**

正面来看,这是一个架构选择正确、执行扎实的工具:

- 它以 **config(原始 sing-box JSON)为唯一真相源**,没有"图→JSON"反序列化步骤,节点/边每次 render 从 config 纯投影(`deriveGraph`,`src/canvas/graph.ts:248`),写回经类型化命令(`src/domain/commands.ts`)与注册表驱动的适配器(`src/domain/portReferenceAdapter.ts`)。这从根上保证了**往返无损、引用与顺序忠实序列化**。
- 覆盖面广:**63 个类型化 schema 行中 59 个可创建**(已核实 `SCHEMA_ROWS` 计数,4 行为 `creatable: false` 的弃用/保留类型),且 TLS(reality/ech/utls/acme/dns01)、v2ray-transport、multiplex、dial、listen、quic 等过去被认为"不透明"的嵌套块**均可结构化编辑**(`src/components/inspector/sharedFields.tsx:203`)。
- 绝大多数真实世界拓扑(代理/inbound/outbound/DNS/route/rule-set/endpoint/service)能端到端用结构化控件 + 枚举下拉构建。

但有两类**系统性硬伤**决定了它还不是"真正的"纯 GUI 有效配置生成器:

1. **没有任何 JSON-Schema/AJV/枚举/类型校验层**。`package.json` 与 `src/` 中无 ajv/json-schema 依赖(已核实),`schemaRegistry.ts:11-12` 明确写道"Enums are intentionally out of scope here"。导出是裸 `JSON.stringify`,唯一的门是一个**可绕过的 `window.confirm()`**(`src/components/exportConfig.ts:39-46`)。因此**导出永远无法保证通过 `sing-box check`**。
2. **仍有一条可枚举的"长尾"被迫回退到原始 JSON**:tun 的 mtu/strict_route、shadowsocks relay destinations、trojan fallback_for_alpn、wireguard peer 级 reserved、对象形态的 domain_resolver/http_client、深度>3 的逻辑规则、以及所有数组的重排序。

**结论一句话:workflow 化方向正确、主干健壮;但"完整且有效"这一目标因校验缺口和长尾字段而尚未达成,属于"可用且强,但未到生产级保证"的状态。**

---

## 2. 六个维度评分表

| 维度 | 评分 | 一句话判断 |
|---|---|---|
| **schema-coverage(覆盖)** | adequate | 覆盖广而准确(59/63 可创建,深层共享块可结构化编辑),但**无 JSON-Schema/枚举校验器**,导出不保证有效,这是降为 adequate 而非 strong 的决定项。 |
| **graph-fidelity(引用图忠实度)** | adequate | 高频引用边(selector/urltest 成员、rule outbound/server、rule_set、detour 链、final、domain_resolver)均为类型化可拖拽边,基数/命名空间/动作门控正确;但**若干真实引用边只存在于级联而从不成为画布边**,边无文字标签,悬空引用渲染为无边——隐喻成立但边缘有泄漏。 |
| **interaction-completeness(交互完整度)** | adequate | 纯 GUI 编排在主干上确实很强,但**不是 100%**:少数构造强制原始 JSON,且更关键的是**没有任何机制保证 GUI 输出通过 `sing-box check`**。 |
| **serialization-correctness(序列化正确性)** | adequate | 导入导出结构无损,引用与顺序忠实;但导出**不保证有效**——裸 stringify,唯一守卫是可绕过的 confirm(),且对整类字段(尤其"实体缺 tag")完全盲视。 |
| **version-targeting(版本目标)** | adequate | 实现用心且大体正确((channel,version) 一致贯穿 linter,1.13 字段级门控真实建模,deprecated 按版本升级);缺口是**一致性而非正确性**(部分 testing-only 段在 stable 仅 warn,palette 仅按 channel 门控)。 |
| **architecture-soundness(架构健壮性)** | adequate | "config 即真相源"主干稳健;但知识在多处平行重编码(一处已漂移),测试覆盖将风险降至 adequate。 |

---

## 3. 设计亮点(节点/边/端口 + 注册表设计做对了什么)

1. **config 即唯一真相源,无双向序列化债务。** 没有存储的 nodes/edges 数组;节点与边每次 render 由 `deriveGraph(config, layout)` 纯计算(`src/canvas/graph.ts:248`),导出 = `JSON.stringify(config)`(`src/domain/serialization.ts:88`)。引用不是独立对象,而是嵌在 config 字段里的 tag 字符串。这消除了"图与 JSON 不同步"这一整类 bug,且**未建模/未知字段经 `structuredClone` 原样往返**。

2. **声明式 portRelations 注册表是单一真相源。** 34 条 `PortRelation`(已核实计数,`src/domain/portRelationRegistry.ts:106-153`),每条是一对类型化端口(handle key + icon + 节点类型门控),携带 `canonicalPath`(引用所在 JSON 指针)、`mode`(writable/readonly/decorative/order-only)、`createTarget`。`SbcNode` 由它渲染端口,`CanvasWorkspace` 据它校验拖拽合法性,`CanvasEdge` 据它渲染。边自描述可逆:`edge:<relationId>:<part>:<part>`(`formatEdgeId`/`parseEdgeId`),可还原回关系。

3. **覆盖广且嵌套块可结构化编辑。** TLS 的 reality/ech/utls,完整内联 ACME(含 EAB 与 dns01_challenge provider 门控字段),v2ray-transport、multiplex、tcp-brutal 均可编辑(`sharedFields.tsx:203`)。所有 route/dns 规则动作(route/reject/hijack-dns/route-options/sniff/resolve、evaluate/respond/predefined)与匹配条件均可编辑。

4. **rename/delete 级联完整。** `referenceRegistry` 覆盖约 40 条引用路径,改名/删除自动重写每一处引用(`replaceRegisteredTagReferences`/`removeRegisteredTagReferences`),避免悬空引用与孤儿。

5. **版本目标真实建模。** active(channel,version) 一致贯穿 linter;类型级门控(naive/ccm/ocm/cloudflared/hysteria-realm)与约 6 处字段级 1.13 门控(route-rule bypass、interface_address 三件套、local prefer_go、TLS 1.13 字段、tailscale advertise_tags/system_interface);legacy DNS address 与 top-level fakeip 在 1.14 正确从 warning 升级为 error。

6. **Inspector 结构化编辑器丰富。** users[]、wireguard peers[]、headers/hosts/torrc map、selector/urltest 候选清单、ssm 托管清单、derp STUN、递归 inline rule-set(到深度 3)等均有专用 repeater;`C17 structurallyCoveredKeys` 守卫证明无 handled key 缺编辑器。命名空间共享(outbound+endpoint 共享 tag 命名空间)被正确建模。

---

## 4. 关键差距与风险(按严重度分组)

### 🔴 Critical / Major(影响"有效"这一核心交付)

**G1 — 无 JSON-Schema/枚举/类型校验,导出不保证有效。**
- 证据:`package.json`/`src/` 无 ajv/json-schema(已核实);`src/domain/schemaRegistry.ts:11-12` 明确枚举出范围;校验是手写语义 linter(`src/domain/diagnostics.ts`,约 2068 行),用正则 CIDR、tag 重复、required/tls-required 检查,**无类型/枚举校验**。
- 风险:非法枚举(congestion_control/udp_relay_mode 等)、错类型标量静默导出,只能被可选官方 binary check 或 sing-box 运行时捕获。
- 建议:为 schema 行补枚举元数据 + 默认开启的 sing-box check(WASM `sing-box check` 或由 Go struct 生成 AJV schema),并对结构性错误**硬阻断导出**。

**G2 — 导出仅软门控,且对整类问题盲视。**
- 证据:`confirmAndExportConfig`(`src/components/exportConfig.ts:39-46`)仅对 error 级**语义**诊断弹一次 `window.confirm("...Export anyway?")`,用户总能继续;`downloadProject` 完全不门控。官方 check 需配置 `VITE_OFFICIAL_CHECK_URL` 才生效(`src/state/useProjectStore.ts:1779`),不在导出路径上。
- 建议:导出流程默认接入(若已配置)官方 check;将版本移除条件在目标版本≥移除版本时升级为 error,使其进入门控。

**G3 — 无"实体缺 tag/空 tag"诊断,无 tag 的可引用实体静默导出并被 sing-box 拒绝。**
- 证据:`diagnostics.ts` 中**唯一**的实体级 tag 诊断是 `duplicate-tag`(`:63`,已核实),无任何 missing/empty tag 检查;`pushTagged`(`src/domain/indexes.ts:35`)仅在 tag truthy 时入索引,无 tag 实体对去重/校验不可见;导出时 `pruneExportNoise` 直接剥掉 `tag:""`。可达性:仅经导入或手改原始 JSON(GUI 创建/改名路径已通过 `getUniqueTag` 防空)。
- 建议:新增 error 级 `entity-missing-tag` 诊断,pathed 到 `/<collection>/<index>/tag`,纳入导出门控。

**G4 — 可枚举长尾字段强制原始 JSON。**
- 证据:tun mtu/strict_route/interface_name(无控件,不在 `handledFields.ts`);shadowsocks relay destinations[](inbound 编辑器仅渲染 method);trojan fallback_for_alpn(画布自身提示"Use Advanced JSON",`inboundSectionsB.tsx:370`);cloudflared control_dialer/tunnel_dialer;TLS kernel_tx/kernel_rx 仅作诊断告警、client_certificate 缺控件;wireguard peer 级 reserved 嵌在 peers[] 内,顶层 catch-all 也兜不住。
- 建议:为最高价值的两项补结构化 repeater(trojan fallback_for_alpn 的 alpn→server/port 行、ss destinations[]),以及 per-peer reserved 三整数输入。

**G5 — 版本门控一致性瑕疵(testing-only 段在 stable 仅 warn)。**
- 证据:outbound:naive(`diagnostics.ts:167-175`)、service:ccm/ocm(`:202-210`)、service:hysteria-realm(`:331-339`)推 **error**;而 inbound:cloudflared(`:1151-1159`)、certificate_providers[](`:1424-1433`)、http_clients[](`:1434-1442`)仅推 **warning**。三者在 stable 都会被 sing-box 启动拒绝,但 warning 不进导出门控。
- 建议:将 http_clients/certificate_providers/cloudflared 在 stable 目标升级为 error,与同类对齐。

### 🟡 Minor(隐喻泄漏 / 可维护性)

**G6 — 部分真实引用边只在级联中,从不成为画布边。**
- 证据:inbound detour(inbound→inbound,`referenceRegistry.ts:130/372` 有级联,`portRelationRegistry` 无关系);route-rule resolve server(`referenceRegistry.ts:258` 有级联,无 PortRelation、无 missing 诊断、无 Inspector 端口),而结构相同的 dns-rule server 却有边(`graph.ts:646`);selector default、route.default_domain_resolver、tun route_address_set、mesh_with/verify_client_url detour 等约 12 处只在级联。用户在 Inspector 设了值但画布无连线。
- 建议:为高价值项补 writable PortRelation;加构建期测试,断言每条 referenceRegistry 路径要么有边要么在显式 Inspector-only allowlist,防止单注册表漂移。

**G7 — 边无文字标签,同一对节点间不同关系视觉无法区分。**
- 证据:`CanvasEdge.tsx:44-78` 仅渲染 bezier + X 按钮,`makeEdge`(`graph.ts:177-195`)不设 `label`;所有边同色。一个 dns-server 可同时是 dns-rule server 与 domain_resolver 目标,渲染为两条同样式边。(端口行有可见文字标签作冗余,故影响有限。)
- 建议:渲染轻量关系标签或 per-relation 颜色/虚线 + hover tooltip。

**G8 — 悬空引用渲染为无边,仅诊断反映。**
- 证据:`outboundTargetNodeId`(`graph.ts:270`)对不存在 tag 也盲返 `outbound:<tag>`,`makeEdge` 不校验目标存在,React Flow 对缺失目标节点的边渲染为空。仅 domain_resolver/http_client 有 tagSet 守卫(不一致)。诊断会把 owner 节点标红,但边端点不可见。
- 建议:为未解析 tag 渲染独特"悬空边"样式或 owner 端口徽标;统一各关系的存在性守卫。

**G9 — 聚合成员边全局上限 96、规则/规则集节点上限 24,大组欠渲染。**
- 证据:`MAX_VISUAL_CANDIDATE_EDGES=96`(`graph.ts:36`,全局非每组)、`MAX_VISUAL_RULE_NODES=24`。route/dns 溢出有 notice 节点,但 `>24 rule_sets` 完全静默(无 notice)。
- 建议:组节点截断时显示画布指示,镜像 route/dns notice。

**G10 — 选择器/urltest 成员顺序与所有顶层数组无 GUI 重排。**
- 证据:仅 `moveRouteRule`/`moveDnsRule`(`commands.ts:319/333`,已核实),无成员重排命令;`connectSelectorCandidate` 始终追加到末尾。selector 顺序语义有意义(空 default 时取首成员),但 Inspector 有显式 Default 下拉(`outboundSectionsB.tsx:430-449`)已覆盖主用例,故实际影响窄。
- 建议:为成员清单加 up/down 重排;可扩展到其他顶层数组。

### ⚙️ 架构债务(无现行 bug,但有漂移风险)

**G11 — 两套引用注册表无 parity 测试。** `portRelationRegistry`(可连边子集)与 `referenceRegistry`(完整级联)各自编码引用路径,无测试交叉校验"每条 writable canonicalPath 都有级联覆盖"。当前一致仅靠人工协调。建议加规范化 parity 测试。

**G12 — togglePortConnection 39 分支硬编码梯子复制注册表。** `src/state/useProjectStore.ts:1044-1541`(约 497 行,store 中共 52 处 `node.kind ===`,已核实)按 (kind,port.key) 手写重编码端口→引用字段映射与节点类型门控,而兄弟路径 `connectDirectedPortReference` 已完全泛型化走 adapter。这是 DRY/维护债,非正确性 bug(对称性测试套件维持一致)。

**G13 — schemaRegistry 版本列休眠。** `versionAdded/deprecatedIn/removedIn/channel` 无生产消费者(仅被 markers 测试读取),活的版本数据在 `minVersions.ts` 与 `nodeLabels.ts`,形成第三份平行副本。属有意分阶段的前瞻元数据,但有漂移风险。

---

## 5. "纯 GUI 可达性"专项分析

下表区分:用户**仅靠 GUI**(画布点击/拖拽 + Inspector 结构化编辑)能构建的部分 vs **强制原始 JSON / 不可达**的部分。

### ✅ 纯 GUI 可达(端到端结构化)

| 配置区 | 可达方式 |
|---|---|
| **18/18 inbound、18/20 outbound、12/14 dns-server、2/2 endpoint、6/6 service、3/3 rule-set 类型创建** | Palette 点击创建 + 自动打开 Inspector;端口"+"创建并连接目标 |
| **核心引用边**(selector/urltest 成员、rule outbound/inbound/rule_set、route/dns final、detour 链、dns-server detour/endpoint/service、domain_resolver(字符串形态)) | 拖拽端口或端口"+"选择器,写回同一规范路径 |
| **TLS/REALITY/ECH/uTLS/内联 ACME/dns01** | `sharedFields.tsx` 路径寻址结构化控件 |
| **v2ray-transport(http/ws/quic/grpc/httpupgrade)、multiplex+tcp-brutal、dial、listen、quic、udp-over-tcp** | 共享字段组结构化编辑 |
| **协议字段集**(ss method、vmess security、vless flow、naive congestion 等枚举) | Inspector `<select>` 下拉(`outboundInspector.tsx`) |
| **wireguard peers[]、users[]、hosts/headers map、derp verify endpoints/mesh/STUN、ssm 托管清单** | 专用 repeater |
| **route/dns 规则**(default + logical 到深度 3,所有动作 + 高级匹配字段 geoip/ip_cidr/process/network 等) | `ruleControls.tsx` + RuleAdvancedFields,up/down 重排 |
| **settings 块**(log/ntp/certificate/experimental 的 cache_file/clash_api/v2ray_api,含 inbounds/outbounds/users tag-list 引用) | `settingsInspector.tsx` 结构化 ModuleCard |
| **certificate_providers / http_clients 创建** | Palette(testing 通道) |

### ⚠️ 强制原始 JSON(parse-safe,摩擦非数据丢失)

| 构造 | 回退点 |
|---|---|
| trojan **fallback_for_alpn** | 画布提示用 Advanced JSON(`inboundSectionsB.tsx:370`) |
| tun **mtu/strict_route/interface_name**、TLS **client_certificate/kernel_tx/kernel_rx**、cloudflared **control_dialer/tunnel_dialer**、ss **relay destinations[]** | 落入 AdvancedNonScalarFields 逐字段 JSON 文本域 |
| wireguard **peer 级 reserved** | 须整体编辑 peers[] 数组为原始 JSON |
| 深度 **>3 的逻辑规则**、9 个 INLINE_RULE_LIST_FIELDS 外的 headless 匹配键 | "Edit rules as JSON"(`ruleControls.tsx:159`) |
| **对象形态** domain_resolver / http_client / default_http_client(含 strategy 等兄弟键) | shared select 降级为 JsonField(`sharedFields.tsx:450`) |
| ssm-api **自定义 path 字符串**(非 "/" 或 "/<tag>") | "Endpoint Mapping JSON"(`serviceInspector.tsx:95`) |
| **数组重排序**(selector/urltest 成员、inbounds/outbounds/dns.servers/endpoints/services/rule_set) | 仅整配置 JSON 文本域 |

### ❌ 不可达 / 仅引用(不可作为节点创建)

- **弃用/保留类型**:wireguard outbound、dns outbound、legacy dns-server、mdns(`creatable:false`,保留以保证往返,但 palette 不提供)。
- **tls.acme 迁移目标 certificate_provider 的结构化编辑**:owner 对象有节点但 ACME/cert-provider 的完整结构化编辑路径不完整。
- **palette→画布拖放**:无空间放置(全部 click-to-add,无 onDrop/dataTransfer)。
- **画布上编辑标量/匹配条件/规则动作**:画布只建模引用边与节点存在/类型/位置,所有标量字段只读副标题,须在 Inspector/JSON 编辑。

**净评估**:对一个**目标 stable(1.13)的典型配置**(若干 inbound/outbound、一个 selector/urltest 组、DNS 服务器与规则、route 规则、rule-set、TLS),用户**可以完全靠 GUI 构建并导出**——但导出**不保证有效**,且若用到上表⚠️/❌中的构造,必须落原始 JSON。

---

## 6. 改进路线建议(按优先级)

### P0 — 闭合"有效性"缺口(决定能否称为"真正的生成器")
1. **接入真实校验并硬阻断导出**:打包 WASM `sing-box check`,或由 sing-box Go struct 生成 AJV/JSON-Schema 做 per-target 校验;对结构性错误硬阻断导出(替换当前可绕过的 confirm())。(G1/G2)
2. **新增 `entity-missing-tag` error 诊断**(及命名空间重复跨命名空间的明确处理),纳入导出门控;在导入时对重复 tag 去重/加后缀 + toast。(G3)
3. **为 schema 行补枚举元数据**,把 method/security/congestion_control/strategy 等改为下拉,并据此校验。(G1)

### P1 — 一致性与最高价值长尾
4. **统一版本门控严重度**:cloudflared/http_clients/certificate_providers 在 stable 升级为 error;palette `itemStatus` 接入 active version,按 `TYPE_MIN_VERSION` 门控(修 1.12-stable 仍提供 naive/ccm/ocm 的问题)。(G5)
5. **补结构化编辑器**:trojan fallback_for_alpn 行编辑器、ss relay destinations[] repeater、per-peer reserved 三整数、TLS 1.13 server 字段、tun 一线控件。(G4)

### P2 — 隐喻完整性与可维护性
6. **为高价值引用补画布边**:inbound detour(自环守卫)、route-rule resolve server(action 门控,镜像 dns-rule);加构建期 parity 测试断言每条 writable canonicalPath 有级联覆盖。(G6/G11)
7. **边可读性**:per-relation 标签/颜色 + hover tooltip;悬空引用渲染独特错误边/owner 端口徽标,统一存在性守卫。(G7/G8)
8. **重排能力**:为 selector/urltest 成员与顶层数组加 up/down 重排命令。(G10)
9. **偿还架构债**:将 `togglePortConnection` 39 分支梯子迁移到 adapter(消除注册表复制);消费或删除 schemaRegistry 休眠版本列,收敛版本数据真相源。(G12/G13)

### P3 — 体验打磨
10. 大组截断的画布指示(镜像 route/dns notice);拖放放置(palette→画布 onDrop);clone-node 命令;数组编辑器拖拽重排。(G9 及 implSummary gaps)

---

**总评**:sbc-ui 在"把 sing-box JSON workflow 化"这件事上**方向正确、骨架可靠**——config-as-source-of-truth + 声明式端口关系注册表是经得起推敲的设计,覆盖与往返忠实度都达到 adequate。但要从"良好的编排辅助工具"跃迁为"可信赖的纯 GUI 有效配置生成器",**必须补上校验层(P0)与一致性/长尾(P1)**。当前状态:**能用、且在主干上很强,但还不能保证生成的就是有效配置。**
