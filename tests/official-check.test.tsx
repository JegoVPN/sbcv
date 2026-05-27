import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

describe("OfficialCheckButton", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not render when VITE_OFFICIAL_CHECK_URL is unset", () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);
    expect(screen.queryByTestId("official-check-button")).not.toBeInTheDocument();
  });
});
