# DNS Server Tailscale - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C0-8 | P0 | DNS Server | Changing DNS server type into `tailscale` or `resolved` does not create required endpoint/service dependencies, and type change can preserve hidden `detour` on non-dial DNS server types. | Make DNS server type-change dependency-aware and scrub fields unsupported by the new type. |
| C1-2 | P1 | Route Rule | `resolve.server` is a DNS server tag reference, but it is missing from DNS-server reference registry, rename/delete lifecycle, graph, and stale-ref diagnostics. | Add `/route/rules/*/server` DNS-server reference handling, graph edge, diagnostics, and tests. |
| C1-3 | P1 | DNS Rule | Hover compatible chip can create a DNS server but does not connect it to the DNS rule; drag/picker create-connect already works. | Add `source.kind === "dns-rule"` branch to compatible creation and test the chip path. |
| C1-4 | P1 | DNS Server | Legacy DNS server `address_resolver` is a DNS-server reference but is not renamed/deleted or diagnosed; `address_strategy` deprecation/shape is also not checked. | Add registry and diagnostics coverage for legacy `address_resolver` / `address_strategy`. |
| C1-5 | P1 | DNS Server | Tailscale DNS server endpoint diagnostics check endpoint existence but not that the endpoint type is `tailscale`. | Validate endpoint type for DNS Tailscale servers. |
| C1-8 | P1 | DNS Server / Canvas | DNS-server port disconnect has the same first-edge problem when multiple DNS rules target one server. | Replace single `edgeByPort` lookup with multi-edge handling or edge-specific disconnect UI. |
| C2-3 | P2 | Endpoint | Endpoint compatible chips only advertise DNS Tailscale Server, while ports support DNS server, DERP service, and certificate-provider relations. | Make endpoint compatible labels match relation registry and cover chip creation. |

## Icon/SVG Findings

No node-specific `IC-*` finding was mapped. Global icon-registry findings still apply through `icon-semantics-audit.md`.

SUMMARY: 1 P0, 5 P1, 1 P2; icons 0 P1, 0 P2.
