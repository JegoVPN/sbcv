# Cloudflare Deployment Plan

This document records the public deployment model for SBC. The plan is no longer deferred: we are shipping the editor on Cloudflare Workers (Static Assets) and the official `sing-box` validator on Cloudflare Workers + Containers under the production domain `sbcv.app`.

> Note: Cloudflare merged Pages into the Workers Builds product. The editor is deployed as a "Workers Static Assets" project, configured via the root `wrangler.toml`. Functionally this is equivalent to the legacy Cloudflare Pages flow (Git-connected, automatic builds from `main`, custom domain binding, `_headers` / SPA fallback). Older references in this document to "Cloudflare Pages" mean the same Worker-Static-Assets project unless explicitly noted.

Decision:

- **Workers Builds now** for the editor at `sbcv.app`, using Cloudflare's GitHub integration for automatic deploys from `main`. Root `wrangler.toml` declares an assets-only Worker pointing at `./dist`.
- **Worker + Container now** for the official `/check` API at `api.sbcv.app`, because Cloudflare Workers cannot execute `sing-box` directly.
- **Editor ships first**, the Worker + Container follow on a parallel track and are wired into the UI behind `VITE_OFFICIAL_CHECK_URL` only after the validator returns correct results in staging.

Production topology:

| Host | Service | Purpose |
| --- | --- | --- |
| `sbcv.app` | Workers Static Assets (`sbcv-app`) | Public SBC editor (apex) |
| `www.sbcv.app` | Cloudflare redirect rule | 301 to `sbcv.app` |
| `api.sbcv.app` | Cloudflare Worker -> Cloudflare Container | Official `sing-box check` API |

## Goal

Publish SBC as a public web app while keeping the editor fast, privacy-aware, and honest about validation:

- Browser editing and semantic validation should be instant.
- Official validation must run the matching `sing-box` binary.
- A `VALID` official result requires exit code `0` and no warning/deprecation output.
- User configs must not be stored as raw logs or persistent data.

## Target Architecture

```txt
sbcv.app                                 api.sbcv.app
    │                                          │
    ▼                                          ▼
Cloudflare Pages                       Cloudflare Worker (sbc-validator-gw)
└── SBC React/Vite static UI            ├── POST /check
                                        ├── GET  /healthz
                                        ├── size + JSON + Turnstile gate
                                        ├── KV cache (hash → result)
                                        ├── rate limit per IP/session
                                        └── forwards to Container with internal token
                                                       │
                                                       ▼
                                            Cloudflare Container (sbc-validator)
                                            ├── /app/bin/sing-box-1.12
                                            ├── /app/bin/sing-box-stable    (1.13.x)
                                            ├── /app/bin/sing-box-testing   (1.14.x)
                                            └── Hono HTTP server on :8080
```

Do not try to execute `sing-box` in a Worker: Cloudflare Workers document `node:child_process` / child processes as partially supported and non-functional. The Container is the binary runner; the Worker is the gateway only.

References:

- Cloudflare Pages build configuration: https://developers.cloudflare.com/pages/configuration/build-configuration/
- Cloudflare Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- Cloudflare Containers getting started: https://developers.cloudflare.com/containers/get-started/
- Cloudflare Containers architecture: https://developers.cloudflare.com/containers/architecture/
- Cloudflare Workers Node.js compatibility: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Cloudflare custom domains for Pages: https://developers.cloudflare.com/pages/configuration/custom-domains/
- Cloudflare Turnstile: https://developers.cloudflare.com/turnstile/

## Three-Step Rollout

Step 1 (Pages) and Step 2 (domain) ship first to bring up `sbcv.app`. Step 3 (Worker + Container) ships on a parallel track and is wired into the UI only after it returns correct results end-to-end.

### Step 1 - Publish The Static Editor On Cloudflare Workers Builds

Use Cloudflare Workers Builds (Static Assets) for the current app. There is no separate Pages product anymore on this Cloudflare account; the dashboard funnels every connected-Git project through Workers Builds, and `wrangler deploy` with an `[assets]` block is the supported way to ship a SPA.

Why Workers Builds (Static Assets):

- SBC is a static React/Vite SPA after `pnpm build`.
- Workers Builds has native GitHub integration and automatic production / preview deployments.
- The root `wrangler.toml` declares an assets-only Worker with `[assets] directory = "./dist"` and `not_found_handling = "single-page-application"`, which gives the same `_redirects` SPA fallback Pages used to provide.
- No API or server runtime is required for import, export, semantic diagnostics, canvas editing, or local JSON validation. We deploy assets-only, no `main` Worker script.

