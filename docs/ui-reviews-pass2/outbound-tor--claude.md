# outbound-tor — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
The `tor` outbound is in good shape and pass-1 is now badly stale: all four Tor-specific fields (`executable_path`, `data_directory`, `extra_args`, `torrc`) are exposed first-class in the Inspector with a build-tag banner, and the relationship model is complete. Remaining issues are small: the torrc "Add" control writes an invalid empty-string key, the build-tag caveat lives only inside the Inspector (not on the canvas badge or in the Check/diagnostics panel), and `data_directory` is not marked `==Recommended==`. No P0; the empty-key write is the only correctness defect.

Upstream field enumeration (tor.md, lines 25-51): `executable_path` (string), `extra_args` (string[]), `data_directory` (string, ==Recommended==), `torrc` (map of options), plus Dial Fields (shared/dial.md). No `server`/`server_port`/TLS/multiplex/transport/QUIC/UDP-over-TCP.

## 1. Left Palette
- Present: `{ label: "Tor (with_tor)", kind: "tor-out", icon: Network, docsUrl: docs("outbound/tor/"), status: "setup" }` — `Palette.tsx:168`.
- Category: under "Outbounds" group. Correct.
- Kind→type: `"tor-out" → "tor"` via `OUTBOUND_PALETTE_TYPES` (`protocols.ts:17`) and in `CREATABLE_OUTBOUND_TYPES` (`protocols.ts:39`). Correct.
- Default action: `status: "setup"` → "Add Tor setup draft to canvas"; `canActivate` allows it (`Palette.tsx:279-287`). Correct.
- Docs link: `outbound/tor/`. Correct.
- Label now carries the `(with_tor)` build-tag hint (pass-1 said the label was bare `"Tor"` — STALE). Good, but the hint is only in text, no tooltip explains the embedded-vs-external distinction.

## 2. Canvas Node
- No Tor-specific node code; rendered by the generic outbound path. Correct (Tor has no server/port/group semantics).
- Title = tag; subtitle falls to `"tor outbound"` because Tor has no `outbounds`/`server` (`graph.ts:396-403`). Correct.
- Pills: `kind / type` titlebar (`SbcNode.tsx:291`), type pill + status pill (`SbcNode.tsx:408-414`). Status = semantic diagnostics for `/outbounds/{index}` (`graph.ts:404`). Reasonable.
- Ports/handles: generic, derived from `portEndpointsForNode` (`SbcNode.tsx:95,277-278`). See section 3 for the resulting handle set. Correct — no spurious server/TLS/transport ports.
- Gap: the build-tag hazard has no canvas badge (only `block` gets a deprecated badge, `SbcNode.tsx:279-296`). A Tor node looks identical to a working proxy on the canvas.

## 3. Upstream/Downstream Links
Model (portRelationRegistry + referenceRegistry) for a `tor` outbound node:

