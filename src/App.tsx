import { Suspense, lazy } from "react";
import { CanvasWorkspace } from "./components/CanvasWorkspace";
import { Inspector } from "./components/Inspector";
import { MobileInspectorSheet } from "./components/MobileInspectorSheet";
import { MobileTopBar } from "./components/MobileTopBar";
import { TopBar } from "./components/TopBar";
import { useViewport } from "./components/useViewport";
import "./styles.css";

// Code-split the desktop Palette so its chunk (icons + the full node catalog) is NOT in the main
// bundle — the mobile shell never renders it (the node-add path lazy-loads it via MobileNodeSheet
// instead), so mobile no longer downloads the Palette on first load. (L4-mobile-palette-defer / A25-rest)
const Palette = lazy(() => import("./components/Palette").then((m) => ({ default: m.Palette })));

export function App() {
  const { isMobile } = useViewport();

  if (isMobile) {
    return (
      <div className="app-shell app-shell--mobile" data-testid="app-mobile">
        <MobileTopBar />
        <main className="workspace workspace--mobile">
          <CanvasWorkspace />
        </main>
        <MobileInspectorSheet />
      </div>
    );
  }

  return (
    <div className="app-shell" data-testid="app-desktop">
      <TopBar />
      <main className="workspace">
        <Suspense fallback={<aside className="palette" aria-hidden="true" data-testid="palette-loading" />}>
          <Palette />
        </Suspense>
        <CanvasWorkspace />
        <Inspector />
      </main>
    </div>
  );
}
