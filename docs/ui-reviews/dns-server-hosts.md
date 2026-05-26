<!-- Status: official-read. Source: stable docs/configuration/dns/server/hosts.md; reviewed against current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# DNS Server / hosts UI Review

## Scope

- Editable node: `dns-server:hosts`
- Official doc: `dns/server/hosts.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `dns.servers[]` with `type: "hosts"`.

Official writable fields from `dns/server/hosts.md`:

- `type`: `hosts`
- `tag`
- `path[]`: hosts file paths, defaulting to the platform hosts file when empty.
- `predefined`: hostname-to-address map.

Relationship model:

- The server can be referenced by `dns.final`.
- DNS rules can route to it through `action: "route"` with `server`.
- Route resolve actions and Dial Fields `domain_resolver` can reference DNS servers by tag.
- Hosts DNS has no Dial Fields, detour, TLS, server, server_port, or path/query URL.
- The official example uses a DNS rule with `ip_accept_any` to route suitable queries to the hosts server.

## Left: Add Library

Current expected action: `ADD`.

Review:

- The Library entry must add a Hosts DNS server resource.
- The Docs action must open `dns/server/hosts.md`.
- The entry should explain that this is local hosts lookup, not remote DNS.

Node-specific concern:

- Showing detour/TLS controls for Hosts would be wrong; it is a local resource.

Recommendation:

- Keep `ADD` and open Inspector with path/predefined editors.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `hosts` as the DNS server type chip.
- Status should fail when `tag` is missing.
- The card can summarize path count and predefined host count.

Port semantics:

- Left ports: references from DNS final, DNS rules, route resolve actions, and domain resolver fields.
- Right ports: none.
- No outbound detour or TLS ports are valid.

Recommendation:

- Use incoming reference affordances only; Hosts does not connect downstream.

## Right: Inspector

Review:

- Inspector must expose tag, path list, and predefined host map.
- `path[]` should be a repeatable file-path list with platform default hint.
- `predefined` should be a structured hostname/address map editor; raw JSON is advanced-only.
- Type switching should clear incompatible Dial/TLS/server fields with diagnostics.

Recommendation:

- Prefer a table for predefined host entries with address-array support.

## Priority Findings

- P0 Hosts DNS must not show Dial, detour, TLS, or remote server controls.
- P1 predefined hosts need a structured map editor.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and malformed host/address values.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
