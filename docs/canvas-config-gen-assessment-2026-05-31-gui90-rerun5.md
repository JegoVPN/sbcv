<!--
  RE-RUN #5 — DoD re-measurement after W8 (version-gate fixes) + W9 (serialization → strong:
  unknown-field linter) + A1/A3 (architecture single-sourcing). Produced by re-running
  scripts/workflows/canvas-config-gen-review.workflow.js from scratch against current main.
  66 agents, 3.46M tokens.
-->

# Re-run #5 — Done-bar re-measurement (2026-05-31)

- **Workflow:** `scripts/workflows/canvas-config-gen-review.workflow.js` (run `wf_ea763750-d73`) · 66 agents
- **Overall score:** **3.9 / 5(strong-)— 主干 workflow 化已达成,版本门控与字段可达性有可定位、可修复的缺口**

## Six-dimension scorecard — re-run#4 → re-run#5

| Dimension | re-run#4 | re-run#5 | What changed |
|---|---|---|---|
| schema-coverage | strong | **strong** | — |
| graph-fidelity | strong | **strong** | — |
| interaction-completeness | strong | **strong** | — |
| serialization-correctness | adequate | **strong** ⬆ | W9 unknown-field linter closed the typo/unknown-field gap |
| version-targeting | adequate | **adequate** | new concrete gaps found (M1 find_process, M2 hysteria2 **inbound** realm/bbr_profile) |
| architecture-soundness | adequate | **strong** ⬆ | A1 (version single-source) + A3 (reference-surface single-source); the "66 entityType literals" reassessed as legitimate type-specific UI |

**5 of 6 dimensions strong.** Only version-targeting remains adequate, on binary-verifiable gaps (see §4 M1/M2).

## Per-dimension verdicts (workflow, verbatim)

