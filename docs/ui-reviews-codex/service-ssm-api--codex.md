# Service SSM API - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C0-17 | P0 | Inbound / SSM API | SSM API `servers` is required and selected inbounds must be managed Shadowsocks, but SBC reports empty or non-managed/non-Shadowsocks mappings as warnings. Inbound type-change can leave an SSM service pointing at a now-invalid inbound while graph still renders the service edge. | Upgrade SSM mapping violations to blocking diagnostics; on inbound type-change away from managed Shadowsocks, either remove SSM mappings or keep them with blocking errors and type-gated graph edges. |
| C1-12 | P1 | Service SSM API | Service node compatible chips advertise “Shadowsocks Inbound” for SSM API and “Tailscale Endpoint” for DERP, but `createCompatible` has no cases for either label, making the hover Add path no-op. | Move compatible creation to a typed registry shared by graph, picker, and store; test SSM/DERP hover chips. |
| C1-13 | P1 | Service SSM API | Drag-connecting multiple Shadowsocks inbounds to one SSM API service always writes `servers["/"]`, replacing the previous mapping even though upstream and Inspector support a mapping object with multiple HTTP endpoints. | Allocate a unique path when `/` is already occupied, or open an explicit endpoint-path picker before connecting. |
| C2-1 | P2 | Service | Graph treats any `service.detour` as an outbound ref and renders it as CCM unless type is OCM, but upstream documents top-level service `detour` only for CCM/OCM. | Gate service-detour graph edges to CCM/OCM and add unsupported-field diagnostics or import-only handling for other service types. |

## Icon/SVG Findings

| ID | Severity | Finding | Development landing |
| --- | --- | --- | --- |
| IC-P2-4 | P2 | Inbound, Service, Settings, and HTTP Client title icons are too generic. | Make high-risk families type-aware where users distinguish protocols visually. |

SUMMARY: 1 P0, 2 P1, 1 P2; icons 0 P1, 1 P2.
