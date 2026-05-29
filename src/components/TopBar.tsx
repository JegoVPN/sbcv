import { CheckCircle2, CircleAlert, CircleX, Download, FileCheck2, FolderOpen, LoaderCircle } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { ChangeEvent } from "react";
import { createConfigExport } from "../domain/serialization";
import { summarizeDiagnostics } from "../domain/diagnostics";
import { nodeIdForDiagnosticPath } from "../domain/diagnosticTargets";
import { SING_BOX_TARGETS, targetFromVersion } from "../domain/targets";
import { useProjectStore } from "../state/useProjectStore";
import type { Diagnostic, SingBoxConfig, SingBoxTargetId } from "../domain/types";
import { DiagnosticsPopover } from "./DiagnosticsPopover";

// Whether the current config holds user work worth confirming before an import overwrites it (A26).
export function configHasContent(config: SingBoxConfig): boolean {
  const len = (value: unknown) => (Array.isArray(value) ? value.length : 0);
  const has = (value: unknown) => value !== undefined && value !== null;
  const c = config as Record<string, unknown>;
  return (
    len(config.inbounds) > 0 ||
    len(config.outbounds) > 0 ||
    len(config.endpoints) > 0 ||
    len(config.services) > 0 ||
    len(c.certificate_providers) > 0 ||
    len(c.http_clients) > 0 ||
    len(config.route?.rules) > 0 ||
    len(config.route?.rule_set) > 0 ||
    has(config.route?.final) ||
    len(config.dns?.servers) > 0 ||
    len(config.dns?.rules) > 0 ||
    has(config.dns?.final) ||
    // settings-only nodes (palette-creatable as single-node configs)
    has(c.log) ||
    has(c.ntp) ||
    has(c.certificate) ||
    has(c.experimental)
  );
}

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
  const {
    channel,
    version,
    setTarget,
    diagnostics,
    officialDiagnostics,
    validateNow,
    runOfficialCheck,
    importJson,
    config,
    focusNode,
    goHome,
    checkNotice,
    isChecking,
    isOfficialChecking,
  } = useProjectStore(
    useShallow((state) => ({
      channel: state.channel,
      version: state.version,
      setTarget: state.setTarget,
      diagnostics: state.diagnostics,
      officialDiagnostics: state.officialDiagnostics,
      validateNow: state.validateNow,
      runOfficialCheck: state.runOfficialCheck,
      importJson: state.importJson,
      config: state.config,
      focusNode: state.focusNode,
      goHome: state.goHome,
      checkNotice: state.checkNotice,
      isChecking: state.isChecking,
      isOfficialChecking: state.isOfficialChecking,
    })),
  );
  const [popoverOpen, setPopoverOpen] = useState(false);

  const allDiagnostics = useMemo(
    () => [...diagnostics, ...officialDiagnostics],
    [diagnostics, officialDiagnostics],
  );
  const resolveFocusTarget = useCallback(
    (diagnostic: Diagnostic) => nodeIdForDiagnosticPath(diagnostic.path, useProjectStore.getState().config),
    [],
  );
  const handleDiagnosticFocus = useCallback(
    (nodeId: string) => {
      focusNode(nodeId);
      setPopoverOpen(false);
    },
    [focusNode],
  );
  const status = summarizeDiagnostics(allDiagnostics);
  const busy = isChecking || isOfficialChecking;
  const pillState = busy ? "checking" : status;
  const target = targetFromVersion(channel, version);
  const StatusIcon =
    pillState === "checking" ? LoaderCircle : pillState === "error" ? CircleX : pillState === "warning" ? CircleAlert : CheckCircle2;

  // While checking, the pill cycles through two phases so the user can see
  // which leg is in flight. validateNow lands in ~250ms; the binary call
  // can take a few hundred ms more (the worker forwards to a Cloudflare
  // Container that spawns sing-box).
  const checkingPhase: "both" | "local" | "binary" | null =
    isChecking && isOfficialChecking
      ? "both"
      : isChecking
        ? "local"
        : isOfficialChecking
          ? "binary"
          : null;
  const statusLabel = (() => {
    if (checkingPhase === "both") return "Checking";
    if (checkingPhase === "local") return "Parsing JSON";
    if (checkingPhase === "binary") return `Running sing-box ${target.version}`;
    if (pillState === "error") return "Invalid";
    if (pillState === "warning") return "Warning";
    return "Valid";
  })();
  const statusTitle = (() => {
    if (checkingPhase === "both") return "Running checks...";
    if (checkingPhase === "local") return "Parsing JSON and running the semantic validator.";
    if (checkingPhase === "binary") return `Running sing-box ${target.version} validation...`;
    return checkNotice || statusLabel;
  })();

  const pillInteractive = pillState !== "checking";
  const popoverTone: "valid" | "warning" | "error" =
    pillState === "error" ? "error" : pillState === "warning" ? "warning" : "valid";

  function runCheck() {
    validateNow();
    void runOfficialCheck();
  }

  function exportConfig() {
    // Gate on semantic diagnostics: they are recomputed synchronously on every config change and are
    // never cleared mid-flight (unlike official/binary diagnostics, which runOfficialCheck clears while a
    // check is in progress), so the gate can't be raced into letting an invalid config through.
    const errorCount = diagnostics.filter((diagnostic) => diagnostic.level === "error").length;
    if (errorCount > 0) {
      const proceed = window.confirm(
        `This config has ${errorCount} error${errorCount === 1 ? "" : "s"} that sing-box may reject. Export anyway?`,
      );
      if (!proceed) return;
    }
    const exportedConfig = createConfigExport(useProjectStore.getState().config);
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
    const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_IMPORT_BYTES) {
      alert(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum import size is 10 MB.`);
      event.target.value = "";
      return;
    }
    // A26: importing replaces the whole config — confirm before clobbering existing work.
    if (configHasContent(config) && !window.confirm("Import replaces your current configuration. Continue?")) {
      event.target.value = "";
      return;
    }
    importJson(await file.text());
    event.target.value = "";
  }

  return (
    <header className="topbar">
      <button
        type="button"
        className="brand"
        onClick={goHome}
        aria-label="sbcv.app — reset view (deselect and fit the canvas)"
        data-testid="brand-home"
      >
        <div className="brand-mark" aria-hidden>
          <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <polygon
              points="16,4 26,10 26,22 16,28 6,22 6,10"
              fill="#0d1116"
              stroke="#c7ff00"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="16" cy="4"  r="3.5" fill="#c7ff00" />
            <circle cx="26" cy="10" r="3.5" fill="#c7ff00" />
            <circle cx="26" cy="22" r="3.5" fill="#c7ff00" />
            <circle cx="16" cy="28" r="3.5" fill="#c7ff00" />
            <circle cx="6"  cy="22" r="3.5" fill="#c7ff00" />
            <circle cx="6"  cy="10" r="3.5" fill="#c7ff00" />
          </svg>
        </div>
        <div>
          <div className="brand-title">sbcv.app</div>
          <div className="brand-subtitle">sing-box visual config</div>
        </div>
      </button>
      <div className="topbar-actions">
        <label className="channel-select">
          <span>Target</span>
          <select
            aria-label="Sing-box target"
            title="Which sing-box build to validate against. Stable (1.13) is the released version; testing (1.14) has newer features not yet in stable — pick the one your sing-box binary runs."
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
            key={busy ? `checking-${checkingPhase}` : checkNotice || pillState}
            type="button"
            className={`status-pill status-pill--${pillState} ${checkNotice && !busy && pillState === "valid" ? "status-pill--checked" : ""} ${pillInteractive ? "status-pill--interactive" : ""}`}
            title={statusTitle}
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
              resolveFocusTarget={resolveFocusTarget}
              onFocus={handleDiagnosticFocus}
            />
          ) : null}
        </div>
        <button type="button" onClick={exportConfig} data-testid="export-button">
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
