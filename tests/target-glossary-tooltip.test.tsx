import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// L1-target-glossary: the target selector had no explanation of what stable (1.13) vs testing (1.14)
// means. Added a tooltip (title) so users understand which build to validate against.

afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

describe("L1-target-glossary — target selector tooltip", () => {
  it("explains stable 1.13 vs testing 1.14 in a tooltip", () => {
    render(<App />);
    const select = screen.getByLabelText("Sing-box target");
    const title = select.getAttribute("title") ?? "";
    expect(title).toMatch(/stable/i);
    expect(title).toMatch(/1\.13/);
    expect(title).toMatch(/testing/i);
    expect(title).toMatch(/1\.14/);
  });
});
