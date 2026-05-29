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

// C8: the mobile (MobileMenuSheet) export path now routes through the same shared
// confirmAndExportConfig gate as desktop, so an invalid config can't be silently downloaded from
// the mobile sheet either.
describe("C8 — mobile export gate parity", () => {
  afterEach(() => {
    // @ts-expect-error matchMedia is not part of jsdom by default
    delete window.matchMedia;
  });

  // MobileMenuSheet is lazy-loaded behind Suspense, so the sheet resolves asynchronously after the
  // toggle click — await it.
  async function openMobileExport() {
    setMatchMedia(true);
    render(<App />);
    fireEvent.click(screen.getByTestId("mobile-menu-toggle"));
    const sheet = within(await screen.findByTestId("mobile-menu-sheet"));
    return sheet.getByRole("button", { name: /export/i });
  }

  it("prompts on error-level diagnostics and aborts the download + keeps the sheet open on cancel", async () => {
    useProjectStore.getState().loadTemplate();
    act(() => {
      useProjectStore.getState().updateField({ kind: "route", id: "main" }, "final", "missing-outbound");
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    fireEvent.click(await openMobileExport());

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0]?.[0]).toMatch(/error/i);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByTestId("mobile-menu-sheet")).toBeInTheDocument();
  });

  it("downloads after the user confirms past the error gate", async () => {
    useProjectStore.getState().loadTemplate();
    act(() => {
      useProjectStore.getState().updateField({ kind: "route", id: "main" }, "final", "missing-outbound");
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    fireEvent.click(await openMobileExport());

    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("exports a valid config without prompting", async () => {
    useProjectStore.getState().loadTemplate();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    fireEvent.click(await openMobileExport());

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });
});
