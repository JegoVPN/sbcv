import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { validateConfig } from "../src/domain/diagnostics";
import { allTestingOnlyFields } from "../src/domain/versionFieldGate";
import type { SingBoxConfig } from "../src/domain/types";

// VT3 — data-driven testing-only field gate. Derived from knownFields.generated.ts per-(channel,kind,type)
// doc field sets: a top-level field present on testing but not stable (and not a stable-doc-omission per the
// W9 SUPPLEMENT) is 1.14-only, so on a stable target it is a hard error. This is the closed-set backstop
// behind the hand-written W8/VT1 gates (which stay as friendlier per-field messages, deduped by path).

function errorsAt(config: SingBoxConfig, channel: "stable" | "testing") {
  return validateConfig(config, channel).filter((d) => d.level === "error");
}
function hasCode(config: SingBoxConfig, channel: "stable" | "testing", code: string) {
  return errorsAt(config, channel).some((d) => d.code === code);
}

describe("VT3 — data-driven testing-only field gate", () => {
  // neighbor_domain (dns-server local) is 1.14-only and NOT covered by any hand-written gate, so it is the
  // clean witness that the data-driven backstop fires. Binary-verified: stable rejects `unknown field
  // "neighbor_domain"`, testing accepts the field.
  it("flags a 1.14-only field that no hand gate covers (dns-server local neighbor_domain)", () => {
    const config = { dns: { servers: [{ type: "local", tag: "l", neighbor_domain: [".lan"] }] } } as unknown as SingBoxConfig;
    expect(hasCode(config, "stable", "field-testing-only")).toBe(true);
    expect(hasCode(config, "testing", "field-testing-only")).toBe(false);
  });

  it("reports the testing-only field at its precise path", () => {
    const config = { dns: { servers: [{ type: "local", tag: "l", neighbor_domain: [".lan"] }] } } as unknown as SingBoxConfig;
    const hit = errorsAt(config, "stable").find((d) => d.code === "field-testing-only");
    expect(hit?.path).toBe("/dns/servers/0/neighbor_domain");
  });

  it("does NOT flag a wholly-testing-only TYPE's fields (the type-level gate covers it; no double-report)", () => {
    // cloudflared is a testing-only inbound TYPE — stable has no cloudflared doc, so the per-field gate must
    // skip it (inbound-cloudflared-testing-only already errors the whole entity).
    const config = { inbounds: [{ type: "cloudflared", tag: "cf", token: "x", protocol: "quic" }] } as unknown as SingBoxConfig;
    expect(hasCode(config, "stable", "field-testing-only")).toBe(false);
  });

  it("does NOT double-report a hand-gated field (realm is covered by the hysteria2 gate)", () => {
    const config = {
      outbounds: [{ type: "hysteria2", tag: "h", server: "1.2.3.4", server_port: 443, password: "p", tls: { enabled: true, server_name: "x" }, realm: "r" }],
    } as unknown as SingBoxConfig;
    // The friendly hand gate fires…
    expect(hasCode(config, "stable", "hysteria2-realm-testing-only")).toBe(true);
    // …and the generic data-driven gate does NOT add a duplicate at the same path.
    expect(hasCode(config, "stable", "field-testing-only")).toBe(false);
  });

  it("every fixtures/stable config produces zero testing-only field errors (no false positives)", () => {
    const dir = "fixtures/stable";
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const config = JSON.parse(readFileSync(`${dir}/${file}`, "utf8")) as SingBoxConfig;
      const offenders = errorsAt(config, "stable").filter((d) => d.code === "field-testing-only");
      expect(offenders, `${file}: ${offenders.map((d) => d.path).join(", ")}`).toEqual([]);
    }
  });

  it("derived testing-only catalog is stable (snapshot — review on doc regen)", () => {
    // Only types that exist on stable contribute (wholly-testing-only types are gated at the type level).
    expect(allTestingOnlyFields()).toMatchInlineSnapshot(`
      {
        "dns-server": {
          "local": [
            "neighbor_domain",
          ],
          "tailscale": [
            "accept_search_domain",
          ],
        },
        "inbound": {
          "hysteria2": [
            "bbr_profile",
            "realm",
          ],
          "tun": [
            "dns_address",
            "dns_mode",
            "exclude_mac_address",
            "include_mac_address",
          ],
        },
        "outbound": {
          "hysteria2": [
            "bbr_profile",
            "hop_interval_max",
            "realm",
          ],
          "ssh": [
            "cipher",
            "kex_algorithm",
            "mac",
          ],
        },
        "rule-set": {
          "headless-rule": [
            "package_name_regex",
          ],
        },
      }
    `);
  });
});
