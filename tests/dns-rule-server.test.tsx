import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A10a (C0-2): sing-box requires `server` for BOTH `route` and `evaluate` DNS-rule actions
// (dns/rule_action.md:37-41, :110-114). The Inspector gated the Server control to `route` only and
// the action-change handler wiped `server` for every non-route action — so `evaluate` could never
// carry a server through the UI even though the domain + graph edge already allow it.

function importDnsRule(action: string) {
  useProjectStore.getState().importJson(
    JSON.stringify({
      dns: {
        servers: [
          { type: "https", tag: "remote-doh", server: "1.1.1.1" },
          { type: "local", tag: "local-dns" },
        ],
        rules: [{ domain_suffix: ["cn"], action, server: "remote-doh" }],
      },
    }),
  );
}

describe("A10a — DNS rule server is settable for route and evaluate", () => {
  beforeEach(() => {
    useProjectStore.getState().importJson(JSON.stringify({}));
  });
  afterEach(() => {
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("shows the Server control for an evaluate action and edits persist", () => {
    importDnsRule("evaluate");
    render(<App />);
    fireEvent.click(screen.getByTestId("node-dns-rule:0"));

    const server = screen.getByLabelText("Server");
    expect(server).toBeInTheDocument();
    expect((server as HTMLSelectElement).value).toBe("remote-doh");

    fireEvent.change(server, { target: { value: "local-dns" } });
    expect(useProjectStore.getState().config.dns?.rules?.[0]?.server).toBe("local-dns");
  });

  it("keeps the server when switching route -> evaluate (both require it)", () => {
    importDnsRule("route");
    render(<App />);
    fireEvent.click(screen.getByTestId("node-dns-rule:0"));

    fireEvent.change(screen.getByLabelText("Action"), { target: { value: "evaluate" } });
    expect(useProjectStore.getState().config.dns?.rules?.[0]?.action).toBe("evaluate");
    expect(useProjectStore.getState().config.dns?.rules?.[0]?.server).toBe("remote-doh");
  });

  it("clears the server when switching to a non-server action (reject)", () => {
    importDnsRule("evaluate");
    render(<App />);
    fireEvent.click(screen.getByTestId("node-dns-rule:0"));

    fireEvent.change(screen.getByLabelText("Action"), { target: { value: "reject" } });
    expect(useProjectStore.getState().config.dns?.rules?.[0]?.action).toBe("reject");
    expect(useProjectStore.getState().config.dns?.rules?.[0]?.server).toBeUndefined();
  });
});
