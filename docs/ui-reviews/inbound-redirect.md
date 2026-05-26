<!-- Status: official-read. Source: stable docs/configuration/inbound/redirect.md and shared/listen.md; reviewed against current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# Inbound / redirect UI Review

## Scope

- Editable node: `inbound:redirect`
- Official doc: `inbound/redirect.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `inbounds[]` with `type: "redirect"`.

Official writable fields from `inbound/redirect.md`:

- `type`: `redirect`
- `tag`
- Listen Fields from `shared/listen.md`.

Relationship model:

- Redirect inbound is only supported on Linux and macOS.
- Route rules and DNS rules can match this inbound by tag through their `inbound[]` fields.
- Listen Fields `detour` references another inbound tag only when the target inbound is injectable.
- Listen Fields legacy sniff/domain fields are deprecated in 1.11 and removed in 1.13; import/migration-only.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must add a Redirect inbound object or clearly open a setup draft.
- The Docs action must open `inbound/redirect.md`.
- The entry must show Linux/macOS support before add, especially when target/client preset is not compatible.

Node-specific concern:

- Redirect is platform infrastructure, not a general proxy protocol. Users need setup guidance, not a blank protocol node.

Recommendation:

- Use `ADD` only when the active target/platform allows it; otherwise show gated help or docs.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `redirect` as the protocol chip.
- Status must warn on incompatible platform target and missing listen address/port.
- The card should be compact because there are no protocol-specific fields.

Port semantics:

- Left ports: none for upstream traffic.
- Right ports: Route Rule matcher and DNS Rule matcher references via `inbound[]`.
- Optional Listen Fields `detour` should be an advanced inbound-reference affordance or Inspector select.

Recommendation:

- Do not invent protocol side ports. Redirect only owns Listen Fields and tag references.

## Right: Inspector

Review:

- Inspector must expose tag and Listen Fields first.
- Platform support copy should be visible near the header.
- Deprecated Listen Fields must be hidden unless imported, with migration copy pointing to route actions.
- Type switching should preserve tag references or show exactly which fields will be dropped.

Recommendation:

- Keep this Inspector very small: platform guidance plus Listen Fields.

## Priority Findings

- P0 platform support must be explicit: Linux and macOS only.
- P1 no fake downstream fields or generic protocol JSON should be shown.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags, listen fields, platform hazards, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
