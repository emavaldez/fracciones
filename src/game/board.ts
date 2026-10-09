// Mesa de ecuaciones: el jugador despeja x paso a paso.
// Lógica pura (sin React) para poder probarla con miles de ecuaciones.
import { F, Fraction } from "../math/fraction";
import { N, X, fr, neg, par, pow, root, row, type Expr } from "../math/expr";
import { cleanTraps, ft } from "./helpers";
import { opSteps, opTraps, type COp } from "./opcheck";
import { powSteps } from "./gen/w5";
import { rootSteps } from "./gen/w6";
import type { Step, Trap } from "./types";

export type SideKey = "L" | "R";
export const other = (s: SideKey): SideKey => (s === "L" ? "R" : "L");
export const sideName = (s: SideKey) => (s === "L" ? "izquierda" : "derecha");

// ---------- Datos ----------

export interface TermSpec {
  c: Fraction;
  x?: boolean;
  /** x : div */
  div?: Fraction;
  /** x elevado a pow (2, 3 o −1) */
  pow?: number;
  /** raíz de índice root de x */
  root?: number;
}
export interface SideSpec {
  /** Número que multiplica a todo el lado: factor · ( … ) */
  factor?: Fraction;
  terms: TermSpec[];
}
export interface BoardSpec {
  L: SideSpec;
  R: SideSpec;
}

export interface BTerm {
  id: number;
  c: Fraction;
  x: boolean;
  div?: Fraction;
  pow?: number;
  root?: number;
}
export interface BSide {
  factor?: Fraction;
  terms: BTerm[];
}
export interface BEq {
  L: BSide;
  R: BSide;
  next: number;
}

const ONE = F(1);

export function makeEq(spec: BoardSpec): BEq {
  let next = 1;
  const side = (s: SideSpec): BSide => ({
    factor: s.factor && !s.factor.equals(ONE) ? s.factor : undefined,
    terms: s.terms.map((t) => ({
      id: next++,
      c: t.c,
      x: !!(t.x || t.div || t.pow || t.root),
      div: t.div,
      pow: t.pow,
      root: t.root,
    })),
  });
  const L = side(spec.L);
  const R = side(spec.R);
  return { L, R, next };
}

/** Atajos para armar ecuaciones en los generadores. */
export const tx = (c: Fraction): TermSpec => ({ c, x: true });
export const tn = (c: Fraction): TermSpec => ({ c });

export const isConst = (t: BTerm) => !t.x;
export const isPlainX = (t: BTerm) => t.x && !t.div && !t.pow && !t.root;
export const isSpecial = (t: BTerm) => !!(t.pow || t.root);

export function findTerm(eq: BEq, side: SideKey, id: number) {
  return eq[side].terms.find((t) => t.id === id);
}

// ---------- Valor (para verificar) ----------

export function termValue(t: BTerm, x: Fraction): Fraction | null {
  if (!t.x) return t.c;
  if (t.pow) return x.isZero() && t.pow < 0 ? null : t.c.mul(x.pow(t.pow));
  if (t.root) {
    const r = x.root(t.root);
    return r ? t.c.mul(r) : null;
  }
  if (t.div) return t.c.mul(x.div(t.div));
  return t.c.mul(x);
}

export function sideValue(s: BSide, x: Fraction): Fraction | null {
  let acc = F(0);
  for (const t of s.terms) {
    const v = termValue(t, x);
    if (!v) return null;
    acc = acc.add(v);
  }
  return s.factor ? acc.mul(s.factor) : acc;
}

export function holds(eq: BEq, x: Fraction): boolean {
  const l = sideValue(eq.L, x);
  const r = sideValue(eq.R, x);
  return !!l && !!r && l.equals(r);
}

