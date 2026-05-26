<!-- Source: stable+testing docs/configuration/service/resolved.md, shared/listen.md, Palette.tsx, SbcNode.tsx, Inspector.tsx, sharedFieldRegistry.ts, diagnostics.ts, commands.ts, graph.ts. Stable and testing docs are identical. -->
<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# service:resolved UI Review

## Scope

- Node kind: `service-resolved` (palette), `service:resolved` (canvas ID prefix)
- Official type value: `"resolved"`
- Canonical sing-box doc: `configuration/service/resolved.md` (stable and testing identical)
- Available since: sing-box 1.12.0
- Platform gate: **Linux / systemd only** — official binary may fail on non-Linux

## Official Model

One object in top-level `services[]`.

```json
{
  "type": "resolved",
  "tag": "<string>",
  "listen": "127.0.0.53",
  "listen_port": 53,
  ... // Listen Fields (shared/listen.md)
}
```

### Official writable fields

| Field | Source | Required | Default |
|---|---|---|---|
| `type` | resolved.md | yes (fixed) | `"resolved"` |
| `tag` | service/index.md | yes | — |
| `listen` | resolved.md + shared/listen.md | yes (doc) | `127.0.0.53` |
| `listen_port` | resolved.md + shared/listen.md | yes (doc) | `53` |
| `bind_interface` | shared/listen.md (1.12.0+) | no | — |
| `routing_mark` | shared/listen.md (1.12.0+, Linux only) | no | — |
| `reuse_addr` | shared/listen.md (1.12.0+) | no | — |
| `netns` | shared/listen.md (1.12.0+, Linux only) | no | — |
| `tcp_fast_open` | shared/listen.md | no | — |
| `tcp_multi_path` | shared/listen.md (Go 1.21+) | no | — |
| `disable_tcp_keep_alive` | shared/listen.md (1.13.0+) | no | — |
| `tcp_keep_alive` | shared/listen.md (1.13.0+) | no | `5m` |
| `tcp_keep_alive_interval` | shared/listen.md | no | `75s` |
| `udp_fragment` | shared/listen.md | no | — |
| `udp_timeout` | shared/listen.md | no | `5m` |
| `detour` | shared/listen.md | no | — |

Total official fields: 16 (excluding `type`/`tag` meta-fields).

Fields NOT present in the official doc for this type: `tls`, `http2`, `quic`, `multiplex`, `v2ray-transport`.

### Relationship model

- `dns.servers[].service` references this service's `tag` — that is the only inbound reference.
- This service is a fake systemd-resolved DBUS service; it has no outbound type-specific peers.
- The paired node `dns-server:resolved` (palette kind `dns-resolved`) writes `dns.servers[].service = <tag>`.

## Current Implementation

### Palette (Palette.tsx:195)

```
{ label: "Resolved", kind: "service-resolved", icon: Server, docsUrl: docs("service/resolved/"), status: "setup" }
```

- Label is correct.
- `status: "setup"` matches the pattern for other service nodes.
- No platform/Linux note in the Palette entry.

### Protocol mapping (protocols.ts:135)

```
"service-resolved": "resolved"
```

Correct; `CREATABLE_SERVICE_TYPES` includes `"resolved"` (line 142).

### createService (commands.ts:479-486)

```typescript
if (type === "resolved") {
  return {
    type,
    tag,
    listen: "127.0.0.53",
    listen_port: 53,
  };
}
```

Correct defaults matching the official doc (`127.0.0.53`, port `53`).

### Canvas subtitle (graph.ts:691)

```typescript
if (service.type === "resolved") return "systemd-resolved service";
```

Accurate and informative.

### Canvas edges (graph.ts:628-666)

The `services.forEach` loop builds:
- `service-detour` edge if `service.detour` is set.
- `service-verify-endpoint` edges for DERP only.
- `service-ssm-inbound` edges for ssm-api only.

No edge is created for the `dns.servers[].service` back-reference from a dns-resolved server to this node. The canvas cannot visually represent the `dns-resolved → service:resolved` relationship.

### Canvas compatible array (graph.ts:645)

```typescript
compatible: service.type === "ssm-api" ? [...] : service.type === "derp" ? [...] : []
```

For `resolved`, `compatible` is `[]` — no drag-to-create hint on the canvas node.

### sharedFieldRegistry (sharedFieldRegistry.ts:158-159)

