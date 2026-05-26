<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# DNS Server / resolved — UI Review

<!-- source: stable + testing docs/configuration/dns/server/resolved.md; sharedFieldRegistry.ts; Inspector.tsx; graph.ts; diagnostics.ts; commands.ts; Palette.tsx; protocols.ts -->

## Scope

- Node ID: `dns-server:resolved`
- Palette kind: `dns-resolved`
- Official type string: `resolved`
- Since: sing-box 1.12.0
- Platform gate: **Linux / systemd only**

## Official Model

`dns.servers[]` object with `type: "resolved"`.

Official writable fields (stable = testing, identical):

| Field | Required | Type | Default | Notes |
|---|---|---|---|---|
| `type` | yes | `"resolved"` | — | fixed |
| `tag` | yes | string | — | unique tag |
| `service` | **Required** | string | — | tag of a `service:resolved` object |
| `accept_default_resolvers` | no | boolean | `false` | accept default DNS resolvers for fallback |

Total official fields: **4**

### Field semantics

`service` — required tag reference to exactly one `service:resolved` object. Without a valid `service:resolved` peer this DNS server cannot function. The node provides no independent dial path (no server address, no detour, no TLS, no path, no endpoint).

`accept_default_resolvers` — when `false`, queries that do not match search/match domains return `NXDOMAIN`. When `true`, DNS servers that have `SetLinkDefaultRoute` or `SetLinkDomains ~.` set are also tried, enabling use as a global DNS resolver.

### Relationship model

- `service` → one `service:resolved` (required, canvas edge right → service node)
- Referenced by `dns.final` (canvas edge from DNS hub)
- Referenced by `dns.rules[].server` via route action (canvas edge from dns-rule nodes)
- Referenced by `route.rules[].dns_server` (route resolve actions, not visualized as canvas edges)
- Referenced by dial fields `domain_resolver` (not visualized as canvas edges)
- No outbound detour, no TLS, no server address — service-backed only

## Current Implementation

### Palette (Palette.tsx line 97)

```
{ label: "Resolved Server", kind: "dns-resolved", icon: Server, docsUrl: docs("dns/server/resolved/"), status: "setup" }
```

- Status `"setup"` — not yet `ready`
- Label "Resolved Server" is acceptable but does not mention Linux/systemd gate
- Icon `Server` is generic; no visual distinction from other DNS server types

### protocols.ts

- `DNS_SERVER_PALETTE_TYPES["dns-resolved"] = "resolved"` — correct mapping
- `CREATABLE_DNS_SERVER_TYPES` includes `"resolved"` — correct
- `dnsServerDialTypes` in `sharedFieldRegistry.ts` explicitly excludes `"resolved"` — correct, no dial shared fields
- `dnsServerTlsTypes` does not include `"resolved"` — correct, no TLS shared fields

### sharedFieldRegistry.ts

`sharedGroupsForEntity` for `ref.kind === "dns-server"`:
- Dial: excluded for `"resolved"` via `dnsServerDialTypes` filter — **correct**
- TLS: excluded (`dnsServerTlsTypes` is `["tls","quic","https","h3"]`) — **correct**
- Neighbor: only for `"local"` type — **correct**

No shared field groups are incorrectly assigned to `resolved` type. This part is clean.

### commands.ts (createDnsServer default)

```ts
if (type === "resolved") {
  return { type, tag, service: "resolved", accept_default_resolvers: false };
}
```

Default scaffolding sets `service: "resolved"` as a literal string, not a resolved tag reference. If no `service:resolved` node exists at creation time, this creates a dangling reference. The default value is a reasonable placeholder but needs a diagnostic.

### Inspector.tsx (dns-server branch, lines 1548–1605)

The `dns-server` Inspector branch renders conditionally based on which keys exist in the entity object:
- `address` — shown if present
- `server` — shown if present
- `server_port` — shown if present
- `path` — shown if present
- `tailscale endpoint` — shown only if `entityType === "tailscale"`
- `AdvancedScalarFields` catches remaining unhandled scalar fields

**Critical gap**: there is no `entityType === "resolved"` branch. Neither `service` nor `accept_default_resolvers` has a dedicated control. Since these fields exist in the scaffolded default object returned by `createDnsServer`, they will be rendered by `AdvancedScalarFields` as raw text inputs (scalar fallback), not as typed controls.

`dnsServerHandledFields` (lines 142–153) does not include `service` or `accept_default_resolvers`. Both fields therefore fall through to `AdvancedScalarFields`.

### graph.ts (canvas edges, lines 543–550)

```ts
if (server.type === "tailscale" && server.endpoint) {
  edges.push(makeEdge(..., `endpoint:${server.endpoint}`, "endpoint", "dns-server"));
}
```

There is **no corresponding edge for `resolved` type**. The `service` field is not used to draw an edge from `dns-server:resolved` to `service:resolved`. The canvas cannot show the required service relationship.

### diagnostics.ts (lines 284–303)

The DNS server validation loop checks `detour` and `endpoint` tag references but does **not** check:
- That a `resolved`-type DNS server has a `service` field set
- That the `service` tag actually exists in `config.services` as a `resolved`-type service
- Platform/Linux-only warning for `dns.servers[type=resolved]` (the warning exists only for `services[type=resolved]` at line 206–214, not for the DNS server side)

## Priority Findings

### P0 — Missing `service` field control in Inspector

`service` is **Required** per the official spec. The Inspector has no select or text input explicitly for this field on the `resolved` branch. It falls through to `AdvancedScalarFields` as a raw text input with no type-specific label, no validation, and no reference to existing `service:resolved` tags. The user cannot discover which service tags are valid.

