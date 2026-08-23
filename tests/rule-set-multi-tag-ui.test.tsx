import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { RouteRulesTable } from "../src/components/RuleTables";
import { useProjectStore } from "../src/state/useProjectStore";

describe("grouped rule-set UI projection", () => {
  afterEach(() => {
    cleanup();
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("opens the shared Inspector and offers every tag to route rules", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({
        route: {
          rules: [{ rule_set: "geo-b" }],
          rule_set: [
            {
              type: "remote",
              tag: ["geo-a", "geo-b"],
              format: "binary",
              url: "https://example.com/{tag}.srs",
            },
          ],
        },
      }),
    );
    useProjectStore.getState().setChannel("testing");

    const app = render(<App />);
    fireEvent.click(screen.getByTestId("node-rule-set:geo-a"));

    expect(screen.getByRole("heading", { name: "geo-a, geo-b" })).toBeInTheDocument();
    expect(screen.getByLabelText("Rule-set tags")).toHaveValue("geo-a, geo-b");
    app.unmount();
    render(<RouteRulesTable />);
    const optionValues = Array.from(document.querySelectorAll("#route-rule-set-tags option")).map(
      (option) => (option as HTMLOptionElement).value,
    );
    expect(optionValues).toEqual(["geo-a", "geo-b"]);
  });
});
