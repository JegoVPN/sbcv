<!-- Status: audit (2026-05-27). Cross-check of `docs/goals/editable-node-ui-deep-pass.md` claimed implementation against actual code in `src/`. 66 nodes reviewed by 66 parallel agents in 7 batches; only code (not doc claims) was trusted. -->

# Editable Node UI Deep Pass — Code Audit 2026-05-27

This audit cross-checks the [editable-node-ui-deep-pass goal](goals/editable-node-ui-deep-pass.md) against actual source code. 66 nodes were reviewed in 7 batches of parallel agents; each agent read the node's two review docs (`docs/ui-reviews/<node>.md` + `docs/claude/<node>.md`) only to extract the claimed P0/P1 findings, then grepped the codebase to verify whether each claim is actually implemented.

**Result: ~120 deltas across 60+ of 66 nodes.** Doc status often says `ui-verified` or `implemented`, but the underlying code is partial or missing. Five nodes are clean: `outbound-vless`, `outbound-tor`, `dns-server-quic`, `dns-server-udp`, `service-ocm`.

This audit is the source of truth for the remaining implementation work. Do not trust the per-node review docs' status comments until the deltas below are closed.

## Cross-cutting Defects (Fix First)

These appear in many nodes simultaneously. One PR per item can close 10–30 nodes' P0s at once.

### CC-1 `address` / `auto_route` rendered for every inbound (should be tun-only) — ✅ CLOSED 2026-05-27

- ~~`src/components/Inspector.tsx:2268-2282` unconditionally renders `Address` + `auto_route` for **all** inbound types, with no `entityType === "tun"` guard.~~ Now gated by `entityType === "tun"` wrapper.
- **Affected (now fixed):** mixed / socks / http / shadowsocks / vmess / trojan / naive / hysteria / hysteria2 / tuic / vless / shadowtls / anytls / redirect / tproxy.
- **Regression test:** `tests/app.test.tsx` — "hides address/auto_route fields for non-tun inbounds" + "renders address/auto_route fields for inbound:tun".

### CC-2 Required protocol fields fall through to `AdvancedScalarFields`

- `password` / `uuid` / `username` / `network` enum are declared in `outboundHandledFields` or `inboundHandledFields`, but no dedicated first-class control exists inside the matching `entityType ===` branch — so the field renders as a generic raw input under "Advanced".
- **Confirmed missing first-class control:**
  - inbound `shadowsocks` → `password`, `users[]`, `destinations[]`, `network`, `managed`
  - inbound `http` → `set_system_proxy` platform-restriction banner
  - inbound `tuic` → `users` entirely
  - inbound `shadowtls` → `version` select
  - outbound `shadowsocks` / `trojan` / `tuic` → `password`
  - outbound `tuic` → `uuid`, `network`, `heartbeat`, `zero_rtt_handshake`
  - outbound `socks` → `network` enum, `username`/`password` first-class
  - outbound `http` → `headers` map (entirely invisible), `path` not in `outboundHandledFields`

### CC-3 Scaffold hardcodes `network: "tcp"` / `"udp"` instead of omitting — ✅ CLOSED 2026-05-27

- ~~Official semantics: omit `network` to mean "both TCP and UDP". The scaffold lies to the user.~~ All 10 hardcoded `network:` defaults stripped from `createInbound` / `createOutbound`.
- **Affected (now fixed):** inbound — direct, naive, tproxy. outbound — shadowsocks, vmess, vless, trojan, hysteria, hysteria2, tuic.
- **Regression test:** `tests/domain.test.ts` — "omits the network field from scaffolds so sing-box defaults to both TCP and UDP".

### CC-4 Palette kind naming still inconsistent (M1.8 incomplete) — ✅ CLOSED 2026-05-27

