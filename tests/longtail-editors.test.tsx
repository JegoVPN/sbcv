import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { parseConfigJson, stringifyConfig } from "../src/domain/serialization";
import { useProjectStore } from "../src/state/useProjectStore";

// V5-S2 — two long-tail structured editors that previously forced raw JSON:
// trojan fallback_for_alpn (map of alpn → {server, server_port}) and wireguard peers[].reserved.

function selectNode(config: object, id: string) {
  useProjectStore.getState().importJson(JSON.stringify(config));
  act(() => {
    useProjectStore.getState().setSelectedId(id);
  });
}

function roundTrips() {
  const config = useProjectStore.getState().config;
  expect(parseConfigJson(stringifyConfig(config))).toEqual(config);
}

describe("V5-S2 — trojan fallback_for_alpn editor", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("adds an ALPN fallback row and writes the map, then round-trips", () => {
    selectNode(
      {
        inbounds: [
          {
            type: "trojan",
            tag: "t",
            listen: "127.0.0.1",
            listen_port: 2080,
            users: [{ name: "u", password: "p" }],
            tls: { enabled: true, server_name: "e" },
          },
        ],
      },
      "inbound:t",
    );
    render(<App />);
    const block = within(screen.getByTestId("inbound-trojan-fallback-for-alpn"));

    fireEvent.click(block.getByRole("button", { name: "Add ALPN fallback" }));
    // Default key is "h2"; fill server + port.
    fireEvent.change(within(screen.getByTestId("inbound-trojan-fallback-for-alpn")).getByPlaceholderText("127.0.0.1"), {
      target: { value: "10.0.0.9" },
    });
    fireEvent.change(within(screen.getByTestId("inbound-trojan-fallback-for-alpn")).getByPlaceholderText("8081"), {
      target: { value: "8443" },
    });

    const trojan = useProjectStore.getState().config.inbounds![0] as Record<string, unknown>;
    expect(trojan.fallback_for_alpn).toEqual({ h2: { server: "10.0.0.9", server_port: 8443 } });
    roundTrips();
  });

  it("renames the ALPN key on blur without losing the target", () => {
    selectNode(
      {
        inbounds: [
          {
            type: "trojan",
            tag: "t",
            listen: "127.0.0.1",
            listen_port: 2080,
            tls: { enabled: true, server_name: "e" },
            fallback_for_alpn: { h2: { server: "1.1.1.1", server_port: 80 } },
          },
        ],
      },
      "inbound:t",
    );
    render(<App />);
    const keyInput = within(screen.getByTestId("inbound-trojan-fallback-for-alpn")).getByDisplayValue("h2");
    fireEvent.change(keyInput, { target: { value: "http/1.1" } });
    fireEvent.blur(keyInput);

    const trojan = useProjectStore.getState().config.inbounds![0] as Record<string, unknown>;
    expect(trojan.fallback_for_alpn).toEqual({ "http/1.1": { server: "1.1.1.1", server_port: 80 } });
  });
});

describe("V5-S2 — wireguard peer reserved editor", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("edits peers[0].reserved into a 3-int array and round-trips", () => {
    selectNode(
      {
        endpoints: [
          {
            type: "wireguard",
            tag: "wg",
            address: ["10.0.0.2/32"],
            private_key: "k",
            peers: [{ address: "1.2.3.4", port: 51820, public_key: "pk", allowed_ips: ["0.0.0.0/0"] }],
          },
        ],
      },
      "endpoint:wg",
    );
    render(<App />);

    fireEvent.change(within(screen.getByTestId("wireguard-peer-reserved-0")).getByRole("textbox"), {
      target: { value: "1, 2, 3" },
    });

    const peer = (useProjectStore.getState().config.endpoints![0] as Record<string, unknown>).peers as Record<string, unknown>[];
    expect(peer[0]!.reserved).toEqual([1, 2, 3]);
    roundTrips();
  });
});
