# Service Resolved - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C0-8 | P0 | DNS Server | Changing DNS server type into `tailscale` or `resolved` does not create required endpoint/service dependencies, and type change can preserve hidden `detour` on non-dial DNS server types. | Make DNS server type-change dependency-aware and scrub fields unsupported by the new type. |
| C2-1 | P2 | Service | Graph treats any `service.detour` as an outbound ref and renders it as CCM unless type is OCM, but upstream documents top-level service `detour` only for CCM/OCM. | Gate service-detour graph edges to CCM/OCM and add unsupported-field diagnostics or import-only handling for other service types. |

## Icon/SVG Findings

| ID | Severity | Finding | Development landing |
| --- | --- | --- | --- |
| IC-P2-4 | P2 | Inbound, Service, Settings, and HTTP Client title icons are too generic. | Make high-risk families type-aware where users distinguish protocols visually. |

SUMMARY: 1 P0, 0 P1, 1 P2; icons 0 P1, 1 P2.
