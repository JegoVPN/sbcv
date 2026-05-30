# Goal — 纯 GUI 可达性 ≥90%:闭合"可信赖的有效配置生成器"最后一公里

> **中心问题(verbatim,验收以重跑评估为准):** 现在能否**仅通过点击、拖拽、简单结构化编辑**生成一份**完整且有效**的 sing-box 配置——即把 JSON 真正"workflow 化",且导出的配置**保证能过 `sing-box check`**?
>
> **Done-bar(P-phase 重跑判据):** 纯 GUI 可达性 **≥90%**(基线 60-70%)、**任何主流构造零强制 JSON 回退**、**导出对结构性错误硬阻断**(不可能导出一份结构非法的配置)、serialization 维持 strong、六维评分无一回退。

## 0. 背景与依据(为什么是这个 goal)

C0–C17 remediation 已全部合并(覆盖广度 / 深层块编辑 / 序列化 / 版本门控 / C17 守卫 / Inspector 拆分到 316 行 shell)。**P3 复评(62-agent,`docs/canvas-config-gen-assessment-2026-05-30-post-remediation.md`)实测可达性仍 ~60-70%、overall adequate**,因为决定天花板的两个"封顶项"**从不在 C0–C17 scope 内**:

- **G1/G2 校验缺口** —— 无 JSON-Schema/枚举/类型校验;导出是裸 `JSON.stringify` + 可绕过的 `confirm()`(`src/components/exportConfig.ts:confirmAndExportConfig`),无法保证有效。
- **G4 可枚举长尾** —— tun mtu/strict_route、ss relay destinations[]、trojan fallback_for_alpn、wireguard peer reserved、对象形态 domain_resolver/http_client、深层逻辑规则、数组重排序仍须落原始 JSON。

本 goal 把 P3 报告第 6 节(P0–P3 路线 + G1–G13)拆成可执行原子项。**最高杠杆是 V-P0(有效性闭合)——这是评分天花板**;V-P1 收长尾与一致性;V-P2 补隐喻完整度与架构债。命名用 **V0–V12** 以区别于 C0–C17。

## 1. Non-Negotiables(流程门,沿用既有规范)

1. **单一可信源 = `docs/upstream/sing-box/{stable,testing}/...`**。每个原子项必须引用其源文档(字段/枚举/版本/迁移),代码 vs 文档冲突时以文档为准且在 Decision Log 记录。
2. **Test-first**:先写失败测试(锚定 outcome),再实现。新增校验不得改坏任一现有 `fixtures/{stable,testing}` 往返/二进制断言。
3. **每个 PR 一次专家 reviewer**:派最契合该改动领域的 senior Claude Code reviewer subagent(domain-correctness vs upstream / React-perf 用 `vercel-react-best-practices` / serialization-round-trip),**reviewer 用 `isolation: "worktree"`**(避免抢主工作树分支)。见 [[codex-review-gate]]。
4. **合并门 = Cloudflare Workers Builds 绿 + reviewer APPROVE + 本地真二进制 `release:check` 绿**;不等 GitHub Actions release-check。见 [[cloudflare-workers-merge-gate]]。
5. **PR-over-commits**([[feedback-pr-over-commits]]);**WILD MODE 不扩 scope**([[wild-mode-autonomous]])——本 goal 内的项才做,新发现的 P0/P1 入队不顺手扩。
6. **Don't-mix / Slice**:行为变更与纯重构分 PR;大项切 sub-slice 各自保持 suite 绿。
7. **Validation Matrix**(见 §6)每项落地前后必跑。

---

## 2. Phase V-P0 — 有效性闭合(评分天花板,先做)

