import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxConfig } from "../src/domain/types";

// A20 (C1-10): VLESS `flow: xtls-rprx-vision` without TLS is accepted by sing-box (upstream/stable does
// not reject it at check-time), so SBC must not raise a BLOCKING error — downgrade to a warning. The
// flow⇔multiplex mutual exclusion stays a hard error.

function diags(config: SingBoxConfig) {
  return validateConfig(config, "testing");
}

describe("A20 — vless flow-without-tls is a warning, not a blocking error (C1-10)", () => {
  it("flags flow=xtls-rprx-vision without tls as a warning (not error)", () => {
    const config = { outbounds: [{ type: "vless", tag: "v", server: "e.x", server_port: 443, uuid: "bf000d23-0752-40b4-affe-68f7707a9661", flow: "xtls-rprx-vision" }] } as unknown as SingBoxConfig;
    const d = diags(config).filter((x) => x.code === "vless-flow-requires-tls");
    expect(d).toHaveLength(1);
    expect(d[0]?.level).toBe("warning");
  });

  it("keeps flow⇔multiplex as a hard error", () => {
    const config = { outbounds: [{ type: "vless", tag: "v", server: "e.x", server_port: 443, uuid: "bf000d23-0752-40b4-affe-68f7707a9661", flow: "xtls-rprx-vision", multiplex: { enabled: true } }] } as unknown as SingBoxConfig;
    const errs = diags(config).filter((x) => x.level === "error").map((x) => x.code);
    expect(errs).toContain("vless-flow-multiplex-conflict");
  });
});
