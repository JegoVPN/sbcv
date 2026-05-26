<!-- Status: official-read. Source: stable docs/configuration/dns/server/dhcp.md and shared/dial.md; reviewed against current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# DNS Server / dhcp UI Review

## Scope

- Editable node: `dns-server:dhcp`
- Official doc: `dns/server/dhcp.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `dns.servers[]` with `type: "dhcp"`.

Official writable fields from `dns/server/dhcp.md`:

- `type`: `dhcp`
- `tag`
- `interface`: interface name to listen on; default interface is used when empty.
- Dial Fields from `shared/dial.md`.

Relationship model:

- The server can be referenced by `dns.final`.
- DNS rules can route to it through `action: "route"` with `server`.
- Route resolve actions and Dial Fields `domain_resolver` can reference DNS servers by tag.
- Dial Fields `detour` references an outbound tag and, when set, all other Dial Fields are ignored.
- DHCP DNS is interface-derived; it has no remote `server`, TLS, path, or headers fields.

## Left: Add Library

Current expected action: `ADD`.

Review:

- The Library entry must add a DHCP DNS server resource.
- The Docs action must open `dns/server/dhcp.md`.
- Adding should select the node and make interface selection optional.

Node-specific concern:

- Users may expect a remote DNS address; DHCP DNS should read as "use DNS discovered from interface".

Recommendation:

- Keep `ADD`; show interface plus optional Dial Fields.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `dhcp` as the DNS server type chip.
- Status should fail when `tag` is missing.
- The card can summarize interface and detour state.

Port semantics:

- Left ports: references from DNS final, DNS rules, route resolve actions, and domain resolver fields.
- Right ports: outbound detour via Dial Fields `detour`.
- No TLS/server/path ports are valid.

Recommendation:

- Make clear that DHCP DNS does not connect to a manually entered remote server.

## Right: Inspector

Review:

- Inspector must expose tag, `interface`, and Dial Fields.
- `interface` should be optional and show "default interface" when empty.
- Dial `detour` should be an outbound select and should visually disable other Dial Fields when selected.
- Deprecated Dial `domain_strategy` should be import-only.

Recommendation:

- Keep this form small and avoid remote DNS fields.

## Priority Findings

- P0 DHCP DNS must not show remote server, TLS, path, or headers controls.
- P0 Dial `detour` must be an outbound tag reference.
- P1 interface field should clearly allow default behavior.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags, invalid detours, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
