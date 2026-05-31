import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// U1 — the http_client migration loop. On testing, a remote rule-set's inspector steers the user off the
// deprecated `download_detour` toward an HTTP Client, but the HTTP Client <select> showed only "None" with
// no way to populate it from a fresh project — a dead-end migration. The fix is a discoverability
// affordance: a "Create HTTP Client" button next to the select that appends a top-level http_clients[]
// entry and wires this rule-set's `http_client` to its tag, staying on the rule-set. The data model
// (http_client = a tag ref into http_clients[]) is unchanged; serialization is untouched.

const REMOTE_RULE_SET_CONFIG = {
  route: {
    rules: [],
    rule_set: [
      { tag: "geosite", type: "remote", format: "binary", url: "https://x/geosite.srs", download_detour: "proxy" },
    ],
  },
  outbounds: [{ type: "direct", tag: "proxy" }],
};

describe("U1 — HTTP Client create affordance", () => {
  beforeEach(() => {
    useProjectStore.getState().importJson(JSON.stringify({}));
  });
  afterEach(() => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("Test A — testing, empty http_clients: shows the button + empty-state hint, creates and wires a client without losing the rule-set selection", () => {
    useProjectStore.getState().setChannel("testing");
    useProjectStore.getState().importJson(JSON.stringify(REMOTE_RULE_SET_CONFIG));
    render(<App />);
    fireEvent.click(screen.getByTestId("node-rule-set:geosite"));

    // The empty-state hint steers the user (no clients defined yet).
    expect(screen.getByText(/no http clients defined yet/i)).toBeTruthy();

    const button = screen.getByRole("button", { name: /create http client/i });
    expect(button).toBeTruthy();

    fireEvent.click(button);

    const config = useProjectStore.getState().config;
    expect(config.http_clients).toBeTruthy();
    expect(config.http_clients).toHaveLength(1);
    const newTag = config.http_clients?.[0]?.tag;
    expect(newTag).toBeTruthy();
    expect(config.route?.rule_set?.[0]?.http_client).toBe(newTag);

    // Selection stays on the rule-set — we do NOT navigate to the new http-client node.
    expect(useProjectStore.getState().selectedId).toBe("rule-set:geosite");
  });

  it("Test B — stable: the http-client card (and its create button) is not rendered even with an existing client", () => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(
      JSON.stringify({
        ...REMOTE_RULE_SET_CONFIG,
        http_clients: [{ tag: "doh" }],
      }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-rule-set:geosite"));

    expect(screen.queryByRole("button", { name: /create http client/i })).toBeNull();
  });

  it("Test C — testing, existing client: the select lists the tag and choosing it sets http_client (no regression)", () => {
    useProjectStore.getState().setChannel("testing");
    useProjectStore.getState().importJson(
      JSON.stringify({
        ...REMOTE_RULE_SET_CONFIG,
        http_clients: [{ tag: "doh" }],
      }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-rule-set:geosite"));

    const select = screen.getByLabelText("HTTP Client") as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
    expect(Array.from(select.options).map((o) => o.value)).toContain("doh");

    fireEvent.change(select, { target: { value: "doh" } });
    expect(useProjectStore.getState().config.route?.rule_set?.[0]?.http_client).toBe("doh");
  });
});
