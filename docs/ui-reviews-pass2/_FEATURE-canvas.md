# Feature UX review — Canvas
<!-- reviewer: principal PM + FE; lens: can a new user understand & use it; source: our code + UX principles -->

## Feature inventory
- Node card shell, selected ring + 4 corner ticks — src/components/SbcNode.tsx:281-306; CSS src/styles.css:1027-1067
- Titlebar shows machine label `${kind} / ${type}` (e.g. "outbound / direct") above the human tag — SbcNode.tsx:287-297; CSS styles.css:971-985
- Deprecated badge (outbound type=block only), dims card — SbcNode.tsx:279,292-296; CSS styles.css:993-1007
- Summary block: status glyph + title (human tag) + subtitle — SbcNode.tsx:384-390
- Left input ports / right output ports, each a round button w/ icon + hover label + corner action badge — SbcNode.tsx:308-382; CSS styles.css:1092-1189
- Port handles (invisible 40px target+source overlay per port) for drag-to-connect — SbcNode.tsx:326-337,364-375; CSS styles.css:1191-1215
- Per-endpoint port icon literal rendered via portIconMap — SbcNode.tsx:104; registry src/domain/portRelationRegistry.ts:90-116
- Big "+" button (left, mid-card): creates first compatible kind — SbcNode.tsx:392-405; CSS styles.css:1268-1280
- Bottom toolbar: type pill, status pill, inspector icon, "primary" button showing `compatible.length || 1` — SbcNode.tsx:407-438; CSS styles.css:1282-1341
- Hover/selected action rail: one `+ kind` chip per compatible string + delete — SbcNode.tsx:440-465; CSS styles.css:1343-1409
- Edge derivation + styling (animated flag only) — src/canvas/graph.ts:127-144,240,324; CSS styles.css:1409-1412
- Compatible chip strings per node kind — graph.ts:227,257,293,405-428,524,594,641,669
- createCompatible (chip → mutation) — src/state/useProjectStore.ts:798-836
- onConnect / isValidConnection (drag) — CanvasWorkspace.tsx:69-79,113-114; store connectPorts useProjectStore.ts:901-909
- Disconnect = select edge + Delete; deletable gated by relation mode — graph.ts:142; portRelationRegistry.ts:186-194
- Canvas shell: pan/select toggle, zoom, fit, minimap toggle, selection pill — CanvasWorkspace.tsx:103-183

## UX findings (prioritized)

