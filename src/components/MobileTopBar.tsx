import { CheckCircle2, CircleAlert, CircleX, FileCheck2, LoaderCircle, MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { summarizeDiagnostics } from "../domain/diagnostics";
import { targetFromVersion } from "../domain/targets";
import { useProjectStore } from "../state/useProjectStore";
import { DiagnosticsPopover } from "./DiagnosticsPopover";
import { MobileMenuSheet } from "./MobileMenuSheet";
import { MobileTemplatesSheet } from "./MobileTemplatesSheet";

export function MobileTopBar() {
  const channel = useProjectStore((state) => state.channel);
  const version = useProjectStore((state) => state.version);
  const diagnostics = useProjectStore((state) => state.diagnostics);
  const officialDiagnostics = useProjectStore((state) => state.officialDiagnostics);
  const validateNow = useProjectStore((state) => state.validateNow);
  const runOfficialCheck = useProjectStore((state) => state.runOfficialCheck);
  const isChecking = useProjectStore((state) => state.isChecking);
  const isOfficialChecking = useProjectStore((state) => state.isOfficialChecking);
  const checkNotice = useProjectStore((state) => state.checkNotice);
  const goHome = useProjectStore((state) => state.goHome);

  const [menuOpen, setMenuOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const allDiagnostics = useMemo(
    () => [...diagnostics, ...officialDiagnostics],
    [diagnostics, officialDiagnostics],
  );
  const status = summarizeDiagnostics(allDiagnostics);
  const busy = isChecking || isOfficialChecking;
  const pillState = busy ? "checking" : status;
  const target = targetFromVersion(channel, version);
  const StatusIcon =
    pillState === "checking" ? LoaderCircle : pillState === "error" ? CircleX : pillState === "warning" ? CircleAlert : CheckCircle2;

  const checkingPhase: "both" | "local" | "binary" | null =
    isChecking && isOfficialChecking ? "both" : isChecking ? "local" : isOfficialChecking ? "binary" : null;
  const statusLabel = (() => {
    if (checkingPhase === "both") return "Checking";
    if (checkingPhase === "local") return "Parsing JSON";
    if (checkingPhase === "binary") return `sing-box ${target.version}`;
    if (pillState === "error") return "Invalid";
    if (pillState === "warning") return "Warning";
    return "Valid";
  })();
  const statusTitle = busy
    ? checkingPhase === "binary"
      ? `Running sing-box ${target.version} validation...`
      : checkingPhase === "local"
        ? "Parsing JSON and running the semantic validator."
        : "Running checks..."
    : checkNotice || statusLabel;

  const pillInteractive = !busy;
  const popoverTone: "valid" | "warning" | "error" =
    pillState === "error" ? "error" : pillState === "warning" ? "warning" : "valid";

  function runCheck() {
    validateNow();
    void runOfficialCheck();
  }

  return (
    <header className="mobile-topbar">
      <button
        type="button"
        className="mobile-brand"
        onClick={goHome}
        aria-label="sbcv.app — return to home"
        data-testid="brand-home"
      >
        <svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <polygon
            points="16,4 26,10 26,22 16,28 6,22 6,10"
            fill="#0d1116"
            stroke="#c7ff00"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="4" r="3.5" fill="#c7ff00" />
          <circle cx="26" cy="10" r="3.5" fill="#c7ff00" />
          <circle cx="26" cy="22" r="3.5" fill="#c7ff00" />
          <circle cx="16" cy="28" r="3.5" fill="#c7ff00" />
          <circle cx="6" cy="22" r="3.5" fill="#c7ff00" />
          <circle cx="6" cy="10" r="3.5" fill="#c7ff00" />
        </svg>
      </button>

      <div className="mobile-topbar__center">
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
            <StatusIcon className={pillState === "checking" ? "status-pill__spinner" : undefined} size={13} />
            {statusLabel}
          </button>
          {popoverOpen && pillInteractive ? (
            <DiagnosticsPopover
              diagnostics={allDiagnostics}
              tone={popoverTone}
              onClose={() => setPopoverOpen(false)}
            />
          ) : null}
        </div>
      </div>

      <button
        type="button"
        className="mobile-topbar__icon-btn"
        onClick={runCheck}
        disabled={busy}
        aria-label="Run check"
      >
        <FileCheck2 size={18} />
      </button>

      <button
        type="button"
        className="mobile-topbar__icon-btn"
        onClick={() => setMenuOpen(true)}
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        data-testid="mobile-menu-toggle"
      >
        <MoreHorizontal size={20} />
      </button>

      <MobileMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenTemplates={() => setTemplatesOpen(true)}
      />
      <MobileTemplatesSheet open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
    </header>
  );
}
