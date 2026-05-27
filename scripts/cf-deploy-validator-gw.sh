#!/bin/sh
# Deploy entrypoint for the Cloudflare Workers Builds project
# `sbc-validator-gw`.
#
# Pipeline:
#   1. Skip if no worker/ or container/ file changed since the previous
#      commit (Cloudflare treats exit 0 as a successful no-op deploy).
#   2. Install worker/ dependencies (Cloudflare Builds only installs root deps).
#   3. Run `wrangler deploy --env=""`.
#   4. Best-effort e2e probe of api.sbcv.app/check. Only hard-fails on ENOENT
#      (broken container image with missing sing-box binaries); anything else
#      is a warning since the deploy itself already succeeded.
#
# Configure in Dashboard -> sbc-validator-gw -> Settings -> Build:
#   Root directory:  /  (so git diff sees both worker/ and container/)
#   Build command:   pnpm install
#   Deploy command:  bash scripts/cf-deploy-validator-gw.sh
#   Build watch paths:  worker/**, container/**, scripts/cf-deploy-validator-gw.sh

set -eu

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# --- 1. Skip if nothing relevant changed --------------------------------------

if ! git rev-parse HEAD~1 >/dev/null 2>&1; then
  echo "==> No HEAD~1 (first build / shallow clone); forcing deploy."
  changed=""
  force_deploy=1
else
  changed="$(git diff --name-only HEAD~1 HEAD)"
  force_deploy=0
fi

relevant="^(worker/|container/|scripts/cf-deploy-validator-gw\.sh$)"

if [ "$force_deploy" != 1 ] && ! echo "$changed" | grep -qE "$relevant"; then
  echo "==> No worker/ or container/ change since previous commit; skipping deploy."
  echo "    Changed files in this push:"
  echo "$changed" | sed 's/^/      /'
  exit 0
fi

echo "==> Relevant change detected; deploying sbc-validator-gw."
echo "$changed" | grep -E "$relevant" | sed 's/^/      /' || true

# --- 2. wrangler deploy -------------------------------------------------------

# worker/ is its own pnpm package, not a workspace member of the root.
# Cloudflare Builds installs root deps but never enters worker/, so wrangler
# would fail to resolve @cloudflare/containers. Install worker/ deps first.
(cd worker && pnpm install --frozen-lockfile && npx --yes wrangler@4.95.0 deploy --env="")

# --- 3. Best-effort e2e probe -------------------------------------------------
#
# Past incident: `wrangler deploy` returned SUCCESS but the Container backend
# silently kept serving a stale image without sing-box binaries on disk. The
# probe catches that specific failure mode (ENOENT). Everything else — cold
# starts, transient 5xx, rate limits, permission-scoped build tokens that
# cannot list containers — is treated as a non-fatal warning because the
# deploy itself already succeeded.

echo
echo "==> End-to-end probe via api.sbcv.app/check (target: 1.13 stable)"

# Give the Container backend a beat to swap to the new image before probing.
sleep 10

probe_body="{\"target\":\"1.13 stable\",\"config\":{\"_post_deploy\":\"$(date +%s%N)\"}}"
probe_res="$(curl -sS \
  -X POST https://api.sbcv.app/check \
  -H 'origin: https://sbcv.app' \
  -H 'content-type: application/json' \
  --data "$probe_body" \
  --max-time 60 2>&1 || true)"

echo "    probe response: $probe_res"

if printf '%s' "$probe_res" | grep -q 'ENOENT'; then
  echo "FATAL: container responded but sing-box-stable is not present on disk." >&2
  echo "       The binaries stage of the container build dropped a binary, or" >&2
  echo "       instances were not restarted onto the new image." >&2
  exit 1
fi

if printf '%s' "$probe_res" | grep -q '"binaryVersion":"1.13'; then
  echo "==> Deploy verified end-to-end (binaryVersion 1.13.x)."
  exit 0
fi

echo "WARN: e2e probe was inconclusive; deploy itself succeeded so continuing."
exit 0
