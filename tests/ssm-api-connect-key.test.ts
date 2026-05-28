import { describe, expect, it } from "vitest";
import { useProjectStore } from "../src/state/useProjectStore";

// A20 (service / C1-13): connecting a shadowsocks inbound to an SSM-API service on the canvas hardcoded
// the servers["/"] key, so wiring a SECOND inbound overwrote the first's root mapping. servers is a
// path->inbound map; each managed server needs a distinct path.

function ssConfig() {
  return JSON.stringify({
    inbounds: [
      { type: "shadowsocks", tag: "ss1", method: "2022-blake3-aes-128-gcm", password: "a", managed: true },
      { type: "shadowsocks", tag: "ss2", method: "2022-blake3-aes-128-gcm", password: "b", managed: true },
    ],
    services: [{ type: "ssm-api", tag: "ssm", servers: { "/": "ss1" } }],
  });
}

describe("A20-service — ssm-api canvas connect does not clobber the root mapping (C1-13)", () => {
  it("adds a second managed inbound under a distinct path instead of overwriting '/'", () => {
    useProjectStore.getState().importJson(ssConfig());
    useProjectStore.getState().connectPorts({
      source: "inbound:ss2",
      sourceHandle: "service",
      target: "service:ssm",
      targetHandle: "managed-inbound",
    });

    const servers = useProjectStore.getState().config.services?.[0]?.servers as Record<string, string>;
    const tags = Object.values(servers);
    expect(tags).toContain("ss1");
    expect(tags).toContain("ss2");
    expect(Object.keys(servers)).toHaveLength(2);
  });

  it("does not duplicate when the same inbound is reconnected", () => {
    useProjectStore.getState().importJson(ssConfig());
    useProjectStore.getState().connectPorts({
      source: "inbound:ss1",
      sourceHandle: "service",
      target: "service:ssm",
      targetHandle: "managed-inbound",
    });
    const servers = useProjectStore.getState().config.services?.[0]?.servers as Record<string, string>;
    expect(Object.values(servers).filter((t) => t === "ss1")).toHaveLength(1);
  });
});
