# SBC Editable Node UI Reviews

This index summarizes the per-node left/middle/right UI review created from the current editable node registry, the review method in `docs/experimental-ui-review.md`, and the official sing-box configuration Markdown.

The official-read pass is complete for all currently editable nodes. This does not mean implementation is complete: the next pass must verify current browser behavior against these documents, then convert the findings into domain commands, Inspector schemas, fixtures, E2E coverage, and target-matched `sing-box check` gates.

## Review Method

Each node doc checks three product surfaces:

- Left: Add Library entry and action wording.
- Middle: Canvas node card, side ports, status, and add/remove affordances.
- Right: Inspector fields, type switching, shared fields, and canonical JSON writeback.

The canvas remains a visual editing layer. The canonical sing-box JSON/domain state remains the source of truth.

## Coverage

- Total editable node reviews: 66
- P0 findings: 45
- P1 findings: 21
- Other findings: 0

## Deep Review Status

Every editable node must be checked before this review work can be called complete. The required evidence chain is:

1. Read the matching official sing-box Markdown file from the local stable/testing docs checkout.
2. Record the exact writable fields, required fields, tag-reference fields, and target/version gates.
3. Compare the current Left Library action, Middle Canvas node/ports, and Right Inspector against those fields.
4. Mark incompatible or mutually exclusive fields as such; do not invent standalone nodes for shared fields.
5. Add or point to at least one fixture, unit test, or UI/E2E gate that proves import -> render -> edit -> export for the node family.

Status vocabulary:

- `baseline`: Pass 1 registry-based document exists only.
- `official-read`: official Markdown has been read and node doc now records concrete field/relationship findings.
- `ui-verified`: current app behavior was checked against the review.
- `implemented`: required UI/domain/test fixes for that node are done.

Current status:

- `implemented`: 1 / 66 (`settings:log`).
- `ui-verified`: 2 / 66 (`outbound:selector`, `outbound:urltest` — P0 Inspector multiselect / default constrained / interrupt toggle landed; outstanding commands.ts cascade and diagnostics).
- `official-read`: 63 / 66.
- `baseline`: 0 / 66.

Review priority:

1. P0 tag-reference nodes: selector, urltest, route/dns hubs and rules, Tailscale endpoint/DNS/service references.
2. P0 target/platform-gated nodes: fakeip/tailscale/resolved DNS servers, DERP/resolved/SSM/hysteria-realm services.
3. P1 common object families: outbound protocols, inbound protocols, DNS servers, rule sets, settings.

## Implementation Bridge

The official-read docs are implementation input, not a completion claim. The next code pass should proceed in user-visible slices, each backed by domain commands, Inspector schemas, fixtures, and E2E checks:

1. Reference editing slice:
   Route final/rule outbound, selector/urltest members, DNS final/rule server, DNS/Dial detours, and Rule Set references must use explicit tag-select commands. This directly addresses the user's "how do I define upstream/downstream" concern.
2. Inspector schema slice:
   Replace generic/raw fields for the highest-use stable objects first: outbound leaf protocols, TUN inbound, Route/DNS rules, DNS servers, selector/urltest groups, and settings singletons.
3. Library add-flow slice:
   Library actions must be context-aware. Adding an outbound while Route, Route Rule, Selector, URLTest, DNS Server, or another Dial-capable object is selected should offer the compatible canonical attachment instead of creating an unexplained orphan.
4. Visual interaction slice:
   Side icons must represent compatible upstream/downstream types, not repeat the node's own icon. Dragging from a side icon should preview a typed edge and snap only to compatible target handles.
5. Validation slice:
   Browser diagnostics must separate semantic validity from official binary checks. Official `sing-box check` remains target-matched: 1.12 Legacy, 1.13 stable, and 1.14 testing use different binaries.

Frontend implementation for every slice must use `vercel-react-best-practices`: keep hover/drag state out of broad canonical subscriptions, memoize graph derivation, avoid barrel imports, and lazy-load heavy editors or advanced JSON panels.

## settings

- [Log Settings](ui-reviews/settings-log.md): P0 singleton global settings; no graph ports or duplicate nodes.
- [NTP Settings](ui-reviews/settings-ntp.md): P0 singleton settings with optional outbound Dial detour, not traffic-chain node.
- [Certificate](ui-reviews/settings-certificate.md): P0 singleton trust settings; do not confuse with certificate providers.
- [Experimental](ui-reviews/settings-experimental.md): P0 singleton settings; Clash/V2Ray references must be real tag selects.

## hub

- [Route Hub](ui-reviews/hub-route.md): P0 keep rule order table-owned and remove any UI that implies edge order is authoritative.
- [DNS Hub](ui-reviews/hub-dns.md): P0 keep DNS rule order table-owned and distinguish DNS server objects from route outbounds.

## rule

