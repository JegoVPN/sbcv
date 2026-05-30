import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { fieldMetaFor } from "../src/domain/schemaRegistry";
import { useProjectStore } from "../src/state/useProjectStore";

// V0 / M5: the data-driven SchemaEnumField renders a protocol enum from its SchemaFieldMeta — the SAME
// registry metadata the V1 validator reads — so the value list is defined ONCE. These tests bind the
// rendered <select> options to the registry, proving the renderer and the validator can't drift, and that
// numeric coercion + nested writes + channel gating behave.

const optionValues = (select: HTMLSelectElement) =>
  Array.from(select.querySelectorAll("option")).map((o) => o.value).filter((v) => v !== "");

function selectOutbound(palette: string, label: string): HTMLSelectElement {
  useProjectStore.getState().loadMinimal();
  act(() => {
    useProjectStore.getState().createFromPalette(palette);
  });
  render(<App />);
  return within(screen.getByLabelText("Node inspector")).getByLabelText(label) as HTMLSelectElement;
}

describe("V0/M5 — data-driven enum select is registry-sourced", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("shadowsocks method options exactly match SS_METHOD_ENUM (the V1-validated source, 18 values)", () => {
    const registryValues = fieldMetaFor("outbound", "shadowsocks")
      .find((m) => m.path.join(".") === "method")!
      .enum!.map((o) => o.value);
    const control = selectOutbound("ss-out", "Method");
    expect(optionValues(control)).toEqual(registryValues);
    expect(registryValues).toContain("2022-blake3-aes-128-gcm");
    expect(registryValues).toContain("rc4-md5"); // legacy still selectable for round-trip
  });

  it("shadowtls version is numeric: the chosen string writes a NUMBER to the config", () => {
    const control = selectOutbound("shadowtls-out", "Version");
    fireEvent.change(control, { target: { value: "2" } });
    const sts = useProjectStore.getState().config.outbounds?.find((o) => o.type === "shadowtls") as Record<string, unknown>;
    expect(sts.version).toBe(2);
    expect(typeof sts.version).toBe("number");
  });

  it("network self-gates from the registry — present for trojan, absent for http (sing-box rejects network on http)", () => {
    const trojan = within(
      (() => {
        useProjectStore.getState().loadMinimal();
        act(() => useProjectStore.getState().createFromPalette("trojan-out"));
        render(<App />);
        return screen.getByLabelText("Node inspector");
      })(),
    );
    expect(trojan.queryByLabelText("Network")).not.toBeNull();

    useProjectStore.getState().importJson(JSON.stringify({ outbounds: [{ type: "http", tag: "h", server: "1.1.1.1", server_port: 8080 }] }));
    act(() => useProjectStore.getState().setSelectedId("outbound:h"));
    render(<App />);
    const httpInspectors = screen.getAllByLabelText("Node inspector");
    expect(within(httpInspectors[httpInspectors.length - 1]!).queryByLabelText("Network")).toBeNull();
  });
});
