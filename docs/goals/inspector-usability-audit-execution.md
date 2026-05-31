# Inspector Usability Audit — Execution Plan

Run with:

```txt
/goal execute the inspector usability remediation queue (U1–U15) --spec docs/goals/inspector-usability-audit-execution.md
```

This is the remediation goal for the **2026-05-31 inspector 可用性审计**（70-agent workflow，
脚本 `scripts/workflows/inspector-usability-audit.workflow.js`，59 条原始发现，经对抗验证后 49 条 confirmed/partial、10 条 refuted）。

**触发问题（motivating bug）：** Target = `1.14 testing` 时，remote Rule-Set 节点显示红色弃用提示
「`download_detour` is deprecated in sing-box 1.14.0 (removed in 1.16.0). Use an HTTP Client (`http_client`) instead.」——
这条提示**符合上游**（`docs/upstream/sing-box/testing/configuration/rule-set/index.md:130-134`）。inspector 也确实给了 HTTP Client 配置入口，
**但那个下拉框永远只有 "None"**，用户无法配置它。于是 UI 推荐的替代方案无法落地，而被弃用的 `download_detour` 反而是阻力最小的路径。

## 审计结论（重要：根因与第一直觉不同）

逐条对抗验证后，结论被**显著修正**——必须照此执行，不要按原始直觉改：

- **没有真正的 P0。** 每一个最初标 P0 的发现在重新追踪真实代码后都被降级。**数据模型与序列化是健全的**：
  序列化是通用的 `structuredClone` 导入 + `JSON.stringify`/`pruneExportNoise` 导出（`src/domain/serialization.ts:73,109-138`），
  **没有任何 per-field/per-protocol 序列化器**。因此「字段在生成时被丢弃 / 不能往返」这一整类首轮发现**全部为误报并已撤回**，
  唯一例外是 WireGuard keepalive 的类型强转（U2）。
- **HTTP Client 的真正根因 = 可发现性死胡同，不是坏控件。** `http_client` 上游定义为「字符串（顶层 `http_clients[]` 中某共享 client 的 tag）**或**对象」
  （`docs/upstream/sing-box/testing/configuration/shared/http-client.md:7-28`）。tag-引用下拉框是**正确的主控件**，选中后能正确往返。
  下拉框只有 "None" 仅仅因为：(a) 全新项目里 `config.http_clients` 为空；(b) 填充它的能力藏在一个独立的、testing-gated 的 Palette 项里，
  且 `http_client` select 既无 `hint` 也无就地创建入口。**修复 = 加可发现性脚手架（空状态提示 + 就地创建 + 内联对象入口），不是改模型。**
- **真正的缺陷集中在两类系统性模式：**
  1. **「引用下拉框无空状态/无就地创建」→ None-only 死胡同**（`http_client` ×4 owner、`domain_resolver` ×2）。
  2. **「Advanced 回退只能编辑已存在的 key」→ 全新节点上无法设置**（`AdvancedScalarFields`/`AdvancedNonScalarFields` 遍历 `Object.entries(entity)`，
     没有"新增 key"入口）：Tailscale/WireGuard ~8 个 key、DNS rule action 模型、route/DNS rule-action 子字段都因此**从零无法编写**；
     更糟的变体是嵌在 handled 对象下的 key（`obfs.min/max_packet_size`）或固定表格无逃生口（DNS rules）。
  3. **per-action/per-type 控件手写、覆盖不全且漂移**（route resolve、DNS predefined、route-options、inbound hysteria2 obfs / TUIC）。

**地基牢固、序列化无损 —— 这是补齐可达性与可发现性的收尾工程，不是推倒重来。**

### 与既有 goal 的关系

本 goal 与 `docs/goals/canvas-config-gen-remediation-execution.md`（C0–C17）**互补、不重叠**：
C-queue 聚焦 palette 创建/版本门控精度/序列化门控统一；本 U-queue 聚焦**已存在节点的 inspector 内字段可达性与可发现性**。
两处都涉及 `http_client`/`certificate_providers`/`hysteria2 1.14` 时，本 doc 在对应 atomic 内显式 cross-ref，避免重复落地。

## Process (non-negotiable)

继承自前序 goal（canvas config-gen remediation / UX language & affordances），逐条不可省略：

- **单一可信源 = `docs/upstream/sing-box/{stable,testing,oldstable}/`** —— stable = 1.13、testing = 1.14、oldstable = 1.12。
  每个原子项**必须引用其对应的 docs/upstream 源文档**，并以该文档为字段/枚举/版本判定（version-added / deprecated-in / removed-in / channel）的**唯一依据**。
  下游若与 docs/upstream 冲突，以 docs/upstream 为准；markers 是**忠实转写**，不是再解读。审计目标渠道 = **testing（1.14）**。
- **Canonical config is the source of truth.** store 的 `config: SingBoxConfig` 即逐字 sing-box JSON；React Flow 节点/边 + Inspector + JSON 全部是它的**单向派生投影**。
  序列化已被验证无损——**任何原子项都不得新增 per-field 序列化器**，新字段靠通用 passthrough 自动往返；改动只在控件层。
- **One atomic = one outcome，严守 don't-mix。** copy vs behavior、domain vs component、stable vs testing-gated、refactor vs feature。过大的原子项按其 `Slice` 拆成多个**各自独立 green** 的 PR。
- **Test-first.** 先写失败测试再改实现；迁移既有测试到新的正确行为（绝不为通过旧测试而保留错误行为）。
- **Land via squash PR，never direct push to `main`.** PR gate + main issue gate 都必须 clean（见 `docs/goal-driven-development.md` 的 Post-Merge Issue Gate）。**Green-before-merge 是硬门：本地 `pnpm test` + `pnpm build` 全绿、Cloudflare Workers Builds 检查 = success、reviewer verdict 已回且 actionable 发现已应用——四者缺一不得合并。** 测试红、build 错、有冲突、CI 未通过、或 review 未回时一律停下，绝不合并。
- **Review gate（per-PR best-suited Claude Code expert reviewer，NOT Codex；BLOCKING）：** 每个 PR 派出最匹配该原子项领域的专家 reviewer subagent(s)（用 Agent 工具：React/perf、domain schema 正确性、version-gating/diagnostics、serialization/round-trip、canvas/React-Flow）。**这是阻塞门：必须先拿到 reviewer 的 verdict，应用其 actionable 发现，本地重新跑到全绿，然后才进入合并步骤。** reviewer 给出 REQUEST-CHANGES 时绝不合并。一次 pass、合并前完成。
- **Frontend gate**（`vercel-react-best-practices`，见 `AGENTS.md` 的 Frontend Skill Gate）对任何 `src/components/**` 或 `src/state/**` diff 强制执行，在同一 work session 内做 bundle / rerender scope / derived-state / async-waterfalls / 全局订阅检查。
- **C17 不变量必须保持绿。** 每个新增结构控件的 key：要么加入对应 `*HandledFields` 且**确实渲染一个能用的控件**，要么加入 `INLINE_RENDERED_KEYS`——否则 `tests/no-silent-unreachable-fields.test.tsx`（C17 guard）会失败。这正是本审计要落实的「主流零回退」硬判据。
- **Re-verify against HEAD before each atomic.** 开工前 sync 到 main 并对照 HEAD 复核 file:line 锚点（`.claude/worktrees/*` 可能 stale；本 doc 锚点采于 2026-05-31 HEAD）；`pnpm exec tsc -b` + `pnpm test` + `pnpm build` + `pnpm e2e` 全绿后再开始。
- **Devlog every atomic** —— 在下方 Running TODO 勾选 + 在 Milestone Notes 追加一条 per-atomic 记录（what changed / tests / expert-review verdict / verification commands）。

### Execution Loop（strict / serial / interruptible）—— 不可省略

本次执行的**事故根因**是把多个步骤串进同一个工具批次、在红 / review 未回时就合并，导致 review gate 与 green gate 形同虚设、且用户无法中途叫停。为杜绝复发，每个原子项**必须严格串行单步推进**：

