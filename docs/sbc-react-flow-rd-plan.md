# SBC React Flow 研发计划

## 1. 项目目标

SBC 的目标是把 sing-box JSON 配置做成一个可视化配置编排器：用户可以像 Higgsfield Canvas / ComfyUI 一样在画布上理解和编辑主链路，但真正的配置真相始终是 sing-box 的 JSON/domain model，而不是画布节点本身。

核心目标：

- 以 `SingBoxConfig` JSON AST / domain model 作为唯一 source of truth。
- 以 React Flow 画布作为可视化编辑层，只表达对象关系、引用关系和主要流向。
- 以 SagerNet/sing-box `stable/docs/configuration` 作为默认字段和校验基线，以 `testing/docs/configuration` 作为前瞻字段来源。
- 支持导入、编辑、预览、校验、格式化、导出 sing-box `config.json`。
- 支持 `sing-box check`、`sing-box format`、schema validation、语义 lint 多层校验。
- 支持高级 JSON 模式，JSON 编辑器和表单/画布可以双向同步。
- 明确区分“图关系”和“有序规则列表”，不把 `route.rules` / `dns.rules` 误建模成自由 DAG。

## 2. 参考产品交互目标

参考 Higgsfield Canvas 截图，SBC 的节点体验需要满足以下目标：

- 每个节点都有自己的图标，例如 TUN、Route、DNS、Selector、URLTest、Direct、Block、Proxy、Endpoint。
- 每个节点都显示明确类型，例如 `Inbound / tun`、`Outbound / selector`、`Route / rule table`。
- 每个节点都有输入/输出连接点，连接点颜色或样式表达端口类型。
- 点击节点后节点显示明确选中态，例如蓝色描边、角点控制柄、悬浮操作条。
- 点击节点后右上/右侧打开该节点的专属编辑区域，类似参考图里的 `Video Generation` 属性面板。
- 节点编辑区域必须能编辑该 sing-box entity 的核心字段、引用字段、版本提示和校验错误。
- 鼠标移动到节点或连接点上时，显示可以对接的上游/下游节点类型。
- 可对接节点以小卡片/缩略节点图片展示，包含图标、类型、名称和简短说明。
- 在 hover 菜单中点击兼容节点类型，可以直接新增节点并建立引用关系。
- 已经添加的节点、连接线、引用关系，在 hover 或选中后可以删除。
- 删除连接线时，删除的是 JSON 中的引用关系，而不是一定删除两端实体。
- 删除节点时，必须明确处理引用：自动清理、提示影响范围，或阻止删除。

视觉目标：

- 深色无限画布，弱网格背景，节点卡片紧凑清晰。
- 主链路从左到右：Inbound -> Route -> Outbound / Selector -> Concrete Outbounds。
- 规则表、Inspector、JSON Preview 比装饰性画布更重要，界面应偏配置工具而不是营销页。
- 节点 hover 控件要轻量，避免遮挡主字段。
- 选中节点时，右侧编辑面板是主要编辑入口；画布节点只显示摘要和高频操作。

## 3. 核心原则

### 3.1 JSON / Domain Model 是真相

项目文件可以包含画布布局，但导出的 sing-box 配置只来自 `config`：

```ts
type SbcProject = {
  appVersion: string;
  singBoxChannel: "stable" | "testing";
  singBoxVersion: string;
  config: SingBoxConfig;
  layout: CanvasLayout;
};
```

`layout` 只保存节点坐标、折叠状态、视口位置、颜色等 UI 信息。它不能决定最终 sing-box 行为。

### 3.2 画布是派生视图

React Flow 的 `nodes` / `edges` 应该从 `config` 派生：

```txt
config -> selectors/indexes -> flow nodes/edges
```

用户在画布上的操作通过 command 修改 `config`：

```txt
canvas action -> domain command -> config mutation -> derived graph refresh
```

不要做：

```txt
flow nodes/edges -> generate config
```

这个方向会让规则顺序、tag 引用、默认值、废弃字段和高级 JSON 编辑变得不可控。

### 3.3 有序规则用表格，不用自由连线

sing-box 不是纯 DAG 工作流：

- `route.rules` 是按顺序匹配的规则列表。
- `dns.rules` 也是独立的按序匹配逻辑。
- `selector.outbounds` / `urltest.outbounds` 是 outbound tag 列表。
- 大量字段通过 `tag` 字符串引用其它对象。

