# Canvas Config-Gen Remediation — Execution Plan

Run with:

```txt
/goal execute the canvas config-gen remediation queue (C0–C17) --spec docs/goals/canvas-config-gen-remediation-execution.md
```

This is the remediation goal for the **2026-05-30 架构评估**
([`docs/canvas-config-gen-assessment-2026-05-30.md`](../canvas-config-gen-assessment-2026-05-30.md)).
该评估(73-agent workflow,47 条发现,44 条经对抗验证)给出的基线判断:**"纯点击/拖拽/简单编辑即可生成完整有效配置"约达成 60-70%**,
整体 `adequate`(趋向 strong)。其中 **serialization-correctness = strong**(config 即唯一事实源、graph→JSON 恒等构造、220 样例字节无损往返),
另外五个维度 = `adequate`,被**字段级覆盖缺口**(V2Ray transport 子字段、inbound TLS ACME、certificate_providers 创建、嵌套逻辑规则)
与**版本门控精度**(`channel === "stable"` 粗门控无法区分 1.12/1.13)拖住。本 goal 的任务是把这些收尾工程逐条做掉:补齐字段级可达性、精确化版本门控、修掉两三个静默缺陷、降低后续改动成本(声明式 schema),
完成后让 reachability 稳步迈入 **≥90%(且任何主流构造零强制 JSON 回退)** 并保持 serialization strong、无维度回退。

地基牢固、骨架可达 —— 这是**收尾工程,不是推倒重来**。

## Process (non-negotiable)

继承自前序 goal(UX language & affordances),逐条不可省略:

- **单一可信源 = `docs/upstream/sing-box/{stable,testing,oldstable}/`** —— 每个原子项**必须引用其对应的 docs/upstream 源文档**,
  并以该文档为字段/枚举/版本判定(version-added / deprecated-in / removed-in / channel)的**唯一依据**。
  下游若与 docs/upstream 冲突,以 docs/upstream 为准;markers 是**忠实转写**(faithful transcription),不是再解读。
- **Canonical config is the source of truth.** store 的 `config: SingBoxConfig` 即逐字 sing-box JSON;React Flow 节点/边 + Inspector + JSON 全部是它的**单向派生投影**。
  任何改动不得让 GUI 数据层与导出 JSON 漂移。
- **One atomic = one outcome,严守 don't-mix。** 每个原子项有一个明确产出与一组 don't-mix 边界(copy vs behavior、infra vs feature、
  domain vs component、stable vs testing-gated、refactor vs feature)。过大的原子项按其 `Slice` 拆成多个**各自独立 green** 的 PR,逐个落地。
- **Test-first.** 先写失败测试再改实现;迁移既有测试到新的正确行为(绝不为了让旧测试通过而保留错误行为)。
- **Land via squash PR,never direct push to `main`.** PR gate + main issue gate 都必须 clean(见 goal-driven-development.md 的 Post-Merge Issue Gate)。
- **Review gate(per-PR best-suited Claude Code expert reviewer,NOT Codex):**
  **每个 PR 派出 Claude Code 最适合该原子项领域的专家 reviewer subagent(s)(用 Agent 工具,按 atomic 的领域选择最匹配的专家:React/perf、domain schema 正确性、version-gating/diagnostics、serialization/round-trip、canvas/React-Flow、architecture/refactor),应用其可执行发现后再合并。** 一次 pass、合并前完成。
- **Frontend gate** (`vercel-react-best-practices`) 对任何 `src/components/**` 或 `src/state/**` diff 强制执行:在同一 work session 内做 bundle size / rerender scope /
  derived-state cost / async-waterfalls / 不必要的全局订阅 检查。
- **Re-verify against HEAD before each atomic.** 开工前先 sync 到 main 并对照 HEAD 复核 file:line anchors(本仓库 `.claude/worktrees/*` 可能 stale);
  `pnpm exec tsc -b` + `pnpm test` + `pnpm build` + `pnpm e2e` 全绿后再开始。
- **Devlog every atomic** —— 在 Running TODO 勾选 + 在 Milestone Notes 追加一条 per-atomic 记录(what changed / tests / expert-review verdict / verification commands)。

## Source Docs

- `AGENTS.md` —— 仓库工作约束。
- [`docs/canvas-config-gen-assessment-2026-05-30.md`](../canvas-config-gen-assessment-2026-05-30.md) —— 本 goal remediates 的评估(G1–G11 findings + 4.2/4.3 minors + P0/P1/P2 路线)。
- [`docs/goal-driven-development.md`](../goal-driven-development.md) —— Goal R&D 模板 / Atomic Rules / Post-Merge Issue Gate / Required Goal Checks。
- [`docs/goals/ux-language-affordances-execution.md`](ux-language-affordances-execution.md) —— 前序 goal,本 doc 的 house-style 来源(Process / Phases & Atomic Queue / Milestone Notes 体例)。
- **`docs/upstream/sing-box/{stable,testing,oldstable}/configuration/**`** —— **唯一可信源**。stable = 1.13、testing = 1.14、oldstable = 1.12。
  每个原子项的 detail block 内逐条引用其 `Source of truth` 路径与 channel。

## Phases & Atomic Queue

执行顺序大致 **P0 → P1 → P2 → P3(re-assessment)**。

- **C0 一般先落地**,因为它把"协议知识手工散落 8-9 文件"收敛为一张声明式表,**降低后续每一项的实施成本与漂移面**;C14-S10(数据驱动标量渲染)显式依赖它。
- **C1 / C2 / C3 各自独立可发**,不必等 C0(它们是最高杠杆的纯 GUI 可达性缺口)。
- P1(C4–C10)是**正确性收敛**(版本门控精度 + 两三个静默误报),彼此基本独立。
- P2(C11–C16)是**结构与图保真度**(可写边、递归规则、注册表驱动、Inspector 拆分、CI 二进制复检、项目 save/load),多数会拆成 sub-slices。

---

### Phase P0 — Foundation + highest-leverage GUI gaps (C0–C3)

地基重构(C0,降本)与三个最痛的"纯 GUI 不可达"缺口(C1 transport 子字段、C2 certificate_providers 创建、C3 inbound TLS ACME)。

- [ ] C0-schema-registry — 单一声明式 per-type schema 表成为新增协议/字段的唯一编辑点;protocols.ts CREATABLE / commands.ts 工厂默认 / sharedFieldRegistry 组成员 / 基础必填诊断全部从中派生,每个 slice 零行为变更。Source: `docs/upstream/sing-box/{stable,testing}/configuration/{inbound,outbound,index}/index.md`. Touch: `src/domain/schemaRegistry.ts` (NEW).
- [ ] C1-transport-subfields — V2Ray transport 全部文档化子字段(headers map / http.method / ws.max_early_data / ws.early_data_header_name / grpc.permit_without_stream)在 Inspector 的 V2Ray Transport 卡内可编辑,不再静默不可达。Source: `docs/upstream/sing-box/stable/configuration/shared/v2ray-transport.md`. Touch: `src/components/Inspector.tsx`.
- [ ] C2-cert-provider-create — testing 通道下四个 Certificate Providers palette 项创建 type-correct 的 `certificate_providers[]` 并可在 Inspector 编辑;stable 仍 gated 且提示语不再误导。Source: `docs/upstream/sing-box/testing/configuration/shared/certificate-provider/index.md`. Touch: `src/domain/commands.ts`.
- [ ] C3-tls-acme — 服务端 TLS 卡暴露结构化 ACME 编辑器 + dns01_challenge 子编辑器,弃用但仍有效的 `tls.acme` 完全可编辑。Source: `docs/upstream/sing-box/stable/configuration/shared/tls.md`. Touch: `src/components/Inspector.tsx`.

#### C0-schema-registry (G6 — architecture) — P0
- **Outcome:** A single declarative per-type schema table (factory defaults, required fields, enums, shared-group membership, version-added/deprecated-in/removed-in, channel) becomes the one place to edit when adding a protocol/field; protocols.ts CREATABLE lists, commands.ts factory defaults, sharedFieldRegistry group membership, and baseline required-field diagnostics are all derived from it — zero behavior change per slice.
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/inbound/index.md` (stable) — inbound `type` enum = direct, mixed, socks, http, shadowsocks, vmess, trojan, naive, hysteria, shadowtls, tuic, hysteria2, vless, anytls, tun, redirect, tproxy; required `type` + `tag`; `cloudflared` is NOT in stable.
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/inbound/index.md` (testing) — adds `cloudflared` → version-added 1.14 / testing-only (table channel column = testing; matches diagnostics `inbound-cloudflared-testing-only` gated by `!atLeast(version,"1.14")`).
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/inbound/cloudflared.md` (testing) — required `token`; optional `edge_ip_version` (int), `datagram_version` (string); no listen/port → factory `{ type, tag, token: "" }`, requiredFields=[token].
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/outbound/index.md` (stable) — outbound `type` enum = direct, block, socks, http, shadowsocks, vmess, trojan, wireguard, hysteria, vless, shadowtls, tuic, hysteria2, anytls, tor, ssh, dns, selector, urltest, naive; `wireguard` (deprecated 1.11 → endpoints[]) and `dns` (deprecated ≤1.10 → hijack-dns) carried with deprecated-in markers and creatable:false; testing enum identical.
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/index.md` (testing) — top-level sections incl. `http_clients` + `certificate_providers` arrays (1.14) → confirms the channel split already in sharedFieldRegistry (http-client group gated to channel==="testing").
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/outbound/hysteria2.md` (testing) — field version markers convention: `:material-plus:` = version-added (hop_interval_max/bbr_profile/realm = 1.14), `:material-alert:` = changed, `:material-delete-*:` / `!!! failure "Deprecated in sing-box X"` = deprecated/removed; transcribe these into the table's per-field version columns.
- **Touch:** `src/domain/schemaRegistry.ts` (NEW) — declarative table keyed by kind+type with factory/requiredFields/enums/sharedGroups/channel/version markers + typed selectors.
- **Touch:** `src/domain/protocols.ts:24-43,68-121,130,143,214` — CREATABLE_* + PALETTE maps derived from the table (same export names + `as const` tuple shape).
- **Touch:** `src/domain/commands.ts:101-277,287-455,515-725` — create{Inbound,Outbound,Service,Endpoint,DnsServer,RuleSet} look up row.factory and clone (byte-identical defaults).
- **Touch:** `src/domain/sharedFieldRegistry.ts:144-160,169-230` — per-type Sets + sharedGroupsForEntity derived from the table's sharedGroups column (channel gating preserved).
- **Touch:** `src/domain/diagnostics.ts:598-693,1093-1114` — proxy/tls/required type Sets + baseline required-field checks (incl. cloudflared token) read required-ness from the table; all codes/messages unchanged.
- **Change:** Add schemaRegistry.ts seeded verbatim from the four+ creators, protocols arrays, and sharedFieldRegistry Sets (pure transcription). Then per slice flip each literal source to a derived selector; each slice is refactor-only with a snapshot test proving byte-identical output.
- **Acceptance:** typecheck + full `pnpm test` green at every slice; CREATABLE_* deep-equal frozen snapshots; create*() deep-equal golden objects for all types; sharedGroupsForEntity order-identical per (kind,type,channel); validateConfig emits identical codes/levels/paths; running app shows no palette/scaffold/inspector/diagnostics diff; a throwaway fake row flows through palette+factory+groups+diagnostics via table edit only.
- **Tests (test-first):** `tests/schema-registry.test.ts` — CREATABLE_* == rows.filter(creatable).map(type) (order-preserving); cloudflared channel=testing+versionAdded=1.14+creatable; wireguard/dns creatable=false+deprecatedIn set. `tests/schema-registry-factory.test.ts` — create*() deep-equals frozen golden per type (tun address[], tuic auth_timeout/heartbeat, anytls idle_session_*, shadowtls handshake, urltest url/interval). `tests/schema-registry-shared-groups.test.ts` — sharedGroupsForEntity golden snapshot per (kind,type,channel) incl. channel-gated http-client/neighbor. Existing `tests/config-doc-capability.test.ts`, `tests/required-fields-diagnostics.test.ts`, `tests/diagnostic-targets.test.ts` stay green unchanged.
- **Reviewer:** architecture/refactor (primary); domain schema-correctness reviewer spot-checks the cloudflared-testing / wireguard-dns-deprecated channel markers.
- **Don't mix:** pure refactor — no behavior change, no new diagnostics/protocols/fields, no copy/UX/React/canvas changes; do not "fix" defaults you notice; markers are a faithful transcription; each slice is its own PR, green before the next.
- **Slice:** S1 seed schemaRegistry.ts + matches-today test (no consumer changes). S2 derive protocols.ts CREATABLE_*/PALETTE. S3 derive commands.ts factories. S4 derive sharedFieldRegistry membership + sharedGroupsForEntity. S5 derive diagnostics.ts proxy/tls/required Sets + baseline required checks. Land S1 first; never combine slices.

