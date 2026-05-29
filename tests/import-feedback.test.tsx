import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { MobileMenuSheet } from "../src/components/MobileMenuSheet";
import { ToastHost } from "../src/components/ToastHost";
import { useProjectStore } from "../src/state/useProjectStore";

// L3-import-feedback: a file import gave no confirmation — success was silent and a parse error only
// showed in the diagnostics popover. importJson now returns { ok, error? }, and the import handlers
// (desktop + mobile) raise a success/error toast.

function importFile(contents: string) {
  const file = new File([contents], "config.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText("Import JSON file"), { target: { files: [file] } });
}

beforeEach(() => {
  useProjectStore.setState({ toasts: [] });
  useProjectStore.getState().importJson(JSON.stringify({}));
});
afterEach(() => {
  useProjectStore.setState({ toasts: [] });
  useProjectStore.getState().importJson(JSON.stringify({}));
});

describe("L3-import-feedback — store result", () => {
  it("importJson returns ok:true for valid JSON and ok:false + error for invalid JSON", () => {
    expect(useProjectStore.getState().importJson(JSON.stringify({ outbounds: [] }))).toEqual({ ok: true });
    const bad = useProjectStore.getState().importJson("{ not json");
    expect(bad.ok).toBe(false);
    expect(bad.error).toBeTruthy();
  });
});

describe("L3-import-feedback — desktop toast", () => {
  it("shows a success toast after a valid file import", async () => {
    render(<App />);
    importFile(JSON.stringify({ outbounds: [{ type: "direct", tag: "fresh" }] }));
    await waitFor(() => expect(screen.getByText(/imported/i)).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent(/imported/i);
  });

  it("shows an error toast when the file is not valid JSON", async () => {
    render(<App />);
    importFile("{ definitely not json");
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(/import failed/i);
  });
});

describe("L3-import-feedback — mobile toast", () => {
  it("shows a success toast after a valid import from the mobile menu sheet", async () => {
    render(
      <>
        <MobileMenuSheet open onClose={() => {}} onOpenTemplates={() => {}} />
        <ToastHost />
      </>,
    );
    importFile(JSON.stringify({ outbounds: [{ type: "direct", tag: "m" }] }));
    await waitFor(() => expect(screen.getByText(/imported/i)).toBeInTheDocument());
  });
});
