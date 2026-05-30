import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { parseConfigJson, stringifyConfig } from "../src/domain/serialization";
import { useProjectStore } from "../src/state/useProjectStore";

// M2 — the log/ntp/certificate/experimental/route/dns singletons + route/dns rule inspectors gained the
// Advanced (scalar + JSON) fallback, restoring the "no field silently unreachable" invariant. An
// unmodeled object key (e.g. experimental.v2ray_api) is now visible + editable inside the node, not
// JSON-only / invisible.

function selectNode(config: object, id: string) {
  useProjectStore.getState().importJson(JSON.stringify(config));
  act(() => {
    useProjectStore.getState().setSelectedId(id);
  });
}

describe("M2 — singleton Advanced fallback", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("surfaces an unmodeled experimental key (v2ray_api) in the Advanced JSON fallback, editable + round-tripping", () => {
    selectNode(
      { experimental: { v2ray_api: { listen: "127.0.0.1:8080", stats: { enabled: true } } } },
      "settings:experimental",
    );
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));
    // The unmodeled object key is now rendered (Advanced JSON fallback), not invisible.
    const editor = inspector.getByText("V2ray Api");
    expect(editor).toBeInTheDocument();
    // It round-trips and is preserved in canonical config.
    const config = useProjectStore.getState().config;
    expect((config.experimental as Record<string, unknown>).v2ray_api).toEqual({
      listen: "127.0.0.1:8080",
      stats: { enabled: true },
    });
    expect(parseConfigJson(stringifyConfig(config))).toEqual(config);

    // It renders inside the Advanced JSON fallback (a real editor), not invisibly dropped.
    const editorTextarea = within(screen.getByLabelText("Node inspector"))
      .getAllByRole("textbox")
      .find((el) => (el as HTMLTextAreaElement).value.includes("127.0.0.1:8080"));
    expect(editorTextarea, "v2ray_api JSON editor should be present").toBeTruthy();
  });

  it("keeps route.default_http_client reachable on STABLE (its control is testing-only)", () => {
    // default_http_client's only control is the http-client shared card, added to route only on testing.
    // On the default stable channel an imported value must still be reachable via the Advanced fallback.
    selectNode(
      { route: { final: "direct", default_http_client: "hc1" }, outbounds: [{ type: "direct", tag: "direct" }] },
      "route:main",
    );
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));
    expect(inspector.getByText(/Default Http Client/i)).toBeInTheDocument();
    expect((useProjectStore.getState().config.route as Record<string, unknown>).default_http_client).toBe("hc1");
  });

  it("surfaces an unmodeled route key in the Advanced fallback", () => {
    selectNode({ route: { final: "direct", some_unmodeled_flag: true }, outbounds: [{ type: "direct", tag: "direct" }] }, "route:main");
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));
    // unmodeled scalar boolean shows as an Advanced toggle (labelForField → "Some Unmodeled Flag")
    expect(inspector.getByText(/Some Unmodeled Flag/i)).toBeInTheDocument();
  });
});