- ~~`Palette.tsx:132` uses `kind: "mixed"` instead of `"inbound-mixed"`.~~ Now `inbound-mixed`.
- ~~`Palette.tsx:145` uses `kind: "tun"` instead of `"inbound-tun"`.~~ Now `inbound-tun`.
- ~~`Palette.tsx:92` still ships `dns-http3` instead of `dns-h3`.~~ Now `dns-h3`.
- Lookup keys in `INBOUND_PALETTE_TYPES` (`protocols.ts`) and `OUTBOUND_PALETTE_TYPES` updated to match; affected test files updated.

### CC-5 TLS-required / users-required diagnostics missing for several protocols — ✅ MOSTLY CLOSED 2026-05-27

- **Audit re-verification:** `outbound-missing-tls` already covers all 7 TLS-required outbound types (trojan / naive / hysteria / hysteria2 / tuic / anytls / shadowtls). The audit's claim that hysteria/hysteria2/tuic were uncovered was incorrect — diagnostic exists at `diagnostics.ts:396-411`. Regression test added.
- **users-required gap fixed:** New `inbound-users-required` error covers all 8 authenticating inbound types (vmess / vless / trojan / naive / hysteria / hysteria2 / tuic / anytls) — previously only vmess/vless/tuic had per-user UUID checks via `validateVmessLikeUsers` and even those didn't error on an empty `users[]`.
- **service derp:** `derp-service-needs-tls` warning already exists at `diagnostics.ts:211`. Scaffold still doesn't seed `tls: { enabled: true }` — see service-derp row below for that piece.

### CC-6 Canvas port action-gating not honoured — ✅ CLOSED 2026-05-27

- ~~`graph.ts:313` and the equivalent dns-rule block create outbound/dns-server edges regardless of `action`.~~ Now gated. Route rule outbound edge renders only when `action ∈ {"", "route", "bypass"}`; dns rule server edge renders only when `action ∈ {"", "route", "evaluate"}`. Other actions (reject/sniff/route-options/hijack-dns/resolve/predefined/respond) suppress the dangling reference visually.
- **Regression test:** `tests/domain.test.ts` — "hides route-rule outbound canvas edge when action is not route/bypass" + "hides dns-rule server canvas edge when action is not route/evaluate".

### CC-7 Platform / channel badges declared in code but not surfaced on Palette — ✅ CLOSED 2026-05-27

- ~~`redirect`, `tproxy`, `hysteria-realm` still show `status: "setup"` on the Palette instead of a gated badge with the correct gate reason.~~ Labels now carry the gate inline: `Redirect (Linux only)`, `TProxy (Linux only)`, `Resolved Server (Linux only)`, `Resolved (Linux only)`, `Hysteria Realm (1.14 testing)`, `DERP (with_tailscale)`, `Tailscale Server (with_tailscale)`, `Tailscale (with_tailscale)` endpoint, `Tor (with_tor)`. Status stays `setup` so the items remain addable; the suffix is visible at-a-glance in the search list and screen-reader-friendly.

## Node-Specific P0 Defects

Grouped by family. Each row is one verified delta from running the audit; line numbers are approximate (codebase moves).

### Settings

