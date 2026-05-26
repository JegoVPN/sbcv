import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateSingBoxCheck, sanitizeSingBoxMessage } from "./singbox-check-policy.mjs";
import { binaryForDetectedVersion } from "./singbox-target-policy.mjs";

const manifestPath = "fixtures/external/manifest.json";
const reportPath = "fixtures/external/compatibility-report.md";
const requiredUiGates = ["json-parse", "import", "derive-graph", "diagnostics", "render", "json-round-trip", "export"];

function resolveCommand(command) {
  const localCommand = join(".tools", "bin", command);
  if (existsSync(localCommand)) return localCommand;
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.trim() || command;
}

function runSingBoxCheck(binary, fixturePath) {
  const tempDir = mkdtempSync(join(tmpdir(), "sbc-external-official-"));
  const tempFile = join(tempDir, "config.json");
  try {
    writeFileSync(tempFile, readFileSync(fixturePath));
    const result = spawnSync(binary, ["check", "-c", tempFile], { encoding: "utf8" });
    return evaluateSingBoxCheck({ status: result.status, stdout: result.stdout, stderr: result.stderr });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function withOfficialGate(gates, shouldInclude) {
  const filtered = gates.filter((gate) => gate !== "official-check");
  return shouldInclude ? [...filtered, "official-check"] : filtered;
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const stats = {
  pass: 0,
  failed: 0,
  warning: 0,
  notApplicable: 0,
  missingBinary: 0,
};
const failuresByVersion = {};

for (const item of manifest) {
  const command = binaryForDetectedVersion(item.detected_version);
  item.expected_gates = withOfficialGate(
    [...new Set([...(item.expected_gates ?? []), ...requiredUiGates])],
    false,
  );

  if (!command) {
    item.official_check = null;
    item.official_check_result = {
      status: "not-applicable",
      reason: "No declared or inferred sing-box version for this display fixture.",
    };
    stats.notApplicable += 1;
    continue;
  }

  const binary = resolveCommand(command);
  if (!binary) {
    item.official_check = null;
    item.official_check_result = {
      status: "missing-binary",
      binary: command,
      reason: "Matching sing-box binary is not installed.",
    };
    stats.missingBinary += 1;
    continue;
  }

  const result = runSingBoxCheck(binary, item.fixture_path);
  if (result.ok) {
    item.official_check = command;
    item.expected_gates = withOfficialGate(item.expected_gates, true);
    item.official_check_result = {
      status: "pass",
      binary: command,
    };
    stats.pass += 1;
  } else {
    item.official_check = null;
    item.official_check_result = {
      status: result.status,
      binary: command,
      reason: sanitizeSingBoxMessage(result.reason),
    };
    if (result.status === "warning") {
      stats.warning += 1;
    } else {
      stats.failed += 1;
    }
    failuresByVersion[item.detected_version] = (failuresByVersion[item.detected_version] ?? 0) + 1;
  }
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const byClass = manifest.reduce((counts, item) => {
  counts[item.fixture_class] = (counts[item.fixture_class] ?? 0) + 1;
  return counts;
}, {});
const byVersion = manifest.reduce((counts, item) => {
  counts[item.detected_version] = (counts[item.detected_version] ?? 0) + 1;
  return counts;
}, {});

const report = [
  "# External Fixture Compatibility Report",
  "",
  `Accepted fixtures: ${manifest.length}`,
  `Official binary pass: ${stats.pass}`,
  `Official binary warning and treated as display/template-compatible: ${stats.warning}`,
  `Official binary failed and treated as display/template-compatible: ${stats.failed}`,
  `Official binary not applicable: ${stats.notApplicable}`,
  `Official binary missing during report generation: ${stats.missingBinary}`,
  "",
  "## Accepted By Class",
  "",
  ...Object.entries(byClass)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `- ${key}: ${count}`),
  "",
  "## Accepted By Detected Version",
  "",
  ...Object.entries(byVersion)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `- ${key}: ${count}`),
  "",
  "## Official Check Failures By Version",
  "",
  ...Object.entries(failuresByVersion)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `- ${key}: ${count}`),
  Object.keys(failuresByVersion).length === 0 ? "- none" : "",
  "",
  "## Notes",
  "",
  "- Fixtures are deterministic snapshots from public GitHub repositories.",
  "- Secrets and credentials are redacted during ingestion.",
  "- Empty selector/urltest provider pools and `{all}` subscription placeholders are expanded into mock SOCKS outbounds.",
  "- `official_check` is set only when the matching sing-box binary accepts the checked-in fixture with `sing-box check` and emits no warning/deprecation output.",
  "- Versioned fixtures that fail or warn in official checks remain accepted only for UI/import/display gates and carry `official_check_result.status = failed` or `warning` with the reason in `manifest.json`.",
  "- Rejected candidates do not count toward the 200 accepted fixture goal.",
  "",
].filter((line, index, lines) => !(line === "" && lines[index - 1] === ""));

writeFileSync(reportPath, `${report.join("\n").trimEnd()}\n`);

console.log(
  `External official gates updated. Pass: ${stats.pass}. Warning/display: ${stats.warning}. Failed/display: ${stats.failed}. Not applicable: ${stats.notApplicable}. Missing binaries: ${stats.missingBinary}.`,
);
