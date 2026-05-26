# Service / hysteria-realm — Deep UI Review

> Sources: official testing docs (`service/hysteria-realm.md`, `shared/listen.md`, `shared/http2.md`, `shared/tls.md`). stable `service/index.md` does NOT list hysteria-realm — stable targets must never add or export this service.
> Reviewed: `Palette.tsx` (lines 199, 250), `commands.ts` (line 534), `Inspector.tsx` (lines 1695–1815), `diagnostics.ts` (lines 216–224), `sharedFieldRegistry.ts` (lines 61, 158–196), `graph.ts` (lines 628–668, 694), `protocols.ts` (lines 133–142, 220–226).

---

## Official Field Model

**Version gate: sing-box 1.14.0 testing only. Not in stable service/index.md.**

```
type:  "hysteria-realm"
tag:   <string>

# Listen Fields (shared/listen.md — embedded inspector)
listen              REQUIRED  string
listen_port                   number
bind_interface                string
routing_mark                  number
reuse_addr                    boolean
netns                         string
tcp_fast_open                 boolean
tcp_multi_path                boolean
disable_tcp_keep_alive        boolean
tcp_keep_alive                duration string
tcp_keep_alive_interval       duration string
udp_fragment                  boolean
udp_timeout                   duration string
detour                        string (outbound tag)

# Protocol-specific field
tls {}              optional  — inbound TLS from shared/tls.md
                              When present: HTTP/2 over TLS; otherwise plain HTTP/1.1.

# HTTP2 Fields (shared/http2.md — target-gated, also 1.14)
idle_timeout                  duration string
keep_alive_period             duration string
stream_receive_window         memory-size string (e.g. "64 MB")
connection_receive_window     memory-size string (e.g. "64 MB")
max_concurrent_streams        number

# users[] — REQUIRED, list of authorized users
users[].name        REQUIRED  string  — username used in logs and as quota key
users[].token       REQUIRED  string  — bearer token used by Hysteria2 inbounds/outbounds
users[].max_realms            number  — max concurrent realm slots for this user
```

**Official field count: 18 (14 listen-shared + tls + 5 http2-shared + users[] with 3 sub-fields)**. `type` and `tag` are infrastructure fields, not counted as configurable content fields.

**No tag references to or from other sing-box nodes.** The service doc defines no `tag` cross-references with inbounds or outbounds. Hysteria2 inbounds/outbounds reference this service operationally via the `users[].token` bearer token value, but this is a runtime credential, not a sing-box config tag field.

---

## Left: Add Library (Palette)

**Current state** (`Palette.tsx` line 199):
```ts
{ label: "Hysteria Realm", kind: "service-hysteria-realm", icon: Plug, docsUrl: docs("service/hysteria-realm/"), status: "setup" }
```

Channel gate (`Palette.tsx` line 250):
```ts
if (item.kind === "service-hysteria-realm" && channel !== "testing") return "gated";
```

**What is correct:**
- Label "Hysteria Realm" is human-readable. Acceptable.
- Channel gate to "testing" is present and correct.
- `docsUrl` points to `service/hysteria-realm/` — correct testing-channel docs path.
- `icon: Plug` — acceptable for a network rendezvous service.

**Findings:**

- P1 (UX) The gate tooltip from `statusTitle("gated", ...)` reads: "Hysteria Realm is target-gated and needs matching sing-box validation" — this is generic and does not name the minimum version. Should say "Requires sing-box 1.14 testing target" so the user understands the specific gate.
- P1 (UX) `status: "setup"` maps to "Add Hysteria Realm setup draft to canvas" — the verb is not wrong but "setup draft" is implementation jargon. A clearer tooltip would be "Add Hysteria Realm service to canvas" or "Configure Hysteria Realm service".
- P0 (correctness) The Palette gating to `channel !== "testing"` is **correct and must be maintained**. Any refactor that removes or generalizes this check is a correctness regression — stable targets would silently permit adding a testing-only service.

---

## Middle: Canvas Node

**Current state** (`graph.ts` lines 628–667):

