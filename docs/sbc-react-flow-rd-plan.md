# SBC React Flow 研发计划

## 1. 项目目标

SBC 的目标是把 sing-box JSON 配置做成一个可视化配置编排器：用户可以像 Higgsfield Canvas / ComfyUI 一样在画布上理解和编辑主链路，但真正的配置真相始终是 sing-box 的 JSON/domain model，而不是画布节点本身。

核心目标：

- 以 `SingBoxConfig` JSON AST / domain model 作为唯一 source of truth。
- 以 React Flow 画布作为可视化编辑层，只表达对象关系、引用关系和主要流向。
- 支持导入、编辑、预览、校验、格式化、导出 sing-box `config.json`。
- 支持 `sing-box check`、`sing-box format`、schema validation、语义 lint 多层校验。
- 支持高级 JSON 模式，JSON 编辑器和表单/画布可以双向同步。
- 明确区分“图关系”和“有序规则列表”，不把 `route.rules` / `dns.rules` 误建模成自由 DAG。

## 2. 参考产品交互目标

参考 Higgsfield Canvas 截图，SBC 的节点体验需要满足以下目标：

- 每个节点都有自己的图标，例如 TUN、Route、DNS、Selector、URLTest、Direct、Block、Proxy、Endpoint。
- 每个节点都显示明确类型，例如 `Inbound / tun`、`Outbound / selector`、`Route / rule table`。
- 每个节点都有输入/输出连接点，连接点颜色或样式表达端口类型。
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

## 3. 核心原则

### 3.1 JSON / Domain Model 是真相

项目文件可以包含画布布局，但导出的 sing-box 配置只来自 `config`：

```ts
type SbcProject = {
  appVersion: string;
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

## 4. sing-box 模块映射

| sing-box 模块 | SBC 表达方式 | 是否放画布 | 备注 |
| --- | --- | --- | --- |
| `inbounds[]` | Inbound 节点 | 是 | TUN、Mixed、SOCKS、HTTP 等入口 |
| `route` | Route Hub 节点 + Route Rules 表 | 是 | `route.rules` 顺序由表格维护 |
| `outbounds[]` | Outbound 节点 | 是 | Direct、Block、Proxy、Selector、URLTest |
| `dns.servers[]` | DNS Server 节点 | 是 | 支持 Local、TCP、UDP、TLS、HTTPS 等 |
| `dns.rules[]` | DNS Rules 表 + 可选规则节点 | 部分 | 顺序逻辑必须表格化 |
| `endpoints[]` | Endpoint 节点 | 是 | WireGuard、Tailscale 等 |
| `services[]` | Service 节点 | 后期 | DERP、Resolved、SSM API 等 |
| `rule_set[]` | Rule Set 资源节点/列表 | 部分 | inline/local/remote |
| `log` / `ntp` / `experimental` | Settings 面板 | 否 | 全局设置不强行画布化 |

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

- 编辑当前节点对应的 JSON 字段。
- 表单由 node registry 和 schema registry 驱动。
- tag rename 必须支持引用级联更新。
- 危险字段、废弃字段、版本不兼容字段要显示提示。

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
4. Official validation：调用 `sing-box check` 作为最终准入。

格式化：

- 保存/导出前可调用 `sing-box format`。
- 多文件配置后期支持 `sing-box merge`。

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
- top-level config normalize。
- tag index / reference index。
- JSON import/export。
- 基础 semantic diagnostics。

验收：

- 可导入常见 sing-box JSON。
- 可导出无 layout/meta 的纯 `config.json`。
- 重复 tag、missing tag 能被发现。

### M2：基础画布与节点交互

交付：

- Inbound、Route、Outbound、Selector、URLTest 基础节点。
- 节点图标、类型标签、状态标记。
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

- 本地/服务端 `sing-box check` 集成。
- `sing-box format` 集成。
- 错误映射到 JSON path、Inspector 字段、Canvas 节点。

验收：

- 无效配置能看到官方错误。
- 有效配置能通过 `sing-box check`。
- 导出前可格式化。

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
- 复杂协议表单过早铺开，拖慢 MVP。
- 画布交互过重，反而降低配置效率。
- JSON Advanced 和表单状态冲突。

对应策略：

- 规则顺序只由表格维护。
- 引入 `singBoxVersion` 维度的 schema registry。
- MVP 先覆盖高频客户端配置。
- 画布聚焦关系理解，详细编辑交给 Inspector / Rule Table。
- JSON 编辑采用 parse 成功后整体提交，失败时保留 draft。

## 14. 开发约束

- 所有提交必须签名，并通过本地 `pre-push` 的 `git verify-commit` 检查。
- 导出的配置不能包含 SBC 私有 layout/meta 字段。
- 所有 tag 引用必须通过 command 层更新，不允许组件直接改深层 JSON。
- 任何新增节点类型必须先注册 Node Registry，再实现 UI。
- 任何新增协议表单必须有 fixture 和 round-trip 测试。

## 15. 参考资料

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

