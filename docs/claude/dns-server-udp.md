<!-- Reviewed against official stable/testing docs (both identical at 1.12.0), Inspector.tsx, sharedFieldRegistry.ts, Palette.tsx, protocols.ts, and commands.ts. -->
<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# DNS Server / udp UI Review

## Scope

- Node ID: `dns-server:udp`
- Palette kind: `dns-udp`
- Official doc: `dns/server/udp.md` (stable == testing, both since 1.12.0)
- sing-box minimum version: **1.12.0**

## Official Model

Fields from `dns/server/udp.md` plus shared dial fields:

| Field | Required | Default | Source |
|---|---|---|---|
| `type` | yes (fixed `"udp"`) | — | index.md |
| `tag` | yes | — | index.md |
| `server` | **yes** | — | udp.md |
| `server_port` | no | `53` | udp.md |
| `detour` | no | — | shared/dial.md |
| `bind_interface` | no | — | shared/dial.md |
| `inet4_bind_address` | no | — | shared/dial.md |
| `inet6_bind_address` | no | — | shared/dial.md |
| `bind_address_no_port` | no | — | shared/dial.md (since 1.13.0) |
| `routing_mark` | no | — | shared/dial.md (Linux only) |
| `reuse_addr` | no | — | shared/dial.md |
| `netns` | no | — | shared/dial.md (since 1.12.0, Linux only) |
| `connect_timeout` | no | — | shared/dial.md |
| `tcp_fast_open` | no | — | shared/dial.md |
| `tcp_multi_path` | no | — | shared/dial.md |
| `disable_tcp_keep_alive` | no | — | shared/dial.md (since 1.13.0) |
| `tcp_keep_alive` | no | `5m` | shared/dial.md (since 1.13.0) |
| `tcp_keep_alive_interval` | no | `75s` | shared/dial.md (since 1.13.0) |
| `udp_fragment` | no | — | shared/dial.md |
| `domain_resolver` | no (required since 1.14.0 if server is domain name) | — | shared/dial.md (since 1.12.0) |
| `network_strategy` | no | — | shared/dial.md (since 1.11.0, mobile only) |
| `network_type` | no | — | shared/dial.md (since 1.11.0, mobile only) |
| `fallback_network_type` | no | — | shared/dial.md (since 1.11.0, mobile only) |
| `fallback_delay` | no | `300ms` | shared/dial.md (since 1.11.0, mobile only) |
| ~~`domain_strategy`~~ | deprecated | — | shared/dial.md (deprecated 1.12.0, removed 1.14.0) |

Total official fields: **23** (22 active + 1 deprecated).

### Key semantic note

The `domain_resolver` field replaces the legacy `address_resolver`/`address_strategy` pattern. When `server` contains a domain name, `domain_resolver` **must** be set (mandatory from sing-box 1.14.0 onward). The UI must surface this as a diagnostic rather than silently allowing a domain-name server without a resolver.

## Current UI State

### Palette (Palette.tsx:88)

```
{ label: "UDP Server", kind: "dns-udp", icon: Server, docsUrl: docs("dns/server/udp/"), status: "setup" }
```

- Label `"UDP Server"` is accurate.
- `docsUrl` points to `dns/server/udp/` — correct.
- `status: "setup"` — matches peer new-type servers (tcp, tls, etc.).

### protocols.ts

- `DNS_SERVER_PALETTE_TYPES["dns-udp"] = "udp"` — correct mapping.
- `CREATABLE_DNS_SERVER_TYPES` includes `"udp"` — correct, addable.
- `preferredDnsServerTags["udp"] = "udp-dns"` — reasonable default tag.

### commands.ts — createDnsServer

For `type === "udp"`, the scaffold is:
```json
{ "type": "udp", "tag": "<tag>", "server": "1.1.1.1", "server_port": 53 }
```
This matches the official minimal shape exactly. No spurious fields, no missing required fields.

### sharedFieldRegistry.ts — dnsServerDialTypes

```ts
const dnsServerDialTypes = new Set([...CREATABLE_DNS_SERVER_TYPES, "mdns"]
  .filter((type) => type !== "hosts" && type !== "fakeip" && type !== "tailscale" && type !== "resolved"));
```

`"udp"` is in `CREATABLE_DNS_SERVER_TYPES` and not filtered out, so `sharedGroupsForEntity` returns `["dial"]` for a `dns-server` of type `"udp"`. The `"tls"` group is NOT returned for UDP (correct — UDP has no TLS).

