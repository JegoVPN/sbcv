<!-- Status: ui-verified (2026-05-27). Shared atomics (dial/listen/TLS shared fields + structured editors + diagnostics + platform/channel banners) landed; see docs/claude/index-ui-reviews.md Cross-Node Findings #1–#9. Node-specific outstanding P0/P1 still tracked here. -->
# Rule Set / local UI Review

## Scope

- Editable node: `rule-set:local`
- Official doc: `rule-set/index.md + rule-set/source-format.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `route.rule_set[]` with `type: "local"`.

Official writable fields from `rule-set/index.md`:

- `type`: `local`
- `tag`: required.
- `format`: `source` or `binary`; optional when `path` extension implies `json` or `srs`.
- `path`: required local file path, automatically reloaded if modified since 1.10.0.

Related rule-set docs:

- Source-format files have `version` and `rules[]`.
- Headless rules define match items used inside source rule-set content.
- AdGuard filters must be converted to binary; they are not directly supported as source formats.

Relationship model:

- Route rules and DNS rules reference rule-set tags via their rule-set fields.
- TUN `route_address_set[]` and `route_exclude_address_set[]` reference rule-set tags.
- Local rule-set has no outbound download detour.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must add a local rule-set resource.
- The Docs action must open `rule-set/index.md`.
- The add flow should clearly distinguish local file from remote URL and inline rules.

Node-specific concern:

- Local rule-set path is not itself a rule order. Rule order remains in route/DNS rule tables.

Recommendation:

- Use `ADD` and open Inspector with path/format plus attach-to-rule affordances.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `local rule-set` as the type.
- Status must fail when tag or path is missing.
- The card should summarize format and file path.

Port semantics:

- Left ports: references from Route Rules, DNS Rules, and TUN route set fields.
- Right ports: none.

Recommendation:

- Do not show download/outbound ports for local rule-set.

## Right: Inspector

Review:

- Inspector must expose tag, path, and format.
- `format` should be a select with source/binary and extension-based hints.
- Path should be a file-path input with auto-reload note.
- Attach/detach from route/DNS rules should be explicit and table-owned for rule order.

Recommendation:

- Keep local rule-set as a resource card, not an ordered rule editor.

## Priority Findings

- P0 required tag/path and canonical rule references must be explicit.
- P0 no outbound detour is valid for local rule-set.
- P1 source/binary/AdGuard conversion rules need visible copy.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags, missing path, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
