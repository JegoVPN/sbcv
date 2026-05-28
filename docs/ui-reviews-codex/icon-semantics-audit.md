# SBC SVG/Icon Semantics Audit

Date: 2026-05-28

This is a follow-up independent review focused only on node icons, port icons, and related SVG/icon affordances. It intentionally does not use prior UI review outputs, Claude review issues, PR comments, or GitHub issue summaries.

## Scope

Reviewed surfaces:

- Node title icons in `src/components/SbcNode.tsx`.
- Palette creation icons in `src/components/Palette.tsx`.
- Compatible-node picker icons in `src/components/ChipPickerPopover.tsx`.
- Inspector header icons in `src/components/Inspector.tsx`.
- Port icon ids and relation mappings in `src/domain/portRelationRegistry.ts`.
- Edge/remove and SVG interaction affordances in `src/components/CanvasEdge.tsx`, `src/components/CanvasWorkspace.tsx`, and `src/styles.css`.
- Local behavior coverage in `tests/sbc-node-ports.test.ts`.

Applied frontend performance review principle from `vercel-react-best-practices`: icon fixes should use static direct imports and a shared registry, avoid broad canvas rerenders, and keep transient drag/hover state out of canonical config subscriptions.

## Design Principles

1. The same `{ nodeKind, nodeType }` must resolve to the same icon across Palette, node card, Inspector, and compatible picker.
2. A node title icon should identify the node's own role/type, not only the broad config collection.
3. A port icon should communicate the referenced object or relation semantics clearly enough for drag-connect decisions.
4. Official or protocol-recognized visuals should be reused where allowed by license and bundle-size review. If not available, create a functionally accurate custom monochrome icon instead of using a misleading generic icon.
5. A generic icon is acceptable only when it is still semantically true. It is not acceptable when it implies another role, for example using a security shield for a plain SOCKS or HTTP outbound.

## Inventory Matrix

| Surface | Current icon source | Coverage result |
| --- | --- | --- |
| Node card kind icons | `SbcNode.tsx` `iconMap` plus `outboundIcon()` | Broad kind coverage exists, but many concrete node types collapse to a generic icon. |
| Palette type icons | Inline icon choices in `Palette.tsx` item definitions | More type-aware than node cards, but drifts from node card, picker, and Inspector icons. |
| Compatible picker icons | `ChipPickerPopover.tsx` `iconForKind()` | Kind-only; ignores `nodeType`, so candidates lose the visual identity the user needs while creating/connecting. |
| Inspector header icons | `Inspector.tsx` `inspectorIcons` | Duplicates another partial mapping and disagrees with Palette/node card for several entities. |
| Port icons | `portRelationRegistry.ts` `sourcePort` / `targetPort` ids rendered by `SbcNode.tsx` | Covers relation groups, but the vocabulary is too narrow for all upstream relations. |
| Edge/remove controls | `CanvasEdge.tsx`, `SbcNode.tsx`, `styles.css` | Connection remove semantics exist, but icon vocabulary differs between edge and port removal. |
| SVG interaction paths | `CanvasWorkspace.tsx`, `styles.css` | Pending dashed connector is an interaction path, not a node/port icon; keep separate from semantic icon registry. |
| Tests | `tests/sbc-node-ports.test.ts` | Tests ensure ports do not blindly copy node icons, but do not assert cross-surface semantic consistency. |

## Findings

### IC-P1-1: Outbound Node Cards Collapse Most Protocols To `Shield`

`SbcNode.tsx` only special-cases `direct`, `block`, `selector`, and `urltest`; all other outbound protocols fall back to `Shield`.

This makes SOCKS, HTTP, DNS, SSH, Tor, WireGuard, Hysteria, VMess, VLESS, Trojan, and similar outbounds look like TLS/security/certificate nodes. It directly violates user recognition: after creating a protocol from the Palette, the canvas often shows a different and misleading icon.

Landing:

- Replace `outboundIcon()` with a shared semantic registry keyed by `{ kind: "outbound", type }`.
- Keep `Shield` only for protocols where TLS/security is the primary visual truth, for example ShadowTLS/AnyTLS if no better mark is adopted.
- Prefer functional icons for protocol roles: HTTP/Naive `Globe2`, SOCKS/TProxy `Network`, SSH `Terminal` or `KeyRound`, DNS `Globe2`, URLTest `Gauge` / `Activity` / `Timer`, selector `Shuffle`.
- Evaluate official/protocol-recognized custom SVGs for WireGuard, Tailscale, Tor, Cloudflare, and other brand-like protocol nodes before inventing substitutes.

### IC-P1-2: Compatible Picker Icons Are Kind-Only

`ChipPickerPopover.tsx` maps only `nodeKind` and ignores `nodeType`. In the compatible picker, candidate rows such as Direct, Block, Selector, URLTest, SOCKS, HTTP, and VLESS can all render as the same generic outbound/network concept.

This is especially risky because the picker appears during the connection workflow, when the user is choosing what node to create or connect.

Landing:

- Pass `nodeType` into the candidate icon resolver.
- Reuse the same semantic registry as node cards and Palette.
- Add tests for at least outbound candidates and DNS server candidates so the picker cannot regress to kind-only icons.

### IC-P1-3: Icon Definitions Are Duplicated Across Four Surfaces

The same conceptual object has different icons depending on where the user sees it:

| Concept | Node card | Palette | Compatible picker | Inspector |
| --- | --- | --- | --- | --- |
| Certificate Provider | `Shield` | `KeyRound` | `Shield` | `Braces` |
| HTTP Client | `Network` | `Globe2` | `Network` | `Network` |
| Service | `Server` | mostly `Server` | `Settings` | `Server` |
| URLTest | `Database` | `Shuffle` | generic outbound | n/a |
| Route | `Route` | `GitBranch` | `Route` | `Route` |

This creates a recognition break: the user can pick one icon from the Palette and then see another on the canvas or Inspector.

Landing:

- Add a single semantic icon registry module for node kind/type and port ids.
- Make `SbcNode`, `Palette`, `ChipPickerPopover`, and `Inspector` consume it.
- Add a unit test that samples every palette item and verifies the node-card and picker icon id match the registry.

### IC-P2-1: URLTest Uses Storage/Shuffle Metaphors Instead Of Testing Semantics

URLTest is shown as `Shuffle` in the Palette, `Database` on node cards, and `database` in port relations. Upstream URLTest is candidate latency/URL testing, not storage.

Landing:

- Reserve `Shuffle` for Selector or other user-choice/group selection semantics.
- Use a latency/probe metaphor such as `Gauge`, `Activity`, `Timer`, or a custom URL probe icon for URLTest across Palette, node card, picker, and ports.

### IC-P2-2: WireGuard And Tailscale Share The Same Generic Endpoint Icon

Endpoint node cards are kind-only `Waypoints`, and the Palette uses `Waypoints` for both WireGuard and Tailscale. These are protocol-specific identities that users are likely to recognize visually.

Landing:

- Add a license/bundle-size review before importing official marks.
- If official marks are acceptable, add monochrome SVG/icon components for WireGuard and Tailscale.
- If official marks are not acceptable, create two distinct functional custom icons and keep them consistent for endpoint nodes, DNS Tailscale server ports, Tailscale certificate-provider endpoint refs, and DERP/Tailscale contexts.

### IC-P2-3: Certificate Provider Looks Like Security, JSON, Or Key Depending On Surface

Certificate Provider appears as `Shield` in node cards, `KeyRound` in the Palette, `Shield` in ports, and `Braces` in Inspector. `Shield` also overlaps with many outbound protocols, which weakens the certificate-provider identity.

Landing:

- Standardize generic certificate-provider identity on `FileKey2`, `KeyRound`, or a custom certificate/key icon.
- Use provider-specific variants only when meaningful: ACME challenge, Cloudflare provider, Tailscale provider.
- Stop using `Braces` for certificate-provider Inspector headers.

### IC-P2-4: Inbound, Service, Settings, And HTTP Client Title Icons Are Too Generic

The canvas guide expects titlebar icons to identify the node's own type. Current node cards map all inbounds to `RadioTower`, all services to `Server`, all settings nodes to `Braces`, and HTTP Client to `Network`.

