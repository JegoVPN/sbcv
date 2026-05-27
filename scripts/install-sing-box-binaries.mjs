import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";

const toolsDir = ".tools";
const binDir = join(toolsDir, "bin");

const binaries = [
  { command: "sing-box-1.12", version: "1.12.25" },
  { command: "sing-box-stable", version: "1.13.12" },
  { command: "sing-box-testing", version: "1.14.0-alpha.25" },
];

// Pinned SHA256 sums for sing-box release tarballs. Keep in sync with
// container/scripts/install-binaries.sh. To bump a version: download the
// new tarball, run `shasum -a 256`, update both files.
const CHECKSUMS = {
  "1.12.25-linux-amd64":         "a1ec76e2b6b139eb747a1b1ebee7d14b8d4be5a833596cad8070a31ef960301f",
  "1.12.25-darwin-arm64":        "a4a06d507f3f4d951490168d1372fce4c02db7211e88af9da13f93ed98068d5e",
  "1.13.12-linux-amd64":         "1540533adb3df24f5ad5f14b5c7ca3dbc2401b10a1c1eb278fcadcada47ec6c4",
  "1.13.12-darwin-arm64":        "43eef86f0ea4a79c3696974f397a963c46a457ee46d1ffac9aa913944a5fc986",
  "1.14.0-alpha.25-linux-amd64": "70f3b299b817e76920ef3c733ee899e460d00bc286611cf72c1f86696b2006b4",
  "1.14.0-alpha.25-darwin-arm64":"ec73bf3a7d61760a22ee1e13731da101403fa034aa0b86b8782d4a4002cae359",
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

  if (existsSync(linkPath) && existsSync(binaryPath) && !process.env.FORCE_INSTALL_SING_BOX) {
    console.log(`${command} already installed`);
    return;
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
}

mkdirSync(binDir, { recursive: true });
for (const binary of binaries) installBinary(binary);
