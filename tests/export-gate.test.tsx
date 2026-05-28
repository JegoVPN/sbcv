import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A2b (pre-export validation gate): exporting a config that has error-level diagnostics must prompt for
// confirmation first, so an invalid config is never silently downloaded (W9). jsdom does not implement
// URL.createObjectURL, so we stub it to detect whether the download actually proceeded.

let createObjectURL: ReturnType<typeof vi.fn>;
let originalCreate: typeof URL.createObjectURL;
let originalRevoke: typeof URL.revokeObjectURL;

beforeEach(() => {
  originalCreate = URL.createObjectURL;
  originalRevoke = URL.revokeObjectURL;
  createObjectURL = vi.fn(() => "blob:mock");
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = createObjectURL;
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
});

afterEach(() => {
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
  vi.restoreAllMocks();
});

describe("pre-export validation gate (A2b)", () => {
  it("confirms before exporting a config with errors and aborts the download on cancel", () => {
    useProjectStore.getState().loadTemplate();
    act(() => {
      // route.final referencing a missing outbound is an error-level diagnostic.
      useProjectStore.getState().updateField({ kind: "route", id: "main" }, "final", "missing-outbound");
    });
    render(<App />);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    fireEvent.click(screen.getByTestId("export-button"));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0]?.[0]).toMatch(/error/i);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("downloads after the user confirms past the error gate", () => {
    useProjectStore.getState().loadTemplate();
    act(() => {
      useProjectStore.getState().updateField({ kind: "route", id: "main" }, "final", "missing-outbound");
    });
    render(<App />);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    fireEvent.click(screen.getByTestId("export-button"));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("exports a valid config without prompting", () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    fireEvent.click(screen.getByTestId("export-button"));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });
});
