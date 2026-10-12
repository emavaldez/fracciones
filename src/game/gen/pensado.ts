// El número pensado: frases como "el doble de un número, más 5, da 17".
// Primero se elige la ecuación que corresponde (las opciones incorrectas son confusiones típicas)
// y después se despeja en la pizarra. También hay ejercicios de traducir frases y expresiones.
import { F, Fraction } from "../../math/fraction";
import { N, X, coef, fr, par, pow, row, toText, type Expr } from "../../math/expr";
import type { Rng } from "../../math/rng";
import { ft, gen, retry } from "../helpers";
import { eqPz, tPar, tProd, tSum, tTerms, tX, tn, type PzSpec } from "../pizarra";
import type { Choice, Question, Step } from "../types";

const ONE = F(1);
const VEC: Record<number, string> = { 2: "el doble", 3: "el triple", 4: "el cuádruple" };
const PARTE: Record<number, string> = { 2: "la mitad", 3: "la tercera parte", 4: "la cuarta parte", 5: "la quinta parte" };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
/** "a" + "el doble" → "al doble" */
const aEl = (s: string) => (s.startsWith("el ") ? `al ${s.slice(3)}` : `a ${s}`);
const su = (s: string) => s.replace(/^el /, "su ").replace(/^la /, "su ");
const n = (v: number) => N(v);
/** Expresión escrita para usar dentro de un texto. */
const said = (e: Expr) =>
  toText(e)
    .replace(/\^2/g, "²")
    .replace(/ - /g, " − ")
    .replace(/(\d+)\/(\d+)/g, "{$1/$2}");

interface Tpl {
  story: string;
  question?: string;
  correct: Expr;
  wrong: { math: Expr; why: string }[];
  pz: PzSpec;
  x: Fraction;
  solve: Step[];
  meaning?: string;
  /** Pista para despejar (si no, la general). */
  hint?: string;
}

/** Pasos para despejar K·x + B = R. */
function solveLinear(K: Fraction, B: Fraction, R: Fraction): Step[] {
  const steps: Step[] = [];
  const rhs = R.sub(B);
  if (!B.isZero()) {
    steps.push({
      text: B.n > 0 ? `Pasamos el ${ft(B)} restando:` : `Pasamos el ${ft(B.neg())} sumando:`,
      math: row(coef(K), "=", fr(R), B.n > 0 ? "-" : "+", fr(B.abs()), "=", fr(rhs)),
    });
  }
  const x = rhs.div(K);
  if (!K.equals(ONE)) {
    steps.push({
      text: K.isInteger() ? `Pasamos el ${K.n} dividiendo:` : `Pasamos ${ft(K)} dividiendo:`,
      math: row(X, "=", fr(rhs), ":", fr(K), "=", fr(x)),
    });
  }
  return steps;
}

const verify = (e: Expr, v: Fraction): Step => ({ text: "Verificamos reemplazando x en la frase:", math: row(e, "=", fr(v)) });

// ---------------------------------------------------------------- plantillas

type Make = (r: Rng) => Tpl | null;

