<!-- Status: ui-verified (2026-05-27). Shared atomics (listenSharedFields + tlsSharedFields + dialSharedFields + JsonField fallback + structured users editor + TLS-required scaffold + sensitive masking + diagnostics) landed; see docs/claude/index-ui-reviews.md Cross-Node Findings #1–#9. Node-specific P0/P1 still tracked here. -->
# Inbound / shadowtls UI Review

## Scope

- Editable node: `inbound:shadowtls`
- Official doc: `inbound/shadowtls.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `inbounds[]` with `type: "shadowtls"`.

Official writable fields from `inbound/shadowtls.md`:

- `type`: `shadowtls`
- `tag`
- Listen Fields from `shared/listen.md`.
- `version`: ShadowTLS protocol version `1`, `2`, or `3`.
- `password`: v2-only password.
- `users[]`: v3-only users with `name` and `password`.
- `handshake`: required handshake server object with `server`, `server_port`, and Dial Fields from `shared/dial.md`.
- `handshake_for_server_name`: v2/v3 server-name keyed handshake map.
- `strict_mode`: v3-only.
- `wildcard_sni`: since 1.12.0, v3-only, `off`, `authed`, or `all`.

Relationship model:

- Route rules and DNS rules can match this inbound by tag through their `inbound[]` fields.
- Listen Fields `detour` references another inbound tag only when the target inbound is injectable.
- Listen Fields legacy sniff/domain fields are deprecated in 1.11 and removed in 1.13; import/migration-only.
- Handshake and handshake_for_server_name are outbound-like dial targets embedded inside the inbound; they are not outbound tag references.
- Dial Fields inside handshake may use `detour` to reference an outbound tag.
- Version controls which credential fields are legal.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must add a ShadowTLS inbound object or clearly open a setup draft.
- The Docs action must open `inbound/shadowtls.md`.
- Target/version copy is required because `wildcard_sni` is 1.12+ and several fields are protocol-version gated.

Node-specific concern:

- This node is easy to misconfigure if the UI shows `password`, `users`, `strict_mode`, and `wildcard_sni` together without version gating.

Recommendation:

- Use `ADD` and immediately open Inspector with protocol version as the first decision.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `shadowtls` and protocol version as compact chips.
- Status must fail locally when `handshake` is missing or when v2/v3 credential requirements conflict.
- The card should summarize handshake host and version; it should not list every server-name override.

Port semantics:

- Left ports: none for upstream traffic.
- Right ports: Route Rule matcher and DNS Rule matcher references via `inbound[]`.
- Advanced embedded Dial `detour` references may show as outbound-reference affordances only when visible in Inspector.

Recommendation:

- Distinguish handshake dial targets from actual outbounds. Do not let users drag a route edge and accidentally overwrite handshake Dial Fields.

## Right: Inspector

Review:

- Inspector must expose tag, listen fields, protocol version, credentials, and required handshake first.
- v2 should show `password`; v3 should show `users[]`, `strict_mode`, and `wildcard_sni`.
- `handshake` needs structured `server`, `server_port`, and Dial Fields controls.
- `handshake_for_server_name` needs a keyed repeater, not raw object editing for common cases.
- Dial `detour` should be a select of outbound tags.
- Deprecated Listen Fields must be hidden unless imported, with migration copy pointing to route actions.

Recommendation:

- Make version selection the UI branch. Hide invalid fields instead of leaving them editable.

## Priority Findings

- P0 protocol version must gate credential and wildcard fields.
- P0 `handshake` is required and must be structured.
- P1 embedded Dial Fields must be clearly separate from outbound nodes.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing handshake, illegal version-field combinations, missing tags, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