因此画布只展示关系，规则顺序必须由专门的 Rule Table 编辑。

### 3.4 信息源核实原则

配置字段和版本语义必须先核实一手资料，再写入 schema registry / node registry。

信息源优先级：

1. 默认基线：SagerNet/sing-box 仓库 `stable` 分支的 `docs/configuration` 目录。
2. 前瞻来源：SagerNet/sing-box 仓库 `testing` 分支的 `docs/configuration` 目录。
3. 稳定公开来源：sing-box 官方配置文档站点。
4. 最终行为来源：对应版本的 `sing-box check`。

已经核实的关键事实：

- stable 与 testing 的 `docs/configuration/index.md` 都明确 sing-box 使用 JSON 作为配置文件格式。
- 官方配置站点的 `#fields` 列出完整顶层配置：`log`、`dns`、`ntp`、`certificate`、`certificate_providers`、`http_clients`、`endpoints`、`inbounds`、`outbounds`、`route`、`services`、`experimental`。
- stable 仓库文档当前顶层结构只列出 `log`、`dns`、`ntp`、`certificate`、`endpoints`、`inbounds`、`outbounds`、`route`、`services`、`experimental`。
- testing 仓库文档顶层结构额外包含 `certificate_providers`、`http_clients`，与官方配置站点一致。
- `route` 文档包含 `rules`、`rule_set`、`final` 等字段，`final` 是默认 outbound tag。
- `dns` 文档包含 `servers`、`rules`、`final` 等字段，`final` 是默认 DNS server tag。
- `route/rule.md` 和 `dns/rule.md` 都包含大量按序匹配条件、logical rule 和版本变更提示。
- `outbound/selector.md` 和 `outbound/urltest.md` 都通过 `outbounds` 字段引用 outbound tag 列表。
- testing 包含 stable 尚未纳入的 1.14 相关字段，例如 `route.default_http_client`、`route.find_neighbor`、`route.dhcp_lease_files`、`dns.optimistic`、`dns.timeout`、DNS response match 字段等。

落地约束：

- 新增或修改任何协议字段前，必须记录对应文档路径。
- 每个 schema registry、node registry、Inspector 表单条目都必须映射到 [sing-box 配置文档入口清单](sing-box-config-doc-inventory.md) 的一个入口。
- 任何 `Since`、`Deprecated`、`Removed` 信息都要进入版本化 schema metadata。
- 不能只根据 UI 直觉创建字段；字段必须能追溯到 sing-box 文档或 CLI 行为。
- 默认导出目标是 stable；不在目标 stable binary 支持范围内的字段必须显示禁用、警告或迁移建议。
- `stable` 和 `testing` 的配置校验必须调用不同版本的 sing-box binary，不能用同一个二进制假装覆盖两个通道。

### 3.5 版本通道策略

SBC 需要显式支持 sing-box 配置通道：

```ts
type SingBoxChannel = "stable" | "testing";

type SingBoxTarget = {
  channel: SingBoxChannel;
  version: string;
  docsBaseUrl: string;
  binaryName: "sing-box-stable" | "sing-box-testing";
};
```

默认行为：

- 新项目默认选择 `stable`。
- UI 目标版本只提供三个高频选项：`1.13 stable`、`1.12 Legacy`（stable binary 校验）、`1.14 testing`。
- 模板默认生成 stable 可用配置。
- stable 模式下不默认生成 stable 文档未列出的字段；如果用户显式启用，必须标记版本风险并以 stable binary 校验结果为准。
- testing 模式下可以显示前瞻字段，但字段必须带 `testing` 标记。
- 从 testing 配置切回 stable 时，必须提供兼容性报告和字段移除/降级建议。

Schema registry 必须按通道和版本分层：

```txt
schemaRegistry
├── stable
│   └── 1.x
└── testing
    └── 1.x
```

Fixture 也必须分层：

```txt
fixtures
├── stable
│   ├── minimal.json
│   ├── tun-route-selector.json
│   └── dns-rules.json
└── testing
    ├── minimal.json
    ├── tun-route-selector.json
    └── testing-only-fields.json
```

## 4. sing-box 顶层模块覆盖

SBC 的 domain model 必须覆盖官方 `#fields` 中列出的完整顶层结构。画布是否展示是产品表达问题，不影响 domain model 对字段的识别、导入、校验和导出。

