import { Braces, FileCheck2, ListChecks, ServerCog } from "lucide-react";
import { useProjectStore } from "../state/useProjectStore";
import { DnsRulesTable, RouteRulesTable } from "./RuleTables";

export function BottomPanel() {
  const panelTab = useProjectStore((state) => state.panelTab);
  const setPanelTab = useProjectStore((state) => state.setPanelTab);
  const jsonDraft = useProjectStore((state) => state.jsonDraft);
  const setJsonDraft = useProjectStore((state) => state.setJsonDraft);
  const applyJsonDraft = useProjectStore((state) => state.applyJsonDraft);
  const refreshJson = useProjectStore((state) => state.refreshJson);
  const diagnostics = useProjectStore((state) => state.diagnostics);
  const officialValidationMessage = useProjectStore((state) => state.officialValidationMessage);

  return (
    <section className="bottom-panel" aria-label="Rules, JSON, and diagnostics">
      <nav className="panel-tabs" aria-label="Editor panels">
        <button
          type="button"
          className={panelTab === "rules" ? "is-active" : ""}
          onClick={() => setPanelTab("rules")}
        >
          <ListChecks size={15} /> Route Rules
        </button>
        <button
          type="button"
          className={panelTab === "dns" ? "is-active" : ""}
          onClick={() => setPanelTab("dns")}
        >
          <ServerCog size={15} /> DNS Rules
        </button>
        <button
          type="button"
          className={panelTab === "json" ? "is-active" : ""}
          onClick={() => setPanelTab("json")}
        >
          <Braces size={15} /> JSON
        </button>
        <button
          type="button"
          className={panelTab === "diagnostics" ? "is-active" : ""}
          onClick={() => setPanelTab("diagnostics")}
        >
          <FileCheck2 size={15} /> Diagnostics
        </button>
      </nav>

      <div className="panel-content">
        {panelTab === "rules" ? <RouteRulesTable /> : null}
        {panelTab === "dns" ? <DnsRulesTable /> : null}
        {panelTab === "json" ? (
          <section className="json-panel" aria-label="JSON Preview">
            <div className="table-panel__header">
              <div>
                <h2>JSON Preview</h2>
                <p>Canonical sing-box config. Layout metadata is never exported.</p>
              </div>
              <div className="inline-actions">
                <button type="button" onClick={refreshJson}>
                  Refresh
                </button>
                <button type="button" onClick={applyJsonDraft}>
                  Apply JSON
                </button>
              </div>
            </div>
            <textarea
              aria-label="Advanced JSON editor"
              spellCheck={false}
              value={jsonDraft}
              onChange={(event) => setJsonDraft(event.target.value)}
            />
          </section>
        ) : null}
        {panelTab === "diagnostics" ? (
          <section className="diagnostics-panel" aria-label="Diagnostics">
            <div className="table-panel__header">
              <div>
                <h2>Diagnostics</h2>
                <p>{officialValidationMessage}</p>
              </div>
            </div>
            <div className="diagnostic-list">
              {diagnostics.length === 0 ? (
                <div className="diagnostic diagnostic--valid">Semantic validation passed.</div>
              ) : (
                diagnostics.map((diagnostic) => (
                  <div className={`diagnostic diagnostic--${diagnostic.level}`} key={`${diagnostic.code}-${diagnostic.path}`}>
                    <strong>{diagnostic.code}</strong>
                    <span>{diagnostic.path}</span>
                    <p>{diagnostic.message}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