### Inspector.tsx — dnsServerHandledFields

```ts
const dnsServerHandledFields = new Set([
  "tag", "type", "address", "server", "server_port",
  "path", "endpoint", "tls", "neighbor_domain",
  ...dialSharedFields,   // detour, bind_interface, connect_timeout, domain_resolver,
                         // network_strategy, network_type, fallback_network_type, fallback_delay
]);
```

`server` and `server_port` are in the handled set — they render as explicit fields in the Inspector dns-server branch (lines 1559–1577).

### Inspector.tsx — dialSharedFields

```ts
const dialSharedFields = [
  "detour",
  "bind_interface",
  "connect_timeout",
  "domain_resolver",
  "network_strategy",
  "network_type",
  "fallback_network_type",
  "fallback_delay",
];
```

The following official dial fields are **absent** from `dialSharedFields`:

| Missing field | Status |
|---|---|
| `inet4_bind_address` | not in dialSharedFields, not in handledFields |
| `inet6_bind_address` | not in dialSharedFields, not in handledFields |
| `bind_address_no_port` | not in dialSharedFields, not in handledFields |
| `routing_mark` | not in dialSharedFields, not in handledFields |
| `reuse_addr` | not in dialSharedFields, not in handledFields |
| `netns` | not in dialSharedFields, not in handledFields |
| `tcp_fast_open` | not in dialSharedFields, not in handledFields |
| `tcp_multi_path` | not in dialSharedFields, not in handledFields |
| `disable_tcp_keep_alive` | not in dialSharedFields, not in handledFields |
| `tcp_keep_alive` | not in dialSharedFields, not in handledFields |
| `tcp_keep_alive_interval` | not in dialSharedFields, not in handledFields |
| `udp_fragment` | not in dialSharedFields, not in handledFields |

These 12 fields are **not** in `dnsServerHandledFields` either, so they fall through to `AdvancedScalarFields` (line 1603). That path renders them as raw text inputs with auto-derived labels — functional but unstyled and without type coercion or validation.

The deprecated `domain_strategy` field is also absent from `dialSharedFields` and `dnsServerHandledFields`, so it too falls to `AdvancedScalarFields`. This is acceptable since it is deprecated; however, the UI should warn when it is present in an imported config.

### Inspector.tsx — server_port rendering

`server_port` is rendered as:
```tsx
<input type="number" value={Number(entity.server_port ?? 0)} ... />
```

The fallback is `0`, not `53`. The official default is `53`. When a user clears the field the value will become `0`, which is invalid. This is a data-loss / silent-error risk.

### Canvas node (graph.ts:523–549)

The canvas node for any `dns-server` entry uses:
- `subtitle`: `"${server.type} dns server"` — plain string, acceptable.
- Edge to outbound via `server.detour` — correct.
- Edge to endpoint only for `tailscale` type — correct (UDP does not use endpoint).
- No edge for `domain_resolver` — the resolver is a tag reference but is not visualized as a canvas edge. For UDP servers where `server` is a domain, the lack of a `domain_resolver` edge means a missing-resolver situation is invisible on the canvas.

## Priority Findings

### P0 — server_port fallback value is 0 instead of 53

**Location**: Inspector.tsx lines 1568–1577

```tsx
value={Number(entity.server_port ?? 0)}
```

Official default is `53`. The current fallback `0` is an invalid port. If a user clicks into the field and clears it, the exported JSON will contain `"server_port": 0`, which sing-box will reject or silently mishandle. The fallback should be `53` (or the field should be omitted when matching the default, as sing-box treats absence of `server_port` as `53`).

**Fix**: Change `?? 0` to `?? 53`, or strip `server_port` from the exported object when it equals `53`.

### P0 — domain_resolver is a free-text input but must reference a dns-server tag

**Location**: Inspector.tsx line 886

```tsx
{ label: "Domain Resolver", path: ["domain_resolver"], kind: "text" }
```

`domain_resolver` accepts a tag string or an object `{ server: "...", ... }`. The current implementation uses a plain text input with no validation and no tag selector. If `server` contains a domain name and `domain_resolver` is absent or wrong, the UDP DNS server will fail to resolve at runtime. From sing-box 1.14.0 this becomes a hard requirement.