Inbound (left, references TO this outbound):
- route final — `route-final` (`portRelationRegistry.ts:93`; ref path `/route/final`). Present.
- route rule outbound — `route-rule` (`:95`; `/route/rules/*/outbound`). Present.
- selector candidate — `selector` (`:103`; `/outbounds/*/outbounds`). Present.
- urltest candidate — `urltest` (`:104`). Present.
- DNS server detour — `dns-server-detour` (`:105`; `/dns/servers/*/detour`). Present.
- dial detour target (other outbound's `detour`) — `outbound-detour` target (`:106`; `/outbounds/*/detour`). Present.
- endpoint detour target — `endpoint-detour` (`:108`). Present.
- service ccm/ocm detour — `service-detour-ccm/ocm` (`:109-110`). Present.
- rule-set download detour — `rule-set-download` (`:111`). Present.
- ntp detour — `settings-ntp-detour` (`:115`). Present.

Outbound (right, this outbound's OWN dial detour):
- `outbound-detour` source has `nodeTypeExcludes: ["block","selector","urltest","dns"]` (`:106`). `tor` is NOT excluded → Tor correctly exposes a dial-detour output port. Correct (Tor has Dial Fields, so `detour` is valid).

referenceRegistry outbound paths (`referenceRegistry.ts:334`) cover all of the above for rename/delete cascade. Verdict: no missing, extra, or wrong links. Pass-1's "P0 Dial detour must use a select/port attachment, not raw tag text" is satisfied — the Inspector Detour control is a `<select>` of outbound tags (`Inspector.tsx:1478`) and the canvas detour-target port exists.

## 4. Right Inspector (fields)
First-class Tor branch at `Inspector.tsx:3266-3363` (gated `entityType === "tor"`). Generic `server`/`server_port` inputs are gated by `"server" in entity` / `"server_port" in entity` (`:3376`, `:3385`); Tor's default object has neither key, so they are correctly hidden.

| Official field | Type (upstream) | UI control | Required marker | Default | Validation / handling | State |
|---|---|---|---|---|---|---|
| `executable_path` | string | text input (`:3272-3279`) | none (optional) | placeholder `/usr/bin/tor`; commands default seeds `/usr/bin/tor` (`commands.ts:419`) | empty → `undefined` (clean) | OK |
| `extra_args` | string[] | CSV text input via `toList`/`fromList` (`:3288-3298`) | none | placeholder `--SafeLogging,0`; default `[]` (`commands.ts:420`) | empty → `undefined` | OK (CSV breaks args containing commas; minor) |
| `data_directory` | string (==Recommended==) | text input (`:3280-3287`) | NOT marked recommended | placeholder `$HOME/.cache/sing-box/tor` (default object seeds `$HOME/.cache/tor`) | empty → `undefined` | PARTIAL — recommended status not surfaced |
| `torrc` | map of options | key/value repeater (`:3299-3361`, `data-testid="tor-torrc-editor"`) | none | default `{ ClientOnly: 1 }` (`commands.ts:421`) | numeric strings coerced to number (`:3333`); empty object → `undefined` (`:3303`) | PARTIAL — "Add" writes empty key; see P1-1 |
| Dial Fields | shared (shared/dial.md) | full Dial group via `sharedGroupsForEntity` → `outboundDialTypes` (`sharedFieldRegistry.ts:150,179`); detour is outbound `<select>` (`Inspector.tsx:1478-1499`) | n/a | n/a | all 21 dial fields present incl. `domain_resolver`, `network_strategy` | OK |

Shared-group correctness: Tor is in `outboundDialTypes` only; absent from `outboundTlsTypes`/`Multiplex`/`Transport`/`Quic`/`UdpOverTcp` (`sharedFieldRegistry.ts:150-155`). So Inspector offers Dial and nothing else. Correct per upstream.

No UI field exists that is absent from the official model. No invalid-JSON write path for torrc/extra_args (structured editors, not raw textareas) except the empty-key bug below.

Pass-1 status: STALE. Pass-1 (`docs/ui-reviews/outbound-tor.md` lines 80-81, 105-112; experimental review `docs/claude/outbound-tor.md` lines 71-93) claimed `extra_args` and `torrc` are "completely hidden" and `executable_path`/`data_directory` are "buried in Advanced fields". All four are now first-class. Pass-1 P0 "no build-tag warning anywhere" is partially resolved (banner exists in Inspector, `:3268-3271`) but not on canvas or in Check.

## Findings (prioritized)
- [P1] torrc "Add torrc key" writes an empty-string key `{ "": "" }` into the map — `Inspector.tsx:3355`. This serializes to an invalid `"torrc": { "": "" }` until the user types a key, and the key-rename guard `if (!newKey || newKey === key) return` (`:3318`) means an empty key can never be renamed away once committed; only delete clears it. Use a draft new-row pattern (commit on key blur) or block empty keys from being written.
- [P1] `data_directory` is not marked `==Recommended==` — `Inspector.tsx:3280-3287`. Upstream (tor.md:37-41) flags it Recommended ("each start will be very slow if not specified"). Add a "Recommended — startup is slow without this" hint to match the spec emphasis.
- [P1] Build-tag hazard is only visible inside the Inspector banner (`Inspector.tsx:3268-3271`); there is NO diagnostic in the Check/diagnostics panel and no canvas badge. `diagnostics.ts` has zero `tor`/`with_tor` handling (grep: only selector/urltest/certificate/cache-file diagnostics). A user who never opens the Inspector, or who runs Check, gets no warning. Emit a soft diagnostic for `type === "tor"` mirroring the existing build-tag/testing-only diagnostic pattern (e.g. `diagnostics.ts:1060-1066`).
- [P2] torrc value coercion forces any numeric-looking string to a JS number (`Inspector.tsx:3333`, regex `/^-?\d+(?:\.\d+)?$/`). torrc values are stringly-typed tor options; a value like a port-only string `"9050"` becomes `9050`. sing-box accepts scalars here so this round-trips, but it can surprise users who intend a string; acceptable but worth a note.
- [P2] `extra_args` uses comma-separated parsing (`Inspector.tsx:3291-3297`); a Tor argument that legitimately contains a comma cannot be represented. Minor — rare for tor flags. A line-based or chip editor would be safer.
- [P2] Canvas node shows no build-tag affordance (`SbcNode.tsx:279-296` badges only `block`). Low priority given the Inspector banner, but consistency with the deprecated-badge pattern would help.

No fixture/test covers `type: "tor"` (grep of `tests/` finds none) — not a code defect but a coverage gap; round-trip of populated `torrc`/`extra_args` is unverified.

SUMMARY: 0 P0, 3 P1, 3 P2.
