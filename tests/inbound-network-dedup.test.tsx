import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A20 (inbound / W28): `network` rendered TWICE for tproxy/direct — the dedicated tcp/udp select PLUS
// the Advanced-fields fallback (because "network" was missing from inboundHandledFields), so two
// controls edited the same key. Adding it to handledFields leaves only the dedicated select.

function importInbound(type: string) {
  useProjectStore.getState().importJson(
    JSON.stringify({ inbounds: [{ type, tag: `${type}-in`, listen: "::", listen_port: 1080, network: "udp" }] }),
  );
}

describe("A20-inbound — network control is not duplicated", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  for (const type of ["tproxy", "direct"]) {
    it(`${type} shows exactly one Network control even when network is set`, () => {
      importInbound(type);
      render(<App />);
      fireEvent.click(screen.getByTestId(`node-inbound:${type}-in`));
      expect(screen.getAllByLabelText("Network")).toHaveLength(1);
    });
  }
});