const TEMPLATES: Make[] = [
  // k·x + b = c
  (r) => {
    const k = r.int(2, 4);
    const x = r.int(1, 12);
    const b = r.int(1, 12);
    const c = k * x + b;
    const v = VEC[k];
    const story = r.pick([
      `${cap(v)} de un número, más ${b}, da ${c}.`,
      `Si ${aEl(v)} de un número le sumo ${b}, obtengo ${c}.`,
      `Pensé un número, lo multipliqué por ${k} y le sumé ${b}: me dio ${c}.`,
      `${cap(v)} de un número, aumentado en ${b}, es igual a ${c}.`,
    ]);
    const wrong = r.shuffle([
      { math: row(n(k), "·", par(row(X, "+", n(b))), "=", n(c)), why: `Con el paréntesis, primero sumás ${b} y después multiplicás por ${k}. La frase dice al revés: primero ${v}, después le sumás ${b}.` },
      { math: row(n(k), "+", X, "+", n(b), "=", n(c)), why: `${cap(v)} de un número (multiplicarlo por ${k}) es ${k}·x, no ${k} + x.` },
      k === 2
        ? { math: row(pow(X, 2), "+", n(b), "=", n(c)), why: "El doble es 2·x. x² es el cuadrado: x·x." }
        : { math: row(coef(F(k)), "-", n(b), "=", n(c)), why: `Hay que sumar ${b}, no restar.` },
    ]);
    return {
      story,
      correct: row(coef(F(k)), "+", n(b), "=", n(c)),
      wrong,
      pz: eqPz(tTerms({ x: F(k) }, F(b)), tn(F(c))),
      x: F(x),
      solve: [...solveLinear(F(k), F(b), F(c)), verify(row(n(k), "·", n(x), "+", n(b)), F(c))],
    };
  },
  // k·x − b = c
  (r) => {
    const k = r.int(2, 4);
    const x = r.int(2, 12);
    const b = r.int(1, k * x - 1);
    const c = k * x - b;
    const v = VEC[k];
    const story = r.pick([
      `${cap(v)} de un número, menos ${b}, es ${c}.`,
      `Si ${aEl(v)} de un número le resto ${b}, obtengo ${c}.`,
      `${cap(v)} de un número, disminuido en ${b}, da ${c}.`,
      `Pensé un número, lo multipliqué por ${k} y le resté ${b}: me dio ${c}.`,
    ]);
    return {
      story,
      correct: row(coef(F(k)), "-", n(b), "=", n(c)),
      wrong: [
        { math: row(n(k), "·", par(row(X, "-", n(b))), "=", n(c)), why: `Con el paréntesis, primero restás ${b} y después multiplicás. La frase dice: primero ${v}, después le restás ${b}.` },
        { math: row(n(b), "-", coef(F(k)), "=", n(c)), why: `Le restás ${b} ${aEl(v)}: primero va ${v} (${k}x) y después “− ${b}”.` },
        { math: row(coef(F(k)), "+", n(b), "=", n(c)), why: `Hay que restar ${b}, no sumar.` },
      ],
      pz: eqPz(tTerms({ x: F(k) }, F(-b)), tn(F(c))),
      x: F(x),
      solve: [...solveLinear(F(k), F(-b), F(c)), verify(row(n(k), "·", n(x), "-", n(b)), F(c))],
    };
  },
  // x : k + b = c
  (r) => {
    const k = r.int(2, 5);
    const m = r.int(1, 8);
    const x = k * m;
    const b = r.int(1, 10);
    const c = m + b;
    const p = PARTE[k];
    const story = r.pick([
      `${cap(p)} de un número, más ${b}, es ${c}.`,
      `Si a ${p} de un número le sumo ${b}, obtengo ${c}.`,
      `Pensé un número, lo dividí por ${k} y le sumé ${b}: me dio ${c}.`,
    ]);
    return {
      story,
      correct: row(X, ":", n(k), "+", n(b), "=", n(c)),
      wrong: [
        { math: row(coef(F(k)), "+", n(b), "=", n(c)), why: `${cap(p)} es dividir por ${k}, no multiplicar.` },
        { math: row(par(row(X, "+", n(b))), ":", n(k), "=", n(c)), why: `Con el paréntesis, primero sumás ${b} y después dividís. La frase dice: primero ${p}, después le sumás ${b}.` },
        { math: row(X, "-", n(k), "+", n(b), "=", n(c)), why: `${cap(p)} no es restar ${k}: es dividir por ${k}.` },
      ],
      pz: eqPz(tSum(tProd(tX, ":", tn(F(k))), "+", tn(F(b))), tn(F(c))),
      x: F(x),
      solve: [
        { text: `Pasamos el ${b} restando:`, math: row(X, ":", n(k), "=", n(c), "-", n(b), "=", n(m)) },
        { text: `El “: ${k}” pasa multiplicando:`, math: row(X, "=", n(m), "·", n(k), "=", n(x)) },
        verify(row(n(x), ":", n(k), "+", n(b)), F(c)),
      ],
    };
  },
  // k·(x + b) = c
  (r) => {
    const k = r.int(2, 4);
    const x = r.int(1, 10);
    const b = r.int(1, 9);
    const c = k * (x + b);
    const v = VEC[k];
    const story = r.pick([
      `${cap(v)} de la suma entre un número y ${b} es ${c}.`,
      `Si a un número le sumo ${b} y el resultado lo multiplico por ${k}, obtengo ${c}.`,
    ]);
    return {
      story,
      correct: row(n(k), "·", par(row(X, "+", n(b))), "=", n(c)),
      wrong: [
        { math: row(coef(F(k)), "+", n(b), "=", n(c)), why: `Así multiplicás solo el número. “${cap(v)} DE LA SUMA” quiere decir que primero se suma y después se multiplica: hace falta el paréntesis.` },
        { math: row(X, "+", n(k), "·", n(b), "=", n(c)), why: `El ${k} multiplica a toda la suma, no solo al ${b}.` },
        { math: row(n(k), "+", par(row(X, "+", n(b))), "=", n(c)), why: `${cap(v)} es multiplicar por ${k}, no sumar ${k}.` },
      ],
      pz: eqPz(tProd(tn(F(k)), "·", tPar(tTerms({ x: ONE }, F(b)))), tn(F(c))),
      x: F(x),
      solve: [
        { text: `El ${k} multiplica a todo el paréntesis: pasa dividiendo.`, math: row(X, "+", n(b), "=", n(c), ":", n(k), "=", n(x + b)) },
        { text: `Pasamos el ${b} restando:`, math: row(X, "=", n(x + b), "-", n(b), "=", n(x)) },
        verify(row(n(k), "·", par(row(n(x), "+", n(b)))), F(c)),
      ],
    };
  },
  // (x − b) : k = c
  (r) => {
    const k = r.int(2, 4);
    const c = r.int(1, 8);
    const b = r.int(1, 10);
    const x = k * c + b;
    const p = PARTE[k];
    const story = r.pick([`${cap(p)} de la diferencia entre un número y ${b} es ${c}.`, `Si a un número le resto ${b} y el resultado lo divido por ${k}, obtengo ${c}.`]);
    return {
      story,
      correct: row(par(row(X, "-", n(b))), ":", n(k), "=", n(c)),
      wrong: [
        { math: row(X, ":", n(k), "-", n(b), "=", n(c)), why: `Así dividís solo el número. “${cap(p)} DE LA DIFERENCIA”: primero se resta y después se divide, con paréntesis.` },
        { math: row(par(row(n(b), "-", X)), ":", n(k), "=", n(c)), why: `La diferencia entre un número y ${b} es x − ${b}: primero va el número.` },
        { math: row(n(k), "·", par(row(X, "-", n(b))), "=", n(c)), why: `${cap(p)} es dividir por ${k}, no multiplicar.` },
      ],
      pz: eqPz(tProd(tPar(tTerms({ x: ONE }, F(-b))), ":", tn(F(k))), tn(F(c))),
      x: F(x),
      solve: [
        { text: `El “: ${k}” divide a todo el paréntesis: pasa multiplicando.`, math: row(X, "-", n(b), "=", n(c), "·", n(k), "=", n(k * c)) },
        { text: `Pasamos el ${b} sumando:`, math: row(X, "=", n(k * c), "+", n(b), "=", n(x)) },
        verify(row(par(row(n(x), "-", n(b))), ":", n(k)), F(c)),
      ],
    };
  },
  // x + k·x = c
  (r) => {
    const k = r.int(2, 4);
    const x = r.int(1, 15);
    const c = (k + 1) * x;
    const v = VEC[k];
    const story = r.pick([`Si a un número le sumo ${su(v)}, obtengo ${c}.`, `Un número más ${su(v)} da ${c}.`]);
    return {
      story,
      correct: row(X, "+", coef(F(k)), "=", n(c)),
      wrong: [
        { math: row(coef(F(k)), "=", n(c)), why: `Falta el número: es el número MÁS ${su(v)}.` },
        { math: row(X, "+", n(k), "=", n(c)), why: `${cap(su(v))} es ${k}·x, no ${k}.` },
        { math: row(X, "·", coef(F(k)), "=", n(c)), why: `Es una suma: el número MÁS ${su(v)}. No se multiplican.` },
      ],
      pz: eqPz(tTerms({ x: ONE }, { x: F(k) }), tn(F(c))),
      x: F(x),
      hint: "Primero juntá las x: x + 2x son 3x.",
      solve: [
        { text: `Juntamos las x: x + ${k}x = ${k + 1}x (un x más ${k} x son ${k + 1} x).`, math: row(coef(F(k + 1)), "=", n(c)) },
        ...solveLinear(F(k + 1), F(0), F(c)),
        verify(row(n(x), "+", n(k), "·", n(x)), F(c)),
      ],
    };
  },
  // k·x = x + b
  (r) => {
    const k = r.int(2, 4);
    const x = r.int(1, 12);
    const b = (k - 1) * x;
    const v = VEC[k];
    const story = r.pick([`${cap(v)} de un número es igual al número más ${b}.`, `Si multiplico un número por ${k}, obtengo lo mismo que si le sumo ${b}.`]);
    return {
      story,
      correct: row(coef(F(k)), "=", X, "+", n(b)),
      wrong: [
        { math: row(coef(F(k)), "=", n(b)), why: `Falta el número del otro lado: es igual AL NÚMERO más ${b}.` },
        { math: row(coef(F(k)), "+", X, "=", n(b)), why: `Es ${v} lo que es igual al número más ${b}: el número va del otro lado del igual, sumado con el ${b}.` },
        { math: row(X, "+", n(k), "=", X, "+", n(b)), why: `${cap(v)} de un número es ${k}·x, no x + ${k}.` },
      ],
      pz: eqPz(tTerms({ x: F(k) }), tTerms({ x: ONE }, F(b))),
      x: F(x),
      solve: [
        { text: "Pasamos la x restando, para juntar las x de un lado:", math: row(coef(F(k)), "-", X, "=", n(b)) },
        { text: `${k}x − x = ${k - 1}x:`, math: row(coef(F(k - 1)), "=", n(b)) },
        ...solveLinear(F(k - 1), F(0), F(b)),
        { text: "Verificamos: los dos lados dan lo mismo.", math: row(n(k), "·", n(x), "=", n(k * x), " y ", n(x), "+", n(b), "=", n(k * x)) },
      ],
      hint: "Hay x de los dos lados: primero juntalas de un mismo lado.",
    };
  },
  // k1·x − b = k2·x + d
  (r) => {
    const k1 = r.int(3, 4);
    const k2 = r.int(2, k1 - 1);
    const x = r.int(2, 12);
    const b = r.int(1, 10);
    const d = (k1 - k2) * x - b;
    if (d < 1 || d === k2) return null;
    const v1 = VEC[k1];
    const v2 = VEC[k2];
    return {
      story: `${cap(v1)} de un número, menos ${b}, es igual ${aEl(v2)} del número, más ${d}.`,
      correct: row(coef(F(k1)), "-", n(b), "=", coef(F(k2)), "+", n(d)),
      wrong: [
        { math: row(coef(F(k1)), "+", n(b), "=", coef(F(k2)), "-", n(d)), why: `Cambiaste los signos: es “menos ${b}” y “más ${d}”.` },
        { math: row(coef(F(k1)), "-", n(b), "=", n(k2), "+", n(d)), why: `${cap(v2)} del número es ${k2}·x, no ${k2}.` },
        { math: row(coef(F(k1)), "-", n(b), "=", n(k2), "·", par(row(X, "+", n(d)))), why: `La frase dice “${v2} del número, más ${d}”: primero se multiplica y después se suma, sin paréntesis.` },
      ],
      pz: eqPz(tTerms({ x: F(k1) }, F(-b)), tTerms({ x: F(k2) }, F(d))),
      x: F(x),
      solve: [
        { text: `Pasamos el ${k2}x restando, para juntar las x de un lado:`, math: row(coef(F(k1 - k2)), "-", n(b), "=", n(d)) },
        ...solveLinear(F(k1 - k2), F(-b), F(d)),
        {
          text: "Verificamos: los dos lados dan lo mismo.",
          math: row(n(k1), "·", n(x), "-", n(b), "=", n(k1 * x - b), " y ", n(k2), "·", n(x), "+", n(d), "=", n(k2 * x + d)),
        },
      ],
      hint: "Hay x de los dos lados: primero juntalas de un mismo lado.",
    };
  },
  // (p/q)·x + b = c
  (r) => {
    const [p, q] = r.pick([
      [2, 3],
      [3, 4],
      [2, 5],
      [3, 5],
      [3, 2],
    ] as const);
    const m = r.int(1, 6);
    const x = q * m;
    const b = r.int(1, 8);
    const c = p * m + b;
    const K = F(p, q);
    return {
      story: `Los ${ft(K)} de un número, más ${b}, dan ${c}.`,
      correct: row(coef(K), "+", n(b), "=", n(c)),
      wrong: [
        { math: row(X, "+", fr(K), "+", n(b), "=", n(c)), why: `“Los ${ft(K)} DE un número” es una multiplicación: ${ft(K)}·x.` },
        { math: row(fr(K), "·", par(row(X, "+", n(b))), "=", n(c)), why: `Con el paréntesis, primero sumás ${b}. La frase dice: primero los ${ft(K)} del número, después le sumás ${b}.` },
        { math: row(coef(K.inv()), "+", n(b), "=", n(c)), why: "Diste vuelta la fracción." },
      ],
      pz: eqPz(tTerms({ x: K }, F(b)), tn(F(c))),
      x: F(x),
      solve: [...solveLinear(K, F(b), F(c)), verify(row(fr(K), "·", n(x), "+", n(b)), F(c))],
    };
  },
  // x + (x ± 1) = c
  (r) => {
    const next = r.chance(0.65);
    const x = r.int(3, 40);
    const s = next ? 1 : -1;
    const c = 2 * x + s;
    const name = next ? "su consecutivo" : "su anterior";
    const other = row(X, next ? "+" : "-", n(1));
    return {
      story: `La suma de un número y ${name} es ${c}.`,
      question: "¿Cuál es el número? (Llamalo x.)",
      correct: row(X, "+", par(other), "=", n(c)),
      wrong: [
        { math: row(other, "=", n(c)), why: `Esa es solo ${name.replace("su ", "el ")}: falta sumarle el número.` },
        { math: row(coef(F(2)), "=", n(c)), why: `${cap(name.replace("su ", "el "))} no es el mismo número: es x ${next ? "+" : "−"} 1.` },
        { math: row(X, "·", par(other), "=", n(c)), why: "Dice “la suma”: es una suma, no un producto." },
      ],
      pz: eqPz(tTerms({ x: ONE }, { x: ONE }, F(s)), tn(F(c))),
      x: F(x),
      hint: "Primero juntá las x: x + x son 2x.",
      solve: [
        { text: `Sacamos el paréntesis y juntamos las x: x + x ${next ? "+" : "−"} 1 = 2x ${next ? "+" : "−"} 1.`, math: row(coef(F(2)), next ? "+" : "-", n(1), "=", n(c)) },
        ...solveLinear(F(2), F(s), F(c)),
        verify(row(n(x), "+", n(x + s)), F(c)),
      ],
      meaning: `Los números son ${x} y ${x + s}.`,
    };
  },
  // x + (x + 1) + (x + 2) = c
  (r) => {
    const x = r.int(2, 30);
    const c = 3 * x + 3;
    return {
      story: `La suma de tres números consecutivos es ${c}.`,
      question: "¿Cuál es el más chico de los tres? (Llamá x al más chico.)",
      correct: row(X, "+", par(row(X, "+", n(1))), "+", par(row(X, "+", n(2))), "=", n(c)),
      wrong: [
        { math: row(coef(F(3)), "=", n(c)), why: "Los tres números no son iguales: son x, x + 1 y x + 2." },
        { math: row(X, "+", coef(F(2)), "+", coef(F(3)), "=", n(c)), why: "Consecutivos quiere decir que van de a uno: x, x + 1 y x + 2. No son el doble ni el triple." },
        { math: row(X, "+", par(row(X, "+", n(1))), "+", par(row(X, "+", n(1))), "=", n(c)), why: "El tercero es el consecutivo del segundo: x + 2." },
      ],
      pz: eqPz(tTerms({ x: ONE }, { x: ONE }, F(1), { x: ONE }, F(2)), tn(F(c))),
      x: F(x),
      hint: "Primero juntá las x (x + x + x = 3x) y los números (1 + 2 = 3).",
      solve: [
        { text: "Sacamos los paréntesis y juntamos: x + x + 1 + x + 2 = 3x + 3.", math: row(coef(F(3)), "+", n(3), "=", n(c)) },
        ...solveLinear(F(3), F(3), F(c)),
        verify(row(n(x), "+", n(x + 1), "+", n(x + 2)), F(c)),
      ],
      meaning: `El más chico es ${x} (los tres números son ${x}, ${x + 1} y ${x + 2}).`,
    };
  },
];

