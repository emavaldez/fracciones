import type { Rng } from "../math/rng";
import type { GenEntry, Level, Question } from "./types";

export function signature(q: Question): string {
  const a = q.answer;
  const val = a.kind === "choice" ? `c${a.correct}:${a.options.length}` : String(a.value);
  return JSON.stringify([q.title, q.story ?? "", q.math ?? null, q.pizzas ?? null, val]);
}

/** Arma la lista de comandas de un nivel, alternando generadores y sin repetir ejercicios. */
export function buildQueue(level: Level, rng: Rng): Question[] {
  const out: Question[] = [];
  const seen = new Set<string>();
  let order: GenEntry[] = [];
  let last = "";
  for (let guard = 0; out.length < level.count && guard < 400; guard++) {
    if (!order.length) {
      order = rng.shuffle(level.gens);
      if (order.length > 1 && order[0].id === last) order.push(order.shift()!);
    }
    const g = order.shift()!;
    const q = g.make(rng);
    const sig = signature(q);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(q);
    last = g.id;
  }
  return out;
}

/** Una comanda parecida (mismo generador) para la revancha. */
export function similar(level: Level, genId: string, rng: Rng, avoid: Set<string>): Question | null {
  const g = level.gens.find((x) => x.id === genId);
  if (!g) return null;
  for (let i = 0; i < 30; i++) {
    const q = g.make(rng);
    const sig = signature(q);
    if (!avoid.has(sig)) return q;
  }
  return null;
}
