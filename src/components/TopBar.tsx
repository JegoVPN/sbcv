import { CheckCircle2, CircleAlert, CircleX, Download, FileCheck2, FolderOpen, LoaderCircle } from "lucide-react";
import { useRef } from "react";
import type { ChangeEvent } from "react";
import { createConfigExport } from "../domain/serialization";
import { summarizeDiagnostics } from "../domain/diagnostics";
import { SING_BOX_TARGETS, targetFromVersion } from "../domain/targets";
import { useProjectStore } from "../state/useProjectStore";
import type { SingBoxTargetId } from "../domain/types";

function padTimestampPart(value: number) {
  return String(value).padStart(2, "0");
}

export function createSbcvFileName(now = new Date()) {
  const date = `${now.getFullYear()}${padTimestampPart(now.getMonth() + 1)}${padTimestampPart(now.getDate())}`;
  const time = `${padTimestampPart(now.getHours())}${padTimestampPart(now.getMinutes())}${padTimestampPart(now.getSeconds())}`;
  return `sbcv_${date}_${time}.json`;
}

export function TopBar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channel = useProjectStore((state) => state.channel);
  const version = useProjectStore((state) => state.version);
  const setTarget = useProjectStore((state) => state.setTarget);
  const config = useProjectStore((state) => state.config);
  const diagnostics = useProjectStore((state) => state.diagnostics);
  const validateNow = useProjectStore((state) => state.validateNow);
  const importJson = useProjectStore((state) => state.importJson);
  const checkNotice = useProjectStore((state) => state.checkNotice);
  const isChecking = useProjectStore((state) => state.isChecking);
  const status = summarizeDiagnostics(diagnostics);
  const pillState = isChecking ? "checking" : status;
  const target = targetFromVersion(channel, version);
  const StatusIcon =
    pillState === "checking" ? LoaderCircle : pillState === "error" ? CircleX : pillState === "warning" ? CircleAlert : CheckCircle2;
  const statusLabel =
    pillState === "checking" ? "Checking" : pillState === "error" ? "Invalid" : pillState === "warning" ? "Warning" : "Valid";

  function exportConfig() {
    const exportedConfig = createConfigExport(config);
    const blob = new Blob([exportedConfig.contents], { type: exportedConfig.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = createSbcvFileName();
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
          <div className="brand-title">sbcv.app</div>
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
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          aria-label="Import JSON file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={handleImport}
        />
        <span
          key={isChecking ? "checking" : checkNotice || pillState}
          className={`status-pill status-pill--${pillState} ${checkNotice && !isChecking && pillState === "valid" ? "status-pill--checked" : ""}`}
          title={checkNotice || statusLabel}
          aria-label={statusLabel}
        >
          <StatusIcon className={pillState === "checking" ? "status-pill__spinner" : undefined} size={14} />
          {statusLabel}
        </span>
      </div>
    </header>
  );
}
