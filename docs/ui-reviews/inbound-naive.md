<!-- Status: ui-verified (2026-05-27). Shared atomics (listenSharedFields + tlsSharedFields + dialSharedFields + JsonField fallback + structured users editor + TLS-required scaffold + sensitive masking + diagnostics) landed; see docs/claude/index-ui-reviews.md Cross-Node Findings #1–#9. Node-specific P0/P1 still tracked here. -->
# Inbound / naive UI Review

## Scope

- Editable node: `inbound:naive`
- Official doc: `inbound/naive.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `inbounds[]` with `type: "naive"`.

Official writable fields from `inbound/naive.md`:

- `type`: `naive`
- `tag`
- Listen Fields from `shared/listen.md`.
- `network`: listen network, `tcp` or `udp`; empty means both.
- `users[]`: required Naive users with `username` and `password`.
- `quic_congestion_control`: since 1.13.0, one of `bbr`, `bbr_standard`, `bbr2`, `bbr2_variant`, `cubic`, `reno`.
- `tls`: inbound TLS object.

Relationship model:

- Route rules and DNS rules can match this inbound by tag through their `inbound[]` fields.
- Listen Fields `detour` references another inbound tag only when the target inbound is injectable.
- Listen Fields legacy sniff/domain fields are deprecated in 1.11 and removed in 1.13; import/migration-only.
- TLS is an embedded inbound TLS Inspector section, not a standalone node.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must add a Naive inbound object or clearly open a setup draft.
- The Docs action must open `inbound/naive.md`.
- Target selector matters: `quic_congestion_control` should only be editable/exported for 1.13+ targets.

Node-specific concern:

- Naive inbound always needs users and TLS to be useful; adding it should create a guided incomplete draft rather than a visually valid node with missing credentials.

Recommendation:

- Use `ADD` for creating this inbound and immediately open Inspector.
- Gate 1.13-only congestion control in the Inspector with clear target copy.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `naive` as the protocol chip.
- Status must fail locally when `users[]` is empty or TLS is absent for a usable server configuration.
- Bottom metadata should expose `naive`, semantic status, and route/DNS reference count only.

Port semantics:

- Left ports: none for upstream traffic.
- Right ports: Route Rule matcher and DNS Rule matcher references via `inbound[]`.
- Optional Listen Fields `detour` should be an advanced inbound-reference affordance or Inspector select.

Recommendation:

- Do not show outbound/group ports for Naive inbound.
- Hover drag should only create canonical route/DNS rule matcher references or Listen `detour`.

## Right: Inspector

Review:

- Inspector must expose tag, listen fields, `network`, users, and inbound TLS first.
- Users need a structured repeater with `username` and sensitive `password`.
- `quic_congestion_control` should be a select and hidden/disabled on 1.12 Legacy.
- Deprecated Listen Fields must be hidden unless imported, with migration copy pointing to route actions.
- Type switching must preserve tag references or show exactly which protocol fields will be dropped.

Recommendation:

- Prefer structured user rows and TLS controls over raw JSON textareas.

## Priority Findings

- P0 `users[]` is required and passwords must be sensitive.
- P0 TLS is a first-class inbound TLS section, not a generic JSON blob.
- P1 `quic_congestion_control` is target-gated to 1.13+.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags, users, TLS, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