### V0 — schema enum/type 元数据 + 数据驱动 scalar/enum 渲染(完成被推迟的 C14-S10)
- **Outcome:** `SchemaRow`(`src/domain/schemaRegistry.ts:25`)新增**逐字段的 type/enum 元数据**(标量字段:`string|number|boolean|enum`,enum 带取值列表 + 可选 since/until 版本);新增一个 `<DataDrivenScalarFields>`,叶子标量/枚举字段从该表渲染(enum → `<select>`,number → numeric input),逐 family 替换 Inspector 里等价的内联 `<select>`/input 分支(byte-identical snapshot 锁)。这是 C0 表的"最后一个消费者",也是 V1 校验与 V5 一致性的数据底座。
- **Source of truth:** 各协议子文档的字段枚举(如 `shared/tls.md` 的 `min_version/max_version/utls.fingerprint`、`outbound/shadowsocks.md` `method`、`outbound/vmess.md` `security`、`outbound/vless.md` `flow`、`shared/dial.md` `domain_strategy/network_strategy`、`outbound/tuic.md` `congestion_control/udp_relay_mode`、`outbound/hysteria2.md` 等)。
- **Touch:** `src/domain/schemaRegistry.ts`(加 `fields?: SchemaFieldMeta[]`,枚举数据);NEW `src/components/inspector/dataDrivenScalarFields.tsx`;逐 family inspector 文件把可数据化的内联枚举/标量分支替换为 `<DataDrivenScalarFields>`(每 family 一 slice,snapshot 不变)。
- **Change:** 先补全枚举元数据(纯数据 + markers 测试),再加渲染器,再逐 family 迁移。不改任何字段的可见行为(同 `<select>` 选项、同 testid)。
- **Acceptance:** 每个 family 的渲染输出对迁移前快照 byte-identical;枚举数据对 upstream 文档逐一核对(测试断言);C0 表自此有活的生产消费者;tsc/suite/`release:check` 绿。
- **Tests:** `tests/schema-field-enums.test.ts`(每行枚举值匹配 upstream 抽取);`tests/data-driven-scalars.test.tsx`(每 type 渲染的 {field,controlType,options,channel-gate} 集合对表)。
- **Reviewer:** domain-correctness(枚举 vs upstream)+ React-perf(渲染器)。
- **Don't-mix:** 元数据 PR 与渲染器迁移 PR 分开;迁移行为冻结,不顺手加新字段。
- **Slice:** S1 字段元数据(数据+测试);S2 渲染器;S3..Sn 每 family 迁移。

### V1 — 枚举/类型校验诊断(非法枚举/错类型 → error)
- **Outcome:** 新增 `source:"semantic"` 的 `enum-invalid` / `type-invalid` 诊断:遍历 config 实体,按 V0 的 schema 字段元数据校验每个标量字段的取值在枚举内、类型正确;非法即 error 级、pathed 到 `/<collection>/<index>/<field>`。这是无需打包二进制就能"保证大部分有效性"的第一道硬门。
- **Source of truth:** 同 V0 的协议子文档枚举/类型。
- **Touch:** `src/domain/diagnostics.ts`(新增校验段,复用 `:43` 的 push helper + `Diagnostic` shape `{level,code,message,path,source}`,`src/domain/types.ts:157`);消费 `schemaRegistry` 字段元数据。
- **Change:** 纯诊断新增,不改写 config。枚举校验须尊重 active(channel,version)(某枚举值仅在某版本有效时按目标门控)。
- **Acceptance:** 故意写非法 `method`/`congestion_control` 的 fixture 触发 error;合法 fixture 零新增 error;现有 `fixtures/**` 全部仍零 error(否则是数据 bug,入队修)。
- **Tests:** `tests/enum-type-validation.test.ts`(正例零 error,反例精确命中 path+code)。
- **Reviewer:** domain-correctness。
- **Don't-mix:** 只加诊断;字段编辑器/导出门控是 V0/V2。
- **Slice:** 一 PR(若枚举多可按 kind 切)。

### V2 — 真 `sing-box check` 进导出路径 + 结构性错误硬阻断
- **Outcome:** 导出**默认接入真实校验**并对结构性/error 级问题**硬阻断**(替换 `confirmAndExportConfig` 里可绕过的 `confirm()`)。两条实现路线择一:(a) 打包 WASM `sing-box check`;(b) 把现有 `runOfficialCheck`(`src/state/useProjectStore.ts:1778`,走 `VITE_OFFICIAL_CHECK_URL`)做成导出前默认调用(已配置时)。导出按钮在有 error 级 semantic 诊断时**禁用/阻断**,而非弹可绕过的 confirm。
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/index.md` `### Check`(`sing-box check` 非零退出 = 非法);C15 已把 pruned-export 喂真二进制(`tests/export-binary-check.test.ts`)——这是把同一契约搬到运行时导出门。
- **Touch:** `src/components/exportConfig.ts:confirmAndExportConfig`(改为 error→硬阻断);`src/state/useProjectStore.ts`(若走 WASM:新增 check 集成;若走 official:导出前 await `runOfficialCheck`);TopBar/MobileMenuSheet 导出按钮态。
- **Change:** error 级 semantic(含 V1 枚举/类型 + V3 missing-tag)硬阻断导出;warning 仍可导出(保留 confirm)。`downloadProject`(草稿)不变,仍不门控。
- **Acceptance:** 含结构性 error 的 config **无法**导出(按钮禁用 + 明确原因列表);修正后可导;纯 GUI 走通路径(palette→编辑→连边→导出)导出物喂真二进制零拒绝(`release:check` 内 export-binary-check 仍绿)。
- **Tests:** `tests/export-hard-gate.test.ts`(error 存在时 `confirmAndExportConfig` 返回 false 且不下载;无 error 时下载);若打包 WASM 加 smoke。
- **Reviewer:** serialization/round-trip + CI/tooling(check 集成)。
- **Don't-mix:** 不改 `pruneExportNoise`/`createConfigExport`;不动外部 fixture 门。
- **Slice:** (a) 硬阻断 + 禁用态(纯前端);(b) 真 check 集成(WASM 或 official 默认化)。