```typescript
const serviceListenTypes = new Set(["derp", "resolved", "ssm-api", "ccm", "ocm", "hysteria-realm"]);
const serviceTlsTypes = new Set(["derp", "ssm-api", "ccm", "ocm", "hysteria-realm"]);
```

- `resolved` is in `serviceListenTypes` — Inspector will show the `listen` shared group. Correct.
- `resolved` is NOT in `serviceTlsTypes` — Inspector will NOT show a TLS section. Correct (no TLS in official doc).

### Inspector shared listen group (Inspector.tsx:849-859)

The `"listen"` group renders:
- Listen, Listen Port, Bind Interface, Routing Mark, Reuse Address, Network Namespace, TCP Fast Open, UDP Timeout.

Missing from the rendered group vs the official listen fields:
- `tcp_multi_path` (Go 1.21+)
- `disable_tcp_keep_alive` (1.13.0+)
- `tcp_keep_alive` (1.13.0+)
- `tcp_keep_alive_interval`
- `udp_fragment`
- `detour`

These fields are missing from the Inspector listen group for all owners, not resolved-specific.

### Inspector service section (Inspector.tsx:1695-1816)

The `ref.kind === "service"` block has type-specific branches for:
- `ssm-api` — dedicated UI.
- `derp` — dedicated UI.
- `ccm` / `ocm` — dedicated UI.
- `hysteria-realm` — dedicated UI.
- `resolved` — **no dedicated branch**; falls through to `AdvancedScalarFields`.

For `resolved`, the Inspector shows:
1. The shared `listen` group (Listen, Listen Port, Bind Interface, etc.) — correct.
2. `AdvancedScalarFields` for any unhandled scalar fields — spill-through catch-all.

There is no type-specific copy, no platform warning in the Inspector panel, and no "Add Resolved DNS server" action.

### serviceHandledFields (Inspector.tsx:168-195)

`listen` and `listen_port` are in `listenSharedFields` which is spread into `serviceHandledFields`. These are handled by the shared listen group, not as free scalar fields.

### Diagnostic (diagnostics.ts:206-213)

```typescript
if (service.type === "resolved") {
  push(diagnostics, "warning", "resolved-service-linux-only",
    `/services/${index}`,
    "Resolved service is Linux/systemd-specific; official checks may fail on other platforms.");
}
```

P0 platform gate exists and is always-on (`warning` severity). Correct and sufficient.

## Priority Findings

### P0 — Canvas has no edge for dns-resolved → service:resolved

**Severity**: P0  
**Location**: `src/canvas/graph.ts`, dns-server forEach loop (~line 523)  
**Gap**: When a `dns-server` of type `"resolved"` has its `service` field set to a resolved service tag, no canvas edge is created. The official schema relationship (`dns.servers[].service`) is invisible on the canvas. For DERP and Tailscale the analogous connections produce edges; resolved has none.  
**Fix**: In the `dnsServers.forEach` loop, add:
```typescript
if (server.type === "resolved" && server.service) {
  edges.push(makeEdge(
    `edge:dns-server-service:${tag}:${server.service}`,
    id,
    `service:${server.service}`,
    "service",
    "dns-server-service"
  ));
}
```
The corresponding input port on the service node (`kind === "service"`, `type === "resolved"`) should list a `"dns-server-service"` input port so the handle exists.

### P0 — Platform gate already exists (diagnostic)

**Status**: Implemented.  
`resolved-service-linux-only` warning is emitted for every `service.type === "resolved"` entry. No further work needed for the diagnostic itself.

### P1 — No dedicated Inspector UI copy for resolved

**Severity**: P1  
**Location**: `src/components/Inspector.tsx`, `ref.kind === "service"` block (~line 1695)  
**Gap**: There is no `entityType === "resolved"` branch. The user sees only the generic listen fields with no explanation. There is no mention of "Linux/systemd only", no link to the pairing with dns-server:resolved, and no inline "Add Resolved DNS server" action.  
**Fix**: Add a branch:
```tsx
{entityType === "resolved" ? (
  <p className="field-hint">
    Linux / systemd only. This service backs a <strong>Resolved DNS Server</strong>.
  </p>
) : null}
```
Optionally add an "Add Resolved DNS server" button that calls `addDnsServer(config, "resolved")` and sets `service` to this tag.

### P1 — No canvas compatible hint for resolved

