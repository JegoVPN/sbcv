import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";
import { createProjectExport } from "../src/domain/serialization";
import { useProjectStore } from "../src/state/useProjectStore";

// C16 slice b (UI): the TopBar "Save project" button downloads the sbcv wrapper, and "Open project"
// loads it back (re-hydrating layout). Distinct from plain Export/Import (which drops layout).

let createObjectURL: ReturnType<typeof vi.fn>;
let origCreate: typeof URL.createObjectURL;
let origRevoke: typeof URL.revokeObjectURL;

beforeEach(() => {
  origCreate = URL.createObjectURL;
  origRevoke = URL.revokeObjectURL;
  createObjectURL = vi.fn(() => "blob:mock");
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = createObjectURL;
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  useProjectStore.getState().setChannel("stable");
  useProjectStore.getState().importJson(JSON.stringify({}));
});
afterEach(() => {
  URL.createObjectURL = origCreate;
  URL.revokeObjectURL = origRevoke;
  vi.restoreAllMocks();
  useProjectStore.getState().setChannel("stable");
  useProjectStore.getState().importJson(JSON.stringify({}));
});

describe("C16b-UI — TopBar Save/Open project", () => {
  it("Save project downloads a wrapper file", () => {
    useProjectStore.getState().importJson(JSON.stringify({ outbounds: [{ type: "direct", tag: "d" }] }));
    render(<App />);
    fireEvent.click(screen.getByTestId("save-project-button"));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("Open project loads the wrapper and re-hydrates layout/channel", async () => {
    // Build a project file off-screen.
    const file = createProjectExport({
      kind: "sbcv-project",
      schemaVersion: 1,
      appVersion: "t",
      singBoxChannel: "testing",
      singBoxVersion: "1.14",
      config: { outbounds: [{ type: "direct", tag: "opened" }] },
      layout: { positions: { "outbound:opened": { x: 7, y: 8 } } },
    } as never).contents;

    render(<App />);
    const input = screen.getByLabelText("Open sbcv project file");
    fireEvent.change(input, { target: { files: [new File([file], "p.sbcv.json", { type: "application/json" })] } });

    expect(await screen.findByText(/Project opened/i)).toBeTruthy();
    const state = useProjectStore.getState();
    expect(state.config.outbounds?.[0]?.tag).toBe("opened");
    expect(state.layout.positions["outbound:opened"]).toEqual({ x: 7, y: 8 });
    expect(state.channel).toBe("testing");
  });
});
