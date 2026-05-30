import { afterEach, describe, expect, it, vi } from "vitest";
import { useProjectStore } from "../src/state/useProjectStore";

// W5: the validation message is now honest about heuristic-vs-binary. Tests run with no
// VITE_OFFICIAL_CHECK_URL configured, so the message is the heuristic-only variant.
const BROWSER_VALIDATION_MESSAGE =
  "Validation is heuristic (semantic linter) only — exports are NOT verified against the sing-box binary. Set VITE_OFFICIAL_CHECK_URL to gate exports on the real binary.";

const MINIMAL_JSON = JSON.stringify({
  log: { level: "info" },
  outbounds: [{ type: "direct", tag: "direct" }],
  route: { final: "direct" },
});

const env = import.meta.env as unknown as Record<string, string>;
const ORIGINAL_OFFICIAL_CHECK_URL = env.VITE_OFFICIAL_CHECK_URL;

function setOfficialCheckUrl(value: string) {
  const previous = env.VITE_OFFICIAL_CHECK_URL;
  env.VITE_OFFICIAL_CHECK_URL = value;
  return () => {
    if (previous === undefined) {
      delete env.VITE_OFFICIAL_CHECK_URL;
    } else {
      env.VITE_OFFICIAL_CHECK_URL = previous;
    }
  };
}

function restoreOfficialCheckUrl() {
  if (ORIGINAL_OFFICIAL_CHECK_URL === undefined) {
    delete env.VITE_OFFICIAL_CHECK_URL;
  } else {
    env.VITE_OFFICIAL_CHECK_URL = ORIGINAL_OFFICIAL_CHECK_URL;
  }
}

async function seedOfficialError() {
  const restoreEnv = setOfficialCheckUrl("https://validator.test");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ status: "invalid", errors: ["old official error"] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
  await useProjectStore.getState().runOfficialCheck();
  restoreEnv();
  vi.unstubAllGlobals();
  expect(useProjectStore.getState().officialDiagnostics).toHaveLength(1);
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  restoreOfficialCheckUrl();
  useProjectStore.getState().loadTemplate();
});

describe("validation state cleanup", () => {
  it("applies JSON drafts as whole-document loads and clears stale editor/validator state", async () => {
    useProjectStore.getState().loadTemplate();
    await seedOfficialError();

    useProjectStore.getState().focusNode("outbound:proxy");
    useProjectStore.getState().openGlobalPanel("json");
    useProjectStore.getState().setSelectedId("route:main");
    useProjectStore.getState().setNodePosition("outbound:proxy", { x: 123, y: 456 });
    const beforeToken = useProjectStore.getState().freshLoadToken;

    useProjectStore.getState().setJsonDraft(MINIMAL_JSON);
    useProjectStore.getState().applyJsonDraft();

    const state = useProjectStore.getState();
    expect(state.selectedId).toBeNull();
    expect(state.focusedNodeId).toBeNull();
    expect(state.globalPanelOpen).toBe(false);
    expect(state.layout).toEqual({ positions: {} });
    expect(state.freshLoadToken).toBe(beforeToken + 1);
    expect(state.officialDiagnostics).toEqual([]);
    expect(state.officialValidationMessage).toBe(BROWSER_VALIDATION_MESSAGE);
    expect(state.checkNotice).toBe("");
    expect(state.isChecking).toBe(false);
    expect(state.isOfficialChecking).toBe(false);
  });

  it("imports JSON as a whole-document load and clears stale editor/validator state", async () => {
    useProjectStore.getState().loadTemplate();
    await seedOfficialError();

    useProjectStore.getState().focusNode("outbound:proxy");
    useProjectStore.getState().openGlobalPanel("json");
    useProjectStore.getState().setSelectedId("route:main");
    useProjectStore.getState().setNodePosition("outbound:proxy", { x: 123, y: 456 });
    const beforeToken = useProjectStore.getState().freshLoadToken;

    useProjectStore.getState().importJson(MINIMAL_JSON);

    const state = useProjectStore.getState();
    expect(state.selectedId).toBeNull();
    expect(state.focusedNodeId).toBeNull();
    expect(state.globalPanelOpen).toBe(false);
    expect(state.layout).toEqual({ positions: {} });
    expect(state.freshLoadToken).toBe(beforeToken + 1);
    expect(state.officialDiagnostics).toEqual([]);
    expect(state.officialValidationMessage).toBe(BROWSER_VALIDATION_MESSAGE);
    expect(state.checkNotice).toBe("");
    expect(state.isChecking).toBe(false);
    expect(state.isOfficialChecking).toBe(false);
  });

  it("clears official validator state on failed JSON loads without replacing canonical config", async () => {
    useProjectStore.getState().loadTemplate();
    await seedOfficialError();
    useProjectStore.getState().focusNode("outbound:proxy");
    const beforeConfig = useProjectStore.getState().config;

    useProjectStore.getState().importJson("{");

    const state = useProjectStore.getState();
    expect(state.config).toBe(beforeConfig);
    expect(state.jsonDraft).toBe("{");
    expect(state.focusedNodeId).toBeNull();
    expect(state.officialDiagnostics).toEqual([]);
    expect(state.officialValidationMessage).toBe(BROWSER_VALIDATION_MESSAGE);
    expect(state.diagnostics).toEqual([
      expect.objectContaining({
        code: "json-parse",
        source: "semantic",
      }),
    ]);
  });

  it("debounces semantic validation and cancels pending notices on canonical loads", () => {
    vi.useFakeTimers();
    useProjectStore.getState().loadTemplate();

    useProjectStore.getState().validateNow();
    expect(useProjectStore.getState().isChecking).toBe(true);
    vi.advanceTimersByTime(249);
    expect(useProjectStore.getState().isChecking).toBe(true);
    vi.advanceTimersByTime(1);
    expect(useProjectStore.getState().isChecking).toBe(false);
    expect(useProjectStore.getState().checkNotice).toMatch(/^Checked /);

    useProjectStore.getState().validateNow();
    expect(useProjectStore.getState().isChecking).toBe(true);
    useProjectStore.getState().importJson(MINIMAL_JSON);
    expect(useProjectStore.getState().isChecking).toBe(false);
    expect(useProjectStore.getState().checkNotice).toBe("");

    vi.advanceTimersByTime(300);
    expect(useProjectStore.getState().isChecking).toBe(false);
    expect(useProjectStore.getState().checkNotice).toBe("");
  });

  it("discards late official validator responses after the checked config changes", async () => {
    useProjectStore.getState().loadTemplate();
    const restoreEnv = setOfficialCheckUrl("https://validator.test");
    let resolveFetch: (response: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    const pending = useProjectStore.getState().runOfficialCheck();
    expect(useProjectStore.getState().isOfficialChecking).toBe(true);

    useProjectStore.getState().loadMinimal();
    expect(useProjectStore.getState().isOfficialChecking).toBe(false);

    resolveFetch(
      new Response(JSON.stringify({ status: "invalid", errors: ["stale official error"] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await pending;
    restoreEnv();

    const state = useProjectStore.getState();
    expect(state.officialDiagnostics).toEqual([]);
    expect(state.officialValidationMessage).toBe(BROWSER_VALIDATION_MESSAGE);
    expect(state.isOfficialChecking).toBe(false);
  });
});
