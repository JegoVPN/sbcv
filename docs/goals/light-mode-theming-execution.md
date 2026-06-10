# Light Mode (Theming) — Execution Plan

Run with:

```txt
/goal execute the light-mode theming queue (T0–T9) --spec docs/goals/light-mode-theming-execution.md
```

这是 **2026-06-10 light-mode 主题化审计** 的执行 goal。目标：为当前 dark-only 的 sbcv 增加一套完整的浅色主题——先把 `src/styles.css` 的全部颜色字面量收敛为语义 CSS 变量（dark 渲染零变化），再交付 `[data-theme="light"]` 变量表与三态主题机制（跟随系统 + 手动覆盖 + localStorage 持久化）与切换 UI。

- 审计 workflow：`scripts/workflows/light-mode-theming-audit.workflow.js`（9-agent，两阶段：4 段 CSS 盘点 + 非 CSS 表面 + 切换基建/测试影响 → 覆盖对抗 + token 归并对抗 + light 调色风险）。
- 原始发现：**~200 个互异颜色值（343 hex + 57 rgb/rgba，机械对账双向精确；机器清单 199 项，散文口径 200 系 currentColor 计入差，以文件本体为准）**、22 条非 CSS 表面事实、19 条基建/测试事实、46 条对抗发现（9 覆盖 + 19 归并 + 18 调色风险）。完整 JSON 在 `.audit/light-mode/findings.json`（gitignored 暂存）；**46 条对抗发现的压缩附录已入库 `docs/goals/light-mode-theming-audit-appendix.md`**（T5/T9 逐条核销以附录为准，JSON 丢失可重跑 workflow 再生）。行号锚点采于 2026-06-10 HEAD `8db1dc6`。
- 方案本身经两名独立 reviewer 对抗审查（可执行性/锚点 + 完备性 vs 审计 JSON），verdict 均为 APPROVE-WITH-EDITS，全部 actionable 发现已应用于本版。
- 路线已定（用户确认）：**全量语义 token 化** + **三态切换（system/dark/light）**。

## 审计结论（重要：照此执行，勿凭直觉）

逐条对抗验证后的**必须遵守的判据**：

1. **「dark 像素零变化」与「近似色合并」互斥——必须两阶段。** 盘点提出的几十处近似色合并（如 `#1a1d20`/`#1a1e21`/`#1C1E20`、24 个灰阶文本、9 个边框暗带、13 档阴影 alpha）每一个都会改变 dark 渲染 1–8 个 RGB 点。裁决：**Phase T-P1 verbatim token 化**（每个互异值一个 token/alias，逐字保值，机械可证零变化）→ **Phase T-P2 受控收敛**（alias 合并为 ~85–100 个语义 token，作为独立 review 的有意视觉微调）。绝不在 P1 里"顺手归并"。
2. **同 hex 必须按角色拆分，值键合并是错的。** 已裁决的拆分（全部经实读核验）：
   - `#101418`：resting 控件填充（:33,:758,:924,:1095,:2243）vs **选中态**填充（:959,:2336-2339）vs 画布端口（:1384,:1482）vs 面板搜索输入（:886,:1651）vs **inspector 下沉卡**（:2079-2083 `.settings-module-card, .advanced-fields`，inset 语义）——**五向**分 token（`--surface-sunken-card` 归 T3 段），light 下选中需要 tint、端口要对比浅画布、下沉卡走 inset 而非按钮填充。
   - `#151a20`：modal 对话框面（:2511）vs 激活 pill 填充（:930）——light 下一个变白、一个要按压感，方向相反。
   - `#1c1e20`/`#1C1E20`：topbar/控制条**表面**（:126,:328,:418,:1150,:2523,:2771）vs 反白按钮上的**深色文字**（:1184,:1189）——surface 族与 `--text-inverse` 永不共 token；大小写孪生在 token 化时归一。
   - `#11161c`：全局输入填充（:59,:3046）vs inspector **内嵌下沉卡**（:2202,:2383,:2604，css-3 段的 "surface-raised" 标签是颠倒的——卡比父面板 `#1a1d20` 更暗，是 inset 不是 raised）vs minimap（:1140）vs 已连接端口（:1411）。
   - `#ff8c69`：palette Legacy 标签文字（:1075，暖珊瑚质感带）vs toast **error 图标**（:3267，danger 族）——light 下一个保暖色、一个要向红加深，必拆。
   - `#20262d`：checking 状态 pill 填充（:482）vs 两处 hover 填充（:1713,:3083）；`#333537`：背景（:431,:447,:1161,:2919）vs 边框（:326,:340,:2840）；`#2a3340`：边框（:552,:735,:757,:2960,:3243）vs hover 背景（:3311）；`#202832`：边框（:1478）vs 图标 chip 背景（:1706）；rgba(0,0,0,0.4)：scrim（:2950）vs 阴影（:3244）。
   - **近似色聚类只允许在同一角色组内进行**：`#2a333d`/`#2b343e` 是边框、而 1–2 点之差的 `#2b333d` 是 hover 背景（:3292）——任何值优先的去重脚本都会静默制造"边框兼任 hover 填充"的坏 token。
