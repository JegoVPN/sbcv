import { describe, expect, it } from "vitest";

import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxConfig } from "../src/domain/types";

// V3 — entity-missing-tag. sing-box `check` rejects a MISSING tag only for rule_set
// ("route.rule_set[0]: missing tag") and http_clients ("missing http client tag"); tagless
// inbounds/outbounds/dns-servers/endpoints/cert-providers are accepted (real-world configs omit them).
// So the error is scoped to exactly the two kinds sing-box rejects — anything broader would block a
// valid export and contradict the done-bar ("保证能过 sing-box check").

const ruleSet = (rs: Record<string, unknown>): SingBoxConfig =>
  ({ route: { rule_set: [rs] } }) as unknown as SingBoxConfig;
const httpClients = (hc: Record<string, unknown>): SingBoxConfig =>
  ({ http_clients: [hc] }) as unknown as SingBoxConfig;

function missingTag(config: SingBoxConfig, channel: "stable" | "testing" = "testing") {
  return validateConfig(config, channel).filter((d) => d.code === "entity-missing-tag");
}

describe("V3 — entity-missing-tag (sing-box-required kinds only)", () => {
  it("flags a rule_set missing its tag, error-level, pathed /route/rule_set/<i>/tag", () => {
    const diags = missingTag(ruleSet({ type: "remote", format: "binary", url: "https://x/y.srs" }));
    expect(diags).toHaveLength(1);
    expect(diags[0]!.level).toBe("error");
    expect(diags[0]!.path).toBe("/route/rule_set/0/tag");
    expect(diags[0]!.source).toBe("semantic");
  });

  it("flags an empty / whitespace rule_set tag", () => {
    expect(missingTag(ruleSet({ type: "local", tag: "", format: "source", path: "./r.json" }))).toHaveLength(1);
    expect(missingTag(ruleSet({ type: "local", tag: "   ", format: "source", path: "./r.json" }))).toHaveLength(1);
  });

  it("flags an http_client missing its tag, pathed /http_clients/<i>/tag", () => {
    const diags = missingTag(httpClients({}));
    expect(diags).toHaveLength(1);
    expect(diags[0]!.path).toBe("/http_clients/0/tag");
  });

  it("does NOT flag a tagged rule_set / http_client", () => {
    expect(missingTag(ruleSet({ type: "local", tag: "rs", format: "source", path: "./r.json" }))).toEqual([]);
    expect(missingTag(httpClients({ tag: "hc" }))).toEqual([]);
  });

  it("does NOT flag tagless inbounds/outbounds/dns-servers (sing-box accepts these)", () => {
    const config = {
      inbounds: [{ type: "mixed", listen: "127.0.0.1", listen_port: 2080 }],
      outbounds: [{ type: "direct" }],
      dns: { servers: [{ type: "udp", server: "8.8.8.8" }] },
    } as unknown as SingBoxConfig;
    expect(missingTag(config)).toEqual([]);
  });
});
