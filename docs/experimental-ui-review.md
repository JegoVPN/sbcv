# Experimental UI Review

本评审只针对 `experimental` 配置在当前 SBC 画布里的表达方式。判断依据是本地 sing-box stable/testing 文档：

- `.tmp/sing-box-docs/stable/docs/configuration/experimental/index.md`
- `.tmp/sing-box-docs/stable/docs/configuration/experimental/cache-file.md`
- `.tmp/sing-box-docs/stable/docs/configuration/experimental/clash-api.md`
- `.tmp/sing-box-docs/stable/docs/configuration/experimental/v2ray-api.md`
- `.tmp/sing-box-docs/testing/docs/configuration/experimental/cache-file.md`
- `docs/sing-box-config-doc-inventory.md`
- `docs/sing-box-canvas-configuration-guide.md`

## Official Model

`experimental` 是顶层全局配置，不是流量链路对象：

```json
{
  "experimental": {
    "cache_file": {},
    "clash_api": {},
    "v2ray_api": {}
  }
}
```

它没有 `tag`，没有上下游引用关系，也不是 route/dns/outbound 的目标。正确表达是一个全局 Settings 入口，内部再分成三个模块。

## Field Scope

### Cache File

stable 字段：

- `enabled`
- `path`
- `cache_id`
- `store_fakeip`
- `store_rdrc`
- `rdrc_timeout`

testing 差异：

- `store_rdrc` 在 1.14 起 deprecated，后续会移除。
- `store_dns` 是 1.14 testing 新字段。

UI 结论：

- `enabled` 必须是主开关。
- `path`、`cache_id` 是普通高级字段。
- `store_fakeip` 是常用开关，可以露出。
- `store_rdrc` 必须带 target/version warning；testing 下不应该默认推荐。
- `rdrc_timeout` 只有启用 `store_rdrc` 时才展示。
- `store_dns` 只在 `1.14 testing` 展示，stable/legacy 不展示也不导出。

### Clash API

stable 字段：

- `external_controller`
- `external_ui`
- `external_ui_download_url`
- `external_ui_download_detour`
- `secret`
- `default_mode`
- `access_control_allow_origin`
- `access_control_allow_private_network`

deprecated 字段：

- `store_mode`
- `store_selected`
- `store_fakeip`
- `cache_file`
- `cache_id`

UI 结论：

- `external_controller` 是启用条件；为空代表 Clash API 关闭。
- 如果监听 `0.0.0.0`，`secret` 应强提示必填。
- `external_ui_download_detour` 是 outbound tag 引用，但不需要画布连线，应该用 Inspector 下拉选择 outbound。
- deprecated 字段不能作为主表单出现；如果导入旧配置，应只在迁移/诊断里提示。
- `default_mode` 应使用枚举选择，不应该是裸输入框。
- CORS 字段是高级字段，默认折叠合理。

### V2Ray API

stable/testing 文档都说明默认安装不包含 V2Ray API，需要 build tag。

字段：

- `listen`
- `stats.enabled`
- `stats.inbounds`
- `stats.outbounds`
- `stats.users`

UI 结论：

- V2Ray API 必须显示 build-tag 风险提示。
- `listen` 为空代表禁用。
- `stats.inbounds` 和 `stats.outbounds` 应该是从现有 tag 中多选，不应该让用户手写。
- `stats.users` 可以是文本列表，但要标明它不是 node tag。

## Screenshot Review

### Left: Add Library

#### `ADD LIBRARY`

必要性：合理。它告诉用户这里是添加配置对象的入口。

问题：对 `Experimental` 这种全局设置，`ADD LIBRARY` 容易暗示会添加一个可连线节点。实际它只是在 canonical JSON 中创建或聚焦 `experimental`。

建议：保留标题，但对 Settings 类目使用更明确动作文案，例如 `OPEN SETUP` 或 `SETUP`，不要让用户以为它是链路节点。

#### Search config

必要性：合理。配置项很多，搜索是必要功能。

建议：搜索结果要区分三种动作：

- `ADD`：会创建可视化对象。
- `SETUP`：会创建或聚焦全局 Settings。
- `INSPECTOR`：不会创建对象，只会打开某个父配置里的模块。

#### Templates / Library pills

必要性：合理。模板和单个配置对象是两种不同入口。

问题：`Library 13` 不是全部 sing-box 配置数量，只是顶层分组数量；这个数字对普通用户意义不大。

建议：保留二级切换，但数字可以弱化或改成展开后局部数量。核心是减少误导，而不是展示清单规模。

#### Category buttons: Log, DNS, NTP, Certificate, Certificate Providers, HTTP Clients, Endpoints, Inbounds, Outbounds, Route, Services, Experimental, Shared

必要性：合理。它们对应官方顶层字段和 shared 文档入口。

