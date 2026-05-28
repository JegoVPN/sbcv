# settings-ntp — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
The NTP node is in good shape and most pass-1 P0/P1 items are now fixed: the canvas detour edge, the settings output port, the `domain_resolver` select, and the "server required when enabled" diagnostic all landed, and tag rename/delete cascades + detour disconnect round-trip correctly. The remaining live defect is a **duplicate `Detour` control** in the Inspector — the hand-coded NTP block renders Detour AND the shared "Dial Fields" card renders Detour again (same path), which is confusing. Two smaller issues: the canvas `dial-detour` port never shows a "connected" state for NTP, and the node title reads "Ntp" instead of "NTP". Note: `write_to_system` named in the task brief is NOT in the upstream doc and is correctly absent from code — it is not a real field.

## 1. Left Palette
- Present and correct. `Palette.tsx:101` — `{ label: "NTP Settings", kind: "settings-ntp", icon: Clock3, docsUrl: docs("ntp/"), status: "setup" }`. Own "NTP" group (`Palette.tsx:100`), docs URL points to the correct page.
- Singleton gating is correct: `Palette.tsx:303` adds `settings-ntp` to `singletonsPresent` when `config.ntp` is non-empty; `itemStatus` (`Palette.tsx:261`) then promotes the badge to `"open"` ("click to open the Inspector"). Before NTP exists the badge is `"Setup"` with an explicit action label `"Setup NTP Settings"` (verified by `tests/app.test.tsx:163`). This directly resolves pass-1's worry that the action was ambiguous.
- Clicking selects the singleton (`Palette.tsx:447-456` maps `settings-ntp` → `settings:ntp`) and `createFromPalette` → `ensureSettings(config,"ntp")` seeds sane defaults (`commands.ts:43-50`: enabled=false, server="time.apple.com", server_port=123, interval="30m"). No duplicate-node risk. **No P0/P1 here.**
- STALE pass-1: pass-1 §"Left: Add Library" flagged that `status:"setup"` did not state the effect — the `open`/`setup` label + title now do.

## 2. Canvas Node
- Node is built in `graph.ts:171-191` from `SETTINGS_NODE_IDS` (`graph.ts:29`): `kind:"settings"`, `type:"ntp"`, `subtitle:"global settings"`, `compatible:[]` (no chip / no spurious traffic affordance — correct for a singleton).
- Title bug: `graph.ts:182` `path[0].toUpperCase()+path.slice(1)` yields **"Ntp"**; should be "NTP" (acronym). Titlebar (`SbcNode.tsx:291`) separately shows `settings / ntp` (lowercase) which is fine. (P2)
- Ports: NTP now exposes exactly ONE output port `dial-detour` ("NTP detour outbound") via the registry relation (`portRelationRegistry.ts:115`) → `portEndpointsForNode` → `getPortSpecs` (`SbcNode.tsx:94-108`). No input ports. This matches sing-box semantics (`ntp.detour` → outbound, no inbound). **Resolves pass-1 P1 "no output port".**
- Edge: `graph.ts:694-709` emits `settings-ntp-detour` from `settings:ntp` → `outbound:<detour>` when `ntp.detour` is a non-empty string and the node exists. **Resolves pass-1 P0 "detour edge never emitted".** Covered by `tests/port-relation-registry.test.ts:57`.
- LIVE bug: `isPortConnected` (`SbcNode.tsx:124-269`) has no `kind === "settings"` case, so the NTP `dial-detour` output port always renders the unconnected `+` state (`SbcNode.tsx:347-380`) even when `ntp.detour` is set and the edge is drawn. The mirror input on the outbound side (`detour-target`, `SbcNode.tsx:175-180`) checks outbounds + endpoints but NOT `config.ntp.detour`, so the target outbound also won't show NTP as a connected source. Cosmetic but inconsistent. (P1)

## 3. Upstream/Downstream Links
Official relationship model: NTP has no tag and is not tag-addressable (no incoming refs); its single outgoing reference is Dial `detour` → an outbound tag (when set, all other Dial Fields are ignored — `dial.md:67-71`). `domain_resolver` may also reference a DNS server tag (string form), per `dial.md:170-184`.

