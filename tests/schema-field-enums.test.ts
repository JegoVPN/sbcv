import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  SCHEMA_ROWS,
  fieldMetaFor,
  type SchemaEnumOption,
  type SchemaFieldMeta,
} from "../src/domain/schemaRegistry";

// V0-S1 — per-(kind,type) scalar enum/type metadata on SchemaRow.fields is the data底座 for V1
// enum/type validation and V5 consistency. This test pins every enum value to its single source of
// truth (docs/upstream/sing-box/{stable,testing}/...): each value must literally appear (backtick-
// quoted) in the cited doc, so a typo'd or hallucinated value fails the build. A handful of critical
// fields also assert the exact value set, to catch omissions the containment check alone would miss.

const here = dirname(fileURLToPath(import.meta.url));
const UPSTREAM = resolve(here, "../docs/upstream/sing-box");

const docCache = new Map<string, string>();
function docText(channel: "stable" | "testing", doc: string): string {
  const key = `${channel}/${doc}`;
  let text = docCache.get(key);
  if (text === undefined) {
    text = readFileSync(resolve(UPSTREAM, channel, "configuration", doc), "utf8");
    docCache.set(key, text);
  }
  return text;
}

// A value counts as "documented" when it appears in the cited doc as a standalone token — either
// backtick-quoted (`salamander`) or as a markdown table cell (| packetaddr |). We bound the literal
// value by non-identifier chars so "bbr" never matches inside "bbr2" (catching omitted enum values).
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function docMentions(channel: "stable" | "testing", doc: string, value: string): boolean {
  const token = new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(value)}([^A-Za-z0-9_]|$)`);
  return token.test(docText(channel, doc));
}

function valuesOf(field: SchemaFieldMeta): string[] {
  return (field.enum ?? []).map((option) => option.value);
}

const enumFields: Array<{ kind: string; type: string; field: SchemaFieldMeta }> = [];
for (const row of SCHEMA_ROWS) {
  for (const field of row.fields ?? []) {
    enumFields.push({ kind: row.kind, type: row.type, field });
  }
}

describe("V0-S1 — schema field enum metadata", () => {
  it("seeds enum metadata for the headline protocol discriminators", () => {
    // Sanity: the table is actually populated (guards against an empty seed silently passing).
    expect(enumFields.length).toBeGreaterThanOrEqual(15);
  });

  it("every enum option's value is documented in its cited upstream doc", () => {
    const undocumented: string[] = [];
    for (const { kind, type, field } of enumFields) {
      if (field.type !== "enum") continue;
      for (const option of field.enum ?? []) {
        // testing-only values live in the testing tree; everything else must exist in stable.
        const channel = option.channel === "testing" ? "testing" : "stable";
        if (!docMentions(channel, field.doc, option.value)) {
          undocumented.push(`${kind}:${type}/${field.path.join(".")} = "${option.value}" not in ${channel}/${field.doc}`);
        }
      }
    }
    expect(undocumented).toEqual([]);
  });

  it("enum fields are well-formed (non-empty, no duplicate values, labels distinct from noise)", () => {
    for (const { kind, type, field } of enumFields) {
      const label = `${kind}:${type}/${field.path.join(".")}`;
      if (field.type === "enum") {
        const values = valuesOf(field);
        expect(values.length, `${label} enum must be non-empty`).toBeGreaterThan(0);
        expect(new Set(values).size, `${label} has duplicate enum values`).toBe(values.length);
        for (const v of values) {
          expect(v.length, `${label} has an empty enum value`).toBeGreaterThan(0);
        }
      } else {
        expect(field.enum, `${label} is type=${field.type} and must not carry an enum`).toBeUndefined();
      }
    }
  });

  // Exact-set spot checks for the highest-value discriminators — these guard against a missing value
  // (which the containment check would not catch). Each set is transcribed from the cited doc.
  const exact = (kind: any, type: string, path: string[]): string[] => {
    const field = (fieldMetaFor(kind, type) ?? []).find((f) => f.path.join(".") === path.join("."));
    return field ? valuesOf(field) : [];
  };

  it("tuic congestion_control / udp_relay_mode match outbound/tuic.md", () => {
    expect(exact("outbound", "tuic", ["congestion_control"])).toEqual(["cubic", "new_reno", "bbr"]);
    expect(exact("outbound", "tuic", ["udp_relay_mode"])).toEqual(["native", "quic"]);
  });

  it("naive quic_congestion_control differs inbound (6) vs outbound (4) per the docs", () => {
    expect(exact("inbound", "naive", ["quic_congestion_control"])).toEqual([
      "bbr",
      "bbr_standard",
      "bbr2",
      "bbr2_variant",
      "cubic",
      "reno",
    ]);
    expect(exact("outbound", "naive", ["quic_congestion_control"])).toEqual(["bbr", "bbr2", "cubic", "reno"]);
  });

  it("tun stack and shadowtls version match their docs", () => {
    expect(exact("inbound", "tun", ["stack"])).toEqual(["system", "gvisor", "mixed"]);
    expect(exact("outbound", "shadowtls", ["version"])).toEqual(["1", "2", "3"]);
    expect(exact("inbound", "shadowtls", ["version"])).toEqual(["1", "2", "3"]);
  });

  it("vmess security keeps the legacy aes-128-ctr value flagged deprecated", () => {
    const field = (fieldMetaFor("outbound", "vmess") ?? []).find((f) => f.path.join(".") === "security")!;
    const legacy = (field.enum ?? []).find((o: SchemaEnumOption) => o.value === "aes-128-ctr");
    expect(legacy?.deprecated).toBe(true);
  });

  it("hysteria2 obfs.type gates gecko to testing/1.14", () => {
    const field = (fieldMetaFor("outbound", "hysteria2") ?? []).find((f) => f.path.join(".") === "obfs.type")!;
    const gecko = (field.enum ?? []).find((o: SchemaEnumOption) => o.value === "gecko");
    expect(gecko?.channel).toBe("testing");
    expect(gecko?.since).toBe("1.14");
  });
});