问题：`Shared` 和 `Experimental` 放在同一层容易误导。`Shared` 不是顶层 JSON key，不应该像 `experimental` 一样被理解为可添加对象。

建议：

- `Experimental` 放在 `Settings` 类组。
- `Shared` 改名为 `Field Groups` 或移到 Inspector 内作为字段族索引。
- Library 中的类目只负责添加或聚焦用户能操作的配置对象。

#### Experimental list item

当前文案：`Experimental` + `SETUP` + `DOCS`

必要性：`Experimental` 入口必要。

问题：

- `SETUP` 合理，但点击后应该明确是“打开全局设置”，不是添加链路节点。
- `DOCS` 合理，但当前如果 Docs 只是装饰或不可点击，就不合理。Docs 必须可点击打开对应官方文档。

建议：

- 主按钮文案改为 `SETUP` 或 `OPEN`。
- Docs 按钮必须打开 `configuration/experimental/`。
- 已经存在 `experimental` 时，再点主按钮只聚焦同一个 Settings，不重复创建。

#### Cache File / Clash API / V2Ray API list items

当前文案：`INSPECTOR` + `DOCS`

必要性：方向正确。它们不是独立节点，只能在 `Experimental` Inspector 内编辑。

问题：

- 如果点击 `Cache File` 没有自动创建/聚焦 `Experimental` 并展开对应模块，用户会困惑。
- `INSPECTOR` 作为状态词偏工程化，不是用户动作。

建议：

- 主动作改成 `OPEN`。
- 点击 `Cache File`：确保 `experimental` 存在，选中 Experimental，右侧自动展开 Cache File。
- 点击 `Clash API`：同理展开 Clash API。
- 点击 `V2Ray API`：同理展开 V2Ray API，并显示 build-tag 提示。

### Canvas Node

#### Title bar: `Settings / Experimental`

必要性：可以保留，但太工程化。

问题：用户关心的是配置模块，不是内部 kind/type。

建议：节点上方显示 `Settings / Experimental` 可以作为小标签；主标题只显示 `Experimental`。

#### Node icon: `{ }`

必要性：弱。`{}` 表示 JSON/settings，但 Experimental 更像实验开关。

建议：使用与 Palette 一致的 flask/experiment 图标，避免 Palette 和节点语义不一致。

#### Status icon: green check

必要性：有价值，但语义要明确。

问题：当前所有模块都是 OFF 时仍显示 valid，容易让用户误解“已经配置好了”。实际它只是“当前 JSON 没有错误”。

建议：

- 如果所有模块 OFF，状态显示 `empty` 或不显示。
- 如果启用模块且语义校验通过，显示 `valid`。
- 如果启用 deprecated/testing-only 字段，显示 `warning`。

#### Main title: `Experimental`

必要性：合理。

#### Subtitle: `global settings`

必要性：合理。它清楚说明不参与链路。

建议：可以改成 `global modules` 或 `cache / api / stats`，让用户知道里面配置什么。

#### Large plus button

必要性：不合理。

原因：

- Experimental 没有上下游节点。
- 官方文档里 `cache_file`、`clash_api`、`v2ray_api` 是子对象，不是图节点。
- `+` 在 Higgsfield 风格中通常表示添加输入、资源或可连接对象；放在这里会误导用户以为可以接线或添加下游。

建议：删除。替代方案：

- 点击节点本体打开 Inspector。
- 节点内部展示 3 个小模块 chip：`Cache File OFF`、`Clash API OFF`、`V2Ray API OFF`。
- 点击 chip 聚焦右侧对应模块。

#### Bottom type pill: `experime...`

必要性：低。

问题：

- 文案被截断，视觉上不专业。
- 对 Settings 节点，重复显示类型没有帮助。

建议：删除，或者改成更短的 `settings`。更推荐删除，把节点做成轻量全局卡片。

#### Bottom status pill: `valid`

必要性：可保留，但不应该和顶部状态重复。

建议：如果节点角标已有状态，底部 status pill 删除。保留一个状态源即可。

#### Bottom settings/sliders button

必要性：对普通节点可能合理；对 Experimental 节点不必要。

问题：点击节点本身已经打开右侧 Inspector，按钮重复。

建议：删除。画布节点越少按钮越好。

#### Bottom count pill: `1`

必要性：不合理。

问题：用户不知道 `1` 是字段数、实例数、连接数还是模块数。

建议：删除。若需要表达模块状态，改成明确文本 `0/3 on`，但也可以放在 Inspector，不放节点底部。

#### Selection label: `Selected settings:experimental`

必要性：调试有用，产品无用。

问题：这是内部 ID，普通用户看不懂。

建议：删除，或改为非常短的 `Experimental selected`，但更推荐删除。选中态已有蓝色边框。

