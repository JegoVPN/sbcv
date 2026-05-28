# sbc-ui pass-2 review — master summary

Three review passes were run against the current code. Source of truth: **sing-box testing 1.14**
(`docs/upstream/sing-box/testing/...`) for conformance; **our own code + UX principles** for the feature pass.

| Pass | Scope | Files | P0 | P1 | P2 |
|---|---|---|---|---|---|
| A. Node conformance | 66 nodes × {palette, canvas, links, inspector fields} vs official model | `<node>--claude.md` | 21 | 154 | 234 |
| B. Relationship audit | whole port/edge + reference-integrity graph | `_RELATIONSHIPS.md` | 0 | 11 | 10 |
| C. Feature UX | 6 interaction areas, "can a new user understand & use it" | `_FEATURE-*.md` | 17 | 26 | 20 |

Counts overlap across passes (the same root cause is reported per-node and again as a theme). The
**de-duplicated systemic issues** below matter more than the totals. 13 of 66 nodes carry a P0; the
two highest-leverage surfaces are the **shared Inspector cards** and the **canvas interaction model**.

---

## Systemic issues (de-duplicated, ranked by blast radius)

### Correctness — these export invalid or wrong config
- **T1. Shared TLS/multiplex/transport cards are not split by direction.** One field list serves inbound
  and outbound (`Inspector.tsx:1502-1547`, no `ref.kind` branch). Inbound nodes (vless/vmess/trojan/…)
  render client-only fields (`insecure`, `disable_sni`, `utls.*`, `fragment`, Reality client
  `public_key`/`short_id`) and omit server-only ones (`client_certificate*`, ech `key`). Writing these
  onto an inbound yields config sing-box rejects. *Biggest single conformance root cause.*
- **T2. Protocol controls scoped to `ref.kind==="outbound"` only.** TUIC/Hysteria/AnyTLS inbound
  variants have no first-class controls; their fields fall through to the Advanced free-text editor.
- **T3. Type-switch is silently destructive.** `changeEntityType` (`commands.ts:902-968`) rebuilds the
  node keeping only `tag`, wiping server/port/uuid/users/tls with no confirm — via an innocuous-looking
  dropdown (`Inspector.tsx:2113`).
- **T4. `JsonField` writes invalid JSON as a raw string** with no parse feedback
  (`Inspector.tsx:808-813`); the inline rule-set editor does it correctly, this one doesn't.
- **T5. No required-field markers and no pre-export validation gate** anywhere — empty `server`/`uuid`
  export silently; export (`TopBar.tsx:98`) is diagnostics-unaware.
- **T6. "Add" seeds blank `{"": ""}` rows** in header/torrc repeaters (`Inspector.tsx:3797/3857/4519`)
  that export as real empty keys; inconsistent with hosts/ccm-ocm repeaters that seed valid placeholders.
- **T10. Version-gating is broken.** `computeDiagnostics` passes only `channel`, never `version`, to
  `validateConfig` (`useProjectStore.ts:134-135`). 1.12 and 1.13 produce identical diagnostics → 1.13+
  features export to a 1.12 target with no warning **and** 1.13-valid features (`advertise_tags`,
  `system_interface`, `certificate.store=chrome`) false-positive on 1.13-stable.

### Reference integrity — rename/delete leaves dangling refs
- **T11. `referenceRegistry` is incomplete.** Missing paths: inbound `detour`, shadowtls
  `handshake.detour`, tun `route_address_set`/`route_exclude_address_set`, route-rule `resolve.server`,
  derp `mesh_with`/`verify_client_url` detours. Renaming/deleting a referenced node silently breaks them.
- **T13. Dial-detour port relations lack type guards** (`portRelationRegistry.ts:105/106`): DNS servers
  that take no detour (fakeip/hosts/resolved) still show a "Detour outbound" port; `block` accepts a
  detour-target input (meaningless "detour through block").
- **T14. Endpoints' outbound-half is unmodeled** — endpoint tags share sing-box's outbound namespace but
  have no input ports / aren't in the outbound reference paths, so they can't be wired as
  route/selector/DNS targets.

