export const meta = {
  name: 'sbc-canvas-config-gen-review',
  description: 'Understand sing-box upstream config schema + the sbc-ui canvas implementation, then review whether a valid config can be built purely via click/drag/simple-edit',
  phases: [
    { title: 'Understand-Upstream', detail: 'parallel readers over sing-box configuration docs by category' },
    { title: 'Understand-Impl', detail: 'parallel readers over the canvas/domain/state implementation' },
    { title: 'Review', detail: 'six review dimensions cross-checking schema vs implementation' },
    { title: 'Verify', detail: 'adversarially verify each finding against code/docs' },
    { title: 'Synthesize', detail: 'produce the Chinese assessment report' },
  ],
}

const STABLE = 'docs/upstream/sing-box/stable/configuration'

const UPSTREAM_SCHEMA = {
  type: 'object',
  required: ['category', 'summary', 'objectTypes', 'references', 'requiredForValid', 'versionNotes'],
  properties: {
    category: { type: 'string' },
    summary: { type: 'string' },
    objectTypes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'keyFields'],
        properties: {
          name: { type: 'string' },
          purpose: { type: 'string' },
          keyFields: { type: 'array', items: { type: 'string' } },
          referenceFields: { type: 'array', items: { type: 'string' }, description: 'fields holding tags/pointers to other config objects' },
          nestedComplexFields: { type: 'array', items: { type: 'string' }, description: 'fields that are objects/arrays/maps needing structured editing (tls, transport, headers, users, rules...)' },
        },
      },
    },
    references: {
      type: 'array',
      description: 'reference edges inherent in sing-box config (the natural graph)',
      items: {
        type: 'object',
        required: ['from', 'field', 'to'],
        properties: { from: { type: 'string' }, field: { type: 'string' }, to: { type: 'string' }, cardinality: { type: 'string' } },
      },
    },
    requiredForValid: { type: 'array', items: { type: 'string' }, description: 'minimal fields required for a valid config of this category' },
    versionNotes: { type: 'string', description: 'anything that differs across oldstable/stable/testing, deprecations, migrations' },
  },
}

const IMPL_SCHEMA = {
  type: 'object',
  required: ['subsystem', 'whatItDoes', 'codeRefs'],
  properties: {
    subsystem: { type: 'string' },
    whatItDoes: { type: 'string' },
    nodeOrProtocolsModeled: { type: 'array', items: { type: 'string' }, description: 'node types / protocols / config sections this subsystem knows about' },
    referenceModel: { type: 'string', description: 'how cross-object references are represented as edges/ports/handles, if relevant' },
    interactionAffordances: { type: 'array', items: { type: 'string' }, description: 'concrete click/drag/edit operations a user can do via this subsystem' },
    serializationBehavior: { type: 'string', description: 'how this maps to/from sing-box JSON, if relevant' },
    escapeHatches: { type: 'array', items: { type: 'string' }, description: 'places where raw-JSON / free-text / manual editing is required instead of structured GUI' },
    gapsObserved: { type: 'array', items: { type: 'string' } },
    codeRefs: { type: 'array', items: { type: 'string' }, description: 'file:line anchors for the key claims' },
  },
}