#### C1-transport-subfields (G1) — P0
- **Outcome:** Every documented V2Ray transport sub-field (http/ws/httpupgrade `headers` map, `http.method`, `ws.max_early_data`, `ws.early_data_header_name`, `grpc.permit_without_stream`) is editable from the inspector's V2Ray Transport card instead of being silently unreachable.
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/shared/v2ray-transport.md` (stable) — transport keyed by `type` ∈ {http, ws, quic, grpc, httpupgrade}. HTTP: `host` (string[]), `path` (string), `method` (string, verified if non-empty), `headers` (string-map object), `idle_timeout` (duration; **prose L91 says default zero**, though the JSON example L39 shows `"15s"` — transcribe the prose default), `ping_timeout` (duration, default 15s). WebSocket: `path`, `headers` (map), `max_early_data` (int, default 0, enabled if non-zero), `early_data_header_name` (string; `Sec-WebSocket-Protocol` for Xray compat). QUIC: no sub-fields. gRPC: `service_name`, `idle_timeout` (15s), `ping_timeout` (15s), `permit_without_stream` (bool, default false). HTTPUpgrade: `host` (single string), `path`, `headers` (map). No version/deprecation markers.
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/shared/v2ray-transport.md` (testing) — byte-for-byte identical to stable (and to oldstable 1.12, verified by diff). Schema is channel-invariant across 1.12/1.13/1.14, so NO channel-conditional logic is needed.
- **Touch:** `src/components/Inspector.tsx:1776-1785` — extend the `v2ray-transport` group to add `method`, `headers` (new keyvalue control), `max_early_data`, `early_data_header_name`, `permit_without_stream`.
- **Touch:** `src/components/Inspector.tsx:1508` — add a `keyvalue` SharedFieldKind + a render branch in SharedFieldControl (1832-1900) reusing the existing Name/Value headers-editor UI (~L5440), writing `undefined` when the map is emptied.
- **Touch:** `src/components/Inspector.tsx:1937-1939` — the `gatedBy` filter is boolean-truthiness only and can't express `transport.type === "ws"`; either render all sub-fields unconditionally (sing-box ignores unset keys) or extend gating to value-equality. Pick one.
- **Touch:** `src/components/Inspector.tsx:124` and `:168` — keep `"transport"` in inbound/outbound handledFields once the card is complete (these are also the one-line JSON-fallback escape hatch for the interim slice; keep both in sync).
- **Change:** Build a `keyvalue` SharedFieldKind for `transport.headers` and add the four per-variant scalar fields to the existing shared group; no channel branching. Alternatively (interim slice) drop `"transport"` from handledFields at L124/L168 so it falls through to the JSON editor — restores reachability in one line.
- **Acceptance:** Setting transport type http/ws/grpc/httpupgrade reveals exactly that variant's documented fields (quic reveals only Type); `headers` round-trips as an object and prunes to `undefined` when emptied; `max_early_data` round-trips as a number and `permit_without_stream` as a boolean; existing suite (incl. tests/shared-field-role.test.tsx) stays green.
- **Tests (test-first):** `tests/v2ray-transport-subfields.test.tsx` — per-type label visibility (Method for http; Max Early Data + Early Data Header Name for ws; Permit Without Stream checkbox for grpc; none for quic); store assertions that `transport.method` is a string, `.max_early_data` is a Number, `.permit_without_stream` is a boolean, `.headers` is `{ key: value }`, and the last-header-removed case leaves `.headers === undefined`; one inbound parity case. Confirm/extend `tests/config-doc-capability.test.ts` to mark the five fields covered.
- **Reviewer:** domain schema-correctness (V2Ray transport field names/types/defaults + map round-trip), secondary React/perf for the keyvalue control.
- **Don't mix:** feature/reachability on the v2ray-transport group only — not the protocol-specific headers-editor dedup, not TLS/multiplex/quic groups, not version-gating; and ship ONE of {full editor, JSON-fallback slice}, not both.
- **Slice:** Interim = delete `"transport"` from handledFields (L124/L168) → JSON fallback (one line + a fallback-render test). Follow-up = add keyvalue kind + typed per-variant controls and re-add transport to handledFields.

#### C2-cert-provider-create (G2) — P0
- **Outcome:** On the testing target the four Certificate Providers palette items create a tagged, type-correct `certificate_providers[]` entry that is selectable and editable in the Inspector with per-type required fields; on stable the items stay gated and the tooltip no longer falsely promises a create path.
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/shared/certificate-provider/index.md` (testing) — testing-only (`!!! question "Since sing-box 1.14.0"`, `icon: material/new-box`; NO stable/oldstable dir). Each entry: `type` enum `acme|tailscale|cloudflare-origin-ca` + `tag` string.
  - **Source of truth:** `docs/upstream/sing-box/testing/configuration/shared/certificate-provider/acme.md` (testing) — `type=acme` (needs `with_acme` build tag). ==Required== `domain` string[]. Optional `email`, `provider` (`letsencrypt` default|`zerossl`|`https://...`), `data_directory`, `disable_http_challenge`/`disable_tls_alpn_challenge` bool, `alternative_http_port`/`alternative_tls_port` int, `external_account{key_id,mac_key}`, `dns01_challenge` object (sub-doc dir absent in vendored tree), and 1.14-added (`:material-plus:`) `account_key`, `key_type` (`ed25519|p256|p384|rsa2048|rsa4096`), `profile`, `http_client`.
  - **Source of truth:** `docs/upstream/sing-box/testing/configuration/shared/certificate-provider/cloudflare-origin-ca.md` (testing) — `type=cloudflare-origin-ca`. ==Required== `domain` string[]. Optional `api_token` (conflicts `origin_ca_key`), `origin_ca_key` (conflicts `api_token`), `request_type` (`origin-rsa` default|`origin-ecc`), `requested_validity` int (7/30/90/365/730/1095/5475; default 5475), `data_directory`, `http_client`.
  - **Source of truth:** `docs/upstream/sing-box/testing/configuration/shared/certificate-provider/tailscale.md` (testing) — `type=tailscale`. ==Required== `endpoint` string (tag of a Tailscale endpoint to reuse). No `domain`.
- **Touch:** `src/domain/commands.ts:718` — add `createCertificateProvider(type,tag)` returning per-type required-field scaffolds (acme/cloudflare-origin-ca: `{type,tag,domain:[]}`; tailscale: `{type:'tailscale',tag,endpoint:''}`) + `addCertificateProvider(config,type,preferredTag?)` + `preferredCertificateProviderTag`.
- **Touch:** `src/state/useProjectStore.ts:972-1066` (createFromPalette) — add a testing-gated branch beside the http-client branch (1037-1041) mapping the four `certificate-provider*` kinds to a type, calling addCertificateProvider, and setting `selectedId=certificate-provider:<tag>`.
- **Touch:** `src/components/Palette.tsx:323-334` (itemStatus) — flip the four `certificate-provider*` kinds gated→`setup` on testing only (mirror cloudflared@326 / http-client@328); gated on stable. This auto-corrects the misleading `statusTitle` gated tooltip at `Palette.tsx:341`.
- **Touch:** `src/components/Palette.tsx:173-176` / `:81` (paletteNodeRef) — the bare `Provider` kind currently maps to the non-schema type `"certificate-provider"`; default it to `acme` or drop the item so no invalid type is ever emitted.
- **Touch:** `src/components/Palette.tsx:284-287` (DRIFT — not in atomic anchors) — a duplicate `shared-*` provider set exists in the Shared group with no create mapping; keep it reference-only (do not add a second create path).
- **Touch:** `src/components/Inspector.tsx:~2790+` (entityType field dispatch) — add per-type editor branches: acme (domain[]/email/provider/key_type/profile/account_key/EAB), cloudflare-origin-ca (domain[]/api_token/origin_ca_key/request_type/requested_validity), tailscale (endpoint picker, reuse dns-server tailscale picker @4509/4598).
- **Change:** Test-first: add create/add commands with type-correct scaffolds; wire a testing-only createFromPalette branch + itemStatus flip; fix the bare-Provider type; leave the Shared duplicates reference-only; add the per-type Inspector editor. Optional copy-only pre-slice: fix the `statusTitle` gated tooltip so it stops claiming "switch to testing to create" while no command exists.
- **Acceptance:** On testing the four items are creatable and each appends a correctly-typed `certificate_providers[]` entry and selects it; on stable they stay gated and non-activatable; no item produces `type:"certificate-provider"`; selecting a created node opens an Inspector with the type's required control; JSON round-trips; existing `stable-version-gated-certificate-providers` and `missing-http-client` diagnostics still fire.
- **Tests (test-first):** `tests/certificate-provider-create.test.ts` — createCertificateProvider scaffold per type incl. the ==Required== field, never `type==='certificate-provider'`, addCertificateProvider dedupes tags. `tests/certificate-provider-create.test.tsx` (mirror `tests/inbound-cloudflared.test.tsx`) — store: testing createFromPalette appends one typed entry + selects it; palette shows "Add ACME" on testing and gated "Needs 1.14" on stable; Inspector shows the required control; diagnostics regression for the two existing codes.
- **Reviewer:** domain schema-correctness (sing-box certificate_providers contract + version-gating; secondary serialization/round-trip).
- **Don't mix:** copy-fix (tooltip) vs behavior (create command); create+scaffold vs the per-type editor (separable PRs); keep stable gating intact (1.14-only docs); don't restructure the duplicate Shared-group items beyond keeping them reference-only.
- **Slice:** A0 (optional) copy/bare-type fix; A — commands + createFromPalette branch + itemStatus flip (P0 core, with tests); B — Inspector per-type structured editor (fast-follow).

#### C3-tls-acme (G4) — P0
- **Outcome:** Server-role TLS cards expose a structured ACME editor (domain / email / provider / data_directory + the rest of the inline acme block) and a dns01_challenge sub-editor, so the deprecated-but-still-valid `tls.acme` object becomes fully editable instead of being swallowed by the `handledFields` exclusion and shown only via a banner.
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/shared/tls.md` (stable/1.13) — `acme` is a valid **server-only** inbound object (appears only in the Inbound skeleton), NOT deprecated on 1.13. ACME Fields: `domain` (list; ACME disabled if empty), `data_directory` (string), `default_server_name` (string), `email` (string), `provider` (`letsencrypt` default | `zerossl` | `https://...` custom), `disable_http_challenge`/`disable_tls_alpn_challenge` (bool), `alternative_http_port`/`alternative_tls_port` (int), `external_account.{key_id,mac_key}` (string), `dns01_challenge` (object — "if configured, other challenge methods will be disabled").
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/shared/tls.md` (testing/1.14) — header `:material-delete-clock: acme`; ACME Fields carry `!!! failure "Deprecated in sing-box 1.14.0" — Inline ACME options are deprecated in sing-box 1.14.0 and will be removed in sing-box 1.16.0`, migrate to `certificate_provider`. Same sub-field shape; replacement `certificate_provider` is server-only, Since 1.14.0.
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/shared/dns01_challenge.md` (stable/1.13) — Structure = `provider` (string) + provider fields. Documented providers: `alidns` (access_key_id, access_key_secret, region_id, `security_token` Since 1.13.0), `cloudflare` (api_token, `zone_token` Since 1.13.0), `acmedns` (Since 1.13.0; username, password, subdomain, server_url). No ttl/propagation_*/resolvers/override_domain on stable.
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/shared/dns01_challenge.md` (testing/1.14) — adds top-level `ttl` (duration), `propagation_delay` (duration), `propagation_timeout` (duration; `-1` disables), `resolvers` (list), `override_domain` (string) — all Since 1.14.0; same three providers.
- **Touch:** `src/domain/sharedFieldRegistry.ts:177-184` — surface the acme/dns01 fields for inbound (and server-cert service) TLS owners only; keep it server-role-only (acme is Inbound-only in both channels). `dns01-challenge` group id/title/placement already exist (registry:16-17,95-99) but are unwired.
- **Touch:** `src/components/Inspector.tsx:1708-1721` — extend the `serverOnly` `SharedFieldDefinition[]` (or add a dedicated `dns01-challenge` case at ~1671-1822, currently falling through to `return []` at 1822) with the ACME sub-fields via nested `["tls","acme",…]` paths + a presence `gatedBy`; add the dns01 sub-editor under `["tls","acme","dns01_challenge",…]` with the 1.14-only fields channel-gated to `testing`.
- **Touch:** `src/components/Inspector.tsx:122` — leave `tls` in `inboundHandledFields` (reject the interim handledFields-exemption shortcut); the structured editor now owns `tls.acme` so it must not also render in the Advanced JSON fallback.
- **Touch:** `src/components/Inspector.tsx:5618-5629` — keep the `tls.acme` deprecation `PlatformBanner` (it IS deprecated in 1.14) but tighten copy so banner = "migrate to certificate_provider" and the editor = the live fields.
- **Change:** Add the ACME field definitions (list/text/select/number/bool) and the dns01_challenge sub-editor as structured shared fields on the server role; gate dns01 provider-specific fields by selected provider and the 1.14 dns01 fields by channel; preserve a custom `https://…` provider string (use the free-text / object-fallback affordance, not a closed enum that drops unknown values); wire `sharedGroupsForEntity` to emit the surface for server-role TLS owners; keep the banner.
- **Acceptance:** Inbound TLS-capable node shows Domain/Email/Provider/Data Directory + a DNS01 Challenge section; every field round-trips export→import unchanged (incl. a custom `https://` provider and nested external_account/dns01_challenge); stable hides the 1.14 dns01 fields, testing shows them; `tls.acme` no longer appears in Advanced JSON; outbound/client TLS shows no ACME; provider-specific dns01 fields gate on the chosen provider.
- **Tests (test-first):** `tests/shared-field-role.test.tsx` — inbound shows ACME + DNS01 labels, outbound does not; round-trip a config with `tls.acme` incl. custom provider + `dns01_challenge.provider=cloudflare` and assert deep-equal after export; channel gate: stable hides `TTL`/`Propagation Delay`/`Override Domain`, testing shows them; assert `tls.acme` is absent from the Advanced-fallback JSON editor.
- **Reviewer:** domain schema-correctness (sing-box TLS/ACME/dns01 shape + stable-vs-testing gating); secondary serialization/round-trip.
- **Don't mix:** Inline `tls.acme` + `dns01_challenge` editor ONLY — no C2 certificate_providers / `tls.certificate_provider` editor (referenced only in banner copy), no outbound/client ACME surface, no `handledFields` exemption, and not the 1.14 certificate-provider acme.md extras (account_key/key_type/profile/http_client).
- **Slice:** If too large for one PR: (a) ACME scalar/list fields + external_account on the server role with banner co-existence; (b) the `dns01_challenge` sub-editor incl. provider-gated + channel-gated 1.14 fields.

---

### Phase P1 — Correctness convergence (C4–C10, C17)

版本门控精度(C4 cloudflared 死点击、C5 1.14-removed legacy DNS 升 error、C6 naive 1.12 门控、C7 1.12-vs-1.13 精确门控)+ 序列化门控统一(C8)+ 两个静默误报修复(C9 跨命名空间 dup-tag、C10 hysteria server_ports)+ 静默不可达不变量守卫(C17,落实"主流零回退"硬判据)。彼此基本独立,可并行排队。