### V3 — `entity-missing-tag` / 空 tag 诊断 + 导入去重
- **Outcome:** 新增 error 级 `entity-missing-tag` 诊断:任何**可被引用**的实体(inbound/outbound/dns-server/endpoint/service/rule-set/certificate-provider/http-client)缺 `tag` 或空 `tag` 即 error,pathed 到 `/<collection>/<index>/tag`,进 V2 导出门控;导入(`importJson`)时对重复/空 tag 去重加后缀 + toast。
- **Source of truth:** 各实体文档(`tag` 为引用键);现有 `duplicate-tag`(`src/domain/diagnostics.ts:63`)是唯一实体级 tag 诊断,无 missing。
- **Touch:** `src/domain/diagnostics.ts`(新增段);`src/domain/indexes.ts:35 pushTagged`(无 tag 实体当前对去重不可见——确认是否需纳入);`src/state/useProjectStore.ts:importJson`(去重)。
- **Change:** GUI 创建/改名路径已经 `getUniqueTag` 防空,故新诊断主要兜导入/手改 JSON;导入去重不丢数据(改 tag,不删实体)。
- **Acceptance:** 导入一份缺 tag 的可引用实体 → error + 导出被 V2 阻断;导入重复 tag → 自动后缀 + toast;GUI 正常创建零新增 error。
- **Tests:** `tests/missing-tag-diagnostic.test.ts` + `tests/import-tag-dedup.test.ts`。
- **Reviewer:** domain-correctness。
- **Don't-mix:** 不改 duplicate-tag 逻辑;只加 missing + 导入去重。
- **Slice:** 一 PR(诊断 + 导入去重可拆二)。

---

## 3. Phase V-P1 — 一致性 + 最高价值长尾

### V4 — 版本门控严重度 + palette 按版本门控
- **Outcome:** 把 testing-only 段在 stable 目标统一升级为 **error**(与同类对齐):inbound `cloudflared`(`diagnostics.ts:1151-1159`)、`certificate_providers[]`(`:1424-1433`)、`http_clients[]`(`:1434-1442`)从 warning→error(对齐 naive `:167-175` / ccm-ocm `:202-210` / hysteria-realm `:331-339`);`Palette.itemStatus`(`src/components/Palette.tsx:323`)接入 active **version**(`TYPE_MIN_VERSION`/`getMinVersion`,`src/domain/minVersions.ts:8/24`)而非仅 channel(修 1.12-stable 仍把 naive/ccm/ocm 列为可创建);修 `setChannel` 丢 version 的 latent bug。
- **Source of truth:** 各 testing-only 段的 "Since sing-box 1.14" / 1.13 标注;`docs/upstream` 版本矩阵。
- **Touch:** `src/domain/diagnostics.ts`(3 处 warn→error,目标≥移除/未到引入版本时);`src/components/Palette.tsx:323 itemStatus`;`src/state/useProjectStore.ts setChannel`。
- **Change:** 升级后这些段进 V2 导出门控;palette 在不满足 min version 时置灰 + tooltip。
- **Acceptance:** stable 目标下创建/携带 cloudflared/http_clients/cert_providers → error 且导出被阻断;1.12-stable 不再提供 naive/ccm/ocm;setChannel 后 version 不丢(测试)。
- **Tests:** 扩 `tests/version-gate-*.test.ts`;`tests/palette-version-gate.test.ts`。
- **Reviewer:** domain-correctness(版本矩阵)。
- **Don't-mix:** 只动严重度/门控,不改字段建模。
- **Slice:** S1 诊断严重度;S2 palette 版本门控 + setChannel 修复。

### V5 — 最高价值长尾结构化编辑器
- **Outcome:** 为可枚举长尾补专用控件,消除"Use Advanced JSON"提示:
  - trojan **fallback_for_alpn**(alpn→{server,port} 行 repeater;现 `inboundSectionsB.tsx:370` 提示落 JSON);
  - shadowsocks **relay destinations[]**(repeater);
  - wireguard **per-peer reserved**(三整数输入,嵌 peers[] 行内);
  - tun **mtu / strict_route / interface_name**(一线控件,补进 `handledFields`);
  - TLS 1.13 server 字段、cloudflared control/tunnel_dialer(择高价值)。
