import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "../src/state/useProjectStore";

// L3-undo-infra: a bounded history snapshot stack in the store. pushHistory() captures the current
// canonical config + layout; undo() restores (and pops) the most recent snapshot, re-syncing
// diagnostics/jsonDraft. Infra only — the flows that snapshot (e.g. import overwrite) come later.

function setOutbound(tag: string) {
  useProjectStore.getState().importJson(JSON.stringify({ outbounds: [{ type: "direct", tag }] }));
}

beforeEach(() => {
  useProjectStore.setState({ history: [] });
  useProjectStore.getState().importJson(JSON.stringify({}));
});
afterEach(() => {
  useProjectStore.setState({ history: [] });
  useProjectStore.getState().importJson(JSON.stringify({}));
});

describe("L3-undo-infra — history snapshot stack", () => {
  it("pushHistory captures the current config; undo restores and pops it", () => {
    setOutbound("A");
    useProjectStore.getState().pushHistory();
    expect(useProjectStore.getState().history).toHaveLength(1);

    setOutbound("B");
    expect(useProjectStore.getState().config.outbounds?.[0]?.tag).toBe("B");

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().config.outbounds?.[0]?.tag).toBe("A");
    expect(useProjectStore.getState().history).toHaveLength(0);
  });

  it("undo re-syncs the JSON draft and diagnostics to the restored config", () => {
    setOutbound("keeper");
    useProjectStore.getState().pushHistory();
    setOutbound("other");
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().jsonDraft).toContain("keeper");
    expect(useProjectStore.getState().jsonDraft).not.toContain("other");
  });

  it("undo on an empty history is a no-op (config reference unchanged)", () => {
    setOutbound("stable-config");
    useProjectStore.setState({ history: [] });
    const before = useProjectStore.getState().config;
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().config).toBe(before);
  });

  it("the stack is bounded (oldest snapshots drop)", () => {
    useProjectStore.setState({ history: [] });
    for (let i = 0; i < 30; i += 1) useProjectStore.getState().pushHistory();
    expect(useProjectStore.getState().history.length).toBeLessThanOrEqual(20);
    expect(useProjectStore.getState().history.length).toBeGreaterThan(0);
  });

  it("supports multiple sequential undos (LIFO)", () => {
    setOutbound("first");
    useProjectStore.getState().pushHistory();
    setOutbound("second");
    useProjectStore.getState().pushHistory();
    setOutbound("third");

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().config.outbounds?.[0]?.tag).toBe("second");
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().config.outbounds?.[0]?.tag).toBe("first");
  });
});
