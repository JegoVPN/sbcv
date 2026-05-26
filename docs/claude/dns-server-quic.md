<!-- Reviewed against official stable/testing docs (both identical at 1.12.0), Inspector.tsx, sharedFieldRegistry.ts, Palette.tsx, protocols.ts, commands.ts, and graph.ts. -->
# DNS Server / quic UI Review

## Scope

- Node ID: `dns-server:quic`
- Palette kind: `dns-quic`
- Official doc: `dns/server/quic.md` (stable == testing, both since 1.12.0)
- sing-box minimum version: **1.12.0** (new `type`-based DNS server structure)

## Official Model

Fields from `dns/server/quic.md` plus shared dial fields:

| Field | Required | Default | Source |
|---|---|---|---|
| `type` | yes (fixed `"quic"`) | — | index.md |
| `tag` | yes | — | index.md |
| `server` | **yes** | — | quic.md |
| `server_port` | no | `853` | quic.md |
| `tls` | no | — | shared/tls.md (outbound) |
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

Total official fields: **26** (25 active + 1 deprecated).

### Key semantic notes

1. `server` is **required** — no default. If `server` contains a domain name, `domain_resolver` **must** be set (mandatory from sing-box 1.14.0).
2. `server_port` defaults to `853` (standard DoQ port). This is different from TCP/UDP (port 53) and HTTPS/H3 (port 443).
3. `tls` is the full outbound TLS object from `shared/tls.md`. It is optional in the JSON schema but practically mandatory for a DoQ connection (the QUIC transport layer itself requires TLS; sing-box may apply a default but callers should set it explicitly).
4. The "quic" shared field group in `sharedFieldRegistry.ts` (`initial_packet_size`, `disable_path_mtu_discovery`, `idle_timeout`, `keep_alive_period`) is **NOT** assigned to `dns-server` nodes — it applies only to hysteria/hysteria2/tuic inbounds and outbounds. DoQ does not expose those QUIC transport knobs via the official docs.
5. Per the official changelog note, `domain_resolver` and `domain_strategy` in Dial Fields replace the legacy `address_resolver`/`address_strategy` pattern from the old (pre-1.12.0) QUIC server.

## Current UI State

### Palette (Palette.tsx:90)

```
{ label: "QUIC Server", kind: "dns-quic", icon: Plug, docsUrl: docs("dns/server/quic/"), status: "setup" }
```

- Label `"QUIC Server"` is accurate.
- `docsUrl` points to `dns/server/quic/` — correct.
- `status: "setup"` — consistent with peer new-type servers (tcp, tls, https, h3).
- Icon is `Plug` — acceptable but `Shield` (used for TLS-family items like `dns-tls`) would better communicate the secure-transport nature of DoQ.

### protocols.ts

- `DNS_SERVER_PALETTE_TYPES["dns-quic"] = "quic"` — correct mapping.
- `CREATABLE_DNS_SERVER_TYPES` includes `"quic"` — correct, addable.
- `preferredDnsServerTags["quic"] = "quic-dns"` — reasonable default tag.

### commands.ts — createDnsServer

For `type === "quic"` (handled in the `type === "tls" || type === "quic"` branch):
```json
{ "type": "quic", "tag": "<tag>", "server": "1.1.1.1", "server_port": 853 }
```
This matches the official minimal shape. Note that `tls` is not pre-populated in the scaffold. For a DoQ server, the QUIC transport inherently uses TLS; leaving `tls: {}` absent means sing-box will negotiate TLS with system defaults. This is acceptable as a scaffold but the Inspector's TLS section should be prominently surfaced for this node type so users know it exists.

### sharedFieldRegistry.ts

```ts
const dnsServerTlsTypes = new Set(["tls", "quic", "https", "h3"]);
```

`"quic"` is correctly included in `dnsServerTlsTypes`, so `sharedGroupsForEntity` returns `["dial", "tls"]` for a `dns-server` of type `"quic"`. Both the dial section and the TLS section will be shown in the Inspector's Shared Configuration panel. This is correct.

The `"quic"` shared group (transport-level QUIC knobs) is correctly **not** assigned to `dns-server` entities — those fields belong to hysteria/tuic inbounds/outbounds only.

### Inspector.tsx — dnsServerHandledFields

```ts
const dnsServerHandledFields = new Set([
  "tag", "type", "address", "server", "server_port",
  "path", "endpoint", "tls", "neighbor_domain",
  ...dialSharedFields,   // detour, bind_interface, connect_timeout, domain_resolver,
                         // network_strategy, network_type, fallback_network_type, fallback_delay
]);
```