Landing:

- Make high-risk families type-aware where users commonly distinguish them visually: TUN, HTTP, SOCKS, Shadowsocks, VMess/VLESS/Trojan, DERP, Resolved, SSM API, NTP, Certificate, Experimental, and HTTP Client.
- Keep broad family icons only where the node is truly a collection/hub rather than a concrete protocol.

### IC-P2-5: Port Icon Vocabulary Is Too Narrow For The Number Of Reference Types

`PortIconId` mostly offers generic ids such as `network`, `server`, `settings`, `shield`, and `database`. Several relation types then look similar even though their reference semantics differ:

- NTP detour uses `network`.
- Rule-set download, Clash download, outbound detour, and DNS detour all lean on `network`.
- DERP endpoint input uses `server`.
- Certificate-provider endpoint input uses `shield`.
- SSM managed inbound uses `radio`.
- Ordered route/DNS rule relations use `git-branch`, which does not communicate ordering.

Landing:

- Expand `PortIconId` to include relation-specific ids such as `clock`, `file-key`, `gauge` / `activity`, `list-ordered`, `tailscale`, `wireguard`, and protocol-specific ids where the port names a concrete protocol.
- Keep the test that prevents ports from blindly copying node icons, but add assertions for the exact icon id on representative relation classes.

### IC-P2-6: Connection Removal Uses Different Icon Semantics On Ports And Edges

Side-port disconnect uses `Trash2`, while edge remove uses `X`. Both remove the same canonical connection/reference, so the visual language should be consistent. A trash can can also read as deleting the node/resource, not disconnecting only the relation.

Landing:

- Choose one relation-removal metaphor for both edge and port controls.
- Prefer a disconnect/unlink icon if available; otherwise use `X` consistently with clear tooltip text.
- Keep node deletion on `Trash2` so resource deletion remains distinct from relation removal.

## Not Findings

| Item | Result |
| --- | --- |
| Lucide icons in general | Acceptable for generic roles and bundle size when the metaphor is accurate. The issue is semantic drift and misleading fallback icons, not the library. |
| Pending dashed chip-picker link | Not a node or port icon. It is an interaction path and should stay visually distinct from committed solid green edges. |
| Product brand inline SVGs | Outside the node/port audit unless product branding is explicitly changed. Do not import upstream sing-box brand assets just to solve node semantics. |
| Status icons such as valid/warning | Acceptable as status affordances. They should not be reused as protocol identity icons. |

## Implementation Atomics

1. Add `src/canvas/iconRegistry.ts` or equivalent with static direct icon imports and explicit exported resolvers for node icons, picker icons, Inspector icons, Palette icons, and port icons.
2. Move `SbcNode`, `Palette`, `ChipPickerPopover`, and `Inspector` to the shared registry without changing behavior except where icons are plainly inconsistent for the same concept.
3. Make compatible picker icons type-aware and add unit tests for outbound, DNS server, endpoint, certificate-provider, and service candidates.
4. Replace the most misleading protocol icons: outbound `Shield` fallback, URLTest `Database`, certificate-provider `Braces`/`Shield`, HTTP Client `Network`, and generic WireGuard/Tailscale `Waypoints`.
5. Expand `PortIconId` for high-frequency connection decisions and add exact-id tests for detour, ordered rules, URLTest candidates, NTP, certificate providers, and Tailscale/WireGuard references.
6. Run a separate license/bundle-size check before adding official SVGs. If official assets are rejected, add small custom monochrome SVGs with stable `aria-label` and no unnecessary path precision.

## Verification Plan

- Unit tests for registry consistency across node card, Palette, compatible picker, Inspector, and port relations.
- Existing `tests/sbc-node-ports.test.ts` should keep verifying that port icons are not blindly copied from node icons.
- Browser smoke test on the canvas: create and connect at least Direct, URLTest, SOCKS/HTTP outbound, Tailscale endpoint, WireGuard endpoint, Certificate Provider, HTTP Client, and Service nodes and verify their icons remain consistent before and after creation.
- Bundle review: direct imports only; no broad `lucide-react` namespace import and no oversized official SVG payloads.
