<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Service / ocm Deep Review

<!-- Source: .tmp/sing-box-docs/stable/docs/configuration/service/ocm.md (identical to testing).
     Reviewed against: Palette.tsx, SbcNode.tsx, Inspector.tsx, sharedFieldRegistry.ts,
     commands.ts, canvas/graph.ts, state/useProjectStore.ts, tests/config-doc-capability.test.ts.
     Baseline: docs/ui-reviews/service-ocm.md. -->

## Official Fields (stable = testing, since sing-box 1.13.0)

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | literal `"ocm"` | yes | discriminator |
| Listen Fields | shared block | no | `listen`, `listen_port`, etc. |
| `credential_path` | string | no | defaults to `~/.codex/auth.json` |
| `usages_path` | string | no | usage tracking disabled if absent |
| `users` | array of `{name, token}` | no | empty = no auth |
| `headers` | object (string→string map) | no | custom HTTP headers forwarded to OpenAI |
| `detour` | string (outbound tag) | no | outbound used to reach OpenAI API |
| `tls` | TLS inbound object | no | see shared TLS inbound spec |

Total official top-level fields: **8** (type + listen block + 6 named fields).

Stable and testing docs are identical; no version delta.

---

## Left: Add Library (Palette.tsx line 198)

```
{ label: "OCM", kind: "service-ocm", icon: Server,
  docsUrl: docs("service/ocm/"), status: "setup" }
```

**Status: correct.** `service-ocm` maps to kind `"ocm"` in `protocols.ts` (line 138). Docs URL points to `service/ocm/`. Status badge `"setup"` is consistent with other service entries (CCM, DERP, SSM-API). No issues found.

---

## Middle: Canvas Node (SbcNode.tsx, graph.ts)

### Port definition (SbcNode.tsx line 193-195)

```ts
if (type === "ccm" || type === "ocm") {
  ports.push({ key: "detour", label: "API detour outbound", nodeKind: "outbound", icon: Network });
}
```

One right-side port: `detour → outbound`. Matches official `detour` field semantics.

### Subtitle (graph.ts line 693)

```ts
if (service.type === "ocm") return "OpenAI Codex multiplexer";
```

Correct human-readable subtitle.

### Edge rendering (graph.ts line 652-653)

```ts
if (service.detour) {
  edges.push(makeEdge(`edge:service-detour:${tag}:${service.detour}`, id,
    `outbound:${service.detour}`, "detour", "service-detour"));
}
```

Edge from `service:tag (detour)` → `outbound:tag (service-detour)`. Correct.

### Layout membership (graph.ts line 225)

```ts
if (typeof service.detour === "string" && service.detour) memberTags.add(service.detour);
```

Detoured outbound is pulled into `member` depth column. Correct.

**Status: no issues found.**

---

## Right: Inspector (Inspector.tsx)

### Shared field groups (sharedFieldRegistry.ts lines 158-159, 193-196)

```ts
const serviceListenTypes = new Set(["derp", "resolved", "ssm-api", "ccm", "ocm", "hysteria-realm"]);
const serviceTlsTypes    = new Set(["derp", "ssm-api", "ccm", "ocm", "hysteria-realm"]);
```

OCM gets both `listen` and `tls` shared sections. Official docs confirm both are applicable. Correct.

No `http2` group is applied (only `hysteria-realm` gets it). OCM does not use HTTP/2 framing, so this is correct.

### OCM-specific fields block (Inspector.tsx lines 1775-1808)

```
{entityType === "ccm" || entityType === "ocm" ? (
  credential_path   → text input
  usages_path       → text input
  detour            → select (outboundTags)
  users             → JsonField (raw JSON textarea, value: entity.users ?? [])
  headers           → JsonField (raw JSON textarea, value: entity.headers ?? {})
) : null}
```

All 5 OCM-specific scalar/reference fields are rendered. Field-by-field assessment:

| Field | UI control | Correctness |
|---|---|---|
| `credential_path` | text input | correct |
| `usages_path` | text input | correct |
| `detour` | select populated from `outboundTags(config)` | correct |
| `users` | `JsonField` raw textarea | functional but unstructured (see P1) |
| `headers` | `JsonField` raw textarea | functional but unstructured (see P1) |

### serviceHandledFields (Inspector.tsx lines 168-195)

All OCM fields are listed: `credential_path`, `usages_path`, `users`, `headers`, `detour`, plus `listen`/`tls` via `listenSharedFields`. No OCM field falls through to `AdvancedScalarFields` unintentionally.

