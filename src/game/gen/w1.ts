// Mundo 1 · El Mostrador: leer porciones, fracciones equivalentes, simplificar y comparar.
import { F, Fraction, gcd, lcm } from "../../math/fraction";
import { N, Q, frac, fr, row, mixedOf, type Expr } from "../../math/expr";
import type { Rng } from "../../math/rng";
import { cleanTraps, ft, gen, retry } from "../helpers";
import type { Choice, PizzaSpec, Question, Step } from "../types";

const RULE_READ =
  "El denominador dice en cuántas partes iguales se cortó el entero. El numerador dice cuántas de esas partes hay.";
const RULE_EQUIV =
  "Dos fracciones son equivalentes si se obtiene una de la otra multiplicando (o dividiendo) numerador y denominador por el mismo número.";

export const leerPizza = gen("w1-leer", (r) => {
  const s = r.pick([3, 4, 5, 6, 8, 10, 12]);
  const k = r.int(1, s - 1);
  const ans = F(k, s);
  return {
    gen: "",
    title: "¿Qué fracción de la pizza queda?",
    story: r.pick([
      "Esto quedó en la bandeja después del almuerzo.",
      "Mirá lo que sobró de la mesa 3.",
      "El repartidor volvió con esta pizza.",
    ]),
    pizzas: [{ slices: s, filled: k }],
    answer: { kind: "fraction", value: ans },
    traps: cleanTraps(ans, [
      {
        value: F(s - k, s),
        msg: `Contaste las porciones que faltan (${s - k}), no las que quedan (${k}).`,
      },
      {
        value: F(s, k),
        msg: "Lo diste vuelta: abajo va en cuántas porciones se cortó la pizza y arriba cuántas porciones hay.",
      },
    ]),
    hint: [{ text: "Contá en cuántas porciones iguales está cortada la pizza: ese número va abajo." }],
    steps: [
      { text: `La pizza está cortada en ${s} porciones iguales: el denominador es ${s}.` },
      { text: `${k === 1 ? "Queda 1 porción" : `Quedan ${k} porciones`}: el numerador es ${k}.`, math: N(k, s) },
      ...(gcd(k, s) > 1 ? [{ text: `También vale simplificada (${k} y ${s} se pueden dividir por ${gcd(k, s)}):`, math: row(N(k, s), "=", fr(ans)) }] : []),
    ],
    rule: RULE_READ,
  };
});

export const leerPizzaImpropia = gen("w1-impropia", (r) => {
  const s = r.pick([2, 3, 4, 6, 8]);
  const w = r.int(1, 2);
  const k = r.int(1, s - 1);
  const total = w * s + k;
  const ans = F(total, s);
  return {
    gen: "",
    title: "¿Cuánta pizza hay en total?",
    story: `Todas las pizzas se cortaron en ${s} porciones. Escribí el total como una sola fracción.`,
    pizzas: [{ slices: s, filled: total }],
    answer: { kind: "fraction", value: ans },
    traps: cleanTraps(ans, [
      { value: F(k, s), msg: `Te olvidaste de ${w === 1 ? "la pizza entera" : "las pizzas enteras"}: cada pizza entera son ${ft(s, s)}.` },
      { value: F(w + k, s), msg: `Cada pizza entera tiene ${s} porciones, no 1. Son ${w}·${s} + ${k} porciones.` },
      { value: F(total, s * (w + 1)), msg: `El denominador es en cuántas porciones se corta UNA pizza (${s}), no el total de porciones de todas.` },
    ]),
    hint: [{ text: `Cada pizza entera tiene ${s} porciones. Contá todas las porciones que hay.` }],
    steps: [
      { text: `Cada pizza está cortada en ${s}: el denominador es ${s}.` },
      {
        text: `Hay ${w} ${w === 1 ? "pizza entera" : "pizzas enteras"} (${w}·${s} = ${w * s} porciones) y ${k === 1 ? "1 porción" : `${k} porciones`} más.`,
        math: row(N(w * s + k, s)),
      },
      { text: "Como número mixto se escribe así:", math: row(N(total, s), "=", mixedOf(ans)) },
    ],
    rule: "Si el numerador es mayor que el denominador, la fracción es mayor que 1 (fracción impropia).",
  };
});

