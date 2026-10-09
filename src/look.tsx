// Cómo se ven las cosas: con pizzas o con chocolates.
// Cambia los dibujos de fracciones, los íconos de puntaje y de vidas, y las palabras de las
// consignas que hablan de esos dibujos ("pizza" → "tableta").
import { createContext, useContext } from "react";
import type { Question } from "./game/types";

export type Look = "pizza" | "choco";

export const LookContext = createContext<Look>("pizza");
export const useLook = () => useContext(LookContext);

const KEY = "fraccion-look";

/** Lo único que se recuerda entre visitas (si el navegador lo permite). */
export function loadLook(): Look {
  try {
    return localStorage.getItem(KEY) === "choco" ? "choco" : "pizza";
  } catch {
    return "pizza";
  }
}
export function saveLook(l: Look) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // sin almacenamiento: dura mientras la página está abierta
  }
}

export function LookToggle({ look, setLook }: { look: Look; setLook: (l: Look) => void }) {
  return (
    <div className="look-toggle" role="radiogroup" aria-label="Ver las fracciones con">
      <span className="look-label">Ver con</span>
      {(
        [
          ["pizza", "🍕", "Pizzas"],
          ["choco", "🍫", "Chocolates"],
        ] as const
      ).map(([id, emoji, name]) => (
        <button key={id} type="button" role="radio" aria-checked={look === id} className={`look-opt${look === id ? " is-on" : ""}`} onClick={() => setLook(id)}>
          <span aria-hidden="true">{emoji}</span> {name}
        </button>
      ))}
    </div>
  );
}

/** Nombre de los "premios" de cada nivel. */
export const prizeWord = (look: Look, n = 2) => (look === "choco" ? (n === 1 ? "chocolate" : "chocolates") : n === 1 ? "pizza" : "pizzas");

const SWAPS: [RegExp, string][] = [
  [/¿Cuánta pizza/g, "¿Cuánto chocolate"],
  [/\bPizzas\b/g, "Tabletas"],
  [/\bpizzas\b/g, "tabletas"],
  [/\bPizza\b/g, "Tableta"],
  [/\bpizza\b/g, "tableta"],
  [/\bse cortaron\b/g, "se dividieron"],
  [/\bse cortó\b/g, "se dividió"],
  [/\bse corta\b/g, "se divide"],
  [/\bcortadas\b/g, "divididas"],
  [/\bcortada\b/g, "dividida"],
];

export function chocoText(s: string): string {
  let out = s;
  for (const [re, to] of SWAPS) out = out.replace(re, to);
  return out;
}

/** En los sectores donde la pizza es lo que se reparte, la consigna pasa a hablar de tabletas. */
export function withLook(q: Question, look: Look): Question {
  if (look !== "choco" || !/^w[1-4]-/.test(q.gen)) return q;
  const t = (s: string | undefined) => (s === undefined ? s : chocoText(s));
  const a = q.answer;
  return {
    ...q,
    title: chocoText(q.title),
    story: t(q.story),
    rule: t(q.rule),
    hint: q.hint.map((h) => ({ ...h, text: t(h.text) })),
    steps: q.steps.map((h) => ({ ...h, text: t(h.text) })),
    traps: q.traps?.map((x) => ({ ...x, msg: chocoText(x.msg) })),
    answer: a.kind === "choice" ? { ...a, options: a.options.map((o) => ({ ...o, label: t(o.label), why: t(o.why) })) } : a,
    followUp: q.followUp ? withLook(q.followUp, look) : undefined,
  };
}
