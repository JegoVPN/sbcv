import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { deriveGraph } from "../src/canvas/graph";
import type { SingBoxConfig } from "../src/domain/types";
import { useProjectStore } from "../src/state/useProjectStore";

// DF5 — low-risk display-precision batch (each item independent).

function subtitleOf(config: unknown, id: string): string | undefined {
  const { nodes } = deriveGraph(config as SingBoxConfig, { positions: {} }, []);
  return nodes.find((node) => node.id === id)?.data.subtitle;
}

describe("DF5 — display precision", () => {
  beforeEach(() => {
    useProjectStore.getState().importJson(JSON.stringify({}));
    useProjectStore.getState().setChannel("stable");
  });
  afterEach(() => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  // DF5a — an unset DNS server_port previously filled the protocol default (443/853) into `value`, so it
  // read as a concrete configured port. Show it as a placeholder hint instead, value empty.
  it("DNS tls Port shows empty value + default placeholder when server_port is unset", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ dns: { servers: [{ type: "tls", tag: "dot", server: "1.1.1.1" }] } }),
    );
    act(() => {
      useProjectStore.getState().setSelectedId("dns-server:dot");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));
    const port = inspector.getByLabelText("Port") as HTMLInputElement;
    expect(port.value).toBe("");
    expect(port.placeholder).toBe("853");
    expect((useProjectStore.getState().config.dns?.servers?.[0] as Record<string, unknown>).server_port).toBeUndefined();
  });

  // DF5b — WireGuard `address` is the LOCAL tunnel address, not the server. The subtitle read like a
  // server, so mark it as local.
  it("WireGuard subtitle marks the address as the local tunnel address", () => {
    expect(subtitleOf({ endpoints: [{ type: "wireguard", tag: "wg", address: ["10.0.0.2/32"] }] }, "endpoint:wg")).toBe(
      "wireguard local 10.0.0.2/32",
    );
    // No address still falls back to the generic label.
    expect(subtitleOf({ endpoints: [{ type: "wireguard", tag: "wg" }] }, "endpoint:wg")).toBe("wireguard endpoint");
  });

  // DF5c — WireGuard `system` (system TUN stack vs gVisor userspace) was a bare unexplained Advanced
  // toggle. Promote it to a named, annotated control.
  it("WireGuard system is a named control, not a bare Advanced toggle", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ endpoints: [{ type: "wireguard", tag: "wg", address: ["10.0.0.2/32"], system: true }] }),
    );
    act(() => {
      useProjectStore.getState().setSelectedId("endpoint:wg");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));
    const sys = within(inspector.getByTestId("wireguard-system")).getByRole("checkbox") as HTMLInputElement;
    expect(sys.checked).toBe(true);
    fireEvent.click(sys);
    expect(useProjectStore.getState().config.endpoints?.[0]?.system).toBeUndefined();
    fireEvent.click(sys);
    expect(useProjectStore.getState().config.endpoints?.[0]?.system).toBe(true);
  });

  // DF5d — a logical DNS rule's nested rule_set refs never produced edges (the loop read only the
  // top-level rule.rule_set). Traverse nested rules so the edge appears.
  it("a logical DNS rule's nested rule_set generates a rule-set edge", () => {
    const config = {
      dns: {
        servers: [{ type: "local", tag: "local" }],
        rules: [
          { type: "logical", mode: "and", rules: [{ rule_set: "geosite-cn" }, { domain: ["example.com"] }], server: "local" },
        ],
      },
      route: {
        rule_set: [{ tag: "geosite-cn", type: "remote", format: "binary", url: "https://example.com/x.srs", download_detour: "direct" }],
      },
      outbounds: [{ type: "direct", tag: "direct" }],
    } as unknown as SingBoxConfig;
    const { edges } = deriveGraph(config, { positions: {} }, []);
    const hit = edges.find((e) => e.source === "dns-rule:0" && e.target === "rule-set:geosite-cn");
    expect(hit).toBeTruthy();
  });
});