- **Source of truth:** `inbound/trojan.md`、`inbound/shadowsocks.md`、`endpoint/wireguard.md`、`inbound/tun.md`、`shared/tls.md`。
- **Touch:** `src/components/inspector/inboundSectionsB.tsx`、`endpointInspector.tsx`/`outboundSectionsB.tsx`(wg peers)、`handledFields.ts`(新键纳入,过 C17 守卫)。
- **Change:** 每补一个编辑器即从 raw-JSON 长尾移除一项;C17 守卫保证新 handled 键有控件。
- **Acceptance:** 上述字段可纯 GUI 编辑并正确序列化;往返无损;C17 守卫绿;`release:check` 绿。
- **Tests:** 每编辑器一 behaviour 测试(编辑→config 路径断言)+ 往返。
- **Reviewer:** React-perf + domain-correctness。
- **Don't-mix:** 每个长尾字段独立 slice;不混 V0 渲染器迁移。
- **Slice:** 每字段一 slice(S1 trojan、S2 ss、S3 wg reserved、S4 tun、S5 TLS…)。

### V6 — 对象形态 domain_resolver / http_client 结构化编辑
- **Outcome:** shared field 在 domain_resolver/http_client/default_http_client 为**对象形态**(带 strategy 等兄弟键)时,从当前降级的 `JsonField`(`src/components/inspector/sharedFields.tsx:450`)升级为结构化子表单(server 下拉 + strategy 枚举 + 其余键),字符串形态保持现有下拉。
- **Source of truth:** `shared/dial.md`(domain_resolver 对象 schema)、testing `http_clients`/`shared` http_client。
- **Touch:** `src/components/inspector/sharedFields.tsx`(对象分支)。
- **Change:** 仅升级对象形态编辑;字符串形态/往返不变。
- **Acceptance:** 对象形态可纯 GUI 编辑 server+strategy;字符串↔对象切换不丢键;往返无损。
- **Tests:** `tests/object-form-resolver-editor.test.tsx`。
- **Reviewer:** React-perf + domain-correctness。
- **Slice:** 一 PR。

---

## 4. Phase V-P2 — 隐喻完整度 + 架构债

### V7 — 高价值引用补画布边 + 注册表 parity 测试
- **Outcome:** 为只在级联中、从不成画布边的高价值引用补 **writable PortRelation**:inbound detour(inbound→inbound,自环守卫)、route-rule resolve server(action 门控,镜像已存在的 dns-rule server 边 `graph.ts:646`);并加**构建期 parity 测试**:断言 `referenceRegistry` 每条 writable canonicalPath 要么有对应 PortRelation/边、要么在显式 Inspector-only allowlist——防两套注册表漂移。
- **Source of truth:** `src/domain/referenceRegistry.ts`(完整级联)vs `src/domain/portRelationRegistry.ts`(可连边子集);相关字段文档。
- **Touch:** `portRelationRegistry.ts`(+关系);`graph.ts`(渲染);NEW `tests/registry-parity.test.ts`。
- **Acceptance:** 新边可拖拽连接并写回同一路径;parity 测试覆盖全部 writable 路径;对称性套件仍绿。
- **Tests:** parity 测试 + 新边的 connect/disconnect 对称性。
- **Reviewer:** domain-correctness(注册表)。
- **Slice:** S1 parity 测试(先暴露缺口);S2 补 inbound detour;S3 补 resolve server。

### V8 — 边可读性 + 悬空引用可见
- **Outcome:** 同一对节点间不同关系可区分(per-relation 轻量标签或颜色/虚线 + hover tooltip,`CanvasEdge.tsx:44-78`);未解析 tag 渲染独特"悬空边"样式或 owner 端口徽标(`graph.ts:270 outboundTargetNodeId` 当前盲返),统一各关系存在性守卫。
- **Source of truth:** N/A(交互打磨);保持 [[project_node_card_n1_findings]] 设计脉络。
- **Touch:** `src/components/CanvasEdge.tsx`、`src/canvas/graph.ts`(makeEdge label / 悬空检测)。
- **Acceptance:** 多关系边视觉可分;悬空引用在画布有可见信号(非仅诊断面板)。
- **Reviewer:** React-perf + canvas/React-Flow。
- **Slice:** S1 边标签/颜色;S2 悬空边渲染 + 统一守卫。

