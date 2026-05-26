import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();
const testingDocsDir = join(repoRoot, ".tmp/sing-box-docs/testing/docs/configuration");
const matrixPath = join(repoRoot, "docs/sing-box-doc-readthrough-matrix.md");
const palettePath = join(repoRoot, "src/components/Palette.tsx");

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function walkMarkdown(dir) {
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkMarkdown(absolute));
      continue;
    }
    if (!entry.name.endsWith(".md") || entry.name.endsWith(".zh.md")) continue;
    result.push(relative(testingDocsDir, absolute).replaceAll("\\", "/"));
  }
  return result.sort((a, b) => a.localeCompare(b));
}

function parseMatrix(markdown) {
  const rows = new Map();
  const start = markdown.indexOf("## Full English Doc Matrix");
  const end = markdown.indexOf("## Addability And UI Semantics");
  const section = start >= 0 && end > start ? markdown.slice(start, end) : markdown;
  const rowRegex = /^\| `([^`]+)` \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm;
  let match;
  while ((match = rowRegex.exec(section))) {
    rows.set(match[1], {
      channel: match[2].trim(),
      className: match[3].trim(),
      implementation: match[4].trim(),
    });
  }
  return rows;
}

function normalizeDocsPath(urlPath, officialSet) {
  const clean = urlPath.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!clean) return "index.md";
  const parts = clean.split("/");
  const last = parts.at(-1);
  if (last === "configuration") return "index.md";
  const indexDoc = `${clean}/index.md`;
  if (officialSet.has(indexDoc)) return indexDoc;
  return `${clean}.md`;
}

function explicitStatus(rest) {
  const status = rest.match(/status:\s*"([^"]+)"/)?.[1];
  if (status) return status;
  if (/ready:\s*true/.test(rest)) return "add";
  return "docs";
}

function parsePalette(tsx, officialSet) {
  const entries = [];
  const itemRegex =
    /\{\s*label:\s*"([^"]+)",\s*kind:\s*"([^"]+)",\s*icon:\s*[A-Za-z0-9_]+,\s*docsUrl:\s*docs\((?:"([^"]*)")?\)([^}]*)\}/g;
  let match;
  while ((match = itemRegex.exec(tsx))) {
    entries.push({
      label: match[1],
      kind: match[2],
      doc: normalizeDocsPath(match[3] ?? "", officialSet),
      status: explicitStatus(match[4] ?? ""),
    });
  }
  return entries;
}

if (!existsSync(testingDocsDir)) {
  fail(
    [
      "Missing local sing-box testing docs checkout.",
      "Expected: .tmp/sing-box-docs/testing/docs/configuration",
      "Create it with the clone command documented in docs/sing-box-doc-readthrough-matrix.md.",
    ].join("\n"),
  );
  process.exit();
}

const officialDocs = walkMarkdown(testingDocsDir);
const officialSet = new Set(officialDocs);
const matrixRows = parseMatrix(readFileSync(matrixPath, "utf8"));
const paletteEntries = parsePalette(readFileSync(palettePath, "utf8"), officialSet);
const paletteByDoc = new Map();

for (const entry of paletteEntries) {
  if (!paletteByDoc.has(entry.doc)) paletteByDoc.set(entry.doc, []);
  paletteByDoc.get(entry.doc).push(entry);
}

const missingInMatrix = officialDocs.filter((doc) => !matrixRows.has(doc));
const staleInMatrix = [...matrixRows.keys()].filter((doc) => !officialDocs.includes(doc));
const missingUserSurface = officialDocs.filter((doc) => !paletteByDoc.has(doc));

const statusCounts = new Map();
for (const entry of paletteEntries) {
  statusCounts.set(entry.status, (statusCounts.get(entry.status) ?? 0) + 1);
}

console.log("# sing-box config coverage audit");
console.log(`official_testing_docs=${officialDocs.length}`);
console.log(`matrix_rows=${matrixRows.size}`);
console.log(`palette_entries=${paletteEntries.length}`);
console.log(
  `palette_statuses=${[...statusCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `${status}:${count}`)
    .join(",")}`,
);

if (missingInMatrix.length) {
  fail(`\nMissing in docs/sing-box-doc-readthrough-matrix.md:\n${missingInMatrix.join("\n")}`);
}

if (staleInMatrix.length) {
  fail(`\nStale matrix rows not present in current testing docs:\n${staleInMatrix.join("\n")}`);
}

if (missingUserSurface.length) {
  console.log(`\nDocs without a Palette surface yet (${missingUserSurface.length}):`);
  for (const doc of missingUserSurface) console.log(`- ${doc}`);
}

const docsOnlyProtocolEntries = paletteEntries.filter((entry) => {
  const row = matrixRows.get(entry.doc);
  return row?.className === "chain-node" && entry.status === "docs";
});

if (docsOnlyProtocolEntries.length) {
  console.log(`\nChain nodes still documentation-only (${docsOnlyProtocolEntries.length}):`);
  for (const entry of docsOnlyProtocolEntries) console.log(`- ${entry.doc}: ${entry.label} (${entry.kind})`);
}

if (!missingInMatrix.length && !staleInMatrix.length) {
  console.log("\nMatrix is in sync with current official testing docs.");
}
