# Endpoint WireGuard - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C0-11 | P0 | Endpoint / Route | Endpoints have inbound/outbound behavior upstream, but route target modeling only accepts `outbounds[]` for `route.final` and `route.rules[].outbound`. Valid endpoint route targets are rejected or unmodeled. | Add a route-target abstraction for outbound + endpoint tags; update diagnostics, references, graph/ports, and route tests. |
| C0-12 | P0 | Endpoint | WireGuard endpoint required fields can be removed silently. Upstream requires endpoint `address`, `private_key`, `peers`, and peer `public_key` / `allowed_ips`; diagnostics currently validate endpoint detours only. | Add WireGuard endpoint required-field diagnostics and UI/domain tests. |
| C0-14 | P0 | Endpoint WireGuard | WireGuard endpoint peer schema uses upstream `address` / `port`, but SBC scaffold and Inspector write `server` / `server_port`, which belong to deprecated WireGuard outbound shape. | Change endpoint peer editor/scaffold to `address` / `port`; add migration/normalization for existing invalid drafts. |
| C2-3 | P2 | Endpoint | Endpoint compatible chips only advertise DNS Tailscale Server, while ports support DNS server, DERP service, and certificate-provider relations. | Make endpoint compatible labels match relation registry and cover chip creation. |

## Icon/SVG Findings

| ID | Severity | Finding | Development landing |
| --- | --- | --- | --- |
| IC-P2-2 | P2 | WireGuard and Tailscale share the same generic endpoint icon. | Use distinct endpoint icons after a license and bundle-size check. |

SUMMARY: 3 P0, 0 P1, 1 P2; icons 0 P1, 1 P2.
