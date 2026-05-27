#!/bin/sh
# Deploy guard + post-deploy verification for the Cloudflare Workers Builds
# project `sbc-validator-gw`.
#
# Background:
#   Cloudflare Workers Builds reruns on every push to main. The validator
#   Worker + Container only cares about changes under worker/ or container/.
#   Editor / docs / fixture commits do not change the validator image, but
#   re-running `wrangler deploy` for them still kicks a Container rollout
#   for no reason.
#
#   Worse, `wrangler deploy` reports "SUCCESS Modified application" for the
#   container image patch even when the Cloudflare Containers backend does
#   not actually apply the new image. This produced a stale runtime
#   (sing-box-stable/testing missing from /app/bin) while every layer of
#   reporting claimed success.
#
# This script therefore:
#   1. Skips if no worker/ or container/ file changed since the previous
#      commit (Cloudflare treats `exit 0` as a successful no-op deploy).
#   2. Runs `wrangler deploy --env=""`.
#   3. Polls `wrangler containers list` until the application image tag
#      matches the latest worker version (8-hex prefix). Fails the build
#      if it never aligns within ~2 minutes.
#   4. Best-effort end-to-end probe of api.sbcv.app/check with a target
#      that requires sing-box-stable (1.13). If the probe returns ENOENT,
#      the build also fails so we never silently leave a broken validator
#      in production.
#
# Configure in Dashboard -> sbc-validator-gw -> Settings -> Build:
#   Root directory:  (leave at repo root, NOT worker/, so git diff works)
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

# --- 3. Verify container application image matches the new worker version ----

cd "$(git rev-parse --show-toplevel)/worker"

echo
echo "==> Post-deploy verification: container image vs worker version"

# Worker version id format is <8hex>-<rest>. wrangler also names container
# image tags by that same 8-hex prefix. So they should match after a real
# deploy. If `wrangler containers list` keeps returning the old prefix,
# Cloudflare did not apply the container application image patch.

latest_ver="$(npx --yes wrangler@4.95.0 versions list 2>/dev/null \
  | awk '/^Version ID:/ { print $3 }' \
  | tail -n 1)"

if [ -z "$latest_ver" ]; then
  echo "FATAL: could not read latest worker version id" >&2
  exit 1
fi

expected_tag="$(printf '%s' "$latest_ver" | cut -c1-8)"
echo "    expected container image tag: $expected_tag (from worker version $latest_ver)"

attempt=0
max_attempts=24    # 24 * 5s = 120s
actual_tag=""
while [ "$attempt" -lt "$max_attempts" ]; do
  attempt=$((attempt + 1))
  actual_tag="$(npx --yes wrangler@4.95.0 containers list 2>/dev/null \
    | grep -oE 'sbc-validator-gw-validatorcontainer:[0-9a-f]+' \
    | head -n 1 \
    | awk -F: '{ print $NF }')"

  if [ "$actual_tag" = "$expected_tag" ]; then
    echo "    container application image: $actual_tag (aligned, attempt $attempt)"
    break
  fi

  echo "    (try $attempt/$max_attempts) container at '$actual_tag', expected '$expected_tag' — waiting 5s"
  sleep 5
done

if [ "$actual_tag" != "$expected_tag" ]; then
  echo "FATAL: Cloudflare Containers backend did not apply the new image within 120s." >&2
  echo "       Worker version $latest_ver expects image tag $expected_tag." >&2
  echo "       Container application is still on image tag '$actual_tag'." >&2
  echo "       This means future /check requests will spawn a stale container." >&2
  echo "       Re-run this deploy from Cloudflare Dashboard, or push a trivial change to container/." >&2
  exit 1
fi

# --- 4. End-to-end probe ------------------------------------------------------

# Hit /check with target=1.13 stable. If the deployed image is correct and
# contains all three binaries, we get JSON with binaryVersion 1.13.x.
# If the image is broken or stale, we get spawn ENOENT or HTTP 5xx.

echo
echo "==> End-to-end probe via api.sbcv.app/check (target: 1.13 stable)"

probe_body="{\"target\":\"1.13 stable\",\"config\":{\"_post_deploy\":\"$(date +%s%N)\"}}"
probe_res="$(curl -sS \
  -X POST https://api.sbcv.app/check \
  -H 'origin: https://sbcv.app' \
  -H 'content-type: application/json' \
  --data "$probe_body" \
  --max-time 60 2>&1 || true)"

echo "    probe response: $probe_res"

if printf '%s' "$probe_res" | grep -q '"binaryVersion":"1.13'; then
  echo "    e2e probe OK: sing-box-stable is callable"
  echo
  echo "==> Deploy verified end-to-end."
  exit 0
fi

if printf '%s' "$probe_res" | grep -q 'ENOENT'; then
  echo "FATAL: container responded but sing-box-stable is not present on disk." >&2
  echo "       This usually means the binaries stage of the container build dropped" >&2
  echo "       a binary silently, or instances were not restarted onto the new image." >&2
  exit 1
fi

# Anything else (cold-start 5xx, rate limit, transient) — treat as a warning
# rather than a hard fail, since image tags align and a manual re-curl after
# a few seconds usually succeeds.
echo "WARN: e2e probe inconclusive; image tags aligned so continuing."
exit 0
