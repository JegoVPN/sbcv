import { Blocks, Cable, GitBranch, Globe2, Network, RadioTower, Shuffle } from "lucide-react";
import { useProjectStore } from "../state/useProjectStore";

const groups = [
  {
    title: "Templates",
    items: [{ label: "TUN Split", kind: "template", icon: Blocks }],
  },
  {
    title: "Inbound",
    items: [{ label: "TUN Inbound", kind: "tun", icon: RadioTower }],
  },
  {
    title: "Route",
    items: [{ label: "Route Hub", kind: "route", icon: GitBranch }],
  },
  {
    title: "Outbound",
    items: [
      { label: "Direct", kind: "direct", icon: Cable },
      { label: "Block", kind: "block", icon: Blocks },
      { label: "SOCKS Proxy", kind: "socks", icon: Network },
      { label: "Selector", kind: "selector", icon: Shuffle },
      { label: "URLTest", kind: "urltest", icon: Shuffle },
    ],
  },
  {
    title: "DNS",
    items: [
      { label: "Local DNS", kind: "dns-local", icon: Globe2 },
      { label: "Remote DoH", kind: "dns-https", icon: Globe2 },
    ],
  },
];

export function Palette() {
  const loadTemplate = useProjectStore((state) => state.loadTemplate);
  const createFromPalette = useProjectStore((state) => state.createFromPalette);

  return (
    <aside className="palette" aria-label="Node palette">
      <div className="panel-title">Palette</div>
      {groups.map((group) => (
        <section className="palette-group" key={group.title}>
          <h2>{group.title}</h2>
          <div className="palette-list">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.kind}
                  type="button"
                  className="palette-item"
                  onClick={() => {
                    if (item.kind === "template") loadTemplate();
                    else createFromPalette(item.kind);
                  }}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </aside>
  );
}