Project settings (Cloudflare Dashboard -> Workers & Pages -> Create application -> Import a Git repository):

| Setting | Value |
| --- | --- |
| Project name | `sbcv-app` |
| Repository | `JegoVPN/SBC` |
| Production branch | `main` |
| Build command | `pnpm build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | repo root |
| Package manager | pnpm (auto-detected via `package.json#packageManager`) |
| Node version | `22` via `.node-version` |
| pnpm version | `10.33.0` via `package.json#packageManager` |

Recommended Cloudflare Pages flow:

1. Cloudflare Dashboard -> Workers & Pages -> Pages -> Connect to Git.
2. Select GitHub repository `JegoVPN/SBC`.
3. Set production branch to `main`.
4. Set build command to `pnpm build`.
5. Set output directory to `dist`.
6. Deploy once and confirm the generated `*.pages.dev` URL loads SBC.
7. Add the production custom domain `sbcv.app` after the first deploy succeeds (see Step 2).

After this step, every pushed commit to `main` should automatically trigger a production Pages deploy. Pull requests / non-production branches can produce preview deployments if enabled.

GitHub automation model:

- Use Cloudflare Pages' GitHub integration, not a GitHub Actions deploy job.
- Cloudflare installs/uses its GitHub app, receives repository webhooks, checks out the commit, installs dependencies, runs `pnpm build`, and publishes `dist`.
- GitHub remains the code source of truth. Cloudflare Pages owns the deployment pipeline.
- No Cloudflare API token is required in GitHub secrets for Step 1.
- Keep the existing GitHub `Release Check` workflow as the quality gate. Pages deployment runs after pushes, but a failed release check still means the commit is not release-quality.

Repository deployment files (already in this PR):

- `.node-version` pins the Cloudflare Pages Node runtime to Node 22.
- `package.json#packageManager` pins pnpm to `10.33.0`.
- `public/_redirects` ships the SPA fallback so deep links load `index.html`.
- `public/_headers` ships conservative browser safety headers.

Fallback if GitHub integration cannot be used:

1. Create a Cloudflare API token with Pages edit permission.
2. Store it as a GitHub Actions secret `CLOUDFLARE_API_TOKEN`.
3. Add a deploy workflow that runs `pnpm build` and `wrangler pages deploy dist --project-name sbcv-app`.
4. Prefer this only if the Cloudflare GitHub integration is unavailable, because it adds secret rotation and CI ownership overhead.

### Step 2 - Bind `sbcv.app` To Pages

The domain `sbcv.app` is registered in Cloudflare, so Cloudflare can automate DNS for the Pages custom domain.

Domain model:

| Host | Target | Purpose |
| --- | --- | --- |
| `sbcv.app` (apex) | Cloudflare Pages project | Public SBC editor |
| `www.sbcv.app` | Cloudflare redirect rule | 301 to `sbcv.app` |
| `api.sbcv.app` | Cloudflare Worker (Step 3) | Official validator API |

Pages custom domain flow:

1. Open the Pages project created in Step 1.
2. Go to Custom domains.
3. Add `sbcv.app` (apex). Cloudflare will use CNAME flattening for the apex automatically.
4. Add `www.sbcv.app` as a second custom domain, or create a redirect rule `www.sbcv.app/*` -> `https://sbcv.app/$1` (301).
5. Wait for SSL certificate issuance on both hosts.
6. Confirm both hostnames serve the same build as the Pages preview URL.

Reserve `api.sbcv.app` for the Worker validator (Step 3). Do not point it at Pages.

GitHub + domain automation after setup:

1. Developer pushes signed commit to `main`.
2. GitHub records the commit and runs `Release Check`.
3. Cloudflare Pages receives the GitHub webhook and builds the same commit.
4. Pages publishes the build to the `*.pages.dev` URL.
5. The `sbcv.app` custom-domain binding serves the new deployment after Cloudflare finishes rollout.

Domain notes:

- The app hostname is inside the same Cloudflare account/zone as the registered domain, so Pages creates the DNS record automatically.
- If `sbcv.app` already has a conflicting DNS record, remove it before adding the Pages custom domain.
- Official-validation copy in the UI must remain hidden until Step 3 reports `valid` end-to-end. Until then, `Check` stays a browser/local semantic check.