3. **light 表是重新设计，不是反转。** 实测 WCAG（白底）：品牌 lime `#c7ff00` = **1.18:1**；warn 琥珀 `#f2bc4b` = **1.74:1**；info 蓝 `#2d99ff` = 2.95:1；danger 淡化变体 `#ff7b7b`/`#ff9a9a`/`#ff7777`/`#ff8c69` = 2.0–2.6:1；muted 灰阶全带 ~1.9–3.1:1——**全部不过 4.5:1 文本线，多数连 3:1 UI 线都不过**。light 值必须整体加深：danger 文本 ~`#c63838`(5.2)、warn 文本 ~`#9a6b00`(4.7，UI 级可锚现存 `#a97927`=3.85)、info 文本 ~`#1565c0`(5.75)、brand 前景向 olive（`#5d7c00`≈4.8；`#7ca300` 已存在于 :2631 可作种子）。
4. **`#c7ff00` 是 god-token，最小分解 4–5 个子角色 + 一个 RGB 三元组**：`--accent-brand-fill`（pill/按钮实底，配 `--text-on-brand` `#151900`，light 下内部对 6.1:1 可存活）、`--accent-brand-fg`（~20 处文字/边框/图标，light 必须深化）、`--focus-ring`（键盘焦点，**light 下 lime 环完全消失 = WCAG 1.4.11 失败**，需 ≥3:1 专用 token）、`--edge-default`（画布连线签名色，light 用 darkened lime 保住"绿色图"品牌）、`--accent-brand-rgb`（驱动 **0/0.09/0.12/0.34/0.5/0.86** 的 alpha 阶梯（:805 keyframe 端点、:1039,:1407,:1856,:1878,:1881）与 `status-check-pulse` keyframe）。同理 mint `--status-{valid,warn,error,info,checking}-icon` 矩阵——per-surface 图标色现在漂移：error 在 popover/移动/canvas-delete = `#e34b4b`(:698)|`#ff7777`(:2889)|`#ff7b7b`(:1779)，**toast error 另为 `#ff8c69`(:3267，见第 2 条的拆分裁决)**。
5. **字面量之外有六个主题面，token 化 styles.css 管不到**：
   - **React Flow vendor 变量**：app 未传 `colorMode`，xyflow 的 **light 默认表**今天就在生效。精确泄漏面 = minimap mask `rgba(240,240,240,.6)` + minimap node `#e2e2e2` + 框选矩形 `rgba(0,89,220,…)` + **选中边 `#555`**；其余（handle/node-wrapper/attribution/edge-label）已证明不漏。杠杆：**在我们的 token 表里定义 `--xy-*`（非 `-default` 后缀）变量**，fallback 链中两主题都胜出，不用 `colorMode` prop（避免双源）。
   - **`color-scheme`**：scrollbar/原生 `<select>` 弹出/checkbox/autofill 全靠 `styles.css:2` 的 `color-scheme: dark`，repo 零自定义滚动条 CSS。light 表第一行必须是 `color-scheme: light`，否则白面板配深色滚动条。
   - **CodeMirror 双重耦合**：`ConfigJsonViewerDialog.tsx:72` 的 `theme="dark"` 注入 oneDark 全套色；且 `styles.css:2578-2581` 的高度规则选择器写死 `.cm-theme-dark`——**prop 切到 light 时类名变 `.cm-theme-light`，编辑器直接失去高度（布局破坏，不只是颜色）**。uiw 的 theme 切换是受支持的动态 reconfigure（`useCodeMirror.js:178-186`，无需 remount）。
   - **TSX 三处字面量**（已证明是 src 内全部）：`CanvasWorkspace.tsx:50` 连接线 inline stroke（**不能删**——删除会复活 :1586 死掉的 `.valid` lime 规则改变拖线行为；改为 `stroke: "var(--edge-connection)"`，inline SVG style 接受 var()）；`CanvasWorkspace.tsx:591` `<Background color="#1f2730">`（改传 var() 字符串，注意它与一位之差的 `#1f2731`(:577 分隔线) 是**巧合不是同族**）；`SbcvLogo.tsx:22` 六边形底板 fill（在 CSS 里加 `.sbcv-logo__hexagon { fill: var(--logo-plate) }` 覆盖 presentation attribute，TSX 不动）。**logo 全件配色 = 主题不变量（用户拍板 2026-06-10，token 预览评审）**：底板 `#0d1116`、lime 描边/圆点 `#c7ff00`（:176-193）、idle 灰 `#59616a`（:180）mint 为 `--logo-plate`/`--logo-stroke`/`--logo-idle`，仅 `:root` 定义，**light 表不覆盖**（lime 对比的是自带暗板而非页面背景，双主题下均成立）。
   - **CSP 拦截 inline 防闪脚本**：`public/_headers:7` `script-src 'self' …` 无 `unsafe-inline` 无 hash，且 `_headers` 在 Workers Static Assets 部署下生效——**inline `<script>` 在 dev 能跑、在 sbcv.app 被静默拦截**。防 FOUC 引导必须是 `public/theme-init.js` 外部经典阻塞脚本（'self' 允许）。注意当前 FOUC 方向：light 用户会看到**暗闪**（`:root` 背景 `#090b0f`）。
   - **favicon**：`index.html:31` data-URI SVG 用 `%23` 编码色（`%230d1116`/`%23c7ff00`），逃过一切 `#` 正则——guard 测试必须同时匹配 `%23[0-9a-fA-F]{3,8}`。favicon 与 logo 暗色底板定为**两主题通用的品牌件（non-goal，不随主题翻转）**。
6. **e2e 时序判据（审计实测）**：Playwright 未设 `colorScheme`，默认模拟 **prefers-color-scheme: light**。(i) 纯 verbatim token 化 = **0 预期 e2e 失败**（16 处颜色断言全部比较计算值，var() 间接不改计算值——它们是 P1 的免费像素回归网）；(ii) 三态机制一旦上线，全套 e2e 翻成 light 渲染，`brand-hover.spec.ts:28` 等必破。**`colorScheme: "dark"` 的 pin 必须与机制同一个 PR 落地**（T7）。
7. **theme 状态的家 = 新建独立小模块，不进 `useProjectStore`。** 该 store 1935 行、无 persist 中间件、十余处 domain action 整体 reset UI 态、现有 UI prefs 刻意 session-ephemeral——塞一个要持久化的 key 是错配。house precedent 是 `src/components/useViewport.ts`（module-level matchMedia singleton + listener Set + `useSyncExternalStore` + 缺失 matchMedia 防御，jsdom 测试可 mock）。localStorage key：`sbcv:theme`，值 `"light"|"dark"`，缺失 = system（这是 app 第一个 localStorage 使用，引导脚本与 store 共享同一 key 与解析真值表）。
8. **顺手发现的 live bug（先修，独立原子）**：点击选中任何边，xyflow vendor 的选中规则把 stroke 压成 `#555`——**今天 dark 下选中边就近不可见**。注意 vendor 规则有**三条臂**（`dist/style.css:177-181`）：`.selected`（(0,3,0)）、`.selectable:focus`、`.selectable:focus-visible`（各 (0,4,0)），且桌面边 `edgesFocusable`（`CanvasWorkspace.tsx:584-586`）+ vendor 给边 `tabIndex=0` → **chromium 里点击即聚焦，只 own `.selected` 一臂打不赢 `:focus` 臂**。修复杠杆 = 定义 `--xy-edge-stroke-selected` 变量（vendor 三臂全部经 `var(--xy-edge-stroke-selected, …-default)` 消费，中间层变量一处生效）。与主题无关，T0 先行修掉。
9. **杂项硬判据**：动效 brightness hover（:519-535 `filter: brightness(1.1)`、:1880 1.14）是"亮=强调"的 dark 习语，light 表需要 `--hover-brightness` < 1 或方向翻转；白 alpha 幽灵控件（`.field__reveal-button` :2713-2726 全 rgba(255,255,255,…) 搭 **未定义变量** `var(--color-text-muted, #b5bdc8)` 兜底，white-hover 洗（:630,:2724）、inset 白边光（:2813））在 light 下不可见，必须 ink-alpha 化；`#b5bdc8` 按值属 secondary 带不属 muted——**删除 :2719 的孤儿 var() 引用改指真实 token，绝不 ship 名为 `--color-text-muted` 的 token**；toast 成功/错误边框 `#2f5a3a`/`#5a2f33` 是相距 4 行的数字异位词（最高手滑风险，转换后 grep 双向确认）；`:515` 等 4 处注释里的 hex 已经/即将漂移，token 化时同步改写注释。

