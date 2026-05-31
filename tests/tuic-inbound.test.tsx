import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// U8 — inbound TUIC had no dedicated section: congestion_control / auth_timeout / zero_rtt_handshake /
// heartbeat were only reachable as unvalidated Advanced fields. Add a structured block mirroring the
// outbound tuic section (congestion_control via the schema-driven enum, auth_timeout + heartbeat duration
// text, zero_rtt_handshake toggle). All are base TUIC fields, so no version gate.

function openTuic(extra: Record<string, unknown> = {}) {
  useProjectStore.getState().importJson(
    JSON.stringify({
      inbounds: [
        {
          type: "tuic",
          tag: "tuicin",
          listen: "::",
          listen_port: 2080,
          users: [{ name: "u", uuid: "059032a9-7d40-4a96-9bb1-36823d848068", password: "x" }],
          tls: { enabled: true, server_name: "ex" },
          ...extra,
        },
      ],
    }),
  );
  render(<App />);
  fireEvent.click(screen.getByTestId("node-inbound:tuicin"));
}
const ib = () => useProjectStore.getState().config.inbounds?.[0] as Record<string, unknown> | undefined;

describe("U8 — inbound TUIC section", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("renders congestion_control as a schema enum (cubic/new_reno/bbr)", () => {
    openTuic();
    const cc = screen.getByLabelText(/Congestion Control/i) as HTMLSelectElement;
    const values = Array.from(cc.options).map((o) => o.value).filter(Boolean);
    expect(values).toEqual(["cubic", "new_reno", "bbr"]);
    fireEvent.change(cc, { target: { value: "bbr" } });
    expect(ib()?.congestion_control).toBe("bbr");
  });

  it("edits auth_timeout and heartbeat (duration strings)", () => {
    openTuic();
    fireEvent.change(screen.getByLabelText(/Auth Timeout/i), { target: { value: "5s" } });
    expect(ib()?.auth_timeout).toBe("5s");
    fireEvent.change(screen.getByLabelText(/Heartbeat/i), { target: { value: "15s" } });
    expect(ib()?.heartbeat).toBe("15s");
  });

  it("toggles zero_rtt_handshake", () => {
    openTuic();
    const zrtt = screen.getByLabelText(/0-RTT|Zero.?RTT|RTT Handshake/i) as HTMLInputElement;
    expect(zrtt.type).toBe("checkbox");
    fireEvent.click(zrtt);
    expect(ib()?.zero_rtt_handshake).toBe(true);
    fireEvent.click(zrtt);
    expect(ib()?.zero_rtt_handshake).toBeUndefined();
  });

  it("round-trips imported values into the controls", () => {
    openTuic({ congestion_control: "new_reno", auth_timeout: "4s", heartbeat: "20s", zero_rtt_handshake: true });
    expect((screen.getByLabelText(/Congestion Control/i) as HTMLSelectElement).value).toBe("new_reno");
    expect((screen.getByLabelText(/Auth Timeout/i) as HTMLInputElement).value).toBe("4s");
    expect((screen.getByLabelText(/Heartbeat/i) as HTMLInputElement).value).toBe("20s");
    expect((screen.getByLabelText(/0-RTT|Zero.?RTT|RTT Handshake/i) as HTMLInputElement).checked).toBe(true);
  });
});
