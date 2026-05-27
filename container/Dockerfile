# syntax=docker/dockerfile:1.7

# Multi-stage build for the SBC validator container.
# Final image: distroless-ish Node 22 with three pinned sing-box binaries.

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
 && echo "==== POST-INSTALL DIRECTORY DUMP ====" \
 && ls -la /stage/bin \
 && file /stage/bin/sing-box-1.12     /stage/bin/sing-box-stable     /stage/bin/sing-box-testing 2>/dev/null || true \
 && for f in /stage/bin/sing-box-1.12 /stage/bin/sing-box-stable /stage/bin/sing-box-testing; do \
       echo "----- $f -----"; \
       [ -x "$f" ] && "$f" version | head -n 1 || echo "MISSING OR NOT EXECUTABLE: $f"; \
    done

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

# ---- Stage 4: final runtime image
FROM node:22-alpine
RUN addgroup -S sbc && adduser -S sbc -G sbc \
 && mkdir -p /app/bin /app/dist /app/node_modules \
 && chown -R sbc:sbc /app

WORKDIR /app

COPY --from=deps     /app/node_modules ./node_modules
COPY --from=binaries /stage/bin/      ./bin/
COPY --from=build    --chown=sbc:sbc /app/dist ./dist
COPY --chown=sbc:sbc package.json ./

USER sbc

EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080
ENV BIN_DIR=/app/bin

CMD ["node", "dist/index.js"]
