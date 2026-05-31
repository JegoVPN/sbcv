import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// U15b — a DERP `verify_client_url` row is `{url, ...HTTP Client Fields}` (service/derp.md:53-65). The
// detour was a free-text input (typo-prone, no discovery of the available outbounds) and the remaining
// HTTP Client Fields (tls / headers / dial) were unreachable. Make detour an outbound <select> and add a
// per-row JSON editor for the remaining HTTP Client Fields.

function openDerp(rows: Array<Record<string, unknown> | string> = [{ url: "https://verify.example/check" }]) {
  useProjectStore.getState().setChannel("testing");
  useProjectStore.getState().importJson(
    JSON.stringify({
      outbounds: [{ type: "direct", tag: "proxy" }],
      services: [{ type: "derp", tag: "d", listen: "::", listen_port: 8443, config_path: "/derp", verify_client_url: rows }],
    }),
  );
  render(<App />);
  fireEvent.click(screen.getByTestId("node-service:d"));
  return within(screen.getByTestId("derp-verify-client-url"));
}
const row0 = () => (useProjectStore.getState().config.services?.[0] as Record<string, unknown>)?.verify_client_url as Record<string, unknown>[] | undefined;

describe("U15b — DERP verify_client_url detour select + HTTP Client Fields", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("renders the detour as an outbound <select> and writes the chosen tag", () => {
    const fs = openDerp();
    const detour = fs.getByLabelText("Detour") as HTMLSelectElement;
    expect(detour.tagName).toBe("SELECT");
    expect(Array.from(detour.options).map((o) => o.value)).toContain("proxy");
    fireEvent.change(detour, { target: { value: "proxy" } });
    expect(row0()?.[0]?.detour).toBe("proxy");
  });

  it("exposes the remaining HTTP Client Fields as a per-row JSON editor that round-trips", () => {
    const fs = openDerp([{ url: "https://v/c", tls: { insecure: true } }]);
    const editor = fs.getByLabelText(/HTTP Client Fields/i) as HTMLTextAreaElement;
    expect(editor.value).toContain("insecure");
    // url and detour are NOT duplicated into the advanced editor (it edits only the remaining fields)
    expect(editor.value).not.toContain("https://v/c");
    // editing the advanced JSON writes through while preserving url
    fireEvent.change(editor, { target: { value: '{"headers":{"X":"y"}}' } });
    expect(row0()?.[0]).toEqual({ url: "https://v/c", headers: { X: "y" } });
  });

  it("normalizes the `__URL__` string shorthand without corrupting or dropping the URL", () => {
    const fs = openDerp(["https://shorthand/c"]);
    // URL is shown in the structured input, not spread into character-index garbage in the JSON editor
    expect((fs.getByLabelText("URL") as HTMLInputElement).value).toBe("https://shorthand/c");
    const editor = fs.getByLabelText(/HTTP Client Fields/i) as HTMLTextAreaElement;
    expect(editor.value).not.toContain('"0"');
    // editing a structured field preserves the URL (no silent drop)
    fireEvent.change(fs.getByLabelText("Detour"), { target: { value: "proxy" } });
    expect(row0()?.[0]).toEqual({ url: "https://shorthand/c", detour: "proxy" });
  });
});