## 与既有 goal 的关系

- 与 U-queue（inspector 可用性）、C-queue（canvas config-gen）、A-queue（diagnostics）**正交**：本 T-queue 只动表现层（`src/styles.css`、三处 TSX 颜色、主题机制/UI），不碰 domain/serialization/diagnostics。
- 尊重 node-card 设计现状（`docs/goals/node-card-redesign-execution.md` 的 minimal-chrome 结论）：T-P2 收敛与 T6 light 表**不得改变 dark 模式的设计语言**（deprecated=amber、gated=violet、platform=slate、selection=blue、palette Legacy=暖珊瑚 vs inspector banner 红——审计确认 palette 与 node badge 的同词异色是**有意分叉**，:1063 注释为证，不要"统一"它们）。
- styles.css 里的设计意图注释（D2/N1/V8-S2/R2/R5/W11 等编号引用既往 goal）在机械替换中**必须原样保留**（引用 hex 的注释按第 9 条同步改写）。

## Process (non-negotiable)

继承前序 goal（U/A-queue）的全部硬门，逐条不可省略：

- **像素不变性是 P1 的 acceptance，且必须机械证明。** T1 交付 `scripts/verify-token-equivalence.mjs`：解析 styles.css，把每个 `var(--…)` 按 `:root` 表解析回字面值，与 `git show <base>:src/styles.css` 的对应声明做规范化 diff——每个 P1 原子项必须**脚本零 diff + `pnpm test` + `pnpm build` + `pnpm e2e` 全绿**才算完成。脚本规格（必须满足，否则首日即误报）：(a) **base = 各原子项开工时的 pre-atomic HEAD**（不固定在 `8db1dc6`，否则 T0/前序原子的合法新增永远报 diff）；(b) **两侧各自按各自的 `:root` 表解析后再比**（T2 起 base 侧已含前序 var()）；(c) **剥离注释后比较**（P1 同步把注释里的 hex 改写为 token 名，注释变更不得污染 diff）；(d) 支持**函数内嵌 var() 替换与空白归一**（`rgba(var(--accent-brand-rgb), 0.34)` ↔ `rgba(199, 255, 0, 0.34)`）；(e) 显式豁免清单逐条断言"新 token 解析值 == 被替换的原字面值"（T2 的 `.sbcv-logo__hexagon` 新增规则断言 == `#0d1116`、T3 的 :2719 断言 == `#b5bdc8`），豁免清单之外不允许声明级新增/消失。16 处既有 e2e 颜色断言是补充回归网，不替代脚本。
- **Guard 测试用棘轮（ratchet）模式。** T1 新建 `tests/theme-token-guard.test.ts`（克隆 `tests/no-local-absolute-paths.test.ts` 的 git ls-files → per-line regex → offenders 机制）。**范围句（一次性写清）**：扫描范围 = `src/styles.css` + `src/**/*.{ts,tsx}`；范围内 allowlist 仅一条 = `src/components/SbcvLogo.tsx:22`（品牌底板常量，CSS 已收权、attribute 留作兜底，对应 Out-of-scope 第 1 条；allowlist 项必须带理由注释）；`e2e/**` 断言常量、`docs/**`、`index.html` favicon、`public/theme-init.js`（首帧背景字面量，有意为之）在范围之外天然豁免。匹配模式 = hex **及 `%23` 编码形式（防未来回归，范围内现状 0 命中）**、rgb/rgba/hsl、值位 named colors。断言违例数 ≤ 当前基线且随 T2–T4 递减；T4 收紧为 `toEqual([])` 终态。
- **Token 命名**：`--{category}-{role}[-{state}]`；类别 = surface / text / border / accent-{brand,info,danger,warn,gated,platform,success} / status / edge / port / canvas / shadow / scrim / focus / xy（vendor 桥接）。P1 期间允许 per-component verbatim alias（如 `--status-error-icon-toast`），P2 收敛后保留语义层 ~85–100 个。
- **One atomic = one outcome，严守 don't-mix**：行为修复（T0）vs 机械重构（T1–T4）vs 有意视觉微调（T5）vs 新表（T6）vs 机制（T7）vs UI（T8）绝不混 PR；AGENTS.md #7 的 ≤400 逻辑行硬约束是 P1 按段拆四个 PR 的原因，不得合并段。
- **Test-first**；**Land via squash PR，never direct push to `main`**（[[feedback_pr_over_commits]]）。Green-before-merge 硬门：本地 `pnpm test` + `pnpm build`（+P1 加 equivalence 脚本）全绿、**Cloudflare Workers Builds = success**（[[feedback_cloudflare_merge_gate]]）、reviewer verdict 已回且 actionable 发现已应用——缺一不合并。本 goal 不触配置生成，`pnpm test:binaries` 不适用（如误触 `src/domain/**` 即越界，回退）。
- **Review gate（BLOCKING，一轮）**：每个原子项派一名最适配领域的资深 Claude Code reviewer 子代理（[[feedback_codex_review_gate]]）；reviewer/explore 子代理只读 ref-explicit git 或隔离 worktree（[[feedback_reviewer_subagent_no_shared_git]]）。
- **Frontend Skill Gate**（AGENTS.md:32-37 显式点名 `src/styles.css`、组件/Playwright 测试、构建配置）：每个原子项同 session 应用 `vercel-react-best-practices`；T7 重点审 theme 订阅的 rerender 范围（narrow selector / `useSyncExternalStore`，绝不让主题翻转触发画布全量重渲）。
- **CSS 导入顺序不变量**：xyflow CSS（经 `CanvasWorkspace.tsx:1`）必须先于 `styles.css`（经 `App.tsx:9`）进 bundle——重构时不得调整 import 链相对顺序。
- **Re-verify against HEAD before each atomic**：开工前 sync main 并对照 HEAD 复核 file:line 锚点（本 doc 锚点采于 2026-06-10 HEAD `8db1dc6`；[[feedback_sync_worktree_before_work]]）。
- **Devlog every atomic**：勾选 Running TODO + Milestone Notes 追加（what changed / tests / equivalence 脚本输出 / reviewer verdict / verification commands）。
- **Execution Loop（strict / serial / interruptible）**：沿用 U-queue 的事故教训——一次一个原子项；一个工具批次只做一件可独立验证的事；实现 / 跑测 / commit / push / 开 PR / **PR issue gate（查 `Review of PR #N` issue，actionable 先修）** / 轮询 CI / merge / **main issue gate（通过后才开下一原子，`docs/goal-driven-development.md:137-167`）** / 下一项各自独立成轮；红灯绝不前进；空工具输出按已成功对待，需要确认时单独只读核查；用户叫停立即停。

