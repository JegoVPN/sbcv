import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// R5: tls.certificate / key / ech.* are PEM line-arrays (shared/tls.md "certificate chain line array, in
// PEM format"). They were rendered as a comma-split CSV input (kind "list"), which mangled any pasted
// multi-line PEM block. They are now a newline-delimited textarea (kind "lines") that round-trips the PEM
// as the string[] of lines sing-box expects.

const PEM = ["-----BEGIN CERTIFICATE-----", "MIIBkTCBfoourbase64==", "-----END CERTIFICATE-----"];

describe("R5 — TLS PEM line-array editor", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("stores a pasted multi-line certificate PEM as a line array (not comma-mangled)", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ inbounds: [{ type: "http", tag: "in", listen: "::", listen_port: 443, tls: { enabled: true } }] }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-inbound:in"));
    const inspector = within(screen.getByTestId("node-inspector"));

    const textarea = inspector.getByLabelText("Certificate (PEM)");
    expect(textarea.tagName).toBe("TEXTAREA");
    fireEvent.change(textarea, { target: { value: PEM.join("\n") } });

    const tls = (useProjectStore.getState().config.inbounds![0] as Record<string, any>).tls;
    expect(tls.certificate).toEqual(PEM);
  });

  it("round-trips: an imported certificate line array displays as a PEM block in the textarea", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ inbounds: [{ type: "http", tag: "in", tls: { enabled: true, certificate: PEM } }] }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-inbound:in"));
    const inspector = within(screen.getByTestId("node-inspector"));

    expect((inspector.getByLabelText("Certificate (PEM)") as HTMLTextAreaElement).value).toBe(PEM.join("\n"));
  });

  it("displays an imported single-string certificate and converts it to a line array on edit", () => {
    // sing-box accepts both string and string[] for these fields (Listable[string]); an imported single
    // string must display intact, and editing normalizes to the canonical line array.
    const single = PEM.join("\n");
    useProjectStore.getState().importJson(
      JSON.stringify({ inbounds: [{ type: "http", tag: "in", tls: { enabled: true, certificate: single } }] }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-inbound:in"));
    const inspector = within(screen.getByTestId("node-inspector"));
    const textarea = inspector.getByLabelText("Certificate (PEM)") as HTMLTextAreaElement;
    expect(textarea.value).toBe(single);
    fireEvent.change(textarea, { target: { value: `${single}\nMIIextra==` } });
    const tls = (useProjectStore.getState().config.inbounds![0] as Record<string, any>).tls;
    expect(tls.certificate).toEqual([...PEM, "MIIextra=="]);
  });

  it("clears to undefined when emptied (no empty-string / empty-array noise)", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ inbounds: [{ type: "http", tag: "in", tls: { enabled: true, certificate: PEM } }] }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-inbound:in"));
    const inspector = within(screen.getByTestId("node-inspector"));
    fireEvent.change(inspector.getByLabelText("Certificate (PEM)"), { target: { value: "" } });

    const tls = (useProjectStore.getState().config.inbounds![0] as Record<string, any>).tls;
    expect(tls.certificate).toBeUndefined();
  });
});
