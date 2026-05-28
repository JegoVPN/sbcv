# Inbound Cloudflared - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C1-22 | P1 | Inbound Cloudflared | `cloudflared` is a testing/1.14 inbound with required `token` and nested control/tunnel Dial Fields, but SBC keeps it palette-gated/import-only, excludes it from creatable/type-select lists, and has no required-token or nested Dial Field diagnostics. | Keep stable gated, but add explicit testing-target support or downgrade the palette entry to docs-only; if supported, add creation, Inspector fields, and token/dial diagnostics. |

## Icon/SVG Findings

No node-specific `IC-*` finding was mapped. Global icon-registry findings still apply through `icon-semantics-audit.md`.

SUMMARY: 0 P0, 1 P1, 0 P2; icons 0 P1, 0 P2.