## Phases & Atomic Queue

执行顺序 **T0（live bug）→ T-P1（verbatim token 化 ×4，dark 零变化）→ T-P2（受控收敛）→ T-P3（light 表 → 机制 → UI）→ T-P4（打磨 + re-audit）**。严格串行，依赖链 T0→T1→T2→T3→T4→T5→T6→T7→T8→T9。

### Running TODO

#### Phase T-P0 — 先行行为修复
- [x] T0-selected-edge-stroke-bug — PR #329

#### Phase T-P1 — verbatim token 化（dark 像素零变化，equivalence 脚本背书）
- [x] T1-token-infra-and-global-topbar（基建 + styles.css 1–815）— PR #331
- [x] T2-canvas-nodes-edges-tsx（styles.css 805–1890 + TSX 三处 + xyflow 桥接变量）— PR #333
- [x] T3-inspector-dialogs（styles.css 1880–2735 + 孤儿 var 修复）— PR #334
- [ ] T4-mobile-toast-and-ratchet-zero（styles.css 2725–3313 + guard 收紧为零）

#### Phase T-P2 — 受控收敛
- [ ] T5-token-consolidation（~200 verbatim → ~85–100 语义 token；有意微调，单独 review）

#### Phase T-P3 — light 表与机制
- [ ] T6-light-variable-table（[data-theme="light"] + color-scheme + 对比度守卫测试）
- [ ] T7-theme-mechanism（theme-init.js + useTheme 模块 + CodeMirror/meta 联动 + **playwright colorScheme pin 同 PR**）
- [ ] T8-theme-toggle-ui（桌面 brand menu + 移动 menu sheet 三态控件 + e2e）

#### Phase T-P4 — 收尾
- [ ] T9-light-polish-and-re-audit（18 条 lightRisk 逐项核销 + workflow 重跑 re-assessment + devlog 终结）

---

### Phase T-P0

#### T0-selected-edge-stroke-bug — live bug（与主题无关，先修）
- **Outcome:** 点击选中边后边线保持可见的选中视觉（蓝 `#2d99ff` 选中语言或加重 lime，定一种并测试锁定），不再被 vendor `#555` 吞没——**含键盘聚焦路径**。
- **根因（已验证，high）:** xyflow 选中规则三臂（`dist/style.css:177-181`：`.selected` (0,3,0)、`.selectable:focus` 与 `:focus-visible` 各 (0,4,0)）全部压过 `styles.css:1821-1824` 的裸 path 规则（(0,1,0)）；桌面边 `edgesFocusable`（`CanvasWorkspace.tsx:584-586`）+ vendor 给边 `tabIndex=0` → chromium 点击即聚焦，**只覆盖 `.selected` 一臂修不掉**。
- **修复杠杆:** 在 `:root` 定义 `--xy-edge-stroke-selected: <选定色>;`（vendor 三臂统一经 `var(--xy-edge-stroke-selected, …-default)` 消费，中间层变量一处生效）。此处的字面量由 T2 token 化为 `--edge-selected`（见 T2），T0 不建 token 体系。
- **Source of truth:** `node_modules/@xyflow/react/dist/style.css:8,177-184`；现有选中语言 = 卡片选中蓝（`styles.css:1296-1305`、一级关联边高亮 :1829-1832）。
- **Acceptance:** e2e：点选一条边断言 computed stroke = 选定色；**Tab 聚焦（focus-visible）路径同断言**；dark 渲染其余不变。
- **Tests (test-first):** e2e 新断言（可挂 `e2e/editor.spec.ts` 边交互族）。
- **Reviewer:** canvas/React-Flow expert。
- **Don't mix:** 不引入 token 体系（单变量字面值除外，由 T2 接管）；不动其他边状态。

### Phase T-P1 — verbatim token 化

> 四个原子项共同的 **Outcome 模板**：该段所有颜色字面量移入 `:root` token 表（逐字保值），使用点改 `var(--…)`；`scripts/verify-token-equivalence.mjs` 对该段零 diff；guard ratchet 基线下降；`pnpm test`/`build`/`e2e` 全绿且**不改任何测试**。同 hex 异义按审计结论第 2 条拆分；alias 命名遵守词表；段内含注释 hex 的设计注释同步改写为 token 名。
>
> **段边界以内容锚为准，行号仅作初始参考**（T1 在文件顶部插入 token 表后全部行号下移；开工前按 HEAD 复核）：T1 = 文件头至 `.official-check-btn` 块结束（含 :805 的 `status-check-pulse` keyframe 端点）；T2 = `.workspace`（:809）起至 `button.sbc-edge-remove` 块结束（含 :1881 的 hover 阴影）；T3 = `.inspector-heading`（:1884）起至 `.field__reveal-button:hover` 块结束（:2726）；T4 = mobile 区块注释（:2728）起至文件尾。重叠带（805–815、1880–1890、2725–2735）内每个字面量按上述归属唯一认领，后段不得重复处理。

