import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// C1 (G1): every documented V2Ray transport sub-field is editable from the inspector's V2Ray
// Transport card — headers map, http.method, ws.max_early_data / ws.early_data_header_name,
// grpc.permit_without_stream — instead of being silently unreachable. Per-variant visibility:
// http/ws/grpc/httpupgrade reveal their documented fields; quic reveals only Type.
// Source: docs/upstream/sing-box/stable/configuration/shared/v2ray-transport.md.

function importOutbound(transport: unknown) {
  useProjectStore.getState().importJson(
    JSON.stringify({
      outbounds: [
        { type: "vmess", tag: "v", server: "127.0.0.1", server_port: 443, uuid: "bf000d23-0752-40b4-affe-68f7707a9661", transport },
      ],
    }),
  );
}

function transportOf(): Record<string, unknown> {
  const out = useProjectStore.getState().config.outbounds?.find((o) => (o as { tag?: string }).tag === "v") as Record<string, unknown>;
  return (out.transport as Record<string, unknown>) ?? {};
}

describe("C1 — V2Ray transport sub-fields", () => {
  beforeEach(() => {
    useProjectStore.getState().importJson(JSON.stringify({}));
  });
  afterEach(() => {
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  function selectNode() {
    render(<App />);
    fireEvent.click(screen.getByTestId("node-outbound:v"));
  }

  describe("per-variant field visibility", () => {
    it("http reveals Method + Headers, not ws/grpc fields", () => {
      importOutbound({ type: "http", host: ["e.com"], path: "/" });
      selectNode();
      expect(screen.getByText("Method")).toBeTruthy();
      expect(screen.getByText("Headers")).toBeTruthy();
      expect(screen.queryByText("Max Early Data")).toBeNull();
      expect(screen.queryByText("Permit Without Stream")).toBeNull();
    });

    it("ws reveals Max Early Data + Early Data Header Name + Headers, not Method/Service Name", () => {
      importOutbound({ type: "ws", path: "/" });
      selectNode();
      expect(screen.getByText("Max Early Data")).toBeTruthy();
      expect(screen.getByText("Early Data Header Name")).toBeTruthy();
      expect(screen.getByText("Headers")).toBeTruthy();
      expect(screen.queryByText("Method")).toBeNull();
      expect(screen.queryByText("Service Name")).toBeNull();
    });

    it("grpc reveals Permit Without Stream + Service Name, not Headers/Method", () => {
      importOutbound({ type: "grpc", service_name: "svc" });
      selectNode();
      expect(screen.getByText("Permit Without Stream")).toBeTruthy();
      expect(screen.getByText("Service Name")).toBeTruthy();
      expect(screen.queryByText("Max Early Data")).toBeNull();
      expect(screen.queryByText("Method")).toBeNull();
    });

    it("quic reveals only Type (no documented sub-fields)", () => {
      importOutbound({ type: "quic" });
      selectNode();
      // The transport Type select still renders (its current value is "quic")...
      expect(screen.getByDisplayValue("quic")).toBeTruthy();
      // ...but no variant sub-fields are revealed.
      expect(screen.queryByText("Method")).toBeNull();
      expect(screen.queryByText("Headers")).toBeNull();
      expect(screen.queryByText("Permit Without Stream")).toBeNull();
      expect(screen.queryByText("Max Early Data")).toBeNull();
    });
  });

  describe("typed round-trips", () => {
    it("http.method is written as a string", () => {
      importOutbound({ type: "http" });
      selectNode();
      fireEvent.change(screen.getByLabelText("Method"), { target: { value: "GET" } });
      expect(transportOf().method).toBe("GET");
    });

    it("ws.max_early_data is written as a Number and early_data_header_name as a string", () => {
      importOutbound({ type: "ws" });
      selectNode();
      fireEvent.change(screen.getByLabelText("Max Early Data"), { target: { value: "2048" } });
      fireEvent.change(screen.getByLabelText("Early Data Header Name"), { target: { value: "Sec-WebSocket-Protocol" } });
      const t = transportOf();
      expect(t.max_early_data).toBe(2048);
      expect(typeof t.max_early_data).toBe("number");
      expect(t.early_data_header_name).toBe("Sec-WebSocket-Protocol");
    });

    it("grpc.permit_without_stream is written as a boolean", () => {
      importOutbound({ type: "grpc" });
      selectNode();
      fireEvent.click(screen.getByLabelText("Permit Without Stream"));
      const t = transportOf();
      expect(t.permit_without_stream).toBe(true);
      expect(typeof t.permit_without_stream).toBe("boolean");
    });

    it("headers round-trips as an object and prunes to undefined when the last entry is removed", () => {
      importOutbound({ type: "http" });
      selectNode();
      // Add one header entry, then give it a value.
      fireEvent.click(screen.getByRole("button", { name: /add header/i }));
      const valueInput = screen.getByLabelText("Headers value 0");
      fireEvent.change(valueInput, { target: { value: "application/grpc" } });
      const headers = transportOf().headers as Record<string, unknown>;
      expect(typeof headers).toBe("object");
      expect(Object.values(headers)).toContain("application/grpc");
      // Remove the only entry → headers pruned to undefined (not left as {}).
      fireEvent.click(screen.getByRole("button", { name: /remove header/i }));
      expect(transportOf().headers).toBeUndefined();
    });
  });

  describe("inbound parity", () => {
    it("a vmess inbound's transport card also exposes Method", () => {
      useProjectStore.getState().importJson(
        JSON.stringify({
          inbounds: [{ type: "vmess", tag: "vin", listen: "127.0.0.1", listen_port: 2080, transport: { type: "http" } }],
        }),
      );
      render(<App />);
      fireEvent.click(screen.getByTestId("node-inbound:vin"));
      expect(screen.getByText("Method")).toBeTruthy();
    });
  });
});
