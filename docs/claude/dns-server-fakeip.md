<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# DNS Server / FakeIP UI Review (Claude Deep Review)

## Scope

- Editable node: `dns-server:fakeip`
- Palette kind: `dns-fakeip-server`
- Official docs: `dns/server/fakeip.md` (stable + testing, identical)
- Source-of-truth: canonical sing-box JSON / domain state.
- Review shape: Left Add Library, Middle Canvas Node, Right Inspector.

---

## Critical Distinction: Two Separate Concepts

The UI contains **two** distinct `dns-fakeip` palette kinds that map to different parts of the sing-box JSON schema. They must not be confused:

| Palette kind | JSON path | Schema status |
| --- | --- | --- |
| `dns-fakeip` | `dns.fakeip` (top-level object) | **Deprecated** in 1.12.0, **removed** in 1.14.0 (testing) |
| `dns-fakeip-server` | `dns.servers[].type = "fakeip"` | **Current** since 1.12.0 — this is the node under review |

The legacy `dns.fakeip` object had fields `enabled`, `inet4_range`, `inet6_range`. The new `dns.servers[].type = "fakeip"` server has only `type`, `tag`, `inet4_range`, `inet6_range` — no `enabled` toggle. Users migrating from pre-1.12 configs will have a top-level `dns.fakeip` block that must be surfaced as a migration diagnostic, not silently merged into the server form.

---

## Official Model

This node writes one object in `dns.servers[]` with `"type": "fakeip"`.

### Official writable fields (stable and testing are identical)

| Field | Type | Required | Default | Semantic | Notes |
| --- | --- | --- | --- | --- | --- |
| `type` | string | required | — | Always `"fakeip"` | Set on creation; must not be editable to break the discriminant |
| `tag` | string | optional | (generated) | Identifies this server in rule routing and `dns.final` | Should be required in practice |
| `inet4_range` | string (CIDR) | optional | `198.18.0.0/15` | IPv4 address pool for FakeIP mapping | Single CIDR string, not an array |
| `inet6_range` | string (CIDR) | optional | `fc00::/18` | IPv6 address pool for FakeIP mapping | See doc heading discrepancy below |

**Total official writable fields: 4** (type, tag, inet4_range, inet6_range).

### Doc discrepancy: `inet6_range` vs `inet6_address`

The stable and testing docs both show `inet6_range` in the JSON structure block but write `inet6_address` as the field heading text. The canonical JSON key is `inet6_range` (confirmed by the JSON example block and by `commands.ts` line 648 which initialises `inet6_range`). The heading is a documentation typo. The UI must use `inet6_range` as the serialised field name.

### Feature availability

FakeIP server type exists since sing-box 1.12.0. Configs targeting earlier versions cannot use this server type. The UI should surface a version gate when the target channel is pre-1.12.

### Relationship model

- FakeIP server can be referenced by `dns.final` (DNS hub final select).
- DNS rules can route to it via `action: "route"` with `server: "<tag>"`.
- FakeIP is a virtual address allocator, not a remote DNS resolver. It does not query upstream servers, does not use a dial detour, and has no address, path, TLS, or endpoint fields.
- `cache_file.store_fakeip` (in `settings:experimental`) controls whether FakeIP mappings survive restart. This is a separate concern from the server node itself.

---

## Left: Add Library

### Current implementation (Palette.tsx lines 83, 94)

```
{ label: "FakeIP",        kind: "dns-fakeip",        icon: Blocks, docsUrl: docs("dns/fakeip/") }
{ label: "FakeIP Server", kind: "dns-fakeip-server",  icon: Blocks, docsUrl: docs("dns/server/fakeip/"), status: "setup" }
```

Both entries use `Blocks` icon. The first (`dns-fakeip`) points to the **deprecated** top-level `dns.fakeip` doc. The second (`dns-fakeip-server`) is the node under review.

### Findings

- **F-PAL-1 (P1)**: The `dns-fakeip` entry (top-level legacy) has no deprecation label. Users on 1.12+ should see it marked as deprecated/removed, or the entry should be hidden for testing-channel targets.
- **F-PAL-2 (P1)**: Both `dns-fakeip` and `dns-fakeip-server` use identical `Blocks` icons. There is no visual distinction. The current `dns-fakeip-server` entry should use a different icon to signal it is the active server-type entry.
- **F-PAL-3 (P1)**: `status: "setup"` on `dns-fakeip-server` is correct (opens/adds a node). No finding on that.
- **F-PAL-4 (P2)**: The `dns-fakeip` entry has no `status` field (it defaults to `"add"`). For a deprecated/removed node type, the action must make the deprecation explicit rather than silently adding.

