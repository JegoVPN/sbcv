import { describe, expect, it } from "vitest";

import { SCHEMA_ROWS, sharedGroupsFromTable } from "../src/domain/schemaRegistry";
import { sharedGroupsForEntity } from "../src/domain/sharedFieldRegistry";
import type { EntityRef } from "../src/domain/types";

const channels = ["stable", "testing"] as const;

describe("schemaRegistry — sharedGroupsFromTable reproduces sharedGroupsForEntity for typed kinds", () => {
  for (const row of SCHEMA_ROWS) {
    for (const channel of channels) {
      it(`${row.kind}:${row.type} @${channel}`, () => {
        const ref = { kind: row.kind, tag: `${row.type}-test` } as EntityRef;
        expect(sharedGroupsFromTable(row.kind, row.type, channel)).toEqual(
          sharedGroupsForEntity(ref, row.type, channel),
        );
      });
    }
  }
});

describe("schemaRegistry — channel-gated rule-set http-client", () => {
  it("remote rule-set surfaces http-client only on testing", () => {
    expect(sharedGroupsFromTable("rule-set", "remote", "stable")).toEqual([]);
    expect(sharedGroupsFromTable("rule-set", "remote", "testing")).toEqual(["http-client"]);
  });
});
