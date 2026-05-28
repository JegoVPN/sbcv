# Service OCM - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C1-21 | P1 | Inbound / Listen Fields | `Listen Fields.detour` is an inbound-tag reference, but inbound `detour` is not in inbound reference rename/delete or stale diagnostics. The shared Listen card also writes `detour` for services as an inbound detour, while service diagnostics/reference graph treat `service.detour` as outbound for all services. | Add owner-aware Listen detour handling: inbound/service listen detour references inbound tags, CCM/OCM API detour references outbound tags, and diagnostics/graph must not conflate them. |
| C2-1 | P2 | Service | Graph treats any `service.detour` as an outbound ref and renders it as CCM unless type is OCM, but upstream documents top-level service `detour` only for CCM/OCM. | Gate service-detour graph edges to CCM/OCM and add unsupported-field diagnostics or import-only handling for other service types. |

## Icon/SVG Findings

| ID | Severity | Finding | Development landing |
| --- | --- | --- | --- |
| IC-P2-4 | P2 | Inbound, Service, Settings, and HTTP Client title icons are too generic. | Make high-risk families type-aware where users distinguish protocols visually. |

SUMMARY: 0 P0, 1 P1, 1 P2; icons 0 P1, 1 P2.
