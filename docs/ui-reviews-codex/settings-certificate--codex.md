# Settings Certificate - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C2-6 | P2 | Settings Certificate | Stable upstream documents top-level `certificate` since sing-box 1.12, but diagnostics warn that the whole block is “testing-only” whenever channel is stable. | Replace channel-only warning with version-aware gates: `certificate` is stable 1.12+, Chrome store is stable 1.13+. |

## Icon/SVG Findings

| ID | Severity | Finding | Development landing |
| --- | --- | --- | --- |
| IC-P2-4 | P2 | Inbound, Service, Settings, and HTTP Client title icons are too generic. | Make high-risk families type-aware where users distinguish protocols visually. |

SUMMARY: 0 P0, 0 P1, 1 P2; icons 0 P1, 1 P2.
