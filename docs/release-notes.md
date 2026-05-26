# SBC Release Notes

## 0.1.0

Initial release target for the stable-first visual sing-box editor.

Supported:

- Stable-first visual editing workflow for TUN inbound, Route, Direct, Block, SOCKS placeholder, Selector, URLTest, DNS servers, Route Rules, and DNS Rules.
- Canonical JSON/domain model as the only source of truth.
- React Flow canvas as derived visualization and interaction layer.
- Inspector-driven node/entity editing.
- JSON preview and advanced JSON apply flow.
- Semantic diagnostics for duplicate tags and missing tag references.
- Fixture validation script that runs `sing-box-stable` and `sing-box-testing` when available.
- Stable fixture verified against sing-box 1.13.12 and testing fixture verified against sing-box 1.14.0-alpha.25 in local release validation.

Known limitations:

- Full protocol field coverage is intentionally deferred behind registry expansion.
- Browser validation is semantic; official validation runs through matching local `sing-box-stable` / `sing-box-testing` binaries.
- Hosted deployment requires user-selected infrastructure or credentials.