export const elegirPizza = gen("w1-elegir", (r) => {
  return retry(() => {
    const s = r.pick([4, 5, 6, 8]);
    const k = r.int(1, s - 1);
    const target = F(k, s);
    const s2 = r.pick([4, 5, 6, 8].filter((x) => x !== s));
    const k2 = k + r.pick([1, -1]);
    const cands: (PizzaSpec & { why: string })[] = [
      { slices: s, filled: s - k, why: `Esa pizza muestra las porciones que faltan: ${ft(s - k, s)}.` },
      {
        slices: s2,
        filled: Math.min(k, s2 - 1),
        why: `Esa pizza está cortada en ${s2} partes, así que muestra ${ft(Math.min(k, s2 - 1), s2)}.`,
      },
      { slices: s, filled: k2, why: `Contá de nuevo: esa tiene ${k2} porciones de ${s}, o sea ${ft(k2, s)}.` },
      { slices: s2, filled: s2 - Math.min(k, s2 - 1), why: `Esa muestra ${ft(s2 - Math.min(k, s2 - 1), s2)}.` },
    ];
    const used = [target];
    const wrong: (PizzaSpec & { why: string })[] = [];
    for (const c of cands) {
      if (c.filled <= 0 || c.filled >= c.slices) continue;
      const v = F(c.filled, c.slices);
      if (used.some((u) => u.equals(v))) continue;
      used.push(v);
      wrong.push(c);
      if (wrong.length === 3) break;
    }
    if (wrong.length < 3) return null;
    const correctOpt: Choice = { pizza: { slices: s, filled: k } };
    const opts: Choice[] = r.shuffle([correctOpt, ...wrong.map((w) => ({ pizza: { slices: w.slices, filled: w.filled }, why: w.why }))]);
    return {
      gen: "",
      title: "¿Qué pizza muestra esta fracción?",
      story: "El cliente pidió exactamente esta parte de una pizza:",
      math: N(k, s),
      answer: { kind: "choice" as const, options: opts, correct: opts.indexOf(correctOpt) },
      hint: [{ text: `Buscá una pizza cortada en ${s} porciones iguales que tenga ${k}.` }],
      steps: [
        { text: `${ft(k, s)} significa: cortar la pizza en ${s} porciones iguales y tomar ${k}.` },
      ],
      rule: RULE_READ,
    };
  });
});

