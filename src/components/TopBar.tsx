import { CheckCircle2, CircleAlert, CircleX, Download, FileCheck2, FolderOpen, LoaderCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { createConfigExport } from "../domain/serialization";
import { summarizeDiagnostics } from "../domain/diagnostics";
import { SING_BOX_TARGETS, targetFromVersion } from "../domain/targets";
import { useProjectStore } from "../state/useProjectStore";
import type { SingBoxTargetId } from "../domain/types";
import { DiagnosticsPopover } from "./DiagnosticsPopover";

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
  const officialDiagnostics = useProjectStore((state) => state.officialDiagnostics);
  const validateNow = useProjectStore((state) => state.validateNow);
  const runOfficialCheck = useProjectStore((state) => state.runOfficialCheck);
  const importJson = useProjectStore((state) => state.importJson);
  const checkNotice = useProjectStore((state) => state.checkNotice);
  const isChecking = useProjectStore((state) => state.isChecking);
  const isOfficialChecking = useProjectStore((state) => state.isOfficialChecking);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const allDiagnostics = useMemo(
    () => [...diagnostics, ...officialDiagnostics],
    [diagnostics, officialDiagnostics],
  );
  const status = summarizeDiagnostics(allDiagnostics);
  const busy = isChecking || isOfficialChecking;
  const pillState = busy ? "checking" : status;
  const target = targetFromVersion(channel, version);
  const StatusIcon =
    pillState === "checking" ? LoaderCircle : pillState === "error" ? CircleX : pillState === "warning" ? CircleAlert : CheckCircle2;
  const statusLabel =
    pillState === "checking" ? "Checking" : pillState === "error" ? "Invalid" : pillState === "warning" ? "Warning" : "Valid";

  const pillInteractive = pillState !== "checking";
  const popoverTone: "valid" | "warning" | "error" =
    pillState === "error" ? "error" : pillState === "warning" ? "warning" : "valid";

  function runCheck() {
    validateNow();
    void runOfficialCheck();
  }

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
        <button type="button" onClick={runCheck} disabled={busy}>
          <FileCheck2 size={15} />
          Check
        </button>
        <div className="status-pill-host">
          <button
            key={busy ? "checking" : checkNotice || pillState}
            type="button"
            className={`status-pill status-pill--${pillState} ${checkNotice && !busy && pillState === "valid" ? "status-pill--checked" : ""} ${pillInteractive ? "status-pill--interactive" : ""}`}
            title={checkNotice || statusLabel}
            aria-label={statusLabel}
            aria-haspopup={pillInteractive ? "dialog" : undefined}
            aria-expanded={pillInteractive ? popoverOpen : undefined}
            disabled={!pillInteractive}
            onClick={() => {
              if (pillInteractive) setPopoverOpen((prev) => !prev);
            }}
          >
            <StatusIcon className={pillState === "checking" ? "status-pill__spinner" : undefined} size={14} />
            {statusLabel}
          </button>
          {popoverOpen && pillInteractive ? (
            <DiagnosticsPopover
              diagnostics={allDiagnostics}
              tone={popoverTone}
              onClose={() => setPopoverOpen(false)}
            />
          ) : null}
        </div>
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
      </div>
    </header>
  );
}
