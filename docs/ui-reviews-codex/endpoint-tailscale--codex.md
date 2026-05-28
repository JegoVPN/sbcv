# Endpoint Tailscale - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C0-8 | P0 | DNS Server | Changing DNS server type into `tailscale` or `resolved` does not create required endpoint/service dependencies, and type change can preserve hidden `detour` on non-dial DNS server types. | Make DNS server type-change dependency-aware and scrub fields unsupported by the new type. |
| C0-11 | P0 | Endpoint / Route | Endpoints have inbound/outbound behavior upstream, but route target modeling only accepts `outbounds[]` for `route.final` and `route.rules[].outbound`. Valid endpoint route targets are rejected or unmodeled. | Add a route-target abstraction for outbound + endpoint tags; update diagnostics, references, graph/ports, and route tests. |
| C0-13 | P0 | Endpoint | Tailscale `system_interface` is modeled as a string in UI/tests, but upstream defines `system_interface` as boolean and uses `system_interface_name` for the name. | Change UI to checkbox `system_interface` plus text `system_interface_name`; add type diagnostics and migration-aware tests. |
| C0-15 | P0 | Certificate Provider | Required certificate-provider fields are not semantically validated: Tailscale provider requires a Tailscale endpoint, ACME/Cloudflare require `domain`, and Cloudflare credential conflicts are unchecked. | Add provider-type diagnostics and endpoint type checks; cover imported providers and provider nodes. |
| C1-5 | P1 | DNS Server | Tailscale DNS server endpoint diagnostics check endpoint existence but not that the endpoint type is `tailscale`. | Validate endpoint type for DNS Tailscale servers. |
| C1-12 | P1 | Service SSM API | Service node compatible chips advertise “Shadowsocks Inbound” for SSM API and “Tailscale Endpoint” for DERP, but `createCompatible` has no cases for either label, making the hover Add path no-op. | Move compatible creation to a typed registry shared by graph, picker, and store; test SSM/DERP hover chips. |
| C1-14 | P1 | Certificate Provider / Endpoint | Tailscale certificate-provider endpoint missing/type diagnostics are absent, although upstream requires a Tailscale endpoint reference. | Add certificate-provider endpoint diagnostics, diagnostic-target tests, and graph edge type guard. |
| C1-15 | P1 | Certificate Provider / Canvas | Tailscale certificate-provider nodes advertise a “Tailscale Endpoint” compatible chip, but `createCompatible` does not implement that label, so the hover Add path is a no-op. | Use a typed compatible registry shared by graph, picker, and store; test the certificate-provider chip path. |
| C2-3 | P2 | Endpoint | Endpoint compatible chips only advertise DNS Tailscale Server, while ports support DNS server, DERP service, and certificate-provider relations. | Make endpoint compatible labels match relation registry and cover chip creation. |

## Icon/SVG Findings

| ID | Severity | Finding | Development landing |
| --- | --- | --- | --- |
| IC-P2-2 | P2 | WireGuard and Tailscale share the same generic endpoint icon. | Use distinct endpoint icons after a license and bundle-size check. |

SUMMARY: 4 P0, 4 P1, 1 P2; icons 0 P1, 1 P2.
