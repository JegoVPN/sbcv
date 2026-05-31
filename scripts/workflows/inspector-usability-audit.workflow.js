export const meta = {
  name: 'inspector-usability-audit',
  description: 'Logically audit every canvas inspector for fields a user cannot actually configure correctly, tracing form -> state -> serialization -> round-trip against docs/upstream, motivated by the rule-set HTTP Client being unconfigurable under sing-box 1.14',
  phases: [
    { title: 'Audit', detail: 'one agent per inspector slice traces each field through the real data flow vs upstream docs' },
    { title: 'Verify', detail: 'adversarially re-trace each finding on the real code before trusting it' },
    { title: 'Synthesize', detail: 'dedupe, rank by severity, write the prioritized remediation report' },
  ],
}

const REPO = '<repo root>'

const ARCHITECTURE = [
  'ARCHITECTURE (this is a single-page React canvas GUI that emits sing-box JSON; there is NO src/lib/singbox — the pipeline lives in src/domain and src/components/inspector):',
  '',
  'Forms / inspectors (what the user actually edits):',
  '  src/components/Inspector.tsx, InspectorPanels.tsx, MobileInspectorSheet.tsx   inspector shell + dispatch',
  '  src/components/inspector/<kind>Inspector.tsx                                  per-node-kind form bodies',
  '  src/components/inspector/sharedFields.tsx                                     reusable field widgets (TLS, transport, multiplex, dial, http-client, etc.)',
  '  src/components/inspector/handledFields.ts                                     which raw config keys the inspector claims to handle (anything not listed may be an "unhandled/advanced" passthrough)',
  '',
  'Domain pipeline (state <-> sing-box config):',
  '  src/domain/types.ts                 domain model types for every node kind',
  '  src/domain/schemaRegistry.ts        declarative field schema (may DRIVE which controls render and their types/enums)',
  '  src/domain/sharedFieldRegistry.ts   declarative schema for shared sub-objects',
  '  src/domain/serialization.ts         domain state <-> sing-box JSON. CHECK BOTH directions: generate (export) AND parse (import). A field dropped here never reaches output; a field not parsed here is lost on import/round-trip.',
  '  src/domain/diagnostics.ts + diagnosticTargets.ts   validation, warnings, the deprecation messages and the WARNING badge (this is where the download_detour deprecation text comes from)',
  '  src/domain/minVersions.ts           per-field minimum sing-box version / target gating',
  '  src/domain/referenceRegistry.ts + portReferenceAdapter.ts + portRelationRegistry.ts   the CROSS-NODE REFERENCE system: dropdowns that pick another node by tag (e.g. detour -> outbound). A reference dropdown showing only "None" usually means nothing of the referenced kind can be created/selected.',
  '  src/domain/commands.ts, templates.ts, indexes.ts   mutations, presets, lookups',
  '  src/state/useProjectStore.ts        zustand store (current state + target version)',
  '  src/canvas/graph.ts, nodeLabels.ts  node graph model + display labels',
  '',
  'Upstream docs (authoritative schema) live under docs/upstream/sing-box/<channel>/configuration/... where <channel> is stable | testing | oldstable.',
  'The canvas Target selector "1.14 testing" maps to the TESTING channel. IMPORTANT: shared/http-client.md exists ONLY in the testing channel docs — http_client is a NEW 1.14 feature, which is exactly why download_detour is deprecated in 1.14 and the UI tells users to switch to it.',
].join('\n')

