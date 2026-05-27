import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

export type SheetSnap = "peek" | "mid" | "full";

const SNAP_VH: Record<SheetSnap, number> = { peek: 25, mid: 55, full: 92 };

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  initialSnap?: SheetSnap;
  ariaLabel: string;
  children: ReactNode;
  testId?: string;
}

export function BottomSheet({
  open,
  onClose,
  initialSnap = "mid",
  ariaLabel,
  children,
  testId,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<SheetSnap>(initialSnap);
  const [dragHeightVh, setDragHeightVh] = useState<number | null>(null);
  const dragStartRef = useRef<{ y: number; heightVh: number } | null>(null);

  useEffect(() => {
    if (open) setSnap(initialSnap);
  }, [open, initialSnap]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const snapTo = useCallback(
    (next: SheetSnap) => {
      setSnap(next);
      setDragHeightVh(null);
    },
    [],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { y: event.clientY, heightVh: SNAP_VH[snap] };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const dy = event.clientY - dragStartRef.current.y;
    const vhDelta = (dy / window.innerHeight) * 100;
    const nextVh = Math.max(10, Math.min(96, dragStartRef.current.heightVh - vhDelta));
    setDragHeightVh(nextVh);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const finalVh = dragHeightVh ?? SNAP_VH[snap];
    dragStartRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (finalVh < 18) {
      onClose();
      return;
    }
    const candidates: SheetSnap[] = ["peek", "mid", "full"];
    const nearest = candidates.reduce((best, cur) =>
      Math.abs(SNAP_VH[cur] - finalVh) < Math.abs(SNAP_VH[best] - finalVh) ? cur : best,
    );
    snapTo(nearest);
  };

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const currentVh = dragHeightVh ?? SNAP_VH[snap];

  // Portal to <body> so that `position: fixed` resolves against the viewport.
  // Without this, an ancestor with `backdrop-filter` / `transform` / `filter`
  // (e.g. .mobile-topbar) becomes the containing block and the sheet collapses
  // to that ancestor's height.
  return createPortal(
    <div className="bottom-sheet-root" role="dialog" aria-modal="true" aria-label={ariaLabel} data-testid={testId}>
      <div className="bottom-sheet-backdrop" onPointerDown={onClose} />
      <div
        ref={sheetRef}
        className="bottom-sheet"
        style={{ height: `${currentVh}vh` }}
      >
        <div
          className="bottom-sheet__handle"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="button"
          tabIndex={0}
          aria-label="Drag to resize"
        >
          <span className="bottom-sheet__handle-bar" />
        </div>
        <div className={`bottom-sheet__body ${snap === "full" ? "bottom-sheet__body--scroll" : ""}`}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
