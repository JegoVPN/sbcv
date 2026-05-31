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

# Pinned SHA256 sums for linux-amd64 release tarballs.
# Keep in sync with scripts/install-sing-box-binaries.mjs (root).
# To bump a version: download the new tarball, run `sha256sum`, update both files.
expected_sha256() {
  case "$1-${TARGETOS}-${TARGETARCH}" in
    1.12.25-linux-amd64)        echo "a1ec76e2b6b139eb747a1b1ebee7d14b8d4be5a833596cad8070a31ef960301f" ;;
    1.13.12-linux-amd64)        echo "1540533adb3df24f5ad5f14b5c7ca3dbc2401b10a1c1eb278fcadcada47ec6c4" ;;
    1.14.0-alpha.25-linux-amd64) echo "70f3b299b817e76920ef3c733ee899e460d00bc286611cf72c1f86696b2006b4" ;;
    *) echo "" ;;
  esac
}

download_binary() {
  version="$1"
  outname="$2"
  archive_name="sing-box-${version}-${TARGETOS}-${TARGETARCH}.tar.gz"
  url="https://github.com/SagerNet/sing-box/releases/download/v${version}/${archive_name}"
  tmp_dir="$(mktemp -d)"

  echo "==> Downloading sing-box ${version} -> ${outname}"
  curl -fL --proto '=https' --tlsv1.2 -o "${tmp_dir}/archive.tar.gz" "$url"

  expected="$(expected_sha256 "$version")"
  actual="$(sha256sum "${tmp_dir}/archive.tar.gz" | awk '{print $1}')"
  echo "==> SHA256: ${actual}"
  if [ -z "$expected" ]; then
    echo "FATAL: no pinned SHA256 for sing-box ${version} on ${TARGETOS}-${TARGETARCH}." >&2
    echo "       Add it to expected_sha256() before building this platform." >&2
    rm -rf "$tmp_dir"
    exit 1
  fi
  if [ "$expected" != "$actual" ]; then
    echo "FATAL: SHA256 mismatch for sing-box ${version}" >&2
    echo "  expected: ${expected}" >&2
    echo "  actual:   ${actual}" >&2
    rm -rf "$tmp_dir"
    exit 1
  fi
  echo "==> SHA256 verified."

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
  extracted_dir="$(dirname "$binary_path")"

  # Each version gets its own directory so its cronet sidecar (below) sits beside
  # the matching binary. sing-box 1.13+ purego Linux/Windows builds load cronet
  # via dlopen() from the binary's own directory at runtime; a flat shared layout
  # could mismatch cronet across versions.
  target_dir="${BIN_DIR}/${outname}"
  rm -rf "$target_dir"
  mkdir -p "$target_dir"

  mv "$binary_path" "${target_dir}/sing-box"
  chmod 0755 "${target_dir}/sing-box"

  # The naive outbound (since 1.13.0) dlopen()s the cronet library from the
  # binary's directory. The release tarball ships it next to the binary; carry it
  # over so naive (including quic) initializes instead of failing at construction
  # with "cronet: library not found". 1.12 ships no cronet (no naive outbound).
  for lib in libcronet.so libcronet.dll; do
    lib_path="$(find "$extracted_dir" -maxdepth 1 -type f -name "$lib" 2>/dev/null | head -n 1)"
    if [ -n "$lib_path" ]; then
      mv "$lib_path" "${target_dir}/${lib}"
      chmod 0644 "${target_dir}/${lib}"
      echo "==> Installed ${target_dir}/${lib} (naive cronet sidecar)"
    fi
  done

  rm -rf "$tmp_dir"

  # Sanity-check immediately so a silent mv failure cannot mask a missing binary.
  if [ ! -x "${target_dir}/sing-box" ]; then
    echo "FATAL: ${target_dir}/sing-box is not executable after install" >&2
    exit 1
  fi
  echo "==> Installed ${target_dir}/sing-box"
}

download_binary "$SB_112_VERSION"     sing-box-1.12
download_binary "$SB_STABLE_VERSION"  sing-box-stable
download_binary "$SB_TESTING_VERSION" sing-box-testing

echo
echo "==> File sanity (binaries are not executed here: sing-box 1.13+ links"
echo "    glibc + cronet, which the alpine build stage cannot run; the final"
echo "    Debian-based runtime stage validates execution.)"
for d in sing-box-1.12 sing-box-stable sing-box-testing; do
  f="${BIN_DIR}/${d}/sing-box"
  if [ ! -s "$f" ] || [ ! -x "$f" ]; then
    echo "FATAL: $f missing or not executable" >&2
    exit 1
  fi
  size="$(wc -c < "$f")"
  echo "  $f: ${size} bytes, executable bit ok"
done

# sing-box 1.13+ (stable, testing) must ship the cronet sidecar or the naive
# outbound fails at construction with "cronet: library not found" — the exact
# failure this layout fixes. 1.12 has no naive outbound, so it needs no sidecar.
if [ "$TARGETOS" = "linux" ]; then
  for d in sing-box-stable sing-box-testing; do
    lib="${BIN_DIR}/${d}/libcronet.so"
    if [ ! -s "$lib" ]; then
      echo "FATAL: $lib missing — naive outbound would fail with 'cronet: library not found'" >&2
      exit 1
    fi
    echo "  $lib: $(wc -c < "$lib") bytes, present"
  done
fi
