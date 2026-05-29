import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// L2-fix-ss-inbound-ciphers (audit H3): the shadowsocks INBOUND method select offered legacy stream
// ciphers (aes-*-ctr/cfb, rc4-md5, chacha20-ietf, xchacha20) that the inbound rejects — those are
// outbound-only (inbound/shadowsocks.md lists only 2022 + AEAD + none). The OUTBOUND select keeps them.

function methodValues(): string[] {
  const select = within(screen.getByTestId("node-inspector")).getByLabelText("Method");
  return Array.from(select.querySelectorAll("option")).map((o) => o.getAttribute("value") ?? "");
}

describe("L2-fix-ss-inbound-ciphers", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("inbound drops stream ciphers but keeps 2022/AEAD/none", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ inbounds: [{ type: "shadowsocks", tag: "ss-in", method: "aes-128-gcm", password: "p" }] }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-inbound:ss-in"));
    const values = methodValues();
    for (const stream of ["aes-128-ctr", "aes-256-cfb", "rc4-md5", "chacha20-ietf", "xchacha20"]) {
      expect(values).not.toContain(stream);
    }
    expect(values).toContain("none");
    expect(values).toContain("aes-128-gcm");
    expect(values).toContain("2022-blake3-aes-128-gcm");
  });

  it("outbound still offers stream ciphers (valid for outbound)", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({
        outbounds: [{ type: "shadowsocks", tag: "ss-out", server: "e.x", server_port: 8388, method: "aes-128-gcm", password: "p" }],
      }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-outbound:ss-out"));
    expect(methodValues()).toContain("aes-128-ctr");
  });
});
