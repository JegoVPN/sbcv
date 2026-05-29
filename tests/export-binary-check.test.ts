import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// The sing-box check/target policies are untyped .mjs scripts shared with the fixture gates; reuse them
// verbatim so the app's pruned export is held to the same pass/no-warning bar as the raw fixtures.
// @ts-expect-error -- .mjs policy script has no type declarations
import { assertCleanSingBoxCheck } from "../scripts/singbox-check-policy.mjs";
// @ts-expect-error -- .mjs policy script has no type declarations
import { binaryForFixturePath } from "../scripts/singbox-target-policy.mjs";
import { createConfigExport, parseConfigJson } from "../src/domain/serialization";

// C15 (P2#12): feed the EXACT bytes the app downloads — createConfigExport(parseConfigJson(fixture)).contents,
// which applies pruneExportNoise — through `sing-box check` on the channel-matched binary for every internal
// fixture. Closes the "app's real output ↔ binary accepts" loop, so a prune step that yields binary-rejected
// output fails the release gate instead of shipping silently. Source: configuration/index.md `### Check`.

const groups = [
  { channel: "stable" as const, dir: "fixtures/stable" },
  { channel: "testing" as const, dir: "fixtures/testing" },
];

function resolveCommand(command: string): string | null {
  const local = join(".tools", "bin", command);
  if (existsSync(local)) return local;
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.trim() || command;
}

describe("export-binary-check — pruned app export is accepted by the matched sing-box binary", () => {
  const failures: string[] = [];
  let officialChecks = 0;
  let prunedDiffersFromRaw = 0;
  let fixtureCount = 0;

  for (const group of groups) {
    if (!existsSync(group.dir)) continue;
    const files = readdirSync(group.dir).filter((file) => file.endsWith(".json"));
    for (const file of files) {
      fixtureCount += 1;
      it(`${group.dir}/${file}`, () => {
        const fixturePath = join(group.dir, file);
        const raw = readFileSync(fixturePath, "utf8");
        // The app's real download path: parse → export (prunes noise) → these bytes.
        const exported = createConfigExport(parseConfigJson(raw));
        if (exported.contents.trim() !== raw.trim()) prunedDiffersFromRaw += 1;

        const expectedBinary = binaryForFixturePath(fixturePath, group.channel);
        const binary = resolveCommand(expectedBinary);
        if (!binary) return; // warn-skip locally; CI installs all three binaries.

        const tempDir = mkdtempSync(join(tmpdir(), "sbc-export-"));
        const tempFile = join(tempDir, "config.json");
        try {
          writeFileSync(tempFile, exported.contents);
          const result = spawnSync(binary, ["check", "-c", tempFile], { encoding: "utf8" });
          officialChecks += 1;
          try {
            assertCleanSingBoxCheck({ binary, file: `${fixturePath} (pruned export)`, status: result.status, stdout: result.stdout, stderr: result.stderr });
          } catch (error) {
            failures.push((error as Error).message);
            throw error;
          }
        } finally {
          rmSync(tempDir, { recursive: true, force: true });
        }
      });
    }
  }

  it("ran the binary against the pruned export of every fixture (or skipped when binaries are absent)", () => {
    expect(failures).toEqual([]);
    if (officialChecks > 0) {
      // When binaries are present, pruning must have actually changed at least one fixture — proving
      // the gate exercises the app's pruned output, not the raw checked-in file.
      expect(prunedDiffersFromRaw).toBeGreaterThan(0);
    } else if (fixtureCount > 0) {
      console.warn("export-binary-check: no sing-box binaries found; checked JSON shape only.");
    }
  });
});
