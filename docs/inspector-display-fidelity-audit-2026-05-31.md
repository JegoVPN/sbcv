<!--
  Inspector / node-panel DISPLAY-FIDELITY audit — investigates where the panel misrepresents the
  config (hidden defining fields, generic forms, misleading empties). Triggered by a user report that
  the Route Rules panel showed sniff/hijack-dns/resolve rules as identical empty domain-match rows.
  Multi-agent audit: 34 agents. Real configs were read LOCALLY and are referenced anonymized here
  (Config A/B) — no local paths or config contents in the repo.
-->

# Inspector display-fidelity audit (2026-05-31)

- **Trigger:** the Route hub's Route Rules table rendered action-rules (sniff/hijack-dns/resolve) as identical empty rows — the action (a rule's defining field) was never shown.
- **Method:** 34-agent audit across the Inspector panels + canvas node cards; each finding adversarially verified against the code.
- **Result:** **23 confirmed distortions** (of 27 raw) — 5 high / 11 medium / 7 low.
- **Status:** the highest-severity class (rule summaries hiding `action`) is **FIXED in #249 (W11)** — the Route/DNS tables + canvas subtitles now show a faithful "action + match" summary via the single-source `src/domain/ruleSummary.ts`. Remaining confirmed distortions are tracked below.

## Verdict

面板显示不可信:确认 23 处失真,核心病灶集中在 Route/DNS 规则表与节点卡片副标题 —— 系统性地隐藏了规则的「定义性字段」action 与非域名匹配条件,导致 sniff/hijack-dns/resolve/reject 及逻辑(logical)规则渲染成空白卡或被误读成无条件路由。需优先修复规则表。

## Top fixes

1. 规则表(RuleTables.tsx)每条规则增加只读 action 标签 + 忠实摘要行(列出实际存在的匹配键:clash_mode/ip_is_private/protocol/port/logical 等),空白卡须永不出现
2. graph.ts 的 ruleSubtitle 增加「非域名匹配器」回退层(clash_mode=Global / 私有IP / protocol=quic),并特判 type=logical 输出「逻辑 and · N 条」,杜绝两条不同规则副标题相同
3. RuleTables 检测 rule.type==='logical' 时停止内联编辑扁平字段(会破坏语义),改为「逻辑组 — 打开规则编辑」标记或引导至 Inspector
4. TUN inbound Address 支持字符串/数组两种形态显示(或在 normalizeConfig 里 coerceStringList),修复字符串地址显示空白且首次编辑即丢值的数据破坏
5. RULE_ACTION_LABELS 补齐 testing 通道的 evaluate/respond,并加测试断言枚举闭集;clash_api default_mode 大小写不敏感匹配(Rule→rule)避免已设值显示为(unset)并被改写

---

## Inspector / 节点面板 显示忠实度 审查报告

### 1. 总体结论

**面板显示不可信,失真为系统性而非偶发。** 在 27 项原始发现中确认 23 项,逐条核对过源码(`src/components/RuleTables.tsx`、`src/canvas/graph.ts`、`src/domain/commands.ts`、`src/components/inspector/*`),机制全部成立。

失真等级分布:**高 5 项 / 中 11 项 / 低 7 项**。其中危害最重、也是用户最初投诉的触发点,集中在**两类抽象摘要面**:

- **Route/DNS 规则表(RuleTables.tsx)**:每条规则只渲染固定四个控件(域名后缀 / 关键字 / Outbound|Server / 匹配 rule-set),**从不渲染 `action`**,也不识别 `type:"logical"`。规则的本质是「匹配条件 + action」,而 action 正是被完全隐藏的那个定义性字段。
- **画布节点卡片副标题(graph.ts)**:`match` 仅取 `domain_suffix → domain_keyword → domain → rule_set` 四个扁平字段;其余约 28 个真实匹配器(clash_mode / ip_is_private / protocol / port / network …)以及 logical 规则的嵌套体一律落到通用兜底字符串 `match rule` / `dns match`。

