import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

afterEach(() => {
  // @ts-expect-error matchMedia is not part of jsdom by default
  delete window.matchMedia;
});

describe("mobile layout switch", () => {
  it("mounts the mobile shell when viewport ≤768px", () => {
    setMatchMedia(true);
    useProjectStore.getState().loadTemplate();
    render(<App />);
    expect(screen.getByTestId("app-mobile")).toBeInTheDocument();
    expect(screen.queryByTestId("app-desktop")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Node palette")).not.toBeInTheDocument();
    expect(screen.getByLabelText("SBC visual canvas")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-menu-toggle")).toBeInTheDocument();
    // Mobile bottom toolbar only keeps fit-view button
    const toolbarButtons = document.querySelectorAll(".react-flow__controls-button");
    expect(toolbarButtons.length).toBe(1);
  });

  it("mounts the desktop shell when viewport >768px", () => {
    setMatchMedia(false);
    useProjectStore.getState().loadTemplate();
    render(<App />);
    expect(screen.getByTestId("app-desktop")).toBeInTheDocument();
    expect(screen.queryByTestId("app-mobile")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Node palette")).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-menu-toggle")).not.toBeInTheDocument();
  });

  it("Inspector compact prop hides destructive actions on mobile shell", () => {
    useProjectStore.getState().loadTemplate();
    const proxyTag = useProjectStore
      .getState()
      .config.outbounds?.find((o) => typeof o === "object" && o !== null && "tag" in o && o.tag !== "direct")?.tag;
    if (!proxyTag) throw new Error("expected an outbound with a tag to exist in the template");
    useProjectStore.getState().setSelectedId(`outbound:${proxyTag}`);

    // Desktop shell first: Inspector mounts without compact class
    setMatchMedia(false);
    const desktop = render(<App />);
    const desktopInspector = desktop.container.querySelector('[data-testid="node-inspector"]');
    expect(desktopInspector).not.toBeNull();
    expect(desktopInspector!.classList.contains("inspector--compact")).toBe(false);
    desktop.unmount();

    // Mobile shell: Inspector inside the bottom sheet gets compact class
    setMatchMedia(true);
    const mobile = render(<App />);
    const mobileInspector = mobile.container.querySelector('[data-testid="node-inspector"]');
    expect(mobileInspector).not.toBeNull();
    expect(mobileInspector!.classList.contains("inspector--compact")).toBe(true);
    mobile.unmount();
  });
});
