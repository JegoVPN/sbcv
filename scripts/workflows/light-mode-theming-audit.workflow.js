export const meta = {
  name: 'light-mode-theming-audit',
  description: 'Pre-goal audit for adding a light theme: exhaustive color-literal inventory (CSS segments + non-CSS surfaces), theme-switching infrastructure facts, adversarial coverage check, token-merge risk review, light-palette risk assessment',
  phases: [
    { title: 'Inventory', detail: 'parallel agents inventory every color literal and the switching/test infrastructure facts' },
    { title: 'Adversarial', detail: 'coverage hunter re-greps for missed literals; token-merge and light-palette risks reviewed against the inventory' },
  ],
}

const REPO = '<repo root>' // agents run with cwd at the repo; never embed machine-specific absolute paths

const CONTEXT = [
  'PROJECT: sbc-ui (sbcv) — a single-page React canvas GUI (Vite, React 18, zustand, @xyflow/react React Flow, @uiw/react-codemirror, lucide-react) that emits sing-box JSON. Styling is ONE hand-written global stylesheet: src/styles.css (3313 lines). No Tailwind, no CSS-in-JS, no component library. The app is currently DARK-ONLY: `color-scheme: dark` at src/styles.css:2, and there is no theme infrastructure (no data-theme, no prefers-color-scheme usage, no localStorage at all).',
  '',
  'GOAL THIS AUDIT FEEDS: a "light mode" execution plan. Route already decided: FULL semantic tokenization of styles.css (every color literal becomes a semantic CSS custom property; :root holds the current dark values verbatim so the dark rendering stays pixel-identical; [data-theme="light"] overrides the variable table), then a three-state theme mechanism (system-follow + manual override persisted to localStorage), then a toggle UI.',
  '',
  'SEED FACTS (already verified — recheck only if your slice contradicts them):',
  '- src/styles.css has ~343 hex literals + ~57 rgb()/rgba() literals.',
  '- Only 4 CSS custom properties exist today, all typography (src/styles.css:1221-1224).',
  '- src/styles.css:2719 references var(--color-text-muted, #b5bdc8) — the variable is NEVER DEFINED; the fallback is doing the work.',
  '- Known TS/TSX hardcoded colors: src/components/CanvasWorkspace.tsx:50 (#e4e9ee connection-line stroke), CanvasWorkspace.tsx:591 (<Background color="#1f2730" .../>), src/components/SbcvLogo.tsx:22 (#0d1116 fill).',
  '- src/components/ConfigJsonViewerDialog.tsx:72 hardcodes CodeMirror theme="dark".',
  '- Top hex frequencies: #c7ff00 ×39 (brand lime accent), #eef2f4 ×17, #101418 ×14, #f2bc4b ×11 (amber/warn), #e34b4b ×9 (danger red), #8a96a3 ×9 (muted text), #2d99ff ×4 (info blue), plus near-duplicate darks (#090b0f / #0a0d12 / #0b0f14, #1C1E20 vs #1c1e20).',
  '',
  'READ-ONLY DISCIPLINE: you are an auditor. Use Read/Grep/Bash(grep/awk/sed -n) on real files only. NEVER run any git command that mutates state (no checkout/stash/reset/commit); plain `git log`/`git show` read-only is fine. Never guess — every claim needs file:line evidence.',
].join('\n')

