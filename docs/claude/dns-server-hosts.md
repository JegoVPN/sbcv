<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# DNS Server / Hosts UI Review

## Scope

- Node ID: `dns-server:hosts`
- Palette kind: `dns-hosts` (`protocols.ts` line 93)
- Canvas / Inspector kind: `dns-server`, type `hosts`
- Official docs:
  - stable: `docs/configuration/dns/server/hosts.md` (Since sing-box 1.12.0)
  - testing: same file, adds 1.14.0 rule example variant
  - common: `docs/configuration/dns/server/index.md`
- This node writes one entry in `dns.servers[]` with `type: "hosts"`.
- Review shape: Left Add Library, Middle Canvas Node, Right Inspector.

---

## Official Model

### Common DNS server fields (index.md, sing-box 1.12.0+)

| Field | Type | Notes |
|---|---|---|
| `type` | `string` | `"hosts"` for this node. Required. |
| `tag` | `string` | Identifies the server for references in `dns.rules[].server` and `dns.final`. |

### Hosts-specific fields

| Field | Type | Notes |
|---|---|---|
| `path` | `string \| string[]` | List of paths to hosts files. Defaults to `/etc/hosts` (or Windows equivalent). Single string accepted; array preferred. |
| `predefined` | `Record<string, string \| string[]>` | Inline domain-to-IP map. Each value is a single IP string or an array of IP strings (for dual-stack). |

**Total official fields: 4** (`type`, `tag`, `path`, `predefined`).

No dial/detour fields are valid on `hosts` type. `sharedFieldRegistry.ts` line 156 explicitly excludes `hosts` from `dnsServerDialTypes`.

---

## Left: Add Library

Current state (Palette.tsx line 86):
```
{ label: "Hosts Server", kind: "dns-hosts", icon: Server, docsUrl: docs("dns/server/hosts/"), status: "setup" }
```

Findings:

- Label "Hosts Server" is clear and correct.
- `docsUrl` points to `dns/server/hosts/` — matches official doc path.
- `status: "setup"` is acceptable; the node is a singleton resource type, not a table row.
- No issues with the Palette entry.

---

## Middle: Canvas Node

Kind `dns-server` uses generic port logic in `SbcNode.tsx`:

- **Input ports** (lines 88–93): `dns` (DNS final server), `dns-rule` (DNS rule). Both are correct — a hosts server can be the `dns.final` target or the `server` of a DNS rule.
- **Output ports** (lines 170–174): `outbound` (Detour outbound). Hosts type has no dial capability and the dial-excluded guard exists in `sharedFieldRegistry.ts`, but the port still renders. This is a cosmetic issue: the detour port appears even though hosts never accepts a `detour` field.

No hosts-specific canvas rendering exists; the node renders as a generic `dns-server` node.

---

## Right: Inspector

### Tag field

Rendered via shared tag input at the top of the `dns-server` branch (Inspector.tsx ~line 1200). Correct.

### Type field

Rendered via shared type select. Correct; switching away from `hosts` would lose `path`/`predefined` state but that is an existing concern across all type switching, not hosts-specific.

### `path` field (Inspector.tsx lines 1578–1586)

```tsx
{"path" in entity ? (
  <label className="field">
    <span>Path</span>
    <input
      value={String(entity.path ?? "")}
      onChange={(event) => updateField(ref, "path", event.target.value)}
    />
  </label>
) : null}
```

**P0 — Scalar string input for an array field.** The official `path` field is `string | string[]`. The creation default (commands.ts line 598) writes a plain string `"/etc/hosts"`, so the single-input works for the default case. However:

1. `String(entity.path ?? "")` silently coerces an array to `"path1,path2"` (JavaScript Array.toString), which is not valid JSON for sing-box.
2. `updateField(ref, "path", event.target.value)` stores a string. If the user previously had an array (imported from JSON), the round-trip converts it to a string.
3. There is no way to add a second path entry. The official example explicitly shows a multi-path array (`["/etc/hosts", "$HOME/.hosts"]`).

Fix required: use `RuleListField` (already used for route/dns rules) or a `toList`/`fromList` textarea, keeping the stored value as `string[]`. Guard: if single entry on export, collapse to string per official note "you can ignore the JSON Array [] tag when the content is only one item."

### `predefined` field

**P0 — Field is entirely absent from the Inspector.**

`predefined` is not in `dnsServerHandledFields` (Inspector.tsx lines 142–153). Because `predefined` is a `Record<string, string | string[]>` (an object), `editableScalarFields` filters it out (line 206–210 only passes string/number/boolean). The field silently falls through both the primary section and `AdvancedScalarFields`. There is no way for a user to add, edit, or remove predefined host entries in the UI.

Fix required: add a key-value repeater in the hosts-specific section of the `dns-server` Inspector branch. Each row: domain input + IP list input (comma-separated to support multiple IPs). Store as `Record<string, string | string[]>`. Add `"predefined"` to `dnsServerHandledFields` so it does not leak into AdvancedScalarFields.

### `DnsServerConfig` type (types.ts lines 38–45)

