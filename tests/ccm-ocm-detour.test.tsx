import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxChannel, SingBoxConfig } from "../src/domain/types";
import { useProjectStore } from "../src/state/useProjectStore";

// A13 (W21 / C1-21, C2-1): ccm/ocm `detour` is an OUTBOUND tag (Claude/OpenAI API). The shared Listen
// group also rendered an "Inbound Detour" select writing the same /services/*/detour key — letting a
// user stomp the outbound API detour with an inbound tag. And ccm/ocm are sing-box 1.13+, so they must
// be flagged on a 1.12 target.

function errorCodes(config: SingBoxConfig, channel: SingBoxChannel, version?: string) {
  return validateConfig(config, channel, version).filter((d) => d.level === "error").map((d) => d.code);
}

describe("A13 — ccm/ocm single correct detour + version gate", () => {
  describe("version gate (1.13+)", () => {
    const ccm = { services: [{ type: "ccm", tag: "ccm1", detour: "out" }], outbounds: [{ type: "direct", tag: "out" }] } as unknown as SingBoxConfig;
    it("flags ccm/ocm on a 1.12 target", () => {
      expect(errorCodes(ccm, "stable", "1.12")).toContain("service-ccm-ocm-version");
    });
    it("accepts ccm/ocm on 1.13 and 1.14", () => {
      expect(errorCodes(ccm, "stable", "1.13")).not.toContain("service-ccm-ocm-version");
      expect(errorCodes(ccm, "testing", "1.14")).not.toContain("service-ccm-ocm-version");
    });
  });

  describe("no duplicate inbound detour control", () => {
    beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
    afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

    it("a ccm service shows the outbound API Detour but not the listen-group Inbound Detour", () => {
      useProjectStore.getState().importJson(
        JSON.stringify({
          inbounds: [{ type: "mixed", tag: "in1", listen: "::", listen_port: 1080 }],
          outbounds: [{ type: "direct", tag: "out" }],
          services: [{ type: "ccm", tag: "ccm1", detour: "out" }],
        }),
      );
      render(<App />);
      fireEvent.click(screen.getByTestId("node-service:ccm1"));

      expect(screen.getByLabelText("API Detour")).toBeInTheDocument();
      expect(screen.queryByLabelText("Inbound Detour")).toBeNull();
    });

    it("a derp service (listen detour is genuinely inbound) keeps the Inbound Detour control", () => {
      useProjectStore.getState().importJson(
        JSON.stringify({
          inbounds: [{ type: "mixed", tag: "in1", listen: "::", listen_port: 1080 }],
          services: [{ type: "derp", tag: "derp1", listen: "::", listen_port: 8443 }],
        }),
      );
      render(<App />);
      fireEvent.click(screen.getByTestId("node-service:derp1"));
      expect(screen.getByLabelText("Inbound Detour")).toBeInTheDocument();
    });
  });
});
