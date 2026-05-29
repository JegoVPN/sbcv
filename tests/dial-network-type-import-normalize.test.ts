import { describe, expect, it } from "vitest";
import { parseConfigJson } from "../src/domain/serialization";

// L4-dial-network-type (A16-norm-rest): A16-norm coerced the ROUTE default_network_type /
// default_fallback_network_type from a legacy raw string to a single-element array on import. The
// dial-group siblings on outbounds/endpoints — network_type / fallback_network_type — have the same
// legacy-string strand (they render through the same `kind:"list"` control). normalizeConfig now
// coerces those too, at the import boundary.

function importConfig(config: unknown) {
  return parseConfigJson(JSON.stringify(config));
}

describe("L4-dial-network-type — dial network-type list fields normalized on import", () => {
  it("coerces a raw-string network_type on an outbound", () => {
    const config = importConfig({ outbounds: [{ type: "direct", tag: "d", network_type: "tcp" }] });
    expect((config.outbounds?.[0] as Record<string, unknown>).network_type).toEqual(["tcp"]);
  });

  it("coerces a raw-string fallback_network_type on an outbound", () => {
    const config = importConfig({ outbounds: [{ type: "direct", tag: "d", fallback_network_type: "wifi" }] });
    expect((config.outbounds?.[0] as Record<string, unknown>).fallback_network_type).toEqual(["wifi"]);
  });

  it("coerces a raw-string network_type on an endpoint", () => {
    const config = importConfig({ endpoints: [{ type: "wireguard", tag: "e", network_type: "tcp" }] });
    expect((config.endpoints?.[0] as Record<string, unknown>).network_type).toEqual(["tcp"]);
  });

  it("drops an empty string to an empty array and leaves arrays / non-strings untouched", () => {
    const config = importConfig({
      outbounds: [
        { type: "direct", tag: "a", network_type: "" },
        { type: "direct", tag: "b", network_type: ["tcp", "wifi"] },
        { type: "direct", tag: "c", network_type: ["tcp", 1] },
      ],
    });
    expect((config.outbounds?.[0] as Record<string, unknown>).network_type).toEqual([]);
    expect((config.outbounds?.[1] as Record<string, unknown>).network_type).toEqual(["tcp", "wifi"]);
    expect((config.outbounds?.[2] as Record<string, unknown>).network_type).toEqual(["tcp", 1]);
  });

  it("still coerces the route defaults (A16-norm regression guard)", () => {
    const config = importConfig({ route: { default_network_type: "tcp" } });
    expect(config.route?.default_network_type).toEqual(["tcp"]);
  });
});
