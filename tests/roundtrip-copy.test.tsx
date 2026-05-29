import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { MobileMenuSheet } from "../src/components/MobileMenuSheet";
import { useProjectStore } from "../src/state/useProjectStore";

// L1-roundtrip-copy: importing then exporting normalizes the config (empty fields are dropped,
// shorthand values expand to sing-box's canonical form), so a re-exported file can differ textually
// from the original even though sing-box reads it identically. Surface that expectation at the two
// places round-trip matters — the desktop Export button tooltip and the mobile Export row caption.

afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

describe("L1-roundtrip-copy — export communicates normalization", () => {
  it("desktop Export button tooltip explains the config is normalized", () => {
    render(<App />);
    const exportButton = screen.getByTestId("export-button");
    const title = exportButton.getAttribute("title") ?? "";
    expect(title).toMatch(/normaliz/i);
    expect(title).toMatch(/sing-box/i);
  });

  it("mobile Export row caption mentions normalization", () => {
    render(<MobileMenuSheet open onClose={() => {}} onOpenTemplates={() => {}} onOpenJson={() => {}} />);
    const exportRow = screen.getByRole("button", { name: /Export/ });
    expect(within(exportRow).getByText(/normaliz/i)).toBeInTheDocument();
  });
});
