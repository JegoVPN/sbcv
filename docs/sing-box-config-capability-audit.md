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
| Palette entries | 103 |
| `ADD` entries | 15 |
| `SETUP` entries | 13 |
| `TABLE` entries | 4 |
| `INSPECTOR` entries | 13 |
| `GATED` entries | 13 |
| `PENDING` entries | 4 |
| `DOCS` entries | 41 |

## User-Facing Meaning

The matrix is now synchronized with the official testing docs, so missing behavior is no longer hidden by missing documentation rows.

The first closed usability gap is Outbound setup: users can now add HTTP, Shadowsocks, VMess, Trojan, Naive, Hysteria, ShadowTLS, VLESS, TUIC, Hysteria2, AnyTLS, Tor, and SSH outbounds from Library. These create canonical JSON objects with the correct official `type`; they no longer fall back to `socks`. The selected setup node opens the Inspector, where common scalar protocol fields such as `password`, `uuid`, `method`, `network`, and bandwidth values are editable.

Remaining chain-node gaps reported by the audit:

- Inbounds still documentation-only except `tun` and `mixed`.
- Outbound `wireguard` and `dns` remain documentation/migration entries until the target-specific migration policy is implemented.

Remaining Palette surface gaps reported by the audit:

- Base docs: `dns/server/index.md`, `endpoint/index.md`, `inbound/index.md`, `outbound/index.md`, `service/index.md`.
- DNS server `fakeip`.
- Rule-set source/headless/adguard docs.

## Release Gate

Do not mark an entry `ADD` or `SETUP` unless all of these exist:

1. Domain command that mutates canonical `SingBoxConfig`.
2. Graph derivation that shows the object from canonical JSON.
3. Inspector or table schema for required and common fields.
4. Unit test for the command path.
5. UI/E2E test for the Library or canvas action.
6. Matching stable/testing fixture validation when the emitted fixture is expected to pass official `sing-box check`.
