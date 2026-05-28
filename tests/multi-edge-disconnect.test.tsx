import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A8-multiedge (Codex C1-7, C1-8, C1-23), resolving the A0 stub.
// CanvasWorkspace.edgeByPort maps each port to the FIRST edge only, so the per-port disconnect control on a
// one-to-many "aggregate" relation port (a selector's "outbound-member" output, or a member's
// "selector-group" input) could only ever remove the first reference. A8-multiedge marks those relations
// aggregate (portRelationRegistry.AGGREGATE_RELATION_IDS) and suppresses the ambiguous per-port disconnect
// on both ends; a specific reference is removed via the Inspector candidate list (complete, immune to the
// canvas edge cap) or the per-edge remove for a rendered edge.

function renderSelectorWithTwoMembers() {
  useProjectStore.getState().importJson(JSON.stringify({
    outbounds: [
      { type: "direct", tag: "hk" },
      { type: "direct", tag: "jp" },
      { type: "selector", tag: "proxy", outbounds: ["hk", "jp"] },
    ],
  }));
  render(<App />);
}

function renderSelectorWithEndpointMember() {
  useProjectStore.getState().importJson(JSON.stringify({
    endpoints: [{ type: "wireguard", tag: "wg", address: ["172.16.0.2/32"], private_key: "test", peers: [] }],
    outbounds: [{ type: "selector", tag: "proxy", outbounds: ["wg"] }],
  }));
  render(<App />);
}

function renderAggregateServiceRelations() {
  useProjectStore.getState().importJson(JSON.stringify({
    endpoints: [
      { type: "tailscale", tag: "ts-a" },
      { type: "tailscale", tag: "ts-b" },
    ],
    inbounds: [
      { type: "shadowsocks", tag: "ss-a", listen: "127.0.0.1", listen_port: 1080, method: "2022-blake3-aes-128-gcm", password: "pw", managed: true },
      { type: "shadowsocks", tag: "ss-b", listen: "127.0.0.1", listen_port: 1081, method: "2022-blake3-aes-128-gcm", password: "pw", managed: true },
    ],
    services: [
      { type: "derp", tag: "derp", verify_client_endpoint: ["ts-a", "ts-b"] },
      { type: "ssm-api", tag: "ssm", servers: { "/": "ss-a", "/managed": "ss-b" } },
    ],
  }));
  render(<App />);
}

function selectorMembers(): string[] {
  return (useProjectStore.getState().config.outbounds?.find((entry) => entry.tag === "proxy")?.outbounds as string[]) ?? [];
}

describe("multi-edge disconnect targets a specific reference (A8-multiedge; C1-7/8/23)", () => {
  it("harness: the selector starts with two members", () => {
    renderSelectorWithTwoMembers();
    expect(selectorMembers()).toEqual(["hk", "jp"]);
  });

  it("suppresses the ambiguous aggregate per-port disconnect controls on both ends", () => {
    renderSelectorWithTwoMembers();
    expect(screen.queryAllByLabelText("Disconnect Downstream candidate from proxy")).toHaveLength(0);
    expect(screen.queryAllByLabelText("Disconnect Upstream Selector candidate for hk")).toHaveLength(0);
    expect(screen.queryAllByLabelText("Disconnect Upstream Selector candidate for jp")).toHaveLength(0);
  });

  it("removes the intended specific member via the Inspector candidate list", () => {
    renderSelectorWithTwoMembers();
    fireEvent.click(screen.getByTestId("node-outbound:proxy"));
    const checklist = screen.getByTestId("candidate-checklist");
    fireEvent.click(within(checklist).getByRole("checkbox", { name: "jp" }));
    expect(selectorMembers()).toEqual(["hk"]);
  });

  it("keeps endpoint selector members removable from the Inspector candidate list", () => {
    renderSelectorWithEndpointMember();
    fireEvent.click(screen.getByTestId("node-outbound:proxy"));
    const checklist = screen.getByTestId("candidate-checklist");
    expect(within(checklist).getByRole("checkbox", { name: "wg" })).toBeChecked();
    fireEvent.click(within(checklist).getByRole("checkbox", { name: "wg" }));
    expect(selectorMembers()).toEqual([]);
  });

  it("suppresses ambiguous aggregate service relation disconnect controls", () => {
    renderAggregateServiceRelations();
    expect(screen.queryAllByLabelText("Disconnect Verify client endpoint from derp")).toHaveLength(0);
    expect(screen.queryAllByLabelText("Disconnect Upstream DERP service for ts-a")).toHaveLength(0);
    expect(screen.queryAllByLabelText("Disconnect Upstream DERP service for ts-b")).toHaveLength(0);
    expect(screen.queryAllByLabelText("Disconnect SSM API service from ss-a")).toHaveLength(0);
    expect(screen.queryAllByLabelText("Disconnect SSM API service from ss-b")).toHaveLength(0);
    expect(screen.queryAllByLabelText("Disconnect Managed Shadowsocks inbound for ssm")).toHaveLength(0);
  });
});
