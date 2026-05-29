import { createConfigExport } from "../domain/serialization";
import type { Diagnostic, SingBoxConfig } from "../domain/types";

function padTimestampPart(value: number) {
  return value.toString().padStart(2, "0");
}

export function createSbcvFileName(now = new Date()) {
  const date = `${now.getFullYear()}${padTimestampPart(now.getMonth() + 1)}${padTimestampPart(now.getDate())}`;
  const time = `${padTimestampPart(now.getHours())}${padTimestampPart(now.getMinutes())}${padTimestampPart(now.getSeconds())}`;
  return `sbcv_${date}_${time}.json`;
}

/**
 * The single export path for both the desktop (TopBar) and mobile (MobileMenuSheet) entry points.
 * Gates on error-level *semantic* diagnostics (recomputed synchronously, never cleared mid-flight —
 * unlike official/binary diagnostics), prompts once on errors, and on confirm streams the pruned
 * config to a download. Returns whether the export actually proceeded (false = user cancelled), so
 * callers can react (e.g. the mobile sheet only closes on a proceeded export).
 */
export function confirmAndExportConfig(config: SingBoxConfig, diagnostics: Diagnostic[]): boolean {
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.level === "error").length;
  if (errorCount > 0) {
    const proceed = window.confirm(
      `This config has ${errorCount} error${errorCount === 1 ? "" : "s"} that sing-box may reject. Export anyway?`,
    );
    if (!proceed) return false;
  }
  const exportedConfig = createConfigExport(config);
  const blob = new Blob([exportedConfig.contents], { type: exportedConfig.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = createSbcvFileName();
  link.click();
  URL.revokeObjectURL(url);
  return true;
}
