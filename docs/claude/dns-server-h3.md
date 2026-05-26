<!-- Reviewed against stable and testing http3.md (identical content), shared dial/TLS registries, Palette.tsx, Inspector.tsx, commands.ts, sharedFieldRegistry.ts, SbcNode.tsx, protocols.ts. -->
<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# DNS Server / h3 UI Review

## Scope

- Node ID in canvas/graph: `dns-server:h3`
- Palette kind: `dns-http3`
- Official type string written to JSON: `h3`
- Official doc (stable = testing): `dns/server/http3.md`
- Since: sing-box 1.12.0

## Official Model (7 fields)

From `stable/docs/configuration/dns/server/http3.md`:

| Field | Required | Default | Notes |
|---|---|---|---|
| `type` | yes | — | `"h3"` |
| `tag` | yes | — | |
| `server` | yes | — | domain name requires `domain_resolver` in Dial |
| `server_port` | no | 443 | |
| `path` | no | `/dns-query` | |
| `headers` | no | — | object, additional HTTP headers |
| `tls` | no | — | shared outbound TLS section |
| Dial Fields | no | — | full set via shared Dial |

Total official editable fields: 7 (excluding tag/type which are always present).

## Naming Inconsistency (P1)

The node uses three different identifiers for the same object:

| Layer | Identifier |
|---|---|
| Palette `kind` | `dns-http3` |
| Canvas node ID prefix / `ref.kind` | `dns-server` + type `h3` |
| Official sing-box `type` value | `h3` |
| `protocols.ts` map key | `"dns-http3": "h3"` |

The Palette key `dns-http3` is the only place the `http3` spelling appears. All sibling nodes use the pattern `dns-<type>` where `<type>` matches the official type string directly (e.g. `dns-tls`, `dns-quic`, `dns-https`). For h3 the type string is `h3` so the consistent palette key would be `dns-h3`, not `dns-http3`.

This is a cosmetic-only inconsistency: `protocols.ts` correctly maps `"dns-http3" -> "h3"` so JSON output is not affected. However it breaks the visual naming convention and causes confusion when grepping for the node.

## Left: Add Library (Palette)

`Palette.tsx` line 92:

```
{ label: "HTTP3 Server", kind: "dns-http3", icon: Globe2, docsUrl: docs("dns/server/http3/"), status: "setup" }
```

- Status `setup` is correct: adds a draft node, not a complete ready resource.
- Label `"HTTP3 Server"` is reasonable but inconsistent with the official name "DNS over HTTP3 (DoH3)". A label like `"DoH3 Server"` or `"H3 DNS"` would match other entries more closely.
- Docs URL points to `dns/server/http3/` which is correct.
- Icon `Globe2` is appropriate (same as HTTPS server).

## Middle: Canvas Node (SbcNode)

- Node kind is `dns-server`, type is `h3`.
- Title bar renders `dns-server / h3` — correct, not the palette kind.
- Icon is `Server` from `iconMap["dns-server"]` — consistent with all other dns-server nodes.

### Port Semantics

Input ports (left side), same for all `dns-server` nodes:

| Port key | Meaning |
|---|---|
| `dns` | DNS final server (connects when `dns.final === this.tag`) |
| `dns-rule` | DNS rule routes to this server (`rule.server === this.tag`) |

Output port (right side):

| Port key | Meaning |
|---|---|
| `outbound` | Detour outbound (`server.detour`) |

These are correct for h3. The detour port maps to Dial Fields `detour`, which is part of the shared Dial section in Inspector. There is no special h3 port beyond what all dialable dns-server nodes expose.

### Canvas Node Data Issues

- The `sbc-node__title` shows `data.title` (the tag value) — correct.
- The bottom pill shows `data.type` which is `h3` — correct.
- The `sbc-node-primary` button count uses `data.compatible.length || 1` — the fallback `|| 1` is not h3-specific but is a general quirk.
- The large `+` affordance creates `data.compatible[0]`. For a DNS server this would typically be nothing; no h3-specific compatible list is defined.

## Right: Inspector

The `dns-server` block in Inspector (lines 1548-1604) handles these fields conditionally by checking `"field" in entity`:

| Field | Inspector control | Notes |
|---|---|---|
| `tag` | text input + `renameTag` | correct |
| `type` | select from `CREATABLE_DNS_SERVER_TYPES` | correct; `h3` is in the list |
| `server` | text input | correct |
| `server_port` | number input | correct, shows `0` when not set — should default-display `443` |
| `path` | text input | correct |
| `tls` | shared TLS card | via `sharedFieldRegistry` |
| Dial Fields | shared Dial card | via `sharedFieldRegistry` |

### Missing Field: `headers` (P0)

`headers` is not in `dnsServerHandledFields` (line 142-153) and is not rendered anywhere in the `dns-server` inspector block. If a user imports a config with `headers` populated, the field will appear in `AdvancedScalarFields` only if it happens to be a flat scalar value — but `headers` is an object (`Record<string, string>`), so it will be silently skipped by `editableScalarFields` (which filters to `string | number | boolean` values only).

This means:

1. No way to set `headers` from the inspector for a new h3 server.
2. Existing `headers` in an imported config is silently invisible and will survive round-trip only because `updateField` is not called on it.
3. There is no `JsonField` fallback for object-typed dns-server fields the way there is for some service fields.

`headers` must be added as a `JsonField` (or structured key-value repeater) in the `dns-server` inspector branch, guarded by `entityType === "h3"` (and also `entityType === "https"` which has the same field per its own doc).

### `server_port` Default Display

