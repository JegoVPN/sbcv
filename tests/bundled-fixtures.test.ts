import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { deriveGraph } from "../src/canvas/graph";
import { validateConfig } from "../src/domain/diagnostics";
import { parseConfigJson, stringifyConfig } from "../src/domain/serialization";
import type { SingBoxChannel } from "../src/domain/types";

function fixtures(dir: string) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(dir, name));
}

function expectRoundTrip(file: string, channel: SingBoxChannel) {
  const source = readFileSync(file, "utf8");
  const parsed = parseConfigJson(source);
  const exported = stringifyConfig(parsed);
  const reparsed = parseConfigJson(exported);
  expect(reparsed).toEqual(parsed);

  const diagnostics = validateConfig(parsed, channel);
  const blocking = diagnostics.filter((d) => d.level === "error" && !d.code.startsWith("legacy-"));
  expect(blocking, `${file} produced semantic errors: ${blocking.map((d) => d.code).join(", ")}`).toEqual([]);

  const graph = deriveGraph(parsed, { positions: {} }, diagnostics);
  expect(graph.nodes.length, `${file} produced empty graph`).toBeGreaterThan(0);
}

describe("bundled stable + testing fixtures", () => {
  it("round-trips every stable fixture (import → parse → stringify → reparse → equal)", () => {
    for (const file of fixtures("fixtures/stable")) {
      expectRoundTrip(file, "stable");
    }
  });

  it("round-trips every testing fixture", () => {
    for (const file of fixtures("fixtures/testing")) {
      expectRoundTrip(file, "testing");
    }
  });
});
