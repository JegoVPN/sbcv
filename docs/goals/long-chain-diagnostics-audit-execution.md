# Long-Chain Diagnostics Audit — Execution Plan

Run with:

```txt
/goal execute the long-chain diagnostics remediation queue (A1–A17) --spec docs/goals/long-chain-diagnostics-audit-execution.md
```

这是 **2026-05-31 长链路诊断审计** 的整改 goal。审计针对 `src/domain/diagnostics.ts` 中的 **长链路（LONG-CHAIN）** 失败类——即诊断的正确结论依赖一个**跨配置段引用**或**多跳回退/覆盖链**，但实现只判了单字段，从而误判整条链。

- 审计 workflow：`scripts/workflows/long-chain-diagnostics-audit.workflow.js`（36-agent，8 个链路族，对抗式验证）。
- 交叉验证 harness：`tests/chain-crosscheck.test.ts`（对 `.audit/cases/<族>/` 下每个配置，跨 1.12/1.13/1.14 三个真实二进制逐 `(case × target)` 比对 `validateConfig` 与 `sing-box check`，写 `_report.json`）。
- 原始发现：**26 项 confirmed（独立怀疑者复核 0 推翻）** + 4 条邻近观察（§ Coverage）。
- 完整报告：`.audit/findings.md`（446 行，含每条的二进制重放表与文档引用）。

## 触发问题（motivating bug）

PR #303 修了 `outbound-domain-without-resolver`：它原本只查 per-entity `domain_resolver`，忽略了 `route.default_domain_resolver` 与「单 DNS 服务器」隐式回退，于是在一个**正确**的真实配置上误报 **42 次**。#303 引入了一个 `domainResolverImplicitlyCovered` 抑制（`defaultDomainResolverPresent || singleDnsServerConfigured`）来修它。

**本次审计的核心反转：** 用三个真实二进制实证后发现，#303 的抑制**对 outbound 正确，但被过度套用到 DNS 服务器分支**——而 DNS 服务器解析**自身**域名地址的规则**更严格**：

| 配置（域名 DNS 服务器） | 1.12 | 1.13 | 1.14 |
|---|---|---|---|
| 仅靠 `route.default_domain_resolver` | ❌ reject | ❌ reject | ❌ reject |
| 单 DNS 服务器、无 resolver | ❌ reject | ❌ reject | ❌ reject |
| per-server `domain_resolver`（唯一满足项） | ✅ | ✅ | ✅ |

于是 #303 的抑制在 DNS 服务器场景**制造了新的假阴性**（我们对二进制硬拒绝的配置保持静默）。这正是「长链路」类 bug 的形状：把适用于 A 段（dial 字段）的回退链，错套到要求不同的 B 段（DNS 服务器自解析）。

## 审计结论（重要：照此执行，勿凭直觉）

逐条对抗验证 + 我方独立二进制重放后，几条**必须遵守的判据**：

- **`check` 不是唯一仲裁者——必须区分 `check` 与 `run`。** `sing-box check` **不解析任何跨段 tag 引用图**（detour、selector 候选、`route.final`、route/dns 规则的 `outbound`/`server` 目标、DERP `verify_client_endpoint`）。这些在 `run`/router-init 才解析、且为 FATAL。
  - **真假阳性（应降级 error→warning）= `check` 与 `run` 都干净通过。** 已实测确认：route 规则悬空 `outbound`、dns 规则悬空 `server`、clash-api 悬空 `external_ui_download_detour` 在 `run` 下均**干净启动、无 FATAL**（规则只是永不命中/惰性解析）。→ A1–A5。
  - **运行时真阳性（必须保持 error，切勿降级）= `check` 通过但 `run` FATAL。** 已实测对照：`route.final` 悬空 → `run` FATAL `default outbound not found`。`detour`/`endpoint`/`ntp detour`/selector 候选 / route.final / DERP verify 同类——**这些不是 #303 形状，保持 error**（详见 § Coverage 第 2 条）。
- **文档化默认绝不报警。** 沿用 [[feedback_no_warn_documented_default]]：字段为空但上游文档写了 fallback/default 时不警告（A4 的 clash-api detour「为空用默认 outbound」即属此类，故只降级、不删除）。
- **降级时不丢覆盖。** 降级一条 error 前，确认该场景的硬拒绝已被另一条 error 覆盖（A5：空/缺失 endpoint 仍由 `dns-server-tailscale-endpoint-missing` error 覆盖，故仅把「非空但悬空」降为 warning）。
- **版本门 = 严重度随 target 升级，而非一刀切。** dial 字段缺 resolver 在 1.12 是弃用 WARN、在 1.13/1.14 是 FATAL（`ENABLE_DEPRECATED_MISSING_DOMAIN_RESOLVER` 门）。对应诊断须 `atLeast(version,"1.13") ? "error" : "warning"`（A7/A8/A12），镜像既有 `dns-server-legacy-address-deprecated` 模式。
- **平台门控（OS）保持 warning。** resolved 仅 Linux 支持，二进制在非 Linux 拒绝，但验证器编写时无法知道部署目标——保持 warning（A16）。

## 与既有 goal 的关系

- 与 `docs/goals/inspector-usability-audit-execution.md`（U-queue）、`canvas-config-gen-remediation-execution.md`（C-queue）**正交**：那两个聚焦 inspector 控件可达性/可发现性；本 A-queue 只改 `src/domain/diagnostics.ts`（及 `scripts/gen-known-fields.mjs` 生成器 A13）的**诊断判定逻辑**，不碰控件。
- **直接修订近期 PR：A6、A11（及相关 A12）** 收紧/撤销 #303 引入的抑制；A4 与 [[feedback_no_warn_documented_default]]（#302）同源。落地时在 devlog 显式标注「修订 #303」。

## Process (non-negotiable)

