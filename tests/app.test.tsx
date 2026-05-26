import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

describe("SBC editor shell", () => {
  it("renders editor regions instead of a landing page", async () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);
    expect(screen.getByText("SBC")).toBeInTheDocument();
    expect(screen.getByLabelText("Node palette")).toBeInTheDocument();
    expect(screen.getByLabelText("SBC visual canvas")).toBeInTheDocument();
    expect(screen.queryByLabelText("Node inspector")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("node-route:main"));
    expect(screen.getByLabelText("Node inspector")).toBeInTheDocument();
    expect(screen.getByLabelText("Rules, JSON, and diagnostics")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "1.13 stable" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "1.12 Legacy" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "1.14 testing" })).toBeInTheDocument();
  });

  it("lets side port buttons mutate canonical references", () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);

    fireEvent.click(screen.getByLabelText("Remove Outbound from Route"));

    expect(useProjectStore.getState().config.route?.final).toBeUndefined();
    expect(screen.getByLabelText("Add Outbound from Route")).toBeInTheDocument();
  });

  it("adds global log as an independent settings node", () => {
    useProjectStore.getState().loadMinimal();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Library/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Log/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add Log Settings" }));

    expect(useProjectStore.getState().selectedId).toBe("settings:log");
    expect(useProjectStore.getState().config.log?.level).toBe("info");
    expect(screen.getByTestId("node-settings:log")).toBeInTheDocument();
  });

  it("adds NTP, Certificate, and Experimental settings as independent editable nodes", () => {
    useProjectStore.getState().loadMinimal();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Library/ }));
    fireEvent.click(screen.getByRole("button", { name: /^NTP/ }));
    fireEvent.click(screen.getByRole("button", { name: "Setup NTP Settings" }));

    expect(useProjectStore.getState().selectedId).toBe("settings:ntp");
    expect(useProjectStore.getState().config.ntp?.server).toBe("time.apple.com");
    expect(screen.getByTestId("node-settings:ntp")).toBeInTheDocument();
    expect(screen.getByText("Enable NTP")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Library/ }));
    const certificateGroup = screen.getAllByRole("button", { name: /^Certificate/ })[0];
    if (!certificateGroup) throw new Error("missing Certificate group");
    fireEvent.click(certificateGroup);
    fireEvent.click(screen.getByRole("button", { name: "Setup Certificate" }));

    expect(useProjectStore.getState().selectedId).toBe("settings:certificate");
    expect(useProjectStore.getState().config.certificate?.store).toBe("system");
    expect(screen.getByTestId("node-settings:certificate")).toBeInTheDocument();
    expect(screen.getByText("Certificate Paths")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Library/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Experimental/ }));
    fireEvent.click(screen.getByRole("button", { name: "Setup Experimental" }));

    expect(useProjectStore.getState().selectedId).toBe("settings:experimental");
    expect(useProjectStore.getState().config.experimental?.cache_file).toMatchObject({ enabled: false });
    expect(screen.getByTestId("node-settings:experimental")).toBeInTheDocument();
    expect(screen.getByText("Cache File")).toBeInTheDocument();
  });

  it("adds outbound setup drafts from the Library without falling back to SOCKS", () => {
    useProjectStore.getState().loadMinimal();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Library/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Outbounds/ }));
    fireEvent.click(screen.getByRole("button", { name: "Setup HTTP" }));

    const created = useProjectStore.getState().config.outbounds?.at(-1);

    expect(created?.type).toBe("http");
    expect(created?.tag).toBe("http-out");
    expect(useProjectStore.getState().selectedId).toBe("outbound:http-out");
    expect(screen.getByText("Password")).toBeInTheDocument();
  });

  it("lets an unconnected outbound define upstream references from the Inspector", () => {
    useProjectStore.getState().loadMinimal();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Library/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Outbounds/ }));
    fireEvent.click(screen.getByRole("button", { name: "Setup Naive" }));

    expect(useProjectStore.getState().selectedId).toBe("outbound:naive-out");
    expect(screen.getByText("Connections")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Set Route final" }));
    expect(useProjectStore.getState().config.route?.final).toBe("naive-out");

    fireEvent.click(screen.getByRole("button", { name: "Add Route rule to this outbound" }));
    expect(useProjectStore.getState().config.route?.rules?.at(-1)?.outbound).toBe("naive-out");

    fireEvent.click(screen.getByRole("button", { name: "Create selector + add" }));
    const selector = useProjectStore
      .getState()
      .config.outbounds?.find((outbound) => outbound.type === "selector" && outbound.outbounds?.includes("naive-out"));
    expect(selector?.tag).toBe("proxy");

    fireEvent.click(screen.getByRole("button", { name: "Create URLTest + add" }));
    const urltest = useProjectStore
      .getState()
      .config.outbounds?.find((outbound) => outbound.type === "urltest" && outbound.outbounds?.includes("naive-out"));
    expect(urltest?.tag).toBe("auto");

    fireEvent.click(screen.getByRole("button", { name: "Use for DNS server detour" }));
    expect(useProjectStore.getState().config.dns?.servers?.some((server) => server.detour === "naive-out")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Use as Dial detour target" }));
    expect(useProjectStore.getState().config.outbounds?.some((outbound) => outbound.detour === "naive-out")).toBe(true);
  });

  it("links newly created outbounds to the selected upstream context", () => {
    useProjectStore.getState().loadTemplate();
    render(<App />);

    fireEvent.click(screen.getByTestId("node-route:main"));
    fireEvent.click(screen.getByRole("button", { name: /Library/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Outbounds/ }));
    fireEvent.click(screen.getByRole("button", { name: "Setup Naive" }));

    expect(useProjectStore.getState().config.route?.rules?.at(-1)?.outbound).toBe("naive-out");

    fireEvent.click(screen.getByTestId("node-outbound:proxy"));
    fireEvent.click(screen.getByRole("button", { name: /Library/ }));
    fireEvent.click(screen.getByRole("button", { name: "Setup HTTP" }));

    const proxy = useProjectStore.getState().config.outbounds?.find((outbound) => outbound.tag === "proxy");
    expect(proxy?.outbounds).toContain("http-out");
  });

  it("adds inbound setup drafts from the Library and opens editable listen fields", () => {
    useProjectStore.getState().loadMinimal();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Library/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Inbounds/ }));
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

    fireEvent.click(screen.getByRole("button", { name: /Library/ }));
    fireEvent.click(screen.getByRole("button", { name: /^DNS/ }));
    fireEvent.click(screen.getByRole("button", { name: "Setup TCP Server" }));

    const created = useProjectStore.getState().config.dns?.servers?.at(-1);

    expect(created?.type).toBe("tcp");
    expect(created?.tag).toBe("tcp-dns");
    expect(useProjectStore.getState().selectedId).toBe("dns-server:tcp-dns");
    expect(screen.getByText("Server")).toBeInTheDocument();
  });
});
