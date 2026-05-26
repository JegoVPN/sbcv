<!-- Status: ui-verified + partially implemented (2026-05-27). P0 #1 fixed — Inspector now exposes final select over dns-server tags, strategy select, all cache toggles (disable_cache, disable_expire, independent_cache, reverse_mapping), cache_capacity, client_subnet. P0 #2 verified — final select sources from config.dns.servers[].tag, not outbound tags. P0 #3 and #4 unchanged (rule ordering authoritative in RouteRulesTable; dns-server namespace separate). Outstanding: P1 testing-1.14 optimistic/timeout fields channel gate, P0 fakeip nested editor (moved to fakeip atomic). -->
# DNS Hub UI Review

## Scope

- Palette kind: `dns-hub` (Palette.tsx line 80)
- Canvas / Inspector kind: `dns` (EntityRef `{ kind: "dns", id: "main" }`)
- Official docs:
  - stable: `docs/configuration/dns/index.md`
  - testing: `docs/configuration/dns/index.md` (1.14.0 changes)
- This node writes the singleton top-level `dns` object.
- Review shape: Left Add Library, Middle Canvas Node, Right Inspector.

---

## Official Model

### Top-level `dns` fields (stable, sing-box ≤ 1.12.x)

| Field | Type | Notes |
|---|---|---|
| `servers` | `[]DNS Server` | Changed in 1.12.0 (breaking schema update). Owns all DNS server objects. |
| `rules` | `[]DNS Rule` | Ordered first-match list. |
| `final` | `string` | Default DNS server tag. Falls back to first server if empty. |
| `strategy` | `string` | One of `prefer_ipv4`, `prefer_ipv6`, `ipv4_only`, `ipv6_only`. |
| `disable_cache` | `bool` | Disable DNS cache. |
| `disable_expire` | `bool` | Disable DNS cache expiry. |
| `independent_cache` | `bool` | Per-server cache isolation. Slight performance cost. |
| `cache_capacity` | `int` | Added 1.11.0. LRU capacity; values < 1024 are ignored. |
| `reverse_mapping` | `bool` | Stores IP→domain reverse map for routing. Problematic on macOS. |
| `client_subnet` | `string` | Added 1.9.0. Global EDNS0 client subnet. IP or prefix. Overridable per server or rule. |
| `fakeip` | `object` | FakeIP settings sub-object. Not an outbound. |

### Testing-only fields (sing-box 1.14.0+)

| Field | Type | Notes |
|---|---|---|
| `optimistic` | `bool \| object` | Optimistic DNS caching (stale-while-revalidate). Conflicts with `disable_cache` and `disable_expire`. Object form: `{ enabled, timeout }`, default timeout `3d`. |
| `timeout` | `string` | Default query timeout. Default `10s`. Overridable per rule action or `domain_resolver`. |

### Deprecated in testing (1.14.0)

| Field | Status |
|---|---|
| `independent_cache` | Deprecated in 1.14.0. Removed per migration guide. |

### Doc inconsistency

The official field table uses the singular label `server` but the actual JSON key is `servers` (plural). The structure block and all implementation code use `servers`. This label inconsistency is a documentation artifact, not a bug.

---

## Relationship Model

### Critical distinctions

**`final` references a DNS server tag, not an outbound tag.**
`dns.final` is a string that must match a `tag` value from `dns.servers[]`. It is not an outbound reference. Any UI control for `final` must source its options exclusively from `config.dns.servers[].tag`, never from `config.outbounds[].tag`.

**`servers[]` owns DNS server objects, not outbound objects.**
DNS servers (kinds `dns-tcp`, `dns-udp`, `dns-tls`, `dns-https`, `dns-local`, `dns-hosts`, etc.) are members of `dns.servers[]` in the exported JSON. They are managed by the dns-server node family, not the outbound family. Canvas edges from dns-hub to dns-server nodes visualize ownership.

**`rules[]` order is canonical JSON array order.**
DNS resolution uses the first matching rule in `dns.rules[]`. Canvas edges visualize rule references only; rule priority is determined by table row order, not edge topology or visual position.

### Reference graph

```
hub:dns (dns object)
  ├── owns → dns.servers[] → dns-server nodes (dns-local, dns-https, dns-tcp, etc.)
  ├── owns → dns.rules[]   → dns-rule nodes (ordered first-match table)
  ├── refs → dns.final     → one dns-server tag (not outbound)
  └── refs → dns.fakeip    → FakeIP settings sub-object (not outbound)

inbound nodes
  └── queries → hub:dns (inbound-query port)
```

