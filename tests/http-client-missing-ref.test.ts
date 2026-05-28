import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxConfig } from "../src/domain/types";

// A22-diag (C1-20): a string `http_client` reference (route.default_http_client / rule-set http_client)
// must point to an existing top-level http_clients[] tag, else flag a dangling reference.

function errorCodes(config: SingBoxConfig) {
  return validateConfig(config, "testing").filter((d) => d.level === "error").map((d) => d.code);
}

describe("A22 — http_client dangling-reference diagnostic (C1-20)", () => {
  it("flags route.default_http_client pointing at a missing http_clients tag", () => {
    const config = { route: { default_http_client: "ghost" } } as unknown as SingBoxConfig;
    expect(errorCodes(config)).toContain("missing-http-client");
  });

  it("flags a rule-set http_client pointing at a missing tag", () => {
    const config = {
      route: { rule_set: [{ type: "remote", tag: "rs", url: "https://e.x/r.srs", format: "binary", http_client: "ghost" }] },
    } as unknown as SingBoxConfig;
    expect(errorCodes(config)).toContain("missing-http-client");
  });

  it("does not flag a reference that resolves to an existing http_clients entry", () => {
    const config = {
      http_clients: [{ tag: "hc" }],
      route: { default_http_client: "hc", rule_set: [{ type: "remote", tag: "rs", url: "https://e.x/r.srs", format: "binary", http_client: "hc" }] },
    } as unknown as SingBoxConfig;
    expect(errorCodes(config)).not.toContain("missing-http-client");
  });

  it("flags a certificate_providers http_client pointing at a missing tag", () => {
    const config = {
      certificate_providers: [{ type: "acme", tag: "cp", http_client: "ghost" }],
    } as unknown as SingBoxConfig;
    expect(errorCodes(config)).toContain("missing-http-client");
  });

  it("does not flag an inline object-form http_client (no tag)", () => {
    const config = {
      route: { rule_set: [{ type: "remote", tag: "rs", url: "https://e.x/r.srs", format: "binary", http_client: { detour: "out" } }] },
      outbounds: [{ type: "direct", tag: "out" }],
    } as unknown as SingBoxConfig;
    expect(errorCodes(config)).not.toContain("missing-http-client");
  });
});