#### T1-token-infra-and-global-topbar
- **Outcome:** token 基建落地 + styles.css 1–815（:root/全局控件/表单/topbar/状态 pill/diagnostics popover）完成 verbatim 替换。
- **基建交付:** `:root` token 表骨架（按词表分类注释分区）；`scripts/verify-token-equivalence.mjs`；`tests/theme-token-guard.test.ts`（ratchet，初始基线 = 全文件现状）；`[data-theme]` 占位注释（空表，T6 填）。
- **Source of truth:** `.audit/light-mode/findings.json` css-1 段 + 归并对抗裁决；guard 模板 = `tests/no-local-absolute-paths.test.ts:14-53`。
- **Touch:** `src/styles.css`（1–815 段 + 顶部 token 表）、`scripts/verify-token-equivalence.mjs`（新）、`tests/theme-token-guard.test.ts`（新）。
- **关键拆分（本段）:** 状态 pill 三色 fill/fg 分离（:472/:477/:487 与 :520/:526/:532 的故意双声明**必须同 token**，:515 stale 注释一并修正为 token 名）；`#1C1E20` pill-chrome vs `.brand-menu` overlay 分 alias；`#333537` 背景/边框拆；白 alpha hover 洗(:630) mint 为 `--surface-hover-wash`（light 翻转黑基）；`--accent-{brand,warn,danger}-rgb` 三元组承接 :522/:528/:534/:802/:805 的 alpha 阶梯；logo stroke 族（:176-193 的 `#c7ff00`、:180 的 `#59616a`）mint 为 **主题不变**的 `--logo-stroke`/`--logo-idle`（不并入 `--accent-brand-fg`，见审计结论 5 与 Out-of-scope 第 1 条）。
- **Acceptance/Tests:** equivalence 零 diff；ratchet 基线从 N₀ 降至 N₁ 并锁定；test-first = 先提交 guard 测试（红：基线断言写成 T1 完成后的目标数）再替换。
- **Reviewer:** CSS refactor 正确性（重点抽查双声明同 token、注释改写、alias 拆分对照审计 JSON）。
- **Don't mix:** 不动 815 行之后任何字面量；不引入 light 值；不调整选择器/specificity。

#### T2-canvas-nodes-edges-tsx
- **Outcome:** styles.css 805–1890（workspace/palette/minimap/画布/节点卡/端口/徽章/边）+ **TSX 三处** + **xyflow 桥接变量**完成 verbatim 替换；canvas 主题控制权全部收归 app。
- **Source of truth:** css-2 段 + noncss facts（xyflow 泄漏面四处的精确清单与 var 链机制 `dist/style.css:3-96`）。
- **Touch:** `src/styles.css`（805–1890 + token 表追加 + `.sbcv-logo__hexagon` fill 规则）、`src/components/CanvasWorkspace.tsx`（:50 `stroke:"var(--edge-connection)"`、:591 `color="var(--canvas-dot-rf)"`）、`src/components/SbcvLogo.tsx`（不动，fill 由 CSS 覆盖）。
- **关键拆分（本段）:** `--surface-inverse`/`--surface-inverse-hover`/`--text-inverse` 三件套（:1182-1190 反白激活钮，**绝不映射到普通 surface/text**）；`#11161c` 四拆；`#101418` 端口族独立；双层点阵两 token（CSS radial `rgba(147,161,176,0.13)`+`#080b10` 与 RF `#1f2730`；`#1f2731` 留在 border 组**不合并**）；edge 族 token（default lime/highlight blue/dangling red/invalid `!important` 规则保持结构只换值）；xyflow 桥接：`--xy-minimap-mask-background-color`、`--xy-minimap-node-background-color`、`--xy-selection-background-color`、`--xy-selection-border`——**P1 阶段取值 = vendor 当前实效值逐字（rgba(240,240,240,0.6)/#e2e2e2/rgba(0,89,220,…)），只收权不改观**（var fallback 链从 `-default` 层换到中间层、值逐位不变、两主题下都胜出——完备性 reviewer 已对 vendor 源码验证此推理成立）。**显式 ACK：dark 侧保留 vendor 的浅 mask/蓝框选既成视觉**（审计 NC11/NC12 建议双主题对齐 app 蓝，本 queue 以 dark 零变化为最高指令——如要对齐，T5 作为有意微调登记，不得在 P1 顺手改）；T0 的 `--xy-edge-stroke-selected` 值改读 `--edge-selected`。
- **Acceptance/Tests:** equivalence 零 diff（TSX 两处由脚本的 TSX 子检查覆盖：文件中不再有 hex；`.sbcv-logo__hexagon` 新增规则走 Process 的显式豁免清单，断言 var 解析值 == `#0d1116`）；e2e `mobile.spec.ts`/`editor.spec.ts` 的 stroke 断言原值通过；ratchet 降至 N₂。
- **Reviewer:** canvas/React-Flow expert（重点：inline style var() 在 connection path 上的实测、xyflow var 链兜底语义、`!important` 层保持）。
- **Don't mix:** 不改 vendor 泄漏面的**值**；不动 T0 之外的边交互行为。

#### T3-inspector-dialogs
- **Outcome:** styles.css 1880–2735（inspector 表单/共享控件/JSON 对话框/lazy 骨架/rule 表/banner）verbatim 替换 + **孤儿 var 修复**。
- **Source of truth:** css-3 段；归并对抗第 8 条（`#b5bdc8` 属 secondary 带）。
- **Touch:** `src/styles.css`（1880–2735 + token 表追加）。
- **关键拆分（本段）:** `#101418` 的第五向 `--surface-sunken-card`（:2079-2083，inset 语义，见结论 2）；:2719 `var(--color-text-muted, #b5bdc8)` → `var(--text-reveal-idle)`（verbatim `#b5bdc8`，归并去向 T5 决）——**不定义 `--color-text-muted`**；`.field__reveal-button` 白 alpha 三件套 mint 为 ink-wash 族；inspector banner 四组 rgba 三件套（bg/border/fg）整组 token（light 下 wash 可保 alpha 换基）；"deprecated/platform 同词异色分叉"保持（banner 红/橙 vs node badge 琥珀/slate，**不统一**）；`#090d12` vs `#0b0f14` code-surface 两 alias；输入框 `border-color: transparent`(:1996) mint `--border-input`（light 必须可见）；`.cm-theme-dark` 高度规则**本段不动**（T7 处理，don't-mix）。
- **Acceptance/Tests:** equivalence 零 diff（:2719 是唯一允许的"字面量消失"点：脚本对该行做显式豁免断言新 token 值 == 原 fallback）；ratchet 降至 N₃。
- **Reviewer:** CSS refactor 正确性 + design-token taxonomy。
- **Don't mix:** 不动 CodeMirror 选择器/主题；不动 banner 色值。

