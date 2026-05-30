import { describe, expect, it } from "vitest";
import { TYPE_MIN_VERSION, typeMinVersion } from "../src/domain/minVersions";
import { SCHEMA_ROWS } from "../src/domain/schemaRegistry";

// W10/A1 — the per-type min-version now lives on SCHEMA_ROWS[].minVersion; minVersions.ts derives
// TYPE_MIN_VERSION from it. This guard asserts the single source: every TYPE_MIN_VERSION entry comes
// from a row, and every row.minVersion is surfaced — so a new versioned type can only be added on its
// schema row (the badge + the diagnostics gate can never drift from the table).

describe("W10/A1 — TYPE_MIN_VERSION is derived from SCHEMA_ROWS (single source)", () => {
  it("each row.minVersion is surfaced and vice-versa", () => {
    const fromRows = new Map<string, string>();
    for (const row of SCHEMA_ROWS) if (row.minVersion) fromRows.set(`${row.kind}:${row.type}`, row.minVersion);

    expect(new Set(Object.keys(TYPE_MIN_VERSION))).toEqual(new Set(fromRows.keys()));
    for (const [key, version] of fromRows) expect(TYPE_MIN_VERSION[key]).toBe(version);
  });

  it("keeps the known type gates (binary-grounded values)", () => {
    expect(typeMinVersion("outbound", "naive")).toBe("1.13");
    expect(typeMinVersion("service", "ccm")).toBe("1.13");
    expect(typeMinVersion("inbound", "cloudflared")).toBe("1.14");
    expect(typeMinVersion("service", "hysteria-realm")).toBe("1.14");
    expect(typeMinVersion("dns-server", "mdns")).toBe("1.14");
    // the naive INBOUND predates 1.13 — only the outbound row carries a min-version
    expect(typeMinVersion("inbound", "naive")).toBeUndefined();
  });
});