### Step 3 - Official Validation On `api.sbcv.app` (Worker + Container)

Build this in parallel with Steps 1 and 2. Promote it to production only after the staging Worker route returns correct `valid` / `warning` / `invalid` for the bundled fixtures.

The Worker is the API gateway. The Container is the binary runner. Do not run `sing-box` directly inside the Worker.

Routing decision: `api.sbcv.app` is a separate hostname. We chose the separate-API-hostname shape over same-domain `/api/check` because it gives the cleanest operational boundary (independent CI, independent rate limits, independent rollback) and Cloudflare's documented Pages + Worker route coordination on the same hostname is harder to reason about under preview deploys. We can move to same-domain `/api/check` later if needed.

What ships in Step 3:

- A `worker/` package: Wrangler project that owns `api.sbcv.app`, the Container binding, and the KV namespace.
- A `container/` package: the Validator API as a small Hono HTTP server, packaged with the three `sing-box` binaries.
- Frontend wiring behind `VITE_OFFICIAL_CHECK_URL=https://api.sbcv.app`.

See "Validator Container", "Worker Gateway", and "Repository Layout" sections below for implementation detail.

## Repository Layout

Add two top-level packages alongside the existing SPA. Keep them isolated so the editor can ship without them.

```txt
/                          existing React/Vite SPA
├── src/                   editor source
├── public/                Pages static (_headers, _redirects)
├── scripts/               existing release tooling
├── worker/                NEW - Cloudflare Worker (Step 3)
│   ├── wrangler.toml
│   ├── package.json
│   ├── src/
│   │   ├── index.ts       fetch handler, routing, gating
│   │   ├── cache.ts       KV hash + lookup
│   │   ├── turnstile.ts   Turnstile verification
│   │   └── forward.ts     forward to container with internal token
│   └── test/
└── container/             NEW - Validator API + sing-box binaries (Step 3)
    ├── Dockerfile
    ├── package.json
    ├── src/
    │   ├── index.ts       Hono server, /check + /healthz
    │   ├── runner.ts      spawn + timeout + temp file lifecycle
    │   └── targets.ts     1.12 / stable / testing dispatch
    └── scripts/
        └── install-binaries.sh   pin + verify checksums for the three binaries
```

The Worker depends on the Container image but they deploy independently. Wrangler v4 supports declaring the Container in the same `wrangler.toml` and instantiating it via a binding from the Worker; see "Worker Gateway" below.

## Validator Container

The container is the only place that runs `sing-box`. Treat it as a sandbox for the three pinned binaries.

Image contract:

- Base: small, current LTS Node (e.g. `node:22-alpine`) or distroless equivalent.
- Process: Hono HTTP server on `:8080`.
- User: non-root (`sbc:sbc`).
- Filesystem: read-only except `/tmp`; `/tmp` cleared per request.
- Endpoints:
  - `POST /check` -> validate one config against the requested target.
  - `GET /healthz` -> liveness; returns binary versions for `1.12`, `stable`, `testing`.

Binary install:

- Pin three releases by tag: `1.12.x`, `1.13.x` (stable), `1.14.x` (testing).
- Download from official `SagerNet/sing-box` GitHub releases at build time.
- Verify SHA256 against the upstream `*.sha256` files.
- Install to `/app/bin/sing-box-1.12`, `/app/bin/sing-box-stable`, `/app/bin/sing-box-testing`.
- Mark executable, owned by `sbc:sbc`, mode `0755`.

Dockerfile skeleton (informative):

```dockerfile
# 1. stage: download + verify binaries
FROM alpine:3.20 AS binaries
ARG SB_112_VERSION
ARG SB_STABLE_VERSION
ARG SB_TESTING_VERSION
RUN apk add --no-cache curl tar
WORKDIR /stage
COPY scripts/install-binaries.sh ./
RUN ./install-binaries.sh

# 2. stage: install runtime deps
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

# 3. stage: final image
FROM node:22-alpine
RUN addgroup -S sbc && adduser -S sbc -G sbc \
 && mkdir -p /app/bin /app/src \
 && chown -R sbc:sbc /app
WORKDIR /app
COPY --from=deps  /app/node_modules ./node_modules
COPY --from=binaries /stage/bin/ /app/bin/
COPY --chown=sbc:sbc src/ ./src/
USER sbc
EXPOSE 8080
CMD ["node", "src/index.js"]
```

