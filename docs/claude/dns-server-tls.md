# dns-server:tls UI Review

Node ID: `dns-server:tls` | Palette kind: `dns-tls`
Official doc: `dns/server/tls.md` (since sing-box 1.12.0)

## Official Field Model

The `tls` DNS server type writes to `dns.servers[]` with the following shape:

```json
{
  "type": "tls",
  "tag": "",
  "server": "",          // Required. IP or domain. If domain, domain_resolver required.
  "server_port": 853,    // Optional. Default: 853.
  "tls": {},             // Outbound TLS object. server_name is the key field.
  // + Dial Fields (detour, bind_interface, connect_timeout, domain_resolver, network_strategy, etc.)
}
```

Total official fields: **5 top-level** (`type`, `tag`, `server`, `server_port`, `tls`) plus the full Dial Fields section (~10 dial fields). Stable and testing docs are identical for this node.

Key notes from official docs:
- `server` is **Required**. Domain values require `domain_resolver` in Dial Fields.
- `server_port` defaults to 853; omitting it is valid.
- `tls` is an **outbound** TLS object. `server_name` is strongly recommended for certificate verification.
- `detour` in Dial Fields replaces the legacy `detour` top-level field — the new `tls` type uses the dialer model, not the old `address_resolver`/`address_strategy` pattern.

## Left: Palette

**Current state** (`Palette.tsx:89`):
```
{ label: "TLS Server", kind: "dns-tls", icon: Shield, docsUrl: docs("dns/server/tls/"), status: "setup" }
```

- Label `"TLS Server"` is acceptable but `"DoT Server"` or `"DNS over TLS"` would be more descriptive in context.
- `status: "setup"` is correct — `canActivate` passes `"setup"`, so clicking adds a draft node.
- `docsUrl` points to the correct official page.
- No `ready: true` flag; item uses the "Setup" action label. Consistent with sibling DNS server entries.

No blocking issues in the Palette entry.

## Middle: Canvas Node

**Current state** (`SbcNode.tsx`):

Canvas title renders as `dns-server / tls` (line 382: `${data.kind} / ${data.type}`). This exposes internal kind/type names to the user directly.

**Port layout** for `dns-server` (all types share the same port spec):
- Input ports (left): `dns` ("DNS final server"), `dns-rule` ("DNS rule")
- Output ports (right): `outbound` ("Detour outbound")

The `outbound` output port maps to `detour` in the Dial Fields section (`isPortConnected` at line 337-338 checks `server.detour`). This is correct for the new dialer model.

No `domain_resolver` port exists on the canvas. The `domain_resolver` Dial Field (which resolves the `server` domain) is Inspector-only, which is acceptable since it is a tag reference but less discoverable than a port edge.

## Right: Inspector

**Current state** (`Inspector.tsx`):

`dnsServerHandledFields` (line 142–153) includes `server`, `server_port`, `tls`, and the `dialSharedFields` array. This is correct coverage.

DNS-server branch (line 1548–1604) renders:
- `"server" in entity` guard → plain text `<input>` for `server` field. **Required field, no visual indication of requirement.**
- `"server_port" in entity` guard → `<input type="number">` with `value={Number(entity.server_port ?? 0)}`. **Default fallback is `0` not `853`.**

Shared field groups dispatched by `sharedGroupsForEntity` for `ref.kind === "dns-server"` with `entityType === "tls"`:
- `dnsServerDialTypes` includes `"tls"` (filtered from `CREATABLE_DNS_SERVER_TYPES`, not excluded) → `"dial"` group is appended. Correct.
- `dnsServerTlsTypes = new Set(["tls", "quic", "https", "h3"])` → `"tls"` group is appended. Correct.

TLS shared field definitions (line 894–905) render:
- `tls.enabled` (boolean)
- `tls.server_name` (text) — critical for DoT certificate verification; no required/recommended hint
- `tls.insecure` (boolean)
- `tls.alpn` (list)
- `tls.min_version` / `tls.max_version` (selects)
- `tls.certificate_path` (text)
- `tls.certificate_provider` (text — should be a select from available certificate providers)

Dial shared field definitions (line 881–892) render:
- `detour` (select, outbound options) — correct
- `bind_interface` (text)
- `connect_timeout` (text)
- `domain_resolver` (text) — **P0: must be a tag select, not free text**. When `server` is a domain, the user must pick a resolver tag. Free text allows silent misconfiguration.
- `network_strategy` (select)
- `network_type` / `fallback_network_type` (list)
- `fallback_delay` (text)

## Priority Findings

### P0: `domain_resolver` is a free-text input, not a tag select

