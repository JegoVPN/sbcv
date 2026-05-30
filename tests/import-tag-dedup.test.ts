import { beforeEach, describe, expect, it } from "vitest";

import { dedupeTags } from "../src/domain/indexes";
import { useProjectStore } from "../src/state/useProjectStore";
import type { SingBoxConfig } from "../src/domain/types";

// V3 — import dedup. On import, repair duplicate tags (namespace-aware, first wins) and assign tags to
// the kinds sing-box requires them on (rule_set / http_clients). Tagless inbounds/outbounds stay as-is.

describe("V3 — dedupeTags (pure)", () => {
  it("suffixes a same-namespace duplicate, first holder keeps its tag", () => {
    const config = {
      outbounds: [
        { type: "direct", tag: "p" },
        { type: "block", tag: "p" },
        { type: "socks", tag: "p" },
      ],
    } as unknown as SingBoxConfig;
    const tally = dedupeTags(config);
    expect(tally.renamed).toBe(2);
    expect(config.outbounds!.map((o) => o.tag)).toEqual(["p", "p-2", "p-3"]);
  });

  it("assigns a tag to a blank-tag rule_set / http_client (sing-box requires it)", () => {
    const config = {
      route: { rule_set: [{ type: "remote", format: "binary", url: "https://x/y.srs" }] },
      http_clients: [{}],
    } as unknown as SingBoxConfig;
    const tally = dedupeTags(config);
    expect(tally.assigned).toBe(2);
    expect((config.route!.rule_set as Array<{ tag?: string }>)[0]!.tag).toBe("rule-set");
    expect(config.http_clients![0]!.tag).toBe("http-client");
  });

  it("leaves tagless inbounds/outbounds untouched (valid for sing-box)", () => {
    const config = {
      inbounds: [{ type: "mixed", listen: "127.0.0.1", listen_port: 2080 }],
      outbounds: [{ type: "direct" }],
    } as unknown as SingBoxConfig;
    const tally = dedupeTags(config);
    expect(tally).toEqual({ renamed: 0, assigned: 0 });
    expect(config.inbounds![0]!.tag).toBeUndefined();
    expect(config.outbounds![0]!.tag).toBeUndefined();
  });

  it("does not collide across distinct namespaces (inbound vs outbound)", () => {
    const config = {
      inbounds: [{ type: "mixed", tag: "x", listen: "127.0.0.1", listen_port: 2080 }],
      outbounds: [{ type: "direct", tag: "x" }],
    } as unknown as SingBoxConfig;
    const tally = dedupeTags(config);
    expect(tally.renamed).toBe(0);
    expect(config.inbounds![0]!.tag).toBe("x");
    expect(config.outbounds![0]!.tag).toBe("x");
  });
});

describe("V3 — importJson normalizes + toasts", () => {
  beforeEach(() => {
    useProjectStore.setState({ toasts: [] });
  });

  it("dedupes duplicate tags on import and raises an info toast", () => {
    const result = useProjectStore.getState().importJson(
      JSON.stringify({ outbounds: [{ type: "direct", tag: "dup" }, { type: "block", tag: "dup" }] }),
    );
    expect(result.ok).toBe(true);
    const outbounds = useProjectStore.getState().config.outbounds!;
    expect(outbounds.map((o) => o.tag)).toEqual(["dup", "dup-2"]);
    const toast = useProjectStore.getState().toasts.find((t) => /Normalized on import/.test(t.message));
    expect(toast?.tone).toBe("info");
    expect(toast?.message).toMatch(/renamed 1 duplicate tag/);
  });

  it("raises no normalize toast for a clean config", () => {
    useProjectStore.getState().importJson(JSON.stringify({ outbounds: [{ type: "direct", tag: "a" }] }));
    expect(useProjectStore.getState().toasts.some((t) => /Normalized on import/.test(t.message))).toBe(false);
  });
});
