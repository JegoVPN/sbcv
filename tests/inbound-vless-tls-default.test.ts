import { describe, expect, it } from "vitest";
import { createInbound } from "../src/domain/commands";

// A18 (W26): VLESS TLS is OPTIONAL upstream (inbound/vless.md). The scaffold seeded
// `tls: { enabled: true }`, forcing a server-cert setup on every new VLESS inbound and contradicting
// the optional default. A fresh VLESS inbound should not enable TLS by default.

describe("A18 — inbound vless does not seed tls:{enabled:true}", () => {
  it("creates a VLESS inbound without an enabled TLS block", () => {
    const vless = createInbound("vless", "vless-in") as Record<string, any>;
    expect(vless.type).toBe("vless");
    expect(vless.users?.length).toBeGreaterThan(0);
    // No auto-enabled TLS: either no tls key, or tls.enabled not true.
    expect(vless.tls?.enabled).not.toBe(true);
  });

  it("still seeds an enabled TLS block for TUIC (TLS is mandatory there)", () => {
    const tuic = createInbound("tuic", "tuic-in") as Record<string, any>;
    expect(tuic.tls?.enabled).toBe(true);
  });
});
