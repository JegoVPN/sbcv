import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateConfig } from "../src/domain/diagnostics";

// Anti-regression guard for the sing-box deprecation audit (1.12 / 1.13 / 1.14 targets).
//
// `docs/upstream/sing-box/testing/deprecated.md` is upstream's authoritative, per-version list of
// deprecated features. It is synced verbatim, so when sing-box adds a new deprecation it appears here
// automatically — and silently, unless something forces us to look. This test parses every `#### <title>`
// entry and asserts each is ACKNOWLEDGED below with how we handle it on the supported targets. A newly
// synced deprecation breaks this test until a human triages it (add a diagnostic, or record why the
// binary's own `check` already covers it).
//
// IMPORTANT: deprecation WARNINGS are emitted by `sing-box run`, not `check`, so the validator container
// (check-based) never sees them — the run-only ones MUST be encoded as static diagnostics here. Trigger
// predicates are binary-verified by run-replay, not copied from the docs (e.g. the address-filter warning
// also fires on a geoip rule-set, which the doc's "(ip_cidr / ip_is_private)" parenthetical omits).

const DEPRECATED_MD = join(__dirname, "../docs/upstream/sing-box/testing/deprecated.md");

/** title (exact `####` heading text) -> how it is handled on the 1.12/1.13/1.14 targets.
 *
 *  `[RR 1.12/1.13/1.14]` records the behaviour BINARY-VERIFIED by run-replay (`sing-box check`/`run`
 *  against the three pinned binaries, 2026-06-01): warn = deprecation warning, error = check/decode
 *  rejection (validator returns invalid), clean = silently accepted. Entries without `[RR ...]` are
 *  classified from the doc + code grep only (removed long before the oldest supported target, or a
 *  non-config item). Trigger predicates for the diagnostics are themselves run-replay-derived — e.g.
 *  the address-filter warning fires on a geoip rule-set, which the doc's "(ip_cidr / ip_is_private)"
 *  parenthetical omits, and `block` is still accepted by the binary despite the doc saying "removed 1.13". */
const ACKNOWLEDGED: Record<string, string> = {
  // 1.14.0 — deprecated on the 1.14 target; run-only (check clean) unless the note says check.
  "Legacy `download_detour` remote rule-set option":
    "diagnostic rule-set-download-detour-deprecated/-removed. [RR run-WARN @1.14, e.g. Gougou.json]",
  "Implicit default HTTP client":
    "diagnostic rule-set-implicit-http-client-deprecated. [RR run-WARN @1.14 only; 1.12/1.13 clean]",
  "Inline ACME options in TLS": "diagnostic: tls.acme deprecation gate (code-verified; not individually run-replayed)",
  "Legacy `strategy` DNS rule action option":
    "diagnostic dns-rule-legacy-strategy-deprecated. [RR run-WARN @1.14 only; 1.12/1.13 clean]",
  "Legacy `rule_set_ip_cidr_accept_empty` DNS rule item":
    "[RR check-WARN @1.14] binary surfaces it via the validator; also feeds dns-rule-mixed-legacy-and-modern-conflict",
  "`independent_cache` DNS option":
    "diagnostic deprecated-dns-independent-cache + binary check-WARN. [RR check-WARN @1.14, e.g. Gougou.json]",
  "`store_rdrc` cache file option":
    "diagnostic cache-file-store-rdrc-deprecated + binary check-WARN. [RR check-WARN @1.14, e.g. Jego.json]",
  "Legacy Address Filter Fields in DNS rules":
    "diagnostic dns-rule-legacy-address-filter-deprecated (ip_cidr/ip_is_private OR geoip rule-set, incl. logical sub-rules). " +
    "[RR run-WARN @1.14; escalates to a cold-start rule-set-init FATAL when a geoip rule-set loads; 1.12/1.13 clean]",
  // 1.12.0
  "Legacy DNS server formats":
    "diagnostic legacy-DNS-server gate + binary. [RR check-WARN @1.12, check-ERROR @1.13, decode-FATAL @1.14]",
  "`outbound` DNS rule item":
    "diagnostic dns-rule-outbound-matcher-deprecated + binary. [RR check-WARN @1.12, check-ERROR @1.13/1.14]",
  "Legacy ECH fields":
    "[RR check-ERROR @1.12/1.13/1.14] binary rejects — validator returns invalid",
  // 1.11.0 — removed in 1.13: check-error on 1.13/1.14, warn/clean on 1.12.
  "Legacy special outbounds":
    "diagnostics: `type:\"dns\"` outbound errors, `type:\"block\"` -> outbound-block-deprecated (warn). " +
    "[RR `dns`: ERROR @1.12, FATAL @1.13/1.14 | `block`: CLEAN on all three — binary still accepts it despite the doc's 'removed 1.13', so our warning is purely informative]",
  "Legacy inbound fields":
    "diagnostic: inbound sniff / domain_strategy gate. [RR check-clean @1.12 (covered statically), decode-FATAL @1.13/1.14]",
  "Destination override fields in direct outbound":
    "diagnostic: override_address/override_port gate + binary. [RR check-ERROR @1.12, decode-FATAL @1.13/1.14]",
  "WireGuard outbound":
    "diagnostic: legacy wireguard-outbound gate + binary. [RR check-ERROR @1.12, decode-FATAL @1.13/1.14]",
  "GSO option in TUN": "[RR check-ERROR @1.12/1.13/1.14] binary rejects — validator returns invalid",
  // 1.10.0 and earlier — removed before the oldest supported target (1.12); decode as unknown-field errors.
  "TUN address fields are merged":
    "removed <=1.12; decode error on supported targets (diagnostic also flags legacy tun address fields). Not individually run-replayed.",
  "Match source rule items are renamed": "removed in 1.11; unknown-field / decode error on all supported targets",
  "Drop support for go1.18 and go1.19": "n/a — Go toolchain requirement, not a config field",
  "Cache file and related features in Clash API": "removed long before supported targets; decode error if present",
  GeoIP: "[RR FATAL @1.12/1.13/1.14] binary rejects at router init",
  Geosite: "[RR FATAL @1.12/1.13/1.14] binary rejects at router init",
  // 1.6.0
  ShadowsocksR: "removed long ago; unsupported protocol type — decode error",
  "Proxy Protocol": "removed long ago — n/a",
};