/** Si la ecuación ya quedó "x = número" (o "número = x"), devuelve el número. */
export function solvedValue(eq: BEq): Fraction | null {
  for (const s of ["L", "R"] as SideKey[]) {
    const a = eq[s];
    const b = eq[other(s)];
    if (a.factor || b.factor) continue;
    if (a.terms.length === 1 && isPlainX(a.terms[0]) && a.terms[0].c.equals(ONE)) {
      if (b.terms.length === 0) return F(0);
      if (b.terms.length === 1 && isConst(b.terms[0])) return b.terms[0].c;
    }
  }
  return null;
}

// ---------- Mostrar ----------

/** El término sin signo (para dibujarlo después de un + o un −). */
export function termAbsExpr(t: BTerm): Expr {
  const a = t.c.abs();
  if (!t.x) return fr(a);
  let core: Expr = X;
  if (t.pow) core = pow(X, t.pow);
  else if (t.root) core = root(t.root, X);
  else if (t.div) return row(X, ":", fr(t.div));
  if (a.equals(ONE)) return core;
  return { t: "coef", c: fr(a), x: core };
}

export function termsExpr(terms: BTerm[]): Expr {
  if (!terms.length) return N(0);
  const parts: (Expr | "+" | "-")[] = [];
  terms.forEach((t, i) => {
    const negv = t.c.n < 0;
    if (i === 0) parts.push(negv ? (t.x ? neg(termAbsExpr(t)) : fr(t.c)) : termAbsExpr(t));
    else parts.push(negv ? "-" : "+", termAbsExpr(t));
  });
  return parts.length === 1 ? (parts[0] as Expr) : row(...parts);
}

export function sideExpr(s: BSide): Expr {
  return s.factor ? row(fr(s.factor), "·", par(termsExpr(s.terms))) : termsExpr(s.terms);
}

export function eqExpr(eq: BEq): Expr {
  return row(sideExpr(eq.L), "=", sideExpr(eq.R));
}

const SUP: Record<string, string> = { "2": "²", "3": "³", "-1": "⁻¹" };

/** Texto del término para las explicaciones (con fracciones {a/b}). */
export function termText(t: BTerm, signed = true): string {
  const c = signed ? t.c : t.c.abs();
  if (!t.x) return ft(c);
  let core = "x";
  if (t.pow) core = `x${SUP[String(t.pow)] ?? "^" + t.pow}`;
  else if (t.root) core = t.root === 2 ? "√x" : `${t.root}√x`;
  else if (t.div) return `x : ${ft(t.div)}`;
  if (c.equals(ONE)) return core;
  if (c.equals(F(-1))) return "−" + core;
  return `${ft(c)}${core}`;
}

// ---------- Movimientos ----------

export type Action =
  | { kind: "move"; from: SideKey; id: number }
  | { kind: "coef"; from: SideKey; id: number }
  | { kind: "divisor"; from: SideKey; id: number }
  | { kind: "special"; from: SideKey; id: number }
  | { kind: "factor"; from: SideKey }
  | { kind: "distribute"; side: SideKey }
  | { kind: "combine"; side: SideKey; a: number; b: number };

export interface ActionOption {
  action: Action;
  label: string;
  primary?: boolean;
}

export type Target = number | "factor";

function likeTerms(s: BSide, t: BTerm) {
  return s.terms.filter((u) => u.id !== t.id && (isConst(t) ? isConst(u) : isPlainX(t) && isPlainX(u)));
}

/** El término semejante más cercano (el siguiente, o si no el anterior). */
export function nearestLike(s: BSide, t: BTerm): BTerm | undefined {
  const i = s.terms.findIndex((u) => u.id === t.id);
  const like = likeTerms(s, t);
  return like.find((u) => s.terms.indexOf(u) > i) ?? like[like.length - 1];
}

function specialLabel(t: BTerm) {
  if (t.pow === -1) return "Pasar el exponente −1 al otro lado";
  if (t.pow) return "Pasar el exponente al otro lado";
  return "Pasar la raíz al otro lado";
}

