# Goal — Inspector / 节点面板显示保真度:让"面板所示 = 实体所是"

> **中心问题(verbatim):** Inspector 面板与画布节点卡所显示的信息,是否**忠实**地表示底层 config 实体——不隐藏定义性字段、不用通用表单掩盖类型/动作差异、不以空字段误导、不静默丢弃已存在的数据?(用户原话:面板"失真/不可信"。)
>
> **Done-bar(重跑面板审计判据):** 重跑 `inspector-display-fidelity-audit` workflow(或等价定向核验),**高/中危失真为 0**;特别是 (a) 任何已配置的规则/实体在任何摘要面都不渲染成空白或语义相反的卡;(b) 无"导入能往返、GUI 却不可见不可编辑"的静默不可达字段;(c) 无"显示空白且首次编辑即丢值"的数据破坏。

## 0. 背景与依据(为什么是这个 goal)

用户上传真实订阅配置后发现:Route 面板的 Route Rules 把 Rule 1/2/3(action = sniff / hijack-dns / resolve)渲染成**视觉相同的空白卡**——隐藏了规则的定义性字段 action。据此启动的多 agent **显示保真度审计**(34 agents,报告 `docs/inspector-display-fidelity-audit-2026-05-31.md`)**确认 23 处失真(高 5 / 中 11 / 低 7)**,逐条核过源码,归为三个同源根因:

1. **抽象摘要面只建模"匹配维度"漏掉"动作维度"** —— 规则表与画布副标题把规则当"域名匹配→目标"二元模型,漏了 `action`(规则的本质)。
2. **匹配优先级硬编码只覆盖 4 个扁平域名字段** —— graph.ts 的 match 写死 `domain_suffix??domain_keyword??domain??rule_set`,其余 ~28 个真实匹配器(clash_mode/ip_is_private/protocol/port/…)塌缩成通用兜底。
3. **`handledFields` 双刃门控** —— 字段进 handledFields 既需专用控件显示、又被排除出 Advanced 兜底;当控件缺失或条件过窄时该字段**任何控件都不出现**却仍序列化往返(静默不可达)。