- [P0] **Per-port icons are hand-authored literals and are inconsistent across an edge's two ends.** The same semantic relation uses different glyphs on each side, and "references an outbound" maps to many glyphs: route-final target uses `route` (portRelationRegistry.ts:93), dns-detour uses `server` (:105), detour-target uses `network` (:106), service-detour uses `server` (:109/110), rule-set-download uses `layers` (:111). A user dragging "an outbound reference" sees a different icon on every node. Icons should be derived from the relation, not typed per endpoint. Rendered at SbcNode.tsx:104.
- [P0] **16 of the compatible "+" chips are dead no-ops.** Selector/URLTest groups advertise 18 chips (graph.ts:405-428) but createCompatible only handles Route/Direct/Block/Selector/URLTest/SOCKS/DNS Server/DNS Tailscale Server (useProjectStore.ts:801-808). Clicking HTTP, Shadowsocks, VMess, Trojan, Naive, Hysteria, Hysteria2, ShadowTLS, VLESS, TUIC, AnyTLS, Tor, SSH, WireGuard, "Shadowsocks Inbound", or "Tailscale Endpoint" silently does nothing. A first-time user clicks and gets zero feedback — looks broken.
- [P0] **The big "+" button and the chip both fire createCompatible but mean different things, with no preview.** The mid-card "+" blindly creates `compatible[0]` (SbcNode.tsx:399-400) — e.g. on Route that is "Direct", with no indication of what it will add. The chip rail (only on hover/select, styles.css:1370-1372) is the only place the choices are visible. New users will hit the always-visible "+" and not understand what just appeared on the canvas.
- [P1] **Drag-to-connect is undiscoverable and gives no failure feedback.** Handles are fully invisible (`opacity:0`, styles.css:1198) and there is no "drag from here" affordance; the per-port `Plus`/`Trash2` corner badge (SbcNode.tsx:340,378) *looks* clickable but its onClick only calls `stopPropagation()` (SbcNode.tsx:322-324,360-362) — clicking a port does nothing. On an invalid drop, isValidConnection just returns false (CanvasWorkspace.tsx:69-79) and connectPorts returns unchanged state with no toast/snackbar (useProjectStore.ts:901-909) — the edge silently vanishes.
- [P1] **No edge legend and edges carry almost no decodable meaning.** Every edge is the same green `#c7ff00`, width 2.2, no arrowhead/marker, no dashed variant (styles.css:1409-1412; makeEdge graph.ts:127-144). Only 2 edges set `animated:true` (inbound→route graph.ts:240, route→final graph.ts:324) and there is no CSS/legend explaining that the marching-ants motion means "primary traffic path." Solid-vs-dashed and color simply do not encode anything a user can read.
- [P1] **"warning" status renders the green "valid" checkmark.** The status icon ternary only branches on `error` (SbcNode.tsx:386 and pill :413), so warning nodes show `CheckCircle2` — yet the border (styles.css:1037) and pill text (styles.css:1318) are amber. Mixed valid/warning signals on the same card; a user can't trust the glyph.
- [P1] **Disconnect is hidden behind select-edge + Delete key.** Edges are only removable via keyboard (CanvasWorkspace.tsx:136 onEdgesDelete:112) and the connected-port `Trash2` badge is non-functional (see above). There is no right-click, no hover "x" on the edge, and no undo (no undo/redo anywhere in store). Mobile users (deleteKeyCode=null, CanvasWorkspace.tsx:136) cannot disconnect at all.
- [P1] **Titlebar leads with machine jargon.** Every card's most prominent top label is `kind / type` like "route-rule / route-rule" or "dns-server / tls" (SbcNode.tsx:291). For a first-time user the redundant/internal taxonomy is noise above the actual name; "route-rule / route-rule" is pure duplication.
- [P2] **Bottom-toolbar "primary" button shows a bare number with a check icon and just opens the inspector.** It renders `compatible.length || 1` (SbcNode.tsx:436) next to a checkmark — reads like a count/score but is actually a duplicate "open inspector" button (same action as the gear at :419-423). Ambiguous and redundant.
- [P2] **No empty/first-run state.** There is no "your canvas is empty — add a node" affordance anywhere in CanvasWorkspace.tsx; with no config the user faces a blank dotted grid (Background styles.css equiv at CanvasWorkspace.tsx:138) and must discover the (separate) palette on their own.
- [P2] **Selection feedback is minimal and the "Selected inbound:foo" pill exposes node IDs.** The pill prints the raw node id (CanvasWorkspace.tsx:181) rather than a human name, and selection is otherwise only a blue ring + corner ticks; there is no inline hint that Delete removes the node or that the inspector is where edits happen.
- [P2] **Connection target highlight is extremely subtle.** Valid drop handles only go to `opacity:0.18` (styles.css:1211-1215); during a drag a new user is unlikely to perceive which ports are valid targets.

## New-user verdict
A first-time user can pan/zoom and roughly read node cards, but the core "build by connecting" model is largely opaque: handles are invisible, the most clickable-looking affordance (port badges) does nothing, and roughly two-thirds of the create chips are dead no-ops with zero feedback. Edges all look identical so structure can't be decoded, and inconsistent per-endpoint icons make even "what kind of link is this" guesswork. The feature reads as a polished but partly non-functional graph editor that needs an onboarding affordance, real connect/disconnect feedback, and chip/edge coherence before a newcomer could succeed unaided.

SUMMARY: 3 P0, 6 P1, 4 P2.
