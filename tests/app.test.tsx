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
    expect(palette.queryByRole("button", { name: /Log Settings/ })).not.toBeInTheDocument();

    fireEvent.click(palette.getByRole("button", { name: /^Log/ }));
    expect(palette.getByRole("button", { name: /Log Settings/ })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /Log Settings/ }));

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

  it("renders structured users editors for all proxy inbound types via schema table", () => {
    const cases: Array<{ paletteKind: string; expectedFields: string[] }> = [
      { paletteKind: "inbound-trojan", expectedFields: ["Name", "Password"] },
      { paletteKind: "inbound-vmess", expectedFields: ["Name", "UUID", "Alter ID"] },
      { paletteKind: "inbound-vless", expectedFields: ["Name", "UUID", "Flow"] },
      { paletteKind: "inbound-tuic", expectedFields: ["Name", "UUID", "Password"] },
      { paletteKind: "inbound-shadowsocks", expectedFields: ["Name", "Password"] },
      { paletteKind: "inbound-hysteria", expectedFields: ["Name", "Auth String"] },
      { paletteKind: "inbound-hysteria2", expectedFields: ["Name", "Password"] },
      { paletteKind: "inbound-anytls", expectedFields: ["Name", "Password"] },
    ];

    for (const { paletteKind, expectedFields } of cases) {
      useProjectStore.getState().loadMinimal();
      act(() => {
        useProjectStore.getState().createFromPalette(paletteKind);
      });
      const { unmount } = render(<App />);
      const inspector = within(screen.getByLabelText("Node inspector"));
      const created = useProjectStore.getState().config.inbounds?.at(-1);
      const editor = inspector.getByTestId(`${created?.type}-inbound-users-editor`);
      // Ensure at least one row exists (some scaffolds, like shadowsocks single-user, start empty).
      if (within(editor).queryAllByLabelText(expectedFields[0]!).length === 0) {
        fireEvent.click(within(editor).getByRole("button", { name: /Add user/ }));
      }
      const afterAdd = within(screen.getByLabelText("Node inspector")).getByTestId(
        `${created?.type}-inbound-users-editor`,
      );
      for (const label of expectedFields) {
        expect(within(afterAdd).getAllByLabelText(label).length).toBeGreaterThan(0);
      }
      unmount();
    }
  });

  it("hides address/auto_route fields for non-tun inbounds", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("inbound-socks");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));
    expect(inspector.queryByLabelText("Address")).not.toBeInTheDocument();
    expect(inspector.queryByLabelText("Auto route")).not.toBeInTheDocument();
  });

  it("renders address/auto_route fields for inbound:tun", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("tun");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));
    expect(inspector.getByLabelText("Address")).toBeInTheDocument();
    expect(inspector.getByLabelText("Auto route")).toBeInTheDocument();
  });

  it("renders socks/http inbound users as a structured row editor", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("inbound-socks");
    });
    render(<App />);

    const inspector = within(screen.getByLabelText("Node inspector"));
    const editor = inspector.getByTestId("socks-inbound-users-editor");
    expect((within(editor).getByLabelText("Username") as HTMLInputElement).value).toBe("user");

    const passwordInput = within(editor).getByLabelText("Password") as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    fireEvent.click(within(editor).getByRole("button", { name: /Add user/ }));
    const after = useProjectStore
      .getState()
      .config.inbounds?.find((inbound) => inbound.type === "socks");
    expect(after?.users).toHaveLength(2);

    fireEvent.click(within(editor).getByLabelText("Remove user 1"));
    const trimmed = useProjectStore
      .getState()
      .config.inbounds?.find((inbound) => inbound.type === "socks");
    expect(trimmed?.users).toHaveLength(1);
  });

  it("renders hysteria-realm users as a structured editor with channel banner", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().setChannel("testing");
    });
    act(() => {
      useProjectStore.getState().createFromPalette("service-hysteria-realm");
    });
    render(<App />);

    const inspector = within(screen.getByLabelText("Node inspector"));
    expect(inspector.getByText(/1.14 testing-only/)).toBeInTheDocument();

    const editor = inspector.getByTestId("hysteria-realm-users-editor");
    // scaffold seeds one user; structured row should already render its name/max_realms
    expect((within(editor).getByLabelText("Name") as HTMLInputElement).value).toBe("user");

    fireEvent.change(within(editor).getByLabelText("Max Realms"), { target: { value: "5" } });
    const service = useProjectStore.getState().config.services?.find((s) => s.type === "hysteria-realm");
    expect(((service as Record<string, unknown>).users as Record<string, unknown>[])[0]).toMatchObject({ max_realms: 5 });

    fireEvent.click(within(editor).getByRole("button", { name: /Add user/ }));
    const updated = useProjectStore.getState().config.services?.find((s) => s.type === "hysteria-realm");
    expect((updated as Record<string, unknown>).users as Record<string, unknown>[]).toHaveLength(2);
  });

  it("renders CCM/OCM users and headers as structured row editors with token masking", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("service-ccm");
    });
    render(<App />);

    const inspector = within(screen.getByLabelText("Node inspector"));
    const usersEditor = inspector.getByTestId("ccm-users-editor");
    expect(within(usersEditor).getByText("No users yet. Click Add to create one.")).toBeInTheDocument();

    fireEvent.click(within(usersEditor).getByRole("button", { name: /Add user/ }));
    let ccm = useProjectStore.getState().config.services?.find((s) => s.type === "ccm");
    expect((ccm as Record<string, unknown>).users).toMatchObject([{ name: "user1", token: "" }]);

    const refreshedUsersEditor = inspector.getByTestId("ccm-users-editor");
    const tokenInput = within(refreshedUsersEditor).getByLabelText("Token") as HTMLInputElement;
    expect(tokenInput.type).toBe("password");
    fireEvent.change(tokenInput, { target: { value: "shhh" } });
    ccm = useProjectStore.getState().config.services?.find((s) => s.type === "ccm");
    expect(((ccm as Record<string, unknown>).users as Record<string, unknown>[])[0]?.token).toBe("shhh");

    const headersEditor = inspector.getByTestId("ccm-headers-editor");
    fireEvent.click(within(headersEditor).getByRole("button", { name: /Add header/ }));
    ccm = useProjectStore.getState().config.services?.find((s) => s.type === "ccm");
    expect((ccm as Record<string, unknown>).headers).toMatchObject({ "X-Header": "" });
  });

  it("renders WireGuard peers as a structured editor with sensitive masking", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("endpoint-wireguard");
    });
    render(<App />);

    const inspector = within(screen.getByLabelText("Node inspector"));
    const privateKey = inspector.getByLabelText("Private Key") as HTMLInputElement;
    expect(privateKey.type).toBe("password");

    // Scaffold seeds one peer; editor surfaces it as a structured row.
    const initialEditor = inspector.getByTestId("wireguard-peers-editor");
    expect((within(initialEditor).getByLabelText("Public Key") as HTMLInputElement).value).toMatch(/^tM4/);

    fireEvent.change(within(initialEditor).getByLabelText("Public Key"), { target: { value: "abc123" } });
    let updated = useProjectStore.getState().config.endpoints?.find((e) => e.type === "wireguard");
    expect(((updated as Record<string, unknown>).peers as Record<string, unknown>[])[0]).toMatchObject({ public_key: "abc123" });

    fireEvent.click(within(initialEditor).getByLabelText("Remove peer 1"));
    updated = useProjectStore.getState().config.endpoints?.find((e) => e.type === "wireguard");
    expect((updated as Record<string, unknown>).peers).toBeUndefined();

    fireEvent.click(within(inspector.getByTestId("wireguard-peers-editor")).getByRole("button", { name: /Add peer/ }));
    updated = useProjectStore.getState().config.endpoints?.find((e) => e.type === "wireguard");
    expect(((updated as Record<string, unknown>).peers as Record<string, unknown>[])[0]).toMatchObject({ server: "192.0.2.1" });
  });

  it("provides a structured predefined hosts editor for dns-server hosts type", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("dns-hosts");
    });
    render(<App />);

    const inspector = within(screen.getByLabelText("Node inspector"));
    const editor = inspector.getByTestId("hosts-predefined-editor");
    expect(within(editor).getByText("No predefined mappings yet. Click Add to start.")).toBeInTheDocument();

    fireEvent.click(within(editor).getByRole("button", { name: /Add host mapping/ }));
    let server = useProjectStore.getState().config.dns?.servers?.find((s) => s.type === "hosts");
    expect((server as Record<string, unknown>)?.predefined).toMatchObject({ "example.com": ["127.0.0.1"] });

    const editorAfter = inspector.getByTestId("hosts-predefined-editor");
    const ipsInput = within(editorAfter).getByLabelText("IPs") as HTMLInputElement;
    fireEvent.change(ipsInput, { target: { value: "10.0.0.1, 10.0.0.2" } });
    server = useProjectStore.getState().config.dns?.servers?.find((s) => s.type === "hosts");
    expect((server as Record<string, unknown>)?.predefined).toMatchObject({
      "example.com": ["10.0.0.1", "10.0.0.2"],
    });

    fireEvent.click(within(editorAfter).getByLabelText("Remove example.com"));
    server = useProjectStore.getState().config.dns?.servers?.find((s) => s.type === "hosts");
    expect((server as Record<string, unknown>)?.predefined).toBeUndefined();
  });

  it("falls back DNS-server port to the protocol default (53/443/853)", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("dns-tls");
    });
    render(<App />);

    const inspector = within(screen.getByLabelText("Node inspector"));
    const portInput = inspector.getByLabelText("Port") as HTMLInputElement;
    expect(portInput.value).toBe("853");
    expect(portInput.placeholder).toBe("853");

    fireEvent.change(portInput, { target: { value: "" } });
    const cleared = useProjectStore
      .getState()
      .config.dns?.servers?.find((server) => server.type === "tls");
    expect(cleared?.server_port).toBeUndefined();
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

  it("renders DERP verify_client_url / mesh_with / stun as structured editors", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("service-derp");
    });
    render(<App />);

    const inspector = within(screen.getByLabelText("Node inspector"));

    const verifyBlock = within(inspector.getByTestId("derp-verify-client-url"));
    fireEvent.click(verifyBlock.getByRole("button", { name: "Add verify URL" }));
    const urlInput = verifyBlock.getByLabelText("URL") as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: "https://verify.example.com/check" } });
    const detourInput = verifyBlock.getByLabelText("Detour") as HTMLInputElement;
    fireEvent.change(detourInput, { target: { value: "proxy-out" } });
    let derp = useProjectStore.getState().config.services?.find((service) => service.type === "derp") as Record<string, unknown>;
    expect((derp.verify_client_url as Record<string, unknown>[])[0]).toMatchObject({
      url: "https://verify.example.com/check",
      detour: "proxy-out",
    });

    const meshBlock = within(inspector.getByTestId("derp-mesh-with"));
    fireEvent.click(meshBlock.getByRole("button", { name: "Add mesh peer" }));
    const serverInput = meshBlock.getByLabelText("Server (required)") as HTMLInputElement;
    fireEvent.change(serverInput, { target: { value: "derp2.example.com" } });
    const portInput = meshBlock.getByLabelText("Server port (required)") as HTMLInputElement;
    fireEvent.change(portInput, { target: { value: "8443" } });
    const hostInput = meshBlock.getByLabelText("Host (optional)") as HTMLInputElement;
    fireEvent.change(hostInput, { target: { value: "derp2-alt" } });

    derp = useProjectStore.getState().config.services?.find((service) => service.type === "derp") as Record<string, unknown>;
    expect((derp.mesh_with as Record<string, unknown>[])[0]).toMatchObject({
      server: "derp2.example.com",
      server_port: 8443,
      host: "derp2-alt",
    });

    const stunBlock = within(inspector.getByTestId("derp-stun"));
    const stunEnabled = stunBlock.getByLabelText("Enabled") as HTMLInputElement;
    expect(stunEnabled.checked).toBe(false);
    fireEvent.click(stunEnabled);
    const stunPort = stunBlock.getByLabelText("Listen port") as HTMLInputElement;
    fireEvent.change(stunPort, { target: { value: "3479" } });
    derp = useProjectStore.getState().config.services?.find((service) => service.type === "derp") as Record<string, unknown>;
    const stun = derp.stun as Record<string, unknown>;
    expect(stun.enabled).toBe(true);
    expect(stun.listen_port).toBe(3479);
  });

  it("inline rule-set editor preserves last valid rules array when JSON is invalid", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("rule-set");
    });
    act(() => {
      const ruleSets = useProjectStore.getState().config.route?.rule_set ?? [];
      const created = ruleSets[ruleSets.length - 1];
      if (created?.tag) {
        useProjectStore.getState().changeEntityType({ kind: "rule-set", tag: created.tag }, "inline");
        useProjectStore.getState().updateField(
          { kind: "rule-set", tag: created.tag },
          "rules",
          [{ domain: ["example.com"] }],
        );
      }
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));
    const textarea = inspector.getByTestId("inline-rules-json") as HTMLTextAreaElement;
    expect(textarea.value).toContain("example.com");

    fireEvent.change(textarea, { target: { value: "{this is broken json" } });
    expect(inspector.getByRole("alert")).toBeInTheDocument();
    // Store still has the last good array (not the bogus string).
    const ruleSet = useProjectStore.getState().config.route?.rule_set?.find((rs) => rs.type === "inline");
    expect(Array.isArray((ruleSet as Record<string, unknown> | undefined)?.rules)).toBe(true);
    expect((ruleSet as Record<string, unknown>).rules).toEqual([{ domain: ["example.com"] }]);

    fireEvent.change(textarea, { target: { value: JSON.stringify([{ domain_suffix: [".cn"] }], null, 2) } });
    const updated = useProjectStore.getState().config.route?.rule_set?.find((rs) => rs.type === "inline");
    expect((updated as Record<string, unknown>).rules).toEqual([{ domain_suffix: [".cn"] }]);
  });

  it("renders SSH outbound credentials and host_key fields as first-class controls", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("ssh-out");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));

    expect(inspector.getByLabelText("SSH User")).toBeInTheDocument();
    const password = inspector.getByLabelText("Password") as HTMLInputElement;
    expect(password.type).toBe("password");
    const privateKey = inspector.getByLabelText("Private Key (PEM)") as HTMLInputElement;
    expect(privateKey.type).toBe("password");

    const hostKey = inspector.getByLabelText("Host Key (newline-separated SHA256)") as HTMLTextAreaElement;
    fireEvent.change(hostKey, { target: { value: "SHA256:abc\nSHA256:def" } });
    const ssh = useProjectStore.getState().config.outbounds?.find((o) => o.type === "ssh");
    expect((ssh as Record<string, unknown>).host_key).toEqual(["SHA256:abc", "SHA256:def"]);

    const algos = inspector.getByLabelText("Host Key Algorithms") as HTMLInputElement;
    fireEvent.change(algos, { target: { value: "ssh-ed25519, ssh-rsa" } });
    const updated = useProjectStore.getState().config.outbounds?.find((o) => o.type === "ssh");
    expect((updated as Record<string, unknown>).host_key_algorithms).toEqual(["ssh-ed25519", "ssh-rsa"]);
  });

  it("surfaces first-class UUID / Password / Auth credentials for proxy outbound types", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("vmess-out");
    });
    render(<App />);
    let inspector = within(screen.getByLabelText("Node inspector"));
    const uuidInput = inspector.getByLabelText("UUID") as HTMLInputElement;
    expect(uuidInput.type).toBe("password");
    fireEvent.click(inspector.getByRole("button", { name: /Generate UUID/ }));
    const after = useProjectStore.getState().config.outbounds?.at(-1);
    expect(typeof after?.uuid).toBe("string");
    expect((after?.uuid as string).length).toBeGreaterThan(10);

    act(() => {
      useProjectStore.getState().createFromPalette("trojan-out");
    });
    inspector = within(screen.getByLabelText("Node inspector"));
    const trojanPassword = inspector.getByLabelText("Password") as HTMLInputElement;
    expect(trojanPassword.type).toBe("password");
    expect(trojanPassword.value).toBe("change-me");

    act(() => {
      useProjectStore.getState().createFromPalette("hysteria-out");
    });
    inspector = within(screen.getByLabelText("Node inspector"));
    const hysteriaAuth = inspector.getByLabelText("Auth (string)") as HTMLInputElement;
    expect(hysteriaAuth.type).toBe("password");
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

  it("masks sensitive fields (first-class Password input) and toggles visibility", () => {
    useProjectStore.getState().loadMinimal();

    act(() => {
      useProjectStore.getState().createFromPalette("http-out");
    });

    render(<App />);

    const inspector = within(screen.getByLabelText("Node inspector"));

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
    expect(inspector.queryByLabelText("uTLS Fingerprint")).not.toBeInTheDocument();
    fireEvent.click(inspector.getByLabelText("uTLS Enabled (client, 1.10+)"));
    expect(inspector.getByLabelText("uTLS Fingerprint")).toBeInTheDocument();
    expect(inspector.getByLabelText("Reality Enabled")).toBeInTheDocument();
    expect(inspector.queryByLabelText("Reality Public Key (client)")).not.toBeInTheDocument();
    fireEvent.click(inspector.getByLabelText("Reality Enabled"));
    expect(inspector.getByLabelText("Reality Public Key (client)")).toBeInTheDocument();
    expect(inspector.getByLabelText("Reality Short ID (client)")).toBeInTheDocument();
    expect(inspector.getByLabelText("ECH Enabled")).toBeInTheDocument();
    expect(inspector.queryByLabelText("ECH Config Path")).not.toBeInTheDocument();
    fireEvent.click(inspector.getByLabelText("ECH Enabled"));
    expect(inspector.getByLabelText("ECH Config Path")).toBeInTheDocument();
    expect(inspector.getByLabelText("ECH Query Server Name")).toBeInTheDocument();
    expect(inspector.getByLabelText("Server (Reality, server-only)")).toBeInTheDocument();
    expect(inspector.getByLabelText("Private Key (Reality, server-only)")).toBeInTheDocument();
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

  it("renders DoH/H3 headers map editor for https/h3 dns-server", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("dns-https");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));
    const block = within(inspector.getByTestId("dns-https-headers"));
    fireEvent.click(block.getByRole("button", { name: "Add header" }));
    const https = useProjectStore.getState().config.dns?.servers?.find((s) => s.type === "https") as Record<string, unknown>;
    expect(https.headers).toBeDefined();
  });

  it("renders fakeip DNS server inet4_range + inet6_range as CSV inputs", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("dns-fakeip-server");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));

    const inet4 = inspector.getByLabelText("IPv4 Range (CIDR)") as HTMLInputElement;
    fireEvent.change(inet4, { target: { value: "198.18.0.0/15" } });
    let fakeip = useProjectStore.getState().config.dns?.servers?.find((s) => s.type === "fakeip") as Record<string, unknown>;
    expect(fakeip.inet4_range).toBe("198.18.0.0/15");

    const inet6 = inspector.getByLabelText("IPv6 Range (CIDR)") as HTMLInputElement;
    fireEvent.change(inet6, { target: { value: "fc00::/18" } });
    fakeip = useProjectStore.getState().config.dns?.servers?.find((s) => s.type === "fakeip") as Record<string, unknown>;
    expect(fakeip.inet6_range).toBe("fc00::/18");
  });

  it("marks legacy outbound block / hysteria v1 / top-level fakeip as deprecated in Palette", () => {
    useProjectStore.getState().loadMinimal();
    render(<App />);
    const palette = within(screen.getByLabelText("Node palette"));
    fireEvent.click(palette.getByRole("button", { name: /Library/ }));
    fireEvent.click(palette.getByRole("button", { name: /^Outbounds/ }));
    const blockBtn = palette.getByRole("button", { name: "Legacy Block" });
    expect(blockBtn.title).toMatch(/deprecated/i);
    const hysteriaBtn = palette.getByRole("button", { name: "Legacy Hysteria" });
    expect(hysteriaBtn.title).toMatch(/deprecated/i);
    fireEvent.click(palette.getAllByRole("button", { name: /^DNS/ })[0]!);
    const fakeipBtn = palette.getByRole("button", { name: "Legacy FakeIP" });
    expect(fakeipBtn.title).toMatch(/deprecated/i);
  });

  it("renders naive outbound username + extra_headers map editor", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("naive-out");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));

    const username = inspector.getByLabelText("Username") as HTMLInputElement;
    fireEvent.change(username, { target: { value: "alice" } });
    let naive = useProjectStore.getState().config.outbounds?.find((o) => o.type === "naive") as Record<string, unknown>;
    expect(naive.username).toBe("alice");

    const headers = within(inspector.getByTestId("naive-extra-headers"));
    fireEvent.click(headers.getByRole("button", { name: "Add header" }));
    naive = useProjectStore.getState().config.outbounds?.find((o) => o.type === "naive") as Record<string, unknown>;
    expect(naive.extra_headers).toBeDefined();
  });

  it("renders tor outbound torrc map editor + extra_args CSV", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("tor-out");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));

    const exec = inspector.getByLabelText("Executable Path") as HTMLInputElement;
    fireEvent.change(exec, { target: { value: "/opt/homebrew/bin/tor" } });
    let tor = useProjectStore.getState().config.outbounds?.find((o) => o.type === "tor") as Record<string, unknown>;
    expect(tor.executable_path).toBe("/opt/homebrew/bin/tor");

    const extraArgs = inspector.getByLabelText("Extra Args (CSV)") as HTMLInputElement;
    fireEvent.change(extraArgs, { target: { value: "--SafeLogging, 0" } });
    tor = useProjectStore.getState().config.outbounds?.find((o) => o.type === "tor") as Record<string, unknown>;
    expect(tor.extra_args).toEqual(["--SafeLogging", "0"]);

    const torrcBlock = within(inspector.getByTestId("tor-torrc-editor"));
    fireEvent.click(torrcBlock.getByRole("button", { name: "Add torrc key" }));
    tor = useProjectStore.getState().config.outbounds?.find((o) => o.type === "tor") as Record<string, unknown>;
    expect(tor.torrc).toBeDefined();
  });

  it("renders hysteria2 server_ports + hop_interval inputs", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("hysteria2-out");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));

    const ports = inspector.getByLabelText("Server Ports (port hopping)") as HTMLInputElement;
    fireEvent.change(ports, { target: { value: "2080:3000, 4000:5000" } });
    let h2 = useProjectStore.getState().config.outbounds?.find((o) => o.type === "hysteria2") as Record<string, unknown>;
    expect(h2.server_ports).toEqual(["2080:3000", "4000:5000"]);

    const hop = inspector.getByLabelText("Hop Interval") as HTMLInputElement;
    fireEvent.change(hop, { target: { value: "45s" } });
    h2 = useProjectStore.getState().config.outbounds?.find((o) => o.type === "hysteria2") as Record<string, unknown>;
    expect(h2.hop_interval).toBe("45s");
  });

  it("renders hysteria2 obfs type select + conditional password", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("hysteria2-out");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));
    const block = within(inspector.getByTestId("hysteria2-obfs"));
    const typeSelect = block.getByLabelText("Type") as HTMLSelectElement;
    expect(typeSelect.tagName).toBe("SELECT");
    expect(block.queryByLabelText("Password")).not.toBeInTheDocument();

    fireEvent.change(typeSelect, { target: { value: "salamander" } });
    const h2 = useProjectStore.getState().config.outbounds?.find((o) => o.type === "hysteria2") as Record<string, unknown>;
    expect((h2.obfs as Record<string, unknown>).type).toBe("salamander");

    const password = block.getByLabelText("Password") as HTMLInputElement;
    expect(password.type).toBe("password");
    fireEvent.change(password, { target: { value: "s3cret" } });
    const updated = useProjectStore.getState().config.outbounds?.find((o) => o.type === "hysteria2") as Record<string, unknown>;
    expect((updated.obfs as Record<string, unknown>).password).toBe("s3cret");
  });

  it("renders TUIC udp_relay_mode select + udp_over_stream toggle with mutual exclusion", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("tuic-out");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));

    const relayMode = inspector.getByLabelText("UDP Relay Mode") as HTMLSelectElement;
    expect(relayMode.tagName).toBe("SELECT");
    fireEvent.change(relayMode, { target: { value: "quic" } });
    let tuic = useProjectStore.getState().config.outbounds?.find((o) => o.type === "tuic") as Record<string, unknown>;
    expect(tuic.udp_relay_mode).toBe("quic");

    const overStream = inspector.getByLabelText("UDP over Stream (conflicts with udp_relay_mode)") as HTMLInputElement;
    fireEvent.click(overStream);
    tuic = useProjectStore.getState().config.outbounds?.find((o) => o.type === "tuic") as Record<string, unknown>;
    expect(tuic.udp_over_stream).toBe(true);
    expect(tuic.udp_relay_mode).toBeUndefined();
  });

  it("renders shadowsocks plugin select with conditional plugin_opts", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("ss-out");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));

    const plugin = inspector.getByLabelText("Plugin (SIP003)") as HTMLSelectElement;
    expect(plugin.tagName).toBe("SELECT");
    expect(inspector.queryByLabelText("Plugin Opts")).not.toBeInTheDocument();

    fireEvent.change(plugin, { target: { value: "v2ray-plugin" } });
    let ss = useProjectStore.getState().config.outbounds?.find((o) => o.type === "shadowsocks") as Record<string, unknown>;
    expect(ss.plugin).toBe("v2ray-plugin");

    const opts = inspector.getByLabelText("Plugin Opts") as HTMLInputElement;
    fireEvent.change(opts, { target: { value: "mode=websocket;path=/proxy" } });
    ss = useProjectStore.getState().config.outbounds?.find((o) => o.type === "shadowsocks") as Record<string, unknown>;
    expect(ss.plugin_opts).toBe("mode=websocket;path=/proxy");

    fireEvent.change(plugin, { target: { value: "" } });
    expect(inspector.queryByLabelText("Plugin Opts")).not.toBeInTheDocument();
  });

  it("renders packet_encoding select for vmess and vless outbounds", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("vmess-out");
    });
    render(<App />);
    let inspector = within(screen.getByLabelText("Node inspector"));
    let pkt = inspector.getByLabelText("Packet Encoding") as HTMLSelectElement;
    expect(pkt.tagName).toBe("SELECT");
    fireEvent.change(pkt, { target: { value: "xudp" } });
    expect(useProjectStore.getState().config.outbounds?.at(-1)?.packet_encoding).toBe("xudp");

    act(() => {
      useProjectStore.getState().createFromPalette("vless-out");
    });
    inspector = within(screen.getByLabelText("Node inspector"));
    pkt = inspector.getByLabelText("Packet Encoding") as HTMLSelectElement;
    fireEvent.change(pkt, { target: { value: "packetaddr" } });
    expect(useProjectStore.getState().config.outbounds?.at(-1)?.packet_encoding).toBe("packetaddr");
  });

  it("renders urltest url / interval / tolerance / idle_timeout as first-class fields", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("urltest");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));

    const urlInput = inspector.getByLabelText("Test URL") as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: "https://example.com/ping" } });
    let urltest = useProjectStore.getState().config.outbounds?.find((o) => o.type === "urltest") as Record<string, unknown>;
    expect(urltest.url).toBe("https://example.com/ping");

    const intervalInput = inspector.getByLabelText("Interval") as HTMLInputElement;
    fireEvent.change(intervalInput, { target: { value: "5m" } });
    urltest = useProjectStore.getState().config.outbounds?.find((o) => o.type === "urltest") as Record<string, unknown>;
    expect(urltest.interval).toBe("5m");

    const toleranceInput = inspector.getByLabelText("Tolerance (ms)") as HTMLInputElement;
    fireEvent.change(toleranceInput, { target: { value: "120" } });
    urltest = useProjectStore.getState().config.outbounds?.find((o) => o.type === "urltest") as Record<string, unknown>;
    expect(urltest.tolerance).toBe(120);

    const idleInput = inspector.getByLabelText("Idle timeout") as HTMLInputElement;
    fireEvent.change(idleInput, { target: { value: "30m" } });
    urltest = useProjectStore.getState().config.outbounds?.find((o) => o.type === "urltest") as Record<string, unknown>;
    expect(urltest.idle_timeout).toBe("30m");
  });

  it("renders TUN-specific stack, route_address, and platform.http_proxy controls", () => {
    useProjectStore.getState().loadMinimal();
    act(() => {
      useProjectStore.getState().createFromPalette("tun");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));

    const stack = inspector.getByLabelText("Stack") as HTMLSelectElement;
    expect(stack.tagName).toBe("SELECT");
    expect(within(stack).getByRole("option", { name: "system" })).toBeInTheDocument();
    expect(within(stack).getByRole("option", { name: "gvisor" })).toBeInTheDocument();
    expect(within(stack).getByRole("option", { name: "mixed" })).toBeInTheDocument();
    fireEvent.change(stack, { target: { value: "gvisor" } });
    let tun = useProjectStore.getState().config.inbounds?.find((i) => i.type === "tun") as Record<string, unknown>;
    expect(tun.stack).toBe("gvisor");

    const einat = inspector.getByLabelText("Endpoint-independent NAT (gvisor only)") as HTMLInputElement;
    fireEvent.click(einat);
    tun = useProjectStore.getState().config.inbounds?.find((i) => i.type === "tun") as Record<string, unknown>;
    expect(tun.endpoint_independent_nat).toBe(true);

    fireEvent.change(stack, { target: { value: "system" } });
    tun = useProjectStore.getState().config.inbounds?.find((i) => i.type === "tun") as Record<string, unknown>;
    expect(tun.stack).toBe("system");
    expect(tun.endpoint_independent_nat).toBeUndefined();
    expect(inspector.queryByLabelText("Endpoint-independent NAT (gvisor only)")).not.toBeInTheDocument();

    const routeAddress = inspector.getByLabelText("Route address (CIDR)") as HTMLInputElement;
    fireEvent.change(routeAddress, { target: { value: "0.0.0.0/1, 128.0.0.0/1" } });
    tun = useProjectStore.getState().config.inbounds?.find((i) => i.type === "tun") as Record<string, unknown>;
    expect(tun.route_address).toEqual(["0.0.0.0/1", "128.0.0.0/1"]);

    const routeSet = inspector.getByLabelText("Route address set (rule-set tags)") as HTMLInputElement;
    fireEvent.change(routeSet, { target: { value: "geosite-cn, cn-ips" } });
    tun = useProjectStore.getState().config.inbounds?.find((i) => i.type === "tun") as Record<string, unknown>;
    expect(tun.route_address_set).toEqual(["geosite-cn", "cn-ips"]);

    const loopback = inspector.getByLabelText("Loopback address") as HTMLInputElement;
    fireEvent.change(loopback, { target: { value: "10.7.0.1, fdfe:dcba:9876::2" } });
    tun = useProjectStore.getState().config.inbounds?.find((i) => i.type === "tun") as Record<string, unknown>;
    expect(tun.loopback_address).toEqual(["10.7.0.1", "fdfe:dcba:9876::2"]);

    const proxyServer = within(inspector.getByTestId("tun-platform-http-proxy"));
    const enabled = proxyServer.getByLabelText("Enabled") as HTMLInputElement;
    fireEvent.click(enabled);
    const serverInput = proxyServer.getByLabelText("Server") as HTMLInputElement;
    fireEvent.change(serverInput, { target: { value: "127.0.0.1" } });
    const portInput = proxyServer.getByLabelText("Server port") as HTMLInputElement;
    fireEvent.change(portInput, { target: { value: "8080" } });
    const bypass = proxyServer.getByLabelText("Bypass domain") as HTMLInputElement;
    fireEvent.change(bypass, { target: { value: "*.local, 192.168.0.0/16" } });

    tun = useProjectStore.getState().config.inbounds?.find((i) => i.type === "tun") as Record<string, unknown>;
    const platform = tun.platform as Record<string, unknown>;
    const httpProxy = platform.http_proxy as Record<string, unknown>;
    expect(httpProxy.enabled).toBe(true);
    expect(httpProxy.server).toBe("127.0.0.1");
    expect(httpProxy.server_port).toBe(8080);
    expect(httpProxy.bypass_domain).toEqual(["*.local", "192.168.0.0/16"]);
  });

  it("surfaces non-scalar entity fields under Advanced JSON fields", () => {
    useProjectStore.getState().loadMinimal();

    act(() => {
      useProjectStore.getState().createFromPalette("inbound-http");
    });
    act(() => {
      // unknown non-scalar array survives import; AdvancedNonScalarFields surfaces it.
      useProjectStore.getState().updateField(
        { kind: "inbound", tag: "http-in" },
        "custom_extras",
        [{ note: "alice" }],
      );
    });

    render(<App />);

    const inspector = within(screen.getByLabelText("Node inspector"));
    const advanced = inspector.getByText("Advanced JSON fields", { exact: false });
    expect(advanced).toBeInTheDocument();
    fireEvent.click(advanced);
    expect(inspector.getByText("Custom Extras")).toBeInTheDocument();
    const extrasTextarea = inspector.getByText("Custom Extras").parentElement?.querySelector("textarea");
    expect(extrasTextarea?.value).toContain("alice");

    act(() => {
      const textarea = inspector.getByText("Custom Extras").parentElement?.querySelector("textarea") as HTMLTextAreaElement;
      fireEvent.change(textarea, {
        target: { value: JSON.stringify([{ note: "bob" }], null, 2) },
      });
    });

    const stored = (
      useProjectStore
        .getState()
        .config.inbounds?.find((inbound) => inbound.tag === "http-in") as Record<string, unknown> | undefined
    )?.custom_extras;
    expect(stored).toEqual([{ note: "bob" }]);
  });
});
