import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// L2-fix-shadowtls-version (audit H7): the ShadowTLS Version select labeled its empty option
// "(default — 3)", but per inbound/outbound shadowtls.md the version table marks `1` as the default
// when version is omitted. Relabeled to "(default — 1)".

describe("L2-fix-shadowtls-version — empty version reads as v1 (upstream default)", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("inbound: the empty Version option is labeled (default — 1), not (default — 3)", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({
        inbounds: [
          { type: "shadowtls", tag: "st", handshake: { server: "example.com", server_port: 443 }, users: [{ name: "u", password: "p" }] },
        ],
      }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-inbound:st"));
    const versionSelect = within(screen.getByTestId("node-inspector")).getByLabelText("Version");
    const emptyOption = versionSelect.querySelector('option[value=""]');
    expect(emptyOption?.textContent).toBe("(default — 1)");
    expect(emptyOption?.textContent).not.toContain("3");
  });
});