| sing-box 模块 | SBC 表达方式 | 是否放画布 | 通道策略 | 备注 |
| --- | --- | --- | --- | --- |
| `log` | 独立 Settings 节点 + Inspector | 可选独立节点 | stable 默认 | 全局日志设置，不参与链路连线 |
| `dns` | DNS Hub 节点 + DNS Rules 表 + DNS Server 节点 | 是 | stable 默认 | `dns.rules` 顺序必须表格化 |
| `ntp` | 独立 Settings 节点 + Inspector | 可选独立节点 | stable 默认 | 全局时间同步设置，不参与链路连线 |
| `certificate` | 独立 Settings 节点 + Inspector | 可选独立节点 | stable 默认 | 证书全局配置，不参与流量链路 |
| `certificate_providers[]` | Certificate Provider 资源列表/节点 | 部分 | version-gated | 官方站点/testing 有；stable 文档缺失时需 stable binary 验证 |
| `http_clients[]` | HTTP Client 资源列表/节点 | 部分 | version-gated | 远程 rule-set、route default HTTP client 等会引用 |
| `endpoints[]` | Endpoint 节点 | 是 | stable 默认 | WireGuard、Tailscale 等底层接口 |
| `inbounds[]` | Inbound 节点 | 是 | stable 默认 | TUN、Mixed、SOCKS、HTTP 等入口 |
| `outbounds[]` | Outbound 节点 | 是 | stable 默认 | Direct、Block、Proxy、Selector、URLTest |
| `route` | Route Hub 节点 + Route Rules 表 | 是 | stable 默认 | `route.rules` 顺序由表格维护 |
| `services[]` | Service 节点/列表 | 后期 | stable 默认 | DERP、Resolved、SSM API 等 |
| `experimental` | 独立 Settings 节点 + Inspector | 可选独立节点 | stable 默认 | Cache File、Clash API、V2Ray API 等，不参与链路连线 |

画布添加策略：

- **链路节点**：Inbound、Route、Route Rule、DNS、DNS Rule、DNS Server、Outbound、Endpoint、Service。它们有输入/输出端口，端口代表 tag 引用、final 引用、detour 引用或成员列表引用。
- **独立设置节点**：Log、NTP、Certificate、Experimental。它们可以从 Palette 添加到画布，点击后在 Inspector 编辑顶层对象，但没有左右端口，不参与边关系。
- **资源节点**：HTTP Client、Certificate Provider、Rule Set。它们不是流量节点，但可能被其它节点引用；初期可以作为资源表/独立节点，ready 前只能作为 Docs 入口。
- **Shared 字段族**：Listen、Dial、TLS、HTTP2、QUIC、DNS01 Challenge、Pre-match、Multiplex、V2Ray Transport、UDP over TCP、TCP Brutal、Wi-Fi State、Neighbor Resolution。它们不能直接拖成节点，必须嵌入所属节点的 Inspector 子表单。

画布派生对象还包括：

| 派生对象 | 来源 | SBC 表达方式 | 备注 |
| --- | --- | --- | --- |
| `dns.servers[]` | `dns` | DNS Server 节点 | 支持 Local、TCP、UDP、TLS、HTTPS 等 |
| `dns.rules[]` | `dns` | DNS Rules 表 + 可选规则节点 | 顺序逻辑必须表格化 |
| `route.rule_set[]` / rule-set config | `route` / top-level rule-set docs | Rule Set 资源节点/列表 | inline/local/remote |

## 5. 节点系统设计

### 5.1 Node Registry

所有节点类型必须从 registry 声明，不能在组件里散落硬编码：

```ts
type NodeKind =
  | "inbound"
  | "route"
  | "route-rule"
  | "dns-server"
  | "dns-rule"
  | "outbound"
  | "selector"
  | "urltest"
  | "endpoint"
  | "rule-set"
  | "service"
  | "settings";

type PortKind =
  | "traffic-source"
  | "route-input"
  | "route-output"
  | "outbound-ref"
  | "dns-query"
  | "dns-server-ref"
  | "endpoint-ref"
  | "rule-set-ref";

type SbcNodeDefinition = {
  kind: NodeKind;
  type: string;
  title: string;
  icon: string;
  colorToken: string;
  description: string;
  entityPath: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  compatibleUpstream: NodeCompatibility[];
  compatibleDownstream: NodeCompatibility[];
  createDefaultEntity: CreateEntityFn;
  inspectorSchema: InspectorSchemaRef;
};
```

