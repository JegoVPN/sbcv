<!-- Status: official-read. Source: stable docs/configuration/dns/server/quic.md, shared/tls.md, and shared/dial.md; reviewed against current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# DNS Server / quic UI Review

## Scope

- Editable node: `dns-server:quic`
- Official doc: `dns/server/quic.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `dns.servers[]` with `type: "quic"`.

Official writable fields from `dns/server/quic.md`:

- `type`: `quic`
- `tag`
- `server`: required DNS server address.
- `server_port`: default `853`.
- `tls`: outbound TLS shared section.
- Dial Fields from `shared/dial.md`.

Relationship model:

- The server can be referenced by `dns.final`.
- DNS rules can route to it through `action: "route"` with `server`.
- Route resolve actions and Dial Fields `domain_resolver` can reference DNS servers by tag.
- Dial Fields `detour` references an outbound tag and, when set, all other Dial Fields are ignored.
- TLS here is outbound TLS for DNS-over-QUIC.

## Left: Add Library

Current expected action: `ADD`.

Review:

- The Library entry must add a DNS-over-QUIC server resource.
- The Docs action must open `dns/server/quic.md`.
- Adding should select the node and ask for server address.

Node-specific concern:

- QUIC still uses the same server/port/TLS/Dial shape as DoT; a separate complex UI is unnecessary.

Recommendation:

- Keep `ADD`; put server/server_port first and TLS/Dial in collapsible sections.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `quic` or `DoQ` as the DNS server type chip.
- Status should fail when `tag` or `server` is missing.
- The card should summarize `server:853`, TLS state, and detour state.

Port semantics:

- Left ports: references from DNS final, DNS rules, route resolve actions, and domain resolver fields.
- Right ports: outbound detour via Dial Fields `detour`.
- No separate TLS node port is valid.

Recommendation:

- Keep QUIC DNS visually aligned with DoT to reduce user confusion.

## Right: Inspector

Review:

- Inspector must expose tag, server, server_port, outbound TLS, and Dial Fields.
- `server_port` should default to `853`.
- Dial `detour` should be an outbound select and should visually disable other Dial Fields when selected.
- Domain-name server values should trigger a resolver diagnostic if needed.

Recommendation:

- Use the same remote encrypted DNS form as DoT, with protocol-specific defaults.

## Priority Findings

- P0 `server` is required.
- P0 TLS must be outbound TLS embedded on this DNS server.
- P0 Dial `detour` must be an outbound tag reference.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags, missing server, invalid detours, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
