import { useEffect } from "react";
import { PizzaRating } from "../components/PizzaRating";
import { Confetti } from "../components/Confetti";
import { findLevel, nextLevel } from "../game/worlds";
import type { LevelResult } from "./Play";
import { sfx } from "../sound";
import { useLook } from "../look";

export function Results({ result, onAgain, onNext, onMap }: { result: LevelResult; onAgain: () => void; onNext: (id: string) => void; onMap: () => void }) {
  const { level, world } = findLevel(result.levelId)!;
  const nxt = nextLevel(result.levelId);
  const boss = level.boss;
  const choco = useLook() === "choco";

  useEffect(() => {
    if (result.lost) sfx.lose();
    else sfx.win();
  }, [result.lost]);

  const title = result.lost
    ? `${boss?.name ?? "El cliente"} se fue sin pagar`
    : boss
      ? `¡Convenciste ${boss.name.startsWith("El ") ? "al " + boss.name.slice(3) : "a " + boss.name}!`
      : result.pizzas === 3
        ? "¡Turno perfecto!"
        : "¡Turno terminado!";

  const message = result.lost
    ? "Te quedaste sin vidas. Mirá la receta del sector y volvé a intentarlo: cada vez salen comandas nuevas."
    : result.pizzas === 3
      ? "La cocina funciona como un reloj."
      : result.pizzas === 2
        ? `Muy bien. Con un par de errores menos llegás a ${choco ? "los tres chocolates" : "las tres pizzas"}.`
        : `Lo terminaste. Probá de nuevo para sumar ${choco ? "chocolates" : "pizzas"}: los ejercicios cambian cada vez.`;

  return (
    <div className="screen results">
      {!result.lost && result.pizzas >= 2 && <Confetti />}
      <div className="results-card">
        <p className="results-kicker">
          {world.place} · {boss ? "Jefe" : `Nivel ${level.id.replace("-", ".")}`}
        </p>
        <h1 className="sign sign-md">{title}</h1>
        {!result.lost && <PizzaRating value={result.pizzas} size={56} />}
        <p className="results-msg">{message}</p>
        <dl className="results-stats">
          <div>
            <dt>Comandas bien</dt>
            <dd>
              {result.correct} de {result.served}
            </dd>
          </div>
          <div>
            <dt>Propinas</dt>
            <dd>${result.coins}</dd>
          </div>
          <div>
            <dt>Mejor racha</dt>
            <dd>{result.bestStreak}</dd>
          </div>
        </dl>
        <div className="results-actions">
          {!result.lost && nxt && (
            <button type="button" className="btn btn-primary btn-big btn-block" onClick={() => onNext(nxt.id)}>
              {nxt.boss ? `Siguiente: ${nxt.boss.name} (jefe)` : `Siguiente: ${nxt.name}`}
            </button>
          )}
          <button type="button" className={`btn ${result.lost || !nxt ? "btn-primary btn-big" : "btn-ghost"} btn-block`} onClick={onAgain}>
            {result.lost ? "Intentar de nuevo" : "Jugar otra vez este nivel"}
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={onMap}>
            Volver al mapa
          </button>
        </div>
      </div>
    </div>
  );
}
