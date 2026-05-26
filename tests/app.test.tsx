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
});