Runtime behavior (enforced in `runner.ts`):

- Never call through a shell.
- `spawn(binary, ["check", "-c", tempFile])`; pass config via temp file under `/tmp`, never as a CLI argument.
- Kill the child after 3-5 seconds; treat timeout as `invalid` with a clear reason.
- Delete temp files in `finally`.
- Capture stdout + stderr; classify into `valid` / `warning` / `invalid` per the status rules in "API Contract".
- Redact sensitive substrings (`password`, `private_key`, `uuid`, `secret`, `token`, `key`) from any returned diagnostic text.
- Log only `{hash, target, status, binaryVersion, durationMs}`; never log raw config.

Container deployment:

- Built and pushed by Wrangler from the `container/` package.
- Tag image with the resolved binary versions (e.g. `sbc-validator:1.12.4-1.13.12-1.14.5`) so rolling forward is explicit.
- Instantiated by the Worker via a Cloudflare Containers binding declared in `worker/wrangler.toml`.

## Worker Gateway

The Worker owns `api.sbcv.app`. It does not run `sing-box`. It validates the request, applies the cache and abuse gates, and forwards to the Container.

`worker/wrangler.toml` shape (informative):

```toml
name = "sbc-validator-gw"
main = "src/index.ts"
compatibility_date = "2026-05-01"
workers_dev = false
routes = [
  { pattern = "api.sbcv.app/*", custom_domain = true }
]

[[kv_namespaces]]
binding = "CHECK_CACHE"
id = "<KV id>"

[vars]
ALLOWED_ORIGIN = "https://sbcv.app"
MAX_BODY_BYTES = "524288"
CHECK_TIMEOUT_MS = "5000"

# Secrets (set via `wrangler secret put`):
# - INTERNAL_TOKEN          shared with the container
# - TURNSTILE_SECRET_KEY    server-side Turnstile secret

[[containers]]
binding = "VALIDATOR"
image = "./container"
instances = 1
```

Worker request flow (`src/index.ts`):

1. CORS: allow `https://sbcv.app` only.
2. Size: reject bodies larger than `MAX_BODY_BYTES` (start at 512 KB).
3. Shape: require JSON object payload `{ target, config }`; reject otherwise.
4. Target: must be one of `1.12 Legacy`, `1.13 stable`, `1.14 testing`.
5. Turnstile: verify the token against `TURNSTILE_SECRET_KEY` for anonymous/high-volume traffic.
6. Rate limit: per-IP and per-session counters; deny with 429.
7. Cache key: `sha256(normalize(config) + target + validatorVersion)`.
8. Cache hit: return the cached result from `CHECK_CACHE`.
9. Cache miss: forward to the Container with header `x-internal-token: $INTERNAL_TOKEN`.
10. Cache the Container response (TTL bounded; do not cache `invalid` for long).
11. Return sanitized JSON per the API Contract.

`CHECK_CACHE` (KV) stores `{status, target, binary, binaryVersion, warnings, errors, durationMs, cachedAt}` keyed by the hash above. Cap TTL at 24h initially.

The Container only accepts requests with `x-internal-token` matching its `INTERNAL_TOKEN` env var. Direct container access without the token returns 401.

## Frontend Integration

The editor reads two optional Vite env vars at build time:

- `VITE_OFFICIAL_CHECK_URL` - e.g. `https://api.sbcv.app`. When set, the UI exposes an "Official Check" action.
- `VITE_TURNSTILE_SITE_KEY` - Turnstile site key. When set, the Official Check button renders the Turnstile widget before allowing a request.

Behavior:

- If `VITE_OFFICIAL_CHECK_URL` is unset (Step 1 / Step 2 only), the UI hides Official Check entirely and `Check` remains the local semantic checker. Copy must not imply official binary validation.
- If `VITE_OFFICIAL_CHECK_URL` is set, Official Check explicitly tells the user "this sends the current config to the validation service" before submitting.

Set both as Cloudflare Pages environment variables on the production environment; leave them unset on preview deploys until the staging Worker is healthy.

## Target Mapping

One validator container contains all supported binaries. Do not run three separate validator services unless capacity data proves it is needed.

| SBC target | Binary | Expected purpose |
| --- | --- | --- |
| `1.12 Legacy` | `sing-box-1.12` | Legacy import/display validation |
| `1.13 stable` | `sing-box-stable` | Default public validation target |
| `1.14 testing` | `sing-box-testing` | Explicit testing validation target |