---

## Middle: Canvas Node

### Current implementation (graph.ts lines 523–550)

All DNS servers use the same `dnsServers.forEach` loop. For a fakeip server:

- `kind: "dns-server"`
- `type: server.type` → `"fakeip"`
- `title`: tag string
- `subtitle`: `"fakeip dns server"` (string interpolation of `server.type`)
- `status`: from diagnostics path `/dns/servers/{index}`
- `compatible: []`
- **No detour edge** emitted (no `server.detour` for fakeip type — correct)
- **No endpoint edge** emitted (only emitted for `tailscale` type — correct)

### Findings

- **F-NODE-1 (P1)**: Subtitle `"fakeip dns server"` does not communicate that this is a virtual address allocator, not a remote resolver. A subtitle like `"FakeIP address pool"` or `"virtual address allocator"` would be clearer.
- **F-NODE-2 (P1)**: `compatible: []` means the Plus button and primary count button still render (see T-NODE-2 / T-NODE-3 from the settings-experimental review, which applies to all nodes with empty `compatible`). These controls are non-functional no-ops for `dns-fakeip-server`.
- **F-NODE-3 (P2)**: The generic `SbcNode` renders the same layout for every DNS server. No visual cue distinguishes fakeip (no upstream) from an actual resolving server.
- **F-NODE-4 (P2)**: Incoming edges (from dns rules pointing to this server, from `dns.final`) are correct per graph.ts. Left port should accept connections from dns-rule route actions and from the DNS hub final field. Right port: none (no detour/endpoint).

---

## Right: Inspector

### Current implementation (Inspector.tsx lines 1548–1603)

The `ref.kind === "dns-server"` branch renders:

1. **Address** field (`"address" in entity ? …`) — conditional on entity having the field.
2. **Server** field (`"server" in entity ? …`) — conditional.
3. **Port** field (`"server_port" in entity ? …`) — conditional.
4. **Path** field (`"path" in entity ? …`) — conditional.
5. **Tailscale Endpoint** select — conditional on `entityType === "tailscale"`.
6. **AdvancedScalarFields** — renders any scalar field not in `dnsServerHandledFields` (tag, type, address, server, server_port, path, endpoint, tls, neighbor_domain, dial shared fields).

For a fakeip server entity initialised by `commands.ts` lines 643–650 (`{ type, tag, inet4_range, inet6_range }`):

- `address`, `server`, `server_port`, `path` are all absent from the entity → those conditional blocks do not render. Correct.
- `inet4_range` and `inet6_range` are string scalars not in `dnsServerHandledFields`. They fall through to **AdvancedScalarFields** and are rendered as plain text inputs with the field name as label.

### Findings

- **F-INS-1 (P0)**: `inet4_range` and `inet6_range` are rendered by `AdvancedScalarFields` as raw text inputs with machine-name labels (`inet4_range`, `inet6_range`). They have no CIDR validation, no human-readable labels ("IPv4 Range", "IPv6 Range"), no default hint text, and no explanation that these define the FakeIP address pool.
- **F-INS-2 (P0)**: There is no type-gated section distinguishing the fakeip Inspector from other dns-server types. Any future field additions to `dnsServerHandledFields` could inadvertently hide fakeip-specific fields. The fakeip Inspector branch should be explicit.
- **F-INS-3 (P1)**: `dnsServerHandledFields` does not include `inet4_range` or `inet6_range`. This means any imports containing these fields will be shown via `AdvancedScalarFields`. While functional, it is not type-safe: if another dns server type ever had these names, there would be no disambiguation.
- **F-INS-4 (P1)**: The Inspector provides no hint that this server type does not perform upstream DNS resolution, and that `store_fakeip` is a related but separate control in `settings:experimental → Cache File`. Users may expect to configure cache behaviour here.
- **F-INS-5 (P1)**: No version gate. The fakeip server type requires sing-box 1.12.0+. When the project targets an older channel, the Inspector should show a warning rather than silently allowing configuration of an unsupported field.
- **F-INS-6 (P2)**: Type switcher exists for dns-server nodes (Inspector.tsx line 1211 renders a `<select>` over `CREATABLE_DNS_SERVER_TYPES`). Switching from `fakeip` to a transport type (e.g. `udp`) must not carry over `inet4_range`/`inet6_range` as they are meaningless for remote servers. The `changeEntityType` path in `commands.ts` re-initialises fields for each type (line 643–649), so the re-init is correct; however there is no confirmation prompt or diagnostic when switching away from fakeip if the tag is referenced as a FakeIP server.
- **F-INS-7 (P2)**: The Inspector does not cross-link to the `settings:experimental → Cache File → Store FakeIP` toggle, leaving users with no discovery path for that related setting.

