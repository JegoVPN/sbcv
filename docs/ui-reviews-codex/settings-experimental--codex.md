# Settings Experimental - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C1-18 | P1 | HTTP Client | Testing `http_clients[]` resources are graphable after import/templates but cannot be created from the Palette and cannot be edited beyond tag/delete. The Inspector has no `http-client` branch in `sharedGroupsForEntity`, despite product docs calling for an HTTP Client Inspector and upstream defining engine/version/headers/TLS/Dial fields. | Add testing-gated `addHttpClient` / palette creation and expose HTTP Client shared groups for HTTP Client entities; keep stable creation disabled. |

## Icon/SVG Findings

| ID | Severity | Finding | Development landing |
| --- | --- | --- | --- |
| IC-P2-4 | P2 | Inbound, Service, Settings, and HTTP Client title icons are too generic. | Make high-risk families type-aware where users distinguish protocols visually. |

SUMMARY: 0 P0, 1 P1, 0 P2; icons 0 P1, 1 P2.
