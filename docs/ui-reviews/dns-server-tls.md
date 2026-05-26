<!-- Status: official-read. Source: stable docs/configuration/dns/server/tls.md, shared/tls.md, and shared/dial.md; reviewed against current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# DNS Server / tls UI Review

## Scope

- Editable node: `dns-server:tls`
- Official doc: `dns/server/tls.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `dns.servers[]` with `type: "tls"`.

Official writable fields from `dns/server/tls.md`:

- `type`: `tls`
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
- TLS here is outbound TLS, because this DNS server dials a remote DoT server.

## Left: Add Library

Current expected action: `ADD`.

Review:

- The Library entry must add a DNS-over-TLS server resource.
- The Docs action must open `dns/server/tls.md`.
- Adding should select the node and ask for server address.

Node-specific concern:

- TLS is embedded in the DNS server; it is not a standalone downstream node.

Recommendation:

- Keep `ADD`; put server/server_port first and TLS/Dial in collapsible sections.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `tls` or `DoT` as the DNS server type chip.
- Status should fail when `tag` or `server` is missing.
- The card should summarize `server:853`, TLS state, and detour state.

Port semantics:

- Left ports: references from DNS final, DNS rules, route resolve actions, and domain resolver fields.
- Right ports: outbound detour via Dial Fields `detour`.
- No separate TLS node port is valid.

Recommendation:

- Keep TLS as card metadata and Inspector fields.

## Right: Inspector

Review:

- Inspector must expose tag, server, server_port, outbound TLS, and Dial Fields.
- `server_port` should default to `853`.
- Dial `detour` should be an outbound select and should visually disable other Dial Fields when selected.
- TLS SNI/server-name settings should be visible when server is an IP address or custom hostname is needed.
- Domain-name server values should trigger a resolver diagnostic if needed.

Recommendation:

- Use structured outbound TLS controls, not raw JSON, for the common DoT path.

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
