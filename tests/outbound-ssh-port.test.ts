import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxConfig } from "../src/domain/types";

// A20 (outbound / W28): SSH outbound server_port defaults to 22 when empty (ssh.md), so it is optional.
// The mandatory-port check treated ssh like every other proxy type and raised a spurious BLOCKING error
// when the port was cleared, flipping the canvas node to error on a legal config.

function errorCodes(config: SingBoxConfig) {
  return validateConfig(config, "testing").filter((d) => d.level === "error").map((d) => d.code);
}

describe("A20-outbound — ssh server_port is optional (defaults to 22)", () => {
  it("does not flag an ssh outbound with no server_port", () => {
    const config = { outbounds: [{ type: "ssh", tag: "ssh-out", server: "example.com" }] } as unknown as SingBoxConfig;
    expect(errorCodes(config)).not.toContain("outbound-invalid-server-port");
  });

  it("still flags an ssh outbound with a present but out-of-range port", () => {
    const config = { outbounds: [{ type: "ssh", tag: "ssh-out", server: "example.com", server_port: 70000 }] } as unknown as SingBoxConfig;
    expect(errorCodes(config)).toContain("outbound-invalid-server-port");
  });

  it("still requires server_port for other proxy outbounds (e.g. socks)", () => {
    const config = { outbounds: [{ type: "socks", tag: "socks-out", server: "example.com" }] } as unknown as SingBoxConfig;
    expect(errorCodes(config)).toContain("outbound-invalid-server-port");
  });
});