## API Contract

Request:

```http
POST https://api.sbcv.app/check
content-type: application/json
origin: https://sbcv.app
```

```json
{
  "target": "1.13 stable",
  "config": {}
}
```

Response:

```json
{
  "status": "valid",
  "target": "1.13 stable",
  "binary": "sing-box-stable",
  "binaryVersion": "1.13.12",
  "warnings": [],
  "errors": [],
  "durationMs": 120
}
```

Status rules:

- `invalid`: `sing-box check` exits non-zero.
- `warning`: `sing-box check` exits zero but stdout/stderr contains warning, deprecated, legacy, or "will be removed" output.
- `valid`: `sing-box check` exits zero and emits no warning/deprecation output.

Errors return RFC 7807-style JSON with HTTP status:

- `400` malformed body or unknown target.
- `401` missing/invalid Turnstile or internal token.
- `413` body over `MAX_BODY_BYTES`.
- `429` rate limited.
- `502` container unreachable / timeout.

## Worker Responsibilities

The Worker is an API gateway, not the validator:

- Reject bodies larger than 512 KB initially.
- Require JSON object payloads with `target` and `config`.
- Normalize and hash `target + config + validatorVersion`.
- Return cached validation results from KV when available.
- Apply rate limits per IP/session.
- Require Turnstile for abusive or high-volume anonymous traffic.
- Add an internal token when forwarding to the container so direct container calls are not accepted.

## Container Responsibilities

The container runs the official binary:

- Use a small Node/Hono or Go HTTP server.
- Never call through a shell.
- Use `spawn(binary, ["check", "-c", tempFile])`.
- Write config to a temp file under `/tmp`.
- Kill the process after 3-5 seconds.
- Run as non-root.
- Delete temp files in `finally`.
- Return sanitized diagnostics only.

The container should not persist user configs. Logs may include hash, target, status, binary version, and duration, but must not include raw config contents.

## Privacy

SBC configs may contain server addresses, passwords, private keys, and account identifiers. Public validation must be explicit:

- Browser `Check` remains semantic and local unless official validation is enabled.
- Official Check tells the user the config is sent to `api.sbcv.app` for validation.
- The service must not store raw configs.
- Client and server diagnostics redact obvious sensitive fields such as `password`, `private_key`, `uuid`, `secret`, `token`, and `key`.

## Secrets And Configuration

Cloudflare-side secrets (set with `wrangler secret put` on `sbc-validator-gw`):

- `INTERNAL_TOKEN` - shared between Worker and Container; rotated on a schedule.
- `TURNSTILE_SECRET_KEY` - server-side Turnstile secret.

Cloudflare Pages environment variables (production only):

- `VITE_OFFICIAL_CHECK_URL=https://api.sbcv.app`
- `VITE_TURNSTILE_SITE_KEY=<site key>`

GitHub Actions secrets (only if Pages GitHub integration is unavailable):

- `CLOUDFLARE_API_TOKEN` - Pages edit + Workers deploy scope.

No secrets are required in the repo for Step 1. Step 3 introduces the Wrangler workflow that owns the secrets above.

## Public Launch Gates

Step 1 - static editor on Pages at `sbcv.app`:

1. `pnpm release:check` passes locally and in CI.
2. Pages build succeeds from GitHub `main`.
3. `sbcv.app` and `www.sbcv.app` resolve and serve the latest build.
4. Browser `Check` copy does not imply official binary validation.
5. Export and Import still work in the hosted app.

Step 3 - official validation on `api.sbcv.app`:

1. Container image builds reproducibly with all three binaries and verified checksums.
2. `POST https://api.sbcv.app/check` returns `valid`, `warning`, and `invalid` correctly against the bundled fixtures.
3. Warning/deprecation output is not reported as pure `valid`.
4. Worker size limit, timeout, KV cache, and rate limit are enabled and exercised in tests.
5. Logs are audited to confirm raw configs are not emitted.
6. `pnpm release:check` still passes on the editor.
7. Frontend copy clearly separates semantic browser validation from official binary validation.
8. `INTERNAL_TOKEN` rotation procedure is documented in the `worker/` README.

## Roadmap

Track-A (editor, currently shipping):

