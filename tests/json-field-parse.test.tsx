import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A0 / W4 guardrail (Pass-2 T4; Codex C0-18).
// JsonField (src/components/Inspector.tsx:794-818) writes the raw unparseable string into canonical
// config on a JSON.parse failure (the catch branch calls onChange(event.target.value)). This is a
// characterization test: green today, it flips RED when A3 (jsonfield-parse-safety) keeps the last-valid
// value and surfaces a role="alert" instead of corrupting state — at which point update it to assert the
// safe behavior. The ssm-api endpoint-mapping field (Inspector.tsx:4803) is a live JsonField surface.

function renderSsmApiInspector() {
  useProjectStore.getState().loadMinimal();
  act(() => {
    useProjectStore.getState().createFromPalette("service-ssm-api");
  });
  render(<App />);
  return within(screen.getByLabelText("Node inspector"));
}

const JSON_FIELD_LABEL = "Endpoint Mapping JSON (advanced multi-path)";

describe("JsonField parse safety (W4 -> A3)", () => {
  it("harness: the ssm-api inspector renders the endpoint-mapping JSON field", () => {
    const inspector = renderSsmApiInspector();
    expect(inspector.getByLabelText(JSON_FIELD_LABEL)).toBeInTheDocument();
  });

  it("documents JsonField writing raw unparseable text into canonical config today (C0-18)", () => {
    const inspector = renderSsmApiInspector();
    fireEvent.change(inspector.getByLabelText(JSON_FIELD_LABEL), { target: { value: "{ not valid json" } });
    const service = useProjectStore.getState().config.services?.find((entry) => entry.type === "ssm-api");
    expect((service as Record<string, unknown>).servers).toBe("{ not valid json");
  });
});
