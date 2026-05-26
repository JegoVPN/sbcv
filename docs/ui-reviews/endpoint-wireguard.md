<!-- Status: official-read. Source: stable docs/configuration/endpoint/wireguard.md and shared/dial.md; reviewed against current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# Endpoint / wireguard UI Review

## Scope

- Editable node: `endpoint:wireguard`
- Official doc: `endpoint/wireguard.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `endpoints[]` with `type: "wireguard"`.

Official writable fields from `endpoint/wireguard.md`:

- `type`: `wireguard`
- `tag`
- `system`, `name`, `mtu`
- `address[]`: required interface address prefixes.
- `private_key`: required base64 WireGuard private key.
- `listen_port`
- `peers[]`: required peer list.
- `peers[].address`, `port`, `public_key`, `pre_shared_key`, `allowed_ips[]`, `persistent_keepalive_interval`, `reserved[]`.
- `udp_timeout`, `workers`
- Dial Fields from `shared/dial.md`.

Relationship model:

- Endpoint resources can be referenced by other config objects that support endpoint tags.
- Dial Fields `detour` references an outbound tag and, when set, all other Dial Fields are ignored.
- WireGuard peer fields are nested data, not standalone peer nodes for MVP.
- `system` mode requires privilege and must not conflict with existing system interfaces.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must add a WireGuard endpoint resource or open a setup wizard.
- The Docs action must open `endpoint/wireguard.md`.
- Adding should select the node and guide required address/private key/peer fields.

Node-specific concern:

- A WireGuard endpoint is unusable without key material and peers. A blank node marked valid is misleading.

Recommendation:

- Use `ADD` and open Inspector with a guided "interface + peer" form.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `wireguard` as the endpoint type chip.
- Status must fail locally when address, private key, peer public key, or allowed IPs are missing.
- The card should summarize address count, peer count, system mode, and detour state.

Port semantics:

- Left ports: references from objects that use this endpoint tag.
- Right ports: outbound detour through Dial Fields.

Recommendation:

- Do not create separate peer nodes until the domain command model supports peer-level identity. Use structured Inspector repeaters first.

## Right: Inspector

Review:

- Inspector must expose tag, system/name, MTU, address list, private key, listen_port, peers, UDP timeout, workers, and Dial Fields.
- `private_key`, peer public/pre-shared keys, and generated-key workflows need sensitive handling.
- Peers need a structured repeater with address, port, key fields, allowed IPs, keepalive, and reserved bytes.
- Dial `detour` must be an outbound select and should visually disable other Dial Fields when selected.
- `system` mode needs privilege/conflict warning.

Recommendation:

- Use a generated key helper in implementation, but keep review scoped to documented fields.

## Priority Findings

- P0 required address/private key/peers must be structured and validated.
- P0 key material must be treated as sensitive.
- P0 Dial `detour` must be an outbound tag reference.
- P1 system interface mode needs privilege warning.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tag, address, keys, peers, invalid detour, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
