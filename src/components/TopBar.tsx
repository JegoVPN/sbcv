import { Download, FileCheck2, FolderOpen, RotateCcw } from "lucide-react";
import { useRef } from "react";
import type { ChangeEvent } from "react";
import { stringifyConfig } from "../domain/serialization";
import { summarizeDiagnostics } from "../domain/diagnostics";
import { useProjectStore } from "../state/useProjectStore";

export function TopBar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channel = useProjectStore((state) => state.channel);
  const setChannel = useProjectStore((state) => state.setChannel);
  const config = useProjectStore((state) => state.config);
  const diagnostics = useProjectStore((state) => state.diagnostics);
  const validateNow = useProjectStore((state) => state.validateNow);
  const loadMinimal = useProjectStore((state) => state.loadMinimal);
  const importJson = useProjectStore((state) => state.importJson);
  const status = summarizeDiagnostics(diagnostics);

  function exportConfig() {
    const blob = new Blob([stringifyConfig(config)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "config.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    importJson(await file.text());
    event.target.value = "";
  }

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">S</div>
        <div>
          <div className="brand-title">SBC</div>
          <div className="brand-subtitle">sing-box visual config</div>
        </div>
      </div>
      <div className="topbar-actions">
        <label className="channel-select">
          <span>Channel</span>
          <select value={channel} onChange={(event) => setChannel(event.target.value as "stable" | "testing")}>
            <option value="stable">stable</option>
            <option value="testing">testing</option>
          </select>
        </label>
        <button type="button" onClick={loadMinimal}>
          <RotateCcw size={15} />
          Minimal
        </button>
        <button type="button" onClick={validateNow}>
          <FileCheck2 size={15} />
          Check
        </button>
        <button type="button" onClick={exportConfig}>
          <Download size={15} />
          Export
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          <FolderOpen size={15} />
          Import via JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          aria-label="Import JSON file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={handleImport}
        />
        <span className={`status-pill status-pill--${status}`}>{status}</span>
      </div>
    </header>
  );
}
