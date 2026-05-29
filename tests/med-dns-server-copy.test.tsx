import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// L2-med-dns-server-copy (MED audit): three DNS server/cache strings overstated or blurred upstream.
// - local `prefer_go`: "bypasses platform-native DNS" overstates — it disables Apple getaddrinfo /
//   Linux systemd-resolved, but Android platform DNS and macOS DHCP still apply (local.md).
// - dhcp `interface` placeholder "auto (system default)": `auto` is the legacy address form, not a value
//   for the structured server; upstream says the default interface is used by default.
// - store_rdrc banner conflated two caches: store_rdrc only caches rejected/address-filter results,
//   while store_dns persists the full DNS cache; store_rdrc is removed in 1.16, not merely "round-trips".

describe("L2-med-dns-server-copy — DNS server/cache copy accuracy", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("local prefer_go hint names the actual disabled resolvers and the exceptions", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ dns: { servers: [{ type: "local", tag: "lg" }] } }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-dns-server:lg"));
    const inspector = within(screen.getByTestId("node-inspector"));
    expect(inspector.getByText(/getaddrinfo/i)).toBeInTheDocument();
    expect(inspector.getByText(/systemd-resolved/i)).toBeInTheDocument();
    expect(inspector.getByText(/macOS DHCP/i)).toBeInTheDocument();
    expect(inspector.queryByText(/bypasses platform-native/i)).toBeNull();
  });

  it("dhcp interface placeholder no longer offers the legacy 'auto' value", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ dns: { servers: [{ type: "dhcp", tag: "dh" }] } }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-dns-server:dh"));
    const inspector = within(screen.getByTestId("node-inspector"));
    const iface = inspector.getByLabelText("Interface") as HTMLInputElement;
    expect(iface.placeholder).toBe("(default interface)");
    expect(iface.placeholder).not.toMatch(/auto/i);
  });

  it("store_rdrc banner distinguishes the two caches and names the 1.16 removal", () => {
    useProjectStore.getState().loadMinimal();
    useProjectStore.getState().setChannel("testing");
    useProjectStore.getState().createFromPalette("settings-experimental");
    render(<App />);
    const inspector = within(screen.getByTestId("node-inspector"));
    fireEvent.click(inspector.getByLabelText("Store RDRC (rejected-response cache)"));
    expect(inspector.getByText(/removed in (sing-box )?1\.16/i)).toBeInTheDocument();
    expect(inspector.getByText(/full DNS cache/i)).toBeInTheDocument();
    expect(inspector.queryByText(/both fields round-trip/i)).toBeNull();
  });
});
