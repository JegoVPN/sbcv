<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Outbound / http — Deep UI Review

> Source: official stable + testing docs (identical for this node), Palette.tsx, Inspector.tsx, sharedFieldRegistry.ts, SbcNode.tsx, commands.ts, diagnostics.ts.
> Review date: 2026-05-27.

---

## Official Field Inventory

**Stable == Testing** — both versions have the same HTTP outbound structure.

### Protocol-specific fields (6)

| Field | Type | Required | Notes |
|---|---|---|---|
| `server` | string | **Yes** | Proxy server address. |
| `server_port` | uint16 | **Yes** | Proxy server port. |
| `username` | string | No | Basic authorization username. |
| `password` | string | No | Basic authorization password. |
| `path` | string | No | Path of HTTP request. |
| `headers` | map[string]string | No | Extra headers of HTTP request. Object with string values. |

### Shared TLS Fields (via shared/tls.md — Outbound shape)

`"http"` is in `outboundTlsTypes` (`sharedFieldRegistry.ts` line 151). TLS group is enabled.

| Field | Notes |
|---|---|
| `tls.enabled` | Enable TLS (HTTPS CONNECT). |
| `tls.server_name` | SNI override. |
| `tls.insecure` | Skip cert verification. |
| `tls.alpn[]` | ALPN list. |
| `tls.min_version` / `tls.max_version` | TLS 1.0–1.3. |
| `tls.certificate_path` | CA certificate path. |
| `tls.certificate_provider` | Certificate provider tag. |
| (many more outbound TLS fields) | See shared/tls.md outbound section for full list. |

### Shared Dial Fields (via shared/dial.md)

`"http"` is in `outboundDialTypes` (all non-block/dns/selector/urltest outbounds, line 150). Dial group is enabled.

| Field | Notes |
|---|---|
| `detour` | Upstream outbound tag (select). |
| `bind_interface` | Network interface to bind. |
| `connect_timeout` | Dial timeout. |
| `domain_resolver` | DNS resolver tag. |
| `network_strategy` | `default` / `hybrid` / `fallback`. |
| `network_type` | Network type filter list. |
| `fallback_network_type` | Fallback network type list. |
| `fallback_delay` | Duration string. |

**Total official fields: 6 protocol-specific + 8 TLS (active subset shown in UI) + 8 dial = 22 tracked fields.**

---

## Left Panel — Palette (Add Library)

**Current state** (`Palette.tsx` line 157):
```ts
{ label: "HTTP", kind: "http-out", icon: Globe2, docsUrl: docs("outbound/http/"), status: "setup" }
```

**Palette kind mapping** (`protocols.ts` line 5):
```ts
"http-out": "http"
```

**Default template** (`commands.ts` line 282–291):
```ts
if (type === "http") {
  return {
    type,
    tag,
    server: "127.0.0.1",
    server_port: 1080,
    username: "user",
    password: "change-me",
  };
}
```

### Findings

- Label `"HTTP"` is correct.
- `status: "setup"` means the Palette item renders a non-clickable status badge instead of a functional ADD action. No drag-to-canvas or click-to-create is available from the Palette.
- `icon: Globe2` is shared with HTTP inbound, HTTP DNS servers, and HTTP Clients — no semantic differentiation between inbound/outbound/dns roles.
- Docs URL `docs("outbound/http/")` points to the correct location.
- Default template includes `username` and `password` but not `path`, `headers`, or `tls`. This is reasonable for a minimal template, but `path` and `headers` have no UI path at all (see Inspector gaps below).

---

## Middle Panel — Canvas Node

**Canvas node kind:** `"outbound"` (SbcNode.tsx).

### Port Specification

**Input ports (left side) — 7 ports, all outbound nodes:**
```
route          → Upstream Route final
route-rule     → Upstream Rule outbound
selector-group → Upstream Selector candidate
urltest-group  → Upstream URLTest candidate
dns-detour     → Upstream DNS detour target
detour-target  → Upstream Dial detour target
service-detour → Upstream service detour target
rule-set-download → Upstream Rule Set download detour
```

