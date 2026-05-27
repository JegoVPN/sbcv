import { TEMPLATE_PRESETS } from "../domain/templates";
import type { TemplatePresetId } from "../domain/templates";
import { useProjectStore } from "../state/useProjectStore";
import { BottomSheet } from "./BottomSheet";

interface MobileTemplatesSheetProps {
  open: boolean;
  onClose: () => void;
}

export function MobileTemplatesSheet({ open, onClose }: MobileTemplatesSheetProps) {
  const loadTemplatePreset = useProjectStore((state) => state.loadTemplatePreset);

  function handlePick(id: TemplatePresetId) {
    loadTemplatePreset(id);
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} initialSnap="mid" ariaLabel="Load template" testId="mobile-templates-sheet">
      <div className="mobile-sheet-header">
        <h2>Templates</h2>
        <p className="mobile-sheet-hint">Pick one to replace the current config.</p>
      </div>
      <ul className="mobile-templates-list">
        {TEMPLATE_PRESETS.map((preset) => (
          <li key={preset.id}>
            <button type="button" onClick={() => handlePick(preset.id)} className="mobile-row-button">
              <span className="mobile-row-button__title">{preset.label}</span>
              <span className="mobile-row-button__meta">
                {preset.channel} · {preset.version}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
