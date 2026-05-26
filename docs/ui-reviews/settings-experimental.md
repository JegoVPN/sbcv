<!-- Status: ui-verified (2026-05-27). Shared atomics (Clash API external_ui controls + cache_file 1.13/1.14 fields + Sensitive masking + diagnostics) landed; see docs/claude/index-ui-reviews.md Cross-Node Findings #1–#9. Node-specific outstanding P0/P1 still tracked here. -->
# Experimental UI Review

## Scope

- Editable node: `settings:experimental`
- Official doc: `experimental/index.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This settings surface writes the top-level `experimental` object.

Official writable fields from `experimental/index.md`:

- `cache_file`
- `clash_api`
- `v2ray_api`

Nested writable fields from official subdocs:

- `cache_file.enabled`, `path`, `cache_id`, `store_fakeip`, `store_rdrc`, `rdrc_timeout`.
- `clash_api.external_controller`, `external_ui`, `external_ui_download_url`, `external_ui_download_detour`, `secret`, `default_mode`, `access_control_allow_origin[]`, `access_control_allow_private_network`.
- Deprecated Clash API fields: `store_mode`, `store_selected`, `store_fakeip`, `cache_file`, `cache_id`.
- `v2ray_api.listen`, `stats.enabled`, `stats.inbounds[]`, `stats.outbounds[]`, `stats.users[]`.

Relationship model:

- Experimental has no tag and no traffic-chain references.
- `clash_api.external_ui_download_detour` references an outbound tag.
- `v2ray_api.stats.inbounds[]` references inbound tags; `stats.outbounds[]` references outbound tags; `stats.users[]` references user names.
- V2Ray API requires a non-default build tag and may not be available in normal binaries.
- Clash API `default_mode` can be referenced by route/DNS `clash_mode` rule items.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry should read as `OPEN` or `SETUP`, not `ADD`, because there is only one top-level `experimental`.
- The Docs action must open `experimental/index.md` and subdocs.
- Submodules such as Cache File and Clash API should be Inspector sections, not fake standalone nodes unless they open the same singleton settings surface.

Recommendation:

- Treat Experimental as a singleton settings module with internal sections.

## Middle: Canvas Node

Review:

- If shown on canvas, it should be a small global settings card.
- No generic `+` affordance or traffic-chain ports are valid.
- Optional reference visualization is limited to documented tag references: Clash UI download detour and V2Ray stats tag lists.

Port semantics:

- Left ports: none for traffic.
- Right ports: optional outbound reference for `clash_api.external_ui_download_detour`.
- Reference summaries for V2Ray API stats should be tag-list metadata, not flow edges by default.

Recommendation:

- Prefer right Inspector sections and avoid placing Experimental in the main routing layout.

## Right: Inspector

Review:

- Inspector must expose Cache File, Clash API, and V2Ray API as clear sections.
- Cache File fields should be structured, with `cache_id`, fakeip storage, RDRC storage, and duration controls.
- Clash API must warn when `external_controller` listens on `0.0.0.0` without `secret`.
- `external_ui_download_detour` must be an outbound select.
- Deprecated Clash API fields should be import-only with migration copy to Cache File fields.
- V2Ray API should be gated by build-tag availability and use inbound/outbound multiselects for stats.

Recommendation:

- Keep global JSON preview out of the node Inspector; top toolbar can own full-config import/export/check.

## Priority Findings

- P0 Experimental is singleton global settings and must not look chainable.
- P0 Clash download detour and V2Ray stats references must be real tag selects.
- P0 deprecated Clash fields must be import-only.
- P1 V2Ray API build-tag limitation needs visible copy.

## Done Criteria

- Opening Experimental updates canonical `experimental`.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch unsafe Clash API exposure, invalid tag references, deprecated fields, and target/version hazards.
- Fixture or smoke coverage proves import, edit, and export for top-level `experimental`.
