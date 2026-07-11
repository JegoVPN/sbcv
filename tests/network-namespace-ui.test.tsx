import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { deriveGraph } from "../src/canvas/graph";
import { Inspector } from "../src/components/Inspector";
import { Palette } from "../src/components/Palette";
import { schemaRow } from "../src/domain/schemaRegistry";
import type { SingBoxChannel, SingBoxConfig } from "../src/domain/types";
import { useProjectStore } from "../src/state/useProjectStore";

function load(config: unknown, channel: SingBoxChannel) {
  act(() => {
    useProjectStore.getState().setChannel(channel);
    useProjectStore.getState().importJson(JSON.stringify(config));
    useProjectStore.getState().setChannel(channel);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  act(() => {
    useProjectStore.getState().setSelectedId(null);
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson("{}");
  });
});

describe("sing-box 1.14 network namespace UI", () => {
  it("registers default and unshare as testing-only 1.14 schema types", () => {
    expect(schemaRow("network-namespace", "default")).toMatchObject({
      channel: "testing",
      minVersion: "1.14",
      requiredFields: ["path"],
    });
    expect(schemaRow("network-namespace", "unshare")).toMatchObject({
      channel: "testing",
      minVersion: "1.14",
    });
  });

  it("gates both Library entries on stable and creates canonical resources on testing", () => {
    load({}, "stable");
    render(<Palette />);

    fireEvent.click(screen.getByRole("button", { name: /Library/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Network Namespaces/ }));
    expect(screen.getByRole("button", { name: "Default: Needs 1.14" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Unshare: Needs 1.14" })).toBeDisabled();

    act(() => useProjectStore.getState().setChannel("testing"));
    fireEvent.click(screen.getByRole("button", { name: "Add Default" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Unshare" }));

    expect(useProjectStore.getState().config.network_namespaces).toEqual([
      { type: "default", tag: "netns", path: "" },
      { type: "unshare", tag: "netns-unshare" },
    ]);
    expect(useProjectStore.getState().selectedId).toBe("network-namespace:netns-unshare");
  });

  it("renders type-specific Inspector fields and writes through canonical commands", () => {
    load(
      {
        network_namespaces: [{ type: "default", tag: "managed-ns", path: "/run/netns/managed" }],
      },
      "testing",
    );
    act(() => useProjectStore.getState().setSelectedId("network-namespace:managed-ns"));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Inspector />);

    expect(screen.getByLabelText("Tag")).toHaveValue("managed-ns");
    expect(screen.getByLabelText("Type")).toHaveValue("default");
    expect(screen.getByLabelText("Path (required)")).toHaveValue("/run/netns/managed");
    expect(screen.queryByLabelText("PID File")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "unshare" } });
    const pidFile = screen.getByLabelText("PID File");
    fireEvent.change(pidFile, { target: { value: "/tmp/sbc-netns.pid" } });

    expect(useProjectStore.getState().config.network_namespaces?.[0]).toEqual({
      type: "unshare",
      tag: "managed-ns",
      pid_file: "/tmp/sbc-netns.pid",
    });
  });

  it("normalizes an explicit empty namespace type without discarding its path", () => {
    load(
      {
        network_namespaces: [{ type: "", tag: "implicit-default", path: "/run/netns/implicit" }],
      },
      "testing",
    );
    act(() => useProjectStore.getState().setSelectedId("network-namespace:implicit-default"));
    render(<Inspector />);

    expect(screen.getByLabelText("Type")).toHaveValue("default");
    expect(screen.getByLabelText("Path (required)")).toHaveValue("/run/netns/implicit");
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "default" } });
    expect(useProjectStore.getState().config.network_namespaces?.[0]?.path).toBe("/run/netns/implicit");
  });

  it("offers arbitrary TUN netns values and keeps an existing value removable on stable", async () => {
    load(
      {
        network_namespaces: [{ type: "unshare", tag: "managed-ns" }],
        inbounds: [{ type: "tun", tag: "tun-in", address: ["172.19.0.1/30"], netns: "/run/netns/custom" }],
      },
      "testing",
    );
    act(() => useProjectStore.getState().setSelectedId("inbound:tun-in"));
    render(<Inspector />);

    const netns = screen.getByLabelText("TUN Network Namespace (Linux, 1.14+)");
    const datalistId = netns.getAttribute("list");
    expect(datalistId).toBeTruthy();
    expect(document.getElementById(datalistId!)?.querySelector('option[value="managed-ns"]')).not.toBeNull();

    fireEvent.change(netns, { target: { value: "/var/run/netns/arbitrary" } });
    expect(useProjectStore.getState().config.inbounds?.[0]?.netns).toBe("/var/run/netns/arbitrary");

    act(() => useProjectStore.getState().setChannel("stable"));
    const stableNetns = await screen.findByLabelText(/^TUN Network Namespace \(Linux, 1\.14\+\)/);
    expect(stableNetns).toHaveValue("/var/run/netns/arbitrary");
    expect(
      screen.getByText("Requires sing-box 1.14 testing. Clear this value to make the TUN inbound stable-compatible."),
    ).toBeInTheDocument();
    fireEvent.change(stableNetns, { target: { value: "" } });
    expect(useProjectStore.getState().config.inbounds?.[0]?.netns).toBeUndefined();
    await waitFor(() => {
      expect(screen.getByLabelText(/^TUN Network Namespace \(Linux, 1\.14\+\)/)).toBeDisabled();
    });
  });

  it("keeps Dial netns free-form while suggesting managed namespace tags", () => {
    load(
      {
        network_namespaces: [{ type: "unshare", tag: "managed-ns" }],
        outbounds: [{ type: "socks", tag: "proxy", server: "127.0.0.1", server_port: 1080 }],
      },
      "testing",
    );
    act(() => useProjectStore.getState().setSelectedId("outbound:proxy"));
    render(<Inspector />);

    const netns = screen.getByLabelText("Network Namespace (Linux, 1.12+)");
    const datalistId = netns.getAttribute("list");
    expect(document.getElementById(datalistId!)?.querySelector('option[value="managed-ns"]')).not.toBeNull();

    fireEvent.change(netns, { target: { value: "blue" } });
    expect(useProjectStore.getState().config.outbounds?.[0]?.netns).toBe("blue");
  });

  it("derives standalone resource nodes from canonical network_namespaces", () => {
    const config: SingBoxConfig = {
      network_namespaces: [
        { type: "default", tag: "existing-ns", path: "blue" },
        { type: "unshare", tag: "rootless-ns", pid_file: "/tmp/rootless.pid" },
      ],
    };
    const { nodes } = deriveGraph(config, { positions: {} }, [], "testing");

    expect(nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "network-namespace:existing-ns",
          data: expect.objectContaining({ kind: "network-namespace", type: "default", subtitle: "blue" }),
        }),
        expect.objectContaining({
          id: "network-namespace:rootless-ns",
          data: expect.objectContaining({ kind: "network-namespace", type: "unshare", subtitle: "PID file · /tmp/rootless.pid" }),
        }),
      ]),
    );
  });

  it("remaps selection and layout only for the renamed entity kind", () => {
    load(
      {
        network_namespaces: [{ type: "default", tag: "blue", path: "blue" }],
        outbounds: [{ type: "direct", tag: "blue" }],
      },
      "testing",
    );
    act(() => {
      useProjectStore.setState({
        selectedId: "outbound:blue",
        focusedNodeId: "network-namespace:blue",
        layout: {
          positions: {
            "outbound:blue": { x: 10, y: 20 },
            "network-namespace:blue": { x: 30, y: 40 },
          },
        },
      });
      useProjectStore.getState().renameTag("network-namespace", "blue", "green");
    });

    const state = useProjectStore.getState();
    expect(state.selectedId).toBe("outbound:blue");
    expect(state.focusedNodeId).toBe("network-namespace:green");
    expect(state.layout.positions).toEqual({
      "outbound:blue": { x: 10, y: 20 },
      "network-namespace:green": { x: 30, y: 40 },
    });
  });
});
