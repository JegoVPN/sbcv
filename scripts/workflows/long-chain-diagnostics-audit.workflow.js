export const meta = {
  name: 'long-chain-diagnostics-audit',
  description: 'Audit "long-chain" diagnostics (verdicts that depend on a cross-section reference or multi-hop fallback/override chain) by extracting the authoritative rule from upstream docs, generating adversarial configs, cross-checking our validateConfig against the REAL sing-box binary (1.12/1.13/1.14), adversarially verifying each divergence, and synthesizing a prioritized findings report',
  phases: [
    { title: 'Probe', detail: 'one agent per chain-family: doc-spec + adversarial configs + binary cross-check via the harness' },
    { title: 'Verify', detail: 'an independent skeptic re-runs the binary and re-reads code/docs to refute each claimed divergence' },
    { title: 'Synthesize', detail: 'dedupe, rank by severity, write the prioritized remediation report' },
  ],
}

// ── Shared context handed to every agent ─────────────────────────────────────────────────────────
const PREAMBLE = `
You are auditing the sbc-ui repo's sing-box config diagnostics for the "LONG-CHAIN" failure class:
a diagnostic whose correct verdict depends on a CROSS-SECTION reference or a MULTI-HOP fallback/override
chain, but which (mis)judges a single field instead of the full chain. The exemplar bug (PR #303) made
\`outbound-domain-without-resolver\` warn on a CORRECT config 42 times because it ignored
\`route.default_domain_resolver\` and the single-DNS-server fallback.

AUTHORITY: docs/upstream/sing-box/{stable,testing,oldstable}/configuration/** is the ONLY source of truth.
Cite the exact doc file + line for every verdict. stable=1.13, testing=1.14, oldstable=1.12.

THE BINARY IS THE FINAL ARBITER. Three real binaries are installed and runnable:
  .tools/bin/sing-box-1.12     -> 1.12.x  (channel "stable",  version "1.12")
  .tools/bin/sing-box-stable   -> 1.13.x  (channel "stable",  version "1.13")
  .tools/bin/sing-box-testing  -> 1.14.x  (channel "testing", version "1.14")
Run a single config directly with:  .tools/bin/sing-box-testing check -c /path/to/config.json
status 0 + no warn/deprecation lines = ACCEPTED; non-zero = REJECTED; status 0 with a warn/deprecation line = WARN.

THE CROSS-CHECK HARNESS (your main tool) compares OUR validateConfig against the binary for every config
file in a directory, across all three targets, and writes a machine-readable report:
  1. Write each adversarial config as .audit/cases/<FAMILY_KEY>/<name>.json  (raw sing-box config, no wrapper).
  2. Run:  CROSSCHECK_DIR=.audit/cases/<FAMILY_KEY> npx vitest run tests/chain-crosscheck.test.ts
  3. Read:  .audit/cases/<FAMILY_KEY>/_report.json
The report has one row per (case × target) with: ours.errorCount/warningCount + ours.diagnostics[].code,
theirs.verdict (pass|reject|warn), theirs.reason, and a "divergence" label. The divergence labels that
are REAL findings:
  - BINARY_PASS_OURS_ERROR      = FALSE POSITIVE: binary accepts, we emit an error (the #303 shape).
  - BINARY_REJECT_OURS_SILENT   = FALSE NEGATIVE: binary rejects, we emit nothing.
  - BINARY_REJECT_OURS_WARN_ONLY= we warn where the binary hard-rejects (should likely be an error).
  - BINARY_WARN_OURS_SILENT     = binary flags a deprecation we miss (softer; judge per the documented-default rule).
  - OURS_THREW                  = validateConfig crashed on a config the binary handles.
Note: ours-WARNING over a binary-PASS is NOT automatically a divergence — advisory warnings are allowed,
EXCEPT do not nag about an empty/unset field whose upstream doc documents a default/fallback (that rule
removed 3 false warnings in PR #302). A warning that contradicts a documented default IS a finding.

CRAFT CONFIGS THAT ISOLATE THE CHAIN. For each chain include at minimum: (a) a CLEAN control the binary
accepts and we should be silent on; (b) a BROKEN control the binary rejects and we should error on;
(c) the FALSE-POSITIVE probe — satisfy the chain via the FAR hop (default/override/elsewhere) the naive
check might miss; (d) the FALSE-NEGATIVE probe — break the chain in a way a single-field check would miss
(dangling ref, wrong-namespace tag, version-gated requirement). Keep configs MINIMAL but binary-valid
except for the one thing under test. Vary by target where the rule changes by version.

SEED FINDINGS (already established this session — treat as leads to confirm/extend, not gospel):
  * A DOMAIN-address DNS server (e.g. {type:"https",server:"dns.google"}) resolving its OWN address is
    only satisfied by a PER-SERVER \`domain_resolver\`. \`route.default_domain_resolver\` does NOT satisfy
    it, and the "single DNS server" optionality does NOT apply to it (binary rejects: "initialize DNS
    server[i]: missing domain resolver for domain server address" on 1.12/1.13/1.14). This suggests PR
    #303's suppression of \`dns-server-domain-without-resolver\` on default/single-server is a FALSE NEGATIVE
    for the DNS-server case. CONFIRM precisely and find the boundary.
  * The dial-fields gate "missing route.default_domain_resolver or domain_resolver in dial fields" is a
    deprecation that is a WARN on 1.12 but FATAL on 1.13 and 1.14. Determine whether our diagnostics flag
    this as an ERROR on 1.13/1.14.
  * There is NO diagnostic validating that the tag named by \`route.default_domain_resolver\` actually
    exists (unlike \`route.default_http_client\` -> missing-http-client). A dangling/typo'd default both
    goes unflagged AND silently suppresses warnings.

Key files: src/domain/diagnostics.ts (the rules), src/domain/indexes.ts (tag collection / namespaces),
src/domain/serialization.ts (parseConfigJson), src/domain/targets.ts (channel<->version).
`

