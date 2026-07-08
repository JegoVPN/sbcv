import { describe, expect, it } from "vitest";

import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxConfig } from "../src/domain/types";

// Escalations surfaced by the pk-box external corpus cross-check (diagnostics vs the real binaries):
// on the CURRENT pins the check itself fails for these legacy shapes, so a warning would greenlight a
// config the binary rejects. Every claim below is binary-verified (1.12.25 / 1.13.14 / 1.14.0-alpha.40):
//  - dial domain_strategy (outbound/endpoint/ntp): 1.12 warns+passes; 1.13.14 + alpha.40 exit 1
//    ("set ENABLE_DEPRECATED_LEGACY_DOMAIN_STRATEGY_OPTIONS=true"). DNS-server dial fields still
//    accept it on every binary — that emission must STAY a warning.
//  - inbound sniff*/domain_strategy: 1.12 accepts; 1.13.14 + alpha.40 decode-FATAL
//    ("legacy inbound fields are deprecated…").
//  - rule clash_mode must be a string: arrays (a reF1nd-fork extension) decode-FATAL on vanilla
//    sing-box for both route and DNS rules.

function findings(config: SingBoxConfig, channel: "stable" | "testing", version: string, code: string) {
  return validateConfig(config, channel, version).filter((d) => d.code === code);
}

describe("dial domain_strategy escalation (removed behind an env gate on 1.13+ binaries)", () => {
  const outbound = {
    outbounds: [{ type: "socks", tag: "s", server: "example.com", server_port: 1080, domain_strategy: "prefer_ipv4" }],
  } as unknown as SingBoxConfig;

  it("stays a warning on a 1.12 target (binary warns and passes)", () => {
    const hits = findings(outbound, "stable", "1.12", "dial-domain-strategy-deprecated");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.level).toBe("warning");
  });

  it("errors on 1.13 and 1.14 targets (binary check exits 1)", () => {
    for (const [channel, version] of [["stable", "1.13"], ["testing", "1.14"]] as const) {
      const hits = findings(outbound, channel, version, "dial-domain-strategy-deprecated");
      expect(hits, `${channel}/${version}`).toHaveLength(1);
      expect(hits[0]!.level, `${channel}/${version}`).toBe("error");
      expect(hits[0]!.message).toContain("ENABLE_DEPRECATED_LEGACY_DOMAIN_STRATEGY_OPTIONS");
    }
  });

  it("dns-server dial domain_strategy STAYS a warning on 1.13 (binary still accepts it there)", () => {
    const config = {
      dns: { servers: [{ type: "udp", tag: "u", server: "1.1.1.1", domain_strategy: "prefer_ipv4" }] },
    } as unknown as SingBoxConfig;
    const hits = findings(config, "stable", "1.13", "dial-domain-strategy-deprecated");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.level).toBe("warning");
  });

  it("endpoint and ntp emissions escalate with the same gate", () => {
    const config = {
      endpoints: [{ type: "wireguard", tag: "wg", domain_strategy: "prefer_ipv4" }],
      ntp: { enabled: true, server: "time.apple.com", domain_strategy: "prefer_ipv4" },
    } as unknown as SingBoxConfig;
    const hits = findings(config, "stable", "1.13", "dial-domain-strategy-deprecated");
    expect(hits.map((d) => d.level)).toEqual(["error", "error"]);
  });
});

describe("legacy inbound fields escalation (decode-FATAL on 1.13+ binaries)", () => {
  const config = {
    inbounds: [
      { type: "mixed", tag: "m1", listen: "127.0.0.1", listen_port: 1, sniff: true },
      { type: "mixed", tag: "m2", listen: "127.0.0.1", listen_port: 2, domain_strategy: "prefer_ipv4" },
    ],
  } as unknown as SingBoxConfig;

  it("warnings on 1.12 (binary accepts)", () => {
    expect(findings(config, "stable", "1.12", "inbound-legacy-sniff-deprecated")[0]?.level).toBe("warning");
    expect(findings(config, "stable", "1.12", "inbound-legacy-domain-strategy-deprecated")[0]?.level).toBe("warning");
  });

  it("errors on 1.13 and 1.14 (binary decode-FATALs)", () => {
    for (const [channel, version] of [["stable", "1.13"], ["testing", "1.14"]] as const) {
      expect(findings(config, channel, version, "inbound-legacy-sniff-deprecated")[0]?.level, `sniff ${version}`).toBe("error");
      expect(findings(config, channel, version, "inbound-legacy-domain-strategy-deprecated")[0]?.level, `ds ${version}`).toBe("error");
    }
  });

  it("zero-valued sniff fields stay warnings on 1.13+ — the binaries only reject non-zero values", () => {
    // Binary-verified: sniff:false / sniff_override_destination:false / sniff_timeout:"0s" all pass
    // check with exit 0 on 1.13.14 AND alpha.40 (the legacy gate keys on non-zero decoded values).
    const zeroValued = {
      inbounds: [
        { type: "mixed", tag: "z1", listen: "127.0.0.1", listen_port: 1, sniff: false },
        { type: "mixed", tag: "z2", listen: "127.0.0.1", listen_port: 2, sniff_override_destination: false },
        { type: "mixed", tag: "z3", listen: "127.0.0.1", listen_port: 3, sniff_timeout: "0s" },
      ],
    } as unknown as SingBoxConfig;
    const hits = findings(zeroValued, "stable", "1.13", "inbound-legacy-sniff-deprecated");
    expect(hits).toHaveLength(3);
    for (const hit of hits) expect(hit.level).toBe("warning");
    // A non-zero timeout IS check-fatal.
    const nonZero = {
      inbounds: [{ type: "mixed", tag: "t", listen: "127.0.0.1", listen_port: 4, sniff_timeout: "300ms" }],
    } as unknown as SingBoxConfig;
    expect(findings(nonZero, "stable", "1.13", "inbound-legacy-sniff-deprecated")[0]?.level).toBe("error");
  });
});

describe("rule clash_mode type gate (fork-style arrays are rejected by vanilla sing-box)", () => {
  it("errors on array clash_mode in route rules, dns rules, and logical sub-rules", () => {
    const config = {
      outbounds: [{ type: "direct", tag: "direct" }],
      dns: {
        servers: [{ type: "local", tag: "local" }],
        rules: [{ clash_mode: ["direct"], server: "local" }],
      },
      route: {
        rules: [
          { clash_mode: ["direct"], outbound: "direct" },
          { type: "logical", mode: "and", rules: [{ clash_mode: ["global"] }, { network: "tcp" }], outbound: "direct" },
        ],
      },
    } as unknown as SingBoxConfig;
    const hits = validateConfig(config, "testing", "1.14").filter((d) => d.code === "rule-clash-mode-type");
    expect(hits.map((d) => d.path).sort()).toEqual([
      "/dns/rules/0/clash_mode",
      "/route/rules/0/clash_mode",
      "/route/rules/1/rules/0/clash_mode",
    ]);
    for (const hit of hits) expect(hit.level).toBe("error");
  });

  it("silent on string clash_mode — and on null, which all three binaries decode as a no-op", () => {
    const config = {
      outbounds: [{ type: "direct", tag: "direct" }],
      route: { rules: [{ clash_mode: "direct", outbound: "direct" }, { clash_mode: null, outbound: "direct" }] },
    } as unknown as SingBoxConfig;
    expect(validateConfig(config, "testing", "1.14").filter((d) => d.code === "rule-clash-mode-type")).toEqual([]);
  });
});