function twoParts(r: Rng, t: Tpl): Question {
  const opts: Choice[] = r.shuffle([{ math: t.correct }, ...t.wrong.map((w) => ({ math: w.math, why: w.why }))]);
  const correctIdx = opts.findIndex((o) => o.math === t.correct);
  const question = t.question ?? "¿Qué número es?";
  const meaning = t.meaning ?? `El número es ${ft(t.x)}.`;
  const solveQ: Question = {
    gen: "",
    title: "Ahora resolvela: ¿cuánto vale x?",
    story: t.story,
    math: t.correct,
    answer: { kind: "fraction", value: t.x },
    answerPrefix: "x =",
    pizarra: t.pz,
    hint: [{ text: t.hint ?? "Despejá de afuera hacia adentro: primero lo que se suma o se resta, después lo que multiplica o divide." }],
    steps: [...t.solve, { text: meaning }],
    rule: "Para despejar x: lo que suma pasa restando, lo que resta pasa sumando, lo que multiplica pasa dividiendo y lo que divide pasa multiplicando.",
  };
  return {
    gen: "",
    title: "¿Qué ecuación corresponde?",
    story: `${t.story} ${question}`,
    answer: { kind: "choice", options: opts, correct: correctIdx },
    hint: [{ text: "Llamá x al número y traducí la frase en orden. Si dice «… DE LA SUMA» o «… DE LA DIFERENCIA», ahí va un paréntesis." }],
    steps: [{ text: "Llamamos x al número y traducimos la frase:", math: t.correct }],
    rule: "“El doble de un número, más 5” es 2x + 5; “el doble de la suma entre un número y 5” es 2·(x + 5). “La mitad” es dividir por 2 y “el consecutivo” es x + 1.",
    followUp: solveQ,
  };
}

