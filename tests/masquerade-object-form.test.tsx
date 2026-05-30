import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { parseConfigJson, stringifyConfig } from "../src/domain/serialization";
import { useProjectStore } from "../src/state/useProjectStore";

// R5 / assessment M1 — hysteria2 masquerade is string | object ({type:file|proxy|string,…}). The control
// only rendered the string form: the object form was invisible AND a stray keystroke replaced the object
// with a string (data loss). It now renders a JSON editor for the object form (round-trips, editable)
// and the URL input for the string/unset form.

function selectHysteria2(masquerade: unknown) {
  useProjectStore.getState().importJson(
    JSON.stringify({
      inbounds: [
        {
          type: "hysteria2",
          tag: "h2",
          listen: "127.0.0.1",
          listen_port: 2080,
          up_mbps: 100,
          down_mbps: 100,
          users: [{ name: "u", password: "p" }],
          tls: { enabled: true, server_name: "e" },
          ...(masquerade === undefined ? {} : { masquerade }),
        },
      ],
    }),
  );
  act(() => {
    useProjectStore.getState().setSelectedId("inbound:h2");
  });
}

function masqueradeOf() {
  return (useProjectStore.getState().config.inbounds![0] as Record<string, unknown>).masquerade;
}

describe("R5/M1 — hysteria2 masquerade object form", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("preserves an imported object-form masquerade (no data loss) and renders a JSON editor", () => {
    const obj = { type: "proxy", url: "http://127.0.0.1:8080", rewrite_host: true };
    selectHysteria2(obj);
    render(<App />);
    // The object form renders the JSON editor, not the URL input.
    const block = within(screen.getByTestId("inbound-hysteria2-masquerade"));
    expect(block.getByRole("textbox")).toBeInTheDocument();
    // Critically: the object is intact in the canonical config (not flattened to a string).
    expect(masqueradeOf()).toEqual(obj);
    const config = useProjectStore.getState().config;
    expect(parseConfigJson(stringifyConfig(config))).toEqual(config);
  });

  it("edits the object form through the JSON editor", () => {
    selectHysteria2({ type: "file", directory: "/var/www" });
    render(<App />);
    const textarea = within(screen.getByTestId("inbound-hysteria2-masquerade")).getByRole("textbox");
    fireEvent.change(textarea, {
      target: { value: JSON.stringify({ type: "file", directory: "/srv/site" }) },
    });
    expect(masqueradeOf()).toEqual({ type: "file", directory: "/srv/site" });
  });

  it("renders the URL input for the string form and edits it", () => {
    selectHysteria2("http://127.0.0.1:8080");
    render(<App />);
    const input = within(screen.getByTestId("inbound-hysteria2-masquerade")).getByRole("textbox");
    expect(input).toHaveValue("http://127.0.0.1:8080");
    fireEvent.change(input, { target: { value: "file:///var/www" } });
    expect(masqueradeOf()).toBe("file:///var/www");
  });
});
