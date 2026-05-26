# Editable Node UI Deep Pass

## Outcome

把 66 个可编辑节点（settings / hub / rule / inbound / outbound / dns-server / endpoint / service / rule-set）的所有 official-read 阶段已记录的 P0 / P1 UI 缺口，按共享基础设施 → 节点族 entityType 分支 → 诊断 / fixture / E2E 的顺序，分批转为代码实现。

完成后每个节点都能从 Library → Canvas → Inspector → JSON 完成 round-trip：

- tag 引用全部走 select / multiselect，没有 raw text；
- enum 字段全部走 `<select>`，没有自由文本；
- array / object 字段至少有 `JsonField` 兜底渲染，重要字段（`users[]` / `peers[]` / `headers` / `predefined` 等）有结构化 repeater；
- TLS-required 协议的 `createInbound` / `createOutbound` 默认 scaffold 已播种 `tls`；
- 平台 / build-tag / channel 限制有 Palette badge + Inspector banner + 诊断；
- `route.rules` / `dns.rules` 顺序只在 RuleTables 表格层主张，画布上是引用卡片；
- `diagnostics.ts` 至少覆盖每节点的 required 字段和 tag 引用有效性；
- 每个节点族至少 1 条 fixture + 1 条 E2E smoke 证明 import → render → edit → export 通过；
- 132 篇 review（`docs/ui-reviews/*.md` + `docs/claude/*.md`）的状态升级为 `implemented`。

## Scope

In scope:

- `src/components/Palette.tsx`、`SbcNode.tsx`、`Inspector.tsx`、`InspectorPanels.tsx`、`RuleTables.tsx`、`CanvasWorkspace.tsx`、`TopBar.tsx`
- `src/canvas/graph.ts`
- `src/domain/sharedFieldRegistry.ts`、`commands.ts`、`diagnostics.ts`、`protocols.ts`、`templates.ts`、`indexes.ts`、`types.ts`、`serialization.ts`、`targets.ts`
- `src/state/useProjectStore.ts`（tag rename / delete / connect / disconnect 扫描路径）
- `docs/ui-reviews/*.md` + `docs/claude/*.md`（状态从 `official-read` 升级到 `ui-verified` → `implemented`）
- `fixtures/` 新增 per-family 最小 fixture
- `e2e/` 新增 per-family round-trip smoke
- `docs/index-ui-reviews.md` + `docs/claude/index-ui-reviews.md`（同步进度计数）

Out of scope（不在本 goal 内，留给其他 goal）:

- 视觉重设计（配色 / 字体 / 排版 / 动画），canvas 的非语义视觉调整。
- 新增 sing-box 协议或节点类型支持（保持当前 66 个节点边界）。
- React Flow 主版本升级、bundler 切换、状态库替换。
- 后端 / 远程 API、协作多人、登录账号。
- 把 canvas 升级为 source-of-truth（已被主 goal 明确拒绝）。
- `sing-box-stable` / `sing-box-testing` 二进制接入本身（在 [Stable-First SBC Visual Editor Release](stable-first-sbc-visual-editor-release.md) 中处理，本 goal 复用其产出）。

## Source Docs

- [AGENTS.md](../../AGENTS.md)
- [Goal-Driven Development](../goal-driven-development.md)
- [Stable-First SBC Visual Editor Release](stable-first-sbc-visual-editor-release.md)（主 goal，本 goal 是其执行支线）
- [SBC React Flow R&D Plan](../sbc-react-flow-rd-plan.md)
- [sing-box Config Document Inventory](../sing-box-config-doc-inventory.md)
- [sing-box Canvas Configuration Guide](../sing-box-canvas-configuration-guide.md)
- [Experimental UI Review](../experimental-ui-review.md)（已有的单节点深度审查范式）
- `vercel-react-best-practices` skill — 本 goal 触发 frontend skill gate
- **Pass 2 official-read 双索引（必读）**：
  - 概念 / 产品层：[docs/index-ui-reviews.md](../index-ui-reviews.md) — Codex 主导，每节点列出官方字段表、关系模型、产品级 P0/P1（节点级标签）
  - 实施 / 代码层：[docs/claude/index-ui-reviews.md](../claude/index-ui-reviews.md) — Claude 主导，每节点 grep 当前实现，给出行号、共享字段表缺口、atomic 实现任务（逐条 finding 计数：P0 ≈ 148，P1 ≈ 260）
