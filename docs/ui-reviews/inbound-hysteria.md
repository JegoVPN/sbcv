<!-- Status: ui-verified (2026-05-27). Shared atomics (listenSharedFields + tlsSharedFields + dialSharedFields + JsonField fallback + structured users editor + TLS-required scaffold + sensitive masking + diagnostics) landed; see docs/claude/index-ui-reviews.md Cross-Node Findings #1–#9. Node-specific P0/P1 still tracked here. -->
# Inbound / hysteria UI Review

## Scope

- Editable node: `inbound:hysteria`
- Official doc: `inbound/hysteria.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `inbounds[]` with `type: "hysteria"`.

Official writable fields from `inbound/hysteria.md`:

- `type`: `hysteria`
- `tag`
- Listen Fields from `shared/listen.md`.
- `up` and `down`: required bandwidth strings such as `100 Mbps`.
- `up_mbps` and `down_mbps`: required Mbps numeric alternatives.
- `obfs`: obfuscation password.
- `users[]`: Hysteria users with `name`, `auth`, and `auth_str`.
- `recv_window_conn`, `recv_window_client`, `max_conn_client`.
- `disable_mtu_discovery`.
- `tls`: required inbound TLS object.

Relationship model:

- Route rules and DNS rules can match this inbound by tag through their `inbound[]` fields.
- Listen Fields `detour` references another inbound tag only when the target inbound is injectable.
- Listen Fields legacy sniff/domain fields are deprecated in 1.11 and removed in 1.13; import/migration-only.
- TLS is an embedded inbound TLS Inspector section, not a standalone node.
- `up/down` string fields and `up_mbps/down_mbps` numeric fields are alternate ways to express bandwidth and should not force duplicate entry.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must add a Hysteria inbound object or clearly open a setup draft.
- The Docs action must open `inbound/hysteria.md`.
- Adding this node should immediately surface required bandwidth and TLS gaps.

Node-specific concern:

- A Hysteria server without bandwidth and TLS is not a meaningful complete object; the UI should not present it as valid.

Recommendation:

- Use `ADD` and open Inspector with a guided "bandwidth + TLS + users" sequence.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `hysteria` as the protocol chip.
- Status must fail locally when required bandwidth or TLS is missing.
- The card should summarize bandwidth and user count, not expose raw QUIC window fields.

Port semantics:

- Left ports: none for upstream traffic.
- Right ports: Route Rule matcher and DNS Rule matcher references via `inbound[]`.
- Optional Listen Fields `detour` should be an advanced inbound-reference affordance or Inspector select.

Recommendation:

- Keep QUIC tuning out of the card; it belongs in an advanced Inspector section.

## Right: Inspector

Review:

- Inspector must expose tag, listen fields, bandwidth, users, and required inbound TLS first.
- Bandwidth should be one UI group that can write either `up/down` strings or `up_mbps/down_mbps`, not four confusing independent inputs.
- Users need a structured repeater; `auth` and `auth_str` are alternate credential forms and should be mutually explained.
- QUIC receive windows, max connection count, and MTU discovery belong in an advanced section.
- Deprecated Listen Fields must be hidden unless imported, with migration copy pointing to route actions.

Recommendation:

- Use unit-aware bandwidth controls and sensitive credential fields; raw JSON should be advanced-only.

## Priority Findings

- P0 bandwidth and TLS requirements must be visible before Check.
- P0 user auth fields need structured, sensitive controls.
- P1 QUIC tuning should be advanced and not shown as generic text boxes by default.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags, bandwidth, TLS, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