const MOTIVATION = [
  'MOTIVATING BUG (the user-reported symptom that triggered this audit — treat it as the canonical example of the class of defect to hunt, but do NOT assume its root cause; trace it):',
  'Target = "1.14 testing". On a remote Rule-Set node the inspector shows a red deprecation notice: "`download_detour` is deprecated in sing-box 1.14.0 (removed in 1.16.0). Use an HTTP Client (`http_client`) instead." This deprecation is CORRECT and expected (upstream says so).',
  'The inspector DOES render a "Shared Configuration > HTTP Client" section as the suggested replacement. BUT the HTTP Client control is a dropdown whose ONLY option is "None" — the user cannot actually configure an HTTP Client at all. So the UI advises an alternative it makes impossible to use, while still emitting the deprecated field.',
  'Note: grep shows http_client referenced across many domain files (serialization.ts, referenceRegistry.ts, portReferenceAdapter.ts, portRelationRegistry.ts, diagnostics.ts, minVersions.ts, sharedFields.tsx, etc.) — so this is NOT a simple "never wired up" case. Reason through it: is http_client modeled in sing-box as an INLINE object, a REFERENCE to a named/shared client, or a global/shared block? Read shared/http-client.md and rule-set/index.md to decide. Then determine why the dropdown can only ever be "None": is there no creatable HTTP Client node/entry? is the reference adapter pointing at the wrong collection? is it modeled as a reference when upstream wants an inline object (or vice-versa)? Find the exact mechanism.',
].join('\n')

const METHOD = [
  'METHOD — use Read and Grep on the REAL files; never guess. For the assigned slice:',
  '1. Open every inspector/form file in the slice. Enumerate every field/control the user sees and the exact state key each reads/writes. Note any control that is a stub ("coming soon", TODO), disabled, or a reference-dropdown whose options can be empty.',
  '2. Open the mapped upstream doc(s) in the TESTING channel (the audit target). Record the authoritative field set: names, types, optional/required, units, enum values, version notes, deprecations, and whether each field is inline vs a reference vs shared.',
  '3. For EACH field, reason through the full data flow and answer:',
  '   a. SET — can the user actually give it a value? (not a stub, not permanently-disabled, not a reference dropdown with no creatable target, not missing entirely.)',
  '   b. SURVIVE — does the value reach the generated config? grep the key in serialization.ts (the generate direction) and confirm it is emitted. Watch for spreads / generic passthrough / handledFields.ts allow-lists.',
  '   c. ROUND-TRIP — does serialization.ts (the parse direction) read it back so import + re-export is lossless?',
  '   d. SHAPE — key name, type, units, enum values, nesting, inline-vs-reference all match upstream?',
  '   e. VERSION — is min-version / deprecation gating correct for the selected target, and if the UI suggests an alternative, is that alternative actually usable end to end?',
  '4. Emit a finding for every gap. Prefer fewer, fully-traced findings over speculation, but be exhaustive within the slice.',
  'If you cannot fully cover the slice, emit one finding with failureMode "coverage-gap" naming what you skipped.',
].join('\n')