- [ ] C4-cloudflared-create — testing 通道点击 "Add Cloudflared" 真正创建 cloudflared inbound(seed `token:""`)并选中,不再死点击。Source: `docs/upstream/sing-box/testing/configuration/inbound/cloudflared.md`. Touch: `src/state/useProjectStore.ts`.
- [ ] C5-version-gate-legacy-dns — 1.14(testing)目标下 legacy schema-prefixed DNS server address 与顶层 `dns.fakeip` 升为 error(二进制会拒绝);1.12/1.13 仍 warning。Source: `docs/upstream/sing-box/testing/configuration/dns/{server/legacy,fakeip}.md`. Touch: `src/domain/diagnostics.ts`.
- [ ] C6-version-gate-naive — naive outbound 在 1.12 目标产生 blocking error(仿 ccm/ocm `!atLeast(version,"1.13")`),使 summarizeDiagnostics 不再误判 1.12 可导出。Source: `docs/upstream/sing-box/stable/configuration/outbound/naive.md`. Touch: `src/domain/diagnostics.ts`.
- [ ] C7-version-gate-channel-to-version — 1.12 stable 目标对真正 1.13-added 字段(kTLS / client_authentication / curve_preferences / naive / dns prefer_go / route bypass / interface_address 族)发 "needs 1.13" warning;1.13 + 1.14 干净。Source: `docs/upstream/sing-box/stable/configuration/shared/tls.md`. Touch: `src/domain/diagnostics.ts` + `src/domain/minVersions.ts` (NEW).
- [ ] C8-export-gate-unify — 抽出 error 级导出确认门控为共享 helper,桌面(TopBar)与移动(MobileMenuSheet)两条路径都走它,无效配置无法从任一入口静默下载。Source: `docs/upstream/sing-box/stable/configuration/index.md`. Touch: `src/domain/serialization.ts` (new export) or `src/components/exportConfig.ts`.
- [ ] C9-dup-tag-namespace — 跨引用命名空间复用标签(inbound 与 outbound 同名 "proxy")不再误报 duplicate-tag、不再触发导出软门控;只标真正同命名空间冲突。Source: `docs/upstream/sing-box/stable/configuration/endpoint/index.md`. Touch: `src/domain/indexes.ts`.
- [ ] C10-hysteria-server-ports — hysteria/hysteria2 用非空 `server_ports`(端口跳跃,无标量 server_port)不再误报 outbound-invalid-server-port;两者皆缺仍报错。Source: `docs/upstream/sing-box/stable/configuration/outbound/hysteria2.md`. Touch: `src/domain/diagnostics.ts`.
- [ ] C17-no-silent-unreachable-guard — CI 不变量:inbound/outbound `handledFields` 里的每个键,要么被结构控件完整渲染、要么不在 handledFields(从而落 Advanced JSON 回退);杜绝 C1/C3 那类"静默不可达"回归,落实"主流零回退"。Source: `docs/upstream/sing-box/stable/configuration/shared/{v2ray-transport,tls,multiplex,dial}.md`. Touch: `tests/no-silent-unreachable-fields.test.tsx` (NEW).

#### C4-cloudflared-create (G3) — P1
- **Outcome:** Clicking "Add Cloudflared" in the Palette on the testing target actually creates a cloudflared inbound (seeded `token:""`) and selects it, instead of being a dead click.
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/inbound/cloudflared.md` (testing) — `cloudflared` inbound exists ONLY on testing/1.14 (`icon: material/new-box`, "Since sing-box 1.14.0"; no stable/ or oldstable/ cloudflared.md). `type="cloudflared"`; `token` is ==Required== (base64 tunnel token); all other fields optional (`protocol` enum quic|http2, `post_quantum` bool, `edge_ip_version` 0|4|6, `datagram_version` v2|v3, `ha_connections`, `grace_period`, `region`, `control_dialer`/`tunnel_dialer` Dial Fields). No listen/listen_port. Fix must seed only `token` — already done by createInbound.
- **Touch:** `src/state/useProjectStore.ts:998` — replace the type-exclusion guard `if (inboundType && inboundType !== "cloudflared")` with a channel gate `if (inboundType && (inboundType !== "cloudflared" || state.channel === "testing"))`, mirroring the hysteria-realm gate at :1031 and the http-client gate at :1037.
- **Touch:** `src/components/Palette.tsx:325-326` — no change (itemStatus already gates inbound-cloudflared to "gated" off-testing / "setup" on testing); the store gate must agree with it.
- **Touch:** `src/domain/commands.ts:272-275` — no change (createInbound already returns `{ type, tag, token: "" }`); confirms only token is seeded.
- **Change:** One-line gate swap in createFromPalette so cloudflared is created on testing only; align with the two existing 1.14-gated palette creators. No diagnostics/Inspector/commands edits.
- **Acceptance:** Testing-target click creates exactly one `{ type:"cloudflared", tag:"cloudflared-in", token:"" }` inbound and sets selectedId `inbound:cloudflared-in`; stable-target click creates nothing (still "Needs 1.14"); Inspector Token control + `inbound-cloudflared-token-missing` diagnostic fire on the new node; no regression to hysteria-realm/http-client creation.
- **Tests (test-first):** `tests/inbound-cloudflared.test.tsx` — (1) extend the testing UI test to `fireEvent.click` the "Add Cloudflared" button and assert a `node-inbound:cloudflared-in` node renders + store has one cloudflared inbound with `token === ""`; (2) store test: setChannel("testing") → createFromPalette("inbound-cloudflared") → one cloudflared inbound + selectedId `inbound:cloudflared-in`; (3) stable-guard test: setChannel("stable") → createFromPalette("inbound-cloudflared") → no inbound added.
- **Reviewer:** version-gating/diagnostics (testing-only 1.14 palette gate alignment), with a canvas/React-Flow eye on the click-through node-creation assertion.
- **Don't mix:** Behavior/gating fix + test only — keep out cloudflared diagnostics, the Inspector token branch, createInbound seeding (all already done), and any optional-field coverage.

#### C5-version-gate-legacy-dns (G9) — P1
- **Outcome:** On the 1.14 (testing) target a legacy schema-prefixed DNS-server `address` and a top-level `dns.fakeip` block are reported as **errors** (the binary rejects them), while on 1.12/1.13 (stable) they remain deprecation **warnings**.
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/dns/server/legacy.md` (stable) — icon `material/delete-clock`; "!!! failure 'Deprecated in sing-box 1.12.0' — Legacy DNS servers ... will be removed in sing-box 1.14.0". Legacy fields `tag, address(==Required==, schema-prefixed tcp://|udp://|tls://|https://|quic://|h3://|rcode://|dhcp:// or bare), address_resolver, address_strategy, strategy, detour, client_subnet`. Still functional on 1.13 → warning correct.
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/dns/server/legacy.md` (testing) — icon `material/note-remove`; "!!! failure 'Removed in sing-box 1.14.0' — ... removed in sing-box 1.14.0". On 1.14 the legacy form is rejected → must be ERROR.
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/dns/fakeip.md` (stable) — icon `material/delete-clock`; "Deprecated in 1.12.0 ... will be removed in 1.14.0". Top-level fields `enabled, inet4_range, inet6_range`. Warning correct on stable.
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/dns/fakeip.md` (testing) — icon `material/note-remove`; "!!! failure 'Removed in sing-box 1.14.0'". On 1.14 the top-level `dns.fakeip` is rejected → must be ERROR (replacement `type=fakeip` server is C7's scope).
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/dns/index.md` (testing) — field table flags `fakeip` with `:material-note-remove:` (removed), distinct from `independent_cache` `:material-delete-clock:` (still deprecated-only). And `docs/upstream/sing-box/testing/configuration/dns/server/index.md` flags the empty/default Legacy type with `:material-note-remove:`, whereas the stable `server/index.md` shows that row WITHOUT the icon.
- **Touch:** `src/domain/diagnostics.ts:498-509` — in the `dns.servers` loop, change the `dns-server-legacy-address-deprecated` level from `"warning"` to `atLeast(version,"1.14") ? "error" : "warning"` and branch the message (1.14: "removed in 1.14.0; sing-box rejects this" / <1.14: keep migrate-to-`type`+`server` wording).
- **Touch:** `src/domain/diagnostics.ts:1209-1221` — in the `dnsTop.fakeip` block, change the `legacy-fakeip-deprecated` level to `atLeast(version,"1.14") ? "error" : "warning"` and branch the message similarly.
- **Touch:** `src/domain/diagnostics.ts:2 / :44-47` — `atLeast` already imported from `./targets`; `version` already flows from `useProjectStore.ts:203` (1.12/1.13/1.14), so no signature/import change needed.
- **Change:** Swap the two hardcoded `"warning"` strings for the `atLeast(version,"1.14")` ternary and make the message text branch on the same condition. Same diagnostic codes, no new codes, no migration logic.
- **Acceptance:** `validateConfig(cfg,"testing")` returns both codes at level `error` for the respective inputs; `validateConfig(cfg,"stable")` and `validateConfig(cfg,"stable","1.12")` keep them at level `warning`; codes unchanged; error messages say "removed in 1.14.0"; `pnpm test` + `tsc` green; existing :1924/:2089 stable assertions still pass.
- **Tests (test-first):** `tests/domain.test.ts` — extend the existing fakeip (~:1924) and legacy-address (~:2089) cases to assert `level === "warning"` under `"stable"`; add testing-target siblings asserting `level === "error"` via `validateConfig(cfg,"testing").find(d=>d.code===...)`; add a `validateConfig(cfg,"stable","1.12")` guard asserting `"warning"`; assert single emission per code and that the testing message contains `"removed in 1.14.0"`.
- **Reviewer:** version-gating/diagnostics (best match: confirms `atLeast(version,"1.14")` semantics and stable/testing severity split).
- **Don't mix:** Severity/message change only — no code renames, no fakeip/legacy migration or auto-fix (that's C7), no serialization or node-card UI changes; keep the schema-prefixed-address check distinct from empty-type legacy-server detection.

#### C6-version-gate-naive (G10) — P1
- **Outcome:** A `naive` outbound emits a blocking ERROR when the target is sing-box 1.12, mirroring the ccm/ocm `!atLeast(version,"1.13")` gate, so a 1.12 config that a 1.12 binary would reject is no longer reported exportable.
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/outbound/naive.md` (stable) — naive outbound, marked `!!! question "Since sing-box 1.13.0"` (`icon: material/new-box`); fields: `server`/`server_port`/`tls` ==Required==, plus username, password, insecure_concurrency, extra_headers, udp_over_tcp, quic, quic_congestion_control (bbr|bbr2|cubic|reno). The `naive` *type* is the 1.13-gated item.
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/outbound/naive.md` (testing) — identical "Since sing-box 1.13.0" marker and field surface in 1.14; valid on 1.13 and 1.14, no removal/deprecation marker → gate is `atLeast(version,"1.13")` with no upper bound.
- **Source of truth:** `docs/upstream/sing-box/oldstable/configuration/outbound/index.md` (oldstable) — the 1.12 outbound type table has NO `naive` row and no `naive.md` exists under oldstable; stable `index.md` adds the `naive` row at line 39. Confirms naive is absent in 1.12, present from 1.13.
- **Touch:** `src/domain/diagnostics.ts:124` — inside the existing `outbounds.forEach((outbound, index) => …)` loop, add `if (outbound.type === "naive" && !atLeast(version, "1.13")) push(diagnostics, "error", "outbound-naive-version", \`/outbounds/${index}/type\`, …)`; `version`, `index`, and `atLeast` (imported line 2) are all in scope.
- **Touch:** `src/domain/diagnostics.ts:163` — reference only: clone the `service-ccm-ocm-version` shape (error level, path `/<collection>/${index}/type`, message `… requires sing-box 1.13+, but the target is <version>. sing-box <version> rejects it.`).
- **Touch:** `src/state/useProjectStore.ts:1042-1043` — confirmed: createFromPalette creates `naive` for any target with no guard (only wireguard/dns excluded). Unchanged here; creation-side gating is C7.
- **Change:** One new diagnostic rule (code `outbound-naive-version`) for `type === "naive"` && `!atLeast(version,"1.13")`, error level, path `/outbounds/${index}/type`, ccm/ocm message template with the entity tag + type substituted. No new imports. Export status flips to blocked on 1.12 via summarizeDiagnostics.
- **Acceptance:** `outbound-naive-version` error present at `/outbounds/<i>/type` for naive on 1.12; absent on 1.13 (stable) and 1.14 (testing); `summarizeDiagnostics` → "error" on 1.12; path focuses the correct `outbound:<tag>` node; no false positives for non-naive outbounds.
- **Tests (test-first):** `tests/outbound-naive-version.test.ts` — `errorCodes(cfg,"stable","1.12")` toContain `outbound-naive-version`; `("stable","1.13")` and `("testing","1.14")` not.toContain; 1.12 diagnostic path `/outbounds/0/type` & level `error`; `summarizeDiagnostics(...) === "error"`. Extend `tests/diagnostic-targets.test.ts` so `nodeIdForDiagnosticPath("/outbounds/<i>/type", config)` maps to `outbound:<tag>`.
- **Reviewer:** version-gating/diagnostics (Claude Code reviewer focused on target/version gates + diagnostic correctness).
- **Don't mix:** Diagnostic-only — do not change createFromPalette/addOutbound creation (C7), the naive field surface, or the ccm/ocm gate. Behavior change, not copy/UX.

