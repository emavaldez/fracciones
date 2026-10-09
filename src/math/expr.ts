// Pequeño árbol de expresiones para DIBUJAR matemática (no para calcular).
// Los generadores arman estas expresiones y el componente <MathView> las dibuja
// con fracciones apiladas, potencias, raíces, periódicos, etc.

import { Fraction } from "./fraction";

export type Op = "+" | "-" | "·" | ":" | "=" | "≠" | "<" | ">" | "→" | "⇒";

export type Expr =
  | { t: "num"; n: number; d: number }
  | { t: "frac"; n: Expr; d: Expr }
  | { t: "dec"; s: string }
  | { t: "per"; neg?: boolean; int: string; ante: string; period: string }
  | { t: "mixed"; neg?: boolean; w: number; n: number; d: number }
  | { t: "var"; name: string }
  | { t: "row"; parts: (Expr | { op: Op })[] }
  | { t: "paren"; x: Expr; kind: "(" | "[" }
  | { t: "pow"; b: Expr; e: Expr }
  | { t: "root"; k: number; x: Expr }
  | { t: "coef"; c: Expr; x: Expr }
  | { t: "neg"; x: Expr }
  | { t: "q"; small?: boolean }
  | { t: "text"; s: string }
  | { t: "hl"; x: Expr; tone?: "a" | "b" | "bad" };

const OPS = new Set(["+", "-", "·", ":", "=", "≠", "<", ">", "→", "⇒"]);

// ---------- Constructores ----------

/** Número escrito tal cual: N(18, 24) se dibuja 18/24 (sin simplificar). */
export const N = (n: number, d = 1): Expr => ({ t: "num", n, d });
/** Fracción ya calculada. */
export const fr = (f: Fraction): Expr => ({ t: "num", n: f.n, d: f.d });
/** Fracción con numerador y denominador arbitrarios: frac(row(3,"·",4), Q()). */
export const frac = (n: Expr | number, d: Expr | number): Expr => ({
  t: "frac",
  n: typeof n === "number" ? N(n) : n,
  d: typeof d === "number" ? N(d) : d,
});
export const X: Expr = { t: "var", name: "x" };
export const Q = (small = false): Expr => ({ t: "q", small });
export const txt = (s: string): Expr => ({ t: "text", s });
export const dec = (s: string): Expr => ({ t: "dec", s });
export const neg = (x: Expr): Expr => ({ t: "neg", x });
export const hl = (x: Expr, tone: "a" | "b" | "bad" = "a"): Expr => ({ t: "hl", x, tone });
export const par = (x: Expr, kind: "(" | "[" = "("): Expr => ({ t: "paren", x, kind });
export const pow = (b: Expr, e: number | Expr): Expr => ({
  t: "pow",
  b,
  e: typeof e === "number" ? N(e) : e,
});
export const root = (k: number, x: Expr): Expr => ({ t: "root", k, x });

export function row(...parts: (Expr | Op | string)[]): Expr {
  return {
    t: "row",
    parts: parts.map((p) => (typeof p === "string" ? (OPS.has(p) ? { op: p as Op } : txt(p)) : p)),
  };
}

/** Término "c·x": (2/3)x, x, −x, 5x… */
export function coef(c: Fraction, name = "x"): Expr {
  const v: Expr = { t: "var", name };
  if (c.equals(new Fraction(1))) return v;
  if (c.equals(new Fraction(-1))) return neg(v);
  return { t: "coef", c: fr(c), x: v };
}

/** Número mixto a partir de una fracción impropia. */
export function mixedOf(f: Fraction): Expr {
  const negv = f.n < 0;
  const a = Math.abs(f.n);
  const w = Math.floor(a / f.d);
  const r = a % f.d;
  if (r === 0) return N(negv ? -w : w);
  if (w === 0) return fr(f);
  return { t: "mixed", neg: negv, w, n: r, d: f.d };
}

export function mixed(w: number, n: number, d: number, negv = false): Expr {
  return { t: "mixed", neg: negv, w, n, d };
}

// ---------- Texto plano (para accesibilidad y para tests) ----------

export function toText(e: Expr): string {
  switch (e.t) {
    case "num":
      return e.d === 1 ? `${e.n}` : `${e.n}/${e.d}`;
    case "frac":
      return `(${toText(e.n)})/(${toText(e.d)})`;
    case "dec":
      return e.s;
    case "per":
      return `${e.neg ? "-" : ""}${e.int},${e.ante}(${e.period})`;
    case "mixed":
      return `${e.neg ? "-" : ""}${e.w} ${e.n}/${e.d}`;
    case "var":
      return e.name;
    case "row":
      return e.parts
        .map((p, i) => {
          if ("op" in p) return ` ${p.op} `;
          const prev = e.parts[i - 1];
          const wrap = prev && "op" in prev && ["+", "-", "·", ":"].includes(prev.op) && isNegativeAtom(p);
          return wrap ? `(${toText(p)})` : toText(p);
        })
        .join("");
    case "paren":
      return e.kind === "(" ? `(${toText(e.x)})` : `[${toText(e.x)}]`;
    case "pow":
      return `${wrapBase(e.b)}^${toText(e.e)}`;
    case "root":
      return `${e.k === 2 ? "√" : e.k === 3 ? "∛" : `raíz ${e.k}`}(${toText(e.x)})`;
    case "coef":
      return `${toText(e.c)}${toText(e.x)}`;
    case "neg":
      return `-${toText(e.x)}`;
    case "q":
      return "?";
    case "text":
      return e.s;
    case "hl":
      return toText(e.x);
  }
}

function wrapBase(b: Expr) {
  const s = toText(b);
  return needsBaseParens(b) ? `(${s})` : s;
}

/** ¿La base de una potencia necesita paréntesis? (fracciones, negativos, filas) */
export function needsBaseParens(b: Expr): boolean {
  if (b.t === "hl") return needsBaseParens(b.x);
  if (b.t === "num") return b.d !== 1 || b.n < 0;
  if (b.t === "frac") return true;
  if (b.t === "mixed" || b.t === "row" || b.t === "neg" || b.t === "coef" || b.t === "dec" || b.t === "per") return true;
  return false;
}

/** ¿Un operando negativo que aparece después de un operador necesita paréntesis? */
export function isNegativeAtom(e: Expr): boolean {
  if (e.t === "hl") return isNegativeAtom(e.x);
  if (e.t === "num") return e.n < 0;
  if (e.t === "dec") return e.s.startsWith("-");
  if (e.t === "mixed" || e.t === "per") return !!e.neg;
  if (e.t === "neg") return true;
  if (e.t === "coef") return isNegativeAtom(e.c);
  return false;
}
