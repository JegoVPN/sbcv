import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

function setMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 768px)" ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// V2 — export HARD gate: a config with error-level semantic diagnostics is structurally invalid and can
// NEVER be exported (no bypassable confirm) — the Export button is disabled and nothing is downloaded.
// (Replaces the old A2b "confirm to bypass" contract.) jsdom does not implement URL.createObjectURL, so
// we stub it to detect whether the download actually proceeded.

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

describe("V2 — desktop export hard gate", () => {
  it("disables Export and never downloads when the config has structural errors (no bypass)", () => {
    useProjectStore.getState().loadTemplate();
    act(() => {
      // route.final referencing a missing outbound is an error-level semantic diagnostic.
      useProjectStore.getState().updateField({ kind: "route", id: "main" }, "final", "missing-outbound");
    });
    render(<App />);
    const button = screen.getByTestId("export-button");
    expect(button).toBeDisabled();

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(button);

    // Disabled button fires no onClick; there is no confirm to bypass and nothing is downloaded.
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("re-enables Export and downloads once the structural error is fixed", () => {
    useProjectStore.getState().loadTemplate();
    act(() => {
      useProjectStore.getState().updateField({ kind: "route", id: "main" }, "final", "missing-outbound");
    });
    render(<App />);
    expect(screen.getByTestId("export-button")).toBeDisabled();

    // Clear the bad reference → gate releases.
    act(() => {
      useProjectStore.getState().updateField({ kind: "route", id: "main" }, "final", "");
    });
    expect(screen.getByTestId("export-button")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("export-button"));
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

describe("V2 — mobile export hard gate parity", () => {
  afterEach(() => {
    // @ts-expect-error matchMedia is not part of jsdom by default
    delete window.matchMedia;
  });

  async function openMobileExport() {
    setMatchMedia(true);
    render(<App />);
    fireEvent.click(screen.getByTestId("mobile-menu-toggle"));
    const sheet = within(await screen.findByTestId("mobile-menu-sheet"));
    return sheet.getByRole("button", { name: /export/i });
  }

  it("disables Export and never downloads on structural errors; sheet stays open", async () => {
    useProjectStore.getState().loadTemplate();
    act(() => {
      useProjectStore.getState().updateField({ kind: "route", id: "main" }, "final", "missing-outbound");
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    const button = await openMobileExport();
    expect(button).toBeDisabled();
    fireEvent.click(button);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByTestId("mobile-menu-sheet")).toBeInTheDocument();
  });

  it("exports a valid config without prompting", async () => {
    useProjectStore.getState().loadTemplate();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    fireEvent.click(await openMobileExport());

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });
});
