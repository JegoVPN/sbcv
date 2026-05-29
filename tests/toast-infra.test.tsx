import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastHost } from "../src/components/ToastHost";
import { useProjectStore } from "../src/state/useProjectStore";

// L3-toast-infra: a minimal toast/notification host — a store slice (pushToast/dismissToast +
// auto-dismiss) and an a11y-live ToastHost portal. This atomic builds ONLY the infrastructure; the
// flows that emit toasts (import feedback, invalid drop, import undo) come in later atomics.

beforeEach(() => useProjectStore.setState({ toasts: [] }));
afterEach(() => {
  useProjectStore.setState({ toasts: [] });
  vi.useRealTimers();
});

describe("L3-toast-infra — store slice", () => {
  it("pushToast adds a toast (default info tone) and returns its id; dismissToast removes it", () => {
    const id = useProjectStore.getState().pushToast({ message: "Saved" });
    const toasts = useProjectStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ id, message: "Saved", tone: "info" });
    useProjectStore.getState().dismissToast(id);
    expect(useProjectStore.getState().toasts).toHaveLength(0);
  });

  it("pushToast assigns unique ids", () => {
    const a = useProjectStore.getState().pushToast({ message: "one" });
    const b = useProjectStore.getState().pushToast({ message: "two" });
    expect(a).not.toBe(b);
    expect(useProjectStore.getState().toasts).toHaveLength(2);
  });
});

describe("L3-toast-infra — ToastHost component", () => {
  it("renders nothing when there are no toasts", () => {
    render(<ToastHost />);
    expect(screen.queryByTestId("toast-host")).toBeNull();
  });

  it("renders a toast message with a polite role for info and an alert role for error", () => {
    render(<ToastHost />);
    act(() => {
      useProjectStore.getState().pushToast({ message: "All good", tone: "success" });
      useProjectStore.getState().pushToast({ message: "It broke", tone: "error" });
    });
    expect(screen.getByText("All good")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("All good");
    expect(screen.getByRole("alert")).toHaveTextContent("It broke");
  });

  it("the dismiss button removes the toast", () => {
    render(<ToastHost />);
    act(() => {
      useProjectStore.getState().pushToast({ message: "dismiss me", durationMs: null });
    });
    fireEvent.click(screen.getByLabelText("Dismiss notification"));
    expect(screen.queryByText("dismiss me")).toBeNull();
  });

  it("an action button runs its handler and dismisses the toast", () => {
    const onAct = vi.fn();
    render(<ToastHost />);
    act(() => {
      useProjectStore.getState().pushToast({ message: "Imported", durationMs: null, action: { label: "Undo", onAct } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onAct).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Imported")).toBeNull();
  });

  it("auto-dismisses after durationMs, but a null duration is sticky", () => {
    vi.useFakeTimers();
    render(<ToastHost />);
    act(() => {
      useProjectStore.getState().pushToast({ message: "temporary", durationMs: 3000 });
      useProjectStore.getState().pushToast({ message: "sticky", durationMs: null });
    });
    expect(screen.getByText("temporary")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByText("temporary")).toBeNull();
    expect(screen.getByText("sticky")).toBeInTheDocument();
  });
});
