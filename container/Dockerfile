# syntax=docker/dockerfile:1.7

# Multi-stage build for the SBC validator container.
#
# Note on libc: stages 1-3 use alpine (musl) because they only download or
# compile, they never execute sing-box. Stage 4 (final runtime) MUST be
# Debian-based (glibc): sing-box 1.13+ ships a CGO-built binary linked
# against glibc with libcronet.so as a side car, and musl/alpine cannot
# resolve the ELF interpreter even though the binary file is present.

ARG SB_112_VERSION=1.12.25
ARG SB_STABLE_VERSION=1.13.12
ARG SB_TESTING_VERSION=1.14.0-alpha.25

# ---- Stage 1: download + extract sing-box binaries
FROM alpine:3.20 AS binaries
ARG SB_112_VERSION
ARG SB_STABLE_VERSION
ARG SB_TESTING_VERSION
ARG TARGETOS=linux
ARG TARGETARCH=amd64

RUN apk add --no-cache curl tar ca-certificates coreutils

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
COPY package.json ./
RUN corepack enable && pnpm install --prod --no-frozen-lockfile --ignore-scripts

# ---- Stage 3: compile TypeScript
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json ./
RUN corepack enable && pnpm install --no-frozen-lockfile --ignore-scripts
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

# Build-time hard fail if any binary cannot actually execute on glibc.
RUN /app/bin/sing-box-1.12    version | head -n 1 \
 && /app/bin/sing-box-stable  version | head -n 1 \
 && /app/bin/sing-box-testing version | head -n 1

USER sbc

EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080
ENV BIN_DIR=/app/bin

CMD ["node", "dist/index.js"]
