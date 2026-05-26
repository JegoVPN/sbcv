<!-- Status: ui-verified (2026-05-27). Shared atomics (Clash API external_ui controls + cache_file 1.13/1.14 fields + Sensitive masking + diagnostics) landed; see docs/claude/index-ui-reviews.md Cross-Node Findings #1–#9. Node-specific outstanding P0/P1 still tracked here. -->
# NTP Settings UI Review

## Scope

- Editable node: `settings:ntp`
- Official doc: `ntp/index.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This settings surface writes the top-level `ntp` object.

Official writable fields from `ntp/index.md`:

- `enabled`
- `server`: required when enabled.
- `server_port`: default `123`.
- `interval`: default `30m`.
- Dial Fields from `shared/dial.md`.

Relationship model:

- NTP has no tag and no route/DNS rule references.
- Dial Fields `detour` references an outbound tag and, when set, all other Dial Fields are ignored.
- NTP provides time for protocols such as TLS, Shadowsocks, and VMess, but it is not itself a traffic flow node.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry should read as `OPEN` or `SETUP`, not `ADD`, because there is only one top-level `ntp`.
- The Docs action must open `ntp/index.md`.
- The entry should not create duplicate NTP nodes.

Recommendation:

- Treat NTP as singleton settings with an optional outbound detour selector.

## Middle: Canvas Node

Review:

- If shown on canvas, it should be a small global settings card.
- No `+` affordance or rule/reference count is valid.
- A single optional outgoing detour affordance can be shown only if the product chooses to visualize Dial `detour`.

Port semantics:

- Left ports: none.
- Right ports: optional outbound detour through Dial Fields.

Recommendation:

- Prefer Inspector select for detour. If visualized, the edge must write canonical `ntp.detour`.

## Right: Inspector

Review:

- Inspector must expose enabled, server, server_port, interval, and Dial Fields.
- `server` is required only for enabled NTP.
- `server_port` should default to `123`.
- `interval` should be a duration field.
- Dial `detour` must be an outbound tag select and should visually disable other Dial Fields when selected.

Recommendation:

- Keep NTP concise: enable toggle, server, interval, optional detour.

## Priority Findings

- P0 NTP is singleton global settings and must not look like a chainable traffic node.
- P0 Dial `detour` must be an outbound tag reference.
- P1 required server should be conditional on `enabled`.

## Done Criteria

- Opening NTP updates canonical `ntp`.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing enabled server, invalid duration, invalid detour, and target/version hazards.
- Fixture or smoke coverage proves import, edit, and export for top-level `ntp`.
