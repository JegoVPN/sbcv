<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# DNS Server / local UI Review

<!-- Source: official stable + testing docs; reviewed against Palette, Inspector, sharedFieldRegistry, commands.ts, SbcNode.tsx, protocols.ts. -->

## Official Model

### Stable (1.12.0+) canonical JSON

```json
{
  "type": "local",
  "tag": "",
  "prefer_go": false
  // Dial Fields
}
```

### Testing (1.14.0+) canonical JSON — adds `neighbor_domain`

```json
{
  "type": "local",
  "tag": "",
  "prefer_go": false,
  "neighbor_domain": []
  // Dial Fields
}
```

### DNS Server common fields (from `dns/server/index.md`)

The `dns.servers[]` index doc defines only two top-level shared fields:

| Field | Required | Type | Notes |
|---|---|---|---|
| `type` | yes | select | `"local"` for this node; available since 1.12.0 |
| `tag` | yes | string | unique identifier for this server |

No other fields (`domain_resolver`, `client_subnet`, `strategy`, `disable_cache`, `disable_expire`) appear in the stable or testing server index — those are legacy DNS hub-level fields, not per-server fields in the new typed API.

### local-specific fields

| Field | Required | Type | Since | Notes |
|---|---|---|---|---|
| `prefer_go` | no | boolean | 1.13.0 (stable) | Forces DNS resolution via dialing; disables platform integrations on Apple/Linux |
| `neighbor_domain` | no | string[] | 1.14.0 (testing only) | Domain suffixes answered from neighbor resolver; entries must start with `.` |

### Dial Fields (shared group)

`dns/server/local/` explicitly includes Dial Fields. These are the shared `dial` group:
`detour`, `bind_interface`, `inet4_bind_address`, `inet6_bind_address`, `connect_timeout`, `domain_resolver`, `network_strategy`, `network_type`, `fallback_network_type`, `fallback_delay`, `tcp_fast_open`, `tcp_multi_path`, `udp_fragment`.

### Field inventory — 15 total (2 common + 2 local-specific + dial group ~11)

---

## Registry / Code Audit

### Palette (`src/components/Palette.tsx` line 85)

```ts
{ label: "Local Server", kind: "dns-local", icon: Globe2, docsUrl: docs("dns/server/local/"), ready: true }
```

- Entry exists with `ready: true` (no `status` qualifier). This is correct — the node is fully supported.
- `docsUrl` points to the official local server doc. Correct.
- Icon is `Globe2` (same as DNS Hub and HTTPS Server). Acceptable but not distinctive.

### Palette kind → type mapping (`src/domain/protocols.ts` line 90-105)

```ts
DNS_SERVER_PALETTE_TYPES = {
  "dns-local": "local",
  ...
}
```

Mapping `dns-local` → `"local"` is correct.

### Default object (`src/domain/commands.ts` line 585)

```ts
if (type === "local") return { type, tag };
```

Default object is `{ type: "local", tag }` — no optional fields scaffolded. This is minimal and correct; `prefer_go` defaults to `false` so it is safe to omit.

### Type-switch preservation (`src/domain/commands.ts` line 901-913)

```ts
if (ref.kind === "dns-server") {
  const replacement = createDnsServer(nextType, ref.tag);
  const detour = item.detour;
  const endpoint = item.endpoint;
  return {
    ...replacement,
    ...(detour ? { detour } : {}),
    ...(nextType === "tailscale" && endpoint ? { endpoint } : {}),
  };
}
```

On type switch, only `detour` and (if switching to tailscale) `endpoint` are preserved. `prefer_go` and `neighbor_domain` are **not preserved** across type switches. This is generally acceptable for type switches but means switching away from `local` and back will silently drop `prefer_go: true`.

### CREATABLE_DNS_SERVER_TYPES (`src/domain/protocols.ts` line 107-120)

```ts
export const CREATABLE_DNS_SERVER_TYPES = [
  "local", "hosts", "tcp", "udp", "tls", "quic",
  "https", "h3", "dhcp", "fakeip", "tailscale", "resolved",
] as const;
```

- `"local"` is first in the list. Correct.
- `"mdns"` is absent — it exists in `DNS_SERVER_PALETTE_TYPES` but is excluded from the type select (because it is `status: "gated"` in Palette). This is consistent.
- `"legacy"` is also absent from `CREATABLE_DNS_SERVER_TYPES`, which is correct since legacy is being deprecated.

The Inspector type `<select>` iterates `CREATABLE_DNS_SERVER_TYPES`, so the type switcher for dns-server will correctly show `local` as an option.

### sharedFieldRegistry (`src/domain/sharedFieldRegistry.ts` line 156, 183-187)

