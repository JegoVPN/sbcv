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
