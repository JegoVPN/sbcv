<!-- Source: official stable+testing docs/configuration/service/ccm.md (identical); baseline docs/ui-reviews/service-ccm.md; grep audit of Palette, SbcNode, Inspector, sharedFieldRegistry, graph.ts, commands.ts, useProjectStore. -->
<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Service / CCM UI Review

## Scope

- Node ID: `service:ccm`
- Palette kind: `service-ccm`
- Official doc: `service/ccm.md` (stable and testing are identical; since sing-box 1.13.0)
- Source-of-truth rule: canonical sing-box JSON domain state, not React Flow nodes or edges.

## Official Model

Fields declared in the official structure block:

| Field             | Type            | Required | Notes                                      |
|-------------------|-----------------|----------|--------------------------------------------|
| `type`            | string literal  | yes      | `"ccm"`                                    |
| listen fields     | shared block    | yes      | `listen`, `listen_port`, and related       |
| `credential_path` | string          | no       | Defaults to `~/.claude/.credentials.json`  |
| `usages_path`     | string          | no       | Disables usage tracking if omitted         |
| `users`           | array of object | no       | Each item: `{ name: string, token: string }` |
| `headers`         | map string→string | no     | Overrides matching headers sent to Claude API |
| `detour`          | string (tag)    | no       | Outbound tag for Claude API connection     |
| `tls`             | object          | no       | Inbound TLS config                         |

Official field count: **8 top-level fields** (listen block counts as one group).

## Left: Add Library

### What is registered

```
{ label: "CCM", kind: "service-ccm", icon: Server, docsUrl: docs("service/ccm/"), status: "setup" }
```

- Group: "Services"
- Status: `"setup"` — activatable (`canActivate` returns true for `setup`)
- Docs URL: `https://sing-box.sagernet.org/configuration/service/ccm/`
- `ready` flag: not set (status overrides readiness check)

### Findings

- **Correct**: `status: "setup"` is activatable and the docs URL matches the official doc path.
- **P2 icon**: `Server` icon is the same generic icon used for all six Services entries (DERP, Resolved, SSM API, CCM, OCM, Hysteria Realm). No unique icon for CCM.
- **No gating**: CCM is available on all channels (stable, testing). No `itemStatus` channel guard. Correct for a 1.13.0 stable feature.
- `statusTitle("setup", "CCM")` → `"Add CCM setup draft to canvas"` — clear and accurate.

## Middle: Canvas Node

### What is registered

- `SbcNodeKind`: `"service"` (all services share this kind; no per-type kind).
- `subtitle`: `"Claude Code multiplexer"` — from `serviceSubtitle(service)` in `graph.ts:692`.
- `status`: `diagnosticStatus(`/services/${index}`, diagnostics)` — standard path-prefix diagnostic scan.
- `compatible`: `[]` — empty; CCM does not appear in the `compatible` array (only `ssm-api` and `derp` have entries).

### Ports

Output ports (right side) for `kind === "service"` and `type === "ccm"`:

```
{ key: "detour", label: "API detour outbound", nodeKind: "outbound", icon: Network }
```

- Registered in `getPortSpecs` at `SbcNode.tsx:193–195`.
- Port connection logic in `graph.ts:652–653` creates `edge:service-detour:<tag>:<detour>` to `outbound:<detour>`.
- `isPortConnected` at `SbcNode.tsx:356–358` checks `service.detour` existence.
- Toggle port in `useProjectStore.ts:1207–1220` guards `type !== "ccm" && type !== "ocm"` before writing/clearing `detour`.

No input ports for `service-ccm`.

### Findings

- **Correct**: Port semantics match the official `detour` field — one output port to any outbound.
- **P2 subtitle**: `"Claude Code multiplexer"` is accurate but does not show any field summary (e.g., listen address/port, user count). Compare: DERP shows `"tailscale derp service"`. No user-visible dynamic content in the node subtitle.
- **No `compatible` entry**: CCM nodes do not have a `compatible` label. This is correct — CCM does not pair with a specific inbound type.

## Right: Inspector

### What is implemented

The CCM inspector block (`Inspector.tsx:1775–1808`) renders when `entityType === "ccm" || entityType === "ocm"`:

| UI control               | Field              | Kind        | Notes                                    |
|--------------------------|--------------------|-------------|------------------------------------------|
| Text input               | `credential_path`  | text        | Empty string clears to `undefined`       |
| Text input               | `usages_path`      | text        | Empty string clears to `undefined`       |
| Select (outbound tags)   | `detour`           | select      | Populates from `outboundTags(config)`    |
| JsonField textarea       | `users`            | raw JSON    | Default `[]`                             |
| JsonField textarea       | `headers`          | raw JSON    | Default `{}`                             |

Shared field groups wired via `sharedFieldRegistry.ts:158–195`:

- `serviceListenTypes` includes `"ccm"` → `"listen"` group rendered (listen, listen_port, bind_interface, routing_mark, reuse_addr, netns, tcp_fast_open, udp_timeout).
- `serviceTlsTypes` includes `"ccm"` → `"tls"` group rendered.