#### C7-version-gate-channel-to-version (G11) — P1
- **Outcome:** A 1.12 Legacy stable target warns "needs sing-box 1.13" for each genuinely-1.13 field (TLS kernel_tx/kernel_rx/curve_preferences/client_authentication, naive outbound, local DNS prefer_go, route-rule bypass + interface_address trio); a 1.13 (and 1.14 testing) target stays clean — gated by `atLeast(version,"1.13")` instead of the coarse `channel==="stable"` default that collapses every stable target to "1.13".
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/shared/tls.md` (stable) — `Changes in sing-box 1.13.0` adds `:material-plus:` kernel_tx, kernel_rx, curve_preferences, client_authentication; each field section carries `!!! question "Since sing-box 1.13.0"`. kernel_tx/kernel_rx = bool default false (Linux 5.1+, TLS1.3-only); curve_preferences = string[] (P256|P384|P521|X25519|X25519MLKEM768); client_authentication = string enum (no|request|require-any|…), **Server only**. Identical in testing (1.14).
  - **Source of truth:** `docs/upstream/sing-box/oldstable/configuration/shared/tls.md` (oldstable) — NEGATIVE: zero hits for those four fields; tops out at `Changes in sing-box 1.12.0`. Confirms they are 1.13.0-only and the 1.12 target rejects them.
  - **Source of truth:** `docs/upstream/sing-box/stable/configuration/route/rule_action.md` (stable) — `Changes in sing-box 1.13.0` adds `:material-plus: bypass`; `### bypass` is `Since sing-box 1.13.0` (Linux + auto_redirect only), shape `{"action":"bypass","outbound":""}`.
  - **Source of truth:** `docs/upstream/sing-box/stable/configuration/route/rule.md` (stable) — `Changes in sing-box 1.13.0` adds `:material-plus:` interface_address, network_interface_address, default_interface_address; each `Since sing-box 1.13.0`. oldstable rule.md has none (tops at 1.11.0).
  - **Source of truth:** `docs/upstream/sing-box/stable/configuration/outbound/naive.md` (stable) — whole outbound marked `Since sing-box 1.13.0`; `quic_congestion_control` has no separate marker (the type itself is 1.13). No oldstable/naive.md. Testing identical.
  - **Source of truth:** `docs/upstream/sing-box/stable/configuration/dns/server/local.md` (stable) — `Changes in sing-box 1.13.0` adds `:material-plus: prefer_go`; `#### prefer_go` is `Since sing-box 1.13.0`, bool default false on a `type:"local"` server. Absent in oldstable.
- **Touch:** `src/domain/diagnostics.ts:47` — keep the default signature but verify the live caller (useProjectStore) passes the concrete target version so `channel==="stable" ? "1.13":"1.14"` is a fallback, not the live path (root cause of 1.12/1.13 collapse).
- **Touch:** `src/domain/diagnostics.ts:678` & `:1178` (inbound TLS) — add `!atLeast(version,"1.13")` warnings on tls.kernel_tx/kernel_rx/curve_preferences/client_authentication → `tls-{kernel-tx,kernel-rx,curve-preferences,client-authentication}-1-13-only`.
- **Touch:** `src/domain/diagnostics.ts:659/:895/:1044` (outbound TLS) — same gates for kernel_tx/kernel_rx/curve_preferences (client_authentication is server-only → inbound only).
- **Touch:** `src/domain/diagnostics.ts:88` & `:464` (route rules, `action` already extracted) — `action==="bypass" && !atLeast(version,"1.13")` → `route-rule-bypass-1-13-only`; any of interface_address/network_interface_address/default_interface_address set → `route-rule-interface-address-1-13-only`.
- **Touch:** `src/domain/diagnostics.ts:498` (dns servers) — `type==="local" && prefer_go!==undefined && !atLeast(version,"1.13")` → `dns-local-prefer-go-1-13-only`.
- **Touch:** `src/domain/diagnostics.ts` (naive outbound) — add `type==="naive" && !atLeast(version,"1.13")` → `naive-outbound-1-13-only` (today the type is badge-gated but NOT linter-gated; make them agree).
- **Touch:** `src/canvas/nodeLabels.ts:106` — relocate the private TYPE→min-version `MIN_VERSION` into a domain module (new `src/domain/minVersions.ts` or `targets.ts`), export it, import from nodeLabels; diagnostics imports the SAME table for the naive/ccm/ocm TYPE gates. Preserves the no-domain→canvas-import layering. Field-level gates stay literal `atLeast` calls (the table is type-keyed; kTLS/bypass are type-agnostic).
- **Change:** Confirm the live caller passes a concrete version, then add per-field `Since 1.13.0` warnings mirroring the existing `endpoint-tailscale-system-interface-1-13-only` precedent (warning, "requires sing-box 1.13+, but the target is X", path at the offending field). Unify the naive/ccm/ocm TYPE min-version between badge and linter via one exported domain constant.
- **Acceptance:** `validateConfig(cfg,"stable","1.12")` flags each field; `"stable","1.13"` and `"testing","1.14"` are clean; default-off/absent shapes (kernel_tx:false, curve_preferences:[], client_authentication:"no", absent prefer_go) produce nothing; badge and diagnostics naive gate flip together from one constant; no new domain→canvas import; pnpm test + build pass.
- **Tests (test-first):** `tests/version-gate-1-13-fields.test.ts` — per-field `codes(cfg,"stable","1.12").toContain(GATE)` + `("stable","1.13"|"testing","1.14").not.toContain(GATE)` + negative default-off cases. `tests/min-version-single-source.test.ts` — assert the exported table value `outbound:naive==="1.13"` drives both `nodeBadge("outbound","naive","1.12")` and the `naive-outbound-1-13-only` diagnostic.
- **Reviewer:** version-gating/diagnostics expert (secondary: architecture/refactor — verify the MIN_VERSION relocation does not invert domain/canvas layering).
- **Don't mix:** behavior + a same-behavior constant relocation only; NO copy rewording, NO UI/inspector changes; do NOT touch the testing-only (1.14) gates at :970/:1014/:1148/:1351 (those are C5/C6 testing-vs-stable); do NOT add 1.13 reject-ICMP or preferred_by.
- **Slice:** (A) extract+export the shared min-version table and wire nodeLabels + the naive/ccm/ocm TYPE gate (prereq); (B) TLS field family (inbound+outbound); (C) route-rule family + local DNS prefer_go. B and C independent after A.

#### C8-export-gate-unify (G8) — P1
- **Outcome:** A single shared export helper enforces the same error-diagnostics confirmation gate on both the desktop (TopBar) and mobile (MobileMenuSheet) export paths, so an invalid config can never be silently downloaded from either entry point.
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/index.md` (stable) — the `### Check` section documents `sing-box check` as the canonical config-validity command; this is the basis for sbc-ui's "validity-before-export" gate (error-level diagnostics approximate what `sing-box check` rejects). No new schema field; the gate is channel-agnostic.
  - **Source of truth:** `docs/upstream/sing-box/testing/configuration/index.md` (testing) — same `sing-box check` contract; testing (1.14) adds top-level `certificate_providers` and `http_clients` sections absent in stable, but that is informational only since the gate reads the diagnostics array, not any specific section. No version markers bear on this behavior atomic.
- **Touch:** `src/components/TopBar.tsx:144-163` — `exportConfig`'s inlined gate (lines 148-154: error count + `window.confirm` + early return) and blob/download become a call to the shared helper.
- **Touch:** `src/components/MobileMenuSheet.tsx:30-40` — ungated `exportConfig` is replaced with a call to the shared helper; `onClose()` runs only when the export proceeded. Mobile must source `diagnostics` (currently not selected) — read `useProjectStore.getState().diagnostics` to match its existing `getState().config` pattern.
- **Touch:** `src/domain/serialization.ts` (new export) or new `src/components/exportConfig.ts` — `confirmAndExportConfig(config, diagnostics): boolean` holding the error-count + `window.confirm` gate and the Blob→createObjectURL→anchor-click→revokeObjectURL→`createSbcvFileName()` download; returns whether the export proceeded.
- **Change:** Extract gate+download into one helper; desktop passes its already-selected `diagnostics` + `getState().config`; mobile pulls `diagnostics` from the store, calls the helper, and only closes the sheet on a truthy (proceeded) result. Keep the synchronous semantic `diagnostics` slice (not `officialDiagnostics`) per TopBar's race-safety comment.
- **Acceptance:** Desktop gate behaves exactly as today (existing tests unchanged). Mobile now prompts on error-level diagnostics; cancel aborts the download and keeps the sheet open; confirm downloads and closes. Valid configs export from both paths with no prompt. The confirmation message (incl. singular/plural) is identical across paths from one source. No change to `createConfigExport` output.
- **Tests (test-first):** `tests/export-gate.test.tsx` — add a mobile describe (matchMedia ≤768px via the `setMatchMedia` helper from `tests/mobile-layout.test.tsx`, open `mobile-menu-toggle`, click Export): (a) error + confirm→false asserts `window.confirm` called once with `/error/i`, `createObjectURL` NOT called, sheet stays open; (b) error + confirm→true asserts `createObjectURL` called once; (c) valid config asserts no confirm + one `createObjectURL`. Keep the three existing desktop A2b cases green to prove desktop routes through the helper. Reach the mobile button via `getByRole('button', { name: /export/i })` in the open sheet, or add `data-testid="mobile-export-button"`.
- **Reviewer:** React/perf (vercel-react-best-practices) — verify mobile sources `diagnostics`, no stale `getState()` closure, and `onClose` fires only on a proceeded export.
- **Don't mix:** Behavior parity only — don't change the confirm copy, don't swap `window.confirm` for a toast/modal, don't touch `createConfigExport`/serialization, and don't fold in the import-confirm gate or `officialDiagnostics`.

