import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A0/W4 guardrail, flipped green by A3 (jsonfield-parse-safety).
// JsonField now keeps the last-valid value and surfaces a role="alert" on a parse failure instead of
// writing the raw unparseable string into canonical config (C0-18 / T4 / W8). The ssm-api endpoint-mapping
// field (Inspector.tsx) is a live JsonField surface.

function renderSsmApiInspector() {
  useProjectStore.getState().loadMinimal();
  act(() => {
    useProjectStore.getState().createFromPalette("service-ssm-api");
  });
  render(<App />);
  return within(screen.getByLabelText("Node inspector"));
}

const JSON_FIELD_LABEL = "Endpoint Mapping JSON (advanced multi-path)";

describe("JsonField parse safety (W4 / A3)", () => {
  it("harness: the ssm-api inspector renders the endpoint-mapping JSON field", () => {
    const inspector = renderSsmApiInspector();
    expect(inspector.getByLabelText(JSON_FIELD_LABEL)).toBeInTheDocument();
  });

  it("does not write unparseable text into canonical config and surfaces a parse alert", () => {
    const inspector = renderSsmApiInspector();
    fireEvent.change(inspector.getByLabelText(JSON_FIELD_LABEL), { target: { value: "{ not valid json" } });

    const service = useProjectStore.getState().config.services?.find((entry) => entry.type === "ssm-api");
    expect(typeof (service as Record<string, unknown>).servers).not.toBe("string");
    expect(inspector.getByText(/previous valid value is kept/i)).toBeInTheDocument();
    expect(inspector.getByRole("alert")).toBeInTheDocument();
  });

  it("writes parsed JSON back to canonical config on valid input", () => {
    const inspector = renderSsmApiInspector();
    fireEvent.change(inspector.getByLabelText(JSON_FIELD_LABEL), { target: { value: '{"/": "ss-in"}' } });

    const service = useProjectStore.getState().config.services?.find((entry) => entry.type === "ssm-api");
    expect((service as Record<string, unknown>).servers).toEqual({ "/": "ss-in" });
  });

  it("resets the editor on entity switch even when the two entities share an identical JSON value", () => {
    // Identical `servers` values: an identity-based reset must fire on switch, not just a value-diff one.
    useProjectStore.getState().importJson(JSON.stringify({
      services: [
        { type: "ssm-api", tag: "svc-a", servers: { "/": "shared" } },
        { type: "ssm-api", tag: "svc-b", servers: { "/": "shared" } },
      ],
    }));
    act(() => {
      useProjectStore.getState().setSelectedId("service:svc-a");
    });
    render(<App />);

    let inspector = within(screen.getByLabelText("Node inspector"));
    fireEvent.change(inspector.getByLabelText(JSON_FIELD_LABEL), { target: { value: "{ broken" } });
    expect(inspector.getByRole("alert")).toBeInTheDocument();

    act(() => {
      useProjectStore.getState().setSelectedId("service:svc-b");
    });
    inspector = within(screen.getByLabelText("Node inspector"));
    expect(inspector.queryByRole("alert")).not.toBeInTheDocument();
    expect((inspector.getByLabelText(JSON_FIELD_LABEL) as HTMLTextAreaElement).value).toContain("shared");

    fireEvent.change(inspector.getByLabelText(JSON_FIELD_LABEL), { target: { value: '{"/": "changed"}' } });
    const svcA = useProjectStore.getState().config.services?.find((entry) => entry.tag === "svc-a");
    const svcB = useProjectStore.getState().config.services?.find((entry) => entry.tag === "svc-b");
    expect((svcA as Record<string, unknown>).servers).toEqual({ "/": "shared" });
    expect((svcB as Record<string, unknown>).servers).toEqual({ "/": "changed" });
  });
});
