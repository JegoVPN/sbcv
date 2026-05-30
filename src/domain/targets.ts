import type { SingBoxBinaryName, SingBoxChannel, SingBoxTargetId } from "./types";

export type SingBoxTargetOption = {
  id: SingBoxTargetId;
  label: string;
  channel: SingBoxChannel;
  version: string;
  binaryName: SingBoxBinaryName;
};

export const SING_BOX_TARGETS: SingBoxTargetOption[] = [
  { id: "1.13-stable", label: "1.13 stable", channel: "stable", version: "1.13", binaryName: "sing-box-stable" },
  { id: "1.12-stable", label: "1.12 Legacy", channel: "stable", version: "1.12", binaryName: "sing-box-1.12" },
  { id: "1.14-testing", label: "1.14 testing", channel: "testing", version: "1.14", binaryName: "sing-box-testing" },
];

export function targetFromVersion(channel: SingBoxChannel, version: string): SingBoxTargetOption {
  const target =
    SING_BOX_TARGETS.find((target) => target.channel === channel && target.version === version) ??
    SING_BOX_TARGETS.find((target) => target.channel === channel) ??
    SING_BOX_TARGETS[0];
  if (!target) throw new Error("No sing-box targets are configured.");
  return target;
}

export function targetById(id: SingBoxTargetId): SingBoxTargetOption {
  const target = SING_BOX_TARGETS.find((item) => item.id === id);
  if (!target) throw new Error(`Unknown sing-box target: ${id}`);
  return target;
}

// The default version when a channel (Stable / Testing) is selected — the NEWEST configured target on
// that channel. SING_BOX_TARGETS is the single place the concrete version numbers live, so an upstream
// release is a one-line edit there and every channel→version default (store setChannel, diagnostics
// default) follows. The labels (stable/testing/legacy) stay constant; only the numbers move.
export function defaultVersionForChannel(channel: SingBoxChannel): string {
  const onChannel = SING_BOX_TARGETS.filter((target) => target.channel === channel);
  if (onChannel.length === 0) throw new Error(`No sing-box target configured for channel "${channel}".`);
  return onChannel.reduce((newest, target) => (compareVersions(target.version, newest.version) > 0 ? target : newest)).version;
}

// Dotted numeric version compare (no semver dep): compareVersions("1.13","1.12") > 0.
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// True when `version` is at least `min` (e.g. atLeast("1.13","1.13") === true).
export function atLeast(version: string, min: string): boolean {
  return compareVersions(version, min) >= 0;
}