1. **一次只做一个原子项。** 不跨原子项预跑。前一个原子项合并并过 main issue gate 之前，不开始下一个。
2. **一个工具批次只做"一件可独立验证的事"。** 严禁把 implement、跑测试、commit、push、开 PR、轮询 CI、merge、下一个原子项 这些**不同阶段**打包进同一个工具批次。每个阶段是独立的一轮，看到上一轮的真实结果后才进入下一轮。
3. **每个原子项的强制步骤序列（逐步、各自独立成轮）：**
   a. sync main + 对照 HEAD 复核 file:line 锚点；
   b. test-first 写失败测试，确认它**确实红**（看真实输出，不看汇总）；
   c. 实现；
   d. 跑目标测试 → 全量 `pnpm test` → `pnpm build`，**全绿**（红则停下修，不前进）；
   e. 新建分支、commit、push、开 PR；
   f. **派阻塞 reviewer**，拿 verdict，应用 actionable 发现，本地重新全绿；
   g. 轮询 Cloudflare Workers Builds（check 名 = `Workers Builds: sbcv`）至 `success`；
   h. **此时四门全绿**（local test/build + reviewer verdict + CI success + 无冲突）才 squash-merge + 删分支；
   i. sync main，跑 main issue gate，勾选 Running TODO + 追加 Milestone Notes。
4. **绝不在红 / build 错 / 冲突 / CI 未绿 / review 未回时合并**（与上方 Land/Review 门重复，因其重要故再申明）。
5. **空工具输出按"已成功"对待，不重试、不据此 reset / 恐慌操作。** 需要确认时单独发一条只读命令核查，绝不基于猜测改动仓库状态。
6. **可中断优先于速度。** 步骤之间留出用户介入窗口；用户一旦表达停止，立即停、不抢跑。

- `AGENTS.md` —— 仓库工作约束 + Frontend Skill Gate。
- `scripts/workflows/inspector-usability-audit.workflow.js` —— 本 goal 的来源审计 workflow（可重跑做 re-assessment）。
- [`docs/goal-driven-development.md`](../goal-driven-development.md) —— Goal R&D 模板 / Atomic Rules / Post-Merge Issue Gate。
- [`docs/goals/canvas-config-gen-remediation-execution.md`](canvas-config-gen-remediation-execution.md) —— 姊妹 goal（C0–C17）+ 本 doc 的 house-style 来源；cross-ref 见各 atomic。
- **`docs/upstream/sing-box/{stable,testing,oldstable}/configuration/**`** —— **唯一可信源**。每个原子项 detail block 内逐条引用其 `Source of truth` 路径与 channel。

## Phases & Atomic Queue

执行顺序 **U-P0（触发 bug + 唯一导出错误）→ U-P1（impossible-to-set 集群）→ U-P2（per-type/覆盖）→ U-P3（打磨/硬化 + re-assessment）**。原子项彼此基本独立、可并行排队，除非注明依赖。

### Running TODO

