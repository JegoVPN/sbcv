# SBC Validator Gateway Worker

Cloudflare Worker bound to `api.sbcv.app`. Acts as a gateway in front of the validator container: it enforces CORS, size/JSON shape gates, Turnstile, rate limits, KV-backed result caching, and forwards official `sing-box check` requests to the container with an internal token.

The Worker never runs `sing-box` itself.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `OPTIONS` | `*` | CORS preflight; only `https://sbcv.app` is allowed |
| `GET` | `/healthz` | Liveness |
| `POST` | `/check` | `{ target, config, turnstileToken? }` -> validator response |

## Local dev

```bash
pnpm install
echo 'INTERNAL_TOKEN=dev-secret'        >  .dev.vars
echo 'VALIDATOR_URL=http://localhost:8080' >> .dev.vars
echo 'TURNSTILE_SECRET_KEY='            >> .dev.vars       # leave blank to skip
pnpm dev                                  # wrangler dev
```

Then start the container in `../container` (`pnpm dev` on :8080) and POST to `http://localhost:8787/check`.

## Tests

```bash
pnpm test
pnpm typecheck
```

## Deploy

In production, deploys are driven by Cloudflare Workers Builds on every push
to `main` that touches `worker/**`, `container/**`, or
`scripts/cf-deploy-validator-gw.sh`. The smart deploy script verifies the
container image tag and runs an end-to-end probe before exiting.

One-time setup (locally, when you first stand up a fresh environment):

```bash
wrangler login
wrangler kv namespace create CHECK_CACHE
# paste the printed id into wrangler.toml -> [[kv_namespaces]] -> id

wrangler secret put INTERNAL_TOKEN          # shared with container
wrangler secret put TURNSTILE_SECRET_KEY    # server-side Turnstile secret
wrangler secret put VALIDATOR_URL           # internal container URL
```

For staging only, repeat with `--env staging`.

Manual deploy (only if Workers Builds is offline):

```bash
pnpm deploy                  # production -> api.sbcv.app
pnpm deploy -- --env staging # api-staging.sbcv.app
```

## Environment

| Name | Source | Purpose |
| --- | --- | --- |
| `ALLOWED_ORIGIN` | `wrangler.toml [vars]` | CORS gate, e.g. `https://sbcv.app` |
| `MAX_BODY_BYTES` | `wrangler.toml [vars]` | Reject larger bodies with 413 |
| `CHECK_TIMEOUT_MS` | `wrangler.toml [vars]` | Abort the container fetch if it takes too long |
| `VALIDATOR_VERSION` | `wrangler.toml [vars]` | Becomes part of the cache key |
| `RATE_LIMIT_PER_MIN` | `wrangler.toml [vars]` | Per-IP cap |
| `VALIDATOR_URL` | secret | Container HTTP URL |
| `INTERNAL_TOKEN` | secret | Shared with container's `x-internal-token` header |
| `TURNSTILE_SECRET_KEY` | secret | Turnstile server-side key; empty = off |
| `CHECK_CACHE` | KV binding | Cache + rate-limit counters |

## Switching to a Containers binding

When Cloudflare Containers is wired up (uncomment the `[[containers]]` and `[[durable_objects.bindings]]` block in `wrangler.toml`), update `src/forward.ts` to call `env.VALIDATOR.fetch(...)` instead of fetching `VALIDATOR_URL`. The rest of the Worker stays the same.
