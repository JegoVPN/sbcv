import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// V4-S2 — the palette gates a node type by the ACTIVE VERSION, not just the channel. naive / ccm / ocm
// are sing-box 1.13, so on a 1.12 stable target they read "Needs 1.13" and are not creatable (they were
// wrongly offered as "Add" before). On 1.13 they are creatable. Plus the setChannel version-drop fix.

async function openLibraryGroup(name: RegExp) {
  const palette = within(await screen.findByLabelText("Node palette"));
  fireEvent.click(palette.getByRole("button", { name: /Library/ }));
  fireEvent.click(palette.getByRole("button", { name: name }));
  return palette;
}

describe("V4-S2 — palette version gating", () => {
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("gates the naive outbound on 1.12-stable (Needs 1.13) and offers it on 1.13", async () => {
    useProjectStore.getState().setTarget("1.12-stable");
    const { unmount } = render(<App />);
    let palette = await openLibraryGroup(/^Outbounds/);
    const gated = palette.getByRole("button", { name: "Naive: Needs 1.13" });
    expect(gated).toBeDisabled();
    unmount();

    useProjectStore.getState().setTarget("1.13-stable");
    render(<App />);
    palette = await openLibraryGroup(/^Outbounds/);
    expect(palette.getByRole("button", { name: "Add Naive" })).toBeEnabled();
  });

  it("gates the ccm service on 1.12-stable (Needs 1.13)", async () => {
    useProjectStore.getState().setTarget("1.12-stable");
    render(<App />);
    const palette = await openLibraryGroup(/^Services/);
    expect(palette.getByRole("button", { name: "CCM: Needs 1.13" })).toBeDisabled();
  });
});

describe("V4-S2 — setChannel keeps version + diagnostics in sync", () => {
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("sets the channel's default version", () => {
    useProjectStore.getState().setChannel("testing");
    expect(useProjectStore.getState().version).toBe("1.14");
    useProjectStore.getState().setChannel("stable");
    expect(useProjectStore.getState().version).toBe("1.13");
  });
});
