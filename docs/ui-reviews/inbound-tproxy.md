<!-- Status: official-read. Source: stable docs/configuration/inbound/tproxy.md and shared/listen.md; reviewed against current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# Inbound / tproxy UI Review

## Scope

- Editable node: `inbound:tproxy`
- Official doc: `inbound/tproxy.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `inbounds[]` with `type: "tproxy"`.

Official writable fields from `inbound/tproxy.md`:

- `type`: `tproxy`
- `tag`
- Listen Fields from `shared/listen.md`.
- `network`: listen network, `tcp` or `udp`; empty means both.

Relationship model:

- TProxy inbound is only supported on Linux.
- Route rules and DNS rules can match this inbound by tag through their `inbound[]` fields.
- Listen Fields `detour` references another inbound tag only when the target inbound is injectable.
- Listen Fields legacy sniff/domain fields are deprecated in 1.11 and removed in 1.13; import/migration-only.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must add a TProxy inbound object or clearly open a setup draft.
- The Docs action must open `inbound/tproxy.md`.
- The entry must show Linux-only support before add.

Node-specific concern:

- TProxy users need routing/firewall context; the canvas should not imply it works by just adding a node.

Recommendation:

- Use `ADD` only when the active target/platform allows it; otherwise show gated help or docs.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `tproxy` as the protocol chip.
- Status must warn on incompatible platform target and missing listen fields.
- The card can summarize network mode only.

Port semantics:

- Left ports: none for upstream traffic.
- Right ports: Route Rule matcher and DNS Rule matcher references via `inbound[]`.
- Optional Listen Fields `detour` should be an advanced inbound-reference affordance or Inspector select.

Recommendation:

- Do not expose outbound group ports. TProxy only contributes an inbound tag and Listen Fields.

## Right: Inspector

Review:

- Inspector must expose tag, Listen Fields, and `network`.
- `network` should be a small select with `both`, `tcp`, and `udp`.
- Linux-only support copy should be visible near the header.
- Deprecated Listen Fields must be hidden unless imported, with migration copy pointing to route actions.
- Type switching should preserve tag references or show exactly which fields will be dropped.

Recommendation:

- Keep advanced routing setup out of this node unless it writes actual documented TProxy fields.

## Priority Findings

- P0 Linux-only support must be explicit.
- P1 `network` should be select-driven, not free text.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags, listen fields, platform hazards, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
