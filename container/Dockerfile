# syntax=docker/dockerfile:1.7

# Multi-stage build for the SBC validator container.
#
# Note on libc: stages 1-3 use alpine (musl) because they only download or
# compile, they never execute sing-box. Stage 4 (final runtime) MUST be
# Debian-based (glibc): sing-box 1.13+ ships a CGO-built binary linked
# against glibc with libcronet.so as a side car, and musl/alpine cannot
# resolve the ELF interpreter even though the binary file is present.
#
# Cache-bust marker (touch to force a fresh image hash): 2026-06-01-1
#
# 2026-06-01: the #320 merge built green but Cloudflare served a STALE image
# (the running container still failed naive+quic with "cronet: library not
# found" even after a cold start), so the per-version layout + libcronet
# sidecar never reached production. Bumping this marker AND threading CACHE_BUST
# through stage 1 forces the binaries stage to actually re-run install-binaries.sh
# instead of reusing a cached layer.

ARG CACHE_BUST=2026-06-01-1
ARG SB_112_VERSION=1.12.25
ARG SB_STABLE_VERSION=1.13.12
ARG SB_TESTING_VERSION=1.14.0-alpha.25

# ---- Stage 1: download + extract sing-box binaries
FROM alpine:3.20 AS binaries
ARG CACHE_BUST
ARG SB_112_VERSION
ARG SB_STABLE_VERSION
ARG SB_TESTING_VERSION
ARG TARGETOS=linux
ARG TARGETARCH=amd64

# Referencing CACHE_BUST in a RUN ties this layer's cache key to the marker, so
# bumping it invalidates the download/install layers and re-runs the install.
RUN echo "cache-bust: ${CACHE_BUST}" \
 && apk add --no-cache curl tar ca-certificates coreutils

WORKDIR /stage
COPY scripts/install-binaries.sh ./install-binaries.sh
RUN chmod +x install-binaries.sh \
 && SB_112_VERSION="${SB_112_VERSION}" \
    SB_STABLE_VERSION="${SB_STABLE_VERSION}" \
    SB_TESTING_VERSION="${SB_TESTING_VERSION}" \
    TARGETOS="${TARGETOS}" \
    TARGETARCH="${TARGETARCH}" \
    ./install-binaries.sh \
 && ls -la /stage/bin

# ---- Stage 2: install Node.js production deps
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile --ignore-scripts

# ---- Stage 3: compile TypeScript
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml tsconfig.json ./
RUN corepack enable && pnpm install --frozen-lockfile --ignore-scripts
COPY src ./src
RUN pnpm exec tsc

# ---- Stage 4: final runtime image (Debian/glibc, see top-of-file note)
FROM node:22-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd -r sbc \
 && useradd -r -g sbc -d /app -s /usr/sbin/nologin sbc \
 && mkdir -p /app/bin /app/dist /app/node_modules \
 && chown -R sbc:sbc /app

WORKDIR /app

COPY --from=deps     /app/node_modules ./node_modules
COPY --from=binaries /stage/bin/      ./bin/
COPY --from=build    --chown=sbc:sbc /app/dist ./dist
COPY --chown=sbc:sbc package.json ./

# Build-time hard fail if any binary cannot actually execute on glibc, and if
# the naive outbound cannot load its cronet sidecar — the failure that surfaced
# as "cronet: library not found" when libcronet.so was dropped during install.
# `check` constructs every outbound, so a naive+quic config exercises the cronet
# dlopen without needing the network. 1.12 predates the naive outbound, so it is
# version-checked only.
RUN /app/bin/sing-box-1.12/sing-box    version | head -n 1 \
 && /app/bin/sing-box-stable/sing-box  version | head -n 1 \
 && /app/bin/sing-box-testing/sing-box version | head -n 1 \
 && test -s /app/bin/sing-box-stable/libcronet.so \
 && test -s /app/bin/sing-box-testing/libcronet.so \
 && printf '%s' '{"outbounds":[{"type":"naive","tag":"cronet-smoke","server":"127.0.0.1","server_port":443,"username":"u","password":"p","quic":true,"tls":{"enabled":true,"server_name":"example.com"}}]}' > /tmp/naive-smoke.json \
 && /app/bin/sing-box-stable/sing-box  check -c /tmp/naive-smoke.json \
 && /app/bin/sing-box-testing/sing-box check -c /tmp/naive-smoke.json \
 && rm -f /tmp/naive-smoke.json

USER sbc

EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080
ENV BIN_DIR=/app/bin

CMD ["node", "dist/index.js"]
