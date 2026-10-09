// Evaluador numérico de expresiones, solo para los tests: verifica que
// cada igualdad que aparece en las explicaciones sea verdadera.
import { F, Fraction, decimalStringToFraction } from "../src/math/fraction";
import type { Expr } from "../src/math/expr";
import { periodicToFraction } from "../src/game/gen/w2";

type Part = Expr | { op: string };

export function evaluate(e: Expr): Fraction | null {
  switch (e.t) {
    case "num":
      return e.d === 0 ? null : F(e.n, e.d);
    case "frac": {
      const n = evaluate(e.n);
      const d = evaluate(e.d);
      if (!n || !d || d.isZero()) return null;
      return n.div(d);
    }
    case "dec":
      return decimalStringToFraction(e.s);
    case "per": {
      const f = periodicToFraction(e.int, e.ante, e.period).f;
      return e.neg ? f.neg() : f;
    }
    case "mixed": {
      const f = F(e.w).add(F(e.n, e.d));
      return e.neg ? f.neg() : f;
    }
    case "paren":
    case "hl":
      return evaluate(e.x);
    case "neg": {
      const v = evaluate(e.x);
      return v ? v.neg() : null;
    }
    case "pow": {
      const b = evaluate(e.b);
      const x = evaluate(e.e);
      if (!b || !x || !x.isInteger()) return null;
      if (b.isZero() && x.n <= 0) return null;
      return b.pow(x.n);
    }
    case "root": {
      const v = evaluate(e.x);
      return v ? v.root(e.k) : null;
    }
    case "row":
      return evalRow(e.parts);
    default:
      return null; // var, coef, q, text
  }
}

function evalRow(parts: Part[]): Fraction | null {
  if (parts.some((p) => "op" in p && !["+", "-", "·", ":"].includes(p.op))) return null;
  // tokens: valor, op, valor, op, ...
  const vals: Fraction[] = [];
  const ops: string[] = [];
  let expectValue = true;
  for (const p of parts) {
    if ("op" in p) {
      if (expectValue) return null;
      ops.push(p.op);
      expectValue = true;
    } else {
      if (!expectValue) return null;
      const v = evaluate(p);
      if (!v) return null;
      vals.push(v);
      expectValue = false;
    }
  }
  if (expectValue || !vals.length) return null;
  // Primero · y :
  const v2: Fraction[] = [vals[0]];
  const o2: string[] = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const v = vals[i + 1];
    if (op === "·") v2[v2.length - 1] = v2[v2.length - 1].mul(v);
    else if (op === ":") {
      if (v.isZero()) return null;
      v2[v2.length - 1] = v2[v2.length - 1].div(v);
    } else {
      o2.push(op);
      v2.push(v);
    }
  }
  let acc = v2[0];
  for (let i = 0; i < o2.length; i++) acc = o2[i] === "+" ? acc.add(v2[i + 1]) : acc.sub(v2[i + 1]);
  return acc;
}

const isSeparator = (p: Part) =>
  ("op" in p && ["<", ">", "→", "⇒", "≠"].includes(p.op)) || (!("op" in p) && p.t === "text" && /^\s*(y|o|⇒)?\s*$/.test(p.s));

/** Devuelve las igualdades falsas encontradas (recorre filas anidadas). */
export function findFalseEqualities(e: Expr | undefined, out: string[] = []): string[] {
  if (!e) return out;
  if (e.t === "row") {
    // grupos separados por textos en blanco o " y "
    const groups: Part[][] = [[]];
    for (const p of e.parts) {
      if (isSeparator(p)) groups.push([]);
      else groups[groups.length - 1].push(p);
    }
    for (const g of groups) {
      const segs: Part[][] = [[]];
      for (const p of g) {
        if ("op" in p && p.op === "=") segs.push([]);
        else segs[segs.length - 1].push(p);
      }
      if (segs.length < 2) continue;
      const values = segs.map((s) => (s.length === 1 && !("op" in s[0]) ? evaluate(s[0]) : evalRow(s)));
      const known = values.filter((v): v is Fraction => v !== null);
      for (let i = 1; i < known.length; i++) {
        if (!known[i].equals(known[0])) out.push(`${known[0]} ≠ ${known[i]}`);
      }
    }
    for (const p of e.parts) if (!("op" in p)) findFalseEqualities(p, out);
  } else if ("x" in e && typeof e.x === "object") findFalseEqualities(e.x as Expr, out);
  else if (e.t === "frac") {
    findFalseEqualities(e.n, out);
    findFalseEqualities(e.d, out);
  } else if (e.t === "pow") findFalseEqualities(e.b, out);
  return out;
}

export function containsValue(e: Expr | undefined, f: Fraction): boolean {
  if (!e) return false;
  const v = e.t === "row" ? null : evaluate(e);
  if (v && v.equals(f)) return true;
  if (e.t === "row") return e.parts.some((p) => !("op" in p) && containsValue(p, f));
  if (e.t === "frac") return containsValue(e.n, f) || containsValue(e.d, f);
  if ("x" in e && typeof e.x === "object") return containsValue(e.x as Expr, f);
  return false;
}
