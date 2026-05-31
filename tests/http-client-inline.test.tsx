import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxChannel, SingBoxConfig } from "../src/domain/types";
import { useProjectStore } from "../src/state/useProjectStore";

// U11 — http_client supports a tag string OR an inline object (shared/http-client.md). The inline object
// was only reachable when the value was ALREADY an object (the JsonField branch); there was no entry point
// to switch a tag/empty value to an inline object (unlike domain_resolver's "Add resolver options"). Also,
// the inline object's "unsupported fields" (http-client.md:48-74) were never validated — a silently invalid
// config. Add (1) a switch-to-inline button and (2) an unsupported-key diagnostic (the priority).

function codes(config: SingBoxConfig, channel: SingBoxChannel, version?: string) {
  return validateConfig(config, channel, version).map((d) => d.code);
}
const GATE = "http-client-unsupported-field";

const REMOTE_RULE_SET = {
  route: {
    rules: [],
    rule_set: [{ tag: "geosite", type: "remote", format: "binary", url: "https://x/geosite.srs", download_detour: "proxy" }],
  },
  outbounds: [{ type: "direct", tag: "proxy" }],
};

describe("U11 — inline http_client object", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  describe("unsupported-key diagnostic (priority)", () => {
    it("flags an inline http_client object that sets an unsupported top-level key", () => {
      const config = {
        route: { default_http_client: { version: "2" } },
      } as unknown as SingBoxConfig;
      expect(codes(config, "testing", "1.14")).toContain(GATE);
    });

    it("flags an inline http_client object that sets an unsupported tls key", () => {
      const config = {
        route: { rule_set: [{ tag: "g", type: "remote", format: "binary", url: "https://x", http_client: { tls: { alpn: ["h2"] } } }] },
      } as unknown as SingBoxConfig;
      expect(codes(config, "testing", "1.14")).toContain(GATE);
    });

    it("does not flag a supported-only inline object (headers + tls.server_name)", () => {
      const config = {
        route: { default_http_client: { headers: { "X-Test": "1" }, tls: { server_name: "example.com", insecure: true } } },
      } as unknown as SingBoxConfig;
      expect(codes(config, "testing", "1.14")).not.toContain(GATE);
    });

    it("does not flag a plain tag-string http_client", () => {
      const config = {
        http_clients: [{ tag: "doh" }],
        route: { default_http_client: "doh" },
      } as unknown as SingBoxConfig;
      expect(codes(config, "testing", "1.14")).not.toContain(GATE);
    });
  });

  describe("switch-to-inline-object button", () => {
    it("seeds an inline object and renders the JSON editor", () => {
      useProjectStore.getState().setChannel("testing");
      useProjectStore.getState().importJson(JSON.stringify(REMOTE_RULE_SET));
      render(<App />);
      fireEvent.click(screen.getByTestId("node-rule-set:geosite"));

      const button = screen.getByRole("button", { name: /inline configuration|inline object/i });
      fireEvent.click(button);
      expect(useProjectStore.getState().config.route?.rule_set?.[0]?.http_client).toEqual({});

      // now an object → the JSON editor (textarea) renders for the HTTP Client field
      const editor = screen.getByLabelText("HTTP Client") as HTMLTextAreaElement;
      expect(editor.tagName).toBe("TEXTAREA");
    });
  });
});