```ts
compatible: service.type === "ssm-api" ? ["Shadowsocks Inbound"]
           : service.type === "derp" ? ["Tailscale Endpoint"]
           : []
```

- `compatible: []` for hysteria-realm — **correct**. No compatible drag targets exist per the official schema.
- Subtitle: `"hysteria2 realm service"` — accurate and human-readable.
- Node placed in `"hub"` column at DNS/endpoint area — functionally acceptable for a runtime service.
- `diagnosticStatus` for `/services/${index}` — will surface the testing-only diagnostic (see diagnostics section).

**No canvas edges are generated for hysteria-realm** beyond the standard `detour` edge (line 652). Hysteria-realm has no `detour` field in its official schema, so no detour edge will appear in practice unless unknown fields are present. `verify_client_endpoint` edges (lines 656–660) are DERP-specific and will not fire for hysteria-realm. `servers` edges (lines 662–666) are ssm-api-specific and will not fire for hysteria-realm. This is all correct.

**Findings:**

- P1 (UX) `compatible: []` leaves no visual affordance for what hysteria-realm connects to. The node will appear as a standalone island. This is semantically accurate — no official tag reference exists — but the canvas placement near DNS/endpoint rows may confuse users who expect a data-plane connection. A subtitle annotation such as "control-plane only — no proxy traffic" or a tooltip explaining the NAT traversal rendezvous role would help.
- P2 (UX) The node inherits the standard service pill row. Since hysteria-realm has no `detour`, `verify_client_endpoint`, or `servers` references, the node appears with no edges. This is correct; no cosmetic change is needed but should be documented for reviewers.

---

## Right: Inspector

**Current state** (`Inspector.tsx` lines 1695–1815):

```tsx
{ref.kind === "service" ? (
  <>
    {/* ... other service type branches ... */}
    {entityType === "hysteria-realm" ? (
      <JsonField label="Users JSON" value={entity.users ?? []} onChange={...} />
    ) : null}
    <AdvancedScalarFields entity={entity} handledFields={serviceHandledFields} ... />
  </>
) : null}
```

Shared field groups for hysteria-realm (from `sharedFieldRegistry.ts` lines 158–196):
- `"listen"` — yes, hysteria-realm is in `serviceListenTypes`
- `"tls"` — yes, hysteria-realm is in `serviceTlsTypes`
- `"http2"` — yes, explicit `if (entityType === "hysteria-realm") groups.push("http2")`

The Inspector itself has **no `channel` check** — Inspector renders for any entity in the store regardless of target. The only protection at add-time is the Palette gate and the diagnostic error.

`serviceHandledFields` includes `"users"` and all listen shared fields plus `"tls"`, `"idle_timeout"`, `"keep_alive_period"`, `"stream_receive_window"`, `"connection_receive_window"`, `"max_concurrent_streams"` via the set. These are marked handled, preventing them from appearing in `AdvancedScalarFields` fallback.

**Findings:**

- **P0 (correctness) `users[]` is rendered as a single raw `JsonField`** — a textarea accepting arbitrary JSON. The official schema has `users[]` as a required structured array with `name` (required), `token` (required, sensitive), and `max_realms`. A raw JSON textarea provides no validation, no required-field enforcement, and no token-sensitive masking. Users can delete all entries or write invalid JSON without field-level feedback.
  - Required fix: Replace `JsonField` with a structured repeater (add/remove rows, labeled inputs for `name`, `token`, `max_realms`).
  - `token` must be treated as a secret: use `type="password"` or provide a reveal toggle. Do not echo in log copy or screenshots.
  - At minimum until a repeater exists, the label "Users JSON" gives no guidance — it should include a hint showing the expected array shape.

- **P0 (correctness) No Inspector-level channel gate for hysteria-realm**. If a user imports a config that already contains `type: "hysteria-realm"` with a stable channel, the Inspector will render and allow editing the hysteria-realm node without any visible channel warning in the Inspector panel. The diagnostic error from `diagnostics.ts` will show in the canvas node status, but the Inspector itself provides no warning banner. A channel-aware warning should appear at the top of the hysteria-realm service Inspector section when the active channel is not "testing".