export const equivFaltante = gen("w1-equiv", (r) => {
  const b = r.pick([2, 3, 4, 5, 6, 7, 8, 9]);
  let a = r.int(1, b + 3);
  while (gcd(a, b) !== 1 || a === b) a = r.int(1, b + 3);
  const m = r.int(2, 6);
  const v = r.int(0, 2);
  let steps: Step[];
  let math;
  let ans: number;
  let traps;
  if (v === 0) {
    // a/b = ?/bm
    ans = a * m;
    math = row(N(a, b), "=", frac(Q(), b * m));
    traps = cleanTraps(ans, [
      { value: a + (b * m - b), msg: `Sumaste ${b * m - b} abajo y arriba. Para que sea equivalente hay que MULTIPLICAR arriba y abajo por el mismo número (acá, ${m}).` },
      { value: b * m, msg: "Copiaste el denominador. El numerador también tiene que multiplicarse." },
    ]);
    steps = [
      { text: `Para pasar de ${b} a ${b * m} se multiplicó por ${m} (porque ${b}·${m} = ${b * m}).` },
      { text: `Hacemos lo mismo con el numerador: ${a}·${m} = ${a * m}.`, math: row(N(a, b), "=", frac(row(N(a), "·", N(m)), row(N(b), "·", N(m))), "=", N(a * m, b * m)) },
    ];
  } else if (v === 1) {
    // a/b = am/?
    ans = b * m;
    math = row(N(a, b), "=", frac(a * m, Q()));
    traps = cleanTraps(ans, [
      { value: b + (a * m - a), msg: `Sumaste ${a * m - a}. Para que sea equivalente hay que MULTIPLICAR arriba y abajo por el mismo número (acá, ${m}).` },
    ]);
    steps = [
      { text: `Para pasar de ${a} a ${a * m} se multiplicó por ${m}.` },
      { text: `Hacemos lo mismo con el denominador: ${b}·${m} = ${b * m}.`, math: row(N(a, b), "=", frac(row(N(a), "·", N(m)), row(N(b), "·", N(m))), "=", N(a * m, b * m)) },
    ];
  } else {
    // am/bm = ?/b
    ans = a;
    math = row(N(a * m, b * m), "=", frac(Q(), b));
    traps = cleanTraps(ans, [
      { value: a * m - (b * m - b), msg: `Restaste ${b * m - b}. Para simplificar hay que DIVIDIR arriba y abajo por el mismo número (acá, ${m}).` },
    ]);
    steps = [
      { text: `Para pasar de ${b * m} a ${b} se dividió por ${m}.` },
      { text: `Hacemos lo mismo arriba: ${a * m} : ${m} = ${a}.`, math: row(N(a * m, b * m), "=", frac(row(N(a * m), ":", N(m)), row(N(b * m), ":", N(m))), "=", N(a, b)) },
    ];
  }
  return {
    gen: "",
    title: "Completá para que sean equivalentes",
    math,
    answer: { kind: "integer", value: ans },
    traps,
    hint: [{ text: "Fijate por qué número se multiplicó (o dividió) la parte que está completa." }],
    steps,
    rule: RULE_EQUIV,
  };
});

export const equivElegir = gen("w1-equiv-elegir", (r) => {
  return retry(() => {
    const b = r.pick([3, 4, 5, 6, 7, 8]);
    const a = r.int(1, b - 1);
    if (gcd(a, b) !== 1) return null;
    const m = r.int(2, 5);
    const opts: Choice[] = [
      { math: N(a * m, b * m) },
      { math: N(a + m, b + m), why: "Sumar el mismo número arriba y abajo NO da una fracción equivalente. Hay que multiplicar o dividir." },
      { math: N(a * m, b), why: "Multiplicaste solo el numerador. Hay que multiplicar arriba y abajo por el mismo número." },
      { math: N(b, a), why: "Esa es la inversa: da vuelta numerador y denominador, y no vale lo mismo." },
    ];
    const vals = [F(a * m, b * m), F(a + m, b + m), F(a * m, b), F(b, a)];
    for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length; j++) if (vals[i].equals(vals[j])) return null;
    const correct = opts[0];
    const shuffled = r.shuffle(opts);
    return {
      gen: "",
      title: "¿Cuál es equivalente?",
      story: `El cliente quiere ${ft(a, b)} de pizza, pero la pizza se cortó distinto. ¿Cuál le sirve?`,
      math: N(a, b),
      answer: { kind: "choice" as const, options: shuffled, correct: shuffled.indexOf(correct) },
      hint: [{ text: "Buscá la que se obtiene multiplicando arriba y abajo por el mismo número." }],
      steps: [
        {
          text: `Multiplicando arriba y abajo por ${m}:`,
          math: row(N(a, b), "=", frac(row(N(a), "·", N(m)), row(N(b), "·", N(m))), "=", N(a * m, b * m)),
        },
      ],
      rule: RULE_EQUIV,
    };
  });
});

function primeFactors(m: number) {
  const out: number[] = [];
  let x = m;
  for (let p = 2; p * p <= x; p++) while (x % p === 0) (out.push(p), (x /= p));
  if (x > 1) out.push(x);
  return out;
}