- 每节点必须读两篇 review（`docs/ui-reviews/<node>.md` + `docs/claude/<node>.md`）
- sing-box stable docs：`.tmp/sing-box-docs/stable/docs/configuration/`
- sing-box testing docs：`.tmp/sing-box-docs/testing/docs/configuration/`

两套 review 是互补关系：概念层定义"应做什么"和"为何这样做"；实施层定义"在哪改、怎么改、改之后会消除哪些节点的 P0"。**Atomic 设计时必须先读概念层确认范围、再读实施层确认改动落点。**

## Optimal Path

Architecture decision:

- 先做共享基础设施（shared field tables、`JsonField` fallback、`PaletteStatus` 扩展、诊断 helpers），再做节点族 entityType 分支，最后补 fixture / E2E。
- Source-of-truth 仍是 canonical sing-box JSON / domain state；React Flow 节点 / 边只是派生视图。
- 注册表驱动：所有节点的字段控件、共享分组、互斥规则尽可能写在 `sharedFieldRegistry` / 节点专属 entityType 分支，不允许散落的硬编码 if 链。
- 每个 atomic 必须可独立合入、可独立回滚，并附带最小 fixture / 单测覆盖。

Why this is the best path for SBC:

- 跨节点共性占 P0 的大头：`AdvancedScalarFields` 不处理 array / object、`dialSharedFields` / `listenSharedFields` / `tlsSharedFields` 大面积缺字段，单次共享改动会消除 30+ 个节点的 P0。
- 与主 release goal 的 stable-first / registry-driven 决策一致。
- 让每个节点专属修复退化为小 atomic（添加 entityType 分支 + 修 scaffold + 加诊断），便于审查与回归。

Alternatives rejected:

- 按节点逐个全量补完：会重复造 dialSharedFields、TLS 服务端字段等，每个节点都要补一遍，PR 体量失控。
- 一次性大重构 Inspector：违反 atomic 规则，无法独立回滚，难以与主 release goal 协同推进。
- 直接放弃 raw text fallback：会破坏现有可导入但当前 UI 暂未覆盖的字段（如 vless reality），导入即丢字段。

Risk controls:

- 每个 atomic 先加单测（domain command / serialization round-trip / diagnostics）再改 UI。
- 共享字段表扩展前先跑全套 fixture round-trip，避免 `editableScalarFields` 重复双渲染。
- 每个节点族 atomic 完成后立刻同步 `docs/ui-reviews/<node>.md` + `docs/claude/<node>.md` 的状态行（`official-read` → `ui-verified` → `implemented`）和两个 index 的进度计数，防止漂移。

## Implementation Plan

总体推进顺序：Milestone 1 → 6。每个 milestone 内的 atomic 可并行，但跨 milestone 必须按顺序（前一个 milestone 的共享改动是后一个的基础）。

每个 atomic 标注主要文件范围和它消除的 review findings（两套索引交叉引用）。

### Milestone 1 — Shared Infrastructure

> 目标：让"补共享字段"的单次 PR 消除大量节点的 P0。