`serviceHandledFields` (`Inspector.tsx:168–194`) includes: `tag`, `type`, `listen`, `listen_port`, `tls`, `credential_path`, `usages_path`, `users`, `headers`, `detour`, plus `listenSharedFields`. Unknown fields fall through to `AdvancedScalarFields`.

### Default scaffold (commands.ts:510–520)

```json
{
  "type": "ccm",
  "tag": "<generated>",
  "listen": "127.0.0.1",
  "listen_port": 8080,
  "credential_path": "",
  "usages_path": "",
  "users": [],
  "headers": {}
}
```

- Default `listen: "127.0.0.1"` is conservative/safe (local-only). Official example uses `"0.0.0.0"`.
- `detour` and `tls` are intentionally absent from the scaffold — correct, both are optional.
- `credential_path: ""` and `usages_path: ""` are empty strings, not `undefined`. The Inspector clears them to `undefined` on empty input, but the scaffold initializes them as `""` which may serialize to the JSON output unnecessarily.

### Findings

- **Correct**: All five CCM-specific fields (`credential_path`, `usages_path`, `detour`, `users`, `headers`) are exposed.
- **Correct**: `detour` uses a select over `outboundTags(config)` — matches the official tag-reference semantics.
- **Correct**: Listen and TLS shared groups are both wired for CCM.
- **P1 — users textarea**: `users` is a raw JSON textarea (`JsonField`). Official schema requires each item to have `name` (string) and `token` (string). There is no structured repeater, no per-item validation, and no UX affordance to add/remove/reorder users. A user must write raw JSON arrays. This is the same gap flagged in the baseline.
- **P1 — headers textarea**: `headers` is a raw JSON textarea (`JsonField`). Official schema is a `map<string, string>`. There is no key/value pair editor. A user must write a raw JSON object.
- **P2 — scaffold empty strings**: `credential_path: ""` and `usages_path: ""` in the scaffold mean a freshly-created CCM node serializes these as empty strings rather than omitting the fields. If the binary treats `""` differently from absence, this may produce unexpected behavior. The Inspector clears to `undefined` on blur, but only after the user touches the field.
- **P2 — no inline hint for credential_path default**: The official doc explains the platform-specific default path logic (`CLAUDE_CONFIG_DIR`, `~/.claude/.credentials.json`, macOS keychain fallback). The Inspector shows only a plain text input with no placeholder or tooltip.
- **P2 — no user count in subtitle**: The canvas node could show `N users` to give at-a-glance status, similar to how outbound nodes show member counts.

## Priority Findings

### P1

1. **users structured repeater missing**: `users` is currently a raw JSON textarea. The field holds an array of `{ name, token }` objects. A structured repeater with Add/Remove row buttons, a text input for `name`, and a text input for `token` would eliminate JSON syntax errors, enable per-row validation (empty token warning), and match the quality of other list fields.

2. **headers key/value editor missing**: `headers` is a raw JSON textarea. The field holds a `map<string, string>`. A key/value pair editor (Add row, key input, value input, Remove button) would be less error-prone and consistent with other map fields once such a component exists.

### P2

3. **Scaffold empty strings for optional path fields**: `credential_path` and `usages_path` initialize as `""` in the default scaffold instead of being absent. This may serialize unnecessary empty-string fields into the output JSON. Fix: initialize as `undefined` (omit the keys from the scaffold object).

4. **No placeholder/hint for credential_path**: The text input has no placeholder showing the platform default path. A placeholder `~/.claude/.credentials.json` would help users understand when they can leave the field blank.

5. **Canvas subtitle is static**: The node subtitle is always `"Claude Code multiplexer"`. Consider appending `N users` when `users.length > 0` or the listen address/port as a second line.

6. **Generic icon**: `Server` icon is shared by all six service types. A more distinctive icon for CCM (e.g., `Bot` or `KeyRound`) would help users visually distinguish node types on the canvas.

## Implementation Tasks

| Priority | Task | File(s) |
|----------|------|---------|
| P1 | Replace `JsonField` for `users` with a `{name, token}` repeater component | `src/components/Inspector.tsx` |
| P1 | Replace `JsonField` for `headers` with a key/value pair editor component | `src/components/Inspector.tsx` |
| P2 | Change scaffold to omit `credential_path` and `usages_path` (remove empty string init) | `src/domain/commands.ts:516–517` |
| P2 | Add placeholder `~/.claude/.credentials.json` to credential_path input | `src/components/Inspector.tsx` |
| P2 | Extend `serviceSubtitle` to show user count when `users.length > 0` | `src/canvas/graph.ts:685–696` |
| P2 | Assign a distinct icon to `service-ccm` Palette entry | `src/components/Palette.tsx:197` |

## Done Criteria

- Adding CCM from Library creates a node with correct default listen address and no empty-string path fields in the serialized JSON.
- Canvas node subtitle reflects user count or listen address dynamically.
- Inspector users repeater supports Add/Remove rows with `name`/`token` inputs; each row validates non-empty token.
- Inspector headers editor supports Add/Remove key/value rows.
- `credential_path` input shows a platform-default placeholder when empty.
- Detour select correctly reflects all available outbound tags and round-trips to JSON export.
- Listen and TLS shared groups render without regressions.
- Diagnostic status uses path prefix `/services/<index>` matching the service array position.