### Comprehension — why "用户使用不明白" (the user's core concern)
- **T7. Port icons are inconsistent** (the icon question). Glyphs are hand-authored per endpoint
  (`portRelationRegistry.ts`), rendered verbatim (`SbcNode.tsx:104`); the same fact "references an
  outbound" shows `route`/`server`/`network`/`layers`/`git-branch` on different nodes, and an edge's two
  ends differ. Fix: derive icon from the relation/target-kind, not per endpoint.
- **T8. 16 of the "+" compatible chips are dead no-ops.** Groups advertise ~18-24 chips
  (`graph.ts:405-428`) but `createCompatible` handles only 8 kinds (`useProjectStore.ts:801-808`).
  Clicking the rest does nothing; the always-visible mid-card "+" blindly creates `compatible[0]` with no
  preview (`SbcNode.tsx:399-400`). Looks broken to a newcomer.
- **T9. Warning-state nodes show the green "valid" checkmark** (`SbcNode.tsx:386/413`); only a subtle
  amber border differs. Users can't see warnings. The footer "✓ N" is the *compatible-kind count*, not a
  validity count (`SbcNode.tsx:436`) — misread as "N problems/N valid".
- **T12 (palette). The Add Library opens empty** (sections collapsed), ~10 disabled "Docs" rows look
  addable but do nothing, 9 jargon status badges (Setup/Table/Gated/…) are unguessable, and search skips
  Templates — the most newcomer-friendly content.
- **Drag-to-connect is undiscoverable** (handles `opacity:0`), invalid drops fail silently, and there is
  **no edge legend** (all edges look identical; only `animated` varies, unexplained).
- **No empty/first-run state**: a new user lands on a full TUN-split config with no onboarding.

### Mobile & data-safety
- **T12 (mobile). Core tasks are impossible on mobile**: `Palette` isn't rendered (`App.tsx:13-22`) so
  nodes can't be added; connecting needs a desktop drag from an invisible handle; sheets clip their
  content (`styles.css:2123-2133`) hiding the templates list.
- **Import replaces the whole config with no confirm and no undo**, and success/failure is nearly
  invisible (no toast/aria-live). *(Counter-finding: round-trip fidelity is actually good — `normalizeConfig`
  uses `structuredClone`, so unknown fields survive export.)*
- **Templates ship `REPLACE_ME` placeholder secrets** and replace the project on tap with no confirm.

---

## Highest-leverage fixes (each closes many findings)
1. **Split the shared field cards (TLS/multiplex/transport/listen/dial) by `ref.kind`/role.** Kills T1
   and a large fraction of the 21 node P0s + many P1s in one structural change.
2. **Add required-field markers + a pre-export validation gate**, and **give `JsonField` parse feedback**
   (never write unparseable text). Closes T4+T5+T6 class "silent invalid export".
3. **Confirm-on-destructive: type-switch (T3) and import (data-safety) need a confirm + undo.**
4. **Wire `version` into `validateConfig`** (T10) so target/channel gating actually fires both directions.
5. **Derive port icons from the relation, one per target-kind** (T7); and **assert every `graph.ts`
   compatible chip has a `createCompatible` branch** in a test (T8) — kills dead chips + the icon mismatch.
6. **A `referenceRegistry`-completeness test** driven by the upstream tag-reference list (T11), plus
   `nodeTypeExcludes` guards on the dial-detour relations (T13).
7. **Fix warning iconography** (distinct icon for warning vs valid) and relabel the "✓ N" chip (T9).
8. **Mobile: add a node-add path + connect affordance, an empty/first-run state, and template explanations**
   (T12); strip `REPLACE_ME` secrets from shipped templates.

---

## Where everything lives
- Per-node conformance: `docs/ui-reviews-pass2/<node>--claude.md` (66 files).
- Relationship/port/edge + reference-integrity audit: `docs/ui-reviews-pass2/_RELATIONSHIPS.md`.
- Feature UX (new-user lens): `docs/ui-reviews-pass2/_FEATURE-{palette,canvas,inspector,diagnostics,io-topbar,mobile-templates}.md`.
- Upstream source of truth (offline mirror): `docs/upstream/sing-box/{testing,stable,oldstable}/` (re-syncable via `scripts/sync-singbox-docs.mjs`).

> Scope note: pass A verified field/link conformance to the official model; passes B and C cover the
> editor's own interaction model and were added after the icon-inconsistency question exposed that
> conformance alone doesn't tell you whether a user can understand the tool.