export const numeroPensado = gen("np-pensado", (r) => {
  const make = r.pick(TEMPLATES);
  return twoParts(r, retry(() => make(r)));
});

// ---------------------------------------------------------------- traducir

interface Phrase {
  text: string;
  math: Expr;
}
/** Una frase y otras parecidas que se escriben distinto. */
type Bank = (r: Rng) => [Phrase, Phrase, Phrase, Phrase];

const BANK: Bank[] = [
  (r) => {
    const a = r.int(2, 9);
    return [
      { text: `el doble de un número, más ${a}`, math: row(coef(F(2)), "+", n(a)) },
      { text: `el doble de la suma entre un número y ${a}`, math: row(n(2), "·", par(row(X, "+", n(a)))) },
      { text: `un número, más el doble de ${a}`, math: row(X, "+", n(2), "·", n(a)) },
      { text: `el cuadrado de un número, más ${a}`, math: row(pow(X, 2), "+", n(a)) },
    ];
  },
  (r) => {
    const a = r.int(2, 9);
    return [
      { text: `la mitad de un número, menos ${a}`, math: row(X, ":", n(2), "-", n(a)) },
      { text: `la mitad de la diferencia entre un número y ${a}`, math: row(par(row(X, "-", n(a))), ":", n(2)) },
      { text: `el doble de un número, menos ${a}`, math: row(coef(F(2)), "-", n(a)) },
      { text: `${a} menos la mitad de un número`, math: row(n(a), "-", X, ":", n(2)) },
    ];
  },
  () => [
    { text: "el triple del consecutivo de un número", math: row(n(3), "·", par(row(X, "+", n(1)))) },
    { text: "el consecutivo del triple de un número", math: row(coef(F(3)), "+", n(1)) },
    { text: "el triple de un número", math: coef(F(3)) },
    { text: "el consecutivo de un número, más 3", math: row(X, "+", n(1), "+", n(3)) },
  ],
  () => [
    { text: "el cuadrado de un número, más su doble", math: row(pow(X, 2), "+", coef(F(2))) },
    { text: "el cuadrado del doble de un número", math: pow(par(coef(F(2))), 2) },
    { text: "el doble del cuadrado de un número", math: row(n(2), "·", pow(X, 2)) },
    { text: "el cuadrado de un número, más 2", math: row(pow(X, 2), "+", n(2)) },
  ],
  (r) => {
    const [p, q] = r.pick([
      [2, 3],
      [3, 4],
      [2, 5],
    ] as const);
    const K = F(p, q);
    return [
      { text: `un número, menos sus ${ft(K)}`, math: row(X, "-", coef(K)) },
      { text: `un número, menos ${ft(K)}`, math: row(X, "-", fr(K)) },
      { text: `los ${ft(K)} de un número`, math: coef(K) },
      { text: `${ft(K)} menos un número`, math: row(fr(K), "-", X) },
    ];
  },
  () => [
    { text: "la suma de un número y su consecutivo", math: row(X, "+", par(row(X, "+", n(1)))) },
    { text: "el consecutivo de un número", math: row(X, "+", n(1)) },
    { text: "el doble de un número", math: coef(F(2)) },
    { text: "el producto de un número y su consecutivo", math: row(X, "·", par(row(X, "+", n(1)))) },
  ],
  () => [
    { text: "el anterior del triple de un número", math: row(coef(F(3)), "-", n(1)) },
    { text: "el triple del anterior de un número", math: row(n(3), "·", par(row(X, "-", n(1)))) },
    { text: "el triple de un número, más 1", math: row(coef(F(3)), "+", n(1)) },
    { text: "el anterior de un número, más 3", math: row(X, "-", n(1), "+", n(3)) },
  ],
  (r) => {
    const a = r.int(2, 9);
    return [
      { text: `la tercera parte de la suma entre un número y ${a}`, math: row(par(row(X, "+", n(a))), ":", n(3)) },
      { text: `la tercera parte de un número, más ${a}`, math: row(X, ":", n(3), "+", n(a)) },
      { text: `el triple de la suma entre un número y ${a}`, math: row(n(3), "·", par(row(X, "+", n(a)))) },
      { text: "la suma entre un número y su tercera parte", math: row(X, "+", X, ":", n(3)) },
    ];
  },
];

