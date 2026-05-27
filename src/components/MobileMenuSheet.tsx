import { Download, FolderOpen, LayoutTemplate } from "lucide-react";
import { useRef } from "react";
import type { ChangeEvent } from "react";
import { createConfigExport } from "../domain/serialization";
import { SING_BOX_TARGETS, targetFromVersion } from "../domain/targets";
import type { SingBoxTargetId } from "../domain/types";
import { useProjectStore } from "../state/useProjectStore";
import { BottomSheet } from "./BottomSheet";
import { createSbcvFileName } from "./TopBar";

interface MobileMenuSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenTemplates: () => void;
}

export function MobileMenuSheet({ open, onClose, onOpenTemplates }: MobileMenuSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channel = useProjectStore((state) => state.channel);
  const version = useProjectStore((state) => state.version);
  const setTarget = useProjectStore((state) => state.setTarget);
  const config = useProjectStore((state) => state.config);
  const importJson = useProjectStore((state) => state.importJson);
  const target = targetFromVersion(channel, version);

  function exportConfig() {
    const exportedConfig = createConfigExport(config);
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
    importJson(await file.text());
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
            <span className="mobile-row-button__meta">Download current config as .json</span>
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