1. Land this PR (Pages-ready repo files, docs).
2. Create the Cloudflare Pages project `sbcv-app` and connect to GitHub `main`.
3. Bind `sbcv.app` (apex) + `www.sbcv.app` to Pages.
4. Announce when Step 1 launch gates are green.

Track-B (validator, parallel):

1. [Done in this PR] Scaffold `container/` with the Dockerfile, `install-binaries.sh`, Hono server, and tests.
2. [Done in this PR] Scaffold `worker/` with `wrangler.toml`, Turnstile + KV + rate-limit middleware, and tests.
3. [Done in this PR] Wire `VITE_OFFICIAL_CHECK_URL` and `VITE_TURNSTILE_SITE_KEY` into the editor; the Official Check button stays hidden unless `VITE_OFFICIAL_CHECK_URL` is set.
4. Deploy `api-staging.sbcv.app` to staging via Wrangler, run fixture-based contract tests, then promote to `api.sbcv.app`.
5. Document `INTERNAL_TOKEN` rotation and Turnstile site/secret rotation.

Out of scope for now (revisit after Track-B is healthy):

- Same-domain `sbcv.app/api/check` routing.
- Multi-region Container placement.
- Per-user accounts / saved configs.

## Dashboard Runbook

Items below require manual action in the Cloudflare account or via the local `wrangler` CLI. None of them can be performed from a CI pipeline without elevated credentials, so they are tracked here as a checklist for the operator.

### A. Editor on Workers Builds (Track-A, ships `sbcv.app`)

Authentication model: Cloudflare's GitHub App handles auth here. No GitHub Actions secret and no `CLOUDFLARE_API_TOKEN` are required for Track-A. The Cloudflare build runner clones the repo, runs `pnpm build` and `npx wrangler deploy`, and is already inside your Cloudflare account so it can publish without an external token.

1. **Connect Cloudflare to GitHub** (one-time per account)
   Cloudflare Dashboard -> Workers & Pages -> Create application -> Connect to Git -> select GitHub. Authorize the Cloudflare GitHub App and grant it access to `JegoVPN/SBC` (whole org or just this repo).
2. **Create the project**
   Continue the import flow:
   - Repository: `JegoVPN/SBC`.
   - Production branch: `main`.
   - Project name: `sbcv-app`.
   - Build command: `pnpm build`.
   - Deploy command: `npx wrangler deploy`.
   - Root directory: repo root.

   Click Deploy. Cloudflare reads the root `wrangler.toml`, uploads `./dist`, and publishes an assets-only Worker on a `*.workers.dev` subdomain.
3. **Verify the staging URL**
   Open the workers.dev URL the dashboard prints. The editor should load; the local `Check` button should work; the Official Check button must remain hidden (env vars not configured yet).
4. **Bind `sbcv.app`**
   `sbcv-app` project -> Settings -> Domains & Routes -> Add custom domain -> `sbcv.app`. Cloudflare creates the DNS record automatically inside the `sbcv.app` zone.
5. **Bind `www.sbcv.app`**
   Either add `www.sbcv.app` as a second custom domain on the same project, or create a Bulk Redirect: `https://www.sbcv.app/*` -> `https://sbcv.app/$1` (301, preserve path + query).
6. **Wait for TLS**
   Confirm both `https://sbcv.app/` and `https://www.sbcv.app/` (or its redirect target) issue valid certificates and serve the same build as the workers.dev URL.

### B. Worker + Container (Track-B, ships `api.sbcv.app`)

Run from the local checkout, in the `worker/` directory.

1. **Authenticate Wrangler**
   ```bash
   cd worker
   pnpm install
   wrangler login
   ```
2. **Create the KV namespace for `CHECK_CACHE`**
   ```bash
   wrangler kv namespace create CHECK_CACHE
   wrangler kv namespace create CHECK_CACHE --env staging
   ```
   Paste each printed `id` into `wrangler.toml` under the matching `[[kv_namespaces]]` block, replacing `PLACEHOLDER_KV_ID` / `PLACEHOLDER_STAGING_KV_ID`.
3. **Register Turnstile**
   Cloudflare Dashboard -> Turnstile -> Add a site.
   - Domain: `sbcv.app`.
   - Mode: Managed.
   Record the **site key** (public, goes into Pages env vars) and the **secret key** (private, goes into Wrangler secret).
