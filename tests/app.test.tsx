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