/** Qué se puede hacer con lo que el jugador tocó. */
export function actionsFor(eq: BEq, side: SideKey, target: Target): { options: ActionOption[]; note?: string } {
  const s = eq[side];
  if (target === "factor") {
    if (!s.factor) return { options: [] };
    return {
      options: [
        { action: { kind: "factor", from: side }, label: `Pasar el ${ft(s.factor)} al otro lado`, primary: true },
        { action: { kind: "distribute", side }, label: "Aplicar la distributiva" },
      ],
    };
  }
  const t = findTerm(eq, side, target);
  if (!t) return { options: [] };
  if (s.factor) {
    return {
      options: [],
      note: `Este término está adentro del paréntesis, y el ${ft(s.factor)} multiplica a todo. Primero tocá el ${ft(s.factor)} de afuera.`,
    };
  }
  const opts: ActionOption[] = [];
  const alone = s.terms.length === 1;
  if (t.x && alone) {
    if (isSpecial(t)) opts.push({ action: { kind: "special", from: side, id: t.id }, label: specialLabel(t), primary: true });
    else if (t.div) opts.push({ action: { kind: "divisor", from: side, id: t.id }, label: `Pasar el ${ft(t.div)} al otro lado`, primary: true });
    else if (!t.c.equals(ONE)) opts.push({ action: { kind: "coef", from: side, id: t.id }, label: `Pasar el ${ft(t.c)} al otro lado`, primary: true });
  }
  // x : d, x² y √x no se mueven enteros: se pasa lo que le hace algo a la x.
  if (!isSpecial(t) && !t.div) {
    const whole = t.x && alone && !t.c.equals(ONE);
    opts.push({ action: { kind: "move", from: side, id: t.id }, label: whole ? "Pasar todo el término al otro lado" : "Pasar al otro lado", primary: !opts.length });
  }
  const u = nearestLike(s, t);
  if (u) {
    opts.push({
      action: { kind: "combine", side, a: t.id, b: u.id },
      label: `Juntar con ${termText(u)}`,
    });
  }
  return { options: opts };
}

/** Si el movimiento no se puede hacer ahora, explica por qué. */
export function blockedReason(eq: BEq, a: Action): string | null {
  const needLoneConstOther = (from: SideKey, what: string): string | null => {
    const o = eq[other(from)];
    if (o.factor) return `Del otro lado hay un paréntesis. Primero sacá ese paréntesis.`;
    if (o.terms.some((t) => t.x)) return "Del otro lado también hay x. Primero llevá todas las x a un mismo lado.";
    if (o.terms.length > 1) return `Del otro lado hay más de un número. Primero juntalos en uno solo, y después pasá ${what}.`;
    return null;
  };
  switch (a.kind) {
    case "move": {
      const t = findTerm(eq, a.from, a.id);
      if (!t) return "Ese término ya no está.";
      if (eq[a.from].factor) return `Este término está adentro del paréntesis. Primero sacá el ${ft(eq[a.from].factor!)} de afuera.`;
      if (isSpecial(t)) return "Para despejar, pasá el exponente o la raíz al otro lado.";
      if (t.div) return `Para despejar, pasá el ${ft(t.div)} al otro lado.`;
      if (eq[other(a.from)].factor) return `Del otro lado hay un paréntesis multiplicado por ${ft(eq[other(a.from)].factor!)}. Primero sacá ese paréntesis.`;
      return null;
    }
    case "coef":
    case "divisor":
    case "special": {
      const t = findTerm(eq, a.from, a.id);
      if (!t) return "Ese término ya no está.";
      const s = eq[a.from];
      if (s.terms.length > 1) {
        const what = a.kind === "special" ? "el exponente" : `el ${ft(a.kind === "divisor" ? t.div! : t.c)}`;
        return `${what[0].toUpperCase() + what.slice(1)} afecta solo a la x, no a todo este lado. Primero dejá la x sola: pasá los otros términos al otro lado.`;
      }
      const why = needLoneConstOther(a.from, a.kind === "special" ? "el exponente" : `el ${ft(a.kind === "divisor" ? t.div! : t.c)}`);
      if (why) return why;
      if (a.kind === "special") {
        const k = eq[other(a.from)].terms[0]?.c ?? F(0);
        if (t.pow === -1 && k.isZero()) return "Ningún número tiene inverso 0: esta ecuación no tiene solución.";
        if (t.pow === 2 && k.n < 0) return "Ningún número al cuadrado da negativo: no tiene solución.";
      }
      return null;
    }
    case "factor":
      if (!eq[a.from].factor) return null;
      return needLoneConstOther(a.from, `el ${ft(eq[a.from].factor!)}`);
    case "distribute":
      return null;
    case "combine": {
      const s = eq[a.side];
      const ta = findTerm(eq, a.side, a.a);
      const tb = findTerm(eq, a.side, a.b);
      if (!ta || !tb || ta.id === tb.id) return "Elegí dos términos del mismo lado.";
      if (s.factor) return "Primero sacá el paréntesis.";
      const like = (isConst(ta) && isConst(tb)) || (isPlainX(ta) && isPlainX(tb));
      if (!like) return "Solo se pueden juntar números con números, o x con x.";
      return null;
    }
  }
}