**根因 1+2(P0/P1)已修(W11 #249):** 新建 `src/domain/ruleSummary.ts` 单源("action + 忠实 match,含非域名匹配器 + logical"),Route/DNS 规则表显示只读摘要行(永不空白)+ logical 规则停止内联编辑,graph.ts 副标题用同一 helper。本 goal 把**剩余 22 处确认失真**(尤其根因 3 的静默不可达与一处数据破坏)拆成 DF 原子项。命名 **DF0–DF5**。

## 1. Non-Negotiables(流程门,沿用既有规范)

1. **单一可信源 = `docs/upstream/sing-box/{stable,testing}/...`**;字段是否合法、是否数组/对象形态、属哪个版本,以文档 + 真二进制为准。
2. **Test-first**:render 测试(挂载 App / 组件,断言控件出现且写回正确值)或 round-trip 测试(导入→编辑→导出无损)先行。
3. **每个 PR 一次专家 reviewer(`isolation:"worktree"`)**:UI 渲染用 React-perf/前端向 reviewer,数据破坏/序列化用 round-trip 向。见 [[feedback_codex_review_gate]]。
4. **合并门 = Workers Builds 绿 + reviewer APPROVE + `release:check` 绿**。见 [[feedback_cloudflare_merge_gate]]。
5. **PR-over-commits([[feedback_pr_over_commits]]);WILD MODE 不扩 scope([[feedback_wild_mode]])。**
6. **Don't-mix / Slice**:数据破坏修复(改 normalize/序列化语义)与纯显示修复分 PR。
7. **真实配置匿名**:用本地真实配置验证时只引用匿名标签(Config A/B),不把路径/内容写进仓库([[feedback_pr_over_commits]] 同精神,用户明确要求)。

---

## 2. Phase DF-P0 — 已完成(记录,不重复做)

### DF0 — 规则表 + 副标题忠实摘要(根因 1+2)✅ DONE(W11 #249)
- **已落地:** `src/domain/ruleSummary.ts`(`ruleMatchSummary`/`ruleSummaryLine`/`RULE_ACTION_LABELS` 含 1.14 evaluate/respond);`RuleTables.tsx` 每条规则只读摘要行 + logical 停内联编辑 + 引导 rule 节点;`graph.ts` 副标题用同一 helper(非域名匹配器 + logical 回退)。实测 config A 的 12 条 route 规则现各显 `sniff` / `hijack-dns · protocol:dns` / `resolve` / `route · private IP` 等。覆盖审计中 **8 项**(高 2 + 中 4 + 低 2:Route/DNS 表省略 action、logical 不可见、副标题丢非域名匹配器、clash_mode/protocol 塌缩、RULE_ACTION_LABELS evaluate/respond)。
- **遗留小项(可并入 DF5):** logical DNS 规则的**嵌套 rule_set 连边**(`graph.ts:654` 只读顶层)未生成边。

---

## 3. Phase DF-P1 — 数据破坏 / 静默不可达(高优先,根因 3)

### DF1 — TUN inbound 字符串型 `address` 显示空白 + 首编辑即毁值(高:数据破坏)
- **Outcome:** sing-box `tun.address` 可为 string 或 string[];当前 `inboundInspector.tsx:43` `value={toList(entity.address)}` 对字符串返回 `''`(显示空白无 placeholder),onChange 又 `fromList(...)` 永远写数组 → **首键即把原字符串改写成数组、丢原值**。修复:显示按 string|array 双形态(`Array.isArray(a)?toList(a):typeof a==="string"?a:""`),最稳妥是在 `normalizeConfig`(`serialization.ts:47-86`)对 `tun.address` `coerceStringList`(导入即规整为数组,既修显示又修毁值)。
- **Source of truth:** `docs/upstream/.../inbound/tun.md`(`address`: List/单值);真二进制接受两形态。
- **Touch:** `src/components/inspector/inboundInspector.tsx:43`;`src/domain/serialization.ts`(若走 coerce);`handledFields.ts`(address 在 inboundHandledFields,故不落 Advanced —— 修控件或 coerce 二选一)。
- **Change:** 若走 coerce:确认对 8 个外部字符串-address fixture 往返语义不变(数组化是 sing-box 等价的)。
- **Acceptance:** 字符串型 address 正常显示且**首次编辑不丢值**;数组型不变;`fixtures` 往返/二进制绿。
- **Tests:** `tests/tun-address-string-form.test.tsx`(导入字符串 address → 显示非空 → 编辑一项 → 不丢原值/不破坏)。
- **Reviewer:** serialization/round-trip。
- **Don't-mix:** coerce(序列化语义)单独 PR。
- **Slice:** 一 PR。

### DF2 — 已存在字段静默不可达:mdns `interface[]` / tailscale `relay_server_static_endpoints` + C17 守卫扩面(中)
- **Outcome:** 两个字段在各自 `handledFields` 里却无可用控件(mdns 的 interface 控件被门控到 dhcp 且为单行;tailscale relay_server_static_endpoints 无控件)→ 导入能往返但 GUI 不可见不可编辑。修复二选一:给它们专用控件,或从 handledFields 移除使其落 Advanced 兜底。**并把 C17 守卫(`handledFields.ts:structurallyCoveredKeys`)从 inbound/outbound 扩展到 endpoint / dns-server / service**,从结构上杜绝此类回归(再有"handled 但无控件"即 CI 失败)。
- **Source of truth:** `docs/upstream/.../dns/server/mdns.md`(interface: List)、`endpoint/tailscale.md`(relay_server_static_endpoints)。
- **Touch:** `dnsServerInspector.tsx`、`endpointInspector.tsx`、`handledFields.ts`(C17 扩面 + 移除/补控件);`tests/no-silent-unreachable-fields.test.tsx`。
- **Acceptance:** 两字段可见可编辑;C17 守卫覆盖 5 类实体且全绿(扩面后若暴露更多静默不可达字段,入队各自修)。
- **Tests:** C17 守卫扩面断言 + 两字段 render/round-trip。
- **Reviewer:** domain-correctness + 前端。
- **Slice:** S1 C17 扩面(可能暴露更多项);S2 修 mdns/tailscale 两项。

---

## 4. Phase DF-P2 — 显示语义修正(中/低)

### DF3 — `udp_over_tcp: true` 布尔简写显示为 OFF(中:隐藏定义性标志)
- **Outcome:** sing-box 接受 `udp_over_tcp:true` 旧式简写;UDP-over-TCP 卡的 Enabled 复选框读 `["udp_over_tcp","enabled"]`,遇布尔返回 undefined → 显示 OFF(config 实为 ON)。修复:布尔值按 `{enabled:bool}` 解读显示,或导入时强转对象形态。
- **Source of truth:** `docs/upstream/.../shared/udp-over-tcp.md`(bool | object)。
- **Touch:** `sharedFields.tsx:377-382`(或 `serialization.ts` coerce);`handledFields.ts:111`。
- **Acceptance:** `udp_over_tcp:true` 显示 ON;对象形态不变;往返绿。
- **Tests:** render + round-trip。 **Reviewer:** 前端 + round-trip。 **Slice:** 一 PR。

### DF4 — Clash API `default_mode` 大小写敏感清空导入值(中:误导空 + 改写)
- **Outcome:** `<select value=String(default_mode??"")>` 选项全小写,导入的 `"Rule"`/`"Enhanced"` 不匹配 → 显示 (unset)(卡头却 ON),首次改动写小写覆盖原值。修复:大小写不敏感匹配显示,或把已设的未识别值保留为可选项(参照 `ruleInspectors.tsx:322-325` 的 rcode 处理)。
- **Source of truth:** `docs/upstream/.../experimental/clash-api.md`(default_mode 大小写不敏感)。
- **Touch:** `settingsInspector.tsx:293-306`。
- **Acceptance:** 导入大写 default_mode 正常显示且不被首编辑改写。
- **Tests:** render/round-trip(导入 "Rule" → 显示选中 → 不改写)。 **Reviewer:** 前端。 **Slice:** 一 PR。

### DF5 — 低危精修批次(可一 PR 多项,各带断言)
- **DNS https/h3/tls/quic Port**:`server_port` 缺失时把协议默认值(443/853)填进 `value` 当具体值显示 → 改放 placeholder、value 留空(参照 `endpointInspector.tsx:107`)。`dnsServerInspector.tsx:104-132`。
- **WireGuard 副标题**:`graph.ts:1185-1189` 显示本地隧道地址(误读为服务器)→ 限定 "local …" 或优先显示首个 peer 地址。
- **WireGuard `system`(tun vs gVisor 栈)**:`endpointInspector.tsx` 降级成无说明的通用 Advanced 开关 → 提升为带标注的具名控件。
- **logical DNS 规则嵌套 rule_set 连边**(DF0 遗留):`graph.ts:654` 让嵌套 rule_set 参与连边。
- 每项独立断言;低危,合一 PR 但 don't-mix 数据语义改动。

---

## 5. Validation Matrix(每原子项落地前后必跑)
- `npx tsc --noEmit`
- 相关 render/round-trip 测试 + `no-silent-unreachable-fields`(C17)
- `npm test`(全套);`npm run release:check`(真二进制往返,确保数据语义修复不破坏导出)
- 数据破坏类(DF1/DF3 coerce):额外用本地真实配置(匿名)验证导入→编辑→导出无损
- 全部落地后重跑面板审计 workflow 核验高/中危归零

## 6. Definition of Done
1. 审计高/中危失真 **归零**(低危可酌情 defer,在 Decision Log 写明)。
2. 无"显示空白且首编辑毁值"的数据破坏(DF1);无"handled 却无控件"的静默不可达(DF2,C17 扩面守住)。
3. 规则/实体在任何摘要面都不渲染成空白或语义相反的卡(DF0 已达,保持)。
4. `fixtures/**` 往返/二进制全绿;真实配置(匿名)无损往返。
5. 无未解释的 P0/P1。

## 7. Sequencing / Decision Log
- **DF0(根因 1+2)已由 W11 #249 完成** —— 本 goal 起点是 DF1。
- **优先级**:DF1(数据破坏,最高)→ DF2(静默不可达 + C17 扩面,防回归)→ DF3/DF4(显示语义)→ DF5(低危批次)。
- **coerce vs 控件**(DF1/DF2/DF3 反复出现的取舍):能在 `normalizeConfig` 用等价 coerce 一次性修显示+数据破坏的优先 coerce(单源、防多控件分歧),否则补控件;每次选型记此。
- 延续 [[project_canvas_config_gen_assessment]] 评估脉络;DF0 实现见 `src/domain/ruleSummary.ts`(#249)。
