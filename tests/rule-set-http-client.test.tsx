import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { sharedGroupsForEntity } from "../src/domain/sharedFieldRegistry";
import { useProjectStore } from "../src/state/useProjectStore";

// A12 (W20 / C2-5): rule-set-remote `http_client` may be a string (tag) OR an inline object
// (shared/http-client.md). The tag-only <select> rendered an object as "None" and clobbered it to a
// string on any change. The field is also testing-only (1.14), so the card is now gated to testing.

describe("A12 — rule-set http_client", () => {
  describe("channel gating (W20: testing-only field)", () => {
    const ref = { kind: "rule-set", tag: "rs" } as const;
    it("exposes the http-client card for a remote rule-set on testing", () => {
      expect(sharedGroupsForEntity(ref, "remote", "testing")).toContain("http-client");
    });
    it("hides it on stable (http_client is sing-box 1.14+)", () => {
      expect(sharedGroupsForEntity(ref, "remote", "stable")).not.toContain("http-client");
    });
  });

  describe("inline object-form preservation (C2-5 data-loss)", () => {
    beforeEach(() => {
      useProjectStore.getState().importJson(JSON.stringify({}));
      useProjectStore.getState().setChannel("testing");
    });
    afterEach(() => {
      useProjectStore.getState().setChannel("stable");
      useProjectStore.getState().importJson(JSON.stringify({}));
    });

    function importRemote(httpClient: unknown) {
      useProjectStore.getState().importJson(
        JSON.stringify({
          outbounds: [{ type: "direct", tag: "out" }],
          route: { rule_set: [{ type: "remote", tag: "rs", format: "binary", url: "https://e.x/r.srs", http_client: httpClient }] },
        }),
      );
      useProjectStore.getState().setChannel("testing");
    }

    it("renders an object http_client as a JSON editor (textarea), not a clobbering select", () => {
      importRemote({ detour: "out" });
      render(<App />);
      fireEvent.click(screen.getByTestId("node-rule-set:rs"));

      const control = screen.getByLabelText("HTTP Client");
      expect(control.tagName).toBe("TEXTAREA");
      expect((control as HTMLTextAreaElement).value).toContain("detour");

      // Editing the object must keep it an object, not write a bare string.
      fireEvent.change(control, { target: { value: JSON.stringify({ detour: "out", headers: { a: "b" } }) } });
      const rs = useProjectStore.getState().config.route?.rule_set?.find((r) => r.tag === "rs") as Record<string, unknown>;
      expect(rs.http_client).toEqual({ detour: "out", headers: { a: "b" } });
    });

    it("still renders a string http_client as a tag select", () => {
      importRemote("my-client");
      render(<App />);
      fireEvent.click(screen.getByTestId("node-rule-set:rs"));

      const control = screen.getByLabelText("HTTP Client");
      expect(control.tagName).toBe("SELECT");
    });
  });
});