**Output ports (right side) — for non-selector/urltest outbounds that support dial detour:**
```
dial-detour → Downstream dial detour
```

`"http"` is not in the excluded set (`["block", "selector", "urltest", "dns"]`), so both input and the `dial-detour` output port are correctly available.

### Findings

- Port spec is correct. HTTP CONNECT proxies can chain via `detour` to another outbound and that relationship is properly represented on both left (`detour-target`) and right (`dial-detour`) ports.
- Canvas titlebar shows `"outbound / http"` (kind + type), which is accurate.
- Canvas node icon is `Shield` for all non-special outbound types (line 47). HTTP shares this with most proxy protocols — acceptable since there is no universal HTTP-specific icon but the UX is generic.
- The node summary shows `data.title` (tag) and `data.subtitle`. No display of `server:server_port` on the canvas node, making it hard to identify which proxy an HTTP outbound points to at a glance.
- The bottom toolbar shows `type` pill and `status` pill but the status reflects generic semantic validity, not HTTP-specific checks (e.g. missing `server` field). This is a systemic gap, not HTTP-specific.

---

## Right Panel — Inspector

### What the inspector provides for `ref.kind === "outbound"`

From `Inspector.tsx` lines 1505–1546:

1. **Tag** rename input.
2. **Type** select from `CREATABLE_OUTBOUND_TYPES`.
3. **Server** text input, shown when `"server" in entity` (line 1507).
4. **Port** number input, shown when `"server_port" in entity` (line 1516).
5. **Candidates** text input for `outbounds[]` (selector/urltest only, line 1526).
6. **Default** text input for `default` (urltest only, line 1535).
7. **AdvancedScalarFields** — spills any non-handled scalar field (line 1544).
8. **SharedFieldCards** — renders Dial and TLS sections as collapsible module cards.

### `outboundHandledFields` set (line 128–141)

```ts
const outboundHandledFields = new Set([
  "tag", "type",
  "server", "server_port",
  "outbounds", "default",
  "tls", "multiplex", "transport", "udp_over_tcp",
  ...dialSharedFields,  // detour, bind_interface, connect_timeout, domain_resolver,
                        // network_strategy, network_type, fallback_network_type, fallback_delay
  ...quicSharedFields,  // initial_packet_size, disable_path_mtu_discovery, idle_timeout, keep_alive_period
]);
```

### Gap analysis for HTTP outbound

| Field | Expected UI | Actual |
|---|---|---|
| `server` | First-class text input | **Present** — rendered when `"server" in entity`. |
| `server_port` | First-class number input | **Present** — rendered when `"server_port" in entity`. |
| `username` | Dedicated text input (auth section) | **Not in `outboundHandledFields`** — `username` is a string so it falls through to `AdvancedScalarFields` as a generic unlabeled text field. |
| `password` | Dedicated password/text input (auth section) | **Not in `outboundHandledFields`** — same as `username`, appears in `AdvancedScalarFields` as a generic unlabeled text field. Rendered as plain `type="text"`, not `type="password"`. |
| `path` | Text input | **Not in `outboundHandledFields`** — `path` is a string, appears in `AdvancedScalarFields` if present in the entity. Absent from the default template, so it will be invisible for a freshly created node. |
| `headers` | Map repeater or JSON textarea | **Not in `outboundHandledFields`** — `headers` is an object (not a scalar), so `AdvancedScalarFields` **silently drops it**. There is no `headers` display for the HTTP outbound inspector. |
| `tls` | Shared TLS card | **Correctly handled** — `"http"` is in `outboundTlsTypes`; TLS card is shown. |
| Dial fields | Shared Dial card | **Correctly handled** — `"http"` is in `outboundDialTypes`; Dial card is shown. |

### Template vs. Inspector consistency

The default template (`commands.ts`) creates:
```json
{ "type": "http", "tag": "...", "server": "127.0.0.1", "server_port": 1080, "username": "user", "password": "change-me" }
```

When this template is rendered in the Inspector:
- `server` and `server_port` appear as first-class inputs.
- `username` and `password` appear in `AdvancedScalarFields` under "Advanced fields (2)" — visible but not labeled with their semantic meaning ("Basic Auth Username", "Basic Auth Password"), not ordered with server fields, and rendered as plain text inputs without the `type="password"` attribute.

