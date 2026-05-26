import { describe, expect, it } from "vitest";
import {
  connectSelectorCandidate,
  createStableTunSplitConfig,
  moveRouteRule,
  renameTag,
  updateRouteRule,
} from "../src/domain/commands";
import { validateConfig } from "../src/domain/diagnostics";
import { parseConfigJson, stringifyConfig } from "../src/domain/serialization";

describe("canonical sing-box domain model", () => {
  it("round-trips stable TUN split config without layout metadata", () => {
    const config = createStableTunSplitConfig();
    const json = stringifyConfig(config);
    expect(json).toContain('"inbounds"');
    expect(json).not.toContain("positions");
    expect(parseConfigJson(json)).toEqual(config);
  });

  it("renames tags and cascades route and selector references", () => {
    const renamed = renameTag(createStableTunSplitConfig(), "proxy", "main-proxy");
    expect(renamed.route?.final).toBe("main-proxy");
    expect(renamed.outbounds?.find((item) => item.tag === "main-proxy")).toBeTruthy();
  });

  it("updates ordered route rules without using canvas edge order", () => {
    const config = createStableTunSplitConfig();
    const updated = updateRouteRule(config, 0, { domain_suffix: ["sg"], outbound: "proxy" });
    expect(updated.route?.rules?.[0]?.domain_suffix).toEqual(["sg"]);
    expect(updated.route?.rules?.[0]?.outbound).toBe("proxy");
    const moved = moveRouteRule(updated, 0, 1);
    expect(moved.route?.rules?.[1]?.domain_suffix).toEqual(["sg"]);
  });

  it("detects missing outbound references", () => {
    const config = connectSelectorCandidate(createStableTunSplitConfig(), "proxy", "missing");
    const diagnostics = validateConfig(config, "stable");
    expect(diagnostics.some((diagnostic) => diagnostic.code === "missing-outbound-candidate")).toBe(true);
  });
});