### 5.2 节点卡片内容

每个节点卡片至少包含：

- 图标：表达协议/模块，例如 shield、route、globe、plug、ban、shuffle。
- 类型标签：例如 `Inbound`、`Outbound`、`DNS Server`。
- 实体名称：优先显示 `tag`，没有 tag 时显示临时名称。
- 关键摘要：例如监听地址、目标服务器、规则数量、候选 outbound 数量。
- 状态标记：valid、warning、error、missing reference、deprecated。
- 输入/输出端口：端口 tooltip 显示可以连接的类型。

### 5.3 兼容节点预览

hover 到节点边缘或端口时显示兼容节点面板：

```txt
Add downstream
├── Route Hub
├── Direct Outbound
├── Block Outbound
├── Selector Group
└── URLTest Group
```

预览卡片包含：

- 节点小图标。
- 节点类型。
- 节点名称模板。
- 简短说明。
- 创建后会写入的 JSON 模块路径。

点击预览卡片后：

1. 创建 domain entity。
2. 生成唯一 tag。
3. 写入合法引用关系。
4. 创建/更新 layout 坐标。
5. 派生 React Flow graph。
6. 选中新节点并打开 Inspector。

## 6. 节点连接规则

### 6.1 初始兼容矩阵

| 上游 | 下游 | 写入 JSON 的行为 |
| --- | --- | --- |
| Inbound | Route | 可视化主链路，通常不写额外字段 |
| Route Rule | Outbound | `route.rules[index].outbound = outbound.tag` |
| Route | Outbound | `route.final = outbound.tag` |
| Route | Selector | `route.final = selector.tag` |
| Selector | Outbound | `selector.outbounds.push(outbound.tag)` |
| URLTest | Outbound | `urltest.outbounds.push(outbound.tag)` |
| DNS Rule | DNS Server | `dns.rules[index].server = server.tag` |
| DNS | DNS Server | `dns.final = server.tag` |
| Route Rule | Rule Set | `route.rules[index].rule_set.push(ruleSet.tag)` |
| DNS Rule | Rule Set | `dns.rules[index].rule_set.push(ruleSet.tag)` |

### 6.2 禁止行为

- 不允许把两个普通 outbound 直接连成“执行流”。
- 不允许通过拖线改变 `route.rules` 顺序。
- 不允许通过拖线绕过 tag 唯一性校验。
- 不允许创建会导致循环引用的 selector/urltest 嵌套，除非 sing-box 版本明确支持且 `sing-box check` 通过。

### 6.3 删除语义

删除连接线：

- 删除对应 JSON 引用。
- 不删除两端对象。
- 如果引用来自规则表字段，规则表同步更新。

删除节点：

- 如果没有被引用，直接删除对应 entity。
- 如果被引用，展示影响范围。
- 可选操作：取消、删除并清理引用、只从画布隐藏。

## 7. 主要界面结构

```txt
┌───────────────────────────────────────────────────────────────┐
│ Top Bar: project name / import / export / check / format       │
├───────────────┬───────────────────────────┬───────────────────┤
│ Node Palette  │ React Flow Canvas          │ Inspector         │
│ Templates     │ Main topology view         │ Entity form       │
│ Search        │ Hover add/delete controls  │ References        │
├───────────────┴───────────────────────────┴───────────────────┤
│ Route Rules / DNS Rules / JSON Preview / Diagnostics           │
└───────────────────────────────────────────────────────────────┘
```

### 7.1 Canvas

- 展示主链路和对象关系。
- 支持拖拽、框选、缩放、自动布局。
- 支持 hover 添加兼容节点。
- 支持 hover 删除节点/连接。
- 支持 missing reference 节点占位，帮助用户修复坏配置。

### 7.2 Inspector

