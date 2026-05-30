import { describe, expect, it } from "vitest";

import { validateConfig, validateFieldMeta } from "../src/domain/diagnostics";
import type { SchemaFieldMeta } from "../src/domain/schemaRegistry";
import type { SingBoxConfig } from "../src/domain/types";

// V1 — enum/type validation diagnostics. Consumes the V0-S1 schemaRegistry field metadata to flag a
// scalar field whose value isn't a known enum value (or is the wrong type), error-level, pathed to
// /<collection>/<index>/<field>. Respects the active (channel, version) target. Pure diagnostic add.

const stable = { channel: "stable" as const, version: "1.13" };
const testing = { channel: "testing" as const, version: "1.14" };

describe("V1 — validateFieldMeta (engine)", () => {
  const methodMeta: SchemaFieldMeta = {
    path: ["method"],
    type: "enum",
    doc: "outbound/shadowsocks.md",
    enum: [{ value: "aes-128-gcm" }, { value: "aes-128-ctr", deprecated: true }],
  };

  it("passes a documented value and unset (undefined/empty/null)", () => {
    expect(validateFieldMeta(methodMeta, "aes-128-gcm", stable)).toBeNull();
    expect(validateFieldMeta(methodMeta, undefined, stable)).toBeNull();
    expect(validateFieldMeta(methodMeta, "", stable)).toBeNull();
    expect(validateFieldMeta(methodMeta, null, stable)).toBeNull();
  });

  it("passes a deprecated-but-valid value (round-trip safety)", () => {
    expect(validateFieldMeta(methodMeta, "aes-128-ctr", stable)).toBeNull();
  });

  it("flags an unknown enum value as enum-invalid", () => {
    const result = validateFieldMeta(methodMeta, "rc4-md6", stable);
    expect(result?.code).toBe("enum-invalid");
    expect(result?.message).toContain("rc4-md6");
  });

  it("coerces numeric enum values (shadowtls version stored as a number)", () => {
    const versionMeta: SchemaFieldMeta = {
      path: ["version"],
      type: "enum",
      doc: "outbound/shadowtls.md",
      enum: [{ value: "1" }, { value: "2" }, { value: "3" }],
    };
    expect(validateFieldMeta(versionMeta, 3, stable)).toBeNull();
    expect(validateFieldMeta(versionMeta, 9, stable)?.code).toBe("enum-invalid");
  });

  it("gates a channel/version-restricted value against the target", () => {
    const obfsMeta: SchemaFieldMeta = {
      path: ["obfs", "type"],
      type: "enum",
      doc: "outbound/hysteria2.md",
      enum: [{ value: "salamander" }, { value: "gecko", since: "1.14", channel: "testing" }],
    };
    // gecko on stable → invalid (known value, wrong target)
    const onStable = validateFieldMeta(obfsMeta, "gecko", stable);
    expect(onStable?.code).toBe("enum-invalid");
    expect(onStable?.message).toMatch(/testing|1\.14/);
    // gecko on testing/1.14 → valid
    expect(validateFieldMeta(obfsMeta, "gecko", testing)).toBeNull();
    // salamander valid on both
    expect(validateFieldMeta(obfsMeta, "salamander", stable)).toBeNull();
  });

  it("flags a wrong-typed scalar (type-invalid) for number/boolean fields", () => {
    const mtuMeta: SchemaFieldMeta = { path: ["mtu"], type: "number", doc: "inbound/tun.md" };
    expect(validateFieldMeta(mtuMeta, 1500, stable)).toBeNull();
    expect(validateFieldMeta(mtuMeta, "1500", stable)?.code).toBe("type-invalid");

    const boolMeta: SchemaFieldMeta = { path: ["strict_route"], type: "boolean", doc: "inbound/tun.md" };
    expect(validateFieldMeta(boolMeta, true, stable)).toBeNull();
    expect(validateFieldMeta(boolMeta, "true", stable)?.code).toBe("type-invalid");
  });
});

describe("V1 — validateConfig end-to-end paths", () => {
  function outboundConfig(outbound: Record<string, unknown>): SingBoxConfig {
    return { outbounds: [outbound] } as unknown as SingBoxConfig;
  }

  it("emits enum-invalid pathed to /outbounds/<i>/<field>", () => {
    const config = outboundConfig({
      type: "shadowsocks",
      tag: "ss",
      server: "x",
      server_port: 8080,
      method: "rc4-md6",
      password: "p",
    });
    const diag = validateConfig(config, "stable").find((d) => d.code === "enum-invalid");
    expect(diag?.level).toBe("error");
    expect(diag?.path).toBe("/outbounds/0/method");
    expect(diag?.source).toBe("semantic");
  });

  it("emits enum-invalid for a nested field path (obfs.type)", () => {
    const config = outboundConfig({
      type: "hysteria2",
      tag: "h2",
      server: "x",
      server_port: 8080,
      password: "p",
      up_mbps: 10,
      down_mbps: 10,
      obfs: { type: "nope" },
    });
    const diag = validateConfig(config, "stable").find((d) => d.code === "enum-invalid");
    expect(diag?.path).toBe("/outbounds/0/obfs/type");
  });

  it("a legal config produces zero enum-invalid / type-invalid", () => {
    const config = outboundConfig({
      type: "tuic",
      tag: "t",
      server: "x",
      server_port: 8080,
      uuid: "u",
      password: "p",
      congestion_control: "cubic",
      udp_relay_mode: "native",
      tls: { enabled: true, server_name: "e" },
    });
    const bad = validateConfig(config, "stable").filter(
      (d) => d.code === "enum-invalid" || d.code === "type-invalid",
    );
    expect(bad).toEqual([]);
  });

  it("flags gecko obfs on a stable target but not on testing", () => {
    const make = (): Record<string, unknown> => ({
      type: "hysteria2",
      tag: "h2",
      server: "x",
      server_port: 8080,
      password: "p",
      up_mbps: 10,
      down_mbps: 10,
      obfs: { type: "gecko", password: "o" },
    });
    expect(validateConfig(outboundConfig(make()), "stable").some((d) => d.code === "enum-invalid")).toBe(true);
    expect(validateConfig(outboundConfig(make()), "testing").some((d) => d.code === "enum-invalid")).toBe(false);
  });
});
