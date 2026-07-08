import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const toolsDir = ".tools";
const binDir = join(toolsDir, "bin");

const binaries = [
  { command: "sing-box-1.12", version: "1.12.25" },
  { command: "sing-box-stable", version: "1.13.14" },
  { command: "sing-box-testing", version: "1.14.0-alpha.40" },
];

// Pinned SHA256 sums for sing-box release tarballs. Keep in sync with
// container/scripts/install-binaries.sh. To bump a version: download the
// new tarball, run `shasum -a 256`, update both files.
const CHECKSUMS = {
  "1.12.25-linux-amd64":         "a1ec76e2b6b139eb747a1b1ebee7d14b8d4be5a833596cad8070a31ef960301f",
  "1.12.25-darwin-arm64":        "a4a06d507f3f4d951490168d1372fce4c02db7211e88af9da13f93ed98068d5e",
  "1.13.14-linux-amd64":         "f48703461a15476951ac4967cdad339d986f4b8096b4eb3ff0829a500502d697",
  "1.13.14-darwin-arm64":        "73e8967b0fc08e17bce4263ca56ebc394822401a16497a1c4e02316c888202ab",
  "1.14.0-alpha.40-linux-amd64": "dc44780a1e0afff257f866f330d08c66615772000ade73eae35832ac59db1a37",
  "1.14.0-alpha.40-darwin-arm64":"131fc6e7547ed425f5c2ee5e95e1b7941756345fef9a29be92055bfa622e24ff",
};

function platformName() {
  if (process.platform === "darwin") return "darwin";
  if (process.platform === "linux") return "linux";
  throw new Error(`Unsupported platform for sing-box binary install: ${process.platform}`);
}

function archName() {
  if (process.arch === "x64") return "amd64";
  if (process.arch === "arm64") return "arm64";
  throw new Error(`Unsupported architecture for sing-box binary install: ${process.arch}`);
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function installBinary({ command, version }) {
  const os = platformName();
  const arch = archName();
  const tag = `v${version}`;
  const archiveName = `sing-box-${version}-${os}-${arch}.tar.gz`;
  const url = `https://github.com/SagerNet/sing-box/releases/download/${tag}/${archiveName}`;
  const targetDir = join(toolsDir, command);
  const archivePath = join(toolsDir, `${command}.tar.gz`);
  const binaryPath = join(targetDir, "sing-box");
  const linkPath = join(binDir, command);

  // A bare existence check silently kept STALE binaries after a version bump (the pins moved but
  // .tools/ still held the old release, so test:binaries validated against the wrong sing-box).
  // Stamp the installed version and reinstall on mismatch.
  const stampPath = join(targetDir, ".version");
  if (existsSync(linkPath) && existsSync(binaryPath) && !process.env.FORCE_INSTALL_SING_BOX) {
    const installed = existsSync(stampPath) ? readFileSync(stampPath, "utf8").trim() : "";
    if (installed === version) {
      console.log(`${command} ${version} already installed`);
      return;
    }
    console.log(`${command} is ${installed || "unstamped"}, want ${version} — reinstalling`);
  }

  rmSync(targetDir, { recursive: true, force: true });
  rmSync(linkPath, { force: true });
  mkdirSync(targetDir, { recursive: true });
  mkdirSync(binDir, { recursive: true });

  console.log(`Installing ${command} ${version}`);
  run("curl", ["-fL", "--proto", "=https", "--tlsv1.2", url, "-o", archivePath]);

  const expected = CHECKSUMS[`${version}-${os}-${arch}`];
  const actual = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
  if (!expected) {
    throw new Error(
      `No pinned SHA256 for sing-box ${version} on ${os}-${arch}. ` +
        `Compute it and add it to CHECKSUMS in this file.`,
    );
  }
  if (actual !== expected) {
    throw new Error(
      `SHA256 mismatch for sing-box ${version}-${os}-${arch}:\n  expected ${expected}\n  actual   ${actual}`,
    );
  }
  console.log(`SHA256 verified: ${actual}`);

  run("tar", ["-xzf", archivePath, "-C", targetDir, "--strip-components=1"]);
  symlinkSync(join("..", command, "sing-box"), linkPath);
  writeFileSync(stampPath, `${version}\n`);
}

mkdirSync(binDir, { recursive: true });
for (const binary of binaries) installBinary(binary);
