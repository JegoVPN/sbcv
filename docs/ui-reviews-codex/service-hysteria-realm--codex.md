# Service Hysteria Realm - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C2-1 | P2 | Service | Graph treats any `service.detour` as an outbound ref and renders it as CCM unless type is OCM, but upstream documents top-level service `detour` only for CCM/OCM. | Gate service-detour graph edges to CCM/OCM and add unsupported-field diagnostics or import-only handling for other service types. |
| C2-2 | P2 | Service Hysteria Realm | Palette/store block creating `hysteria-realm` on stable, but the Service Inspector type dropdown still offers it on stable and relies on diagnostics after the mutation. | Make type-change options channel-aware or require an explicit testing-target switch before selecting testing-only service types. |

## Icon/SVG Findings

| ID | Severity | Finding | Development landing |
| --- | --- | --- | --- |
| IC-P2-4 | P2 | Inbound, Service, Settings, and HTTP Client title icons are too generic. | Make high-risk families type-aware where users distinguish protocols visually. |

SUMMARY: 0 P0, 0 P1, 2 P2; icons 0 P1, 1 P2.
