import { describe, expect, it } from "vitest";

import {
  CREATABLE_DNS_SERVER_TYPES,
  CREATABLE_ENDPOINT_TYPES,
  CREATABLE_INBOUND_TYPES,
  CREATABLE_OUTBOUND_TYPES,
  CREATABLE_RULE_SET_TYPES,
  CREATABLE_SERVICE_TYPES,
  DNS_SERVER_PALETTE_TYPES,
  ENDPOINT_PALETTE_TYPES,
  INBOUND_PALETTE_TYPES,
  OUTBOUND_PALETTE_TYPES,
  SERVICE_PALETTE_TYPES,
} from "../src/domain/protocols";
import { typeMinVersion } from "../src/domain/minVersions";
import { creatableTypes, paletteTypeMap, schemaRow } from "../src/domain/schemaRegistry";

describe("schemaRegistry — matches today's CREATABLE lists (order-preserving)", () => {
  it("inbound", () => {
    expect(creatableTypes("inbound")).toEqual([...CREATABLE_INBOUND_TYPES]);
  });
  it("outbound", () => {
    expect(creatableTypes("outbound")).toEqual([...CREATABLE_OUTBOUND_TYPES]);
  });
  it("dns-server", () => {
    expect(creatableTypes("dns-server")).toEqual([...CREATABLE_DNS_SERVER_TYPES]);
  });
  it("endpoint", () => {
    expect(creatableTypes("endpoint")).toEqual([...CREATABLE_ENDPOINT_TYPES]);
  });
  it("service", () => {
    expect(creatableTypes("service")).toEqual([...CREATABLE_SERVICE_TYPES]);
  });
  it("rule-set", () => {
    expect(creatableTypes("rule-set")).toEqual([...CREATABLE_RULE_SET_TYPES]);
  });
});

describe("schemaRegistry — matches today's palette maps", () => {
  it("inbound", () => {
    expect(paletteTypeMap("inbound")).toEqual({ ...INBOUND_PALETTE_TYPES });
  });
  it("outbound", () => {
    expect(paletteTypeMap("outbound")).toEqual({ ...OUTBOUND_PALETTE_TYPES });
  });
  it("dns-server", () => {
    expect(paletteTypeMap("dns-server")).toEqual({ ...DNS_SERVER_PALETTE_TYPES });
  });
  it("endpoint", () => {
    expect(paletteTypeMap("endpoint")).toEqual({ ...ENDPOINT_PALETTE_TYPES });
  });
  it("service", () => {
    expect(paletteTypeMap("service")).toEqual({ ...SERVICE_PALETTE_TYPES });
  });
});

describe("schemaRegistry — type metadata (channel / creatable / required); version via the live source", () => {
  // V10/G5: the dead row-level versionAdded/deprecatedIn/removedIn markers were removed. Per-type minimum
  // versions are asserted against the curated single source (minVersions.TYPE_MIN_VERSION) — which
  // intentionally differs from a raw "since" (e.g. mDNS is gated only in the palette, not on canvas).
  it("cloudflared is testing-only, creatable, token-required (1.14 via the version source)", () => {
    const row = schemaRow("inbound", "cloudflared");
    expect(row?.creatable).toBe(true);
    expect(row?.channel).toBe("testing");
    expect(row?.requiredFields).toEqual(["token"]);
    expect(typeMinVersion("inbound", "cloudflared")).toBe("1.14");
  });
  it("hysteria-realm + mdns are 1.14 testing types", () => {
    expect(schemaRow("service", "hysteria-realm")?.channel).toBe("testing");
    expect(typeMinVersion("service", "hysteria-realm")).toBe("1.14");
    expect(schemaRow("dns-server", "mdns")?.channel).toBe("testing");
    // mdns is deliberately NOT in TYPE_MIN_VERSION (palette-gated, not canvas-badged) — keep that contract.
    expect(typeMinVersion("dns-server", "mdns")).toBeUndefined();
  });
  it("naive outbound / ccm / ocm are 1.13 types (version source)", () => {
    expect(typeMinVersion("outbound", "naive")).toBe("1.13");
    expect(typeMinVersion("service", "ccm")).toBe("1.13");
    expect(typeMinVersion("service", "ocm")).toBe("1.13");
  });
  it("anytls (in/out) and tailscale endpoint are 1.12 types (version source)", () => {
    expect(typeMinVersion("inbound", "anytls")).toBe("1.12");
    expect(typeMinVersion("outbound", "anytls")).toBe("1.12");
    expect(typeMinVersion("endpoint", "tailscale")).toBe("1.12");
  });
  it("wireguard / dns outbounds and legacy DNS server are reference-only (creatable=false)", () => {
    expect(schemaRow("outbound", "wireguard")?.creatable).toBe(false);
    expect(schemaRow("outbound", "dns")?.creatable).toBe(false);
    expect(schemaRow("dns-server", "legacy")?.creatable).toBe(false);
  });
});
