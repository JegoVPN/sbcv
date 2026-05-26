import { CanvasWorkspace } from "./components/CanvasWorkspace";
import { Inspector } from "./components/Inspector";
import { Palette } from "./components/Palette";
import { TopBar } from "./components/TopBar";
import "./styles.css";

export function App() {
  return (
    <div className="app-shell">
      <TopBar />
      <main className="workspace">
        <Palette />
        <CanvasWorkspace />
        <Inspector />
      </main>
    </div>
  );
}
