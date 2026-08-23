# sing-box 1.13.19 / 1.14 beta.17 Conformance

## Outcome

SBC keeps `1.13 stable` as the default target and `1.14 testing` as explicit opt-in while validating against the current upstream releases (`1.13.19` and `1.14.0-beta.17`). The local documentation ledger covers the beta.17 configuration surface, newer imports remain safe to open and round-trip, and newly writable fields follow canonical domain commands, target gates, and matching binary checks.

## Scope

- In scope:
  - Roll the stable/testing validator pins and deployment version markers forward.
  - Sync the stable/testing upstream documentation snapshots and the doc-coverage ledger.
  - Close import/runtime compatibility gaps introduced after `1.14.0-alpha.43`, especially multi-tag rule-sets and tagged DNS response evaluation.
  - Add first-class support for the smaller, broadly useful stable/testing fields introduced since the previous snapshot.
  - Classify OpenVPN/OpenConnect resources accurately and implement them only when their canonical command, Inspector, fixture, and testing binary gate are complete.
- Out of scope:
  - Making `1.14 testing` the default target before upstream stable release.
  - Changing the canonical `SingBoxConfig` source-of-truth architecture.
  - Treating every large OpenVPN/OpenConnect option as an eager always-loaded Inspector form.

## Source Docs

- `AGENTS.md`
- `docs/sbc-react-flow-rd-plan.md`
- `docs/sing-box-config-doc-inventory.md`
- `docs/sing-box-canvas-configuration-guide.md`
- `docs/sing-box-config-capability-audit.md`
- Upstream `stable` configuration docs at sing-box `1.13.19`.
- Upstream `testing` configuration docs at sing-box `1.14.0-beta.17`.
- Upstream release changelog from `1.13.14` / `1.14.0-alpha.43` through the target releases.

## Optimal Path

- Architecture decision: preserve literal canonical JSON and expand the registry/command/view layers around new upstream shapes. Do not flatten multi-tag ownership into canvas-only state.
- Why this is the best path for SBC: it keeps import/export lossless, maintains explicit tag-reference commands, and lets unsupported testing objects remain visible without claiming a complete write path.
- Alternatives rejected:
  - Generating output from React Flow nodes, because rule order and multi-tag resource identity live in canonical JSON.
  - Exposing all new testing objects immediately as `ADD SETUP`, because OpenVPN/OpenConnect require large nested schemas and official fixture coverage first.
  - Leaving the testing validator on alpha.43 while documenting beta fields, because semantic and official validation would disagree.
- Risk controls:
  - Stable remains the default target.
  - Every emitted fixture uses its target-matched binary.
  - Unsupported new docs stay `GATED`, `PENDING`, `INSPECTOR`, or `DOCS` until the release gate is complete.
  - Multi-tag rule-set import is fixed before first-class multi-tag creation.
  - Optional large editors are split/lazy-loaded where practical; canonical config subscriptions stay narrow and transient canvas state stays local.

## Implementation Plan

1. Roll binary pins, checksums, container defaults, Worker cache marker, and deployment documentation to `1.13.19` / `1.14.0-beta.17`.
2. Force-sync stable/testing docs, update the inventory/readthrough/audit baseline from 114 to 121 English testing docs, and classify every new entry.
3. Make rule-set `tag: string[]` imports render and reference safely; model tagged DNS evaluate/match-response/race semantics and diagnostics.
4. Add smaller high-value fields: stable AnyTLS `client_metadata`; testing UDP NAT, Tailscale, Hysteria2, rule-set `initial_path`, and related DNS fields.
5. Add testing-gated OpenVPN/OpenConnect write paths in bounded slices, or retain truthful non-writable statuses with recorded follow-up scope.

## Review Plan

- Self-review focus: canonical ownership, target gates, tag rename/delete behavior, import losslessness, exact binary/version coupling.
- Source-of-truth checks: every field/type maps to the inventory and the matching synced upstream Markdown.
- Diff scope checks: one concern per atomic; no unrelated cleanup.
- Design/UX checks: Library status must describe actual click behavior and required target.
- Frontend skill gate: apply `vercel-react-best-practices`; review bundle size, rerender scope, derived graph cost, async waterfalls, and broad Zustand subscriptions before each frontend atomic is done.

## E2E Plan

- User path: select the target, import or create the covered resource, edit it through its owner, run semantic/official validation, export, and reimport.
- Tooling: Vitest domain/UI tests, Playwright smoke paths, and target-matched `sing-box check`.
- Expected evidence: stable/testing fixtures pass cleanly with no warning/deprecation output; a beta.17 multi-tag/DNS import does not crash or lose fields.
- Fallback: platform-specific Linux fixtures may be skipped on macOS only when explicitly reported and must run through the Linux release gate.

## Acceptance Criteria

- Local and container installers resolve to `1.12.25`, `1.13.19`, and `1.14.0-beta.17` with pinned SHA256 values.
- Documentation audit is synchronized with 121 beta.17 English configuration docs.
- New beta.17 imports do not crash the derived graph or silently lose supported fields.
- Stable and testing creation/edit paths remain target-correct and binary-clean.
- OpenVPN/OpenConnect statuses do not overclaim implementation completeness.

## Validation Matrix

| Case | Check |
| --- | --- |
| 1.12 legacy config | `sing-box-1.12 check` |
| 1.13 stable config | `sing-box-stable check` |
| 1.14 testing config | `sing-box-testing check` |
| Domain and UI | `pnpm test` |
| Build | `pnpm build` |
| User workflow | targeted Playwright smoke, then `pnpm e2e` before goal completion |