### sharedFieldRegistry behaviour

`sharedGroupsForEntity` (sharedFieldRegistry.ts line 183–187) for `ref.kind === "dns-server"`:
- `dnsServerDialTypes` excludes `"fakeip"` (line 156) → no `dial` shared group.
- `dnsServerTlsTypes` does not include `"fakeip"` → no `tls` shared group.
- `entityType === "local"` check does not match → no `neighbor` group.

Result: no shared field groups are injected for fakeip. This is correct — fakeip servers have no dial or TLS fields.

---

## Diagnostics

The baseline review (`docs/ui-reviews/dns-server-fakeip.md`) does not list a specific diagnostics.ts path. Based on the graph construction (path `/dns/servers/{index}`), the diagnostics file should check:

| Missing diagnostic | Code | Level | Path |
| --- | --- | --- | --- |
| `fakeip` server tag is referenced in `dns.final` but server has no tag | `missing-fakeip-tag` | error | `/dns/servers/{i}` |
| `inet4_range` is not a valid CIDR string | `invalid-fakeip-inet4-range` | error | `/dns/servers/{i}/inet4_range` |
| `inet6_range` is not a valid CIDR string | `invalid-fakeip-inet6-range` | error | `/dns/servers/{i}/inet6_range` |
| Both `inet4_range` and `inet6_range` absent (pool has no address space) | `fakeip-no-address-range` | warning | `/dns/servers/{i}` |
| Top-level `dns.fakeip` present alongside a `dns.servers[].type = "fakeip"` entry | `legacy-fakeip-coexists` | warning | `/dns/fakeip` |

---

## Tag Reference Surfaces

| Field | Kind | Control | Diagnostic needed |
| --- | --- | --- | --- |
| Referenced by `dns.final` | dns-server tag | DNS hub Inspector final select | Existing edge from hub |
| Referenced by `dns.rules[].server` | dns-server tag | DNS rule Inspector server select | Existing edge from dns-rule nodes |

The fakeip server itself has no outgoing tag references.

---

## Priority Findings

### P0 — Platform / type-specific guidance

| ID | Finding |
| --- | --- |
| F-INS-1 | `inet4_range` and `inet6_range` rendered by `AdvancedScalarFields` with machine-name labels and no CIDR validation. Must be promoted to a dedicated fakeip-specific Inspector section with proper labels, placeholder defaults, and CIDR validation. |
| F-INS-2 | No type-gated Inspector section for fakeip. The current implementation relies entirely on the generic `AdvancedScalarFields` fallback, which provides no type guidance, no field descriptions, and no protection against field bleed from other dns-server types. |

### P1

| ID | Finding |
| --- | --- |
| F-INS-3 | `inet4_range` / `inet6_range` not in `dnsServerHandledFields`; rendered by advanced fallback only. |
| F-INS-4 | No cross-link to `store_fakeip` in `settings:experimental`. |
| F-INS-5 | No version gate for sing-box 1.12.0+ requirement. |
| F-PAL-1 | Legacy `dns-fakeip` Palette entry has no deprecation label for 1.12+/1.14+ targets. |
| F-PAL-2 | Both `dns-fakeip` and `dns-fakeip-server` use identical `Blocks` icon. |
| F-NODE-1 | Subtitle `"fakeip dns server"` misleads — should communicate virtual allocator role. |
| F-NODE-2 | Plus button and primary count button render for nodes with `compatible: []`. |

### P2

| ID | Finding |
| --- | --- |
| F-INS-6 | Type switcher carries no confirmation when switching away from fakeip while tag is in use. |
| F-INS-7 | No discovery link to `cache_file.store_fakeip` in experimental settings. |
| F-NODE-3 | No visual cue on canvas distinguishing fakeip (no upstream) from remote resolving servers. |
| F-PAL-4 | Legacy `dns-fakeip` action defaults to `"add"` — should be restricted or deprecated. |

---

## Implementation Tasks

### Inspector — FakeIP-specific section

