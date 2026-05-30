import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { parseConfigJson, stringifyConfig } from "../src/domain/serialization";
import { useProjectStore } from "../src/state/useProjectStore";

// V9-S1 — selector/urltest candidate ORDER is meaningful (urltest priority). The candidate checklist is
// order-agnostic (add appends); a dedicated "Candidate order" list reorders entity.outbounds in place.

function selectUrltest() {
  useProjectStore.getState().importJson(
    JSON.stringify({
      outbounds: [
        { type: "direct", tag: "a" },
        { type: "direct", tag: "b" },
        { type: "direct", tag: "c" },
        { type: "urltest", tag: "ut", outbounds: ["a", "b", "c"] },
      ],
    }),
  );
  act(() => {
    useProjectStore.getState().setSelectedId("outbound:ut");
  });
}

function memberOrder() {
  return (useProjectStore.getState().config.outbounds!.find((o) => o.tag === "ut") as Record<string, unknown>)
    .outbounds;
}

describe("V9-S1 — selector/urltest candidate reorder", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("moves a candidate up and down, persisting order, and round-trips", () => {
    selectUrltest();
    render(<App />);
    const order = within(screen.getByTestId("candidate-order"));

    fireEvent.click(order.getByRole("button", { name: "Move candidate b up" }));
    expect(memberOrder()).toEqual(["b", "a", "c"]);

    fireEvent.click(within(screen.getByTestId("candidate-order")).getByRole("button", { name: "Move candidate b down" }));
    expect(memberOrder()).toEqual(["a", "b", "c"]);

    const config = useProjectStore.getState().config;
    expect(parseConfigJson(stringifyConfig(config))).toEqual(config);
  });

  it("disables up on the first and down on the last", () => {
    selectUrltest();
    render(<App />);
    const order = within(screen.getByTestId("candidate-order"));
    expect(order.getByRole("button", { name: "Move candidate a up" })).toBeDisabled();
    expect(order.getByRole("button", { name: "Move candidate c down" })).toBeDisabled();
  });
});
