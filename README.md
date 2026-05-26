# SBC

SBC is a sing-box configuration builder planned around a canonical JSON/domain model with a React Flow visual editing layer.

The canvas is not the source of truth. The sing-box JSON config and validated domain model are.

## Development

```bash
pnpm install
pnpm dev
```

Useful checks:

```bash
pnpm build
pnpm test
pnpm validate:fixtures
pnpm e2e
pnpm release:check
```

Fixture validation runs official `sing-box-stable` and `sing-box-testing` binaries when they are available in `.tools/bin/` or on `PATH`; otherwise it reports that official checks were skipped and only performs deterministic JSON parsing. For local release verification, place the stable binary at `.tools/bin/sing-box-stable` and the testing binary at `.tools/bin/sing-box-testing`.

## Publish

```bash
pnpm build
pnpm preview
```

The app builds to `dist/` and can be hosted as a static site. Hosted deployment credentials or platform selection are intentionally outside the repo.

## Documents

- [Agents Guide](AGENTS.md)
- [SBC React Flow R&D Plan](docs/sbc-react-flow-rd-plan.md)
- [sing-box Config Document Inventory](docs/sing-box-config-doc-inventory.md)
- [Goal-Driven Development](docs/goal-driven-development.md)
- [Release Goal: Stable-First SBC Visual Editor](docs/goals/stable-first-sbc-visual-editor-release.md)
- [First Goal: Project Scaffold And UI Shell](docs/goals/project-scaffold-and-ui-shell.md)
- [Release Notes](docs/release-notes.md)