function parseDeprecatedTitles(md: string): string[] {
  return md
    .split(/\r?\n/)
    .filter((line) => line.startsWith("#### "))
    .map((line) => line.slice(5).trim());
}

describe("sing-box deprecation coverage", () => {
  it("acknowledges every deprecation listed in upstream deprecated.md", () => {
    const titles = parseDeprecatedTitles(readFileSync(DEPRECATED_MD, "utf8"));
    expect(titles.length).toBeGreaterThan(10); // guard against a parse/path regression
    const unacknowledged = titles.filter((t) => !(t in ACKNOWLEDGED));
    expect(
      unacknowledged,
      `New/unrecognized sing-box deprecation(s) in deprecated.md. Triage each (add a diagnostic for run-only ` +
        `warnings, or record that 'check' already errors) and add it to ACKNOWLEDGED:\n  - ${unacknowledged.join("\n  - ")}`,
    ).toEqual([]);
  });

  it("emits the run-only 1.14 deprecation warnings that `check` cannot catch", () => {
    // These three are the run-only warnings the validator (check-based) would otherwise miss.
    const config = {
      outbounds: [{ type: "direct", tag: "direct" }],
      route: {
        rule_set: [{ type: "remote", tag: "geoip-cn", url: "https://example.com/geoip-cn.srs", format: "binary" }],
      },
      dns: {
        servers: [{ type: "udp", tag: "d", server: "1.1.1.1" }],
        rules: [
          { rule_set: "geoip-cn", server: "d" },
          { domain: ["example.com"], action: "route", server: "d", strategy: "ipv4_only" },
        ],
      },
    } as unknown as Parameters<typeof validateConfig>[0];
    const codes = validateConfig(config, "testing").map((d) => d.code);
    expect(codes).toContain("rule-set-implicit-http-client-deprecated");
    expect(codes).toContain("dns-rule-legacy-address-filter-deprecated");
    expect(codes).toContain("dns-rule-legacy-strategy-deprecated");
    // None of them fire on the 1.13 target (binary runs clean there).
    const stable = validateConfig(config, "stable").map((d) => d.code);
    expect(stable).not.toContain("rule-set-implicit-http-client-deprecated");
    expect(stable).not.toContain("dns-rule-legacy-address-filter-deprecated");
    expect(stable).not.toContain("dns-rule-legacy-strategy-deprecated");
  });
});
