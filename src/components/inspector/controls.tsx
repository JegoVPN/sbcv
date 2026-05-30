import { useEffect, useRef, useState, type ReactNode } from "react";

// C14 — leaf presentational controls extracted from the Inspector monolith. Pure components with no
// dependency on the Inspector's domain helpers, so they live in their own module and are imported back.

const SENSITIVE_FIELD_PATTERNS = [
  "password",
  "passphrase",
  "private_key",
  "pre_shared_key",
  "preshared_key",
  "psk",
  "secret",
  "token",
  "auth_key",
  "authkey",
  "credential",
];

export function isSensitiveFieldName(field: string) {
  const lower = field.toLowerCase();
  return SENSITIVE_FIELD_PATTERNS.some((pattern) => lower.includes(pattern));
}

export function SensitiveTextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const [reveal, setReveal] = useState(false);
  return (
    <label className="field field--sensitive">
      <span>{label}</span>
      <span className="field__input-row">
        <input
          type={reveal ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
        <button
          type="button"
          className="field__reveal-button"
          aria-label={reveal ? `Hide ${label}` : `Show ${label}`}
          onClick={() => setReveal((current) => !current)}
        >
          {reveal ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}

export function PlatformBanner({ kind, text }: { kind: "platform" | "build-tag" | "deprecated" | "channel"; text: string }) {
  return (
    <div className={`inspector-banner inspector-banner--${kind}`} role="note" aria-label={text}>
      {text}
    </div>
  );
}

export function JsonField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const serialized = JSON.stringify(value ?? null, null, 2);
  const [draft, setDraft] = useState(serialized);
  const [error, setError] = useState<string | null>(null);
  // Tracks the serialized form this editor last emitted, so an external value change (e.g. selecting a
  // different entity that reuses this component instance) can be told apart from our own valid edit.
  const lastEmittedRef = useRef(serialized);
  useEffect(() => {
    // External change: reset the draft and clear any stale parse error so the previous entity's bad
    // draft can never be written onto the newly selected one. Our own valid edits keep lastEmittedRef in
    // sync, so they don't trigger a reset (and the textarea isn't reformatted mid-edit).
    if (serialized !== lastEmittedRef.current) {
      lastEmittedRef.current = serialized;
      setDraft(serialized);
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);
  return (
    <label className="field inspector-json-field">
      <span>{label}</span>
      <textarea
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (!next.trim()) {
            // Empty input clears the field instead of erroring (mirrors InlineRuleSetEditor).
            setError(null);
            lastEmittedRef.current = JSON.stringify(null, null, 2);
            onChange(undefined);
            return;
          }
          try {
            const parsed = JSON.parse(next);
            setError(null);
            lastEmittedRef.current = JSON.stringify(parsed ?? null, null, 2);
            onChange(parsed);
          } catch (cause) {
            // Never write unparseable text into canonical config; keep the last valid value.
            setError(cause instanceof Error ? cause.message : "Invalid JSON.");
          }
        }}
      />
      {error ? (
        <span className="field__hint field__hint--error" role="alert">
          {error} The previous valid value is kept — fix the JSON to apply changes.
        </span>
      ) : null}
    </label>
  );
}

export function ModuleCard({
  title,
  active,
  children,
}: {
  title: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <details className={`settings-module-card ${active ? "is-active" : ""}`}>
      <summary>
        <span>{title}</span>
        <strong>{active ? "ON" : "OFF"}</strong>
      </summary>
      <div className="settings-module-card__body">{children}</div>
    </details>
  );
}