4. **Push Worker secrets**
   ```bash
   wrangler secret put INTERNAL_TOKEN          # any long random string; share with the container
   wrangler secret put TURNSTILE_SECRET_KEY    # from step B.3
   wrangler secret put VALIDATOR_URL           # internal container URL, see step B.6
   ```
   Repeat each with `--env staging` to set the staging variants.
5. **Build the validator container**
   ```bash
   cd ../container
   pnpm install
   pnpm docker:build
   ```
   This pulls the three pinned `sing-box` releases and runs `sing-box version` for each as a build-time sanity check. Bump the build args if you need newer point releases:
   ```bash
   docker build \
     --build-arg SB_112_VERSION=1.12.25 \
     --build-arg SB_STABLE_VERSION=1.13.12 \
     --build-arg SB_TESTING_VERSION=1.14.0-alpha.25 \
     -t sbc-validator:1.12.25-1.13.12-1.14.0a25 .
   ```
6. **Deploy the container to Cloudflare Containers**
   When using the Cloudflare Containers binding (recommended):
   - Uncomment the `[[containers]]`, `[[durable_objects.bindings]]`, and `[[migrations]]` blocks in `worker/wrangler.toml`.
   - Update `worker/src/forward.ts` to call `env.VALIDATOR.fetch(...)` instead of fetching `env.VALIDATOR_URL`.
   - From `worker/`, run `wrangler deploy` (or `--env staging` first). Wrangler builds the image at `../container/Dockerfile` and registers it.

   When using a direct HTTP container (any host running the image) skip the binding edits and instead push the URL via `wrangler secret put VALIDATOR_URL`.
7. **Deploy the Worker**
   ```bash
   cd worker
   wrangler deploy --env staging        # api-staging.sbcv.app
   curl -fsS https://api-staging.sbcv.app/healthz
   wrangler deploy                       # api.sbcv.app
   curl -fsS https://api.sbcv.app/healthz
   ```
8. **Contract smoke test against staging**
   ```bash
   curl -fsS -X POST https://api-staging.sbcv.app/check \
     -H 'origin: https://staging.sbcv.app' \
     -H 'content-type: application/json' \
     --data '{"target":"1.13 stable","config":{}}'
   ```
   Expect a JSON body with `status` in `{"valid","warning","invalid"}` and a populated `binaryVersion`.

### C. Wire The Editor To The Validator

1. **Pages -> Settings -> Environment variables -> Production**
   Add:
   - `VITE_OFFICIAL_CHECK_URL=https://api.sbcv.app`
   - `VITE_TURNSTILE_SITE_KEY=<site key from step B.3>`
2. **Pages -> Settings -> Environment variables -> Preview** (optional)
   Either leave both unset (preview deploys will show no Official Check button) or point preview at staging:
   - `VITE_OFFICIAL_CHECK_URL=https://api-staging.sbcv.app`
   - `VITE_TURNSTILE_SITE_KEY=<staging site key>`
3. **Redeploy Pages**
   Trigger a deploy so the editor bundle picks up the new env vars. Confirm the "Official Check" button appears next to "Check" on `sbcv.app`.

### D. Rotation

| Secret | Rotation procedure |
| --- | --- |
| `INTERNAL_TOKEN` | Generate a new random string. `wrangler secret put INTERNAL_TOKEN` on each Worker env. Rebuild the container with the new value in its environment (Cloudflare Containers will pick it up on next deploy). |
| `TURNSTILE_SECRET_KEY` | Rotate via the Turnstile site settings. `wrangler secret put TURNSTILE_SECRET_KEY` on each Worker env. |
| `VALIDATOR_URL` | Only changes if the container hostname changes. Update via `wrangler secret put VALIDATOR_URL`. |

### E. Final Verification Checklist

Before announcing public launch:

- [ ] `https://sbcv.app/` loads the editor and `Check` runs locally without errors.
- [ ] `https://api.sbcv.app/healthz` returns 200 and lists three targets.
- [ ] `https://api.sbcv.app/check` with a known-good fixture returns `status:"valid"`.
- [ ] `https://api.sbcv.app/check` with a known-invalid fixture returns `status:"invalid"`.
- [ ] `https://api.sbcv.app/check` without origin `https://sbcv.app` is rejected.
- [ ] Pages -> Functions/Settings show `VITE_OFFICIAL_CHECK_URL` and `VITE_TURNSTILE_SITE_KEY` in production.
- [ ] Worker logs contain no raw config payloads (sample 20 random requests).
- [ ] CI `Release Check` is green on `main`.
