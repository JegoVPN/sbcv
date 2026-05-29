import { describe, expect, it } from "vitest";

import { nodeBadge } from "../src/canvas/nodeLabels";
import { validateConfig } from "../src/domain/diagnostics";
import { typeMinVersion } from "../src/domain/minVersions";
import type { SingBoxConfig } from "../src/domain/types";

// C7-A: a single domain table (minVersions.TYPE_MIN_VERSION) drives both the canvas "needs X" badge
// (nodeLabels.nodeBadge) and the diagnostics TYPE gates (naive / ccm / ocm), so they can never disagree.

describe("C7-A — type min-version single source", () => {
  it("exposes the shared type min-versions", () => {
    expect(typeMinVersion("outbound", "naive")).toBe("1.13");
    expect(typeMinVersion("service", "ccm")).toBe("1.13");
    expect(typeMinVersion("service", "ocm")).toBe("1.13");
    expect(typeMinVersion("inbound", "cloudflared")).toBe("1.14");
  });

  it("the table value drives the naive node badge AND the naive diagnostic", () => {
    const min = typeMinVersion("outbound", "naive")!;
    // Badge: a target older than the min shows "needs <min>".
    const badge = nodeBadge("outbound", "naive", "1.12");
    expect(badge?.tone).toBe("version");
    expect(badge?.label).toBe(`needs ${min}`);
    // Diagnostic: naive on a sub-min target errors, citing the same min.
    const config = { outbounds: [{ type: "naive", tag: "n", server: "x", server_port: 443, tls: { enabled: true, server_name: "e" } }] } as unknown as SingBoxConfig;
    const diag = validateConfig(config, "stable", "1.12").find((d) => d.code === "outbound-naive-version");
    expect(diag?.level).toBe("error");
    expect(diag?.message).toContain(`${min}+`);
    // On a min-or-newer target both are silent.
    expect(nodeBadge("outbound", "naive", min)).toBeNull();
    expect(validateConfig(config, "stable", min).find((d) => d.code === "outbound-naive-version")).toBeUndefined();
  });

  it("the table value drives the ccm/ocm badge AND diagnostic", () => {
    const min = typeMinVersion("service", "ccm")!;
    expect(nodeBadge("service", "ccm", "1.12")?.label).toBe(`needs ${min}`);
    const config = { services: [{ type: "ccm", tag: "c", listen: "127.0.0.1", listen_port: 8080, users: [] }] } as unknown as SingBoxConfig;
    expect(validateConfig(config, "stable", "1.12").find((d) => d.code === "service-ccm-ocm-version")?.message).toContain(`${min}+`);
  });
});