`server`, `server_port`, and `tls` are all in the handled set. `server` and `server_port` render as explicit inputs in the dns-server Inspector branch (lines 1559–1577). `tls` is in the handledFields set and rendered via the SharedFieldCards TLS section.

### Inspector.tsx — server_port rendering

```tsx
<input type="number" value={Number(entity.server_port ?? 0)} ... />
```

The fallback is `0`, not `853`. The official default is `853`. When a user clears the field, the exported JSON will contain `"server_port": 0`, which is invalid. This is a data-loss / silent-error risk specific to the quic type (different default than udp/tcp which have port 53).

### Inspector.tsx — TLS fields rendered

The TLS shared section renders these fields via `sharedFieldDefinitions` for group `"tls"`:
- `tls.enabled` (boolean)
- `tls.server_name` (text)
- `tls.insecure` (boolean)
- `tls.alpn` (list)
- `tls.min_version` (select)
- `tls.max_version` (select)
- `tls.certificate_path` (text)
- `tls.certificate_provider` (text)

Missing TLS outbound fields that are not in the Inspector TLS group: `disable_sni`, `cipher_suites`, `curve_preferences`, `certificate`, `certificate_public_key_sha256`, `client_certificate`, `client_certificate_path`, `client_key`, `client_key_path`, `fragment`, `fragment_fallback_delay`, `record_fragment`, `ech`, `utls`, `reality`. These fall to `AdvancedScalarFields` as raw text inputs. For DoQ, `utls` (fingerprint spoofing) and `insecure` are the fields most likely to be configured by end-users; both are covered by the current TLS section.

### Inspector.tsx — dialSharedFields

The following official dial fields are **absent** from `dialSharedFields` and from `dnsServerHandledFields`:

| Missing field | Status |
|---|---|
| `inet4_bind_address` | falls to AdvancedScalarFields |
| `inet6_bind_address` | falls to AdvancedScalarFields |
| `bind_address_no_port` | falls to AdvancedScalarFields |
| `routing_mark` | falls to AdvancedScalarFields |
| `reuse_addr` | falls to AdvancedScalarFields |
| `netns` | falls to AdvancedScalarFields |
| `tcp_fast_open` | falls to AdvancedScalarFields |
| `tcp_multi_path` | falls to AdvancedScalarFields |
| `disable_tcp_keep_alive` | falls to AdvancedScalarFields |
| `tcp_keep_alive` | falls to AdvancedScalarFields |
| `tcp_keep_alive_interval` | falls to AdvancedScalarFields |
| `udp_fragment` | falls to AdvancedScalarFields |

These 12 fields fall through to `AdvancedScalarFields` (line 1603). Boolean fields render as text inputs accepting `true`/`false` strings. This is a shared issue across all dns-server types, not quic-specific.

### Canvas node (graph.ts:523–549)

The canvas node for any `dns-server` uses:
- `subtitle`: `"${server.type} dns server"` — shows `"quic dns server"`, acceptable.
- Edge to outbound via `server.detour` — correct (drawn at line 544).
- No edge for `domain_resolver` — unvisualized tag dependency.
- No edge for tailscale endpoint (correct — quic does not use `endpoint`).

The output port `"outbound"` is connected via the dial `detour` field (useProjectStore.ts line 1149–1158). When clicked, if no detour is set, a `direct` outbound is created and linked. This is correct behavior for a DoQ server.

## Priority Findings

### P0 — server_port fallback value is 0 instead of 853

**Location**: Inspector.tsx lines 1568–1577

```tsx
value={Number(entity.server_port ?? 0)}
```

Official default for `quic` is `853`. The current fallback `0` is an invalid port. If a user clicks into the field and clears it, the exported JSON will contain `"server_port": 0`, which sing-box will reject or silently mishandle. The fallback must be `853` for quic (and tls). This is distinct from the UDP/TCP case (port 53) — the fix needs to be type-aware.

**Fix**: Make the fallback value type-specific. For `quic` and `tls`, use `?? 853`; for `tcp` and `udp`, use `?? 53`; for `https` and `h3`, use `?? 443`. Or, omit the field entirely when it matches the type-specific default.

### P0 — domain_resolver is a free-text input but must reference a dns-server tag

**Location**: Inspector.tsx line 886

