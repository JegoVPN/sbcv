# dns-server-hosts — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The two pass-1 P0s (missing `predefined` editor, scalar-only `path`) are now FIXED: the Inspector ships a hosts-gated multi-path input and a structured predefined-hosts (domain to IPs) repeater, `DnsServerConfig` models both fields, and a `dns-server-hosts-empty` diagnostic exists with test coverage. The node is solid end-to-end. The one real remaining defect is the canvas: hosts still renders a writable "Detour outbound" output port and an edge dropped onto it writes a `detour` field that is invalid for `type: "hosts"` with no diagnostic to catch it. Pass-1 is now stale on nearly every Inspector/type claim.

## Official model (upstream hosts.md, since 1.12.0)

Exactly 4 writable fields. No dial/detour/tls/server/server_port/endpoint/service.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `type` | `"hosts"` | yes | — | discriminator |
| `tag` | string | yes (for refs) | — | referenced by `dns.final` + `dns.rules[].server` |
| `path` | `string \| string[]` | no | `/etc/hosts` (Win: system32 hosts) | list of hosts files; single item may be a bare string |
| `predefined` | `Record<string, string \| string[]>` | no | — | inline domain to IP(s); value may be one IP string OR array (dual-stack) |

## 1. Left Palette

Present and correct. `Palette.tsx:85` — `{ label: "Hosts Server", kind: "dns-hosts", ..., docsUrl: docs("dns/server/hosts/"), status: "setup" }`. Maps `dns-hosts -> "hosts"` (`protocols.ts:93`); creatable (`protocols.ts:108`); preferred tag `hosts-dns` (`protocols.ts:192`). Category "DNS", label clear, docs URL matches the official path. `status:"setup"` is activatable (`Palette.tsx:280-287`) and creates the node. Minor: the "Setup" badge + tooltip "Add … setup draft to canvas" (`Palette.tsx:269`) undersells a fully-supported type — cosmetic only.

## 2. Canvas Node

Rendered as generic `dns-server` (`graph.ts:531-572`). Titlebar `dns-server / hosts` (`SbcNode.tsx:291`); title = tag; bottom pill shows type (`SbcNode.tsx:408-411`). Status from diagnostics (`graph.ts:544`), so `dns-server-hosts-empty` and `duplicate-tag` flip the node to warning/error. Good.

Ports come from the registry via `portEndpointsForNode` (`SbcNode.tsx:94-108`), not hardcoded — pass-1's "lines 88-93/170-174" port citations are STALE.
- Input ports for hosts: `dns` (DNS final server, rel `dns-final` `portRelationRegistry.ts:98`) and `dns-rule` (rel `dns-rule` `:101`). Both correct — hosts can be `dns.final` and a rule `server`.
- Output ports for hosts: `outbound` "Detour outbound" from rel `dns-server-detour` (`:105`). The source endpoint has NO `nodeType`/`nodeTypeExcludes`, so it renders for ALL dns-server types including hosts. `endpoint` (tailscale) and `service` (resolved) ports are correctly type-gated and do NOT show for hosts. So hosts wrongly shows ONE invalid output port. See Finding P1-1.

Subtitle is the generic `"{type} dns server"` (`graph.ts:543`); it does not summarize path count / predefined-host count (pass-1 §2 ask). Cosmetic. See P2-1.

## 3. Upstream/Downstream Links

Official relationship model for a hosts server: it is a referenced target only (no downstream). Referenced by `dns.final`, `dns.rules[].server`, and tag-referencing resolver fields (`route.default_domain_resolver`, dial `domain_resolver`).

- portRelationRegistry: inbound refs `dns-final` (`:98`) and `dns-rule` (`:101`) — correct and present.
- referenceRegistry `dns-server` entry (`referenceRegistry.ts:339-343`) tracks `/dns/final`, `/dns/rules/*/server`, `/route/default_domain_resolver`, `*/domain_resolver` for rename/delete. Correct and complete for hosts as a referenced tag.
- EXTRA/wrong link: `dns-server-detour` (`:105`) exposes a writable OUTGOING `detour` link from hosts. Upstream hosts has no detour (confirmed: `sharedFieldRegistry.ts:156` excludes hosts from `dnsServerDialTypes`; test `config-doc-capability.test.ts:261`). The relation should exclude non-dial dns types. See P1-1.
- No MISSING links for hosts.

## 4. Right Inspector (fields)

