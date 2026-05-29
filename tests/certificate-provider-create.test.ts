import { describe, expect, it } from "vitest";

import { addCertificateProvider, createCertificateProvider } from "../src/domain/commands";
import { useProjectStore } from "../src/state/useProjectStore";

// C2 (G2) slice A: the testing-only Certificate Providers palette items create a tagged, type-correct
// certificate_providers[] entry (acme/cloudflare-origin-ca → domain[]; tailscale → endpoint) and select
// it; stable stays gated. Never emits the non-schema type "certificate-provider".
// Source: testing/.../shared/certificate-provider/{acme,tailscale,cloudflare-origin-ca}.md.

describe("C2 — createCertificateProvider scaffolds", () => {
  it("acme requires domain[]", () => {
    expect(createCertificateProvider("acme", "c")).toEqual({ type: "acme", tag: "c", domain: [] });
  });
  it("cloudflare-origin-ca requires domain[]", () => {
    expect(createCertificateProvider("cloudflare-origin-ca", "c")).toEqual({ type: "cloudflare-origin-ca", tag: "c", domain: [] });
  });
  it("tailscale requires endpoint (no domain)", () => {
    expect(createCertificateProvider("tailscale", "c")).toEqual({ type: "tailscale", tag: "c", endpoint: "" });
  });
  it("never produces the non-schema type 'certificate-provider'", () => {
    for (const t of ["acme", "tailscale", "cloudflare-origin-ca"]) {
      expect((createCertificateProvider(t, "c") as { type: string }).type).not.toBe("certificate-provider");
    }
  });
  it("addCertificateProvider dedupes tags", () => {
    let config = addCertificateProvider({}, "acme", "dup");
    config = addCertificateProvider(config, "tailscale", "dup");
    const tags = (config.certificate_providers ?? []).map((p) => (p as { tag?: string }).tag);
    expect(new Set(tags).size).toBe(tags.length);
    expect(tags).toHaveLength(2);
  });
});

describe("C2 — createFromPalette certificate-provider (testing-gated)", () => {
  it("testing: each typed palette item appends one correctly-typed entry and selects it", () => {
    const cases: Array<[string, string]> = [
      ["certificate-provider-acme", "acme"],
      ["certificate-provider-tailscale", "tailscale"],
      ["certificate-provider-cloudflare-origin-ca", "cloudflare-origin-ca"],
    ];
    for (const [kind, type] of cases) {
      useProjectStore.getState().importJson(JSON.stringify({}));
      useProjectStore.getState().setChannel("testing");
      useProjectStore.getState().createFromPalette(kind);
      const state = useProjectStore.getState();
      const providers = state.config.certificate_providers ?? [];
      expect(providers).toHaveLength(1);
      expect((providers[0] as { type?: string }).type).toBe(type);
      expect(state.selectedId).toBe(`certificate-provider:${(providers[0] as { tag?: string }).tag}`);
    }
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("stable: creates nothing (gated, needs 1.14)", () => {
    useProjectStore.getState().importJson(JSON.stringify({}));
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().createFromPalette("certificate-provider-acme");
    expect(useProjectStore.getState().config.certificate_providers ?? []).toHaveLength(0);
    useProjectStore.getState().importJson(JSON.stringify({}));
  });
});