- **Location**: `Inspector.tsx` line 886, `sharedFieldDefinitions` group `"dial"`.
- **Issue**: `domain_resolver` must reference a `dns.servers[].tag` value. Rendering it as `kind: "text"` lets users type arbitrary strings that silently produce invalid configs. When `server` contains a domain name (common for DoT like `cloudflare-dns.com`), a missing or wrong `domain_resolver` causes DNS bootstrap failure at runtime.
- **Fix**: Change `domain_resolver` in the dial group to `kind: "select"` with options derived from `config.dns?.servers?.map(s => s.tag).filter(Boolean)`, similar to how `detour` uses `outboundOptions`. Consider also making the canvas `outbound` port display `domain_resolver` as a second output edge type, or at least add a canvas warning when `server` is a domain and `domain_resolver` is unset.

### P0: `server_port` Inspector default shows `0` instead of `853`

- **Location**: `Inspector.tsx` line 1573: `value={Number(entity.server_port ?? 0)}`.
- **Issue**: When a newly created `dns-tls` node has no `server_port` key yet (or it is explicitly cleared), the Inspector shows `0`. The official default is `853`. The `createDnsServer` factory at `commands.ts:609–616` correctly sets `server_port: 853` on creation, so the node will have the value after initial creation. However if a user edits the port to empty or the node is imported without `server_port`, the display shows `0` rather than suggesting `853`.
- **Fix**: Change the fallback: `entity.server_port ?? 853` for the `dns-server` branch. This matches the NTP pattern at line 1305 which uses `entity.server_port ?? 123`.

### P1: `server` field has no required-field indicator

- **Location**: `Inspector.tsx` line 1559–1566 — plain `<label><span>Server</span><input …/></label>`.
- **Issue**: Official docs mark `server` as `==Required==`. An empty `server` field produces a broken DNS server config with no diagnostic. Other nodes that have required fields (e.g., `server` for outbound protocols) also have no indicator, but DoT is particularly sensitive because an empty server silently makes the DNS server non-functional.
- **Fix**: Add a visual required marker (`*` or label class) on the `server` input for `dns-server` nodes that have the `server` field. Optionally emit a canvas node warning status when `server` is empty.

### P1: `tls.certificate_provider` rendered as free text instead of select

- **Location**: `Inspector.tsx` line 903: `{ label: "Certificate Provider", path: ["tls", "certificate_provider"], kind: "text" }`.
- **Issue**: `tls.certificate_provider` is a tag reference to `certificate_providers[].tag`. Rendering it as a text input allows misspellings and does not surface available providers. The correct control is a select derived from `config.certificate_providers?.map(p => p.tag).filter(Boolean)`.
- **Fix**: Promote this field to `kind: "select"` with dynamic options in `sharedFieldDefinitions`. This affects all entities that render the `"tls"` shared group, not just `dns-tls`.

## Implementation Tasks

1. **`domain_resolver` → tag select** (`Inspector.tsx`, `sharedFieldDefinitions` group `"dial"`):
   - Change `kind` from `"text"` to `"select"`.
   - Add `options` callback using `config.dns?.servers` tags (filter out the current entity's own tag).
   - Update `SharedFieldDefinition` type if needed to support dynamic options.

2. **`server_port` fallback** (`Inspector.tsx` line 1573):
   - Change `entity.server_port ?? 0` to `entity.server_port ?? 853` for the `dns-server` render branch.

3. **Required field indicator for `server`** (`Inspector.tsx` line 1559):
   - Add CSS class or `aria-required` attribute to the server input when `ref.kind === "dns-server"` and the entity type has `server` as a required field (`tls`, `quic`, `tcp`, `udp`).
   - Optionally: add a canvas node `status: "error"` state when `server` is empty.

4. **`tls.certificate_provider` → tag select** (`Inspector.tsx` line 903 in `sharedFieldDefinitions`):
   - Thread `config` into the `tls` group case (config is already available in `sharedFieldDefinitions` signature).
   - Build options from `config.certificate_providers?.map(p => p.tag).filter(Boolean) ?? []`.

5. **Canvas node title** (`SbcNode.tsx` line 382):
   - Consider replacing `dns-server / tls` with a human label like `DoT Server` using a lookup table.
   - Low priority — affects all node types, not just this one.

## Done Criteria

- Adding `dns-tls` from Library creates a node with `type: "tls"`, `server: "1.1.1.1"`, `server_port: 853`.
- Inspector shows `server` with a required indicator.
- Inspector shows `server_port` with `853` as default/placeholder.
- `domain_resolver` renders as a select populated from `dns.servers` tags.
- `tls.certificate_provider` renders as a select populated from `certificate_providers` tags.
- Canvas `outbound` port reflects `detour` field state.
- JSON export round-trips correctly; `tls.server_name` survives edit.
