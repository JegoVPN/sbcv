import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxChannel, SingBoxConfig } from "../src/domain/types";
import { useProjectStore } from "../src/state/useProjectStore";

// U14 — harden the download_detour deprecation (rule-set/index.md:130-134: deprecated 1.14, removed 1.16).
// It was advisory-only on testing. Now: warn on 1.14/1.15, ERROR on >=1.16 (removed); flag the
// download_detour + http_client both-set redundancy; and on testing only render the Download Detour control
// when a value already exists (editing/clearing), so a fresh project is steered to http_client (pairs with U1).

function codes(config: SingBoxConfig, channel: SingBoxChannel, version?: string) {
  return validateConfig(config, channel, version).map((d) => d.code);
}
const remoteRuleSet = (extra: Record<string, unknown>) => ({
  outbounds: [{ type: "direct", tag: "proxy" }],
  http_clients: [{ tag: "doh" }],
  route: { rules: [], rule_set: [{ tag: "geo", type: "remote", format: "binary", url: "https://x/g.srs", ...extra }] },
});

describe("U14 — download_detour deprecation hardening", () => {
  describe("version gating", () => {
    it("warns (not errors) on 1.14", () => {
      const c = remoteRuleSet({ download_detour: "proxy" }) as unknown as SingBoxConfig;
      expect(codes(c, "testing", "1.14")).toContain("rule-set-download-detour-deprecated");
      expect(codes(c, "testing", "1.14")).not.toContain("rule-set-download-detour-removed");
    });
    it("errors on >=1.16 (removed)", () => {
      const c = remoteRuleSet({ download_detour: "proxy" }) as unknown as SingBoxConfig;
      const out = codes(c, "testing", "1.16");
      expect(out).toContain("rule-set-download-detour-removed");
      expect(out).not.toContain("rule-set-download-detour-deprecated");
    });
    it("is clean on stable 1.13 (download_detour is valid there)", () => {
      const c = remoteRuleSet({ download_detour: "proxy" }) as unknown as SingBoxConfig;
      expect(codes(c, "stable", "1.13")).not.toContain("rule-set-download-detour-deprecated");
      expect(codes(c, "stable", "1.13")).not.toContain("rule-set-download-detour-removed");
    });
  });

  describe("both-set conflict", () => {
    it("flags download_detour + http_client set together", () => {
      const c = remoteRuleSet({ download_detour: "proxy", http_client: "doh" }) as unknown as SingBoxConfig;
      expect(codes(c, "testing", "1.14")).toContain("rule-set-download-detour-http-client-conflict");
    });
    it("does not flag the conflict when only one is set", () => {
      const onlyDetour = remoteRuleSet({ download_detour: "proxy" }) as unknown as SingBoxConfig;
      expect(codes(onlyDetour, "testing", "1.14")).not.toContain("rule-set-download-detour-http-client-conflict");
      const onlyClient = remoteRuleSet({ http_client: "doh" }) as unknown as SingBoxConfig;
      expect(codes(onlyClient, "testing", "1.14")).not.toContain("rule-set-download-detour-http-client-conflict");
    });
  });

  describe("Download Detour control gating", () => {
    afterEach(() => {
      useProjectStore.getState().setChannel("stable");
      useProjectStore.getState().importJson(JSON.stringify({}));
    });
    beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

    function open(channel: "stable" | "testing", extra: Record<string, unknown>) {
      useProjectStore.getState().setChannel(channel);
      useProjectStore.getState().importJson(JSON.stringify(remoteRuleSet(extra)));
      render(<App />);
      fireEvent.click(screen.getByTestId("node-rule-set:geo"));
    }

    it("hides the Download Detour control on testing for a fresh rule-set (no value)", () => {
      open("testing", {});
      expect(screen.queryByLabelText("Download Detour")).toBeNull();
    });
    it("shows the Download Detour control on testing when a value already exists (to edit/clear)", () => {
      open("testing", { download_detour: "proxy" });
      expect(screen.getByLabelText("Download Detour")).toBeInTheDocument();
    });
    it("shows the Download Detour control on stable (the supported path there)", () => {
      open("stable", {});
      expect(screen.getByLabelText("Download Detour")).toBeInTheDocument();
    });
  });
});
