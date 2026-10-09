// Mundo 3 · El Horno: suma y resta.
import { F, Fraction, gcd, lcm } from "../../math/fraction";
import { N, fr, frac, mixed, row, type Expr } from "../../math/expr";
import { DENS_MED, cleanTraps, ft, gen, nice, properFrac, retry, simplifySteps } from "../helpers";
import type { Question, Step, Trap } from "../types";

export interface Term {
  f: Fraction;
  op: "+" | "-";
}

export function termsExpr(terms: Term[], show?: Expr[]): Expr {
  const parts: (Expr | "+" | "-")[] = [];
  terms.forEach((t, i) => {
    const e = show?.[i] ?? fr(t.f);
    if (i === 0) {
      parts.push(t.op === "-" ? fr(t.f.neg()) : e);
    } else {
      parts.push(t.op, e);
    }
  });
  return row(...parts);
}

export function evalTerms(terms: Term[]) {
  return terms.reduce((acc, t, i) => (i === 0 ? (t.op === "-" ? t.f.neg() : t.f) : t.op === "+" ? acc.add(t.f) : acc.sub(t.f)), F(0));
}

/** Pasos para sumar/restar una lista de fracciones con denominador común. */
export function sumSteps(terms: Term[]): Step[] {
  const steps: Step[] = [];
  // Restar un negativo
  const hasMinusNeg = terms.some((t, i) => i > 0 && t.op === "-" && t.f.n < 0);
  let ts = terms;
  if (hasMinusNeg) {
    const fixed: Term[] = terms.map((t, i) => (i > 0 && t.op === "-" && t.f.n < 0 ? { f: t.f.neg(), op: "+" } : t));
    steps.push({
      text: "Restar un número negativo es lo mismo que sumar su opuesto:",
      math: row(termsExpr(terms), "=", termsExpr(fixed)),
    });
    ts = fixed;
  }
  const L = ts.reduce((acc, t) => lcm(acc, t.f.d), 1);
  const nums = ts.map((t) => t.f.n * (L / t.f.d));
  const same = ts.every((t) => t.f.d === L);
  if (!same) {
    const dens = [...new Set(ts.map((t) => t.f.d))];
    steps.push({
      text:
        dens.length === 1
          ? ""
          : `Buscamos un denominador común: el mínimo común múltiplo de ${dens.slice(0, -1).join(", ")} y ${dens[dens.length - 1]} es ${L}.`,
    });
    const conv: (Expr | "   y   ")[] = [];
    ts.forEach((t, i) => {
      if (t.f.d === L) return;
      if (conv.length) conv.push("   y   ");
      conv.push(row(fr(t.f), "=", frac(row(N(t.f.n), "·", N(L / t.f.d)), row(N(t.f.d), "·", N(L / t.f.d))), "=", N(nums[i], L)));
    });
    steps.push({ text: "Ampliamos cada fracción para que tenga ese denominador:", math: row(...conv) });
  }
  // Operación con numeradores
  const numRowParts: (Expr | "+" | "-")[] = [];
  ts.forEach((t, i) => {
    if (i === 0) numRowParts.push(N(t.op === "-" ? -nums[i] : nums[i]));
    else numRowParts.push(t.op, N(nums[i]));
  });
  const total = ts.reduce((acc, t, i) => (i === 0 ? (t.op === "-" ? -nums[i] : nums[i]) : t.op === "+" ? acc + nums[i] : acc - nums[i]), 0);
  const commonExpr = termsExpr(ts, ts.map((_, i) => N(nums[i], L)));
  steps.push({
    text: same ? "Tienen el mismo denominador: operamos los numeradores y el denominador queda igual." : "Ahora operamos los numeradores y el denominador queda igual:",
    math: row(commonExpr, "=", frac(row(...numRowParts), L), "=", N(total, L)),
  });
  steps.push(...simplifySteps(total, L));
  return steps.filter((s) => s.text !== "" || s.math);
}

