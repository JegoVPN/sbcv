import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// L4-subtitle-degeneric (A29-rest): all four settings nodes (log/ntp/certificate/experimental) showed
// the same generic "global settings" subtitle. Now each carries real info, like the
// inbound/outbound/endpoint/service subtitles already do. (route/dns hubs already show rule counts and
// notice nodes are already informative — only settings was generic.)

function subtitleOf(nodeId: string): string {
  const node = screen.getByTestId(`node-${nodeId}`);
  return node.querySelector(".sbc-node__subtitle")?.textContent ?? "";
}

afterEach(() => {
  useProjectStore.getState().importJson(JSON.stringify({}));
});

describe("L4-subtitle-degeneric — settings node subtitles carry real info", () => {
  it("log shows its level", () => {
    useProjectStore.getState().importJson(JSON.stringify({ log: { level: "info" } }));
    render(<App />);
    expect(subtitleOf("settings:log")).toBe("log level info");
  });

  it("log shows disabled when logging is off", () => {
    useProjectStore.getState().importJson(JSON.stringify({ log: { disabled: true } }));
    render(<App />);
    expect(subtitleOf("settings:log")).toBe("logging disabled");
  });

  it("ntp shows its server when enabled", () => {
    useProjectStore.getState().importJson(JSON.stringify({ ntp: { enabled: true, server: "time.apple.com" } }));
    render(<App />);
    expect(subtitleOf("settings:ntp")).toBe("time sync · time.apple.com");
  });

  it("ntp reads as off when not enabled (enabled defaults to false), even with a server set", () => {
    useProjectStore.getState().importJson(JSON.stringify({ ntp: { server: "time.apple.com" } }));
    render(<App />);
    expect(subtitleOf("settings:ntp")).toBe("time sync off");
  });

  it("experimental lists the enabled subsystems", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ experimental: { clash_api: { external_controller: "127.0.0.1:9090" }, cache_file: { enabled: true } } }),
    );
    render(<App />);
    expect(subtitleOf("settings:experimental")).toBe("Clash API · cache file");
  });

  it("certificate falls back to a meaningful label (not 'global settings')", () => {
    useProjectStore.getState().importJson(JSON.stringify({ certificate: {} }));
    render(<App />);
    expect(subtitleOf("settings:certificate")).toBe("TLS certificates");
  });

  it("ntp enabled with no server falls back to a meaningful label", () => {
    useProjectStore.getState().importJson(JSON.stringify({ ntp: { enabled: true } }));
    render(<App />);
    expect(subtitleOf("settings:ntp")).toBe("time sync");
  });
});
