import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { Braces, Copy, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { stringifyConfig } from "../domain/serialization";
import { useProjectStore } from "../state/useProjectStore";

const jsonExtensions = [json()];

type ConfigJsonViewerDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function ConfigJsonViewerDialog({ open, onClose }: ConfigJsonViewerDialogProps) {
  const config = useProjectStore((state) => state.config);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  const jsonText = useMemo(() => stringifyConfig(config), [config]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
    };
  }, []);

  async function copyJson() {
    await navigator.clipboard.writeText(jsonText);
    setCopied(true);
    if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1800);
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="json-viewer-root" role="dialog" aria-modal="true" aria-label="Current JSON">
      <div className="json-viewer-backdrop" onPointerDown={onClose} />
      <section className="json-viewer-dialog">
        <header className="json-viewer-header">
          <div className="json-viewer-title">
            <Braces size={18} aria-hidden />
            <div>
              <h2>Current JSON</h2>
              <p>Canonical sing-box config. Layout metadata is not included.</p>
            </div>
          </div>
          <div className="json-viewer-actions">
            <button type="button" onClick={copyJson}>
              <Copy size={15} />
              {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" className="json-viewer-close" onClick={onClose} aria-label="Close JSON viewer">
              <X size={17} />
            </button>
          </div>
        </header>
        <div className="json-viewer-editor">
          <CodeMirror
            value={jsonText}
            height="100%"
            theme="dark"
            extensions={jsonExtensions}
            editable={false}
            readOnly
            basicSetup={{
              autocompletion: false,
              bracketMatching: true,
              closeBrackets: false,
              foldGutter: true,
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
              lineNumbers: true,
            }}
          />
        </div>
      </section>
    </div>,
    document.body,
  );
}