- **单一可信源 = `docs/upstream/sing-box/{stable=1.13, testing=1.14, oldstable=1.12}/configuration/**`。** 每个原子项必须引用其对应 docs/upstream 源文档的 `文件:行号`，并以其为字段/枚举/版本/默认判定的唯一依据。下游冲突以 docs/upstream 为准。
- **二进制是最终仲裁者。** 每个原子项落地前用三二进制交叉验证（`pnpm test:binaries`，或对单配置直接 `.tools/bin/sing-box-{1.12,stable,testing} check -c <file>`）。涉及跨段引用图（detour/final/rule 目标）的判定，**必须额外用 `sing-box run` 区分 check-pass-run-FATAL（真阳性，保 error）与 check+run-clean（假阳性，降级）**——见审计结论。沿用 [[feedback_local_binary_check_workflow]]。
- **复用审计 harness 做回归证据。** 每个原子项的回归种子来自 `.audit/cases/<族>/<repro>.json`（注意：`.audit/` 是 gitignored 暂存区——落地时把该最小配置**内联进 `tests/` 下的测试**作为固定回归用例，并可在 harness 上 `CROSSCHECK_DIR=... CROSSCHECK_STRICT=1 npx vitest run tests/chain-crosscheck.test.ts` 复证）。
- **One atomic = one outcome。** 一条规则一项；严守 don't-mix（severity 改动 vs 新增检查、stable vs testing-gated、降级 vs 升级分开）。
- **Test-first。** 先写失败测试再改实现；迁移既有测试到新的正确行为（**绝不为通过旧测试而保留错误行为**——A6 须同步修正 `tests/domain.test.ts` 中被二进制推翻的 case A 断言）。
- **Land via squash PR，never direct push to `main`**（[[feedback_pr_over_commits]]）。Green-before-merge 硬门：本地 `pnpm test` + `pnpm build` + `pnpm test:binaries` 全绿、**Cloudflare Workers Builds = success**（[[feedback_cloudflare_merge_gate]]）、reviewer verdict 已回且 actionable 发现已应用——缺一不合并。
- **Review gate（BLOCKING，一轮）：** 每个原子项派一名最适配的资深 Claude Code reviewer 子代理（domain-correctness vs sing-box upstream 为主审）做**一轮**评审（[[feedback_codex_review_gate]]），应用其 actionable 发现后再合并。reviewer/explore 子代理用只读 ref-explicit git 或隔离 worktree（[[feedback_reviewer_subagent_no_shared_git]]）。
- **Re-verify against HEAD before each atomic。** 开工前 sync main 并对照 HEAD 复核 file:line 锚点（本 doc 锚点采于 2026-05-31 HEAD `f618d24`，已对照 live source 校验；`.claude/worktrees/*` 可能 stale，见 [[feedback_sync_worktree_before_work]]）。
- **Devlog every atomic** —— 勾选下方 Running TODO + 在 Milestone Notes 追加一条（what changed / tests / 二进制重放 / reviewer verdict / verification commands）。

## Phases & Atomic Queue

执行顺序 **L-P0（假阳性降级，阻断有效配置）→ L-P1（#303 resolver 抑制修订，活跃回归）→ L-P2（dial-fields 版本门 + endpoint resolver 缺失检查）→ L-P3（其余假阴性 / 缺失检查 / 规格修正）**。

**合并顺序约束：** A11 先于 A6（二者同改 `~945-954` 的抑制语义，A11 先收紧 `domainResolverImplicitlyCovered` 再由 A6 移除 DNS-server 逃逸）。A17 依赖 A5（存在性需先降级）。其余基本独立可并行。

### Running TODO

#### Phase L-P0 — 假阳性降级（error→warning；`check`+`run` 双清已实测）
- [x] A1-missing-rule-outbound-downgrade — PR #305 (merged)
- [x] A2-missing-route-rule-inbound-downgrade — PR #306 (merged)
- [x] A3-missing-dns-rule-server-downgrade — PR #307 (merged)
- [x] A4-clash-api-download-detour-downgrade — PR #308 (merged)
- [x] A5-missing-dns-server-endpoint-downgrade — ⚠️ **REVISED → 保 error**（二进制推翻降级）：PR (this) = 回归锁定 + spec 更正,无 severity 改动

#### Phase L-P1 — #303 resolver 抑制修订（⚠️ 修订 #303）
- [ ] A11-missing-default-domain-resolver（+ 收紧 implicit-cover）⚠️#303 — **先落**
- [ ] A6-dns-server-domain-resolver-revise ⚠️#303 — **后落**

#### Phase L-P2 — dial-fields 版本门 + endpoint resolver 缺失检查
- [ ] A7-outbound-resolver-version-gate
- [ ] A8-direct-outbound-resolver
- [ ] A9-endpoint-wireguard-resolver（🆕）
- [ ] A10-endpoint-tailscale-resolver（🆕）
- [ ] A12-dial-fields-migration-gate（🆕，触发条件须收紧，见 § Coverage 4）

#### Phase L-P3 — 其余假阴性 / 缺失检查 / 规格修正
- [ ] A13-rule-set-unknown-field-coverage（🆕，生成器层）
- [ ] A14-ssm-api-not-managed-shadowsocks-error
- [ ] A15-ssm-api-empty-servers-error
- [ ] A16-resolved-dns-server-linux-warning
- [ ] A17-dns-server-endpoint-not-tailscale-warning（可选/低优先，依赖 A5）

---

### Phase L-P0 — 假阳性降级（#303 形状：二进制接受，我们硬报错）

> 本类最高优先：我们在二进制 **`check` 与 `run` 都接受** 的配置上发 error，错误阻断用户导出可运行配置。每项落地前**必须 `run` 复证干净启动**（不只 `check`）。