- [Route Rule](ui-reviews/rule-route-rule.md): P0 centralize creation/reorder/delete in route.rules table; node is a reference card.
- [DNS Rule](ui-reviews/rule-dns-rule.md): P0 centralize creation/reorder/delete in dns.rules table; node is a reference card.

## inbound

- [Inbound / direct](ui-reviews/inbound-direct.md): P1 avoid raw protocol forms for common fields; keep advanced JSON/import-only fields collapsed.
- [Inbound / mixed](ui-reviews/inbound-mixed.md): P1 avoid raw protocol forms for common fields; keep advanced JSON/import-only fields collapsed.
- [Inbound / socks](ui-reviews/inbound-socks.md): P1 avoid raw protocol forms for common fields; keep advanced JSON/import-only fields collapsed.
- [Inbound / http](ui-reviews/inbound-http.md): P1 avoid raw protocol forms for common fields; keep advanced JSON/import-only fields collapsed.
- [Inbound / shadowsocks](ui-reviews/inbound-shadowsocks.md): P0 SSM managed mode must be explicit when connected to SSM API.
- [Inbound / vmess](ui-reviews/inbound-vmess.md): P1 avoid raw protocol forms for common fields; keep advanced JSON/import-only fields collapsed.
- [Inbound / trojan](ui-reviews/inbound-trojan.md): P1 avoid raw protocol forms for common fields; keep advanced JSON/import-only fields collapsed.
- [Inbound / naive](ui-reviews/inbound-naive.md): P0 users/TLS requirements and 1.13 congestion-control gate must be explicit.
- [Inbound / hysteria](ui-reviews/inbound-hysteria.md): P0 bandwidth, user auth, and required TLS need guided controls.
- [Inbound / shadowtls](ui-reviews/inbound-shadowtls.md): P0 protocol version must gate credentials, handshake, and wildcard SNI fields.
- [Inbound / vless](ui-reviews/inbound-vless.md): P0 user UUID validation and embedded TLS/transport sections are required.
- [Inbound / tuic](ui-reviews/inbound-tuic.md): P0 user UUID/password and required TLS must be guided, with 0-RTT warning.
- [Inbound / hysteria2](ui-reviews/inbound-hysteria2.md): P0 required TLS, masquerade mode conflicts, and user password guidance must be visible.
- [Inbound / anytls](ui-reviews/inbound-anytls.md): P0 required users/TLS and advanced padding scheme handling are needed.
- [Inbound / tun](ui-reviews/inbound-tun.md): P0 TUN must be template-guided with platform and rule-set reference diagnostics.
- [Inbound / redirect](ui-reviews/inbound-redirect.md): P0 platform support must be explicit: Linux and macOS only.
- [Inbound / tproxy](ui-reviews/inbound-tproxy.md): P0 Linux-only support and network mode controls must be explicit.

## outbound

- [Outbound / direct](ui-reviews/outbound-direct.md): P1 common server/dial/TLS fields should be first-class controls.
- [Outbound / block](ui-reviews/outbound-block.md): P1 common server/dial/TLS fields should be first-class controls.
- [Outbound / socks](ui-reviews/outbound-socks.md): P1 common server/dial/TLS fields should be first-class controls.
- [Outbound / http](ui-reviews/outbound-http.md): P1 common server/dial/TLS fields should be first-class controls.
- [Outbound / shadowsocks](ui-reviews/outbound-shadowsocks.md): P1 common server/dial/TLS fields should be first-class controls.
- [Outbound / vmess](ui-reviews/outbound-vmess.md): P1 common server/dial/TLS fields should be first-class controls.
- [Outbound / trojan](ui-reviews/outbound-trojan.md): P1 common server/dial/TLS fields should be first-class controls.
- [Outbound / naive](ui-reviews/outbound-naive.md): P1 common server/dial/TLS fields should be first-class controls.
- [Outbound / hysteria](ui-reviews/outbound-hysteria.md): P1 common server/dial/TLS fields should be first-class controls.
- [Outbound / shadowtls](ui-reviews/outbound-shadowtls.md): P1 common server/dial/TLS fields should be first-class controls.
- [Outbound / vless](ui-reviews/outbound-vless.md): P1 common server/dial/TLS fields should be first-class controls.
- [Outbound / tuic](ui-reviews/outbound-tuic.md): P1 common server/dial/TLS fields should be first-class controls.
- [Outbound / hysteria2](ui-reviews/outbound-hysteria2.md): P1 common server/dial/TLS fields should be first-class controls.
- [Outbound / anytls](ui-reviews/outbound-anytls.md): P1 common server/dial/TLS fields should be first-class controls.
- [Outbound / tor](ui-reviews/outbound-tor.md): P1 common server/dial/TLS fields should be first-class controls.
- [Outbound / ssh](ui-reviews/outbound-ssh.md): P1 common server/dial/TLS fields should be first-class controls.
- [Outbound / selector](ui-reviews/outbound-selector.md): P0 group membership needs visual add/remove and Inspector multiselect.
- [Outbound / urltest](ui-reviews/outbound-urltest.md): P0 group membership needs visual add/remove and Inspector multiselect.

