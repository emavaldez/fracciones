// Pizarra: la cuenta (o la ecuación) se ve entera y el jugador marca pedazos.
// Este módulo no tiene interfaz: representa la cuenta como árbol, la convierte en
// fichas para marcar, decide si un pedazo se puede resolver solo (y si no, por qué),
// y aplica los movimientos. Se prueba con miles de cuentas en tests/pizarra.test.ts.
import { F, Fraction } from "../math/fraction";
import { N, X, fr, neg as negE, par as parE, pow as powE, root as rootE, row, type Expr } from "../math/expr";
import { cleanTraps, ft } from "./helpers";
import { opSteps, opTraps } from "./opcheck";
import { sumSteps } from "./gen/w3";
import { powSteps } from "./gen/w5";
import { rootSteps } from "./gen/w6";
import type { Step, Trap } from "./types";

// ---------- Árbol ----------

/** Operación entre factores: "" es la multiplicación sin signo (2x, 3(…)). */
export type MulOp = "·" | ":" | "";

export type T =
  | { k: "n"; v: Fraction }
  | { k: "x" }
  | { k: "sum"; t: { s: 1 | -1; n: T }[] }
  | { k: "prod"; f: { op: MulOp; n: T }[] }
  | { k: "pow"; b: T; e: number }
  | { k: "root"; i: number; n: T }
  | { k: "par"; n: T; br: "(" | "[" };

export interface PzSpec {
  kind: "calc" | "eq";
  sides: T[];
}

export type Path = number[];
const ONE = F(1);

// ---------- Constructores ----------

/** Número (si es negativo queda como "−número"). */
export const tn = (v: Fraction): T => (v.n < 0 ? { k: "sum", t: [{ s: -1, n: { k: "n", v: v.neg() } }] } : { k: "n", v });
export const tX: T = { k: "x" };
export const tPar = (n: T, br: "(" | "[" = "("): T => ({ k: "par", n, br });
export const tPow = (b: T, e: number): T => ({ k: "pow", b, e });
export const tRoot = (i: number, n: T): T => ({ k: "root", i, n });

/** Suma: tSum(a, "+", b, "-", c) o tSum("-", a, "+", b). */
export function tSum(...parts: (T | "+" | "-")[]): T {
  const t: { s: 1 | -1; n: T }[] = [];
  let s: 1 | -1 = 1;
  for (const p of parts) {
    if (p === "+" || p === "-") s = p === "-" ? -1 : 1;
    else {
      t.push({ s, n: p });
      s = 1;
    }
  }
  return { k: "sum", t };
}

/** Producto: tProd(a, "·", b, ":", c) o tProd(a, "", x) para 2x. */
export function tProd(...parts: (T | MulOp)[]): T {
  const f: { op: MulOp; n: T }[] = [];
  let op: MulOp = "";
  for (const p of parts) {
    if (typeof p === "string") op = p;
    else {
      f.push({ op: f.length ? op : "", n: p });
      op = "·";
    }
  }
  return { k: "prod", f };
}

/** c·x (con 1x = x y −1x = −x). */
export function tCx(c: Fraction): T {
  if (c.equals(ONE)) return tX;
  if (c.equals(F(-1))) return { k: "sum", t: [{ s: -1, n: tX }] };
  if (c.n < 0) return { k: "sum", t: [{ s: -1, n: tProd(tn(c.neg()), "", tX) }] };
  return tProd(tn(c), "", tX);
}

/** Lado armado con términos: números y {x: coeficiente}. tTerms({ x: F(2,3) }, F(-1,4)) = 2/3·x − 1/4 */
export function tTerms(...items: (Fraction | { x: Fraction })[]): T {
  const t: { s: 1 | -1; n: T }[] = [];
  for (const it of items) {
    const v = it instanceof Fraction ? it : it.x;
    if (v.isZero()) continue;
    const abs = v.abs();
    t.push({ s: v.n < 0 ? -1 : 1, n: it instanceof Fraction ? tn(abs) : tCx(abs) });
  }
  return normSide({ k: "sum", t });
}

export const eqPz = (L: T, R: T): PzSpec => ({ kind: "eq", sides: [normSide(L), normSide(R)] });

// ---------- Recorrer ----------

function child(t: T, k: number): T {
  switch (t.k) {
    case "sum":
      return t.t[k].n;
    case "prod":
      return t.f[k].n;
    case "pow":
      return t.b;
    case "root":
    case "par":
      return t.n;
    default:
      throw new Error("Camino inválido");
  }
}

export function getNode(t: T, p: Path): T {
  return p.reduce((cur, k) => child(cur, k), t);
}

export function setNode(t: T, p: Path, v: T): T {
  if (!p.length) return v;
  const [k, ...rest] = p;
  switch (t.k) {
    case "sum":
      return { ...t, t: t.t.map((x, i) => (i === k ? { ...x, n: setNode(x.n, rest, v) } : x)) };
    case "prod":
      return { ...t, f: t.f.map((x, i) => (i === k ? { ...x, n: setNode(x.n, rest, v) } : x)) };
    case "pow":
      return { ...t, b: setNode(t.b, rest, v) };
    case "root":
    case "par":
      return { ...t, n: setNode(t.n, rest, v) };
    default:
      throw new Error("Camino inválido");
  }
}

export function hasX(t: T): boolean {
  switch (t.k) {
    case "n":
      return false;
    case "x":
      return true;
    case "sum":
      return t.t.some((x) => hasX(x.n));
    case "prod":
      return t.f.some((x) => hasX(x.n));
    case "pow":
      return hasX(t.b);
    default:
      return hasX(t.n);
  }
}

/** Un número suelto: 3/4, −3/4 o (−3/4). */
export function isNumLeaf(t: T): boolean {
  if (t.k === "n") return true;
  if (t.k === "par") return isNumLeaf(t.n);
  return t.k === "sum" && t.t.length === 1 && t.t[0].s === -1 && t.t[0].n.k === "n";
}

export function numVal(t: T): Fraction {
  if (t.k === "n") return t.v;
  if (t.k === "par") return numVal(t.n);
  if (t.k === "sum") return numVal(t.t[0].n).neg();
  throw new Error("No es un número");
}

/** x, 2x, (2/3)·x… (un término con x de grado 1 que se puede juntar con otros). */
export function xCoef(t: T): Fraction | null {
  if (t.k === "x") return ONE;
  if (t.k === "sum" && t.t.length === 1 && t.t[0].s === -1) {
    const c = xCoef(t.t[0].n);
    return c && c.neg();
  }
  if (t.k === "prod") {
    let c = ONE;
    let xs = 0;
    for (let i = 0; i < t.f.length; i++) {
      const f = t.f[i];
      if (f.n.k === "x") {
        if (f.op === ":") return null;
        xs++;
      } else if (isNumLeaf(f.n)) c = f.op === ":" ? c.div(numVal(f.n)) : c.mul(numVal(f.n));
      else return null;
    }
    return xs === 1 ? c : null;
  }
  return null;
}

// ---------- Valor ----------

export function ev(t: T, x?: Fraction): Fraction | null {
  switch (t.k) {
    case "n":
      return t.v;
    case "x":
      return x ?? null;
    case "par":
      return ev(t.n, x);
    case "sum": {
      let acc = F(0);
      for (const it of t.t) {
        const v = ev(it.n, x);
        if (!v) return null;
        acc = it.s < 0 ? acc.sub(v) : acc.add(v);
      }
      return acc;
    }
    case "prod": {
      let acc: Fraction | null = null;
      for (const it of t.f) {
        const v = ev(it.n, x);
        if (!v) return null;
        if (acc === null) acc = v;
        else if (it.op === ":") {
          if (v.isZero()) return null;
          acc = acc.div(v);
        } else acc = acc.mul(v);
      }
      return acc;
    }
    case "pow": {
      const b = ev(t.b, x);
      if (!b || (b.isZero() && t.e <= 0)) return null;
      return b.pow(t.e);
    }
    case "root": {
      const v = ev(t.n, x);
      return v ? v.root(t.i) : null;
    }
  }
}

