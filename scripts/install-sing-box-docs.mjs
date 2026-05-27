import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const docsRoot = ".tmp/sing-box-docs";
const checkouts = [
  { branch: "stable", target: join(docsRoot, "stable") },
  { branch: "testing", target: join(docsRoot, "testing") },
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "inherit", ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function hasConfigurationDocs(target) {
  return existsSync(join(target, "docs/configuration/index.md"));
}

function installDocs({ branch, target }) {
  if (hasConfigurationDocs(target) && !process.env.FORCE_INSTALL_SING_BOX_DOCS) {
    console.log(`sing-box ${branch} configuration docs already installed`);
    return;
  }

  rmSync(target, { recursive: true, force: true });
  console.log(`Installing sing-box ${branch} configuration docs`);
  run("git", [
    "clone",
    "--depth",
    "1",
    "--branch",
    branch,
    "--filter=blob:none",
    "--sparse",
    "https://github.com/SagerNet/sing-box.git",
    target,
  ]);
  run("git", ["-C", target, "sparse-checkout", "set", "docs/configuration"]);
}

for (const checkout of checkouts) installDocs(checkout);