- 点击节点后打开当前节点对应的编辑面板。
- 面板默认停靠在右侧；在宽屏上可表现为右上角属性区，和参考图中的节点编辑区域一致。
- 面板标题显示节点类型和实体名，例如 `Outbound / selector / proxy`。
- 面板编辑当前节点对应的 JSON 字段。
- 表单由 node registry 和 schema registry 驱动。
- 表单分区包括基础字段、协议字段、引用字段、版本提示、诊断结果。
- 基础字段至少包括 `type`、`tag`、启用状态、备注或显示名。
- 引用字段必须显示被引用对象的状态，例如存在、缺失、重复、版本不兼容。
- 面板中的新增/删除候选引用必须复用 canvas compatibility matrix，避免两套规则。
- tag rename 必须支持引用级联更新。
- 危险字段、废弃字段、版本不兼容字段要显示提示。
- 面板修改必须通过 domain command 写入 canonical config，不能直接修改 React Flow node data。

### 7.3 Rule Tables

Route Rules 表：

- 拖拽排序。
- 编辑 match 条件。
- 编辑 action。
- 选择 outbound tag。
- 支持 logical rule 嵌套编辑。

DNS Rules 表：

- 拖拽排序。
- 编辑 query/match 条件。
- 编辑 action/server。
- 支持 response match / evaluate 等高级逻辑。

### 7.4 JSON Preview / Advanced JSON

- 实时显示 canonical config。
- 支持格式化。
- 支持直接编辑 JSON。
- JSON 编辑成功后重新 normalize，失败时保留错误位置。

## 8. 数据与状态架构

### 8.1 Store 分层

```txt
domainStore
├── config
├── indexes
├── diagnostics
└── commands

canvasStore
├── layout
├── selection
├── viewport
└── hoverIntent

editorStore
├── activePanel
├── jsonDraft
└── validationState
```

### 8.2 Command 示例

```ts
type DomainCommand =
  | { type: "createInbound"; inboundType: string; position?: XYPosition }
  | { type: "createOutbound"; outboundType: string; position?: XYPosition }
  | { type: "connectRouteFinal"; outboundTag: string }
  | { type: "connectRouteRuleOutbound"; ruleId: string; outboundTag: string }
  | { type: "connectSelectorCandidate"; selectorTag: string; outboundTag: string }
  | { type: "renameTag"; from: string; to: string }
  | { type: "deleteEntity"; entityRef: EntityRef; cleanupRefs: boolean };
```

所有 command 必须可测试，并且能生成 diagnostics。

## 9. 校验策略

校验分四层：

1. JSON parse：确保文本是合法 JSON。
2. Schema validation：确保字段类型、枚举、必填项基本正确。
3. Semantic lint：确保 tag 唯一、引用存在、规则顺序合理、版本字段兼容。
4. Official validation：调用目标通道对应的 `sing-box check` 作为最终准入。

格式化：

- 保存/导出前可调用 `sing-box format`。
- 多文件配置后期支持 `sing-box merge`。

版本化校验矩阵：

| 目标 | 文档来源 | 校验 binary | 必须通过 |
| --- | --- | --- | --- |
| stable | `SagerNet/sing-box/stable/docs/configuration` | `sing-box-stable` | 是，默认阻断 |
| testing | `SagerNet/sing-box/testing/docs/configuration` | `sing-box-testing` | 是，但仅对 testing 目标阻断 |

CI 要求：

- stable fixture 必须通过 `sing-box-stable check`。
- testing fixture 必须通过 `sing-box-testing check`。
- stable fixture 不允许包含 stable binary 无法通过的字段。
- 如果同一 fixture 声明为 dual-compatible，必须同时通过两个 binary。
- `format` 和 `merge` 也应按目标通道调用对应 binary。

## 10. 研发里程碑

### M0：项目骨架

交付：

- Next.js / React / TypeScript 项目。
- React Flow 基础画布。
- Zustand 或等价状态层。
- 基础 UI 组件和暗色主题。
- GitHub commit signing 工作流保持开启。

验收：

- 本地可以启动页面。
- 页面包含 Canvas、Inspector、JSON Preview 三块区域。
- 每次 commit 在 GitHub 上显示 Verified。

### M1：Domain Model 与导入导出

交付：

- `SingBoxConfig` 类型。
- `SingBoxChannel` / `SingBoxTarget` 类型。
- 官方 Configuration 导航入口清单。
- stable-first schema registry。
- top-level config normalize。
- tag index / reference index。
- JSON import/export。
- 基础 semantic diagnostics。

验收：

- 可导入常见 stable sing-box JSON。
- 可导入官方 `#fields` 中列出的完整顶层 key。
- 可导出无 layout/meta 的纯 `config.json`。
- 重复 tag、missing tag 能被发现。
- stable 模式不会默认导出 stable binary 无法通过的字段。

