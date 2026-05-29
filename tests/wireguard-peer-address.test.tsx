import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { createEndpoint } from "../src/domain/commands";
import { useProjectStore } from "../src/state/useProjectStore";

// L2-fix-wireguard-peer (audit H1): a WireGuard endpoint peer used the keys `server`/`server_port`,
// but upstream (endpoint/wireguard.md) defines a peer as `address`/`port`. The old keys produced an
// invalid export (the peer had no address sing-box recognizes). Fixed the seed + the Inspector.

describe("L2-fix-wireguard-peer — peer uses upstream address/port", () => {
  it("seeds a peer with address/port, not server/server_port", () => {
    const ep = createEndpoint("wireguard", "wg") as unknown as Record<string, unknown>;
    const peer = (ep.peers as Record<string, unknown>[])[0]!;
    expect(peer.address).toBe("127.0.0.1");
    expect(peer.port).toBe(51820);
    expect(peer).not.toHaveProperty("server");
    expect(peer).not.toHaveProperty("server_port");
  });
});

describe("L2-fix-wireguard-peer — Inspector reads/writes the peer address", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("shows the peer address and persists edits to `address`", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({
        endpoints: [
          {
            type: "wireguard",
            tag: "wg",
            address: ["172.16.0.2/32"],
            private_key: "EEKlAzKfS87ShJPnvEF3AiJjGS9JHEzgn2jB3J7yMkY=",
            peers: [{ address: "9.9.9.9", port: 1234, public_key: "k", allowed_ips: ["0.0.0.0/0"] }],
          },
        ],
      }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-endpoint:wg"));
    // The peer row's Address input shows the upstream `address`, not a blank `server`.
    const peerAddress = screen.getByDisplayValue("9.9.9.9");
    fireEvent.change(peerAddress, { target: { value: "8.8.8.8" } });
    const ep = useProjectStore.getState().config.endpoints?.[0] as unknown as Record<string, unknown>;
    const peer = (ep.peers as Record<string, unknown>[])[0]!;
    expect(peer.address).toBe("8.8.8.8");
    expect(peer).not.toHaveProperty("server");
  });
});
