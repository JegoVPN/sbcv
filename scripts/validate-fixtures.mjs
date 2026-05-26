import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertCleanSingBoxCheck } from "./singbox-check-policy.mjs";
import { binaryForFixturePath } from "./singbox-target-policy.mjs";

const fixtureGroups = [
  { channel: "stable", dir: "fixtures/stable" },
  { channel: "testing", dir: "fixtures/testing" },
];

function resolveCommand(command) {
  const localCommand = join(".tools", "bin", command);
  if (existsSync(localCommand)) return localCommand;
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.trim() || command;
}

function validateJson(file) {
  JSON.parse(readFileSync(file, "utf8"));
}

function runSingBoxCheck(binary, file) {
  const result = spawnSync(binary, ["check", "-c", file], { encoding: "utf8" });
  assertCleanSingBoxCheck({ binary, file, status: result.status, stdout: result.stdout, stderr: result.stderr });
}

let officialChecks = 0;
const skipped = [];

for (const group of fixtureGroups) {
  if (!existsSync(group.dir)) continue;
  const files = readdirSync(group.dir).filter((file) => file.endsWith(".json"));
  for (const file of files) {
    const fixturePath = join(group.dir, file);
    validateJson(fixturePath);
    const expectedBinary = binaryForFixturePath(fixturePath, group.channel);
    const binary = resolveCommand(expectedBinary);
    if (binary) {
      const tempDir = mkdtempSync(join(tmpdir(), "sbc-fixture-"));
      const tempFile = join(tempDir, "config.json");
      try {
        writeFileSync(tempFile, readFileSync(fixturePath));
        runSingBoxCheck(binary, tempFile);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
      officialChecks += 1;
    } else {
      skipped.push(`${expectedBinary} missing for ${fixturePath}`);
    }
  }
}

if (officialChecks === 0) {
  console.warn("No official sing-box binaries found; fixture validation was limited to JSON parsing.");
}

for (const item of skipped) {
  console.warn(`Skipped official check: ${item}`);
}

console.log(`Fixture validation complete. Official checks: ${officialChecks}. Skipped: ${skipped.length}.`);
