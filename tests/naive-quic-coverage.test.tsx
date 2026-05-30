import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";
import { outboundHandledFields } from "../src/components/inspector/handledFields";

// W8 (naive coverage) — `quic` (boolean) and `insecure_concurrency` (number) are documented naive
// outbound fields (outbound/naive.md) that were unmodeled — the only RED field when reconstructing a
// real tuic/anytls/naive subscription config purely via the GUI. They now have structured controls.

function naive() {
  return useProjectStore.getState().config.outbounds?.[0] as Record<string, unknown>;
}

describe("W8 — naive quic / insecure_concurrency reachable from a structured control", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("marks both keys handled (excluded from the Advanced fallback)", () => {
    expect(outboundHandledFields.has("quic")).toBe(true);
    expect(outboundHandledFields.has("insecure_concurrency")).toBe(true);
  });

  it("toggles quic and edits insecure_concurrency via the structured controls", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({
        outbounds: [
          { type: "naive", tag: "n", server: "1.2.3.4", server_port: 443, username: "u", password: "p", tls: { enabled: true, server_name: "x" } },
        ],
      }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-outbound:n"));

    fireEvent.click(screen.getByLabelText(/Enable QUIC transport/i));
    expect(naive().quic).toBe(true);

    fireEvent.change(screen.getByLabelText("Insecure concurrency"), { target: { value: "4" } });
    expect(naive().insecure_concurrency).toBe(4);
  });
});