结果:四类常见规则(sniff、hijack-dns、resolve、reject)在规则表里渲染成**视觉上完全相同的空白卡**;clash_mode/ip_is_private 规则被误读成「把所有流量发给某出站」的**无条件路由**(语义相反、且危险);logical 复合规则被显示成空 catch-all。这不是「可接受的精简」,而是隐藏了实体的定义性字段,属于真正的失真。

此外还有数据破坏级问题:TUN inbound 的字符串型 `address` 显示为空白,且首次编辑即被改写成数组、丢掉原值。

---

### 2. 确认问题(按严重度分组)

#### 高(High)— 隐藏定义性字段 / 数据破坏

| 问题 | 面板显示什么 | 实体实际是什么 | file:line | 具体例子 | 修复建议 |
|---|---|---|---|---|---|
| Route 规则表完全省略 `action` | 固定四控件,无 action。sniff/hijack-dns/resolve/reject 因 `routeRuleAllowsOutbound` 返回 false 连 Outbound 选择框都隐藏 → 三个空输入框的全空白卡 | 规则 = 匹配条件 + action;action 是最具定义性的属性(决定 sniff/hijack-dns/resolve/reject/route) | `RuleTables.tsx:104-172`;门控 `commands.ts:233-236` | `{"action":"sniff"}` 与 `{"action":"resolve"}` 渲染成完全相同的空白「Rule N」 | 卡片加只读 action 标签;action 已在 `inspector/ruleInspectors.tsx:77-99` 完整枚举可复用 |
| logical 规则在两张表里完全不可见 | 表对 `type==='logical'` 零处理,仍按扁平四字段渲染。`mode`(and/or)与嵌套 `rules[]` 从不显示 | logical 规则的匹配逻辑全在嵌套 `rules[]` + `mode` 里,无任何顶层 domain/rule_set | `RuleTables.tsx:104-172 / 215-281` | `{type:"logical",mode:"and",rules:[{rule_set:"geosite-!cn",invert:true},{rule_set:"geoip-cn"}],server:"RemoteDNS"}` 在 DNS 表里只显示 Server=RemoteDNS,读起来像无条件 catch-all。**更糟:表是内联编辑面,往里打字会注入顶层 domain_suffix,语义非法** | 检测 logical 输出「逻辑 and · 2 条」摘要并停止内联编辑扁平字段 |
| DNS 规则卡副标题忽略 logical 与非域名匹配器 | 与 route 同样的 match 优先级,fallback `dns match` | logical 规则副标题退化成 `dns match`,且 `stringRefs(rule.rule_set)` 只读顶层 rule_set,**嵌套 rule_set 连边都不生成** | `graph.ts:632-639`(+ `:654` 边) | CN 分流常见 logical-AND 规则 → 卡片「DNS Rule 2 / dns match」,与空规则字符串相同。该模式在 15+ fixture 中出现(如 `fixtures/stable/manual-proxy-client-bypass-no-leak.json`) | logical 输出结构标签;嵌套 rule_set 应纳入连边 |
| Route 规则表把 pre-match / clash_mode / ip_is_private 规则渲染成空白或无条件卡 | 同上四控件 | 8/12 类无域名的规则其定义字段全隐藏 | `RuleTables.tsx:103-172` | `{clash_mode:"Global",outbound:"Manual Select"}` 只显示 Outbound=Manual Select,读作无条件默认规则(实为 Clash-Global 模式专属);`{ip_is_private:true,outbound:"direct"}` 读作「全发 direct」 | 每卡加只读摘要行:action(默认 route)+ 实际存在的非建模匹配器 |
| TUN inbound 字符串 `address` 显示空白且编辑即毁值 | 单个 Address 输入框 `value={toList(entity.address)}`;`toList` 对非数组返回 `''` → 全空白无 placeholder | sing-box 接受 `tun.address` 为 string 或 string[];`normalizeConfig` 不强转,字符串原样导入。`address` 在 `inboundHandledFields` → 也不落到 Advanced 兜底。onChange 写 `fromList(...)`(永远数组)→ **首键即丢原字符串** | `inboundInspector.tsx:43`;`handledFields.ts:54`;`serialization.ts:47-86` | `{"type":"tun","address":"172.19.0.1/30"}` 显示 Address=(空);而数组形态 `["172.19.0.1/30",...]` 正常显示。约 8 个外部 fixture 用字符串形态 | `value={Array.isArray(address)?toList(address):(typeof address==='string'?address:'')}`,或在 normalizeConfig 里对 address `coerceStringList` |

