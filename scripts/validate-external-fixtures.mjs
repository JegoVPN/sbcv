import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const requiredUiGates = ["json-parse", "import", "derive-graph", "diagnostics", "json-round-trip", "export"];
const manifest = JSON.parse(readFileSync("fixtures/external/manifest.json", "utf8"));
const rejected = JSON.parse(readFileSync("fixtures/external/rejected.json", "utf8"));

function fail(message) {
  throw new Error(message);
}

function resolveCommand(command) {
  const localCommand = join(".tools", "bin", command);
  if (existsSync(localCommand)) return localCommand;
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.trim() || command;
}

function runSingBoxCheck(binary, fixturePath) {
  const tempDir = mkdtempSync(join(tmpdir(), "sbc-external-validate-"));
  const tempFile = join(tempDir, "config.json");
  writeFileSync(tempFile, readFileSync(fixturePath));
  const result = spawnSync(binary, ["check", "-c", tempFile], { encoding: "utf8" });
  rmSync(tempDir, { recursive: true, force: true });
  if (result.status !== 0) {
    fail(`${binary} check failed for ${fixturePath}\n${result.stdout}\n${result.stderr}`);
  }
}

if (manifest.length < 200) fail(`Expected at least 200 accepted external fixtures, found ${manifest.length}`);
if (!Array.isArray(rejected)) fail("fixtures/external/rejected.json must be an array");

const ids = new Set();
const hashes = new Set();
let officialChecks = 0;
let displayOnlyVersioned = 0;

for (const item of manifest) {
  if (ids.has(item.id)) fail(`Duplicate external fixture id: ${item.id}`);
  ids.add(item.id);

  if (!item.counts_toward_200) fail(`${item.id} is in manifest but does not count toward 200`);
  if (!item.source_repo || !item.source_path || !item.source_commit) {
    fail(`${item.id} is missing source traceability`);
  }
  if (!item.normalized_hash) fail(`${item.id} is missing normalized_hash`);
  if (hashes.has(item.normalized_hash)) fail(`Duplicate normalized hash: ${item.normalized_hash}`);
  hashes.add(item.normalized_hash);

  if (!existsSync(item.fixture_path)) fail(`${item.id} fixture path is missing: ${item.fixture_path}`);
  JSON.parse(readFileSync(item.fixture_path, "utf8"));

  for (const gate of requiredUiGates) {
    if (!item.expected_gates?.includes(gate)) fail(`${item.id} is missing expected gate: ${gate}`);
  }

  if (!item.official_check_result?.status) {
    fail(`${item.id} is missing official_check_result.status`);
  }

  if (item.official_check_result.status === "missing-binary") {
    fail(`${item.id} official check binary is missing: ${item.official_check_result.binary}`);
  }

  if (item.official_check) {
    if (!item.expected_gates.includes("official-check")) {
      fail(`${item.id} has official_check but expected_gates lacks official-check`);
    }
    const binary = resolveCommand(item.official_check);
    if (!binary) fail(`${item.id} official check binary not found: ${item.official_check}`);
    runSingBoxCheck(binary, item.fixture_path);
    officialChecks += 1;
  } else if (item.detected_version !== "unknown") {
    displayOnlyVersioned += 1;
    if (item.official_check_result.status !== "failed") {
      fail(`${item.id} has version ${item.detected_version} without official_check or failed official result`);
    }
  }
}

if (officialChecks === 0) fail("No external fixture official checks ran");

console.log(
  `External fixture validation complete. Accepted: ${manifest.length}. Rejected: ${rejected.length}. Official checks: ${officialChecks}. Versioned display/template fixtures: ${displayOnlyVersioned}.`,
);