**Status: all official fields covered. No P0 gaps.**

---

## State / Commands

### Default object (commands.ts lines 522-533)

```ts
if (type === "ocm") {
  return {
    type, tag,
    listen: "127.0.0.1",
    listen_port: 8081,   // ← differs from CCM (8080); intentional disambiguation
    credential_path: "",
    usages_path: "",
    users: [],
    headers: {},
  };
}
```

`detour` and `tls` are absent from default — correct, both are optional. `listen_port: 8081` is a sensible default that avoids conflict with CCM's 8080.

### Edge connect (useProjectStore.ts line 450-453)

```ts
if (outputNode.kind === "service" && outputHandle === "detour"
    && inputNode.kind === "outbound" && inputHandle === "service-detour") {
  if (service?.type !== "ccm" && service?.type !== "ocm") return null;
  return updateEntityField(config, { kind: "service", tag }, "detour", inputNode.value);
}
```

Drag-to-connect correctly writes `detour` into OCM state.

### Port toggle (useProjectStore.ts lines 1207-1221)

Toggling the `detour` port on an OCM node either clears the existing `detour` or creates a `direct` outbound and links it. Correct round-trip behavior.

### Reverse toggle from outbound (useProjectStore.ts lines 862-870)

```ts
if (node.kind === "outbound" && port.key === "service-detour") {
  const service = firstServiceDetouringThrough(config, node.value);
  if (service?.tag) {
    config = updateEntityField(..., "detour", undefined);
  } else {
    const ensured = ensureService(config, "ocm");   // ← creates OCM if none exists
    ...
  }
}
```

Dragging from an outbound's `service-detour` port auto-creates an OCM service if no CCM/OCM exists. This is intentional behavior (OCM is the default new service kind in this flow).

### Type change (tests/config-doc-capability.test.ts line 406-408)

```ts
const alternateType = type === "resolved" ? "ocm" : "resolved";
config = changeEntityType(config, { kind: "service", tag }, alternateType);
```

OCM participates in `changeEntityType` smoke test. Passes.

---

## Priority Findings

### P1 — users repeater is raw JSON (Inspector.tsx line 1805)

`users` is rendered as `<JsonField label="Users JSON" value={entity.users ?? []} .../>`.

The official schema is a typed array of `{name: string, token: string}` objects. A raw textarea works but:
- No per-entry add/remove/reorder.
- No inline validation of `name`/`token` fields.
- Difficult to use for non-technical users who configure multiple named tokens.

**Recommendation:** Replace with a structured repeater that renders one row per user with `name` (text) and `token` (password-style text) inputs plus add/remove controls.

### P1 — headers map repeater is raw JSON (Inspector.tsx line 1806)

`headers` is rendered as `<JsonField label="Headers JSON" value={entity.headers ?? {}} .../>`.

The official schema is a plain string→string map. A raw textarea works but is error-prone for key-value data.

**Recommendation:** Replace with a key-value repeater (two text inputs per row: header name, header value) with add/remove controls.

---

## Implementation Tasks

1. **users structured repeater** — Replace `JsonField` for `users` with a repeater component that renders `{name, token}` rows. Each row: `name` text input + `token` text input (optionally masked) + remove button. Add-row button appends `{name: "", token: ""}`. Serialize as array on change.

2. **headers key-value repeater** — Replace `JsonField` for `headers` with a key-value repeater. Each row: key text input + value text input + remove button. Add-row appends an empty pair. Serialize as `Record<string,string>` on change.

3. **Regression test for users/headers round-trip** — After implementing structured repeaters, add a test that: creates an OCM node, adds two users and two headers via the new controls, exports JSON, re-imports, and verifies the values survive the round-trip.

---

## Done Criteria

- Palette entry `service-ocm` adds an OCM service node and opens Inspector.
- Canvas node subtitle reads "OpenAI Codex multiplexer".
- Canvas `detour` port connects to any outbound and writes `detour` tag to JSON.
- Inspector renders `credential_path`, `usages_path`, `detour` select, `users`, `headers` for OCM nodes.
- Inspector `listen` and `tls` shared sections appear (both are in serviceListenTypes / serviceTlsTypes).
- All 8 official fields round-trip through JSON export without loss.
- Semantic diagnostics catch a missing/invalid `detour` tag reference.
- Fixture or smoke test imports a config with OCM users and headers and verifies node renders correctly.
