import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// L1-badges-treatment (D2 de-dup): the Hysteria Realm palette label carried "(1.14 testing)" AND showed
// a version/gated badge — double-stating. On stable it's gated; the `Needs 1.14` badge now carries the
// version, so the label drops the suffix → bare "Hysteria Realm".

describe("L1-badges-treatment — Hysteria Realm label de-dup", () => {
  beforeEach(() => useProjectStore.getState().loadMinimal());
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("on stable, the label is bare 'Hysteria Realm' and the gated badge carries the version", async () => {
    render(<App />);
    const palette = within(await screen.findByLabelText("Node palette"));
    fireEvent.click(palette.getByRole("button", { name: /Library/ }));
    fireEvent.click(palette.getByRole("button", { name: /^Services/ }));
    // gated on stable → non-actionable aria-label "<label>: <badge>" with the version on the BADGE.
    expect(palette.getByRole("button", { name: "Hysteria Realm: Needs 1.14" })).toBeDisabled();
    // no label still carries the redundant "(1.14 testing)" suffix.
    expect(palette.queryByRole("button", { name: /\(1\.14 testing\)/ })).toBeNull();
  });
});
