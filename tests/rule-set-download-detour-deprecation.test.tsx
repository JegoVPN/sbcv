import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// L2-fix-rule-set-deprecation (audit H9): a remote rule-set's `download_detour` is deprecated in
// sing-box 1.14 (→ `http_client`, removed 1.16), but the Inspector showed no signal. A deprecation
// banner now appears when `download_detour` is set (mirroring the store_rdrc banner pattern).

function importRuleSet(withDetour: boolean) {
  useProjectStore.getState().importJson(
    JSON.stringify({
      outbounds: [{ type: "direct", tag: "out" }],
      route: {
        rule_set: [
          {
            type: "remote",
            tag: "rs",
            url: "https://example.com/rs.srs",
            format: "binary",
            ...(withDetour ? { download_detour: "out" } : {}),
          },
        ],
      },
    }),
  );
}

describe("L2-fix-rule-set-deprecation — download_detour deprecation banner", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("shows the deprecation banner on testing when download_detour is set", () => {
    importRuleSet(true);
    useProjectStore.getState().setChannel("testing");
    render(<App />);
    fireEvent.click(screen.getByTestId("node-rule-set:rs"));
    const inspector = within(screen.getByTestId("node-inspector"));
    expect(inspector.getByText(/`?download_detour`? is deprecated/i)).toBeInTheDocument();
    expect(inspector.getByText(/http_client/i)).toBeInTheDocument();
  });

  it("does not show the banner when download_detour is unset (testing)", () => {
    importRuleSet(false);
    useProjectStore.getState().setChannel("testing");
    render(<App />);
    fireEvent.click(screen.getByTestId("node-rule-set:rs"));
    const inspector = within(screen.getByTestId("node-inspector"));
    expect(inspector.queryByText(/download_detour. is deprecated/i)).toBeNull();
  });

  it("does NOT show the banner on stable even with download_detour set (it's the valid 1.13 field)", () => {
    importRuleSet(true);
    useProjectStore.getState().setChannel("stable");
    render(<App />);
    fireEvent.click(screen.getByTestId("node-rule-set:rs"));
    const inspector = within(screen.getByTestId("node-inspector"));
    expect(inspector.queryByText(/download_detour. is deprecated/i)).toBeNull();
  });
});