const SAMPLES = [F(2), F(3), F(7, 5)];

/** Qué tipo de valor tiene: un número, c·x, u otra cosa. */
export function classify(t: T): { kind: "num"; v: Fraction } | { kind: "lin"; c: Fraction } | { kind: "other" } {
  if (!hasX(t)) {
    const v = ev(t);
    return v ? { kind: "num", v } : { kind: "other" };
  }
  const vals = SAMPLES.map((s) => ev(t, s));
  if (vals.some((v) => !v)) return { kind: "other" };
  const c = vals[0]!.div(SAMPLES[0]);
  if (vals.every((v, i) => v!.equals(c.mul(SAMPLES[i])))) return { kind: "lin", c };
  return { kind: "other" };
}

// ---------- Ordenar (después de cada paso) ----------

function canImplicit(n: T) {
  return n.k === "x" || n.k === "par" || n.k === "root" || (n.k === "pow" && n.b.k === "x");
}

export function norm(t: T): T {
  switch (t.k) {
    case "n":
      return t.v.n < 0 ? { k: "sum", t: [{ s: -1, n: { k: "n", v: t.v.neg() } }] } : t;
    case "x":
      return t;
    case "par": {
      const inner = norm(t.n);
      if (inner.k === "n" || inner.k === "x" || inner.k === "pow" || inner.k === "root" || inner.k === "par") return inner;
      return { ...t, n: inner };
    }
    case "pow": {
      let b = norm(t.b);
      if (t.e === 1) return b;
      if (b.k === "sum" || b.k === "prod") b = tPar(b);
      return { ...t, b };
    }
    case "root":
      return { ...t, n: norm(t.n) };
    case "prod": {
      let f: { op: MulOp; n: T }[] = [];
      t.f.forEach((it, i) => {
        const n = norm(it.n);
        const op: MulOp = i === 0 ? "" : it.op;
        if (n.k === "prod" && (i === 0 || op !== ":")) {
          n.f.forEach((inner, j) => f.push({ op: j === 0 ? op : inner.op, n: inner.n }));
        } else f.push({ op, n: n.k === "sum" ? tPar(n) : n });
      });
      // El 1 que multiplica no se escribe.
      // (1 · a = a y a : 1 = a; pero 1 : a no es a)
      f = f.filter((it, i) => {
        if (!(it.n.k === "n" && it.n.v.equals(ONE)) || f.length === 1) return true;
        return i === 0 ? f[1].op === ":" : false;
      });
      f = f.map((it, i) => ({ op: i === 0 ? "" : it.op === "" && !canImplicit(it.n) ? "·" : it.op, n: it.n }));
      if (f.length === 1) return f[0].n;
      return { k: "prod", f };
    }
    case "sum": {
      let terms: { s: 1 | -1; n: T }[] = [];
      for (const it of t.t) {
        const n = norm(it.n);
        if (n.k === "sum") n.t.forEach((inner) => terms.push({ s: (it.s * inner.s) as 1 | -1, n: inner.n }));
        else terms.push({ s: it.s, n });
      }
      if (terms.length > 1) terms = terms.filter((it) => !(it.n.k === "n" && it.n.v.isZero()));
      if (!terms.length) return tn(F(0));
      if (terms.length === 1 && terms[0].s === 1) return terms[0].n;
      return { k: "sum", t: terms };
    }
  }
}

/** Lado completo: sin paréntesis de más afuera. */
export function normSide(t: T): T {
  let s = norm(t);
  while (s.k === "par") s = norm(s.n);
  return s;
}

// ---------- Para mostrar ----------

export function toExpr(t: T): Expr {
  switch (t.k) {
    case "n":
      return fr(t.v);
    case "x":
      return X;
    case "par":
      return parE(toExpr(t.n), t.br);
    case "pow":
      return powE(toExpr(t.b), t.e);
    case "root":
      return rootE(t.i, toExpr(t.n));
    case "sum": {
      const parts: (Expr | "+" | "-")[] = [];
      t.t.forEach((it, i) => {
        if (i === 0) parts.push(it.s < 0 ? (it.n.k === "n" ? fr(it.n.v.neg()) : negE(toExpr(it.n))) : toExpr(it.n));
        else parts.push(it.s < 0 ? "-" : "+", toExpr(it.n));
      });
      return parts.length === 1 ? (parts[0] as Expr) : row(...parts);
    }
    case "prod": {
      const parts: (Expr | "·" | ":")[] = [];
      t.f.forEach((it, i) => {
        if (i > 0 && it.op !== "") parts.push(it.op);
        parts.push(toExpr(it.n));
      });
      return row(...parts);
    }
  }
}

export function pzExpr(pz: PzSpec): Expr {
  return pz.kind === "eq" ? row(toExpr(pz.sides[0]), "=", toExpr(pz.sides[1])) : toExpr(pz.sides[0]);
}

const SUP: Record<string, string> = { "2": "²", "3": "³", "-1": "⁻¹", "4": "⁴" };

/** Texto con fracciones {a/b} para las explicaciones. */
export function tText(t: T): string {
  switch (t.k) {
    case "n":
      return ft(t.v);
    case "x":
      return "x";
    case "par":
      return t.br === "(" ? `(${tText(t.n)})` : `[${tText(t.n)}]`;
    case "pow": {
      const b = tText(t.b);
      return `${t.b.k === "n" && t.b.v.d !== 1 ? `(${b})` : b}${SUP[String(t.e)] ?? "^" + t.e}`;
    }
    case "root":
      return `${t.i === 2 ? "√" : t.i === 3 ? "∛" : "√"}(${tText(t.n)})`;
    case "sum":
      return t.t.map((it, i) => (i === 0 ? (it.s < 0 ? "−" : "") : it.s < 0 ? " − " : " + ") + tText(it.n)).join("");
    case "prod":
      return t.f.map((it, i) => (i === 0 ? "" : it.op === "" ? "" : ` ${it.op} `) + tText(it.n)).join("");
  }
}

// ---------- Fichas ----------

export type TokKind = "num" | "x" | "op" | "open" | "close" | "root" | "exp";

export interface Tok {
  i: number;
  kind: TokKind;
  v?: Fraction;
  op?: string;
  e?: number;
  br?: string;
  ri?: number;
  /** Nodo al que pertenece la ficha. */
  path: Path;
  /** Para signos: a qué término/factor acompaña. */
  slot?: number;
  /** Para la raíz: última ficha de lo que está adentro. */
  end?: number;
}

export type RNode =
  | { r: "tok"; tok: Tok }
  | { r: "row"; c: RNode[] }
  | { r: "pow"; base: RNode; exp: Tok; autoPar: boolean }
  | { r: "root"; tok: Tok; inner: RNode }
  | { r: "par"; open: Tok; inner: RNode; close: Tok };

export interface Layout {
  toks: Tok[];
  tree: RNode;
  spans: Map<string, [number, number]>;
}

const pk = (p: Path) => p.join(".");