| Atomic | 范围 | 消除的 findings |
| --- | --- | --- |
| **1.1 Dial fields completion** | `sharedFieldRegistry.ts`（`dialSharedFields`）+ `types.ts`（DialConfig） | 12+ missing dial fields × 影响 outbound 全族 / dns-server tcp/udp/tls/quic/https/h3/dhcp / NTP / endpoint：claude 索引 Cross-Node #2 第一条 |
| **1.2 Listen fields completion** | `sharedFieldRegistry.ts`（`listenSharedFields`）+ `types.ts` | 缺 `tcp_multi_path` / `disable_tcp_keep_alive` / `tcp_keep_alive*` / `udp_fragment` / `detour`：影响所有 inbound + service-derp/resolved/hysteria-realm |
| **1.3 TLS fields completion (server-side)** | `sharedFieldRegistry.ts`（`tlsSharedFields`）+ Inspector TLS card | server-side `key_path` / 内联 `key[]` / `certificate[]` 缺口：影响 trojan/vless/vmess inbound、hysteria 系列、DoT/DoQ/DoH/DoH3、derp、hysteria-realm |
| **1.4 Reality / uTLS / ECH / fragment 子对象** | Inspector TLS card 嵌套 + `types.ts` | vless outbound P0 reality 缺失、vless inbound reality、各种 outbound 1.12+ fragment：claude 索引 Cross-Node #2 第三条 |
| **1.5 `JsonField` fallback for array/object** | `Inspector.tsx`（`AdvancedScalarFields` 兜底）+ entityType 分支 hook | 30+ 个节点的 array/object 字段 invisibility（users[] / headers / peers[] / predefined / extra_headers / host_key[] 等） |
| **1.6 `PaletteStatus` 扩展** | `Palette.tsx`（status union + 渲染）+ `useProjectStore.ts` singleton guard | `deprecated`（block / hysteria v1 / legacy fakeip）、`singleton-locked`（settings / hub）、`open`（已存在的 singleton）+ canvas `+` no-op 修复 |
| **1.7 Diagnostics helpers** | `diagnostics.ts`（required-field、tag-ref-validity、required-when 条件） | 所有诊断盲区（claude Cross-Node #15）的基础，supports milestone 6 |
| **1.8 节点 kind 命名统一** | `Palette.tsx` + `protocols.ts` | `mixed` → `inbound-mixed`、`dns-http3` → `dns-h3`、`hysteria-out` 等 → `outbound-*`：codex 索引 cross-node #1（Library 词汇）+ claude #11 |

Milestone 1 完成的硬指标：

- 全套现有 fixtures `pnpm test` 通过，无 round-trip 字段丢失；
- `vercel-react-best-practices` skill 在每个 atomic 的实现 + 自审中应用过；
- 两个 review index 的 Coverage 行新增 `shared-infra-ready: 1.x 完成`。

### Milestone 2 — Tag Reference UI Hardening

> 目标：所有 tag 引用从 raw text / CSV / 单值 select 升级为 select / multiselect，并补齐 rename / delete 扫描。

| Atomic | 范围 |
| --- | --- |
| **2.1 Selector outbounds + default** | Inspector `outbound:selector` 分支：multiselect candidate（排除 self / 排除非 outbound）、default constrained select、`interrupt_exist_connections` toggle、commands.ts rename / delete 扫描 `default` |
| **2.2 URLTest outbounds + 字段集** | Inspector `outbound:urltest`：multiselect、`url` / `interval` / `tolerance` / `idle_timeout` / `interrupt_exist_connections` 一等公民、移除误显示的 `default` |
| **2.3 Route / DNS hub final select** | Inspector `hub:route` / `hub:dns` 加入 `final` outbound / dns-server select |
| **2.4 Route rule action-gated outbound** | Inspector `rule:route-rule`：outbound select 仅在 `action === "route"` 显示；其它 action 的 sub-fields（reject / sniff / route-options / resolve / hijack-dns）按 action 分组渲染；canvas outbound 端口同步 gating |
| **2.5 DNS rule action-gated server** | 与 2.4 平行；删除幽灵 `dns-rule-action` Palette kind |
| **2.6 `domain_resolver` select 化** | `sharedFieldRegistry.ts` 把 `domain_resolver` 控件 kind 从 text 换成 dns-server tag select；diagnostics 加 required-when-domain |
| **2.7 Rule-set download_detour 诊断** | `diagnostics.ts` 验证 `download_detour` 存在性 + testing channel deprecation warning |
| **2.8 SSM API servers mapping 多路径 select** | Inspector `service:ssm-api`：保留多路径 map 编辑，select option 限于 `managed: true` 的 shadowsocks inbound；canvas edge 自动写 `managed: true` |
| **2.9 DERP `verify_client_endpoint[]` multiselect** | Inspector `service:derp`：multiselect 限于 endpoint:tailscale；disconnect 仅移除单 tag |
| **2.10 NTP detour + Cache file external_ui_download_detour** | `settings:ntp` 已有 select 但缺 canvas edge；`experimental.clash_api.external_ui_download_detour` Inspector 字段从无到有 |

### Milestone 3 — Default Scaffold + Required Fields

> 目标：新建节点立刻是有效配置；required 字段不再埋进 Advanced。

