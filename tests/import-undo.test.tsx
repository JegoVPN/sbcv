import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// L3-import-undo: importing overwrites the whole config (A26 confirms it). The import-success toast now
// carries a one-tap "Undo" that restores the pre-import config via the undo-infra snapshot. importJson
// snapshots atomically only on a successful parse (no stray snapshot on a parse error).

function importFile(contents: string) {
  const file = new File([contents], "config.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText("Import JSON file"), { target: { files: [file] } });
}

beforeEach(() => {
  useProjectStore.setState({ toasts: [], history: [] });
  useProjectStore.getState().importJson(JSON.stringify({}));
});
afterEach(() => {
  useProjectStore.setState({ toasts: [], history: [] });
  useProjectStore.getState().importJson(JSON.stringify({}));
});

describe("L3-import-undo — store snapshot option", () => {
  it("importJson({snapshot:true}) captures the pre-import config; undo restores it", () => {
    useProjectStore.getState().importJson(JSON.stringify({ outbounds: [{ type: "direct", tag: "before" }] }));
    const result = useProjectStore.getState().importJson(
      JSON.stringify({ outbounds: [{ type: "direct", tag: "after" }] }),
      { snapshot: true },
    );
    expect(result.ok).toBe(true);
    expect(useProjectStore.getState().config.outbounds?.[0]?.tag).toBe("after");
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().config.outbounds?.[0]?.tag).toBe("before");
  });

  it("does not snapshot on a parse error (no stray history entry)", () => {
    useProjectStore.setState({ history: [] });
    const result = useProjectStore.getState().importJson("{ not json", { snapshot: true });
    expect(result.ok).toBe(false);
    expect(useProjectStore.getState().history).toHaveLength(0);
  });

  it("does not snapshot without the option", () => {
    useProjectStore.setState({ history: [] });
    useProjectStore.getState().importJson(JSON.stringify({ outbounds: [] }));
    expect(useProjectStore.getState().history).toHaveLength(0);
  });
});

describe("L3-import-undo — toast undo affordance", () => {
  it("the import-success toast offers Undo that reverts the import", async () => {
    useProjectStore.getState().importJson(JSON.stringify({ outbounds: [{ type: "direct", tag: "keep" }] }));
    render(<App />);
    // A26 confirm fires for non-empty config — accept it.
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    importFile(JSON.stringify({ outbounds: [{ type: "direct", tag: "incoming" }] }));
    await waitFor(() => expect(useProjectStore.getState().config.outbounds?.[0]?.tag).toBe("incoming"));

    const undo = await screen.findByRole("button", { name: "Undo" });
    fireEvent.click(undo);
    expect(useProjectStore.getState().config.outbounds?.[0]?.tag).toBe("keep");
    confirmSpy.mockRestore();
  });
});