## dns-server

- [DNS Server / local](ui-reviews/dns-server-local.md): P0 Dial detour must be outbound-tag based; prefer_go is 1.13+ gated.
- [DNS Server / hosts](ui-reviews/dns-server-hosts.md): P0 no Dial/TLS/remote server controls; predefined hosts need structured editing.
- [DNS Server / tcp](ui-reviews/dns-server-tcp.md): P0 server is required and Dial detour must be outbound-tag based.
- [DNS Server / udp](ui-reviews/dns-server-udp.md): P0 server is required and no TLS/path controls should appear.
- [DNS Server / tls](ui-reviews/dns-server-tls.md): P0 server plus embedded outbound TLS and Dial detour must be explicit.
- [DNS Server / quic](ui-reviews/dns-server-quic.md): P0 server plus embedded outbound TLS and Dial detour must be explicit.
- [DNS Server / https](ui-reviews/dns-server-https.md): P0 DoH server/path/TLS/Dial need structured controls, including headers table.
- [DNS Server / h3](ui-reviews/dns-server-h3.md): P0 DoH3 must preserve JSON `type: "h3"` while using clear UI labels.
- [DNS Server / dhcp](ui-reviews/dns-server-dhcp.md): P0 no remote server/TLS/path controls; interface defaults must be clear.
- [DNS Server / fakeip](ui-reviews/dns-server-fakeip.md): P0 platform/type-specific guidance is required.
- [DNS Server / tailscale](ui-reviews/dns-server-tailscale.md): P0 platform/type-specific guidance is required.
- [DNS Server / resolved](ui-reviews/dns-server-resolved.md): P0 platform/type-specific guidance is required.

## endpoint

- [Endpoint / wireguard](ui-reviews/endpoint-wireguard.md): P0 address/private key/peer requirements need structured sensitive editing.
- [Endpoint / tailscale](ui-reviews/endpoint-tailscale.md): P0 DERP/DNS endpoint references need one-click attach/detach plus clear platform guidance.

## service

- [Service / derp](ui-reviews/service-derp.md): P0 TLS requirement and Tailscale endpoint verification must be visible before Check.
- [Service / resolved](ui-reviews/service-resolved.md): P0 mark Linux/systemd-only clearly; official check may fail on non-Linux.
- [Service / ssm-api](ui-reviews/service-ssm-api.md): P0 servers mapping must be a guided Shadowsocks managed-inbound selector.
- [Service / ccm](ui-reviews/service-ccm.md): P0 1.13+ gated service with outbound detour, sensitive tokens, and public-listen warnings.
- [Service / ocm](ui-reviews/service-ocm.md): P0 1.13+ gated service with outbound detour, sensitive tokens, and public-listen warnings.
- [Service / hysteria-realm](ui-reviews/service-hysteria-realm.md): P0 target-gated to 1.14 testing; stable UI must not add/export it silently.

## rule-set

- [Rule Set / remote](ui-reviews/rule-set-remote.md): P0 tag/url and outbound download detour must be explicit.
- [Rule Set / local](ui-reviews/rule-set-local.md): P0 tag/path and route/DNS/TUN references must be explicit.
- [Rule Set / inline](ui-reviews/rule-set-inline.md): P0 structured Headless Rule editing is required.

## Cross-Node Findings

1. Library actions need a strict vocabulary: `ADD` for real objects, `SETUP` for setup drafts/global objects, `OPEN` for Inspector-only modules, and `TABLE` for ordered lists.
2. Canvas side ports must represent real tag references only. Hidden graph-only references are not acceptable.
3. Rule order belongs to tables, not edge order. Route Rule and DNS Rule nodes should be visual references.
4. Settings nodes should be visually lighter than flow objects and should not expose chainable plus/port affordances.
5. Tag references should use selects or multiselects in Inspector. Raw text lists are acceptable only as temporary advanced controls.
6. Target-gated nodes must say which sing-box target unlocks them. Silent no-op clicks are not acceptable.
7. Status pills must separate semantic browser validation from official `sing-box check` validation.
8. Shared fields must remain embedded in supported parent Inspectors, not become fake standalone nodes.

## Next Review Pass

- Verify current app behavior against each official-read node document in the browser.
- Add screenshot annotations after the next Playwright capture pass where visual evidence would make a finding clearer.
- Convert P0 findings into actionable UI issues or implementation atomics.
- Add E2E coverage for each node family proving Library -> Canvas -> Inspector -> JSON export.