| Atomic | 范围 |
| --- | --- |
| **3.1 TLS 默认播种** | `commands.ts` `createInbound` / `createOutbound` 为 trojan / naive / hysteria / hysteria2 / tuic / anytls / shadowtls outbound、对应 inbound、shadowtls inbound 播种 `tls: { enabled: true }`；shadowtls 还要播种 `handshake` |
| **3.2 Required field 提升一等公民** | Inspector：`server` / `server_port` / `uuid` / `password` / `method` 在 outbound 各 entityType 分支提升；inbound: `users[]` 暴露；P0 列表覆盖所有 outbound 协议 |
| **3.3 Enum select 替换** | 所有 enum 字段改 `<select>`：`method` / `security` / `network` / `version` / `congestion_control` / `udp_relay_mode` / `stack` / `flow` / `packet_encoding` / `default_mode` 等 |
| **3.4 Sensitive 字段 type=password + mask** | `password` / `private_key` / `private_key_passphrase` / `pre_shared_key` / `auth_key` / `token` 等渲染为 `type="password"` + show/hide toggle |
| **3.5 UUID generator helper** | Inspector UUID 字段：插入"生成"按钮 + 格式校验 |
| **3.6 Default scaffold cleanup** | 修正 `network: "tcp"` / `network: "udp"` 硬编码（应留空表示 both）；shadowtls v3 不应预填 `password`；socks 默认补 v5 字段 |

### Milestone 4 — Node-Family entityType Blocks

> 目标：每个节点族在 Inspector 都有 entityType 分支，渲染该协议的全部官方字段。

| Atomic | 范围 |
| --- | --- |
| **4.1 Inbound entityType blocks** | 17 个 inbound 协议各自补 entityType 渲染（重点：users[] 结构化、TUN 平台 / 路由字段、shadowsocks SSM managed mode 显式、shadowtls version-gated、hysteria v1 deprecation banner） |
| **4.2 Outbound entityType blocks** | 18 个 outbound 协议各自补：SSH host_key[]/algorithms 列表 + 三种 auth 互斥；vless flow / packet_encoding；trojan fallback；tor torrc / extra_args 结构化；hysteria2 obfs / realm / server_ports 嵌套；naive extra_headers |
| **4.3 DNS server entityType blocks** | 12 个 dns-server：`server_port` 类型敏感 fallback（53 / 443 / 853）；hosts.predefined map repeater；https/h3 headers map；dhcp interface 一等公民；tailscale endpoint 引用；fakeip range CIDR repeater；resolved service 引用 + 平台 banner |
| **4.4 Endpoint entityType blocks** | wireguard peers[] 结构化 repeater；tailscale 1.13 字段 channel gate + auth_key 敏感 + DERP/DNS reference 一键 attach/detach |
| **4.5 Service entityType blocks** | derp config_path 必填校验 + verify_client_url 嵌套；ssm-api 已在 M2；ccm/ocm users/headers 结构化 repeater；hysteria-realm channel gate banner + users 结构化；resolved canvas edge + 平台 banner |
| **4.6 Rule-set entityType blocks** | inline rules[] 结构化 headless-rule editor；local 删 download-detour 端口；remote http_client 对象 / 字符串两种形态支持；Palette 直接创建 local / inline 入口 |
| **4.7 Settings entityType blocks** | experimental 三模块 cache_file / clash_api / v2ray_api 分别一等公民控件 + v2ray-api build-tag warning + deprecated 字段处理；certificate PEM 多行 textarea + chrome store 版本门控；log timestamp 字段补；NTP 字段完整 |

### Milestone 5 — Platform / Channel / Version Gating

> 目标：所有 target-gated 节点都有明示，stable 项目不静默写出 testing 字段。

| Atomic | 范围 |
| --- | --- |
| **5.1 Linux-only Palette badge + Inspector banner + 诊断** | inbound:redirect / inbound:tproxy / dns-server:resolved / service:resolved |
| **5.2 Tailscale 全栈 platform gate** | endpoint:tailscale / dns-server:tailscale / service:derp（含 verify_client_endpoint） |
| **5.3 Build-tag warning** | outbound:tor 自托管 vs embedded、`experimental.v2ray_api` |
| **5.4 Testing-channel 字段门控** | cache_file.store_dns、route 1.14 字段、dns rule 1.14 matchers、anytls 1.12 节点门控、shadowsocks 2022 method、ssh cipher/mac/kex_algorithm、hysteria2 realm、hysteria2 bbr_profile、dns-server-tailscale accept_search_domain 等 — channel === 'stable' 时隐藏 / channel === 'testing' 时显示 banner |
| **5.5 Deprecation banner / status** | block outbound、Hysteria v1（inbound + outbound）、legacy fakeip（top-level dns.fakeip）、clash_api store_*、override_address / override_port、domain_strategy → domain_resolver migration、cache_file.store_rdrc → store_dns |
| **5.6 Channel selector 行为** | TopBar 切换 channel 时刷新 Palette 状态 + Inspector banner + 诊断 |