export function layout(t: T): Layout {
  const toks: Tok[] = [];
  const spans = new Map<string, [number, number]>();
  const push = (tok: Omit<Tok, "i">): Tok => {
    const full = { ...tok, i: toks.length } as Tok;
    toks.push(full);
    return full;
  };
  const walk = (n: T, path: Path): RNode => {
    const start = toks.length;
    let out: RNode;
    switch (n.k) {
      case "n":
        out = { r: "tok", tok: push({ kind: "num", v: n.v, path }) };
        break;
      case "x":
        out = { r: "tok", tok: push({ kind: "x", path }) };
        break;
      case "sum": {
        const c: RNode[] = [];
        n.t.forEach((it, k) => {
          if (k > 0 || it.s < 0) c.push({ r: "tok", tok: push({ kind: "op", op: it.s < 0 ? "−" : "+", path, slot: k }) });
          c.push(walk(it.n, [...path, k]));
        });
        out = { r: "row", c };
        break;
      }
      case "prod": {
        const c: RNode[] = [];
        n.f.forEach((it, k) => {
          if (k > 0 && it.op !== "") c.push({ r: "tok", tok: push({ kind: "op", op: it.op, path, slot: k }) });
          c.push(walk(it.n, [...path, k]));
        });
        out = { r: "row", c };
        break;
      }
      case "pow": {
        const base = walk(n.b, [...path, 0]);
        const exp = push({ kind: "exp", e: n.e, path });
        out = { r: "pow", base, exp, autoPar: n.b.k === "n" && n.b.v.d !== 1 };
        break;
      }
      case "root": {
        const tok = push({ kind: "root", ri: n.i, path });
        const inner = walk(n.n, [...path, 0]);
        tok.end = toks.length - 1;
        out = { r: "root", tok, inner };
        break;
      }
      case "par": {
        const open = push({ kind: "open", br: n.br, path });
        const inner = walk(n.n, [...path, 0]);
        const close = push({ kind: "close", br: n.br === "(" ? ")" : "]", path });
        out = { r: "par", open, inner, close };
        break;
      }
    }
    spans.set(pk(path), [start, toks.length - 1]);
    return out;
  };
  const tree = walk(t, []);
  return { toks, tree, spans };
}

// ---------- Leer un pedazo tal cual está escrito ----------

/** Arma el árbol de las fichas marcadas (como si estuvieran solas). Null si el pedazo está incompleto. */
export function parseToks(toks: Tok[], extra?: { at: number; v: Fraction }): T | null {
  let pos = 0;
  const peek = () => toks[pos];
  const isPrimaryStart = (t?: Tok) => !!t && (t.kind === "num" || t.kind === "x" || t.kind === "open" || t.kind === "root" || (extra !== undefined && t.i === extra.at));
  const fail = (): never => {
    throw new Error("parse");
  };
  const primary = (): T => {
    const t = peek();
    if (!t) return fail();
    if (extra && t.i === extra.at) {
      pos++;
      const v = tn(extra.v);
      return extra.v.n < 0 ? tPar(v) : v;
    }
    if (t.kind === "num") {
      pos++;
      return { k: "n", v: t.v! };
    }
    if (t.kind === "x") {
      pos++;
      return tX;
    }
    if (t.kind === "open") {
      pos++;
      const inner = expr();
      const c = peek();
      if (!c || c.kind !== "close") return fail();
      pos++;
      return tPar(inner, t.br === "[" ? "[" : "(");
    }
    if (t.kind === "root") {
      const endIdx = toks.findIndex((u) => u.i === t.end);
      if (endIdx < 0) return fail();
      const sub = parseToks(toks.slice(pos + 1, endIdx + 1), extra);
      if (!sub) return fail();
      pos = endIdx + 1;
      return tRoot(t.ri!, sub);
    }
    return fail();
  };
  const factor = (): T => {
    let p = primary();
    while (peek() && peek().kind === "exp") {
      p = tPow(p, peek().e!);
      pos++;
    }
    return p;
  };
  const term = (): T => {
    const f: { op: MulOp; n: T }[] = [{ op: "", n: factor() }];
    for (;;) {
      const t = peek();
      if (t && t.kind === "op" && (t.op === "·" || t.op === ":")) {
        pos++;
        f.push({ op: t.op as MulOp, n: factor() });
      } else if (isPrimaryStart(t)) {
        f.push({ op: "", n: factor() });
      } else break;
    }
    return f.length === 1 ? f[0].n : { k: "prod", f };
  };
  const expr = (): T => {
    const terms: { s: 1 | -1; n: T }[] = [];
    let s: 1 | -1 = 1;
    let first = true;
    for (;;) {
      const t = peek();
      if (t && t.kind === "op" && (t.op === "+" || t.op === "−")) {
        pos++;
        s = t.op === "−" ? -1 : 1;
      } else if (!first) break;
      terms.push({ s, n: term() });
      s = 1;
      first = false;
    }
    return terms.length === 1 && terms[0].s === 1 ? terms[0].n : { k: "sum", t: terms };
  };
  try {
    const out = expr();
    if (pos !== toks.length) return null;
    return out;
  } catch {
    return null;
  }
}

/** Lado completo con un pedazo reemplazado por un número (para mostrar qué pasaría). */
export function substitute(t: T, i: number, j: number, v: Fraction): T | null {
  const lay = layout(t);
  const marker = { ...lay.toks[i] };
  // Si el pedazo empezaba con su signo, el resultado ya lo incluye: queda "+ resultado".
  const plus: Tok[] = lay.toks[i].kind === "op" && i > 0 ? [{ i: -1, kind: "op", op: "+", path: [] }] : [];
  const toks = [...lay.toks.slice(0, i), ...plus, marker, ...lay.toks.slice(j + 1)];
  return parseToks(toks, { at: marker.i, v });
}

// ---------- ¿Se puede resolver ese pedazo solo? ----------

export type Sel =
  | { ok: true; kind: "node"; path: Path }
  | { ok: true; kind: "terms"; path: Path; from: number; to: number; withSign: boolean }
  | { ok: true; kind: "factors"; path: Path; from: number; to: number; withOp: boolean }
  | { ok: true; kind: "sign"; path: Path; slot: number }
  | { ok: true; kind: "exp"; path: Path }
  | { ok: true; kind: "rootsign"; path: Path }
  | { ok: false; reason: string };

function commonPrefix(a: Path, b: Path): Path {
  const out: Path = [];
  for (let k = 0; k < Math.min(a.length, b.length) && a[k] === b[k]; k++) out.push(a[k]);
  return out;
}

function partialReason(n: T): string {
  switch (n.k) {
    case "prod": {
      const div = n.f.some((f) => f.op === ":");
      const mul = n.f.some((f) => f.op !== ":") && n.f.length > 1;
      const what = div && mul ? "multiplicaciones y divisiones" : div ? "una división" : "una multiplicación";
      return `${tText(n)} es un solo término (tiene ${what}) y lo cortaste por la mitad. Las multiplicaciones y divisiones van antes que las sumas y restas: los + y − son los que separan los términos.`;
    }
    case "pow":
      return `La potencia va con su base: ${tText(n)} es un solo pedazo y se resuelve antes que lo que tiene alrededor.`;
    case "root":
      return `Marcaste solo una parte de la raíz ${tText(n)}. La raíz va entera.`;
    case "par":
      return `Marcaste medio paréntesis. Lo que está adentro de ${tText(n)} va junto: o marcás todo el paréntesis, o algo de adentro.`;
    default:
      return "Ese pedazo no se puede separar así.";
  }
}

