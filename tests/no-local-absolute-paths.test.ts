import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Privacy guard. A committed absolute home path (e.g. `/Users/<name>/...`) leaks the developer's local
// username and machine layout. It happened once in a workflow script under scripts/workflows/. This test
// scans every tracked file and fails on any `/Users/<name>/` or `/home/<name>/` path, so it can never
// silently reach the public repo again.
//
// Authored code/config/docs must use relative paths, `process.cwd()`, or `git rev-parse --show-toplevel`.

const ROOT = join(__dirname, "..");

// A home directory with a username segment. `/home/runner/` (CI) is allowed — it carries no private info.
const LOCAL_HOME_PATH = /\/(?:Users\/[A-Za-z0-9._-]+|home\/(?!runner\/)[A-Za-z0-9._-]+)\//;

// Out of scope: synced upstream docs and external user-config fixtures (third-party content whose paths
// are not our developer's privacy), plus binary/lock files.
const SKIP_PREFIX = ["docs/upstream/", "fixtures/external/"];
const SKIP_EXT = /\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|otf|eot|pdf|gz|zip|lock|ipynb)$/i;
const SELF = "tests/no-local-absolute-paths.test.ts";

function trackedFiles(): string[] {
  return execSync("git ls-files -z", { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
    .split("\0")
    .filter(Boolean);
}

describe("privacy: no local absolute paths in tracked files", () => {
  it("contains no /Users/<name>/ or /home/<name>/ path", () => {
    const offenders: string[] = [];
    for (const rel of trackedFiles()) {
      if (rel === SELF) continue;
      if (SKIP_EXT.test(rel)) continue;
      if (SKIP_PREFIX.some((p) => rel.startsWith(p))) continue;
      let text: string;
      try {
        text = readFileSync(join(ROOT, rel), "utf8");
      } catch {
        continue;
      }
      text.split(/\r?\n/).forEach((line, i) => {
        if (LOCAL_HOME_PATH.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 120)}`);
      });
    }
    expect(
      offenders,
      `Local absolute home path(s) leaked into tracked files (use a relative path / process.cwd() instead):\n  ${offenders.join(
        "\n  ",
      )}`,
    ).toEqual([]);
  });
});
