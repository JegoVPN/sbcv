import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { blockingExportErrors, exportConfigGated } from "../src/components/exportConfig";
import type { Diagnostic, SingBoxConfig } from "../src/domain/types";

// V2 — exportConfigGated is the single hard gate. Error-level *semantic* diagnostics block the export
// outright (no bypass, nothing downloaded). Warnings allow export behind one confirm. Official/binary
// diagnostics (source !== "semantic") never block — they may carry platform/runtime errors.

const config = { outbounds: [{ type: "direct", tag: "d" }] } as unknown as SingBoxConfig;

function diag(level: Diagnostic["level"], source: Diagnostic["source"], code = "x"): Diagnostic {
  return { level, source, code, path: "/x", message: code };
}

let createObjectURL: ReturnType<typeof vi.fn>;
let original: typeof URL.createObjectURL;
let originalRevoke: typeof URL.revokeObjectURL;

beforeEach(() => {
  original = URL.createObjectURL;
  originalRevoke = URL.revokeObjectURL;
  createObjectURL = vi.fn(() => "blob:mock");
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = createObjectURL;
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  // jsdom anchors don't navigate; click is a no-op but must exist.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => {
  URL.createObjectURL = original;
  URL.revokeObjectURL = originalRevoke;
  vi.restoreAllMocks();
});

describe("V2 — blockingExportErrors", () => {
  it("counts only error-level semantic diagnostics", () => {
    const diagnostics = [
      diag("error", "semantic", "enum-invalid"),
      diag("warning", "semantic", "soft"),
      diag("error", "official", "platform"), // official errors are NOT structural blockers
    ];
    expect(blockingExportErrors(diagnostics).map((d) => d.code)).toEqual(["enum-invalid"]);
  });
});

describe("V2 — exportConfigGated", () => {
  it("blocks (no download) when a semantic error is present", () => {
    const outcome = exportConfigGated(config, [diag("error", "semantic", "duplicate-tag")]);
    expect(outcome).toEqual({ exported: false, reason: "blocked", errors: [diag("error", "semantic", "duplicate-tag")] });
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("does NOT block on an official/platform error (advisory, not structural)", () => {
    const outcome = exportConfigGated(config, [diag("error", "official", "resolved-linux-only")]);
    expect(outcome).toEqual({ exported: true });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("confirms on warnings; cancel aborts the download", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const outcome = exportConfigGated(config, [diag("warning", "semantic", "soft")]);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ exported: false, reason: "cancelled" });
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("confirms on warnings; accept downloads", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    expect(exportConfigGated(config, [diag("warning", "semantic", "soft")])).toEqual({ exported: true });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("exports a clean config with no prompt", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    expect(exportConfigGated(config, [])).toEqual({ exported: true });
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });
});