const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['family', 'specSummary', 'findings'],
  properties: {
    family: { type: 'string' },
    specSummary: { type: 'string', description: 'the authoritative chain rule per the docs, with file:line citations and version differences' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'severity', 'ruleId', 'chain', 'docCitation', 'reproFile', 'perTarget', 'proposedFix', 'confidence'],
        properties: {
          id: { type: 'string', description: 'stable kebab id, e.g. dns-server-resolver-default-false-negative' },
          title: { type: 'string' },
          severity: { type: 'string', enum: ['false-positive', 'false-negative', 'missing-check', 'deprecation-gate', 'spec-mismatch', 'ok'] },
          ruleId: { type: 'string', description: 'the diagnostics.ts code involved, or "(none)" if a check is missing entirely' },
          chain: { type: 'string', description: 'the reference/fallback chain this depends on' },
          docCitation: { type: 'string', description: 'doc file:line that proves the correct behavior' },
          reproFile: { type: 'string', description: 'path to the .audit/cases/<family>/<name>.json that demonstrates it' },
          perTarget: {
            type: 'array',
            items: {
              type: 'object',
              required: ['target', 'binaryVerdict', 'ourErrors', 'ourWarnings'],
              properties: {
                target: { type: 'string' },
                binaryVerdict: { type: 'string' },
                binaryReason: { type: 'string' },
                ourErrors: { type: 'number' },
                ourWarnings: { type: 'number' },
                ourCodes: { type: 'string' },
                divergence: { type: 'string' },
              },
            },
          },
          proposedFix: { type: 'string', description: 'the minimal correct fix in diagnostics.ts, honoring the documented-default rule' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['findingId', 'refuted', 'reason'],
  properties: {
    findingId: { type: 'string' },
    refuted: { type: 'boolean', description: 'true if the claimed divergence does NOT hold up (config unfair, doc misread, binary actually agrees with us, etc.)' },
    reason: { type: 'string', description: 'what the independent re-run of the binary + re-read of code/doc showed' },
    correctedSeverity: { type: 'string', enum: ['false-positive', 'false-negative', 'missing-check', 'deprecation-gate', 'spec-mismatch', 'ok', 'unchanged'] },
    binaryReplay: { type: 'string', description: 'the exact per-target binary verdicts you observed on re-run' },
  },
}

// ── The chain-families to audit ──────────────────────────────────────────────────────────────────
const FAMILIES = [
  {
    key: 'dns-server-resolver',
    title: 'DNS server self-resolution (domain_resolver vs route.default vs single-server)',
    brief: `Codes: dns-server-domain-without-resolver (diagnostics.ts ~1844-1852). A DNS server whose \`server\`/
address is a DOMAIN must resolve its own address. Determine EXACTLY what satisfies the binary: per-server
\`domain_resolver\`? \`route.default_domain_resolver\`? the single-DNS-server optionality? Does it differ for
IP-address servers, fakeip, tailscale, resolved, dhcp, hosts, local, tcp/udp/tls/quic/https/http3? Confirm
the seed finding that PR #303's default/single-server suppression is a FALSE NEGATIVE here, and find the
precise boundary (which server types, which versions). Docs: docs/upstream/.../configuration/dns/server/*.md
and shared/dial.md (#domain_resolver). Also test "domain server pointed at by domain_resolver" recursion.`,
  },
  {
    key: 'outbound-endpoint-resolver',
    title: 'Outbound/Endpoint dial resolver chain (+ endpoints have NO check)',
    brief: `Codes: outbound-domain-without-resolver (~958-966). An outbound/endpoint whose server address is a
DOMAIN needs \`domain_resolver\` OR \`route.default_domain_resolver\` (single-DNS-server optional). Verify our
chain matches the binary for outbounds. CRITICAL: ENDPOINTS (wireguard/tailscale with a domain peer/server
address) currently have NO resolver check at all — determine whether the binary requires one for endpoints
and whether we should add it. Also test the "direct" outbound special case (resolves request domains).
Docs: shared/dial.md, outbound/*.md, endpoint/*.md.`,
  },
  {
    key: 'dial-fields-deprecation-gate',
    title: 'Global dial-fields resolver deprecation gate (1.12 warn -> 1.13/1.14 fatal)',
    brief: `The binary emits "missing route.default_domain_resolver or domain_resolver in dial fields is
deprecated ... will be removed in 1.14" — a WARN on 1.12 but a FATAL on 1.13/1.14 (gated by env
ENABLE_DEPRECATED_MISSING_DOMAIN_RESOLVER). Determine the precise trigger condition and whether ANY of our
diagnostics flag it as an ERROR on 1.13/1.14 (so a user is warned before the binary hard-rejects). This is
a version-gated severity escalation — exactly the kind a single-version check misses. Docs: the migration
page + shared/dial.md + dns/index.md (default_domain_resolver). Cross-check all three binaries.`,
  },
  {
    key: 'default-domain-resolver-dangling',
    title: 'route.default_domain_resolver dangling-ref (open follow-up #1)',
    brief: `There is NO diagnostic that the DNS-server tag named by \`route.default_domain_resolver\` (string OR
inline {server} object) exists — unlike route.default_http_client -> missing-http-client (~2493). A typo'd
default both (a) goes unflagged AND (b) silently suppresses the domain-without-resolver warnings. Confirm
the binary rejects a dangling default; confirm we are silent; propose missing-default-domain-resolver
(error, mirror the http_client pattern). Also test the inline {server:"..."} object form. Docs:
route/index.md (default_domain_resolver), dns/rule_action.md (#route format).`,
  },
  {
    key: 'detour-chains',
    title: 'Detour reference chains (outbound/dns-server/service/ntp + ssm/ccm/ocm API + DERP verify)',
    brief: `Codes: missing-endpoint-detour, missing-service-detour, missing-dns-server-detour, ntp-detour-missing,
missing-ssm-api-inbound + ssm-api-no-managed-inbound + ssm-api-inbound-not-managed-shadowsocks,
missing-derp-verify-endpoint + derp-verify-endpoint-not-tailscale. Each detour/ref must resolve to a REAL
entity of the RIGHT namespace/type. Probe: dangling detour; detour pointing at the wrong namespace (e.g. an
inbound tag where an outbound is required); valid detour. Check whether the binary actually rejects each
case we flag (and vice-versa). Watch namespaces: indexes.ts buildNamespacedTagIndex allows a tag reused
across distinct namespaces. Docs: outbound/*, service/*, dns/*, ntp.md, service/ssm.md, service/derp.md.`,
  },
  {
    key: 'rule-set-http-client',
    title: 'Rule-set http_client / download_detour / default_http_client interplay (1.14)',
    brief: `Codes: rule-set-download-detour-deprecated/-removed/-missing/-http-client-conflict, missing-http-client,
http-client-unsupported-field, route-default-http-client-testing-only, rule-set-http-client-testing-only. In
1.14 remote rule-sets migrate from download_detour to http_client (tag into http_clients[] OR inline object;
or route.default_http_client). Map the FULL chain: when is download_detour deprecated vs removed; when is an
http_client required; does a missing http_clients[] tag reject; do inline-object unsupported fields get
silently ignored or rejected. Probe each across 1.13 vs 1.14. Docs: rule-set/source-format or
rule-set/index.md, route/index.md (default_http_client), shared/http-client.md.`,
  },
  {
    key: 'dns-endpoint-service-refs',
    title: 'DNS server -> endpoint/service cross-refs (tailscale, resolved)',
    brief: `Codes: missing-dns-server-endpoint, dns-server-tailscale-endpoint-missing, resolved-service-linux-only.
A tailscale DNS server references an \`endpoint\` (must be a tailscale endpoint); a resolved DNS server
depends on a system service / platform. Probe: dangling endpoint ref; endpoint ref pointing at a non-tailscale
endpoint; resolved on non-linux target. Confirm binary behavior matches our verdicts and severities. Docs:
dns/server/tailscale.md, dns/server/resolved.md, endpoint/tailscale.md.`,
  },
  {
    key: 'conditional-cross-section',
    title: 'Other "X required/valid unless Y elsewhere" cross-section rules',
    brief: `Catch-all for remaining chain rules. Codes to probe: selector-default-not-in-candidates &
missing-outbound-candidate (selector/urltest default must be one of its outbounds, which must exist);
v2ray-stats-inbound-missing / v2ray-stats-outbound-missing (api stats names must match real in/outbounds);
missing-route-final / missing-dns-final (final must reference a real outbound/server, or be optional when one
exists); missing-rule-outbound / missing-route-rule-set / missing-route-rule-inbound / missing-dns-rule-*
(rule references). For each, find a case where the requirement is satisfied via a DIFFERENT section than the
naive check looks at, OR where a dangling ref slips through. Docs: outbound/selector.md, outbound/urltest.md,
experimental/v2ray-api, route/index.md, route/rule.md, dns/rule.md.`,
  },
]

// ── Run ──────────────────────────────────────────────────────────────────────────────────────────
phase('Probe')
log(`Auditing ${FAMILIES.length} long-chain diagnostic families against the real sing-box binaries.`)

const perFamily = await pipeline(
  FAMILIES,
  // Stage 1 — probe: extract the authoritative spec, generate adversarial configs, cross-check.
  (fam) =>
    agent(
      `${PREAMBLE}

YOUR CHAIN-FAMILY: ${fam.title}
FAMILY_KEY: ${fam.key}
${fam.brief}

Do this:
1. Read the authoritative upstream doc(s) for this chain (stable + testing + oldstable where they differ) and
   the relevant diagnostics.ts code. Write a precise specSummary with file:line citations + version notes.
2. Generate the adversarial configs (clean control, broken control, false-positive probe, false-negative
   probe, plus any version-specific variants) into .audit/cases/${fam.key}/ . Use minimal, binary-valid JSON.
   If a rule changes by version, add a <name>.meta.json sidecar to scope targets, e.g. {"targets":["1.14-testing"]}.
3. Run: CROSSCHECK_DIR=.audit/cases/${fam.key} npx vitest run tests/chain-crosscheck.test.ts
4. Read .audit/cases/${fam.key}/_report.json and, for any case where a target shows a divergence label, ALSO
   re-run the binary directly to capture the exact reason string.
5. Return findings. Each finding = one real or suspected divergence (or a confirmed "ok" where our verdict
   already matches the binary on a tricky chain, so the verifier can spot-check). Set reproFile to the case
   path. Only claim a divergence you actually observed in the report. Honor the documented-default rule
   (don't propose a warning for an empty field with a documented fallback).`,
      { label: `probe:${fam.key}`, phase: 'Probe', schema: FINDINGS_SCHEMA, agentType: 'general-purpose' },
    ),
  // Stage 2 — verify: an independent skeptic tries to refute each claimed divergence.
  (probe, fam) => {
    if (!probe || !Array.isArray(probe.findings)) return { family: fam.key, specSummary: probe?.specSummary || '', verified: [] }
    const toCheck = probe.findings.filter((f) => f.severity && f.severity !== 'ok')
    return parallel(
      toCheck.map((f) => () =>
        agent(
          `${PREAMBLE}

You are an INDEPENDENT SKEPTIC verifying ONE claimed divergence from the "${fam.title}" audit. Your default
posture is to REFUTE: assume the claim is wrong until the binary + docs + code force you to agree.

CLAIMED FINDING (JSON):
${JSON.stringify(f, null, 2)}

Do this, independently:
1. Read the repro config at ${f.reproFile} (and its .meta.json if present). Re-run it directly through EACH
   relevant binary: .tools/bin/sing-box-1.12 / sing-box-stable / sing-box-testing  check -c ${f.reproFile}
   Record the exact status + reason per target.
2. Independently read the cited doc lines (${f.docCitation}) — verify they actually say what the finding claims,
   and that no OTHER doc clause (a documented default/fallback, a version gate, the single-DNS-server
   optionality) overturns it. AUTHORITY = docs/upstream only.
3. Independently read the diagnostics.ts rule (${f.ruleId}) to confirm what we actually emit for this config.
4. Decide: is this a REAL divergence between our diagnostics and the binary, at the claimed severity? A config
   that is unfair (broken for an unrelated reason, not binary-valid except for the thing under test) REFUTES
   the finding. Set refuted=true if it does not hold up; otherwise refuted=false and give correctedSeverity
   (or "unchanged"). Always fill binaryReplay with the per-target verdicts you observed.`,
          { label: `verify:${f.id}`, phase: 'Verify', schema: VERDICT_SCHEMA, agentType: 'general-purpose' },
        ).then((v) => ({ finding: f, verdict: v })),
      ),
    ).then((verified) => ({ family: fam.key, specSummary: probe.specSummary, verified: verified.filter(Boolean) }))
  },
)

// ── Synthesize ─────────────────────────────────────────────────────────────────────────────────
phase('Synthesize')
const confirmed = []
const refuted = []
for (const fam of perFamily.filter(Boolean)) {
  for (const v of fam.verified) {
    if (v.verdict && v.verdict.refuted === false) confirmed.push({ family: fam.family, ...v })
    else refuted.push({ family: fam.family, ...v })
  }
}
log(`Probe complete: ${confirmed.length} confirmed divergences, ${refuted.length} refuted/uncertain across ${perFamily.length} families.`)

const synthesis = await agent(
  `${PREAMBLE}

You are writing the FINAL audit report for the long-chain diagnostics audit. Below are the per-family spec
summaries and the VERIFIED findings (each already re-checked by an independent skeptic against the binary).

CONFIRMED (skeptic did NOT refute):
${JSON.stringify(confirmed, null, 2)}

REFUTED / UNCERTAIN (for transparency; do not list as bugs but note any that need a human look):
${JSON.stringify(refuted.map((r) => ({ family: r.family, id: r.finding?.id, title: r.finding?.title, reason: r.verdict?.reason })), null, 2)}

PER-FAMILY SPEC SUMMARIES:
${JSON.stringify(perFamily.filter(Boolean).map((f) => ({ family: f.family, spec: f.specSummary })), null, 2)}

Write a Simplified-Chinese markdown report to .audit/findings.md with:
1. 概述 — the audit method (doc-as-authority + three-binary cross-check) and headline counts.
2. 确认的发现 — grouped by severity (假阳性 / 假阴性 / 缺失检查 / 版本门 / 规格不符). For EACH: the rule id,
   the chain, the doc citation (file:line), the per-version binary-vs-our verdict table, the repro file path,
   and the minimal proposed fix in diagnostics.ts. Order by impact (a false positive on a valid config, like
   the #303 shape, is highest; a silent false negative on a hard-reject is next).
3. 建议的原子修复清单 — a numbered atomic list (A-style) suitable for landing one-per-PR with the review gate,
   each scoped to a single rule, with its repro file as the regression seed. Flag explicitly which atomics
   REVISE the recent #302/#303 fixes (e.g. the dns-server resolver false-negative) vs. add new checks.
4. 存疑/需人工确认 — anything the skeptics could not settle.
Be precise and cite docs. Do not invent findings beyond the confirmed list. After writing the file, return
the full markdown content as your final message.`,
  { label: 'synthesize', phase: 'Synthesize', agentType: 'general-purpose' },
)

return { confirmed: confirmed.length, refuted: refuted.length, families: perFamily.length, report: synthesis }