```tsx
{ label: "Domain Resolver", path: ["domain_resolver"], kind: "text" }
```

`domain_resolver` must reference the tag of another dns-server. A plain text input accepts arbitrary strings with no validation. If `server` contains a domain name (e.g., `"dns.cloudflare.com"`) and `domain_resolver` is absent or wrong, the DoQ server will fail to resolve at runtime. From sing-box 1.14.0 this is a hard requirement.

**Fix**: Render `domain_resolver` as a select over available `dns-server` tags (same pattern as `detour` over outbound tags). Add a diagnostic that fires when `server` is not an IP address literal and `domain_resolver` is unset.

### P1 — TLS section not visually emphasized for quic type

**Location**: Inspector.tsx SharedFieldCards, Inspector dns-server branch

For `dns-quic`, TLS is not optional at the protocol level (QUIC inherently requires TLS). However, the Inspector shows TLS in the generic "Shared Configuration" collapsible section, giving it the same visual weight as optional shared sections like dial. A user unfamiliar with DoQ may overlook TLS configuration entirely and not realize why the connection fails.

**Fix**: For `type === "quic"`, either promote the TLS section to appear above the dial section with a note ("DoQ requires TLS"), or add an info banner in the dns-server Inspector branch when `tls.enabled` is falsy and `entityType === "quic"`.

### P1 — 12 dial fields fall through to AdvancedScalarFields without type coercion

**Location**: Inspector.tsx dialSharedFields (lines 105–114), dnsServerHandledFields (lines 142–153)

Same as all dns-server types. Boolean fields (`bind_address_no_port`, `reuse_addr`, `tcp_fast_open`, `tcp_multi_path`, `disable_tcp_keep_alive`, `udp_fragment`) require typed `true`/`false` strings. Numeric field (`routing_mark`) accepts arbitrary text.

**Fix**: Add these 12 fields to `dialSharedFields` with correct `SharedFieldKind` values. This fix applies to all dns-server types, not only quic.

### P1 — canvas does not visualize domain_resolver dependency

**Location**: graph.ts — dns-server node construction (lines 523–549)

When `server` is a domain name and `domain_resolver` is set to another dns-server tag, there is no canvas edge representing that dependency. A user cannot see the resolver chain on the canvas.

**Fix**: When `domain_resolver` is a non-empty string on a dns-server entity, draw an edge from the dns-server node to the target `dns-server:<domain_resolver>` node. Add a semantic diagnostic when `server` is a domain-name literal and `domain_resolver` is absent.

## Implementation Tasks

1. **P0-A** In Inspector.tsx, fix `entity.server_port ?? 0` to be type-aware: for quic (and tls), default to `853`; for tcp/udp, `53`; for https/h3, `443`. The fix affects all three occurrences of `server_port ?? 0` in the Inspector dns-server branch (lines ~1573).
2. **P0-B** In Inspector.tsx `sharedFieldDefinitions` for the `"dial"` group, change `domain_resolver` from `kind: "text"` to `kind: "select"` with options drawn from dns-server tags. Add a semantic diagnostic: when a dns-server entity has `server` set to a non-IP value and `domain_resolver` is absent, emit a `"missing-domain-resolver"` error.
3. **P1-A** For `entityType === "quic"` in the dns-server Inspector branch, render a visible note or promote the TLS shared section so users understand TLS configuration is required for DoQ.
4. **P1-B** Add the 12 missing dial fields to `dialSharedFields` in Inspector.tsx with correct `SharedFieldKind` values. No change needed to `dnsServerHandledFields` since `dialSharedFields` is spread into it.
5. **P1-C** In graph.ts dns-server node construction, add an edge for `domain_resolver` when it is a non-empty string, connecting to `dns-server:<domain_resolver>`. Handle missing target by marking the edge as broken.

## Done Criteria

- Exporting a `dns-quic` node with default `server_port` absent produces `"server_port": 853` or no `server_port` key (not `0`).
- `domain_resolver` is a tag select in the Inspector; a domain-name server without a resolver triggers a visible diagnostic.
- The TLS section is prominently surfaced for `quic`-type dns-server nodes.
- Boolean and numeric dial fields render as checkboxes and number inputs, not plain text boxes.
- A canvas edge appears between a QUIC DNS server and its `domain_resolver` target when set.
- Fixture or smoke test: add a `dns-quic` server with a domain-name `server`, a `domain_resolver` reference, and a minimal `tls` object; round-trip through import/export with no field loss.
