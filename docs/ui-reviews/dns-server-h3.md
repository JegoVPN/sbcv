<!-- Status: ui-verified (2026-05-27). Shared atomics (dial/listen/TLS shared fields + structured editors + diagnostics + platform/channel banners) landed; see docs/claude/index-ui-reviews.md Cross-Node Findings #1–#9. Node-specific outstanding P0/P1 still tracked here. -->
# DNS Server / h3 UI Review

## Scope

- Editable node: `dns-server:h3`
- Official doc: `dns/server/http3.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `dns.servers[]` with `type: "h3"`.

Official writable fields from `dns/server/http3.md`:

- `type`: `h3`
- `tag`
- `server`: required DNS server address.
- `server_port`: default `443`.
- `path`: default `/dns-query`.
- `headers`: additional request headers.
- `tls`: outbound TLS shared section.
- Dial Fields from `shared/dial.md`.

Relationship model:

- The server can be referenced by `dns.final`.
- DNS rules can route to it through `action: "route"` with `server`.
- Route resolve actions and Dial Fields `domain_resolver` can reference DNS servers by tag.
- Dial Fields `detour` references an outbound tag and, when set, all other Dial Fields are ignored.
- TLS here is outbound TLS for DNS-over-HTTP3.

## Left: Add Library

Current expected action: `ADD`.

Review:

- The Library entry must add a DNS-over-HTTP3 server resource.
- The Docs action must open `dns/server/http3.md`.
- Adding should select the node and ask for server address/path.

Node-specific concern:

- The UI name should say DoH3 or HTTP3, but the JSON type must stay `h3`.

Recommendation:

- Keep `ADD`; expose server and path first, with headers/TLS/Dial collapsed.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `h3` or `DoH3` as the DNS server type chip.
- Status should fail when `tag` or `server` is missing.
- The card should summarize `server`, path, TLS state, and detour state.

Port semantics:

- Left ports: references from DNS final, DNS rules, route resolve actions, and domain resolver fields.
- Right ports: outbound detour via Dial Fields `detour`.
- No separate TLS or headers node is valid.

Recommendation:

- Keep this aligned with HTTPS DNS, with only the protocol label/defaults changed.

## Right: Inspector

Review:

- Inspector must expose tag, server, server_port, path, headers, outbound TLS, and Dial Fields.
- `server_port` should default to `443`; `path` should default to `/dns-query`.
- Headers need a key/value repeater, not raw JSON for common editing.
- Dial `detour` should be an outbound select and should visually disable other Dial Fields when selected.
- Domain-name server values should trigger a resolver diagnostic if needed.

Recommendation:

- Use the same form model as HTTPS DNS with protocol-specific labeling.

## Priority Findings

- P0 `server` is required.
- P0 TLS must be outbound TLS embedded on this DNS server.
- P0 Dial `detour` must be an outbound tag reference.
- P1 label must clarify DoH3 while preserving JSON `type: "h3"`.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags, missing server, invalid detours, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