function twoTermTraps(a: Fraction, op: "+" | "-", b: Fraction, ans: Fraction): Trap[] {
  const L = lcm(a.d, b.d);
  const traps: Trap[] = [];
  const sgn = op === "+" ? 1 : -1;
  if (a.d === b.d) {
    if (op === "+") traps.push({ value: F(a.n + b.n, 2 * a.d), msg: `Sumaste los denominadores. Si el denominador es el mismo, queda igual (${a.d}): solo se suman los numeradores.` });
    else traps.push({ value: F(a.n - b.n, 1), msg: `Te olvidaste del denominador. Si es el mismo, queda igual: el resultado sigue siendo en ${a.d === 2 ? "medios" : `partes de ${a.d}`}.` });
  } else {
    const dd = a.d + sgn * b.d;
    if (dd > 0)
      traps.push({
        value: F(a.n + sgn * b.n, dd),
        msg: `${op === "+" ? "Sumaste" : "Restaste"} numerador con numerador y denominador con denominador. Así no se puede: primero hay que llevar las fracciones a un denominador común (${L}).`,
      });
    traps.push({
      value: F(a.n + sgn * b.n, L),
      msg: `Usaste el denominador común ${L}, pero te faltó ampliar los numeradores: si el denominador se multiplica, el numerador también.`,
    });
  }
  const other = op === "+" ? a.sub(b) : a.add(b);
  if (b.n < 0) {
    traps.push({
      value: other,
      msg:
        op === "-"
          ? `Restar un negativo es sumar su opuesto: ${ft(a)} − (${ft(b)}) = ${ft(a)} + ${ft(b.neg())}.`
          : `Sumar un negativo es restar: ${ft(a)} + (${ft(b)}) = ${ft(a)} − ${ft(b.neg())}.`,
    });
  } else {
    traps.push({ value: other, msg: `Fijate la operación: es una ${op === "+" ? "suma" : "resta"}.` });
  }
  return cleanTraps(ans, traps);
}

const RULE_SAME = "Con el mismo denominador, se suman o restan los numeradores y el denominador queda igual.";
const RULE_DIFF = "Con distinto denominador, primero se buscan fracciones equivalentes con un denominador común (el mcm) y después se operan los numeradores.";

function buildTwo(a: Fraction, op: "+" | "-", b: Fraction, story?: string): Question {
  const ans = op === "+" ? a.add(b) : a.sub(b);
  const terms: Term[] = [
    { f: a, op: "+" },
    { f: b, op },
  ];
  const same = a.d === b.d;
  return {
    gen: "",
    title: op === "+" ? "Resolvé la suma" : "Resolvé la resta",
    story,
    math: row(termsExpr(terms), "=", { t: "q" }),
    answer: { kind: "fraction", value: ans },
    traps: twoTermTraps(a, op, b, ans),
    hint: same
      ? [{ text: "Tienen el mismo denominador: operá solo los numeradores." }]
      : [{ text: `Buscá un denominador común: un número que sea múltiplo de ${a.d} y de ${b.d}.` }],
    steps: sumSteps(terms),
    rule: same ? RULE_SAME : RULE_DIFF,
  };
}

const STORIES_SUM = [
  "Una mesa pidió dos porciones distintas. ¿Cuánta pizza es en total?",
  "Sumá lo que salió del horno en dos tandas.",
  "Juntá lo que quedó en dos bandejas.",
];
const STORIES_SUB = ["Había esto y se vendió una parte. ¿Cuánto queda?", "¿Cuánto más comió uno que el otro?"];