```typescript
export type DnsServerConfig = TaggedConfig & {
  detour?: string;
  endpoint?: string;
  address?: string;
  server?: string;
  server_port?: number;
  path?: string;   // ← typed as string, not string | string[]
};
```

`path` is typed as `string` only. This does not model the official `string | string[]`. `predefined` is entirely absent from the type.

---

## Default Creation (commands.ts lines 594–599)

```typescript
if (type === "hosts") {
  return {
    type,
    tag,
    path: "/etc/hosts",
  };
}
```

- Creates with `path: "/etc/hosts"` (string scalar). Acceptable as a default per official docs (default path when none specified).
- Does not include `predefined: {}`. Acceptable — predefined is optional.
- Missing `predefined` in the initial object means `"predefined" in entity` would be false, preventing a hypothetical predefined section from rendering even if added. Fix: either add `predefined: {}` to the default or use `entityType === "hosts"` guard instead of `"predefined" in entity`.

---

## Dial/Detour Section

`sharedFieldRegistry.ts` line 156 correctly excludes `hosts` from `dnsServerDialTypes`. The shared field registry does not render dial fields for hosts. However, the output port for `outbound` (detour) still appears on the canvas node for all `dns-server` kinds including hosts (SbcNode.tsx lines 170–173). This is a P1 visual confusion issue.

---

## Priority Findings

### P0: `predefined` map is completely absent from Inspector

- **Where**: Inspector.tsx — `dnsServerHandledFields` set and the `dns-server` render block.
- **Impact**: Users cannot add inline host overrides at all through the UI. The field silently falls through. This is the primary differentiating feature of the `hosts` server type.
- **Fix**: Add a key-value repeater for `predefined` in the hosts-specific section, guarded by `entityType === "hosts"`. Add `"predefined"` to `dnsServerHandledFields`. Update `DnsServerConfig` type to include `predefined?: Record<string, string | string[]>`.

### P0: `path` rendered as single-value scalar, but is `string | string[]`

- **Where**: Inspector.tsx lines 1578–1586; types.ts line 44.
- **Impact**: Importing a config with multiple paths corrupts the field on any Inspector edit (array coerced to joined string). User cannot add a second path via UI.
- **Fix**: Replace the plain `<input>` with `RuleListField` (or equivalent list editor). Update `DnsServerConfig.path` to `string | string[]`. On export, if array has one element, optionally collapse to string.

---

### P1: Canvas detour output port shows for `hosts` type

- **Where**: SbcNode.tsx lines 170–174 — generic `dns-server` output ports include `outbound` (Detour) for all types.
- **Impact**: Hosts server has no `detour` capability. The port is visually misleading and could create canvas edges that produce invalid JSON references.
- **Fix**: Filter the detour port by checking if `type` is in `dnsServerDialTypes` before adding the `outbound` port spec.

### P1: `DnsServerConfig` type does not model `predefined` or array `path`

- **Where**: `src/domain/types.ts` lines 38–45.
- **Impact**: TypeScript does not catch incorrect usage; `path` typed as `string` means import round-trips with array values are untyped.
- **Fix**: Update type to `path?: string | string[]; predefined?: Record<string, string | string[]>;`.

---

## Implementation Tasks

1. **types.ts** — Add `predefined?: Record<string, string | string[]>` and change `path?: string` to `path?: string | string[]` in `DnsServerConfig`.

2. **commands.ts** — Optionally initialise `predefined: {}` in the `hosts` creation block so `"predefined" in entity` is true for newly created nodes (or switch the Inspector guard to `entityType === "hosts"`).

3. **Inspector.tsx — `path` field** — Replace the single `<input>` for `"path" in entity` with a `RuleListField`-style multi-value editor, guarded to `entityType === "hosts"` (so other server types using `path` for transport path are not affected). Update serialisation to store as `string[]`.

4. **Inspector.tsx — `predefined` field** — Add a hosts-specific key-value repeater section below the path field, guarded by `entityType === "hosts"`. UI: list of rows with `(domain) → (IPs, comma-separated)`, plus add/remove buttons. On change, write `predefined` as `Record<string, string | string[]>`. Add `"predefined"` to `dnsServerHandledFields`.

5. **SbcNode.tsx** — In the `dns-server` output ports block (lines 170–174), add a guard: only include the `outbound` detour port when `type` is in `dnsServerDialTypes` (or equivalent check excluding `hosts`, `fakeip`, `tailscale`, `resolved`).

6. **Smoke / fixture test** — Add a fixture covering `{ type: "hosts", tag: "hosts", path: ["/etc/hosts", "$HOME/.hosts"], predefined: { "localhost": ["127.0.0.1", "::1"] } }` and verify round-trip import → edit → export preserves the array and map.

---

## Done Criteria

- `predefined` map entries can be added, edited, and removed from the Inspector.
- `path` accepts multiple entries via list editor; array round-trips correctly.
- Canvas does not show a detour port for `hosts` type nodes.
- `DnsServerConfig` TypeScript type fully models `path` and `predefined`.
- Fixture or smoke test covers multi-path and predefined import/export round-trip.
