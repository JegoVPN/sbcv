import {
  Braces,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleX,
  Download,
  ExternalLink,
  FileCheck2,
  FolderOpen,
  Github,
  Home,
  LoaderCircle,
} from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { ChangeEvent } from "react";
import { confirmAndExportConfig, downloadProject } from "./exportConfig";
import { summarizeDiagnostics } from "../domain/diagnostics";
import { nodeIdForDiagnosticPath } from "../domain/diagnosticTargets";
import { SING_BOX_TARGETS, targetFromVersion } from "../domain/targets";
import { useProjectStore } from "../state/useProjectStore";
import type { Diagnostic, SingBoxConfig, SingBoxTargetId } from "../domain/types";
import { GITHUB_REPO_URL } from "./appLinks";
import { DiagnosticsPopover } from "./DiagnosticsPopover";
import { SbcvLogo } from "./SbcvLogo";

const ConfigJsonViewerDialog = lazy(() =>
  import("./ConfigJsonViewerDialog").then((module) => ({ default: module.ConfigJsonViewerDialog })),
);

// Whether the current config holds user work worth confirming before an import overwrites it (A26).
export function configHasContent(config: SingBoxConfig): boolean {
  const len = (value: unknown) => (Array.isArray(value) ? value.length : 0);
  const has = (value: unknown) => value !== undefined && value !== null;
  const c = config as Record<string, unknown>;
  return (
    len(config.inbounds) > 0 ||
    len(config.outbounds) > 0 ||
    len(config.endpoints) > 0 ||
    len(config.services) > 0 ||
    len(c.certificate_providers) > 0 ||
    len(c.http_clients) > 0 ||
    len(config.route?.rules) > 0 ||
    len(config.route?.rule_set) > 0 ||
    has(config.route?.final) ||
    len(config.dns?.servers) > 0 ||
    len(config.dns?.rules) > 0 ||
    has(config.dns?.final) ||
    // settings-only nodes (palette-creatable as single-node configs)
    has(c.log) ||
    has(c.ntp) ||
    has(c.certificate) ||
    has(c.experimental)
  );
}

// createSbcvFileName moved to ./exportConfig (shared with the mobile sheet); re-exported for
// back-compat with existing importers (MobileMenuSheet, tests).
export { createSbcvFileName } from "./exportConfig";