export const simplificar = gen("w1-simplificar", (r) => {
  return retry(() => {
    const b = r.int(2, 12);
    const a = r.int(1, 2 * b);
    if (gcd(a, b) !== 1 || a === b) return null;
    const m = r.pick([2, 3, 4, 5, 6, 8, 9, 10, 12]);
    const n = a * m;
    const d = b * m;
    if (n > 150 || d > 150) return null;
    const ans = F(a, b);
    // División de a poco, por factores primos de m (de mayor a menor).
    const fs = primeFactors(m).sort((x, y) => y - x);
    const chainParts: (ReturnType<typeof N> | "=")[] = [N(n, d)];
    let cn = n;
    let cd = d;
    for (const p of fs) {
      cn /= p;
      cd /= p;
      chainParts.push("=", N(cn, cd));
    }
    const steps: Step[] = [
      { text: `Buscamos un número que divida a ${n} y a ${d}. El más grande (el MCD) es ${m}.` },
      { text: `Dividimos arriba y abajo por ${m}:`, math: row(N(n, d), "=", frac(row(N(n), ":", N(m)), row(N(d), ":", N(m))), "=", N(a, b)) },
    ];
    if (fs.length > 1) steps.push({ text: "También se puede ir de a poco, dividiendo por números chicos:", math: row(...chainParts) });
    steps.push({ text: `${ft(a, b)} es irreducible: ${a} y ${b} no tienen divisores en común (salvo el 1).` });
    return {
      gen: "",
      title: "Simplificá hasta que sea irreducible",
      math: N(n, d),
      answer: { kind: "fraction" as const, value: ans, mustSimplify: true },
      traps: cleanTraps(ans, [
        { value: F(a, d), msg: "Dividiste solo el numerador. Hay que dividir los dos por el mismo número." },
        { value: F(n, b), msg: "Dividiste solo el denominador. Hay que dividir los dos por el mismo número." },
      ]),
      hint: [{ text: `Probá dividir ${n} y ${d} por ${fs[fs.length - 1]}. Seguí hasta que no se pueda más.` }],
      steps,
      rule: "Para simplificar, se divide numerador y denominador por el mismo número. Es irreducible cuando ya no tienen divisores comunes.",
    };
  });
});

function compareSteps(a: Fraction, b: Fraction): Step[] {
  const L = lcm(a.d, b.d);
  const A = a.n * (L / a.d);
  const B = b.n * (L / b.d);
  const sym = A < B ? "<" : A > B ? ">" : "=";
  const result: Step = { math: row(fr(a), sym, fr(b)) };
  // Signos distintos: no hace falta ninguna cuenta.
  if ((a.n < 0 && b.n > 0) || (a.n > 0 && b.n < 0)) {
    return [{ ...result, text: "Una es negativa y la otra positiva: cualquier número positivo es mayor que cualquier negativo." }];
  }
  const steps: Step[] = [];
  if (a.d !== b.d) {
    steps.push({
      text: `Las llevamos al mismo denominador, ${L}:`,
      math: row(fr(a), "=", N(A, L), "   y   ", fr(b), "=", N(B, L)),
    });
  }
  steps.push({
    ...result,
    text:
      A === B
        ? "Valen lo mismo: son equivalentes."
        : A < 0
          ? `Comparamos los numeradores: ${A} ${sym} ${B}. Con dos negativos, es mayor el que está más cerca del 0.`
          : `Con el mismo denominador, gana el numerador más grande: ${A} ${sym} ${B}.`,
  });
  return steps;
}