#### A1-missing-rule-outbound-downgrade — 假阳性
- **Outcome:** `missing-rule-outbound` 由 `"error"` 降为 `"warning"`。route 规则的悬空 `outbound`（matcher 形式与 `action:"route"` 形式）几乎总是笔误（路由静默失效），保留警告信号但不硬阻断。
- **根因（已验证，confidence high）:** `check` 不解析 route 规则的 outbound 引用图；实测 `run` 干净启动（"started"，无 FATAL），规则只是永不命中。对照：`route.final` 悬空 `run` FATAL（属 A 类真阳性，保 error，**不要顺手改 final**）。
- **Source of truth:** `route/rule.md:484`（`outbound` matcher 自 1.11 弃用，移至 Rule Action）+ `route/rule_action.md:38`（`outbound` ==Required== 仅指字段存在，不要求 tag 可解析）。
- **Touch:** `src/domain/diagnostics.ts:396-404`（push level `"error"`→`"warning"`）。
- **Acceptance:** 悬空 route 规则 outbound（两种形式）→ 1 warning（非 error）；三二进制 `check` exit 0 且 `run` 干净启动；`route.final` 悬空仍为 error（不回归）。
- **Tests (test-first):** 内联 `.audit/cases/conditional-cross-section/route-rule-outbound-dangling.json`（+ action-form）为回归种子；断言 level=warning；断言 route.final 悬空仍 error。
- **Reviewer:** domain-correctness（sing-box upstream + check/run 区分）。
- **Don't mix:** 仅此规则 severity；不动 `missing-route-final` / detour 类。

#### A2-missing-route-rule-inbound-downgrade — 假阳性
- **Outcome:** `missing-route-rule-inbound` 由 `"error"` 降为 `"warning"`。悬空 inbound matcher 只让规则永不匹配，二进制 check+run 接受。
- **根因（已验证，high）:** 同 A1，inbound matcher 不参与 init 引用图。
- **Source of truth:** `route/rule.md:204-206`（inbound = "Tags of Inbound"，无「必须存在」约束）。
- **Touch:** `src/domain/diagnostics.ts:386-394`（`"error"`→`"warning"`）。
- **Acceptance:** 悬空 inbound matcher → 1 warning；三二进制 check+run 接受。
- **Tests:** 种子 `conditional-cross-section/route-rule-inbound-dangling.json`。
- **Reviewer:** domain-correctness。
- **Don't mix:** 仅此规则。

#### A3-missing-dns-rule-server-downgrade — 假阳性
- **Outcome:** `missing-dns-rule-server` 由 `"error"` 降为 `"warning"`（旧式 `server` 与 `action:"route"` 形式皆经二进制确认 check+run 接受）。
- **根因（已验证，high）:** `check` 不解析 dns 规则 `server` 引用（注意：1.14 的 check **会**解析 dns `rule_set`，但**不**解析 dns rule `server`）；`run` 干净启动。
- **Source of truth:** `dns/rule.md:469-473`（旧式 `server` 自 1.11 弃用）+ `dns/rule_action.md:27-31`（现代 `route.server` ==Required== 仅指字段存在）。
- **Touch:** `src/domain/diagnostics.ts:794-802`（`"error"`→`"warning"`）。
- **Acceptance:** 悬空 dns 规则 server（两形式）→ 1 warning；三二进制 check+run 接受。**注意区分**：`missing-dns-rule-set` 在 1.14 是真阳性（check 解析 rule_set），不在本项范围（见 § Coverage 1）。
- **Tests:** 种子 `conditional-cross-section/dns-rule-server-dangling.json`。
- **Reviewer:** domain-correctness。
- **Don't mix:** 仅 dns 规则 `server`；不碰 `missing-dns-rule-set`。

#### A4-clash-api-download-detour-downgrade — 假阳性（文档化默认）
- **Outcome:** `clash-api-download-detour-missing` 由 `"error"` 降为 `"warning"`。该 detour 仅在下载外部 UI 时惰性解析，文档明确「为空用默认 outbound」。
- **根因（已验证，high）:** 实测 `run` 下 clash-api 监听 + started、无 FATAL。属 [[feedback_no_warn_documented_default]] 同源（文档化 fallback）。
- **Source of truth:** `experimental/clash-api.md:88-92`（"Default outbound will be used if empty"）。
- **Touch:** `src/domain/diagnostics.ts:2126-2133`（`"error"`→`"warning"`）。
- **Acceptance:** 悬空 `external_ui_download_detour` → 1 warning；三二进制 check+run 接受。
- **Tests:** 种子 `conditional-cross-section/clash-api-download-detour-dangling.json`。
- **Reviewer:** domain-correctness。
- **Don't mix:** 仅此规则。

#### A5-missing-dns-server-endpoint-downgrade — ⚠️ **REVISED 2026-06-01：spec premise 被二进制推翻 → 保 error**
- **原 Outcome（已撤回）:** ~~`missing-dns-server-endpoint` 由 error 降为 warning（仅非空悬空/错命名空间）。~~
- **实际 Outcome（binary-grounded）:** **不降级。** `missing-dns-server-endpoint`（error）与 `dns-server-tailscale-endpoint-missing`（error）**均已正确,保持不变**。本原子项 = **回归锁定 + spec 更正**(无 severity 改动)。
- **推翻依据（三-binary 三-control 复证,主理人未在原审计复证此条）:** tailscale DNS 服务器的 `endpoint` 引用**在 run/init 解析且 FATAL**——并非惰性。三版 `check` 0 但 `run` FATAL：
  - `ts-fp-dangling-endpoint`（非空悬空,另有有效 `endpoints[]`）→ 三版 `run` FATAL `initialize dns/tailscale[ts]: endpoint not found: does-not-exist`。
  - `ts-fp-endpoint-wrong-namespace`（endpoint→outbound tag）→ 三版 `run` FATAL `endpoint not found: direct-out`。
  - `ts-clean-control`（endpoint→真实 tailscale endpoint）→ 三版 `run` "sing-box started"(仅 TRACE 健康警告,连不上 controlplane ≠ FATAL)——**隔离证明悬空引用本身才是 FATAL 源**。
  - 空/缺失 → 三版 `run` FATAL `missing tailscale endpoint tag`。
  与 `route.final` 同形(check-pass/run-FATAL = 运行时真阳性,审计结论要求保 error)。原审计「run 干净(仅 TRACE)」声明误把 clean-control 的行为安到了 dangling case 上。
