import { Download, FolderOpen, LayoutTemplate } from "lucide-react";
import { useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import type { ChangeEvent } from "react";
import { createConfigExport } from "../domain/serialization";
import { SING_BOX_TARGETS, targetFromVersion } from "../domain/targets";
import type { SingBoxTargetId } from "../domain/types";
import { useProjectStore } from "../state/useProjectStore";
import { BottomSheet } from "./BottomSheet";
import { configHasContent, createSbcvFileName } from "./TopBar";

interface MobileMenuSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenTemplates: () => void;
}

export function MobileMenuSheet({ open, onClose, onOpenTemplates }: MobileMenuSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { channel, version, setTarget, importJson } = useProjectStore(
    useShallow((state) => ({
      channel: state.channel,
      version: state.version,
      setTarget: state.setTarget,
      importJson: state.importJson,
    })),
  );
  const target = targetFromVersion(channel, version);

  function exportConfig() {
    const exportedConfig = createConfigExport(useProjectStore.getState().config);
    const blob = new Blob([exportedConfig.contents], { type: exportedConfig.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = createSbcvFileName();
    link.click();
    URL.revokeObjectURL(url);
    onClose();
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
    const result = importJson(await file.text());
    const pushToast = useProjectStore.getState().pushToast;
    if (result.ok) {
      pushToast({ message: "Configuration imported", tone: "success" });
    } else {
      pushToast({ message: `Import failed: ${result.error}`, tone: "error", durationMs: 8000 });
    }
    event.target.value = "";
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} initialSnap="mid" ariaLabel="Top bar menu" testId="mobile-menu-sheet">
      <div className="mobile-sheet-header">
        <h2>Menu</h2>
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
          <button type="button" className="mobile-row-button" onClick={() => fileInputRef.current?.click()}>
            <FolderOpen size={18} />
            <span className="mobile-row-button__title">Import JSON</span>
            <span className="mobile-row-button__meta">Load a sing-box config file</span>
          </button>
        </li>
        <li>
          <button type="button" className="mobile-row-button" onClick={exportConfig}>
            <Download size={18} />
            <span className="mobile-row-button__title">Export</span>
            <span className="mobile-row-button__meta">Normalized .json — empty fields dropped, shorthands expanded</span>
          </button>
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
