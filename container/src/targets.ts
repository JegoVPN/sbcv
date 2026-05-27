import { join } from "node:path";

export type SbcTarget = "1.12 Legacy" | "1.13 stable" | "1.14 testing";

export interface TargetSpec {
  target: SbcTarget;
  binary: string;
  binaryPath: string;
}

const BIN_DIR = process.env.BIN_DIR ?? "/app/bin";

const SPECS: Record<SbcTarget, TargetSpec> = {
  "1.12 Legacy": {
    target: "1.12 Legacy",
    binary: "sing-box-1.12",
    binaryPath: join(BIN_DIR, "sing-box-1.12"),
  },
  "1.13 stable": {
    target: "1.13 stable",
    binary: "sing-box-stable",
    binaryPath: join(BIN_DIR, "sing-box-stable"),
  },
  "1.14 testing": {
    target: "1.14 testing",
    binary: "sing-box-testing",
    binaryPath: join(BIN_DIR, "sing-box-testing"),
  },
};

export const SUPPORTED_TARGETS: readonly SbcTarget[] = Object.keys(SPECS) as SbcTarget[];

export function isValidTarget(value: unknown): value is SbcTarget {
  return typeof value === "string" && value in SPECS;
}

export function resolveTarget(target: SbcTarget): TargetSpec {
  return SPECS[target];
}
