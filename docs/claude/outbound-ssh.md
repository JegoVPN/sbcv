<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Outbound / ssh — Deep UI Review

> Source: official stable docs (`outbound/ssh.md`), official testing docs (`outbound/ssh.md`), Palette.tsx, Inspector.tsx, sharedFieldRegistry.ts, commands.ts.
> Review date: 2026-05-27.

---

## Version / Build Notes

**Stable fields (10):** `server`, `server_port`, `user`, `password`, `private_key`, `private_key_path`, `private_key_passphrase`, `host_key`, `host_key_algorithms`, `client_version` — available in all supported sing-box builds.

**Testing-only additions (3) — sing-box 1.14.0:** `cipher`, `mac`, `kex_algorithm`. These three fields are absent from the stable branch and must not be offered as editable fields unless the UI tracks a build ≥ 1.14.0. No version gate currently exists anywhere in the codebase.

---

## Official Field Inventory

**Protocol-specific fields — stable (10)**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `server` | string | **Required** | — | Server address. |
| `server_port` | number | optional | `22` | Server port. |
| `user` | string | optional | `"root"` | SSH username. |
| `password` | string | optional | — | Password auth. Mutually exclusive with private key auth. |
| `private_key` | string | optional | — | Inline PEM private key. Mutually exclusive with `password` and `private_key_path`. |
| `private_key_path` | string | optional | — | Path to private key file on disk. Mutually exclusive with `password` and `private_key`. |
| `private_key_passphrase` | string | optional | — | Passphrase for an encrypted private key. Only meaningful when `private_key` or `private_key_path` is set. |
| `host_key` | array of strings | optional | (accept any) | Accepted server host public keys, space-separated SSH authorized-keys entries. Empty means accept any. |
| `host_key_algorithms` | array of strings | optional | — | Host key algorithm filter list. |
| `client_version` | string | optional | random | SSH client version string sent during handshake. |

**Protocol-specific fields — testing only (sing-box ≥ 1.14.0)**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `cipher` | array of strings | optional | (binary default) | Allowed symmetric ciphers. Empty uses binary defaults. |
| `mac` | array of strings | optional | (binary default) | Allowed MAC algorithms. Empty uses binary defaults. |
| `kex_algorithm` | array of strings | optional | (binary default) | Allowed key exchange algorithms. Empty uses binary defaults. |

**Shared Dial Fields** — present for all `outbounds[]` via `sharedFieldRegistry.ts` (`outboundDialTypes` includes `"ssh"`). Confirmed at `sharedFieldRegistry.ts` line 150: `outboundDialTypes` is built from `CREATABLE_OUTBOUND_TYPES` with only `"block"`, `"dns"`, `"selector"`, and `"urltest"` excluded — `"ssh"` is included.

**No TLS, no multiplex, no transport, no QUIC, no UDP-over-TCP:** `sharedFieldRegistry.ts` confirms SSH is absent from `outboundTlsTypes` (line 151), `outboundQuicTypes`, `outboundMultiplexTypes`, `outboundTransportTypes`, and `outboundUdpOverTcpTypes`. These sections must not be shown for SSH outbound.

Total official fields: **10 stable + 3 testing + shared Dial fields (8)**.

---

## Left Panel — Palette (Add Library)

**Current state** (`Palette.tsx` line 170):

```ts
{ label: "SSH", kind: "ssh-out", icon: Server, docsUrl: docs("outbound/ssh/"), status: "setup" }
```

### Findings

- Label `"SSH"` is correct and human-readable.
- `status: "setup"` renders a non-clickable badge. The node cannot be dragged or clicked to add an outbound. No add-action affordance is provided.
- `docsUrl` target `docs("outbound/ssh/")` is correct.
- `icon: Server` — same icon used for multiple nodes. Acceptable for now; no SSH-specific icon needed.
- **No version gate for 1.14.0 fields.** The three testing-only fields (`cipher`, `mac`, `kex_algorithm`) will be added once the Inspector gains SSH-specific controls; at that point a version guard will be required.

