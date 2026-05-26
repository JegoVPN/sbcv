<!-- Status: ui-verified (2026-05-27). Shared atomics (listenSharedFields + tlsSharedFields + dialSharedFields + JsonField fallback + structured users editor + TLS-required scaffold + sensitive masking + diagnostics) landed; see docs/claude/index-ui-reviews.md Cross-Node Findings #1–#9. Node-specific P0/P1 still tracked here. -->
# Inbound / tun UI Review

## Scope

- Editable node: `inbound:tun`
- Official doc: `inbound/tun.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `inbounds[]` with `type: "tun"`.

Official writable fields from `inbound/tun.md`:

- `type`: `tun`
- `tag`
- `interface_name`, `address[]`, `mtu`.
- `auto_route`, `iproute2_table_index`, `iproute2_rule_index`.
- `auto_redirect`, `auto_redirect_input_mark`, `auto_redirect_output_mark`, `auto_redirect_reset_mark`, `auto_redirect_nfqueue`, `auto_redirect_iproute2_fallback_rule_index`.
- `exclude_mptcp`, `loopback_address[]`, `strict_route`.
- `route_address[]`, `route_exclude_address[]`, `route_address_set[]`, `route_exclude_address_set[]`.
- `endpoint_independent_nat`, `udp_timeout`, `stack`.
- `include_interface[]`, `exclude_interface[]`.
- `include_uid[]`, `include_uid_range[]`, `exclude_uid[]`, `exclude_uid_range[]`.
- `include_android_user[]`, `include_package[]`, `exclude_package[]`.
- `platform.http_proxy.enabled`, `server`, `server_port`, `bypass_domain[]`, `match_domain[]`.
- Deprecated fields: `gso`, `inet4_address`, `inet6_address`, `inet4_route_address`, `inet6_route_address`, `inet4_route_exclude_address`, `inet6_route_exclude_address`.
- Listen Fields from `shared/listen.md`.

Relationship model:

- TUN inbound is the canonical "traffic source" for local transparent proxy flows; route rules and DNS rules can match it by tag through `inbound[]`.
- `route_address_set[]` and `route_exclude_address_set[]` reference rule-set tags, not route-rule nodes.
- Listen Fields `detour` references another inbound tag only when the target inbound is injectable.
- Listen Fields legacy sniff/domain fields are deprecated in 1.11 and removed in 1.13; import/migration-only.
- `auto_route`, `auto_redirect`, route sets, marks, and platform fields have strong OS/version constraints.
- Deprecated address split fields were removed in 1.12; they should be import-only for 1.12+ targets.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must add a TUN inbound object or one of the curated TUN templates.
- The Docs action must open `inbound/tun.md`.
- Because TUN has many platform hazards, the primary add flow should prefer templates such as desktop TUN, Android VPN, and router/Linux gateway.

Node-specific concern:

- A flat Inspector with every TUN field as a text input overwhelms ordinary users and hides the important decisions: address, auto_route, DNS leak prevention, and route inclusion/exclusion.

Recommendation:

- Use `ADD` for a minimal TUN and keep richer TUN setups in Templates.
- Show target/platform guidance before exposing Linux/Android/Apple-specific fields.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `tun` as the protocol chip.
- Status must fail locally when `address[]` is empty for a TUN setup that expects automatic interface configuration.
- The card should summarize `stack`, `auto_route`, and route-set usage, not show individual routing marks.

Port semantics:

- Left ports: none for upstream traffic.
- Right ports: Route Hub/default flow, Route Rule matcher, and DNS Rule matcher references.
- Rule-set references for `route_address_set[]` and `route_exclude_address_set[]` can be shown as advanced resource-reference ports or Inspector selects.
- Listen Fields `detour` should be advanced and rarely used for TUN.

Recommendation:

- Treat TUN as a major source node. Its most important outgoing path is to Route, while matcher edges are secondary references.

## Right: Inspector

Review:

- Inspector must be grouped by user task: Interface, Routing, Platform filters, HTTP proxy, Advanced Linux routing, Imported deprecated fields.
- `address[]`, `route_address[]`, and exclude arrays need list editors with CIDR validation.
- `route_address_set[]` and `route_exclude_address_set[]` need rule-set tag multiselects.
- `auto_redirect` fields should be gated by Linux/nftables guidance and `auto_route`.
- `route.default_mark` / dial `routing_mark` conflicts should surface as diagnostics when `auto_redirect` is enabled.
- Include/exclude interface fields are mutually exclusive and should be presented as mode choices.
- Platform Android user/package fields should only appear in an Android section.
- Deprecated address/GSO fields should be read-only import/migration fields for 1.12+.

Recommendation:

- The MVP Inspector should expose only safe core fields by default: tag, address, stack, auto_route, strict_route, route includes/excludes, and HTTP proxy. Everything else belongs in Advanced.

## Priority Findings

- P0 TUN must be template-guided; a flat input dump is not usable.
- P0 rule-set references must point to rule-set tags, not route-rule nodes.
- P0 deprecated pre-1.12 address fields must be import-only for supported targets.
- P1 OS/platform constraints need visible diagnostics.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags, missing addresses, route-set references, conflict fields, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
