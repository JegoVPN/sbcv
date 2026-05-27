#!/bin/sh
# Deploy guard for the Cloudflare Workers Builds project `sbc-validator-gw`.
#
# Cloudflare Workers Builds re-runs on every push to main. The validator
# Worker + Container only cares about changes under worker/ or container/
# (Dockerfile, install-binaries.sh, Hono server, wrangler.toml). Editor /
# docs / fixture commits do not change the validator image, and re-running
# `wrangler deploy` for them still kicks the Cloudflare Container rollout
# (current -> target image) for no reason and slows down recovery from real
# validator changes.
#
# This script is run in the project root by Workers Builds and:
#   - exits 0 if the last commit only touches files outside worker/ container/
#     (Cloudflare treats this as a successful skipped deploy);
#   - cd's into worker/ and runs `wrangler deploy --env=""` otherwise.
#
# Configure in Dashboard -> sbc-validator-gw -> Settings -> Build:
#   Root directory:  (leave at repo root, NOT worker/, so git diff works)
#   Build command:   pnpm install --filter @sbc/validator-gw
#   Deploy command:  bash scripts/cf-deploy-validator-gw.sh

set -eu

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# On the very first build there may be no HEAD~1 (shallow clone) or no prior
# commit. In that case force a deploy so we never silently skip the initial
# rollout.
if ! git rev-parse HEAD~1 >/dev/null 2>&1; then
  echo "==> No HEAD~1 (first build / shallow clone); deploying."
  changed=""
  force_deploy=1
else
  changed="$(git diff --name-only HEAD~1 HEAD)"
  force_deploy=0
fi

if [ "$force_deploy" = 1 ] || echo "$changed" | grep -qE '^(worker/|container/|scripts/cf-deploy-validator-gw\.sh$)'; then
  echo "==> Relevant change detected; deploying sbc-validator-gw"
  echo "$changed" | grep -E '^(worker/|container/|scripts/cf-deploy-validator-gw\.sh$)' || true
  cd worker
  exec npx --yes wrangler@4.95.0 deploy --env=""
fi

echo "==> No worker/ or container/ change since previous commit; skipping deploy."
echo "    Changed files in this push:"
echo "$changed" | sed 's/^/      /'
exit 0