| Node | Defect |
| --- | --- |
| settings-log | All claims verified; only a P1 idea ("log.level enum value validation") absent — not blocking. |
| settings-ntp | ✅ ~~NTP detour canvas edge never generated~~ — fixed 2026-05-27; `graph.ts` now emits `edge:settings-ntp-detour:<tag>` when `config.ntp.detour` is set, and `SbcNode.tsx` exposes a `dial-detour` output port on `kind === "settings"` + `type === "ntp"` so the connection is visible. Canvas title still says "Ntp" (path-capitalised) — minor cosmetic, not blocking. |
| settings-certificate | ✅ ~~`Inspector.tsx:1998` uses `toList`/`fromList` (comma split) for `certificate[]`~~ — fixed 2026-05-27; the PEM textarea now splits on `\n{2,}` (blank line between PEM blocks per the standard) and trims whitespace per block, preserving multi-line bodies and trailing newlines. `certificate_path[]` / `certificate_directory_path[]` still use comma-separated input (file paths normally don't contain commas; OK). Missing diagnostics for `store: "chrome"` 1.13+ gate and the 1.12+ `certificate` block channel gate. |
| settings-experimental | `experimental.v2ray_api.stats.inbounds` / `outbounds` / `users` not rendered (only `listen` + `stats.enabled`). No v2ray stats tag-existence diagnostics. Palette sub-entries `experimental-cache-file` etc. have no `createFromPalette` handler (clicking is a no-op). `SbcNode.tsx` `iconMap["settings"]` ignores the experimental icon override. |

### Hub

| Node | Defect |
| --- | --- |
| hub-route | ✅ ~~5 platform fields missing~~ — fixed 2026-05-27. ✅ ~~sharedFieldRegistry.ts:200 unconditionally pushes http-client + neighbor groups~~ — fixed 2026-05-27, `sharedGroupsForEntity` now takes a `channel` argument and hides `http-client` + `neighbor` groups on stable channel (covers route hub, route-rule, dns-rule). Inspector passes the current channel. |
| hub-dns | No embedded `fakeip` editor in the dns hub branch. `optimistic` / `timeout` (testing 1.14) have no channel gate. |

### Rules

| Node | Defect |
| --- | --- |
| rule-route-rule | ✅ ~~`action === "route-options"` sub-form not implemented~~ — fixed 2026-05-27; Inspector now renders a `Route options` fieldset (override_address / override_port / network_strategy / fallback_delay / udp_disable_domain_unmapping / tls_fragment) whenever the rule's action is "route" or "route-options". All six fields added to routeRulePrimaryFields so AdvancedScalarFields no longer double-renders them. This also gives 1.11-D users a concrete migration target. Deprecated `geosite` / `source_geoip` / `geoip` still in `routeRuleAdvancedFields`. `inbound` / `rule_set` references still free-text via `RuleListField`. ✅ canvas outbound port action-gating fixed under CC-6. |
| rule-dns-rule | ✅ ~~Phantom `dns-rule-action` Palette kind still present~~ — removed 2026-05-27; `dns/rule_action.md` now mapped to "no direct palette" (action lives inside the dns-rule Inspector). Canvas dns-server port gating fixed under CC-6. Missing 1.13 stable fields `interface_address`, `network_interface_address`, `default_interface_address`. `package_name_regex` (1.14 testing) absent. `evaluate` / `respond` / `route-options` action sub-forms not rendered. |

### Rule-set

| Node | Defect |
| --- | --- |
| rule-set-local | ✅ ~~`SbcNode.tsx:169` returns `download-detour` port for all rule-set kinds~~ — fixed 2026-05-27; SbcNode now returns an empty output port array unless `type === "remote"`, so inline and local rule-set nodes no longer expose a dangling `download-detour` wire. ✅ Palette three entries already landed. |
| rule-set-remote | `http_client` only exposes a string select — cannot edit the inline object form. No `missing-rule-set-format` diagnostic for non-standard URL extensions. Palette label still generic "Rule Set" instead of "Remote Rule Set". |
| rule-set-inline | ✅ ~~hardcoded to remote~~ — fixed. ✅ ~~Inline node still shows `download-detour` port~~ — fixed 2026-05-27; SbcNode suppresses the port for inline/local rule-sets. Canvas subtitle still generic. |

### Inbound

| Node | Defect |
| --- | --- |
| inbound-direct | `network`, `override_address`, `override_port` not in `inboundHandledFields` (lines 135-160) — drop to AdvancedScalarFields as raw inputs instead of dedicated select/number controls. |
| inbound-mixed | Palette `kind: "mixed"` violates `inbound-*` prefix (CC-4). `set_system_proxy` toggle not in inbound block. `address`/`auto_route` shown despite mixed not supporting them (CC-1). |
| inbound-socks | `address`/`auto_route` shown (CC-1). |
| inbound-http | `address`/`auto_route` shown (CC-1). No `set_system_proxy` platform restriction warning. |
| inbound-shadowsocks | ✅ ~~`method` enum not first-class for inbound~~ — fixed 2026-05-27; Inspector renders a full 13-entry method select (2022 + AEAD + legacy stream cipher) inside `entityType === "shadowsocks"` inbound block, and `method` added to `inboundHandledFields` so AdvancedScalarFields doesn't double-render. `users[]` rendered via INBOUND_USER_SCHEMAS. `password`, `destinations[]`, `network`, `managed` still fall through to AdvancedScalarFields. |
| inbound-vmess | UUID **generate button missing** inside users repeater (uuid is sensitive-masked only). `protocols.ts:175` reverse map says `vmess: "vmess-in"` but Palette kind is `"inbound-vmess"` — any code path using the reverse lookup will fail. alterId deprecation warning exists in diagnostics but not inline next to the field. |
| inbound-trojan | No `entityType === "trojan"` dedicated block in inbound — users/fallback/fallback_for_alpn have no protocol-specific UI. TLS-required diagnostic absent for trojan inbound. Listen 5 fields not surfaced. TLS card missing `key_path` (server-side). |
| inbound-naive | `network` and `quic_congestion_control` enum selectors missing. users non-empty check doesn't include naive. |
| inbound-hysteria | Inbound block (Inspector.tsx:2248-2520) has **no v1 deprecation banner** — the banner only exists in the outbound block (line 2629). Palette label says "Hysteria" without "(v1, legacy)" suffix. `up_mbps`/`down_mbps` have no protocol-specific "Required" annotation. |
| inbound-hysteria2 | `masquerade` field completely absent (grep empty). `brutal_debug` falls to AdvancedScalarFields. No TLS-required diagnostic block. obfs/min_packet_size/max_packet_size for gecko only via JsonField fallback. |
| inbound-tuic | **`users` array completely invisible** in tuic block (line 3028) — only congestion_control/udp_relay_mode/udp_over_stream rendered. `auth_timeout`, `heartbeat`, `zero_rtt_handshake` missing. No `tuic-inbound-needs-tls` diagnostic. |
| inbound-vless | `users[].flow` in repeater is plain text instead of enum select — accepts illegal values. |
| inbound-shadowtls | **No version select in inbound** (falls to AdvancedScalarFields as text). No version-gated visibility for v2/v3 password vs users. `handshake_for_server_name` no repeater/UI. No version-validation diagnostics. |
| inbound-anytls | **`padding_scheme[]` completely invisible** (not in `inboundHandledFields`). `address`/`auto_route` shown (CC-1). No 1.12+ version gate on Palette. |
| inbound-tun | Missing UI for `include_uid[]` / `exclude_uid[]` / `include_uid_range[]` / `exclude_uid_range[]` / `include_interface[]` / `exclude_interface[]` / `include_android_user[]` / `include_package[]` / `exclude_package[]`. `auto_redirect` and its 5 companion fields not in Inspector. ✅ ~~`createInbound` scaffold is IPv4-only~~ — fixed 2026-05-27, scaffold now seeds dual-stack `["172.19.0.1/30", "fdfe:dcba:9876::1/126"]` matching the official 1.13 template. |
| inbound-redirect | No `redirect-platform-warning` diagnostic in `diagnostics.ts`. `address`/`auto_route` rendered (CC-1). Palette `status` still `"setup"` instead of gated. |
| inbound-tproxy | Palette has no "Linux only" status. `network` not in `inboundHandledFields` → no enum select for tproxy. |

### Outbound

| Node | Defect |
| --- | --- |
| outbound-direct | `domain_strategy` 1.12+ deprecation diagnostic missing (`diagnostics.ts:589`). |
| outbound-block | ✅ ~~No canvas deprecation badge~~ — fixed 2026-05-27, SbcNode renders an amber "deprecated" pill on the title bar and dims the card border when `kind === "outbound" && type === "block"`. ✅ `outbound-block-deprecated` diagnostic landed under 1.11-A. |
| outbound-socks | `network` falls back to text (no enum). `username`/`password` not first-class for socks branch. |
| outbound-http | **`headers` map invisible** — not in `outboundHandledFields`; `AdvancedNonScalarFields` skips object fields. `path` not in `outboundHandledFields` → new HTTP outbounds drop it on round-trip. |
| outbound-shadowsocks | ✅ ~~`password` not rendered in shadowsocks block~~ — false positive in original audit; shared password block at Inspector.tsx:2730 already renders `Password` (SensitiveTextField) for shadowsocks/trojan/naive/tuic/hysteria2/anytls/shadowtls. Regression test in app.test.tsx ("renders Password as a first-class sensitive field for shadowsocks-like outbounds") locks this. ✅ `commands.ts network:"tcp"` removed under CC-3. `network` enum select absent in shadowsocks-specific sub-block — fall through to AdvancedScalarFields. `udp_over_tcp` / `multiplex` conflict diagnostic still absent. |
| outbound-vmess | `network` default in `commands.ts:319` still `"tcp"`. |
| outbound-trojan | `password` not in `outboundHandledFields:156-170` (only sensitive-user list). `network` default `"tcp"`. |
| outbound-naive | `username` no dedicated branch (degrades to Advanced). `quic_congestion_control` enum select missing. |
| outbound-hysteria | `up_mbps` / `down_mbps` not in `outboundHandledFields`. No `hysteria-tls-required` / `hysteria-v1-deprecated` diagnostics. obfs UI only in hysteria2 branch — not in hysteria. |
| outbound-hysteria2 | `up_mbps`/`down_mbps` not surfaced in outbound (only used inside multiplex.brutal). No `hysteria2-requires-tls` / `hysteria2-requires-password` diagnostic. |
| outbound-tuic | `uuid` + `password` + `network` not first-class for tuic branch. `network: "udp"` hardcoded in scaffold. No tuic-specific TLS-required / UUID diagnostics. `heartbeat`, `zero_rtt_handshake` degrade to Advanced. |
| outbound-vless | ✅ Clean. |
| outbound-shadowtls | `version` no enum select (drops to Advanced raw text). No version-conditional password visibility. No version-conditional warning diagnostic. |
| outbound-anytls | `idle_session_check_interval` / `idle_session_timeout` / `min_idle_session` missing from `outboundHandledFields`. No 1.12.0+ version gate on Palette. |
| outbound-ssh | Three-way auth mutual exclusion (`password` / `private_key` / `private_key_path`) has no diagnostic. 1.14 testing fields (`cipher`, `mac`, `kex_algorithm`) have diagnostics but **no editing controls** in Inspector. |
| outbound-tor | ✅ Clean. |
| outbound-selector | `compatible` array (`graph.ts:414-415`) limited to `["SOCKS","Direct","Block"]` — should expand to all proxy types. |
| outbound-urltest | `createOutbound("urltest")` scaffold doesn't seed `tolerance` / `idle_timeout` / `interrupt_exist_connections`. |

### DNS server

| Node | Defect |
| --- | --- |
| dns-server-local | `prefer_go` not in `dnsServerHandledFields` (line 205-221). `neighbor_domain` has no "Since 1.14.0 (testing)" annotation nor channel-gate diagnostic. |
| dns-server-hosts | ✅ ~~`path` strongly typed as `string`~~ — fixed 2026-05-27; Inspector renders a `Path(s)` comma-separated input only for `entityType === "hosts"`, parsing single vs. multi entries back into `string` vs. `string[]`. `DnsServerConfig.path` now types as `string \| string[]`. `predefined` and `headers` added to the type. Canvas detour port still renders for hosts despite `dnsServerDialTypes` excluding it. No `predefined` non-empty diagnostic. |
| dns-server-udp | ✅ Clean. |
| dns-server-tcp | ✅ ~~`missing-dns-server-address` diagnostic missing~~ — fixed 2026-05-27, `dns-server-missing-server` error fires for any udp/tcp/tls/https/quic/h3 DNS server that lacks a non-empty `server` string. |
| dns-server-tls | `certificate_provider` still rendered as free text instead of select. ✅ ~~`server` field has no required indicator/diagnostic~~ — fixed 2026-05-27 (covered by the new `dns-server-missing-server` error). |
| dns-server-https | ✅ ~~Scaffold writes non-existent field `address: "https://1.1.1.1/dns-query"`~~ — fixed 2026-05-27, `commands.ts` `createDnsServer("https")` no longer emits the deprecated `address`. `DnsServerConfig.headers` field still missing from `types.ts:38-45`. No `missing-server` diagnostic. |
| dns-server-quic | ✅ Clean. |
| dns-server-h3 | Palette kind still `dns-http3` (CC-4). `DnsServerConfig.headers` missing in types. No `domain_resolver`-required-for-domain diagnostic. |
| dns-server-dhcp | No diagnostic when `server.interface === ""`. |
| dns-server-fakeip | Legacy `dns-fakeip` Palette entry has no deprecation badge — users may pick it accidentally. Canvas subtitle stays generic. Two Palette entries (`dns-fakeip` / `dns-fakeip-server`) share the same `Blocks` icon. |
| dns-server-resolved | ✅ ~~`service` field has no Inspector control~~ — fixed 2026-05-27. Inspector resolved branch now renders a `Service` select (limited to `service:resolved` tags) plus an `accept_default_resolvers` toggle. `graph.ts` emits `edge:dns-server-service:<dns>:<service>` and SbcNode exposes matching ports (dns-server output + service:resolved input). Two new diagnostics: `dns-server-resolved-service-missing` (warning) and `dns-server-resolved-service-not-found` (error). |
| dns-server-tailscale | ✅ ~~`accept_default_resolvers` not in `dnsServerHandledFields`~~ — fixed 2026-05-27; rendered as a first-class toggle in the tailscale Inspector branch and added to `dnsServerHandledFields`. ✅ scaffold no longer seeds the dangling `endpoint`. `SbcNode.tsx` always renders outbound detour port; tailscale should suppress it. `accept_search_domain` (testing 1.14) has diagnostic but no UI. |

### Endpoint

| Node | Defect |
| --- | --- |
| endpoint-wireguard | ✅ ~~`peer.public_key` uses plain `<input>` — no sensitive masking~~ — fixed 2026-05-27; peer.public_key now wrapped in SensitiveTextField (matches peer.pre_shared_key). `address` is CSV via `toList`/`fromList`, no CIDR-tagged repeater. No wireguard-specific diagnostics (private_key / peers / peer.allowed_ips emptiness). `listen_port` / `workers` not in `endpointHandledFields`. |
| endpoint-tailscale | `auth_key` not wrapped in `SensitiveTextField` inside the tailscale block (lines 3606-3641) — it's in `endpointHandledFields` but doesn't render with masking. 14 fields (`ephemeral`, `hostname`, `exit_node`, `exit_node_allow_lan_access`, `relay_server_port`, `system_interface_name`, `system_interface_mtu`, etc.) drop to Advanced. `advertise_tags` and `system_interface` have no 1.13 channel gate — exporting on 1.12 target writes unknown fields. |

### Service

| Node | Defect |
| --- | --- |
| service-ssm-api | Canvas edge creation does not auto-set `managed: true` on the linked Shadowsocks inbound. Diagnostic warns post-hoc but won't auto-fix. |
| service-derp | ✅ ~~scaffold returns 8 fields with no `tls`~~ — fixed 2026-05-27. ✅ ~~Default `listen: "127.0.0.1"` inappropriate~~ — fixed 2026-05-27, scaffold now listens on `"::"` (all IPv4 + IPv6). `derp-service-needs-tls` diagnostic still fires for any imported derp without TLS. Inspector has no inline TLS-required banner. `config_path` still no required marker. `verify_client_url` / `mesh_with` / `stun` are `JsonField` only. |
| service-hysteria-realm | Palette `statusTitle()` falls back to generic gate text instead of "Requires sing-box 1.14 testing target". No `users` required diagnostic (no `hysteria-realm-user-name-required` / `-token-required`). Scaffold uses placeholder `"change-me"` token with no diagnostic prompting replacement. |
| service-ccm | `credential_path` / `usages_path` scaffold writes empty strings instead of `undefined`. No ccm-specific diagnostics (public listen warning, empty users, missing detour). Canvas subtitle stays static "Claude Code multiplexer". |
| service-ocm | ✅ Clean. |
| service-resolved | ✅ ~~`SbcNode.tsx` returns empty port array for resolved~~ — fixed 2026-05-27, service:resolved now has a `dns-server` input port. Canvas edge from dns-server:resolved to service:resolved emitted by graph.ts. `DnsServerConfig.path` widened earlier; `service` is read via the broader `[key: string]: unknown` escape but a regression test verifies edge generation. Store-side `dns-server-service → service:resolved` connect handler still pending. |

## Suggested Repair Plan

Order this work to maximise nodes-closed-per-PR.

1. **CC-1 — gate `address` / `auto_route` on tun** — touches `Inspector.tsx:2268-2282` only; closes a P0 on ~15 inbound nodes.
2. **CC-2 — first-class controls for `password` / `uuid` / `network` / `users` across affected protocols** — biggest single chunk; ~12 nodes.
3. **CC-3 — strip `network: "tcp"` / `"udp"` defaults from scaffolds** — touches `commands.ts` only; behavioural fix on ~5 outbound nodes.
4. **CC-4 — Palette kind rename `mixed → inbound-mixed`, `dns-http3 → dns-h3`** — touches `Palette.tsx` + tests; closes naming P0.
5. **CC-5 — TLS-required / users-required diagnostics for trojan / tuic / hysteria / hysteria2 / naive / derp** — `diagnostics.ts` only.
6. **CC-6 — action-gate canvas ports in `graph.ts`** for route-rule + dns-rule.
7. **CC-7 — Palette badge surfacing** for redirect / tproxy / hysteria-realm gates.
8. Then split node-specific P0s into per-family atomics: settings (4), hub (1), rule (2), inbound (~10), outbound (~12), dns-server (~8), endpoint (2), service (4).

## Method

- 7 batches × 10 / 10 / 10 / 10 / 10 / 10 / 6 = 66 agents, each running in parallel within a batch.
- Each agent: read `docs/ui-reviews/<node>.md` + `docs/claude/<node>.md` to extract claimed P0/P1 findings only (not to trust them), then grep `src/components/Inspector.tsx`, `src/components/Palette.tsx`, `src/components/SbcNode.tsx`, `src/canvas/graph.ts`, `src/domain/commands.ts`, `src/domain/diagnostics.ts`, `src/domain/sharedFieldRegistry.ts`, `src/domain/types.ts`, `src/domain/protocols.ts`, `src/state/useProjectStore.ts`.
- Each agent reported only deltas; "all good" findings collapsed to "remaining N already landed".
- Five nodes returned zero deltas: `outbound-vless`, `outbound-tor`, `dns-server-quic`, `dns-server-udp`, `service-ocm`.

When a delta is closed in code, drop the row from this doc and update the matching `docs/ui-reviews/<node>.md` + `docs/claude/<node>.md` status comment.
