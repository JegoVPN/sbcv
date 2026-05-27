export type SbcTarget = "1.12 Legacy" | "1.13 stable" | "1.14 testing";

export const SUPPORTED_TARGETS: readonly SbcTarget[] = [
  "1.12 Legacy",
  "1.13 stable",
  "1.14 testing",
];

export function isValidTarget(value: unknown): value is SbcTarget {
  return typeof value === "string" && (SUPPORTED_TARGETS as readonly string[]).includes(value);
}
