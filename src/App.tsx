import { CanvasWorkspace } from "./components/CanvasWorkspace";
import { Inspector } from "./components/Inspector";
import { MobileInspectorSheet } from "./components/MobileInspectorSheet";
import { MobileTopBar } from "./components/MobileTopBar";
import { Palette } from "./components/Palette";
import { TopBar } from "./components/TopBar";
import { useViewport } from "./components/useViewport";
import "./styles.css";

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
        <Palette />
        <CanvasWorkspace />
        <Inspector />
      </main>
    </div>
  );
}
