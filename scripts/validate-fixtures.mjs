import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureGroups = [
  { channel: "stable", binary: "sing-box-stable", dir: "fixtures/stable" },
  { channel: "testing", binary: "sing-box-testing", dir: "fixtures/testing" },
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
  if (result.status !== 0) {
    throw new Error(`${binary} check failed for ${file}\n${result.stdout}\n${result.stderr}`);
  }
}

let officialChecks = 0;
const skipped = [];

for (const group of fixtureGroups) {
  if (!existsSync(group.dir)) continue;
  const files = readdirSync(group.dir).filter((file) => file.endsWith(".json"));
  for (const file of files) {
    const fixturePath = join(group.dir, file);
    validateJson(fixturePath);
    const binary = resolveCommand(group.binary);
    if (binary) {
      const tempDir = mkdtempSync(join(tmpdir(), "sbc-fixture-"));
      const tempFile = join(tempDir, "config.json");
      writeFileSync(tempFile, readFileSync(fixturePath));
      runSingBoxCheck(binary, tempFile);
      rmSync(tempDir, { recursive: true, force: true });
      officialChecks += 1;
    } else {
      skipped.push(`${group.binary} missing for ${fixturePath}`);
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
