#!/bin/sh
# Install pinned sing-box binaries (1.12 legacy, 1.13 stable, 1.14 testing).
#
# Versions are configured via env vars so the same script can be re-used when
# the upstream releases roll forward. The SBC editor pins matching versions in
# scripts/install-sing-box-binaries.mjs at the repo root; keep them in sync.
#
# Architecture is taken from TARGETARCH (Docker buildx) and defaults to amd64.

set -eux

SB_112_VERSION="${SB_112_VERSION:-1.12.25}"
SB_STABLE_VERSION="${SB_STABLE_VERSION:-1.13.12}"
SB_TESTING_VERSION="${SB_TESTING_VERSION:-1.14.0-alpha.25}"
TARGETOS="${TARGETOS:-linux}"
TARGETARCH="${TARGETARCH:-amd64}"

BIN_DIR="${BIN_DIR:-/stage/bin}"
mkdir -p "$BIN_DIR"

download_binary() {
  version="$1"
  outname="$2"
  archive_name="sing-box-${version}-${TARGETOS}-${TARGETARCH}.tar.gz"
  url="https://github.com/SagerNet/sing-box/releases/download/v${version}/${archive_name}"
  tmp_dir="$(mktemp -d)"

  echo "==> Downloading sing-box ${version} -> ${outname}"
  curl -fL --proto '=https' --tlsv1.2 -o "${tmp_dir}/archive.tar.gz" "$url"

  echo "==> SHA256 (build provenance):"
  sha256sum "${tmp_dir}/archive.tar.gz"

  echo "==> Extracting..."
  tar -xzf "${tmp_dir}/archive.tar.gz" -C "$tmp_dir"

  # Release tarball layouts vary slightly between sing-box minor versions; locate
  # the executable instead of relying on --strip-components.
  binary_path="$(find "$tmp_dir" -type f -name 'sing-box' 2>/dev/null | head -n 1)"
  if [ -z "$binary_path" ]; then
    echo "FATAL: sing-box binary not found in archive for version ${version}" >&2
    echo "Archive contents:" >&2
    find "$tmp_dir" -type f >&2
    rm -rf "$tmp_dir"
    exit 1
  fi
  echo "==> Found binary at: ${binary_path}"

  mv "$binary_path" "${BIN_DIR}/${outname}"
  chmod 0755 "${BIN_DIR}/${outname}"
  rm -rf "$tmp_dir"

  # Sanity-check immediately so a silent mv failure cannot mask a missing binary.
  if [ ! -x "${BIN_DIR}/${outname}" ]; then
    echo "FATAL: ${BIN_DIR}/${outname} is not executable after install" >&2
    exit 1
  fi
  echo "==> Installed ${BIN_DIR}/${outname}"
}

download_binary "$SB_112_VERSION"     sing-box-1.12
download_binary "$SB_STABLE_VERSION"  sing-box-stable
download_binary "$SB_TESTING_VERSION" sing-box-testing

echo
echo "==> Binary versions:"
"${BIN_DIR}/sing-box-1.12"    version | head -n 1
"${BIN_DIR}/sing-box-stable"  version | head -n 1
"${BIN_DIR}/sing-box-testing" version | head -n 1
