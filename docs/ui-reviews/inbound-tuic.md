<!-- Status: ui-verified (2026-05-27). Shared atomics (listenSharedFields + tlsSharedFields + dialSharedFields + JsonField fallback + structured users editor + TLS-required scaffold + sensitive masking + diagnostics) landed; see docs/claude/index-ui-reviews.md Cross-Node Findings #1–#9. Node-specific P0/P1 still tracked here. -->
# Inbound / tuic UI Review

## Scope

- Editable node: `inbound:tuic`
- Official doc: `inbound/tuic.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `inbounds[]` with `type: "tuic"`.

Official writable fields from `inbound/tuic.md`:

- `type`: `tuic`
- `tag`
- Listen Fields from `shared/listen.md`.
- `users[]`: TUIC users.
- `users[].uuid`: required TUIC user UUID.
- `users[].password`: TUIC user password.
- `congestion_control`: `cubic`, `new_reno`, or `bbr`.
- `auth_timeout`: duration, default `3s`.
- `zero_rtt_handshake`: boolean with replay-attack warning.
- `heartbeat`: duration, default `10s`.
- `tls`: required inbound TLS object.

Relationship model:

- Route rules and DNS rules can match this inbound by tag through their `inbound[]` fields.
- Listen Fields `detour` references another inbound tag only when the target inbound is injectable.
- Listen Fields legacy sniff/domain fields are deprecated in 1.11 and removed in 1.13; import/migration-only.
- TLS is an embedded inbound TLS Inspector section, not a standalone node.
- `zero_rtt_handshake` has a security warning and should not be a casual unlabeled toggle.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must add a TUIC inbound object or clearly open a setup draft.
- The Docs action must open `inbound/tuic.md`.
- Adding this node should immediately show required UUID/password/TLS gaps.

Node-specific concern:

- Users may enable 0-RTT without understanding replay risk if it appears as a generic checkbox.

Recommendation:

- Use `ADD` and open Inspector with user, TLS, and security-sensitive QUIC fields grouped.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `tuic` as the protocol chip.
- Status must fail locally when user UUID or TLS is missing.
- The card can summarize user count, congestion control, and TLS state.

Port semantics:

- Left ports: none for upstream traffic.
- Right ports: Route Rule matcher and DNS Rule matcher references via `inbound[]`.
- Optional Listen Fields `detour` should be an advanced inbound-reference affordance or Inspector select.

Recommendation:

- Keep auth timeout, heartbeat, and 0-RTT off the card unless invalid or explicitly changed.

## Right: Inspector

Review:

- Inspector must expose tag, listen fields, users, congestion control, and required inbound TLS.
- Users need a structured repeater with UUID validation and sensitive password fields.
- `congestion_control` should be a select.
- `auth_timeout` and `heartbeat` should be duration inputs.
- `zero_rtt_handshake` needs inline warning copy from the official docs.
- Deprecated Listen Fields must be hidden unless imported, with migration copy pointing to route actions.

Recommendation:

- Use guided structured fields; reserve raw JSON only for unknown imported extras.

## Priority Findings

- P0 user UUID and TLS requirements must be visible before Check.
- P0 passwords must be sensitive.
- P1 0-RTT warning must be shown near the toggle.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags, user UUIDs, TLS, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