---

## Middle Panel — Canvas Node

**Canvas node kind:** `"outbound"` (generic outbound node).

### Port Specification

```
Left ports (input):
  - route-final         → Route hub final outbound target
  - route-rule-outbound → Route rule outbound reference
  - selector-candidate  → Selector outbounds member
  - urltest-candidate   → URLTest outbounds member
  - dns-detour          → DNS server detour reference
  - dial-detour         → Dial detour reference (from other outbounds/endpoints/dns-servers)
  - service-detour      → Service outbound reference

Right ports (output):
  - dial-detour-out     → Outbound for use as the dial detour of this node
```

### Findings

- Standard outbound port layout is correct for SSH.
- No SSH-specific port behavior is needed (SSH does not carry embedded inbound, rule-set, or endpoint references).
- Canvas node label is `tag ?? ref.kind`. Acceptable.
- No `server` or auth-method summary visible on canvas label when multiple SSH outbounds coexist. Minor UX gap — not a P0/P1 issue.

---

## Right Panel — Inspector

### What the inspector currently provides for `ref.kind === "outbound"`

1. **Tag** rename input.
2. **Type** select from `CREATABLE_OUTBOUND_TYPES` (includes `"ssh"` at index 14 of `protocols.ts`).
3. **Server** text input — conditionally rendered when `"server" in entity` (line 1507 of `Inspector.tsx`). SSH default template seeds `server`, so this renders.
4. **Port** number input — conditionally rendered when `"server_port" in entity` (line 1516). SSH default template seeds `server_port: 22`, so this renders.
5. **AdvancedScalarFields** — generic accordion for scalars not in `outboundHandledFields`. SSH-specific scalar fields that appear here: `user`, `password`, `private_key_path`, `private_key_passphrase`, `client_version`.
6. **SharedFieldCards** — "Dial Fields" section via `sharedGroupsForEntity` for `ref.kind === "outbound"` with `type === "ssh"`. Correctly included.

### `outboundHandledFields` set — SSH fields NOT included

```ts
const outboundHandledFields = new Set([
  "tag", "type", "server", "server_port",
  "outbounds", "default",
  "tls", "multiplex", "transport", "udp_over_tcp",
  ...dialSharedFields,   // detour, bind_interface, connect_timeout, domain_resolver, network_strategy, network_type, fallback_network_type, fallback_delay
  ...quicSharedFields,   // initial_packet_size, disable_path_mtu_discovery, idle_timeout, keep_alive_period
]);
```

The following SSH fields are **not** in `outboundHandledFields`:

- `user` — scalar string → falls to `AdvancedScalarFields` (visible but generic text input, alphabetical order)
- `password` — scalar string → falls to `AdvancedScalarFields`
- `private_key` — scalar string → falls to `AdvancedScalarFields`
- `private_key_path` — scalar string → falls to `AdvancedScalarFields`
- `private_key_passphrase` — scalar string → falls to `AdvancedScalarFields`
- `client_version` — scalar string → falls to `AdvancedScalarFields`
- `host_key` — **array of strings** → `AdvancedScalarFields` only surfaces scalars; `host_key` is **silently invisible**
- `host_key_algorithms` — **array of strings** → silently invisible for the same reason
- `cipher` (testing) — array of strings → silently invisible
- `mac` (testing) — array of strings → silently invisible
- `kex_algorithm` (testing) — array of strings → silently invisible

### Default template — `commands.ts` (line 414–423)

```ts
if (type === "ssh") {
  return {
    type,
    tag,
    server: "127.0.0.1",
    server_port: 22,
    user: "root",
    password: "change-me",
  };
}
```

- Seeds `server`, `server_port`, `user`, `password`. Reasonable starting point.
- Does **not** seed `host_key`, `host_key_algorithms`, `private_key`, `private_key_path`, `private_key_passphrase`, `client_version`. Correct — these are optional.
- `password: "change-me"` is a placeholder; users must change it. Acceptable.
- No `private_key` / `private_key_path` in default is correct — password auth is the simpler default.