#### 中(Medium)

| 问题 | 面板显示什么 | 实体实际是什么 | file:line | 修复建议 |
|---|---|---|---|---|
| DNS 规则表省略 `action` | 域名后缀/关键字/Server/rule-set;reject/predefined/respond 连 Server 都被门控隐藏 | reject/predefined 的 action 决定丢弃/RCODE,表里无从分辨 | `RuleTables.tsx:215-281`;`commands.ts:265-268` | 同 route:表面 action;predefined 显示 rcode |
| Route 规则副标题丢非域名匹配器(综合项) | 仅 domain/rule_set 喂入,否则 `match rule` | ~28 个匹配器(protocol/clash_mode/ip_is_private/port…)全不可见 | `graph.ts:386-400` | 无 domain/rule_set 时回退总结活跃匹配器 |
| DNS 规则副标题丢非域名匹配器 | 同上,fallback `dns match` | query_type/client_subnet/protocol 不可见;自带模板 `templates.ts:160-177` 即触发(query_type/clash_mode-only) | `graph.ts:632-639` | 同上,回退总结 query_type 等 |
| clash_mode 匹配器被丢(表+副标题) | clash_mode 不在表也不在副标题优先级 | clash_mode 把规则限定在某 Clash 模式;隐藏后读作无条件 catch-all,危险。`templates.ts:570-571` 即此形态 | `graph.ts:386-400`;`RuleTables.tsx:104-172` | 副标题/卡片显示 clash_mode |
| Route 规则副标题:clash_mode/ip_is_private/protocol 三种不同规则塌缩成同一 `match rule` | 同 match 优先级 | 三条规则本质不同却卡片相同;`fixtures/external/kj163kj-...config_default...json` 复现 | `graph.ts:386-390` | 增加非域名匹配器 fallback 层 |
| logical 规则画布副标题退化为 fallback | match 仅看扁平字段 | logical 卡片显示 `dns match`,与表同样误导 | `graph.ts:386-400, 632-639` | logical 输出「AND · N 子规则」 |
| `udp_over_tcp: true`(布尔简写)显示为 OFF | UDP-over-TCP 卡的 Enabled 复选框读路径 `["udp_over_tcp","enabled"]`,`sharedValueAt` 遇布尔即返回 undefined → 未勾选、卡头 OFF | sing-box 接受 `udp_over_tcp:true` 旧式简写;在 `outboundHandledFields` 故 Advanced 也不显示 → 定义性 enabled 标志全不可见(config ON 显示成 OFF) | `sharedFields.tsx:377-382`;`handledFields.ts:111`;upstream `shared/udp-over-tcp.md` | 布尔值按 `{enabled:bool}` 解读显示,或导入时强转对象形态 |
| Tailscale endpoint `relay_server_static_endpoints` 既无控件又被排除出 Advanced | 仅渲染 auth_key/state_directory/... 无该字段控件 | 在 `endpointHandledFields` 却无对应控件 → 导入值能 round-trip 但 GUI 不可见不可编辑;C17 守卫不覆盖 endpoint | `handledFields.ts:269`;`endpointInspector.tsx:175-247` | 从 handledFields 移除使其落 Advanced,或加专用列表控件;并把 C17 守卫扩到 endpoint/dns-server/service |
| mdns DNS server `interface[]` 静默丢弃 | 唯一 interface 控件被门控到 `dhcp` 且为单行字符串输入 | mdns 的 `interface` 是数组且为唯一类型字段(`schemaRegistry.ts:910-921`);handled 故 Advanced 也跳过 → 无任何编辑器 | `dnsServerInspector.tsx:287-296`;`handledFields.ts:244` | 给 mdns 加数组型 interface 控件,或移出 handledFields |
| Clash API Default Mode 把导入的大写值静默清空 | `<select value=String(default_mode??"")>` 选项全小写;`"Rule"` 不匹配任何 option → 显示 (unset),但卡头因有值显示 ON | sing-box default_mode 大小写不敏感,配置常用大写。`templates.ts:867/918` 自带 `"Enhanced"` 即触发。首次改动写小写值覆盖原值 | `settingsInspector.tsx:293-306` | 大小写不敏感匹配显示;或把已设的未识别值作为可选项保留(参照 `ruleInspectors.tsx:322-325`) |
| (DNS Rules hub 表隐藏 logical/predefined/query_type/domain_regex) | 仅四控件 | predefined-only 规则 → 全空白卡;domain/domain_regex-only → 只显示 Server,读作「匹配一切→server」 | `RuleTables.tsx:214-280` | 同 route 表:显示 action + 存在的匹配器标记 |

