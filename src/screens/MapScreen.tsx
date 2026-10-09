import { useEffect, useRef, useState } from "react";
import { RECIPES } from "../game/recipes";
import type { World } from "../game/types";
import { MathView, RichText } from "../components/MathView";
import { PizzaRating } from "../components/PizzaRating";
import { NumberLine } from "../components/NumberLine";
import { LookToggle, TEXTS, prizeWord, themedWorlds, type Look } from "../look";

export function rankFor(coins: number, look: Look) {
  const ranks = TEXTS[look].ranks;
  let r = ranks[0][1];
  for (const [min, name] of ranks) if (coins >= min) r = name;
  return r;
}

function Sheet({ onClose, children, label }: { onClose: () => void; children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn sheet-close" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
        <div className="sheet-scroll">{children}</div>
      </div>
    </div>
  );
}

function RecipeView({ world }: { world: World }) {
  return (
    <div className="recipe">
      <h2 className="sign sign-sm">Receta de {world.place}</h2>
      <p className="recipe-topic">{world.topic}</p>
      <ul className="recipe-list">
        {RECIPES[world.id].map((it, i) => (
          <li key={i}>
            <p>
              <RichText text={it.text} />
            </p>
            {it.math && (
              <div className="recipe-math">
                <MathView e={it.math} size="sm" />
              </div>
            )}
            {it.line && (
              <div className="recipe-line">
                <NumberLine spec={it.line} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MapScreen({
  coins,
  best,
  sound,
  setSound,
  onPlay,
  onHome,
  look,
  setLook,
}: {
  look: Look;
  setLook: (l: Look) => void;
  coins: number;
  best: Record<string, number>;
  sound: boolean;
  setSound: (v: boolean) => void;
  onPlay: (levelId: string) => void;
  onHome: () => void;
}) {
  const [open, setOpen] = useState<World | null>(null);
  const [recipe, setRecipe] = useState(false);

  return (
    <div className="screen map">
      <header className="map-top">
        <button type="button" className="map-brand" onClick={onHome} aria-label="Volver a la portada">
          <span className="sign sign-sm">La Fracción</span>
        </button>
        <div className="map-stats">
          <span className="map-rank">{rankFor(coins, look)}</span>
          <span className="coins" aria-label={`Propinas: ${coins} pesos`}>
            <span className="coin" aria-hidden="true">$</span>
            {coins}
          </span>
          <button type="button" className="icon-btn" onClick={() => setSound(!sound)} aria-label={sound ? "Apagar sonido" : "Prender sonido"} aria-pressed={sound}>
            {sound ? (
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M4 9h4l5-4v14l-5-4H4z" className="ico-solid" />
                <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" className="ico-line" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M4 9h4l5-4v14l-5-4H4z" className="ico-solid" />
                <path d="M16 9l5 6M21 9l-5 6" className="ico-line" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <p className="map-intro">{TEXTS[look].mapIntro}</p>
      <div className="map-look">
        <LookToggle look={look} setLook={setLook} />
      </div>

      <ol className="route">
        {themedWorlds(look).map((w, i) => {
          const got = w.levels.reduce((s, l) => s + (best[l.id] ?? 0), 0);
          const max = w.levels.length * 3;
          return (
            <li key={w.id} className={`stop stop-${i % 2 === 0 ? "l" : "r"}`}>
              <button type="button" className="stop-btn" onClick={() => setOpen(w)}>
                <span className="stop-plate" aria-hidden="true">
                  <span className="stop-emoji">{w.emoji}</span>
                </span>
                <span className="stop-text">
                  <span className="stop-num">Sector {i + 1}</span>
                  <span className="stop-name">{w.place}</span>
                  <span className="stop-topic">{w.topic}</span>
                  {got > 0 && <span className="stop-score">{got} de {max} {prizeWord(look)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {open && !recipe && (
        <Sheet onClose={() => setOpen(null)} label={open.place}>
          <div className="world-head">
            <span className="world-emoji" aria-hidden="true">
              {open.emoji}
            </span>
            <div>
              <h2 className="sign sign-sm">{open.place}</h2>
              <p className="world-topic">{open.topic}</p>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-block recipe-btn" onClick={() => setRecipe(true)}>
            Leer la receta (la teoría con ejemplos)
          </button>
          <ul className="levels">
            {open.levels.map((l) => (
              <li key={l.id}>
                <button type="button" className={`level${l.boss ? " is-boss" : ""}`} onClick={() => onPlay(l.id)}>
                  <span className="level-badge" aria-hidden="true">
                    {l.boss ? l.boss.emoji : l.id.split("-")[1]}
                  </span>
                  <span className="level-text">
                    <span className="level-name">{l.boss ? `Jefe: ${l.boss.name}` : l.name}</span>
                    <span className="level-about">{l.boss ? "Todo el sector mezclado, con 3 vidas" : l.about}</span>
                  </span>
                  {best[l.id] ? <PizzaRating value={best[l.id]} size={18} /> : <span className="level-go">Jugar</span>}
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
      {open && recipe && (
        <Sheet onClose={() => setRecipe(false)} label={`Receta de ${open.place}`}>
          <RecipeView world={open} />
          <button type="button" className="btn btn-primary btn-block" onClick={() => setRecipe(false)}>
            Volver a los niveles
          </button>
        </Sheet>
      )}
    </div>
  );
}