| Link | Expected | Code | Status |
|---|---|---|---|
| `ntp.detour` → outbound | yes (out) | `portRelationRegistry.ts:115` relation `settings-ntp-detour` (readonly, disconnectable), `/ntp/detour`, createTarget `["outbound"]` | OK |
| edge emission | on detour set | `graph.ts:694-709` | OK |
| detour disconnect → clear `ntp.detour` | yes | `commands.ts:1209-1213` | OK |
| tag rename/remove cascade (detour) | yes | `referenceRegistry.ts:169,190`; outbound paths incl `/ntp/detour` `referenceRegistry.ts:334` | OK |
| tag rename/remove cascade (domain_resolver) | yes | `referenceRegistry.ts:237,252` | OK |
| incoming refs to NTP | none | none | OK (correct) |

No missing/extra/wrong links. The relation is correctly `readonly` mode (the canonical value is a string in the Inspector, the edge is a read-only mirror) with `disconnectable:true` so the edge can still be deleted. **Pass-1's link section is now fully satisfied; its P0 is stale.**

## 4. Right Inspector (fields)
Hand-coded NTP block: `Inspector.tsx:2213-2260`. Shared "Dial Fields" card also rendered for NTP via `sharedFieldRegistry.ts:216` (`groups.push("dial")`) → `SharedFieldCards` (`Inspector.tsx:5343`) → generic dial list `Inspector.tsx:1476-1500`.

| Official field | UI? | Control | Required/Default | Notes |
|---|---|---|---|---|
| `enabled` | yes `Inspector.tsx:2215` | checkbox | default false | OK |
| `server` | yes `Inspector.tsx:2223` | text | **Required** | value, writes string. Required enforced by diagnostic, not by a UI marker — see findings |
| `server_port` | yes `Inspector.tsx:2230` | number | 123 | shows 123 default; writes `Number(...)` |
| `interval` | yes `Inspector.tsx:2238` | text | "30m" | duration string; OK (no duration validation) |
| `detour` (dial) | yes — **TWICE** `Inspector.tsx:2245` AND dial card `Inspector.tsx:1478` | select (outbound tags) | — | DUPLICATE control, both write `["detour"]`. P1 |
| `bind_interface` | yes (dial) `Inspector.tsx:1479` | text | — | OK |
| `inet4_bind_address` | yes (dial) `Inspector.tsx:1480` | text | — | OK — **resolves pass-1 P1** |
| `inet6_bind_address` | yes (dial) `Inspector.tsx:1481` | text | — | OK — **resolves pass-1 P1** |
| `bind_address_no_port` | yes (dial) `Inspector.tsx:1482` | boolean | — | labeled "(Linux, 1.13+)" |
| `routing_mark` | yes (dial) `Inspector.tsx:1483` | text | — | text accepts int or "0x.." hex (upstream allows both) — OK; writes string even for ints (P2) |
| `reuse_addr` | yes (dial) `Inspector.tsx:1484` | boolean | — | OK |
| `netns` | yes (dial) `Inspector.tsx:1485` | text | — | labeled "(Linux, 1.12+)" |
| `connect_timeout` | yes (dial) `Inspector.tsx:1486` | text | — | OK |
| `tcp_fast_open` | yes (dial) `Inspector.tsx:1487` | boolean | — | OK |
| `tcp_multi_path` | yes (dial) `Inspector.tsx:1488` | boolean | — | OK |
| `disable_tcp_keep_alive` | yes (dial) `Inspector.tsx:1489` | boolean | — | OK |
| `tcp_keep_alive` | yes (dial) `Inspector.tsx:1490` | text | "5m" | OK (no default prefill) |
| `tcp_keep_alive_interval` | yes (dial) `Inspector.tsx:1491` | text | "75s" | OK |
| `udp_fragment` | yes (dial) `Inspector.tsx:1492` | boolean | — | OK |
| `domain_resolver` | yes (dial) `Inspector.tsx:1493` | select (dns server tags) | — | string form only; object form not editable here — **resolves pass-1 P2 (was plain text)** |
| `network_strategy` | yes (dial) `Inspector.tsx:1494` | select default/hybrid/fallback | — | OK |
| `network_type` | yes (dial) `Inspector.tsx:1495` | list | — | OK |
| `fallback_network_type` | yes (dial) `Inspector.tsx:1496` | list | — | OK |
| `fallback_delay` | yes (dial) `Inspector.tsx:1497` | text | "300ms" | OK |
| `domain_strategy` (deprecated, removed 1.14) | yes (dial) `Inspector.tsx:1498` | text | — | shown with "(deprecated 1.12+)" label; deprecation diagnostic at `diagnostics.ts:1537-1542`. OK |
| `write_to_system` | n/a | — | — | NOT an official field (absent from `ntp/index.md` and `dial.md`); correctly NOT exposed |