const ROLE_VOCAB = [
  'SEMANTIC ROLE VOCABULARY — name groups with these prefixes so four agents converge on one taxonomy (invent a suffix when needed, e.g. "surface-canvas-dot"):',
  '  surface-*   backgrounds: surface-app, surface-raised (cards/panels), surface-overlay (popover/dialog/sheet), surface-input, surface-hover, surface-active, surface-canvas, surface-minimap',
  '  text-*      text-primary, text-secondary, text-muted, text-disabled, text-inverse, text-on-accent',
  '  border-*    border-default, border-subtle, border-strong, border-focus',
  '  accent-brand-*   the #c7ff00 lime family (status pills, active edges, focus, logo)',
  '  accent-info-*    the #2d99ff / #6fb8ff blue family (selection, links, highlight)',
  '  accent-danger-*  the #e34b4b / #ff5470 red family (errors, delete, dangling edges)',
  '  accent-warn-*    the #f2bc4b amber family (warnings, deprecated)',
  '  accent-gated-*   the violet family (version-gated badges, see comment at styles.css:1270)',
  '  accent-platform-* the slate-blue family (platform-locked, styles.css:1264)',
  '  edge-* / node-* / port-*  canvas-graph specifics that do not reduce to the generic roles',
  '  shadow-* / scrim-*  box-shadows, overlay scrims (rgba blacks)',
  '  misc-*      anything that resists classification — explain in roleNote',
].join('\n')

const CSS_METHOD = [
  'METHOD:',
  '1. Read your assigned line range of src/styles.css in full (use Read with offset/limit; chunk if needed). Line numbers in your output MUST be real file line numbers.',
  '2. Inventory EVERY color literal in the range: hex (#fff, #ffffff, 8-digit), rgb()/rgba(), hsl(), and CSS named colors used as colors (white, black, red, transparent ONLY when it participates in a visual the light theme must reconsider, e.g. gradient stops or border colors meant to vanish). Also note color-relevant `opacity` tricks and `box-shadow`/`text-shadow`/`outline`/`background` shorthand colors — shorthands hide literals.',
  '3. Group them by SEMANTIC ROLE (vocabulary below). The role is what the color MEANS in context (read the surrounding selectors and the rich design-intent comments — e.g. tags like D2, N1, V8-S2, R2 — they encode meaning).',
  '4. For each color value inside a group: report total count in your range and up to 5 representative usages (line, selector, property, optional note).',
  '5. specialCases — flag every instance of: (a) SAME hex carrying DIFFERENT meanings in different contexts (would need to SPLIT into two tokens because light values may diverge); (b) near-duplicate hexes that should MERGE into one token; (c) colors woven into rgba() with alpha where the light theme needs a different base; (d) literals inside shorthands easy to miss; (e) anything theme-hostile (e.g. a color meant to match a sibling literal elsewhere).',
  '6. selfCheck — run a mechanical recount over your range, e.g.: sed -n "<start>,<end>p" src/styles.css | grep -oE "#[0-9a-fA-F]{3,8}\\b" | wc -l (and same for rgba?). State the counts and confirm your groups account for them (or name what you intentionally excluded and why).',
].join('\n')

const CSS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['segment', 'groups', 'specialCases', 'selfCheck'],
  properties: {
    segment: { type: 'string' },
    groups: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['role', 'colors'],
      properties: {
        role: { type: 'string' },
        roleNote: { type: 'string' },
        colors: { type: 'array', items: {
          type: 'object', additionalProperties: false, required: ['value', 'count', 'examples'],
          properties: {
            value: { type: 'string' },
            count: { type: 'number' },
            examples: { type: 'array', maxItems: 5, items: {
              type: 'object', additionalProperties: false, required: ['line', 'selector', 'property'],
              properties: { line: { type: 'number' }, selector: { type: 'string' }, property: { type: 'string' }, note: { type: 'string' } },
            } },
          },
        } },
      },
    } },
    specialCases: { type: 'array', items: { type: 'string' } },
    selfCheck: { type: 'string' },
  },
}

const FACTS_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['facts'],
  properties: { facts: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['topic', 'finding', 'evidence'],
    properties: { topic: { type: 'string' }, finding: { type: 'string' }, evidence: { type: 'string' }, implication: { type: 'string' } },
  } } },
}

const ADVERSARY_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['findings'],
  properties: { findings: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['title', 'severity', 'detail', 'evidence'],
    properties: { title: { type: 'string' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] }, detail: { type: 'string' }, evidence: { type: 'string' } },
  } } },
}

