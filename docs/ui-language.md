# sbcv UI Language Spec (L1-vocab)

The single source of truth for sbcv's user-facing copy. Every Phase-1 copy atomic (L1-badges,
L1-buildtags, L1-brandbtn, glossary, diagnostics) conforms to this.

**Status: SIGNED OFF by the user 2026-05-29.** Decisions:
- **Badge words = the full proposed set**, including `setup → Add` (the ~15 `name:"Setup X"` test
  assertions get migrated). So: Setup→Add, Table→List, Inspector→In parent, Docs→Reference,
  Gated→Needs 1.14, Pending→Soon; Add/Legacy/Open keep their words. Legacy = colored; testing/gated = muted.
- **De-dup carrier:** keep the `Needs 1.14`-style badge, drop the version suffix from the label.
- **Hysteria v1 = KEEP the Legacy treatment** (pill + banner + diagnostic — the opinionated "prefer
  Hysteria2"), but **drop the literal-false "deprecated upstream / official docs recommend migrating"
  attribution** in the banners. (So `hysteria-out` stays in `deprecatedKinds`; only the wording changes.)

## Voice
- **Plain, specific, sing-box-accurate.** Prefer the upstream term the user must learn (e.g. "Outbound",
  "DNS server") over invented UI jargon. No internal kind/type enums in chrome.
- **State the cause, not the mechanism.** "Needs sing-box 1.14" beats "Gated"; "edited inside its parent"
  beats "Inspector".
- **One concept = one word, everywhere** (palette badge, Inspector, diagnostics, tooltips).
- **No redundancy.** If a label already states the version/state, the badge must not repeat it
  (e.g. `Hysteria Realm (1.14 testing)` + a `Testing` badge double-states — pick one carrier).

## Badge vocabulary (palette status) — the core decision (D2)

`testing/gated` ≠ `legacy/deprecated` and they must READ + LOOK different:
- **Legacy** = sing-box *deprecated* this. The quality bar: a **colored** chip (amber/orange).
- **Testing/gated** = valid, but needs a newer build target (creatable on the right channel). A **muted**
  (grey) chip. Cause: the *target*, not deprecation.

| state | when it applies | current word | → proposed word | treatment |
|---|---|---|---|---|
| `add` | ready; click creates it | Add | **Add** (keep) | neutral / lime accent |
| `setup` | creates a draft you must fill in | Setup | **Add** (drop the separate word — it still adds; the draft-needs-fields nuance moves to a tooltip) ⚠ test churn | neutral |
| `table` | add/edit via the ordered rules table | Table | **List** (or "Add to list") | neutral |
| `inspector` | edited inside its parent node | Inspector | **In parent** | muted |
| `docs` | reference only (removed/legacy kinds kept per D4) | Docs | **Reference** | muted |
| `gated` | needs a newer sing-box target | Gated | **Needs 1.14** (channel-specific) | muted grey |
| `pending` | planned; no writable command yet | Pending | **Soon** | muted |
| `deprecated` | sing-box-deprecated | Legacy | **Legacy** (keep) | **colored (amber)** ← the bar |
| `open` | already exists; opens its Inspector | Open | **Open** (keep) | muted |

> ⚠ Renaming `setup`→`add` touches ~15 `name:"Setup X"` test assertions (migrated in L1-badges).
> If you'd rather keep "Setup" as a distinct word, say so — that avoids the churn.

De-dup rule (D2): a node whose **label** carries the version (e.g. `Hysteria Realm (1.14 testing)`) drops
the `Needs 1.14` badge, OR drops the suffix and keeps the badge — **pick one** (proposed: keep the badge
`Needs 1.14`, drop the label suffix, since D3 already strips build/version suffixes from labels).

## Build-tag suffixes (D3)
Drop `(with_tailscale)` / `(with_tor)` from palette **labels** → "Tailscale", "Tor". Surface the build-tag
requirement as the existing build-tag **banner** in the Inspector (already present) + optionally a tooltip,
not in the primary name.

## Brand menu (L1-brandmenu)
The brand control opens the `sbcv.app` menu. The menu header expands the name as
`sing-box configuration visualizer`; reset view is an explicit menu action because `goHome` only
deselects, closes the global panel, and re-fits the canvas.

## Terminology glossary (consistent terms)
- **Target** = channel + version (e.g. "stable 1.13", "testing 1.14"). Tooltip (L1-target-glossary):
  "Stable (1.13) is the released build; testing (1.14) has newer features not yet in stable."
- **Outbound / Endpoint** = where traffic exits (endpoints share the outbound namespace).
- **Rule set** (resource) vs **Match rule-set** (a route/dns rule's match field) — disambiguate the label.
- **Detour** = the outbound a component dials through. **Resolver** = the DNS server a component resolves
  domains through (a distinct relationship from detour).

## Diagnostics hierarchy (L1-diag-hierarchy)
Read message-first (human-readable), code secondary (small/muted). The code is a reference, not the headline.

## Open decisions for the user (sign-off)
1. **Badge words** — confirm the → column (esp. `setup`→`add` given the test churn; `gated`→`Needs 1.14`).
2. **De-dup carrier** — keep the `Needs 1.14` badge + drop the label suffix? (proposed yes.)
3. **Hysteria v1 "deprecated" stance (H5/H6, deferred from L2)** — sbcv currently treats Hysteria v1 as
   deprecated/legacy across banners + the Palette `Legacy` pill + diagnostics (`hysteria-v1-deprecated`),
   but upstream `deprecated.md` does NOT formally deprecate v1 (only sub-fields). **Keep treating v1 as
   Legacy** (opinionated "prefer v2"), or **drop the deprecation** (it's not upstream-deprecated)? This
   sets whether `hysteria-out` stays in `deprecatedKinds` and whether the diagnostics/banners stay.
   (Note: `dns`/`wireguard`/`block` outbounds ARE removed-in-1.13 → those SHOULD be Legacy.)