- **T-INS-1 (P0)**: Add a type-gated branch in the `ref.kind === "dns-server"` Inspector section: when `entityType === "fakeip"`, render a dedicated block instead of falling through to `AdvancedScalarFields`. This branch must include:
  - `inet4_range`: text field, label "IPv4 Range", placeholder `198.18.0.0/15`. Writes via `updateField(ref, "inet4_range", value)`.
  - `inet6_range`: text field, label "IPv6 Range", placeholder `fc00::/18`. Writes via `updateField(ref, "inet6_range", value)`. Confirm the serialised key is `inet6_range`, not `inet6_address`.
  - A static description line: "FakeIP allocates virtual addresses for DNS queries. These ranges define the IP pool."
- **T-INS-2 (P0)**: Add `"inet4_range"` and `"inet6_range"` to `dnsServerHandledFields` so they are not double-rendered by `AdvancedScalarFields` once the dedicated section exists.
- **T-INS-3 (P1)**: Add a version gate note when `entityType === "fakeip"`: show an info banner that this server type requires sing-box 1.12.0 or later.
- **T-INS-4 (P2)**: Add a cross-reference note: "To persist FakeIP mappings across restarts, enable 'Store FakeIP' under Settings → Experimental → Cache File." Optionally, make this a clickable link that navigates to `settings:experimental`.

### Graph / Canvas Node

- **T-NODE-1 (P1)**: In `graph.ts` `dnsServers.forEach`, when `server.type === "fakeip"`, override subtitle to `"FakeIP address pool"` (or `"virtual address allocator"`) instead of `"fakeip dns server"`.
- **T-NODE-2 (P1)**: In `SbcNode.tsx`, wrap the `sbc-node__add` Plus button in `{data.compatible.length > 0 ? (…) : null}`. This applies to all nodes with `compatible: []`, including fakeip.
- **T-NODE-3 (P1)**: Similarly guard the primary count button for nodes with `compatible: []`.

### Palette

- **T-PAL-1 (P1)**: On the `dns-fakeip` (legacy) Palette entry, add a deprecation label or `status: "deprecated"` rendering. When target channel is `testing` (1.14+), either hide the entry or visually mark it as removed.
- **T-PAL-2 (P1)**: Change the `dns-fakeip-server` Palette entry icon from `Blocks` to a different icon that visually distinguishes it from the legacy entry and communicates its virtual allocator role.

### Diagnostics

- **T-DIAG-1**: In `diagnostics.ts`, within the `dns.servers` loop, when `server.type === "fakeip"` and both `server.inet4_range` and `server.inet6_range` are absent or falsy, push `fakeip-no-address-range` warning at `/dns/servers/{i}`.
- **T-DIAG-2**: Add CIDR format validation for `inet4_range` and `inet6_range` when present; push `invalid-fakeip-inet4-range` / `invalid-fakeip-inet6-range` errors.
- **T-DIAG-3**: If top-level `config.dns?.fakeip` is present alongside any `dns.servers[]` entry with `type === "fakeip"`, push `legacy-fakeip-coexists` warning to guide migration.

### Tests / Fixtures

- **T-TEST-1**: Add an e2e fixture JSON containing `dns.servers[].type = "fakeip"` with `inet4_range` and `inet6_range`. Import, verify node renders as `dns-server:*`, verify Inspector shows both CIDR fields, verify export contains `inet4_range` / `inet6_range` (not `inet6_address`).
- **T-TEST-2**: Add unit test in `diagnostics.ts` for `fakeip-no-address-range` (both ranges absent).

---

## Done Criteria

- [ ] Inspector for `entityType === "fakeip"` renders dedicated IPv4 Range and IPv6 Range fields with correct labels.
- [ ] `inet4_range` and `inet6_range` are in `dnsServerHandledFields` and not double-rendered.
- [ ] Serialised export uses key `inet6_range`, not `inet6_address`.
- [ ] Canvas node subtitle for fakeip communicates virtual allocator role, not "dns server".
- [ ] Plus button and primary count button hidden for `compatible: []` nodes.
- [ ] Legacy `dns-fakeip` Palette entry shows deprecation for 1.12+/1.14+ targets.
- [ ] `fakeip-no-address-range` and CIDR-format diagnostics fire correctly.
- [ ] At least one import + export fixture test covering `inet4_range` and `inet6_range`.
- [ ] Stable and testing docs confirmed read (identical at this surface; see this document).