export function TopBar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const brandMenuRef = useRef<HTMLDivElement>(null);
  const {
    channel,
    version,
    setTarget,
    diagnostics,
    officialDiagnostics,
    validateNow,
    runOfficialCheck,
    importJson,
    config,
    focusNode,
    goHome,
    checkNotice,
    isChecking,
    isOfficialChecking,
  } = useProjectStore(
    useShallow((state) => ({
      channel: state.channel,
      version: state.version,
      setTarget: state.setTarget,
      diagnostics: state.diagnostics,
      officialDiagnostics: state.officialDiagnostics,
      validateNow: state.validateNow,
      runOfficialCheck: state.runOfficialCheck,
      importJson: state.importJson,
      config: state.config,
      focusNode: state.focusNode,
      goHome: state.goHome,
      checkNotice: state.checkNotice,
      isChecking: state.isChecking,
      isOfficialChecking: state.isOfficialChecking,
    })),
  );
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const [jsonViewerOpen, setJsonViewerOpen] = useState(false);

  const allDiagnostics = useMemo(
    () => [...diagnostics, ...officialDiagnostics],
    [diagnostics, officialDiagnostics],
  );
  const resolveFocusTarget = useCallback(
    (diagnostic: Diagnostic) => nodeIdForDiagnosticPath(diagnostic.path, useProjectStore.getState().config),
    [],
  );
  const handleDiagnosticFocus = useCallback(
    (nodeId: string) => {
      focusNode(nodeId);
      setPopoverOpen(false);
    },
    [focusNode],
  );
  const status = summarizeDiagnostics(allDiagnostics);
  const busy = isChecking || isOfficialChecking;
  const pillState = busy ? "checking" : status;
  const target = targetFromVersion(channel, version);
  const StatusIcon =
    pillState === "checking" ? LoaderCircle : pillState === "error" ? CircleX : pillState === "warning" ? CircleAlert : CheckCircle2;

  // While checking, the pill cycles through two phases so the user can see
  // which leg is in flight. validateNow lands in ~250ms; the binary call
  // can take a few hundred ms more (the worker forwards to a Cloudflare
  // Container that spawns sing-box).
  const checkingPhase: "both" | "local" | "binary" | null =
    isChecking && isOfficialChecking
      ? "both"
      : isChecking
        ? "local"
        : isOfficialChecking
          ? "binary"
          : null;
  const statusLabel = (() => {
    if (checkingPhase === "both") return "Checking";
    if (checkingPhase === "local") return "Parsing JSON";
    if (checkingPhase === "binary") return `Running sing-box ${target.version}`;
    if (pillState === "error") return "Invalid";
    if (pillState === "warning") return "Warning";
    return "Valid";
  })();
  const statusTitle = (() => {
    if (checkingPhase === "both") return "Running checks...";
    if (checkingPhase === "local") return "Parsing JSON and running the semantic validator.";
    if (checkingPhase === "binary") return `Running sing-box ${target.version} validation...`;
    return checkNotice || statusLabel;
  })();

  const pillInteractive = pillState !== "checking";
  const popoverTone: "valid" | "warning" | "error" =
    pillState === "error" ? "error" : pillState === "warning" ? "warning" : "valid";

  useEffect(() => {
    if (!brandMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!brandMenuRef.current?.contains(event.target as Node)) setBrandMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBrandMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [brandMenuOpen]);

  function runCheck() {
    validateNow();
    void runOfficialCheck();
  }

  function exportConfig() {
    // Gate on the synchronous semantic `diagnostics` slice (never cleared mid-flight, unlike
    // official/binary diagnostics) so the gate can't be raced into letting an invalid config through.
    confirmAndExportConfig(useProjectStore.getState().config, diagnostics);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_IMPORT_BYTES) {
      alert(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum import size is 10 MB.`);
      event.target.value = "";
      return;
    }
    // A26: importing replaces the whole config — confirm before clobbering existing work.
    if (configHasContent(config) && !window.confirm("Import replaces your current configuration. Continue?")) {
      event.target.value = "";
      return;
    }
    const result = importJson(await file.text(), { snapshot: true });
    const { pushToast, undo } = useProjectStore.getState();
    if (result.ok) {
      pushToast({ message: "Configuration imported", tone: "success", action: { label: "Undo", onAct: undo } });
    } else {
      pushToast({ message: `Import failed: ${result.error}`, tone: "error", durationMs: 8000 });
    }
    event.target.value = "";
  }

  function saveProjectFile() {
    downloadProject(useProjectStore.getState().saveProject());
  }

  async function handleOpenProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_IMPORT_BYTES) {
      alert(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 10 MB.`);
      event.target.value = "";
      return;
    }
    // Opening a project replaces the whole workspace (config + layout) — confirm before clobbering.
    if (configHasContent(config) && !window.confirm("Open replaces your current configuration and layout. Continue?")) {
      event.target.value = "";
      return;
    }
    const result = useProjectStore.getState().loadProject(await file.text(), { snapshot: true });
    const { pushToast, undo } = useProjectStore.getState();
    if (result.ok) {
      pushToast({ message: "Project opened", tone: "success", action: { label: "Undo", onAct: undo } });
    } else {
      pushToast({ message: `Open failed: ${result.error}`, tone: "error", durationMs: 8000 });
    }
    event.target.value = "";
  }

  return (
    <header className="topbar">
      <div className="brand-menu-host" ref={brandMenuRef}>
        <button
          type="button"
          className={`brand ${brandMenuOpen ? "brand--open" : ""}`}
          onClick={() => setBrandMenuOpen((open) => !open)}
          aria-label="Open sbcv.app menu"
          aria-haspopup="menu"
          aria-expanded={brandMenuOpen}
          data-testid="brand-menu-toggle"
        >
          <div className="brand-mark" aria-hidden>
            <SbcvLogo />
          </div>
          <div>
            <div className="brand-title">sbcv.app</div>
            <div className="brand-subtitle">sing-box visual config</div>
          </div>
          <ChevronDown className="brand-chevron" size={15} aria-hidden />
        </button>
        {brandMenuOpen ? (
          <div className="brand-menu" role="menu" aria-label="sbcv.app menu">
            <div className="brand-menu__intro">
              <SbcvLogo animated className="brand-menu__logo" />
              <div>
                <strong>sbcv.app</strong>
                <span>sing-box configuration visualizer</span>
              </div>
            </div>
            <button
              type="button"
              className="brand-menu__item"
              role="menuitem"
              onClick={() => {
                goHome();
                setBrandMenuOpen(false);
              }}
            >
              <Home size={17} />
              <span>Reset view</span>
            </button>
            <button
              type="button"
              className="brand-menu__item"
              role="menuitem"
              onClick={() => {
                setBrandMenuOpen(false);
                setJsonViewerOpen(true);
              }}
            >
              <Braces size={17} />
              <span>View JSON</span>
            </button>
            <button
              type="button"
              className="brand-menu__item"
              role="menuitem"
              onClick={() => {
                setBrandMenuOpen(false);
                fileInputRef.current?.click();
              }}
            >
              <FolderOpen size={17} />
              <span>Import JSON</span>
            </button>
            <button
              type="button"
              className="brand-menu__item"
              role="menuitem"
              onClick={() => {
                setBrandMenuOpen(false);
                projectInputRef.current?.click();
              }}
            >
              <FolderOpen size={17} />
              <span>Open project (.sbcv)</span>
            </button>
            <a className="brand-menu__item" role="menuitem" href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
              <Github size={17} />
              <span>GitHub</span>
              <ExternalLink className="brand-menu__external" size={14} aria-hidden />
            </a>
          </div>
        ) : null}
      </div>
      <div className="topbar-actions">
        <label className="channel-select">
          <span>Target</span>
          <select
            aria-label="Sing-box target"
            title="Which sing-box build to validate against. Stable (1.13) is the released version; testing (1.14) has newer features not yet in stable — pick the one your sing-box binary runs."
            value={target.id}
            onChange={(event) => setTarget(event.target.value as SingBoxTargetId)}
          >
            {SING_BOX_TARGETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={runCheck} disabled={busy}>
          <FileCheck2 size={15} />
          Check
        </button>
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
            <StatusIcon className={pillState === "checking" ? "status-pill__spinner" : undefined} size={14} />
            {statusLabel}
          </button>
          {popoverOpen && pillInteractive ? (
            <DiagnosticsPopover
              diagnostics={allDiagnostics}
              tone={popoverTone}
              onClose={() => setPopoverOpen(false)}
              resolveFocusTarget={resolveFocusTarget}
              onFocus={handleDiagnosticFocus}
            />
          ) : null}
        </div>
        <button
          type="button"
          onClick={exportConfig}
          data-testid="export-button"
          title="Downloads a normalized config: empty fields are dropped and shorthand values are expanded to sing-box's canonical form, so a re-imported file may differ textually from your original but sing-box reads it identically."
        >
          <Download size={15} />
          Export
        </button>
        <button
          type="button"
          onClick={saveProjectFile}
          data-testid="save-project-button"
          title="Saves a project file (.sbcv.json) — your config plus canvas layout and target — so node positions survive a round-trip. Plain Export writes a bare sing-box config (no layout)."
        >
          <Download size={15} />
          Save project
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        aria-label="Import JSON file"
        accept="application/json,.json"
        className="visually-hidden"
        onChange={handleImport}
      />
      <input
        ref={projectInputRef}
        type="file"
        aria-label="Open sbcv project file"
        accept=".sbcv.json,application/json,.json"
        className="visually-hidden"
        onChange={handleOpenProject}
      />
      {jsonViewerOpen ? (
        <Suspense fallback={null}>
          <ConfigJsonViewerDialog open={jsonViewerOpen} onClose={() => setJsonViewerOpen(false)} />
        </Suspense>
      ) : null}
    </header>
  );
}
