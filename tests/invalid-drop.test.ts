import { describe, expect, it } from "vitest";
import { classifyConnectEnd } from "../src/components/CanvasWorkspace";

// L3-invalid-drop: dragging a connection and releasing it on an INCOMPATIBLE node/handle used to do
// nothing (React Flow rejects the connection; handleConnectEnd returned silently). classifyConnectEnd
// distinguishes the three release outcomes so the component can give feedback ("incompatible" → toast),
// connect ("connected"), or offer node creation on empty canvas ("open-picker").

describe("L3-invalid-drop — classifyConnectEnd", () => {
  it("a valid release is 'connected' (onConnect handles it), even over a node", () => {
    expect(classifyConnectEnd({ isValid: true })).toBe("connected");
    expect(classifyConnectEnd({ isValid: true, toNode: {} })).toBe("connected");
  });

  it("releasing on a node/handle that rejected the connection is 'incompatible'", () => {
    expect(classifyConnectEnd({ isValid: false, toNode: {} })).toBe("incompatible");
    expect(classifyConnectEnd({ isValid: false, toHandle: {} })).toBe("incompatible");
    expect(classifyConnectEnd({ isValid: null, toNode: {} })).toBe("incompatible");
  });

  it("releasing over empty canvas is 'open-picker'", () => {
    expect(classifyConnectEnd({ isValid: false })).toBe("open-picker");
    expect(classifyConnectEnd({ isValid: null })).toBe("open-picker");
    expect(classifyConnectEnd({})).toBe("open-picker");
  });
});
