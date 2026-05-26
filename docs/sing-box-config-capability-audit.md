# sing-box Config Capability Audit

This document records the machine-checkable gap between the official sing-box configuration docs and SBC's current write paths.

Run the audit with:

```bash
pnpm audit:config-docs
```

The audit compares the latest local testing docs checkout at `.tmp/sing-box-docs/testing/docs/configuration` against:

- [sing-box Configuration Readthrough Matrix](sing-box-doc-readthrough-matrix.md)
- `src/components/Palette.tsx`

## Current Result

Last run: 2026-05-26 against testing docs commit `b6c416b0482a2d2391470d70ce518abff3ba51f8`.

| Metric | Count |
| --- | ---: |
| Official testing English docs | 105 |
| Matrix rows | 105 |
| Palette entries | 107 |
| `ADD` entries | 15 |
| `SETUP` entries | 44 |
| `TABLE` entries | 4 |
| `INSPECTOR` entries | 14 |
| `GATED` entries | 15 |
| `PENDING` entries | 0 |
| `DOCS` entries | 15 |

## User-Facing Meaning

The matrix is now synchronized with the official testing docs, so missing behavior is no longer hidden by missing documentation rows.

The first closed usability gap is Outbound setup: users can now add HTTP, Shadowsocks, VMess, Trojan, Naive, Hysteria, ShadowTLS, VLESS, TUIC, Hysteria2, AnyTLS, Tor, and SSH outbounds from Library. These create canonical JSON objects with the correct official `type`; they no longer fall back to `socks`. The selected setup node opens the Inspector, where common scalar protocol fields such as `password`, `uuid`, `method`, `network`, and bandwidth values are editable.

The second closed usability gap is Inbound setup: users can now add Direct, SOCKS, HTTP, Shadowsocks, VMess, Trojan, Naive, Hysteria, ShadowTLS, VLESS, TUIC, Hysteria2, AnyTLS, Redirect, and TProxy inbounds from Library. These create canonical JSON objects with the correct official `type`, select the new node, and expose editable listen/protocol scalar fields in the Inspector. Cloudflared remains `GATED` because it is a testing-only `1.14` inbound.

The third closed usability gap is DNS Server setup: users can now add Hosts, TCP, UDP, TLS, QUIC, HTTPS, HTTP3/H3, DHCP, FakeIP, Tailscale, and Resolved DNS servers from Library. These create DNS server objects under canonical `dns.servers[]`, select the new DNS server node, and expose editable server/path/interface/range/reference scalar fields in the Inspector. mDNS remains `GATED` because it is testing-only, and Legacy remains docs/migration-only.

The fourth closed usability gap is independent settings setup: users can now add NTP, Certificate, and Experimental settings from Library. These create canonical top-level `ntp`, `certificate`, and `experimental` objects, pin independent settings cards on the canvas, and expose editable NTP server/interval and certificate store/path fields in the Inspector. Experimental uses collapsed module cards for Cache File, Clash API, and V2Ray API so the default view stays visual and does not dump raw fields. The stable fixture `fixtures/stable/global-settings.json` validates the emitted stable-safe subset with `sing-box-stable`.

The fifth closed usability gap is outbound upstream ownership: newly created outbounds now respect the selected canonical owner. Route, Route Rule, Selector, URLTest, and DNS Server selections connect the new outbound through the corresponding official tag field. Orphan outbounds expose explicit Inspector actions for route final, route rule, selector/urltest membership, DNS detour target, and Dial detour target, so users do not need to infer those references from side-port icons alone.

The sixth closed usability gap is Rule Set setup: users can now add a stable-safe remote source rule-set from Library. SBC writes `route.rule_set[]`, renders a `rule-set` canvas node, exposes URL/format/update interval/download detour fields in the Inspector, validates `route.rules[].rule_set` and `dns.rules[].rule_set` tag references, and shows rule-set fields in both ordered rule tables. The stable fixture `fixtures/stable/rule-set-remote.json` validates this output with `sing-box-stable`.

The seventh closed usability gap is Endpoint setup and type switching: users can now add WireGuard and Tailscale endpoints from Library. SBC writes canonical `endpoints[]`, renders endpoint nodes, supports endpoint Dial `detour`, links Tailscale DNS servers to Tailscale endpoints, and validates endpoint tag references. Inbound, Outbound, DNS Server, Endpoint, and Rule Set nodes also expose target-appropriate type switching in the Inspector while preserving tags and clearing invalid references through domain commands.

Remaining chain-node gaps reported by the audit:

- Outbound `wireguard` and `dns` remain documentation/migration entries until the target-specific migration policy is implemented.

Remaining Palette surface gaps reported by the audit:

- Base docs: `dns/server/index.md`, `endpoint/index.md`, `inbound/index.md`, `outbound/index.md`, `service/index.md`.

Remaining writable object gaps reported by the expanded audit:

- Rule Set source-format and AdGuard conversion helpers.
- Service resources.
- Outbound WireGuard and DNS migration/special entries.
- Testing-only Certificate Provider and HTTP Client resource schemas.

## Release Gate

Do not mark an entry `ADD` or `SETUP` unless all of these exist:

1. Domain command that mutates canonical `SingBoxConfig`.
2. Graph derivation that shows the object from canonical JSON.
3. Inspector or table schema for required and common fields.
4. Unit test for the command path.
5. UI/E2E test for the Library or canvas action.
6. Matching stable/testing fixture validation when the emitted fixture is expected to pass official `sing-box check`.