### Gap analysis for SSH outbound

| Field | Expected UI | Actual |
|---|---|---|
| `server` | Dedicated text input | Correctly rendered via `"server" in entity` check. |
| `server_port` | Dedicated number input | Correctly rendered via `"server_port" in entity` check. |
| `user` | Dedicated text input with label "User" | Falls to `AdvancedScalarFields` accordion. Visible but buried; not first-class. |
| `password` | Dedicated password input (auth section) | Falls to `AdvancedScalarFields`. Rendered as plain text. Password value exposed. |
| `private_key` | Multi-line textarea (PEM inline key) | Falls to `AdvancedScalarFields`. Scalar → rendered as single-line text input. Unusable for multi-line PEM content. |
| `private_key_path` | Dedicated text input (path) | Falls to `AdvancedScalarFields`. Visible as generic text input. |
| `private_key_passphrase` | Dedicated text input (password-type) | Falls to `AdvancedScalarFields`. Visible as plain text input. |
| `host_key` | Array textarea or repeater (one entry per host key line) | **Silently invisible** — array type, skipped by `AdvancedScalarFields`. |
| `host_key_algorithms` | Multi-select or comma list input | **Silently invisible** — array type, skipped by `AdvancedScalarFields`. |
| `client_version` | Text input | Falls to `AdvancedScalarFields`. Visible but generic. |
| `cipher` (1.14.0) | Multi-select or comma list | **Silently invisible** — array type. |
| `mac` (1.14.0) | Multi-select or comma list | **Silently invisible** — array type. |
| `kex_algorithm` (1.14.0) | Multi-select or comma list | **Silently invisible** — array type. |
| Dial shared fields | SharedFieldCards "Dial Fields" section | **Correctly handled** — SSH is in `outboundDialTypes`. |

---

## Priority Findings

### P0 — host_key is silently invisible (security-critical field)

`host_key` is a `string[]` array of SSH server public keys. When present it restricts which servers the client will trust — it is the SSH equivalent of certificate pinning. When absent, the client accepts **any** host key, which creates TOFU / MITM risk in real deployments.

`host_key` is not in `outboundHandledFields`. `AdvancedScalarFields` filters to scalar values only; arrays are completely skipped. An imported config that includes `host_key` entries will have them invisibly stored but never shown or editable through the Inspector.

A user who wants to pin a server's public key must use the global raw JSON textarea — there is no structured UI path. More critically, a user who imports a config with `host_key` pinning and then edits the node through Inspector will not realize the pins exist; if they recreate the node the pins are lost.

**Resolution required:** Add `"host_key"` to `outboundHandledFields`. Render a `JsonField` (textarea of the JSON string array) gated on `entityType === "ssh"` inside the outbound Inspector block. Long-term: a string-per-row repeater is more ergonomic for public key entries.

### P0 — host_key_algorithms silently invisible

`host_key_algorithms` is a `string[]` restricting which host key algorithms the client accepts. Like `host_key`, it is invisible in the Inspector — not in `outboundHandledFields`, array type, skipped by `AdvancedScalarFields`.

**Resolution required:** Add `"host_key_algorithms"` to `outboundHandledFields`. Render a comma-list input or `JsonField` gated on `entityType === "ssh"`.

### P0 — private_key rendered as single-line text input (unusable for PEM)

`private_key` contains an inline PEM private key, which is a multi-line string (typically 20–50 lines). `AdvancedScalarFields` renders all scalar strings as a single `<input type="text">`. A PEM key cannot be meaningfully pasted into a single-line text input; the newlines are stripped, the key becomes invalid, and there is no visible error.

While `private_key` is technically a scalar (a string containing `\n`), the UI renders it as a one-line text control, making it functionally unusable for real PEM content.

**Resolution required:** Add `"private_key"` to `outboundHandledFields`. Render a `<textarea>` (or `JsonField`) for `private_key` gated on `entityType === "ssh"`. The textarea must preserve newlines when reading from and writing to the entity.

