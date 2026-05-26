<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# DNS Server / https — Deep UI Review

> Source: official stable + testing docs (identical for this node), Palette.tsx, Inspector.tsx, sharedFieldRegistry.ts, SbcNode.tsx, commands.ts, diagnostics.ts, types.ts.
> Review date: 2026-05-27.

---

## Official Field Inventory

**Stable == Testing** — both versions define the same `dns/server/https.md` structure. This node was introduced in sing-box 1.12.0.

### Protocol-specific fields (4)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `server` | string | **Yes** | — | DNS server address. If a domain name, `domain_resolver` (dial field) must be set. |
| `server_port` | uint16 | No | `443` | DNS server port. |
| `path` | string | No | `/dns-query` | HTTP request path for the DoH endpoint. |
| `headers` | map\[string\]string | No | — | Additional HTTP headers sent with DoH requests. |

### Shared TLS Fields (via shared/tls.md — Outbound shape)

`"https"` is in `dnsServerTlsTypes` (`sharedFieldRegistry.ts` line 157). TLS group is enabled.

| Field | Notes |
|---|---|
| `tls.enabled` | Enable TLS for the DoH connection. |
| `tls.server_name` | SNI override. |
| `tls.insecure` | Skip certificate verification. |
| `tls.alpn[]` | ALPN list (e.g. `h2`, `http/1.1`). |
| `tls.min_version` / `tls.max_version` | TLS 1.0–1.3. |
| `tls.certificate_path` | CA certificate path. |
| `tls.certificate_provider` | Certificate provider tag. |
| (additional outbound TLS fields) | See shared/tls.md outbound section for full list. |

### Shared Dial Fields (via shared/dial.md)

`"https"` is in `dnsServerDialTypes` (`sharedFieldRegistry.ts` line 156 — all CREATABLE_DNS_SERVER_TYPES except `hosts`, `fakeip`, `tailscale`, `resolved`). Dial group is enabled.

| Field | Notes |
|---|---|
| `detour` | Upstream outbound tag (select). |
| `bind_interface` | Network interface to bind. |
| `connect_timeout` | Dial timeout. |
| `domain_resolver` | DNS resolver tag for resolving `server` when it is a domain name. Required when `server` is a domain. |
| `network_strategy` | `default` / `hybrid` / `fallback`. |
| `network_type` | Network type filter list. |
| `fallback_network_type` | Fallback network type list. |
| `fallback_delay` | Duration string. |

**Total official fields: 4 protocol-specific + 8 TLS (active subset shown in UI) + 8 dial = 20 tracked fields.**

---

## Left Panel — Palette (Add Library)

**Current state** (`Palette.tsx` line 91):
```ts
{ label: "HTTPS Server", kind: "dns-https", icon: Globe2, docsUrl: docs("dns/server/https/"), ready: true }
```

**Palette kind mapping** (`protocols.ts` line 98):
```ts
"dns-https": "https"
```

### Findings

- Label `"HTTPS Server"` is clear and correct for a DNS over HTTPS resolver.
- `ready: true` means the Palette item has a functional ADD action — correct given this node type has its initial state implemented.
- `icon: Globe2` is shared with multiple DNS server types (Local, HTTP3, mDNS) and the DNS hub. No semantic differentiation between different HTTPS-capable nodes.
- Docs URL `docs("dns/server/https/")` points to the correct location.
- No drag-to-canvas behavior observed in the code; ADD adds directly via command — consistent with other DNS server nodes.

---

## Middle Panel — Canvas Node

**Canvas node kind:** `"dns-server"` (SbcNode.tsx).

### Port Specification

**Input ports (left side):**
```
dns      → Referenced as dns.final
dns-rule → Referenced in a DNS rule's server field
```

**Output ports (right side) for `dns-server` kind:**
```
outbound  → Upstream dial detour outbound (when detour is set)
endpoint  → Upstream endpoint (for tailscale type only)
```

`"https"` is a standard DNS server type with no special port exclusions.

### Findings

