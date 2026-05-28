# Outbound URLTest - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C0-5 | P0 | Outbound | Selector/urltest require non-empty `outbounds`; SBC creates empty arrays, downgrades empty candidates to a warning, and disconnect can remove the last candidate. `sing-box-stable check` rejects empty lists. | Make empty selector/urltest candidates blocking errors; decide whether UI prevents last removal or allows invalid drafts with blocking diagnostics. |
| C0-9 | P0 | Outbound | `changeEntityType` preserves `detour` when changing to non-dialable outbound types such as `block`, `dns`, `selector`, or `urltest`; stable rejects selector `detour` as unknown. | Scrub `detour` unless the new outbound type supports Dial Fields; add type-change tests. |
| C1-7 | P1 | Outbound / Canvas | Group-member port trash removes the first edge for an aggregate selector/urltest port, not the specific visible edge the user intended. | Hide aggregate-port trash or require exact edge/relation choice; test multi-candidate selector/urltest behavior. |
| C1-9 | P1 | Outbound | Compatible outbound chips advertise many active types that `createCompatible` does not implement, so several “Add” paths are no-op. | Replace label switches with a typed compatible registry or hide unsupported chips; test HTTP/VLESS creation. |

## Icon/SVG Findings

| ID | Severity | Finding | Development landing |
| --- | --- | --- | --- |
| IC-P2-1 | P2 | URLTest uses storage/shuffle metaphors instead of latency/probe semantics. | Use one testing/probe icon consistently for URLTest nodes and ports. |

SUMMARY: 2 P0, 2 P1, 0 P2; icons 0 P1, 1 P2.
