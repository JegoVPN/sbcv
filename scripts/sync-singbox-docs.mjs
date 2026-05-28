#!/usr/bin/env node
// scripts/sync-singbox-docs.mjs
// Mirror the official sing-box documentation tree into the repo for offline
// reading and as the source-of-truth for node UI reviews.
//
//   testing   -> docs/upstream/sing-box/testing   (1.14)
//   stable    -> docs/upstream/sing-box/stable    (1.13)
//   oldstable -> docs/upstream/sing-box/oldstable (1.12)
//
// Each branch's repository `docs/` subtree is copied verbatim (so a node's
// official doc lives at e.g. docs/upstream/sing-box/testing/configuration/outbound/vless.md).
// The mirror is reproducible and committed to the repo; the daily
// .github/workflows/sync-singbox-docs.yml re-runs this with FORCE and opens a PR
// only when the upstream docs actually changed. SYNC_INFO.txt records the source
// commit (no wall-clock timestamp, so an unchanged upstream yields no diff).
//
// Usage:
//   node scripts/sync-singbox-docs.mjs                 # sync missing branches
//   FORCE_SYNC_SING_BOX_DOCS=1 node scripts/...        # re-sync all branches
//   node scripts/sync-singbox-docs.mjs testing stable  # only these branches

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const DEST_ROOT = join(REPO_ROOT, "docs", "upstream", "sing-box");
const REPO_URL = "https://github.com/SagerNet/sing-box.git";

const BRANCHES = [
  { branch: "testing", version: "1.14" },
  { branch: "stable", version: "1.13" },
  { branch: "oldstable", version: "1.12" },
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "inherit", ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed (exit ${result.status})`);
  }
}

function capture(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  return result.status === 0 ? result.stdout.trim() : "";
}

function isSynced(dest) {
  return existsSync(join(dest, "configuration", "index.md"));
}

function syncBranch({ branch, version }) {
  const dest = join(DEST_ROOT, branch);
  if (isSynced(dest) && !process.env.FORCE_SYNC_SING_BOX_DOCS) {
    console.log(`sing-box ${branch} (${version}) docs already synced -> ${rel(dest)}`);
    return;
  }

  const tmp = join(REPO_ROOT, ".tmp", `sing-box-docs-sync-${branch}`);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`Syncing sing-box ${branch} (${version}) docs...`);
  run("git", [
    "clone",
    "--depth", "1",
    "--branch", branch,
    "--filter=blob:none",
    "--sparse",
    REPO_URL,
    tmp,
  ]);
  run("git", ["-C", tmp, "sparse-checkout", "set", "docs"]);

  const srcDocs = join(tmp, "docs");
  if (!existsSync(srcDocs)) {
    throw new Error(`expected docs/ in ${branch} checkout, not found`);
  }

  const sha = capture("git", ["-C", tmp, "rev-parse", "HEAD"]);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(srcDocs, dest, { recursive: true });
  // No wall-clock timestamp here on purpose: the file must be a pure function of
  // upstream content so an unchanged upstream produces no git diff (= no daily PR noise).
  writeFileSync(
    join(dest, "SYNC_INFO.txt"),
    [
      `source: ${REPO_URL}`,
      `branch: ${branch}`,
      `version: ${version}`,
      `commit: ${sha}`,
      `generated_by: scripts/sync-singbox-docs.mjs (do not edit by hand)`,
      ``,
    ].join("\n"),
  );

  rmSync(tmp, { recursive: true, force: true });
  console.log(`  -> ${rel(dest)} @ ${sha.slice(0, 12)}`);
}

function rel(p) {
  return p.startsWith(REPO_ROOT) ? p.slice(REPO_ROOT.length + 1) : p;
}

const requested = process.argv.slice(2);
const targets = requested.length
  ? BRANCHES.filter((b) => requested.includes(b.branch))
  : BRANCHES;

if (requested.length && targets.length !== requested.length) {
  const known = BRANCHES.map((b) => b.branch).join(", ");
  console.error(`Unknown branch in: ${requested.join(", ")}. Known: ${known}`);
  process.exit(1);
}

mkdirSync(DEST_ROOT, { recursive: true });
for (const target of targets) syncBranch(target);
console.log("Done.");