- **Source of truth:** `dns/server/tailscale.md:34-38`（endpoint ==Required==）+ 二进制 `run` 重放(最终仲裁者)。
- **Touch:** **无代码改动。** 仅在 `tests/domain.test.ts` 新增 describe「long-chain runtime true-positives (binary run-FATAL — stay error)」锁定四态 severity。
- **Acceptance:** 非空悬空/错命名空间 → error；空/缺失 → error；clean-control → 静默；锁定测试全绿。
- **Tests:** 内联 `ts-fp-dangling-endpoint` / `ts-fp-endpoint-wrong-namespace` / 空 / 缺失 四态 → 断言 level=error。
- **Reviewer:** domain-correctness（复核反转推理 + 独立 `run` 重放）。
- **Don't mix:** 仅锁定 severity 现状 + spec 更正；类型检查（endpoint 存在但非 tailscale 类型）仍归 A17。
- **⚠️ 连带影响 A17:** A17 原模型「悬空/错命名空间 = warn(A5)」**作废**——那些是 error。A17 仅处理「endpoint 存在于 `endpoints[]` 但 `type!=='tailscale'`」的咨询 warning（到 A17 时复核 `ts-fn-endpoint-not-tailscale` 二进制是否接受）。

---

### Phase L-P1 — #303 resolver 抑制修订（⚠️ 直接修订 #303）

> #303 的 `domainResolverImplicitlyCovered`（`defaultDomainResolverPresent || singleDnsServerConfigured`，`diagnostics.ts:952-954`）对 outbound 正确、被错套到 DNS 服务器与悬空 default。A11 先收紧并补缺口、A6 后移除 DNS-server 逃逸。

#### A11-missing-default-domain-resolver — 🆕 缺失检查 ⚠️#303（先落）
- **Outcome:** 新增 `missing-default-domain-resolver`（error），镜像 `route.default_http_client → missing-http-client`：当 `route.default_domain_resolver`（字符串，或带 `server` 字符串的对象）命名的 tag 不在 `getDnsServerTags(config)` 中，且存在域名消费者时，报 error。**并收紧** `domainResolverImplicitlyCovered`：仅当 default 解析到真实 DNS 服务器 tag 时才计为「已覆盖」——否则笔误既躲过悬空检查又静默掩盖真正的缺-resolver 警告。
- **根因（已验证，high；我方种子阶段亦直接实测）:** 悬空 default 三版全 FATAL `default domain resolver not found`，我们 0/0 静默；且任何非空 default 值使 `resolverPresent` 返回 true 从而抑制 resolver 警告。边界：换成真实 tag → 三版 PASS；悬空但无域名消费者（仅 IP）→ 三版 PASS（故须门控于域名消费者存在，否则假阳性）。
- **Source of truth:** `dns/server/index.md:51-53`（tag）；`shared/dial.md:182-184`（字符串值等价于设 `server`，须命名现有 DNS 服务器 tag）；`route/index.md:110-116`；对照 `diagnostics.ts:2487` 的 `missing-http-client` 模式。处理**字符串与对象 `{server:...}` 两种形式**。
- **Touch:** `src/domain/diagnostics.ts:945-954`（收紧 `domainResolverImplicitlyCovered` 仅计真实 tag）+ 新增引用检查块（解析 `route.default_domain_resolver` → 对照 `getDnsServerTags`，门控域名消费者存在）。
- **Acceptance:** 悬空 default（string/object）+ 域名消费者 → error 于 `/route/default_domain_resolver`；真实 tag → 静默；悬空但无域名消费者 → 静默（不假阳性）；收紧后被掩盖的真缺-resolver 警告恢复（与 A6 协同验证）。
- **Tests:** 种子 `default-domain-resolver-dangling/broken-dangling-string.json`（+ object / direct-consumer / noconsumer-ip 边界）、`dns-server-resolver/fn-dangling-default-resolver.json`。
- **Reviewer:** domain-correctness（resolver 链 + 引用语义）。
- **Don't mix:** 与 A6 慎重排序（A11 先）；不在此项移除 DNS-server 逃逸（那是 A6）。

#### A6-dns-server-domain-resolver-revise — ⚠️#303 假阴性（后落）
- **Outcome:** `dns-server-domain-without-resolver`：移除 DNS 服务器分支的 `domainResolverImplicitlyCovered` 逃逸；触发条件改为 `looksLikeDomain(server.server) && !resolverPresent(server.domain_resolver)`；severity warning→**error**（三版硬拒绝）；**修正文案**（当前两处错误：暗示「1.14+ 才需要」——实际 1.12 即 FATAL；暗示 `route.default`/单服务器有用——对 DNS 服务器为假）。
- **根因（已验证，high；种子阶段亦直接实测 case C/D/B/E 三版 reject）:** 域名 DNS 服务器自解析**只认 per-server `domain_resolver`**；`route.default_domain_resolver` 与单服务器可选性都不满足（后者仅救 IP 字面量服务器）。公平性：仅给该服务器加 `domain_resolver:"u"` → 三版 PASS。
- **Source of truth:** `dns/server/tls.md:44`、`https.md:47`（"If domain name is used, `domain_resolver` must also be set"，无条件）；对照 `shared/dial.md:178`（单服务器/default 可选性**仅**适用于 dial 字段）。
- **Touch:** `src/domain/diagnostics.ts:1843-1854`（移除 line 1846 的 implicit-cover 短路；warning→error；改文案）。**同步修正** `tests/domain.test.ts:2671-2673`（case A 断言「仅 `route.default_domain_resolver` 在 2-服务器域名配置上保持静默」已被二进制三版 REJECT 推翻——迁移到正确行为，勿保留旧错误断言）。
- **Acceptance:** 域名 DNS 服务器无 per-server resolver（无论 default/单服务器）→ error；加 per-server `domain_resolver` → 静默；IP 字面量服务器无 resolver → 静默（单服务器可选性仍救 IP）；三二进制 check 重放一致。
- **Tests:** 种子 `dns-server-resolver/fn-default-resolver-no-perserver.json`、`fn-single-server-domain-no-resolver.json`、`fn-single-domain-server-default-resolver.json`、`broken-domain-no-resolver-anywhere.json`。
- **Reviewer:** domain-correctness（必须复核未在 IP 服务器上误报）。
- **Don't mix:** 仅 DNS 服务器 resolver；outbound 版本门归 A7；dial-fields 全局门归 A12。

