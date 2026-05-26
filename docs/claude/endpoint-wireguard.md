# endpoint-wireguard UI Review

<!-- Source: official stable/testing wireguard.md (identical), endpoint/index.md, baseline docs/ui-reviews/endpoint-wireguard.md, grep of Palette / Inspector / SbcNode / sharedFieldRegistry / graph.ts / commands.ts / diagnostics.ts. -->

## Official Field Inventory (stable == testing, since 1.11.0)

| Field | Required | Type | Notes |
|---|---|---|---|
| `type` | yes | `"wireguard"` | constant |
| `tag` | yes | string | endpoint tag |
| `system` | no | boolean | use system TUN interface; default false |
| `name` | no | string | custom interface name (only when system=true) |
| `mtu` | no | number | default 1408 |
| `address` | **yes** | string[] | CIDR prefixes assigned to interface |
| `private_key` | **yes** | string | base64, secret |
| `listen_port` | no | number | local UDP listen port |
| `peers` | **yes** | object[] | see peers sub-fields below |
| `udp_timeout` | no | duration string | UDP NAT expiry; default "5m" |
| `workers` | no | number | default = CPU count |
| *(Dial Fields)* | no | object | detour, bind_interface, connect_timeout, domain_resolver, network_strategy, network_type, fallback_network_type, fallback_delay |

### peers[] sub-fields

| Field | Required | Type | Notes |
|---|---|---|---|
| `peers[].address` | no | string | peer server address |
| `peers[].port` | no | number | peer server port |
| `peers[].public_key` | **yes** | string | base64 |
| `peers[].pre_shared_key` | no | string | base64, secret |
| `peers[].allowed_ips` | **yes** | string[] | CIDR list |
| `peers[].persistent_keepalive_interval` | no | number | seconds; 0 = disabled |
| `peers[].reserved` | no | [number,number,number] | 3-byte array |

Total official fields: 18 (7 top-level wireguard-specific + Dial block + 7 peer sub-fields).

---

## Current Implementation

### Palette (`src/components/Palette.tsx:124`)

```
{ label: "WireGuard", kind: "endpoint-wireguard", icon: Waypoints,
  docsUrl: docs("endpoint/wireguard/"), status: "setup" }
```

- `status: "setup"` renders an `ADD` button that calls `addEndpoint("wireguard")`.
- `docsUrl` links to the correct official page.
- Label reads "WireGuard" — correct.

### Default scaffold (`src/domain/commands.ts:547-565`)

`createEndpoint("wireguard", tag)` produces:

```json
{
  "type": "wireguard", "tag": "<generated>",
  "system": false, "name": "wg0", "mtu": 1408,
  "address": ["172.16.0.2/32"],
  "private_key": "<placeholder base64>",
  "peers": [{ "address": "127.0.0.1", "port": 51820,
              "public_key": "<placeholder base64>",
              "allowed_ips": ["0.0.0.0/0"] }],
  "udp_timeout": "5m"
}
```

Missing from scaffold: `listen_port`, `workers` (acceptable — optional).
`pre_shared_key`, `persistent_keepalive_interval`, `reserved` absent (optional).

### Canvas Node (`src/canvas/graph.ts`, `src/components/SbcNode.tsx`)

- Subtitle: `wireguard <address[0], address[1], ...>` or `"wireguard endpoint"` — correct.
- `compatible: []` for wireguard endpoint — no auto-connect pill shown. Tailscale endpoint gets a DNS-server compatible badge; wireguard gets none. Consistent with wireguard not being a target of any upstream reference.
- Right output port: `"dial-detour"` → `Dial detour outbound` (SbcNode.tsx:175). Correct.
- Left input ports: `[]` for non-tailscale endpoint (SbcNode.tsx:95-102). Wireguard endpoint has no upstream callers tracked on-canvas. This is technically correct because no sing-box object holds a wireguard endpoint tag reference — WireGuard traffic is self-contained. However, an outbound `wireguard` type (kind `wireguard-out`) shares the same `type: "wireguard"` value; these are distinct objects and must not be confused.

### Inspector (`src/components/Inspector.tsx:1628-1657`)

Fields rendered for `entityType === "wireguard"`:

| UI Label | Field | Control | Notes |
|---|---|---|---|
| Address | `address` | text `<input>` via `toList/fromList` | comma-separated string; no CIDR validation |
| Private Key | `private_key` | text `<input>`, plain visible | **no password masking** |
| Peers JSON | `peers` | `<textarea>` raw JSON | **no structured repeater** |

