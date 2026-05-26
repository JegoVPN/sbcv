<!-- Status: ui-verified (2026-05-27). Shared atomics (dial/listen/TLS shared fields + structured editors + diagnostics + platform/channel banners) landed; see docs/claude/index-ui-reviews.md Cross-Node Findings #1–#9. Node-specific outstanding P0/P1 still tracked here. -->
# Rule Set / remote UI Review

## Scope

- Editable node: `rule-set:remote`
- Official doc: `rule-set/index.md + rule-set/source-format.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `route.rule_set[]` with `type: "remote"`.

Official writable fields from `rule-set/index.md`:

- `type`: `remote`
- `tag`: required.
- `format`: `source` or `binary`; optional when `url` extension implies `json` or `srs`.
- `url`: required.
- `download_detour`: outbound tag for downloading the rule-set.
- `update_interval`: default `1d`.

Related rule-set docs:

- Source-format files have `version` and `rules[]`.
- Headless rules define the actual match items used inside inline/source rule-set content.
- AdGuard filters are not source format directly; they must be converted to binary with `sing-box rule-set convert --type adguard`.

Relationship model:

- Route rules and DNS rules reference rule-set tags via their rule-set fields.
- TUN `route_address_set[]` and `route_exclude_address_set[]` reference rule-set tags.
- `download_detour` references an outbound tag.
- Remote rule-sets are cached if `experimental.cache_file.enabled`.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must add a remote rule-set resource.
- The Docs action must open `rule-set/index.md`.
- The add flow should clearly distinguish remote URL, local file, and inline rule-set.

Node-specific concern:

- Users will expect rule-sets to affect routing immediately; the UI must show that a route/DNS rule still has to reference the tag.

Recommendation:

- Use `ADD` and open Inspector with url/format/download detour, plus an "attach to rule" affordance.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `remote rule-set` as the type.
- Status must fail when tag or url is missing.
- The card should summarize format, update interval, and download detour.

Port semantics:

- Left ports: references from Route Rules, DNS Rules, and TUN route set fields.
- Right ports: outbound download detour only.

Recommendation:

- Dragging from a route/DNS rule to this node writes the relevant rule-set tag; dragging this node to an outbound writes `download_detour`.

## Right: Inspector

Review:

- Inspector must expose tag, url, format, update interval, and download detour.
- `download_detour` must be an outbound select.
- `format` should be a select with source/binary and extension-based hints.
- AdGuard content should be explained as convert-to-binary, not directly editable as source rules.
- Attach/detach from route/DNS rules should be explicit and table-owned for rule order.

Recommendation:

- Keep rule-set content editing separate from remote metadata; remote nodes point to files.

## Priority Findings

- P0 required tag/url and outbound download detour reference must be explicit.
- P0 route/DNS/TUN references must update canonical tag fields, not canvas-only edges.
- P1 AdGuard conversion caveat should be visible when users choose binary/AdGuard templates.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags, missing url, invalid detour, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
