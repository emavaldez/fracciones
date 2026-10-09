// Solo para desarrollo (#galeria): muestra un ejemplo de cada generador con su explicación.
import { MathView, RichText } from "../components/MathView";
import { OnePizza, Pizzas } from "../components/Pizza";
import { WORLDS } from "../game/worlds";
import { makeRng } from "../math/rng";
import type { GenEntry, Question } from "../game/types";

function Q({ q }: { q: Question }) {
  return (
    <div className="ticket" style={{ marginBottom: 18 }}>
      <p style={{ fontSize: 12, color: "#888", margin: 0 }}>{q.gen}</p>
      {q.story && (
        <p className="ticket-story">
          <RichText text={q.story} />
        </p>
      )}
      <h2 className="ticket-title">{q.title}</h2>
      {q.math && (
        <div className="ticket-math">
          <MathView e={q.math} size="lg" />
        </div>
      )}
      {q.pizzas && (
        <div className="ticket-pizzas">
          {q.pizzas.map((p, i) => (
            <Pizzas key={i} spec={p} size={90} />
          ))}
        </div>
      )}
      {q.answer.kind === "choice" && (
        <div className="choices">
          {q.answer.options.map((o, i) => (
            <div key={i} className={`choice${i === (q.answer as { correct: number }).correct ? " is-right" : ""}`}>
              {o.label && <span className="choice-label">{o.label}</span>}
              {o.math && <MathView e={o.math} size="md" />}
              {o.pizza && <OnePizza slices={o.pizza.slices} filled={o.pizza.filled} size={60} />}
            </div>
          ))}
        </div>
      )}
      <p>
        <b>Respuesta:</b> {q.answer.kind === "choice" ? q.answer.correct : String(q.answer.value)} ({q.answer.kind})
      </p>
      <ol className="steps">
        {q.steps.map((s, i) => (
          <li key={i}>
            {s.text && (
              <p>
                <RichText text={s.text} />
              </p>
            )}
            {s.math && (
              <div className="steps-math">
                <MathView e={s.math} size="sm" />
              </div>
            )}
          </li>
        ))}
      </ol>
      {q.followUp && <Q q={q.followUp} />}
    </div>
  );
}

export default function Gallery() {
  const seen = new Set<string>();
  const gens: GenEntry[] = [];
  for (const w of WORLDS) for (const l of w.levels) for (const g of l.gens) if (!seen.has(g.id)) (seen.add(g.id), gens.push(g));
  const seed = Number(new URLSearchParams(location.search).get("seed") ?? 7);
  return (
    <div className="screen">
      {gens.map((g, i) => (
        <Q key={g.id} q={g.make(makeRng(seed + i))} />
      ))}
    </div>
  );
}
