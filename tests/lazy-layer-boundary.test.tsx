import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LazyLayerBoundary } from "../src/components/LazyLayerBoundary";

// R2 — a lazy layer whose chunk fails to load must NOT blank the app. The boundary catches the failure
// and renders a recoverable, closable error in the slot. (Real chunk-abort is covered in e2e; here we
// simulate the failure with a throwing child, which React surfaces to the same error boundary.)

function Boom(): JSX.Element {
  throw new Error("dynamic import failed");
}

describe("R2 — LazyLayerBoundary", () => {
  it("catches a failed child and renders a recoverable error instead of crashing", () => {
    const onClose = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <div data-testid="app-root">
        <LazyLayerBoundary onClose={onClose}>
          <Boom />
        </LazyLayerBoundary>
      </div>,
    );
    // The error is contained in the slot; the surrounding app tree is still mounted.
    expect(screen.getByTestId("app-root")).toBeInTheDocument();
    expect(screen.getByTestId("lazy-layer-error")).toBeInTheDocument();
    // Close lets the user dismiss it.
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it("renders children normally when they don't throw", () => {
    render(
      <LazyLayerBoundary>
        <div data-testid="loaded">loaded</div>
      </LazyLayerBoundary>,
    );
    expect(screen.getByTestId("loaded")).toBeInTheDocument();
    expect(screen.queryByTestId("lazy-layer-error")).toBeNull();
  });
});
