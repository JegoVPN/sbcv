import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// N3-remove-center-plus (node-card redesign): the big center "+" on a node card auto-linked to
// `compatible[0]` (over-design). Removed — the right-side downstream ports + the hover candidate
// affordance already cover "add downstream".

afterEach(() => {
  useProjectStore.getState().importJson(JSON.stringify({}));
});

describe("node card no longer has the center auto-link '+'", () => {
  it("renders no .sbc-node__add button even for a node with compatible candidates", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({
        outbounds: [
          { type: "urltest", tag: "auto", outbounds: ["a", "b"] },
          { type: "direct", tag: "a" },
          { type: "direct", tag: "b" },
        ],
      }),
    );
    const { container } = render(<App />);
    // the urltest node advertises compatible candidates (would have shown the center "+")
    expect(screen.getByTestId("node-outbound:auto")).toBeInTheDocument();
    expect(container.querySelector(".sbc-node__add")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Add from / })).toBeNull();
  });
});
