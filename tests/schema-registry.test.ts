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

describe("schemaRegistry — version / deprecation markers (faithful to nodeLabels today)", () => {
  it("cloudflared is testing-only, 1.14, creatable, token-required", () => {
    const row = schemaRow("inbound", "cloudflared");
    expect(row?.creatable).toBe(true);
    expect(row?.channel).toBe("testing");
    expect(row?.versionAdded).toBe("1.14");
    expect(row?.requiredFields).toEqual(["token"]);
  });
  it("hysteria-realm + mdns are 1.14 testing types", () => {
    expect(schemaRow("service", "hysteria-realm")?.versionAdded).toBe("1.14");
    expect(schemaRow("service", "hysteria-realm")?.channel).toBe("testing");
    expect(schemaRow("dns-server", "mdns")?.versionAdded).toBe("1.14");
    expect(schemaRow("dns-server", "mdns")?.channel).toBe("testing");
  });
  it("naive outbound / ccm / ocm are 1.13 types", () => {
    expect(schemaRow("outbound", "naive")?.versionAdded).toBe("1.13");
    expect(schemaRow("service", "ccm")?.versionAdded).toBe("1.13");
    expect(schemaRow("service", "ocm")?.versionAdded).toBe("1.13");
  });
  it("anytls (in/out) and tailscale endpoint are 1.12 types", () => {
    expect(schemaRow("inbound", "anytls")?.versionAdded).toBe("1.12");
    expect(schemaRow("outbound", "anytls")?.versionAdded).toBe("1.12");
    expect(schemaRow("endpoint", "tailscale")?.versionAdded).toBe("1.12");
  });
  it("wireguard / dns outbounds are reference-only (creatable=false) with deprecated+removed markers", () => {
    const wg = schemaRow("outbound", "wireguard");
    expect(wg?.creatable).toBe(false);
    expect(wg?.deprecatedIn).toBe("1.11");
    expect(wg?.removedIn).toBe("1.13");
    const dns = schemaRow("outbound", "dns");
    expect(dns?.creatable).toBe(false);
    expect(dns?.deprecatedIn).toBe("1.11");
    expect(dns?.removedIn).toBe("1.13");
  });
  it("legacy DNS server is reference-only with deprecated 1.12 / removed 1.14", () => {
    const legacy = schemaRow("dns-server", "legacy");
    expect(legacy?.creatable).toBe(false);
    expect(legacy?.deprecatedIn).toBe("1.12");
    expect(legacy?.removedIn).toBe("1.14");
  });
});
