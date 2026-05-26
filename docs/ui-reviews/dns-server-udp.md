<!-- Status: official-read. Source: stable docs/configuration/dns/server/udp.md and shared/dial.md; reviewed against current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# DNS Server / udp UI Review

## Scope

- Editable node: `dns-server:udp`
- Official doc: `dns/server/udp.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `dns.servers[]` with `type: "udp"`.

Official writable fields from `dns/server/udp.md`:

- `type`: `udp`
- `tag`
- `server`: required DNS server address.
- `server_port`: default `53`.
- Dial Fields from `shared/dial.md`.

Relationship model:

- The server can be referenced by `dns.final`.
- DNS rules can route to it through `action: "route"` with `server`.
- Route resolve actions and Dial Fields `domain_resolver` can reference DNS servers by tag.
- Dial Fields `detour` references an outbound tag and, when set, all other Dial Fields are ignored.
- If `server` is a domain name, Dial `domain_resolver` or `route.default_domain_resolver` is needed.

## Left: Add Library

Current expected action: `ADD`.

Review:

- The Library entry must add a UDP DNS server resource.
- The Docs action must open `dns/server/udp.md`.
- Adding should select the node and ask for server address.

Node-specific concern:

- UDP DNS is the simplest remote resolver; the UI should not bury server/port below advanced Dial controls.

Recommendation:

- Keep `ADD`; put server/server_port first, Dial Fields collapsed.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `udp` as the DNS server type chip.
- Status should fail when `tag` or `server` is missing.
- The card should summarize `server:port` and detour state.

Port semantics:

- Left ports: references from DNS final, DNS rules, route resolve actions, and domain resolver fields.
- Right ports: outbound detour via Dial Fields `detour`.

Recommendation:

- Do not show TLS/path ports for UDP DNS.

## Right: Inspector

Review:

- Inspector must expose tag, server, server_port, and Dial Fields.
- `server_port` should default to `53`.
- Dial `detour` should be an outbound select and should visually disable other Dial Fields when selected.
- Domain-name server values should trigger a `domain_resolver` diagnostic if no resolver path exists.
- Deprecated Dial `domain_strategy` should be import-only.

Recommendation:

- Use a compact remote DNS form plus collapsible Advanced Dial.

## Priority Findings

- P0 `server` is required.
- P0 Dial `detour` must be an outbound tag reference.
- P1 domain-name server values need resolver diagnostics.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags, missing server, invalid detours, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
