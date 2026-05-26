import type { SingBoxChannel, SingBoxTargetId } from "./types";

export type SingBoxTargetOption = {
  id: SingBoxTargetId;
  label: string;
  channel: SingBoxChannel;
  version: string;
};

export const SING_BOX_TARGETS: SingBoxTargetOption[] = [
  { id: "1.13-stable", label: "1.13 stable", channel: "stable", version: "1.13" },
  { id: "1.12-stable", label: "1.12 Legacy", channel: "stable", version: "1.12" },
  { id: "1.14-testing", label: "1.14 testing", channel: "testing", version: "1.14" },
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
