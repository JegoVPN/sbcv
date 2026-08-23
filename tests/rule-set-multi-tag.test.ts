import { describe, expect, it } from "vitest";
import { deriveGraph } from "../src/canvas/graph";
import { deleteEntity, renameTag, updateEntityField } from "../src/domain/commands";
import { nodeIdForDiagnosticPath } from "../src/domain/diagnosticTargets";
import { validateConfig } from "../src/domain/diagnostics";
import { dedupeTags, getRuleSetTags, getTaggedEntities } from "../src/domain/indexes";
import { parseConfigJson, stringifyConfig } from "../src/domain/serialization";
import type { SingBoxConfig } from "../src/domain/types";

function groupedConfig(): SingBoxConfig {
  return {
    route: {
      rules: [{ rule_set: "geo-b", outbound: "direct" }],
      rule_set: [
        {
          type: "remote",
          tag: ["geo-a", "geo-b"],
          format: "binary",
          url: "https://example.com/{tag}.srs",
        },
      ],
    },
    dns: { rules: [{ rule_set: ["geo-a", "unrelated"] }] },
    inbounds: [{ type: "tun", tag: "tun-in", route_address_set: ["geo-a", "geo-b", "keep"] }],
    outbounds: [{ type: "direct", tag: "direct" }],
  };
}

describe("sing-box 1.14 grouped rule-set tags", () => {
  it("projects one canonical object as one node and resolves every tag edge to it", () => {
    const config = groupedConfig();
    const graph = deriveGraph(config, { positions: {} }, []);
    const ruleSetNodes = graph.nodes.filter((node) => node.data.kind === "rule-set");

    expect(ruleSetNodes).toHaveLength(1);
    expect(ruleSetNodes[0]).toMatchObject({
      id: "rule-set:geo-a",
      data: { title: "geo-a, geo-b", ref: { kind: "rule-set", tag: "geo-a" } },
    });
    expect(graph.edges.find((edge) => edge.id.includes("route-rule-set"))?.target).toBe("rule-set:geo-a");
    expect(graph.edges.find((edge) => edge.id.includes("dns-rule-set") && edge.id.includes("geo-a"))?.target).toBe("rule-set:geo-a");
    expect(graph.nodes.some((node) => node.id === "rule-set:geo-b")).toBe(false);
    expect(nodeIdForDiagnosticPath("/route/rule_set/0/url", config)).toBe("rule-set:geo-a");
  });

  it("indexes both tags and preserves the tag list through JSON import/export", () => {
    const config = groupedConfig();
    expect([...getRuleSetTags(config)]).toEqual(["geo-a", "geo-b"]);
    expect(getTaggedEntities(config).filter((entity) => entity.kind === "rule-set").map((entity) => entity.tag)).toEqual([
      "geo-a",
      "geo-b",
    ]);

    const imported = parseConfigJson(stringifyConfig(config));
    expect(imported.route?.rule_set?.[0]?.tag).toEqual(["geo-a", "geo-b"]);
  });

  it("updates and renames through either tag without flattening the canonical group", () => {
    const updated = updateEntityField(groupedConfig(), { kind: "rule-set", tag: "geo-b" }, "update_interval", "1d");
    expect(updated.route?.rule_set?.[0]).toMatchObject({ tag: ["geo-a", "geo-b"], update_interval: "1d" });

    const renamed = renameTag(updated, "rule-set", "geo-b", "geo-c");
    expect(renamed.route?.rule_set?.[0]?.tag).toEqual(["geo-a", "geo-c"]);
    expect(renamed.route?.rules?.[0]?.rule_set).toBe("geo-c");
    expect(renamed.dns?.rules?.[0]?.rule_set).toEqual(["geo-a", "unrelated"]);
    expect(renamed.inbounds?.[0]?.route_address_set).toEqual(["geo-a", "geo-c", "keep"]);
  });

  it("deleting a grouped node removes the object and references to all its tags", () => {
    const deleted = deleteEntity(groupedConfig(), { kind: "rule-set", tag: "geo-b" });
    expect(deleted.route?.rule_set).toEqual([]);
    expect(deleted.route?.rules?.[0]?.rule_set).toBeUndefined();
    expect(deleted.dns?.rules?.[0]?.rule_set).toBe("unrelated");
    expect(deleted.inbounds?.[0]?.route_address_set).toEqual(["keep"]);
  });

  it("deduplicates individual tags without replacing a valid tag array", () => {
    const config: SingBoxConfig = {
      route: { rule_set: [{ type: "remote", tag: ["geo", "geo"], url: "https://example.com/{tag}.srs" }] },
    };
    expect(dedupeTags(config)).toEqual({ assigned: 0, renamed: 1 });
    expect(config.route?.rule_set?.[0]?.tag).toEqual(["geo", "geo-2"]);
  });

  it("enforces the 1.14 channel, placeholder, and inline constraints", () => {
    const valid = groupedConfig();
    const testingErrors = validateConfig(valid, "testing").filter((diagnostic) => diagnostic.level === "error");
    expect(testingErrors.map((diagnostic) => diagnostic.code)).not.toContain("rule-set-multi-tag-placeholder-missing");

    expect(validateConfig(valid, "stable").map((diagnostic) => diagnostic.code)).toContain("rule-set-multi-tag-testing-only");

    const invalid: SingBoxConfig = {
      route: {
        rule_set: [
          { type: "remote", tag: ["a", "b"], format: "binary", url: "https://example.com/all.srs" },
          { type: "inline", tag: ["c", "d"], rules: [] },
        ],
      },
    };
    const codes = validateConfig(invalid, "testing").map((diagnostic) => diagnostic.code);
    expect(codes).toContain("rule-set-multi-tag-placeholder-missing");
    expect(codes).toContain("rule-set-multi-tag-inline-conflict");
  });
});
