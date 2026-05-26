<!-- Status: ui-verified (2026-05-27). Shared atomics (listenSharedFields + tlsSharedFields + dialSharedFields + JsonField fallback + structured users editor + TLS-required scaffold + sensitive masking + diagnostics) landed; see docs/claude/index-ui-reviews.md Cross-Node Findings #1–#9. Node-specific P0/P1 still tracked here. -->
# Inbound / anytls UI Review

## Scope

- Editable node: `inbound:anytls`
- Official doc: `inbound/anytls.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `inbounds[]` with `type: "anytls"`.

Official writable fields from `inbound/anytls.md`:

- `type`: `anytls`
- `tag`
- Listen Fields from `shared/listen.md`.
- `users[]`: required AnyTLS users with `name` and `password`.
- `padding_scheme[]`: AnyTLS padding scheme line array.
- `tls`: inbound TLS object.

Relationship model:

- AnyTLS inbound exists since 1.12.0, so it is unavailable for pre-1.12 targets but valid for 1.12 Legacy, 1.13 stable, and 1.14 testing.
- Route rules and DNS rules can match this inbound by tag through their `inbound[]` fields.
- Listen Fields `detour` references another inbound tag only when the target inbound is injectable.
- Listen Fields legacy sniff/domain fields are deprecated in 1.11 and removed in 1.13; import/migration-only.
- TLS is an embedded inbound TLS Inspector section, not a standalone node.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must add an AnyTLS inbound object or clearly open a setup draft.
- The Docs action must open `inbound/anytls.md`.
- Target copy should note this is 1.12+.

Node-specific concern:

- `padding_scheme` is a line array with a documented default; most users should not have to edit it before the node works.

Recommendation:

- Use `ADD` and put padding scheme under Advanced with "use default" as the normal path.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `anytls` as the protocol chip.
- Status must fail locally when users or TLS are missing.
- The card can summarize user count and whether custom padding is enabled.

Port semantics:

- Left ports: none for upstream traffic.
- Right ports: Route Rule matcher and DNS Rule matcher references via `inbound[]`.
- Optional Listen Fields `detour` should be an advanced inbound-reference affordance or Inspector select.

Recommendation:

- Do not expose padding scheme on the card; it is advanced protocol tuning.

## Right: Inspector

Review:

- Inspector must expose tag, listen fields, users, and inbound TLS first.
- Users need a structured repeater with sensitive passwords.
- `padding_scheme[]` should be a line editor with a default/reset affordance, not raw JSON.
- Deprecated Listen Fields must be hidden unless imported, with migration copy pointing to route actions.

Recommendation:

- Keep the common path short: users, TLS, optional padding advanced.

## Priority Findings

- P0 `users[]` is required and passwords must be sensitive.
- P0 TLS must be first-class.
- P1 padding scheme should be advanced and resettable to official default.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags, users, TLS, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
