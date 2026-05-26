<!-- Status: implemented (2026-05-27). Source: stable docs/configuration/log/index.md. P0 timestamp toggle added to Inspector with disabled-first ordering; output placeholder corrected. Outstanding: P1 singleton guard for Palette and P2 canvas subtitle differentiation. -->
# Log Settings UI Review

## Scope

- Editable node: `settings:log`
- Official doc: `log/index.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This settings surface writes the top-level `log` object.

Official writable fields from `log/index.md`:

- `disabled`
- `level`: one of `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `panic`.
- `output`: file path; when enabled, logs are not written to console.
- `timestamp`

Relationship model:

- Log has no tag and no graph references.
- It is global settings, not a traffic node, route node, DNS node, or resource.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry should read as `OPEN` or `SETUP`, not `ADD`, because there is only one top-level `log`.
- The Docs action must open `log/index.md`.
- The entry should not create duplicate log nodes.

Recommendation:

- Treat Log as a singleton settings module in the Library pill, not as an addable canvas object.

## Middle: Canvas Node

Review:

- If shown on canvas, it should be a small global settings card with no side ports.
- No `+` affordance, upstream handles, downstream handles, or reference count are valid.
- Status should mean local field validity only, not official `sing-box check`.

Port semantics:

- Left ports: none.
- Right ports: none.

Recommendation:

- Prefer opening the right Inspector directly over placing a fake node on the flow graph.

## Right: Inspector

Review:

- Inspector must expose `disabled`, `level`, `output`, and `timestamp`.
- `level` must be a select.
- `output` should explain console output behavior.
- No tag, type switch, route/DNS tabs, JSON preview, or graph connect actions belong here.

Recommendation:

- Keep the Inspector compact and global; no canvas-specific controls.

## Priority Findings

- P0 Log is singleton global settings and must not look chainable.
- P1 `level` needs enum control and `output` needs console behavior hint.

## Done Criteria

- Opening Log updates canonical `log`.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch invalid log levels.
- Fixture or smoke coverage proves import, edit, and export for top-level `log`.
