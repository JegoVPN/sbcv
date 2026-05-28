import { useEffect, useRef } from "react";
import { useProjectStore } from "../state/useProjectStore";
import { BottomSheet } from "./BottomSheet";
import { Palette } from "./Palette";

interface MobileNodeSheetProps {
  open: boolean;
  onClose: () => void;
}

// A25 (W31): mobile has no Palette, so nodes can't be added. Surface the existing Palette inside a
// bottom sheet — it already carries every node entry + createFromPalette, so this is the mobile
// node-add path. The `.mobile-node-sheet` wrapper neutralizes the Palette's desktop absolute layout.
export function MobileNodeSheet({ open, onClose }: MobileNodeSheetProps) {
  // Adding a node selects it (createFromPalette sets selectedId), which opens the inspector sheet.
  // Close this sheet on that selection change so two sheets don't stack.
  const selectedId = useProjectStore((state) => state.selectedId);
  const lastSelected = useRef(selectedId);
  useEffect(() => {
    if (open && selectedId !== null && selectedId !== lastSelected.current) {
      onClose();
    }
    lastSelected.current = selectedId;
  }, [selectedId, open, onClose]);

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Add node" testId="mobile-node-sheet">
      <div className="mobile-node-sheet">
        <Palette />
      </div>
    </BottomSheet>
  );
}