### M2：基础画布与节点交互

交付：

- Inbound、Route、Outbound、Selector、URLTest 基础节点。
- 节点图标、类型标签、状态标记。
- 点击节点打开右侧节点编辑面板。
- hover 显示兼容上游/下游节点预览。
- hover 添加节点并建立 JSON 引用。
- hover 删除连接和节点。

验收：

- 可以在画布上搭出：TUN -> Route -> Selector -> HK/JP/URLTest。
- JSON Preview 实时生成对应 sing-box JSON。
- 删除连接后 JSON 引用同步消失。

### M3：Route Rules / DNS Rules

交付：

- Route Rules 表格编辑。
- DNS Servers 节点。
- DNS Rules 表格编辑。
- 规则排序、复制、禁用、删除。
- 规则连接 outbound/server tag。

验收：

- 可以表达 `domain_suffix: cn -> direct`、`domain_keyword: ads -> block`、`final -> proxy`。
- 规则顺序只由表格控制。
- 画布只展示规则到目标对象的引用。

### M4：Inspector 与协议表单

交付：

- schema-driven Inspector。
- TUN、Mixed、SOCKS、HTTP inbound 表单。
- Direct、Block、SOCKS、HTTP、Shadowsocks、VLESS、Trojan、Hysteria2 outbound 表单。
- Selector、URLTest 完整字段。

验收：

- 表单编辑和 JSON 编辑双向同步。
- tag rename 能安全更新所有引用。
- deprecated/version warning 可见。

### M5：官方 CLI 校验

交付：

- 本地/服务端 `sing-box-stable check` 集成。
- 本地/服务端 `sing-box-testing check` 集成。
- 按目标通道调用对应 binary 的 `sing-box format`。
- 错误映射到 JSON path、Inspector 字段、Canvas 节点。

验收：

- stable 无效配置能看到 stable binary 的官方错误。
- testing 无效配置能看到 testing binary 的官方错误。
- stable 有效配置必须通过 `sing-box-stable check`。
- testing 有效配置必须通过 `sing-box-testing check`。
- dual-compatible 配置必须同时通过两个 binary。
- 导出前可用目标通道对应 binary 格式化。

### M6：高级能力

交付：

- 模板库。
- 自动布局。
- 子图/折叠分组。
- rule-set 管理。
- 配置 diff。
- 多文件 merge。
- 分享和协作。

验收：

- 用户能从模板快速生成常见客户端配置。
- 大型配置在画布上仍然可读。

## 11. 测试计划

单元测试：

- normalize。
- tag index。
- reference index。
- command reducer。
- graph derivation。
- semantic lint。

Fixture 测试：

- 最小配置。
- TUN + Route + Direct/Block/Selector。
- DNS servers + DNS rules。
- Selector / URLTest outbounds。
- missing reference。
- duplicate tag。

E2E 测试：

- 导入 JSON。
- hover 添加兼容节点。
- 删除连接。
- 修改 Inspector。
- 拖拽排序 route rules。
- JSON Advanced 编辑同步。
- 导出并运行校验。
- stable fixture 使用 stable binary 校验。
- testing fixture 使用 testing binary 校验。

## 12. 首批模板

### 12.1 TUN 分流客户端

```txt
TUN Inbound
  -> Route
    -> cn rule -> Direct
    -> ads rule -> Block
    -> final -> Proxy Selector
      -> HK Proxy
      -> JP Proxy
      -> URLTest Auto
```

### 12.2 DNS 分流

```txt
DNS
  -> cn domains -> Local DNS
  -> foreign domains -> Remote DoH
  -> final -> Remote DoH
```

### 12.3 代理组

```txt
Selector
  -> Manual HK
  -> Manual JP
  -> URLTest Auto
```

## 13. 主要风险

- 把规则顺序错误地建模成图，导致配置语义错误。
- sing-box 版本变化导致字段废弃或行为变化。
- stable/testing 文档和 binary 行为不一致。
- 复杂协议表单过早铺开，拖慢 MVP。
- 画布交互过重，反而降低配置效率。
- JSON Advanced 和表单状态冲突。

对应策略：