### P1 — Authentication fields are buried in AdvancedScalarFields with no mutual-exclusion guidance

`password`, `private_key`, and `private_key_path` are three mutually exclusive auth methods. The Inspector places `user`, `password`, `private_key_path`, and `private_key_passphrase` in the `AdvancedScalarFields` accordion — all treated as generic, equal-weight scalars with no grouping, labeling, or guidance that only one auth method should be active.

A user can accidentally set both `password` and `private_key_path` in the JSON (via the inspector's generic fields), producing an ambiguous config. The official docs do not explicitly state which takes precedence in that case.

**Resolution required:** Add an SSH-specific Inspector section for `entityType === "ssh"` that:
1. Groups `user` as a first-class field immediately below Server/Port.
2. Offers an "Auth method" selector (`password` | `private_key` | `private_key_path`).
3. Conditionally shows only the relevant auth fields (password input, or key textarea + passphrase input, or path input + passphrase input).
4. Adds `"user"`, `"password"`, `"private_key"`, `"private_key_path"`, `"private_key_passphrase"` to `outboundHandledFields`.

Minimum acceptable: bring these fields out of `AdvancedScalarFields` as first-class inputs with correct types (`password` → `type="password"`, `private_key` → `<textarea>`).

### P1 — password shown as plain text (security exposure)

`password` is rendered by `AdvancedScalarFields` as `<input type="text">` because `typeof value === "string"`. Passwords should use `<input type="password">` to avoid shoulder-surfing exposure. The same issue applies to `private_key_passphrase`.

**Resolution required:** Gate `password` and `private_key_passphrase` as explicit `type="password"` inputs inside an SSH-specific Inspector block.

### P1 — Testing-only fields (cipher / mac / kex_algorithm) silently invisible

`cipher`, `mac`, and `kex_algorithm` (sing-box ≥ 1.14.0) are `string[]` arrays. They are not in `outboundHandledFields` and are arrays — silently invisible. A user importing a 1.14.0 config that includes custom cipher lists will see them stored invisibly and have no way to edit them through the Inspector.

**Resolution required:** Add these three fields to `outboundHandledFields` and render them as comma-list inputs or `JsonField` textareas gated on `entityType === "ssh"`. Add a version note in the UI: "Requires sing-box ≥ 1.14.0".

---

## Implementation Tasks

### Task 1 — First-class SSH Inspector block (P0 / P1)

**File:** `src/components/Inspector.tsx`

Inside the `ref.kind === "outbound"` block (around line 1505–1546), add an SSH-specific section:

```tsx
{entityType === "ssh" ? (
  <>
    <div className="inspector-section-title">SSH Auth</div>
    <label className="field">
      <span>User</span>
      <input
        value={String(entity.user ?? "")}
        onChange={(event) => updateField(ref, "user", event.target.value || undefined)}
      />
    </label>
    <label className="field">
      <span>Password</span>
      <input
        type="password"
        value={String(entity.password ?? "")}
        onChange={(event) => updateField(ref, "password", event.target.value || undefined)}
      />
    </label>
    <label className="field">
      <span>Private Key (PEM)</span>
      <textarea
        value={String(entity.private_key ?? "")}
        onChange={(event) => updateField(ref, "private_key", event.target.value || undefined)}
        placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
      />
    </label>
    <label className="field">
      <span>Private Key Path</span>
      <input
        value={String(entity.private_key_path ?? "")}
        onChange={(event) => updateField(ref, "private_key_path", event.target.value || undefined)}
        placeholder="$HOME/.ssh/id_rsa"
      />
    </label>
    <label className="field">
      <span>Key Passphrase</span>
      <input
        type="password"
        value={String(entity.private_key_passphrase ?? "")}
        onChange={(event) => updateField(ref, "private_key_passphrase", event.target.value || undefined)}
      />
    </label>
    <div className="inspector-section-title">SSH Security</div>
    <label className="field">
      <span>Client Version</span>
      <input
        value={String(entity.client_version ?? "")}
        onChange={(event) => updateField(ref, "client_version", event.target.value || undefined)}
        placeholder="SSH-2.0-OpenSSH_7.4p1 (random if empty)"
      />
    </label>
    <JsonField
      label="Host Keys (accepted server public keys)"
      value={entity.host_key ?? []}
      onChange={(value) => updateField(ref, "host_key", value)}
    />
    <JsonField
      label="Host Key Algorithms"
      value={entity.host_key_algorithms ?? []}
      onChange={(value) => updateField(ref, "host_key_algorithms", value)}
    />
    <JsonField
      label="Ciphers (≥ 1.14.0)"
      value={entity.cipher ?? []}
      onChange={(value) => updateField(ref, "cipher", value)}
    />
    <JsonField
      label="MAC Algorithms (≥ 1.14.0)"
      value={entity.mac ?? []}
      onChange={(value) => updateField(ref, "mac", value)}
    />
    <JsonField
      label="Key Exchange Algorithms (≥ 1.14.0)"
      value={entity.kex_algorithm ?? []}
      onChange={(value) => updateField(ref, "kex_algorithm", value)}
    />
  </>
) : null}
```

Also extend `outboundHandledFields` to include all SSH-specific fields:

```ts
const outboundHandledFields = new Set([
  // existing entries ...
  "user",
  "password",
  "private_key",
  "private_key_path",
  "private_key_passphrase",
  "host_key",
  "host_key_algorithms",
  "client_version",
  "cipher",
  "mac",
  "kex_algorithm",
]);
```

### Task 2 — Auth method grouping / mutual exclusion hint (P1)

Long-term UX improvement for Task 1. Replace the flat listing of `password` / `private_key` / `private_key_path` with a single "Auth Method" `<select>` that shows `password`, `private_key`, or `private_key_path`, and conditionally renders only the relevant sub-fields. On switch, clear the fields belonging to the previous auth method.

Until the selector is implemented, add a `<small>` note below the section title: "Use only one of: password, private key, or private key path."

### Task 3 — Verify default template correctness (informational)

**File:** `src/domain/commands.ts` (line 414–423)

The default SSH template seeds `{ server, server_port, user, password }`. This is a reasonable starting point. No change required for correctness, but:

- Consider seeding `host_key: []` to make the "accept-any" behavior explicit rather than implicit.
- Do **not** seed `private_key` or `private_key_path` in the default (correct — password auth is simpler for the default).

### Task 4 — Version note for 1.14.0 fields (P1)

**File:** `src/components/Inspector.tsx` (SSH block from Task 1)

Add a visible `<small>` annotation next to `cipher`, `mac`, `kex_algorithm` fields: "Requires sing-box ≥ 1.14.0 (testing branch)". Until a version-gate system exists, this annotation is the minimum required to prevent user confusion when using a stable binary.

---

## Done Criteria

- `user`, `password`, `private_key`, `private_key_path`, `private_key_passphrase`, `client_version` are first-class labeled fields in the SSH outbound Inspector, not buried in the Advanced accordion.
- `password` and `private_key_passphrase` render as `type="password"` inputs.
- `private_key` renders as a multi-line `<textarea>` that accepts PEM content.
- `host_key` is visible as a JSON array field (or string-per-row repeater) in the Inspector.
- `host_key_algorithms`, `cipher`, `mac`, `kex_algorithm` are visible as JSON array fields with appropriate labels.
- All SSH-specific fields are added to `outboundHandledFields` and no longer appear in the generic Advanced accordion.
- The Dial Fields shared card is still shown (already correct).
- No TLS, multiplex, transport, or QUIC cards are shown for SSH outbound (already correct).
- Fixture or e2e smoke test: import an SSH outbound config with `host_key` pinning and `private_key_path` auth, verify all fields are visible and editable in the Inspector, edit tag, export JSON, check round-trip fidelity including `host_key` array.