**Fix**: Render `domain_resolver` as a select over available `dns-server` tags (same pattern as `detour` over outbound tags). Add a diagnostic that fires when `server` is not an IP address and `domain_resolver` is unset.

### P1 — 12 dial fields fall through to AdvancedScalarFields without type coercion

**Location**: Inspector.tsx dialSharedFields (lines 105–114), dnsServerHandledFields (lines 142–153)

The fields `inet4_bind_address`, `inet6_bind_address`, `bind_address_no_port`, `routing_mark`, `reuse_addr`, `netns`, `tcp_fast_open`, `tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, `udp_fragment` are not in `dialSharedFields` and not in `dnsServerHandledFields`. They are rendered by `AdvancedScalarFields` as untyped text boxes with auto-capitalized labels.

For boolean fields (`bind_address_no_port`, `reuse_addr`, `tcp_fast_open`, `tcp_multi_path`, `disable_tcp_keep_alive`, `udp_fragment`), the user must type `true`/`false` as strings. For numeric fields (`routing_mark`), arbitrary text is accepted.

**Fix**: Add these fields to `dialSharedFields` (they are shared across outbounds, endpoints, and dns-servers) with proper `kind` annotations (`boolean`, `number`, `text`). Update the `sharedFieldDefinitions` for the `"dial"` group in Inspector to include them.

### P1 — deprecated domain_strategy not flagged in Inspector

**Location**: Inspector.tsx — no warning for `domain_strategy` in dns-server context

When an imported config contains `domain_strategy` on a UDP DNS server (legal until sing-box 1.14.0), the field is silently displayed as a raw text input via `AdvancedScalarFields`. There is no deprecation warning and no migration hint toward `domain_resolver`.

**Fix**: Add a version-gated warning banner or field-level note when `domain_strategy` is present on a dns-server entity, pointing the user toward `domain_resolver` and the migration guide.

### P1 — canvas does not visualize domain_resolver dependency

**Location**: graph.ts — dns-server node construction (lines 523–549)

When a UDP DNS server has `server` set to a domain name, it depends on `domain_resolver` to resolve that domain. This dependency is not represented as a canvas edge. A user building a config from scratch cannot see that the resolver dependency is missing.

**Fix**: When `domain_resolver` is a non-empty string on a dns-server entity, draw an edge from the dns-server node to the target `dns-server:<tag>` node (similar to the detour edge). Add a diagnostic that fires when `server` is a domain name and `domain_resolver` is absent.

## Implementation Tasks

1. **P0-A** In Inspector.tsx, change `entity.server_port ?? 0` to `entity.server_port ?? 53` for the dns-server `server_port` field (line 1573). Applies to all dns-server types that have `server_port`.
2. **P0-B** In Inspector.tsx `sharedFieldDefinitions` for the `"dial"` group, change `domain_resolver` from `kind: "text"` to `kind: "select"` with options drawn from dns-server tags. Add a diagnostic in the validation layer: when a dns-server entity has `server` set to a non-IP value and `domain_resolver` is absent, emit a P0-level diagnostic.
3. **P1-A** Add the 12 missing dial fields to `dialSharedFields` in Inspector.tsx with correct `SharedFieldKind` values. Update `sharedFieldDefinitions` for the `"dial"` group to include them. No change needed to `dnsServerHandledFields` since `dialSharedFields` is spread into it.
4. **P1-B** In the dns-server Inspector branch, detect the presence of `domain_strategy` and render a deprecation warning label adjacent to the field.
5. **P1-C** In graph.ts dns-server node construction, add an edge for `domain_resolver` when it is a non-empty string, connecting to `dns-server:<domain_resolver>`. Handle the case where the target node does not exist by marking the edge as broken (same pattern used elsewhere for missing tags).

## Done Criteria

- Exporting a `dns-udp` node with default `server_port` absent produces `"server_port": 53` or no `server_port` key (not `0`).
- `domain_resolver` is a tag select in the Inspector; missing resolver with a domain-name server triggers a visible diagnostic.
- Boolean and numeric dial fields render as checkboxes and number inputs, not plain text boxes.
- Imported configs with `domain_strategy` show a deprecation warning.
- A canvas edge appears between a UDP DNS server and its `domain_resolver` target when set.
- Fixture or smoke test: add a `dns-udp` server with a domain-name `server` and a `domain_resolver` reference, round-trip through import/export, verify no field loss.
