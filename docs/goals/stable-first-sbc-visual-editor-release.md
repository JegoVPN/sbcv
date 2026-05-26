# Stable-First SBC Visual Editor Release

## Outcome

Ship a release-ready sing-box visual configuration editor inspired by Higgsfield Canvas: users can build, import, inspect, validate, edit, and export sing-box configs through a React Flow canvas while the canonical JSON/domain model remains the only source of truth.

The release is done when a user can open the app, create a stable sing-box config visually, edit node fields in the right Inspector, manage route/DNS ordered rules, view and edit JSON, run validation, export `config.json`, and pass E2E verification for the core stable-first workflow.

## Scope

In scope:

- Production-ready React/TypeScript app.
- Production build, CI checks, and publish/deploy instructions.
- Higgsfield-style dark infinite canvas with node icons, ports, selected state, hover add/delete controls, and right-side Inspector.
- Canonical `SingBoxConfig` domain model and domain command layer.
- Full top-level module awareness for the official sing-box `#fields`: `log`, `dns`, `ntp`, `certificate`, `certificate_providers`, `http_clients`, `endpoints`, `inbounds`, `outbounds`, `route`, `services`, `experimental`.
- Stable-first schema registry seeded from the configuration document inventory.
- Explicit testing channel support for testing-gated fields.
- React Flow graph derived from canonical config.
- Inspector forms for the release-critical stable path.
- Route Rules table and DNS Rules table as ordered editors.
- JSON Preview and Advanced JSON editing with parse/normalize round-trip.
- Stable/testing validation service using separate binaries or a documented, tested fallback when binaries are unavailable.
- Import/export of pure sing-box JSON without SBC layout metadata.
- Templates for common stable client flows.
- Unit, integration, and E2E/smoke tests required for release.
- Documentation updates and run instructions.
- Release notes covering supported sing-box channel/version behavior and known limitations.

Out of scope for this release:

- Multi-user collaboration.
- Cloud accounts, auth, billing, sharing links, or hosted persistence.
- Full protocol coverage for every obscure field before the core editor is releasable.
- Treating the canvas as the source of truth.
- Replacing official `sing-box check` with only local schema validation.

## Source Docs

- [AGENTS.md](../../AGENTS.md)
- [SBC React Flow R&D Plan](../sbc-react-flow-rd-plan.md)
- [sing-box Config Document Inventory](../sing-box-config-doc-inventory.md)
- [Goal-Driven Development](../goal-driven-development.md)
- `vercel-react-best-practices` skill for React/Next.js implementation and review
- sing-box official configuration fields: https://sing-box.sagernet.org/configuration/#fields
- sing-box stable docs: https://github.com/SagerNet/sing-box/tree/stable/docs/configuration
- sing-box testing docs: https://github.com/SagerNet/sing-box/tree/testing/docs/configuration
- Higgsfield Canvas reference: https://higgsfield.ai/canvas/
- User-provided Higgsfield Canvas screenshots in the task thread are authoritative for canvas/Inspector interaction when the public Canvas URL is auth-gated.

## Product Definition

The first screen is the editor, not a landing page.

Layout:

- Top bar: project name, import, export, check, format, channel selector, validation status.
- Left palette: node/module templates grouped by Inbound, Route, DNS, Outbound, Endpoint, Service, Settings.
- Center canvas: main relationship view with dark grid background.
- Right Inspector: selected node/entity editor.
- Bottom or side panel: Route Rules, DNS Rules, JSON Preview, Diagnostics.

Canvas behavior:

- Nodes have icons, type labels, tags/names, status badges, and stable dimensions.
- Nodes expose typed connection ports.
- Hovering a node/port shows compatible upstream/downstream node cards.
- Clicking a compatible card creates the domain entity and legal reference.
- Existing nodes/connections can be removed from hover/selection controls.
- Deleting a connection removes the JSON reference, not necessarily the entity.
- Deleting a referenced node shows impact and either blocks or performs explicit cleanup.
- Selecting a node opens the right Inspector and shows selected state.

Release-critical flow:

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

The generated config must be stable-compatible unless the user explicitly switches to testing.

## Optimal Path

Architecture decision:

- Use canonical JSON/domain state as the state authority.
- Use React Flow only as a derived visual projection and interaction layer.
- Use registry-driven schema, node, Inspector, and compatibility definitions.
- Keep ordered rule logic in tables; canvas only visualizes references.
- Use official `sing-box check` as the final validation gate.

Why this is the best path for SBC:

- It matches sing-box's real config semantics: ordered rules plus tag references, not a pure DAG.
- It allows JSON import/export and Advanced JSON editing without losing information.
- It makes validation traceable to official docs and binaries.
- It supports a Higgsfield-like canvas UX without corrupting config semantics.

Alternatives rejected:

