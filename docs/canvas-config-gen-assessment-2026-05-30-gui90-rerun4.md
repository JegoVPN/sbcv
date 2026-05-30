<!--
  RE-RUN #4 — DoD measurement for the "close pure-GUI reachability to >=90%" goal
  (docs/goals/gui-reachability-90-execution.md) after the V0–V10 / R1–R5 queue and
  the W1–W7 all-strong round (+ #239 / #243 selection-highlight fixes) landed.

  Produced by re-running scripts/workflows/canvas-config-gen-review.workflow.js from
  scratch against current main + docs/upstream/sing-box/. 64 agents, 38 findings
  (36 confirmed, 2 rejected). 10 upstream digests, 9 impl digests.
-->

# Re-run #4 — Done-bar measurement (2026-05-30)

## Run metadata

- **Workflow:** `scripts/workflows/canvas-config-gen-review.workflow.js` (run `wf_5c70dbb6-124`)
- **Agents:** 64 · **Findings:** 38 (36 confirmed, 2 rejected) · **Digests:** 10 upstream / 9 impl
- **Overall score:** **7.5 / 10** — strong coverage + graph-fidelity; adequate serialization / version-targeting / architecture.
- **Method:** per-dimension evidence verification + adversarial re-check of every finding against code (`file:line`) and the bundled upstream docs, with real `sing-box-{1.12,1.13,1.14}` binaries grounding every validity claim.

## Done-bar verdict

| Done-bar criterion | Target | Result |
|---|---|---|
| Pure-GUI reachability | ≥90% (baseline 60-70%) | ✅ **90-95%** (production, binary check on) |
| Zero forced JSON for mainstream constructs | required | ✅ only exotic sub-objects fall to inline JSON sub-editors |
| Export hard-blocks structural errors | required | 🟡 **partial** — production binary gate yes; dev/self-hosted/offline path only heuristic linter (M1) |
| Serialization dimension "strong" | required | ❌ **adequate** (M1 unknown-field gap) |
| Six dimensions, no regression | required | 🟡 coverage/graph-fidelity/interaction rose to **strong**; serialization scored **adequate** (sharper weighting of the always-present M1 gap — not a code regression) |
| No unresolved P0/P1 | required | ❌ three Major (P0) gaps remain: M1 (serialization), M2 + M3 (version-targeting) |

**Headline goal (≥90% pure-GUI reachability): ACHIEVED.** The "all-strong" stretch is **not** met — 3 of 6 dimensions are strong, and three Major export-validity gaps remain.

## 实测可达性(口径 B — measured, not estimated)

The workflow's "90-95%" is a synthesis-level **estimate** (no denominator). To replace it with a measured number, one dense real-world subscription config (~50 outbounds mixing tuic / anytls / naive + selector/urltest, fakeip+https+local DNS with 8 rules, clash_mode route rules, two remote rule-sets, a TUN inbound with `platform.http_proxy`, and `cache_file.store_fakeip`) was classified field-by-field against the app's **actual** reachability oracle (`handledFields` + shared-field groups + the route/dns rule primary/advanced field sets + verified nested editors), and its validity was ground-truthed with the real sing-box binaries.

| Metric | Measured |
|---|---|
| Distinct `(entityType, key)` constructs (nested one level) | 112 |
| Buildable from scratch via a structured control (口径 B) | **111 (99.1%)** |
| Forced to raw-JSON / unreachable from scratch | **1 (0.9%)** — outbound `naive.quic` (a *documented* naive field, not modeled; the app models `quic_congestion_control` + `udp_over_tcp` but not the bare `quic` boolean) |
| Entity instances individually palette-creatable | 100% (52 outbounds, 2 inbounds, 3 DNS servers, 8 DNS rules, 8 route rules, 2 rule-sets) |
| Binary validity (ground truth) | `check` exit 0 on **stable 1.13** and **testing 1.14** (1 deprecation warning) |
| App heuristic linter | 0 errors on both channels (agrees with binary → would not block export); 44 advisory `outbound-domain-without-resolver` warnings; correctly flags the same `independent_cache` 1.14 deprecation the binary warns about |

**Conclusion (n=1 deep):** for this dense real-world config the measured pure-GUI reachability is **99.1%**, with the single gap being one documented long-tail naive field (`quic`) — exactly the G3 "unmodeled long-tail scalar" class.

### Population measurement (n=222 real-world corpus, top-level granularity)

The same classifier was run over the full bundled `fixtures/external` corpus (222 real configs pulled from public GitHub repos), split modern vs legacy by the manifest's `detected_version`:

| Cohort | configs | field-construct reachability | configs 100% reachable |
|---|---|---|---|
| **Modern (≥1.12 declared)** | 76 | **98.26%** | 55.3% |
| Legacy (<1.12 / undeclared) | 144 | 94.02% | 21.5% |
| **Full corpus** | 222 | **95.88%** (11433/11924) | 33.3% |

The ~4% unreachable tail is **almost entirely deprecated / migrated schema the app deliberately models only in its modern form** — `dns-rule.outbound` (102 configs; pre-1.11 routing, now action+server), legacy typeless DNS-server `address_resolver`/`strategy`/`address_strategy` (pre-1.12 schema), inbound `sniff`/`sniff_override_destination`/`sniff_timeout` (pre-1.11; now route `action: sniff`), tun `inet4_address`/`inet6_address` (pre-1.11; now `address`), vmess `alter_id` (deprecated) — **plus non-standard Clash.Meta extensions** (`filter`/`providers`/`use_all_providers`/`include`/`exclude` on selector/urltest) that sing-box's own strict decoder rejects. The genuine *modern-schema* coverage gaps are tiny: `naive.quic`, `naive.insecure_concurrency`, and shadowsocks-inbound single `password` (4 configs).

### Dynamic reconstruction (end-to-end ground truth)

Beyond static classification, two dense real configs were **rebuilt from scratch using only the command surface the GUI controls dispatch** — `createInbound`/`createOutbound`/`createDnsServer`/`createRuleSet` (palette), `updateEntityField` (structured field controls), `addRouteRule`/`addDnsRule` (rule editors) — restricted to fields that have a structured control. The result was export-pruned and deep-diffed against the original:

| Config (real-world, anonymized) | entities rebuilt | RED (no control, skipped) | residual diff after excluding RED |
|---|---|---|---|
| **Config A** (http / anytls / selector / urltest) | 2 in / 46 out / 2 dns / 3 rule-set / 14 rules | **0** | **0 — 100% reconstructed via the command surface** |
| **Config B** (tuic / anytls / naive / selector / urltest) | 2 in / 52 out / 3 dns / 2 rule-set / 16 rules | 1 (`naive.quic`) | **0 — byte-identical except that one boolean** |

This is end-to-end proof (not just static classification): driving the real GUI command surface reproduces both configs field-for-field, surviving serialization, with the only gap being the single documented `naive.quic` field in Config B.

**Verdict on the estimate:** the synthesis "90-95%" is **corroborated, not hallucinated** — three independent angles agree: single dense config 99.1% (static), 222-config corpus 95.88% / modern cohort 98.26% (static breadth), and **dynamic reconstruction with 0 residual diff** (Config A 100%, Config B 100% minus `naive.quic`). The honest refinement: **modern (≥1.12) configs are ~98-100% pure-GUI buildable**; the full corpus is dragged to ~96% by legacy configs carrying pre-1.11/1.12 fields the app intentionally doesn't author from scratch (it round-trips them). Caveats: corpus measurement is top-level-key granularity (nested descent only raises green, as the n=1 deep dive showed); "reachable" = has a structured control / shared-group / factory coverage.

## Six-dimension scorecard

| Dimension | re-run #3 | re-run #4 | Verdict (re-run #4) |
|---|---|---|---|
| schema-coverage | adequate | **strong** | All stable types modeled; deprecated/removed kept `creatable:false` for round-trip; Advanced-JSON fallback → no silent unreachable field. |
| graph-fidelity | adequate | **strong** | Node/edge/port is a faithful projection of the tag-reference graph; dual registry + parity test guard drift; flat ≥1.11 rule-action model is correct. |
| interaction-completeness | adequate | **strong** | Every node kind palette-creatable; every cross-object ref is dropdown/port (never free-text); forced raw-JSON confined to exotic constructs; ~90-95% GUI-only. |
| serialization-correctness | strong* | **adequate** | graph→JSON identity, 220-fixture + 18 real-binary round-trip lossless; **one hole:** heuristic linter can't catch unknown/typo'd field names the strict decoder FATAL-rejects. |
| version-targeting | adequate | **adequate** | Type/section gating strong + binary-verified; **field-level hole** (QUIC block ungated on default 1.13) + severity inconsistency (1.14-only fields ship via bypassable warning). |
| architecture-soundness | adequate | **adequate** | Single declarative `SCHEMA_ROWS` spine is real; Inspector already split 5641→318 lines. Smells: half data-driven renderer (~45 `entityType===` literals), label/version sources outside the table, two registries kept honest only by tests. |

\* The original 2026-05-30 baseline scored serialization "strong"; re-run #4 re-weights the always-present unknown-field gap (M1) more strictly and lands it at "adequate". This is a scoring-lens sharpening, **not** a code regression — the code only improved (W1–W7 + #243).

---

# sbc-ui 最终评估报告:能否仅靠点击/拖拽/简单编辑生成 sing-box 配置?

> 评估对象:sbc-ui —— 以 React-Flow 画布把 sing-box JSON 配置"工作流化"的编辑器。
> 评估日期:2026-05-30 | 评估方式:逐维度证据核验 + 关键断言代码复核。

---

## 1. 总体结论

**合理。基本实现了"JSON 的 workflow 化"。** 当前设计与实现是一套自洽、工程质量高的"GUI 即配置源"系统:`config` 字段本身就是 sing-box 配置对象,画布图(节点/边)是 `deriveGraph(config, …)` 的**纯派生投影**,序列化就是 `JSON.stringify(config)`。这条主线从根本上保证了画布永远无法表达 config 里不存在的东西,`graph→JSON` 是恒等映射、不可能失真。

**纯 GUI 可达性:在生产环境(已配置二进制校验)下约 90-95% 的真实配置可纯点击/拖拽/结构化编辑完成,无需手写 JSON。** 剩余 5-10% 的少数异形子对象需落到**内联 JSON 子编辑器**(不是整库 textarea),如 hysteria2 masquerade 对象形式、SSM-API 多路径映射、嵌套深度 >5 的逻辑规则、个别冷门 headless 匹配器、以及模型未播种的冷门标量(vmess `global_padding` 等)。

**两个尚未达成"绝对保证"的关键点:**
1. **有效性证明而非可达性。** 默认导出门控是启发式 linter,**检测不出未知/拼错字段**——而 sing-box 严格解码器会 FATAL 拒绝它们。生产环境已用 `.env.production`(`VITE_OFFICIAL_CHECK_URL=https://api.sbcv.app`,已核实)接入真二进制校验缓解,但 dev 构建、自托管不配 URL、以及校验服务不可达窗口仍可导出被真二进制拒绝的配置。
2. **字段级版本门控有真实漏洞。** QUIC 共享字段块在默认 stable 1.13 目标上完全未门控;一批 1.14-only 字段只发可绕过的 warning 却自称"会被 stable 拒绝"。

**综合评分:7.5 / 10。** 覆盖面与图保真度为 strong,序列化正确性、版本门控、架构可维护性为 adequate。所有缺口都是可定点修复的工程问题,不动摇整体合理性。

---

## 2. 六个维度评分表

| 维度 | 评分 | 一句话判断 |
|---|---|---|
| **Schema 覆盖** | **Strong** | 63 行 SCHEMA_ROWS 建模全部稳定协议类型;弃用/移除类型保留 `creatable:false` 仅供往返;Advanced JSON 兜底保证无字段静默不可达。 |
| **图保真度** | **Strong** | 节点/边/端口是 sing-box 标签引用图的忠实投影;双注册表 + parity 测试静态守护漂移;对 ≥1.11 扁平 rule-action 模型理解正确;泄漏点少且有文档。 |
| **交互完整性** | **Strong** | 每个节点种类可从调色板创建,每个跨对象引用是下拉框/端口而非自由文本;强制 raw JSON 仅限极少数异形构造;~90-95% 配置纯 GUI 可达。 |
| **序列化正确性** | **Adequate** | `graph→JSON` 恒等且结构精确,220 fixture + 真二进制往返无损;唯一实质漏洞:启发式 linter 检测不出未知/拼错字段。 |
| **版本目标** | **Adequate** | 类型/段级门控强且经二进制验证;字段级有真实漏洞(默认 1.13 上 QUIC 字段未门控)+ 1.14-only 字段只发可绕过 warning 的严重性不一致。 |
| **架构可维护性** | **Adequate** | 单一声明式 SCHEMA_ROWS 是真脊梁;Inspector.tsx 已从 5641 拆到 318 行(brief 前提已过时);次要异味:半数据驱动渲染、标签/版本三处外置、双注册表靠测试维系。 |

---

## 3. 设计亮点:节点/边/端口 + 注册表设计做对了什么

### 3.1 单一事实源 + 纯派生图(架构最核心的正确决策)
- store 里**没有节点/边结构**,只有 `config: SingBoxConfig`(`useProjectStore.ts:141`)+ 应用本地 `layout` 坐标映射。图由 `deriveGraph(config, layout, diagnostics, channel)`(`graph.ts:249`)纯函数派生,仅被 `CanvasWorkspace.tsx:256` 用 `useMemo` 消费,**从不进入序列化**。
- 序列化即 `JSON.stringify(config, null, 2)`(`serialization.ts:88`),导出前 `pruneExportNoise` 只剔除空串/空数组等无害噪声。
- 严格的分层:`grep` 确认 `src/domain/` 无 `domain→canvas` 反向 import;`minVersions.ts:4` 显式注释保留该分层约束。这意味着不存在第二个权威模型,杜绝了双源不一致。

### 3.2 协议覆盖近乎完整且边界守得住
- `SCHEMA_ROWS`(`schemaRegistry.ts:138-1082`)63 行,doc-vs-schema diff 返回 0 个缺失类型。每行携带 `factory`(默认值唯一来源)、`creatable`、`sharedGroups`、`fields[]` 元数据,**驱动调色板列表、校验、Inspector 渲染**。
- 弃用/移除类型(wireguard/dns 出站、legacy/mdns DNS server)保留 `creatable:false`——**可往返、可编辑,但不在调色板提供**,这与上游 deprecation 状态精确对应,是正确姿态而非覆盖缺口。

### 3.3 引用模型:下拉框/端口,绝不自由文本
- 跨对象引用一律为 `<select>`(填充自现有标签)或可拖拽端口:`route.final`(`routeInspector.tsx:51-61`)、`dns.final`(`dnsInspector.tsx:45-58`)、route-rule `outbound`(`ruleInspectors.tsx:103-111`)、dns-rule `server`、selector `default`、各类 `detour`(`sharedFields.tsx`)。**先前 brief 关于"自由文本 route.final/rule.outbound"的说法已过时、不成立。**
- 对 sing-box ≥1.11 的**扁平 rule-action 模型理解正确**:`rule.action` 字符串 + 同级 `rule.server`/`rule.outbound`,按 action 门控边是忠实的,不是过度简化。

### 3.4 双注册表 + parity 测试守护漂移
- `referenceRegistry.ts`(8 个 ReferenceKind 的完整 rename/delete 级联)与 `portRelationRegistry.ts`(可画成边的子集)分工清晰;`registry-parity.test.ts:16-38` 静态强制每个可写引用路径**要么有边、要么在 Inspector-only 白名单**——这是对静默漂移的真实有效守护。
- 导入去重 `dedupeTags`(`indexes.ts:156`)命名空间感知、首次出现优先,**永不破坏引用**(首个标签持有者不改名),且 endpoint 与 outbound 共享命名空间处理正确。

### 3.5 共享嵌套块全部逐字段结构化
- 15 个 SharedFieldGroup(`sharedFieldRegistry.ts:4-19`)逐字段编辑:TLS reality/ech/utls 内联 ACME + dns01(provider 门控)、v2ray-transport 五变体、multiplex+tcp-brutal、quic、dial、listen——而非整块 raw JSON。
- **Advanced JSON 兜底**(`advancedFields.tsx`)保证任何未被结构化控件认领的字段仍可编辑;C17 守护测试(`no-silent-unreachable-fields.test.tsx`)断言无字段静默不可达。

---

## 4. 关键差距与风险(按严重度分组)

### 🔴 Major(影响"保证有效"的核心承诺)

**M1. 未知/拼错字段过启发式门控,但 sing-box FATAL 拒绝**
- 证据:`.tools/bin/sing-box-stable check` 对 `{type:'direct', totally_bogus_field:'xyz'}` 返回 `json: unknown field "totally_bogus_field"` 退出码 1;而 `validateConfig` 对同一配置返回**零诊断**。`serialization.ts:47-86` 的 `normalizeConfig` 只检查顶层容器形状,**不校验字段名**;`exportConfig.ts:60-66` 只按 `level==="error"` 门控。
- 缓解(已存在):`.env.production` 已配 `VITE_OFFICIAL_CHECK_URL=https://api.sbcv.app`(已核实),生产构建导出时 `runOfficialCheck()` 会拦截未知字段。残余缺口:dev 构建、自托管不配 URL、以及校验服务不可达时仅发 warning(`useProjectStore.ts:1875-1884`)而不阻断。
- 建议:把真二进制校验设为部署默认且**校验不可达时按 error 阻断**(而非 warning);或新增"未知字段" linter pass,遍历每个实体对 schemaRegistry 已知 + 共享组字段集,对严格解码器会拒绝的键报 error。

**M2. QUIC 共享字段块在默认 stable 1.13 上完全未门控**
- 证据:`quic` 被放在**无条件 `sharedGroups`**(而非 `testingSharedGroups`)里,见 `schemaRegistry.ts:285/346/365`(hysteria/tuic/hysteria2 入站)、`607/669/703`(出站)——已核实。QUIC 卡片(`sharedFields.tsx:322-329`)渲染 4 个字段(`initial_packet_size`/`disable_path_mtu_discovery`/`idle_timeout`/`keep_alive_period`)**无 channel 过滤**。上游 `testing/.../shared/quic.md:5` 标注 "Since sing-box 1.14.0",stable 无该文件。经 vitest 复核:在 stable/1.13 目标上这些字段产生**零版本/QUIC 诊断**,直接导出被 1.13 二进制拒绝。
- 建议:把 `quic` 从无条件 `sharedGroups` 移入 `testingSharedGroups`,并在 <1.14 目标上对任何 QUIC 块键报 error(仿 `checkTls113Fields` 模式),配二进制验证测试。

**M3. 1.14-only 字段只发可绕过 warning,与团队自己的政策自相矛盾**
- 证据:tun `dns_mode`/`dns_address`/MAC 过滤(`diagnostics.ts:1419-1448`)、ssh `cipher`/`mac`/`kex`(`1239-1268`)、hysteria2 `realm`/`bbr_profile`/`hop_interval_max`(`1283-1311`,已核实)在 stable 目标上均为 `level:"warning"`,而**语义等价**的 `dns.optimistic`/`certificate_providers`/`cloudflared` 等却正确报 error。`exportConfig.ts:84-96` 只阻断 error,warning 走一次性 `window.confirm` 可绕过。最刺眼:`diagnostics.ts:1291` 文案写 "will be rejected by stable builds" 却只发 warning(已核实)。这违反团队自身的 `version-gate-severity.test.ts:6-9` 政策。
- 建议:在 <1.14 目标上把这些字段级 testing-only 门控升级为 error(逐个二进制验证后),纳入 `version-gate-severity` 测试集。

### 🟡 Minor / 结构性

**G1. 约 14 个真实跨对象引用是 Inspector-only,无法画成画布边**
- 证据:`portRelationRegistry.ts:106-157` 对这些路径无 `canonicalPath`;`registry-parity.test.ts:16-38` 白名单列出原因。包括 selector/urltest `default`、`tls.certificate_provider`、legacy `address_resolver`、tun `route_address_set`、v2ray stats `inbounds/outbounds`、嵌套数组 detour(shadowtls/cloudflared/derp)。引用仍可在 Inspector 编辑且参与 rename/delete 级联,**不破坏 config**,只是画布呈现不完整。
- 建议:把 `selector/urltest default` 与 `tls.certificate_provider`(单标签跨节点引用,形状与已有边一致)提升为边;其余保持 Inspector-only 但确保悬空标签显示为 error 行。

**G2. 少数异形构造强制 raw JSON(80/20 取舍,可接受)**
- 证据:hysteria2 masquerade 对象形式(`inboundSectionsB.tsx:431`)、SSM-API 多路径 server 映射(`serviceInspector.tsx:95`)、嵌套深度 >5 逻辑规则(`ruleControls.tsx:174`)、个别冷门 headless 匹配器(`network_interface_address` 等)。逃逸口是**作用域内的 JsonField 子编辑器**,不是整库 textarea。
- 建议:若追求 99% 覆盖,为 hysteria2 masquerade `{type,url,headers}` 与 4 个冷门匹配器加结构化编辑器,并支持按需展开逻辑规则深度上限。

**G3. 模型未播种的标量无法从零作答**
- 证据:Advanced 兜底只渲染**已存在于对象上**的键(`helpers.ts:56-72`)。vmess `global_padding`/`authenticated_length`、naive `insecure_concurrency` 既不在 `handledFields` 也不被 factory 播种,只能经导入/raw-JSON 引入后才可编辑。
- 建议:对高价值缺失标量加进 factory 默认值或显式控件;或在 Advanced 段加"添加字段"功能。

**G4. 新增协议仍需触碰约 5-7 个文件(架构异味)**
- 证据:数据层确为单行(`SchemaRow` 捆绑 factory/creatable/fields/sharedGroups),但 UI **非自动生成**:`SchemaEnumField` 由调用方传 kind/type/field,无遍历 `fields[]` 渲染的循环;实测约 45 处 `entityType === "..."` 字面量条件分散在 `inboundSectionsB.tsx`/`outboundSectionsB.tsx` 等。标签表(`nodeLabels.ts:7`)与版本表(`minVersions.ts:8`)是表外第二/第三事实源。
- 建议:由 `fields[]` 驱动逐类型字段渲染;把 `typeLabels` 折进 SCHEMA_ROWS 的 `label` 字段;仅对 tun/selector 等特殊类型保留手写段。

**G5. 双注册表靠测试 + 手写白名单维系**
- 证据:`referenceRegistry.ts:312-345` 与 `portRelationRegistry.ts:106-157` 是两张独立手写表,唯一绑定是 `registry-parity.test.ts`(已纳入 CI 的 `release:check`)。历史上 5 类引用(route-rule resolve.server、tun route_address_set、shadowtls/derp/cloudflared 嵌套 detour)曾缺失,A6a 修复(`commit 381b217`)。当前测试全绿、模型忠实,属结构弱点非活跃缺陷。
- 建议:由 referenceRegistry 派生 portRelations 的 canonicalPath 集,消除重复路径串;或加文档抓取测试比对上游引用字段。

### 🟢 Observation(正向确认 / 信息性)
- **无 redo;undo 粒度粗**:仅 load/import 入快照;普通字段编辑/连线/删除/移动不入历史,不可单独撤销(`useProjectStore.ts:138-212,751-770`)。
- **raw-JSON 应用/导入会清空 layout**:手编 JSON 或导入丢失手动节点定位,仅 `.sbcv` 项目往返保留坐标。
- **占位密钥仅 warning**:factory 播种的 `change-me` 字符串密钥发 warning 可绕过导出(`diagnostics.ts:2208-2224`);而播种的固定 UUID 字面量**连 warning 都没有**——零诊断即导出 stub UUID。
- **1.14 弃用未提示**:DNS rule_action.strategy、hysteria recv_window/disable_mtu_discovery 两组弃用无提示(其同代 1.14.0 弃用项却有 warning)。
- **order/装饰边视觉上与真引用边几乎一致**:`inbound→route`、route/dns-rule-order 与可删真引用边同为绿色路径,无图例区分,易误读。

---

## 5. "纯 GUI 可达性"专项分析

### ✅ 可纯 GUI 构建(点击 + 拖拽 + 结构化表单)
| 配置区 | 可达方式 |
|---|---|
| 全部稳定入站/出站/DNS-server/endpoint/service/rule-set 类型 | 调色板点击创建;身份标量(server/port/uuid/password/users[])逐字段 |
| 跨对象引用(final/outbound/server/detour/selector members/domain_resolver) | 下拉框 或 画布端口拖拽连线 |
| 共享块 TLS(reality/ech/utls/acme/dns01)、v2ray-transport、multiplex、dial、listen、quic | `sharedFields.tsx` 逐字段 |
| 单例段 log/ntp/certificate/experimental(cache_file/clash_api/v2ray_api)、route hub、dns hub | 专属调色板节点 + 结构化 Inspector |
| route/dns 规则(action + 常用匹配器,深度 ≤5) | `ruleControls.tsx` 结构化编辑器 |
| 任何对象上**已存在**的未建模标量/对象 | Advanced JSON 兜底(逐键)|

### ⚠️ 强制落到内联 JSON 子编辑器(非整库,作用域内)
- hysteria2 `masquerade` 对象形式(`inboundSectionsB.tsx:431`)
- SSM-API 自定义多路径 `servers` 映射(`serviceInspector.tsx:95`)
- 逻辑规则嵌套深度 > 5(`ruleControls.tsx:174`)
- headless 规则冷门匹配器:`network_interface_address`/`default_interface_address` 等(`ruleControls.tsx:142-164`)
- domain_resolver/http_client 的对象形式(仅 `.server`/`.detour` 标签参与边,其余子键需表单/JSON)

### ❌ 从零无法作答,需先导入或整库 raw-JSON
- 模型既未建模又未 factory 播种的冷门标量:vmess `global_padding`/`authenticated_length`、naive `insecure_concurrency`(`handledFields.ts:169-194` 确认缺失)——必须经导入/raw-JSON 引入后才出现在 Advanced 兜底
- 顶层集合的整体结构(inbounds[]/outbounds[] 数组)从 Inspector 无增删入口(创建走调色板/JSON tab)
- 仅供 docs/参考的调色板项(Legacy DNS、WireGuard 出站、GeoIP/Geosite、各 shared-* 条目):无创建动作,只给 Docs 链接

### 量化估计
- **生产环境(已配二进制校验):约 90-95% 真实配置纯 GUI 可达且经真二进制证明有效。**
- 剩余 5-10% 需内联 JSON 子编辑器编辑一两个异形子对象,**不是整库手写**。
- 真正"零 GUI 路径"的只有冷门未播种标量与参考-only 段,占比极小。

---

## 6. 改进路线建议(按优先级)

### P0 —— 关闭"保证有效"缺口(直接对应 done-bar"保证能过 sing-box check")
1. **修复 QUIC 字段未门控(M2):** 把 `quic` 移入 `testingSharedGroups`,并在 <1.14 目标对 QUIC 块键报 error。低成本、影响默认目标、有明确二进制证据。
2. **统一版本门控严重性(M3):** 把 tun/ssh/hysteria2 等 1.14-only 字段在 stable 目标升级为 error;修正"will be rejected"却只发 warning 的文案矛盾。
3. **加固二进制校验为默认硬门控(M1):** 校验服务不可达时按 error 阻断而非 warning;或新增"未知字段" linter pass 兜住 dev/自托管路径。

### P1 —— 提升可达性与呈现保真
4. **提升两条 Inspector-only 引用为边(G1):** `selector/urltest default` 与 `tls.certificate_provider`,二者均为单标签跨节点引用、形状与已有边一致。
5. **占位密钥升级(Observation):** 对公网监听入站等安全敏感场景把 `change-me` 占位升为 error;给播种 UUID 至少加 warning。
6. **order/装饰边差异化样式 + 图例(Observation):** 虚线/灰色/细线 + 一行图例,消除"边即引用"的误读。

### P2 —— 架构与可维护性收敛
7. **由 `fields[]` 驱动逐类型字段渲染(G4):** 把约 45 处 `entityType===` 字面量收敛为表驱动;`typeLabels` 折进 SCHEMA_ROWS。
8. **双注册表单源化(G5):** 由 referenceRegistry 派生 portRelations 路径,消除重复串。
9. **补 redo + 细化 undo 粒度(Observation):** 让字段编辑/连线/删除可单独撤销。

### P3 —— 长尾 99% 覆盖(可选)
10. 为 hysteria2 masquerade、SSM-API 多路径、4 个冷门 headless 匹配器加结构化编辑器;逻辑规则深度上限改为按需展开。
11. 把高价值未播种标量(vmess global_padding 等)加进 factory 默认值,使其出现在 Advanced 兜底。

---

### 一句话收尾
**这套设计的根基(config 即配置本体、图为纯派生、引用为下拉/端口、单表驱动)是正确且经得起推敲的,"JSON 工作流化"在主流配置上已经实质达成。** 距离"任何配置都纯 GUI 且保证过 check"还差的,主要是字段级版本门控的两个定点漏洞和"默认非生产环境下导出靠启发式而非真二进制"这一条——都是清晰、可在数日内逐项修复的工程缺口,而非设计层面的方向性错误。

---

## 附录:六维度完整 verdict(工作流原文)

- **schema-coverage (strong):** Coverage is broad and largely complete. Every stable sing-box protocol type across all node-bearing sections is modeled (18/18 inbounds incl. testing-only cloudflared, 20/20 outbounds, 14/14 DNS servers, 2/2 endpoints, 6/6 services, 3/3 rule-sets) and all but the four intentionally-deprecated/removed types (wireguard outbound, dns outbound, legacy DNS server, mdns) are creatable from the palette; the deprecated four still round-trip and edit. All 7 route + 6 DNS rule actions, the singletons (log/ntp/certificate/experimental/route/dns hubs), and certificate_providers/http_clients are all reachable and structurally editable. Shared blocks (TLS incl. reality/ech/utls/acme/dns01, v2ray-transport, multiplex, dial, listen, quic, udp-over-tcp, tcp-brutal) have field-by-field editors. The principal coverage limits are by design and well-guarded: (1) the Advanced fallback only surfaces fields ALREADY present in the object, so unmodeled-but-valid scalars (e.g. vmess global_padding/authenticated_length) cannot be authored from scratch without the raw-JSON tab; (2) logical rule nesting deeper than 5 levels degrades to JSON; (3) visual overflow caps (24 rules, 24 rule-sets, 96 edges) hide — but never drop — entities.
- **graph-fidelity (strong):** The node/edge/port model is a faithful, well-engineered projection of sing-box's tag-reference graph. Every cross-object reference in the upstream "references" lists is accounted for in the FULL referenceRegistry cascade (rename/delete), and the cross-NODE subset is wired as canvas edges via portRelationRegistry. A parity test statically enforces that every writable reference path is EITHER edged OR on an explicit Inspector-only allowlist. The flat rule-action model (rule.action string + sibling rule.server/rule.outbound) is CORRECT for sing-box >=1.11. Leaky in a small, well-documented set: ~14 Inspector-only refs, partial single-port disconnect on aggregate relations, over-restricted detour targets, order/decorative pseudo-edges visually near-identical to true edges, no mutation-time cycle prevention. None corrupt config data.
- **interaction-completeness (strong):** YES for the overwhelming majority of real-world configs. Every node kind is creatable from the palette, every cross-object reference is a dropdown or a draggable port (never free-text), and every protocol's scalar/identity/TLS/transport/multiplex/credential fields have dedicated structured controls. A universal "Advanced JSON fields" inline fallback guarantees no field is ever silently unreachable. Forced raw-JSON is confined to a small set of genuinely-exotic constructs. ~90-95% of practical configs are achievable GUI-only with zero hand-written JSON.
- **serialization-correctness (adequate):** The store's config IS the sing-box config, so graph→JSON is identity and structurally exact; round-trip is verified lossless by a 220-fixture corpus test plus a real-binary check on 18 internal fixtures, and dangling refs/duplicate tags/empty groups are error-gated before export. The one material correctness hole is that the heuristic linter — the ONLY export gate unless the optional binary endpoint is configured — does not detect unknown/typo'd field names that sing-box's strict decoder FATAL-rejects.
- **version-targeting (adequate):** Type/section-level version gating is strong and binary-verified, but field-level gating has a real hole on the default 1.13 target (QUIC Fields) plus a severity inconsistency that lets 1.14-only fields ship via the bypassable warning path.
- **architecture-soundness (adequate):** Sound and maintainable for "GUI-as-config-source": a single declarative schema table (SCHEMA_ROWS) is the real spine. The headline "Inspector.tsx 5641 lines" risk is stale (now 318, already split). The genuine structural smells are secondary: a half-data-driven renderer that still needs hand-placed JSX, three label/version sources that live outside the table, and two parallel registries kept honest only by tests.
