import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { getNodeIcon } from "../canvas/iconRegistry";
import type { PortNodeKind } from "../domain/portRelationRegistry";

export type ChipPickerCandidate = {
  id: string;
  label: string;
  nodeKind: PortNodeKind;
  nodeType: string;
  handleId: string;
};

type ChipPickerPopoverProps = {
  x: number;
  y: number;
  width: number;
  maxHeight: number;
  candidates: ChipPickerCandidate[];
  onPick: (candidate: ChipPickerCandidate) => void;
  onClose: () => void;
};

function CandidateIcon({ kind, type }: { kind: PortNodeKind; type: string }) {
  const Icon = getNodeIcon(kind, type);
  return <Icon size={15} strokeWidth={2} />;
}

export function ChipPickerPopover({ x, y, width, maxHeight, candidates, onPick, onClose }: ChipPickerPopoverProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return candidates;
    return candidates.filter((candidate) => candidate.label.toLowerCase().includes(needle));
  }, [candidates, query]);

  return (
    <div
      className="chip-picker nodrag nopan nowheel"
      style={{ left: x, top: y, width, maxHeight }}
      role="dialog"
      aria-label="Compatible nodes"
    >
      <label className="chip-picker__search">
        <Search size={16} />
        <input
          autoFocus
          aria-label="Search compatible nodes"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
          }}
          placeholder="Search"
        />
      </label>
      <div className="chip-picker__list">
        {filtered.map((candidate) => (
          <button className="chip-picker__item" key={candidate.id} type="button" onClick={() => onPick(candidate)}>
            <span className="chip-picker__item-icon" aria-hidden="true">
              <CandidateIcon kind={candidate.nodeKind} type={candidate.nodeType} />
            </span>
            <span>{candidate.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
