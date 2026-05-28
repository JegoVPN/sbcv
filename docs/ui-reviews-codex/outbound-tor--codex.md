# Outbound Tor - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C0-6 | P0 | Shared TLS | Inspector uses one mixed TLS editor for inbound, outbound, and DNS server TLS. Upstream has distinct inbound/server and outbound/client schemas; `sing-box-stable check` rejects invalid-role fields such as outbound `tls.key_path` and inbound `tls.utls`. | Split TLS fields by role and update UI tests so invalid-role fields are absent. |
| C1-9 | P1 | Outbound | Compatible outbound chips advertise many active types that `createCompatible` does not implement, so several “Add” paths are no-op. | Replace label switches with a typed compatible registry or hide unsupported chips; test HTTP/VLESS creation. |

## Icon/SVG Findings

| ID | Severity | Finding | Development landing |
| --- | --- | --- | --- |
| IC-P1-1 | P1 | Outbound node cards collapse most protocols to Shield. | Use a shared semantic icon registry keyed by outbound type. |

SUMMARY: 1 P0, 1 P1, 0 P2; icons 1 P1, 0 P2.