// ---------- Elegir cómo pasa ----------

export interface ChoiceOpt {
  label: string;
  math?: Expr;
  correct: boolean;
  why?: string;
}
export interface ChoiceSet {
  question: string;
  options: ChoiceOpt[];
}

function lead(op: "+" | "-" | "·" | ":", e: Expr): Expr {
  return row({ t: "text", s: "" }, op, e);
}

export function choicesFor(eq: BEq, a: Action): ChoiceSet | null {
  switch (a.kind) {
    case "move": {
      const t = findTerm(eq, a.from, a.id)!;
      const abs = termAbsExpr(t);
      const tt = termText(t, false);
      const wasPlus = t.c.n >= 0;
      return {
        question: `¿Cómo llega ${tt} al otro lado del =?`,
        options: [
          {
            label: "sumando",
            math: lead("+", abs),
            correct: !wasPlus,
            why: wasPlus ? `${cap(tt)} está sumando de este lado. Al cruzar el =, pasa restando.` : undefined,
          },
          {
            label: "restando",
            math: lead("-", abs),
            correct: wasPlus,
            why: wasPlus ? undefined : `${cap(tt)} está restando de este lado. Al cruzar el =, pasa sumando.`,
          },
        ],
      };
    }
    case "coef": {
      const t = findTerm(eq, a.from, a.id)!;
      const c = t.c;
      return {
        question: c.n < 0 ? `¿Cómo pasa el ${ft(c)} al otro lado? (va con su signo)` : `¿Cómo pasa el ${ft(c)} al otro lado?`,
        options: [
          { label: "dividiendo", math: lead(":", fr(c)), correct: true },
          { label: "multiplicando", math: lead("·", fr(c)), correct: false, why: `El ${ft(c)} está multiplicando a la x. Lo que multiplica pasa dividiendo.` },
          {
            label: c.n < 0 ? "sumando" : "restando",
            math: lead(c.n < 0 ? "+" : "-", fr(c.abs())),
            correct: false,
            why: `El ${ft(c)} no está sumando ni restando: ${termText(t)} es ${ft(c)} por x. Lo que multiplica pasa dividiendo.`,
          },
        ],
      };
    }
    case "divisor": {
      const t = findTerm(eq, a.from, a.id)!;
      const d = t.div!;
      return {
        question: `¿Cómo pasa el ${ft(d)} al otro lado?`,
        options: [
          { label: "multiplicando", math: lead("·", fr(d)), correct: true },
          { label: "dividiendo", math: lead(":", fr(d)), correct: false, why: `La x está dividida por ${ft(d)}. Lo que divide pasa multiplicando.` },
        ],
      };
    }
    case "factor": {
      const c = eq[a.from].factor!;
      return {
        question: `¿Cómo pasa el ${ft(c)} al otro lado?`,
        options: [
          { label: "dividiendo", math: lead(":", fr(c)), correct: true },
          { label: "multiplicando", math: lead("·", fr(c)), correct: false, why: `El ${ft(c)} multiplica a todo el paréntesis. Lo que multiplica pasa dividiendo.` },
          {
            label: "restando",
            math: lead("-", fr(c.abs())),
            correct: false,
            why: `El ${ft(c)} no está sumando: multiplica a todo el paréntesis. Pasa dividiendo.`,
          },
        ],
      };
    }
    case "special": {
      const t = findTerm(eq, a.from, a.id)!;
      const k = eq[other(a.from)].terms[0]?.c ?? F(0);
      const K = fr(k);
      if (t.pow === 2)
        return {
          question: "La x está elevada al cuadrado. ¿Cómo queda del otro lado?",
          options: [
            { label: "como raíz cuadrada", math: root(2, K), correct: true },
            { label: "dividiendo por 2", math: row(K, ":", N(2)), correct: false, why: "Elevar al cuadrado no es multiplicar por 2. Lo contrario de elevar al cuadrado es sacar la raíz cuadrada." },
            { label: "elevando al cuadrado", math: pow(K, 2), correct: false, why: "Lo contrario de elevar al cuadrado es sacar la raíz, no volver a elevar." },
          ],
        };
      if (t.pow === 3)
        return {
          question: "La x está elevada al cubo. ¿Cómo queda del otro lado?",
          options: [
            { label: "como raíz cúbica", math: root(3, K), correct: true },
            { label: "dividiendo por 3", math: row(K, ":", N(3)), correct: false, why: "Elevar al cubo no es multiplicar por 3. Lo contrario de elevar al cubo es la raíz cúbica." },
          ],
        };
      if (t.root === 2)
        return {
          question: "La x está adentro de una raíz cuadrada. ¿Cómo queda del otro lado?",
          options: [
            { label: "elevando al cuadrado", math: pow(K, 2), correct: true },
            { label: "multiplicando por 2", math: row(K, "·", N(2)), correct: false, why: "Lo contrario de la raíz cuadrada es elevar al cuadrado, y elevar al cuadrado no es multiplicar por 2." },
            { label: "como raíz", math: root(2, K), correct: false, why: "Lo contrario de sacar la raíz es elevar al cuadrado." },
          ],
        };
      return {
        question: "x elevado a la −1 es el inverso de x. ¿Cuánto vale x?",
        options: [
          { label: "el inverso", math: pow(K, -1), correct: true },
          { label: "el opuesto", math: k.n < 0 ? fr(k.neg()) : neg(K), correct: false, why: "El exponente −1 no cambia el signo: indica el inverso (dar vuelta la fracción)." },
          { label: "el mismo número", math: K, correct: false, why: "x⁻¹ no es x: es su inverso. Entonces x es el inverso de ese número." },
        ],
      };
    }
    default:
      return null;
  }
}

