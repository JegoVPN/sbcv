import { useShallow } from "zustand/react/shallow";
import { useProjectStore } from "../state/useProjectStore";
import { BottomSheet } from "./BottomSheet";
import { Inspector } from "./Inspector";

export function MobileInspectorSheet() {
  const { selectedId, setSelectedId } = useProjectStore(
    useShallow((state) => ({
      selectedId: state.selectedId,
      setSelectedId: state.setSelectedId,
    })),
  );

  return (
    <BottomSheet
      open={selectedId !== null}
      onClose={() => setSelectedId(null)}
      initialSnap="mid"
      ariaLabel="Inspector"
      testId="mobile-inspector-sheet"
    >
      <div className="mobile-inspector-body">
        <Inspector compact />
      </div>
    </BottomSheet>
  );
}