- **P1 (UX) Inspector section order for hysteria-realm**: The current render order is: shared Listen fields (via sharedFieldRegistry), then shared TLS (via sharedFieldRegistry), then shared HTTP2 (via sharedFieldRegistry), then `users[]` JsonField, then `AdvancedScalarFields` fallback. The official doc order is: Listen → TLS → HTTP2 → users. The current implementation order matches the official doc order, which is correct.

- **P1 (UX) No explanatory text** — The Inspector for hysteria-realm shows raw field controls with no explanation of what the service does (Hysteria2 NAT traversal rendezvous, control-plane only). A single-sentence context note at the top of the section would reduce confusion for users unfamiliar with the feature.

- **P1 (UX) `max_realms: 0` semantic** — The official doc describes `max_realms` as "Maximum number of realm slots this user may hold concurrently" with no default noted. A `0` default in the scaffold (`commands.ts` line 540 sets `max_realms: 1` — actually correct) implies 1 as the starting value. Verify that `0` is not treated as "unlimited" or "disabled" in the binary, as this would require a note in the field label.

---

## commands.ts Scaffold

**Current state** (`commands.ts` lines 534–542):
```ts
if (type === "hysteria-realm") {
  return {
    type,
    tag,
    listen: "127.0.0.1",
    listen_port: 8444,
    users: [{ name: "user", token: "change-me", max_realms: 1 }],
  };
}
```

**What is correct:**
- `listen` and `listen_port` are present (required by Listen Fields).
- `users[]` is non-empty (required by official schema), with all three sub-fields populated.
- `token: "change-me"` is a placeholder — acceptable but should trigger a diagnostic if not changed.

**Findings:**
- P1 The scaffold does not include `tls` or HTTP2 fields. These are optional per the official doc, so their absence is correct. However, `listen: "127.0.0.1"` may not be appropriate for a public realm service — `0.0.0.0` or an explicit address may be more useful as a scaffold default. This is a UX concern, not a correctness bug.
- P1 No diagnostic exists for the placeholder token value `"change-me"`. A warning diagnostic on the scaffold token would reduce the chance of users deploying with the default credential.

---

## diagnostics.ts

**Current state** (`diagnostics.ts` lines 216–224):
```ts
if (service.type === "hysteria-realm" && channel !== "testing") {
  push(diagnostics, "error", "hysteria-realm-testing-only", `/services/${index}`,
    "Hysteria Realm service is available only for the 1.14 testing target.");
}
```

**What is correct:**
- Error-level diagnostic fires on any non-testing channel.
- Message names "1.14 testing target" explicitly — correct.
- Path `/services/${index}` is correct for the JSON pointer.

**Findings:**
- P1 No diagnostic for empty `users[]`. The official doc marks `users` as `==Required==` and `users[].name` and `users[].token` also as `==Required==`. If a user deletes all users via the JsonField textarea, no diagnostic warns that `users[]` is required and must be non-empty.
- P2 No diagnostic for missing `listen` when it defaults to an empty string. The Listen Fields shared section marks `listen` as `==Required==`. Depending on whether AdvancedScalarFields or the shared section enforces this, an empty `listen` could produce a silent invalid export.

---

## sharedFieldRegistry.ts

**Current state** (`sharedFieldRegistry.ts` lines 58–63, 158–196):
```ts
{
  doc: "shared/http2.md",
  group: "http2",
  owners: ["http_clients[]", "service[hysteria-realm]"],
  mode: "target-gated",
},
```

```ts
const serviceListenTypes = new Set(["derp", "resolved", "ssm-api", "ccm", "ocm", "hysteria-realm"]);
const serviceTlsTypes = new Set(["derp", "ssm-api", "ccm", "ocm", "hysteria-realm"]);
...
if (ref.kind === "service") {
  if (serviceListenTypes.has(entityType)) groups.push("listen");
  if (serviceTlsTypes.has(entityType)) groups.push("tls");
  if (entityType === "hysteria-realm") groups.push("http2");
}
```

