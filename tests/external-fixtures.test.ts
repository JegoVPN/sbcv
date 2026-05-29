import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deriveGraph } from "../src/canvas/graph";
import { validateConfig } from "../src/domain/diagnostics";
import { createConfigExport, parseConfigJson, stringifyConfig } from "../src/domain/serialization";
import type { SingBoxChannel } from "../src/domain/types";

type ExternalFixtureManifestEntry = {
  id: string;
  fixture_path: string;
  channel: SingBoxChannel;
  counts_toward_200: boolean;
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("external sing-box fixture corpus", () => {
  it("imports, validates, derives graph, round-trips, and exports every accepted fixture", () => {
    const manifest = readJson<ExternalFixtureManifestEntry[]>("fixtures/external/manifest.json").filter(
      (item) => item.counts_toward_200,
    );
    const failures: string[] = [];

    expect(manifest.length).toBeGreaterThanOrEqual(200);

    for (const item of manifest) {
      try {
        const sourceJson = readFileSync(item.fixture_path, "utf8");
        const config = parseConfigJson(sourceJson);
        const diagnostics = validateConfig(config, item.channel);
        const graph = deriveGraph(config, { positions: {} }, diagnostics);
        const roundTrip = parseConfigJson(stringifyConfig(config));
        const exportedConfig = createConfigExport(config);
        const exportedRoundTrip = parseConfigJson(exportedConfig.contents);

        if (graph.nodes.length === 0) {
          throw new Error("derived graph has no nodes");
        }
        expect(roundTrip).toEqual(config);
        expect(exportedConfig.fileName).toBe("config.json");
        expect(exportedConfig.mimeType).toBe("application/json");
        // The download prunes inert empty-string/array noise (L4-export-noise), so it is intentionally
        // NOT byte-identical to the imported config. Instead assert the D7 guarantee: cleaning changes
        // no meaning (re-imported export yields the same diagnostics) and is idempotent (re-export is
        // byte-stable — no progressive loss).
        expect(validateConfig(exportedRoundTrip, item.channel)).toEqual(diagnostics);
        expect(createConfigExport(exportedRoundTrip).contents).toBe(exportedConfig.contents);
      } catch (error) {
        failures.push(`${item.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    expect(failures).toEqual([]);
  });
});