#### T4-mobile-toast-and-ratchet-zero
- **Outcome:** styles.css 2725–3313（compact/移动壳/sheet/toast）verbatim 替换；**guard ratchet 收紧为 `toEqual([])` 终态**（src/styles.css + src/**/*.tsx 零裸色，allowlist 之外）。
- **Source of truth:** css-4 段。
- **关键拆分（本段）:** scrim vs shadow 分离（rgba(0,0,0,0.4) 双义）；`#2f5a3a`/`#5a2f33` 异位词双向 grep 复核；toast 真绿族独立 `--accent-success-*`（**不并入 brand lime**）；移动 status icon 接 `--status-*-icon` 矩阵；`#14181d` sheet 面与 `background: transparent` 继承耦合（:3139,:3214）注释标注。
- **Acceptance/Tests:** equivalence 零 diff；guard 终态绿；全量 `pnpm e2e`（含 mobile）绿。已知 flaky 的 `e2e/port-click-redesign.spec.ts` node-delete hover-opacity 断言（当前 :327/:329 附近，按内容定位勿按行号）与本队列无关，红了重跑该 job（[[project_flaky_e2e_node_delete_hover]]）。
- **Reviewer:** CSS refactor 正确性（终态 guard 的 allowlist 边界审查）。
- **Don't mix:** 不预填 light 值。

### Phase T-P2

#### T5-token-consolidation — 受控收敛（有意微调）
- **Outcome:** token 表从 ~200 verbatim alias 收敛到 **~85–100 语义 token**；dark 渲染允许 stated-policy 内的微调。
- **合并政策（优先级，必须照此执行）:** 下方"已裁决清单"条目是**经审计签字的预批例外**（部分 Δ 超 8，如 info 前景 Δ≈22、muted 档内最高 Δ≈40——视觉抽查背书后照并）；**Δ≤8 且同角色组内**只约束清单之外的新合并；两者都不满足的保留 alias。**e2e 锚定约束：16 处 e2e 断言值所在的 verbatim 值默认为其合并组的 canonical**（如 `#ff7777`+`#ff7b7b` 合并时 canonical 必须取 `#ff7b7b`，因 `port-click-redesign.spec.ts` 断言 rgb(255,123,123)）；确需偏离时同 PR 改断言并在 Milestone Notes 记录。
- **已裁决清单（来源 = 归并对抗 19 条 + 四段盘点 specialCases，逐条核销以 `docs/goals/light-mode-theming-audit-appendix.md` 为准）:** 大小写孪生归一（`#1C1E20`/`#292B2D`/`#494B4D` 三对）；`#090b0f`+`#0a0d12`→`--surface-app`；`#f4f7f9`→text-primary；muted 灰阶 24→4 档（`#8794a0` 是 gated 语义色（hex 在 :1066，设计注释 :1062-1063）**保独立**）；边框 9→2-3；**hover 填充族 11 值→3-4 token**（`#171d24`/`#1a222b`/`#20262d`/`#232629`/`#292b2d`/`#2b333d`/`#2a3340`(:3311)/`#303842`/`#151b22`/`#494b4d`(hover-on-control 单列)等，god-group 之一）；info 前景 `#59b4ff`/`#65b0ff`/`#6fb8ff`→1（platform `#6fb6e6`、banner `#9fc6ff`、toast `#8aa0b4` **排除在外**）；danger 边框三连/深面双连/软文本双连各并；**撞名裁决：`#101418` 族 = `--surface-control`，`#252b31`/`#252b32`/`#232a32` 族 = `--surface-control-chip`**（归并对抗 TM0 与 TM12 同名冲突，按此定名）；近白文本族并(但 `#e4e9ee` edge 线与 `#e7f4ff` 角柄 outline **保独立 token**)；shadow 13 alpha→3-4 档完整字符串 token（`--shadow-overlay/raised/node` + glow）；**brightness hover 消费端改写**（:521/:527/:533/:1880 改 `filter: brightness(var(--hover-brightness, 1.1))`——无颜色字面量故 P1 不触，结构性改写归本项，light 值 T6 填）。
- **Acceptance:** 视觉抽查清单（每个被合并值列代表选择器截图/目测项）+ reviewer 签字；16 处 e2e 颜色断言按上方锚定约束逐一确认；equivalence 脚本切换到"容差模式"报告每处 Δ 供 review。
- **Reviewer:** design-system/token taxonomy expert（对照附录逐条核销）。
- **Don't mix:** 不引入 light 值；不动选择器（brightness 的 var() 参数化除外）。

### Phase T-P3

#### T6-light-variable-table
- **Outcome:** `[data-theme="light"]` 完整变量表（含 `color-scheme: light`、`--xy-*` light 值、shadow/scrim/wash 的 light 策略、brightness 极性）+ **对比度守卫测试**。手动 `document.documentElement.dataset.theme='light'` 即可完整预览（机制未上线，无用户入口）。
- **设计约束（来自 lightRisk 18 条，逐条核销在 T9）:** 文本对 ≥4.5:1、UI/状态指示 ≥3:1（WCAG 1.4.3/1.4.11）；brand 前景向 olive（保"绿图"签名）；focus ring 专用 token light 下 ≥3:1；卡-画布分离极性翻转（light 下卡白于画布、边框扛更多分离职责）；选中蓝深化 ~`#1c7ed6`、角柄 outline 翻深；tinted-dark 三件套(badge/delete/banner/toast/lazy-error)按"浅 wash bg + 深 border + 深 fg"重导出而非亮度翻转；阴影 alpha 约砍至 1/3 收紧 spread；`--hover-brightness: 0.95` 类极性处理（消费端 var() 化已由 T5 完成，本项只填 light 值）；glass 表面换白基保 alpha；状态 pill 加边界。
- **Touch:** `src/styles.css`（light 表 ~100–150 行）、`tests/theme-contrast.test.ts`（新：解析两套表，对一份显式 fg/bg 配对清单断言对比度阈值——配对清单是测试的一部分，新 token 不配对则测试失败提醒登记；**rgba token 按其配对 bg 先做 alpha 合成再算 ratio；shadow/scrim/gradient 类进显式 exempt 表**）。
- **Acceptance/Tests:** 对比度测试绿（test-first：先写配对清单与阈值，红，再填表）；一条临时 e2e（`page.addInitScript` 设 data-theme=light）smoke 关键面无 vendor 色/无暗残留；dark 渲染零变化（equivalence 不涉及——light 表不触 :root）。
- **Reviewer:** a11y/contrast expert（验算对比度数学与配对清单完备性）。
- **Don't mix:** 不加切换机制/UI；不动 CodeMirror；**light 覆盖只写变量值，`[data-theme="light"]` 下不得新增组件级选择器**（避免重开 :147-150 那类 specificity war——审计 IF18 警告）；**`--logo-*` 族是主题不变量，不进 light 覆盖表**。

