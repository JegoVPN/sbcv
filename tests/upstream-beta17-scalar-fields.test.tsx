import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxConfig } from "../src/domain/types";
import { useProjectStore } from "../src/state/useProjectStore";

function current(kind: "outbounds" | "endpoints", index = 0) {
  return useProjectStore.getState().config[kind]?.[index] as Record<string, unknown> | undefined;
}

describe("sing-box 1.13.19 / 1.14 beta.17 scalar fields", () => {
  beforeEach(() => {
    useProjectStore.getState().setTarget("1.13-stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  afterEach(() => {
    useProjectStore.getState().setTarget("1.13-stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("edits AnyTLS client_metadata and blocks it on the 1.12 legacy target", () => {
    const config = {
      outbounds: [{ type: "anytls", tag: "anytls", server: "127.0.0.1", server_port: 443, password: "p" }],
    } as SingBoxConfig;
    useProjectStore.getState().importJson(JSON.stringify(config));
    render(<App />);
    fireEvent.click(screen.getByTestId("node-outbound:anytls"));

    const field = screen.getByLabelText(/Client Metadata/) as HTMLInputElement;
    fireEvent.change(field, { target: { value: "compat-client" } });
    expect(current("outbounds")?.client_metadata).toBe("compat-client");
    fireEvent.change(field, { target: { value: "" } });
    expect(current("outbounds")?.client_metadata).toBeUndefined();

    const withMetadata = {
      ...config,
      outbounds: [{ ...config.outbounds![0], client_metadata: "compat-client" }],
    } as SingBoxConfig;
    expect(validateConfig(withMetadata, "stable", "1.12").map((item) => item.code)).toContain(
      "outbound-anytls-client-metadata-1-13-only",
    );
    expect(validateConfig(withMetadata, "stable", "1.13").map((item) => item.code)).not.toContain(
      "outbound-anytls-client-metadata-1-13-only",
    );
  });

  it("edits the new Tailscale, Hysteria2, and remote Rule Set testing fields", () => {
    useProjectStore.getState().setChannel("testing");
    useProjectStore.getState().importJson(JSON.stringify({
      endpoints: [{ type: "tailscale", tag: "ts", state_directory: "tailscale" }],
      outbounds: [{ type: "hysteria2", tag: "hy2", server: "127.0.0.1", server_port: 443, password: "p" }],
      route: { rule_set: [{ type: "remote", tag: "rules", format: "source", url: "https://example.com/rules.json" }] },
    }));
    render(<App />);

    fireEvent.click(screen.getByTestId("node-endpoint:ts"));
    fireEvent.change(screen.getByLabelText(/Listen Port \(since sing-box 1\.14\.0\)/), { target: { value: "41641" } });
    fireEvent.change(screen.getByLabelText(/Taildrop Directory/), { target: { value: "inbox" } });
    expect(current("endpoints")).toMatchObject({ listen_port: 41641, taildrop_directory: "inbox" });

    fireEvent.click(screen.getByTestId("node-outbound:hy2"));
    fireEvent.click(screen.getByLabelText(/Disable Chrome QUIC fingerprint parroting/));
    expect(current("outbounds")?.disable_chrome_parrot).toBe(true);

    fireEvent.click(screen.getByTestId("node-rule-set:rules"));
    fireEvent.change(screen.getByLabelText(/Initial Path/), { target: { value: "bootstrap/rules.json" } });
    expect(useProjectStore.getState().config.route?.rule_set?.[0]?.initial_path).toBe("bootstrap/rules.json");
  });

  it("keeps testing-only fields export-blocking on stable and clean on testing", () => {
    const config = {
      endpoints: [{ type: "tailscale", tag: "ts", listen_port: 41641, taildrop_directory: "inbox" }],
      outbounds: [{ type: "hysteria2", tag: "hy2", disable_chrome_parrot: true }],
      route: { rule_set: [{ type: "remote", tag: "rules", url: "https://example.com/rules.json", initial_path: "bootstrap/rules.json" }] },
    } as unknown as SingBoxConfig;
    const stablePaths = validateConfig(config, "stable", "1.13")
      .filter((item) => item.code === "field-testing-only")
      .map((item) => item.path);
    expect(stablePaths).toEqual(expect.arrayContaining([
      "/endpoints/0/listen_port",
      "/endpoints/0/taildrop_directory",
      "/outbounds/0/disable_chrome_parrot",
      "/route/rule_set/0/initial_path",
    ]));
    expect(validateConfig(config, "testing", "1.14").filter((item) => item.code === "field-testing-only")).toEqual([]);
  });

  it("does not advertise initial_path on a fresh stable Rule Set", () => {
    useProjectStore.getState().importJson(JSON.stringify({
      route: { rule_set: [{ type: "remote", tag: "rules", format: "source", url: "https://example.com/rules.json" }] },
    }));
    render(<App />);
    fireEvent.click(screen.getByTestId("node-rule-set:rules"));
    expect(screen.queryByLabelText(/Initial Path/)).toBeNull();
  });
});
