import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";

const toolsDir = ".tools";
const binDir = join(toolsDir, "bin");

const binaries = [
  { command: "sing-box-1.11", version: "1.11.15" },
  { command: "sing-box-1.12", version: "1.12.25" },
  { command: "sing-box-stable", version: "1.13.12" },
  { command: "sing-box-testing", version: "1.14.0-alpha.25" },
];

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
  run("curl", ["-L", url, "-o", archivePath]);
  run("tar", ["-xzf", archivePath, "-C", targetDir, "--strip-components=1"]);
  symlinkSync(join("..", command, "sing-box"), linkPath);
}

mkdirSync(binDir, { recursive: true });
for (const binary of binaries) installBinary(binary);

