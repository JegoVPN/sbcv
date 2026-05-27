---
title: Claude pre-push commit review gate
status: draft
owner: JegoVPN
created: 2026-05-28
last-updated: 2026-05-28
---

## Goal

为本地 `git push` 增加一道由 Claude Code 驱动的 review，作为现有签名验证 + GitHub `release-check` CI + 自我 review 的补充。每个待 push 的 commit 单独并行 review，按严重度阻塞或警告 push。

## Non-goals

- 不接管 PR review；GitHub 上的 `release-check` CI 仍是 ground truth。
- 不做自动 fix；review-only。
- 不加 GitHub Action 镜像这套 review。单人 repo，`git push --no-verify` 是知情的 hotfix 通道。
- 不做基于 commit sha 的结果缓存。rebase 后 sha 变，命中率低，复杂度不划算。
- 不做 severity 阈值的可配置化。critical/major 一律阻塞是硬规则。

## Architecture

### File layout

```
.githooks/pre-push                              # 现有，追加 stage 2 调用
scripts/claude-review/
  ├── run.mjs                                   # review 引擎
  ├── rubric.md                                 # 静态 prompt（4 维 rubric + severity 定义）
  └── README.md                                 # 用法、绕过方式、成本说明
```

`pre-push` 仍只做两件事：
1. **stage 1**（现有，不动）：循环 push range，对每个 commit 跑 `git verify-commit` 做签名验证。
2. **stage 2**（新增）：stage 1 的 `while read` 循环收集所有 push ranges；循环结束后 `exec` 一次 `node scripts/claude-review/run.mjs <range...>`。所有 review 复杂度收在 node 脚本里，hook 仍然短小可读。

### Flow

```
git push
  └─ .githooks/pre-push
       ├─ stage 1: git verify-commit per commit in <range>   (existing)
       └─ stage 2: node scripts/claude-review/run.mjs <range>
              ├─ git rev-list <range...> → [sha1, sha2, ...]
              ├─ for each sha (Promise.all + concurrency=4):
              │      git show --numstat --format= <sha>
              │      if non-Markdown LOC > 400 → synthetic SEVERITY:major
              │      spawn `claude --print` with prompt =
              │          rubric.md
              │        + AGENTS.md (inlined as rubric context)
              │        + commit message
              │        + `git show --stat -p <sha>`
              │        + most-recently-committed goal doc (if any)
              ├─ parse SEVERITY:... lines from each stdout
              └─ any critical|major → exit 1; else exit 0
```

并行用 `Promise.all` + 简单 semaphore（无新依赖）。concurrency=4 平衡 Claude Code session rate limit 与延迟。

### Review dimensions

`rubric.md` 内联以下 4 维度的检查清单，每个 commit 都跑全部 4 维：

1. **正确性** — bug、未处理分支、错误处理、资源泄漏。
2. **AGENTS.md 11 条 non-negotiables** — Claude 必须逐条对照并在 finding 中引用规则编号（例：`AGENTS.md #10: unrelated cleanup`）。
3. **Goal/spec 偏离度** — 若按"git recency"规则解析到 current goal doc（见下文），检查该 commit 是否在 goal scope 内、是否推进了既定 milestone。找不到则跳过该维度（仍执行其他 3 维）。
4. **React/性能** — 当 commit 触及 `src/**/*.{ts,tsx}` 时，套用 `vercel-react-best-practices` 要点：bundle 体积、rerender 范围、derived state 昂贵、async/data 瀑布。

### Severity contract

Claude 必须按以下格式产出（rubric.md 明确要求）：

```
## Review for <sha-short> — <commit subject>
<人读的分析，自由格式 markdown>

SEVERITY:critical — <一行：问题 + 引用 file:line + 引用规则>
SEVERITY:major    — ...
SEVERITY:minor    — ...
SUMMARY: <N> critical, <M> major, <K> minor.
```

`run.mjs` 用 `^SEVERITY:(critical|major|minor)\b` 正则扫每个子进程 stdout。任一 commit 出现 `critical` 或 `major` → `run.mjs` 退出非零，pre-push 阻塞 push。`SUMMARY:` 仅用于人读日志，不参与判定。

Severity 定义（写进 rubric.md，给 Claude 做判定依据）：

- **critical** — 直接破坏 AGENTS.md non-negotiables、引入安全漏洞、破坏 canonical config invariant、明显回归。
- **major** — 违反文档化约定、明显的逻辑 bug、scope creep（commit 包含 unrelated 改动）、跨 atomic 边界。
- **minor** — 命名 / 注释 / 微小风格问题、可读性建议。

