import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxConfig } from "../src/domain/types";

// TUIC zero_rtt_handshake reduces handshake latency but is vulnerable to replay attacks (upstream
// tuic.md recommends disabling it). Surface it as a warning — the same diagnostics/status layer that
// already flags vmess alterId>0 — rather than a bespoke card badge.
const codes = (config: unknown) => validateConfig(config as SingBoxConfig, "stable").map((d) => d.code);
const uuid = "00000000-0000-0000-0000-000000000000";

describe("tuic zero_rtt_handshake replay warning", () => {
  it("warns on a tuic outbound with zero_rtt_handshake enabled", () => {
    expect(
      codes({ outbounds: [{ type: "tuic", tag: "t", server: "1.2.3.4", server_port: 443, uuid, zero_rtt_handshake: true }] }),
    ).toContain("tuic-zero-rtt-replay");
  });

  it("warns on a tuic inbound with zero_rtt_handshake enabled", () => {
    expect(
      codes({ inbounds: [{ type: "tuic", tag: "ti", listen: "::", listen_port: 443, users: [{ uuid, password: "p" }], zero_rtt_handshake: true }] }),
    ).toContain("tuic-zero-rtt-replay");
  });

  it("does not warn when zero_rtt_handshake is absent or false", () => {
    expect(
      codes({ outbounds: [{ type: "tuic", tag: "t", server: "1.2.3.4", server_port: 443, uuid }] }),
    ).not.toContain("tuic-zero-rtt-replay");
    expect(
      codes({ outbounds: [{ type: "tuic", tag: "t", server: "1.2.3.4", server_port: 443, uuid, zero_rtt_handshake: false }] }),
    ).not.toContain("tuic-zero-rtt-replay");
    expect(
      codes({ inbounds: [{ type: "tuic", tag: "ti", listen: "::", listen_port: 443, users: [{ uuid, password: "p" }] }] }),
    ).not.toContain("tuic-zero-rtt-replay");
  });
});
