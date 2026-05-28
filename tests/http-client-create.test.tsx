import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { addHttpClient } from "../src/domain/commands";
import { sharedGroupsForEntity } from "../src/domain/sharedFieldRegistry";
import type { SingBoxConfig } from "../src/domain/types";
import { useProjectStore } from "../src/state/useProjectStore";

// A22-create (C1-18/19, C2-4): the top-level http_clients[] node is creatable on the testing channel
// (gated on stable), and an http-client entity exposes its shared TLS / HTTP2 / Dial cards.

describe("A22-create — http_clients[] is creatable + editable on testing", () => {
  it("addHttpClient appends a tagged entry", () => {
    const out = addHttpClient({} as SingBoxConfig) as SingBoxConfig;
    expect(out.http_clients?.length).toBe(1);
    expect(typeof out.http_clients?.[0]?.tag).toBe("string");
  });

  it("an http-client entity gets the TLS/HTTP2/Dial shared groups", () => {
    const groups = sharedGroupsForEntity({ kind: "http-client", tag: "hc" }, null, "testing");
    expect(groups).toEqual(expect.arrayContaining(["tls", "http2", "dial"]));
  });

  describe("Palette + Inspector", () => {
    beforeEach(() => {
      useProjectStore.getState().importJson(JSON.stringify({}));
      useProjectStore.getState().setChannel("testing");
    });
    afterEach(() => {
      useProjectStore.getState().setChannel("stable");
      useProjectStore.getState().importJson(JSON.stringify({}));
    });

    it("creates an http-client node from the Palette on testing and opens its Inspector", () => {
      useProjectStore.getState().loadMinimal();
      useProjectStore.getState().setChannel("testing");
      render(<App />);
      const palette = within(screen.getByLabelText("Node palette"));
      fireEvent.click(palette.getByRole("button", { name: /Library/ }));
      fireEvent.click(palette.getByRole("button", { name: /^HTTP Clients/ }));
      fireEvent.click(palette.getByRole("button", { name: "Setup HTTP Client" }));

      expect(useProjectStore.getState().config.http_clients?.length).toBe(1);
      const inspector = within(screen.getByLabelText("Node inspector"));
      // The shared HTTP-client object surfaces its TLS card.
      expect(inspector.getByText("TLS")).toBeInTheDocument();
    });
  });
});
