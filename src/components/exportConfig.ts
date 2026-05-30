import { createConfigExport, createProjectExport } from "../domain/serialization";
import type { Diagnostic, SbcProject, SingBoxConfig } from "../domain/types";

function padTimestampPart(value: number) {
  return value.toString().padStart(2, "0");
}

export function createSbcvFileName(now = new Date()) {
  const date = `${now.getFullYear()}${padTimestampPart(now.getMonth() + 1)}${padTimestampPart(now.getDate())}`;
  const time = `${padTimestampPart(now.getHours())}${padTimestampPart(now.getMinutes())}${padTimestampPart(now.getSeconds())}`;
  return `sbcv_${date}_${time}.json`;
}

function downloadBlob(contents: string, mimeType: string, fileName: string): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

// Download the project wrapper (C16): config + layout + channel/version as `*.sbcv.json`. Unlike the
// config Export, this is NOT diagnostics-gated (saving a draft project is always allowed) and carries
// the `kind:"sbcv-project"` discriminator so it's never confused with a plain sing-box config.
export function downloadProject(project: SbcProject): void {
  const exported = createProjectExport(project);
  downloadBlob(exported.contents, exported.mimeType, createSbcvFileName().replace(/\.json$/, ".sbcv.json"));
}

/**
 * Error-level *semantic* diagnostics — the deterministic, platform-independent structural problems
 * (V1 enum/type, V3 missing-tag, references, duplicate tags, required fields, version gates). These are
 * what hard-block an export: a config with any of them is structurally invalid and sing-box would reject
 * it on every platform. Official/binary-check diagnostics are excluded here — they may carry runtime/
 * platform errors (e.g. "resolved service is only supported on Linux") that are environment-dependent
 * and must not block a config authored for a different target OS (advisory layer handles those).
 */
export function blockingExportErrors(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.level === "error" && diagnostic.source === "semantic");
}

export type ExportOutcome =
  | { exported: true }
  /** Hard-blocked: structurally-invalid config can never be exported (no bypass). */
  | { exported: false; reason: "blocked"; errors: Diagnostic[] }
  /** User declined the (warnings-only) confirmation. */
  | { exported: false; reason: "cancelled" };

/**
 * The single export path for both the desktop (TopBar) and mobile (MobileMenuSheet) entry points (V2).
 *
 * HARD GATE: when there are error-level semantic diagnostics the config is structurally invalid and the
 * export is *blocked outright* — no bypassable confirm, nothing is downloaded. This makes "you cannot
 * export a structurally-invalid config" a hard guarantee. Warnings still allow export behind a one-time
 * confirm. The UI additionally disables the Export button while blocked, so this function is the
 * belt-and-suspenders backstop (programmatic / keyboard paths can't slip an invalid config through).
 */
export function exportConfigGated(config: SingBoxConfig, diagnostics: Diagnostic[]): ExportOutcome {
  const errors = blockingExportErrors(diagnostics);
  if (errors.length > 0) return { exported: false, reason: "blocked", errors };

  const warnings = diagnostics.filter(
    (diagnostic) => diagnostic.level === "warning" && diagnostic.source === "semantic",
  );
  if (warnings.length > 0) {
    const proceed = window.confirm(
      `This config has ${warnings.length} warning${warnings.length === 1 ? "" : "s"} that sing-box may flag. Export anyway?`,
    );
    if (!proceed) return { exported: false, reason: "cancelled" };
  }

  const exportedConfig = createConfigExport(config);
  downloadBlob(exportedConfig.contents, exportedConfig.mimeType, createSbcvFileName());
  return { exported: true };
}