function cap(s: string) {
  return s.startsWith("{") ? "El " + s : s[0].toUpperCase() + s.slice(1);
}

// ---------- Hacer el movimiento ----------

export interface ComputeJob {
  prompt: string;
  /** La cuenta que tiene que hacer el jugador. */
  expr: Expr;
  result: Fraction;
  /** Ecuación con el movimiento hecho y la cuenta pendiente. */
  base: BEq;
  side: SideKey;
  /** Términos de base[side] que se reemplazan por el resultado. */
  replace: number[];
  resultX: boolean;
  steps: Step[];
  traps: Trap[];
  label: string;
  note?: string;
}

export type Outcome = { eq: BEq; label: string } | { job: ComputeJob };

function setSide(eq: BEq, side: SideKey, s: BSide, next = eq.next): BEq {
  return { ...eq, [side]: s, next } as BEq;
}

/** Lado contrario con un solo número (o 0): devuelve el número, la ecuación con ese lugar listo y su id. */
function loneConst(eq: BEq, side: SideKey): { k: Fraction; eq: BEq; id: number } {
  const o = eq[side];
  if (o.terms.length === 1) return { k: o.terms[0].c, eq, id: o.terms[0].id };
  const id = eq.next;
  return { k: F(0), eq: setSide(eq, side, { terms: [{ id, c: F(0), x: false }] }, eq.next + 1), id };
}