// Work-list: real inspector files grouped into slices, each mapped to its authoritative testing-channel docs.
const SLICES = [
  {
    id: 'ruleset-httpclient',
    title: 'Rule-set + shared HTTP Client + cross-node reference system (THE motivating bug)',
    files: [
      'src/components/inspector/ruleSetInspector.tsx',
      'src/components/inspector/sharedFields.tsx',
      'src/components/inspector/handledFields.ts',
      'src/domain/referenceRegistry.ts',
      'src/domain/portReferenceAdapter.ts',
      'src/domain/portRelationRegistry.ts',
      'src/domain/serialization.ts',
      'src/domain/diagnostics.ts',
      'src/domain/minVersions.ts',
    ],
    docs: [
      'configuration/rule-set/index.md',
      'configuration/shared/http-client.md',
      'configuration/shared/dial.md',
    ],
    focus: 'Center on why the HTTP Client control can only be "None" and how http_client should be modeled vs how it is. Also audit every other rule-set field (type, format, url, download_detour, update_interval, path, rules).',
  },
  {
    id: 'outbound',
    title: 'Outbound / proxy protocol inspector',
    files: ['src/components/inspector/outboundInspector.tsx', 'src/components/inspector/sharedFields.tsx'],
    docs: ['configuration/outbound/index.md', 'configuration/outbound/vless.md', 'configuration/outbound/vmess.md', 'configuration/outbound/trojan.md', 'configuration/outbound/shadowsocks.md', 'configuration/outbound/hysteria2.md', 'configuration/outbound/tuic.md', 'configuration/outbound/anytls.md', 'configuration/outbound/shadowtls.md', 'configuration/outbound/socks.md', 'configuration/outbound/http.md', 'configuration/outbound/wireguard.md', 'configuration/outbound/selector.md', 'configuration/outbound/urltest.md', 'configuration/outbound/ssh.md', 'configuration/outbound/tor.md'],
    focus: 'Per protocol type, check that every protocol-specific field renders, serializes, round-trips, and matches upstream shape. Flag any protocol whose form is missing fields the doc requires.',
  },
  {
    id: 'inbound',
    title: 'Inbound inspector',
    files: ['src/components/inspector/inboundInspector.tsx', 'src/components/inspector/sharedFields.tsx'],
    docs: ['configuration/inbound/index.md', 'configuration/inbound/vless.md', 'configuration/inbound/vmess.md', 'configuration/inbound/trojan.md', 'configuration/inbound/shadowsocks.md', 'configuration/inbound/hysteria2.md', 'configuration/inbound/tuic.md', 'configuration/inbound/anytls.md', 'configuration/inbound/mixed.md', 'configuration/inbound/socks.md', 'configuration/inbound/http.md', 'configuration/inbound/tun.md', 'configuration/inbound/direct.md', 'configuration/inbound/redirect.md', 'configuration/inbound/tproxy.md', 'configuration/shared/listen.md'],
    focus: 'Check listen fields and per-type inbound fields, including users/credentials editors (a common place for "coming soon" stubs).',
  },
  {
    id: 'dns',
    title: 'DNS + DNS server inspector',
    files: ['src/components/inspector/dnsInspector.tsx', 'src/components/inspector/dnsServerInspector.tsx', 'src/components/inspector/sharedFields.tsx'],
    docs: ['configuration/dns/index.md', 'configuration/dns/server/index.md', 'configuration/dns/server/https.md', 'configuration/dns/server/tls.md', 'configuration/dns/server/quic.md', 'configuration/dns/server/udp.md', 'configuration/dns/server/tcp.md', 'configuration/dns/server/local.md', 'configuration/dns/server/hosts.md', 'configuration/dns/server/dhcp.md', 'configuration/dns/server/fakeip.md', 'configuration/dns/server/tailscale.md', 'configuration/dns/server/resolved.md', 'configuration/dns/rule.md', 'configuration/dns/rule_action.md'],
    focus: 'DNS in 1.14 testing uses the new typed-server model. Verify each server type renders the right fields, and that DNS rules/actions are configurable.',
  },
  {
    id: 'endpoint',
    title: 'Endpoint inspector (WireGuard / Tailscale)',
    files: ['src/components/inspector/endpointInspector.tsx', 'src/components/inspector/sharedFields.tsx'],
    docs: ['configuration/endpoint/index.md', 'configuration/endpoint/wireguard.md', 'configuration/endpoint/tailscale.md'],
    focus: 'WireGuard peers and Tailscale fields — peer/address list editors are common stub points.',
  },
  {
    id: 'route',
    title: 'Route rules + rule actions inspector',
    files: ['src/components/inspector/routeInspector.tsx', 'src/components/inspector/ruleInspectors.tsx'],
    docs: ['configuration/route/index.md', 'configuration/route/rule.md', 'configuration/route/rule_action.md', 'configuration/route/sniff.md'],
    focus: 'Every rule matcher field and every action type. Check that rule_set references, outbound/detour references, and logical rules are all settable and serialize correctly.',
  },
  {
    id: 'service-cert',
    title: 'Service + certificate-provider inspector',
    files: ['src/components/inspector/serviceInspector.tsx', 'src/components/inspector/certificateProviderInspector.tsx', 'src/components/inspector/sharedFields.tsx'],
    docs: ['configuration/service/index.md', 'configuration/service/derp.md', 'configuration/service/resolved.md', 'configuration/service/ssm-api.md', 'configuration/certificate/index.md', 'configuration/shared/certificate-provider/index.md', 'configuration/shared/certificate-provider/acme.md', 'configuration/shared/dns01_challenge.md'],
    focus: 'Service types and certificate provider config (ACME / DNS-01 challenge are nested-object heavy and stub-prone).',
  },
  {
    id: 'shared-tls-transport',
    title: 'Shared TLS / transport / multiplex / dial widgets + schema registries',
    files: ['src/components/inspector/sharedFields.tsx', 'src/domain/schemaRegistry.ts', 'src/domain/sharedFieldRegistry.ts'],
    docs: ['configuration/shared/tls.md', 'configuration/shared/v2ray-transport.md', 'configuration/shared/multiplex.md', 'configuration/shared/dial.md', 'configuration/shared/tcp-brutal.md', 'configuration/shared/udp-over-tcp.md'],
    focus: 'These widgets are reused by many nodes, so a single missing field here is high-blast-radius. Check TLS (reality, ech, utls), transport (ws/grpc/http/httpupgrade), multiplex, dial against upstream and verify they serialize + round-trip.',
  },
  {
    id: 'settings-version',
    title: 'Global settings + cross-cutting version-gating & deprecation logic',
    files: ['src/components/inspector/settingsInspector.tsx', 'src/domain/minVersions.ts', 'src/domain/diagnostics.ts', 'src/domain/diagnosticTargets.ts'],
    docs: ['configuration/index.md', 'configuration/log/index.md', 'configuration/ntp/index.md', 'configuration/experimental/index.md', 'configuration/experimental/clash-api.md', 'configuration/experimental/cache-file.md', 'configuration/deprecated.md'],
    focus: 'Audit the deprecation/version-gating ENGINE itself: does every deprecation warning point to an alternative that is actually configurable in the UI? (The download_detour->http_client case is the proof that this can be violated.) Cross-check deprecated.md against what the UI lets users build.',
  },
]

