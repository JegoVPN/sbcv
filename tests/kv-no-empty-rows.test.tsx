import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { withUniqueBlankKey } from "../src/components/Inspector";
import { useProjectStore } from "../src/state/useProjectStore";

// A4c (kv-no-empty-rows): adding a kv-repeater row must seed a unique, non-empty key so a blank
// `{"":""}` entry is never committed to / exported from canonical config (W13 / C0-6).

describe("withUniqueBlankKey", () => {
  it("seeds the base key with an empty value when it is free", () => {
    expect(withUniqueBlankKey({}, "X-Header")).toEqual({ "X-Header": "" });
  });

  it("never produces an empty key and increments on collision", () => {
    const result = withUniqueBlankKey({ "X-Header": "a", "X-Header-2": "b" }, "X-Header");
    const added = Object.keys(result).filter((key) => !["X-Header", "X-Header-2"].includes(key));
    expect(added).toEqual(["X-Header-3"]);
    expect(Object.keys(result)).not.toContain("");
  });
});

describe("kv repeater Add does not seed a blank key (A4c)", () => {
  it("adds a unique non-empty header key on an http outbound", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("http-out");
    });
    render(<App />);

    const headersFieldset = within(screen.getByLabelText("Node inspector")).getByTestId("outbound-http-headers");
    fireEvent.click(within(headersFieldset).getByRole("button", { name: /Add header/ }));

    const http = useProjectStore.getState().config.outbounds?.find((outbound) => outbound.type === "http");
    const headers = (http?.headers ?? {}) as Record<string, unknown>;
    expect(Object.keys(headers)).not.toContain("");
    expect(Object.keys(headers).length).toBe(1);
    expect(Object.keys(headers)[0]).toBeTruthy();
  });
});
