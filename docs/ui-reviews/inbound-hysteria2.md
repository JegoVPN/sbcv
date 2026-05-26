<!-- Status: ui-verified (2026-05-27). Shared atomics (listenSharedFields + tlsSharedFields + dialSharedFields + JsonField fallback + structured users editor + TLS-required scaffold + sensitive masking + diagnostics) landed; see docs/claude/index-ui-reviews.md Cross-Node Findings #1–#9. Node-specific P0/P1 still tracked here. -->
# Inbound / hysteria2 UI Review

## Scope

- Editable node: `inbound:hysteria2`
- Official doc: `inbound/hysteria2.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `inbounds[]` with `type: "hysteria2"`.

Official writable fields from `inbound/hysteria2.md`:

- `type`: `hysteria2`
- `tag`
- Listen Fields from `shared/listen.md`.
- `up_mbps` and `down_mbps`: optional max bandwidth in Mbps.
- `obfs.type`: only `salamander`.
- `obfs.password`: obfuscator password.
- `users[]`: Hysteria2 users.
- `users[].password`: authentication password.
- `ignore_client_bandwidth`.
- `tls`: required inbound TLS object.
- `masquerade`: URL string configuration for auth failures.
- `masquerade.type`: object configuration, one of `file`, `proxy`, `string`.
- `masquerade.directory`, `url`, `rewrite_host`, `status_code`, `headers`, `content`.
- `brutal_debug`.

Relationship model:

- Route rules and DNS rules can match this inbound by tag through their `inbound[]` fields.
- Listen Fields `detour` references another inbound tag only when the target inbound is injectable.
- Listen Fields legacy sniff/domain fields are deprecated in 1.11 and removed in 1.13; import/migration-only.
- TLS is an embedded inbound TLS Inspector section, not a standalone node.
- `up_mbps/down_mbps` conflict semantically with `ignore_client_bandwidth`; UI must explain the official behavior.
- `masquerade` string and `masquerade.type` object modes are mutually exclusive.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must add a Hysteria2 inbound object or clearly open a setup draft.
- The Docs action must open `inbound/hysteria2.md`.
- Adding this node should surface required TLS and authentication gaps.

Node-specific concern:

- The official docs warn that sing-box does not support Hysteria2 official `userpass` alias. This should be shown near user password editing.

Recommendation:

- Use `ADD` and open Inspector with users, TLS, bandwidth, and masquerade as separate guided sections.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `hysteria2` as the protocol chip.
- Status must fail locally when TLS is missing or when masquerade modes conflict.
- The card can summarize user count, bandwidth cap, and obfs state.

Port semantics:

- Left ports: none for upstream traffic.
- Right ports: Route Rule matcher and DNS Rule matcher references via `inbound[]`.
- Optional Listen Fields `detour` should be an advanced inbound-reference affordance or Inspector select.

Recommendation:

- Do not show masquerade as downstream nodes. It is fallback HTTP3 behavior inside the inbound.

## Right: Inspector

Review:

- Inspector must expose tag, listen fields, users, required inbound TLS, bandwidth, obfs, and masquerade.
- Users need a structured repeater with sensitive password fields and official `userpass` compatibility copy.
- `obfs.type` should be a select with only `salamander`.
- Bandwidth controls should explain the `ignore_client_bandwidth` interaction.
- Masquerade needs a mode selector: none, URL, file, proxy, or string.
- Deprecated Listen Fields must be hidden unless imported, with migration copy pointing to route actions.

Recommendation:

- Use mode-based forms for `masquerade`; raw object editing should be advanced/import-only.

## Priority Findings

- P0 TLS is required.
- P0 masquerade string/object modes must be mutually exclusive.
- P0 users/passwords need structured sensitive controls and compatibility guidance.
- P1 bandwidth versus `ignore_client_bandwidth` needs inline diagnostics.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags, TLS, masquerade conflicts, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
