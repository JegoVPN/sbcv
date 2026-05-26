import { readFileSync } from "node:fs";
import { createElement } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { deriveGraph } from "../src/canvas/graph";
import type { SbcFlowNode } from "../src/canvas/graph";
import { validateConfig } from "../src/domain/diagnostics";
import { createConfigExport, parseConfigJson } from "../src/domain/serialization";
import type { Diagnostic, SingBoxChannel, SingBoxConfig } from "../src/domain/types";
import { useProjectStore } from "../src/state/useProjectStore";

type ExternalFixtureManifestEntry = {
  id: string;
  fixture_path: string;
  channel: SingBoxChannel;
  counts_toward_200: boolean;
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function selectInspectableNodeId(config: SingBoxConfig, nodes: SbcFlowNode[]): string | null {
  if (config.route && nodes.some((node) => node.id === "route:main")) return "route:main";
  if (config.dns && nodes.some((node) => node.id === "dns:main")) return "dns:main";
  const taggedNode = nodes.find((node) => {
    const ref = node.data.ref;
    if (ref.kind === "inbound") return config.inbounds?.some((item) => item.tag === ref.tag);
    if (ref.kind === "outbound") return config.outbounds?.some((item) => item.tag === ref.tag);
    if (ref.kind === "dns-server") return config.dns?.servers?.some((item) => item.tag === ref.tag);
    return ref.kind === "route-rule" || ref.kind === "dns-rule";
  });
  return taggedNode?.id ?? nodes[0]?.id ?? null;
}

function loadFixtureIntoStore(
  id: string,
  channel: SingBoxChannel,
  config: SingBoxConfig,
  diagnostics: Diagnostic[],
  selectedId: string | null,
) {
  useProjectStore.setState({
    channel,
    version: channel,
    config,
    layout: { positions: {} },
    selectedId,
    jsonDraft: createConfigExport(config).contents,
    diagnostics,
    officialValidationMessage: `External fixture render gate: ${id}`,
  });
}

function shardManifest(manifest: ExternalFixtureManifestEntry[]) {
  const shardIndex = Number(process.env.EXTERNAL_RENDER_SHARD_INDEX ?? 0);
  const shardCount = Number(process.env.EXTERNAL_RENDER_SHARD_COUNT ?? 1);
  if (!Number.isInteger(shardIndex) || !Number.isInteger(shardCount) || shardCount < 1) {
    throw new Error("Invalid external render shard environment.");
  }
  if (shardIndex < 0 || shardIndex >= shardCount) {
    throw new Error(`Invalid external render shard index ${shardIndex} of ${shardCount}.`);
  }
  return manifest.filter((_, index) => index % shardCount === shardIndex);
}

describe("external sing-box fixture render gate", () => {
  it("renders the assigned accepted fixture shard through the app surfaces", () => {
    const manifest = shardManifest(
      readJson<ExternalFixtureManifestEntry[]>("fixtures/external/manifest.json").filter(
        (item) => item.counts_toward_200,
      ),
    );
    const failures: string[] = [];

    expect(manifest.length).toBeGreaterThan(0);

    for (const item of manifest) {
      try {
        const config = parseConfigJson(readFileSync(item.fixture_path, "utf8"));
        const diagnostics = validateConfig(config, item.channel);
        const graph = deriveGraph(config, { positions: {} }, diagnostics);
        const selectedId = selectInspectableNodeId(config, graph.nodes);

        if (graph.nodes.length === 0) {
          throw new Error("derived graph has no nodes");
        }

        loadFixtureIntoStore(item.id, item.channel, config, diagnostics, selectedId);
        render(createElement(App));
        expect(screen.getByLabelText("SBC visual canvas")).toBeInTheDocument();
        expect(screen.getByLabelText("Node inspector")).toBeInTheDocument();
        if (selectedId) {
          expect(screen.getByTestId(`node-${selectedId}`)).toBeInTheDocument();
        }
        cleanup();

        if (config.route) {
          loadFixtureIntoStore(item.id, item.channel, config, diagnostics, "route:main");
          render(createElement(App));
          expect(screen.getByLabelText("Route rules")).toBeInTheDocument();
          cleanup();
        }

        if (config.dns) {
          loadFixtureIntoStore(item.id, item.channel, config, diagnostics, "dns:main");
          render(createElement(App));
          expect(screen.getByLabelText("DNS rules")).toBeInTheDocument();
          cleanup();
        }
      } catch (error) {
        failures.push(`${item.id}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        act(() => {
          useProjectStore.setState({ selectedId: null, layout: { positions: {} } });
        });
        cleanup();
      }
    }

    expect(failures).toEqual([]);
  }, 120_000);
});