export const sumaMismoDen = gen("w3-mismo-den", (r) => {
  return retry(() => {
    const d = r.int(3, 12);
    const op = r.pick(["+", "-"] as const);
    const a = op === "+" ? r.int(1, d - 1) : r.int(2, d + 3);
    const b = r.int(1, d - 1);
    if (op === "-" && a <= b) return null;
    // Se muestran sin reducir para que el denominador sea el mismo.
    const fa = F(a, d);
    const fb = F(b, d);
    const ans = op === "+" ? fa.add(fb) : fa.sub(fb);
    if (!nice(ans)) return null;
    const terms = [
      { f: fa, op: "+" as const },
      { f: fb, op },
    ];
    const total = op === "+" ? a + b : a - b;
    return {
      gen: "",
      title: op === "+" ? "Resolvé la suma" : "Resolvé la resta",
      story: r.pick(op === "+" ? STORIES_SUM : STORIES_SUB),
      math: row(termsExpr(terms, [N(a, d), N(b, d)]), "=", { t: "q" }),
      pizzas: d <= 8 && op === "+" && a + b <= 2 * d ? [{ slices: d, filled: a }, { slices: d, filled: b }] : undefined,
      answer: { kind: "fraction" as const, value: ans },
      traps: cleanTraps(ans, [
        op === "+"
          ? { value: F(a + b, 2 * d), msg: `Sumaste los denominadores. Si el denominador es el mismo, queda igual (${d}): solo se suman los numeradores.` }
          : { value: F(a - b, 1), msg: `Te olvidaste del denominador. Si es el mismo, queda igual: el resultado es ${ft(a - b, d)}.` },
        { value: op === "+" ? F(a - b, d) : F(a + b, d), msg: `Fijate la operación: es una ${op === "+" ? "suma" : "resta"}.` },
      ]),
      hint: [{ text: `Las dos son porciones de ${d}. Contá cuántas porciones hay ${op === "+" ? "en total" : "después de sacar"}.` }],
      steps: [
        {
          text: "Tienen el mismo denominador: operamos los numeradores y el denominador queda igual.",
          math: row(termsExpr(terms, [N(a, d), N(b, d)]), "=", frac(row(N(a), op, N(b)), d), "=", N(total, d)),
        },
        ...simplifySteps(total, d),
      ],
      rule: RULE_SAME,
    };
  });
});

export const sumaDistintoDen = gen("w3-distinto-den", (r) => {
  return retry(() => {
    const a = properFrac(r, DENS_MED);
    const b = properFrac(r, DENS_MED);
    if (a.d === b.d) return null;
    const op = r.pick(["+", "-"] as const);
    if (op === "-" && a.compare(b) <= 0) return null;
    const res = op === "+" ? a.add(b) : a.sub(b);
    if (!nice(res, 72)) return null;
    return buildTwo(a, op, b, r.pick(op === "+" ? STORIES_SUM : STORIES_SUB));
  });
});

export const sumaNegativos = gen("w3-negativos", (r) => {
  return retry(() => {
    const kind = r.int(0, 3);
    const a = properFrac(r, DENS_MED);
    const b = properFrac(r, DENS_MED);
    if (kind === 0) {
      // −a + b  ó  −a − b
      const op = r.pick(["+", "-"] as const);
      const ans = op === "+" ? a.neg().add(b) : a.neg().sub(b);
      if (!nice(ans, 72)) return null;
      return buildTwo(a.neg(), op, b);
    }
    if (kind === 1) {
      // a − b con resultado negativo
      if (a.compare(b) >= 0 || a.d === b.d) return null;
      return buildTwo(a, "-", b, "Ojo: acá se saca más de lo que hay.");
    }
    if (kind === 2) {
      // a − (−b)  ó  a + (−b)
      const op = r.pick(["+", "-"] as const);
      const q = buildTwo(a, op, b.neg());
      if (!nice(q.answer.kind === "fraction" ? q.answer.value : F(0), 72)) return null;
      return q;
    }
    // entero ± fracción
    const n = r.int(1, 4) * r.sign();
    const op = r.pick(["+", "-"] as const);
    const q = buildTwo(F(n), op, b);
    q.hint = [{ text: `Un entero es una fracción con denominador 1: ${n} = ${ft(n * b.d, b.d)}.` }];
    return q;
  });
});