### V9 — 数组重排序(GUI)
- **Outcome:** selector/urltest 成员清单与顶层数组(inbounds/outbounds/dns.servers/endpoints/services/rule_set)加 up/down 重排命令(现仅 `moveRouteRule`/`moveDnsRule`,`commands.ts:319/333`)。
- **Touch:** `src/domain/commands.ts`(通用 move);相关 Inspector repeater。
- **Acceptance:** 顺序可纯 GUI 调整并序列化;往返保序。
- **Reviewer:** domain-correctness。
- **Slice:** S1 成员清单;S2 顶层数组。

### V10 — 偿还架构债(G12/G13)
- **Outcome:** 把 `togglePortConnection` 39 分支硬编码梯子(`src/state/useProjectStore.ts:1044-1541`)迁到已泛型化的 adapter(`portReferenceAdapter`),消除注册表第二份复制;消费或删除 `schemaRegistry` 休眠版本列,收敛版本数据真相源(minVersions/nodeLabels/schemaRegistry 三份 → 一份)。
- **Change:** 纯重构,零行为变更;对称性套件 + parity 测试作锁。
- **Acceptance:** togglePortConnection 走 adapter;suite/对称性/parity 全绿;版本数据单源。
- **Reviewer:** architecture/refactor。
- **Slice:** S1 togglePortConnection→adapter;S2 版本列收敛。

---

## 5. Phase V-P3 — 体验打磨(可 defer,不入 done-bar)
- V11 大组截断画布指示(镜像 route/dns notice,`graph.ts:36 MAX_VISUAL_*`);V12 palette→画布拖放放置(onDrop/dataTransfer);clone-node 命令;数组编辑器拖拽重排。各为独立小项,done-bar 达成后按需排。

---

## 6. Validation Matrix(每原子项落地前后必跑)

| Case | Check |
| --- | --- |
| stable config(`fixtures/stable`) | `pnpm validate:fixtures` → `sing-box-stable check`(1.13) |
| testing config(`fixtures/testing`) | `sing-box-testing check`(1.14);1.12/legacy 走 `sing-box-1.12` |
| app code | `pnpm exec tsc -b` + `pnpm test` + `pnpm build` |
| frontend diff(`src/components/**`、`src/state/**`) | `vercel-react-best-practices` skill gate(同 session) |
| e2e / smoke | `pnpm e2e`;纯 GUI 路径(palette 创建→编辑→连边→**导出被硬门校验**) |
| pruned-export ↔ binary | `pnpm release:check` 内 `export-binary-check`(pruned 导出喂真二进制) |
| **新增:导出硬门** | V2 后:含结构性 error 的 config 无法导出(测试 + e2e) |

## 7. Definition of Done(P-phase 重跑)

backlog 全部合并后,用 `Workflow({ scriptPath: "scripts/workflows/canvas-config-gen-review.workflow.js" })` **重跑评估**,reportMarkdown 落到新日期化文件 `docs/canvas-config-gen-assessment-<YYYY-MM-DD>.md`(并置对比可达性提升)。**DONE 判据(以重跑为准):**

1. **纯 GUI 可达性 ≥90%**(基线 60-70%);
2. **任何主流构造零强制 JSON 回退**(报告第 5 节 ⚠️ 表中无主流构造);
3. **导出硬门**:不存在"结构非法仍可导出"的路径(V2 在 CI/e2e 内验证);
4. **serialization 维持 strong**,**六维评分无一回退**;
5. **无未解决 / 未显式 deferred 的 P0/P1**(每个未做项在 Decision Log 写明理由)。
6. 若重跑仍暴露 P0/P1,入队为下一原子项(**不扩 scope**),修完再重跑,直至判据满足。

## 8. Sequencing / Decision Log

- **顺序:** V-P0(V0→V1→V2→V3)是天花板,**最先且按序**(V1 依赖 V0 的字段元数据;V2 依赖 V1/V3 的 error 诊断进门控)。V-P1(V4–V6)独立可并行,不阻塞。V-P2(V7–V10)隐喻/债,V0-P0 之后任意排。V-P3 defer。
- **V2 实现路线(WASM vs official 默认化)** 是首个待定:打包 WASM `sing-box check` 体积/构建成本 vs 复用 `VITE_OFFICIAL_CHECK_URL`(需部署 check 端点)。落地前在本 Decision Log 记录选型。
- **不扩 scope**:本 goal 只闭合 P3 报告 G1–G13;新发现的 gap 入队不顺手做。
- 评审门遵循 [[codex-review-gate]];合并门遵循 [[cloudflare-workers-merge-gate]];落地遵循 [[feedback-pr-over-commits]] / [[wild-mode-autonomous]];设计脉络延续 [[project_node_card_n1_findings]] 与 [[project-canvas-config-gen-assessment]]。
