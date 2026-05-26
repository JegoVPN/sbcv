import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";

describe("SBC editor shell", () => {
  it("renders editor regions instead of a landing page", async () => {
    render(<App />);
    expect(screen.getByText("SBC")).toBeInTheDocument();
    expect(screen.getByLabelText("Node palette")).toBeInTheDocument();
    expect(screen.getByLabelText("SBC visual canvas")).toBeInTheDocument();
    expect(screen.getByLabelText("Node inspector")).toBeInTheDocument();
    expect(screen.getByLabelText("Rules, JSON, and diagnostics")).toBeInTheDocument();
  });
});