`endpointHandledFields` (`Inspector.tsx:154`) lists `address`, `private_key`, `peers`, `detour` — so `system`, `name`, `mtu`, `listen_port`, `workers`, `udp_timeout` fall into `AdvancedScalarFields` (fallback key-value editor).

Dial fields rendered via shared `"dial"` group (sharedFieldRegistry.ts:189-191): all endpoint kinds receive the `"dial"` group, which exposes `detour`, `bind_interface`, `connect_timeout`, `domain_resolver`, `network_strategy`, `network_type`, `fallback_network_type`, `fallback_delay`.

Reference summary card (Inspector.tsx:1607-1625): shows `tailscaleDnsServers`, `derpServices`, `certificateProviders`. None of these are relevant to a wireguard endpoint (they are Tailscale-specific). The card is unconditional for all `ref.kind === "endpoint"` nodes and will show "none" for all three rows on a wireguard endpoint — harmless but noisy.

### Semantic Diagnostics (`src/domain/diagnostics.ts:111-121`)

Only one check for endpoints: `missing-endpoint-detour` — detour tag must exist in outbounds if set. No wireguard-specific checks:

- No check for required `address[]` being empty.
- No check for required `private_key` being empty/placeholder.
- No check for required `peers[]` being empty.
- No check that each peer has a non-empty `public_key`.
- No check that each peer has a non-empty `allowed_ips[]`.

### TypeScript types (`src/domain/types.ts:47-51`)

`EndpointConfig` only declares `detour?`, `address?`, `private_key?`. Fields `peers`, `system`, `name`, `mtu`, `listen_port`, `udp_timeout`, `workers` are absent (resolved via `[key: string]: unknown` but lose static type safety).

---

## Priority Findings

### P0

*(No P0 found — the node is functional end-to-end: add, canvas render, basic inspector edit, JSON export all work.)*

### P1

**P1-1 — peers[] rendered as raw JSON textarea (no structured repeater)**

`Inspector.tsx:1644-1656` uses a `<textarea>` showing `JSON.stringify(entity.peers)`. Users must hand-edit JSON to add/remove peers, change IPs, or rotate keys. Each peer has 7 official fields including nested CIDR arrays. This is the highest-priority UX gap for this node.

Required: a repeater component that shows one card per peer with labelled inputs for `address`, `port`, `public_key` (masked), `pre_shared_key` (masked), `allowed_ips` (CIDR repeater), `persistent_keepalive_interval`, `reserved`.

**P1-2 — `private_key` rendered as plain-text input (no masking)**

`Inspector.tsx:1639-1641`: `<input value={String(entity.private_key ?? "")} ...>`. A WireGuard private key is a secret. The field should use `type="password"` with a show/hide toggle, matching the treatment of credentials in other nodes (e.g. outbound user tokens).

**P1-3 — `address[]` rendered as comma-string input (no CIDR repeater)**

`Inspector.tsx:1632-1635`: address is a free-text CSV via `toList/fromList`. The field must accept CIDR prefixes (e.g. `172.16.0.2/32`, `fd00::2/128`). There is no format hint, no validation, and no add/remove UI per prefix. A CIDR tag-input or multi-input control (same as needed for `peers[].allowed_ips`) would prevent silent malformation.

### P2

**P2-1 — Missing semantic diagnostics for required wireguard fields**

`diagnostics.ts` has zero wireguard-specific checks. The following semantic errors should be raised:

| Condition | Severity | Suggested code |
|---|---|---|
| `address` is empty or `[]` | error | `wireguard-missing-address` |
| `private_key` is empty string | error | `wireguard-missing-private-key` |
| `peers` is empty or `[]` | error | `wireguard-missing-peers` |
| any peer missing `public_key` | error | `wireguard-peer-missing-public-key` |
| any peer missing `allowed_ips` | error | `wireguard-peer-missing-allowed-ips` |

**P2-2 — Reference card shows Tailscale-only rows for wireguard endpoint**

`Inspector.tsx:1607-1625`: the "Connections" reference card shows `tailscaleDnsServers`, `derpServices`, `certificateProviders` for every endpoint kind. For `wireguard` all three will always read "none". Either gate the card on `entityType === "tailscale"` or add a wireguard-specific set of connections (currently none exist, so the card can be hidden entirely for wireguard).

**P2-3 — `EndpointConfig` TypeScript type is incomplete**