const REVIEW_SCHEMA = {
  type: 'object',
  required: ['dimension', 'verdict', 'score', 'findings'],
  properties: {
    dimension: { type: 'string' },
    verdict: { type: 'string' },
    score: { type: 'string', enum: ['strong', 'adequate', 'weak', 'broken'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'severity', 'description'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'major', 'minor', 'observation'] },
          description: { type: 'string' },
          evidence: { type: 'string', description: 'docRef and/or codeRef file:line backing this' },
          recommendation: { type: 'string' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['holds', 'confidence'],
  properties: {
    holds: { type: 'boolean', description: 'true if the finding is accurate & reproducible against the actual code/docs' },
    correction: { type: 'string', description: 'corrected/refined description if the original was wrong or imprecise' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    severityAdjustment: { type: 'string', description: 'if the severity should change, the new severity + why' },
  },
}

const SYNTH_SCHEMA = {
  type: 'object',
  required: ['coreVerdict', 'overallScore', 'executiveSummary', 'topStrengths', 'topGaps', 'reportMarkdown'],
  properties: {
    coreVerdict: { type: 'string', description: 'Direct answer in Chinese: can a complete valid sing-box config be produced purely via click/drag/simple-edit, and to what degree' },
    overallScore: { type: 'string' },
    executiveSummary: { type: 'string', description: 'Chinese' },
    topStrengths: { type: 'array', items: { type: 'string' } },
    topGaps: { type: 'array', items: { type: 'string' } },
    reportMarkdown: { type: 'string', description: 'full detailed report in 简体中文 markdown' },
  },
}

// ---------- Phase A: upstream schema understanding ----------
const upstreamGroups = [
  { category: 'top-level + log + ntp + experimental + certificate', files: `${STABLE}/index.md, ${STABLE}/log/index.md, ${STABLE}/ntp/index.md, ${STABLE}/experimental/index.md, ${STABLE}/experimental/cache-file.md, ${STABLE}/experimental/clash-api.md, ${STABLE}/experimental/v2ray-api.md, ${STABLE}/certificate/index.md` },
  { category: 'inbound (all protocols)', files: `every English .md in ${STABLE}/inbound/ (index, mixed, socks, http, shadowsocks, vmess, vless, trojan, naive, hysteria, hysteria2, tuic, anytls, shadowtls, tun, redirect, tproxy, direct)` },
  { category: 'outbound (all protocols, incl. selector/urltest)', files: `every English .md in ${STABLE}/outbound/ (index, direct, block, socks, http, shadowsocks, vmess, vless, trojan, wireguard, hysteria, hysteria2, tuic, anytls, shadowtls, ssh, tor, dns, selector, urltest). Pay special attention to selector & urltest — their "outbounds" field is the core reference graph.` },
  { category: 'endpoint (wireguard, tailscale)', files: `every English .md in ${STABLE}/endpoint/` },
  { category: 'dns (index, rule, rule_action, fakeip, servers)', files: `${STABLE}/dns/index.md, rule.md, rule_action.md, fakeip.md, and every English .md in ${STABLE}/dns/server/` },
  { category: 'route (index, rule, rule_action, sniff, geoip, geosite)', files: `every English .md in ${STABLE}/route/. The route.rules[].outbound and rule-set references are central reference edges.` },
  { category: 'rule-set (index, headless-rule, source-format, adguard)', files: `every English .md in ${STABLE}/rule-set/` },
  { category: 'service (index, ccm, derp, ocm, resolved, ssm-api)', files: `every English .md in ${STABLE}/service/` },
  { category: 'shared (dial, listen, tls, multiplex, v2ray-transport, tcp-brutal, udp-over-tcp, etc.)', files: `every English .md in ${STABLE}/shared/. These are reused field blocks embedded in inbounds/outbounds — they define the "complex nested editor" surface.` },
]

const versionDiffPrompt = `You are a sing-box schema version analyst. Compare the configuration schema across the three vendored doc versions:
- docs/upstream/sing-box/oldstable/configuration/
- docs/upstream/sing-box/stable/configuration/
- docs/upstream/sing-box/testing/configuration/
Use Bash to diff directory listings and grep for version markers ("!!! warning", "deprecated", ":material-alpha:", "since sing-box", migration notes) across the three trees. Identify: (1) config sections/protocols that exist in only some versions (e.g. cloudflared inbound, mdns dns server, hysteria-realm service, certificate-provider, http2/quic/http-client/neighbor shared blocks appear only in testing); (2) deprecated/removed items (legacy dns servers, geoip/geosite, the dns "address"/legacy format); (3) renamed/migrated fields. Return a category="version-diff" digest. In objectTypes, list version-gated items with which versions they appear in (put that in 'purpose'). In versionNotes, give the overall picture of how much the schema drifts across versions.`

// ---------- Phase B: implementation understanding ----------
const implGroups = [
  { subsystem: 'state-store', files: 'src/state/useProjectStore.ts (1976 lines)', focus: 'The zustand store. Extract: the in-memory data model (project/nodes/edges shape), what a "node" is and what a "edge"/reference is, the full set of mutation actions (add node, connect, edit field, delete, move, import/export, undo/redo), how the store relates to sing-box config sections. Is the store the single source of truth that serialization reads from?' },
  { subsystem: 'canvas-graph-render', files: 'src/canvas/graph.ts (1231 lines), src/components/CanvasWorkspace.tsx, src/components/SbcNode.tsx, src/components/CanvasEdge.tsx, src/canvas/nodeLabels.ts', focus: 'How config objects become React Flow nodes/edges. What ports/handles exist on a node, how edges are drawn, what drag-to-connect does, how an invalid connection is rejected (red line), how node badges/subtitles are derived. This is where the visual graph metaphor lives.' },
  { subsystem: 'serialization', files: 'src/domain/serialization.ts, src/domain/indexes.ts', focus: 'The graph <-> sing-box JSON mapping. Does graph -> JSON produce a valid sing-box config? Is there JSON -> graph import (round-trip)? What is dropped or approximated? How are tags generated and references resolved into JSON tag strings?' },
  { subsystem: 'domain-model', files: 'src/domain/types.ts, src/domain/protocols.ts, src/domain/templates.ts (1419 lines)', focus: 'The catalog of node kinds / protocols the app models, the TypeScript types for nodes & fields, and the prebuilt templates. Which sing-box protocols/sections are present vs absent in this catalog? How are field schemas declared per protocol?' },
  { subsystem: 'reference-port-model', files: 'src/domain/referenceRegistry.ts, src/domain/portRelationRegistry.ts, src/domain/sharedFieldRegistry.ts', focus: 'THE core of the workflow metaphor. Which sing-box references (outbound->outbound for selector/urltest, route.rule->outbound, route.rule->rule_set, dns.rule->dns server, *->detour/dial, etc.) are modeled as edges/ports? What does each port represent? Are there references in the schema that are NOT modeled here?' },
  { subsystem: 'inspector-editing', files: 'src/components/Inspector.tsx (5641 lines), src/components/InspectorPanels.tsx, src/components/RuleTables.tsx, src/components/ChipPickerPopover.tsx', focus: 'The field-editing surface. For each field type, how does a user edit it (text input, toggle, dropdown, chip picker, nested table)? Are complex nested fields (tls, transport, users[], rules[], headers map) editable structurally, or do they require raw JSON / free text? Identify every escape-hatch where the user must type JSON or where a field is not editable at all.' },
  { subsystem: 'commands', files: 'src/domain/commands.ts (1319 lines)', focus: 'The command layer: enumerate the operations users can invoke (add/connect/disconnect/edit/delete/duplicate/convert/move). How do click & drag map to commands? Are there config-construction operations that have NO command (i.e. only doable by raw edit)?' },
  { subsystem: 'diagnostics-version', files: 'src/domain/diagnostics.ts (2018 lines), src/domain/diagnosticTargets.ts, src/domain/targets.ts', focus: 'Validation & version targeting. What sing-box version "targets" exist, how do diagnostics gate features by version, what classes of invalid config are caught (missing refs, dangling tags, type errors, deprecated usage)? Does validation cover enough to guarantee the exported JSON is actually accepted by sing-box?' },
  { subsystem: 'palette-interaction', files: 'src/components/Palette.tsx (605 lines), src/components/canvasInteractionContext.ts, src/components/TopBar.tsx, src/components/DiagnosticsPopover.tsx', focus: 'How nodes get created and how the user navigates. What can be added from the palette (drag-out / click-to-add)? Top-bar actions (import, export, target switch). Is every config section reachable by creating a node, or are some sections (log, ntp, experimental, route options) only reachable some other way?' },
]

const upstreamPrompt = (g) => `You are a sing-box configuration schema analyst. Read these upstream docs (use Read; the docs are markdown with field tables): ${g.files}

Extract the SCHEMA and especially the REFERENCE GRAPH for category "${g.category}". For each object type list keyFields, referenceFields (fields whose value is a tag/pointer to another config object — these become edges in a node graph), and nestedComplexFields (object/array/map fields that need a structured sub-editor). In 'references', enumerate every place this category points to another config object (e.g. selector.outbounds -> outbound tags, route rule.outbound -> outbound tag, rule.rule_set -> rule-set tag, *.detour -> outbound tag, dns rule.server -> dns server tag, tls.* , dial fields). In requiredForValid list the minimal fields. This feeds a review of whether a node-graph GUI can fully represent sing-box configs, so be precise about what is a reference vs a scalar vs a nested object. Be exhaustive but terse. Return the structured object.`

const implPrompt = (g) => `You are a senior frontend/architecture analyst reading the sbc-ui codebase (a React-Flow canvas that visualizes & generates sing-box JSON configs). Read these files (use Read/Grep): ${g.files}

Focus: ${g.focus}

Return a precise digest. Ground every important claim with a file:line codeRef. List interactionAffordances as concrete user gestures (e.g. "drag from palette to add an outbound node", "click outbound port then pick target to create selector edge"). List escapeHatches wherever the user must type raw JSON / free text / cannot edit structurally. List gapsObserved for anything the schema needs that this subsystem does not handle. Be exhaustive but terse.`

let upstream, impl
await (async () => {
  const [u, i] = await Promise.all([
    parallel([
      ...upstreamGroups.map((g) => () => agent(upstreamPrompt(g), { label: `up:${g.category.split(' ')[0]}`, phase: 'Understand-Upstream', schema: UPSTREAM_SCHEMA })),
      () => agent(versionDiffPrompt, { label: 'up:version-diff', phase: 'Understand-Upstream', schema: UPSTREAM_SCHEMA }),
    ]),
    parallel(implGroups.map((g) => () => agent(implPrompt(g), { label: `impl:${g.subsystem}`, phase: 'Understand-Impl', schema: IMPL_SCHEMA }))),
  ])
  upstream = u.filter(Boolean)
  impl = i.filter(Boolean)
})()

log(`Understanding complete: ${upstream.length} upstream digests, ${impl.length} impl digests. Starting review.`)

// Compact context for review agents
const ctx = JSON.stringify({ upstream, impl })

// ---------- Phase C: review dimensions ----------
const dimensions = [
  { key: 'schema-coverage', prompt: 'COVERAGE: Cross-check the upstream schema (every inbound/outbound/endpoint protocol, dns servers, route/dns rule actions, rule-set, service, shared blocks, log/ntp/experimental/certificate top-level sections) against what the implementation models (domain-model, palette, inspector digests). Which sections/protocols/fields can be represented in the canvas, and which are MISSING or only partially modeled? Quantify coverage. Distinguish "modeled & editable" vs "modeled but not editable" vs "absent".' },
  { key: 'graph-fidelity', prompt: 'GRAPH FIDELITY: Does the node/edge/port model faithfully represent sing-box reference structure? Compare the upstream "references" lists (selector.outbounds, urltest.outbounds, route rule->outbound/rule_set, dns rule->server, *.detour, dial fields, route final/default) against the reference-port-model + canvas-graph digests. Are there references that CANNOT be expressed as an edge (so the user must type a tag string)? Are there edges that misrepresent or over-simplify the schema? Is the metaphor sound or leaky?' },
  { key: 'interaction-completeness', prompt: 'INTERACTION COMPLETENESS (the central question): Can a user produce a COMPLETE, VALID sing-box config purely via click / drag / simple structured edit, with NO hand-written JSON? Walk the path: add nodes (palette), connect references (drag), edit fields (inspector). Identify every point where the user is forced into raw JSON, free-text-that-must-be-valid-JSON, or where a needed config construct has no GUI affordance at all (use the escapeHatches & gaps from impl digests). Give a clear verdict with the percentage/scope of configs achievable GUI-only.' },
  { key: 'serialization-correctness', prompt: 'SERIALIZATION CORRECTNESS: Does the node graph serialize to VALID sing-box JSON that sing-box would accept? Is there round-trip import (existing JSON -> graph -> JSON) and is it lossless? What gets dropped/approximated? Are generated tags & resolved references correct? Consider ordering, required fields, and whether diagnostics actually guard validity before export.' },
  { key: 'version-targeting', prompt: 'VERSION TARGETING: sing-box has oldstable/stable/testing with schema drift (version-gated protocols/fields, deprecations, migrations — see the version-diff upstream digest). Does the implementation (diagnostics-version, targets) handle version targeting correctly? Are version-gated features gated, deprecated features warned, and does the editor expose the right field set per target? Where could it emit a config invalid for the selected version?' },
  { key: 'architecture-soundness', prompt: 'ARCHITECTURE SOUNDNESS: Is the design reasonable & maintainable for the goal of "GUI-as-sing-box-config-source"? Evaluate: single source of truth for the schema (registries vs hardcoding scattered across Inspector.tsx 5641 lines / templates / protocols / diagnostics), how a new protocol/field would be added (how many files), coupling between store/graph/serialization/inspector, and whether the registries (reference/port/sharedField) actually centralize the schema or are duplicated. Flag smells and structural risks.' },
]

const reviewed = await pipeline(
  dimensions,
  (d) => agent(
    `You are a meticulous senior reviewer of the sbc-ui sing-box config canvas. Below is the combined understanding of (a) the sing-box upstream config schema and (b) the implementation, as JSON.\n\n${ctx}\n\n${d.prompt}\n\nUse the digests as your map, but VERIFY key claims by reading the actual files (Read/Grep) and actual docs before asserting — do not trust the digest blindly. Produce findings with severity and a concrete recommendation each, and a one-line verdict + score for the dimension. Be specific and evidence-backed (cite file:line or doc path). Return the structured object.`,
    { label: `review:${d.key}`, phase: 'Review', schema: REVIEW_SCHEMA },
  ),
  (review, d) => parallel((review.findings || []).map((f) => () =>
    agent(
      `Adversarially verify this review finding about the sbc-ui sing-box canvas. Dimension: ${review.dimension}. Finding: "${f.title}" (severity ${f.severity}).\nDescription: ${f.description}\nClaimed evidence: ${f.evidence || '(none given)'}\n\nIndependently check it against the ACTUAL code and docs (Read/Grep/Bash). Default to holds=false if you cannot reproduce/confirm it. If the claim is true but imprecise, set holds=true and give a correction. If severity is mis-rated, note severityAdjustment. Return the structured verdict.`,
      { label: `verify:${(f.title || 'finding').slice(0, 28)}`, phase: 'Verify', schema: VERDICT_SCHEMA },
    ).then((v) => ({ dimension: review.dimension, dimVerdict: review.verdict, dimScore: review.score, ...f, verdict: v }))
      .catch(() => null),
  )),
)

const allFindings = reviewed.flat().filter(Boolean)
const confirmed = allFindings.filter((f) => f.verdict && f.verdict.holds)
const rejected = allFindings.filter((f) => f.verdict && !f.verdict.holds)
log(`Review complete: ${allFindings.length} findings, ${confirmed.length} confirmed, ${rejected.length} rejected. Synthesizing.`)

// ---------- Phase D: synthesis ----------
phase('Synthesize')
const dimScores = dimensions.map((d) => {
  const r = reviewed.flat().filter(Boolean).find((f) => f.dimension && f.dimension.toLowerCase().includes(d.key.split('-')[0]))
  return { dimension: d.key, score: r ? r.dimScore : 'unknown', verdict: r ? r.dimVerdict : '' }
})

const synthInput = JSON.stringify({
  dimensionScores: dimScores,
  confirmedFindings: confirmed.map((f) => ({ dimension: f.dimension, title: f.title, severity: f.verdict.severityAdjustment || f.severity, description: f.verdict.correction || f.description, evidence: f.evidence, recommendation: f.recommendation, confidence: f.verdict.confidence })),
  upstreamReferenceGraph: upstream.map((u) => ({ category: u.category, references: u.references, versionNotes: u.versionNotes })),
  implSummary: impl.map((i) => ({ subsystem: i.subsystem, whatItDoes: i.whatItDoes, referenceModel: i.referenceModel, escapeHatches: i.escapeHatches, gapsObserved: i.gapsObserved })),
})

const synthesis = await agent(
  `You are the lead architect writing the final assessment of sbc-ui — a React-Flow canvas whose goal is to let users GENERATE sing-box JSON configs purely through clicking, dragging, and simple structured editing ("workflow-izing the JSON"). Below is the verified evidence: per-dimension scores, confirmed findings, the upstream reference graph, and an implementation summary.\n\n${synthInput}\n\nWrite the final report in 简体中文 markdown. It MUST answer the user's central question directly: 现在的设计与实现是否合理?能否仅通过点击、拖拽、简单编辑就生成 sing-box 配置文件,真正实现了 JSON 的 workflow 化?\n\nStructure the reportMarkdown as: (1) 总体结论 (direct verdict + overall score); (2) 六个维度评分表 (coverage / graph-fidelity / interaction-completeness / serialization / version-targeting / architecture, each with score + one-line judgement); (3) 设计亮点 (what the node/edge/port + registry design gets right); (4) 关键差距与风险 (grouped by severity, each finding with evidence file:line/doc and a recommendation); (5) "纯 GUI 可达性" 专项分析 — concretely which parts of a sing-box config a user can build GUI-only vs which force raw JSON / are unreachable; (6) 改进路线建议 (prioritized). Be concrete, cite evidence, no fluff. coreVerdict and executiveSummary in Chinese; topStrengths/topGaps as short Chinese bullet strings.`,
  { label: 'synthesize', phase: 'Synthesize', schema: SYNTH_SCHEMA },
)

return {
  coreVerdict: synthesis.coreVerdict,
  overallScore: synthesis.overallScore,
  executiveSummary: synthesis.executiveSummary,
  topStrengths: synthesis.topStrengths,
  topGaps: synthesis.topGaps,
  reportMarkdown: synthesis.reportMarkdown,
  stats: { upstreamDigests: upstream.length, implDigests: impl.length, findings: allFindings.length, confirmed: confirmed.length, rejected: rejected.length },
  dimensionScores: dimScores,
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * RE-ASSESSMENT WORKFLOW — "理解 schema → 理解实现 → 对照评审 → 对抗验证 → 综合"
 * ─────────────────────────────────────────────────────────────────────────────
 * This is the canvas config-generation review that produced
 * `docs/canvas-config-gen-assessment-2026-05-30.md`. It is the re-measurement
 * harness for the remediation goal
 * `docs/goals/canvas-config-gen-remediation-execution.md`.
 *
 * Single source of truth = `docs/upstream/sing-box/{stable,testing,oldstable}/`.
 *
 * To RE-RUN after the goal completes (re-derives the verdict + six dimension
 * scores from scratch against current code + docs):
 *
 *   Workflow({ scriptPath: "scripts/workflows/canvas-config-gen-review.workflow.js" })
 *
 * It returns { coreVerdict, overallScore, dimensionScores, topStrengths,
 * topGaps, reportMarkdown, stats }. Write the new reportMarkdown to a fresh
 * dated file `docs/canvas-config-gen-assessment-<YYYY-MM-DD>.md` and diff the
 * dimensionScores against the 2026-05-30 baseline (serialization=strong; the
 * other five=adequate; pure-GUI reachability ~60-70%).
 *
 * The original baseline run: 73 agents, 47 findings (44 confirmed, 3 rejected).
 */