## Done Definition

- Implementation complete: all in-scope compatibility and prioritized field work landed; deferred large protocol work is truthfully classified.
- Review complete: source traceability, React performance, target/version, and diff-scope reviews pass.
- E2E/smoke complete: covered stable/testing user paths and target binary checks pass.
- Docs updated: inventory, readthrough matrix, capability audit, guide, deployment notes, and milestone notes reflect the shipped state.
- Signed commit pushed: each atomic uses a signed commit, PR, merge, and post-merge issue gate.

## Milestone Notes

- 2026-08-23 — Goal opened from the upstream conformance audit. Upstream targets confirmed as `1.12.25`, `1.13.19`, and `1.14.0-beta.17`; the worktree started clean on `main` at `35e5c97`.
- 2026-08-23 — Atomic 1 aligned the local installer, Linux container installer, container defaults, Worker cache marker, and deployment/release documentation with `1.13.19` / `1.14.0-beta.17`. Darwin and Linux archives were verified against pinned SHA256 values; both Linux archives contained the expected binary and Cronet library.
- 2026-08-23 — Atomic 1 checks passed: syntax checks, `git diff --check`, production build, 1,857 serial Vitest cases, 19 runnable internal official-binary fixtures (1 Linux-only namespace fixture skipped on macOS), 42 external official-binary checks across 237 accepted fixtures, 237 external render fixtures, 21 export/binary tests, and 43 Playwright E2E cases. A normal parallel unit run hit five existing 5-second UI timeouts under load; all affected files passed serially and the full suite passed with a 30-second per-test ceiling. Docker was not installed locally, so the image itself could not be built; Linux artifacts, checksums, archive contents, and shell syntax were checked independently.
- 2026-08-23 — Frontend performance review for Atomic 1: no frontend implementation, UI test, or build configuration changed, so there was no new bundle, rerender, derived-state, or waterfall risk. The production build retained its pre-existing large-chunk warnings.
- 2026-08-23 — Atomic 1 production rollout: the first Cloudflare build pushed and selected the new container image but failed its six exact-version probes because traffic still reached `1.14.0-alpha.43`. A manual retry completed the immediate container rollout; production then returned `1.12.25`, `1.13.19`, and `1.14.0-beta.17` for the three target channels, with the beta.17 Network Namespace probe valid.
- 2026-08-23 — Atomic 2 force-synced the stable docs at `b5ebaa1fc0f2b94256180b95468e73ef53caa27d` and testing docs at `712046a26d12bf132568476c14c5b717584d1ac0`. The machine audit now agrees at 121 testing English docs, 121 readthrough rows, and 121 Palette entries. JSON Schema is documentation-only; five OpenConnect/OpenVPN objects and the shared UDP NAT group are explicitly pending instead of overclaiming a write path.
- 2026-08-23 — Atomic 2 checks passed: doc audit and field regeneration, `git diff --check`, production build, 279 focused registry/schema/version tests, 1,865 serial Vitest cases, 19 runnable target-matched fixture checks (1 Linux-only namespace fixture skipped on macOS), and 43 Playwright E2E cases at four workers. The first E2E run exposed one Library test coupled to the old group count; its selector now matches the semantic Library control. A later eight-worker run hit an unrelated hover timing race, which passed alone and in the complete four-worker run.
- 2026-08-23 — Frontend performance review for Atomic 2: the new documentation surfaces are static Palette and registry entries only. They add no config-store subscriptions, broad rerender paths, expensive derived graph state, or data waterfalls; Palette remains a separate lazy-loaded chunk and the build retains its pre-existing large-chunk warnings.
- 2026-08-23 — Atomic 3 added lossless sing-box 1.14 grouped rule-set tags. One canonical rule-set object remains one canvas node, all declared tags resolve to it, import/export preserves the tag list, and update/rename/delete commands operate through any tag while cascading every grouped reference. Testing validation enforces `{tag}` placeholders and the inline conflict; stable blocks the 1.14 tag-list shape.
- 2026-08-23 — Atomic 3 also models beta.17 DNS response identity and race ordering: `match_response: true` resolves only a preceding untagged evaluate, string values resolve the matching tagged evaluate, response fields require explicit response matching, race requires a response and a final action, and speculative use is checked against race ordering. Stable now blocks response/race fields at any logical-rule depth because 1.13.19 rejects them at decode.
- 2026-08-23 — Atomic 3 checks passed: direct `sing-box-testing` / `sing-box-stable` stdin probes for the new shapes, `git diff --check`, production build, 1,881 serial Vitest cases, 121-doc coverage audit, 20 runnable target-matched fixture checks (1 Linux-only namespace fixture skipped on macOS), 22 export/binary tests, 42 official checks plus render/import coverage for 237 accepted external fixtures, and 43 Playwright E2E cases at four workers. The default parallel unit run had one existing 5-second fixture coverage timeout under load; that file passed alone in 1.33 seconds and the complete serial suite passed.
- 2026-08-23 — Frontend performance review for Atomic 3: grouped tag normalization is linear and computed once per graph derivation; it does not flatten canonical data, add dependencies, introduce broad Zustand subscriptions, or retain transient canvas state. Inspector and rule-table changes reuse their existing narrow selectors. The production build retains its pre-existing large-chunk warnings.

## Notes And Deviations

- 2026-08-23 — No version label change is required: the product targets minor channels (`1.13 stable`, `1.14 testing`) while the validator pins select the concrete point release.