---

### Phase L-P2 — dial-fields 版本门 + endpoint resolver 缺失检查

#### A7-outbound-resolver-version-gate — 版本门
- **Outcome:** `outbound-domain-without-resolver` 的 severity 由硬编码 `"warning"` 改为 `atLeast(version,"1.13") ? "error" : "warning"`；重写文案（1.13+/1.14 = 必需/拒绝，1.12 = 弃用）。
- **根因（已验证，high）:** 域名 outbound + 无 resolver + ≥2 DNS 服务器命中 dial 字段弃用门：1.12 WARN（接受）/ 1.13/1.14 ERROR+FATAL（`ENABLE_DEPRECATED_MISSING_DOMAIN_RESOLVER`）。我们当前恒 warning，1.13/1.14 漏报。
- **Source of truth:** `shared/dial.md:170`（自 1.14 必需）+ `:174`（单 DNS 服务器时可选）；`testing/.../shared/dial.md:5-7`；`migration.md:515`。
- **Touch:** `src/domain/diagnostics.ts:963`（镜像 `dns-server-legacy-address-deprecated` 的版本键控 `diagnostics.ts:905-909`）。
- **Acceptance:** 同配置：1.12 → warning，1.13/1.14 → error；resolver 链满足 → 三版静默；三二进制重放一致。
- **Tests:** 种子 `dial-fields-deprecation-gate/broken-domain-outbound-no-resolver.json`、`outbound-endpoint-resolver/fn-outbound-domain-multi-dns-noresolver.json`。
- **Reviewer:** version-gating/diagnostics。
- **Don't mix:** 仅 severity 版本键控；`direct` 特例归 A8；DNS-server 孪生归 A6。

#### A8-direct-outbound-resolver — 假阴性
- **Outcome:** `outbound-domain-without-resolver` 特例化 `type==="direct"`：跳过 `looksLikeDomain(server)` 早返回（direct 无 server 字段但解析「请求域名」），施加 resolver 要求；≥1.13 error / 1.12 warning；保留 `resolverImplicitlyCovered` 守卫（0/1 DNS 服务器不触发）。
- **根因（已验证，high）:** direct outbound + ≥2 DNS 服务器无 resolver → 1.12 warn / 1.13/1.14 FATAL；我们因 `outbound.server` 为 undefined 早返回，三版全静默。
- **Source of truth:** `shared/dial.md:182-184`（`direct` → "Domain in request"）；`outbound/direct.md:10-24`（direct 无 server 字段）。
- **Touch:** `src/domain/diagnostics.ts:956-968`。
- **Acceptance:** direct + ≥2 DNS 无 resolver：1.12 warning / 1.13+ error；0/1 DNS 服务器或 resolver 已设 → 静默。
- **Tests:** 种子 `outbound-endpoint-resolver/fn-direct-multi-dns-noresolver.json`、`dial-fields-deprecation-gate/fn-direct-outbound-no-resolver.json`。
- **Reviewer:** version-gating/diagnostics。
- **Don't mix:** 仅 direct 特例；与 A7 同文件区域注意不互相覆盖（可同 PR 但分 slice）。

#### A9-endpoint-wireguard-resolver — 🆕 缺失检查
- **Outcome:** 新增 endpoints resolver 检查（与 outbound 平行）：`type==="wireguard"` 时检查每个 `peers[j].address` 是否 `looksLikeDomain`；resolver 由 `endpoint.domain_resolver` OR `route.default_domain_resolver` OR 单 DNS 满足；≥1.13 error / 1.12 warning。
- **根因（已验证，high）:** endpoints 整类**无任何 resolver 检查**；wireguard 域名 peer + ≥2 DNS 无 resolver → 1.12 warn / 1.13/1.14 FATAL，我们静默。
- **Source of truth:** `shared/dial.md:182-185`（others → "Domain in server address"）；`endpoint/wireguard.md:81-83,127-129`（peers.address + Dial Fields）。
- **Touch:** `src/domain/diagnostics.ts:968` 后新增 `endpoints.forEach`。
- **Acceptance:** wireguard 域名 peer + ≥2 DNS 无 resolver：1.12 warning / 1.13+ error；IP peer / default-resolver / 单 DNS → 三版静默（已验证干净控制组 PASS，须保持静默）。
- **Tests:** 种子 `outbound-endpoint-resolver/fn-endpoint-wg-domain-multi-dns-noresolver.json`、`dial-fields-deprecation-gate/fn-endpoint-domain-peer-no-resolver.json`。
- **Reviewer:** domain-correctness + version-gating。
- **Don't mix:** 仅 wireguard endpoint；tailscale 归 A10（不同严重度模型）。