### Goal doc lookup

Branch 命名（如 `atomic/canvas-pr2-reference-registry`）和 goal 文件名（如 `canvas-port-interaction-redesign-execution.md`）的 token 重叠常常不足以 unique 定位，靠 branch-name heuristic 不可靠。改用 **git history recency**：

1. `git ls-files 'docs/goals/*.md'` 列出所有 goal docs。
2. 对每个文件取最近一次提交的 commit time（`git log -1 --format=%ct -- <file>`）。
3. 时间最大者即 current goal doc。
4. 若 `docs/goals/` 为空或全部 untracked → 跳过维度 3，stderr 记 `claude-review: no committed goal doc, skipping drift check`。

Implementation note: goal doc paths are passed to `git log` with argv (`execFileSync('git', [...])`), never interpolated through a shell.

依据：goal-driven 工作流下，新 goal 启动会 commit 一份新 goal doc，进行中的 goal 会持续 commit 更新 —— 最近被 commit 的 goal doc 就是 active goal。这是 0-config heuristic，被 git history 锚定，比文件 mtime 稳。

不准的边界（接受）：刚 commit 完旧 goal 的清理改动 + 还没创建新 goal doc 时，会指向旧 goal。可接受，最差结果是维度 3 报 false positive "drift"，人读 review 时能识别忽略。

### Failure / offline behavior

| 情况 | 行为 |
|---|---|
| `claude` CLI 不在 PATH | fail-open；stderr：`claude-review: CLI not found, skipping (AGENTS.md #9: explicit gap)` |
| 单 commit review > 90s | 杀子进程；该 commit 标记 unavailable；**不**阻塞 push |
| `claude --print` 非零退出 | fail-open + warning，理由同上 |
| `SBC_SKIP_CLAUDE_REVIEW=1 git push` | 整段 stage 2 跳过，stderr 明示 |

fail-open 默认依据 AGENTS.md #9 "No silent validation gaps" —— 前提是**响亮地告知**，不是悄无声息地跳过。`SBC_SKIP_CLAUDE_REVIEW=1` 是窄通道：比 `--no-verify` 更明确意图，且不会顺手跳过签名验证（stage 1 仍跑）。

### Size pre-check

Before invoking Claude, `run.mjs` computes `git show --numstat --format= <sha>` and sums inserted + deleted lines for non-Markdown paths only. If that counted size exceeds 400 lines, the script emits a synthetic `SEVERITY:major` and does not spawn Claude for that commit.

Reasoning:

- AGENTS.md #8 is a logical-code atomicity budget. Large code commits are expensive to review and likely cross concerns.
- Goal/spec/docs commits may naturally exceed 400 Markdown lines while still being one coherent artifact. They remain reviewable by Claude rather than being blocked by the cheap size short-circuit.
- Markdown is still included in the Claude prompt if the commit passes the non-Markdown pre-check.

### Cost

`claude --print` 走本地 Claude Code 订阅，**无 per-token marginal cost**。约束是订阅的 rate limit / 5-hr session quota。

成本控制：rubric.md + AGENTS.md 内容固定放在 prompt 前缀，触发 prompt cache，跨 commit 并行 review 共享缓存命中。

### Out of scope (explicit YAGNI)

- GitHub Action 兜底（用户明确选择信任本地 hook + `--no-verify` 通道）。
- Commit sha 缓存（rebase 失效，得不偿失）。
- Severity 阈值配置文件。
- 自动 fix。
- 跨多 ref push 的聚合报告（hook 本就按 ref 循环；保持每 ref 一份输出即可）。

## Acceptance criteria

- Push 一个含 N 个 commit 的 branch，触发恰好 N 个 review；并发上限 4。N ≤ 4 时总耗时 ≈ 最慢的单 commit review；N > 4 时分批，仍显著快于串行。
- 一个故意违反 AGENTS.md non-negotiable（如：commit 同时改了 unrelated 文件 → #10 scope creep）的测试 commit，产生 `SEVERITY:critical` 或 `major` 并阻塞 push。
- 一个纯 docs 的小 commit，产生 `SUMMARY: 0 critical, 0 major, 0 minor`（或仅 minor），不阻塞。
- 断网 / `claude` CLI 不存在 → push 放行，stderr 含 `claude-review: ... skipping` 字样。
- `SBC_SKIP_CLAUDE_REVIEW=1 git push` 不调任何 Claude，但 stage 1 签名验证仍然跑。

## Open questions

无设计期开放问题。实现期可能需调：prompt 中"严重度"判定的细化、goal-drift 维度的假阳性率。这些通过 prompt 迭代解决，不改架构。