`types.ts:47-51` lacks `peers`, `system`, `name`, `mtu`, `listen_port`, `udp_timeout`, `workers`. Without typed fields, editor autocomplete and refactor safety are degraded. Should add:

```ts
export type WireGuardPeer = {
  address?: string;
  port?: number;
  public_key?: string;
  pre_shared_key?: string;
  allowed_ips?: string[];
  persistent_keepalive_interval?: number;
  reserved?: [number, number, number];
};

export type EndpointConfig = TaggedConfig & {
  detour?: string;
  address?: string[];
  private_key?: string;
  system?: boolean;
  name?: string;
  mtu?: number;
  listen_port?: number;
  udp_timeout?: string;
  workers?: number;
  peers?: WireGuardPeer[];
};
```

**P2-4 — `peers[].pre_shared_key` not masked in future repeater**

When P1-1 is implemented the repeater must render `pre_shared_key` with `type="password"` + show/hide, matching `private_key` treatment.

**P2-5 — `listen_port` and `workers` live in AdvancedScalarFields**

`listen_port` and `workers` are not in `endpointHandledFields`, so they fall through to `AdvancedScalarFields` as freeform text. `listen_port` should be a `type="number"` input and `workers` similarly. Moving them to the primary section would also clarify the system-interface workflow (`system: true` + `name` + `listen_port`).

---

## Canvas Port Audit

| Direction | Port key | Target kind | Wired in graph.ts? | Correct? |
|---|---|---|---|---|
| Right (output) | `dial-detour` | outbound | yes — `edge:endpoint-detour:…` | yes |
| Left (input) | *(none)* | — | no incoming edges for wireguard | yes — no sing-box object references a wireguard endpoint by tag |

WireGuard endpoint is not referenced by any upstream object (unlike Tailscale endpoint which is referenced by `dns-server.tailscale` via `endpoint` field). Left port array is correctly empty.

---

## Dial Fields Coverage

`sharedFieldRegistry.ts:189-191` applies `"dial"` group to all `CREATABLE_ENDPOINT_TYPES` (`["wireguard", "tailscale"]`). The official WireGuard endpoint doc confirms Dial Fields are supported. Coverage is correct. `detour` is in `endpointHandledFields` so it is explicitly managed (not dumped into AdvancedScalarFields).

---

## Implementation Tasks

1. **[P1-1]** Add `WireGuardPeersRepeater` component. Each row: address (text), port (number), public_key (password+toggle), pre_shared_key (password+toggle, optional), allowed_ips (CIDR tag-input), keepalive (number, optional), reserved (3-number tuple, optional, hidden unless set). Replace the `<textarea>` at Inspector.tsx:1644-1656.

2. **[P1-2]** Change `private_key` input at Inspector.tsx:1639-1641 to `type="password"` with a show/hide toggle button.

3. **[P1-3]** Replace the `address` CSV input at Inspector.tsx:1632-1635 with a CIDR tag-input (add/remove per prefix, same component as `peers[].allowed_ips`).

4. **[P2-1]** Add wireguard-specific diagnostics to `diagnostics.ts` in the `endpoints.forEach` block (after the existing `missing-endpoint-detour` check): validate `address`, `private_key`, `peers`, `peer.public_key`, `peer.allowed_ips`.

5. **[P2-2]** Gate the endpoint reference card on `entityType === "tailscale"` (or show a wireguard-appropriate empty state), so wireguard users don't see three "none" rows.

6. **[P2-3]** Expand `EndpointConfig` in `types.ts` with all wireguard fields and add `WireGuardPeer` type.

7. **[P2-5]** Move `listen_port` and `workers` into `endpointHandledFields` and render them as number inputs in the wireguard section, grouped with `system`, `name`, `mtu`, and `udp_timeout` into an "Interface Settings" sub-section.

---

## Done Criteria

- Adding endpoint-wireguard from Palette produces a scaffolded node with required fields populated.
- Inspector peers section is a structured repeater (add/remove peer rows, per-field inputs).
- `private_key` and `peers[].pre_shared_key` fields use password masking.
- `address` and `peers[].allowed_ips` use CIDR tag-input with per-item add/remove.
- Semantic diagnostics flag empty `address`, empty `private_key`, empty `peers`, and peers missing `public_key` or `allowed_ips`.
- Reference card is hidden (or wireguard-relevant) for wireguard endpoint.
- `detour` edge on canvas connects to the correct outbound node.
- Fixture round-trip: import a JSON with a wireguard endpoint, inspect, edit a peer IP, export — JSON matches expected shape.
