import { describe, expect, it } from "vitest";

import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxConfig } from "../src/domain/types";

// W3 (re-run#3 M4/M5): three version-gate holes that let a lint-clean config be rejected by the
// selected-version binary, each binary-verified:
//  M4 — field-level `since` is now enforced (naive inbound quic_congestion_control, since 1.13, on 1.12)
//  M5 — the 1.14-only `mdns` DNS-server type is now gated (was ungated)
//  certificate.store="chrome" is now a hard error (not a bypassable warning) on 1.12.

const errorCodes = (config: SingBoxConfig, channel: "stable" | "testing", version?: string) =>
  new Set(validateConfig(config, channel, version).filter((d) => d.level === "error").map((d) => d.code));

describe("W3 — version-gate completeness", () => {
  it("M4: field-level since — naive quic_congestion_control (1.13) errors on a 1.12 target", () => {
    const naive = {
      inbounds: [{ type: "naive", tag: "n", listen: "::", listen_port: 443, quic_congestion_control: "bbr" }],
    } as unknown as SingBoxConfig;
    expect(errorCodes(naive, "stable", "1.12").has("version-invalid")).toBe(true);
    // clean on 1.13+ (the field is valid there)
    expect(errorCodes(naive, "stable", "1.13").has("version-invalid")).toBe(false);
  });

  it("M5: mdns DNS-server (1.14-only) errors on 1.12/1.13, clean on 1.14", () => {
    const mdns = { dns: { servers: [{ type: "mdns", tag: "m" }] } } as unknown as SingBoxConfig;
    expect(errorCodes(mdns, "stable", "1.13").has("dns-server-version")).toBe(true);
    expect(errorCodes(mdns, "stable", "1.12").has("dns-server-version")).toBe(true);
    expect(errorCodes(mdns, "testing", "1.14").has("dns-server-version")).toBe(false);
  });

  it("certificate.store=chrome is a hard error on 1.12 (was a bypassable warning)", () => {
    const cfg = { certificate: { store: "chrome" } } as unknown as SingBoxConfig;
    const diags = validateConfig(cfg, "stable", "1.12");
    const chrome = diags.find((d) => d.code === "settings-certificate-store-chrome-testing-only");
    expect(chrome?.level).toBe("error");
    // clean on 1.13+
    expect(validateConfig(cfg, "stable", "1.13").some((d) => d.code === "settings-certificate-store-chrome-testing-only")).toBe(false);
  });
});
