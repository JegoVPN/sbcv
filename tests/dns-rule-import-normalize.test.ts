import { describe, expect, it } from "vitest";
import { parseConfigJson, stringifyConfig } from "../src/domain/serialization";

// A10d (A10c review follow-up): the dns-rule / route-rule normalizers ran only in the add/update
// commands, never on import. So an imported `{action:"reject",server:"x"}` dns-rule (or a
// `{action:"reject",outbound:"x"}` route-rule) kept a stale field that is invalid for that action —
// invisible on every editor surface yet still re-exported. normalizeConfig now runs the same
// normalizers on import so the stale field is scrubbed at the boundary.

function importConfig(config: unknown) {
  return parseConfigJson(JSON.stringify(config));
}

describe("A10d — dns-rule server scrubbed on import", () => {
  it("drops `server` from a reject dns-rule (action does not allow a server)", () => {
    const config = importConfig({ dns: { rules: [{ action: "reject", server: "stale" }] } });
    expect(config.dns?.rules?.[0]).not.toHaveProperty("server");
  });

  it("keeps `server` for a route dns-rule and for the implicit (no-action) route rule", () => {
    const config = importConfig({
      dns: { rules: [{ action: "route", server: "keep" }, { domain_suffix: ["x"], server: "keep-implicit" }] },
    });
    expect(config.dns?.rules?.[0]?.server).toBe("keep");
    expect(config.dns?.rules?.[1]?.server).toBe("keep-implicit");
  });

  it("keeps `server` for an evaluate dns-rule (the full allow-list on the import path)", () => {
    const config = importConfig({ dns: { rules: [{ action: "evaluate", server: "keep" }] } });
    expect(config.dns?.rules?.[0]?.server).toBe("keep");
  });

  it("does not re-export the scrubbed server", () => {
    const config = importConfig({ dns: { rules: [{ action: "reject", server: "stale" }] } });
    expect(stringifyConfig(config)).not.toContain("stale");
  });
});

describe("A10d — route-rule outbound scrubbed on import (same root cause)", () => {
  it("drops `outbound` from a reject route-rule", () => {
    const config = importConfig({ route: { rules: [{ action: "reject", outbound: "stale" }] } });
    expect(config.route?.rules?.[0]).not.toHaveProperty("outbound");
  });

  it("keeps `outbound` for a route route-rule and the implicit route rule", () => {
    const config = importConfig({
      route: { rules: [{ action: "route", outbound: "keep" }, { domain_suffix: ["x"], outbound: "keep-implicit" }] },
    });
    expect(config.route?.rules?.[0]?.outbound).toBe("keep");
    expect(config.route?.rules?.[1]?.outbound).toBe("keep-implicit");
  });

  it("keeps `outbound` for a bypass route-rule (bypass is in the allow-list)", () => {
    const config = importConfig({ route: { rules: [{ action: "bypass", outbound: "keep" }] } });
    expect(config.route?.rules?.[0]?.outbound).toBe("keep");
  });
});
