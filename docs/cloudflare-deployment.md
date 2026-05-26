# Cloudflare Deployment Plan

This document records the intended public deployment model for SBC. Implementation is deferred; the current priority remains the visual editor and validation correctness.

## Goal

Publish SBC as a public web app while keeping the editor fast, privacy-aware, and honest about validation:

- Browser editing and semantic validation should be instant.
- Official validation must run the matching `sing-box` binary.
- A `VALID` official result requires exit code `0` and no warning/deprecation output.
- User configs must not be stored as raw logs or persistent data.

## Architecture

```txt
Cloudflare Pages
└── SBC React/Vite static UI

Cloudflare Worker
├── /api/check
├── request size limit
├── rate limit / Turnstile
├── KV cache by normalized config hash
└── proxies official checks to Cloudflare Container

Cloudflare Container
└── Validator API
    ├── /app/bin/sing-box-1.12
    ├── /app/bin/sing-box-stable
    └── /app/bin/sing-box-testing
```

Use Cloudflare Pages for the React app. Do not try to execute `sing-box` in a Worker: Cloudflare Workers document `node:child_process` as only partially supported and non-functional. Use Cloudflare Containers for the binary runner instead.

References:

- Cloudflare Containers getting started: https://developers.cloudflare.com/containers/get-started/
- Cloudflare Containers architecture: https://developers.cloudflare.com/containers/architecture/
- Cloudflare Workers Node.js compatibility: https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Target Mapping

One validator container should contain all supported binaries. Do not run three separate validator services unless capacity data proves it is needed.

| SBC target | Binary | Expected purpose |
| --- | --- | --- |
| `1.12 Legacy` | `sing-box-1.12` | Legacy import/display validation |
| `1.13 stable` | `sing-box-stable` | Default public validation target |
| `1.14 testing` | `sing-box-testing` | Explicit testing validation target |

## API Contract

Request:

```http
POST /api/check
content-type: application/json
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
- Official Check should tell the user the config is sent to the validation service.
- The service must not store raw configs.
- Client and server diagnostics should redact obvious sensitive fields such as `password`, `private_key`, `uuid`, `secret`, `token`, and `key`.

## Public Launch Gates

Before enabling public official validation:

1. Container image builds reproducibly with all three binaries.
2. `/api/check` returns `valid`, `warning`, and `invalid` correctly.
3. Warning/deprecation output is not reported as pure `valid`.
4. Worker size limit, timeout, cache, and rate limit are enabled.
5. Logs are audited to ensure raw configs are not emitted.
6. CI still runs `pnpm release:check`.
7. Frontend copy clearly separates semantic browser validation from official binary validation.

## Deferred Work

- Wrangler/Cloudflare Container scaffold.
- Validator API package.
- Worker gateway package.
- KV cache binding.
- Turnstile integration.
- Production domain and environment setup.