#### T7-theme-mechanism
- **Outcome:** 三态主题机制端到端可用（无 UI 入口，console/localStorage 可驱动）：`public/theme-init.js`（CSP-safe 外部阻塞脚本：读 `sbcv:theme` → 设 `data-theme` + 同步首帧背景，防双向 FOUC）；`src/state/useTheme.ts`（镜像 `useViewport.ts`：matchMedia('(prefers-color-scheme: dark)') + localStorage 覆盖 + `useSyncExternalStore` + dataset 同步 + 缺 matchMedia 防御 + **localStorage 读写一律 try/catch，异常按 system 处理**（Safari 隐私模式等，theme-init.js 同样要求））；**常驻挂载：`App.tsx` 顶层调用 `useTheme()`**（useViewport 模式的 listener 在首个订阅时才挂上，唯一消费者若是惰性挂载的对话框，系统主题翻转将不会同步 dataset/meta——必须有常驻订阅者）；`<meta name="theme-color">` 动态对（media-paired 初始 + 手动覆盖时 JS 更新）；CodeMirror `theme={resolved}` 联动 + `styles.css:2578-2581` 选择器改 `[class*="cm-theme"]` 双态兼容；可选的切换瞬间 transition 抑制类（:144,:508,:1291,:1782,:1865 五处 120ms tween 可接受则记录为 known-minor）。
- **同 PR 硬约束:** `playwright.config.ts` `use.colorScheme: "dark"` pin（审计判据第 6 条——没有它全套 e2e 翻 light 必红）。
- **Source of truth:** infra facts（CSP/_headers、boot 时序、useViewport 模式、uiw reconfigure 机制）。
- **Touch:** `index.html`（head 加 `<script src="/theme-init.js">` + theme-color meta 对）、`public/theme-init.js`（新，~15 行）、`src/state/useTheme.ts`（新）、`src/App.tsx`（常驻挂载）、`src/components/ConfigJsonViewerDialog.tsx`（theme prop）、`src/styles.css`（cm-theme 选择器）、`playwright.config.ts`（pin）、`tests/`（useTheme 单测，mock matchMedia）、`e2e/`（light 路径 spec）。
- **Acceptance/Tests:** test-first 单测覆盖真值表（key 缺失→system、两显式值、storage 异常→system、storage event 跨标签同步可选）；e2e：默认（pin dark）全绿不改断言 + 新增一条 light 路径 e2e（addInitScript 预置 localStorage）断言 data-theme 与一个 token 计算值；**CSP 只能在 Cloudflare 部署层验证（`_headers` 不被 vite preview 解析，本地"无报错"是假阴性）**——本地仅验 theme-init 的阻塞时序，合并后在 Workers Builds preview/sbcv.app 复核 console 无 CSP 拦截。
- **Reviewer:** frontend infra expert（boot/CSP/storage/rerender 范围——theme 翻转只许 reflow 样式，不许触发画布数据重算）。
- **Don't mix:** 无 UI；不改任何 token 值。

#### T8-theme-toggle-ui
- **Outcome:** 桌面 brand menu（`TopBar.tsx` 菜单体系）与移动 `MobileMenuSheet.tsx` 各一个三态控件（System / Dark / Light，当前态可见，文案沿用产品语言惯例）。
- **Touch:** `src/components/TopBar.tsx`、`src/components/MobileMenuSheet.tsx`、`src/styles.css`（控件样式走既有 menu-item token，无新字面量——guard 保证）。
- **Acceptance/Tests:** e2e：切 light → token 计算值变 + 持久化（reload 仍 light）→ 切回 System 跟随 emulateMedia；移动视口同验；axe/键盘可达（focus ring 在两主题可见——T6 的 focus token 在此实测）。
- **Reviewer:** UX/frontend expert。
- **Don't mix:** 不调 palette 值；发现的色值问题登记给 T9。

### Phase T-P4

#### T9-light-polish-and-re-audit
- **Outcome:** 18 条 lightRisk 发现逐项核销（修复或带理由 ACK，以附录为准）；重跑 `scripts/workflows/light-mode-theming-audit.workflow.js` 的对抗阶段做 re-assessment（预期：coverage 零新增、light 下无 vendor 泄漏/暗残留）；全 UI 面双主题巡检清单过一遍（topbar/菜单/palette/画布全状态/minimap/inspector 全表单/dialog/popover/sheet/toast/badge/banner/focus/selection/scrollbar）；**README hero 截图（`docs/assets/hero.png`，README.md:15 引用）双主题更新或显式 out-of-scope 声明**——它是浏览器 UI 之外唯一的颜色营销面；devlog 终结 + 记忆沉淀。
- **Acceptance:** 巡检清单零 P0/P1 残留；`pnpm release:check` 全绿；Milestone Notes 完整。
- **Reviewer:** 综合（design + a11y 双签）。

## Out of scope（显式非目标）

- favicon 与 SbcvLogo 的随主题翻转——**logo 全件配色（暗底板 `#0d1116` + lime `#c7ff00` 描边/圆点 + idle 灰 `#59616a`）为主题不变量（用户拍板 2026-06-10）**；token 化为 `--logo-*` 族、仅 `:root` 定义，light 表不覆盖（审计确认双主题下均 legible）。
- `prefers-reduced-motion` / `prefers-contrast` / forced-colors 支持（审计确认现状为零，独立 gap，另立 goal）。
- CodeMirror 自绘 token-driven EditorView.theme（务实采用 stock one-dark/light；如 T9 巡检认定 stock light 与 chrome 失谐，再立后续原子）。
- 第三主题（高对比度等）——token 架构已为其留好形状，但不在本 queue。

## Validation Matrix

| Case | Check |
| --- | --- |
| P1 每原子 | `node scripts/verify-token-equivalence.mjs` 零 diff + `pnpm test` + `pnpm build` + `pnpm e2e` |
| guard 终态 | `tests/theme-token-guard.test.ts` offenders `toEqual([])`（T4 起） |
| light 对比度 | `tests/theme-contrast.test.ts`（T6 起，配对清单全覆盖） |
| 机制 | useTheme 单测真值表 + e2e light 路径 + prod CSP 验证（T7） |
| 端到端 | T8 e2e 切换/持久化/系统跟随；T9 `pnpm release:check` |

## Milestone Notes

（每原子项落地后追加：what changed / tests / equivalence 输出 / reviewer verdict / verification commands / 偏差。）

