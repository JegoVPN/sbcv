#!/usr/bin/env node
// scripts/claude-review/poll-and-submit.mjs
// Polls open GitHub PRs. For any PR without a "Review of PR #N" issue,
// fetches the head, runs Claude review, opens the issue, and cross-links.
// Designed to run on a /loop schedule. Idempotent: existing review
// issues are detected by title search and skipped.

import { execFileSync, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatIssueBody } from "./submit.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUN_MJS = resolve(__dirname, "run.mjs");

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function gh(args) {
  return spawnSync("gh", args, { encoding: "utf8" });
}

function trySpawn(cmd, args) {
  return spawnSync(cmd, args, { encoding: "utf8" });
}

export function hasReviewIssue(prNumber) {
  const r = gh([
    "issue",
    "list",
    "--state",
    "all",
    "--search",
    `"Review of PR #${prNumber}" in:title`,
    "--json",
    "number",
  ]);
  if (r.status !== 0) return false;
  try {
    return JSON.parse(r.stdout).length > 0;
  } catch {
    return false;
  }
}

async function reviewOnePR(pr) {
  process.stderr.write(`\npoll: reviewing PR #${pr.number} — ${pr.title}\n`);

  const fetchR = trySpawn("git", [
    "fetch",
    "origin",
    `pull/${pr.number}/head:refs/remotes/origin/pr-${pr.number}-head`,
  ]);
  if (fetchR.status !== 0) {
    process.stderr.write(`poll: git fetch failed for PR #${pr.number}:\n${fetchR.stderr}\n`);
    return null;
  }

  const baseSha = git(["rev-parse", `origin/${pr.baseRefName}`]);
  const mergeBase = git(["merge-base", pr.headRefOid, baseSha]);
  const range = `${mergeBase}..${pr.headRefOid}`;
  process.stderr.write(`poll: range ${range}\n`);

  const reviewR = trySpawn("node", [RUN_MJS, range]);
  const reviewOutput = (reviewR.stdout || "") + (reviewR.stderr || "");
  process.stderr.write(reviewOutput);

  const issueTitle = `Review of PR #${pr.number}: ${pr.title}`;
  const issueBody = formatIssueBody({
    reviewStdout: reviewOutput,
    prNumber: pr.number,
    prUrl: pr.url,
    headSha: pr.headRefOid,
    branchName: pr.headRefName,
  });

  const issueR = gh(["issue", "create", "--title", issueTitle, "--body", issueBody]);
  if (issueR.status !== 0) {
    process.stderr.write(`poll: gh issue create failed for PR #${pr.number}:\n${issueR.stderr}\n`);
    return null;
  }
  const issueUrl = issueR.stdout.trim().split(/\r?\n/).pop();

  const comment = gh([
    "pr",
    "comment",
    String(pr.number),
    "--body",
    `Automated Claude review opened: ${issueUrl}`,
  ]);
  if (comment.status !== 0) {
    process.stderr.write(`poll: pr comment failed (non-fatal):\n${comment.stderr}\n`);
  }

  process.stderr.write(`poll: PR #${pr.number} → ${issueUrl}\n`);
  return issueUrl;
}

async function main() {
  const prsR = gh([
    "pr",
    "list",
    "--state",
    "open",
    "--json",
    "number,title,baseRefName,headRefOid,headRefName,url",
  ]);
  if (prsR.status !== 0) {
    process.stderr.write(`poll: gh pr list failed:\n${prsR.stderr}\n`);
    return 1;
  }
  const prs = JSON.parse(prsR.stdout);
  process.stderr.write(`poll: ${prs.length} open PR(s) total\n`);

  let reviewed = 0;
  let skipped = 0;
  let errored = 0;
  for (const pr of prs) {
    if (hasReviewIssue(pr.number)) {
      skipped++;
      process.stderr.write(`poll: PR #${pr.number} already has review issue, skip\n`);
      continue;
    }
    try {
      const url = await reviewOnePR(pr);
      if (url) reviewed++;
      else errored++;
    } catch (err) {
      errored++;
      process.stderr.write(`poll: error on PR #${pr.number}: ${err.message}\n`);
    }
  }

  process.stderr.write(`poll: done — ${reviewed} reviewed, ${skipped} skipped, ${errored} errored\n`);
  return 0;
}

const invokedDirect =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirect) {
  main()
    .then((c) => process.exit(c))
    .catch((err) => {
      process.stderr.write(`poll: unexpected error: ${err.message}\n`);
      process.exit(0); // fail-open so the loop continues
    });
}