export function analyze(t: T, lay: Layout, i: number, j: number): Sel {
  const { toks, spans } = lay;
  if (i > j) [i, j] = [j, i];
  const a = toks[i];
  const b = toks[j];
  if (i === j) {
    if (a.kind === "num" || a.kind === "x") return { ok: true, kind: "node", path: a.path };
    if (a.kind === "exp") return { ok: true, kind: "exp", path: a.path };
    if (a.kind === "root") return { ok: true, kind: "rootsign", path: a.path };
    if (a.kind === "op") {
      const owner = getNode(t, a.path);
      if (owner.k === "sum") return { ok: true, kind: "sign", path: a.path, slot: a.slot! };
      return { ok: false, reason: "Marcaste solo el signo de la operación. Marcá también los números." };
    }
    return { ok: false, reason: "Marcaste solo un paréntesis." };
  }
  if (b.kind === "op") return { ok: false, reason: "El pedazo que marcaste termina en un signo: falta lo que viene después." };
  const P = commonPrefix(a.path, b.path);
  const node = getNode(t, P);
  const span = spans.get(pk(P))!;
  if (span[0] === i && span[1] === j) return { ok: true, kind: "node", path: P };

  const childSpan = (k: number) => spans.get(pk([...P, k]))!;
  const opIdx = (k: number) => toks.findIndex((u) => u.kind === "op" && u.slot === k && pk(u.path) === pk(P));

  if (node.k === "sum" || node.k === "prod") {
    const items = node.k === "sum" ? node.t.length : node.f.length;
    let k1 = -1;
    let k2 = -1;
    let withLead = false;
    for (let k = 0; k < items; k++) {
      const [cs, ce] = childSpan(k);
      if (i === cs) k1 = k;
      if (i === opIdx(k) && opIdx(k) >= 0) {
        k1 = k;
        withLead = true;
      }
      if (j === ce) k2 = k;
    }
    if (k1 >= 0 && k2 >= k1) {
      if (node.k === "sum") {
        if (!withLead && node.t[k1].s < 0) {
          return {
            ok: false,
            reason: `${tText(node.t[k1].n)} está restando: el signo − va con él. Si lo juntás con lo que sigue, marcá también el −.`,
          };
        }
        return { ok: true, kind: "terms", path: P, from: k1, to: k2, withSign: withLead };
      }
      if (k1 === k2) return { ok: true, kind: "factors", path: P, from: k1, to: k2, withOp: withLead };
      if (withLead) return { ok: false, reason: "El pedazo que marcaste empieza con un signo de multiplicar o dividir: falta lo que está antes." };
      if (k1 > 0 && node.f[k1].op === ":") {
        return {
          ok: false,
          reason: `Ese pedazo está dividido por lo que viene antes. Las multiplicaciones y divisiones se resuelven en orden, de izquierda a derecha: primero va ${tText({ k: "prod", f: node.f.slice(0, k1 + 1).map((f, idx) => ({ ...f, op: idx === 0 ? "" : f.op })) })}.`,
        };
      }
      return { ok: true, kind: "factors", path: P, from: k1, to: k2, withOp: false };
    }
    // Corta un término o factor por la mitad
    for (let k = 0; k < items; k++) {
      const [cs, ce] = childSpan(k);
      const cutStart = i > cs && i <= ce;
      const cutEnd = j >= cs && j < ce;
      if (cutStart || cutEnd) return { ok: false, reason: partialReason(child(node, k)) };
    }
    return { ok: false, reason: "Ese pedazo no se puede separar así." };
  }
  return { ok: false, reason: partialReason(node) };
}

// ---------- Resolver un pedazo ----------

export interface Calc {
  side: number;
  i: number;
  j: number;
  /** El pedazo leído tal cual está escrito. */
  lit: T;
  linear: boolean;
  /** Lo que da (o el número que acompaña a la x). */
  value: Fraction;
  sel: Sel;
  steps: Step[];
  traps: Trap[];
}

function isAtomic(t: T): boolean {
  if (t.k === "n" || t.k === "x") return true;
  if (t.k === "par") return isAtomic(t.n);
  if (t.k === "sum") return t.t.length === 1 && isAtomic(t.t[0].n);
  if (t.k === "prod") return t.f.length === 2 && t.f[0].n.k === "n" && t.f[1].n.k === "x" && t.f[1].op === "";
  return false;
}

export function startResolve(pz: PzSpec, side: number, i: number, j: number): { calc: Calc } | { msg: string } {
  if (i > j) [i, j] = [j, i];
  const t = pz.sides[side];
  const lay = layout(t);
  const sel = analyze(t, lay, i, j);
  const lit = parseToks(lay.toks.slice(i, j + 1));
  if (!lit) return { msg: sel.ok ? "Ese pedazo está incompleto." : sel.reason };
  if (sel.ok && (sel.kind === "sign" || sel.kind === "exp" || sel.kind === "rootsign")) return { msg: "Marcaste solo un signo. Marcá una cuenta: dos números con la operación en el medio." };
  if (isAtomic(lit)) return { msg: hasX(lit) ? "Eso ya es un solo término: no hay ninguna cuenta para hacer." : "Eso ya es un número: no hay ninguna cuenta para hacer. Marcá dos números con la operación en el medio." };
  const c = classify(lit);
  if (c.kind === "other") {
    return {
      msg: hasX(lit)
        ? "Ahí hay términos con x y términos sin x: no se pueden juntar en uno solo. Juntá las x con las x y los números con los números."
        : "Esa cuenta no da un número exacto. Probá con otro pedazo.",
    };
  }
  const linear = c.kind === "lin";
  const value = c.kind === "lin" ? c.c : c.v;
  return { calc: { side, i, j, lit, linear, value, sel, steps: explainSteps(lit, linear), traps: trapsFor(lit, value, linear) } };
}

/** Reemplaza el pedazo (ya validado) por su resultado. */
export function applyResolve(pz: PzSpec, calc: Calc, value: Fraction = calc.value): PzSpec {
  const t = pz.sides[calc.side];
  const R = calc.linear ? tCx(value) : tn(value);
  const sel = calc.sel;
  if (!sel.ok) throw new Error("Pedazo inválido");
  let next: T;
  if (sel.kind === "node") next = setNode(t, sel.path, R);
  else if (sel.kind === "terms") {
    const s = getNode(t, sel.path) as Extract<T, { k: "sum" }>;
    const terms = [...s.t.slice(0, sel.from), { s: 1 as const, n: R }, ...s.t.slice(sel.to + 1)];
    next = setNode(t, sel.path, { k: "sum", t: terms });
  } else if (sel.kind === "factors") {
    const p = getNode(t, sel.path) as Extract<T, { k: "prod" }>;
    const f = [...p.f.slice(0, sel.from), { op: p.f[sel.from].op, n: R.k === "sum" ? tPar(R) : R }, ...p.f.slice(sel.to + 1)];
    next = setNode(t, sel.path, { k: "prod", f });
  } else throw new Error("Pedazo inválido");
  const sides = [...pz.sides];
  sides[calc.side] = normSide(next);
  return { ...pz, sides };
}

/** Explicación cuando el pedazo no se podía resolver solo (después de que el jugador calculó). */
export function explainInvalid(pz: PzSpec, calc: Calc, given: Fraction | null) {
  const reason = calc.sel.ok ? "" : calc.sel.reason;
  const right = given !== null && given.equals(calc.value);
  const litTxt = calc.linear ? `${tText(calc.lit)} = ${ft(calc.value)}x` : `${tText(calc.lit)} = ${ft(calc.value)}`;
  const arith = right ? `La cuenta está bien hecha (${litTxt}), pero ese pedazo no se podía resolver solo.` : `Ese pedazo no se podía resolver solo. (Y además, ${litTxt}.)`;
  let demo: { before: Expr; after: Expr; v0: Fraction; v1: Fraction } | null = null;
  if (pz.kind === "calc" && !calc.linear) {
    const t = pz.sides[calc.side];
    // Se reemplaza por lo que realmente da ese pedazo, así se ve solo el error de agrupar.
    const after = substitute(t, calc.i, calc.j, calc.value);
    const v0 = ev(t);
    const v1 = after ? ev(after) : null;
    if (after && v0 && v1 && !v0.equals(v1)) demo = { before: toExpr(t), after: toExpr(after), v0, v1 };
  }
  return { arith, reason, demo };
}

// ---------- Explicación y errores típicos de una cuenta ----------

function explainSteps(t: T, linear: boolean): Step[] {
  if (linear) return linSteps(t);
  const out: Step[] = [];
  evalSteps(t, out);
  return out.length ? out : [{ text: `Da ${ft(ev(t)!)}.` }];
}

