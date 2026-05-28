# Service DERP - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C0-10 | P0 | Service DERP | DERP `mesh_with` entries require `server` and `server_port`, but diagnostics do not validate either field and Inspector can create a row with an empty `server`. | Add DERP mesh peer required-field diagnostics; make the Inspector create a valid draft or show blocking validation immediately. |
| C1-11 | P1 | Service DERP | DERP `verify_client_url[]` and `mesh_with[]` embed Dial Fields, including outbound `detour` and DNS `domain_resolver`, but these nested references are not in reference registry, graph edges, or stale-ref diagnostics. | Add nested DERP Dial Field reference helpers for rename/delete/diagnostics; decide whether to visualize nested detour/domain-resolver edges. |
| C1-12 | P1 | Service SSM API | Service node compatible chips advertise “Shadowsocks Inbound” for SSM API and “Tailscale Endpoint” for DERP, but `createCompatible` has no cases for either label, making the hover Add path no-op. | Move compatible creation to a typed registry shared by graph, picker, and store; test SSM/DERP hover chips. |
| C2-1 | P2 | Service | Graph treats any `service.detour` as an outbound ref and renders it as CCM unless type is OCM, but upstream documents top-level service `detour` only for CCM/OCM. | Gate service-detour graph edges to CCM/OCM and add unsupported-field diagnostics or import-only handling for other service types. |
| C2-3 | P2 | Endpoint | Endpoint compatible chips only advertise DNS Tailscale Server, while ports support DNS server, DERP service, and certificate-provider relations. | Make endpoint compatible labels match relation registry and cover chip creation. |

## Icon/SVG Findings

| ID | Severity | Finding | Development landing |
| --- | --- | --- | --- |
| IC-P2-4 | P2 | Inbound, Service, Settings, and HTTP Client title icons are too generic. | Make high-risk families type-aware where users distinguish protocols visually. |

SUMMARY: 1 P0, 2 P1, 2 P2; icons 0 P1, 1 P2.
