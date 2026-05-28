import { describe, expect, it } from "vitest";
import { parseConfigJson } from "../src/domain/serialization";

// A16-norm (A16 review follow-up): A16 made route.default_network_type /
// default_fallback_network_type an array shape (`string[]`), but a legacy/pre-release config carrying
// the raw-string form (`default_network_type: "tcp"`) imported a bare string into a `string[]`-typed
// field — a type-lie that strands silently in the list control and risks `.length`/`.includes` bugs on
// the string elsewhere. normalizeConfig now coerces the raw string to a single-element array at import.

function importConfig(config: unknown) {
  return parseConfigJson(JSON.stringify(config));
}

describe("A16-norm — route network-type list fields normalized on import", () => {
  it("coerces a raw-string default_network_type to a single-element array", () => {
    const config = importConfig({ route: { default_network_type: "tcp" } });
    expect(config.route?.default_network_type).toEqual(["tcp"]);
  });

  it("coerces a raw-string default_fallback_network_type to a single-element array", () => {
    const config = importConfig({ route: { default_fallback_network_type: "wifi" } });
    expect(config.route?.default_fallback_network_type).toEqual(["wifi"]);
  });

  it("drops an empty-string value to an empty array (no `[\"\"]` noise)", () => {
    const config = importConfig({ route: { default_network_type: "" } });
    expect(config.route?.default_network_type).toEqual([]);
  });

  it("leaves an already-array value untouched", () => {
    const config = importConfig({ route: { default_network_type: ["tcp", "wifi"] } });
    expect(config.route?.default_network_type).toEqual(["tcp", "wifi"]);
  });

  it("only touches strings — a non-string value passes through unchanged (strings-only contract)", () => {
    const config = importConfig({ route: { default_network_type: ["tcp", 1] } });
    expect(config.route?.default_network_type).toEqual(["tcp", 1]);
  });

  it("leaves a route with no network-type fields alone", () => {
    const config = importConfig({ route: { final: "direct" } });
    expect(config.route?.default_network_type).toBeUndefined();
    expect(config.route?.final).toBe("direct");
  });
});
