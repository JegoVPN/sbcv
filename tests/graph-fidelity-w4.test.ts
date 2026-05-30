import { describe, expect, it } from "vitest";

import { deriveGraph } from "../src/canvas/graph";
import { removeRegisteredTagReferences, replaceRegisteredTagReferences } from "../src/domain/referenceRegistry";
import type { SingBoxConfig } from "../src/domain/types";

// W4 (re-run#3 m1/m2): two graph-fidelity gaps.
//  m1 — legacy DNS server `address_resolver` (a dns-server tag) was tracked NOWHERE, so renaming the
//       referenced resolver silently broke the link and deleting it left a dangling ref.
//  m2 — past the rule-set canvas cap the whole block was hidden SILENTLY; now an overflow notice appears.

describe("W4/m1 — legacy DNS address_resolver is cascade-tracked", () => {
  const make = (): SingBoxConfig =>
    ({
      dns: {
        servers: [
          { type: "udp", tag: "boot", server: "1.1.1.1", server_port: 53 },
          { tag: "leg", address: "dns.example.com", address_resolver: "boot" },
        ],
      },
    }) as unknown as SingBoxConfig;

  it("rename rewrites address_resolver", () => {
    const config = make();
    replaceRegisteredTagReferences(config, "boot", "boot2");
    expect((config.dns!.servers![1] as Record<string, unknown>).address_resolver).toBe("boot2");
  });

  it("delete scrubs the dangling address_resolver", () => {
    const config = make();
    removeRegisteredTagReferences(config, "dns-server", "boot");
    expect((config.dns!.servers![1] as Record<string, unknown>).address_resolver).toBeUndefined();
  });
});

describe("W4/m2 — rule-set overflow notice", () => {
  const ruleSets = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ type: "remote", tag: `rs${i}`, url: `https://x/${i}.srs`, format: "binary" }));
  const graphOf = (n: number) =>
    deriveGraph({ route: { rule_set: ruleSets(n) } } as unknown as SingBoxConfig, { positions: {} }, []);

  it("shows a rule-sets-overflow notice (and no rule-set nodes) past the 24-node cap", () => {
    const g = graphOf(30);
    expect(g.nodes.some((n) => n.id === "notice:rule-sets-overflow")).toBe(true);
    expect(g.nodes.some((n) => n.data.kind === "rule-set")).toBe(false);
    expect(g.nodes.find((n) => n.id === "notice:rule-sets-overflow")?.data.title).toContain("30");
  });

  it("renders rule-set nodes (and no overflow notice) at/under the cap", () => {
    const g = graphOf(3);
    expect(g.nodes.filter((n) => n.data.kind === "rule-set")).toHaveLength(3);
    expect(g.nodes.some((n) => n.id === "notice:rule-sets-overflow")).toBe(false);
  });
});