#### 低(Low)

| 问题 | 摘要 | file:line | 修复建议 |
|---|---|---|---|
| `protocol` 匹配器从两个摘要面丢弃 | `{protocol:"dns",action:"hijack-dns"}` 表里空白卡、副标题仅 `hijack-dns`,protocol 限定不可见;`fixtures/stable/manual-proxy-client-tun-ipv4.json` 复现 | `graph.ts:386-390` | protocol 纳入 fallback 链 |
| protocol 限定从 sniff/reject/hijack-dns 规则丢失 | action 显示但 protocol 作用域丢失,读作无条件动作 | `graph.ts:386-400` | 组合成 `quic · reject` |
| WireGuard 卡副标题显示本地隧道地址,误读为服务器 | `wireguard 172.16.0.2/32` 是本地接口地址,真正对端在 `peers[].address` | `graph.ts:1185-1189` | 限定为「local …」或优先显示首个 peer 地址 |
| WireGuard `system`(tun vs gVisor 栈)只作通用 Advanced 开关 | 定义性栈切换降级成无说明的「System」复选框,`name`/`mtu` 同样 | `endpointInspector.tsx:53-174` | 提升到 wireguard 块并加标注 |
| DNS https/tls Port 在 server_port 缺失时把协议默认值当具体值显示 | 未设端口时 value 直接填 443/853,无法区分「未设(推断443)」与「显式443」 | `dnsServerInspector.tsx:104-132` | 默认值只放 placeholder,value 留空(参照 `endpointInspector.tsx:107`) |
| `RULE_ACTION_LABELS` 不全,未映射 action 漏出原始枚举 | stable 通道映射其实完整,但 testing 通道 DNS 的 `evaluate`/`respond`(1.14)未映射 → 副标题漏出裸枚举 | `graph.ts:128-145` | 补齐枚举并加闭集断言测试,或 titleCase 兜底 |
| 表 Outbound/Server 选择框对 action-scrubbed 规则隐藏控件,使动作型规则像欠配置的路由规则 | 选择框被整体隐藏(非显示 Missing),加上 action 不显示 → 与全新空规则无法区分 | `RuleTables.tsx:141-157, 251-267` | 在同卡显示 action 标签使「sniff 无 outbound」可读 |

---

### 3. 根因分析

三个反复出现的同源模式:

1. **抽象摘要面只建模「匹配维度」却漏掉「动作维度」。** Route/DNS 规则表与画布副标题都把规则当成「域名/rule-set 匹配 → 目标」的二元模型来渲染,但 sing-box 规则的真实模型是 **`{匹配条件集} + action`**(见 `graph.ts:124-127` 的注释本身就阐述了「a rule is match + action」原则)。表与副标题恰恰漏了 action 这个定义性维度。讽刺的是项目自己的测试 `tests/rule-action-label.test.ts` 已为画布节点实现了 action 标签修复,但**规则表被遗漏**。

2. **匹配优先级硬编码只覆盖 4 个扁平域名字段。** `graph.ts:386-390` / `632-636` 把 `match` 写死为 `domain_suffix ?? domain_keyword ?? domain ?? rule_set`,而 Inspector 的 `routeRuleAdvancedFields`/`dnsRuleAdvancedFields`(`ruleControls.tsx`)清楚枚举了约 28 个真实匹配器。两者脱节,导致「以非域名匹配器为唯一条件」的规则一律塌缩成通用兜底字符串。