const SEGMENTS = [
  { id: 'css-1-global-topbar', range: [1, 815], blurb: 'root/color-scheme, global resets, buttons/inputs/forms, the entire topbar (brand pill, menus, status pills, actions, popovers)' },
  { id: 'css-2-canvas-nodes', range: [805, 1890], blurb: 'workspace shell, palette, minimap, canvas, node cards (sbc-node), ports, badges (deprecated/gated/platform), edges incl. selection/dangling/animated states, node delete affordance' },
  { id: 'css-3-inspector-dialogs', range: [1880, 2735], blurb: 'inspector panels/forms, shared field widgets, fieldsets/repeaters, JSON viewer dialog, lazy-layer skeleton, rule tables/summaries, stale toggles' },
  { id: 'css-4-mobile-toast', range: [2725, 3313], blurb: 'inspector compact mode, mobile app shell/topbar/sheets, bottom sheet, toasts/notifications' },
]

phase('Inventory')

const inventoryThunks = SEGMENTS.map((seg) => () =>
  agent([
    CONTEXT, '', ROLE_VOCAB, '', CSS_METHOD, '',
    `YOUR SLICE: src/styles.css lines ${seg.range[0]}-${seg.range[1]} (${seg.blurb}). Ranges overlap ~10 lines with neighbors on purpose; include boundary literals anyway (dedup happens later).`,
    'Return ONLY the structured object. segment = "' + seg.id + '".',
  ].join('\n'), { label: seg.id, phase: 'Inventory', schema: CSS_SCHEMA }))

inventoryThunks.push(() =>
  agent([
    CONTEXT, '', ROLE_VOCAB, '',
    'YOUR SLICE: every COLOR SOURCE OUTSIDE src/styles.css. Audit exhaustively, with file:line evidence:',
    '1. All color literals in src/**/*.{ts,tsx} (hex, rgb/rgba, named, inline style objects). Verify the three seed facts and hunt for more (grep patterns: #[0-9a-fA-F], rgba?, "color:", style={{...}}).',
    '2. index.html — meta theme-color (present? absent?), inline styles, body/background, favicon refs. public/** — every SVG/ico/manifest/og asset whose colors a light theme must reconsider (read the SVGs).',
    '3. @xyflow/react dist CSS (node_modules/@xyflow/react/dist/style.css): which of its DEFAULT colors actually reach our rendered UI vs are fully overridden by src/styles.css (attribution badge, controls, minimap mask, edge defaults, handle defaults, selection rect). List each xyflow default color that would LEAK into a light theme unstyled. Also check which React Flow components the app actually renders (grep CanvasWorkspace.tsx for MiniMap/Controls/Background/Panel/attribution props).',
    '4. CodeMirror: how @uiw/react-codemirror theme="dark" works (read node_modules/@uiw/react-codemirror/cjs or src — does "dark"/"light" map to built-in themes?), what syntax-highlight palette the JSON gets in each, and what the integration cost of switching theme dynamically is (prop change only?). Evidence from node_modules source, not memory.',
    '5. lucide-react icons: confirm stroke=currentColor (i.e. free under tokenization) or list exceptions.',
    '6. worker/** and wrangler.toml: does the Worker generate/transform HTML where a theme bootstrap script or meta tag would need to live, or is it pure static asset serving + API?',
    '7. Scan src/styles.css ONLY for url(...) / image references / gradients that bake in colors (others own the literals; you own embedded assets).',
    'Return facts[]; one fact per discrete finding; implication = what the light-mode plan must do about it.',
  ].join('\n'), { label: 'noncss-surfaces', phase: 'Inventory', schema: FACTS_SCHEMA }))