| schema-coverage | **strong** | Coverage of the sing-box config surface is broad and largely accurate. All protocol/type rosters are fully enumerated and almost all are creatable; the per-entity Inspector provide… |
| graph-fidelity | **strong** | The node/edge/port model is fundamentally sound and faithful. References are modeled the right way — as tag-string values written at a canonicalPath, projected read-only into edges… |
| interaction-completeness | **strong** | Strong for the mainstream config surface: the great majority of real-world sing-box configs (TUN/proxy clients, multi-protocol server inbounds with TLS/REALITY/ACME, selector/urlte… |
| serialization-correctness | **strong** | The node graph serializes to valid sing-box JSON via a no-transform model (the in-memory config IS the exported JSON), import→graph→export round-trips losslessly (verified deep-equ… |
| version-targeting | **adequate** | Version targeting is architecturally sound and broadly correct: three concrete targets (1.13 stable default, 1.12 Legacy, 1.14 testing) flow a single (channel, version) through val… |
| architecture-soundness | **strong** | The design is sound and notably well-engineered for its goal: config-as-canonical-model with read-only graph projection, a real single-source schema table (SCHEMA_ROWS) that drives… |

---

# sbc-ui 终审报告：节点画布能否纯 GUI 生成 sing-box 配置(JSON 的 workflow 化)

## 1. 总体结论

**结论：基本实现了,且架构选型正确。** 对绝大多数主流 sing-box 配置,用户确实能仅通过点击、拖拽、简单结构化编辑端到端生成有效配置,无需手写一行 JSON——这正是"把 JSON workflow 化"的目标。剩余约 10-15% 的小众/高级构造仍被强制回退到 JSON 逃生口,且存在两处会让"生成的配置对所选版本无效"的版本门控漏洞,需要修补才能称作"对目标版本保证可用"。

**综合评分:3.9 / 5(strong-)。** 主干面 workflow 化已达成且实现扎实;扣分集中在版本门控漏洞、引用模型与上游 schema 缺乏自动绑定、Inspector 字段面手写化三处可定位、可修复的缺口。

核心架构是对的:store 中持有的**就是字面 `SingBoxConfig`**(`useProjectStore.ts:141`),`stringifyConfig` 就是 `JSON.stringify(config, null, 2)`(`serialization.ts:89`),`deriveGraph` 是**纯只读投影**(`graph.ts:249`)。引用不是独立的 edge 对象,而是**写在某个 canonicalPath 上的 tag 字符串**——这恰好匹配 sing-box 本身"引用即字段中的 tag,没有独立 edge 概念"的事实。因此"所编辑即所导出",导入→图→导出可无损往返(220 个外部 fixture deep-equal 通过),导出字节经真实 sing-box 二进制验证(19/19 fixture 在 1.13.12 + testing 上零错误、零弃用警告)。

---

## 2. 六维度评分表

| 维度 | 评分 | 一句话判断 |
|---|---|---|
| **Schema 覆盖** | strong | 协议/类型花名册近乎完整(18/18 入站、20/20 出站、14/14 DNS server、endpoint/service/rule-set 全建模),Inspector 提供真正的结构化编辑器而非纯 JSON;覆盖洞窄且多为有意为之。 |
| **图保真度** | strong | 引用建模正确(引用即 canonicalPath 上的 tag,只读投影为边),核心引用图全为一等公民边,parity 测试单源防漂移;泄漏在边缘(preferred_by 遗漏、若干 Inspector-only 引用、可视化上限)。 |
| **交互完整性** | strong | 主流配置面可零 JSON 端到端构建;残余 ~10-15% 构造强制回退 JSON,集中在小众/高级特性,无主流构造不可达。 |
| **序列化正确性** | strong | 无变换模型,导入/导出无损往返(220 fixture deep-equal),真实二进制验证(19/19);残余风险在 linter 启发式而非 schema 穷尽。 |
| **版本目标** | adequate | 架构合理(三目标、schema 派生的类型级 minVersion、硬导出门控),但未知字段 linter 合并双 channel 故每个 testing-only 字段都靠手写门控,已确认有真实漏洞(find_process、hysteria2 realm/bbr_profile)。 |
| **架构稳健性** | strong | config 即模型 + 只读投影、真正的单源 schema 表、registry 化引用模型 + parity 测试、清晰的 domain↛canvas↛component 分层;维护性短板局部化(Inspector 字段面手写、graph.ts 命令式重写引用路径)。 |

---

## 3. 设计亮点(节点/边/端口 + registry 设计做对了什么)

1. **config 即唯一事实源,图是纯投影。** store 不持有 nodes/edges 数组,而是持有字面 config;每次写入都经 `commands.ts` 纯函数返回新 config,再由 `sync()` 重算 jsonDraft 与 diagnostics(`useProjectStore.ts`)。导出直接读 `useProjectStore.getState().config`,因此不存在"画布模型"与"导出模型"的双轨漂移。

2. **引用建模与 sing-box 本质一致。** sing-box 中没有独立的 edge 概念,一条引用就是某字段里的一个 tag。本实现把引用写在 `canonicalPath`(如 `/route/rules/*/outbound`)上,边只是从 config 投影出的只读关系。`route/rule_action.md` 证实 action 的 `outbound`/`server` 是 rule 对象上 `action` 的平级兄弟字段,故 `updateRouteRule`(`commands.ts:308`)的平级写法是 schema 准确的。

3. **真正的类型级单一事实源。** `SCHEMA_ROWS`(`schemaRegistry.ts`)驱动 palette、工厂 `factory(tag)`、`TYPE_MIN_VERSION`(`minVersions.ts:15`)、diagnostics——画布"需要 X"徽标与 linter 共用同一来源,不可能各说各话。`commands-factory-frozen.test.ts`(15/15 通过)钉住此不变量。

4. **registry 单源 + parity 测试防漂移。** `referenceRegistry.ts` 是完整的重命名/删除级联源;`portRelationRegistry.ts` 是其中被画成边的子集;`tests/registry-parity.test.ts`(3/3 通过)强制每条可写引用路径**要么是边,要么显式列入 `INSPECTOR_ONLY_REFERENCE_PATHS`**(`referenceRegistry.ts:354-373`),使"画布 vs Inspector"的引用面单源化。

5. **导出经真实二进制验证 + 不可绕过硬门控。** `exportConfig.ts:85-86` 在存在 error 级语义诊断时直接 `{exported:false, reason:"blocked"}`,无 bypass;`export-binary-check.test.ts` 把 app 实际导出字节喂给版本匹配的真实 sing-box 二进制(19/19 通过,deprecation 即失败)。

6. **未知字段白名单由上游文档自动生成。** `knownFields.generated.ts` 由 `gen-known-fields.mjs` 从 `docs/upstream/sing-box/{stable,testing}` 抽取,可确定性重现;`config-doc-capability.test.ts`(236 测试)走真实文档树断言 UI 能力——schema 随上游演进而非靠人工审计。

7. **悬空引用可见化。** 任何指向不存在 tag 的边会被合成红色 "Missing: <tag>" 伪节点(`graph.ts:993-1023`),而非静默消失。

---

## 4. 关键差距与风险(按严重度分组)

### 4.1 Major(会产出对所选版本无效的配置,或结构性维护风险)

**M1 — route.find_process(1.14 testing-only)在 stable 上无门控,导出 stable 二进制拒绝的配置。**
`routeInspector.tsx:110-119` 无条件渲染 `find_process` 勾选框;`diagnostics.ts` 中 `find_process` **零命中**(已验证 grep 无结果),而兄弟字段 `find_neighbor`/`dhcp_lease_files`/`default_http_client` 都在 `channel === "stable"` 块里被门控(`diagnostics.ts:1814-1844`)。默认目标是 1.13-stable,该字段在 stable/oldstable 文档中均不存在,二进制按未知字段 FATAL 拒绝。
*建议:* 在 diagnostics 的 stable route 块加 `find_process` error 门控,并把勾选框包进 `channel === "testing"`(镜像 `default_http_client`),加一条 fixture 测试断言 stable + find_process 产生阻塞错误。

**M2 — 未知字段 linter 合并双 channel,testing-only 字段全靠手写门控,已有确认漏洞。**
`knownFieldsRegistry.ts:55-92` 对 `["stable","testing"]` 取并集,header 注释明确"版本特定字段由 version-gate 检查捕获,不在此处"。其后果是每个 1.14 字段都需要一条手写门控,否则在 stable 上导出干净但二进制拒绝。已确认 **inbound hysteria2 的 `realm`/`bbr_profile` 漏门**:门控只在 outbounds 循环里(`diagnostics.ts:1342-1347`,路径 `/outbounds/`),inbound hysteria2 分支只调 `checkQuic114Fields`,实测带 realm+bbr_profile 的 stable 入站产生零诊断。
*建议:* 用数据驱动的 testing-only 字段检查替换枚举门控——从 `DOC_FIELD_NAMES` 按 (kind,type) 算出"testing 有而 stable 无"的字段集,通用发 error;至少加构建期测试断言每个 (testing−stable) 字段都有门控或显式豁免,新版本漏门则 CI 失败。

**M3 — 引用模型无自动绑定上游 schema,只内部互对齐,已暴露真实遗漏。**
`registry-parity.test.ts` 只把两个内部 registry 互相对齐,**零绑定到上游 schema**。已确认 route rule 的 `preferred_by`(1.13/1.14 稳定字段,DNS server tag 列表)在 `referenceRegistry.ts`、`portRelationRegistry.ts`、`INSPECTOR_ONLY_REFERENCE_PATHS` 中**全缺**(已验证 grep 在两个 registry 中零命中)。实测重命名 dns1→dns2 时 `preferred_by:["dns1"]` 不变(悬空),删除 dns1 也不清理。parity 测试照样通过,盲点真实存在。
*建议:* 加一条从上游文档(或手维护 manifest)派生 tag-引用字段集、断言每个都在 `referenceRegistry.paths` 中(边或 Inspector-only)的测试,把 diagnostics 层已承认的"枚举非穷尽"转为引用模型的守卫不变量。

**M4 — Inspector 字段面是手写白名单,不由 schema 行驱动(最大维护性短板)。**
`handledFields.ts:171-196` 是手维护的 ~190 字符串 `Set`;约 78 处手写 `<option>` 列表散落在各 inspector 文件未走 registry;`outboundInspector.tsx`、`inboundSectionsB.tsx` 中枚举字段靠手工定位 `<SchemaEnumField .../>`。C17 守卫(`handledFields.ts:202-205`)自述"只证明定义/inline 键存在,不证明渲染了可用控件"。"加一个新协议字段"仍要触多文件。
*建议:* 加一个数据驱动字段渲染器,遍历 `schemaRow(kind,type).fields` 自动放置标量控件,手写 JSX 仅保留真正特殊布局,使 add-a-field 成本回到单行,并让 C17 守卫成为真正的可达性证明。

**M5 — 校验是启发式/枚举 linter 而非 schema 穷尽。**
未知字段 linter 只查顶层键(`diagnostics.ts:232` 遍历 `Object.keys(entity)`),且 `knownFieldsFor` 返回扁平顶层键集、不递归进 tls/transport/multiplex。实测 `tls:{servr_name:...}` 产生 0 阻塞错误,而顶层 `servr_name` 会被标记。endpoint/service 行 0 个 `fields[]`,故其 enum/type 校验是空操作(wireguard endpoint 的 `listen_port:'NOT_A_NUMBER'` 不报错)。权威保证依赖**可选**的 `VITE_OFFICIAL_CHECK_URL`(`useProjectStore.ts:96-99`),未配置时仅靠 linter。
*建议:* 让 unknown-field linter 递归进 tls/transport/multiplex/dial/listen 共享子对象(复用同一双 channel 白名单);为 endpoint/service 的 enum 叶子补 field 元数据;在 UI 明示未配置二进制校验时导出有效性仅为启发式。

### 4.2 Minor(有逃生通道,不阻塞生成有效配置)

**m1 — 一批构造强制回退 JSON。**
- ssm-api `servers` **自定义路径键**:结构化清单与画布边都只自动派生路径(`/`、`/<tag>`),任意路径仅能经 `serviceInspector.tsx:95` 的 JSON 字段。
- DNS `predefined` 动作的 `answer`/`ns`/`extra` 记录:`ruleInspectors.tsx:369-381` 只渲染 rcode 选择,其余落入 Advanced JSON 兜底。
- hysteria2 `masquerade` 对象形态:`inboundSectionsB.tsx:431-448` 字符串形态给输入框,对象形态用 JsonField。
- 内联(无 tag)`http_client` 对象:`sharedFields.tsx:542-545` 只有 tag `<select>`,内联对象回退 JSON。
- 逻辑规则嵌套 >5 层:`ruleControls.tsx:174` `MAX_INLINE_RULE_DEPTH = 5`。
- **任意未建模顶层字段**:两个 Advanced 兜底都只重新呈现实体上**已存在**的键(`helpers.ts:56-72` 遍历 `Object.entries(entity)`),无法新增未建模键——只能经整文档 JSON 编辑器(`InspectorPanels.tsx:75-80`)加入。这是唯一一处结构性缺口。
*建议:* 为 ssm-api 加每条路径文本输入;为 predefined 加 answer/ns/extra 重复行编辑器;在 Advanced 区加"添加自定义字段(key + JSON value)"控件,避免整文档往返。

**m2 — testing-only DNS-rule 匹配器只是 warning(可绕过),而 route-rule 对应字段是 error(不一致)。**
`diagnostics.ts:1856-1875` 把 `source_mac_address`/`source_hostname`/`preferred_by`/`match_response`/`package_name_regex` 在 stable 上发 **warning**(可经 window.confirm 绕过导出),`response_rcode/answer/ns/extra` 则完全无门控(只在 1.14 排序检查里);而 route-rule 的 `interface_address` 系列是 **error**(`diagnostics.ts:375`)。其中 `source_mac_address`/`source_hostname` 还有一等 GUI 编辑器(`ruleControls.tsx:443-452`),用户可纯 GUI 添加→仅得可绕过 warning→导出→二进制硬拒。
*建议:* 在 <1.14 目标上把这些 DNS-rule 匹配器从 warning 升为 error(对齐 route-rule),补 response_* 门控,最好走 M2 的同一数据驱动机制。

**m3 — 可视化上限在大配置上降级,且 http_client 边在 stable 上整体抑制。**
`graph.ts:35-37` 上限 24 规则/24 rule-set/96 候选边;超出仅画提示节点,经 Rules 表/Inspector 可达。`graph.ts:951` 把所有 http_client 边门控在 `channel === "testing"`,stable 上 http-client 节点渲染但无连线(有意,文档记录)。候选边 96 是**所有 selector/urltest 组共享的单一预算**,非每组。
*建议:* 保留上限(保护 React Flow 性能),但考虑把候选边上限改为每组,避免单个大 selector 被静默截断。

**m4 — 撤销基于快照且无持久化。** `pushHistory` 仅由 import/loadProject 内联触发(`useProjectStore.ts:1710-1714`),字段编辑/删除/连线/移动**均不可单独撤销**,无 redo;store 无 localStorage,刷新即重置为 `createStableTunSplitConfig()`。实际撤销只能回退最近一次 import。
*建议:* 在 store 边界为每次结构性写入前压入有界快照,并自动保存 {config,layout} 到 localStorage——因 `commands.ts` 已是唯一写入瓶颈,两者都是局部改动。

**m5 — pruneExportNoise 仅在下载字节上剔除空串/空数组键,与官方校验所验配置发散。** `serialization.ts:111-117` 下载的是 pruned 字节,而 `runOfficialCheck` POST 的是未 pruned 的 `config`(`useProjectStore.ts:1804`)。差异对纯 GUI 配置罕见,主要影响导入/手编含惰性空键的配置。*建议:* 让 official-check 发送与下载等价的 pruned 字节。

### 4.3 Observation(设计正确性确认,非缺陷)

- 4 个 `creatable:false` 行(wireguard 出站、dns 出站、legacy DNS server、mdns)被有意排除 palette 创建(`useProjectStore.ts:930,940`),前三个已弃用、mdns 为 1.14 前向门控,palette 中诚实标为 reference-only/gated,不减少可达的有效现代配置。
- 导出硬门控对结构性有效性的保证是真实的(`exportConfig.ts:60-101`),并刻意排除平台/OS 特定 official 错误以免跨 OS 配置被过度阻塞。

---

## 5. "纯 GUI 可达性"专项分析

### 5.1 可纯 GUI 构建(零手写 JSON)

- **整体拓扑与节点创建**:6 类实体(出站/入站/DNS server/endpoint/service/rule-set)经 palette 点击创建(无拖拽,纯点击);settings 四单例(log/ntp/certificate/experimental)。
- **跨对象引用(连线)**:selector/urltest 成员、route.final、route rule→outbound、route rule resolve→server、dns.final、dns rule→server、dns/route rule→rule_set、所有 detour 家族、domain_resolver(字符串/{server} 形态)、endpoint↔outbound 命名空间共享、ssm-api 自动路径——全部可点端口/拖端口连线。
- **凭据与数组**:入站 `users[]` 增删行编辑器(13 个协议,含敏感字段掩码 + Generate UUID)、wireguard `peers[]`、trojan `fallback_for_alpn` 映射行、derp mesh 行。
- **TLS 子图**:server/client 角色拆分、REALITY 握手、ECH、uTLS、内联 ACME + dns01_challenge(alidns/cloudflare/acmedns 子表)。
- **transport/multiplex/quic/udp-over-tcp**:逐变体结构化。
- **规则匹配器与动作**:全套 route 动作(route/bypass/reject/hijack-dns/route-options/sniff/resolve)、全套 DNS 动作,匹配器经 RuleListField 结构化;action-gated 端口清理。
- **全局设置**:log、ntp(+detour)、certificate(PEM)、experimental(cache_file/clash_api/v2ray_api stats)、dns hosts 映射。

### 5.2 强制回退 raw JSON(可达但仅经 JSON 字段/逃生口)

- ssm-api `servers` **自定义路径键**(自动派生外的任意前缀)。
- DNS `predefined` 动作的 `answer`/`ns`/`extra` 记录。
- hysteria2 入站 `masquerade` 对象形态({type:file|proxy|string,...})。
- 内联(无 tag)`http_client` 对象。
- domain_resolver 对象形态超出 {server,strategy,disable_cache,rewrite_ttl,client_subnet} 的字段。
- 逻辑规则嵌套 **>5 层**。
- 仅 1.13+ 的三个 interface_address 匹配器(`network_interface_address`/`default_interface_address` 在任何结构化路径都不可达)。

### 5.3 不可经 GUI 新增(只能整文档 JSON 编辑器或 import)

- **任意未建模顶层实体字段**:Advanced 兜底只重呈现已存在键,不能新增结构化 UI 未建模的新键——必须经 `InspectorPanels.tsx:75-80` 整文档 JSON 编辑器或 import。这是唯一真正的结构性可达性缺口。
- 4 个有意排除的 `creatable:false` 类型(wireguard 出站、dns 出站、legacy DNS server、mdns)——但这些本就弃用或前向门控,排除不减少有效现代配置。

### 5.4 画布上不可见但 Inspector 可编辑(引用边泄漏)

legacy `address_resolver`、v2ray stats、嵌套数组 detour(derp mesh_with/verify_client_url)、tun route_address_set CSV、`tls.certificate_provider`、`preferred_by`(后者甚至连 Inspector 添加都需先存在)——这些是 Inspector-only 引用,画布无连线(`referenceRegistry.ts:354-373`)。

**小结**:无主流构造完全不可达;被迫 JSON 的部分集中在小众/高级特性;唯一结构性缺口是"新增未建模顶层字段需整文档 JSON 往返"。

---

## 6. 改进路线建议(按优先级)

**P0(修正版本正确性,防止生成无效配置)**
1. 给 `route.find_process` 加 stable error 门控并把勾选框 `channel === "testing"` 化(M1)。
2. 补 inbound hysteria2 `realm`/`bbr_profile` 门控;最好直接做**数据驱动 testing-only 字段检查**:从 `(testing−stable)` 字段集通用发 error,并加构建期 parity 测试,新版本漏门即 CI 失败(M2)。
3. 把 testing-only DNS-rule 匹配器从 warning 升为 error 并补 response_*(m2)——可与第 2 项共用机制。

**P1(防引用/校验静默漂移)**
4. 加从上游文档派生 tag-引用字段集、断言全部在 `referenceRegistry.paths` 的测试,并补回 `preferred_by`(M3)。
5. 让 unknown-field linter 递归进 tls/transport/multiplex/dial/listen 共享子对象;为 endpoint/service enum 叶子补 field 元数据(M5)。
6. 把 `gen-known-fields.mjs` 接入 CI 的"生成文件最新"检查,docs-sync 后白名单不可静默滞后。

**P2(提升纯 GUI 可达性)**
7. 补结构化编辑器:ssm-api 路径行、DNS predefined answer/ns/extra 重复行、hysteria2 masquerade {type} 表单、内联 http_client 表单。
8. 在 Advanced 区加"添加自定义字段(key + JSON value)"控件,消除"新增未建模字段需整文档 JSON 往返"这一结构性缺口。

**P3(架构维护性,降低长期演进成本)**
9. 引入数据驱动字段渲染器遍历 `schemaRow(kind,type).fields`,让"加一个新协议字段"回到单行,C17 守卫成为真正可达性证明(M4)。
10. 让 `graph.ts` 边发射由 `portRelations` canonicalPath 驱动(或加测试断言 deriveGraph 发射的 relationId 与 registry 双向对应),消除读侧投影与引用模型的命令式重复。
11. 在 store 边界加每次写入级快照撤销 + localStorage 自动保存(m4)。

---

## 附:关键证据索引

- config 即模型:`src/state/useProjectStore.ts:141`、`src/domain/serialization.ts:89,111-117`、`src/canvas/graph.ts:249`
- 引用 registry + parity:`src/domain/referenceRegistry.ts:312-373`、`src/domain/portRelationRegistry.ts:106-157`、`tests/registry-parity.test.ts:32-47`
- 单源 schema:`src/domain/schemaRegistry.ts`、`src/domain/minVersions.ts:15`、`tests/commands-factory-frozen.test.ts`
- 导出门控 + 二进制验证:`src/components/exportConfig.ts:60-101`、`tests/export-binary-check.test.ts`、`tests/external-fixtures.test.ts`
- M1 find_process:`src/components/inspector/routeInspector.tsx:110-119`、`src/domain/diagnostics.ts`(零命中)
- M2 hysteria2 门控:`src/domain/diagnostics.ts:1342-1347`(仅 /outbounds)、`src/domain/knownFieldsRegistry.ts:55-92`
- M3 preferred_by 缺失:`src/domain/referenceRegistry.ts:323-327`(dns-server 条目无 preferred_by)
- M4 字段面手写:`src/components/inspector/handledFields.ts:171-205`
- 上限/抑制:`src/canvas/graph.ts:35-37,951`