Coverage: every official writable field is exposed with a sensible control. No invalid-JSON writes observed (number/string/boolean/list/select all type-correct). No UI fields exist that are absent from the official model. The settings block has no `AdvancedScalarFields` passthrough, but unknown imported keys still survive export because the entity object is retained — so no data loss, though such keys are not surfaced for editing (minor, shared across all settings nodes; out of scope).

## Findings (prioritized)
- **[P1] Duplicate `Detour` control in the NTP Inspector.** The hand-coded block renders Detour (`Inspector.tsx:2245-2258`) and the shared Dial Fields card renders Detour again (`Inspector.tsx:1478`, enabled for NTP by `sharedFieldRegistry.ts:216`). Both write `["detour"]`, so no corruption, but the user sees two identical selects. Fix: drop the hand-coded Detour (keep Server/Port/Interval/Enable in the block, let the Dial card own all dial fields incl. detour), OR exclude NTP from the shared "dial" group and keep only the hand-coded essentials. (`Inspector.tsx:2245`, `sharedFieldRegistry.ts:216`)
- **[P1] `dial-detour` output port never shows connected for NTP.** `isPortConnected` has no `settings`/`dial-detour` branch (`SbcNode.tsx:124-269`), and the outbound-side `detour-target` check ignores `config.ntp.detour` (`SbcNode.tsx:175-180`). Even with a valid detour and a drawn edge, both endpoints render the unconnected `+` affordance. Add: output `kind==="settings" && portKey==="dial-detour"` → `Boolean(config.ntp?.detour)`, and OR `config.ntp?.detour === value` into the `detour-target` input check. (`SbcNode.tsx:175-180`, `SbcNode.tsx:258-260`)
- **[P2] Node title renders "Ntp" not "NTP".** `graph.ts:182` naive first-char uppercase. Add a path→label lookup (`ntp`→"NTP"). (`graph.ts:182`)
- **[P2] `server` required-ness has no in-form affordance.** Diagnostic `ntp-server-missing` fires when `enabled && !server` (`diagnostics.ts:1301-1311`) — good — but the field label has no required marker/asterisk and no inline error, so the requirement is only visible via the diagnostics surface. Add a required marker on the Server label (`Inspector.tsx:2223-2229`).
- **[P2] `routing_mark` writes a string.** Upstream accepts an int (`1234`) or hex string (`"0x1234"`); the `text` control always stores a string, so a plain integer is serialized as `"1234"` not `1234`. Likely accepted by sing-box but not byte-faithful. Shared dial concern, not NTP-specific. (`Inspector.tsx:1483`)
- **[P2] `domain_resolver` object form not editable.** Only the string (DNS-server-tag) form is offered via the select (`Inspector.tsx:1493`); the object form (`dial.md:170-184`) cannot be authored in the UI. Acceptable for now; shared dial concern.

Where pass-1 is now stale: pass-1's P0 (detour edge missing), its P1s (no output port; missing `inet4_/inet6_bind_address`; no "server required when enabled" diagnostic), and its P2s (`domain_resolver` plain text; dial fields missing from the dial group) are ALL resolved in current code. Pass-1 also predates the now-present duplicate-detour regression and the `isPortConnected` gap.

SUMMARY: 0 P0, 2 P1, 4 P2.