### Milestone 6 — Diagnostics + Fixtures + E2E

> 目标：每个节点至少 1 条诊断 + 1 条 fixture + 1 条 E2E 链路。

| Atomic | 范围 |
| --- | --- |
| **6.1 Required diagnostics** | server / server_port / TLS-required / users[] non-empty / managed-mode 一致性 / Selector default 在 candidates 内 / SSM API servers 非空 / DERP TLS / DERP config_path / NTP server / rule-set url-or-path 等 |
| **6.2 Tag reference diagnostics** | 所有 tag-ref 字段验证目标存在 + 类型正确（outbound vs dns-server vs endpoint vs service vs inbound vs rule-set）+ rename 时回写 + delete 时清理 |
| **6.3 Per-family fixture round-trip** | `fixtures/sing-box/` 新增每族最小 fixture + `tests/round-trip` 加用例：import → domain state → export → 字节级相等 |
| **6.4 Per-family E2E smoke** | `e2e/` 新增 9 条 smoke（每族 1 条）：Palette ADD → Canvas 节点出现 → Inspector 主字段可填 → JSON Preview 出现新字段 → Export 含字段 |
| **6.5 Sing-box check 验证** | `sing-box-stable check` 通过所有 stable fixture；`sing-box-testing check` 通过所有 testing fixture |
| **6.6 状态升级 + index 同步** | 每节点完成后切 `docs/ui-reviews/<node>.md` + `docs/claude/<node>.md` 顶部状态注释到 `implemented`；`docs/index-ui-reviews.md` 的 Coverage / Status 行同步；`docs/claude/index-ui-reviews.md` 的总计同步 |

## Review Plan

Self-review focus（每个 atomic 前后必查）:

- 是否仅改 atomic 声明的文件，未做无关 cleanup。
- 是否破坏既有 fixture round-trip。
- 是否在 stable 项目里偷偷写 testing 字段。
- 是否给 React Flow 节点 / 边添加了 source-of-truth 行为（违规）。

Source-of-truth 检查（每个 atomic 必读一遍）:

- AGENTS.md 非协商条款。
- `docs/sing-box-config-doc-inventory.md` 字段映射。
- 对应的 `docs/ui-reviews/<node>.md` + `docs/claude/<node>.md`。
- 必要时复读 `.tmp/sing-box-docs/{stable,testing}/` 对应 md。

Diff scope checks:

- 每 atomic ≤ 400 logical lines；超出需拆分。
- 不混 schema 与 canvas 改动；不混 stable / testing；不混 refactor 与 feature。

Design / UX checks（凡触及 UI）:

- Palette label 词汇库：ADD / SETUP / OPEN / TABLE（不出现内部 kind）。
- Canvas port 必须对应官方 tag 引用字段；不允许 graph-only 隐藏引用。
- Status pill 区分语义校验和 `sing-box check` 校验。
- shared fields 内嵌在父 Inspector，不创造 fake 独立节点。

Frontend skill gate（强制）:

- `vercel-react-best-practices` skill 在同一会话内 load 并应用。
- 重点检查：bundle 体积（Inspector.tsx 已 1902 行，新增分支必须 lazy / 拆分）、rerender scope（避免广订阅 useProjectStore 整体）、derived state cost（memoize tag list / candidate filter）、async waterfalls（无；canvas 不应触发网络）、避免不必要的全局订阅。

## E2E Plan

User path（按节点族分 9 路）:

1. settings：打开 app → Palette → 单击 Log Settings → Inspector 编辑 → JSON Preview 出现 `log` 块 → Export 验证。
2. hub：Palette → Route Hub → Inspector 设置 `final` → 在 Route Rules Table 加 1 行 → Export 验证 rules 顺序。
3. rule：与 hub 联动。
4. inbound：以 mixed 为代表，扩展到 socks / shadowsocks / vless / tun。
5. outbound：以 selector 为代表，含 candidate multiselect / default。
6. dns-server：以 https / tcp / tailscale 为代表，含 detour / endpoint 引用。
7. endpoint：wireguard peers 结构化编辑 + 引用 dns-server / service。
8. service：ssm-api servers 多路径 + DERP TLS required。
9. rule-set：local 文件 + remote URL + inline rules 结构化。

Tooling:

- Playwright（`playwright.config.ts` 已就绪）；
- 现有 `e2e/editor.spec.ts` / `external-fixtures.spec.ts` 为起点；
- 配合 `sing-box-stable check` / `sing-box-testing check` 验证 export。

Expected evidence:

- Playwright trace + 录屏作为 PR 附件；
- `pnpm test` 全绿；
- `pnpm e2e` 全绿；
- `sing-box-* check` 退出码 0。

Fallback if full E2E is not possible（按 stable-first 主 goal 的 fallback 策略）:

- 至少 round-trip unit + diagnostic unit 通过；
- 明确在 PR 描述里写"未执行 E2E 因 X"，并在该节点的 review 文档底部加 Notes。

## Acceptance Criteria

Observable behavior:

- 用户从 Library 单击任一节点，Inspector 立即可编辑所有官方 writable 字段，不再需要展开 Advanced 才找到 required 字段。
- 任何 tag 引用字段都是 select / multiselect，不存在 raw text 输入 tag 的路径。
- 任何 array / object 字段至少可见可编辑（结构化 repeater 或 JsonField fallback）。
- 删除节点会清理所有引用它的 tag；rename 节点会更新所有引用。
- channel 切换 stable ↔ testing 时 Palette 项 / Inspector 字段 / 诊断同步刷新。
- platform-only 节点在不匹配平台 / target 上明确说明，不静默写入。

Tests / checks:

- `pnpm test` 通过（domain command / serialization round-trip / diagnostics 单测）。
- `pnpm e2e` 通过（9 条 per-family smoke）。
- `sing-box-stable check` 在所有 stable fixture 上通过。
- `sing-box-testing check` 在所有 testing fixture 上通过。
- TypeScript `pnpm tsc --noEmit` 无错。
- `vercel-react-best-practices` 自审完成（每个 atomic）。

Docs updates:

- `docs/ui-reviews/*.md`：顶部 Status 注释升级到 `implemented`；Priority Findings 部分加完成日期。
- `docs/claude/*.md`：同上；Implementation Tasks 小节标 ✅ 或链 PR。
- `docs/index-ui-reviews.md` + `docs/claude/index-ui-reviews.md`：Coverage 行更新到 `implemented: N / 66`。
- 必要时更新 `docs/sing-box-config-doc-inventory.md` 字段映射（如发现新字段未登记）。

## Validation Matrix

| Case | Check |
| --- | --- |
| stable config fixture | `sing-box-stable check` 退出 0 |
| testing config fixture | `sing-box-testing check` 退出 0 |
| domain command round-trip | `pnpm test`（commands / serialization）通过 |
| Inspector → JSON 写回 | `pnpm test`（diagnostics + writeback unit）通过 |
| Library → Canvas → Inspector → Export | `pnpm e2e` per-family smoke 全绿 |
| TS compile | `pnpm tsc --noEmit` 无错 |
| React perf | `vercel-react-best-practices` 自审：bundle / rerender / derived state / 全局订阅 |
| Stable / testing channel 切换 | E2E 内含 channel 切换断言 |
| Tag rename / delete | `pnpm test`（commands.renameTag / deleteTag）覆盖每族引用字段 |
| 平台 / build-tag gate | diagnostics 单测 + Palette 视觉测 |

## Done Definition

- Implementation complete：M1–M6 所有 atomic 合入 main；
- Review complete：每个 atomic 都过 self-review + frontend skill gate；
- E2E / smoke complete：9 条 per-family Playwright smoke + 全套 fixture round-trip + `sing-box-* check` 全绿；
- Docs updated：132 篇 review 标 `implemented`；两个 index 同步；本 goal 文档底部 Notes And Deviations 记录所有偏离；
- Signed commit pushed：所有 atomic 签名 commit，已 push 到 origin/main 且 GitHub Verified；
- 主 release goal（[stable-first-sbc-visual-editor-release.md](stable-first-sbc-visual-editor-release.md)）"Inspector forms for the release-critical stable path"和"Templates for common stable client flows"两项可勾掉。