export function execute(eq: BEq, a: Action): Outcome {
  switch (a.kind) {
    case "move": {
      const t = findTerm(eq, a.from, a.id)!;
      const to = other(a.from);
      const from: BSide = { ...eq[a.from], terms: eq[a.from].terms.filter((u) => u.id !== t.id) };
      const moved: BTerm = { ...t, id: eq.next, c: t.c.neg() };
      const dest: BSide = { ...eq[to], terms: [...eq[to].terms, moved] };
      const next = { ...eq, [a.from]: from, [to]: dest, next: eq.next + 1 } as BEq;
      const tt = termText(t, false);
      return {
        eq: next,
        label: t.c.n >= 0 ? `Pasamos ${tt} al otro lado: estaba sumando y llega restando.` : `Pasamos ${tt} al otro lado: estaba restando y llega sumando.`,
      };
    }
    case "combine": {
      const s = eq[a.side];
      const [ta, tb] = [findTerm(eq, a.side, a.a)!, findTerm(eq, a.side, a.b)!].sort((p, q) => s.terms.indexOf(p) - s.terms.indexOf(q));
      const A = ta.c;
      const op: COp = tb.c.n < 0 ? "-" : "+";
      const B = tb.c.abs();
      const isX = ta.x;
      return {
        job: {
          prompt: isX ? "Juntá las x: operá los números que las acompañan (x es 1·x)." : "Juntá los números.",
          expr: row(fr(A), op, fr(B)),
          result: A.add(tb.c),
          base: eq,
          side: a.side,
          replace: [ta.id, tb.id],
          resultX: isX,
          steps: opSteps(A, op, B),
          traps: opTraps(A, op, B),
          label: isX ? "Juntamos las x." : "Juntamos los números.",
        },
      };
    }
    case "coef":
    case "divisor": {
      const t = findTerm(eq, a.from, a.id)!;
      const to = other(a.from);
      const lc = loneConst(eq, to);
      const base = setSide(lc.eq, a.from, { terms: [{ id: t.id, c: ONE, x: true }] });
      const isDiv = a.kind === "coef";
      const m = isDiv ? t.c : t.div!;
      const op: COp = isDiv ? ":" : "·";
      return {
        job: {
          prompt: "Ahora calculá el otro lado.",
          expr: row(fr(lc.k), op, fr(m)),
          result: isDiv ? lc.k.div(m) : lc.k.mul(m),
          base,
          side: to,
          replace: [lc.id],
          resultX: false,
          steps: opSteps(lc.k, op, m),
          traps: opTraps(lc.k, op, m),
          label: isDiv ? `Pasamos el ${ft(m)} dividiendo.` : `Pasamos el ${ft(m)} multiplicando.`,
        },
      };
    }
    case "factor": {
      const c = eq[a.from].factor!;
      const to = other(a.from);
      const lc = loneConst(eq, to);
      const base = setSide(lc.eq, a.from, { terms: lc.eq[a.from].terms });
      return {
        job: {
          prompt: "Ahora calculá el otro lado.",
          expr: row(fr(lc.k), ":", fr(c)),
          result: lc.k.div(c),
          base,
          side: to,
          replace: [lc.id],
          resultX: false,
          steps: opSteps(lc.k, ":", c),
          traps: opTraps(lc.k, ":", c),
          label: `Pasamos el ${ft(c)} dividiendo, y el paréntesis se va.`,
        },
      };
    }
    case "distribute": {
      const s = eq[a.side];
      const f = s.factor!;
      const consts = s.terms.filter(isConst);
      // Las x se multiplican solas; la cuenta del número la hace el jugador.
      const terms = s.terms.map((t) => (t.x ? { ...t, c: t.c.mul(f) } : consts.indexOf(t) > 0 ? { ...t, c: t.c.mul(f) } : t));
      const base = setSide(eq, a.side, { terms });
      const label = `Aplicamos la distributiva: el ${ft(f)} multiplica a cada término.`;
      if (!consts.length) return { eq: base, label };
      const k = consts[0].c;
      return {
        job: {
          prompt: `Distributiva: el ${ft(f)} multiplica a la x y también al número. ¿Cuánto da?`,
          expr: row(fr(f), "·", fr(k)),
          result: f.mul(k),
          base,
          side: a.side,
          replace: [consts[0].id],
          resultX: false,
          steps: opSteps(f, "·", k),
          traps: opTraps(f, "·", k),
          label,
        },
      };
    }
    case "special": {
      const t = findTerm(eq, a.from, a.id)!;
      const to = other(a.from);
      const lc = loneConst(eq, to);
      const base = setSide(lc.eq, a.from, { terms: [{ id: t.id, c: ONE, x: true }] });
      const k = lc.k;
      const common = { base, side: to, replace: [lc.id], resultX: false, prompt: "Ahora calculá el otro lado." };
      if (t.pow === 2 || t.pow === 3) {
        const idx = t.pow;
        const res = k.root(idx)!;
        return {
          job: {
            ...common,
            expr: root(idx, fr(k)),
            result: res,
            steps: rootSteps(k, idx),
            traps: cleanTraps(res, [
              { value: k.div(F(idx)), msg: `La raíz no es dividir por ${idx}: buscamos un número que elevado a la ${idx} dé ${ft(k)}.` },
              { value: k, msg: "Te faltó sacar la raíz." },
              ...(idx === 3 ? [{ value: res.neg(), msg: "Con índice impar, la raíz conserva el signo del número de adentro." }] : []),
            ]),
            label: idx === 2 ? "La potencia pasó al otro lado como raíz cuadrada." : "La potencia pasó al otro lado como raíz cúbica.",
            note: idx === 2 ? `Ojo: ${ft(res.neg())} también cumple, porque un negativo al cuadrado da positivo. Acá buscamos la positiva.` : undefined,
          },
        };
      }
      if (t.root) {
        const res = k.pow(t.root);
        return {
          job: {
            ...common,
            expr: pow(fr(k), t.root),
            result: res,
            steps: powSteps(k, t.root),
            traps: cleanTraps(res, [
              { value: k.mul(F(t.root)), msg: "Elevar al cuadrado no es multiplicar por 2: es multiplicar el número por sí mismo." },
              ...(Math.abs(k.n) !== 1 ? [{ value: F(k.n ** t.root, k.d), msg: "Elevaste solo el numerador. La potencia va arriba y abajo." }] : []),
              { value: k, msg: "Te faltó elevar al cuadrado." },
            ]),
            label: "La raíz pasó al otro lado como potencia.",
          },
        };
      }
      const res = k.inv();
      return {
        job: {
          ...common,
          expr: pow(fr(k), -1),
          result: res,
          steps: powSteps(k, -1),
          traps: cleanTraps(res, [
            { value: res.neg(), msg: "El inverso conserva el signo: solo se da vuelta la fracción." },
            { value: k, msg: "Te faltó dar vuelta la fracción." },
          ]),
          label: "El exponente −1 pasó al otro lado: x es el inverso.",
        },
      };
    }
  }
}

