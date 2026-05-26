<!-- Status: ui-verified (2026-05-27). Shared atomics (Clash API external_ui controls + cache_file 1.13/1.14 fields + Sensitive masking + diagnostics) landed; see docs/claude/index-ui-reviews.md Cross-Node Findings #1–#9. Node-specific outstanding P0/P1 still tracked here. -->
# Certificate Settings UI Review

## Scope

- Editable node: `settings:certificate`
- Official doc: `certificate/index.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This settings surface writes the top-level `certificate` object.

Official writable fields from `certificate/index.md`:

- `store`: `system`, `mozilla`, `chrome`, or `none`.
- `certificate[]`: PEM certificate line array.
- `certificate_path[]`: PEM certificate file paths, automatically reloaded.
- `certificate_directory_path[]`: PEM certificate directory paths, automatically reloaded.

Relationship model:

- Certificate has no tag and no graph references.
- It is global trust configuration used by TLS consumers; it is not a certificate provider resource.
- `store: "chrome"` is available since 1.13.0.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry should read as `OPEN` or `SETUP`, not `ADD`, because there is only one top-level `certificate`.
- The Docs action must open `certificate/index.md`.
- It must be distinct from `certificate_providers[]`, which are separate shared provider resources.

Recommendation:

- Treat Certificate as singleton trust settings; certificate providers remain separate resource/config sections.

## Middle: Canvas Node

Review:

- If shown on canvas, it should be a small global settings card with no side ports.
- No `+` affordance, rule/reference count, or traffic-chain edge is valid.
- The card can summarize selected store and custom certificate counts.

Port semantics:

- Left ports: none.
- Right ports: none.

Recommendation:

- Prefer direct Inspector opening over fake canvas placement.

## Right: Inspector

Review:

- Inspector must expose store select, certificate text/list editor, certificate path list, and directory path list.
- `store: "chrome"` needs 1.13+ target gating.
- PEM certificates should be edited as multi-line entries or file references, not hidden raw JSON only.
- Path lists should clearly say files/directories are automatically reloaded.

Recommendation:

- Use clear modes: trust store, paste PEM, add files, add directory.

## Priority Findings

- P0 Certificate is singleton global settings and must not be confused with certificate providers.
- P1 Chrome Root Store is target-gated to 1.13+.
- P1 PEM/path arrays need structured editing.

## Done Criteria

- Opening Certificate updates canonical `certificate`.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch invalid store values and target/version hazards.
- Fixture or smoke coverage proves import, edit, and export for top-level `certificate`.