function makeCompare(withNeg: boolean) {
  return (r: Rng) => {
    const kind = r.int(0, 3);
    if (kind === 0) {
      // mismo numerador, distinto denominador
      return retry(() => {
        const n = r.int(1, 5);
        const d1 = r.int(n + 1, 12);
        const d2 = r.int(n + 1, 12);
        if (d1 === d2 || gcd(n, d1) !== 1 || gcd(n, d2) !== 1) return null;
        const a = F(n, d1);
        const b = F(n, d2);
        return buildCompare(r, a, b, fr(a), fr(b), withNeg);
      });
    }
    if (kind === 1) {
      // equivalentes escritas distinto
      return retry(() => {
        const d = r.int(2, 7);
        const n = r.int(1, d - 1);
        if (gcd(n, d) !== 1) return null;
        const [m1, m2] = r.shuffle([1, 2, 3, 4, 5]).slice(0, 2);
        const base = F(n, d);
        return buildCompare(r, base, base, N(n * m1, d * m1), N(n * m2, d * m2), withNeg);
      });
    }
    return retry(() => {
      const d1 = r.int(2, 12);
      const n1 = r.int(1, d1 - 1);
      const d2 = r.int(2, 12);
      const n2 = r.int(1, d2 - 1);
      if (gcd(n1, d1) !== 1 || gcd(n2, d2) !== 1) return null;
      const a = F(n1, d1);
      const b = F(n2, d2);
      if (a.equals(b)) return null;
      return buildCompare(r, a, b, fr(a), fr(b), withNeg);
    });
  };
}

function buildCompare(r: Rng, a0: Fraction, b0: Fraction, ea0: Expr, eb0: Expr, withNeg: boolean): Question {
  let a = a0;
  let b = b0;
  let ea = ea0;
  let eb = eb0;
  if (withNeg && r.chance(0.6)) {
    const flipA = r.chance(0.6);
    const flipB = r.chance(0.6) || !flipA;
    if (flipA && ea.t === "num") ((a = a.neg()), (ea = N(-ea.n, ea.d)));
    if (flipB && eb.t === "num") ((b = b.neg()), (eb = N(-eb.n, eb.d)));
  }
  const c = a.compare(b);
  const labels = ["<", ">", "="];
  const correct = c < 0 ? 0 : c > 0 ? 1 : 2;
  const sameNum = a.n === b.n && a.d !== b.d && a.n > 0;
  const options: Choice[] = labels.map((l, i) => ({
    label: l,
    why:
      i === correct
        ? undefined
        : sameNum
          ? "Con el mismo numerador, la de denominador más grande es la más chica: la pizza está cortada en porciones más chicas."
          : i === 2
            ? "No son equivalentes: llevalas al mismo denominador y fijate que los numeradores son distintos."
            : (a.n < 0) !== (b.n < 0) && !a.isZero() && !b.isZero()
              ? "Cualquier número positivo es mayor que cualquier negativo."
              : a.n < 0 && b.n < 0
                ? "Con dos negativos, es mayor el que está más cerca del 0. Llevalas al mismo denominador y fijate."
                : "Llevalas al mismo denominador y compará los numeradores.",
  }));
  let steps = compareSteps(a, b);
  const shownDiff = (e: Expr, f: Fraction) => e.t === "num" && (e.n !== f.n || e.d !== f.d);
  if (a.equals(b)) {
    steps = [
      { text: "Simplificamos las dos:", math: row(ea, "=", fr(a), "   y   ", eb, "=", fr(b)) },
      { text: "Dan la misma fracción: son equivalentes.", math: row(ea, "=", eb) },
    ];
  } else if (shownDiff(ea, a) || shownDiff(eb, b)) {
    steps.unshift({ text: "Primero simplificamos:", math: row(ea, "=", fr(a), "   y   ", eb, "=", fr(b)) });
  }
  const hasNeg = a.n < 0 || b.n < 0;
  return {
    gen: "",
    title: "¿Qué signo va en el medio?",
    story: hasNeg ? "En la caja anotan ganancias (positivo) y pérdidas (negativo). Compará." : "Dos clientes discuten quién comió más. Ayudalos.",
    math: row(ea, Q(), eb),
    answer: { kind: "choice", options, correct },
    hint: [{ text: "Llevá las dos fracciones al mismo denominador y compará los numeradores." }],
    steps,
    rule: hasNeg
      ? "Un positivo siempre es mayor que un negativo. Entre dos negativos, es mayor el más cercano a 0."
      : "Para comparar fracciones, se llevan a común denominador y se comparan los numeradores.",
  };
}

export const comparar = gen("w1-comparar", makeCompare(false));
export const compararNeg = gen("w1-comparar-neg", makeCompare(true));