function evalSteps(t: T, out: Step[]): Fraction {
  switch (t.k) {
    case "n":
      return t.v;
    case "x":
      throw new Error("x");
    case "par":
      return evalSteps(t.n, out);
    case "sum": {
      const vals = t.t.map((it) => evalSteps(it.n, out));
      if (vals.length === 1) return t.t[0].s < 0 ? vals[0].neg() : vals[0];
      out.push(...sumSteps(vals.map((v, k) => ({ f: k === 0 && t.t[0].s < 0 ? v.neg() : v, op: k === 0 ? "+" : t.t[k].s < 0 ? "-" : "+" }))));
      return ev(t)!;
    }
    case "prod": {
      const vals = t.f.map((it) => evalSteps(it.n, out));
      let acc = vals[0];
      for (let k = 1; k < vals.length; k++) {
        const op = t.f[k].op === ":" ? ":" : "·";
        out.push(...opSteps(acc, op, vals[k]));
        acc = op === ":" ? acc.div(vals[k]) : acc.mul(vals[k]);
      }
      return acc;
    }
    case "pow": {
      const b = evalSteps(t.b, out);
      out.push(...powSteps(b, t.e));
      return b.pow(t.e);
    }
    case "root": {
      const v = evalSteps(t.n, out);
      out.push(...rootSteps(v, t.i));
      return v.root(t.i)!;
    }
  }
}

function linSteps(t: T): Step[] {
  const terms: { c: Fraction; s: 1 | -1 }[] = [];
  const collect = (n: T, s: 1 | -1): boolean => {
    if (n.k === "par") return collect(n.n, s);
    if (n.k === "sum") return n.t.every((it) => collect(it.n, (s * it.s) as 1 | -1));
    const c = xCoef(n);
    if (!c) return false;
    terms.push({ c, s });
    return true;
  };
  if (collect(t, 1) && terms.length >= 2) {
    const total = terms.reduce((acc, it) => (it.s < 0 ? acc.sub(it.c) : acc.add(it.c)), F(0));
    return [
      { text: "Para juntar las x, se operan los números que las acompañan (x es 1·x):" },
      ...sumSteps(terms.map((it, k) => ({ f: k === 0 && it.s < 0 ? it.c.neg() : it.c, op: k === 0 ? "+" : it.s < 0 ? "-" : "+" }))),
      { text: `Queda ${ft(total)}x.` },
    ];
  }
  const c = classify(t);
  return [{ text: `Queda ${c.kind === "lin" ? ft(c.c) : "?"}x.` }];
}

/** Valor si se resuelve todo de izquierda a derecha, sin respetar qué va primero. */
function leftToRight(t: T): Fraction | null {
  const flat: (Fraction | string)[] = [];
  const walk = (n: T): boolean => {
    if (n.k === "sum") {
      n.t.forEach((it, k) => {
        if (k > 0 || it.s < 0) flat.push(it.s < 0 ? "-" : "+");
        walk(it.n);
      });
      return true;
    }
    if (n.k === "prod") {
      n.f.forEach((it, k) => {
        if (k > 0) flat.push(it.op === ":" ? ":" : "·");
        walk(it.n);
      });
      return true;
    }
    const v = ev(n);
    if (!v) return false;
    flat.push(v);
    return true;
  };
  if (!walk(t)) return null;
  let acc: Fraction | null = null;
  let op = "+";
  for (const it of flat) {
    if (typeof it === "string") {
      op = it;
      continue;
    }
    if (acc === null) acc = op === "-" ? it.neg() : it;
    else acc = op === "+" ? acc.add(it) : op === "-" ? acc.sub(it) : op === "·" ? acc.mul(it) : it.isZero() ? acc : acc.div(it);
  }
  return acc;
}

function trapsFor(t: T, value: Fraction, linear: boolean): Trap[] {
  const traps: Trap[] = [];
  const inner = t.k === "par" ? t.n : t;
  if (linear) {
    if (inner.k === "sum" && inner.t.length === 2) {
      const a = xCoef(inner.t[0].n);
      const b = xCoef(inner.t[1].n);
      if (a && b) traps.push(...opTraps(inner.t[0].s < 0 ? a.neg() : a, inner.t[1].s < 0 ? "-" : "+", b));
    }
    return cleanTraps(value, traps);
  }
  if (inner.k === "sum" && inner.t.length === 2 && isNumLeaf(inner.t[0].n) && isNumLeaf(inner.t[1].n)) {
    const a = numVal(inner.t[0].n);
    traps.push(...opTraps(inner.t[0].s < 0 ? a.neg() : a, inner.t[1].s < 0 ? "-" : "+", numVal(inner.t[1].n)));
  } else if (inner.k === "prod" && inner.f.length === 2 && isNumLeaf(inner.f[0].n) && isNumLeaf(inner.f[1].n)) {
    traps.push(...opTraps(numVal(inner.f[0].n), inner.f[1].op === ":" ? ":" : "·", numVal(inner.f[1].n)));
  } else if (inner.k === "pow" && isNumLeaf(inner.b)) {
    const b = numVal(inner.b);
    const e = inner.e;
    if (e > 0) {
      if (b.d !== 1 && Math.abs(b.n) !== 1) traps.push({ value: F(b.n ** e, b.d), msg: "Elevaste solo el numerador. La potencia va arriba y abajo." });
      traps.push({ value: b.mul(F(e)), msg: `Elevar a la ${e} no es multiplicar por ${e}: es multiplicar la base ${e} veces por sí misma.` });
    }
    if (e === 0) traps.push({ value: F(0), msg: "Todo número (menos el 0) elevado a la 0 da 1." });
    if (e < 0) traps.push({ value: b.pow(-e), msg: "Te faltó dar vuelta la base: el exponente negativo invierte la fracción." });
    traps.push({ value: value.neg(), msg: b.n < 0 ? "Base negativa: con exponente par da positivo, con impar da negativo." : "Revisá el signo." });
  } else if (inner.k === "root" && isNumLeaf(inner.n)) {
    const v = numVal(inner.n);
    traps.push({ value: v.div(F(inner.i)), msg: `La raíz no es dividir por ${inner.i}: buscamos un número que elevado a la ${inner.i} dé ${ft(v)}.` });
    traps.push({ value: v, msg: "Te faltó sacar la raíz." });
  } else {
    const ltr = leftToRight(inner);
    if (ltr) traps.push({ value: ltr, msg: "Resolviste de izquierda a derecha. Primero van las potencias y raíces, después las multiplicaciones y divisiones, y al final las sumas y restas." });
  }
  return cleanTraps(value, traps);
}

// ---------- Pasar al otro lado (ecuaciones) ----------

export type Move =
  | { kind: "term"; side: number; k: number }
  | { kind: "factor"; side: number; k: number; withSign: boolean }
  | { kind: "neg"; side: number }
  | { kind: "exp"; side: number }
  | { kind: "root"; side: number };

export interface ChoiceOpt {
  label: string;
  math?: Expr;
  correct: boolean;
  why?: string;
}

const lead = (op: "+" | "-" | "·" | ":", e: Expr): Expr => row({ t: "text", s: "" }, op, e);

/** El producto que forma todo el lado (o el lado sin su signo menos). */
function sideProd(t: T): { prod: Extract<T, { k: "prod" }>; negative: boolean } | null {
  if (t.k === "prod") return { prod: t, negative: false };
  if (t.k === "sum" && t.t.length === 1 && t.t[0].s < 0 && t.t[0].n.k === "prod") return { prod: t.t[0].n, negative: true };
  return null;
}