export const traducirFrase = gen("np-traducir", (r) => {
  const [ok, ...others] = r.pick(BANK)(r);
  if (r.chance(0.55)) {
    // de la frase a la expresión
    const opts: Choice[] = r.shuffle([{ math: ok.math }, ...others.map((o) => ({ math: o.math, why: `${said(o.math)} se lee: «${o.text}». Es otra cosa.` }))]);
    return {
      gen: "",
      title: "¿Cómo se escribe con x?",
      story: `«${cap(ok.text)}»`,
      answer: { kind: "choice", options: opts, correct: opts.findIndex((o) => o.math === ok.math) },
      hint: [
        {
          text: "Llamá x al número. Fijate si hay coma: «el doble de un número, más 4» es primero el doble (2x) y después + 4. Si dice «el doble DE LA SUMA…», primero se suma: va un paréntesis.",
        },
      ],
      steps: [
        { text: `«${cap(ok.text)}» se escribe así:`, math: ok.math },
        ...others.slice(0, 2).map((o) => ({ text: `En cambio, «${o.text}» es:`, math: o.math })),
      ],
      rule: "“El doble de un número, más 4” es 2x + 4. “El doble DE LA SUMA entre un número y 4” lleva paréntesis: 2·(x + 4), porque primero se suma.",
    };
  }
  // de la expresión a la frase
  const opts: Choice[] = r.shuffle([{ label: cap(ok.text) }, ...others.map((o) => ({ label: cap(o.text), why: `Esa frase se escribe ${said(o.math)}.` }))]);
  return {
    gen: "",
    title: "¿Qué frase dice esto?",
    math: ok.math,
    answer: { kind: "choice", options: opts, correct: opts.findIndex((o) => o.label === cap(ok.text)) },
    hint: [{ text: "Fijate si hay paréntesis: «el doble DE LA SUMA…», «la mitad DE LA DIFERENCIA…». Sin paréntesis, las cuentas se hacen en el orden de la frase." }],
    steps: [{ text: `${said(ok.math)} se lee: «${ok.text}».`, math: ok.math }],
    rule: "Un paréntesis se lee «… DE LA SUMA» o «… DE LA DIFERENCIA»: 2·(x + 5) es “el doble de la suma entre un número y 5”, y 2x + 5 es “el doble de un número, más 5”.",
  };
});
