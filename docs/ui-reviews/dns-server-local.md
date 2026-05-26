<!-- Status: ui-verified (2026-05-27). Shared atomics (dial/listen/TLS shared fields + structured editors + diagnostics + platform/channel banners) landed; see docs/claude/index-ui-reviews.md Cross-Node Findings #1–#9. Node-specific outstanding P0/P1 still tracked here. -->
# DNS Server / local UI Review

## Scope

- Editable node: `dns-server:local`
- Official doc: `dns/server/local.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `dns.servers[]` with `type: "local"`.

Official writable fields from `dns/server/local.md`:

- `type`: `local`
- `tag`
- `prefer_go`: since 1.13.0.
- Dial Fields from `shared/dial.md`.

Relationship model:

- The server can be referenced by `dns.final`.
- DNS rules can route to it through `action: "route"` with `server`.
- Route resolve actions and Dial Fields `domain_resolver` can reference DNS servers by tag.
- Dial Fields `detour` references an outbound tag and, when set, all other Dial Fields are ignored.
- `prefer_go` is target-gated to 1.13+ and affects platform resolver behavior.

## Left: Add Library

Current expected action: `ADD`.

Review:

- The Library entry must add a local DNS server resource.
- The Docs action must open `dns/server/local.md`.
- Target gating should disable or hide `prefer_go` for 1.12 Legacy.

Node-specific concern:

- Local DNS is not an outbound. Its only downstream-like reference is the embedded Dial `detour`.

Recommendation:

- Keep `ADD` as the primary action and open Inspector for tag and optional Dial settings.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `local` as the DNS server type chip.
- Status should fail when `tag` is missing because other DNS objects reference servers by tag.
- The card can summarize `prefer_go` and detour state only.

Port semantics:

- Left ports: references from DNS final, DNS rules, route resolve actions, and domain resolver fields.
- Right ports: outbound detour only when Dial Fields `detour` is used.
- Do not show TLS/server-address ports for local DNS.

Recommendation:

- Dragging from DNS Rule to this node writes `dns.rules[].server`; dragging this node to an outbound writes Dial `detour`.

## Right: Inspector

Review:

- Inspector must expose tag, `prefer_go` with 1.13+ gate, and Dial Fields.
- Dial `detour` should be a select over outbound tags and should visually disable other Dial Fields when selected.
- Platform-specific `prefer_go` behavior needs short help copy.
- Deprecated Dial `domain_strategy` should be import-only and replaced by `domain_resolver`.

Recommendation:

- Keep common Local DNS setup minimal: tag, optional prefer_go, optional detour.

## Priority Findings

- P0 Dial `detour` must be an outbound tag reference, not a canvas-only edge.
- P1 `prefer_go` is target-gated to 1.13+ and needs platform copy.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags, invalid detours, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
