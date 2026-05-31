# sbcv — sing-box 配置可视化编辑器

> 在可视化画布上构建、校验、读懂 [sing-box](https://github.com/SagerNet/sing-box) 配置 —— 告别手撸 JSON。

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Live — sbcv.app](https://img.shields.io/badge/live-sbcv.app-brightgreen.svg)](https://sbcv.app)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-orange.svg)](#贡献)

[English](README.md) · **简体中文**

**sbcv** 把 sing-box 的 `config.json` 变成一块拖拽式画布:把入站、出站、节点、DNS 服务器、路由规则拖上来，连根线接好，再用**真正的** `sing-box check` 一键校验 —— 全程只需一个浏览器标签页。

**[→ 打开 sbcv.app](https://sbcv.app)** · 免费 · 开源（MIT） · 免安装 · 免登录

[![sbcv —— 一份 sing-box 配置在可视化画布上的样子](docs/assets/hero.png)](https://sbcv.app)

---

## 为什么选 sbcv？

### 1. 拖，而不是敲 —— 拼写错误根本无从发生

在可视化画布上构建配置：把入站、出站、端点、DNS 服务器、路由规则、规则集拖上来，再连线接好。所有枚举值都是下拉框，每一个 tag 引用都是一根连线 —— 那些悄悄毁掉手写配置的拼错字段名、失效引用，在这里压根无从发生。

> 想加一条「国内直连、国外代理」的路由规则，不必再在几百行 JSON 里翻找位置：把规则拖出来、下拉里选一下、连一根线 —— 引用关系自动建好。

### 2. 一键跑官方校验 —— 加载*之前*就知道对不对

点 **Check**，sbcv 在服务端跑的是**官方 `sing-box check` 二进制**，针对你选定的 sing-box 发布通道 —— **Testing**、**Stable**（默认）或 **Legacy**（当前对应 1.14 / 1.13 / 1.12）。我们跟随 sing-box 自己的发布节奏，每个通道始终对应当前的上游构建 —— 绝不是一个钉死、逐渐过时的快照。它给出的结论和 sing-box 本体完全一致 —— 不是模拟、不是猜测，本地什么都不用装。

> 再也不用 *改 → 导入客户端 → 起不来 → 猜哪儿错了 → 重来*。配置还没进客户端，你就能看到究竟哪一行有问题。想试下一个版本？把通道从 **Stable** 切到 **Testing**，点一下 Check，所有被废弃或不兼容的字段立刻亮出来。

### 3. JSON 始终是唯一真相 —— 双向无损，不留存

画布只是一个看得懂的视图，规范的 sing-box JSON 始终是唯一真相。在可视化编辑器和原始 JSON 之间随便来回切 —— 数据不会丢失，也不会被悄悄改写。已有配置点 **Import** 导入即可编辑，完成后点 **Export** 导回 JSON。

> 拿到一份不是你写的、几百行的配置？导入进来，整张拓扑一眼看明白 —— 流量从哪进、命中哪条规则、最后从哪个出站离开。而且这一切都在一个浏览器标签页里完成：免安装、免账号，你的配置也绝不会留存在服务器上。

---

## 上手使用

1. 打开 **[sbcv.app](https://sbcv.app)**，在顶栏选择你的 sing-box 发布通道 —— Testing、Stable 或 Legacy。
2. 把节点拖到画布上，或点 **Import** 导入一份已有配置来编辑。
3. 把节点连起来，填好下拉框。
4. 点 **Check** 校验，满意后点 **Export JSON** 导出。

---

## 自行运行

```bash
git clone https://github.com/JegoVPN/sbcv
cd sbcv
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # tsc -b && vite build → dist/
pnpm test         # vitest
```

---

## 工作原理

- **规范配置优先。** `SingBoxConfig` 领域模型是唯一真相。React Flow 画布是它的*派生*视图 —— 每次编辑都通过领域命令更新规范 JSON，所以可视化与原文永不脱节。
- **浏览器内的真实校验。** 远端的 `sing-box check` 校验器是一个 Cloudflare Worker，按 sing-box 发布通道分发到对应的 Container —— Testing、Stable、Legacy 各一个，且都与上游保持同步，所以校验结论和你自己跑的二进制完全一致。
- **默认隐私优先。** 配置绝不留存在服务器上。无账号，无遥测。

**技术栈：** Vite · React · [React Flow](https://reactflow.dev) · Zustand · TypeScript · Cloudflare Workers + Containers。

---

## 贡献

欢迎提 Issue 和 PR。尤其欢迎这几类反馈：

- **Inspector 里缺了某个 sing-box 字段** → 提一个 issue，附上字段名 + 文档链接。
- **某机场 / 服务商的订阅 JSON 导入失败** → 附上一份脱敏后的副本。
- **某条诊断是误报** → 贴上触发它的配置片段。

---

## 许可证

MIT © 2026 —— 见 [LICENSE](LICENSE)。

## 致谢

- **[SagerNet/sing-box](https://github.com/SagerNet/sing-box)** —— sbcv 只是让它的配置更好打理。
- **[Linux.do](https://linux.do)** —— 早期反馈、bug 报告，并让项目始终对准真实用户需求。
- **[V2EX](https://www.v2ex.com)** —— 那些发掘出值得支持的边角场景的讨论帖。