inventoryThunks.push(() =>
  agent([
    CONTEXT, '',
    'YOUR SLICE: theme-SWITCHING infrastructure + test-impact facts. Audit exhaustively, file:line evidence for every claim:',
    '1. Boot path: index.html script tags, src/main.tsx, src/App.tsx — where would a pre-React inline theme bootstrap (anti-FOUC) have to go; what renders first; is there any SSR/prerender (vite config, worker/)?',
    '2. State layer: src/state/useProjectStore.ts — is zustand persist middleware used anywhere? Confirm localStorage is currently UNUSED app-wide. Where do existing UI-prefs-like states live (e.g. collapsed panels) and how are they wired to components? Recommend (with evidence of existing patterns) whether theme belongs in the existing store or a tiny new store.',
    '3. Playwright: read playwright.config.ts + e2e/** — (a) what colorScheme do tests run under (Playwright DEFAULT emulates prefers-color-scheme:light unless set!) — this matters because a system-follow theme would flip ALL existing e2e to light; (b) list EVERY style/color assertion in e2e specs (toHaveCSS, getComputedStyle, opacity/color/background literals, screenshots) with file:line; (c) how many would break under (i) pure tokenization (values unchanged) and (ii) light-default rendering.',
    '4. Unit tests: tests/** — any that read styles.css, assert on classes/colors, or would interact with a guard test like "no raw color literals outside the token block" (look at tests/no-local-absolute-paths.test.ts as the house pattern for repo-wide guard tests; cite its mechanism).',
    '5. Accessibility/system signals: current usage of prefers-reduced-motion / prefers-contrast / forced-colors in styles.css (any @media?), and `color-scheme` implications for native widgets (scrollbars, form controls, <select>, autofill) — which native surfaces does the app actually show that color-scheme will flip?',
    '6. AGENTS.md + docs/goal-driven-development.md: extract the constraints that bind this goal (Frontend Skill Gate scope, PR/test gates, guard-test conventions).',
    '7. CSS architecture wrinkles relevant to a variable indirection: any @media print? Any place styles.css relies on specificity hacks that a :root-level variable change cannot reach (e.g. inline styles in TSX overriding CSS)? Any transition/animation on color properties that would animate badly on theme flip?',
    'Return facts[].',
  ].join('\n'), { label: 'infra-and-tests', phase: 'Inventory', schema: FACTS_SCHEMA }))

const inventory = await parallel(inventoryThunks)
const cssResults = inventory.slice(0, 4).filter(Boolean)
const noncss = inventory[4]
const infra = inventory[5]

const allValues = [...new Set(cssResults.flatMap(r => r.groups.flatMap(g => g.colors.map(c => c.value.toLowerCase()))))].sort()
const paletteSummary = cssResults.map(r =>
  `## ${r.segment}\n` + r.groups.map(g => `- ${g.role}${g.roleNote ? ' (' + g.roleNote + ')' : ''}: ${g.colors.map(c => `${c.value}×${c.count}`).join(', ')}`).join('\n'),
).join('\n')
const allSpecialCases = cssResults.flatMap(r => r.specialCases.map(s => `[${r.segment}] ${s}`)).join('\n')

log(`Inventory done: ${allValues.length} distinct color values across ${cssResults.length} CSS segments`)

phase('Adversarial')