const auditPrompt = (slice) => [
  `You are auditing the "${slice.title}" slice of a sing-box GUI config builder. Working dir: ${REPO}. Audit target = sing-box 1.14 (TESTING channel docs).`,
  '',
  'GOAL: find every place where a user CANNOT actually configure a field correctly through the inspector — settable? survives generation? round-trips? correct shape? correct version gating? This is USABILITY + CORRECTNESS via full data-flow reasoning, not a lint/style pass.',
  '',
  `Files in this slice (paths relative to repo root): ${slice.files.join(', ')}`,
  `Authoritative upstream docs (under docs/upstream/sing-box/testing/, plus compare with stable/ where useful): ${slice.docs.join(', ')}`,
  `Slice focus: ${slice.focus}`,
  '',
  ARCHITECTURE,
  '',
  MOTIVATION,
  '',
  METHOD,
  '',
  'SEVERITY: P0 = inspector cannot produce a correct config for this field (silently dropped / impossible to set / wrong key or shape). P1 = silent data loss or round-trip loss. P2 = incomplete but a workaround exists. P3 = cosmetic/copy.',
  'For each finding give: precise codePath (file:line), concrete evidence (quote the code AND the upstream line), and the exact user-visible impact (what the user does, what they expect, what actually happens).',
  'Report ALL findings via the structured schema.',
].join('\n')

const verifyPrompt = (finding, slice) => [
  `Adversarially verify ONE inspector-audit finding. Working dir: ${REPO}. Default to REFUTING unless re-tracing the real code proves it true.`,
  '',
  `Slice: ${slice.id}. Finding:`,
  JSON.stringify(finding, null, 2),
  '',
  'Re-read the EXACT files with Read/Grep — do not trust the finding. Trace the real path:',
  '- "dropped on generate" claim: open src/domain/serialization.ts and confirm the key truly is not emitted. Check object spreads, helper builders, handledFields.ts passthrough, and schemaRegistry-driven emission before concluding.',
  '- "stub / missing / dead control" claim: open the form file and confirm the control is really absent / disabled / placeholder-only / a reference-dropdown with no populatable source.',
  '- "no round-trip" claim: open serialization.ts parse direction and confirm the key is not read back.',
  '- "wrong shape / inline-vs-reference / version" claim: compare the code against the testing-channel upstream doc verbatim.',
  'Beware false positives: a value emitted via spread, a control rendered only for a specific node type/target, a key stored under a different name, a field the doc marks server-generated or client-only, a reference list that IS populatable once a prerequisite node exists.',
  '',
  'Return verdict (confirmed / refuted / partial), corrected severity, a concrete UI repro (step-by-step), expected vs actual generated config, the precise root cause, the exact fix location (file:line + what to change), and your confidence.',
].join('\n')

