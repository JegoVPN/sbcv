# outbound-ssh — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
The SSH outbound is now in strong shape: a dedicated, first-class Inspector block exposes all 13 protocol fields (10 stable + cipher/mac/kex) plus Dial Fields, with sensitive masking, an auth-mutex warning, and stable-channel testing-only gating — so pass-1's headline P0s (host_key invisible, password plaintext, fields buried in Advanced) are all stale/resolved. Palette, canvas node, and the full upstream/downstream link set are correct per the official relationship model. Two real defects remain: a false-positive `server_port` "required" error that contradicts the upstream "22 if empty" default, and `private_key` rendered as a single-line input that cannot hold a real multi-line PEM key.

## 1. Left Palette
- Present: `Palette.tsx:169` — `{ label: "SSH", kind: "ssh-out", icon: Server, docsUrl: docs("outbound/ssh/"), status: "setup" }`. Under the "Outbounds" group — correct category.
- Label "SSH" correct; docs URL `outbound/ssh/` correct.
- `status: "setup"` is actionable (clickable): `canActivate` includes `"setup"` (`Palette.tsx:279-287`); clicking calls `createFromPalette("ssh-out")`. **Pass-1's claim that the badge is "non-clickable / no add affordance" (ui-reviews/outbound-ssh §Left) is STALE.**
- Map `ssh-out → ssh` correct (`protocols.ts:18`, `:40`); preferred tag `ssh-out` (`protocols.ts:163`).
- Icon `Server` shared with other nodes — acceptable, no finding.

## 2. Canvas Node
- Node kind `"outbound"`, type `"ssh"`; title = tag, subtitle = `ssh <server>:<port>` (`graph.ts:395`, `:401-402`). Good summary.
- Titlebar leads with `"{kind} / {type}"` = `outbound / ssh` (`SbcNode.tsx:291`) and the tag sits below in `sbc-node__title` (`SbcNode.tsx:388`). Both pass-1 docs asked for human-name-first; type-first titlebar is a minor PM nit, not a regression. [P2]
- Status badge driven by diagnostics for `/outbounds/{index}` (`graph.ts:404`); deprecated badge not applied to ssh (correct — ssh is not deprecated).
- Ports: SSH is a plain `outbound` node, so `portEndpointsForNode` yields the standard outbound port set — inputs: route-final, route-rule, selector-group, urltest-group, dns-detour, detour-target, service-detour, rule-set-download; output: `dial-detour` (its own detour). `outbound-detour` source excludes only `block/selector/urltest/dns` (`portRelationRegistry.ts:106`), so ssh correctly KEEPS the dial-detour output. No TLS/transport/multiplex/quic ports exist for ssh (those are not ports; they are Inspector cards and are correctly gated off — see §4). Ports correct.

## 3. Upstream/Downstream Links
Official model: an ssh outbound may be referenced by route `final`, route `rules[].outbound`, selector/urltest `outbounds[]`, dns `servers[].detour`, other outbound/endpoint/service/rule-set/ntp dial `detour`; and itself emits one dial `detour` output. All present and correct:
- referenceRegistry `outbound` paths cover `/route/final`, `/route/rules/*/outbound`, `/outbounds/*/outbounds`, `/outbounds/*/default`, `/outbounds/*/detour`, `/dns/servers/*/detour`, `/endpoints/*/detour`, `/services/*/detour`, `/route/rule_set/*/download_detour`, `/ntp/detour` (`referenceRegistry.ts:334`). Complete.
- portRelations inbound edges to an outbound node: `route-final`, `route-rule`, `selector`, `urltest`, `dns-server-detour`, `outbound-detour`, `service-detour-ccm/ocm`, `rule-set-download`, `endpoint-detour`, `settings-ntp-detour` (`portRelationRegistry.ts:93-115`). Outbound's own detour output: `outbound-detour` source (`:106`). Complete.
- changeEntityType preserves `detour` when retyping to ssh (`commands.ts:914-919`) — link survives a type switch. Correct.
- No missing / extra / wrong links for ssh. `service-detour` is restricted to ccm/ocm services only, matching upstream (derp/ssm/resolved have no outbound detour). Correct.

## 4. Right Inspector (fields)
Dedicated `entityType === "ssh"` block at `Inspector.tsx:3527-3629`; all ssh fields are in `outboundHandledFields` (`Inspector.tsx:178-211`) so none leak into the generic Advanced accordion. **The entire pass-1 "silently invisible / buried in AdvancedScalarFields" section is STALE.**

