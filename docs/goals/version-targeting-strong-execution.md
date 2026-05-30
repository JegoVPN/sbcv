# Goal — version-targeting → strong:闭合"导出对所选版本保证有效"的最后一维

> **中心问题(verbatim,验收以重跑评估为准):** 用户用 GUI 生成的配置,**对所选 sing-box 目标版本(stable 1.13 / testing 1.14)是否保证有效**——即不可能在 stable 目标上导出一份带 1.14-only 字段、会被 stable 二进制 FATAL 拒绝的配置?
>
> **Done-bar(重跑 `scripts/workflows/canvas-config-gen-review.workflow.js` 判据):** version-targeting 维度从 **adequate → strong**,达成 **6/6 全维度 strong**;**任何 testing-only 字段在 stable 目标上导出被 error 硬阻断**(不靠逐字段手写门控的运气);引用级联无悬空;其余五维无回退。

## 0. 背景与依据(为什么是这个 goal)

re-run#5(66-agent,`docs/canvas-config-gen-assessment-2026-05-31-gui90-rerun5.md`)实测 **5/6 维度 strong**(serialization 经 W9、architecture 经 A1/A3 双双上台),**唯一停在 adequate 的是 version-targeting**。其 verdict 援引的"真实漏洞"经真二进制逐一核验后:

