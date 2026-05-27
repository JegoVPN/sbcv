# SBC Validator Container

Hono HTTP service that runs `sing-box check` against a posted config. Image bundles three pinned binaries (1.12 legacy, 1.13 stable, 1.14 testing). The Cloudflare Worker at `api.sbcv.app` is the only authorized caller.

## Endpoints

- `GET /healthz` — liveness, lists supported targets.
- `POST /check` — body `{ target, config }`, returns `{ status, target, binary, binaryVersion, warnings, errors, durationMs }`.

Requires header `x-internal-token: $INTERNAL_TOKEN` if `INTERNAL_TOKEN` is set in the environment.

## Local dev

```bash
pnpm install
pnpm dev            # tsx watch on :8080, binaries must already be on $BIN_DIR
pnpm test           # vitest
```

For end-to-end local runs that exercise the real `sing-box` binary, point `BIN_DIR` at the repo-root `.tools/bin/` directory after running `node scripts/install-sing-box-binaries.mjs` at the repo root.

## Docker

```bash
pnpm docker:build   # docker build -t sbc-validator:dev .
pnpm docker:run     # docker run --rm -p 8080:8080 sbc-validator:dev
```

The `Dockerfile` build args override the pinned versions:

```bash
docker build \
  --build-arg SB_112_VERSION=1.12.25 \
  --build-arg SB_STABLE_VERSION=1.13.12 \
  --build-arg SB_TESTING_VERSION=1.14.0-alpha.25 \
  -t sbc-validator:1.12.25-1.13.12-1.14.0a25 .
```

Keep these versions in sync with `scripts/install-sing-box-binaries.mjs` at the repo root.

## Environment

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | HTTP listen port | `8080` |
| `BIN_DIR` | Directory containing the three binaries | `/app/bin` |
| `INTERNAL_TOKEN` | Shared secret with the Worker; required header `x-internal-token` if set | unset (open) |
| `MAX_BODY_BYTES` | Reject larger bodies with 413 | `524288` (512 KB) |
| `CHECK_TIMEOUT_MS` | Kill `sing-box check` after N ms | `5000` |

## Deployment

The container is deployed to Cloudflare Containers from `worker/wrangler.toml` (sibling package). See `docs/cloudflare-deployment.md` for the full rollout sequence.
