import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { configHasContent } from "../src/components/TopBar";
import type { SingBoxConfig } from "../src/domain/types";
import { useProjectStore } from "../src/state/useProjectStore";

// A26 (W32): importing replaces the whole config. Confirm before clobbering existing work; an empty
// config imports without a prompt.

function importFile(json: unknown) {
  const file = new File([JSON.stringify(json)], "config.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText("Import JSON file"), { target: { files: [file] } });
}

describe("A26 — import safety confirm", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => {
    vi.restoreAllMocks();
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("configHasContent reflects whether the config holds work", () => {
    expect(configHasContent({} as SingBoxConfig)).toBe(false);
    expect(configHasContent({ outbounds: [{ type: "direct", tag: "a" }] } as unknown as SingBoxConfig)).toBe(true);
    // settings-only and final-only configs count as content (would otherwise silently clobber).
    expect(configHasContent({ experimental: { clash_api: {} } } as unknown as SingBoxConfig)).toBe(true);
    expect(configHasContent({ route: { final: "direct" } } as unknown as SingBoxConfig)).toBe(true);
    expect(configHasContent({ log: { level: "info" } } as unknown as SingBoxConfig)).toBe(true);
  });

  it("confirms before importing over a non-empty config and keeps it on cancel", async () => {
    useProjectStore.getState().importJson(JSON.stringify({ outbounds: [{ type: "direct", tag: "keep" }] }));
    render(<App />);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    importFile({ outbounds: [{ type: "direct", tag: "imported" }] });
    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    expect(useProjectStore.getState().config.outbounds?.[0]?.tag).toBe("keep");
  });

  it("imports without a prompt when the current config is empty", async () => {
    render(<App />);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    importFile({ outbounds: [{ type: "direct", tag: "fresh" }] });
    await waitFor(() => expect(useProjectStore.getState().config.outbounds?.[0]?.tag).toBe("fresh"));
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
