import { describe, expect, it } from "vitest";

import { createConfigExport, createProjectExport, parseConfigJson, parseProjectJson } from "../src/domain/serialization";
import type { SbcProject, SingBoxConfig } from "../src/domain/types";

// C16 (4.2 layout-loss) slice a: a versioned `sbcv-project` wrapper (config + layout + channel/version)
// round-trips canvas positions, stays strictly distinct from a bare sing-box config, and rejects
// malformed input. Source: configuration/index.md (the wrapper is app-local, never a sing-box config).

function makeProject(overrides: Partial<SbcProject> = {}): SbcProject {
  return {
    kind: "sbcv-project",
    schemaVersion: 1,
    appVersion: "test",
    singBoxChannel: "stable",
    singBoxVersion: "1.13",
    config: { outbounds: [{ type: "direct", tag: "d" }] } as unknown as SingBoxConfig,
    layout: { positions: { "outbound:d": { x: 12, y: 34 } } },
    ...overrides,
  };
}

describe("C16a — project wrapper round-trip", () => {
  it("round-trips positions + config and emits kind + numeric schemaVersion", () => {
    const project = makeProject();
    const exported = createProjectExport(project);
    const parsed = JSON.parse(exported.contents);
    expect(parsed.kind).toBe("sbcv-project");
    expect(typeof parsed.schemaVersion).toBe("number");

    const reloaded = parseProjectJson(exported.contents);
    expect(reloaded.layout.positions).toEqual({ "outbound:d": { x: 12, y: 34 } });
    expect(reloaded.config.outbounds?.[0]?.tag).toBe("d");
    expect(reloaded.singBoxChannel).toBe("stable");
    expect(reloaded.singBoxVersion).toBe("1.13");
  });

  it("preserves testing-channel root keys (http_clients / certificate_providers)", () => {
    const project = makeProject({
      singBoxChannel: "testing",
      singBoxVersion: "1.14",
      config: {
        outbounds: [{ type: "direct", tag: "d" }],
        http_clients: [{ tag: "hc" }],
        certificate_providers: [{ type: "acme", tag: "c", domain: ["e.com"] }],
      } as unknown as SingBoxConfig,
    });
    const reloaded = parseProjectJson(createProjectExport(project).contents);
    expect(reloaded.config.http_clients?.[0]?.tag).toBe("hc");
    expect((reloaded.config.certificate_providers?.[0] as { tag?: string })?.tag).toBe("c");
  });
});

describe("C16a — wrapper ↔ config distinctness", () => {
  it("parseProjectJson rejects a bare sing-box config (no wrapper)", () => {
    const bare = createConfigExport({ outbounds: [{ type: "direct", tag: "d" }] } as unknown as SingBoxConfig);
    expect(() => parseProjectJson(bare.contents)).toThrow(/sbcv project/i);
  });

  it("a project file is parseable as a project but is NOT a bare config the editor would import as-is", () => {
    const exported = createProjectExport(makeProject());
    // It parses as a project...
    expect(parseProjectJson(exported.contents).kind).toBe("sbcv-project");
    // ...and a naive parseConfigJson sees the wrapper keys, not a real sing-box root (no outbounds at top level).
    const asConfig = parseConfigJson(exported.contents);
    expect(asConfig.outbounds).toBeUndefined();
  });

  it("rejects bad kind / non-numeric schemaVersion / malformed positions", () => {
    expect(() => parseProjectJson(JSON.stringify({ kind: "nope", schemaVersion: 1, layout: { positions: {} } }))).toThrow();
    expect(() => parseProjectJson(JSON.stringify({ kind: "sbcv-project", schemaVersion: "1", layout: { positions: {} } }))).toThrow(/schemaVersion/i);
    expect(() => parseProjectJson(JSON.stringify({ kind: "sbcv-project", schemaVersion: 1, layout: { positions: [] } }))).toThrow(/positions/i);
    expect(() => parseProjectJson(JSON.stringify({ kind: "sbcv-project", schemaVersion: 1 }))).toThrow(/positions/i);
  });
});