/** Aplica el resultado de la cuenta. */
export function finishJob(job: ComputeJob, value: Fraction = job.result): BEq {
  const base = job.base;
  const s = base[job.side];
  const first = job.replace[0];
  let terms = s.terms.filter((t) => t.id === first || !job.replace.includes(t.id));
  terms = terms.map((t) => (t.id === first ? { id: base.next, c: value, x: job.resultX } : t));
  if (value.isZero()) terms = terms.filter((t) => t.id !== base.next);
  return { ...base, [job.side]: { ...s, terms }, next: base.next + 1 } as BEq;
}

// ---------- Sugerencia del próximo paso ----------

export interface Suggestion {
  side: SideKey;
  target: Target;
  action: Action;
  text: string;
}

export function suggest(eq: BEq): Suggestion | null {
  if (solvedValue(eq)) return null;
  const sides: SideKey[] = ["L", "R"];
  for (const s of sides) {
    const f = eq[s].factor;
    if (!f) continue;
    const o = eq[other(s)];
    const consts = o.terms.filter(isConst);
    if (o.terms.length > 1 && consts.length >= 2 && !o.terms.some((t) => t.x)) {
      return { side: other(s), target: consts[0].id, action: { kind: "combine", side: other(s), a: consts[0].id, b: consts[1].id }, text: `Primero juntá los números de la ${sideName(other(s))}.` };
    }
    return { side: s, target: "factor", action: { kind: "factor", from: s }, text: `El ${ft(f)} multiplica a todo el paréntesis: pasalo al otro lado.` };
  }
  const xs = (s: SideKey) => eq[s].terms.filter((t) => t.x);
  const xL = xs("L").length;
  const xR = xs("R").length;
  if (!xL && !xR) return null;
  if (xL && xR) {
    const keep: SideKey = xL >= xR ? "L" : "R";
    const from = other(keep);
    const t = xs(from)[0];
    return {
      side: from,
      target: t.id,
      action: { kind: "move", from, id: t.id },
      text: `Hay x de los dos lados. Llevalas a un mismo lado: pasá ${termText(t)} a la ${sideName(keep)}.`,
    };
  }
  const xSide: SideKey = xL ? "L" : "R";
  const cSide = other(xSide);
  const constsX = eq[xSide].terms.filter(isConst);
  if (constsX.length) {
    const t = constsX[0];
    return { side: xSide, target: t.id, action: { kind: "move", from: xSide, id: t.id }, text: `Dejá la x sola: pasá ${termText(t)} al otro lado.` };
  }
  const constsO = eq[cSide].terms.filter(isConst);
  if (constsO.length >= 2) {
    return {
      side: cSide,
      target: constsO[0].id,
      action: { kind: "combine", side: cSide, a: constsO[0].id, b: constsO[1].id },
      text: `Juntá los números de la ${sideName(cSide)}.`,
    };
  }
  const xt = xs(xSide);
  if (xt.length >= 2) {
    return { side: xSide, target: xt[0].id, action: { kind: "combine", side: xSide, a: xt[0].id, b: xt[1].id }, text: "Juntá las x en un solo término." };
  }
  const t = xt[0];
  if (isSpecial(t)) {
    return {
      side: xSide,
      target: t.id,
      action: { kind: "special", from: xSide, id: t.id },
      text: t.root ? "La x está dentro de una raíz: pasá la raíz al otro lado." : "Pasá el exponente al otro lado.",
    };
  }
  if (t.div) return { side: xSide, target: t.id, action: { kind: "divisor", from: xSide, id: t.id }, text: `La x está dividida por ${ft(t.div)}: pasalo al otro lado.` };
  if (!t.c.equals(ONE)) return { side: xSide, target: t.id, action: { kind: "coef", from: xSide, id: t.id }, text: `El ${ft(t.c)} está multiplicando a la x: pasalo al otro lado.` };
  return null;
}