#### C9-dup-tag-namespace (4.2 dup-tag) — P1
- **Outcome:** A tag reused across distinct reference namespaces (e.g. an inbound and an outbound both named "proxy") no longer raises a duplicate-tag error and no longer trips the desktop export soft-gate; only genuine same-namespace collisions are flagged.
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/inbound/index.md` (stable) — `inbounds[].tag` = "The tag of the inbound" (**line 40** — the testing copy is line 41 because the `cloudflared` row shifts it down); referenced only via `route.rules[].inbound`. No global-uniqueness statement.
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/outbound/index.md` (stable) — `outbounds[].tag` = "The tag of the outbound" (line 43); referenced via `route.final` / `route.rules[].outbound` / selector|urltest `.outbounds[]`.
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/endpoint/index.md` (stable) — endpoint (`!!! question "Since sing-box 1.11.0"`) is "a protocol with inbound and outbound behavior" (line 5); `endpoints[].tag` (line 29). Endpoint tags share the OUTBOUND namespace, so outbound+endpoint must be deduped together (matches existing `getOutboundTags`, indexes.ts:83-90).
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/route/index.md` (stable) — `route.final` = "Default outbound tag" (line 70); references resolve per-field/per-namespace, so identical tags in different collections never collide at runtime. (Note: the field-level reference semantics live in the rule/ sub-page; this is a reasonable inference, not a literal quote from index.md.)
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/{inbound,outbound}/index.md` (testing) — identical tag semantics to stable (testing only adds the `cloudflared` inbound type, line 37); no channel-specific behavior for this fix.
- **Touch:** `src/domain/indexes.ts:73-81` — `buildTagIndex` keys on the bare `entity.tag`, collapsing cross-namespace reuse into one >1 bucket. Add `namespaceForKind(kind)` (outbound+endpoint → "outbound"; inbound/dns-server/rule-set/http-client/certificate-provider/service each their own) and `buildNamespacedTagIndex(config)` keyed on `${namespace} ${tag}`. Leave bare-tag `buildTagIndex` for `getUniqueTag`/`renameTag`.
- **Touch:** `src/domain/diagnostics.ts:50-64` — switch the duplicate-tag loop to the namespaced index; keep the per-ref path emission (`/<collection>/<index>/tag`) so node-level targeting is unchanged.
- **Change:** Add the namespace helper + namespaced index in indexes.ts; point only the diagnostics dup-tag loop at it. getUniqueTag/renameTag stay global-unique (conservative, harmless). UI consumers untouched because the diagnostic shape (code/path/level/one-per-ref) is identical.
- **Acceptance:** inbound `dup` + outbound `dup` → 0 duplicate-tag and 0 error-level diagnostics, so export skips the "Export anyway?" confirm (TopBar.tsx:148-153); two outbounds `x` still flagged at both `/outbounds/*/tag`; outbound `wg` + wireguard endpoint `wg` still flagged (shared namespace); behavior identical stable vs testing.
- **Tests (test-first):** `tests/domain.test.ts` — rewrite the line-831 test to assert ZERO dup-tag for the cross-namespace inbound/outbound `dup` config and move per-path assertions onto two same-namespace outbounds; add "does not flag cross-namespace tag reuse" (inbound+outbound+dns-server all `proxy` → []), "flags outbound/endpoint same-namespace collision" (paths `['/endpoints/0/tag','/outbounds/0/tag']`), "still flags true same-namespace duplicate" (two outbounds `x`), and an error-count===0 export-gate guard.
- **Reviewer:** version-gating/diagnostics expert (sing-box diagnostic + namespace semantics); secondary domain schema-correctness.
- **Don't mix:** Domain/diagnostics only — no canvas/graph or DiagnosticsPopover changes (emission contract preserved); do NOT renamespace getUniqueTag/renameTag (separate scope); not a copy change.

#### C10-hysteria-server-ports (4.2 server_ports) — P1
- **Outcome:** A hysteria/hysteria2 outbound using port hopping via a non-empty `server_ports` array (no scalar `server_port`) no longer raises the blocking `outbound-invalid-server-port` error, while a config supplying neither still errors.
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/outbound/hysteria2.md` (stable) — `server_port` is `==Required==` int but "Ignored if `server_ports` is set."; `server_ports` = array of port-range strings (e.g. `"2080:3000"`), "Since sing-box 1.11.0", "Conflicts with `server_port`." So server_ports substitutes for server_port (port hopping, `hop_interval` default 30s).
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/outbound/hysteria.md` (stable) — `server_ports` = port-range string array, "Since sing-box 1.12.0", "Conflicts with `server_port`." (hysteria's `server_port` lacks the explicit "Ignored if…" line but server_ports is the documented conflicting substitute.)
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/outbound/hysteria2.md` (testing) — same server_ports contract ("Since 1.11.0", "Conflicts with `server_port` and `realm`"); testing additionally has `hop_interval_max` "Since sing-box 1.14.0" and testing-only `realm` (both out of scope here).
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/outbound/hysteria.md` (testing) — same as stable hysteria; `server_ports` present in both targeted channels.
- **Touch:** `src/domain/diagnostics.ts:643-656` — generalize the ssh-only port exemption: compute `hasServerPorts = Array.isArray(server_ports) && length > 0`; when `hasServerPorts` (hysteria/hysteria2) OR type==="ssh", an absent server_port is legal and only a present-but-out-of-range value is flagged; all other types still require an in-range scalar port.
- **Touch:** `src/domain/diagnostics.ts:1000-1013` — VERIFY ONLY: existing `hysteria2-server-port-vs-server-ports` warning (both-fields-set) stays untouched; new fix is orthogonal.
- **Change:** Replace the `outbound.type === "ssh" ? … : portOutOfRange` ternary with logic that exempts an absent port when `hasServerPorts` is true (or ssh), still erroring on out-of-range present ports and on the neither-supplied case. Reuse existing message/code.
- **Acceptance:** hysteria2/hysteria with `server_ports:["2080:3000"]` and no `server_port` → no `outbound-invalid-server-port` (stable + testing); same with out-of-range `server_port:70000` → still errors; neither field → still errors; socks with no port → still errors; existing both-fields warning and ssh tests unchanged.
- **Tests (test-first):** `tests/hysteria-server-ports.test.ts` — `validateConfig(cfg, channel).filter(level==="error").map(code)`: server_ports-only hysteria2 and hysteria NOT toContain "outbound-invalid-server-port" (both channels); server_ports + out-of-range port toContain; neither field toContain; socks control toContain; empty server_ports:[] toContain. Plus `tests/outbound-ssh-port.test.ts` regression stays green.
- **Reviewer:** version-gating/diagnostics (sing-box schema-aware diagnostics expert).
- **Don't mix:** Behavior-only required-check fix; do not alter the SSH branch, the both-fields `hysteria2-server-port-vs-server-ports` warning, inbound hysteria2 (`listen_port`), or hop_interval/hop_interval_max handling.

#### C17-no-silent-unreachable-guard (新增 — enforces "主流零回退") — P1
- **Outcome:** A CI invariant test guarantees no field in inbound/outbound `handledFields` is silently unreachable — every handled key is EITHER fully rendered by a structured control OR not in handledFields (so it falls through to the Advanced JSON fallback). This is the systematic guard for the harder ≥90% / zero-mainstream-fallback done-bar: it prevents reintroducing the exact C1/C3 root cause (a key in handledFields whose editor is incomplete AND therefore never reaches `AdvancedNonScalarFields`).
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/shared/{v2ray-transport,tls,multiplex,dial}.md` (stable) — these define the universe of nested-object subkeys (transport.*, tls.*, multiplex.*, dial.*) that, when their parent key is in handledFields, must each stay reachable via a control or the JSON fallback. testing equivalents identical except 1.14 additions already gated elsewhere; the invariant itself is channel-invariant.
- **Touch:** `src/components/Inspector.tsx:113-157` (inboundHandledFields) / `:158-220` (outboundHandledFields) — the handled-key sets under test.
- **Touch:** `src/components/Inspector.tsx:324-331` (editableNonScalarFields excludes handled keys) — the exclusion that turns an incomplete-control handled key into a silently-unreachable field; expose a small testable mapping {handled key → covered-by-a-control?}.
- **Touch:** `tests/no-silent-unreachable-fields.test.tsx` (NEW) — for every handled key assert covered-by-control OR not-in-handledFields; fail listing any silently-unreachable key.
- **Change:** Add the invariant test (+ a tiny exported helper listing handled keys and whether a SharedFieldDefinition/control covers them). Test-first: the guard passes once C1/C3 land; if it flags additional unenumerated subkeys (tls/multiplex/dial), queue those as follow-up coverage atomics rather than widening this one.
- **Acceptance:** the guard passes with C1/C3 merged; deliberately re-adding an uncovered key to handledFields (or deleting a control) fails the guard with the offending key named; runs in plain `pnpm test` (no binary, no e2e).
- **Tests (test-first):** `tests/no-silent-unreachable-fields.test.tsx` — the exhaustive handled-key invariant + a synthetic negative case proving it fails on an injected silently-unreachable key.
- **Reviewer:** React/perf (vercel-react-best-practices) for the Inspector mapping seam; secondary domain schema-correctness for the handled-key↔documented-field correspondence.
- **Don't mix:** guard/test infra ONLY — it DETECTS the class; per-field coverage fixes (transport = C1, tls.acme = C3, any multiplex/dial subkeys it surfaces = follow-up atomics) are separate. Do not fix flagged fields inside this atomic beyond what C1/C3 already cover.

---

### Phase P2 — Structure & graph fidelity (C11–C16)

可写边 + 递归规则 + 注册表驱动 + Inspector 拆分 + CI 二进制复检 + 项目 save/load。多数会拆 sub-slices;C14-S10 显式依赖 C0。

- [ ] C11-detour-endpoint-edges — 6 个 dial 式 detour 边解析 endpoint 目标(不再画出幻影 outbound),且 `domain_resolver`→dns-server / `http_client` 跨对象引用成为可写端口关系(http-client 节点不再漂浮)。Source: `docs/upstream/sing-box/stable/configuration/shared/dial.md`. Touch: `src/canvas/graph.ts`.
- [ ] C12-logical-rule-recursion — 嵌套 logical(and/or)子规则用与顶层相同的结构编辑器(mode 选择 + 嵌套 rules[] 列表)可编辑,不再死在 "edit in JSON mode" 提示。Source: `docs/upstream/sing-box/stable/configuration/rule-set/headless-rule.md`. Touch: `src/components/Inspector.tsx`.
- [ ] C13-registry-driven-portswitch — isPortConnected(读)/ connectDirectedPortReference(连写)/ disconnectEdge(断写)三条手写并行 switch 统一为一个 registry 驱动的 adapter(canonicalPath + endpoints + gate);加可写关系 = 一条 registry 项 + 至多一条 adapter 子句。Source: `docs/upstream/sing-box/stable/configuration/route/rule.md`. Touch: `src/domain/portRelationRegistry.ts`.
- [ ] C14-inspector-split — 5641 行 Inspector.tsx 拆为 per-entity-kind 组件,零行为变更;C0 落地后叶子 scalar/enum 分支改为数据渲染。Source: `docs/upstream/sing-box/stable/configuration/index.md`. Touch: `src/components/Inspector.tsx` + `src/components/inspector/` (NEW).
- [ ] C15-ci-binary-check — CI 对内部 fixtures 喂 **pruned 导出**(createConfigExport contents,应用实际下载的字节)给真实 sing-box 二进制 `check`,闭合"应用实际输出 ↔ 二进制接受"回路。Source: `docs/upstream/sing-box/stable/configuration/index.md`. Touch: `tests/export-binary-check.test.ts` (NEW).
- [ ] C16-project-save-load — 项目级 Save/Open 把 config + layout + channel/version 序列化为带版本的 `sbcv-project` 包装,打开时回灌坐标;普通 sing-box JSON Export/Import 保持当前丢坐标行为,两种文件格式明确区分。Source: `docs/upstream/sing-box/stable/configuration/index.md`. Touch: `src/domain/serialization.ts`.

#### C11-detour-endpoint-edges (G7) — P2
- **Outcome:** All 6 dial-style detour edges resolve endpoint targets (detour→endpoint renders an edge, not a phantom `outbound:<tag>`), and the unmodeled `domain_resolver`→dns-server and `http_client` references become writable port relations so http-client nodes stop floating.
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/shared/dial.md` (stable) — `detour` (string) = "tag of the upstream outbound" but the tag namespace is shared with endpoints; `domain_resolver` (string OR object, `:material-plus:` added 1.12.0) string form "is equivalent to setting `server`" (a dns-server tag), object form reuses the route DNS rule action minus `action`; `domain_strategy` `:material-failure:` deprecated 1.12, removed 1.14.
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/shared/dial.md` (testing) — `domain_resolver` `:material-alert:` under "Changes in sing-box 1.14.0"; note: "this item will be required for outbound/endpoints using domain name in server address since sing-box 1.14.0" (optional only when one DNS server is configured).
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/shared/http-client.md` (testing) — `!!! question "Since sing-box 1.14.0"`: http_client is TESTING-ONLY (no stable doc — candidate path corrected); value "A string or an object", string = "tag of a shared HTTP Client defined in top-level `http_clients`"; shared object embeds Dial Fields (so it itself has `detour`).
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/dns/rule_action.md` (stable) — `route` action `server`: ==Required==, "Tag of target server" (the schema object-form domain_resolver reuses).
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/dns/server/index.md` (testing) — dns-server `tag` is the resolution target; `mdns` type added 1.14, legacy `:material-note-remove:` (stable doc lacks both).
- **Touch:** `src/canvas/graph.ts:684,944,973,857,998,1015` — replace the 6 hardcoded `outbound:${tag}` edge targets with the existing `outboundTargetNodeId(tag)` helper (graph.ts:410; only ONE definition exists — drift note).
- **Touch:** `src/domain/portRelationRegistry.ts:121` — add `endpoint` to the `outbound-detour` target `extraNodeKinds` so endpoint-targeted detours stay registry-explainable.
- **Touch:** `src/domain/portRelationRegistry.ts:106-133` — add writable relations `dial-domain-resolver` (→dns-server, canonicalPath `.../domain_resolver`) and `http-client-ref` family (route.default_http_client / rule_set[*].http_client / certificate_providers[*].http_client, testing-gated).
- **Touch:** `src/canvas/graph.ts:900-918` + `:200-374` (isPortConnected) + `src/domain/commands.ts:1149-1268` (disconnectEdge) + `src/state/useProjectStore.ts:632-721` (connect) — wire the two new relations end-to-end; reuse existing http_client infra in `referenceRegistry.ts:88-119` and diagnostics in `diagnostics.ts:1494-2009` (do not duplicate).
- **Change:** (A) swap detour edge targets to `outboundTargetNodeId`; (B) model `domain_resolver`→dns-server as a writable relation (string + object `.server` form), keeping Inspector's select as the editor; (C) model the 3 `http_client` string refs + shared-object detour as testing-gated edges into the http-client node.
- **Acceptance:** detour-at-endpoint renders an `endpoint:<tag>` edge; registry "every rendered edge explainable" test passes; domain_resolver edge connects/disconnects and lights the dns-server dot; http-client refs render edges on testing only and the node no longer floats; no duplicate diagnostics; tsc/lint/tests green.
- **Tests (test-first):** `tests/detour-endpoint-edges.test.ts` (each of the 6 detours → `endpoint:<tag>` target, no dangling node); `tests/dial-domain-resolver-edge.test.ts` (string+object form → `dns-server:<tag>`, relationForHandles resolves, disconnect clears, isPortConnected both ends); `tests/http-client-reference-edges.test.ts` (testing renders / stable suppresses the 3 refs, connectedPorts reflect input); extend `tests/port-relation-registry.test.ts` and `tests/port-disconnect-symmetry.test.ts` to cover the new relations.
- **Reviewer:** canvas/React-Flow graph reviewer with a reference-port/domain schema lens (the A7b / port-relation-registry reviewer).
- **Don't mix:** behavior not copy (no field retitles/restyles); reuse the single `outboundTargetNodeId` and existing http_client referenceRegistry/diagnostics (no second helper, no duplicate diagnostics); keep http_client edges testing-gated; keep the zero-schema-risk detour retargeting reasoned separately from the two new connect/disconnect-bearing relations.
- **Slice:** C11a detour→endpoint retargeting (6 edge swaps + extraNodeKinds + isPortConnected case, lowest risk, ship first); C11b dial-domain-resolver relation (registry + edge + isPortConnected + connect + disconnect — highest value, 1.14 requiredness); C11c http_client relations (testing-gated edges for 3 refs + shared-object detour, reuses existing infra).

#### C12-logical-rule-recursion (G5) — P2
- **Outcome:** A logical (and/or) sub-rule nested inside any inline/logical `rules[]` becomes editable with the same structured editor as a top-level logical rule (mode select + nested rule list), instead of dead-ending at a "edit in JSON mode" hint.
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/rule-set/headless-rule.md` (stable) — Logical Fields (lines 281-297): `type` = `logical` (literal), `mode` ==Required== = `and`|`or`, `rules` ==Required== = array of headless rules; a logical rule's `rules[]` items are themselves headless rules that may contain further logical rules (the recursion element); optional `invert` boolean. No recursion-depth bound is documented.
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/rule-set/headless-rule.md` (testing) — identical logical contract; 1.14 only adds non-logical match fields (`package_name_regex` :material-plus: 1.14.0, `query_type` :material-alert:), so the recursive editor needs no channel gating.
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/route/rule.md` (stable) — Logical Fields (490-506): `type`=`logical`, `mode` ==Required== and|or, `rules` ==Required==; confirms a NESTED logical sub-rule is a match rule (no action/outbound at the nested level).
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/dns/rule.md` (stable) — Logical Fields (537-549) match the same uniform grammar across route/dns/headless.
- **Touch:** `src/components/Inspector.tsx:760-857` — `InlineRuleSetEditor`: add optional `depth` prop (default 0); this component IS the gap.
- **Touch:** `src/components/Inspector.tsx:824-825` — replace the dead-end `field__hint` ("Logical (and/or) rule — edit its nested rules in JSON mode.") with an inline `mode` select (and/or, via `patchRule(index,{mode})`) + recursive `<InlineRuleSetEditor depth={depth+1} value={ruleObj.rules} onChange={(next)=>patchRule(index,{rules:next})} />`, gated by a `MAX_INLINE_RULE_DEPTH` cap that keeps the JSON hint as the deep-nesting fallback.
- **Touch:** `src/components/Inspector.tsx:1159` and `:1384` — RouteRuleInspector/DnsRuleInspector top-level delegation to `InlineRuleSetEditor` (NOT the gap; verify they still render two-deep after the change).
- **Change:** Add `depth` prop; recurse on logical children with a stable key and a small UI depth cap (3); reuse existing `patchRule` (undefined-pruning preserves round-trip) and `isLogicalRule`. Nested children render only headless match fields, never route/dns action fields. JSON escape hatch retained for depth beyond the cap.
- **Acceptance:** A nested `{type:'logical',mode:'and',rules:[{domain:['a']}]}` shows a mode select + editable nested `domain`; edits write to `…rules[0].rules[0].domain` preserving parent `type`/`mode`; add/remove/reorder work at the nested level; 3+ deep falls back to JSON hint and round-trips; top-level logical rules unchanged; no infinite render; suite green.
- **Tests (test-first):** `tests/inline-rule-set-editor.test.tsx` — (1) structurally edit a nested logical sub-rule (no JSON hint); (2) flip nested mode and→or; (3) add a rule inside the nested group; (4) depth-cap regression: 3-deep chain still shows JSON hint and round-trips; (5) strengthen the existing "preserves non-structured keys" test for byte-identical sibling logical rules.
- **Reviewer:** React/perf (vercel-react-best-practices) — recursive component, stable keys, depth prop, no remount/infinite-render regression.
- **Don't mix:** behavior-only recursion; do NOT add/change match-field schema (1.14 fields), touch the JSON escape-hatch parse contract, refactor action/outbound logic, or inject action fields into nested children; keep the JSON hint only as the depth-cap fallback.
- **Slice:** Fits one PR (~one new prop + ~30 lines). If split: PR-1 single-level recursion (JSON hint for depth>=1); PR-2 raise cap + depth-cap regression test.

#### C13-registry-driven-portswitch (4.3 port-switch) — P2
- **Outcome:** `isPortConnected` (read), `connectDirectedPortReference` (connect write), and `disconnectEdge` (disconnect write) all resolve a port/edge through one registry-driven adapter keyed off `PortRelation` (canonicalPath + endpoints + gate), so adding a writable relation is a single registry entry plus at most one adapter clause — not parallel edits across three hand-written switch maps.
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/route/rule.md` (stable) — reference fields the port-switch touches: `inbound` = "Tags of [Inbound]" (string|string[] tag-ref, optional); `rule_set` = "Match [rule-set]" (string|string[], optional, Since 1.8.0); `outbound` = single-tag string, `!!! failure "Deprecated in sing-box 1.11.0"` ("Moved to Rule Action"); `action` = ==Required== (1.11.0+) → writing `outbound` stays gated by the existing `routeRuleAllowsOutbound` predicate. The `canonicalPath` wildcard `/route/rules/*/{outbound,rule_set,inbound}` binds `*` to the rule index.
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/route/rule.md` (testing) — identical reference-port contract; `outbound` still `!!! failure "Deprecated in sing-box 1.11.0"`. New 1.14.0 fields (`source_mac_address`, `source_hostname`, `package_name_regex`, `:material-plus:`) are match-only, not reference ports, so the writable-relation surface this atomic refactors is the same across stable and testing — no version gate added.
- **Touch:** `src/domain/portRelationRegistry.ts:60-104` — formalize the inert `canonicalPath` by adding a typed reference-shape (`refKind: scalar | tag-array | map`) + optional `gate` to `PortRelation`; keep `relation()` factory back-compatible.
- **Touch:** `src/domain/portRelationRegistry.ts:106-133` — populate/verify `canonicalPath` + ref-shape + gate on all 25 writable relations; canonicalPath stops being dead metadata.
- **Touch:** `src/canvas/graph.ts:200-374` — `isPortConnected`'s input/output switch blocks become a registry lookup → `adapter.isConnected(config, node, relation)`.
- **Touch:** `src/state/useProjectStore.ts:632-787` — `connectDirectedPortReference`'s ~20 `if (kind && handle)` clauses collapse to `relationForHandles(...)` → `adapter.connect(...)`, gates carried as per-relation predicates.
- **Touch:** `src/domain/commands.ts:1149-~1320` — `disconnectEdge`'s parallel per-relation clauses become `adapter.disconnect(config, parsedEdge, relation)` (the THIRD parallel switch the assessment didn't name; slice 2).
- **Change:** One domain adapter interprets `canonicalPath` (`*`→index) + ref-shape + gate, reusing existing `addTagRef`/`removeTagRef`/`stringRefs`, `updateEntityField`/`updateRouteRule`/`updateDnsRule`, and the `*AllowsOutbound`/`supports*` gates. Bespoke cases (ssm-api servers path-map via `uniqueServerPath`, clash_api nested object, ntp/experimental settings-path) route through exactly one labelled escape hatch keyed by `relation.id`. Pure refactor — no new relation, no schema/behavior/diagnostics change.
- **Acceptance:** All three existing port suites stay green with zero assertion edits; `grep canonicalPath` shows a live consumer; adding a synthetic relation is read+connect+disconnect-able with no edits to graph.ts/useProjectStore.ts/commands.ts; all type/action/pairing gates preserved; `pnpm test` + `tsc --noEmit` pass.
- **Tests (test-first):** `tests/port-relation-adapter.test.ts` (NEW) — adapter agrees with the three legacy functions on the broad fixture for every writable relation; `*` binds the right rule index; tag-array round-trips remove-only-named; a synthetic scalar + tag-array relation is fully wired with no caller edits. Plus `tests/port-interaction-symmetry.test.ts`, `tests/port-disconnect-symmetry.test.ts`, `tests/port-relation-registry.test.ts` UNCHANGED and green (the symmetry + completeness guards catch any dropped/changed relation).
- **Reviewer:** architecture/refactor (registry-driven indirection over three call sites; secondary: serialization/round-trip for the canonical config equality the symmetry tests assert).
- **Don't mix:** Refactor-only — no new relation, no schema field, no diagnostics, no copy/UX/render change. Do NOT surface the `outbound` 1.11.0 deprecation here (separate version-gating atomic). Keep bespoke escape hatches explicit rather than force-fitting them into the generic pointer adapter. Stable/testing reference-port surface is identical → no version gate added.
- **Slice:** (1) domain adapter + registry shape + new adapter test, no caller rewired; (2) rewire read path (graph.ts) — gate on registry test; (3) rewire connect (useProjectStore.ts) + disconnect (commands.ts) — gate on the two symmetry suites. Each PR independently green.