| Official field | Type | Req | UI control | Status |
|---|---|---|---|---|
| `server` | string | **Yes** | Text input `Inspector.tsx:3376-3384` | Present; no inline "Required" marker — diagnostics enforce it (`diagnostics.ts:534-543`). [P2] |
| `server_port` | number | no (def 22) | Number input w/ placeholder 22 `Inspector.tsx:3385-3414` | Present, good default hint — but flagged as **error** when empty/cleared, contradicting upstream. [P1] |
| `user` | string | no (def root) | Text input `Inspector.tsx:3529-3535` | Present. Default seeded `root` (`commands.ts:431`). No `root` placeholder hint when cleared. [P2] |
| `password` | string | no | SensitiveTextField (masked, reveal) `Inspector.tsx:3536-3540` | Present + masked. Resolves pass-1 plaintext P1. |
| `private_key` | string (PEM, multi-line) | no | SensitiveTextField = single-line `<input>` `Inspector.tsx:3551-3555` | Present + masked, but **single-line** — cannot hold a real multi-line PEM block. [P1] |
| `private_key_path` | string | no | Text input `Inspector.tsx:3541-3550` | Present, good placeholder. |
| `private_key_passphrase` | string | no | SensitiveTextField (masked) `Inspector.tsx:3556-3560` | Present + masked. |
| `host_key` | string[] | no (any if empty) | Newline textarea → string[] `Inspector.tsx:3561-3573` | Present, round-trips to array. Resolves pass-1 P0. |
| `host_key_algorithms` | string[] | no | CSV input → string[] `Inspector.tsx:3574-3583` | Present. Resolves pass-1 P0. |
| `client_version` | string | no (random) | Text input `Inspector.tsx:3584-3590` | Present. No "random if empty" hint. [P2] |
| `cipher` (1.14) | string[] | no | CSV input → string[] `Inspector.tsx:3595-3605` | Present; testing-only banner above `:3591-3594`. |
| `mac` (1.14) | string[] | no | CSV input → string[] `Inspector.tsx:3606-3616` | Present. |
| `kex_algorithm` (1.14) | string[] | no | CSV input → string[] `Inspector.tsx:3617-3627` | Present. |
| Dial Fields | object | no | SharedFieldCards "Dial" (`sharedFieldRegistry.ts:150,179`) | Present (ssh ∈ outboundDialTypes). |

Non-official surfaces correctly absent for ssh: no TLS / multiplex / transport / quic / udp-over-tcp cards (ssh not in those sets, `sharedFieldRegistry.ts:151-155`). Correct.

Extra correctness checks:
- Auth mutual-exclusion warning exists (`diagnostics.ts:781-795`, `ssh-auth-mutex`) — addresses pass-1 P1 guidance, though there is still no auth-method selector (informational; warning is sufficient).
- Stable-channel gating for cipher/mac/kex (`diagnostics.ts:797-826`) emits `ssh-*-testing-only` warnings — addresses pass-1's "no version gate" P1.
- No invalid-JSON writes: all array fields write real `string[]` (or `undefined` when empty), not raw strings.

## Findings (prioritized)
- **[P1]** `server_port` false-positive error. Upstream: "22 will be used if empty" (ssh.md:42-44) → optional. But `diagnostics.ts:544-553` treats ssh (member of `proxyOutboundTypes`, `:512`) as **error** unless `server_port` is a number 1–65535. Clearing the port (legal config) raises a spurious blocking error and flips the canvas node to error status. Fix: exclude ssh from the mandatory-port branch, or only warn, or treat empty as the documented default 22. (`src/domain/diagnostics.ts:544-553`, set defined `:499-513`)
- **[P1]** `private_key` is single-line, unusable for real PEM. `Inspector.tsx:3551-3555` renders `private_key` via `SensitiveTextField`, whose control is `<input type=password/text>` (`Inspector.tsx:655-661`) — newlines cannot be entered/pasted, so an inline OpenSSH PEM key is truncated. Was pass-1 P0; the dedicated field + masking landed but the multi-line requirement was not met. Fix: use a masked `<textarea>` (or toggle-to-textarea) preserving `\n`. (`src/components/Inspector.tsx:3551-3555`; control `:639-673`)
- **[P2]** `server` has no inline "Required" marker in the Inspector (`Inspector.tsx:3376-3384`); only the diagnostic enforces it. Add a required asterisk/hint for the one upstream-Required field. (`src/components/Inspector.tsx:3376-3384`)
- **[P2]** Missing default hints: `user` (no `root` placeholder, `Inspector.tsx:3531-3534`) and `client_version` (no "random if empty" placeholder, `Inspector.tsx:3585-3589`). Upstream documents both defaults. (`src/components/Inspector.tsx:3531-3534`, `:3585-3589`)
- **[P2]** Canvas titlebar leads with `outbound / ssh` rather than the human tag (`SbcNode.tsx:291` vs title at `:388`); both pass-1 docs requested human-name-first. Cosmetic. (`src/components/SbcNode.tsx:291`)
- **[P2]** Testing-only banner for cipher/mac/kex is rendered unconditionally (`Inspector.tsx:3591-3594`), not gated on `channel`; testing-channel users see a redundant "1.14+ only" note. The diagnostics gate is correctly channel-aware (`diagnostics.ts:797`), so this is purely informational noise. (`src/components/Inspector.tsx:3591-3594`)

Pass-1 staleness summary: `docs/ui-reviews/outbound-ssh.md` and `docs/claude/outbound-ssh.md` predate the dedicated SSH Inspector block and diagnostics. Their P0s (host_key / host_key_algorithms invisible, password plaintext, fields buried in Advanced) and the "Palette setup badge does nothing" claim are all resolved. Their `private_key` multi-line P0 is only partially resolved (now first-class + masked, still single-line).

SUMMARY: 0 P0, 2 P1, 4 P2.