---

## Canvas Ports

### Left (input) ports — SbcNode.tsx `getInputPortSpecs`, kind `"dns"`

| Port key | Label | Connected node kind | Purpose |
|---|---|---|---|
| `inbound-query` | DNS query source | `inbound` | Visualizes which inbounds send DNS queries through this hub |

### Right (output) ports — SbcNode.tsx `getOutputPortSpecs`, kind `"dns"`

| Port key | Label | Connected node kind | Purpose |
|---|---|---|---|
| `dns-rule` | DNS rule | `dns-rule` | Visualizes rules owned by this hub (does NOT control order) |
| `dns-server` | DNS server | `dns-server` | Visualizes `dns.final` server connection |

### Port findings

- The output `dns-server` port (right) checks `config.dns?.final === value` for active state (SbcNode.tsx line 325). This is correct: it only activates when `final` is set.
- The output `dns-rule` port checks `(config.dns?.rules?.length ?? 0) > 0` for active state. Correct.
- On the dns-server node side, the input port labeled "DNS final server" (`key: "dns"`, `nodeKind: "dns"`) represents being referenced as `final`. The input port labeled "DNS rule" (`key: "dns-rule"`) represents being referenced by a rule's `server` field.
- There is no canvas port for `fakeip`, `client_subnet`, `strategy`, or cache toggles. These are Inspector-only scalar fields.

---

## Inspector

### What is rendered for `ref.kind === "dns"`

From Inspector.tsx:

1. **Header**: Shows kind label `dns`, no delete button (singleton — delete is suppressed at line 1164).
2. **DnsRulesTable** (RuleTables.tsx): Inline ordered table for `dns.rules[]`. See [Rule table behavior](#rule-table-behavior).
3. **No Tag field**: `final` is not rendered as a tagged entity; the dns hub has no `tag` field.
4. **No Type field**: dns hub has no `type` field.
5. **No shared field groups**: `sharedGroupsForEntity` returns no groups for `ref.kind === "dns"` (sharedFieldRegistry.ts — no branch for dns kind).
6. **No explicit scalar fields**: There is no rendered control for `final`, `strategy`, `disable_cache`, `disable_expire`, `independent_cache`, `cache_capacity`, `reverse_mapping`, `client_subnet`, `fakeip`, `optimistic`, or `timeout`.

**P0 finding**: All top-level `dns` scalar fields (`final`, `strategy`, `disable_cache`, `disable_expire`, `independent_cache`, `cache_capacity`, `reverse_mapping`, `client_subnet`, `fakeip`, `optimistic`, `timeout`) are currently unrendered in the Inspector. The entire dns hub Inspector consists only of the DnsRulesTable and the header. There are no controls for any scalar DNS settings.

### Rule table behavior (RuleTables.tsx `DnsRulesTable`)

The `DnsRulesTable` component owns `dns.rules[]` order via `moveDnsRule`, `addDnsRule`, `deleteDnsRule`, and `updateDnsRule` store actions.

Each rule card shows:
- Domain suffix (text input, comma-separated)
- Keyword (text input, comma-separated)
- Server (select from `config.dns?.servers[].tag` — correct namespace)
- Rule Set (datalist input from `config.route?.rule_set[].tag`)

Up/Down/Delete row actions are present.

**P1 finding**: The rule card exposes only 4 of the many dns-rule fields (domain_suffix, domain_keyword, server, rule_set). Full dns-rule editing is handled by the DnsRuleInspector component when a specific dns-rule entity ref is selected, but the table only surfaces the most critical fields.

**P0 finding**: Rule Set datalist (`dns-rule-set-tags`) is populated from `config.route?.rule_set`, which is the correct location for rule-set objects. This is correct.

**P0 finding**: Server select for dns-rule rows uses `config.dns?.servers` — correct; this is the DNS server namespace, not outbound namespace.

---

## Left: Add Library

Palette entry (Palette.tsx line 80):

```
{ label: "DNS Hub", kind: "dns-hub", icon: Globe2, docsUrl: docs("dns/"), ready: true }
```

- Status: `ready: true` — will render as active "ADD" button.
- The dns hub is a singleton. The `ready: true` flag does not encode singleton-idempotency behavior.

**P1 finding**: Clicking ADD a second time after the hub already exists should focus or open the existing dns hub, not create a duplicate. The current `ready` status only controls the button appearance; singleton enforcement must be handled in the add action logic.

**P1 finding**: "DNS Hub" is clear as a label. No change needed.

---

## Middle: Canvas Node

- `SbcNode.tsx` resolves `kind === "dns"` for both input and output port specs.
- Left port (`inbound-query`): shows only when inbounds exist (`(config.inbounds?.length ?? 0) > 0`, line 232).
- Right ports: `dns-rule` activates when rules exist; `dns-server` activates when `final` is set.

**P1 finding**: The `dns-server` right port activates on `final` only. DNS server nodes connected without a `final` link (e.g., servers only used by rules) will not produce an active port on the hub. This is visually misleading — servers owned by the hub but not set as `final` appear unconnected at the hub level. Consider whether an additional right port should visualize general dns-server ownership vs. only the `final` reference.

**P0 finding confirmed**: DNS server ports must not be confused with outbound ports. Port key `"dns-server"` with `nodeKind: "dns-server"` is correctly typed and separate from outbound port key `"outbound"`.

---

## Priority Findings

### P0

1. **Inspector empty for all dns scalars**: `final`, `strategy`, `disable_cache`, `disable_expire`, `independent_cache`, `cache_capacity`, `reverse_mapping`, `client_subnet`, `fakeip`, `optimistic`, `timeout` are all unrendered. The user cannot configure any dns-level setting from the Inspector.
2. **`final` must reference DNS server tags only**: Any future `final` select must source from `config.dns.servers[].tag`, never from `config.outbounds[].tag`. Current RuleTables server selects are correct in this regard; the missing `final` control must follow the same pattern.
3. **DNS rule order is table-owned**: Rule order is canonical JSON order managed by `moveDnsRule` in RuleTables. Canvas edges are visualization only. This is currently implemented correctly in RuleTables.tsx.
4. **DNS server objects are not outbounds**: The dns-server palette family (`dns-tcp`, `dns-udp`, etc.) produces entries in `dns.servers[]`. They must never be confused with or co-mingled with `outbounds[]`. All existing port specs and server selects use the correct namespace.

### P1

1. **Singleton idempotency**: ADD must be idempotent after dns hub exists. Needs guard in the add action.
2. **Missing scalar field controls**: `final` (dns-server tag select), `strategy` (enum select: `prefer_ipv4`/`prefer_ipv6`/`ipv4_only`/`ipv6_only`), `disable_cache` (checkbox), `disable_expire` (checkbox), `independent_cache` (checkbox, deprecated in 1.14.0 — show with deprecation warning when target ≥ 1.14), `cache_capacity` (number, helper text: values < 1024 ignored), `reverse_mapping` (checkbox), `client_subnet` (IP/prefix text), `fakeip` (link to FakeIP node or embedded sub-section), `optimistic` (checkbox/object, testing only), `timeout` (duration text, testing only).
3. **dns-server ownership port**: A right port visualizing all DNS server children (not just `final`) would improve canvas legibility.
4. **fakeip is a sub-object, not a canvas node**: `dns.fakeip` is an embedded settings object. It must not create a separate canvas node. An Inspector sub-section or link to the dns-fakeip Palette item is appropriate.
5. **Version gating for deprecated/new fields**: `independent_cache` is deprecated at 1.14.0; `optimistic` and `timeout` are testing-only. These need version-aware rendering.

---

## Done Criteria

- DNS Hub Inspector renders controls for all official scalar fields: `final` (dns-server tag select), `strategy` (enum select), cache toggles, `cache_capacity`, `reverse_mapping`, `client_subnet`, `fakeip` sub-section.
- `final` select sources exclusively from `config.dns.servers[].tag`.
- DnsRulesTable row order maps 1:1 to `dns.rules[]` JSON order.
- DNS server ports are visually and semantically distinct from outbound ports on all canvas nodes.
- ADD action from Library is idempotent for dns hub (singleton).
- Testing-only fields (`optimistic`, `timeout`) are hidden or gated when target is stable.
- `independent_cache` shows a deprecation warning when target ≥ 1.14.0.
- Fixture or smoke test covers import → render → edit scalar field → export round-trip.