- Port semantics are correct. The HTTPS DNS server connects right-to-left as a rule target or final resolver, and optionally chains right to an outbound via dial `detour`.
- Canvas titlebar shows `"dns-server / https"` (kind + type), which is accurate.
- No display of `server:server_port` or `path` in the canvas node subtitle — difficult to distinguish multiple DoH servers at a glance (e.g., different providers both using type `https`).
- The node status badge reflects generic semantic validity, not HTTPS-specific checks (e.g., missing required `server` field).

---

## Middle Panel — Initial State (commands.ts)

**`createDnsServer("https", tag)`** (`commands.ts` lines 617–626):
```ts
if (type === "https") {
  return {
    type,
    tag,
    address: "https://1.1.1.1/dns-query",  // ← spurious legacy field
    server: "1.1.1.1",
    server_port: 443,
    path: "/dns-query",
  };
}
```

### Findings

- The template includes an `address` field that is **not defined in the official `https.md` schema**. The `address` field belongs to the legacy DNS server type; the new `https` type uses `server` + `server_port` + `path`. This is a spurious field that will appear in the exported JSON and may confuse the sing-box parser or future validation.
- `server`, `server_port`, and `path` are correctly seeded.
- `headers` is absent from the template (acceptable — it is optional and defaults to none), but see Inspector gap below.

---

## Right Panel — Inspector

### What the inspector provides for `ref.kind === "dns-server"`

From `Inspector.tsx` lines 1548–1605:

1. **Tag** rename input.
2. **Type** select from `CREATABLE_DNS_SERVER_TYPES`.
3. **Address** text input, shown when `"address" in entity` (line 1550).
4. **Server** text input, shown when `"server" in entity` (line 1559).
5. **Port** number input, shown when `"server_port" in entity` (line 1568).
6. **Path** text input, shown when `"path" in entity` (line 1578).
7. **Tailscale Endpoint** select, gated on `entityType === "tailscale"` (line 1587).
8. **AdvancedScalarFields** — spills any non-handled scalar field (line 1603).
9. **SharedFieldCards** — renders Dial and TLS sections as collapsible module cards.

### `dnsServerHandledFields` set (lines 142–153)

```ts
const dnsServerHandledFields = new Set([
  "tag", "type",
  "address",
  "server", "server_port",
  "path",
  "endpoint",
  "tls",
  "neighbor_domain",
  ...dialSharedFields,
]);
```

`"headers"` is **not** in this set.

### Gap analysis for HTTPS DNS server

| Field | Expected UI | Actual |
|---|---|---|
| `server` | First-class required text input | **Present** — rendered when `"server" in entity`. Default template seeds it, so visible for new nodes. |
| `server_port` | First-class number input | **Present** — rendered when `"server_port" in entity`. Default template seeds it. |
| `path` | Text input | **Present** — rendered when `"path" in entity`. Default template seeds it. |
| `headers` | Map repeater or JSON textarea | **Missing** — `headers` is an object, not a scalar. It is absent from `dnsServerHandledFields`. `AdvancedScalarFields` only shows scalar fields, so `headers` is **silently invisible** for imported configs that contain it, and cannot be added for new nodes. |
| `tls` | Shared TLS card | **Correctly handled** — `"https"` is in `dnsServerTlsTypes`; TLS card is shown. |
| Dial fields | Shared Dial card | **Correctly handled** — `"https"` is in `dnsServerDialTypes`; Dial card is shown. |
| `address` (spurious) | Should not exist for `type === "https"` | **Present** — the default template seeds `address`, so the Inspector renders it as a first-class text input even though `address` is not in the official `https.md` schema. It is in `dnsServerHandledFields`, so it is always shown. |

### Template vs. Inspector consistency

The default template (`commands.ts`) creates:
```json
{
  "type": "https",
  "tag": "...",
  "address": "https://1.1.1.1/dns-query",
  "server": "1.1.1.1",
  "server_port": 443,
  "path": "/dns-query"
}
```

When this template is rendered in the Inspector:
- `address`, `server`, `server_port`, `path` all appear as first-class inputs — but `address` is spurious.
- `headers` is absent from the entity so it never appears.
- The TLS and Dial shared cards are correctly shown.

