import { Braces, Download, ExternalLink, FolderOpen, Github, LayoutTemplate } from "lucide-react";
import { useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import type { ChangeEvent } from "react";
import { SING_BOX_TARGETS, targetFromVersion } from "../domain/targets";
import type { SingBoxTargetId } from "../domain/types";
import { useProjectStore } from "../state/useProjectStore";
import { GITHUB_REPO_URL } from "./appLinks";
import { BottomSheet } from "./BottomSheet";
import { blockingExportErrors, exportConfigGated } from "./exportConfig";
import { configHasContent } from "./TopBar";

interface MobileMenuSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenTemplates: () => void;
  onOpenJson: () => void;
}

export function MobileMenuSheet({ open, onClose, onOpenTemplates, onOpenJson }: MobileMenuSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { channel, version, setTarget, importJson, diagnostics } = useProjectStore(
    useShallow((state) => ({
      channel: state.channel,
      version: state.version,
      setTarget: state.setTarget,
      importJson: state.importJson,
      diagnostics: state.diagnostics,
    })),
  );
  const target = targetFromVersion(channel, version);
  // V2 hard gate (parity with desktop): structural errors disable Export entirely.
  const exportBlockers = blockingExportErrors(diagnostics);

  function exportConfig() {
    // Same hard gate as desktop. Read config/diagnostics from the store; only close the sheet when the
    // export actually proceeded (blocked/cancelled keeps the sheet open).
    const { config, diagnostics: current, pushToast } = useProjectStore.getState();
    const outcome = exportConfigGated(config, current);
    if (outcome.exported) {
      onClose();
    } else if (outcome.reason === "blocked") {
      pushToast({
        message: `Fix ${outcome.errors.length} structural error${outcome.errors.length === 1 ? "" : "s"} before exporting.`,
        tone: "error",
      });
    }
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
    if (configHasContent(useProjectStore.getState().config) && !window.confirm("Import replaces your current configuration. Continue?")) {
      event.target.value = "";
      return;
    }
    const result = importJson(await file.text(), { snapshot: true });
    const { pushToast, undo } = useProjectStore.getState();
    if (result.ok) {
      pushToast({ message: "Configuration imported", tone: "success", action: { label: "Undo", onAct: undo } });
    } else {
      pushToast({ message: `Import failed: ${result.error}`, tone: "error", durationMs: 8000 });
    }
    event.target.value = "";
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} initialSnap="mid" ariaLabel="Top bar menu" testId="mobile-menu-sheet">
      <div className="mobile-sheet-header">
        <h2>sbcv.app</h2>
        <p className="mobile-sheet-hint">sing-box configuration visualizer</p>
      </div>

      <div className="mobile-menu-section">
        <label className="mobile-menu-field">
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
      </div>

      <ul className="mobile-menu-actions">
        <li>
          <button type="button" className="mobile-row-button" onClick={() => { onClose(); onOpenTemplates(); }}>
            <LayoutTemplate size={18} />
            <span className="mobile-row-button__title">Templates</span>
            <span className="mobile-row-button__meta">Replace config with a preset</span>
          </button>
        </li>
        <li>
          <button type="button" className="mobile-row-button" onClick={() => { onClose(); onOpenJson(); }}>
            <Braces size={18} />
            <span className="mobile-row-button__title">View JSON</span>
            <span className="mobile-row-button__meta">Read-only canonical config</span>
          </button>
        </li>
        <li>
          <button type="button" className="mobile-row-button" onClick={() => fileInputRef.current?.click()}>
            <FolderOpen size={18} />
            <span className="mobile-row-button__title">Import JSON</span>
            <span className="mobile-row-button__meta">Load a sing-box config file</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className="mobile-row-button"
            onClick={exportConfig}
            disabled={exportBlockers.length > 0}
            aria-disabled={exportBlockers.length > 0}
          >
            <Download size={18} />
            <span className="mobile-row-button__title">Export</span>
            <span className="mobile-row-button__meta">
              {exportBlockers.length > 0
                ? `Fix ${exportBlockers.length} structural error${exportBlockers.length === 1 ? "" : "s"} first`
                : "Normalized .json — empty fields dropped, shorthands expanded"}
            </span>
          </button>
        </li>
        <li>
          <a className="mobile-row-button mobile-row-link" href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
            <Github size={18} />
            <span className="mobile-row-button__title">GitHub</span>
            <span className="mobile-row-button__meta">JegoVPN/sbcv</span>
            <ExternalLink className="mobile-row-button__external" size={14} aria-hidden />
          </a>
        </li>
      </ul>

      <input
        ref={fileInputRef}
        type="file"
        aria-label="Import JSON file"
        accept="application/json,.json"
        className="visually-hidden"
        onChange={handleImport}
      />
    </BottomSheet>
  );
}