### T0-selected-edge-stroke-bug — PR #329
- **What changed:** `:root` 新增 `--xy-edge-stroke-selected: #2d99ff`（vendor 三臂 `.selected`/`.selectable:focus`/`.selectable:focus-visible` 统一经该中间层变量取色），选中/聚焦边从 vendor `#555` 变为选择蓝。选蓝理由：与卡片选中（:1296-1305）和一级边高亮（#2d99ff）同语言。
- **Tests (test-first):** e2e `editor.spec.ts` 新增——点选（interaction path 几何中点 + getScreenCTM，避开 bezier bbox 中心不在曲线上的问题）与键盘 focus 两臂均断言 `rgb(45,153,255)`；修复前红（实测 `rgb(85,85,85)` 复现 bug）。
- **Verification:** `pnpm test`(1731) + `pnpm build` + `pnpm e2e`(37) 全绿；视觉截图确认选中边清晰可辨。vendor 消费链核验：`dist/style.css:180` 消费 `var(--xy-edge-stroke-selected, …-default)`，vendor 仅定义 `-default` 后缀（:8 `#555`、:56 dark `#727272`），无同名遮蔽。
- **Reviewer verdict:** 7 角度 review（line-scan / removed-behavior / cross-file / reuse / simplification / efficiency / altitude）零 actionable 发现；altitude 评注——own 中间层变量优于叠加 specificity，三臂一处生效。
- **偏差:** 无。该变量值由 T2 接管为 `var(--edge-selected)`。
- **事故记录:** 并行会话从本分支误切 `ci/sync-singbox-docs-hardening` 导致 PR #330 短暂裹挟 T0 commit；已 `rebase --onto origin/main` 剥离并 force-with-lease 修复，两 PR 文件集已各自干净。

### T1-token-infra-and-global-topbar — PR #331
- **What changed:** ① `:root` token 表落地（59 个 token：surfaces ×15、text ×14、borders ×8、accents/status ×13、RGB 三元组 ×3、logo 主题不变量 ×2、whole-shadow ×3、vendor bridge ×1），`[data-theme="light"]` 占位注释就位；② styles.css 全局/topbar 段（文件头至 `status-check-pulse` keyframe）全部颜色字面量改 `var()`——状态 pill 的故意双声明（rest + hover re-assert）已同 token 锁死；glow ring/pulse keyframe 走 `rgba(var(--accent-*-rgb), α)` 三元组；大小写孪生（`#1C1E20`/`#292B2D`/`#494B4D`）token 化时归一小写；4 处注释 hex 同步改写为 token 名（含 :515 stale 注释修正）；③ `scripts/verify-token-equivalence.mjs`（两侧各自解析 var→字面、剥注释、属性名稳定排序规范化、豁免清单带值断言）；④ `tests/theme-token-guard.test.ts`（ratchet：391 → **301**；`rgba(var(` 豁免、TS 注释剥离防 `#303` 类 PR 编号误报、SbcvLogo.tsx:22 allowlist 带理由）。
- **Equivalence:** `node scripts/verify-token-equivalence.mjs main` → ✓ 456 个规范化声明逐一相同（零像素变化机械成立）。
- **Tests:** unit 1732/1732（含新 guard）、build ✓（tsc 严格索引检查通过）、e2e 37/37（16 处颜色断言原值通过 = 免费像素回归网）。
- **视觉抽查:** topbar/brand pill/状态 pill/popover 截图与 token 化前一致。
- **偏差:** `:root` 内 `background`/`color` 声明移至 token 表之后（值不变，声明顺序对渲染无影响）——equivalence 脚本以属性名稳定排序吸收该顺序差，同名属性保持相对顺序以保住 CSS 覆盖语义。

### T2-canvas-nodes-edges-tsx — PR #333
- **What changed:** ① 画布段（`.workspace` 起至 `button.sbc-edge-remove` 块）全部字面量 token 化（+95 个 token：canvas 双点阵、glass 四面、node 卡/badge 三件套、`#101418` 角色五拆中的四向、port 全态、edge 五态、selection 族 + `--selection-rgb`、danger/legacy/gated/platform 族、复合 whole-shadow ×10）；② TSX 两处收口（`connectionLineStyle.stroke` 与 `<Background color>` 改读 var()，连线 inline stroke 保留——删除会复活死掉的 `.valid` lime 规则）；③ `.sbcv-logo__hexagon { fill: var(--logo-plate) }` 新规则收权 TSX presentation attribute（equivalence 豁免清单带值断言 `== #0d1116`）；④ xyflow 泄漏面四变量收权（minimap mask/node、selection rect ×2，**取值 = vendor 实效值逐字，dark 零变化**，控制权移入表内）；⑤ T0 的 `--xy-edge-stroke-selected` 改读 `--edge-selected`。
- **Equivalence:** ✓ 457 个规范化声明逐一相同（含 logo fill 豁免验证）。
- **Tests:** unit 1732/1732、build ✓、e2e 37/37（mobile/editor 的全部 edge stroke 断言原值通过）；ratchet 301 → **151**。
- **视觉抽查:** 选中节点蓝 ring/角柄、一级边蓝高亮、lime 默认边、端口、minimap、反白 active 控件——与 token 化前一致。
- **偏差:** 无。

### T3-inspector-dialogs — PR #334
- **What changed:** inspector 表单/共享控件/rule 表/diagnostics/JSON 对话框/banner 段全部字面量 token 化（+70 token：表单族、`--surface-sunken-card`（`#101418` 第五向，:2306）、`--surface-card-inset`（审计纠偏的 inset 语义三卡）、`--surface-dialog`（与 active-pill 同值拆分）、banner 四组 bg/border/fg 三件套整组、白 alpha ghost 族、code 双面、whole-gradient skeleton、`--border-default`）；**孤儿 var 修复**：:2942 `var(--color-text-muted, #b5bdc8)` → `var(--text-reveal-idle)`（值=原 fallback，未 ship `--color-text-muted`）；`.cm-theme-dark` 高度规则按 don't-mix 未动（T7 处理）。
- **Equivalence:** ✓ 457 个规范化声明逐一相同（孤儿 var 两侧解析同值，自然通过）。
- **Tests:** unit 1732、build ✓、e2e 37/37；ratchet 151 → **65**。
- **视觉抽查:** inspector 全表单/rule card/placeholder/对话框——一致。
- **偏差:** 无（中途漏 mint `--border-default` 被 equivalence 当场抓出 ×5——验证器按设计工作）。