dns-server branch at `Inspector.tsx:4215-4549`. Tag input `:2094-2107`; Type select `:2128-2135`.

| Official field | UI state | Control | Required marker | Default | Validation | Verdict |
|---|---|---|---|---|---|---|
| `type` | exposed | select of `CREATABLE_DNS_SERVER_TYPES` (`:2128`) | n/a | "hosts" on create (`commands.ts:606`) | switching rebuilds via `createDnsServer`, keeps detour/endpoint only where relevant (`commands.ts:921-934`) | OK |
| `tag` | exposed | text, rename-on-blur (`:2094-2106`) | none (no per-hosts "tag required" diag) | `hosts-dns` | `duplicate-tag` only (`diagnostics.ts:25-35`) | OK (see P2-2) |
| `path` | exposed, hosts-gated | text, comma-split list (`:4316-4351`) | none | `/etc/hosts` on create | empty->undefined, 1->string, many->`string[]` (`:4332-4338`); round-trips (test `app.test.tsx:1070`) | OK — pass-1 P0 FIXED |
| `predefined` | exposed, hosts-gated | structured repeater domain + IPs (`:4380-4457`) | none | absent on create | empty rows pruned, deleted-when-empty (`:4385-4386`); reads string|array, writes `string[]` (`:4388-4392`) | OK — pass-1 P0 FIXED (see P2-3) |

Field hygiene: `path` + `predefined` (plus tag/type) are in `dnsServerHandledFields` (`Inspector.tsx:241-260`), so neither leaks into AdvancedScalar/NonScalar fallbacks (`:4547-4548`). No invalid-JSON write path for hosts (the comma inputs always produce string/array/undefined; no freeform JSON textarea is reachable for the 4 official fields). No UI fields exist beyond the official model for hosts. No sensitive-masking needed (no secrets in hosts). All correct.

Type model (`types.ts:38-47`): `path?: string | string[]` and `predefined?: Record<string, string[]>` now present — pass-1's "path is string-only / predefined absent" is STALE. Residual: `predefined` value type is `string[]` only; upstream also allows a bare `string` per value (P2-3). The `DnsServerConfig` also carries `detour`/`endpoint`/`service`/`headers` etc. shared across all dns types — fine structurally, but see P1-1 for the canvas exposing `detour` on hosts.

## Findings (prioritized)

- [P1-1] Hosts renders a writable "Detour outbound" port and accepts a detour edge, writing an invalid `dns.servers[hosts].detour`. `portRelationRegistry.ts:105` (`dns-server-detour` source endpoint lacks a type filter) -> port shows via `SbcNode.tsx:95`; `CanvasWorkspace.tsx:69-79` accepts the connection as `writable`; `graph.ts:551-553` would even render the resulting edge. No diagnostic rejects a `detour` on a non-dial dns type (`diagnostics.ts:411-419` only flags dangling detour refs). Fix: add `nodeTypeExcludes: ["hosts","fakeip","tailscale","resolved","mdns"]` (or a positive `dnsServerDialTypes` gate) to the `dns-server-detour` SOURCE endpoint so the port/connection is suppressed for hosts; optionally add a semantic diagnostic for `detour` on excluded types. (Pass-1 called this "cosmetic/P1"; it is actually an invalid-write path.)

- [P2-1] Canvas subtitle for hosts is the generic `"{type} dns server"`; does not surface path count / predefined-host count. `graph.ts:543`. Low-value polish from pass-1 §2.

- [P2-2] No hosts-specific "tag required" diagnostic; an empty-tag hosts server (only reachable via manual JSON edit, since `addDnsServer` always assigns a tag — `commands.ts:451-457`) is silently un-referenceable. Consider a generic dns-server missing-tag check. `diagnostics.ts:1072-1089`.

- [P2-3] `predefined` value normalization: upstream permits `string | string[]` per value; the editor reads either but always writes `string[]` (`Inspector.tsx:4388-4392,4402-4408`) and `DnsServerConfig.predefined` is `Record<string, string[]>` (`types.ts:45`). Importing `{"www.google.com":"127.0.0.1"}` displays fine but any edit rewrites it to `["127.0.0.1"]`. Still valid sing-box JSON; only a cosmetic divergence from the doc's scalar example. Optionally collapse single-IP arrays on write and widen the type to `string | string[]`.

SUMMARY: 0 P0, 1 P1, 3 P2.