### Diagnostics gap

`diagnostics.ts` DNS server validation (lines 284–303) only checks:
- `server.detour` references a valid outbound tag.
- `server.endpoint` references a valid endpoint tag.

There is no check for:
- Missing `server` (required field) on `type === "https"` DNS server.
- Presence of the spurious `address` field on `type === "https"`.

---

## Priority Findings

### P0 — Spurious `address` field in default template for `type === "https"`

**Location:** `src/domain/commands.ts` line 621 and `src/components/Inspector.tsx` line 1550.

The official `https.md` schema defines no `address` field. The `address` field belongs to the legacy DNS server type. The default template for `type === "https"` incorrectly includes `"address": "https://1.1.1.1/dns-query"`, which:

1. Produces an invalid exported JSON field that the sing-box binary may reject or silently ignore.
2. Renders as a first-class "Address" input in the Inspector, misleading the user into thinking it is a valid configuration field.
3. Causes the `address` guard in the Inspector (`"address" in entity`) to always fire for newly created HTTPS servers, creating a confusing duplicate of `server`.

**Resolution required:**
- Remove `address: "https://1.1.1.1/dns-query"` from the `https` branch in `createDnsServer` (`commands.ts`).
- The Inspector's `"address" in entity` guard will naturally stop showing the address field for new nodes once the template is fixed. For imported legacy configs that happen to have both `address` and `server`, the guard will still show it, which may be acceptable as a migration aid but should be gated to `type !== "https"` to prevent confusion.

### P0 — `headers` object is silently invisible in Inspector

**Location:** `src/components/Inspector.tsx` — dns-server block (lines 1548–1605).

`headers` is an `map[string]string` defined in the official schema. It is absent from `dnsServerHandledFields`. The `AdvancedScalarFields` component only surfaces scalar values, so any imported config with `"headers": {"Authorization": "Bearer ..."}` will be **entirely invisible** in the Inspector. The field cannot be added or viewed for newly created HTTPS servers.

**Resolution required:**
1. Add `"headers"` to `dnsServerHandledFields` in `Inspector.tsx`.
2. Add a `JsonField` for headers gated on `ref.kind === "dns-server" && entityType === "https"` in the DNS server inspector block:
```tsx
{entityType === "https" ? (
  <JsonField
    label="Extra Headers"
    value={entity.headers ?? {}}
    onChange={(value) => updateField(ref, "headers", value)}
  />
) : null}
```

### P1 — Missing required-field diagnostic for `server` on `type === "https"`

**Location:** `src/domain/diagnostics.ts` — DNS server forEach loop (line 284).

The `server` field is marked `==Required==` in the official schema. A user who clears the Server input to an empty string produces an exported config with `"server": ""`, which is invalid. No diagnostic fires.

**Resolution required:** In the DNS server diagnostics loop, add:
```ts
if (["https", "h3", "tls", "quic", "tcp", "udp"].includes(server.type ?? "") && !server.server) {
  push(diagnostics, "error", "missing-dns-server-server",
    `/dns/servers/${index}/server`,
    `DNS server "${server.tag}" (${server.type}) requires a server address.`);
}
```

### P1 — `path` input hidden for imported configs without a `path` key

**Location:** `src/components/Inspector.tsx` line 1578.

The Path field is rendered only when `"path" in entity`. The default template seeds `path: "/dns-query"` so this is fine for newly created nodes. However, if a user imports a config that omits `path` (relying on the default `/dns-query`), the Path field will be invisible in the Inspector. There is no way to add a non-default path without manually editing the JSON export.

This is a systemic issue shared with other field guards in the DNS server inspector block, but is especially relevant for `path` since its default is a meaningful non-empty value and users may want to override it for custom DoH deployments.

**Resolution required:** Always render the Path input for `entityType === "https"` regardless of whether `path` exists in the entity:
```tsx
{entityType === "https" || "path" in entity ? (
  <label className="field">
    <span>Path</span>
    <input
      value={String(entity.path ?? "/dns-query")}
      onChange={(event) => updateField(ref, "path", event.target.value || undefined)}
      placeholder="/dns-query"
    />
  </label>
) : null}
```

