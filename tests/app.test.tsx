import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { createSbcvFileName } from "../src/components/TopBar";
import { useProjectStore } from "../src/state/useProjectStore";

describe("SBC editor shell", () => {
  it("formats exported config downloads with the SBCV timestamp name", () => {
    expect(createSbcvFileName(new Date(2026, 4, 26, 23, 7, 9))).toBe("sbcv_20260526_230709.json");
  });

  it("renders editor regions instead of a landing page", async () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);
    expect(screen.getByText("sbcv.app")).toBeInTheDocument();
    expect(screen.getByLabelText("Node palette")).toBeInTheDocument();
    expect(screen.getByLabelText("SBC visual canvas")).toBeInTheDocument();
    expect(screen.queryByLabelText("Node inspector")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("node-route:main"));
    expect(screen.getByLabelText("Node inspector")).toBeInTheDocument();
    expect(screen.queryByLabelText("Rules, JSON, and diagnostics")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Route rules")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "1.13 stable" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "1.12 Legacy" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "1.14 testing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByLabelText("Checking")).toBeInTheDocument();
    expect(await screen.findByLabelText("Valid")).toBeInTheDocument();
    expect(screen.queryByText(/Checked .*: valid/)).not.toBeInTheDocument();
  });

  it("shows a red invalid check pill when validation fails", async () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);

    act(() => {
      useProjectStore.getState().updateField({ kind: "route", id: "main" }, "final", "missing-outbound");
    });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByLabelText("Checking")).toBeInTheDocument();
    const invalid = await screen.findByLabelText("Invalid");
    expect(invalid).toHaveClass("status-pill--error");
  });

  it("lets side port buttons mutate canonical references", () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);

    fireEvent.click(screen.getByLabelText("Remove Outbound from Route"));

    expect(useProjectStore.getState().config.route?.final).toBeUndefined();
    expect(screen.getByLabelText("Add Outbound from Route")).toBeInTheDocument();
  });

  it("keeps Library groups collapsed until a category is chosen", () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);

    const palette = within(screen.getByLabelText("Node palette"));
    fireEvent.click(palette.getByRole("button", { name: /Library/ }));

    expect(palette.getByRole("button", { name: /^Outbounds/ })).toBeInTheDocument();
    expect(palette.queryByRole("button", { name: "Add Log Settings" })).not.toBeInTheDocument();

    fireEvent.click(palette.getByRole("button", { name: /^Log/ }));
    expect(palette.getByRole("button", { name: "Add Log Settings" })).toBeInTheDocument();
  });

  it("marks the loaded template without closing the template panel", () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);

    const palette = within(screen.getByLabelText("Node palette"));
    fireEvent.click(palette.getByRole("button", { name: /Templates/ }));
    fireEvent.click(palette.getByRole("button", { name: "Add official client tun fakeip" }));

    expect(palette.getByRole("button", { name: "Added official client tun fakeip" })).toBeInTheDocument();
    expect(palette.getByRole("button", { name: "Add official client bypass route rules" })).toBeInTheDocument();
  });

  it("opens focused inspectors for ordered route and DNS rule nodes", () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);

    fireEvent.click(screen.getByTestId("node-route-rule:0"));
    expect(screen.getByLabelText("Route rule 1 inspector")).toBeInTheDocument();
    expect(screen.getByText("Match")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("cn"), { target: { value: "sg" } });
    expect(useProjectStore.getState().config.route?.rules?.[0]?.domain_suffix).toEqual(["sg"]);

    fireEvent.click(screen.getByTestId("node-dns-rule:0"));
    expect(screen.getByLabelText("DNS rule 1 inspector")).toBeInTheDocument();
    expect(screen.getByText("Query type")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Server"), { target: { value: "remote-doh" } });
    expect(useProjectStore.getState().config.dns?.rules?.[0]?.server).toBe("remote-doh");
  });

  it("mounts shared official fields only inside their owning node inspectors", async () => {
    useProjectStore.getState().loadMinimal();
    render(<App />);

    const palette = within(screen.getByLabelText("Node palette"));
    fireEvent.click(palette.getByRole("button", { name: /Library/ }));
    fireEvent.click(palette.getByRole("button", { name: /^Inbounds/ }));
    fireEvent.click(screen.getByRole("button", { name: "Setup HTTP" }));

    let inspector = within(screen.getByLabelText("Node inspector"));
    expect(inspector.getByText("Listen Fields")).toBeInTheDocument();
    expect(inspector.getByText("TLS")).toBeInTheDocument();
    expect(inspector.queryByText("Dial Fields")).not.toBeInTheDocument();

    fireEvent.click(inspector.getByText("Listen Fields"));
    fireEvent.change(inspector.getByLabelText("Listen Port"), { target: { value: "8088" } });
    expect(useProjectStore.getState().config.inbounds?.at(-1)?.listen_port).toBe(8088);

    fireEvent.click(palette.getByRole("button", { name: /^Outbounds/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add SOCKS" }));

    inspector = within(screen.getByLabelText("Node inspector"));
    expect(inspector.getByText("Dial Fields")).toBeInTheDocument();
    expect(inspector.getByText("UDP over TCP")).toBeInTheDocument();
    fireEvent.click(inspector.getByText("Dial Fields"));
    fireEvent.change(inspector.getByLabelText("Connect Timeout"), { target: { value: "5s" } });
    expect(useProjectStore.getState().config.outbounds?.at(-1)?.connect_timeout).toBe("5s");

    act(() => {
      useProjectStore.getState().addRouteRule();
    });
    fireEvent.click(await screen.findByTestId("node-route-rule:0"));
    inspector = within(screen.getByLabelText("Node inspector"));
    fireEvent.click(inspector.getByText("Shared Wi-Fi / Neighbor"));
    fireEvent.change(inspector.getByLabelText("Source MAC"), { target: { value: "00:11:22:33:44:55" } });
    fireEvent.change(inspector.getByLabelText("Wi-Fi SSID"), { target: { value: "office" } });
    expect(useProjectStore.getState().config.route?.rules?.[0]?.source_mac_address).toEqual(["00:11:22:33:44:55"]);
    expect(useProjectStore.getState().config.route?.rules?.[0]?.wifi_ssid).toEqual(["office"]);
  });

  it("adds global log as an independent settings node", () => {
    useProjectStore.getState().loadMinimal();
    render(<App />);

    const palette = within(screen.getByLabelText("Node palette"));
    fireEvent.click(palette.getByRole("button", { name: /Library/ }));
    fireEvent.click(palette.getByRole("button", { name: /^Log/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add Log Settings" }));

    expect(useProjectStore.getState().selectedId).toBe("settings:log");
    expect(useProjectStore.getState().config.log?.level).toBe("info");
    expect(screen.getByTestId("node-settings:log")).toBeInTheDocument();
  });

  it("adds NTP, Certificate, and Experimental settings as independent editable nodes", () => {
    useProjectStore.getState().loadMinimal();
    render(<App />);

    const palette = within(screen.getByLabelText("Node palette"));
    fireEvent.click(palette.getByRole("button", { name: /Library/ }));
    fireEvent.click(palette.getByRole("button", { name: /^NTP/ }));
    fireEvent.click(screen.getByRole("button", { name: "Setup NTP Settings" }));

    expect(useProjectStore.getState().selectedId).toBe("settings:ntp");
    expect(useProjectStore.getState().config.ntp?.server).toBe("time.apple.com");
    expect(screen.getByTestId("node-settings:ntp")).toBeInTheDocument();
    expect(screen.getByText("Enable NTP")).toBeInTheDocument();

    const certificateGroup = palette.getAllByRole("button", { name: /^Certificate/ })[0];
    if (!certificateGroup) throw new Error("missing Certificate group");
    fireEvent.click(certificateGroup);
    fireEvent.click(screen.getByRole("button", { name: "Setup Certificate" }));

    expect(useProjectStore.getState().selectedId).toBe("settings:certificate");
    expect(useProjectStore.getState().config.certificate?.store).toBe("system");
    expect(screen.getByTestId("node-settings:certificate")).toBeInTheDocument();
    expect(screen.getByText("Certificate Paths")).toBeInTheDocument();

    fireEvent.click(palette.getByRole("button", { name: /^Experimental/ }));
    fireEvent.click(screen.getByRole("button", { name: "Setup Experimental" }));

    expect(useProjectStore.getState().selectedId).toBe("settings:experimental");
    expect(useProjectStore.getState().config.experimental?.cache_file).toMatchObject({ enabled: false });
    expect(screen.getByTestId("node-settings:experimental")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Node inspector")).getByText("Cache File")).toBeInTheDocument();
  });

  it("adds outbound setup drafts from the Library without falling back to SOCKS", () => {
    useProjectStore.getState().loadMinimal();
    render(<App />);

    const palette = within(screen.getByLabelText("Node palette"));
    fireEvent.click(palette.getByRole("button", { name: /Library/ }));
    fireEvent.click(palette.getByRole("button", { name: /^Outbounds/ }));
    fireEvent.click(screen.getByRole("button", { name: "Setup HTTP" }));

    const created = useProjectStore.getState().config.outbounds?.at(-1);

    expect(created?.type).toBe("http");
    expect(created?.tag).toBe("http-out");
    expect(useProjectStore.getState().selectedId).toBe("outbound:http-out");
    expect(screen.getByText("Password")).toBeInTheDocument();
  });

  it("lets an unconnected outbound define upstream references from its left-side port", () => {
    useProjectStore.getState().loadMinimal();
    render(<App />);

    const palette = within(screen.getByLabelText("Node palette"));
    fireEvent.click(palette.getByRole("button", { name: /Library/ }));
    fireEvent.click(palette.getByRole("button", { name: /^Outbounds/ }));
    fireEvent.click(screen.getByRole("button", { name: "Setup Naive" }));

    expect(useProjectStore.getState().selectedId).toBe("outbound:naive-out");
    fireEvent.click(screen.getByLabelText("Add Upstream Route final for naive-out"));
    expect(useProjectStore.getState().config.route?.final).toBe("naive-out");
  });

  it("connects reversed React Flow port drags through canonical JSON commands", () => {
    useProjectStore.getState().loadTemplate();

    useProjectStore.getState().connectPorts({
      source: "outbound:jp",
      sourceHandle: "route",
      target: "route:main",
      targetHandle: "outbound",
    });

    expect(useProjectStore.getState().config.route?.final).toBe("jp");
  });

  it("links newly created outbounds to the selected upstream context", () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);

    fireEvent.click(screen.getByTestId("node-route:main"));
    let palette = within(screen.getByLabelText("Node palette"));
    fireEvent.click(palette.getByRole("button", { name: /Library/ }));
    fireEvent.click(palette.getByRole("button", { name: /^Outbounds/ }));
    fireEvent.click(screen.getByRole("button", { name: "Setup Naive" }));

    expect(useProjectStore.getState().config.route?.rules?.at(-1)?.outbound).toBe("naive-out");

    fireEvent.click(screen.getByTestId("node-outbound:proxy"));
    palette = within(screen.getByLabelText("Node palette"));
    fireEvent.click(screen.getByRole("button", { name: "Setup HTTP" }));

    const proxy = useProjectStore.getState().config.outbounds?.find((outbound) => outbound.tag === "proxy");
    expect(proxy?.outbounds).toContain("http-out");
  });

  it("adds inbound setup drafts from the Library and opens editable listen fields", () => {
    useProjectStore.getState().loadMinimal();
    render(<App />);

    const palette = within(screen.getByLabelText("Node palette"));
    fireEvent.click(palette.getByRole("button", { name: /Library/ }));
    fireEvent.click(palette.getByRole("button", { name: /^Inbounds/ }));
    fireEvent.click(screen.getByRole("button", { name: "Setup HTTP" }));

    const created = useProjectStore.getState().config.inbounds?.at(-1);

    expect(created?.type).toBe("http");
    expect(created?.tag).toBe("http-in");
    expect(useProjectStore.getState().selectedId).toBe("inbound:http-in");
    expect(screen.getByText("Listen Port")).toBeInTheDocument();
  });

  it("adds DNS server setup drafts from the Library and opens editable DNS fields", () => {
    useProjectStore.getState().loadMinimal();
    render(<App />);

    const palette = within(screen.getByLabelText("Node palette"));
    fireEvent.click(palette.getByRole("button", { name: /Library/ }));
    fireEvent.click(palette.getByRole("button", { name: /^DNS/ }));
    fireEvent.click(screen.getByRole("button", { name: "Setup TCP Server" }));

    const created = useProjectStore.getState().config.dns?.servers?.at(-1);

    expect(created?.type).toBe("tcp");
    expect(created?.tag).toBe("tcp-dns");
    expect(useProjectStore.getState().selectedId).toBe("dns-server:tcp-dns");
    expect(screen.getByText("Server")).toBeInTheDocument();
  });

  it("adds rule-set setup resources from the Library and opens editable rule-set fields", () => {
    useProjectStore.getState().loadMinimal();
    render(<App />);

    const palette = within(screen.getByLabelText("Node palette"));
    fireEvent.click(palette.getByRole("button", { name: /Library/ }));
    fireEvent.click(palette.getByRole("button", { name: /^Route/ }));
    fireEvent.click(screen.getByRole("button", { name: "Setup Rule Set" }));

    const created = useProjectStore.getState().config.route?.rule_set?.at(-1);

    expect(created).toMatchObject({
      type: "remote",
      tag: "remote-rules",
      format: "source",
    });
    expect(useProjectStore.getState().selectedId).toBe("rule-set:remote-rules");
    expect(screen.getByTestId("node-rule-set:remote-rules")).toBeInTheDocument();
    expect(screen.getByText("Download Detour")).toBeInTheDocument();
  });

  it("changes an outbound protocol type from the node Inspector", () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);

    fireEvent.click(screen.getByTestId("node-outbound:jp"));
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "http" } });

    const jp = useProjectStore.getState().config.outbounds?.find((outbound) => outbound.tag === "jp");
    expect(jp).toMatchObject({ type: "http", tag: "jp", server: "127.0.0.1" });
    expect(useProjectStore.getState().config.outbounds?.find((outbound) => outbound.tag === "auto")?.outbounds).toContain("jp");
  });

  it("adds endpoint setup resources and links Tailscale DNS to an endpoint", () => {
    useProjectStore.getState().loadMinimal();
    render(<App />);

    const palette = within(screen.getByLabelText("Node palette"));
    fireEvent.click(palette.getByRole("button", { name: /Library/ }));
    fireEvent.click(palette.getByRole("button", { name: /^Endpoints/ }));
    fireEvent.click(screen.getByRole("button", { name: "Setup Tailscale" }));

    expect(useProjectStore.getState().selectedId).toBe("endpoint:ts-ep");
    expect(useProjectStore.getState().config.endpoints?.at(-1)).toMatchObject({ type: "tailscale", tag: "ts-ep" });
    expect(screen.getByTestId("node-endpoint:ts-ep")).toBeInTheDocument();
    expect(screen.getByText("State Directory")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Add Upstream Tailscale DNS server for ts-ep"));

    const tailscaleServer = useProjectStore
      .getState()
      .config.dns?.servers?.find((server) => server.type === "tailscale" && server.endpoint === "ts-ep");
    expect(tailscaleServer?.tag).toBe("tailscale-dns");
  });

  it("renders cache_file store_rdrc/rdrc_timeout and store_dns (testing only) with deprecation banner", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().setChannel("testing");
    });
    act(() => {
      useProjectStore.getState().createFromPalette("settings-experimental");
    });
    render(<App />);

    const inspector = within(screen.getByLabelText("Node inspector"));
    const storeRdrc = inspector.getByLabelText("Store RDRC (DNS cache reasons)") as HTMLInputElement;
    expect(storeRdrc).toBeInTheDocument();
    expect(inspector.queryByLabelText("RDRC Timeout")).not.toBeInTheDocument();
    expect(inspector.getByLabelText("Store DNS responses (1.14 testing)")).toBeInTheDocument();

    fireEvent.click(storeRdrc);
    expect(inspector.getByLabelText("RDRC Timeout")).toBeInTheDocument();
    expect(inspector.getByText(/store_rdrc is deprecated in sing-box 1.14/)).toBeInTheDocument();

    fireEvent.change(inspector.getByLabelText("RDRC Timeout"), { target: { value: "1h" } });
    const cf = (useProjectStore.getState().config.experimental ?? {}) as Record<string, Record<string, unknown>>;
    expect(cf.cache_file?.rdrc_timeout).toBe("1h");

    act(() => {
      useProjectStore.getState().setChannel("stable");
    });
    expect(screen.queryByLabelText("Store DNS responses (1.14 testing)")).not.toBeInTheDocument();
  });

  it("links SSM API to managed Shadowsocks inbounds and flips managed flag in lock-step", () => {
    useProjectStore.getState().loadMinimal();

    act(() => {
      useProjectStore.getState().createFromPalette("service-ssm-api");
    });
    render(<App />);

    // SSM API scaffold auto-creates a shadowsocks inbound + servers mapping
    const initialStore = useProjectStore.getState();
    const initialSsm = initialStore.config.services?.find((service) => service.type === "ssm-api");
    const managedTag = Object.values((initialSsm?.servers ?? {}) as Record<string, string>)[0];
    expect(typeof managedTag).toBe("string");

    const inspector = within(screen.getByLabelText("Node inspector"));
    const checklist = inspector.getByTestId("ssm-managed-checklist");
    const checkbox = within(checklist).getByLabelText(new RegExp(managedTag!)) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);
    let store = useProjectStore.getState();
    const cleared = store.config.services?.find((service) => service.type === "ssm-api");
    expect(cleared?.servers ?? {}).toEqual({});
    const clearedInbound = store.config.inbounds?.find((inbound) => inbound.tag === managedTag);
    expect(clearedInbound?.managed).toBeUndefined();

    fireEvent.click(checkbox);
    store = useProjectStore.getState();
    const restored = store.config.services?.find((service) => service.type === "ssm-api");
    expect(Object.values((restored?.servers ?? {}) as Record<string, string>)).toContain(managedTag);
    const restoredInbound = store.config.inbounds?.find((inbound) => inbound.tag === managedTag);
    expect(restoredInbound?.managed).toBe(true);
  });

  it("renders DERP verify_client_endpoint as a multiselect over tailscale endpoint tags", () => {
    useProjectStore.getState().loadMinimal();

    act(() => {
      useProjectStore.getState().createFromPalette("endpoint-tailscale");
    });
    act(() => {
      useProjectStore.getState().createFromPalette("service-derp");
    });
    render(<App />);

    const inspector = within(screen.getByLabelText("Node inspector"));
    const checklist = inspector.getByTestId("derp-endpoint-checklist");
    const tsCheckbox = within(checklist).getByLabelText("ts-ep") as HTMLInputElement;
    expect(tsCheckbox.checked).toBe(false);

    fireEvent.click(tsCheckbox);
    let derp = useProjectStore.getState().config.services?.find((service) => service.type === "derp");
    expect(derp?.verify_client_endpoint).toEqual(["ts-ep"]);

    fireEvent.click(tsCheckbox);
    derp = useProjectStore.getState().config.services?.find((service) => service.type === "derp");
    expect(derp?.verify_client_endpoint).toBeUndefined();
  });

  it("renders entityType-specific enum selects for outbound protocols", () => {
    useProjectStore.getState().loadMinimal();

    act(() => {
      useProjectStore.getState().createFromPalette("ss-out");
    });
    render(<App />);

    let inspector = within(screen.getByLabelText("Node inspector"));
    expect(inspector.getByLabelText("Network")).toBeInTheDocument();
    const methodSelect = inspector.getByLabelText("Method") as HTMLSelectElement;
    expect(methodSelect.tagName).toBe("SELECT");
    fireEvent.change(methodSelect, { target: { value: "2022-blake3-aes-128-gcm" } });
    expect(useProjectStore.getState().config.outbounds?.at(-1)?.method).toBe("2022-blake3-aes-128-gcm");

    act(() => {
      useProjectStore.getState().createFromPalette("vmess-out");
    });
    inspector = within(screen.getByLabelText("Node inspector"));
    expect(inspector.getByLabelText("Security")).toBeInTheDocument();

    act(() => {
      useProjectStore.getState().createFromPalette("vless-out");
    });
    inspector = within(screen.getByLabelText("Node inspector"));
    expect(inspector.getByLabelText("Flow")).toBeInTheDocument();

    act(() => {
      useProjectStore.getState().createFromPalette("tuic-out");
    });
    inspector = within(screen.getByLabelText("Node inspector"));
    expect(inspector.getByLabelText("Congestion Control")).toBeInTheDocument();

    act(() => {
      useProjectStore.getState().createFromPalette("socks");
    });
    inspector = within(screen.getByLabelText("Node inspector"));
    expect(inspector.getByLabelText("SOCKS Version")).toBeInTheDocument();
  });

  it("masks sensitive fields in AdvancedScalarFields and toggles visibility", () => {
    useProjectStore.getState().loadMinimal();

    act(() => {
      useProjectStore.getState().createFromPalette("http-out");
    });

    render(<App />);

    const inspector = within(screen.getByLabelText("Node inspector"));
    fireEvent.click(inspector.getByText(/Advanced fields/));

    const passwordInput = inspector.getByLabelText("Password") as HTMLInputElement;
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput.type).toBe("password");
    expect(passwordInput.value).toBe("change-me");

    const showButton = inspector.getByRole("button", { name: "Show Password" });
    fireEvent.click(showButton);
    expect(passwordInput.type).toBe("text");

    fireEvent.change(passwordInput, { target: { value: "stronger-secret" } });
    expect(useProjectStore.getState().config.outbounds?.at(-1)?.password).toBe("stronger-secret");
  });

  it("shows platform / build-tag / deprecation banners only for matching node types", () => {
    useProjectStore.getState().loadMinimal();

    act(() => {
      useProjectStore.getState().createFromPalette("inbound-redirect");
    });
    render(<App />);

    let inspector = within(screen.getByLabelText("Node inspector"));
    expect(inspector.getByText(/Platform gate: redirect inbound only works on Linux/)).toBeInTheDocument();

    act(() => {
      useProjectStore.getState().createFromPalette("inbound-tproxy");
    });
    inspector = within(screen.getByLabelText("Node inspector"));
    expect(inspector.getByText(/Platform gate: TProxy inbound only works on Linux/)).toBeInTheDocument();

    // socks inbound should have no platform banner
    act(() => {
      useProjectStore.getState().createFromPalette("inbound-socks");
    });
    inspector = within(screen.getByLabelText("Node inspector"));
    expect(inspector.queryByText(/Platform gate:/)).not.toBeInTheDocument();

    // tor outbound build-tag banner
    act(() => {
      useProjectStore.getState().createFromPalette("tor-out");
    });
    inspector = within(screen.getByLabelText("Node inspector"));
    expect(inspector.getByText(/Build-tag gate: outbound tor requires/)).toBeInTheDocument();

    // hysteria outbound deprecation banner
    act(() => {
      useProjectStore.getState().createFromPalette("hysteria-out");
    });
    inspector = within(screen.getByLabelText("Node inspector"));
    expect(inspector.getByText(/Hysteria v1 is deprecated/)).toBeInTheDocument();

    // block outbound deprecation banner
    act(() => {
      useProjectStore.getState().createFromPalette("block");
    });
    inspector = within(screen.getByLabelText("Node inspector"));
    expect(inspector.getByText(/Deprecated: outbound type `block`/)).toBeInTheDocument();
  });

  it("gates the dns-rule server select by action and surfaces reject + predefined sub-fields", () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);

    fireEvent.click(screen.getByTestId("node-dns-rule:0"));
    let inspector = within(screen.getByLabelText("DNS rule 1 inspector"));

    expect(inspector.getByLabelText("Server")).toBeInTheDocument();

    fireEvent.change(inspector.getByLabelText("Action"), { target: { value: "reject" } });
    inspector = within(screen.getByLabelText("DNS rule 1 inspector"));
    expect(inspector.queryByLabelText("Server")).not.toBeInTheDocument();
    expect(inspector.getByLabelText("Reject Method")).toBeInTheDocument();
    expect(inspector.getByLabelText("No drop (only return)")).toBeInTheDocument();
    expect(useProjectStore.getState().config.dns?.rules?.[0]?.server).toBeUndefined();

    fireEvent.change(inspector.getByLabelText("Action"), { target: { value: "predefined" } });
    inspector = within(screen.getByLabelText("DNS rule 1 inspector"));
    expect(inspector.getByLabelText("Predefined RCODE")).toBeInTheDocument();
    expect(inspector.queryByLabelText("Server")).not.toBeInTheDocument();

    fireEvent.change(inspector.getByLabelText("Predefined RCODE"), { target: { value: "NXDOMAIN" } });
    expect(useProjectStore.getState().config.dns?.rules?.[0]?.rcode).toBe("NXDOMAIN");
  });

  it("gates the route-rule outbound select by action and surfaces reject/sniff/resolve sub-fields", () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);

    fireEvent.click(screen.getByTestId("node-route-rule:0"));
    let inspector = within(screen.getByLabelText("Route rule 1 inspector"));

    // Default action is route -> outbound select visible
    expect(inspector.getByLabelText("Outbound")).toBeInTheDocument();

    // Switching to reject hides outbound and shows method/no_drop
    fireEvent.change(inspector.getByLabelText("Action"), { target: { value: "reject" } });
    inspector = within(screen.getByLabelText("Route rule 1 inspector"));
    expect(inspector.queryByLabelText("Outbound")).not.toBeInTheDocument();
    expect(inspector.getByLabelText("Reject Method")).toBeInTheDocument();
    expect(inspector.getByLabelText("No drop (only return)")).toBeInTheDocument();
    expect(useProjectStore.getState().config.route?.rules?.[0]?.outbound).toBeUndefined();

    // Sniff
    fireEvent.change(inspector.getByLabelText("Action"), { target: { value: "sniff" } });
    inspector = within(screen.getByLabelText("Route rule 1 inspector"));
    expect(inspector.getByLabelText("Sniffer")).toBeInTheDocument();
    expect(inspector.getByLabelText("Sniff Timeout")).toBeInTheDocument();
    expect(inspector.queryByLabelText("Outbound")).not.toBeInTheDocument();

    // Resolve shows resolve sub-fields (server + strategy)
    fireEvent.change(inspector.getByLabelText("Action"), { target: { value: "resolve" } });
    inspector = within(screen.getByLabelText("Route rule 1 inspector"));
    expect(inspector.getByLabelText("Resolve Server")).toBeInTheDocument();
    expect(inspector.getByLabelText("Resolve Strategy")).toBeInTheDocument();
  });

  it("exposes route and DNS hub final selectors plus top-level toggles in the Inspector", () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);

    // Route hub
    fireEvent.click(screen.getByTestId("node-route:main"));
    let inspector = within(screen.getByLabelText("Node inspector"));

    const routeFinal = inspector.getByLabelText("Final Outbound") as HTMLSelectElement;
    expect(routeFinal).toBeInTheDocument();
    const routeFinalOptions = Array.from(routeFinal.options).map((option) => option.value);
    expect(routeFinalOptions).toContain("");
    expect(routeFinalOptions.length).toBeGreaterThan(1);

    const autoDetect = inspector.getByLabelText("Auto detect interface") as HTMLInputElement;
    const initialAutoDetect = useProjectStore.getState().config.route?.auto_detect_interface;
    fireEvent.click(autoDetect);
    expect(useProjectStore.getState().config.route?.auto_detect_interface).not.toBe(initialAutoDetect);

    // DNS hub
    fireEvent.click(screen.getByTestId("node-dns:main"));
    inspector = within(screen.getByLabelText("Node inspector"));

    expect(inspector.getByLabelText("Final DNS Server")).toBeInTheDocument();
    const strategy = inspector.getByLabelText("Strategy") as HTMLSelectElement;
    fireEvent.change(strategy, { target: { value: "prefer_ipv4" } });
    expect(useProjectStore.getState().config.dns?.strategy).toBe("prefer_ipv4");

    const disableCache = inspector.getByLabelText("Disable cache") as HTMLInputElement;
    fireEvent.click(disableCache);
    expect(useProjectStore.getState().config.dns?.disable_cache).toBe(true);
  });

  it("renders extended TLS shared fields including server key, Reality, uTLS, ECH and fragment", () => {
    useProjectStore.getState().loadMinimal();

    act(() => {
      useProjectStore.getState().createFromPalette("inbound-http");
    });

    render(<App />);

    const inspector = within(screen.getByLabelText("Node inspector"));
    fireEvent.click(inspector.getByText("TLS"));

    expect(inspector.getByLabelText("Key Path (server)")).toBeInTheDocument();
    expect(inspector.getByLabelText("Key (PEM lines or list, server)")).toBeInTheDocument();
    expect(inspector.getByLabelText("Certificate (PEM lines or list)")).toBeInTheDocument();
    expect(inspector.getByLabelText("Client Authentication (server)")).toBeInTheDocument();
    expect(inspector.getByLabelText("uTLS Enabled (client, 1.10+)")).toBeInTheDocument();
    expect(inspector.getByLabelText("uTLS Fingerprint")).toBeInTheDocument();
    expect(inspector.getByLabelText("Reality Enabled")).toBeInTheDocument();
    expect(inspector.getByLabelText("ECH Enabled")).toBeInTheDocument();
    expect(inspector.getByLabelText("Fragment (client, 1.12+)")).toBeInTheDocument();
    expect(inspector.getByLabelText("Record Fragment (client, 1.12+)")).toBeInTheDocument();
    expect(inspector.getByLabelText("Curve Preferences (1.13+)")).toBeInTheDocument();

    fireEvent.change(inspector.getByLabelText("Key Path (server)"), { target: { value: "/etc/tls/server.key" } });
    expect((useProjectStore.getState().config.inbounds?.at(-1)?.tls as Record<string, unknown> | undefined)?.key_path).toBe(
      "/etc/tls/server.key",
    );
  });

  it("renders the full official Listen Fields set including 1.13 keep-alive, udp_fragment and inbound detour", () => {
    useProjectStore.getState().loadMinimal();

    act(() => {
      useProjectStore.getState().createFromPalette("inbound-http");
    });

    render(<App />);

    const inspector = within(screen.getByLabelText("Node inspector"));
    fireEvent.click(inspector.getByText("Listen Fields"));

    expect(inspector.getByLabelText("TCP Multi Path")).toBeInTheDocument();
    expect(inspector.getByLabelText("Disable TCP Keep Alive (1.13+)")).toBeInTheDocument();
    expect(inspector.getByLabelText("TCP Keep Alive (1.13+)")).toBeInTheDocument();
    expect(inspector.getByLabelText("TCP Keep Alive Interval")).toBeInTheDocument();
    expect(inspector.getByLabelText("UDP Fragment")).toBeInTheDocument();
    expect(inspector.getByLabelText("Inbound Detour")).toBeInTheDocument();

    fireEvent.click(inspector.getByLabelText("UDP Fragment"));
    expect(useProjectStore.getState().config.inbounds?.at(-1)?.udp_fragment).toBe(true);
  });

  it("renders the full official Dial Fields set including 1.13 keep-alive and Linux-only fields", () => {
    useProjectStore.getState().loadMinimal();

    act(() => {
      useProjectStore.getState().createFromPalette("socks");
    });

    render(<App />);

    const inspector = within(screen.getByLabelText("Node inspector"));
    fireEvent.click(inspector.getByText("Dial Fields"));

    expect(inspector.getByLabelText("IPv4 Bind Address")).toBeInTheDocument();
    expect(inspector.getByLabelText("IPv6 Bind Address")).toBeInTheDocument();
    expect(inspector.getByLabelText("Bind Address No Port (Linux, 1.13+)")).toBeInTheDocument();
    expect(inspector.getByLabelText("Routing Mark (Linux)")).toBeInTheDocument();
    expect(inspector.getByLabelText("Reuse Address")).toBeInTheDocument();
    expect(inspector.getByLabelText("Network Namespace (Linux, 1.12+)")).toBeInTheDocument();
    expect(inspector.getByLabelText("TCP Fast Open")).toBeInTheDocument();
    expect(inspector.getByLabelText("TCP Multi Path")).toBeInTheDocument();
    expect(inspector.getByLabelText("Disable TCP Keep Alive (1.13+)")).toBeInTheDocument();
    expect(inspector.getByLabelText("TCP Keep Alive (1.13+)")).toBeInTheDocument();
    expect(inspector.getByLabelText("TCP Keep Alive Interval (1.13+)")).toBeInTheDocument();
    expect(inspector.getByLabelText("UDP Fragment")).toBeInTheDocument();
    expect(inspector.getByLabelText("Domain Strategy (deprecated 1.12+)")).toBeInTheDocument();

    fireEvent.click(inspector.getByLabelText("TCP Fast Open"));
    expect(useProjectStore.getState().config.outbounds?.at(-1)?.tcp_fast_open).toBe(true);

    fireEvent.change(inspector.getByLabelText("Routing Mark (Linux)"), { target: { value: "0x1234" } });
    expect(useProjectStore.getState().config.outbounds?.at(-1)?.routing_mark).toBe("0x1234");
  });

  it("renders selector candidates as a constrained checklist and default select", () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);

    fireEvent.click(screen.getByTestId("node-outbound:proxy"));

    const inspector = within(screen.getByLabelText("Node inspector"));
    const checklist = inspector.getByTestId("candidate-checklist");
    const hkCheckbox = within(checklist).getByLabelText("hk", { exact: false }) as HTMLInputElement;
    expect(hkCheckbox.checked).toBe(true);

    fireEvent.click(hkCheckbox);
    const proxyAfterToggle = useProjectStore
      .getState()
      .config.outbounds?.find((outbound) => outbound.tag === "proxy");
    expect(proxyAfterToggle?.outbounds).not.toContain("hk");

    const defaultSelect = inspector.getByLabelText("Default") as HTMLSelectElement;
    const defaultOptions = Array.from(defaultSelect.options).map((option) => option.value);
    expect(defaultOptions).toContain("");
    expect(defaultOptions).not.toContain("proxy");
    expect(defaultOptions).not.toContain("hk");

    if (defaultOptions.length > 1) {
      fireEvent.change(defaultSelect, { target: { value: defaultOptions[1] } });
      expect(
        useProjectStore.getState().config.outbounds?.find((outbound) => outbound.tag === "proxy")?.default,
      ).toBe(defaultOptions[1]);
    }

    const interrupt = inspector.getByLabelText("Interrupt existing connections on switch") as HTMLInputElement;
    expect(interrupt.checked).toBe(false);
    fireEvent.click(interrupt);
    expect(
      useProjectStore.getState().config.outbounds?.find((outbound) => outbound.tag === "proxy")
        ?.interrupt_exist_connections,
    ).toBe(true);
  });

  it("renders urltest candidates as a checklist without a default select", () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);

    fireEvent.click(screen.getByTestId("node-outbound:auto"));

    const inspector = within(screen.getByLabelText("Node inspector"));
    expect(inspector.getByTestId("candidate-checklist")).toBeInTheDocument();
    expect(inspector.queryByLabelText("Default")).not.toBeInTheDocument();
    expect(inspector.getByLabelText("Interrupt existing connections on switch")).toBeInTheDocument();
  });

  it("round-trips the settings:log timestamp toggle (timestamp + output placeholder)", () => {
    useProjectStore.getState().loadMinimal();

    act(() => {
      useProjectStore.getState().createFromPalette("settings-log");
    });

    render(<App />);

    const inspector = within(screen.getByLabelText("Node inspector"));

    expect(inspector.getByPlaceholderText("file path (omit to use console)")).toBeInTheDocument();

    const timestampToggle = inspector.getByLabelText("Prefix each line with a timestamp") as HTMLInputElement;
    expect(timestampToggle.checked).toBe(false);

    fireEvent.click(timestampToggle);
    expect(useProjectStore.getState().config.log).toMatchObject({ timestamp: true });

    fireEvent.click(timestampToggle);
    expect((useProjectStore.getState().config.log ?? {}).timestamp).toBeUndefined();

    const disableToggle = inspector.getByLabelText("Disable log") as HTMLInputElement;
    fireEvent.click(disableToggle);
    expect(useProjectStore.getState().config.log).toMatchObject({ disabled: true });
    expect(timestampToggle.disabled).toBe(true);
  });

  it("surfaces non-scalar entity fields under Advanced JSON fields", () => {
    useProjectStore.getState().loadMinimal();

    act(() => {
      useProjectStore.getState().createFromPalette("inbound-http");
    });
    act(() => {
      useProjectStore.getState().updateField(
        { kind: "inbound", tag: "http-in" },
        "users",
        [{ username: "alice", password: "secret" }],
      );
    });

    render(<App />);

    const inspector = within(screen.getByLabelText("Node inspector"));
    const advanced = inspector.getByText("Advanced JSON fields", { exact: false });
    expect(advanced).toBeInTheDocument();
    fireEvent.click(advanced);
    expect(inspector.getByText("Users")).toBeInTheDocument();
    const usersTextarea = inspector.getByText("Users").parentElement?.querySelector("textarea");
    expect(usersTextarea?.value).toContain("alice");

    act(() => {
      const textarea = inspector.getByText("Users").parentElement?.querySelector("textarea") as HTMLTextAreaElement;
      fireEvent.change(textarea, {
        target: { value: JSON.stringify([{ username: "bob", password: "x" }], null, 2) },
      });
    });

    const stored = useProjectStore
      .getState()
      .config.inbounds?.find((inbound) => inbound.tag === "http-in")?.users;
    expect(stored).toEqual([{ username: "bob", password: "x" }]);
  });
});
