import { describe, expect, it } from "vitest";

import {
  createDnsServer,
  createEndpoint,
  createInbound,
  createOutbound,
  createRuleSet,
  createService,
} from "../src/domain/commands";
import { SCHEMA_ROWS, type SchemaEntityKind } from "../src/domain/schemaRegistry";

const create: Record<SchemaEntityKind, (type: string, tag: string) => unknown> = {
  inbound: createInbound,
  outbound: createOutbound,
  "dns-server": createDnsServer,
  endpoint: createEndpoint,
  service: createService,
  "rule-set": createRuleSet,
};

describe("schemaRegistry — factory output is byte-identical to commands.create*()", () => {
  for (const row of SCHEMA_ROWS) {
    it(`${row.kind}:${row.type}`, () => {
      const tag = `${row.type}-test`;
      expect(row.factory(tag)).toEqual(create[row.kind](row.type, tag));
    });
  }
});
