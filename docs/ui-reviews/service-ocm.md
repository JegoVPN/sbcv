<!-- Status: official-read. Source: stable docs/configuration/service/ocm.md, shared/listen.md, and shared/tls.md; reviewed against current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# Service / ocm UI Review

## Scope

- Editable node: `service:ocm`
- Official doc: `service/ocm.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `services[]` with `type: "ocm"`.

Official writable fields from `service/ocm.md`:

- `type`: `ocm`
- Listen Fields from `shared/listen.md`.
- `credential_path`
- `usages_path`
- `users[]`: authorized users with `name` and `token`.
- `headers`: custom HTTP headers sent to OpenAI API.
- `detour`: outbound tag for connecting to OpenAI API.
- `tls`: inbound TLS object.

Relationship model:

- OCM is available since 1.13.0.
- It is a runtime service, not a route target or outbound.
- `detour` references an outbound tag.
- TLS is inbound TLS for serving the OCM service.
- Users/tokens are nested credentials, not graph nodes.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must add an OCM service resource or open a setup wizard.
- The Docs action must open `service/ocm.md`.
- Target gating should disable OCM on 1.12 Legacy.

Node-specific concern:

- OCM exposes a remote Codex proxy; unauthenticated public listen addresses are dangerous.

Recommendation:

- Use `ADD` only for 1.13+ targets and open Inspector with listen/auth guidance.

## Middle: Canvas Node

Review:

- The node label should show `OCM` and listen address/port.
- Status should warn when listening publicly without users or TLS.
- The card should summarize user count, TLS state, usage tracking, and detour state.

Port semantics:

- Left ports: none for traffic routing.
- Right ports: outbound detour via `detour`.

Recommendation:

- Keep service nodes outside the main traffic layout unless the user explicitly visualizes service detour.

## Right: Inspector

Review:

- Inspector must expose Listen Fields, credential path, usage path, users, headers, detour, and inbound TLS.
- Users need a structured repeater with sensitive token fields.
- Headers need a key/value repeater.
- Detour must be an outbound select.
- Public listen without users/secret-like auth should be a high-priority diagnostic.
- Deprecated Listen Fields must be import-only.

Recommendation:

- Use a security-first service form: listen scope, auth users, TLS, then advanced paths/headers/detour.

## Priority Findings

- P0 1.13+ target gate is required.
- P0 service detour must be an outbound tag reference.
- P0 tokens must be sensitive and public unauthenticated listen should warn.
- P1 users/headers need structured repeaters.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch unsafe listen/auth combinations, invalid detours, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
