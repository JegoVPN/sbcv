# Canvas Connection UX - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C2-7 | P2 | Canvas Connection UX | Edge remove buttons are hidden by opacity but keep `pointer-events: all`, so invisible remove targets can intercept canvas clicks and focus before the edge is visibly hovered. | Disable pointer events unless the remove button is visible or focused; add a canvas interaction test for hidden edge controls. |

## Icon/SVG Findings

No node-specific `IC-*` finding was mapped. Global icon-registry findings still apply through `icon-semantics-audit.md`.

SUMMARY: 0 P0, 0 P1, 1 P2; icons 0 P1, 0 P2.