#### A10-endpoint-tailscale-resolver — 🆕 缺失检查
- **Outcome:** endpoints resolver 检查中，`type==="tailscale"` 视为始终携带隐式域名服务器地址（默认 `control_url` = `controlplane.tailscale.com`）；**所有目标发 error**（硬 init 错误，**非**版本门弃用——不像 wireguard/outbound 1.12 只 WARN），除非 resolver 链满足。
- **根因（已验证，high）:** 裸 tailscale endpoint 三版全 FATAL `initialize endpoint[i]: missing domain resolver for domain server address`，我们静默。
- **Source of truth:** `endpoint/tailscale.md:63-67`（control_url 默认 controlplane.tailscale.com）；`shared/dial.md:182-185`（Endpoints → Domain in server address）。
- **Touch:** `src/domain/diagnostics.ts:968` 后（与 A9 同处的 endpoints 检查）。
- **Acceptance:** tailscale endpoint 无满足的 resolver → 三版 error；resolver 链满足 → 静默；三二进制 check 重放一致。
- **Tests:** 种子 `outbound-endpoint-resolver/fn-endpoint-tailscale-noresolver.json`。
- **Reviewer:** domain-correctness（须复核「所有目标 error，非版本门」与 A9 区别）。
- **Don't mix:** 仅 tailscale endpoint resolver；与 A9 共用遍历但严重度模型不同，分别测。

#### A12-dial-fields-migration-gate — 🆕 缺失检查（触发条件须收紧）
- **Outcome:** 新增配置级检查：存在解析「请求域名」的 `direct` outbound + 域名 DNS 服务器组合、且 `route.default_domain_resolver` 未设 → 1.12 warning / ≥1.13 error。此门**区别于** per-server 要求（即便全 per-server 解析的配置，1.13/1.14 无 `default_domain_resolver` 仍 FATAL）。
- **根因（已验证，high）:** dial-fields 迁移门（DNS 服务器情形）我们完全未标记。**触发须收紧**（§ Coverage 4）：边界测试显示具体由「`direct` outbound + 域名 DNS 服务器」触发；以下**不**触发（勿过度报警）：仅域名 DNS 服务器无 outbounds、`direct` 无 dns、域名 DNS 服务器 + `block`/socks/IP outbound。
- **Source of truth:** `testing/.../shared/dial.md:174`（outbound DNS rule items 弃用，自 1.14 必需）；二进制 `ENABLE_DEPRECATED_MISSING_DOMAIN_RESOLVER` 门。
- **Touch:** `src/domain/diagnostics.ts` ~951（resolver 块附近，新增配置级检查）。
- **Acceptance:** 触发组合：1.12 warning / 1.13+ error；上述非触发组合 → 三版静默（边界 case 必测）。
- **Tests:** 种子 `dns-server-resolver/gate-perserver-only-no-default.json` + 至少 4 个非触发边界 case。
- **Reviewer:** version-gating/diagnostics（重点复核触发条件不过宽，避免重蹈 #303 假阳性）。
- **Don't mix:** 仅此全局门；与 A6/A11 抑制语义解耦（此门即便 per-server 全满足仍触发）。

---

### Phase L-P3 — 其余假阴性 / 缺失检查 / 规格修正

#### A13-rule-set-unknown-field-coverage — 🆕 缺失检查（生成器层）
- **Outcome:** 让 W9 `unknown-field` linter 覆盖 rule-set 实体（当前对所有 rule-set 被跳过）。在**生成器层**修：`scripts/gen-known-fields.mjs` 从 `rule-set/index.md` 的 Remote/Local/Inline 字段段生成 `byKind['rule-set']['remote'|'local'|'inline']`。
- **根因（已验证，high）:** W9 linter（`diagnostics.ts:276-292`）调 `knownFieldsFor('rule-set',type)` 返回 null（`knownFieldsRegistry.ts:87`），因生成的 `DOC_FIELD_NAMES.byKind['rule-set']` 只含文档页 basename（`headless-rule`/`source-format`），**不含**类型枚举 `remote/local/inline`。二进制对未知字段三版 reject（`json: unknown field`）。
- **Source of truth:** `rule-set/index.md:60-137`（Local/Remote/Inline 封闭字段集）。字段并集须含 `type,tag,format,path,url,update_interval,download_detour` 及（testing）`http_client`。**避免**直接用 `schemaRow('rule-set','remote').fields`（仅 `[format]`；http-client 共享组贡献的是 adapter 内部字段，会产生错误并集误报合法 `url` 等）。
- **Touch:** `scripts/gen-known-fields.mjs`（registry 层，**非** `diagnostics.ts`）；重新生成 `knownFieldsRegistry`。
- **Acceptance:** rule-set 含伪造顶层字段 → `unknown-field` warning；合法 `remote`/`local`/`inline` 字段（含 `url`/`download_detour`/testing `http_client`）不误报；三二进制对伪造字段 reject 一致。
- **Tests:** 种子 `rule-set-http-client/03-broken-bogus-ruleset-field.json` + 三类合法 rule-set 不误报用例。
- **Reviewer:** domain-correctness（字段并集正确性）。
- **Don't mix:** 仅 rule-set linter 覆盖；不动其它 kind 的 known-fields。

#### A14-ssm-api-not-managed-shadowsocks-error — 假阴性
- **Outcome:** `ssm-api-inbound-not-managed-shadowsocks` warning→error（仅级别，路径/文案不变）。
- **根因（已验证，high）:** SSM API server 指向非 shadowsocks 或 `managed:false` 的 inbound → 三版 FATAL `inbound/...is not a SSM server`；我们仅 warn。无文档默认冲突（managed 虽默认 false，SSM 显式要求 true）。
- **Source of truth:** `service/ssm-api.md:39`（"Selected Shadowsocks inbounds must be configured with managed enabled"）；`inbound/shadowsocks.md:90-92`。
- **Touch:** `src/domain/diagnostics.ts:588-596`。
- **Acceptance:** 非 managed/非 shadowsocks SSM server inbound → error；三二进制 reject 一致。
- **Tests:** 种子 `detour-chains/ssm-api-wrong-type-inbound.json`、`ssm-api-unmanaged-shadowsocks.json`。
- **Reviewer:** domain-correctness。
- **Don't mix:** 仅此规则 severity。