#### C14-inspector-split (4.3 — inspector-monolith) — P2
- **Outcome:** Inspector.tsx (5641 lines, ~3684-line main component, ~60 inline `entityType` branches) is split into per-entity-kind components with zero behavior change, and once C0's descriptor table lands, leaf scalar/enum fields render from data instead of inline conditionals.
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/index.md` (stable) — fixes the entity-family taxonomy the split follows: **10** authoritative top-level keys (the contract said "9" — corrected): `log`, `dns`, `ntp`, `certificate`, `endpoints[]`, `inbounds[]`, `outbounds[]`, `route`, `services[]`, `experimental`, each mapping to a sub-doc. Refactor-only: no field/enum/version-marker contract is altered.
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/index.md` (testing) — testing (1.14) is a **12-key superset, NOT identical** to stable (the contract's "identical key set" claim is corrected): it adds `certificate_providers` (array) and `http_clients` (array). A faithful per-kind split must account for these two extra families on the testing channel; channel-gated controls (e.g. dns-server tailscale `accept_search_domain`, sing-box 1.14.0) move unchanged.
- **Touch:** `src/components/Inspector.tsx:1957-5641` — extract each `ref.kind` block (inbound 2793, outbound 3482, dns-server 4461, endpoint 4810, service 5015, rule-set 5545, route 2058, dns 2136, rules 2297/2300, settings 2376-2523) into its own component under new `src/components/inspector/`; keep `export function Inspector` as a thin dispatch shell.
- **Touch:** `src/components/Inspector.tsx:113,158,221,249,267,295,683,982` — move per-kind `handledFields` Sets and the `AdvancedScalar/NonScalarFields` fallback to `inspector/shared.tsx`; this seam is what C0's descriptor table later replaces for scalar/enum leaves.
- **Touch:** `src/components/InspectorPanels.tsx:1-109` — NOT the monolith (candidate anchor is wrong); separate rules/JSON/diagnostics tab component. Out of scope — do not touch.
- **Change:** Pure structural decomposition first (one PR per family), threading identical props (entity/ref/channel/config/updateField/sharedGroups/handledFields) and preserving every control, testid, aria-label, and gating condition. Then, gated on C0, add a `<DataDrivenScalarFields>` renderer reading the descriptor table and delete the inline scalar/enum branches it subsumes, leaving only custom controls (repeaters, pickers, UUID/key generators) inline.
- **Acceptance:** Public `Inspector` export and `node-inspector`/`inspector-header` markup unchanged; full existing tests/ suite passes with zero assertion edits; no inspector component file >~600 lines and shell <~400; tsc + eslint clean, no new circular imports; identical render in both channels.
- **Tests (test-first):** `tests/inspector-split-structure.test.tsx` — render `<App/>`, click a node-testid for each entity family, assert `node-inspector` mounts and the family's signature field renders; per-family representative-type assertions in stable AND testing (reuse importJson + setChannel pattern). Plus run the whole existing suite unchanged as the preservation gate. C0-slice: `tests/inspector-data-driven-scalars.test.tsx` snapshots each type's rendered {field, controlType, channel-gate} set against the descriptor table.
- **Reviewer:** architecture/refactor reviewer, with a React/perf pass (vercel-react-best-practices) on the extracted component tree (props threading, memoization, re-render parity).
- **Don't mix:** Extraction PRs are behavior-frozen (the green suite is the proof) and must stay separate from the C0-gated data-driven migration; never touch InspectorPanels.tsx; never fold in deferred field-coverage gaps (transport headers / ACME / certificate_providers creation are their own atomics).
- **Slice:** S1 scaffold inspector/ + shared.tsx; S2 inbound; S3 outbound; S4 dns-server; S5 endpoint; S6 service; S7 rule-set; S8 route+dns+rules; S9 settings — each keeps the full suite green. S10 (after C0): descriptor-table scalar/enum renderer, delete subsumed inline branches family-by-family.

#### C15-ci-binary-check (5.3 / P2#12) — P2
- **Outcome:** CI feeds the exact bytes the app downloads — `createConfigExport(parseConfigJson(fixture)).contents` after `pruneExportNoise` — through `sing-box check` on the channel-matched binary for every internal fixture, so a prune step that yields binary-rejected output fails the release gate instead of shipping silently.
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/index.md` (stable) — top-level keys `log`,`dns`,`ntp`,`certificate`,`endpoints`,`inbounds`,`outbounds`,`route`,`services`,`experimental`; `### Check` documents `sing-box check` as the validation invocation (non-zero exit = invalid) — the binary contract this gate exercises against the PRUNED export.
- **Source of truth:** `docs/upstream/sing-box/testing/configuration/index.md` (testing) — same `sing-box check` contract; ADDS `certificate_providers` and `http_clients` (arrays) to the top-level structure (absent in stable 1.13). serialization.ts already array-asserts both, so testing-channel exports can carry them and MUST be checked with the 1.14 testing binary.
- **Touch:** `tests/export-binary-check.test.ts` (NEW) — Vitest gate: for `fixtures/stable/*.json` and `fixtures/testing/*.json`, `parseConfigJson` → `createConfigExport` → write `.contents` to a tmp file → `spawnSync(binary,['check','-c',tmp])` → `assertCleanSingBoxCheck`. Vitest is the only runner able to import the TS `createConfigExport`.
- **Touch:** `scripts/singbox-target-policy.mjs:17-21` — reuse `binaryForFixturePath(file, channel)` (testing→sing-box-testing, 1.12/legacy→sing-box-1.12, else sing-box-stable). No change.
- **Touch:** `scripts/singbox-check-policy.mjs:53-58` — reuse `assertCleanSingBoxCheck` so the app's output is held to the same pass/no-warning bar as raw fixtures. No change.
- **Touch:** `src/domain/serialization.ts:96-116` — subject under test (`pruneExportNoise` + `createConfigExport`); NOT edited.
- **Touch:** `package.json:14,21-22` — add the gate to `validate:external` (or a new `validate:export-binary`) so `release:check` covers it; keep it excluded from plain `test` to stay binary-free.
- **Touch:** `.github/workflows/release-check.yml:41-45` — binaries already installed before `release:check`; confirm the gate runs there. No new install step.
- **Change:** Add a Vitest gate that walks the internal fixtures, runs each through the app's real export path (`parseConfigJson` → `createConfigExport`, which applies `pruneExportNoise`), writes the resulting `contents` to a tmp file, and runs `sing-box check` with the channel/version-matched binary, judged by the shared `assertCleanSingBoxCheck`. Missing binary locally → warn-and-skip (same `resolveCommand` pattern as `validate-fixtures.mjs`); CI installs all three so the gate is real. Wire into `release:check`; keep out of plain `test`. No production code changes.
- **Acceptance:** Every internal fixture's PRUNED export (not the raw file, not the live config) is `sing-box check`-ed with the matched binary; a binary rejection or warning/deprecation line fails the gate with binary+file+reason; `release:check` fails on any binary-rejected app-export; absent binaries warn-skip; tmp files are cleaned in `finally` and no fixtures are mutated; the gate is excluded from plain `test`.
- **Tests (test-first):** `tests/export-binary-check.test.ts` — iterate `fixtures/{stable,testing}/*.json`; `createConfigExport(parseConfigJson(...))` → tmp file → `spawnSync(... 'check' ...)` → accumulate into `failures` and `expect(failures).toEqual([])`; assert ≥1 check actually ran when binaries present; assert the checked string differs from the raw fixture for a noise-bearing fixture (proves the pruned path, not the raw file); negative guard: a config with inert empty-string/array keys is pruned AND still binary-accepted.
- **Reviewer:** serialization/round-trip reviewer (gate correctness depends on `createConfigExport`/`pruneExportNoise` output staying binary-valid), with a CI/tooling lens for the `release:check` wiring.
- **Don't mix:** Infra/CI only — do not alter `pruneExportNoise`/`createConfigExport`; do not touch the external-fixture gates (those check the RAW checked-in fixture, a separate concern); test-only, no runtime code or new deps; do not fix any fixture this gate flags as binary-rejected (that is a follow-up behavior atomic).
- **Slice:** Fits one PR. If a fixture's app-export turns out binary-rejected, split the fix into a separate fixture/behavior atomic and land the gate first (optionally allow-listing the known-bad fixture with a tracked TODO) so the loop is closed without scope creep.

#### C16-project-save-load (4.2 layout-loss) — P2
- **Outcome:** A new project-level Save/Open serializes a versioned `sbcv-project` wrapper (config + layout + channel/version) and re-hydrates node positions on open, so canvas coordinates survive a round-trip — while plain sing-box JSON Export/Import keeps its current (layout-dropping) behavior and the two file formats stay clearly distinct.
- **Source of truth:** `docs/upstream/sing-box/stable/configuration/index.md` (stable) — sing-box 1.13 config root keys: `log`/`dns`/`ntp`/`certificate`/`experimental` (objects), `endpoints`/`inbounds`/`outbounds`/`services` (arrays), `route` (object). There is **no** `sbcv`/project-wrapper key: the wrapper is an app-local format, NOT a sing-box config, and must never be fed to `sing-box check`. `SbcProject.config` must hold a full sing-box root that round-trips through the existing `normalizeConfig`.
  - **Source of truth:** `docs/upstream/sing-box/testing/configuration/index.md` (testing) — sing-box 1.14 root adds two keys absent from stable: `certificate_providers` (array) and `http_clients` (array) (already modeled on `SingBoxConfig`); oldstable (1.12) index is byte-identical to stable. So the wrapper's inner `config` must preserve channel-specific root keys verbatim (Open normalizes via `parseConfigJson`/`normalizeConfig`, which already handle these), and `SbcProject.singBoxChannel`/`singBoxVersion` record the authoring channel so Open can restore the target.
- **Touch:** `src/domain/types.ts:130-136` — `SbcProject` exists but is referenced nowhere; add a `kind:"sbcv-project"` discriminator + `schemaVersion:number`, keep `config:SingBoxConfig`/`layout:ProjectLayout`/`appVersion`/`singBoxChannel`/`singBoxVersion`.
- **Touch:** `src/domain/serialization.ts` (after :116) — add `createProjectExport(project)` → `*.sbcv.json`, and `parseProjectJson(json)` that validates `kind`/`schemaVersion`, runs inner config through existing `normalizeConfig`, validates `layout.positions`. Do NOT route the wrapper through plain `parseConfigJson`.
- **Touch:** `src/state/useProjectStore.ts:1802-1830` — `importJson` calls `...freshLayoutState(state)` (helper :232-238) which sets `layout:{positions:{}}` — the plain-import layout-loss site; leave it. Add `loadProject(value,{snapshot})` mirroring `loadTemplatePreset` (:950-962) that sets `layout: project.layout` (no `freshLayoutState`), `sync(project.config, channel, version)`, channel/version from the wrapper, bumps capture/load tokens, snapshots prior {config,layout} to history. Declare `loadProject` (+ optional `saveProject`) on the store interface near `importJson` (:190). Source `appVersion` from a single constant (a `__APP_VERSION__` define from package.json or a hardcoded `APP_VERSION` — none exists in src/ yet, introduce one).
- **Touch:** `src/components/TopBar.tsx:144-187,267-288` — add 'Save project' (download `sbcv_<ts>.sbcv.json` from `createProjectExport(saveProject())`) and 'Open project' file input (`loadProject(text,{snapshot:true})`) reusing the size-guard + configHasContent confirm + success/Undo toast pattern; copy distinguishes Export/Import (sing-box JSON) from Save/Open (sbcv project). Disambiguate `createSbcvFileName` (:43-47), which today prefixes `sbcv_` on the BARE config — avoid a confusable name with the wrapper.
- **Change:** Activate the dormant `SbcProject` wrapper end-to-end: harden the type, add `createProjectExport`/`parseProjectJson` (reusing `normalizeConfig`), add a `loadProject`/`saveProject` store action that restores config+channel/version+layout atomically without wiping positions, and add disambiguated Save/Open buttons in TopBar. Plain Export/Import (and its deliberate layout reset) is untouched.
- **Acceptance:** Drag nodes off default, Save, Open in a fresh session → nodes reappear at saved x/y and channel/version/config match. The project file has top-level `kind:"sbcv-project"`+`schemaVersion`, so `sing-box check` / plain Import reject it with a clear message; Open rejects a bare config (no wrapper) without mutating state. Open shares Import's 10MB cap, overwrite-confirm, and Undo toast. Plain Export still writes a pruned bare `config.json`; plain Import still empties layout.
- **Tests (test-first):** `tests/project-save-load.test.ts` — createProjectExport/parseProjectJson round-trips positions+config and emits `kind:"sbcv-project"`+numeric `schemaVersion`; wrapper↔config distinctness (each rejects the other's output); testing-channel config keeps `http_clients`/`certificate_providers`; bad `kind`/`schemaVersion`/malformed `positions` throw. `tests/store-load-project.test.ts` — `loadProject` sets `layout.positions` from file (not `{}`), updates channel/version, bumps tokens, and `{snapshot:true}`→`undo()` restores prior state; regression: `importJson` still empties positions.
- **Reviewer:** serialization/round-trip (domain serialization + store load action; secondary canvas/React-Flow for position re-hydration).
- **Don't mix:** Don't change plain Export/Import behavior (leave `importJson`'s `freshLayoutState` reset at :1825); keep the `sbcv-project` wrapper strictly distinct from the sing-box config root; no localStorage/auto-persist, multi-file projects, or auto-arrange; copy changes only to disambiguate the two formats.
- **Slice:** (a) domain-only — type discriminator + create/parseProjectJson + `tests/project-save-load.test.ts` (no UI, independently mergeable, de-risks the round-trip contract); (b) store+UI — loadProject/saveProject + TopBar Save/Open + `tests/store-load-project.test.ts`.

---

### Phase P3 — Re-assessment (definition of done)

backlog 全部合并后,**重跑评估 workflow 复测**,而非自我宣布完成。

1. 用 Workflow 工具重新启动评估流水线:
   ```js
   Workflow({ scriptPath: "scripts/workflows/canvas-config-gen-review.workflow.js" })
   ```
2. 把它返回的 `reportMarkdown` 写入一份**全新的日期化文件** `docs/canvas-config-gen-assessment-<YYYY-MM-DD>.md`(不要覆盖 2026-05-30 那份;新旧并置以便对比 reachability 提升)。
3. **Goal DONE 的判据**(以重跑结果为准):
   - **纯 GUI 可达性显著提升 —— 目标 ≥90%**(基线 60-70%);
   - **任何主流构造零强制 JSON 回退** —— 重跑报告第 5.2 节"被迫落到原始 JSON"表中不得出现任何主流构造;C17 守卫在 CI 内保证无新的静默不可达字段;
   - **无 P0/P1 finding 仍未解决或未显式 deferred**(每个未做项必须在 Milestone Notes / Decision Log 写明 deferred 理由);
   - **serialization-correctness 保持 strong**;
   - **没有任何维度回退**(六维评分无一从 adequate/strong 跌落)。
4. 若重跑仍暴露 P0/P1,把它作为下一个原子项入队(不扩大 scope),修完再重跑,直至判据满足。

## Validation Matrix

每个原子项落地前后跑这张矩阵(Required Goal Checks):

| Case | Check |
| --- | --- |
| stable config(fixtures/stable) | `pnpm validate:fixtures` → `sing-box-stable check`(stable 1.13 二进制) |
| testing config(fixtures/testing) | `sing-box-testing check`(testing 1.14 二进制);1.12/legacy 路径走 `sing-box-1.12` |
| app code(domain + components) | `pnpm exec tsc -b` + `pnpm test`(vitest)+ `pnpm build` |
| frontend diff(src/components/** 或 src/state/**) | `vercel-react-best-practices` skill gate(同一 session 内) |
| e2e / smoke | `pnpm e2e`(Playwright);用户路径走通(palette 创建 → 编辑 → 连边 → 导出) |
| pruned-export ↔ binary(C15 落地后) | `pnpm release:check` 内的 `export-binary-check`(把 pruned 导出喂真实二进制) |

## Acceptance Criteria

- 每个原子项满足其 detail block 的 `Acceptance`(observable behavior + test-first 测试 + don't-mix 守住)。
- 单一可信源:每个原子项引用了其对应的 `docs/upstream/...` 源文档,字段/枚举/版本判定与该文档一致(markers 忠实转写)。
- 全程 `pnpm exec tsc -b` + `pnpm test` + `pnpm build` + `pnpm e2e` 绿;C15 落地后 `pnpm release:check` 绿。
- 每个 PR 经一位最匹配领域的 Claude Code 专家 reviewer subagent 一次 pass、应用可执行发现后合并;PR gate + main issue gate clean。
- P3 重跑评估显示 reachability ≥90% 且主流构造零强制 JSON 回退、serialization 仍 strong、无维度回退、无未解释的 P0/P1。

## Done Definition

- [ ] P0(C0–C3)合并:声明式 schema 表落地降本 + 三个最痛的纯 GUI 缺口闭合。
- [ ] P1(C4–C10、C17)合并:版本门控精确化 + 导出门控统一 + 两个静默误报修复 + 静默不可达守卫。
- [ ] P2(C11–C16)合并:可写边 + 递归规则 + 注册表驱动 + Inspector 拆分 + CI 二进制复检 + 项目 save/load。
- [ ] P3 重跑评估完成,写入新 `docs/canvas-config-gen-assessment-<YYYY-MM-DD>.md`,判据(≥90% reachability 且主流零回退、serialization strong、无回退、无未解释 P0/P1)满足。
- [ ] 每个原子项有 Milestone Note;每条 deferred 在 Decision Log 留痕。
- [ ] 所有合并经 squash PR,无直接 push to main;最终在 GitHub 可验证。

## Running TODO

Mirror of the queue above; tick as merged. (Populated during execution.)

- [x] C0-schema-registry (S1–S5) — #152, #153, #154, #155, #156
- [x] C1-transport-subfields — #157
- [x] C2-cert-provider-create — A (creation) #166 + B (per-type Inspector editor) #180
- [x] C3-tls-acme — #161
- [x] C4-cloudflared-create — #158
- [x] C5-version-gate-legacy-dns — #159
- [x] C6-version-gate-naive — #162
- [x] C7-version-gate-channel-to-version — A (min-version single-source) #172, B (1.13 TLS fields) #174, C (route bypass / interface_address / local DNS prefer_go) #176
- [x] C8-export-gate-unify — #160
- [x] C9-dup-tag-namespace — #169
- [x] C10-hysteria-server-ports — #164
- [x] C17-no-silent-unreachable-guard — #181
- [x] C11-detour-endpoint-edges — C11a #171 + C11b (dial-domain-resolver) #178 + C11c (http_client edges) #179
- [x] C12-logical-rule-recursion — #168
- [ ] C13-registry-driven-portswitch (S1/S2/S3)
- [ ] C14-inspector-split (S1–S10)
- [x] C15-ci-binary-check — #163
- [x] C16-project-save-load — a (domain wrapper) #170 + b-store (loadProject/saveProject) #173 + b-UI (TopBar Save/Open) #177
- [ ] P3 re-assessment

## Decision Log

(Append dated entries as decisions are made during execution.)

- 2026-05-30 — Sequencing: C0 lands first (de-risks/降本 for the rest); C1–C3 are independently shippable and need not wait on C0; C14-S10 (data-driven scalar renderer) is explicitly blocked on C0.
- 2026-05-30 — Source corrections folded in from the grounded backlog: C9 stable inbound-tag is **line 40** (testing copy is line 41, shifted by the `cloudflared` row); C14 testing top-level keys are a **12-key superset** (adds `certificate_providers` + `http_clients`), NOT identical to stable's 10 (the assessment's "9/identical" phrasings were corrected); C1 HTTP `idle_timeout` default = **zero per prose L91** (the JSON example L39 "15s" is example-only); C3 testing `tls.acme` carries `Deprecated in sing-box 1.14.0` (verified L715). Package manager is `pnpm` throughout (matches `release:check`).
- 2026-05-30 — Review gate is **per-PR best-suited Claude Code expert reviewer subagent(s)** (Agent tool), NOT Codex (per active MEMORY: the 2-round Codex gate was replaced 2026-05-29).
- 2026-05-30 — User decisions on the 4 open questions: (1) **P3 done-bar raised to ≥90% AND zero forced JSON-fallback for any mainstream construct** (harder than the ≥85% default) → motivated adding **C17-no-silent-unreachable-guard** (P1, test-only) to make "零回退" an enforceable CI invariant rather than an aspirational number; (2) sequencing keeps the default (C0 first, but C1–C3 independently shippable); (3) C2/C3 stay split (not merged into one ACME epic); (4) C13/C14 stay independent back-to-back (no slice interleave). Queue is now C0–C17.
- 2026-05-30 — Execution model: disjoint-file atomics run as concurrent PRs (one each touching domain/diagnostics, Inspector, useProjectStore, serialization/export) since GitHub squash-merge auto-merges non-overlapping diffs; same-file atomics stay sequential. Each PR rebased onto latest main before merge; post-merge issue gate run on combined main.
- 2026-05-30 — Local real-binary validation: `.tools/bin/` holds the three sing-box binaries (stable 1.13.12 / testing 1.14.0-alpha.25 / 1.12.25). Run the full `release:check` (incl. validate:fixtures/external + e2e + the C15 export-binary gate) **locally with `PATH="$PWD/.tools/bin:$PATH"` before pushing**, so CI is confirmation rather than discovery.
- 2026-05-30 — Known flaky e2e: `e2e/port-click-redesign.spec.ts:317` (node-delete hover opacity) flakes ~50% on CI's headless chromium (catches the CSS transition mid-flight) but is rock-solid locally; it hit unrelated domain-only PRs (S5/C4/C5). Mitigation = rerun the failed CI job, not debug the PR (it can't be reproduced/fixed-verified locally). See `[[project_flaky_e2e_node_delete_hover]]`.

## Milestone Notes

(Filled in during execution, one entry per atomic/slice — mirror the ux-language doc's format: Status / What changed / Tests / Expert review verdict + in-pass fixes / Verification commands.)

### C0-schema-registry (S1–S5) — DONE (#152–#156)
- **What:** New `src/domain/schemaRegistry.ts` declarative per-type table (factory / creatable / paletteKind / channel / version+deprecation markers / sharedGroups / proxy·tls·required flags) + typed selectors. Consumers flipped to derive from it, byte-identically: S1 seed + matches-today guards; S2 `protocols.ts` CREATABLE_* → `creatableTypes(kind)` (palette maps stay literal-typed); S3 `commands.create*()` → `schemaRow().factory()`; S4 `sharedFieldRegistry.sharedGroupsForEntity` + dial predicates → table; S5 `diagnostics.ts` proxy/tls/required Sets + cloudflared token → table.
- **Tests:** schema-registry{,-factory,-shared-groups,-diagnostics}.test.ts (matches-today characterization vs each live source); protocols-creatable-frozen, commands-factory-frozen, shared-groups-derived (frozen goldens proving derivation reproduces exact output).
- **Reviewer:** architecture/refactor (×5, one per slice) — APPROVE each; S1 SHOULD-FIX (add diagnostics-seam characterization test) applied; nits (docs-sourced markers comment, channel-field comment) applied. Exhaustive byte-equivalence verified (63 factory rows, 64 group combos, 3 diagnostics Sets).
- **Verify:** tsc -b clean; pnpm test green at every slice; pnpm build green; combined post-merge gate on main 1228 passed.

### C1-transport-subfields — DONE (#157)
- **What:** Every documented V2Ray transport sub-field editable from the Inspector card (http.method, ws.max_early_data/early_data_header_name, grpc.permit_without_stream, headers string-map) via a new `keyvalue` SharedFieldKind + a value-equality `visibleWhen` gate; per-variant visibility (quic = Type only). `transport` stays in handledFields.
- **Tests:** tests/v2ray-transport-subfields.test.tsx (per-variant visibility + typed round-trips + headers prune-to-undefined + inbound parity).
- **Reviewer:** domain schema-correctness (field contract vs v2ray-transport.md, line-by-line) + frontend gate — APPROVE, no findings.
- **Verify:** tsc -b clean; pnpm test 1237.

### C3-tls-acme — DONE (#161)
- **What:** Structured inbound (server-only) ACME editor + dns01_challenge sub-editor in the TLS card; provider-gated dns01 fields via `visibleWhen`, 1.14 dns01 fields channel-gated to testing, custom `https://` provider preserved (free-text). `tls` stays in handledFields.
- **Tests:** tests/tls-acme.test.tsx (inbound-shows / outbound-hides, channel gate, provider gate, custom-provider+cloudflare round-trip).
- **Reviewer:** domain schema-correctness (ACME/dns01 contract vs tls.md + dns01_challenge.md; inbound-only role gate confirmed) + frontend gate — APPROVE, no findings.
- **Verify:** full local `release:check` against real binaries — pnpm test 1242 · validate:fixtures 18 · validate:external 220 · e2e 23.

### C4-cloudflared-create — DONE (#158)
- **What:** `createFromPalette` cloudflared guard swapped from a hard type-exclusion to a testing channel gate (mirrors hysteria-realm/http-client); "Add Cloudflared" creates `{type,tag,token:""}` on testing, nothing on stable.
- **Tests:** tests/inbound-cloudflared.test.tsx (C4 block) — testing creates+selects, stable creates nothing, non-cloudflared unregressed, click-through renders the node.
- **Reviewer:** version-gating/diagnostics — APPROVE (empirically reverted the gate → the two bug-exercising tests fail; palette itemStatus alignment confirmed).
- **Verify:** tsc -b clean; cloudflared suite 9/9; full suite green.

### C5-version-gate-legacy-dns — DONE (#159)
- **What:** Legacy schema-prefixed DNS-server `address` and top-level `dns.fakeip` become **errors** on the 1.14 target (binary removed them) via `atLeast(version,"1.14")`; stay warnings on 1.12/1.13. Same codes; level+message branch.
- **Tests:** tests/version-gate-legacy-dns.test.ts (error on testing, warning on stable+1.12, single emission, "removed in sing-box 1.14.0" message).
- **Reviewer:** version-gating/diagnostics — APPROVE (severity vs docs verified; testing presets use modern DNS so unaffected). Test regex fixed in-pass ("removed in sing-box 1.14.0").
- **Verify:** tsc -b clean; pnpm test 1234.

### C6-version-gate-naive — DONE (#162)
- **What:** `naive` outbound emits a blocking error on the 1.12 target (Since 1.13.0) — code `outbound-naive-version`, path `/outbounds/${i}/type` — mirroring the ccm/ocm gate. Diagnostic-only.
- **Tests:** tests/outbound-naive-version.test.ts (1.12 error / 1.13·1.14 clean / path+level / summarize→error / non-naive negative).
- **Reviewer:** version-gating/diagnostics — APPROVE, no findings.
- **Verify:** tsc -b clean; pnpm test 1255; build green.

### C8-export-gate-unify — DONE (#160)
- **What:** Extracted `confirmAndExportConfig(config,diagnostics):boolean` to `src/components/exportConfig.ts` (+ `createSbcvFileName` moved, re-exported from TopBar); desktop and mobile export now share the same error-diagnostics confirm gate; mobile sources diagnostics from getState() and only closes the sheet on a proceeded export.
- **Tests:** tests/export-gate.test.tsx mobile describe (error+cancel keeps sheet open / error+confirm downloads / valid no-prompt) + 3 existing desktop cases stay green.
- **Reviewer:** React/perf — APPROVE (no new subscription / stale closure; no import cycle; behavior parity verified).
- **Verify:** tsc -b clean; pnpm test 1231.

### C15-ci-binary-check — DONE (#163)
- **What:** `tests/export-binary-check.test.ts` feeds `createConfigExport(parseConfigJson(fixture)).contents` (the pruned download bytes) through `sing-box check` on the matched binary for every internal fixture; reuses the singbox-target/check policies verbatim; warn-skips when binaries absent. Wired `validate:export-binary` into `release:check`, excluded from plain `test`.
- **Tests:** the gate itself (19 cases; asserts ≥1 pruned export differs from raw, proving the pruned path).
- **Reviewer:** serialization/round-trip + CI/tooling — APPROVE (one informational nit: differ-counter conflates prune+normalize; guarantee still holds).
- **Verify:** local real binaries — 18 pruned exports accepted, 19/19; tsc -b clean.

### C2-cert-provider-create slice A — DONE (#166)
- **What:** Certificate Providers palette items creatable on testing (gated stable): commands.createCertificateProvider (acme/cloudflare-origin-ca → `{type,tag,domain:[]}`; tailscale → `{type,tag,endpoint:""}`) + addCertificateProvider; createFromPalette testing-gated branch maps the four kinds → type (bare→acme, never the non-schema `certificate-provider`); Palette itemStatus flips `certificate-provider*` gated→setup on testing (shared-* duplicates stay reference-only).
- **Tests:** certificate-provider-create.test.ts (scaffold per type incl. required field; testing creates+selects; stable creates nothing; dedup). **Reviewer:** domain schema-correctness — APPROVE. **Verify:** tsc clean; pnpm test 1267; build.
- **Deferred:** slice B (per-type structured Inspector editor) — created nodes render via the generic Inspector fallback meanwhile.

### C9-dup-tag-namespace — DONE (#169)
- **What:** indexes.namespaceForKind (endpoint shares OUTBOUND namespace) + buildNamespacedTagIndex; diagnostics dup-tag loop keys on `${namespace} ${tag}` so cross-namespace tag reuse (inbound+outbound "proxy") no longer false-flags; same-namespace collisions still flagged. **Reviewer:** version-gating/diagnostics — APPROVE. **Verify:** tsc clean; pnpm test 1272; domain.test.ts:831 migrated to same-namespace.

### C10-hysteria-server-ports — DONE (#164)
- **What:** generalized the ssh absent-port exemption — an absent server_port is legal when ssh OR a non-empty `server_ports` array (port hopping); neither/empty/socks still error. **Reviewer:** version-gating/diagnostics — APPROVE. **Verify:** tsc clean; pnpm test 1267.

### C12-logical-rule-recursion — DONE (#168)
- **What:** InlineRuleSetEditor gains `depth`+`idPrefix`; a nested logical rule recurses with the same editor (Mode select + nested list), JSON hint only beyond MAX_INLINE_RULE_DEPTH (3). **Reviewer:** React/perf — APPROVE (bounded recursion, stable keys). **Verify:** tsc clean; pnpm test 1264.

### C16-project-save-load slice a (domain) — DONE (#170)
- **What:** SbcProject gains `kind:"sbcv-project"`+`schemaVersion`; serialization.createProjectExport/parseProjectJson (validates kind/schemaVersion/positions, normalizes inner config); ConfigExport.fileName widened to string. **Reviewer:** serialization/round-trip — APPROVE. **Verify:** tsc clean; pnpm test 1279.

### C11-detour-endpoint-edges slice a — DONE (#171)
- **What:** 6 dial-style detour edges resolve targets via outboundTargetNodeId (detour→endpoint renders endpoint:<tag>, not phantom outbound); 7 detour-target input relations gain extraNodeKinds ["endpoint"] so endpoint nodes render the handles + reflect connected state. **Reviewer:** canvas/React-Flow — APPROVE-WITH-NITS (connected-state widening applied in-pass). **Verify:** tsc clean; pnpm test 1292; e2e 24 (local real binaries).
- **Deferred:** C11b (dial-domain-resolver writable relation), C11c (http_client testing-gated edges).

### C7-version-gate slice A (min-version single-source) — DONE (#172)
- **What:** TYPE→min-version table extracted to domain/minVersions.ts; nodeLabels badge + diagnostics naive/ccm/ocm gates read the one source. Zero behavior change. **Reviewer:** architecture/refactor — APPROVE. **Verify:** tsc clean; pnpm test 1291.

### C7-version-gate slice B (1.13 TLS fields) — DONE (#174)
- **What:** a 1.12 target warns on set 1.13 TLS fields (kernel_tx/kernel_rx/curve_preferences both roles; client_authentication inbound-only); 1.13/1.14 clean; default-off silent. **Reviewer:** version-gating/diagnostics — APPROVE. **Verify:** tsc clean; pnpm test 1305.
- **Deferred:** C7-C (route bypass action / interface_address trio / local DNS prefer_go gates).

### C16-project-save-load slice b (store) — DONE (#173)
- **What:** store saveProject() (versioned wrapper) + loadProject() (re-hydrates layout positions — no freshLayoutState reset — restores channel/version, snapshots to undo, rejects a bare config); domain/appVersion.ts (APP_VERSION). **Reviewer:** serialization/round-trip + canvas — APPROVE. **Verify:** tsc clean; pnpm test 1293.
- **Deferred:** slice b-UI (TopBar Save/Open buttons).

<!-- devlog batch 3 (2026-05-30): C7-C / C16-b-UI / C11b / C11c / C2-B / C17 -->

### C7-version-gate slice C (1.13 route/DNS fields) — DONE (#176)
- **What:** a 1.12 target warns on 1.13-added route `bypass` action / `interface_address` trio / local DNS `prefer_go`; 1.13/1.14 clean. Completes C7. **Reviewer:** version-gating/diagnostics. **Verify:** tsc clean; pnpm test + real-binary release:check green.

### C16-project-save-load slice b-UI (TopBar Save/Open) — DONE (#177)
- **What:** TopBar "Save project" (downloads the `*.sbcv.json` wrapper) + "Open project" (file input → loadProject, re-hydrates layout/channel); distinct from plain Export/Import (which drop layout). Completes C16. **Verify:** real-binary release:check green.

### C11-detour-endpoint-edges slice b (dial-domain-resolver) — DONE (#178)
- **What:** dial.md `domain_resolver` (string OR object `.server`; 1.12+, required for domain-named servers since 1.14) modeled as a writable edge from a dial-bearing outbound/endpoint/dns-server into the referenced dns-server. Three relations per source kind (precise dial-group type gate; "tailscale" is dial as endpoint but not dns-server, so one shared nodeTypeExcludes can't serve all three). Inspector select stays the editor; adds canvas port + connect (preserves object siblings) + disconnect (drops string|object); no self-loop edge; no new diagnostics (reuses 1.14 requiredness warnings). **Reviewer:** canvas/React-Flow + reference-port — APPROVE (self-loop guard + object-connect test added). **Verify:** tsc clean; pnpm test 1328; real-binary release:check green (flaky e2e :317 reran).

### C11-detour-endpoint-edges slice c (http_client edges) — DONE (#179)
- **What:** the three 1.14-only `http_client` string refs (route.default_http_client / remote rule_set.http_client / acme|cloudflare-origin-ca cert-provider.http_client) + the shared HTTP-client object's own dial `detour` modeled as writable edges; the http-client node no longer floats. deriveGraph gains an optional `channel` (default "testing"; CanvasWorkspace threads the live store channel) so a stable target suppresses the edges + connectedPorts; only string form is edged (object form inline, per the C1-20 diagnostic). Reuses referenceRegistry cascade + existing testing-only diagnostics (no duplication); chip-create gains an http-client branch. **Reviewer:** canvas/React-Flow + reference-port/version-gating — APPROVE. **Verify:** tsc clean; pnpm test 1348; real-binary release:check green.

### C2-cert-provider-create slice B (per-type Inspector editor) — DONE (#180)
- **What:** a selected certificate_providers[] entry opens a per-type structured editor (acme: domain[]/email/provider/data_directory + 1.14 key_type/profile/account_key + EAB; cloudflare-origin-ca: domain[]/api_token/origin_ca_key/request_type/requested_validity; tailscale: endpoint picker) via the shared SharedFieldControl; remaining keys fall to Advanced JSON via certificateProviderHandledFields. testing-only → no in-editor channel gate. Also fixed a round-trip nit: clearing the last leaf of a nested object now drops the parent (hasMeaningfulValue guard in nestedPatch) instead of leaving `external_account: {}` — also cleans the C3 tls.acme path. Completes C2. **Reviewer:** domain schema-correctness — APPROVE (every field/enum/control cross-checked vs the cert-provider docs; the empty-object nit fixed). **Verify:** tsc clean; pnpm test 1336; real-binary release:check green.

### C17-no-silent-unreachable-guard — DONE (#181)
- **What:** plain-`pnpm test` CI invariant guard (no binary/e2e): exports inbound/outboundHandledFields + `structurallyCoveredKeys` (INLINE_RENDERED_KEYS ∪ shared-group field paths ∪ {tag,type}); asserts each kind's handledFields ⊆ keys covered on some channel (channel-union — the 1.14-removed `domain_strategy` is covered on stable only); synthetic-key negative case + anti-drift check (every inline key maps to a real updateField literal) + positive anchor (`transport` covered). Makes "零回退" an enforceable invariant — prevents reintroducing the C1/C3 silent-unreachable class. Guard/test infra only; per-field fixes stay separate atomics. **Reviewer:** React/perf + domain — APPROVE-WITH-NITS (all 4 applied: ReadonlySet typing, anti-drift test, limitation comment, positive anchor). **Verify:** tsc clean; pnpm test 1359; real-binary release:check green.