export function startPass(pz: PzSpec, side: number, i: number, j: number): { move: Move; question: string; options: ChoiceOpt[] } | { msg: string } {
  if (pz.kind !== "eq") return { msg: "Acá no hay =: no hay otro lado." };
  if (i > j) [i, j] = [j, i];
  const t = pz.sides[side];
  const other = pz.sides[1 - side];
  const lay = layout(t);
  const otherE = toExpr(other);
  const sp = sideProd(t);

  // Caso especial: el signo menos junto con el primer número (−2/3 en −2/3·x)
  if (sp && sp.negative && lay.toks[i].kind === "op" && lay.toks[i].slot === 0 && lay.toks[i].path.length === 0) {
    const f0 = lay.spans.get(pk([0, 0]))!;
    if (j === f0[1] && isNumLeaf(sp.prod.f[0].n)) return passFactor(pz, side, 0, true);
  }

  const sel = analyze(t, lay, i, j);
  if (!sel.ok) return { msg: sel.reason };
  const whole = sel.kind === "node" && sel.path.length === 0;

  if (sel.kind === "exp" && sel.path.length === 0 && t.k === "pow" && t.b.k === "x") return passExp(side, t.e, otherE);
  if (sel.kind === "rootsign" && sel.path.length === 0 && t.k === "root" && t.n.k === "x") return passRoot(side, otherE);
  if (sel.kind === "sign" && sel.path.length === 0 && t.k === "sum" && t.t.length === 1) {
    return {
      move: { kind: "neg", side },
      question: "El signo menos está multiplicando (−x es −1 · x). ¿Cómo pasa al otro lado?",
      options: [
        { label: "dividiendo por −1", math: lead(":", parE(fr(F(-1)))), correct: true },
        { label: "sumando", math: lead("+", N(1)), correct: false, why: "El signo menos no está sumando ni restando: es como multiplicar por −1. Pasa dividiendo por −1." },
      ],
    };
  }

  // Un término entero de un lado que es una suma
  if (t.k === "sum") {
    if (sel.kind === "terms" && sel.path.length === 0) {
      if (sel.from !== sel.to) return { msg: "Pasá de a un término por vez." };
      return passTerm(pz, side, sel.from);
    }
    if (sel.kind === "node" && sel.path.length === 1) return passTerm(pz, side, sel.path[0]);
    if (whole) return t.t.length === 1 ? passTerm(pz, side, 0) : { msg: "Pasá de a un término por vez." };
    if (sel.kind === "node" || sel.kind === "factors") {
      const k = sel.path[0];
      const term = t.t[k].n;
      if (sel.kind === "factors" || (sel.kind === "node" && sel.path.length === 2 && term.k === "prod")) {
        const node = getNode(t, sel.path);
        if (term.k === "prod" && hasX(term) && !(sel.kind === "node" && node.k === "x")) {
          return { msg: `${tText(sel.kind === "node" ? node : term)} multiplica solo a ${tText(term)}, no a todo este lado. Para pasarlo, primero ${tText(term)} tiene que quedar sola de este lado.` };
        }
        if (sel.kind === "node" && node.k === "x") return { msg: `La x está multiplicada: ${tText(term)} va junto. Si querés pasar el término entero, marcá ${tText(term)}.` };
      }
      return { msg: `Eso es solo una parte de ${tText(term)}. Para pasar un término al otro lado, marcalo entero.` };
    }
    return { msg: "Para pasar algo al otro lado, marcá un término entero." };
  }

  // Un lado que es un solo producto: se puede pasar un factor
  if (sp && !sp.negative) {
    if (whole) return passTerm(pz, side, -1);
    if (sel.kind === "factors" && sel.path.length === 0 && sel.from === sel.to) return passFactor(pz, side, sel.from, false);
    if (sel.kind === "node" && sel.path.length === 1) return passFactor(pz, side, sel.path[0], false);
    return { msg: "Para pasar algo dividiendo o multiplicando, marcá un solo número." };
  }
  if (sp && sp.negative) {
    if (whole) return passTerm(pz, side, 0);
    if (sel.kind === "node" && sel.path.length === 2) return passFactor(pz, side, sel.path[1], false);
    return { msg: "Para pasar algo dividiendo o multiplicando, marcá un solo número." };
  }
  if (whole) return passTerm(pz, side, -1);
  return { msg: "Eso está adentro de otra cuenta. Primero resolvé o sacá lo que lo rodea." };
}

function passTerm(pz: PzSpec, side: number, k: number) {
  const t = pz.sides[side];
  const term = k < 0 ? { s: 1 as const, n: t } : (t as Extract<T, { k: "sum" }>).t[k];
  const abs = toExpr(term.n);
  const tt = tText(term.n);
  const wasPlus = term.s > 0;
  return {
    move: { kind: "term" as const, side, k },
    question: `¿Cómo llega ${tt} al otro lado del =?`,
    options: [
      { label: "sumando", math: lead("+", abs), correct: !wasPlus, why: wasPlus ? `${tt} está sumando de este lado. Al cruzar el =, pasa restando.` : undefined },
      { label: "restando", math: lead("-", abs), correct: wasPlus, why: wasPlus ? undefined : `${tt} está restando de este lado. Al cruzar el =, pasa sumando.` },
    ],
  };
}

function passFactor(pz: PzSpec, side: number, k: number, withSign: boolean): { move: Move; question: string; options: ChoiceOpt[] } | { msg: string } {
  const sp = sideProd(pz.sides[side])!;
  const f = sp.prod.f[k];
  if (hasX(f.n)) return { msg: "La x se queda: es la que hay que despejar. Pasá lo que la acompaña." };
  const v = withSign ? numVal(f.n).neg() : f.n.k === "n" || isNumLeaf(f.n) ? numVal(f.n) : null;
  const shown = v ? fr(v) : toExpr(f.n);
  const ftxt = v ? ft(v) : tText(f.n);
  const divides = k > 0 && f.op === ":";
  if (k === 0 && sp.prod.f.length > 1 && sp.prod.f[1].op === ":") {
    return { msg: "Lo que está antes de una división no se puede pasar así. Pasá el número que divide." };
  }
  return {
    move: { kind: "factor", side, k, withSign },
    question: divides ? `La x está dividida por ${ftxt}. ¿Cómo pasa al otro lado?` : `¿Cómo pasa el ${ftxt} al otro lado?${v && v.n < 0 ? " (va con su signo)" : ""}`,
    options: divides
      ? [
          { label: "multiplicando", math: lead("·", shown), correct: true },
          { label: "dividiendo", math: lead(":", shown), correct: false, why: `Está dividiendo. Lo que divide pasa multiplicando.` },
        ]
      : [
          { label: "dividiendo", math: lead(":", shown), correct: true },
          { label: "multiplicando", math: lead("·", shown), correct: false, why: `El ${ftxt} está multiplicando. Lo que multiplica pasa dividiendo.` },
          { label: "restando", math: lead("-", shown), correct: false, why: `El ${ftxt} no está sumando: está multiplicando. Pasa dividiendo.` },
        ],
  };
}

function passExp(side: number, e: number, otherE: Expr) {
  const K = otherE;
  const options: ChoiceOpt[] =
    e === -1
      ? [
          { label: "el inverso", math: powE(K, -1), correct: true },
          { label: "el opuesto", math: negE(K), correct: false, why: "El exponente −1 no cambia el signo: indica el inverso (dar vuelta la fracción)." },
        ]
      : [
          { label: e === 2 ? "como raíz cuadrada" : `como raíz de índice ${e}`, math: rootE(e, K), correct: true },
          { label: `dividiendo por ${e}`, math: row(K, ":", N(e)), correct: false, why: `Elevar a la ${e} no es multiplicar por ${e}. Lo contrario de una potencia es una raíz.` },
          { label: "como potencia", math: powE(K, e), correct: false, why: "Lo contrario de elevar es sacar la raíz, no volver a elevar." },
        ];
  return {
    move: { kind: "exp" as const, side },
    question: e === -1 ? "x elevado a la −1 es el inverso de x. ¿Cuánto vale x?" : "¿Cómo pasa el exponente al otro lado?",
    options,
  };
}

function passRoot(side: number, otherE: Expr) {
  return {
    move: { kind: "root" as const, side },
    question: "La x está adentro de una raíz cuadrada. ¿Cómo pasa la raíz al otro lado?",
    options: [
      { label: "como potencia al cuadrado", math: powE(otherE, 2), correct: true },
      { label: "multiplicando por 2", math: row(otherE, "·", N(2)), correct: false, why: "Lo contrario de la raíz cuadrada es elevar al cuadrado, y elevar al cuadrado no es multiplicar por 2." },
      { label: "como raíz", math: rootE(2, otherE), correct: false, why: "Lo contrario de sacar la raíz es elevar al cuadrado." },
    ] as ChoiceOpt[],
  };
}