- **M1 `route.find_process` —— 误报,不做。** re-run agent 称其 1.14-only、stable 会 FATAL;实测 `.tools/bin/sing-box-stable check` 对 `{route:{find_process:true}}` **exit 0 接受**。`find_process` 是 stable 合法字段,**给它加门控会错误阻断有效配置**(W2/W5 同类教训)。仅在 Decision Log 记录,不产生原子项。
- **M2 hysteria2 入站 1.14-only 字段 —— 真实。** 实测 stable `unknown field "realm"`;W8(#245)当时只门控了 **出站** hysteria2 的 realm/bbr_profile/hop_interval_max(`diagnostics.ts` 路径 `/outbounds/`),**入站分支只调 `checkQuic114Fields`,漏了这三个**。
- **M3 `route.rules[].preferred_by` —— 真实(引用悬空)。** 它是 **endpoint tag 的 string[]**(`docs/upstream/.../route/rule.md:167` 示例 `["tailscale","wireguard"]`),但既不在 `referenceRegistry` 也不在 `portRelationRegistry` → 重命名/删除被引用的 endpoint 时该引用变悬空且不级联。
- **结构性根因(决定能否真正 strong):** W9 的未知字段 linter **有意合并双 channel 白名单**(`knownFieldsRegistry.ts`,注释明示"版本特定字段交给 version-gate 检查"),所以**每个 testing-only 字段都依赖一条手写门控**;漏写(如 M2)即在 stable 导出干净但二进制拒绝。要真正 strong,需把"testing-only 字段在 stable 上 = error"做成**数据驱动**(从 `knownFields.generated.ts` 的 per-channel 字段集派生),而非靠人逐个记得加。

本 goal 把上述拆成 VT 原子项:**VT1 修 M2(即时止血),VT3 做数据驱动版本门(治本、同时覆盖 M2 与未来字段),VT2 修 M3 引用悬空。** 命名用 **VT0–VT3** 以区别 V/W/C 系列。

## 1. Non-Negotiables(流程门,沿用既有规范)

1. **单一可信源 = `docs/upstream/sing-box/{stable,testing}/...`**,且**每个版本断言必须用 `.tools/bin/sing-box-{1.12,stable,testing}` 真二进制 `check` 验证**(本 goal 的全部门控都是版本断言,二进制是终审;文档与代码冲突以二进制+文档为准,记 Decision Log)。
2. **Test-first**:先写失败测试(stable=error / testing=ok 双断言),再实现。不得改坏任一 `fixtures/{stable,testing}` 往返/二进制断言。
3. **每个 PR 一次专家 reviewer(`isolation:"worktree"`)**,且**必须对抗式核对"是否误报"**——任何新门控都要证明被 gate 的字段确实被 stable 二进制拒绝(防 M1 类误报)。见 [[feedback_codex_review_gate]]。
4. **合并门 = Cloudflare Workers Builds 绿 + reviewer APPROVE + 本地 `release:check` 绿**;不等 GitHub Actions。见 [[feedback_cloudflare_merge_gate]]。
5. **PR-over-commits([[feedback_pr_over_commits]]);WILD MODE 不扩 scope([[feedback_wild_mode]])。**
6. **Don't-mix / Slice**:VT1(止血)与 VT3(数据驱动重构)分 PR;VT3 若引入误报风险须先 spike 验证零误报再落地。

---

## 2. Phase VT-P0 — 即时止血 + 治本版本门

### VT1 — hysteria2 入站 1.14-only 字段门控(修 M2)
- **Outcome:** 在 `diagnostics.ts` 的入站校验里,对 `channel === "stable"` 且 `inbound.type === "hysteria2"` 的 `realm` / `bbr_profile` / `hop_interval_max` 报 **error**(`source:"semantic"` → 喂 V2 导出硬闸),镜像 W8 已为出站 hysteria2 写的等价检查。
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/inbound/hysteria2.md`(realm/bbr_profile 标 "Since 1.14");二进制:`sing-box-stable check` 对带 `realm` 的 hysteria2 入站返回 `unknown field "realm"`(已验证),`sing-box-testing` 识别该字段。
- **Touch:** `src/domain/diagnostics.ts`(入站 hysteria2 分支,紧邻其 `checkQuic114Fields` 调用处);复用 W8 的 push 模式与 code 命名(如 `hysteria2-realm-testing-only`,但 path 指向 `/inbounds/`)。
- **Change:** 纯诊断;逐字段二进制确认 realm/bbr_profile/hop_interval_max 三者都在 stable 入站被拒后再 gate(只 gate 被证实拒绝的)。
- **Acceptance:** 带这些字段的 stable hysteria2 入站 → error 且导出被阻断;testing 目标零 error;现有 fixture 无新增 error。
- **Tests:** 扩 `tests/version-gate-severity.test.ts`:每字段 stable=error / testing=ok。
- **Reviewer:** domain-correctness + 二进制误报核对。
- **Don't-mix:** 只加入站门控;不动出站既有检查。
- **Slice:** 一 PR。

### VT3 — 数据驱动 testing-only 字段门控(治本,真正使 version-targeting → strong)
- **Outcome:** 新增一个**从 `knownFields.generated.ts` per-channel 字段集派生**的检查:对每个实体,凡出现的顶层字段 ∈ `testing_doc[kind][type]` 但 ∉ `stable_doc[kind][type]`(即 1.14-only),在 stable(<1.14)目标上报 **error**。一次性覆盖 M2 及所有现存/未来 1.14-only 字段,取代逐字段手写门控的脆弱性。
- **Source of truth:** `src/domain/knownFields.generated.ts`(`gen-known-fields.mjs` 从 `docs/upstream/{stable,testing}` 抽取的 per-(channel,kind,type) 字段集);终审仍是真二进制。
- **Touch:** NEW `src/domain/versionFieldGate.ts`(派生 testing-only 集 + 一个豁免补充集);`src/domain/diagnostics.ts`(在实体循环里调用)。
- **Change:** **必须先 spike 验证零误报**——doc-parse 偶有漏列合法 stable 字段(W9 已知:tuic.zero_rtt_handshake 不在 stable 文档却 stable 合法),会被错判为 1.14-only → 误阻断。复用/对齐 W9 的 `SUPPLEMENT` 思路:凡"stable 二进制接受但 stable 文档漏列"的字段进豁免集(spike 跑 `fixtures/stable` + 真二进制零误报后方可落地)。落地后,W8/VT1 的逐字段手写门控可保留为更友好的文案层,但闭集由本检查兜底。
- **Acceptance:** 任一 1.14-only 字段(realm、QUIC 块、tun dns_mode、ssh cipher、…)在 stable 上一律 error,无需各自手写;`fixtures/stable/*` + config A/B(本地匿名验证)零误报;新加一个 1.14 字段无需改诊断即被 gate。
- **Tests:** `tests/version-field-gate.test.ts`(派生集快照 + 代表性 1.14 字段 stable=error/testing=ok + 全 `fixtures/stable` 零误报断言);spike 阶段额外用真二进制交叉验证派生集。
- **Reviewer:** domain-correctness + 二进制零误报核对(最高风险项,按 W9 标准对抗审查)。
- **Don't-mix:** 与 VT1 分开(VT1 先合,VT3 再覆盖);spike 与实现分阶段。
- **Slice:** S1 spike(派生集 + 零误报验证,临时 harness 不提交);S2 实现 + 豁免集 + 测试。

---

## 3. Phase VT-P1 — 引用保真

### VT2 — `route.rules[].preferred_by` 纳入 endpoint 引用级联(修 M3)— ❌ **误报,不做(WONTFIX)**
> **裁定(对抗式审查 + 真二进制/上游文档核实,2026-05-31):M3 是误报,与 M1 `find_process` 同类。** `route.rules[].preferred_by`(Since 1.13)**不是 tag 引用**,而是只有两个合法值的**固定枚举** `tailscale` / `wireguard`(`route/rule.md`:"Match specified outbounds' preferred routes" —— `tailscale`=Match MagicDNS domains & peers' allowed IPs,`wireguard`=Match peers' allowed IPs)。仓库自有派生文档已明确:`docs/claude/rule-route-rule.md:224` "Fixed enum, not a tag"、`docs/ui-reviews/rule-route-rule.md:55` "not a tag reference; it is an enum-like list (`tailscale`, `wireguard`)"。
> **若误把它纳入 endpoint 级联会产生真实数据破坏**:用户有一个**名为 `tailscale` 或 `wireguard` 的 endpoint**(完全合法 —— `tailscale` 正是一种 endpoint type 的常见命名),rename/删除它会把规则里本应是枚举常量的 `preferred_by` 改写/清空 —— 把有效配置改坏。枚举值压根不会"悬空"。**实现 PR #259 已据此关闭撤销。**
> **真正是 tag 引用的是另一个字段 `dns.rules[].preferred_by`**(1.14-only,**dns-server** tag 列表,见 `dns/rule.md`),与 route 的同名枚举字段无关;若日后要建模须另开一项、目标 dns-server 命名空间,且先确认其 enum/tag 混合语义是否值得建模。
>
> 以下原始(错误)方案保留作记录:
- **Outcome:** 把 `/route/rules/*/preferred_by`(endpoint tag 的 string[])加入 `referenceRegistry` 的 endpoint 访问器,使重命名/删除 endpoint 时该引用被改写/清理;并按 `registry-parity` 规则把它列为**画布边**或显式 `INSPECTOR_ONLY_REFERENCE_PATHS`(它是 string[],与 selector members 类似,倾向 Inspector-only 列表编辑)。
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/route/rule.md`(`preferred_by`:endpoint tag 数组,选择经哪个 endpoint 出网)。
- **Touch:** `src/domain/referenceRegistry.ts`(`visitEndpointRefs` 加 `config.route?.rules?.forEach(rule => rule.preferred_by = op.stringArray(rule.preferred_by))`,并把路径加进 endpoint entry 的 `paths`);`INSPECTOR_ONLY_REFERENCE_PATHS`(W10/A3,加 `/route/rules/*/preferred_by` + 理由);若做成边则加 `portRelationRegistry`。
- **Change:** 纯引用级联补全;`registry-parity.test.ts` 会强制"要么边、要么 Inspector-only",据此二选一。
- **Acceptance:** 改名/删除一个被 `preferred_by` 引用的 endpoint → 引用同步改写/清理(不悬空);`registry-parity` 绿;往返无损。
- **Tests:** 扩 `tests/domain.test.ts` 引用级联用例(rename/delete endpoint 命中 preferred_by);`registry-parity` 自动覆盖。
- **Reviewer:** domain-correctness。
- **Don't-mix:** 只补 preferred_by;不动其它引用。
- **Slice:** 一 PR。

---

## 4. Validation Matrix(每原子项落地前后必跑)
- `npx tsc --noEmit`
- `npx vitest run version-gate-severity version-field-gate registry-parity domain`
- 真二进制:对每个被 gate 的字段,`.tools/bin/sing-box-stable check`(应拒)+ `sing-box-testing check`(应受);`fixtures/stable` 零误报
- `npm test`(全套);`npm run release:check`(真二进制 fixture 往返)
- 落地后重跑 `scripts/workflows/canvas-config-gen-review.workflow.js` 核验 version-targeting → strong

## 5. Definition of Done(重跑判据)
1. version-targeting 维度 **strong**;达成 **6/6 全 strong**。
2. 任一 testing-only 字段在 stable 目标导出被 error 硬阻断,且**由数据驱动检查兜底**(非纯手写门控)。
3. ~~`preferred_by` 引用级联完整,无悬空。~~ → **moot:M3 误报**(`route.rules[].preferred_by` 是固定枚举 `tailscale`/`wireguard`,非 tag 引用,无悬空可言;详见 VT2 段与 Decision Log)。
4. 其余五维无回退;`fixtures/**` 全绿、二进制零误报。
5. 无未解释的 P0/P1(每个未做项在 Decision Log 写明)。

## 6. Sequencing / Decision Log
- **M1 `route.find_process` = 二进制确认的误报(stable exit 0),不 gate** —— 记录在此,防后续重复"修复"一个非缺口。
- **M3 `route.rules[].preferred_by` = 误报,不做(WONTFIX)** —— 它是固定枚举 `tailscale`/`wireguard`(`route/rule.md`),**非 tag 引用**(仓库自有 `docs/claude/rule-route-rule.md:224` "Fixed enum, not a tag")。纳入 endpoint 级联会破坏名为 tailscale/wireguard 的 endpoint 配置(rename/删除时改写枚举常量)。实现 PR #259 已撤销。真正的 tag 引用是 `dns.rules[].preferred_by`(dns-server tag,1.14-only),另当别论。**对抗式审查在此正确拦截了一次会破坏有效配置的"修复"** —— 与 M1 同类教训:看到 tag 旁数组里有字符串就推断是引用,需以上游 prose + 真二进制为准。
- **VT1 → VT3 顺序**:VT1 即时止血(小、确定);VT3 治本(需 spike 验零误报,风险高,后做且独立审查)。**实际落地:VT1 #257、VT3 #258 均已合并;VT3 的数据驱动门由 13/13 字段真二进制零误报核对 + 全 fixtures/stable 扫描守住,reviewer 另查出并修复了 tun MAC 三重报错(path 对齐)。**
- ~~**VT2 边 vs Inspector-only**~~ —— moot,VT2/M3 误报不做(见上)。
- 延续 [[project_canvas_config_gen_assessment]] 的评估脉络。
