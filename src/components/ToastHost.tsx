import { CheckCircle2, CircleX, Info, X } from "lucide-react";
import { useEffect } from "react";
import { useProjectStore } from "../state/useProjectStore";
import type { Toast } from "../state/useProjectStore";

const toneIcon = {
  info: Info,
  success: CheckCircle2,
  error: CircleX,
} as const;

function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useProjectStore((state) => state.dismissToast);

  useEffect(() => {
    if (toast.durationMs === null) return;
    const timer = setTimeout(() => dismissToast(toast.id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, dismissToast]);

  const Icon = toneIcon[toast.tone];
  // Errors interrupt (assertive); info/success wait their turn (polite, via role="status").
  const role = toast.tone === "error" ? "alert" : "status";

  return (
    <div className={`toast toast--${toast.tone}`} role={role} data-testid="toast">
      <Icon size={16} className="toast__icon" aria-hidden />
      <span className="toast__message">{toast.message}</span>
      {toast.action ? (
        <button
          type="button"
          className="toast__action"
          onClick={() => {
            toast.action?.onAct();
            dismissToast(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      ) : null}
      <button
        type="button"
        className="toast__dismiss"
        aria-label="Dismiss notification"
        onClick={() => dismissToast(toast.id)}
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

// Fixed-position stack of transient notifications (L3-toast-infra). Each toast is its own ARIA live
// region (role status/alert) so screen readers announce it on insertion.
export function ToastHost() {
  const toasts = useProjectStore((state) => state.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toast-host" data-testid="toast-host">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
