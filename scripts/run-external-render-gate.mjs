import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("fixtures/external/manifest.json", "utf8")).filter(
  (item) => item.counts_toward_200,
);
const shardSize = Number(process.env.EXTERNAL_RENDER_SHARD_SIZE ?? 8);

if (!Number.isInteger(shardSize) || shardSize < 1) {
  throw new Error(`Invalid EXTERNAL_RENDER_SHARD_SIZE: ${process.env.EXTERNAL_RENDER_SHARD_SIZE}`);
}

const shardCount = Math.ceil(manifest.length / shardSize);
const startedAt = Date.now();

for (let shardIndex = 0; shardIndex < shardCount; shardIndex += 1) {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "vitest",
      "run",
      "tests/external-fixtures-render.test.ts",
      "--pool",
      "forks",
      "--maxWorkers",
      "1",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        EXTERNAL_RENDER_SHARD_INDEX: String(shardIndex),
        EXTERNAL_RENDER_SHARD_COUNT: String(shardCount),
      },
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`External render gate complete. Fixtures: ${manifest.length}. Shards: ${shardCount}. Duration: ${seconds}s.`);
