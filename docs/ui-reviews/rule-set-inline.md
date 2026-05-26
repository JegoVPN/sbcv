<!-- Status: official-read. Source: stable docs/configuration/rule-set/index.md, rule-set/source-format.md, and rule-set/headless-rule.md; reviewed against current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# Rule Set / inline UI Review

## Scope

- Editable node: `rule-set:inline`
- Official doc: `rule-set/index.md + rule-set/headless-rule.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `route.rule_set[]` with `type: "inline"`.

Official writable fields from `rule-set/index.md`:

- `type`: `inline` since 1.10.0.
- `tag`: required.
- `rules[]`: required list of Headless Rule objects.

Headless rule fields from `rule-set/headless-rule.md` include:

- Default match fields such as `query_type`, `network`, `domain`, `domain_suffix`, `domain_keyword`, `domain_regex`, `source_ip_cidr`, `ip_cidr`, port fields, process fields, package fields, network type fields, Wi-Fi fields, and `invert`.
- Logical rules with `type: "logical"`, required `mode` `and` or `or`, and nested `rules[]`.
- Version-gated fields such as `network_type` in 1.11+ and `network_interface_address` / `default_interface_address` in 1.13+.

Relationship model:

- Route rules and DNS rules reference rule-set tags via their rule-set fields.
- TUN `route_address_set[]` and `route_exclude_address_set[]` reference rule-set tags.
- Inline rule-set has no path, url, or download detour.
- Rule-set internal `rules[]` are not route.rules/dns.rules and should not be ordered by canvas edge order.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must add an inline rule-set resource.
- The Docs action must open `rule-set/index.md` and `rule-set/headless-rule.md`.
- The add flow should explain that inline rule-set rules are reusable match definitions, not routing actions.

Node-specific concern:

- Headless rules have many match fields. A raw JSON textarea will overwhelm users and make version gates invisible.

Recommendation:

- Use `ADD` and open Inspector with a structured rule builder, starting with common domain/IP/port match groups.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `inline rule-set` as the type.
- Status must fail when tag is missing or `rules[]` is empty.
- The card should summarize rule count and common match families.

Port semantics:

- Left ports: references from Route Rules, DNS Rules, and TUN route set fields.
- Right ports: none.

Recommendation:

- Do not show downstream outbounds. A rule-set only supplies reusable match data.

## Right: Inspector

Review:

- Inspector must expose tag and a structured Headless Rule editor.
- Common fields should be grouped as Domain, IP/CIDR, Port, Process/App, Network, Wi-Fi, and Advanced.
- Logical rules need a nested builder with `and`/`or`.
- Version-gated fields need target-aware enablement.
- Attach/detach from route/DNS rules should be explicit and table-owned for route/DNS rule order.

Recommendation:

- Start with structured repeaters for the most common fields and reserve raw JSON for advanced imported rules.

## Priority Findings

- P0 inline rules are required and need structured Headless Rule editing.
- P0 canonical references from route/DNS/TUN must be tag fields, not canvas-only edges.
- P1 version-gated Headless Rule fields need target-aware UI.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags, empty rules, malformed match fields, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