const wrapFactor = (t: T): T => (t.k === "sum" || t.k === "prod" ? tPar(t) : t);

export function applyPass(pz: PzSpec, m: Move): { pz: PzSpec; label: string } {
  const sides = [...pz.sides];
  const t = sides[m.side];
  const o = 1 - m.side;
  const dest = sides[o];
  let label = "";
  switch (m.kind) {
    case "term": {
      const term = m.k < 0 ? { s: 1 as const, n: t } : (t as Extract<T, { k: "sum" }>).t[m.k];
      sides[m.side] = m.k < 0 ? tn(F(0)) : { k: "sum", t: (t as Extract<T, { k: "sum" }>).t.filter((_, i) => i !== m.k) };
      const moved = { s: (term.s * -1) as 1 | -1, n: term.n };
      const destTerms = dest.k === "sum" ? [...dest.t] : dest.k === "n" && dest.v.isZero() ? [] : [{ s: 1 as const, n: dest }];
      // Llega al lado de los de su misma clase (x con x, números con números)
      const isX = hasX(term.n);
      let at = destTerms.length;
      for (let i = destTerms.length - 1; i >= 0; i--) {
        if (hasX(destTerms[i].n) === isX) {
          at = i + 1;
          break;
        }
      }
      destTerms.splice(at, 0, moved);
      sides[o] = { k: "sum", t: destTerms };
      label = term.s > 0 ? `Pasaste ${tText(term.n)} al otro lado: estaba sumando y llega restando.` : `Pasaste ${tText(term.n)} al otro lado: estaba restando y llega sumando.`;
      break;
    }
    case "factor": {
      const sp = sideProd(t)!;
      const f = sp.prod.f[m.k];
      const val = m.withSign ? tn(numVal(f.n).neg()) : f.n;
      const rest = sp.prod.f.filter((_, i) => i !== m.k).map((it, i) => ({ ...it, op: i === 0 ? ("" as MulOp) : it.op }));
      const remaining: T = rest.length === 1 ? rest[0].n : { k: "prod", f: rest };
      sides[m.side] = sp.negative && !m.withSign ? { k: "sum", t: [{ s: -1, n: remaining }] } : remaining;
      const divides = m.k > 0 && f.op === ":";
      sides[o] = { k: "prod", f: [{ op: "", n: wrapFactor(dest) }, { op: divides ? "·" : ":", n: wrapFactor(val) }] };
      label = divides ? `Pasaste el ${tText(val)} multiplicando.` : `Pasaste el ${tText(val)} dividiendo.`;
      break;
    }
    case "neg":
      sides[m.side] = (t as Extract<T, { k: "sum" }>).t[0].n;
      sides[o] = { k: "prod", f: [{ op: "", n: wrapFactor(dest) }, { op: ":", n: tPar(tn(F(-1))) }] };
      label = "Pasaste el signo menos dividiendo por −1.";
      break;
    case "exp": {
      const e = (t as Extract<T, { k: "pow" }>).e;
      sides[m.side] = tX;
      sides[o] = e === -1 ? tPow(wrapFactor(dest), -1) : tRoot(e, dest);
      label = e === -1 ? "El exponente −1 pasó al otro lado: x es el inverso." : e === 2 ? "La potencia pasó al otro lado como raíz cuadrada." : "La potencia pasó al otro lado como raíz.";
      break;
    }
    case "root":
      sides[m.side] = tX;
      sides[o] = tPow(wrapFactor(dest), 2);
      label = "La raíz pasó al otro lado como potencia.";
      break;
  }
  return { pz: { ...pz, sides: sides.map(normSide) }, label };
}

// ---------- Distributiva ----------

export function applyDistribute(pz: PzSpec, side: number, i: number, j: number): { pz: PzSpec; label: string } | { msg: string } {
  if (i > j) [i, j] = [j, i];
  const t = pz.sides[side];
  const lay = layout(t);
  const sel = analyze(t, lay, i, j);
  const bad = { msg: "La distributiva se usa cuando un número multiplica a un paréntesis con una suma o resta adentro. Marcá el número junto con el paréntesis." };
  if (!sel.ok) return { msg: sel.reason };
  let path: Path;
  let prod: Extract<T, { k: "prod" }>;
  if (sel.kind === "node") {
    const n = getNode(t, sel.path);
    if (n.k !== "prod") return bad;
    path = sel.path;
    prod = n;
  } else if (sel.kind === "factors" && sel.to - sel.from === 1) {
    const n = getNode(t, sel.path) as Extract<T, { k: "prod" }>;
    path = sel.path;
    prod = n;
    if (n.f.length !== 2) return bad;
  } else return bad;
  if (prod.f.length !== 2) return bad;
  const [a, b] = prod.f;
  const pIdx = a.n.k === "par" && a.n.n.k === "sum" ? 0 : b.n.k === "par" && b.n.n.k === "sum" ? 1 : -1;
  if (pIdx < 0 || (pIdx === 1 && b.op === ":")) return bad;
  const c = pIdx === 0 ? b.n : a.n;
  if (!isNumLeaf(c)) return bad;
  const inner = (pIdx === 0 ? a.n : b.n) as Extract<T, { k: "par" }>;
  const sum = inner.n as Extract<T, { k: "sum" }>;
  const divide = pIdx === 0 && b.op === ":";
  const terms = sum.t.map((it) => ({
    s: it.s,
    n: { k: "prod", f: [{ op: "" as MulOp, n: wrapFactor(c) }, { op: (divide ? ":" : it.n.k === "x" ? "" : "·") as MulOp, n: wrapFactor(it.n) }] } as T,
  }));
  const fixed = divide ? terms.map((it) => ({ s: it.s, n: { k: "prod", f: [{ op: "" as MulOp, n: wrapFactor((it.n as Extract<T, { k: "prod" }>).f[1].n) }, { op: ":" as MulOp, n: wrapFactor(c) }] } as T })) : terms;
  const next = setNode(t, path, { k: "sum", t: fixed });
  const sides = [...pz.sides];
  sides[side] = normSide(next);
  return { pz: { ...pz, sides }, label: `Aplicaste la distributiva: el ${tText(c)} ${divide ? "divide" : "multiplica"} a cada término del paréntesis.` };
}

// ---------- ¿Terminó? ----------

export function solvedValue(pz: PzSpec): Fraction | null {
  if (pz.kind === "calc") {
    const t = pz.sides[0];
    return isNumLeaf(t) ? numVal(t) : null;
  }
  for (const s of [0, 1]) {
    const a = pz.sides[s];
    const b = pz.sides[1 - s];
    if (a.k === "x" && isNumLeaf(b)) return numVal(b);
  }
  return null;
}

// ---------- Pista: el próximo pedazo conveniente ----------

export interface Hint {
  side: number;
  i: number;
  j: number;
  action: "resolver" | "pasar" | "distributiva";
  text: string;
}

type Piece = { path: Path } | { path: Path; terms: [number, number] } | { path: Path; factors: [number, number] };

function rangeOf(t: T, p: Piece): [number, number] {
  const lay = layout(t);
  if ("terms" in p) {
    const s = getNode(t, p.path) as Extract<T, { k: "sum" }>;
    const [a, b] = p.terms;
    const sign = s.t[a].s < 0 || a > 0 ? lay.toks.findIndex((u) => u.kind === "op" && u.slot === a && pk(u.path) === pk(p.path)) : -1;
    const start = s.t[a].s < 0 && sign >= 0 ? sign : lay.spans.get(pk([...p.path, a]))![0];
    return [start, lay.spans.get(pk([...p.path, b]))![1]];
  }
  if ("factors" in p) {
    const [a, b] = p.factors;
    return [lay.spans.get(pk([...p.path, a]))![0], lay.spans.get(pk([...p.path, b]))![1]];
  }
  return lay.spans.get(pk(p.path))!;
}