export const sumaMixtos = gen("w3-mixtos", (r) => {
  return retry(() => {
    const d1 = r.pick([2, 3, 4, 5, 6, 8]);
    const d2 = r.pick([2, 3, 4, 5, 6, 8]);
    const w1 = r.int(1, 3);
    const w2 = r.int(1, 2);
    const n1 = r.int(1, d1 - 1);
    const n2 = r.int(1, d2 - 1);
    if (gcd(n1, d1) !== 1 || gcd(n2, d2) !== 1) return null;
    const f1 = F(w1 * d1 + n1, d1);
    const f2 = F(w2 * d2 + n2, d2);
    const op = r.pick(["+", "-"] as const);
    const ans = op === "+" ? f1.add(f2) : f1.sub(f2);
    if (!nice(ans, 48) || ans.n <= 0) return null;
    const terms: Term[] = [
      { f: f1, op: "+" },
      { f: f2, op },
    ];
    // Error típico: operar enteros con enteros y fracciones "derecho" (numerador con numerador, denominador con denominador)
    const dd = op === "+" ? d1 + d2 : d1 - d2;
    const wrongParts = dd > 0 && d1 !== d2 ? F(op === "+" ? w1 + w2 : w1 - w2).add(F(op === "+" ? n1 + n2 : n1 - n2, dd)) : null;
    return {
      gen: "",
      title: "Resolvé (respondé con una fracción)",
      story: op === "+" ? "Para la masa se usan estos kilos de harina en dos tandas. ¿Cuántos kilos son en total?" : "Había estos kilos de harina y se usó una parte. ¿Cuántos kilos quedan?",
      math: row(mixed(w1, n1, d1), op, mixed(w2, n2, d2), "=", { t: "q" }),
      answer: { kind: "fraction" as const, value: ans },
      traps: cleanTraps(ans, [
        ...(wrongParts
          ? [{ value: wrongParts, msg: `Operaste los enteros bien, pero las fracciones ${op === "+" ? "las sumaste" : "las restaste"} numerador con numerador y denominador con denominador. Hace falta denominador común: lo más seguro es pasar cada mixto a fracción.` }]
          : []),
      ]),
      hint: [{ text: `Primero pasá cada número mixto a fracción: ${w1} ${ft(n1, d1)} = ${ft(f1)}.` }],
      steps: [
        {
          text: "Pasamos cada número mixto a fracción (entero por denominador, más el numerador):",
          math: row(mixed(w1, n1, d1), "=", fr(f1), "   y   ", mixed(w2, n2, d2), "=", fr(f2)),
        },
        ...sumSteps(terms),
      ],
      rule: "Para operar números mixtos, conviene pasarlos a fracción primero.",
    };
  });
});

export const sumaTres = gen("w3-tres", (r) => {
  return retry(() => {
    const dens = [2, 3, 4, 5, 6, 8, 10, 12];
    const a = properFrac(r, dens);
    const b = properFrac(r, dens);
    const c = properFrac(r, dens);
    const ops = [r.pick(["+", "-"] as const), r.pick(["+", "-"] as const)];
    const terms: Term[] = [
      { f: r.chance(0.3) ? a.neg() : a, op: "+" },
      { f: b, op: ops[0] },
      { f: c, op: ops[1] },
    ];
    const L = terms.reduce((acc, t) => lcm(acc, t.f.d), 1);
    if (L > 30 || new Set(terms.map((t) => t.f.d)).size < 2) return null;
    const ans = evalTerms(terms);
    if (!nice(ans, 30)) return null;
    return {
      gen: "",
      title: "Resolvé",
      story: "Tres hornadas, una cuenta.",
      math: row(termsExpr(terms), "=", { t: "q" }),
      answer: { kind: "fraction" as const, value: ans },
      traps: cleanTraps(ans, [
        { value: F(terms.reduce((s, t, i) => s + (i === 0 || t.op === "+" ? t.f.n : -t.f.n), 0), L), msg: `Usaste el denominador común ${L}, pero te faltó ampliar los numeradores.` },
      ]),
      hint: [{ text: "Buscá un denominador común para las tres fracciones." }],
      steps: sumSteps(terms),
      rule: RULE_DIFF,
    };
  });
});

