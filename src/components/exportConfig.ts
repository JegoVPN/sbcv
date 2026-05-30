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
 * W5 (M1): an official sing-box-binary error is a runtime/platform error when it depends on the host OS
 * or a build tag (e.g. "resolved service is only supported on Linux", "requires sing-box built with the
 * with_tailscale tag"). Those must NOT block a config authored for a different target OS — they stay
 * advisory. Every other official error (unknown field, parse failure, missing/invalid value) is a
 * structural rejection that holds on every platform and SHOULD block, like a semantic error.
 *
 * The alternatives are deliberately phrase-anchored, NOT bare keywords, to avoid false positives that
 * would let an INVALID config export (the dangerous direction): a bare `platform` would match the genuine
 * `tun.platform` field path embedded in a structural error, and a bare `requires …(tag)` would match a
 * structural "missing tag" rejection. "built with" already covers the build-tag (with_X) messages, and
 * platform-context is gated to "this/current platform". A missed platform phrasing merely over-blocks a
 * cross-OS config (annoying, recoverable); a missed structural error here would silently ship an invalid one.
 */
const OFFICIAL_PLATFORM_ERROR_RE =
  /(only|not) supported on|built with|unavailable on|on (linux|macos|windows|android|darwin|ios)\b|\b(this|current) platform\b/i;

export function isPlatformOfficialError(diagnostic: Diagnostic): boolean {
  return diagnostic.source === "official" && OFFICIAL_PLATFORM_ERROR_RE.test(diagnostic.message);
}

/**
 * Errors that HARD-BLOCK an export: deterministic structural problems sing-box rejects on every platform.
 * Two sources qualify — the `semantic` heuristic linter (V1 enum/type, V3 missing-tag, references, required
 * fields, version gates) and, once the official sing-box-binary check has run (W5/M1), its non-platform
 * `official` errors (the authoritative proof). Platform/OS-specific official errors are excluded (advisory)
 * so a config authored for a different target OS is never blocked here.
 */
export function blockingExportErrors(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter(
    (diagnostic) =>
      diagnostic.level === "error" &&
      (diagnostic.source === "semantic" || (diagnostic.source === "official" && !isPlatformOfficialError(diagnostic))),
  );
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