Inspector renders `Number(entity.server_port ?? 0)` for the port input. The official default is `443`. The `createDnsServer("h3", tag)` in `commands.ts` does set `server_port: 443` in the initial draft, so new nodes are fine. But if someone clears the field (making it `0`), the UI doesn't communicate that `443` is the implicit default. Minor UX gap, not a data loss risk.

### `path` Default Display

Same pattern: rendered as empty string when absent, but official default is `/dns-query`. The `createDnsServer("h3", tag)` sets `path: "/dns-query"` so new nodes are fine. If cleared, the placeholder or helper text is missing.

### Shared Sections

`sharedGroupsForEntity` for `ref.kind === "dns-server"`:

- `dnsServerDialTypes` includes all creatable types except `hosts`, `fakeip`, `tailscale`, `resolved`. `h3` is in `CREATABLE_DNS_SERVER_TYPES` and is not excluded → `dial` group is added. Correct.
- `dnsServerTlsTypes = new Set(["tls", "quic", "https", "h3"])` → `tls` group is added. Correct.

The shared Dial Fields section exposes:

| Dial field | UI label |
|---|---|
| `detour` | Detour (select from outbounds) |
| `bind_interface` | Bind Interface |
| `connect_timeout` | Connect Timeout |
| `domain_resolver` | Domain Resolver (text) |
| `network_strategy` | Network Strategy (select) |
| `network_type` | Network Type (list) |
| `fallback_network_type` | Fallback Network (list) |
| `fallback_delay` | Fallback Delay |

All present. `domain_resolver` is especially important for h3 because the official doc states: "If domain name is used, `domain_resolver` must also be set." There is no validation or diagnostic that enforces this.

The shared TLS section exposes: `enabled`, `server_name`, `insecure`, `alpn`, `min_version`, `max_version`, `certificate_path`, `certificate_provider`. These are the standard outbound TLS fields. Correct for h3.

### `domain_resolver` Required-When-Domain Diagnostic (P1)

The official doc says `domain_resolver` MUST be set when `server` is a domain name. The diagnostics file (`diagnostics.ts`) does not check this for h3 (or https). If the user sets `server: "dns.cloudflare.com"` without `domain_resolver`, the config will be exported silently and fail at runtime.

## `DnsServerConfig` Type (types.ts)

```typescript
export type DnsServerConfig = TaggedConfig & {
  detour?: string;
  endpoint?: string;
  address?: string;
  server?: string;
  server_port?: number;
  path?: string;
};
```

`headers` is absent from the TypeScript type. This means even if the Inspector rendered a `headers` field, the type would need updating to allow it. The type also lacks `tls` (handled as a generic object through the shared TLS inspector) — consistent with how other entities handle it via `unknown`.

## `createDnsServer` for h3 (commands.ts)

```typescript
if (type === "h3") {
  return {
    type,
    tag,
    server: "1.1.1.1",
    server_port: 443,
    path: "/dns-query",
  };
}
```

The draft is correct but does not include `headers: {}` — this is fine because `headers` is optional. However, unlike the `https` type which also pre-populates `address` (a legacy field that h3 does not use), h3 is clean. The draft gives the user a working starting point.

Note: the `https` draft includes `address: "https://1.1.1.1/dns-query"` as well as `server`/`server_port`/`path`. For h3 there is no `address` field, which is correct.

## Priority Findings

### P0: `headers` field invisible and uneditable (Inspector.tsx + types.ts)

`headers` is an official field for `type: "h3"` (and `type: "https"`). It is:
- Not in `dnsServerHandledFields` (so not explicitly handled).
- An object type, so it falls through `editableScalarFields` silently.
- Not in the `DnsServerConfig` TypeScript type.

Result: users cannot set custom HTTP headers for DoH3 requests from the UI, and any `headers` already present in imported JSON survives as invisible pass-through data only.

### P1: Palette kind naming inconsistency (`dns-http3` vs `dns-h3`)

The Palette uses `dns-http3` while every other dns-server palette key uses the official type string suffix. The official type is `h3`, so the key should be `dns-h3` to match `dns-tls`, `dns-quic`, `dns-https`, etc. This is cosmetic only (JSON output is correct) but breaks the naming convention and causes confusion.

### P1: No diagnostic for missing `domain_resolver` when `server` is a hostname

When `server` is a domain name (not a bare IP), sing-box requires `domain_resolver` to be set in Dial Fields. The UI has no validation for this. A new user setting `server: "dns.cloudflare.com"` without Dial Fields will get a silently invalid export.

## Implementation Tasks

1. **Add `headers` JsonField to dns-server inspector** (Inspector.tsx, guarded by `entityType === "h3" || entityType === "https"`):
   - Add `"headers"` to `dnsServerHandledFields` so it does not leak into `AdvancedScalarFields`.
   - Render a `JsonField` for it in the `dns-server` block.
   - Add `headers?: Record<string, string>` to `DnsServerConfig` in `types.ts`.

2. **Fix Palette kind** (Palette.tsx + protocols.ts):
   - Change `kind: "dns-http3"` to `kind: "dns-h3"` in `Palette.tsx`.
   - Update `protocols.ts` key from `"dns-http3"` to `"dns-h3"`.
   - No other code references `dns-http3` directly.

3. **Add `domain_resolver` diagnostic for h3/https** (diagnostics.ts):
   - When `server` looks like a hostname (contains non-numeric, non-IP characters) and `domain_resolver` / `detour` are absent, emit a warning-level diagnostic on the dns-server node.

4. **Improve `server_port` and `path` placeholder text** (Inspector.tsx):
   - Show `placeholder="443"` for the port input when type is `h3` (or `https`).
   - Show `placeholder="/dns-query"` for the path input.
   - These are purely cosmetic UX improvements, not data bugs.
