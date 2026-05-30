import { describe, expect, it } from "vitest";

import { blockingExportErrors, isPlatformOfficialError } from "../src/components/exportConfig";
import type { Diagnostic } from "../src/domain/types";

// W5 (re-run#3 M1): the official sing-box-binary check is escalated from advisory to an authoritative
// pre-export gate — its STRUCTURAL errors now hard-block export (proof of validity), while platform/OS-
// specific official errors stay advisory so a config authored for another target OS is never blocked.

const d = (over: Partial<Diagnostic>): Diagnostic =>
  ({ level: "error", code: "x", path: "", message: "", source: "semantic", ...over });

describe("W5 — official-check authoritative export gate", () => {
  it("classifies platform/OS/build-tag official errors as advisory (not blocking)", () => {
    for (const message of [
      "resolved service is only supported on Linux",
      "tun is not supported on this platform",
      "endpoint tailscale requires sing-box built with the with_tailscale tag",
      "naive outbound requires libcronet on Linux builds",
    ]) {
      expect(isPlatformOfficialError(d({ source: "official", message }))).toBe(true);
    }
  });

  it("treats structural official errors (unknown field, parse, missing) as NOT platform", () => {
    for (const message of [
      'json: unknown field "frobnicate"',
      "missing password",
      "invalid uuid: incorrect UUID length",
      // regression (W5 review): a structural error on the genuine `tun.platform` field path must NOT be
      // mis-classed as platform-advisory (a bare `platform` keyword would have let this invalid config out).
      'inbounds[0].tun.platform.http_proxy: json: unknown field "foo"',
      // and a structural "missing tag" rejection must not be swallowed by a build-tag pattern.
      "rule_set entry requires a tag",
    ]) {
      expect(isPlatformOfficialError(d({ source: "official", message }))).toBe(false);
    }
  });

  it("blocks export on a structural official error, but NOT on a platform official error", () => {
    const structural = blockingExportErrors([d({ source: "official", message: 'json: unknown field "x"' })]);
    expect(structural).toHaveLength(1);
    const platform = blockingExportErrors([d({ source: "official", message: "only supported on Linux" })]);
    expect(platform).toHaveLength(0);
  });

  it("still blocks semantic errors and ignores official/semantic warnings", () => {
    expect(blockingExportErrors([d({ source: "semantic", level: "error" })])).toHaveLength(1);
    expect(blockingExportErrors([d({ source: "official", level: "warning", message: "x" })])).toHaveLength(0);
    expect(blockingExportErrors([d({ source: "semantic", level: "warning" })])).toHaveLength(0);
  });
});