/** Una cuenta lista para hacer (sus partes ya son números), respetando qué va primero. */
export function readyPiece(t: T, path: Path = []): Piece | null {
  switch (t.k) {
    case "n":
    case "x":
      return null;
    case "par":
      return readyPiece(t.n, [...path, 0]);
    case "pow":
      return isNumLeaf(t.b) ? { path } : readyPiece(t.b, [...path, 0]);
    case "root":
      return isNumLeaf(t.n) ? { path } : readyPiece(t.n, [...path, 0]);
    case "prod": {
      for (let k = 0; k < t.f.length; k++) {
        const n = t.f[k].n;
        if (!isNumLeaf(n) && n.k !== "x") {
          const r = readyPiece(n, [...path, k]);
          if (r) return r;
        }
      }
      for (let k = 0; k + 1 < t.f.length; k++) {
        if (isNumLeaf(t.f[k].n) && isNumLeaf(t.f[k + 1].n) && (k === 0 || t.f[k].op !== ":")) return { path, factors: [k, k + 1] };
      }
      return null;
    }
    case "sum": {
      for (let k = 0; k < t.t.length; k++) {
        const n = t.t[k].n;
        if (!isNumLeaf(n) && !xCoef(n)) {
          const r = readyPiece(n, [...path, k]);
          if (r) return r;
        }
      }
      for (let k = 0; k + 1 < t.t.length; k++) {
        const a = t.t[k].n;
        const b = t.t[k + 1].n;
        if ((isNumLeaf(a) && isNumLeaf(b)) || (xCoef(a) && xCoef(b))) return { path, terms: [k, k + 1] };
      }
      return null;
    }
  }
}

function pieceText(t: T, p: Piece): string {
  if ("terms" in p) {
    const s = getNode(t, p.path) as Extract<T, { k: "sum" }>;
    return tText({ k: "sum", t: s.t.slice(p.terms[0], p.terms[1] + 1) });
  }
  if ("factors" in p) {
    const s = getNode(t, p.path) as Extract<T, { k: "prod" }>;
    return tText({ k: "prod", f: s.f.slice(p.factors[0], p.factors[1] + 1).map((f, i) => ({ ...f, op: i === 0 ? "" : f.op })) });
  }
  return tText(getNode(t, p.path));
}

function reasonFor(t: T, p: Piece): string {
  for (let k = 0; k <= p.path.length; k++) if (getNode(t, p.path.slice(0, k)).k === "par" && k < p.path.length) return "Primero va lo de adentro del paréntesis.";
  if ("factors" in p) return "Antes de sumar y restar van las multiplicaciones y divisiones.";
  if ("terms" in p) return "Ahora quedan sumas y restas.";
  const n = getNode(t, p.path);
  if (n.k === "pow" || n.k === "root") return "Primero van las potencias y raíces.";
  return "";
}

function hintResolve(pz: PzSpec, side: number, p: Piece, why?: string): Hint {
  const t = pz.sides[side];
  const [i, j] = rangeOf(t, p);
  const pre = why ?? reasonFor(t, p);
  return { side, i, j, action: "resolver", text: `${pre ? pre + " " : ""}Marcá ${pieceText(t, p)} y resolvelo.` };
}

export function hint(pz: PzSpec): Hint | null {
  if (solvedValue(pz)) return null;
  if (pz.kind === "calc") {
    const p = readyPiece(pz.sides[0]);
    return p ? hintResolve(pz, 0, p) : null;
  }
  const [L, R] = pz.sides;
  const xs = (t: T) => (t.k === "sum" ? t.t.filter((it) => hasX(it.n)).length : hasX(t) ? 1 : 0);
  // 1. Un número multiplicando a un paréntesis con x
  for (const s of [0, 1]) {
    const t = pz.sides[s];
    const sp = sideProd(t);
    if (sp && sp.prod.f.some((f) => f.n.k === "par" && hasX(f.n))) {
      const o = pz.sides[1 - s];
      if (!isNumLeaf(o) && !hasX(o)) {
        const p = readyPiece(o);
        if (p) return hintResolve(pz, 1 - s, p, "Primero resolvé el otro lado.");
      }
      const k = sp.prod.f.findIndex((f) => isNumLeaf(f.n));
      if (k >= 0 && !hasX(o)) {
        const lay = layout(t);
        const span = lay.spans.get(pk(sp.negative ? [0, k] : [k]))!;
        return { side: s, i: span[0], j: span[1], action: "pasar", text: `El ${tText(sp.prod.f[k].n)} multiplica a todo el paréntesis: marcalo y pasalo al otro lado.` };
      }
    }
  }
  // 2. Cuentas pendientes que no son juntar términos sueltos (por ejemplo 2/3 · 1/4, o un : después de pasar)
  for (const s of [0, 1]) {
    const t = pz.sides[s];
    const p = readyPiece(t);
    if (p && !("terms" in p && p.path.length === 0)) return hintResolve(pz, s, p, "Hay una cuenta pendiente.");
  }
  // 3. x de los dos lados
  if (xs(L) && xs(R)) {
    const keep = xs(L) >= xs(R) ? 0 : 1;
    const from = 1 - keep;
    const t = pz.sides[from];
    const lay = layout(t);
    if (t.k === "sum") {
      const k = t.t.findIndex((it) => hasX(it.n));
      const [i, j] = rangeOf(t, { path: [], terms: [k, k] });
      return { side: from, i, j, action: "pasar", text: `Hay x de los dos lados. Marcá ${tText(t.t[k].n)} y pasalo a la ${keep === 0 ? "izquierda" : "derecha"}.` };
    }
    const span = lay.spans.get("")!;
    return { side: from, i: span[0], j: span[1], action: "pasar", text: `Hay x de los dos lados. Marcá ${tText(t)} y pasalo a la ${keep === 0 ? "izquierda" : "derecha"}.` };
  }
  const xSide = xs(L) ? 0 : 1;
  const xt = pz.sides[xSide];
  // 4. Números del lado de la x
  if (xt.k === "sum") {
    const k = xt.t.findIndex((it) => !hasX(it.n));
    if (k >= 0) {
      const lay = layout(xt);
      const span = lay.spans.get(pk([k]))!;
      return { side: xSide, i: span[0], j: span[1], action: "pasar", text: `Para dejar sola la x, marcá ${tText(xt.t[k].n)} y pasalo al otro lado.` };
    }
  }
  // 5. Juntar del otro lado, 6. juntar las x
  for (const s of [1 - xSide, xSide]) {
    const p = readyPiece(pz.sides[s]);
    if (p) return hintResolve(pz, s, p, s === xSide ? "Juntá las x." : "Juntá los números.");
  }
  // 7. La x sola con algo que la acompaña
  const lay = layout(xt);
  const sp = sideProd(xt);
  if (xt.k === "pow") {
    const e = lay.toks.find((u) => u.kind === "exp")!;
    return { side: xSide, i: e.i, j: e.i, action: "pasar", text: "Marcá el exponente y pasalo al otro lado." };
  }
  if (xt.k === "root") return { side: xSide, i: 0, j: 0, action: "pasar", text: "Marcá el signo de la raíz y pasalo al otro lado." };
  if (xt.k === "sum" && xt.t.length === 1 && xt.t[0].n.k === "x") return { side: xSide, i: 0, j: 0, action: "pasar", text: "Marcá el signo menos de la x y pasalo al otro lado." };
  if (sp) {
    const k = sp.prod.f.findIndex((f) => !hasX(f.n));
    if (k >= 0) {
      const span = lay.spans.get(pk(sp.negative ? [0, k] : [k]))!;
      const start = sp.negative && k === 0 ? 0 : span[0];
      const divides = k > 0 && sp.prod.f[k].op === ":";
      return {
        side: xSide,
        i: start,
        j: span[1],
        action: "pasar",
        text: divides ? `La x está dividida: marcá el ${tText(sp.prod.f[k].n)} y pasalo al otro lado.` : `Marcá el número que multiplica a la x y pasalo al otro lado.`,
      };
    }
  }
  return null;
}
