import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BottomSheet } from "../src/components/BottomSheet";
import {
  CanvasInteractionContext,
  createCanvasInteractionStore,
  interactionPortKey,
  useCanvasInteraction,
} from "../src/components/canvasInteractionContext";
import { useViewport } from "../src/components/useViewport";

describe("frontend performance helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shares one matchMedia listener across viewport consumers", () => {
    let matches = false;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const addEventListener = vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
      if (event === "change") listeners.add(listener);
    });
    const removeEventListener = vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
      if (event === "change") listeners.delete(listener);
    });
    const mql = {
      get matches() {
        return matches;
      },
      addEventListener,
      removeEventListener,
    } as unknown as MediaQueryList;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn(() => mql),
    });

    function ViewportConsumer({ label }: { label: string }) {
      const { isMobile } = useViewport();
      return <span>{`${label}:${isMobile ? "mobile" : "desktop"}`}</span>;
    }

    const { unmount } = render(
      <>
        <ViewportConsumer label="a" />
        <ViewportConsumer label="b" />
      </>,
    );

    expect(screen.getByText("a:desktop")).toBeInTheDocument();
    expect(screen.getByText("b:desktop")).toBeInTheDocument();
    expect(addEventListener).toHaveBeenCalledTimes(1);

    act(() => {
      matches = true;
      for (const listener of listeners) listener({ matches: true } as MediaQueryListEvent);
    });

    expect(screen.getByText("a:mobile")).toBeInTheDocument();
    expect(screen.getByText("b:mobile")).toBeInTheDocument();

    unmount();
    expect(removeEventListener).toHaveBeenCalledTimes(1);
  });

  it("updates bottom sheet drag height without rerendering sheet contents on every pointer move", () => {
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      writable: true,
      value: setPointerCapture,
    });
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
      configurable: true,
      writable: true,
      value: releasePointerCapture,
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    let renders = 0;

    function Content() {
      renders += 1;
      return <div>Sheet body</div>;
    }

    render(
      <BottomSheet open onClose={() => {}} ariaLabel="Inspector">
        <Content />
      </BottomSheet>,
    );

    const handle = screen.getByRole("button", { name: "Drag to resize" });
    const sheet = document.querySelector(".bottom-sheet") as HTMLElement | null;
    expect(sheet).toBeTruthy();
    expect(renders).toBe(1);

    fireEvent.pointerDown(handle, { pointerId: 1, clientY: 500 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 450 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 420 });

    expect(renders).toBe(1);
    expect(sheet?.style.height).toMatch(/vh$/);

    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it("keeps canvas port interaction rerenders scoped to affected nodes", () => {
    const store = createCanvasInteractionStore();
    const renders = { a: 0, b: 0 };

    function PortConsumer({ nodeId, label }: { nodeId: string; label: keyof typeof renders }) {
      renders[label] += 1;
      const { compatiblePortKeys, pendingPortKey } = useCanvasInteraction(nodeId, ["route"]);
      return (
        <span>
          {`${label}:${pendingPortKey ?? "idle"}:${compatiblePortKeys.has("route") ? "compatible" : "plain"}`}
        </span>
      );
    }

    render(
      <CanvasInteractionContext.Provider value={store}>
        <PortConsumer nodeId="route:main" label="a" />
        <PortConsumer nodeId="dns:main" label="b" />
      </CanvasInteractionContext.Provider>,
    );

    expect(renders).toEqual({ a: 1, b: 1 });

    act(() => {
      store.setSnapshot({
        pendingPortKey: interactionPortKey("route:main", "route"),
        compatiblePortKeys: new Set([interactionPortKey("route:main", "route")]),
      });
    });

    expect(screen.getByText("a:route:compatible")).toBeInTheDocument();
    expect(screen.getByText("b:idle:plain")).toBeInTheDocument();
    expect(renders).toEqual({ a: 2, b: 1 });
  });
});