### Right: Inspector

#### Panel title: `{ } Settings`

必要性：不合理。

问题：

- `Settings` 过泛，用户已经选的是 Experimental。
- `{}` 图标与 Experimental 不一致。

建议：标题改成 `Experimental`，副标题小字 `Settings` 或 `Global settings`。

#### Close button `X`

必要性：合理。

建议：保留。关闭后取消选中节点，不显示 Inspector。

#### Delete button

必要性：有条件合理。

问题：删除全局 Experimental 配置会移除所有实验模块，风险比普通节点高。

建议：

- 保留，但文案/tooltip 必须明确 `Remove experimental settings`。
- 如果任一模块已启用，删除前需要轻量确认。
- 如果所有模块 OFF，可以直接移除。

#### Section label: `SETTINGS`

必要性：低。

问题：太泛，没有提供决策信息。

建议：删除，或改成 `EXPERIMENTAL MODULES`。

#### Name/value: `settings`

必要性：不合理。

问题：这是内部 kind，不是用户可编辑字段。Experimental 官方配置没有 `tag` 或 `name`。

建议：删除。不要把内部模型字段暴露给用户。

#### Cache File collapsed card

必要性：合理。

问题：只显示 `OFF` 不够。用户不知道 OFF 的判断来自哪个字段。

建议：

- 卡片标题：`Cache File`
- 状态：`OFF` / `ON`
- 展开后第一项必须是 `Enable cache file`。
- OFF 时隐藏高级字段，只显示一行说明：`Stores selector/fakeip/DNS cache when enabled.`

#### Clash API collapsed card

必要性：合理。

问题：Clash API 的启用条件是 `external_controller` 非空，而不是单独 `enabled` 字段。当前 OFF 状态必须按这个规则判断。

建议：

- 展开后首项是 `Controller`，placeholder `127.0.0.1:9090`。
- 如果 controller 是 `0.0.0.0:*` 且 secret 为空，给 warning。
- `External UI` 和 download 字段放高级区。
- `Download detour` 用 outbound tag 下拉，不用文本框。
- deprecated fields 不展示，只在导入旧配置时提示迁移。

#### V2Ray API collapsed card

必要性：合理，但必须有风险提示。

问题：官方文档明确说默认安装不包含 V2Ray API。当前只显示 OFF，缺少 build-tag 提示。

建议：

- 展开卡片顶部显示 `Requires sing-box build with V2Ray API support.`
- `listen` 为空表示 OFF。
- `stats.inbounds` / `stats.outbounds` 使用 tag 多选。
- `stats.users` 使用文本列表。

## Recommended Redesign

### Palette Behavior

```txt
Settings
  Experimental       SETUP   DOCS

Experimental modules
  Cache File         OPEN    DOCS
  Clash API          OPEN    DOCS
  V2Ray API          OPEN    DOCS
```

行为：

- `Experimental SETUP`：创建或聚焦 `config.experimental`。
- `Cache File OPEN`：创建或聚焦 `config.experimental`，展开 Cache File。
- `Clash API OPEN`：创建或聚焦 `config.experimental`，展开 Clash API。
- `V2Ray API OPEN`：创建或聚焦 `config.experimental`，展开 V2Ray API。
- `DOCS`：打开对应官方文档链接。

### Canvas Node

推荐最小节点：

```txt
Experimental
global settings

[Cache File OFF] [Clash API OFF] [V2Ray API OFF]
```

删除：

- 大 `+` 按钮
- 底部 `experime...` 类型 pill
- 底部 `valid` pill
- 底部 sliders 按钮
- 底部 `1` 计数 pill
- `Selected settings:experimental` 浮层

保留：

- 节点选中边框
- 一个简洁状态角标
- 点击节点打开 Inspector

### Inspector

推荐结构：

```txt
Experimental
Global settings

Cache File                 OFF
  Enable cache file
  Path
  Cache ID
  Store FakeIP
  Store RDRC               stable only / warning in testing
  RDRC timeout             visible when Store RDRC on
  Store DNS                1.14 testing only

Clash API                  OFF
  Controller
  Secret
  Default mode             select: Rule / Global / Direct
  Advanced UI
    External UI
    Download URL
    Download detour        outbound selector
  Advanced CORS
    Allowed origins
    Allow private network

V2Ray API                  OFF
  Build-tag warning
  Listen
  Enable stats
  Stats inbounds           inbound tag multiselect
  Stats outbounds          outbound tag multiselect
  Stats users              text list
```

## Final Product Rule

`experimental` 不应该被设计成连线节点。它应该是一个可选的全局设置卡片，负责承载三个官方子模块。画布只展示它的存在和模块开关状态；真正编辑在右侧 Inspector 中完成。所有字段写回 canonical JSON，导出时不包含任何画布布局元数据。