- Graph-as-source: rejected because route/DNS ordering and tag references would be lossy.
- UI-first static mock: rejected because release requires import/export/check/E2E.
- Schema-only editor without canvas: rejected because the product goal is visual composition.
- Full protocol coverage before release: rejected because the optimal path is a stable core workflow with extensible registries.

Risk controls:

- Domain commands are the only way to mutate config.
- Every registry entry maps to the config document inventory.
- Stable fixtures are blocked by `sing-box-stable check`.
- Testing fields require explicit channel selection.
- E2E covers the main user path, not only component rendering.
- React implementation follows `vercel-react-best-practices`: direct imports, dynamic import for heavy editors, Map/Set indexes for repeated lookups, derived state during render/selectors where appropriate, and isolated transient canvas state to prevent whole-app rerenders.

## Implementation Plan

### Phase 1: App Foundation

1. Scaffold the app with React, TypeScript, package scripts, lint/typecheck/build.
2. Apply `vercel-react-best-practices` before writing UI architecture: keep heavy editors lazy, avoid barrel imports, and design store selectors to prevent canvas-wide rerenders.
3. Build the editor shell: top bar, palette, canvas, Inspector, JSON/diagnostics/rules area.
4. Add app directories for domain, schema registry, node registry, canvas derivation, validation, fixtures, tests.
5. Add README run instructions.

### Phase 2: Canonical Domain Model

1. Implement `SingBoxConfig`, `SingBoxChannel`, `SingBoxTarget`, and project layout metadata types.
2. Implement normalize/import/export that preserves canonical config and strips SBC layout on export.
3. Implement tag index and reference index.
4. Implement semantic diagnostics for duplicate tags, missing refs, unsupported channel fields, and ordered rule warnings.
5. Add round-trip fixtures for stable minimal and TUN route selector configs.

### Phase 3: Node And Schema Registries

1. Seed top-level module registry from the document inventory.
2. Add release-critical node definitions: TUN inbound, Route, Route Rule, DNS, DNS Server, Direct, Block, Selector, URLTest, proxy outbound placeholder, Endpoint placeholder, Settings.
3. Define port types and compatibility matrix.
4. Define create-default-entity functions and Inspector schema refs.

### Phase 4: React Flow Canvas

1. Derive React Flow nodes/edges from canonical config and layout.
2. Render dark canvas, nodes, icons, typed ports, status badges, and selected state.
3. Implement hover compatible-node menu.
4. Implement create/connect/delete commands from canvas interactions.
5. Implement auto-placement for new connected nodes.

### Phase 5: Inspector And Tables

1. Build right Inspector for selected entity.
2. Implement tag rename with reference cascade.
3. Implement Route Rules ordered table.
4. Implement DNS Servers and DNS Rules ordered table.
5. Connect table choices to outbound/server/rule-set references.

### Phase 6: JSON And Validation

1. Build JSON Preview.
2. Build Advanced JSON editor with parse/normalize/apply flow.
3. Add stable/testing validation service.
4. Integrate `sing-box-stable check`, `sing-box-testing check`, and format where binaries are available.
5. If binaries are unavailable in CI/dev, add documented fallback and tests that fail loudly when official validation was skipped.

### Phase 7: Templates And Release Polish

1. Add stable TUN split-routing template.
2. Add DNS split template.
3. Add proxy selector template.
4. Add polished empty/loading/error states.
5. Add keyboard/hover affordances and no-overlap responsive checks.

### Phase 8: Review, E2E, Release

1. Self-review against this goal, AGENTS.md, and source-of-truth docs.
2. Run unit/integration tests.
3. Run E2E workflow: create config visually, edit Inspector, reorder rules, edit JSON, validate, export.
4. Run browser screenshots at desktop and mobile/tablet widths.
5. Run production build and release packaging checks.
6. Verify publish/deploy instructions on the chosen target or document the exact external blocker.
7. Fix implementation, tests, or docs until the release criteria are true.
8. Commit signed, push, verify GitHub commit, and report final release state.

## Review Plan

Self-review focus:

- No exported config contains SBC layout/meta.
- No final config is generated from React Flow node state.
- Rule ordering comes from tables/domain state, not canvas edge order.
- Every release-critical field maps to the document inventory.
- Stable mode does not silently accept unsupported testing-gated fields.
- Tag rename/delete/connect behavior is explicit and tested.

Source-of-truth checks:

- Confirm official `#fields` top-level coverage.
- Confirm stable/testing docs used for fields touched in the release.
- Confirm `sing-box check` behavior is separated by target channel.

Diff scope checks:

- No unrelated refactors.
- No generated clutter committed unless required.
- No secrets or local machine state.
- README and docs match actual commands.

Design/UX checks:

- First viewport is the editor.
- Canvas, Inspector, Rules, JSON Preview, Diagnostics are all accessible.
- Text does not overlap or overflow in main supported viewport sizes.
- Node icon/type/tag/status are visible.
- Hover add/delete and selected-node Inspector are discoverable.

React performance checks:

- Heavy editors such as JSON editor/Monaco are dynamically loaded or otherwise deferred.
- React Flow interaction state does not cause full app rerenders on hover/drag.
- Derived graph/index work uses memoized selectors and Map/Set indexes.
- Imports avoid unnecessary barrel/bundle expansion.
- Expensive non-urgent updates use transitions or deferred state where appropriate.

## E2E Plan

Primary user path:

1. Start the app.
2. Open the editor.
3. Create a TUN inbound from the palette.
4. Add/connect Route through hover compatible-node UI.
5. Add Direct, Block, Selector, URLTest, and two proxy placeholders.
6. Add route rules: `domain_suffix: cn -> direct`, `domain_keyword: ads -> block`, final -> selector.
7. Select nodes and edit key fields in the right Inspector.
8. Reorder a rule in the Route Rules table and verify JSON order changes.
9. Edit JSON in Advanced mode and verify canvas/Inspector update.
10. Run stable validation.
11. Export pure `config.json`.
12. Re-import the exported JSON and verify semantic equivalence.

Required evidence:

- Automated E2E test or smoke script for the primary path.
- Browser/Playwright verification for the local app.
- Browser screenshot for the editor shell and a populated graph.
- Production build output.
- Test output for unit/integration/E2E.
- Official validation output or explicit documented reason it could not run.

Fallback if full E2E is blocked:

- Fix the app/test/docs if the blocker is under repo control.
- If blocked by external binary availability, add a deterministic fallback and document exact missing binary/version.
- If blocked by deployment credentials or paid external services, keep release local-build complete and document the exact publish step requiring user action.
- Do not mark the goal complete until the fallback still proves the user path as far as possible.

## Acceptance Criteria

Product:

- User can create the release-critical TUN split-routing config visually.
- User can inspect and edit every release-critical node in the right Inspector.
- User can add compatible nodes from hover UI.
- User can delete nodes/connections with correct JSON reference behavior.
- User can manage `route.rules` and `dns.rules` as ordered tables.
- User can view, edit, import, and export JSON.
- Exported `config.json` does not include layout/meta.
- Stable/testing channel selection is visible and affects validation.

Technical:

- Canonical config/domain model is the only source of truth.
- React Flow graph is derived.
- Domain commands cover create, connect, disconnect, delete, rename tag, edit field, import JSON, export JSON.
- Schema/node/Inspector registries are traceable to document inventory.
- Stable fixtures pass stable validation or official validation absence is explicitly blocked/reported.
- Testing fixtures use testing validation only when target channel is testing.

Quality:

- Unit tests cover domain commands and indexes.
- Round-trip tests cover import/export fixtures.
- E2E/smoke covers the primary user path.
- React performance review against `vercel-react-best-practices` is complete.
- Browser screenshot review passes for supported viewport sizes.
- README contains accurate run, test, build, and validation commands.
- CI or equivalent local release gate runs build, typecheck, tests, and E2E/smoke.
- No known release-blocking diagnostics remain.

Release:

- Build/typecheck/test commands pass.
- E2E/smoke passes.
- Publish/deploy instructions are verified or external blockers are explicit.
- Release notes document supported stable/testing behavior and known limitations.
- Final commit is signed.
- Push to `origin main` succeeds.
- GitHub shows the final commit as Verified.

## Validation Matrix

| Case | Check |
| --- | --- |
| Markdown/docs | `git diff --check` |
| TypeScript | project typecheck |
| Build | project build |
| Domain commands | unit tests |
| Import/export | round-trip fixture tests |
| Canvas/Inspector | component or integration tests |
| Primary workflow | E2E/smoke test |
| Stable fixtures | `sing-box-stable check` |
| Testing fixtures | `sing-box-testing check` |
| Browser layout | desktop and mobile/tablet screenshots |
| Release packaging | production build and publish/deploy instruction verification |
| Commit | `git log --show-signature -1` and GitHub verification |

## Done Definition

- Implementation complete: release-critical editor workflow works end to end.
- Review complete: source-of-truth, diff scope, and UX review are done.
- E2E complete: primary workflow is verified in browser automation or equivalent smoke test.
- Validation complete: stable/testing validation behavior is implemented and tested.
- Docs complete: README, AGENTS references, and goal notes reflect actual commands and behavior.
- Release complete: production build is verified, publish/deploy path is documented, signed commit is pushed to `origin main`, and GitHub reports Verified.

## Agent Autonomy

The agent should solve problems encountered on the path:

- If tests are wrong, fix the tests.
- If docs are wrong or underspecified, fix the docs.
- If the planned architecture conflicts with sing-box semantics, update the goal notes and implement the corrected path.
- If dependencies or tooling fail, diagnose and choose the most maintainable fix.
- If official validation cannot run, make that failure explicit and build the strongest safe fallback without pretending it is official validation.

Ask the user only for true product direction decisions, secrets, paid external services, or irreversible/destructive actions.

## Notes And Deviations

- Date:
- Decision:
- Reason:
