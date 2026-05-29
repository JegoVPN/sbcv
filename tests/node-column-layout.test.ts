import { describe, expect, it } from "vitest";
import { createStableTunSplitConfig } from "../src/domain/commands";
import { deriveGraph } from "../src/canvas/graph";

// The settings column (Log / NTP / Certificate / Experimental) must sit at least one card-width to the
// LEFT of the entry column (x=0), so a 330px-wide settings card never overlaps an entry-column card by
// default. Regression guard for the "Log node pressed under Route" overlap: the columns were only 300px
// apart (< card width), so Log and the Route hub shared the same y and overlapped horizontally.
const CARD_WIDTH = 330; // .sbc-node-shell width in styles.css

describe("node column layout — settings column clearance", () => {
  it("places settings nodes at least one card-width left of the entry column", () => {
    const config = createStableTunSplitConfig();
    const { nodes } = deriveGraph(config, { positions: {} }, []);
    const log = nodes.find((node) => node.id === "settings:log");
    expect(log).toBeDefined();
    // The entry column anchors at x=0; a card placed at the settings x must clear it entirely.
    expect(log!.position.x + CARD_WIDTH).toBeLessThanOrEqual(0);
  });
});