3. **`handledFields` 双刃门控。** 字段一旦进入 `handledFields`,既需要一个专用控件来显示它,又被排除出 Advanced 兜底。当专用控件缺失(`relay_server_static_endpoints`)或控件条件过窄(mdns 的 `interface` 被门控到 dhcp、TUN `address` 只认数组)时,该字段在**任何控件里都不出现**,却仍会序列化 round-trip —— 即「静默不可达」缺陷。C17 守卫(`handledFields.ts:206-224`)本可捕获此类,但只覆盖 inbound/outbound。

共同后果:**面板呈现的「这就是该实体的全部字段」是一个谎言**,而被隐藏的恰是决定行为的字段。这正是用户「失真/不可信」的来源。

---

### 4. 修复路线(按优先级)

**P0 — 规则表显示 action + 忠实的逐条摘要(直接修复用户投诉)**
- 在 `RuleTables.tsx` 的 `RouteRulesTable`/`DnsRulesTable` 每张 `rule-card` 顶部加一个**只读摘要行**:
  - 显示 action(默认补 `route`),复用 `RULE_ACTION_LABELS` 与 `inspector/ruleInspectors.tsx:77-99` 的枚举;
  - 列出**实际存在**的非建模匹配键(clash_mode / ip_is_private / protocol / port / network / ip_cidr / process_name…),例如 `sniff`、`clash_mode = Global`、`protocol = quic · reject`;
  - 检测 `rule.type==='logical'` → 显示 `逻辑 and · N 条`,并**停止内联编辑扁平字段**(否则往 logical 规则注入顶层 domain_suffix 语义非法),改为「打开规则编辑」引导到 Inspector。
- 底线:**空白卡永不出现** —— 任何配置过的规则都必须有可辨识内容。

**P1 — 画布副标题增加匹配器回退层**
- 在 `graph.ts` 的 `ruleSubtitle` 调用前,当 domain/rule_set 都缺失时,增加一个回退层总结活跃的非域名匹配器(`clash: Global` / `私有IP` / `protocol: quic` / `port 443`),route 与 dns 路径(`:386-400`、`:632-639`)一致处理。
- 特判 `type==='logical'`:输出 `AND · N 子规则` 或列出嵌套 rule_set 标签;同时让嵌套 `rule_set`(`:654`)参与连边生成。
- 给 `RULE_ACTION_LABELS` 补齐 testing 通道的 `evaluate`/`respond`,并加一条断言「映射覆盖完整 rule_action 闭集」的测试。

**P2 — Inspector 数据破坏 / 不可达字段**
- **TUN `address`(高):** 按 string|array 双形态显示;最稳妥是在 `normalizeConfig` 对 `tun.address` 调 `coerceStringList`,既修显示又修「首键毁值」。
- **`udp_over_tcp` 布尔(中):** 在 udp-over-tcp 分组把布尔值按 `{enabled:bool}` 解读显示,或导入时强转。
- **`relay_server_static_endpoints` / mdns `interface`(中):** 二选一 —— 移出对应 handledFields 让其落到 Advanced JSON 兜底,或补专用控件;并把 C17 `structurallyCoveredKeys` 守卫扩展到 endpoint / dns-server / service 三类,杜绝此类回归。

**P3 — 低危精修**
- Clash API `default_mode` 大小写不敏感匹配(`Rule→rule`),或保留未识别已设值为可选项,避免显示 (unset) 并在首次编辑时改写。
- DNS https/tls Port:协议默认值改放 placeholder、value 留空(参照 `endpointInspector.tsx:107`)。
- WireGuard 副标题限定为「local …」或优先显示首个 peer 地址;`system` 提升为带说明的具名控件。

**相关文件(绝对路径):**
- `src/components/RuleTables.tsx`
- `src/canvas/graph.ts`
- `src/domain/commands.ts`
- `src/components/inspector/inboundInspector.tsx`
- `src/components/inspector/handledFields.ts`
- `src/components/inspector/sharedFields.tsx`
- `src/components/inspector/endpointInspector.tsx`
- `src/components/inspector/dnsServerInspector.tsx`
- `src/components/inspector/settingsInspector.tsx`
- `src/components/inspector/ruleInspectors.tsx`(action / logical 完整编辑器,可复用)
- `src/domain/serialization.ts`