- 规则顺序只由表格维护。
- 引入 `singBoxVersion` 维度的 schema registry。
- 引入 `singBoxChannel`，stable 是默认阻断通道，testing 是显式 opt-in 通道。
- 下载并缓存两套 sing-box binary，校验时严格按目标通道选择。
- MVP 先覆盖高频客户端配置。
- 画布聚焦关系理解，详细编辑交给 Inspector / Rule Table。
- JSON 编辑采用 parse 成功后整体提交，失败时保留 draft。

## 14. 开发约束

- 所有提交必须签名，并通过本地 `pre-push` 的 `git verify-commit` 检查。
- 导出的配置不能包含 SBC 私有 layout/meta 字段。
- 默认导出配置必须以 stable schema 为准，并通过 stable binary 校验。
- testing-only 配置必须显式标记 `singBoxChannel: "testing"`。
- stable/testing 校验必须使用不同版本的 sing-box binary。
- 所有 tag 引用必须通过 command 层更新，不允许组件直接改深层 JSON。
- 任何新增节点类型必须先注册 Node Registry，再实现 UI。
- 任何新增协议表单必须有 fixture 和 round-trip 测试。

## 15. 参考资料

- SBC sing-box config document inventory: [sing-box-config-doc-inventory.md](sing-box-config-doc-inventory.md)
- SagerNet/sing-box stable configuration docs: https://github.com/SagerNet/sing-box/tree/stable/docs/configuration
- SagerNet/sing-box stable configuration index: https://raw.githubusercontent.com/SagerNet/sing-box/stable/docs/configuration/index.md
- SagerNet/sing-box stable route docs: https://raw.githubusercontent.com/SagerNet/sing-box/stable/docs/configuration/route/index.md
- SagerNet/sing-box stable DNS docs: https://raw.githubusercontent.com/SagerNet/sing-box/stable/docs/configuration/dns/index.md
- SagerNet/sing-box stable route rule docs: https://raw.githubusercontent.com/SagerNet/sing-box/stable/docs/configuration/route/rule.md
- SagerNet/sing-box stable DNS rule docs: https://raw.githubusercontent.com/SagerNet/sing-box/stable/docs/configuration/dns/rule.md
- SagerNet/sing-box stable selector outbound docs: https://raw.githubusercontent.com/SagerNet/sing-box/stable/docs/configuration/outbound/selector.md
- SagerNet/sing-box stable URLTest outbound docs: https://raw.githubusercontent.com/SagerNet/sing-box/stable/docs/configuration/outbound/urltest.md
- SagerNet/sing-box testing configuration docs: https://github.com/SagerNet/sing-box/tree/testing/docs/configuration
- SagerNet/sing-box testing configuration index: https://raw.githubusercontent.com/SagerNet/sing-box/testing/docs/configuration/index.md
- SagerNet/sing-box testing route docs: https://raw.githubusercontent.com/SagerNet/sing-box/testing/docs/configuration/route/index.md
- SagerNet/sing-box testing DNS docs: https://raw.githubusercontent.com/SagerNet/sing-box/testing/docs/configuration/dns/index.md
- SagerNet/sing-box testing route rule docs: https://raw.githubusercontent.com/SagerNet/sing-box/testing/docs/configuration/route/rule.md
- SagerNet/sing-box testing DNS rule docs: https://raw.githubusercontent.com/SagerNet/sing-box/testing/docs/configuration/dns/rule.md
- SagerNet/sing-box testing selector outbound docs: https://raw.githubusercontent.com/SagerNet/sing-box/testing/docs/configuration/outbound/selector.md
- SagerNet/sing-box testing URLTest outbound docs: https://raw.githubusercontent.com/SagerNet/sing-box/testing/docs/configuration/outbound/urltest.md
- sing-box configuration: https://sing-box.sagernet.org/configuration/
- sing-box route: https://sing-box.sagernet.org/configuration/route/
- sing-box DNS: https://sing-box.sagernet.org/configuration/dns/
- sing-box inbound: https://sing-box.sagernet.org/configuration/inbound/
- sing-box outbound: https://sing-box.sagernet.org/configuration/outbound/
- ComfyUI workflow: https://docs.comfy.org/development/core-concepts/workflow
- ComfyUI nodes: https://docs.comfy.org/development/core-concepts/nodes
- ComfyUI links: https://docs.comfy.org/development/core-concepts/links
- ComfyUI subgraph: https://docs.comfy.org/interface/features/subgraph
- Higgsfield Canvas: https://higgsfield.ai/canvas-intro