#### Phase U-P0 — The motivating bug + the only emit-correctness defect
- [x] U1-http-client-migration-loop — rule-set/route/dns-server HTTP Client select 加空状态 hint + testing-gated「Create HTTP Client」就地创建按钮 + 弃用 banner 联动；一举修掉触发 bug 与 4 个同类 owner。Touch: `src/components/inspector/sharedFields.tsx`, `src/components/inspector/ruleSetInspector.tsx`, `src/domain/commands.ts`(reuse). **DONE (PR #272).**
- [x] U2-wireguard-keepalive-int — WireGuard peer `persistent_keepalive_interval` 改为整数强转（当前写原始字符串，sing-box 拒绝），placeholder `"25s"`→`"25"`。Touch: `src/components/inspector/endpointInspector.tsx`. **DONE (PR #271).**

#### Phase U-P1 — impossible-to-set clusters
- [x] U3-dns-rule-action-model — DNS Rules 表格加 action `<select>`（reusing `updateDnsRule`→`normalizeDnsRule`）；深度 per-action 选项已在节点检查器（`DnsRuleInspector`）覆盖，故表格只补 action select（右尺寸，不重复造编辑器）。Touch: `src/components/RuleTables.tsx`. **DONE (PR #273 + #275 + #276).**
- [x] U4-tailscale-fields — Tailscale 分支补 `accept_routes`/`ephemeral`/`exit_node`/`exit_node_allow_lan_access`/`hostname`/`relay_server_port`，登记 handled + INLINE_RENDERED_KEYS。Touch: `src/components/inspector/endpointInspector.tsx`, `handledFields.ts`. **DONE (PR #277).**
- [x] U5-wireguard-fields — WireGuard 分支补 `listen_port`/`name`/`workers`，登记 handled。Touch: `src/components/inspector/endpointInspector.tsx`, `handledFields.ts`. **DONE (PR #280).**
- [x] U6-route-rule-action-coverage — route resolve `timeout`/cache/ttl/client_subnet、predefined `answer`/`ns`/`extra`、route-options 6 子字段 + 1.14 `tls_spoof`/`tls_spoof_method`（版本门控）、reject Method 加 `reply`（**仅 route**,上游修正）。Touch: `src/components/inspector/ruleInspectors.tsx`, `ruleControls.tsx`, `Inspector.tsx`, `diagnostics.ts`. **DONE (PR #282 U6a + #283 U6b).**

#### Phase U-P2 — per-type / coverage gaps
- [x] U7-hysteria2-obfs-1.14 — outbound+inbound obfs gecko `min/max_packet_size`；outbound 1.14 `hop_interval_max`/`bbr_profile`/`brutal_debug`/realm；inbound 补整个 obfs 控件。Touch: `outboundSectionsB.tsx`, `inboundSectionsB.tsx`, `handledFields.ts`, `diagnostics.ts`. **DONE (PR #285 U7a + #286 U7b).**
- [x] U8-tuic-inbound-section — inbound TUIC 分支：`congestion_control`/`auth_timeout`/`zero_rtt_handshake`/`heartbeat`。Touch: `inboundSectionsB.tsx`, `schemaRegistry.ts`, `handledFields.ts`. **DONE (PR #288).**
- [ ] U9-dns-optimistic-object — `optimistic` 复合控件（enabled + stale-serve window `timeout`），并澄清相邻 per-query Timeout 标签。Touch: `src/components/inspector/dnsInspector.tsx`.
- [ ] U10-domain-resolver-empty-state — `domain_resolver`/`default_domain_resolver` select 加 hint +（可选）就地创建 DNS server。Touch: `src/components/inspector/sharedFields.tsx`.
- [ ] U11-inline-http-client — `http_client` 内联对象入口（tag→object 切换）+ diagnostic 校验内联对象里的不支持 key。Touch: `sharedFields.tsx`, `src/domain/diagnostics.ts`.
- [ ] U12-cert-provider-acme — standalone ACME certificate-provider 的 `dns01_challenge` 结构化编辑器 + `http_client` select。Touch: `sharedFields.tsx`, `handledFields.ts`.（与 C2/C3 cross-ref）

#### Phase U-P3 — polish / hardening + re-assessment
- [ ] U13-rule-action-scrub — 扩展 `normalizeRouteRule`/`normalizeDnsRule` 的 drop 列表（sniffer/timeout/strategy/route-options 组），修测试注释。Touch: `src/domain/commands.ts`, `tests/rule-action-field-scrub.test.ts`.
- [ ] U14-deprecation-hardening — `download_detour` 1.16 升 error + both-set 冲突 diagnostic；testing 上 Download Detour 控件按值/渠道门控；修正 version-gate 注释（可选 singleton 覆盖）。Touch: `src/domain/diagnostics.ts`, `ruleSetInspector.tsx`, `versionFieldGate.ts`.
- [ ] U15-network-enum-derp — `network` matcher enum(tcp/udp/icmp) + 修内联标签；DERP `verify_client_url` detour→outbound `<select>` + 余下 HTTP Client Fields。Touch: `ruleControls.tsx`, `serviceInspector.tsx`.
- [ ] U16-reassess — 重跑审计 workflow 复核 U1–U15 是否落地、是否引入回归；更新本 doc 的 Milestone Notes。

---

### Phase U-P0 — The motivating bug + the only emit-correctness defect

#### U1-http-client-migration-loop — P0 (headline / 触发 bug)
- **Outcome:** rule-set（及 route `default_http_client`、dns-server）的 HTTP Client `<select>` 在选项为空时显示空状态 hint，并提供一个 testing-gated「Create HTTP Client」按钮就地创建 `http_clients[]` 资源并自动选中；弃用 banner 联动指向同一动作。触发 bug（None-only 死胡同）连同 4 个同类 owner 一并修复。
- **根因（已对抗验证）:** **可发现性死胡同，不是坏控件。** `http_client` 模型/往返均正确；只是空 `http_clients[]` + 无 hint + 无就地创建。**不要改 `http_client` 的形状或把它变成强制内联对象**（字符串 tag 形态是合法的，diagnostics 已认它）。
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/shared/http-client.md:7-28`（http_client = 顶层 `http_clients[]` 中共享 client 的 tag，或内联对象；Since 1.14.0）；`docs/upstream/sing-box/testing/configuration/rule-set/index.md:114-122,130-134`（remote rule-set `http_client` 字段 + `download_detour` 弃用→改用 http_client）。
- **Touch:** `src/components/inspector/sharedFields.tsx:126-128`（`httpClientOptions` 来源）、`:386-387`（rule-set `http_client` / route `default_http_client` 定义）、`:547-560`（select 渲染分支，恒前置 `<option value="">None</option>`）、`:562-570`（既有 `domain-resolver` 就地动作按钮模式可复用）。给这两个定义加 `hint`；当 `(definition.options ?? []).length === 0` 时渲染空状态 + 「Create HTTP Client」按钮（以 `path[0] === 'http_client' || 'default_http_client'` 或新增 `createKind` 标志定向）。`SharedFieldControl` 目前是纯渲染器（只有 `updateField`）——需通过 prop/callback 线入 add-resource 动作。
- **Touch:** `src/domain/commands.ts:196-200`（`addHttpClient(config, preferredTag?)` 已存在，push `{ tag }` 进 `http_clients`）——直接复用，不新增命令。
- **Touch:** `src/components/inspector/ruleSetInspector.tsx:54-58`（弃用 banner）——扩展 banner 使其链接/触发同一 create 动作，让 steering 文案与控件联动。
- **Touch:** create 路径 testing-gated（`src/state/useProjectStore.ts` 的 `addResource('http-client')` 分支、`src/components/Palette.tsx` 的 http-client gate）——内联按钮必须同样 `channel === "testing"` 才显示。
- **Change:** 给 http_client/default_http_client select 加 (1) 空状态 hint、(2) testing-gated 就地创建按钮（调 `addHttpClient` 后选中新 tag）；banner 联动。无序列化改动。
- **Acceptance:** 全新 testing 项目里新建 remote rule-set → inspector 的 HTTP Client 区显示空状态提示 + 「Create HTTP Client」按钮；点击后 `http_clients[]` 多出一项且该 rule-set 的 `http_client` 自动指向它；切到 stable 时按钮不出现；既有 `http_clients` 往返/校验不回归。
- **Tests (test-first):** `tests/http-client-create-affordance.test.tsx` —— testing 下空 `http_clients` 时 select 旁出现 create 按钮，点击后 store 多一个 http-client 资源且 rule-set.http_client === 新 tag；stable 下按钮缺席；banner 文案含指向 create 的措辞。
- **Reviewer:** React/perf（prop 线入 + rerender scope）主审；domain schema-correctness 复核 http_client tag/object 形态不被破坏。
- **Don't mix:** 仅「可发现性 affordance」——不动 `http_client` 形状、不做内联对象编辑器（那是 U11）、不碰 `download_detour` 控件门控（U14）。
- **Slice:** S1 = hint + 空状态文案（最小、低风险）。S2 = 就地创建按钮 + banner 联动（线入 callback）。

#### U2-wireguard-keepalive-int — P1（唯一的导出正确性 bug）
- **Outcome:** WireGuard peer `persistent_keepalive_interval` 以**整数秒**写入/导出，而不是原始字符串；placeholder 由 `"25s"` 改为 `"25"`，不再暗示 duration 字符串。
- **根因（已对抗验证，confidence high）:** 控件写 `event.target.value || undefined`（原始字符串），sing-box 此字段解码为无符号整数、**拒绝字符串**，导致导出的 config 无法加载。同文件兄弟字段 `port`（`:109`）已用 `parseOptionalPort` 强转，唯独 keepalive 漏了。
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/endpoint/wireguard.md`（peer `persistent_keepalive_interval` = 整数秒）。
- **Touch:** `src/components/inspector/endpointInspector.tsx:131-142` —— 把 `value` 改为 `String(typeof peer.persistent_keepalive_interval === "number" ? peer.persistent_keepalive_interval : "")`，`onChange` 改为 `patchPeer(index, { persistent_keepalive_interval: parseOptionalPort(event.target.value) })`（或新增 `parseOptionalInt` 助手——非负整数或 blank 时 undefined），placeholder `"25s"`→`"25"`，可加 `type="number"`/`inputMode="numeric"`。`parseOptionalPort` 已在 `:7` 导入。
- **Touch（可选防御）:** `src/domain/serialization.ts` 的 `normalizeConfig` 在导入边界对 `endpoints[].peers[].persistent_keepalive_interval` 做强转，与既有 `coerceStringList`/`coerceUdpOverTcp` 同模式——但主修复是控件。
- **Change:** keepalive onChange 改用整数强转 helper + placeholder 修正。
- **Acceptance:** 在 WireGuard endpoint 的 peer 里输入 `25` → store 存 `25`（number）、导出 JSON 为 `"persistent_keepalive_interval": 25`；清空 → 字段消失；非数字输入不写入坏值；`sing-box check`（若 e2e 有二进制）接受导出结果。
- **Tests (test-first):** `tests/wireguard-keepalive.test.tsx` —— 输入数字断言 store 为 Number 且导出为整数；清空断言 undefined；既有 peer port/reserved 强转不回归。
- **Reviewer:** serialization/round-trip（类型正确性）主审；React/perf 次审。
- **Don't mix:** 仅 keepalive 字段——不顺手改 peer 其他控件或 endpoint 其他字段（那些归 U5）。

---

### Phase U-P1 — impossible-to-set clusters

#### U3-dns-rule-action-model — P1
- **Outcome:** DNS Rules 表格能设置 rule action 及其选项；当前 action 被硬编码为 route，整个 DNS rule action 模型在 GUI 不可写（每条 GUI 建的 DNS 规则只能 route，无法 reject 屏蔽域名、无法 predefined 返回固定响应、无法设 per-rule cache/ttl/timeout/client_subnet）。表格是固定表、**无 JSON/Advanced 逃生口**，所以一个已被模型与序列化支持的能力却**零写入路径**。
- **根因（已对抗验证，confidence high）:** 模型完整支持（`types.ts:74`，`normalizeDnsRule` 保留 action 子 key `commands.ts:270-278`，经 `serialization.ts:78` 往返；代码甚至已读 `rule.action` 来 gate Server 选择器），但 UI 从不**写** `action`。
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/dns/rule_action.md`（DNS rule actions：route / route-options / reject{method,no_drop} / predefined{rcode,answer,ns,extra} / 可选 evaluate）。
- **Touch:** `src/components/RuleTables.tsx`，`DnsRulesTable` 的 per-rule body（`:197+`，Server select 在 `:274-280`、`dnsRuleAllowsServer` gate 在 `:274`）—— 在 Server select 前加 action `<select>`（route | route-options | reject | predefined；可选 evaluate），经 `updateDnsRule(ruleIndex, { action })` 绑定；再按 action 条件渲染选项控件：reject→method/no_drop；predefined→rcode/answer/ns/extra；route|route-options→disable_cache/disable_optimistic_cache/rewrite_ttl/client_subnet（Server 仍由既有 `dnsRuleAllowsServer` gate）。
- **Touch（可选）:** `src/domain/commands.ts:289-297` `addDnsRule` 可 seed `action:"route"`——非必需，`normalizeDnsRule`/序列化已处理。**无序列化改动。**
- **Acceptance:** DNS Rules → +Rule → 出现 action select；选 reject 显示 method/no_drop；选 predefined 显示 rcode + answer/ns/extra 列表；route/route-options 显示 cache/ttl/client_subnet；每种 action 导出/往返正确；切换 action 时不残留旧 action 的字段（与 U13 协同）。
- **Tests (test-first):** `tests/dns-rule-action.test.tsx` —— 每种 action 渲染正确控件 + 写入正确 key；导出 JSON 形状符合 rule_action.md；Server select 在 reject/predefined 下隐藏。
- **Reviewer:** domain schema-correctness（DNS rule_action 契约）主审；React/perf 次审表格 rerender。
- **Don't mix:** 仅 DNS rules 表格 action 模型——route rules 的 action 覆盖归 U6；scrub 完整性归 U13。

#### U4-tailscale-fields — P1+P2（一个分支）
- **Outcome:** Tailscale endpoint 分支补齐文档化但 GUI 无法从零设置的字段：`accept_routes`(P1)、`ephemeral`(P1)、`exit_node`、`exit_node_allow_lan_access`、`hostname`、`relay_server_port`。
- **根因（已对抗验证）:** 这些 key 无专用控件、未被 factory seed、未在 handled 集——`AdvancedScalarFields`/`AdvancedNonScalarFields` 只遍历已存在的 key，故从零不可设置（导入的值能经 Advanced 回退编辑，纯属 from-scratch 编写缺口）。
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/endpoint/tailscale.md`（`accept_routes` bool / `ephemeral` bool / `exit_node` string / `exit_node_allow_lan_access` bool / `hostname` string / `relay_server_port` int, since 1.13）。
- **Touch:** `src/components/inspector/endpointInspector.tsx` 的 `entityType === "tailscale"` 分支（Control URL 后 ~`:210`，System Interface MTU 控件 `:241-255` 可作 numeric 模板）—— 加 toggle（accept_routes/ephemeral/exit_node_allow_lan_access）、text（exit_node/hostname）、number（relay_server_port）控件，均 `updateField(entityRef, key, value || undefined)`。
- **Touch:** `src/components/inspector/handledFields.ts` —— 6 个 key 加入 `endpointHandledFields`(`:277+`) 与 `INLINE_RENDERED_KEYS`(`:177+`)，满足 C17 guard。
- **Touch（可选）:** `src/domain/diagnostics.ts` —— `relay_server_port` 在 1.12/stable 目标加 1.13 版本门控 diagnostic（仿既有 system_interface/advertise_tags gate）。
- **Acceptance:** 全新 Tailscale endpoint 的 inspector 显示这 6 个控件；各自写入/往返正确；C17 guard 绿；relay_server_port 在 1.12 目标（若加门控）告警。
- **Tests (test-first):** `tests/tailscale-fields.test.tsx` —— 每个控件渲染 + 写入正确 key/类型；C17 不变量测试覆盖新 key。
- **Reviewer:** domain schema-correctness（Tailscale 字段名/类型/版本）主审；React/perf 次审。
- **Don't mix:** 仅 Tailscale 分支——WireGuard 字段归 U5。

#### U5-wireguard-fields — P2（一个分支）
- **Outcome:** WireGuard endpoint 分支补 `listen_port`、`name`（gate on `entity.system`）、`workers`。
- **根因（已对抗验证）:** `listen_port` 在 `listenSharedFields` 但 endpoint 只发 Dial 卡（`...dialSharedFields`，不含它）；`system` toggle 已渲染但配对的 `name` 没渲染（半实现）；`workers` 无控件。
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/endpoint/wireguard.md`（`listen_port` int / `name` string，system 接口作用域 / `workers` int）。
- **Touch:** `src/components/inspector/endpointInspector.tsx` 的 `entityType === "wireguard"` 分支（System toggle 后 `:182+`）—— 加 Listen Port number（`updateField(entityRef,"listen_port", parseOptionalPort(...))`，helper 已 `:7` 导入）、name text（可 gate on `entity.system === true`）、workers number。
- **Touch:** `src/components/inspector/handledFields.ts` —— `listen_port` 加入 `endpointHandledFields` + `INLINE_RENDERED_KEYS`；`name`/`workers` 至少加入 `INLINE_RENDERED_KEYS`（满足 C17；是否加 endpointHandledFields 取决于是否要从 Advanced 回退抑制导入值）。
- **Acceptance:** WireGuard endpoint inspector 显示 Listen Port/Name/Workers；写入/往返正确；C17 guard 绿。
- **Tests (test-first):** `tests/wireguard-fields.test.tsx` —— 控件渲染 + 类型正确（listen_port/workers 为 Number）；name gate on system（若采用）。
- **Reviewer:** domain schema-correctness 主审；React/perf 次审。
- **Don't mix:** 仅 WireGuard 分支——keepalive 归 U2、Tailscale 归 U4。

#### U6-route-rule-action-coverage — P1+P2（一个 inspector）
- **Outcome:** route/DNS rule action 控件补全：route `resolve` 的 `timeout`(P2) + `disable_cache`/`disable_optimistic_cache`/`rewrite_ttl`/`client_subnet`；DNS `predefined` 的 `answer`/`ns`/`extra` 列表；route-options 的 `udp_connect`/`udp_timeout`/`tls_record_fragment`/`tls_fragment_fallback_delay`/`fallback_network_type` + 1.14 `tls_spoof`/`tls_spoof_method`（版本门控）；两处 reject Method `<select>` 加 `reply` 值。
- **根因（已对抗验证）:** 各 action 控件手写、覆盖不全。`resolve` 的 `timeout` 是「claimed-handled」（被 Advanced 回退抑制）却只在 `action=sniff` 渲染——闭环死点；predefined 只能设 rcode；route-options 多个子字段无控件；reject Method 只有 default/drop，缺 1.13 的 `reply`。
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/route/rule_action.md`（resolve timeout/cache/ttl/client_subnet、route-options 子字段、1.14 `tls_spoof`/`tls_spoof_method`、reject method 含 `reply`）；`docs/upstream/sing-box/testing/configuration/route/rule.md`、`dns/rule_action.md`（predefined answer/ns/extra；reject reply 1.13）。
- **Touch:** `src/components/inspector/ruleInspectors.tsx`（action 分支结构已确认：sniff `:13`、route-options `:36`、reject `:75`、resolve `:108`、predefined `:129`，DNS 侧镜像在 `:286+`）—— resolve 分支加 Resolve Timeout text（仿 sniff timeout）+ cache/ttl/client_subnet 控件；predefined 分支加 answer/ns/extra `RuleListField`（已从 `./ruleControls` 导入）；route-options 分支加 6 个子字段控件；reject Method `<select>` 加 `<option value="reply">reply</option>`（route + DNS 两处）；`tls_spoof`/`tls_spoof_method` 控件 channel-gate 到 testing（仿 evaluate/respond 模式）。
- **Touch:** `src/components/inspector/ruleControls.tsx` —— 新 key 加入 `routeRulePrimaryFields`/`dnsRulePrimaryFields`，避免在 Advanced 回退重复渲染。
- **Touch（可选）:** `src/domain/minVersions.ts` / `versionFieldGate.ts` —— `tls_spoof`/`tls_spoof_method` 登记 1.14 字段门控（注意 minVersions 当前仅 type-keyed；字段级门控以 diagnostics 内 `atLeast()` 字面调用为主）。
- **Change:** 补全各 action 控件 + reply 值 + 1.14 字段门控。**无序列化改动**（passthrough 已序列化任意 rule key）。
- **Acceptance:** resolve 显示 timeout/cache/ttl/client_subnet；predefined 显示 answer/ns/extra 且导出为列表；route-options 6 子字段可设；reply 可选；tls_spoof/tls_spoof_method 仅 testing 显示且 1.12/1.13 目标告警；新 key 不在 Advanced 重复出现；导出/往返正确。
- **Tests (test-first):** `tests/route-rule-action-coverage.test.tsx` —— per-action 控件可见性 + 写入；reply 选项存在；tls_spoof 渠道门控；predefined 列表往返。
- **Reviewer:** domain schema-correctness（route/DNS rule_action 契约 + 版本门控）主审；React/perf 次审。
- **Don't mix:** 仅 route/DNS rule action 控件覆盖——DNS rules 表格 action 模型归 U3；scrub 归 U13。
- **Slice:** 可拆为 (a) resolve+predefined+reply（无门控）；(b) route-options 6 子字段 + tls_spoof 门控。

---

### Phase U-P2 — per-type / coverage gaps

#### U7-hysteria2-obfs-1.14 — P2
- **Outcome:** outbound + inbound 的 hysteria2 obfs 在 `obfs.type === "gecko"` 时可设 `min_packet_size`/`max_packet_size`；outbound 补 1.14 `hop_interval_max`/`bbr_profile`/`brutal_debug` + Realm 子编辑器；inbound 补**整个 obfs 控件**（当前 inbound 完全无 obfs 控件，仅 Advanced JSON 可达——已确认）。
- **根因（已对抗验证）:** outbound obfs 编辑器只暴露 type+password；因 `obfs` 是 handled key，Advanced 回退跳过整个对象 → gecko 包大小无处可设。inbound 连 obfs 控件都没有。1.14 新增字段仅 Advanced-JSON 可达。
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/outbound/hysteria2.md`（`hop_interval_max`/`bbr_profile`/`realm` = 1.14；obfs gecko min/max_packet_size）；`docs/upstream/sing-box/testing/configuration/inbound/hysteria2.md`（inbound obfs）。
- **Touch:** `src/components/inspector/outboundSectionsB.tsx`（hysteria2 obfs fieldset `:264-290`，`writeObfs` 在 `:254-261`，min_idle_session number 模板）—— gecko 时加 Min/Max Packet Size number（经 `writeObfs({min_packet_size}/{max_packet_size})`）；hysteria2 块加 hop_interval_max text、bbr_profile select、brutal_debug checkbox；加 Realm 子编辑器（或最少 JsonField）。
- **Touch:** `src/components/inspector/inboundSectionsB.tsx` 的 `hysteria2` 块 —— 加结构化 obfs fieldset（仿 outbound `:264-290`：type select salamander；gecko gate 到 testing/1.14；password 经 SensitiveTextField；min/max_packet_size）。
- **Touch:** `src/domain/schemaRegistry.ts` —— inbound hysteria2 行加 `fields`（镜像 outbound obfs.type enum，`doc: "inbound/hysteria2.md"`）；可选 outbound bbr_profile enum 行。
- **Touch:** `src/components/inspector/handledFields.ts` —— `obfs` 加入 `inboundHandledFields`（结构控件存在后）；outbound 新 top-level key（hop_interval_max/bbr_profile/brutal_debug/realm）加入 `outboundHandledFields`，避免 Advanced 重复。（`grep -rn "HandledFields" src/components/inspector/handledFields.ts` 复核确切集名。）
- **Change:** 补 obfs 包大小 + 1.14 字段 + inbound obfs 控件。**无序列化改动**（obfs 整对象往返；先确认 parse+emit 保留 nested obfs key）。
- **Acceptance:** outbound/inbound hysteria2 选 gecko 显示 Min/Max Packet Size；outbound 显示 hop_interval_max/bbr_profile/brutal_debug/realm；inbound 有完整 obfs 控件；新 key 不在 Advanced 重复；导出/往返正确；C17 guard 绿。
- **Tests (test-first):** `tests/hysteria2-obfs.test.tsx` —— gecko 包大小控件出现 + 写入 nested obfs；1.14 字段渲染 + 往返；inbound obfs 控件存在。
- **Reviewer:** domain schema-correctness（hysteria2 1.14 字段 + obfs 嵌套）主审；React/perf 次审。
- **Don't mix:** 仅 hysteria2 obfs/1.14——其他协议字段不动。
- **Cross-ref:** 与 `canvas-config-gen-remediation` 的 hysteria2 相关项对齐，勿重复落地。

#### U8-tuic-inbound-section — P2
- **Outcome:** inbound TUIC 加专用分支：`congestion_control`（enum）/`auth_timeout`/`zero_rtt_handshake`（bool）/`heartbeat`。
- **根因（已对抗验证）:** inbound 无 TUIC 专用 section，这些字段仅作未校验的 Advanced 字段存在。
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/inbound/tuic.md`（congestion_control cubic|new_reno|bbr、auth_timeout、zero_rtt_handshake、heartbeat）。
- **Touch:** `src/components/inspector/inboundSectionsB.tsx` —— 加 `entityType === "tuic"` 块（仿 `outboundSectionsB.tsx` 的 tuic 分支）：congestion_control SchemaEnumField + auth_timeout/heartbeat duration text + zero_rtt_handshake toggle。
- **Touch:** `src/domain/schemaRegistry.ts` —— inbound tuic 行加 `fields`（congestion_control enum，`doc:"inbound/tuic.md"`），令 SchemaEnumField 解析 enum + V1 校验生效。
- **Touch:** `src/components/inspector/handledFields.ts` —— 4 个 key 加入 `inboundHandledFields`；`auth_timeout` 加入 `INLINE_RENDERED_KEYS`（congestion_control/heartbeat/zero_rtt_handshake 已在列）。
- **Acceptance:** inbound TUIC inspector 显示 4 个结构控件；congestion_control 为 enum；导出/往返正确；C17 guard 绿。
- **Tests (test-first):** `tests/tuic-inbound.test.tsx` —— 控件渲染 + enum 校验 + 往返。
- **Reviewer:** domain schema-correctness 主审；React/perf 次审。
- **Don't mix:** 仅 inbound TUIC——outbound TUIC 已验证完整，勿动。

#### U9-dns-optimistic-object — P2
- **Outcome:** DNS `optimistic` 改为复合控件（enabled checkbox + 条件 stale-serve window `timeout` text），可写对象形态 `{enabled, timeout}`；相邻 per-query Timeout 字段重新标注以消除混淆。
- **根因（已对抗验证）:** optimistic 当前只能 on/off bool；对象形态（默认 3d 的 stale-serve 窗口）无法编写；相邻「Timeout」其实是无关的 per-query `dns.timeout`（10s）。两者都在 `dnsHandledFields`，故都不落 Advanced 回退。
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/dns/index.md`（`optimistic` 对象 `{enabled, timeout}`；per-query `timeout`）。
- **Touch:** `src/components/inspector/dnsInspector.tsx:181-209`（optimistic toggle `:182-197`，per-query Timeout `:198-207`，FakeIP 复合控件 `:123-178` 作模板）—— 用 enabled checkbox + 条件 stale-serve window text 替换纯 bool；只 enabled 时写 `optimistic:true`（或 `{enabled:true}`），带 timeout 时写 `{enabled:true, timeout}`；disabled 时 undefined。重标 per-query Timeout 字段（如「Query Timeout」）。
- **Touch:** 保持 `optimistic` 与 `timeout` 在 `dnsHandledFields`。
- **Acceptance:** optimistic 可开启并设 stale-serve window；导出 `{enabled, timeout}` 形态正确；per-query Timeout 标签清晰区分；往返正确。
- **Tests (test-first):** `tests/dns-optimistic.test.tsx` —— enabled-only 与 enabled+timeout 两种写入；标签区分。
- **Reviewer:** domain schema-correctness 主审；React/perf 次审。
- **Don't mix:** 仅 optimistic 复合控件 + 标签——不动其他 DNS hub 字段。

#### U10-domain-resolver-empty-state — P2
- **Outcome:** `domain_resolver`/`default_domain_resolver` 的 Server 下拉框在无 DNS server 时显示 hint（及可选就地创建 DNS server），不再裸 None-only。
- **根因（已对抗验证）:** 与 U1 同类——引用下拉框来源于另一集合（DNS servers），空时只剩 None，无 hint/无就地创建。（`diagnostics.ts` 已有告警软化影响，故 P2 非 P1。）
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/dns/index.md` + `dns/server/*.md`（domain_resolver = DNS server tag/对象）。
- **Touch:** `src/components/inspector/sharedFields.tsx:164`（Default Domain Resolver 定义）、`:198`（Domain Resolver 定义）—— 加 `hint`；可选在 select 分支（`:547-560`）/object 子表单（`:478-539`）加空状态 + 就地创建（接 `CREATABLE_DNS_SERVER_TYPES`，`src/domain/protocols.ts:72`）。
- **Acceptance:** 无 DNS server 时 domain_resolver select 显示 hint；（若实现）就地创建可用；往返不回归。
- **Tests (test-first):** `tests/domain-resolver-empty-state.test.tsx` —— 空 server 时 hint 出现。
- **Reviewer:** React/perf 主审；domain schema-correctness 次审。
- **Don't mix:** 仅 domain_resolver 空状态——http_client 归 U1。复用 U1 的就地创建 pattern（若 U1 先落地）。

#### U11-inline-http-client — P2
- **Outcome:** `http_client` 支持从空状态切换为内联对象编辑（tag→object），并对内联对象里的不支持 key 给 diagnostic 校验。
- **根因（已对抗验证）:** 内联对象形态（上游 `// or {}`）仅当值**已是**对象时可达（JsonField 分支 `:543-545`）；不像 `domain_resolver` 有「切换为内联对象」按钮（`:562-570` gated 到 `objectForm === 'domain-resolver'`）。且内联对象只有裸 JSON，无对 `tls.alpn`/`ech`/`utls`/`reality`、HTTP2/QUIC 等**不支持 key** 的校验。
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/shared/http-client.md:48-74`（明列 supported / unsupported 字段）。
- **Touch:** `src/components/inspector/sharedFields.tsx:44`（`objectForm` 类型，现仅 `"domain-resolver"`）—— 拓宽为含 `"http-client"`/`"json"`；`:386-387` 给 http_client 定义打标；`:562-570` 加「Add inline configuration」按钮（seed `{}` 令 JsonField 分支渲染）。
- **Touch:** `src/domain/diagnostics.ts`（~`:2390-2412` 既有 http_client 检查附近）—— 内联对象含不支持 key 时告警（按 http-client.md:48-74）。
- **Change:** 加 tag→object 入口 + 不支持 key diagnostic。若只做其一，**diagnostic 优先**（防静默无效配置）。
- **Acceptance:** 空 http_client 可切换为内联对象编辑；内联对象含 `tls.alpn`/`ech` 等时告警；tag 形态不受影响。
- **Tests (test-first):** `tests/http-client-inline.test.tsx` —— 切换按钮产生 `{}` 并渲染 JsonField；diagnostic 命中不支持 key。
- **Reviewer:** domain schema-correctness（supported/unsupported 集合）主审；React/perf 次审。
- **Don't mix:** 仅内联对象入口 + 校验——tag 形态可发现性归 U1。
- **依赖:** 建议在 U1 之后（共享 http_client select 代码区）。

#### U12-cert-provider-acme — P2
- **Outcome:** standalone ACME certificate-provider 可结构化配置 `dns01_challenge`（provider + 凭据）与 `http_client`，不再仅裸 JSON。
- **根因（已对抗验证，verdict partial）:** inline-TLS ACME 有结构化 dns01 控件，但 standalone provider 节点不渲染它们；ACME `http_client`（1.14 新增）声明的 http-client shared group 从不为 cert provider 渲染（与 U1 同类）。
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/shared/certificate-provider/acme.md`（dns01_challenge 对象 + 1.14 http_client）；`docs/upstream/sing-box/testing/configuration/shared/dns01_challenge.md`（provider alidns/cloudflare/acmedns + 凭据 + 1.14 ttl/propagation_*/resolvers/override_domain）；`certificate-provider/cloudflare-origin-ca.md:22`（http_client）。
- **Touch:** `src/components/inspector/sharedFields.tsx` 的 `certificateProviderFields()` acme 分支（`:723-735`）—— append 结构化 dns01_challenge 定义（仿 inline 编辑器 `:297-316`，但根在 `["dns01_challenge", ...]`；provider select + provider-specific 凭据经 `visibleWhen`；1.14 字段 channel-gate testing）+ http_client select。需把 `channel` 线入 `certificateProviderFields`（当前签名 `(entityType, config)`）。
- **Touch:** `src/components/inspector/handledFields.ts` 的 `certificateProviderHandledFields`（`:329-345`）—— 加 `dns01_challenge`/`http_client`，避免 Advanced 重复；更新 `:326-328` 注释。
- **Change:** 抽 dns01_challenge 定义为共享 helper（避免 inline 与 standalone 漂移）+ http_client select（复用 U1 pattern）。
- **Acceptance:** standalone ACME cert-provider inspector 显示 dns01_challenge（provider + 凭据，1.14 字段仅 testing）+ http_client；导出/往返正确；C17 guard 绿。
- **Tests (test-first):** `tests/cert-provider-acme.test.tsx` —— dns01 provider 切换显示对应凭据；1.14 字段渠道门控；http_client select 出现。
- **Reviewer:** domain schema-correctness（cert-provider/dns01 契约 + 版本门控）主审；serialization/round-trip 次审。
- **Don't mix:** 仅 standalone cert-provider ACME——inline-TLS ACME 编辑器（C3）不动；palette 创建（C2）不动。
- **Cross-ref:** C2/C3（canvas-config-gen-remediation）——本项假设 cert-provider 节点已可创建/选中；若 C2 未落地，先 cross-check 创建路径。

---

### Phase U-P3 — polish / hardening + re-assessment

#### U13-rule-action-scrub — P3
- **Outcome:** 切换 rule action 时残留的 action-specific 字段被集中清除（当前只 scrub `outbound`/`server`），避免导出残留无关字段。
- **根因（已对抗验证，verdict partial）:** 高频例（set reject method 后切 route）已 scrub 并有测试——旗舰例**不复现**；残留泄漏的是 sniff-only `sniffer`/`timeout`、resolve-only `strategy`、route-options 组在切走后仍存活并原样导出。
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/route/rule_action.md` + `dns/rule_action.md`（各 action 的合法字段集）。
- **Touch:** `src/domain/commands.ts` 的 `normalizeRouteRule`（`:255-263`）/`normalizeDnsRule`（`:270-278`，单一 scrub 点，update + import 都跑）—— 扩展 drop 列表：`action!=="sniff"` 时 drop `sniffer`/`timeout`；`!=="resolve"` 时 drop `strategy`；离开 route/route-options/bypass 时 drop route-options 组（override_*/network_*/fallback_*/udp_*/tls_*）。
- **Touch:** `tests/rule-action-field-scrub.test.ts:10` —— 修正不准确的注释 + 加新 scrub 组覆盖。
- **Acceptance:** 切换 action 后导出不含旧 action 字段；既有高频例不回归。
- **Tests (test-first):** 扩展 `tests/rule-action-field-scrub.test.ts` —— 新 scrub 组逐一覆盖。
- **Reviewer:** domain schema-correctness（rule action 字段归属）主审。
- **Don't mix:** 仅 scrub 列表 + 测试注释——不动控件（U3/U6）。

#### U14-deprecation-hardening — P3
- **Outcome:** `download_detour` 弃用从「纯提示」升级：1.16 目标升 error；`download_detour` 与 `http_client` 同设时给冲突 diagnostic；testing 上 Download Detour 控件按值/渠道门控（仅编辑/清除既有值，不鼓励从零新建）；修正 version-gate backstop 过度声称的注释。
- **根因（已对抗验证）:** 弃用仅 advisory——从不 auto-migrate、从不标 both-set 冲突、从不在 1.16 移除边界升级；且警告 gated 在 `channel==="testing"` 而非目标版本（对比 http_client 在 `:1925-1931` 的对称版本检查）。Download Detour 控件无条件渲染（`ruleSetInspector.tsx:60-73`），使弃用字段成为阻力最小路径。
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/rule-set/index.md:130-134`（download_detour 弃用 1.14、移除 1.16）；`docs/upstream/sing-box/testing/deprecated.md`。
- **Touch:** `src/domain/diagnostics.ts:2120-2128`（download_detour 弃用块）—— 目标 ≥1.16 升 error/version（用既有 `version` 比较模式，如 `:1804-1810`）；`type === "remote"` 块内加 both-set（download_detour + http_client）冗余 diagnostic。
- **Touch:** `src/components/inspector/ruleSetInspector.tsx:60-73`（Download Detour `<select>`）—— 加渠道/值门控：`{(channel !== "testing" || entity.download_detour) ? <控件> : null}`，testing 上仅为编辑/清除既有值而显示。
- **Touch（可选）:** `src/domain/diagnostics.ts:17-20` / `src/domain/versionFieldGate.ts:7` —— 修正「覆盖每个 1.14 字段」的过度声称注释（实际仅覆盖 array-collection kinds；singleton/nested owner 是手工门控）；可选加 `SINGLETON_GATE_SECTIONS` 表覆盖 route/dns。
- **Acceptance:** 1.16 目标下 download_detour 报 error；both-set 报冲突；testing 上无既有值时 Download Detour 控件不显示（与 U1 的 http_client steering 配对）；注释不再过度声称。
- **Tests (test-first):** `tests/download-detour-gating.test.ts` —— 1.14 warning / 1.16 error；both-set 冲突；控件渲染门控。
- **Reviewer:** version-gating/diagnostics 主审。
- **Don't mix:** 弃用/版本门控硬化——http_client 可发现性归 U1（但二者配对，注意协同）。
- **依赖:** 与 U1 协同（banner/控件同区）。

#### U15-network-enum-derp — P3
- **Outcome:** `network` matcher 改为 enum(tcp/udp/icmp) 控件（修内联标签「Network (tcp/udp)」缺 icmp）；DERP `verify_client_url` 行的 detour 改 outbound `<select>` + 暴露余下 HTTP Client Fields。
- **根因（已对抗验证）:** `network` 为自由文本，typo（`TCP`/`icmpv6`）静默接受；内联变体标签遗漏 1.13 `icmp`。DERP `verify_client_url` 行只有 url + 自由文本 detour，HTTP Client Fields 不可编辑。
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/route/rule.md:243-253`（network tcp/udp/icmp）；`docs/upstream/sing-box/testing/configuration/service/derp.md:53-65`（verify_client_url = `{url, ...HTTP Client Fields}`）。
- **Touch:** `src/components/inspector/ruleControls.tsx`（`RuleAdvancedFields` 字段渲染 switch `~:389-424`，network 在 route/DNS 两 list `:75`/`:106`，内联标签 `:147`）—— network 加 enum 分支（tcp/udp/icmp）；修内联标签。
- **Touch:** `src/components/inspector/serviceInspector.tsx` 的 `verify_client_url` 行编辑器（`rows.map` `:173+`）—— detour `<input>` 改 `<select>`（`outboundTags(config)`，仿 ccm/ocm `:364-377`）；加余下 HTTP Client Fields（或最少 JsonField 行回退）。
- **Acceptance:** network 仅可选 tcp/udp/icmp（route + DNS）；内联标签含 icmp；DERP verify_client_url detour 为 outbound select；HTTP Client Fields 可达；往返正确。
- **Tests (test-first):** `tests/network-enum.test.tsx` + `tests/derp-verify-client-url.test.tsx`。
- **Reviewer:** domain schema-correctness 主审；React/perf 次审。
- **Don't mix:** network enum 与 DERP 是两个独立 slice，可拆两 PR。

#### U16-reassess — re-assessment
- **Outcome:** U1–U15 落地后重跑审计 workflow，确认缺口闭合、无回归，更新本 doc Milestone Notes 与基线判断。
- **Touch:** `scripts/workflows/inspector-usability-audit.workflow.js`（重跑；如有 file:line 漂移先 sync 锚点）。
- **Acceptance:** 重跑后原 49 条 confirmed/partial 中归本 goal 的项目均闭合或显式 deferred；无新 P1；Milestone Notes 记录最终判断。

---

## Coverage / 已撤回（不要重提）

对抗验证已确认为**正确、无缺陷**，记录以界定审计边界——**勿重新提出**：

- **序列化对每个可设置 key 都无损** —— 通用 `structuredClone` 导入 + `JSON.stringify`/`pruneExportNoise` 导出，**无 per-protocol 序列化器**。整个「生成时丢弃 / 不往返 / serializeTls-excludes-X / utls-list-incomplete」类**全部为误报**。
- **HTTP Client 一旦存在 `http_clients[]` 节点即端到端可用**（默认模板已带一个）——P0「impossible / dead reference / wrong adapter」框定已撤回；真正残留 = U1 的可发现性缺口。
- **outbound per-protocol 字段覆盖完整无损**（socks/http/ss/vmess/vless/trojan/ssh/tor/tuic/anytls/shadowtls/hysteria/hysteria2/selector/urltest + tls/multiplex/dial/transport 共享组）。
- **inbound 面**（listen 字段、users[]、set_system_proxy、tproxy/direct network、trojan fallback、shadowtls version+handshake、SS method enum、TUN 字段、http TLS、Advanced passthrough）——正确。
- **typed DNS-server 面**（dial/tls/neighbor 卡、server/port/path/headers/predefined/interface、tailscale `accept_search_domain` testing-gate）——正确无损。
- **settings inspector**（log/ntp/certificate/experimental 含 cache_file + clash_api + v2ray_api）与**共享 TLS/transport/multiplex/dial/tcp-brutal/udp-over-tcp 控件**——对 1.14 testing 文档字段完整且合规。（一处无害 cosmetic：`experimental.v2ray_api` 既有专卡又出现在 Advanced——已知的有意重复。）
- **WireGuard outbound** 正确地 non-creatable + 硬错误带迁移至 endpoints 提示——正确。
- **Shadowsocks relay `managed`** 已在 SSM service inspector 有一等控件（`serviceInspector.tsx:41-80`）——`destinations[]` 仍仅 Advanced（可选补，非缺口）。

## Milestone Notes

（每个 atomic 合并后追加一条：what changed / tests / expert-review verdict / verification commands。）

- **U2 (PR #271, commit `5f9222d`)** — WireGuard peer `persistent_keepalive_interval` 从写原始字符串改为整数强转：新增 `parseOptionalInt` helper（非负整数，控件再 clamp 到 uint16 ≤65535），placeholder `"25s"`→`"25"`、`inputMode="numeric"`、读回为 number。Tests: `tests/wireguard-keepalive.test.tsx`（含 0/超界/清空/导出为 JSON number）+ `tests/inspector-helpers.test.ts`（pin parseOptionalInt 契约）。Reviewer: APPROVE（2 条 minor——0 值测试 + helper 单测——已补）。Verify: full suite green, `pnpm build` clean。
- **U1 (PR #272, commit `4561548`)** — rule-set HTTP Client select 加空状态 hint + testing-gated「Create HTTP Client」按钮（新 store action `createHttpClientForField`，复用 `addHttpClient`，保持当前选择 + autoPlace 新节点），弃用 banner 联动。`http_client` 形状/序列化未动。Tests: `tests/http-client-create-affordance.test.tsx`（testing 建+连、stable 不显示、既有 tag 选择无回归）。Reviewer: APPROVE。Verify: full suite green, build clean, C17 guard green。
- **U8 (PR #288, commit on main)** — inbound TUIC 专用 section(此前这些字段仅作未校验 Advanced 字段存在):`congestion_control`(SchemaEnumField,新增 inbound tuic schemaRegistry `fields` enum cubic/new_reno/bbr,令 V1 也校验导入值)/`auth_timeout`(text)/`heartbeat`(text)/`zero_rtt_handshake`(toggle),镜像 outbound tuic(去掉 outbound 专有 udp_relay_mode/udp_over_stream)。4 key 入 inboundHandledFields(auth_timeout 入 INLINE_RENDERED_KEYS,其余经 outbound 字面已在列)。均基础字段,无版本门控。无序列化改动。Tests: `tests/tuic-inbound.test.tsx`。Reviewer: APPROVE(专门复核 per-type unreachable 陷阱——确认仅 tuic 声明这四字段,无 U7b 同类暴露)。Verify: tsc clean, 1629 tests green, build clean, `pnpm test:binaries` 19/19, Workers Builds success。
- **U7 (PR #285 U7a + #286 U7b)** — hysteria2 obfs + 1.14 字段,按 outbound/inbound 拆两 PR。**U7a (#285):** outbound obfs 加 gecko-only `min/max_packet_size`（obfs.type==="gecko" 时显示）;outbound 块加 `hop_interval_max`(text)/`bbr_profile`(select,standard 默认→omit)/`brutal_debug`(checkbox,顺带修复其此前 C17 仅靠 inbound 字面满足、outbound 实际无控件的静默死角)/`realm`(JsonField 最小对象编辑器);新 diagnostic `hysteria2-obfs-packet-size-testing-only`。**U7b (#286):** inbound hysteria2 此前**完全无 obfs 控件**,镜像 outbound 补整个 obfs fieldset;`obfs` 加入 inboundHandledFields,复用同一 packet-size diagnostic。**关键决策(outbound 模式):** 不做 UI channel-gate(OutboundSectionsB/InboundSectionsB 无 channel),沿用既有「无条件渲染 + diagnostic 门控」(既有 realm/bbr_profile/hop_interval_max 诊断已是此模式)。**U7b reviewer REQUEST-CHANGES → 修复:** 把 `obfs` 加入全局 inboundHandledFields 会让 **hysteria v1**(obfs 是字符串=混淆密码)的导入值从 Advanced 回退消失(C17 跨 kind 超集检查盲区);加了 hysteria v1 专用 obfs 字符串控件 + 回归测试。Tests: `tests/hysteria2-obfs.test.tsx`(18 条:outbound gecko 包大小/1.14 字段/realm/诊断 + inbound obfs + v1 字符串可达性)。Reviewer: U7a APPROVE;U7b REQUEST-CHANGES→修复后绿。Verify: tsc clean, 1625 tests green, build clean, `pnpm test:binaries` 19/19, Workers Builds success（两次)。
- **U6 (PR #282 U6a + #283 U6b)** — route/DNS rule action 控件补全,按 spec Slice 拆两 PR。**U6a (#282):** route `resolve` 加 disable_cache/rewrite_ttl/client_subnet（1.12,无门控）+ timeout/disable_optimistic_cache（1.14,channel-gate,导入值在 stable 仍可编辑）；DNS `predefined` 加 answer/ns/extra 列表;route `reject` 加 `reply`。**U6b (#283):** route-options 加 udp_connect/udp_timeout/tls_record_fragment/tls_fragment_fallback_delay/fallback_network_type + tls_spoof/tls_spoof_method（1.14,channel-gate + 新 diagnostic）。新 key 全部登记 routeRule/dnsRulePrimaryFields 防 Advanced 双渲染;给 RouteRuleInspector 接入 `channel` prop(原先只有 DnsRuleInspector 有)。无序列化改动。**两处刻意决策(均经 reviewer 确认):** (1) **上游修正** —— spec 说「route+DNS 两处加 reply」,但 dns/rule_action.md reject 只有 default/drop,`reply`(ICMP echo)是 route-only,故只加 route(测试 pin 了 DNS reject 无 reply);(2) **审慎偏离 spec** —— spec 说 tls_spoof「告警」,但实际 unknown field 在 <1.14 硬拒绝解码,故 `route-rule-tls-spoof-1-14-only` 用 **error**(与 route-rule-bypass-1-13-only / dns-rule-action-1-14-only 同类一致)。Tests: `tests/route-rule-action-coverage.test.tsx`（13 条:1.12/1.14 门控、导入可达性、reply route-only、spoof_method 枚举、diagnostic 两臂、无双渲染）。Reviewer: 两 PR 均 APPROVE 零 actionable。Verify: tsc clean, 1615 tests green, build clean, `pnpm test:binaries` 19/19, Workers Builds success（两次）。
- **U5 (PR #280, commit `f99b1d2`)** — WireGuard endpoint 补 `listen_port`（number，`parseOptionalPort`）/`name`（text，system-interface 作用域）/`workers`（number，`parseOptionalInt`，0=CPU-count 默认→omit）。3 key 登记 `endpointHandledFields` + `INLINE_RENDERED_KEYS`（C17 绿,且 handled 防 Advanced 双渲染）。均 1.11+ 基础字段,**无版本门控**。无序列化改动。**Reviewer REQUEST-CHANGES → 修复:** 最初把 `name` 控件 gate 在 `system === true`,但因 `name` 已 handled（从 Advanced 抑制）,导入 `{name, system 关闭}` 会零控件可达——reviewer 指出这正是 `dnsServerHandledFieldsStable` 先例规避的「invisible AND stuck」死角,违背 U-series 导入往返目标。改为 **name 控件去 gate、始终渲染**（标签传达作用域,仍 handled 故不双渲染）。Tests: `tests/wireguard-fields.test.tsx`（控件写入+类型+name 不论 system 均可达+导入往返+无 Advanced 双控件）。本地工作流验证:tsc clean, 1602 tests green, build clean, `pnpm test:binaries` 19/19, Workers Builds success。
- **U4 (PR #277, commit `27ca204`)** — Tailscale endpoint 补 6 个文档化但从零不可设的字段:3 个 toggle（`ephemeral`/`accept_routes`/`exit_node_allow_lan_access`）+ 2 个 text（`hostname`/`exit_node`）+ Relay Server Port number（`parseOptionalPort`，0=默认→omit）。6 key 同时登记 `endpointHandledFields` + `INLINE_RENDERED_KEYS`（C17 guard 绿）。`relay_server_port` 是 1.13+,加版本门控 `endpoint-tailscale-relay-server-port-1-13-only`（warning，仿 system_interface；0 默认不告警）；其余 5 个是 1.12 基础字段,**未**误加门控。`advertise_exit_node` 按审计范围**显式排除**（factory 已 seed 它,故从零经 Advanced 回退可达,非缺口）。无序列化改动。Tests: `tests/tailscale-fields.test.tsx`（控件写入+清空+导入往返+版本门控两臂+0-非告警）。Reviewer: APPROVE（domain schema-correctness 主审 + React/perf 次审,零 actionable,唯一 nit=advertise_exit_node 对称性,范围外）。Verify: tsc clean, full suite 170 files/1596 tests green, build clean, C17 guard green, Workers Builds = success。
- **U3 (PR #273 → #275 → #276)** — DNS Rules 表格加 action `<select>`。**执行事故记录（诚实留痕，为后续戒）：** 我把 implement+commit+merge 串进同一巨型工具批次,导致:(a) #273 只合进了测试、生产代码漏进 commit → main 变红;(b) #275 的"修复"又把 action select 重复插入了一份 → `Found multiple elements` 仍红;(c) #276 删掉重复块,恢复绿。根因 = 违反单步/green-before-merge,已据此在本 doc 新增 **Execution Loop（strict/serial/interruptible）** 小节并强化 Land/Review 门。最终状态:每行单个 action select,`tests/dns-rule-table-action.test.tsx` 6/6 绿,full suite 169 files/1590 tests green,build clean。
