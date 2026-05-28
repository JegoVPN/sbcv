# Outbound Block - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C0-9 | P0 | Outbound | `changeEntityType` preserves `detour` when changing to non-dialable outbound types such as `block`, `dns`, `selector`, or `urltest`; stable rejects selector `detour` as unknown. | Scrub `detour` unless the new outbound type supports Dial Fields; add type-change tests. |
| C1-9 | P1 | Outbound | Compatible outbound chips advertise many active types that `createCompatible` does not implement, so several “Add” paths are no-op. | Replace label switches with a typed compatible registry or hide unsupported chips; test HTTP/VLESS creation. |

## Icon/SVG Findings

No node-specific `IC-*` finding was mapped. Global icon-registry findings still apply through `icon-semantics-audit.md`.

SUMMARY: 1 P0, 1 P1, 0 P2; icons 0 P1, 0 P2.
