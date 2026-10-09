import { lazy, Suspense, useCallback, useState } from "react";
import { Home } from "./screens/Home";
import { MapScreen } from "./screens/MapScreen";
import { Play, type LevelResult } from "./screens/Play";
import { Results } from "./screens/Results";
import { setSoundEnabled } from "./sound";
import { findLevel } from "./game/worlds";

// Galería de ejercicios: solo en desarrollo (npm run dev → #galeria).
const Gallery = import.meta.env.DEV ? lazy(() => import("./screens/Gallery")) : null;

/** Permite abrir un nivel directo con un link: …/#nivel=3-2 */
function initialScreen(): Screen {
  const m = location.hash.match(/nivel=(\d-[\dJj])/);
  if (m) {
    const id = m[1].toUpperCase();
    if (findLevel(id)) return { name: "play", levelId: id, run: 0 };
  }
  return { name: "home" };
}

type Screen = { name: "home" } | { name: "map" } | { name: "play"; levelId: string; run: number } | { name: "results"; result: LevelResult };

// El progreso vive solo mientras la página está abierta (no se guarda nada).
export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [coins, setCoins] = useState(0);
  const [best, setBest] = useState<Record<string, number>>({});
  const [sound, setSoundState] = useState(true);
  const [run, setRun] = useState(0);

  const setSound = useCallback((v: boolean) => {
    setSoundEnabled(v);
    setSoundState(v);
  }, []);

  const play = useCallback(
    (levelId: string) => {
      setRun((r) => r + 1);
      setScreen({ name: "play", levelId, run: run + 1 });
      window.scrollTo({ top: 0 });
    },
    [run],
  );

  const finish = useCallback((result: LevelResult) => {
    setCoins((c) => c + result.coins);
    if (!result.lost) setBest((b) => ({ ...b, [result.levelId]: Math.max(b[result.levelId] ?? 0, result.pizzas) }));
    setScreen({ name: "results", result });
    window.scrollTo({ top: 0 });
  }, []);

  if (Gallery && location.hash === "#galeria") {
    return (
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
    );
  }

  switch (screen.name) {
    case "home":
      return <Home onStart={() => setScreen({ name: "map" })} />;
    case "map":
      return <MapScreen coins={coins} best={best} sound={sound} setSound={setSound} onPlay={play} onHome={() => setScreen({ name: "home" })} />;
    case "play":
      return (
        <Play
          key={screen.run}
          levelId={screen.levelId}
          onExit={() => {
            if (location.hash) history.replaceState(null, "", location.pathname + location.search);
            setScreen({ name: "map" });
          }}
          onFinish={finish}
        />
      );
    case "results":
      return (
        <Results
          result={screen.result}
          onAgain={() => play(screen.result.levelId)}
          onNext={(id) => play(id)}
          onMap={() => setScreen({ name: "map" })}
        />
      );
  }
}
