<!-- Status: official-read. Source: stable docs/configuration/dns/server/https.md, shared/tls.md, and shared/dial.md; reviewed against current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# DNS Server / https UI Review

## Scope

- Editable node: `dns-server:https`
- Official doc: `dns/server/https.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `dns.servers[]` with `type: "https"`.

Official writable fields from `dns/server/https.md`:

- `type`: `https`
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
- TLS here is outbound TLS for DNS-over-HTTPS.

## Left: Add Library

Current expected action: `ADD`.

Review:

- The Library entry must add a DNS-over-HTTPS server resource.
- The Docs action must open `dns/server/https.md`.
- Adding should select the node and ask for server address/path.

Node-specific concern:

- DoH has headers, path, TLS, and Dial Fields; these should be grouped so the common Cloudflare/Google path stays simple.

Recommendation:

- Keep `ADD`; expose server and path first, with headers/TLS/Dial collapsed.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `https` or `DoH` as the DNS server type chip.
- Status should fail when `tag` or `server` is missing.
- The card should summarize `server`, path, TLS state, and detour state.

Port semantics:

- Left ports: references from DNS final, DNS rules, route resolve actions, and domain resolver fields.
- Right ports: outbound detour via Dial Fields `detour`.
- No separate TLS or headers node is valid.

Recommendation:

- Keep HTTP request details inside Inspector.

## Right: Inspector

Review:

- Inspector must expose tag, server, server_port, path, headers, outbound TLS, and Dial Fields.
- `server_port` should default to `443`; `path` should default to `/dns-query`.
- Headers need a key/value repeater, not raw JSON for common editing.
- Dial `detour` should be an outbound select and should visually disable other Dial Fields when selected.
- Domain-name server values should trigger a resolver diagnostic if needed.

Recommendation:

- Use a remote encrypted DNS form with an optional headers table.

## Priority Findings

- P0 `server` is required.
- P0 TLS must be outbound TLS embedded on this DNS server.
- P0 Dial `detour` must be an outbound tag reference.
- P1 headers need a structured key/value editor.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags, missing server, invalid detours, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