### SharedFieldCards — TLS group

The TLS shared card (lines 895–904) exposes 8 fields for outbound:
`tls.enabled`, `tls.server_name`, `tls.insecure`, `tls.alpn`, `tls.min_version`, `tls.max_version`, `tls.certificate_path`, `tls.certificate_provider`.

For HTTP CONNECT with TLS (HTTPS proxy), the relevant missing outbound TLS fields include:
- `tls.certificate[]` (inline PEM for custom CA)
- `tls.utls{}` (uTLS fingerprint — testing channel only)
- `tls.ech{}` (ECH client — testing channel only)

These are less critical for outbound than for inbound but represent completeness gaps.

### Diagnostics gap

`diagnostics.ts` validates tag references (selector/urltest candidates, detour) but has no check for:
- Missing `server` on `type === "http"` outbound (required field).
- Missing `server_port` on `type === "http"` outbound (required field).

A created-then-cleared `server` field produces an invalid config with no error diagnostic.

---

## Priority Findings

### P0 — `headers` object is silently invisible

`headers` is a `map[string]string` (plain JSON object). It is not in `outboundHandledFields` and `AdvancedScalarFields` skips non-scalar types. For any imported config with `"headers": {"X-Foo": "bar"}` the field is **entirely invisible** in the Inspector and will be **preserved on export only if the user never edits the entity** (the store holds the original object). The moment any field on the entity is updated via `updateField`, the `headers` key survives because `updateField` does a shallow patch — but there is no way to view or modify it.

**Resolution required:** Add a `JsonField` labeled "Extra Headers" gated on `ref.kind === "outbound" && entityType === "http"` and add `"headers"` to `outboundHandledFields`.

Longer term: implement a key-value repeater so each header can be added/removed without raw JSON editing.

### P0 — Missing required-field diagnostics for `server` and `server_port`

The HTTP outbound spec marks `server` and `server_port` as **Required**. `diagnostics.ts` has no validation for these on `type === "http"` (or any outbound type with server). A user can clear `server` to an empty string via the Inspector and the config will export as invalid JSON with no error badge.

**Resolution required:** Add to `diagnostics.ts` `outbounds.forEach` loop:
```ts
if (["http", "socks", "shadowsocks", "vmess", "trojan", "vless", "tuic", "hysteria", "hysteria2", "naive", "anytls", "ssh"].includes(outbound.type)) {
  if (!outbound.server) {
    push(diagnostics, "error", "missing-outbound-server", `/outbounds/${index}/server`,
      `Outbound "${outbound.tag}" (${outbound.type}) requires a server address.`);
  }
  if (!outbound.server_port) {
    push(diagnostics, "error", "missing-outbound-server-port", `/outbounds/${index}/server_port`,
      `Outbound "${outbound.tag}" (${outbound.type}) requires a server port.`);
  }
}
```

### P1 — `username` and `password` land in AdvancedScalarFields without semantic labeling

`username` and `password` appear in the generic "Advanced fields (N)" accordion because they are not in `outboundHandledFields`. They are rendered as plain `<input type="text">` fields with auto-derived labels ("Username", "Password") but without:
- Visual grouping under a "Basic Auth" section.
- Semantic separation from unrelated scalar fields like protocol-specific options.
- `type="password"` for the password field.

A new user editing credentials for an HTTP proxy must expand the Advanced accordion to find them, which is non-obvious.

**Resolution required:** Add an explicit auth section in the outbound inspector block, gated on `entityType === "http"`:
```tsx
{entityType === "http" ? (
  <>
    <div className="inspector-section-title">Basic Auth</div>
    <label className="field">
      <span>Username</span>
      <input value={String(entity.username ?? "")}
        onChange={(e) => updateField(ref, "username", e.target.value || undefined)} />
    </label>
    <label className="field">
      <span>Password</span>
      <input type="password" value={String(entity.password ?? "")}
        onChange={(e) => updateField(ref, "password", e.target.value || undefined)} />
    </label>
  </>
) : null}
```