#### A15-ssm-api-empty-servers-error — 假阴性
- **Outcome:** `ssm-api-no-managed-inbound` warning→error。`servers` 是 ==Required==，空/缺失映射使 sing-box 崩溃（净效果 = 永不可运行）。
- **根因（已验证，high）:** servers 空/缺失 → 三版 panic SIGSEGV（`ssmapi.NewService` server.go:69，status 2）；我们仅 warn。`{"servers":{}}` 是 JSON 骨架记法，非文档化空默认。
- **Source of truth:** `service/ssm-api.md:33-39`（servers ==Required==）。
- **Touch:** `src/domain/diagnostics.ts:569-577`。
- **Acceptance:** 空/缺失 servers → error；三二进制 reject(panic) 一致。
- **Tests:** 种子 `detour-chains/ssm-api-empty-servers.json`。
- **Reviewer:** domain-correctness。
- **Don't mix:** 仅此规则 severity。

#### A16-resolved-dns-server-linux-warning — 规格不符
- **Outcome:** 两处结构修复，**不升级 error**（宿主 OS 门控，warning 是文档正确严重度）：(1) Linux-only 提示当前只在 service 节点（`diagnostics.ts:676-684`），在 `server.type==='resolved'` 分支（`diagnostics.ts:1796`）附加等价 **warning**，使无 `services[]` 条目的 resolved DNS 服务器也获平台提示；(2) 所有情形保持 warning。
- **根因（已验证，high）:** 二进制对 resolved **DNS 服务器**与 **service** 在非 Linux 都拒绝，但我们的警告只挂 service 节点；无 backing service 的 resolved DNS 服务器今天只得到 `dns-server-resolved-service-missing`，无 Linux-only 提示。
- **Source of truth:** `service/resolved.md:9`（"fake systemd-resolved DBUS service" = Linux/systemd）；二进制 "resolved DNS server is only supported on Linux"。
- **Touch:** `src/domain/diagnostics.ts:1796`（新增 warning）；`676-684`（既有 service 提示不变）。
- **Acceptance:** 非 Linux target 的 resolved DNS 服务器（无 service 条目）→ Linux-only warning；severity 保持 warning（不 error）。
- **Tests:** 种子 `dns-endpoint-service-refs/resolved-no-service-field.json`。
- **Reviewer:** domain-correctness（确认不误升 error）。
- **Don't mix:** 仅节点归属 + 提示补齐；不改 severity 模型。

#### A17-dns-server-endpoint-not-tailscale-warning — 🆕 缺失检查（可选/低优先，依赖 A5）
- **Outcome:** 仿 `derp-verify-endpoint-not-tailscale`（`diagnostics.ts:628-635`），当 tailscale DNS 服务器的 `endpoint` 解析到的 `endpoints[]` 条目 `type !== 'tailscale'` 时发**咨询 warning**（**绝不 error**——二进制接受，error 会重现 #303 假阳性类）。
- **根因（已验证，high）:** tailscale DNS 服务器指向 wireguard endpoint 二进制三版接受（运行时才校验类型），我们今天只查存在性（且过严，见 A5），从不查类型。
- **Source of truth:** `dns/server/tailscale.md:38`（"The tag of the Tailscale Endpoint"）；`endpoint/tailscale.md:14`。
- **Touch:** `src/domain/diagnostics.ts` tailscale DNS 分支。须与 A5 配套：解析到 tailscale endpoint = 静默；非 tailscale = warn；悬空/错命名空间 = warn（A5）；缺失/空 = error（`dns-server-tailscale-endpoint-missing`）。
- **Acceptance:** tailscale DNS 服务器 → 非 tailscale endpoint = warning；→ tailscale endpoint = 静默；二进制三版接受（不可 error）。
- **Tests:** 种子 `dns-endpoint-service-refs/ts-fn-endpoint-not-tailscale.json`。
- **Reviewer:** domain-correctness。
- **Don't mix:** 依赖 A5 先落（存在性已降级）；仅类型咨询 warning。

---

## Coverage / 已撤回 / 需人工确认（不要误改）

> 来自审计 `.audit/findings.md` § 4 的邻近观察——**实现 A-queue 时严格遵守，避免误伤**。

1. **`missing-dns-rule-set`（1.14）是真阳性，不在 A3 范围。** dns 规则悬空 `server` 全版本被接受（→ A3 降级），但悬空 `rule_set` 在 **1.14-testing 的 `check` 会解析**（"rule-set not found"）。1.12/1.13 的 check 是否解析 dns rule `rule_set` **需专门 case 复核 check+run 两阶段后再定级**，本审计未列为确认发现——**A3 只动 `server`，勿顺手碰 `rule_set`**。

2. **detour/selector/route.final/DERP-verify 是运行时真阳性，保持 error，切勿降级。** `sing-box check` 不解析任何跨段 tag 引用图，解析在 `run`/router-init 且 FATAL。已实测对照：`route.final` 悬空 → `run` FATAL。区分依据：A1–A5 的悬空引用在 `run` 也干净启动（规则永不触发/惰性解析），而 detour/route.final 悬空在 `run` FATAL。涉及规则：`missing-rule-outbound` 之外的 `missing-route-final`/`missing-dns-final`/`missing-*-detour`/`missing-derp-verify-endpoint`/`ntp-detour-missing`/`selector-default-not-in-candidates`/`missing-outbound-candidate` —— **这些是正确的 error**。

3. **`experimental.v2ray_api` 不可用本 harness 仲裁。** 三二进制因 build tag 一律 FATAL `v2ray api is not included in this build`（文档化 build-tag 默认）。`v2ray-stats-inbound-missing`/`v2ray-stats-outbound-missing` 等**无法二进制验证**——若要改动需人工或专门构建，**本 A-queue 不含 v2ray 相关改动**。

