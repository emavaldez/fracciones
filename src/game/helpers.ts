import { Fraction, F, gcd } from "../math/fraction";
import { N, fr, row, type Expr } from "../math/expr";
import type { Rng } from "../math/rng";
import type { GenEntry, Generator, Question, Step } from "./types";

/** Fracción en línea para usar dentro de textos: "{3/4}". */
export function ft(f: Fraction | number, d?: number): string {
  if (typeof f === "number") {
    if (d === undefined || d === 1) return `${f}`;
    return `{${f}/${d}}`;
  }
  return f.d === 1 ? `${f.n}` : `{${f.n}/${f.d}}`;
}

/** Igual que ft, pero entre paréntesis si es negativa (para escribir "3 + (−1/2)"). */
export function ftp(f: Fraction): string {
  return f.n < 0 ? `(${ft(f)})` : ft(f);
}

export function gen(id: string, make: Generator): GenEntry {
  return {
    id,
    make: (r) => {
      const q = make(r);
      q.gen = id;
      if (q.followUp) q.followUp.gen = id;
      return q;
    },
  };
}

/** Pasos para simplificar n/d (escrito sin reducir). Vacío si ya es irreducible. */
export function simplifySteps(n: number, d: number): Step[] {
  const g = gcd(n, d);
  if (g === 1) return [];
  const f = F(n, d);
  return [
    {
      text: `Simplificamos: ${Math.abs(n)} y ${d} se pueden dividir por ${g}.`,
      math: row(N(n, d), "=", fr(f)),
    },
  ];
}

/** "n/d = reducida" si se puede simplificar, o solo n/d. */
export function withSimplify(n: number, d: number): Expr[] {
  const g = gcd(n, d);
  if (g === 1 || d === 0) return [N(n, d)];
  return [N(n, d), fr(F(n, d))];
}

/** Arma una fila "a = b = c" sin repetir pasos iguales. */
export function chain(...items: Expr[]): Expr {
  const parts: (Expr | "=")[] = [];
  let last = "";
  for (const it of items) {
    const key = JSON.stringify(it);
    if (key === last) continue;
    if (parts.length) parts.push("=");
    parts.push(it);
    last = key;
  }
  return row(...parts);
}

const DEN_NAMES: Record<number, [string, string]> = {
  2: ["medio", "medios"],
  3: ["tercio", "tercios"],
  4: ["cuarto", "cuartos"],
  5: ["quinto", "quintos"],
  6: ["sexto", "sextos"],
  7: ["séptimo", "séptimos"],
  8: ["octavo", "octavos"],
  9: ["noveno", "novenos"],
  10: ["décimo", "décimos"],
};

/** "3 cuartos", "1 tercio", "5 porciones de 12" */
export function denName(count: number, d: number): string {
  const names = DEN_NAMES[d];
  if (!names) return `${count} ${count === 1 ? "porción" : "porciones"} de ${d}`;
  return `${count} ${count === 1 ? names[0] : names[1]}`;
}

/** "1 pizza entera" / "3 pizzas enteras" y similares. */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export const DENS_EASY = [2, 3, 4, 5, 6, 8, 10];
export const DENS_MED = [2, 3, 4, 5, 6, 8, 9, 10, 12];

/** Fracción propia irreducible con denominador de la lista. */
export function properFrac(r: Rng, dens = DENS_MED): Fraction {
  for (;;) {
    const d = r.pick(dens);
    const n = r.int(1, d - 1);
    if (gcd(n, d) === 1) return F(n, d);
  }
}

/** Fracción irreducible (puede ser impropia) con numerador hasta maxN. */
export function anyFrac(r: Rng, dens = DENS_MED, maxN = 12): Fraction {
  for (;;) {
    const d = r.pick(dens);
    const n = r.int(1, maxN);
    if (gcd(n, d) === 1 && n !== d) return F(n, d);
  }
}

/** ¿Es "linda" para mostrar como resultado? */
export function nice(f: Fraction, maxD = 60, maxN = 120) {
  return f.d <= maxD && Math.abs(f.n) <= maxN;
}

/** Repite un generador hasta que cumpla una condición. */
export function retry<T>(make: () => T | null, tries = 200): T {
  for (let i = 0; i < tries; i++) {
    const v = make();
    if (v !== null) return v;
  }
  throw new Error("No se pudo generar el ejercicio");
}

export const opName = { "+": "suma", "-": "resta", "·": "multiplicación", ":": "división" } as const;

/** Mezcla trampas y quita las que coinciden con la respuesta correcta. */
export function cleanTraps(correct: Fraction | number, traps: { value: Fraction | number; msg: string }[]) {
  const eq = (a: Fraction | number, b: Fraction | number) => {
    const fa = typeof a === "number" ? F(a) : a;
    const fb = typeof b === "number" ? F(b) : b;
    return fa.equals(fb);
  };
  const out: { value: Fraction | number; msg: string }[] = [];
  for (const t of traps) {
    if (eq(t.value, correct)) continue;
    if (out.some((o) => eq(o.value, t.value))) continue;
    out.push(t);
  }
  return out;
}

export type { Question };