### P1 — `DnsServerConfig` type missing `headers` field

**Location:** `src/domain/types.ts` lines 38–45.

```ts
export type DnsServerConfig = TaggedConfig & {
  detour?: string;
  endpoint?: string;
  address?: string;
  server?: string;
  server_port?: number;
  path?: string;
  // headers is missing
};
```

The `headers` field is absent from the TypeScript type, which means any code that accesses `entity.headers` will be typed as `unknown` and the store will not preserve it through a type-switched update (when the user switches from `https` to another type and back, the replacement object from `createDnsServer` discards `headers`).

**Resolution required:** Add `headers?: Record<string, string>` to `DnsServerConfig`.

---

## Implementation Tasks

### Task 1 — Remove spurious `address` from HTTPS default template (P0)

**File:** `src/domain/commands.ts` lines 617–626.

Remove `address: "https://1.1.1.1/dns-query"` from the `https` branch:
```ts
if (type === "https") {
  return {
    type,
    tag,
    server: "1.1.1.1",
    server_port: 443,
    path: "/dns-query",
  };
}
```

Optionally gate the Address input in Inspector to `entityType !== "https"` to prevent it from showing for imported legacy configs that happen to carry `address`.

### Task 2 — Add `headers` field to Inspector for `type === "https"` DNS server (P0)

**File:** `src/components/Inspector.tsx`

1. Add `"headers"` to `dnsServerHandledFields` (line 142 block).
2. In the `ref.kind === "dns-server"` block (lines 1548–1605), add after the Path input and before the Tailscale Endpoint select:
```tsx
{entityType === "https" ? (
  <JsonField
    label="Extra Headers"
    value={entity.headers ?? {}}
    onChange={(value) => updateField(ref, "headers", value)}
  />
) : null}
```

### Task 3 — Add `headers` to `DnsServerConfig` TypeScript type (P1)

**File:** `src/domain/types.ts`

```ts
export type DnsServerConfig = TaggedConfig & {
  detour?: string;
  endpoint?: string;
  address?: string;
  server?: string;
  server_port?: number;
  path?: string;
  headers?: Record<string, string>;  // ← add
};
```

### Task 4 — Add required-server diagnostic for new DNS server types (P1)

**File:** `src/domain/diagnostics.ts`

In the `config.dns?.servers` forEach loop (after line 303), add:
```ts
if (["https", "h3", "tls", "quic", "tcp", "udp"].includes(server.type ?? "") && !server.server) {
  push(
    diagnostics,
    "error",
    "missing-dns-server-server",
    `/dns/servers/${index}/server`,
    `DNS server "${server.tag}" (${server.type}) requires a server address.`,
  );
}
```

### Task 5 — Always render Path input for `entityType === "https"` (P1)

**File:** `src/components/Inspector.tsx`

Replace the guard at line 1578:
```tsx
// Before:
{"path" in entity ? (

// After:
{entityType === "https" || entityType === "h3" || "path" in entity ? (
```

Update the value expression to use the correct default:
```tsx
value={String(entity.path ?? (entityType === "https" || entityType === "h3" ? "/dns-query" : ""))}
```

---

## Done Criteria

- Exporting a freshly created HTTPS DNS server node produces JSON with no `address` field.
- `headers` object is visible and editable as a JSON field in the Inspector when `type === "https"`.
- `path` input is always visible for `type === "https"`, pre-filled with `/dns-query` as placeholder when empty.
- Semantic diagnostics fire an `"error"` level finding when `server` is empty on a `type === "https"` DNS server.
- `DnsServerConfig` TypeScript type includes `headers?: Record<string, string>`.
- Round-trip test: import `{ "type": "https", "tag": "doh", "server": "dns.example.com", "server_port": 443, "path": "/dns-query", "headers": { "Authorization": "Bearer token" } }`, verify all fields visible in Inspector, edit tag, export JSON, confirm `address` is absent and `headers` is preserved.
