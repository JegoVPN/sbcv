import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createProjectExport } from "../src/domain/serialization";
import { useProjectStore } from "../src/state/useProjectStore";

// C16 slice b (store): loadProject re-hydrates the saved canvas layout (positions survive a round-trip)
// and restores channel/version, unlike plain importJson which deliberately empties the layout.

function reset() {
  useProjectStore.getState().setChannel("stable");
  useProjectStore.getState().importJson(JSON.stringify({}));
}

describe("C16b — loadProject / saveProject store action", () => {
  beforeEach(reset);
  afterEach(reset);

  it("saveProject captures config + layout + channel/version as a versioned wrapper", () => {
    useProjectStore.getState().importJson(JSON.stringify({ outbounds: [{ type: "direct", tag: "d" }] }));
    useProjectStore.getState().setChannel("testing");
    useProjectStore.getState().setNodePosition("outbound:d", { x: 11, y: 22 });
    const project = useProjectStore.getState().saveProject();
    expect(project.kind).toBe("sbcv-project");
    expect(typeof project.schemaVersion).toBe("number");
    expect(project.singBoxChannel).toBe("testing");
    expect(project.layout.positions["outbound:d"]).toEqual({ x: 11, y: 22 });
    expect(project.config.outbounds?.[0]?.tag).toBe("d");
  });

  it("loadProject restores positions (not {}), channel/version, and bumps the load token", () => {
    // Author + save a project with a dragged node.
    useProjectStore.getState().importJson(JSON.stringify({ outbounds: [{ type: "direct", tag: "d" }] }));
    useProjectStore.getState().setChannel("testing");
    useProjectStore.getState().setNodePosition("outbound:d", { x: 33, y: 44 });
    const file = createProjectExport(useProjectStore.getState().saveProject()).contents;

    // Wipe to a fresh stable session, then open the project.
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
    const tokenBefore = useProjectStore.getState().freshLoadToken;

    const result = useProjectStore.getState().loadProject(file);
    expect(result.ok).toBe(true);
    const state = useProjectStore.getState();
    expect(state.layout.positions["outbound:d"]).toEqual({ x: 33, y: 44 });
    expect(state.channel).toBe("testing");
    expect(state.config.outbounds?.[0]?.tag).toBe("d");
    expect(state.freshLoadToken).toBe(tokenBefore + 1);
  });

  it("{snapshot:true} → undo() restores the prior config + layout", () => {
    useProjectStore.getState().importJson(JSON.stringify({ outbounds: [{ type: "direct", tag: "before" }] }));
    useProjectStore.getState().setNodePosition("outbound:before", { x: 1, y: 2 });
    const file = createProjectExport({
      kind: "sbcv-project",
      schemaVersion: 1,
      appVersion: "t",
      singBoxChannel: "stable",
      singBoxVersion: "1.13",
      config: { outbounds: [{ type: "direct", tag: "after" }] },
      layout: { positions: { "outbound:after": { x: 9, y: 9 } } },
    } as never).contents;

    useProjectStore.getState().loadProject(file, { snapshot: true });
    expect(useProjectStore.getState().config.outbounds?.[0]?.tag).toBe("after");
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().config.outbounds?.[0]?.tag).toBe("before");
    expect(useProjectStore.getState().layout.positions["outbound:before"]).toEqual({ x: 1, y: 2 });
  });

  it("rejects a bare sing-box config (no wrapper) without mutating state", () => {
    useProjectStore.getState().importJson(JSON.stringify({ outbounds: [{ type: "direct", tag: "keep" }] }));
    const result = useProjectStore.getState().loadProject(JSON.stringify({ outbounds: [{ type: "block", tag: "other" }] }));
    expect(result.ok).toBe(false);
    expect(useProjectStore.getState().config.outbounds?.[0]?.tag).toBe("keep");
  });

  it("regression: plain importJson still empties the layout (deliberate layout reset)", () => {
    useProjectStore.getState().importJson(JSON.stringify({ outbounds: [{ type: "direct", tag: "d" }] }));
    useProjectStore.getState().setNodePosition("outbound:d", { x: 5, y: 6 });
    useProjectStore.getState().importJson(JSON.stringify({ outbounds: [{ type: "direct", tag: "d" }] }));
    expect(useProjectStore.getState().layout.positions["outbound:d"]).toBeUndefined();
  });
});
