import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import {
  endpointHandledFieldsForChannel,
  inboundHandledFieldsForChannel,
} from "../src/components/inspector/handledFields";
import { validateConfig } from "../src/domain/diagnostics";
import { sharedGroupsFromTable } from "../src/domain/schemaRegistry";
import type { SingBoxConfig } from "../src/domain/types";
import { useProjectStore } from "../src/state/useProjectStore";

const wireGuard = {
  type: "wireguard",
  tag: "wg-ep",
  system: false,
  name: "wg0",
  mtu: 1408,
  address: ["172.16.0.2/32"],
  private_key: "EEKlAzKfS87ShJPnvEF3AiJjGS9JHEzgn2jB3J7yMkY=",
  peers: [
    {
      address: "127.0.0.1",
      port: 51820,
      public_key: "tM4NaeCZrzxQ6BfhyeuQMy5jDReji4o8h5LVAGpI1HQ=",
      allowed_ips: ["0.0.0.0/0"],
    },
  ],
  udp_timeout: "5m",
};

function configWithUdpNat(): SingBoxConfig {
  return {
    inbounds: [
      { type: "tun", tag: "tun-in", address: ["172.19.0.1/30"], auto_route: true },
      { type: "tproxy", tag: "tproxy-in", listen: "127.0.0.1", listen_port: 7893 },
    ],
    endpoints: [wireGuard],
  } as unknown as SingBoxConfig;
}

describe("sing-box 1.14 shared UDP NAT fields", () => {
  beforeEach(() => {
    useProjectStore.getState().setTarget("1.14-testing");
    useProjectStore.getState().importJson(JSON.stringify(configWithUdpNat()));
  });

  afterEach(() => {
    useProjectStore.getState().setTarget("1.13-stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("attaches the testing-only group to TUN, TProxy, and WireGuard", () => {
    for (const [kind, type] of [
      ["inbound", "tun"],
      ["inbound", "tproxy"],
      ["endpoint", "wireguard"],
    ] as const) {
      expect(sharedGroupsFromTable(kind, type, "stable")).not.toContain("udp-nat");
      expect(sharedGroupsFromTable(kind, type, "testing")).toContain("udp-nat");
    }

    expect(inboundHandledFieldsForChannel("stable")).not.toContain("udp_mapping");
    expect(inboundHandledFieldsForChannel("testing")).toContain("udp_mapping");
    expect(endpointHandledFieldsForChannel("stable")).not.toContain("udp_timeout");
    expect(endpointHandledFieldsForChannel("testing")).toContain("udp_timeout");
  });

  it("edits each supported parent through canonical config commands", () => {
    render(<App />);

    fireEvent.click(screen.getByTestId("node-inbound:tun-in"));
    fireEvent.change(screen.getByLabelText("UDP Mapping"), { target: { value: "address_dependent" } });
    fireEvent.change(screen.getByLabelText("UDP Filtering"), {
      target: { value: "address_and_port_dependent" },
    });
    const tunMax = screen.getByLabelText(/^UDP NAT Max/) as HTMLInputElement;
    expect(tunMax.min).toBe("0");
    expect(tunMax.step).toBe("1");
    fireEvent.change(tunMax, { target: { value: "8192" } });
    expect(useProjectStore.getState().config.inbounds?.[0]).toMatchObject({
      udp_mapping: "address_dependent",
      udp_filtering: "address_and_port_dependent",
      udp_nat_max: 8192,
    });

    fireEvent.click(screen.getByTestId("node-inbound:tproxy-in"));
    fireEvent.change(screen.getByLabelText("UDP Mapping"), { target: { value: "endpoint_independent" } });
    expect(useProjectStore.getState().config.inbounds?.[1]).toMatchObject({
      udp_mapping: "endpoint_independent",
    });

    fireEvent.click(screen.getByTestId("node-endpoint:wg-ep"));
    fireEvent.change(screen.getByLabelText("UDP Timeout"), { target: { value: "10m" } });
    fireEvent.change(screen.getByLabelText("UDP Filtering"), { target: { value: "address_dependent" } });
    expect(useProjectStore.getState().config.endpoints?.[0]).toMatchObject({
      udp_timeout: "10m",
      udp_filtering: "address_dependent",
    });
  });

  it("keeps imported testing fields reachable on stable while hiding the testing card", () => {
    useProjectStore.getState().setTarget("1.13-stable");
    useProjectStore.getState().importJson(JSON.stringify({
      inbounds: [
        {
          type: "tun",
          tag: "tun-in",
          address: ["172.19.0.1/30"],
          udp_mapping: "address_dependent",
        },
      ],
    }));
    render(<App />);
    fireEvent.click(screen.getByTestId("node-inbound:tun-in"));

    expect(screen.queryByText("UDP NAT")).toBeNull();
    fireEvent.click(screen.getByText("Advanced fields", { exact: false }));
    const fallback = screen.getByLabelText(/UDP Mapping/i);
    fireEvent.change(fallback, { target: { value: "endpoint_independent" } });
    expect(useProjectStore.getState().config.inbounds?.[0]?.udp_mapping).toBe("endpoint_independent");
  });

  it("blocks testing-only fields on stable and validates testing enum/uint32 shape", () => {
    const config = {
      inbounds: [
        {
          type: "tun",
          tag: "tun-in",
          address: ["172.19.0.1/30"],
          udp_mapping: "address_dependent",
          udp_filtering: "endpoint_independent",
          udp_nat_max: 8192,
        },
      ],
    } as unknown as SingBoxConfig;
    const stableHits = validateConfig(config, "stable", "1.13").filter((item) => item.code === "version-invalid");
    expect(stableHits.map((item) => item.path)).toEqual([
      "/inbounds/0/udp_mapping",
      "/inbounds/0/udp_filtering",
      "/inbounds/0/udp_nat_max",
    ]);
    expect(validateConfig(config, "testing", "1.14").filter((item) => item.level === "error")).toEqual([]);

    const invalidEnum = structuredClone(config);
    (invalidEnum.inbounds![0] as Record<string, unknown>).udp_mapping = "invalid";
    expect(validateConfig(invalidEnum, "testing", "1.14")).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "enum-invalid", path: "/inbounds/0/udp_mapping" })]),
    );

    for (const value of [-1, 1.5]) {
      const invalidMax = structuredClone(config);
      (invalidMax.inbounds![0] as Record<string, unknown>).udp_nat_max = value;
      expect(validateConfig(invalidMax, "testing", "1.14")).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "number-invalid", path: "/inbounds/0/udp_nat_max" })]),
      );
    }
  });
});
