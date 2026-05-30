import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { blockingExportErrors, exportConfigGated } from "../src/components/exportConfig";
import type { Diagnostic, SingBoxConfig } from "../src/domain/types";

// V2 — exportConfigGated is the single hard gate. Error-level *semantic* diagnostics block the export
// outright (no bypass, nothing downloaded). Warnings allow export behind one confirm. W5: official-binary
// errors now block too WHEN STRUCTURAL (unknown field / parse / missing); platform/OS-specific official
// errors (classified by message) stay advisory so a config authored for another target OS isn't blocked.

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
  it("counts semantic errors + structural official errors; excludes platform official errors and warnings", () => {
    const diagnostics = [
      diag("error", "semantic", "enum-invalid"),
      diag("warning", "semantic", "soft"),
      diag("error", "official", "only supported on Linux"), // platform → advisory (message-classified)
      diag("error", "official", 'json: unknown field "x"'), // structural → blocks (W5)
    ];
    expect(blockingExportErrors(diagnostics).map((d) => d.code).sort()).toEqual(['json: unknown field "x"', "enum-invalid"].sort());
  });
});

describe("V2 — exportConfigGated", () => {
  it("blocks (no download) when a semantic error is present", () => {
    const outcome = exportConfigGated(config, [diag("error", "semantic", "duplicate-tag")]);
    expect(outcome).toEqual({ exported: false, reason: "blocked", errors: [diag("error", "semantic", "duplicate-tag")] });
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("does NOT block on an official PLATFORM error (advisory, not structural)", () => {
    const outcome = exportConfigGated(config, [diag("error", "official", "resolved service is only supported on Linux")]);
    expect(outcome).toEqual({ exported: true });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("W5: blocks on a STRUCTURAL official error (unknown field — proof the binary rejects it)", () => {
    const structural = diag("error", "official", 'json: unknown field "frob"');
    const outcome = exportConfigGated(config, [structural]);
    expect(outcome).toEqual({ exported: false, reason: "blocked", errors: [structural] });
    expect(createObjectURL).not.toHaveBeenCalled();
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