**Severity**: P1  
**Location**: `src/canvas/graph.ts` line 645  
**Gap**: `compatible: []` for `resolved` type, so the canvas node shows no drag-to-create affordance. Other service nodes with natural pairings (ssm-api → Shadowsocks Inbound, derp → Tailscale Endpoint) carry a label.  
**Fix**: Add `compatible: service.type === "resolved" ? ["Resolved DNS Server"] : []` (or extend the existing ternary chain).

### P1 — listen group missing five listen fields

**Severity**: P1  
**Location**: `src/components/Inspector.tsx`, `group === "listen"` block (~line 849)  
**Gap**: `tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, `udp_fragment`, `detour` are absent from the rendered field list. This is a shared-group gap affecting all listen owners, not resolved-specific, but it means resolved users cannot configure these fields through the Inspector.  
**Fix**: Add the missing fields to the `"listen"` group definition; apply version annotations for 1.13.0+ fields.

### P2 — No input port spec on service:resolved node for dns-server-service handle

**Severity**: P2  
**Location**: `src/components/SbcNode.tsx`, `kind === "service"` input port branch (~line 119)  
**Gap**: The `kind === "service"` input ports return `[]` for `resolved` type. When the P0 graph edge is added, there will be a handle ID with no corresponding port spec, which will render as a disconnected handle.  
**Fix**: Add to the input ports for `kind === "service"` when `type === "resolved"`:
```typescript
if (type === "resolved") {
  return [{ key: "dns-server-service", label: "Resolved DNS server", nodeKind: "dns-server", nodeType: "resolved", icon: Server }];
}
```

### P2 — DnsServerConfig type lacks `service` field

**Severity**: P2  
**Location**: `src/domain/types.ts`, `DnsServerConfig` (~line 38)  
**Gap**: `DnsServerConfig` does not declare a `service` field. Access to `server.service` in graph.ts or commands.ts would require a cast. The `createDnsServer("resolved", ...)` result hardcodes `service: "resolved"` (commands.ts:670) without type support.  
**Fix**: Add `service?: string` to `DnsServerConfig`.

### P2 — Store has no connect-edge handler for dns-server-service → service:resolved

**Severity**: P2  
**Location**: `src/state/useProjectStore.ts`, edge-drop handling  
**Gap**: The store handles derp-service, tailscale endpoint, and ssm-api managed-inbound edges, but has no branch for `outputNode.kind === "dns-server" && outputHandle === "service" && inputNode.kind === "service" && inputHandle === "dns-server-service"`. Dragging a dns-resolved server onto a resolved service would not write `dns.servers[].service`.  
**Fix**: Add a store branch to call `updateEntityField(config, { kind: "dns-server", tag: outputNode.value }, "service", inputNode.value)`.

## Implementation Tasks

1. **Add `service` field to `DnsServerConfig`** in `src/domain/types.ts`. (P2 — prerequisite for all below.)

2. **Add canvas edge for dns-resolved → service:resolved** in `src/canvas/graph.ts` inside the `dnsServers.forEach` loop. (P0)

3. **Add input port spec on service node for `resolved` type** in `src/components/SbcNode.tsx` input ports branch. (P2 — required for edge to render)

4. **Add store edge-drop handler** for `dns-server-service → service:resolved` in `src/state/useProjectStore.ts`. (P2)

5. **Add `entityType === "resolved"` Inspector branch** with platform copy and optional "Add Resolved DNS server" action in `src/components/Inspector.tsx`. (P1)

6. **Add `compatible` hint for resolved** on the canvas node in `src/canvas/graph.ts`. (P1)

7. **Complete the listen group** with missing fields (`tcp_keep_alive`, `disable_tcp_keep_alive`, `tcp_keep_alive_interval`, `udp_fragment`, `detour`) in the Inspector shared group definition. (P1 — shared, affects all listen owners)

## Done Criteria

- Adding `service-resolved` from Palette creates `services[]` entry with `listen: "127.0.0.53"` and `listen_port: 53`.
- Canvas shows a directed edge from a `dns-server:resolved` node to the `service:resolved` node when `dns.servers[].service` is set.
- Dragging a dns-resolved server onto the resolved service node writes `dns.servers[].service`.
- Inspector shows a Linux-only warning for type `resolved`.
- `resolved-service-linux-only` diagnostic fires on all resolved service entries.
- No TLS, HTTP/2, or QUIC shared sections appear in the resolved service Inspector.
- Export round-trips: import → render → edit `listen` / `listen_port` → export preserves correct values.
