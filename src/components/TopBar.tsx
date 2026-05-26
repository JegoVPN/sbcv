import { Download, FileCheck2, FolderOpen, RotateCcw } from "lucide-react";
import { useRef } from "react";
import type { ChangeEvent } from "react";
import { createConfigExport } from "../domain/serialization";
import { summarizeDiagnostics } from "../domain/diagnostics";
import { SING_BOX_TARGETS, targetFromVersion } from "../domain/targets";
import { useProjectStore } from "../state/useProjectStore";
import type { SingBoxTargetId } from "../domain/types";

export function TopBar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channel = useProjectStore((state) => state.channel);
  const version = useProjectStore((state) => state.version);
  const setTarget = useProjectStore((state) => state.setTarget);
  const config = useProjectStore((state) => state.config);
  const diagnostics = useProjectStore((state) => state.diagnostics);
  const validateNow = useProjectStore((state) => state.validateNow);
  const loadMinimal = useProjectStore((state) => state.loadMinimal);
  const importJson = useProjectStore((state) => state.importJson);
  const status = summarizeDiagnostics(diagnostics);
  const target = targetFromVersion(channel, version);

  function exportConfig() {
    const exportedConfig = createConfigExport(config);
    const blob = new Blob([exportedConfig.contents], { type: exportedConfig.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportedConfig.fileName;
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
          <span>Target</span>
          <select
            aria-label="Sing-box target"
            value={target.id}
            onChange={(event) => setTarget(event.target.value as SingBoxTargetId)}
          >
            {SING_BOX_TARGETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
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