4. **A12 触发条件务必收紧。** dial-fields 迁移门（DNS 服务器情形）精确触发为「`direct` outbound + 域名 DNS 服务器」组合，而非泛化「任何域名 DNS 服务器/outbound 存在」。实现 A12 须以边界 case 复测，避免在「仅域名 DNS 服务器无 outbounds」「域名 DNS 服务器 + block/socks/IP outbound」等不触发组合上过度报警（否则重蹈 #303 假阳性）。

5. **FN-5（悬空 default 的 FN 一面）已折叠进 A11/MC-1。** 报告 26 项中 FN-5 是 MC-1/MC-4 的交叉引用（非独立项）——A11 一处修复同时覆盖「悬空未检测」与「非空字符串抑制真警告」两面。

## Milestone Notes

- **2026-05-31 — 审计完成、本 doc 创建。** 36-agent workflow（`scripts/workflows/long-chain-diagnostics-audit.workflow.js`）+ 交叉验证 harness（`tests/chain-crosscheck.test.ts`，已从默认 `pnpm test` 排除，显式 `CROSSCHECK_DIR=... npx vitest run` 调用）。8 链路族、26 confirmed（0 推翻）。头条：#303 的 `domainResolverImplicitlyCovered` 被过度套用到 DNS 服务器分支,制造假阴性（A6/A11/A12 修订）。主理人独立二进制重放复证：A1/A3/A4 假阳性 `run` 干净启动、`route.final` 对照 `run` FATAL——确认「假阳性降级 vs 运行时真阳性保 error」判据。回归种子在 `.audit/cases/`（gitignored，落地时内联进 `tests/`）。**A1–A17 待执行。**
- **2026-05-31 — A1 落地（PR #305, merged）。** `missing-rule-outbound` error→warning。二进制重放（1.12.25/1.13.12/1.14.0-alpha.25）：matcher + `action:"route"` 两形式 `check` exit 0 + `run` "sing-box started" 无 FATAL；对照 `route.final` 悬空 `run` FATAL `default outbound not found`(保 error)。测试：W7 reference-coverage parity 测试迁移到 `staleWarningCodes` 绑定(覆盖仍绑,降为 warning 级)+ 两形式专属回归 + route.final 对照。reviewer(domain-correctness, general-purpose 子代理, 独立二进制重放)= APPROVE 无 blocking。门：`pnpm test`(1671)/`build`/`test:binaries`(19) 全绿 + Cloudflare Workers Builds success。
- **2026-05-31 — A2 落地（PR #306, merged）。** `missing-route-rule-inbound` error→warning（仅此 code,不碰 `missing-dns-rule-inbound`）。二进制重放：`route-rule-inbound-dangling` 三版 `check` 0 + `run` started。测试：inbound 案移入 `staleWarningCodes` + 专属回归。reviewer = APPROVE(独立二进制重放亦确认 A5 run-FATAL,第三次印证)。
- **2026-05-31 — A3 落地（PR #307, merged）。** `missing-dns-rule-server` error→warning（仅 dns 规则 `server`,**不碰 `missing-dns-rule-set`**）。二进制重放:legacy 形式 + `action:"route"` 形式三版 `check` 0 + `run` started；对照 dns `rule_set` 悬空 1.14 `check` FATAL `rule-set not found`(保 error,§Coverage 1 成立)。测试:dns-server 案 `missing-dns-rule-server` 移入 `staleWarningCodes` + 两形式专属回归 + rule_set error 对照。reviewer 发现 binary-replay 残留(`tailscale/` 运行时文件含私钥被 `git add -A` 误扫入提交)→ 已 `git rm --cached` + 把 `tailscale/` 加进 `.gitignore` 并 force-push 修复(实质评审全 PASS)。**教训:改用显式 `git add <path>`。**
- **2026-05-31 — A4 落地（PR #308, merged）。** `clash-api-download-detour-missing` error→warning（文档化默认:clash-api.md "Default outbound will be used if empty"）。二进制重放:`clash-api-download-detour-dangling` 三版 `check` 0 + `run` started。测试:outbound 案该 code 移入 `staleWarningCodes` + 专属回归。reviewer = APPROVE(确认 diff 恰 3 文件、无 stray 残留)。
- **2026-06-01 — A5 落地（本 PR）= ⚠️ 反转。** 三-binary 三-control `run` 重放推翻 spec「降级」premise:tailscale DNS-server `endpoint` 在 run/init 解析且 FATAL(`ts-fp-dangling-endpoint` / `ts-fp-endpoint-wrong-namespace` 三版 `run` FATAL `endpoint not found`;`ts-clean-control` 三版 `run` started 仅 TRACE = 隔离证明;空/缺失 三版 `run` FATAL `missing tailscale endpoint tag`)。= 运行时真阳性(同 `route.final`)→ **保 error,无代码改动**。原审计「run 干净」误植 clean-control 行为。本 PR 仅加锁定测试 + 更正 spec A5 章节,并标注 A17 连带作废。两次独立 reviewer(A2/A3 reviewer 顺带)亦确认 run-FATAL,共三次印证。
- **2026-05-31 — ⚠️ A5 预警（二进制复证推翻 spec）。** P0 基线预跑发现 `dns-endpoint-service-refs/ts-fp-dangling-endpoint.json`(tailscale DNS server `endpoint:"does-not-exist"`,另有不同 tag 的 `endpoints[]`)在 **1.12/1.13/1.14 三版 `run` 均 FATAL** `start service: initialize dns/tailscale[ts]: endpoint not found: does-not-exist`——`check` 0 但 `run` FATAL = 运行时真阳性,与 `route.final` 同形,**不应降级**。spec A5「run 干净」声明未被主理人复证覆盖(milestone note 仅列 A1/A3/A4+route.final)。到 A5 时以 wrong-namespace + clean-control 深查后修订本条(预期:`missing-dns-server-endpoint` 保 error;A17 相应调整)。