```ts
const dnsServerDialTypes = new Set(
  [...CREATABLE_DNS_SERVER_TYPES, "mdns"]
  .filter((type) => type !== "hosts" && type !== "fakeip" && type !== "tailscale" && type !== "resolved")
);
// dnsServerDialTypes includes "local" ✓

if (ref.kind === "dns-server") {
  if (dnsServerDialTypes.has(entityType)) groups.push("dial");
  if (dnsServerTlsTypes.has(entityType)) groups.push("tls");
  if (entityType === "local") groups.push("neighbor");
}
```

- `"local"` is in `dnsServerDialTypes` → Dial shared group is attached. Correct.
- `"local"` is NOT in `dnsServerTlsTypes` (which is `["tls", "quic", "https", "h3"]`) → no TLS group. Correct.
- `entityType === "local"` → pushes `"neighbor"` group. Correct per testing docs (`neighbor_domain` is a local-only field).

### Neighbor group fields (`src/components/Inspector.tsx` line 969-978)

```ts
if (group === "neighbor") {
  if (ref.kind === "dns-server") {
    return [{ label: "Neighbor Domain", path: ["neighbor_domain"], kind: "list" }];
  }
}
```

`neighbor_domain` is surfaced as a `kind: "list"` shared field inside the `neighbor` group. The `neighbor` group is only added to `local` type dns-server nodes.

However, `neighbor_domain` is a **testing-only field** (since 1.14.0). The UI exposes it unconditionally with no version guard or tooltip indicating it requires testing/1.14.0.

### dnsServerHandledFields (`src/components/Inspector.tsx` line 142-153)

```ts
const dnsServerHandledFields = new Set([
  "tag", "type",
  "address", "server", "server_port", "path",
  "endpoint",
  "tls",
  "neighbor_domain",
  ...dialSharedFields,
]);
```

`neighbor_domain` is listed in `dnsServerHandledFields`, so it will NOT fall through to `AdvancedScalarFields` as a raw scalar. It is handled by the `neighbor` shared group card. Correct.

`prefer_go` is **not** in `dnsServerHandledFields`. Since `prefer_go` is a boolean scalar, it falls through to `AdvancedScalarFields` as a checkbox rendered under the "Advanced fields" disclosure. The label will auto-generate as "Prefer Go" via `labelForField`. This works but is not ideal — it should be a first-class toggle in the Inspector body.

### Inspector dns-server body (`src/components/Inspector.tsx` line 1548-1604)

The dns-server block checks for `"address" in entity`, `"server" in entity`, `"server_port" in entity`, `"path" in entity`, `"endpoint" in entity` — none of these apply to a `local` server. For a `local` type node, the only primary Inspector body content is:
1. Tag input (always shown if tag exists)
2. Type select (CREATABLE_DNS_SERVER_TYPES)
3. Dial shared group card
4. Neighbor shared group card (only for `local`)
5. AdvancedScalarFields spillover (catches `prefer_go` as boolean checkbox)

There are no explicit primary fields added for `local` beyond the shared groups.

### SbcNode ports (`src/components/SbcNode.tsx` line 88-93)

Left-side (input) ports for `dns-server`:
```ts
{ key: "dns", label: "DNS final server", nodeKind: "dns", icon: Globe2 },
{ key: "dns-rule", label: "DNS rule", nodeKind: "dns-rule", icon: GitBranch },
```

Right-side (output) ports for `dns-server`:
```ts
{ key: "outbound", label: "Detour outbound", nodeKind: "outbound", icon: Network }
```
(tailscale also adds `endpoint` port — not applicable to `local`)

Port semantics are correct for `local`: it can be referenced as a final or rule-target server, and it can dial through an outbound detour. No extraneous ports.

---

## Priority Findings

### P0 — None

The local DNS server node is broadly correct. The critical fields (`tag`, `type`, dial group, `neighbor_domain`) are all wired. There are no missing required fields and no broken port semantics.

### P1 — `prefer_go` falls through to AdvancedScalarFields instead of being a first-class toggle

`prefer_go` is a named local-specific field documented in stable since 1.13.0. It controls platform integration behaviour (Apple NetworkExtension `getaddrinfo`, Linux systemd-resolved DBus). It currently falls through to the generic `AdvancedScalarFields` disclosure as a boolean checkbox labelled "Prefer Go".

The disclosure is hidden by default. A user who specifically wants to set `prefer_go: true` to force Go-native dialing (the primary use-case on Linux with systemd-resolved) may not find it.

**Fix required:**
- Add `"prefer_go"` to `dnsServerHandledFields` in `Inspector.tsx`.
- Render a named toggle inside the dns-server Inspector block, gated on `entityType === "local"`:
  ```tsx
  {entityType === "local" ? (
    <label className="toggle-row">
      <input
        type="checkbox"
        checked={Boolean(entity.prefer_go)}
        onChange={(event) => updateField(ref, "prefer_go", event.target.checked || undefined)}
      />
      <span>Prefer Go (disable platform DNS integrations)</span>
    </label>
  ) : null}
  ```
- Version annotation: tooltip or `<small>` noting "Since 1.13.0".

