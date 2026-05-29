import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiagnosticsPopover } from "../src/components/DiagnosticsPopover";
import type { Diagnostic } from "../src/domain/types";

// L1-diag-hierarchy: the diagnostic item led with the machine code (bright/bold) and buried the
// human-readable message last. People read the message to understand the problem; the code is a
// lookup key. So the message is now the headline (first + prominent) and the code/path are the
// muted secondary line.

const diagnostic: Diagnostic = {
  code: "outbound.detour.missing",
  path: "outbounds[0].detour",
  message: "Detour points to an outbound tag that does not exist.",
  level: "error",
  source: "semantic",
};

describe("L1-diag-hierarchy — diagnostics read message-first", () => {
  it("renders the human message before the machine code in DOM order", () => {
    const { container } = render(
      <DiagnosticsPopover diagnostics={[diagnostic]} tone="error" onClose={() => {}} />,
    );
    const body = container.querySelector(".diagnostics-popover__body");
    const message = container.querySelector(".diagnostics-popover__message");
    const code = container.querySelector(".diagnostics-popover__code");
    expect(body).not.toBeNull();
    expect(message).not.toBeNull();
    expect(code).not.toBeNull();
    // message precedes code within the item body (headline reads first).
    expect(
      message!.compareDocumentPosition(code!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("still shows the code and path as a secondary reference", () => {
    const { getByText } = render(
      <DiagnosticsPopover diagnostics={[diagnostic]} tone="error" onClose={() => {}} />,
    );
    expect(getByText("outbound.detour.missing")).toBeInTheDocument();
    expect(getByText("outbounds[0].detour")).toBeInTheDocument();
    expect(getByText("Detour points to an outbound tag that does not exist.")).toBeInTheDocument();
  });
});