const synthPrompt = (confirmed) => [
  `You are the lead engineer. Synthesize these adversarially-confirmed inspector-usability findings into a prioritized remediation report. Working dir: ${REPO}.`,
  '',
  'Confirmed findings (each already re-traced against real code):',
  JSON.stringify(confirmed, null, 2),
  '',
  'Write a markdown report:',
  '1. Executive summary — name the systemic pattern(s), how many inspectors/fields are affected, P0/P1 counts.',
  '2. Canonical case — lead with the rule-set HTTP Client problem, fully explained: how http_client should be modeled per upstream, why the UI dropdown can only be "None", and what download_detour is doing meanwhile. State the real root cause.',
  '3. Findings grouped by failure mode (impossible-to-set, dropped-on-generate, no-round-trip, stub, wrong-shape, version-gating, other) then by severity. For each: file, field, user impact, repro, root cause, exact fix location.',
  '4. Remediation plan — ordered by severity, grouped into PR-sized atomics (each = one coherent independently-landable fix). Call out the HTTP Client fix as the first atomic.',
  '5. Coverage — list any coverage-gap findings so nothing is silently dropped.',
  '',
  'Return the full markdown report plus counts and the top systemic themes.',
].join('\n')

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    slice: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          failureMode: { type: 'string', enum: ['impossible-to-set', 'dropped-on-generate', 'no-round-trip', 'stub', 'wrong-shape', 'version-gating', 'coverage-gap', 'other'] },
          form: { type: 'string' },
          field: { type: 'string' },
          upstreamRef: { type: 'string' },
          codePath: { type: 'string' },
          evidence: { type: 'string' },
          userImpact: { type: 'string' },
          severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
        },
        required: ['title', 'failureMode', 'form', 'field', 'evidence', 'userImpact', 'severity'],
      },
    },
  },
  required: ['slice', 'findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: { type: 'string', enum: ['confirmed', 'refuted', 'partial'] },
    severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
    reproSteps: { type: 'string' },
    expected: { type: 'string' },
    actual: { type: 'string' },
    rootCause: { type: 'string' },
    fixLocation: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    notes: { type: 'string' },
  },
  required: ['verdict', 'severity', 'reproSteps', 'expected', 'actual', 'rootCause', 'fixLocation', 'confidence'],
}

const SYNTH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    report: { type: 'string' },
    confirmedCount: { type: 'number' },
    p0Count: { type: 'number' },
    p1Count: { type: 'number' },
    themes: { type: 'array', items: { type: 'string' } },
  },
  required: ['report', 'confirmedCount', 'p0Count', 'p1Count', 'themes'],
}

// Audit each slice, then verify that slice's findings as soon as the audit lands (pipeline, no global barrier).
const sliceResults = await pipeline(
  SLICES,
  (slice) => agent(auditPrompt(slice), { label: `audit:${slice.id}`, phase: 'Audit', schema: FINDINGS_SCHEMA }),
  (res, slice) => parallel((res?.findings ?? []).map((f, i) => () =>
    agent(verifyPrompt(f, slice), { label: `verify:${slice.id}#${i + 1}`, phase: 'Verify', schema: VERDICT_SCHEMA })
      .then((v) => ({ ...f, slice: slice.id, verdict: v }))
      .catch(() => null)
  )),
)

const all = sliceResults.flat().filter(Boolean)
const confirmed = all.filter((f) => f.verdict && (f.verdict.verdict === 'confirmed' || f.verdict.verdict === 'partial'))
const refuted = all.filter((f) => f.verdict && f.verdict.verdict === 'refuted')
log(`Audited ${SLICES.length} slices -> ${all.length} raw findings -> ${confirmed.length} confirmed/partial, ${refuted.length} refuted`)

phase('Synthesize')
const synth = await agent(synthPrompt(confirmed), { label: 'synthesize', phase: 'Synthesize', schema: SYNTH_SCHEMA })

return {
  report: synth.report,
  counts: { raw: all.length, confirmed: confirmed.length, refuted: refuted.length, p0: synth.p0Count, p1: synth.p1Count },
  themes: synth.themes,
  confirmed,
  refuted,
}