const adversarial = await parallel([
  () => agent([
    CONTEXT, '',
    'ROLE: coverage adversary. Four agents inventoried src/styles.css and claim the DISTINCT color-value set below is complete. PROVE THEM WRONG.',
    'Claimed set (lowercased): ' + allValues.join(' '),
    'Hunt mechanically with grep over src/styles.css AND src/**/*.{ts,tsx} AND index.html for anything absent from the set:',
    '- hex of every length (#abc, #abcd, #aabbcc, #aabbccdd — case-insensitive), rgb/rgba/hsl/hsla/color(), color-mix(), light-dark()',
    '- named colors in value position (white, black, red, grey/gray families, transparent, currentcolor) — check border/background/box-shadow/outline/text-shadow/fill/stroke/caret-color/accent-color/scrollbar-color/text-decoration-color/column-rule shorthands specifically',
    '- ::selection, ::placeholder, :autofill, ::-webkit-scrollbar*, ::backdrop rules; @media blocks (print? forced-colors?); CSS inside template literals in TS/TSX; SVG fill/stroke attributes in TSX',
    '- opacity-only "colors" that encode dark-theme assumptions (e.g. white text at low opacity)',
    'For each MISS: report value + file:line + why it matters for theming. Also sanity-check the claimed set for phantom entries (values not actually in the file). severity: high = a user-visible surface would stay dark/wrong in light mode; low = cosmetic.',
  ].join('\n'), { label: 'coverage-adversary', phase: 'Adversarial', schema: ADVERSARY_SCHEMA }),

  () => agent([
    CONTEXT, '', ROLE_VOCAB, '',
    'ROLE: token-merge adversary. Below is the proposed role->colors grouping from four segment auditors, plus their special-case flags. Your job: find every place where the MERGE/SPLIT decision is WRONG for a future light theme. Verify suspicions against the real src/styles.css (Read the cited lines).',
    'Specifically hunt:',
    '1. SAME VALUE, DIVERGENT MEANING across segments (e.g. a hex used as both card background and input background; or border vs divider) — light values may need to differ; recommend SPLIT with concrete token names.',
    '2. NEAR-DUPLICATES that should merge (within a few RGB points, or case variants like #1C1E20/#1c1e20) — recommend MERGE and which canonical value.',
    '3. Role-name inconsistencies between segments (same meaning, different role label) — propose the unified label.',
    '4. ALPHA-WEAVE traps: rgba(x,y,z,a) whose RGB base duplicates an opaque token — in light mode they must stay coupled; recommend representing as color-mix or a paired token.',
    '5. Estimate the final token-table size (count of semantic tokens) and call out any group so overloaded it will become a god-token.',
    'GROUPING:\n' + paletteSummary, '',
    'SPECIAL CASES ALREADY FLAGGED:\n' + allSpecialCases,
  ].join('\n'), { label: 'token-merge-adversary', phase: 'Adversarial', schema: ADVERSARY_SCHEMA }),

  () => agent([
    CONTEXT, '',
    'ROLE: light-palette risk assessor. Given the dark-theme semantic palette summary below, enumerate the DESIGN risks a light variable table must solve. You are not designing final values; you are writing the constraint list + danger zones for the implementer, each with evidence from the real UI CSS (Read cited lines to understand the context).',
    'Mandatory coverage:',
    '1. Brand lime #c7ff00 (×39): compute its WCAG contrast on white/near-white and on the dark surfaces; classify each usage family (text-on-dark-pill? edge stroke? focus ring? logo?) by whether a DARKENED lime variant works or the role must remap to a different hue in light; flag any place lime is TEXT on light.',
    '2. Status hues (danger #e34b4b, warn #f2bc4b, info #2d99ff, gated violet, platform slate): which fail 4.5:1 (text) or 3:1 (UI) on near-white and need darkened light variants.',
    '3. Shadows/scrims: rgba black shadows tuned for dark surfaces — what strategy for light (lighter alpha? hue-tinted?); list the heaviest shadows by line.',
    '4. Canvas: dot-grid #1f2730 on dark — what the light canvas needs (grid contrast, node card vs canvas separation, minimap mask).',
    '5. Edge/status states (active lime edge, selection blue, dangling red dashed, marching-ants animation): visibility on light background.',
    '6. CodeMirror JSON syntax palette in light vs our chrome.',
    '7. color-scheme flip side-effects (native scrollbar/controls) anywhere we rely on dark scrollbars visually.',
    '8. Photometric inversion traps: places where dark theme uses BRIGHTER=raised (e.g. hover lightens); light needs DARKER=pressed or borders — list hover/active families whose polarity must flip.',
    'severity: high = will look broken/unreadable if naively inverted; medium = needs deliberate choice; low = nice-to-know.',
    'PALETTE:\n' + paletteSummary,
  ].join('\n'), { label: 'light-risk-assessor', phase: 'Adversarial', schema: ADVERSARY_SCHEMA }),
])

return {
  cssInventory: cssResults,
  noncssFacts: noncss,
  infraFacts: infra,
  distinctValues: allValues,
  coverageFindings: adversarial[0],
  tokenMergeFindings: adversarial[1],
  lightRiskFindings: adversarial[2],
}