### P1 — `neighbor_domain` is a testing-only field (1.14.0) with no version guard in the UI

The `neighbor` shared group is shown unconditionally for `local` type nodes via `sharedGroupsForEntity`. The `neighbor_domain` field it surfaces is only available since sing-box 1.14.0 (testing channel). A user running a stable 1.12.x or 1.13.x config will silently write an unrecognized field.

**Fix required:**
- Add a version badge or tooltip to the Neighbor Domain field label indicating "Since 1.14.0 (testing)".
- Optionally add a diagnostic: if `neighbor_domain` is non-empty and the project's target version is < 1.14.0, emit a warning.

### P1 — Type select includes `"legacy"` in `DNS_SERVER_PALETTE_TYPES` but not in `CREATABLE_DNS_SERVER_TYPES`

This is not a bug but a deliberate inconsistency: `dns-legacy` palette kind maps to `"legacy"` type (for importing/rendering existing configs), but `"legacy"` is excluded from the Inspector type select. If a user has an imported legacy server and clicks the type select, they cannot return to `"legacy"` after switching. This is the intended deprecation path but should be documented.

No code change required; this is an accepted design decision, but a tooltip on the type select ("Legacy type is deprecated in 1.14.0") would improve clarity.

### P1 — `mdns` type absent from `CREATABLE_DNS_SERVER_TYPES` but present in `DNS_SERVER_PALETTE_TYPES`

`mdns` is a testing-only (1.14.0+) server type. It appears in `DNS_SERVER_PALETTE_TYPES` and in Palette as `status: "gated"`, but is not in `CREATABLE_DNS_SERVER_TYPES`. This means:
- A user cannot reach `mdns` via the type select on an existing dns-server node.
- An imported config with `type: "mdns"` will display the type as `"mdns"` in the header, but the type select will show no matching option (the select will show `local` as the current value since `"mdns"` is not in the list).

This is an existing known gap for the `gated` mdns type; it needs a fix at the `dns-mdns` Palette item but is not specific to `local`.

---

## Implementation Tasks

1. **Promote `prefer_go` to first-class toggle (P1)**
   - Add `"prefer_go"` to `dnsServerHandledFields` in `Inspector.tsx` (line 142-153).
   - Inside the `ref.kind === "dns-server"` Inspector block (around line 1548), add a conditional toggle rendered only when `entityType === "local"`:
     ```tsx
     {entityType === "local" ? (
       <label className="toggle-row">
         <input
           type="checkbox"
           checked={Boolean(entity.prefer_go)}
           onChange={(e) => updateField(ref, "prefer_go", e.target.checked || undefined)}
         />
         <span>Prefer Go <small>(Since 1.13.0 — disables platform DNS integrations)</small></span>
       </label>
     ) : null}
     ```

2. **Add version annotation for `neighbor_domain` (P1)**
   - In `sharedFieldDefinitions` for the `"neighbor"` group (`Inspector.tsx` line 969-978), add a label suffix or `since` metadata indicating "Since 1.14.0 (testing)":
     ```ts
     { label: "Neighbor Domain (since 1.14.0 / testing)", path: ["neighbor_domain"], kind: "list" }
     ```
   - Optionally, add a `diagnostics.ts` check: if `dns.servers[type=local].neighbor_domain` is non-empty and the effective target version is < 1.14.0, emit a `warning` diagnostic.

3. **Preserve `prefer_go` across type switches (minor / opportunistic)**
   - In `changeEntityType` (`commands.ts` line 901-913), when switching away from `local` type or back, `prefer_go` is currently dropped. This is expected behavior for type switches but could be improved: if switching from `local` to another type that does not support `prefer_go`, drop it; if the user is explicitly switching type back to `local`, it is acceptable to not restore it since the original is gone.
   - No immediate code change required; document as a known limitation.

4. **Fixture coverage for local + prefer_go + neighbor_domain (testing)**
   - Add a fixture file containing a dns-server of type `local` with `prefer_go: true` and `neighbor_domain: [".", ".lan"]`.
   - Verify import → canvas render → Inspector edit (`prefer_go` toggle visible, `neighbor_domain` list editable) → JSON export round-trip.
   - Note: `neighbor_domain` fixture should be marked as testing-only to avoid false positives in stable-channel CI.

---

## Done Criteria

- `prefer_go` is rendered as a named toggle in the Inspector body (not hidden in Advanced fields) when `entityType === "local"`.
- `neighbor_domain` field label carries a "Since 1.14.0 (testing)" annotation.
- Type select for dns-server correctly shows all CREATABLE_DNS_SERVER_TYPES; `local` is the first and default option.
- Dial shared group is attached to `local` type nodes (currently correct).
- Neighbor shared group is attached only to `local` type nodes (currently correct).
- An imported config with `prefer_go: true` round-trips without data loss.
- A diagnostic (or tooltip) warns when `neighbor_domain` is used on a pre-1.14.0 target.