**Fix**: Add an `entityType === "resolved"` branch in the dns-server Inspector section. Render `service` as a `<select>` over `config.services.filter(s => s.type === "resolved").map(s => s.tag)`. Mark it required.

### P0 — Missing canvas edge: dns-server[resolved] → service:resolved

`graph.ts` draws a tailscale endpoint edge but has no equivalent for the `resolved` service reference. The canvas cannot visualize the mandatory `service` relationship. Dragging to create this edge also has no code path.

**Fix**: Add alongside the tailscale branch:
```ts
if (server.type === "resolved" && server.service) {
  edges.push(makeEdge(`edge:dns-server-service:${tag}:${server.service}`, id, `service:${server.service}`, "service", "dns-server"));
}
```

### P0 — No diagnostic for missing or invalid `service` tag reference

`diagnostics.ts` validates `detour` and `endpoint` references but not `service` for resolved DNS servers. A config with `service: "nonexistent"` exports silently with no error.

**Fix**: In the `dns.servers` forEach loop add:
```ts
if (server.type === "resolved") {
  const serviceTags = new Set(listItems(config.services).filter(s => s.type === "resolved").map(s => s.tag));
  if (!server.service) {
    push(diagnostics, "error", "resolved-dns-missing-service", `/dns/servers/${index}/service`,
      `DNS server "${server.tag}" (type resolved) requires a service field.`);
  } else if (!serviceTags.has(server.service)) {
    push(diagnostics, "error", "resolved-dns-missing-service-ref", `/dns/servers/${index}/service`,
      `DNS server "${server.tag}" references missing resolved service "${server.service}".`);
  }
}
```

### P0 — Platform gate: Linux/systemd warning missing for dns-server[resolved]

The `resolved-service-linux-only` warning fires for `services[type=resolved]` but not for `dns.servers[type=resolved]`. A user adding just the DNS server node with no service, or on a non-Linux target, gets no warning.

**Fix**: Add a parallel platform warning in the DNS server forEach:
```ts
if (server.type === "resolved") {
  push(diagnostics, "warning", "resolved-dns-linux-only", `/dns/servers/${index}`,
    "Resolved DNS server is Linux/systemd-specific; requires a running systemd-resolved instance.");
}
```

### P1 — `accept_default_resolvers` rendered as raw scalar, no behavioral copy

`accept_default_resolvers` falls to `AdvancedScalarFields` as a generic boolean toggle with the auto-generated label "Accept Default Resolvers". No copy explains the split-DNS vs global-DNS consequence (NXDOMAIN for non-matching domains when `false`; default route resolvers used when `true`).

**Fix**: In the `entityType === "resolved"` Inspector branch add an explicit labeled toggle:
```tsx
<label className="toggle-row">
  <input
    type="checkbox"
    checked={Boolean(entity.accept_default_resolvers)}
    onChange={(e) => updateField(ref, "accept_default_resolvers", e.target.checked)}
  />
  <span>Accept Default Resolvers</span>
</label>
<p className="field-hint">
  When off, queries not matching search or match domains return NXDOMAIN (split-DNS mode).
  When on, DNS servers with SetLinkDefaultRoute or SetLinkDomains ~. are also tried (global DNS mode).
</p>
```

Add `accept_default_resolvers` to `dnsServerHandledFields` to prevent double-render.

### P1 — Palette label does not signal Linux/systemd gate

"Resolved Server" is ambiguous. Users unfamiliar with systemd-resolved may add it expecting a generic resolver.

**Fix**: Label could be "Resolved (systemd)" or add a `status: "gated"` with tooltip text explaining the Linux requirement. At minimum, the Palette item tooltip or description should mention Linux/systemd.

### P1 — Default scaffold `service: "resolved"` may produce dangling reference

`createDnsServer` always scaffolds `service: "resolved"`. If the user adds the DNS server node before adding a `service:resolved` node, the default is immediately a broken reference. There is no inline "create service" affordance.

**Fix**: Either (a) auto-create a `service:resolved` peer when a `dns-resolved` node is added (if none exists), or (b) scaffold `service: ""` and require the user to select, or (c) add an inline create/jump button in the Inspector service select.

## Implementation Tasks

1. **Inspector**: Add `entityType === "resolved"` branch with:
   - `service` select over existing `service:resolved` tags (required, no empty option or empty = warning state)
   - `accept_default_resolvers` checkbox with behavioral hint text
   - Add both fields to `dnsServerHandledFields`

2. **graph.ts**: Add edge from `dns-server:resolved` to `service:resolved` using the `service` field, mirroring the tailscale endpoint edge pattern.

3. **diagnostics.ts**:
   - Add `resolved-dns-missing-service` error when `service` is absent or empty on a `resolved` DNS server
   - Add `resolved-dns-missing-service-ref` error when `service` tag does not match any `services[type=resolved]`
   - Add `resolved-dns-linux-only` warning for any `dns.servers[type=resolved]` entry

4. **Palette**: Clarify label or add tooltip to indicate Linux/systemd requirement.

5. **commands.ts**: Consider scaffolding `service: ""` instead of `service: "resolved"` to avoid a silent dangling reference on first creation, or auto-create the service peer.

## Done Criteria

- Inspector shows `service` as a typed select and `accept_default_resolvers` as a labeled toggle for `resolved`-type DNS servers.
- Canvas draws an edge from the resolved DNS server node to its `service:resolved` node.
- Diagnostics emit an error for a missing or unresolvable `service` reference.
- Diagnostics emit a Linux/systemd warning for any `resolved` DNS server entry.
- Fixture import of a config with `type: "resolved"` renders, edits, and re-exports correctly.