**What is correct:**
- Listen, TLS, and HTTP2 groups are all registered for hysteria-realm.
- HTTP2 is marked `"target-gated"` — correct since shared/http2.md is itself a 1.14.0 feature.
- TLS is embedded inspector — correct, it is an inline object not a standalone node.

**No findings** in sharedFieldRegistry for this node.

---

## Priority Findings

- **P0** Target gate: `channel !== "testing"` gate in Palette is correct and must be preserved. Stable targets must never add or export hysteria-realm. The diagnostic error at `/services/${index}` enforces this post-import. Gate is present in both Palette (add prevention) and diagnostics (import/export enforcement).

- **P0** Inspector has **no channel warning banner** for hysteria-realm. If a hysteria-realm node exists in a stable-channel project (e.g. imported from a testing config), the Inspector renders fully with no visible warning. A channel-gating warning should appear at the top of the hysteria-realm Inspector section when `channel !== "testing"`.

- **P0** `users[]` Inspector is a raw `JsonField` (textarea). Required field (`==Required==` per docs), required sub-fields (`name`, `token`), and sensitive field (`token`) all need structured repeater with validation and token masking.

- **P1** No required-field diagnostic for empty `users[]` or missing `users[].name` / `users[].token`.

- **P1** Palette gate tooltip does not name the minimum version. Replace generic "target-gated" wording with "Requires sing-box 1.14 testing target".

- **P1** No explanatory context in Inspector for what Hysteria Realm does (control-plane rendezvous service, not a data-plane proxy route).

- **P1** No placeholder-token diagnostic. The scaffold ships `token: "change-me"` with no warning if unchanged.

---

## Implementation Tasks

1. **Inspector channel warning banner** — In the `{entityType === "hysteria-realm"}` branch, check `channel !== "testing"` (pass `channel` down or read from store) and render a warning: "This service requires sing-box 1.14 testing channel. It will not be accepted by stable builds."

2. **Structured users[] repeater** — Replace `JsonField label="Users JSON"` with a repeater component:
   - Add/remove user rows.
   - `name`: labeled text input, required, non-empty validation.
   - `token`: labeled `type="password"` input with reveal toggle, required.
   - `max_realms`: labeled number input, optional (default omitted or 0).
   - Empty users[] shows an error inline ("At least one user is required").

3. **diagnostics.ts — required-field checks for users[]**:
   ```ts
   if (service.type === "hysteria-realm") {
     if (!Array.isArray(service.users) || service.users.length === 0) {
       push(diagnostics, "error", "hysteria-realm-users-required", `/services/${index}/users`,
         "Hysteria Realm requires at least one authorized user.");
     }
     (service.users ?? []).forEach((user, ui) => {
       if (!user.name) push(diagnostics, "error", "hysteria-realm-user-name-required",
         `/services/${index}/users/${ui}/name`, "User name is required.");
       if (!user.token) push(diagnostics, "error", "hysteria-realm-user-token-required",
         `/services/${index}/users/${ui}/token`, "User token is required.");
     });
   }
   ```

4. **Palette tooltip wording** — Update `statusTitle("gated", ...)` or add a hysteria-realm-specific override to say "Requires sing-box 1.14 testing target" instead of the generic gated message.

5. **Optional: placeholder token diagnostic** — When `users[].token === "change-me"`, emit a warning diagnostic recommending token replacement.

6. **Optional: context annotation on canvas node** — Add a secondary subtitle or tooltip for hysteria-realm canvas nodes explaining "Control-plane only — NAT traversal rendezvous for Hysteria2". No structural change needed, subtitle string update in `serviceSubtitle()` is sufficient.

---

## Done Criteria

- Adding hysteria-realm from Palette on a non-testing channel is gated (already true).
- Importing a config with hysteria-realm on a non-testing channel shows an error diagnostic on the canvas node (already true).
- Inspector for hysteria-realm shows a visible warning when channel is not "testing".
- `users[]` Inspector section uses a structured repeater with per-field validation and token masking.
- Diagnostics catch empty `users[]`, missing `name`, and missing `token`.
- JSON export round-trips correctly: add → edit users → export → re-import produces identical canonical state.
- Stable target projects cannot export hysteria-realm without a blocking diagnostic error.
