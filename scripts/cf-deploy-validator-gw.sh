#!/bin/sh
# Deploy entrypoint for the Cloudflare Workers Builds project
# `sbc-validator-gw`.
#
# Pipeline:
#   1. Skip if no worker/ or container/ file changed since the previous
#      commit (Cloudflare treats exit 0 as a successful no-op deploy).
#   2. Install worker/ dependencies (Cloudflare Builds only installs root deps).
#   3. Run `wrangler deploy --env=""`.
#   4. Verify the exact testing binary and a testing-only feature through the
#      production API. A stale or inconclusive rollout fails the build.
#
# Configure in Dashboard -> sbc-validator-gw -> Settings -> Build:
#   Root directory:  worker
#   Build command:   pnpm install --frozen-lockfile
#   Deploy command:  bash ../scripts/cf-deploy-validator-gw.sh
#   Preview command: npx --yes wrangler@4.95.0 versions upload --env=""
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

# --- 2. Validate the rollout version contract --------------------------------

expected_112_version="$(sed -n 's/^ARG SB_112_VERSION=//p' container/Dockerfile | head -n 1)"
expected_stable_version="$(sed -n 's/^ARG SB_STABLE_VERSION=//p' container/Dockerfile | head -n 1)"
expected_testing_version="$(sed -n 's/^ARG SB_TESTING_VERSION=//p' container/Dockerfile | head -n 1)"
expected_cache_bust="$(sed -n 's/^ARG CACHE_BUST=//p' container/Dockerfile | head -n 1)"
expected_validator_version="$expected_112_version+$expected_stable_version+$expected_testing_version+$expected_cache_bust"
configured_validator_version="$(sed -n 's/^VALIDATOR_VERSION = "\([^"]*\)"/\1/p' worker/wrangler.toml | head -n 1)"

if [ -z "$expected_112_version" ] || [ -z "$expected_stable_version" ] \
  || [ -z "$expected_testing_version" ] || [ -z "$expected_cache_bust" ]; then
  echo "FATAL: could not read binary versions or CACHE_BUST from container/Dockerfile." >&2
  exit 1
fi

if [ "$configured_validator_version" != "$expected_validator_version" ] \
  || grep '^VALIDATOR_VERSION = ' worker/wrangler.toml \
    | grep -Fvq "VALIDATOR_VERSION = \"$expected_validator_version\""; then
  echo "FATAL: worker VALIDATOR_VERSION ($configured_validator_version) must match" >&2
  echo "       the Dockerfile release fingerprint ($expected_validator_version)." >&2
  exit 1
fi

if [ "$force_deploy" != 1 ]; then
  previous_dockerfile="$(git show HEAD~1:container/Dockerfile 2>/dev/null || true)"
  previous_binary_versions="$(printf '%s\n' "$previous_dockerfile" | sed -n 's/^ARG SB_.*_VERSION=//p')"
  current_binary_versions="$(sed -n 's/^ARG SB_.*_VERSION=//p' container/Dockerfile)"
  previous_cache_bust="$(printf '%s\n' "$previous_dockerfile" | sed -n 's/^ARG CACHE_BUST=//p' | head -n 1)"

  if [ "$current_binary_versions" != "$previous_binary_versions" ] \
    && [ "$expected_cache_bust" = "$previous_cache_bust" ]; then
    echo "FATAL: binary pins changed without bumping container CACHE_BUST." >&2
    exit 1
  fi
fi

# --- 3. wrangler deploy -------------------------------------------------------

# worker/ is its own pnpm package, not a workspace member of the root.
# Cloudflare Builds installs root deps but never enters worker/, so wrangler
# would fail to resolve @cloudflare/containers. Install worker/ deps first.
(cd worker && pnpm install --frozen-lockfile && npx --yes wrangler@4.95.0 deploy --env="" --containers-rollout=immediate)

# --- 4. Exact-version e2e probe ----------------------------------------------
#
# Past incident: `wrangler deploy` returned SUCCESS but the Container backend
# silently kept serving a stale image. Use a unique testing-only config on
# every attempt so neither the old nor new KV namespace can hide the running
# binary version.

echo
echo "==> End-to-end probe via api.sbcv.app/check (expected: $expected_testing_version)"

probe_attempt=1
probe_max_attempts=6
while [ "$probe_attempt" -le "$probe_max_attempts" ]; do
  probe_nonce="$(date +%s)-$probe_attempt"
  probe_body="{\"target\":\"1.14 testing\",\"config\":{\"network_namespaces\":[{\"type\":\"default\",\"tag\":\"post-deploy-$probe_nonce\",\"path\":\"/proc/self/ns/net\"}]}}"
  probe_res="$(curl -sS \
    -X POST https://api.sbcv.app/check \
    -H 'origin: https://sbcv.app' \
    -H 'content-type: application/json' \
    --data "$probe_body" \
    --max-time 60 2>&1 || true)"

  echo "    attempt $probe_attempt/$probe_max_attempts: $probe_res"

  if printf '%s' "$probe_res" | grep -q 'ENOENT'; then
    echo "FATAL: container responded but sing-box-testing is not present on disk." >&2
    exit 1
  fi

  if printf '%s' "$probe_res" | grep -Fq "\"binaryVersion\":\"$expected_testing_version\"" \
    && printf '%s' "$probe_res" | grep -q '"status":"valid"'; then
    echo "==> Deploy verified end-to-end ($expected_testing_version, network_namespaces valid)."
    exit 0
  fi

  probe_attempt=$((probe_attempt + 1))
  if [ "$probe_attempt" -le "$probe_max_attempts" ]; then
    sleep 10
  fi
done

echo "FATAL: production validator did not roll out $expected_testing_version." >&2
exit 1
