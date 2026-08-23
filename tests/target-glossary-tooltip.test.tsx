import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { MobileMenuSheet } from "../src/components/MobileMenuSheet";
import { SING_BOX_TARGETS, targetDisplayLabel } from "../src/domain/targets";
import { useProjectStore } from "../src/state/useProjectStore";

// L1-target-glossary: the target selector had no explanation of what stable (1.13) vs testing (1.14)
// means. Added a tooltip (title) so users understand which build to validate against.

afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

describe("L1-target-glossary — target selector tooltip", () => {
  it("shows the exact validator release in desktop option labels and the tooltip", () => {
    render(<App />);
    const select = screen.getByLabelText("Sing-box target");
    const title = select.getAttribute("title") ?? "";
    for (const target of SING_BOX_TARGETS) {
      expect(within(select).getByRole("option", { name: targetDisplayLabel(target) })).toBeInTheDocument();
      expect(title).toContain(target.binaryVersion);
    }
  });

  it("uses the same exact-version labels in the mobile menu", () => {
    render(<MobileMenuSheet open onClose={() => {}} onOpenTemplates={() => {}} onOpenJson={() => {}} />);
    const select = screen.getByLabelText("Sing-box target");
    for (const target of SING_BOX_TARGETS) {
      expect(within(select).getByRole("option", { name: targetDisplayLabel(target) })).toBeInTheDocument();
    }
  });

  it("keeps displayed releases aligned with local and production validator pins", () => {
    const installer = readFileSync("scripts/install-sing-box-binaries.mjs", "utf8");
    const dockerfile = readFileSync("container/Dockerfile", "utf8");
    const dockerArgByBinary = {
      "sing-box-1.12": "SB_112_VERSION",
      "sing-box-stable": "SB_STABLE_VERSION",
      "sing-box-testing": "SB_TESTING_VERSION",
    } as const;

    for (const target of SING_BOX_TARGETS) {
      expect(installer).toContain(`{ command: "${target.binaryName}", version: "${target.binaryVersion}" }`);
      expect(dockerfile).toContain(`ARG ${dockerArgByBinary[target.binaryName]}=${target.binaryVersion}`);
    }
  });
});
