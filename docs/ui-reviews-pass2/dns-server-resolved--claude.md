# dns-server-resolved — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
The `resolved` DNS-server node is now genuinely built across all four surfaces: a dedicated Inspector branch with a typed `service` select + platform banner, a canvas `service` edge, a `service` reference registry entry, and two diagnostics for the required `service` ref. Pass-1's four P0s (missing field controls, missing canvas edge, missing service diagnostic, missing Linux signal) are now **all stale/resolved**. Remaining issues are smaller: the canvas node renders a spurious "Detour outbound" output port that does not belong to a service-backed type, the required `service` reference downgrades to a warning instead of an error, and `service` has no required marker / inline create affordance.

## 1. Left Palette
- Present. `Palette.tsx:96` — `{ label: "Resolved Server (Linux only)", kind: "dns-resolved", icon: Server, docsUrl: docs("dns/server/resolved/"), status: "setup" }`.
- Category DNS, label now carries the "(Linux only)" gate (pass-1's P1 "label does not signal Linux/systemd" is **stale**). Docs URL correct.
- `status: "setup"` → action "Setup", and `canActivate` allows `setup` (`Palette.tsx:279-287`), so the item creates the node. Mapping `DNS_SERVER_PALETTE_TYPES["dns-resolved"]="resolved"` and `CREATABLE_DNS_SERVER_TYPES` include `resolved` (`protocols.ts:104,119`). Correct.
- Minor: icon `Server` is shared with several DNS types; no functional issue.

## 2. Canvas Node
- Title = tag, subtitle = `"resolved dns server"` (`graph.ts:542-543`); titlebar shows `dns-server / resolved` (`SbcNode.tsx:291`). Status pill is whole-config diagnostic status (shared concern, not node-specific).
- `compatible: []` (`graph.ts:545`) — the big `+` quick-create and hover chips are absent, so there is **no one-click "create service:resolved" affordance** on canvas even though `service` is required (contrast dns-rule `compatible:["DNS Server"]`). The service must be made from the palette then linked in Inspector.
- Ports for `dns-server:resolved` resolve from `portEndpointsForNode` (`portRelationRegistry.ts:196-205`):
  - Inputs: `dns` (DNS final) + `dns-rule` — correct (referenced by `dns.final` and `dns.rules[].server`).
  - Outputs: `service` (readonly, "systemd-resolved service", `portRelationRegistry.ts:114`) **plus** `outbound` ("Detour outbound", `portRelationRegistry.ts:105`). The `dns-server-detour` source endpoint has **no `nodeType`/`nodeTypeExcludes`**, so it renders on every DNS-server type including `resolved`. Resolved is service-backed and has no dial/detour in the upstream schema — this port is semantically wrong. The port test (`tests/sbc-node-ports.test.ts:18-19`) covers `https`/`tailscale` but has **no `resolved` row**, so this slipped through.
- Service edge: drawn dns-server→service when `service` is set (`graph.ts:558-570`), `readonly` mode so drag-to-connect can't create it (`CanvasWorkspace.tsx:38` only matches `writable`), but it is `disconnectable:true` so edge-delete clears `service` (`commands.ts:1149-1156`). Reasonable: the link is Inspector-driven, canvas shows + can detach it.

## 3. Upstream/Downstream Links
Official relationship model for a resolved DNS server: outbound `service` → one `service:resolved` (required); inbound refs from `dns.final`, `dns.rules[].server` (route/evaluate), `route.rules[].dns_server` (resolve action) and dial `domain_resolver` fields; plus `dns.rules[].preferred_by` in 1.14 (Split DNS example).
- `service` → `service:resolved`: present in portRelationRegistry (`dns-server-service`, readonly, `portRelationRegistry.ts:114`), in referenceRegistry (`service` kind, `/dns/servers/*/service`, `referenceRegistry.ts:271-277,350-355`), rename/remove wired (`commands.ts` via registry; `changeEntityType` clears it when service type changes, `commands.ts:956`). Canvas edge present. **Correct & complete** (pass-1 "missing edge"/"no service ref handling" are **stale**).
- Referenced-by `dns.final` / `dns.rules[].server`: handled generically by the `dns-server` reference kind (`referenceRegistry.ts:339-343`) and drawn as `dns-final`/`dns-rule` edges. Correct.
- Extra/wrong: the **`dns-server-detour` relation applies to `resolved`** (no type guard) — an extra link/port that should not exist for this type (see §2). [P1]
- Missing (minor): `dns.rules[].preferred_by` (the 1.14 Split-DNS selector that names a resolved server by tag) is neither a primary/advanced DNS-rule field nor a drawn edge; it is only surfaced as a testing-only deprecation warning (`diagnostics.ts:1277`). Not strictly part of the resolved *node*, but it is the canonical way to target a resolved server, so the relationship is invisible in the UI. [P2]

## 4. Right Inspector (fields)
Inspector resolved branch: `Inspector.tsx:4229-4261`. `dnsServerHandledFields` now includes `service` + `accept_default_resolvers` (`Inspector.tsx:249-250`), so neither double-renders in AdvancedScalarFields (pass-1 "fields fall through to raw scalar" is **stale**). No dial/TLS shared groups for resolved (`sharedFieldRegistry.ts:156-157,187-191`) — correct, no address/server/port/path/detour/TLS controls leak in.

| Official field | Required | UI control | Required marker | Default | Validation | Notes |
|---|---|---|---|---|---|---|
| `type` (fixed `resolved`) | yes | type `<select>` over CREATABLE_DNS_SERVER_TYPES (`Inspector.tsx:2128-2135`) | n/a | `resolved` | n/a | Switchable; `changeEntityType` rescaffolds and preserves only detour/endpoint (`commands.ts:921-934`) — fine for resolved. |
| `tag` | yes | tag field (shared header) | implicit | `resolved-dns` (`protocols.ts:204`) | duplicate-tag diag | OK. |
| `service` | **Required** | `<select>` over `services` filtered to `type==="resolved"` (`Inspector.tsx:4235-4250`) | **No required marker**; placeholder "(select service:resolved)" maps to `undefined` | scaffold `service:"resolved"` (`commands.ts:680`) | warning if empty / error if unresolved (`diagnostics.ts:1090-1115`) | Control type correct. Two gaps: (a) required field flagged only as **warning** when empty, not error, though sing-box cannot start without it; (b) no inline "create service:resolved" / jump affordance, and if no resolved service exists the select is empty with only the placeholder. |
| `accept_default_resolvers` | no | checkbox (`Inspector.tsx:4251-4260`) | n/a | `false` (`commands.ts:681`) | none needed | Toggle correct, writes `undefined` when off (clean export). **No behavioral copy** explaining split-DNS (NXDOMAIN for non-matching) vs global-DNS — pass-1 asked for this hint; still absent. [P2] |

Sensitive-masking: none of resolved's fields are sensitive — correct. Nested-object handling: resolved has no nested objects — n/a. No invalid-JSON write path (no JSON textarea on this branch). No UI fields exist that are absent from the official model.

## Findings (prioritized)
- [P1] Canvas: `resolved` node renders a spurious **"Detour outbound" output port**. The `dns-server-detour` relation source endpoint lacks a `nodeType`/`nodeTypeExcludes` guard, so it applies to every DNS-server type. Resolved is service-backed (no dial/detour in upstream). Fix: restrict the `dns-server-detour` source to dialable types (mirror `dnsServerDialTypes`) or add `nodeTypeExcludes:["resolved","hosts","fakeip","tailscale"]`. `src/domain/portRelationRegistry.ts:105`. Add a `resolved` row to `tests/sbc-node-ports.test.ts:18`.
- [P1] Diagnostics: missing/empty `service` on a `resolved` server is only a **warning** (`dns-server-resolved-service-missing`), but `service` is `==Required==` and sing-box will not start without it. Should be an `error` (the unresolved-tag case is already an error at `diagnostics.ts:1108`). `src/domain/diagnostics.ts:1093-1100`.
- [P2] Inspector: `service` select has **no required marker** and **no inline create/jump** to a `service:resolved`; combined with `compatible:[]` on the canvas node (`src/canvas/graph.ts:545`) the user has no guided path to create the mandatory peer. `src/components/Inspector.tsx:4235-4250`.
- [P2] Inspector: `accept_default_resolvers` toggle lacks **behavioral copy** (off → NXDOMAIN for non-search/match domains = split-DNS; on → default-route resolvers tried = global DNS). `src/components/Inspector.tsx:4251-4260`.
- [P2] Default scaffold sets `service:"resolved"` literally (`src/domain/commands.ts:680`); if no `service:resolved` peer exists this is a dangling ref on creation (now caught as an error diagnostic, so impact is reduced vs pass-1).
- [P2] Links: `dns.rules[].preferred_by` (1.14 Split-DNS targeting of a resolved server) is not modeled as a field or edge, only a testing-only warning. `src/domain/diagnostics.ts:1277`.

Stale pass-1 items (now fixed): P0 missing `service` control, P0 missing canvas edge, P0 missing service diagnostic, P0 Linux-gate not surfaced (now an Inspector banner `Inspector.tsx:4231-4234`), P1 palette label missing Linux signal, P1 `accept_default_resolvers` raw-scalar render. Note: the Linux/systemd signal is an Inspector **banner** only, not a `diagnostic` on the dns-server side (the `resolved-service-linux-only` diag at `diagnostics.ts:218` covers only `services[]`); acceptable but asymmetric.

SUMMARY: 0 P0, 2 P1, 4 P2.
