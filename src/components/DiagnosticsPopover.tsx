import { useEffect, useRef } from "react";
import { CheckCircle2, CircleAlert, CircleX, Info, X } from "lucide-react";

import type { Diagnostic } from "../domain/types";

type Tone = "valid" | "warning" | "error";

interface DiagnosticsPopoverProps {
  diagnostics: Diagnostic[];
  tone: Tone;
  onClose: () => void;
}

const LEVEL_ORDER: Record<Diagnostic["level"], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

const TONE_TITLE: Record<Tone, string> = {
  valid: "Looks good",
  warning: "Warnings found",
  error: "Errors found",
};

export function DiagnosticsPopover({ diagnostics, tone, onClose }: DiagnosticsPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (ref.current && target && !ref.current.contains(target)) {
        onClose();
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const sorted = [...diagnostics].sort((a, b) => {
    const byLevel = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
    if (byLevel !== 0) return byLevel;
    return a.path.localeCompare(b.path);
  });

  const counts = {
    error: diagnostics.filter((d) => d.level === "error").length,
    warning: diagnostics.filter((d) => d.level === "warning").length,
    info: diagnostics.filter((d) => d.level === "info").length,
  };

  const summaryParts = [
    counts.error > 0 ? `${counts.error} error${counts.error !== 1 ? "s" : ""}` : null,
    counts.warning > 0 ? `${counts.warning} warning${counts.warning !== 1 ? "s" : ""}` : null,
    counts.info > 0 ? `${counts.info} info` : null,
  ].filter((part): part is string => part !== null);

  const HeaderIcon = tone === "error" ? CircleX : tone === "warning" ? CircleAlert : CheckCircle2;

  return (
    <div
      ref={ref}
      className={`diagnostics-popover diagnostics-popover--${tone}`}
      role="dialog"
      aria-label="Configuration diagnostics"
    >
      <div className="diagnostics-popover__header">
        <span className="diagnostics-popover__title">
          <HeaderIcon size={14} aria-hidden />
          {TONE_TITLE[tone]}
        </span>
        <span className="diagnostics-popover__summary">
          {summaryParts.length > 0 ? summaryParts.join(" · ") : "No issues detected"}
        </span>
        <button
          type="button"
          className="diagnostics-popover__close"
          onClick={onClose}
          aria-label="Close diagnostics"
        >
          <X size={14} />
        </button>
      </div>
      {sorted.length === 0 ? (
        <div className="diagnostics-popover__empty">
          The current configuration parses cleanly and reports no semantic
          warnings against <strong>{tone === "valid" ? "the selected target" : "the editor"}</strong>.
        </div>
      ) : (
        <ul className="diagnostics-popover__list">
          {sorted.map((diagnostic, index) => {
            const Icon =
              diagnostic.level === "error"
                ? CircleX
                : diagnostic.level === "warning"
                  ? CircleAlert
                  : Info;
            return (
              <li
                key={`${diagnostic.code}-${diagnostic.path}-${index}`}
                className={`diagnostics-popover__item diagnostics-popover__item--${diagnostic.level}`}
              >
                <Icon size={14} className="diagnostics-popover__icon" aria-hidden />
                <div className="diagnostics-popover__body">
                  <div className="diagnostics-popover__code">
                    <span>{diagnostic.code}</span>
                    {diagnostic.source === "official" ? (
                      <span className="diagnostics-popover__badge">official</span>
                    ) : null}
                  </div>
                  <div className="diagnostics-popover__path" title={diagnostic.path}>
                    {diagnostic.path}
                  </div>
                  <div className="diagnostics-popover__message">{diagnostic.message}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
