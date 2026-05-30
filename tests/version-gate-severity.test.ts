import { describe, expect, it } from "vitest";

import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxConfig } from "../src/domain/types";

// V4-S1 — testing-only sections that sing-box-stable REJECTS at decode are error-level on a stable
// target (verified against the real binary: "unknown field http_clients" / "unknown field
// certificate_providers" / "unknown inbound type: cloudflared"), so they feed the V2 export hard gate
// — aligning with naive / ccm-ocm / hysteria-realm. On the testing target they are valid (no error).

function codes(config: SingBoxConfig, channel: "stable" | "testing") {
  return new Set(validateConfig(config, channel).filter((d) => d.level === "error").map((d) => d.code));
}

describe("V4-S1 — testing-only sections are errors on stable", () => {
  it("cloudflared inbound errors on stable, ok on testing", () => {
    const config = { inbounds: [{ type: "cloudflared", tag: "cf", token: "x" }] } as unknown as SingBoxConfig;
    expect(codes(config, "stable").has("inbound-cloudflared-testing-only")).toBe(true);
    expect(codes(config, "testing").has("inbound-cloudflared-testing-only")).toBe(false);
  });

  it("top-level certificate_providers errors on stable, ok on testing", () => {
    const config = {
      certificate_providers: [{ type: "dnsimple", tag: "cp", api_access_token: "x" }],
    } as unknown as SingBoxConfig;
    expect(codes(config, "stable").has("stable-version-gated-certificate-providers")).toBe(true);
    expect(codes(config, "testing").has("stable-version-gated-certificate-providers")).toBe(false);
  });

  it("http_clients errors on stable, ok on testing", () => {
    const config = { http_clients: [{ tag: "hc" }] } as unknown as SingBoxConfig;
    expect(codes(config, "stable").has("stable-version-gated-http-clients")).toBe(true);
    expect(codes(config, "testing").has("stable-version-gated-http-clients")).toBe(false);
  });
});

describe("V4-S3 — removed-type outbounds are errors (sing-box rejects by default)", () => {
  it("legacy dns / wireguard outbounds error on every target; block stays a warning", () => {
    const dnsOut = { outbounds: [{ type: "dns", tag: "d" }] } as unknown as SingBoxConfig;
    const wgOut = { outbounds: [{ type: "wireguard", tag: "w" }] } as unknown as SingBoxConfig;
    const blockOut = { outbounds: [{ type: "block", tag: "b" }] } as unknown as SingBoxConfig;
    for (const channel of ["stable", "testing"] as const) {
      expect(codes(dnsOut, channel).has("outbound-dns-legacy-deprecated")).toBe(true);
      expect(codes(wgOut, channel).has("outbound-wireguard-legacy-deprecated")).toBe(true);
      // block is accepted by sing-box (1.12 + 1.13) — must NOT be an export-blocking error.
      expect(validateConfig(blockOut, channel).find((d) => d.code === "outbound-block-deprecated")?.level).toBe("warning");
    }
  });
});