Add `"username"` and `"password"` to `outboundHandledFields`.

### P1 — `path` field not surfaced for freshly created nodes

`path` is an optional HTTP request path string. It is absent from the default template, so for a new node it is not in the entity and `AdvancedScalarFields` will not show it (only shows fields that **exist** in the entity object). For imported configs with `path` set it will appear in `AdvancedScalarFields` as a plain text input — inconsistent behavior depending on import vs. create workflow.

**Resolution required:** Add explicit `path` control in the inspector block for `entityType === "http"` (alongside the auth section), and add `"path"` to `outboundHandledFields`. The default template can remain without `path` (it is optional) but the inspector must always show the control.

---

## Implementation Tasks

### Task 1 — Expose `headers` as JSON field (P0)

**File:** `src/components/Inspector.tsx`

1. Add `"headers"` to `outboundHandledFields` (line 128).
2. In the `ref.kind === "outbound"` block (line 1505), add after the existing server/port inputs and before `AdvancedScalarFields`:

```tsx
{entityType === "http" ? (
  <JsonField
    label="Extra Headers"
    value={entity.headers ?? {}}
    onChange={(value) => updateField(ref, "headers", value)}
  />
) : null}
```

Long-term: replace with a key-value repeater component.

### Task 2 — Add required-field diagnostics for server/server_port (P0)

**File:** `src/domain/diagnostics.ts`

In the `outbounds.forEach` loop (after line 95), add a server-required check for proxy-type outbounds. See P0 code sketch above. The type list should include at minimum: `http`, `socks`, `shadowsocks`, `vmess`, `trojan`, `vless`, `tuic`, `hysteria`, `hysteria2`, `naive`, `anytls`, `ssh`.

### Task 3 — Add explicit Basic Auth section for HTTP outbound (P1)

**File:** `src/components/Inspector.tsx`

1. Add `"username"` and `"password"` to `outboundHandledFields`.
2. In the `ref.kind === "outbound"` block, add the auth section gated on `entityType === "http"` as shown in P1 resolution above. Use `type="password"` for the password input.
3. Place the section between the Port input and `AdvancedScalarFields`.

### Task 4 — Expose `path` field for HTTP outbound (P1)

**File:** `src/components/Inspector.tsx`

1. Add `"path"` to `outboundHandledFields`.
2. In the `ref.kind === "outbound"` block, add after the auth section (or within it) for `entityType === "http"`:

```tsx
{entityType === "http" ? (
  <label className="field">
    <span>Request Path</span>
    <input
      value={String(entity.path ?? "")}
      onChange={(e) => updateField(ref, "path", e.target.value || undefined)}
      placeholder="optional, e.g. /"
    />
  </label>
) : null}
```

### Task 5 — Upgrade Palette status (P1)

**File:** `src/components/Palette.tsx` line 157

Change `status: "setup"` to `ready: true` once tasks 1–4 are complete and the node round-trips correctly.

### Task 6 — Display server:port on canvas node subtitle (P1)

**File:** canvas graph builder (wherever `data.subtitle` is set for outbound nodes)

For `type === "http"` (and other proxy outbounds with `server`), set `subtitle` to `"${server}:${server_port}"` so the canvas node displays the destination at a glance, matching the pattern used by other connection-oriented tools.

---

## Done Criteria

- `headers` object is visible and editable as a JSON field in the Inspector for `type === "http"` outbound.
- `username` and `password` appear in a labeled "Basic Auth" section, not in the generic Advanced accordion.
- `password` field uses `type="password"` rendering.
- `path` field is always shown for HTTP outbound, regardless of whether it is present in the imported entity.
- Semantic diagnostics fire an `"error"` level finding when `server` or `server_port` is empty on an HTTP outbound.
- `tls.enabled` toggle in the TLS shared card correctly enables/disables TLS fields for HTTPS proxy mode.
- Round-trip test: import `{ type: "http", tag: "http-out", server: "proxy.example.com", server_port: 8080, username: "u", password: "p", path: "/connect", headers: {"X-Token": "abc"}, tls: { enabled: true } }`, verify all fields visible in Inspector, edit tag, export JSON, check all fields preserved.