## Notes And Deviations

- Date: 2026-05-27
- Decision: 把所有 66 节点的 UI 缺口集中到一个 goal 文档下，按 6 个 milestone 分批 atomic 推进，而不是为每节点开独立 goal。
- Reason: 两套 review（codex 概念层 + claude 实施层）已经把每节点的"应做什么 / 在哪改"清单化；剩下 30+ 个 P0 是同一类共享缺陷的多个实例（dialSharedFields / listenSharedFields / tlsSharedFields / AdvancedScalarFields）。共享改动单次消除多个 P0，比每节点单独修更小、更可回滚。
- Risk acknowledged: Milestone 4 的 17+18+12+2+6+3+4 = 62 个节点专属 atomic 可能体量过大，必要时按需拆为子 goal（如 `editable-node-ui-deep-pass-inbound.md`），但起点保持在本文档以便横向跨节点对照。

---

- Date: 2026-05-27（基线状态确认）
- Note: 短暂混淆已澄清 —— 实施启动前一度在工作树看不到 `src/domain/sharedFieldRegistry.ts`（以为该文件不存在并准备从零创建），随后用户确认该文件本来就存在、仅因前一次同步未推送回来；现已恢复。两套 review（`docs/ui-reviews/*.md` + `docs/claude/*.md`）的代码符号引用全部可信。
- Confirmed baseline at implementation start：
  - `src/domain/sharedFieldRegistry.ts` 存在，211 行，导出 `SharedFieldGroupId`、`SHARED_DOC_PLACEMENTS`、`sharedGroupsForEntity()`、`sharedDocPlacementFor()`。已有的组：`listen / dial / tls / http-client / http2 / quic / certificate-provider / dns01-challenge / pre-match / multiplex / v2ray-transport / udp-over-tcp / tcp-brutal / wifi-state / neighbor`。
  - `sharedGroupsForEntity()` 已经会根据 inbound/outbound/dns-server/endpoint/service/route/route-rule/dns-rule/settings.ntp 的 type 返回对应的 group id 列表 —— 这是已存在的注册表骨架。
  - `src/components/Inspector.tsx` 实际 1902 行；`src/domain/commands.ts` 1201 行；`src/domain/diagnostics.ts` 337 行；`src/components/Palette.tsx` 439 行；`src/components/SbcNode.tsx` 554 行。
  - `src/domain/types.ts` 148 行：`EntityRef` 已含 `endpoint` / `service` 两 kind；`EndpointConfig` / `ServiceConfig` 已声明。
  - `pnpm test` 基线：**288 tests in 6 files pass**, 3.81s。测试文件：`tests/app.test.tsx`、`tests/domain.test.ts`、`tests/external-fixtures.test.ts`、`tests/sbc-node-ports.test.ts`、加上另外 2 个（external-fixtures-render 默认排除）。
- Implication：所有 milestone / atomic 仍按本文档 Implementation Plan 推进；M1 是"扩展已存在的 `sharedFieldRegistry` + 字段表 + diagnostics helpers"，不是从零创建。

- Date: 2026-05-27（near-term atomic 选择）
- Decision: 第一批 atomic 选 **三个互相独立、可串行验证流水线**：
  1. **Atomic A**：Inspector 中给 array / object 字段加 `JsonField` 兜底（消除 30+ 节点的 invisibility P0；最小独立改动）。
  2. **Atomic B**：`settings:log` 端到端样板 —— 补 `timestamp` 字段一等公民、新增 diagnostics、新增 fixture round-trip、`docs/ui-reviews/settings-log.md` + `docs/claude/settings-log.md` 状态升级。这条窄切面验证整条流水线（review → diagnostics → fixture → docs sync）。
  3. **Atomic C**：在 M1.1 范围内扩展 dial shared fields —— 把 12+ 个缺失字段补进现有 `dialSharedFields`（待第一次 grep `Inspector.tsx` 确认实际表名）。
- Reason: 先用 Atomic A + B 把流水线打通，再用 Atomic C 验证"单次共享改动消多个 P0"假设，之后才并行展开 M1.2/1.3/1.4 与 M2 tag-reference 改动。
