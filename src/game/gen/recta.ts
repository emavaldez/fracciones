// Sector 3 · El Riel de Comandas: fracciones en la recta numérica.
// Ubicar (tocando la recta), leer, negativos, rayitas que no coinciden con el denominador.
import { F, Fraction, gcd } from "../../math/fraction";
import { N, dec, frac, fr, mixed, row, type Expr } from "../../math/expr";
import type { Rng } from "../../math/rng";
import { decStr } from "../../math/sci";
import { cleanTraps, ft, gen, retry } from "../helpers";
import type { Choice, LineMark, LineSpec, Question } from "../types";

const RULE =
  "En la recta, cada entero se divide en tantas partes iguales como dice el denominador. Desde el 0 se cuentan saltos (los espacios, no las rayitas): tantos como dice el numerador. Los positivos van a la derecha del 0 y los negativos a la izquierda.";
const RULE_READ =
  "Para leer un punto: el denominador es en cuántas partes está dividido cada entero (se cuentan los espacios, no las rayitas) y el numerador, cuántos saltos hay desde el 0.";

const saltos = (k: number) => (k === 1 ? "1 salto" : `${k} saltos`);
/** Número mixto escrito con fracciones en línea: "1 + {3/4}" (RichText no dibuja mixtos). */
const mixedTxt = (w: number, k: number, d: number) => `${w} + ${ft(k, d)}`;

const hops = (from: Fraction, step: Fraction, count: number) => ({ from, step, count });
/** Un numerador entre 1 y d − 1 que no se simplifica con d. */
const coprime = (r: Rng, d: number) => r.pick(Array.from({ length: d - 1 }, (_, i) => i + 1).filter((x) => gcd(x, d) === 1));

// ---------------------------------------------------------------- ubicar

export const rectaUbicar = gen("rc-ubicar", (r) => {
  const d = r.pick([2, 3, 4, 5, 6, 8, 10]);
  const n = r.int(1, d - 1);
  const max = d <= 6 && r.chance(0.35) ? 2 : 1;
  const v = F(n, d);
  const line: LineSpec = { min: 0, max, parts: d };
  return {
    gen: "",
    title: "Ubicá la fracción en la recta",
    math: N(n, d),
    answer: { kind: "point", value: v, line },
    traps: cleanTraps(v, [
      {
        value: F(n - 1, d),
        msg: `Contaste la rayita del 0 como si fuera la primera. Se cuentan saltos (los espacios entre rayitas): desde el 0, ${saltos(n)} de ${ft(1, d)}.`,
      },
      { value: F(d - n, d), msg: `Contaste desde el 1 hacia atrás. Se cuenta desde el 0 hacia la derecha: ${saltos(n)} de ${ft(1, d)}.` },
    ]),
    hint: [{ text: `Cada espacio entre dos rayitas es ${ft(1, d)}. Contá saltos desde el 0, no rayitas.` }],
    steps: [
      { text: `El denominador es ${d}: cada entero está dividido en ${d} partes iguales, así que cada salto es ${ft(1, d)}.`, line },
      {
        text: `El numerador es ${n}: desde el 0 contamos ${saltos(n)} hacia la derecha.`,
        math: N(n, d),
        line: { ...line, hops: hops(F(0), F(1, d), n), marks: [{ value: v, tone: "ok" }] },
      },
    ],
    rule: RULE,
  };
});

export const rectaUbicarImpropia = gen("rc-impropia", (r) => {
  const d = r.pick([2, 3, 4, 5, 6]);
  const w = r.int(1, 2);
  const k = coprime(r, d);
  const n = w * d + k;
  const v = F(n, d);
  const max = Math.min(3, w + 1 + (r.chance(0.5) ? 1 : 0));
  const asMixed = r.chance(0.5);
  const line: LineSpec = { min: 0, max, parts: d };
  const deEnteros = w === 1 ? "del entero" : `de los ${w} enteros`;
  return {
    gen: "",
    title: "Ubicá el número en la recta",
    math: asMixed ? mixed(w, k, d) : N(n, d),
    answer: { kind: "point", value: v, line },
    traps: cleanTraps(v, [
      { value: F(k, d), msg: `Te olvidaste ${deEnteros}: ${asMixed ? "el número" : ft(n, d)} es ${mixedTxt(w, k, d)}. Primero llegás al ${w} y desde ahí contás ${saltos(k)}.` },
      { value: F((w + 1) * d + k, d), msg: `Te pasaste un entero: ${asMixed ? "el número" : ft(n, d)} es ${mixedTxt(w, k, d)}, así que va entre el ${w} y el ${w + 1}.` },
    ]).filter((t) => (t.value as Fraction).value() <= max),
    hint: [{ text: asMixed ? `Primero llegá al ${w}. Después contá los saltos de ${ft(1, d)}.` : `Fijate cuántos enteros entran en ${ft(n, d)}: pasalo a número mixto.` }],
    steps: [
      ...(asMixed
        ? [{ text: `${mixedTxt(w, k, d)}: son ${w === 1 ? "un entero" : `${w} enteros`} y ${ft(k, d)} más.` }]
        : [{ text: `Lo pasamos a número mixto: ${n} : ${d} da ${w} y ${k === 1 ? "sobra 1" : `sobran ${k}`}.`, math: row(N(n, d), "=", mixed(w, k, d)) }]),
      {
        text: `Llegamos al ${w} y desde ahí contamos ${saltos(k)} de ${ft(1, d)}.`,
        line: { ...line, hops: hops(F(w), F(1, d), k), marks: [{ value: v, tone: "ok" }] },
      },
    ],
    rule: RULE,
  };
});

export const rectaUbicarNegativa = gen("rc-negativa", (r) => {
  const d = r.pick([2, 3, 4, 5, 6]);
  const k = coprime(r, d);
  const isMixed = r.chance(0.45);
  const v = isMixed ? F(-(d + k), d) : F(-k, d);
  const min = isMixed ? -2 : r.pick([-1, -2]);
  const max = isMixed ? r.pick([0, 1]) : 1;
  const line: LineSpec = { min, max, parts: d };
  const asImproper = isMixed && r.chance(0.4);
  const math: Expr = isMixed ? (asImproper ? N(-(d + k), d) : mixed(1, k, d, true)) : N(-k, d);
  const shownTxt = isMixed ? (asImproper ? ft(-(d + k), d) : `−1 ${ft(k, d)}`) : ft(-k, d);
  const traps = isMixed
    ? [
        {
          value: F(-(d - k), d),
          msg: `${shownTxt} es más chico que −1: está a la izquierda del −1, no a la derecha. Es −1 − ${ft(k, d)}: desde el −1 seguís ${saltos(k)} hacia la izquierda.`,
        },
        { value: F(-k, d), msg: `Te olvidaste del entero: ${shownTxt} es −1 − ${ft(k, d)}. Primero llegás al −1 y después seguís ${saltos(k)} hacia la izquierda.` },
      ]
    : [{ value: F(-(d - k), d), msg: `Saliste del −1 y contaste hacia la derecha. ${ft(-k, d)} está a ${saltos(k)} del 0, hacia la izquierda.` }];
  traps.unshift({ value: v.neg(), msg: "Fuiste para la derecha: los negativos van a la izquierda del 0." });
  return {
    gen: "",
    title: "Ubicá el número en la recta",
    math,
    answer: { kind: "point", value: v, line },
    traps: cleanTraps(v, traps).filter((t) => (t.value as Fraction).value() <= max),
    hint: [
      {
        text: isMixed
          ? "Primero llegá al −1 (a la izquierda del 0) y seguí hacia la izquierda."
          : "Los negativos están a la izquierda del 0. Contá los saltos desde el 0 hacia la izquierda.",
      },
    ],
    steps: isMixed
      ? [
          {
            text: asImproper ? `Lo pasamos a número mixto: ${ft(-(d + k), d)} = −1 − ${ft(k, d)}.` : `−1 ${ft(k, d)} es −1 − ${ft(k, d)}: está más a la izquierda que el −1.`,
            ...(asImproper ? { math: row(N(-(d + k), d), "=", mixed(1, k, d, true)) } : {}),
          },
          {
            text: `Llegamos al −1 y seguimos ${saltos(k)} de ${ft(1, d)} hacia la izquierda.`,
            line: { ...line, hops: hops(F(-1), F(-1, d), k), marks: [{ value: v, tone: "ok" }] },
          },
        ]
      : [
          { text: `Los negativos están a la izquierda del 0. Cada entero está dividido en ${d} partes: cada salto es ${ft(1, d)}.` },
          {
            text: `Desde el 0 contamos ${saltos(k)} hacia la izquierda.`,
            line: { ...line, hops: hops(F(0), F(-1, d), k), marks: [{ value: v, tone: "ok" }] },
          },
        ],
    rule: RULE,
  };
});

// ---------------------------------------------------------------- leer

export const rectaLeer = gen("rc-leer", (r) =>
  retry(() => {
    const d = r.pick([3, 4, 5, 6, 8]);
    const max = d <= 5 && r.chance(0.4) ? 2 : 1;
    const n = r.int(1, max * d - 1);
    if (n % d === 0) return null;
    const v = F(n, d);
    const line: LineSpec = { min: 0, max, parts: d, marks: [{ value: v, tone: "ask" }] };
    const traps = [
      { value: F(n, d + 1), msg: `Contaste las rayitas en vez de los espacios: entre el 0 y el 1 hay ${d + 1} rayitas, pero el entero está dividido en ${d} partes.` },
      { value: F(n + 1, d), msg: "Contaste la rayita del 0. Los saltos se cuentan desde el 0: el primero termina en la primera rayita después del 0." },
      ...(d > 2
        ? [{ value: F(n, d - 1), msg: `Contaste solo las rayitas de adentro (${d - 1}), pero lo que importa son los espacios: el entero quedó dividido en ${d} partes.` }]
        : []),
      ...(max === 2 ? [{ value: F(n, 2 * d), msg: `Tomaste toda la recta como si fuera un entero. El entero va del 0 al 1, y está dividido en ${d} partes.` }] : []),
    ];
    const plain: LineSpec = { min: 0, max, parts: d };
    return {
      gen: "",
      title: "¿Qué fracción marca la banderita?",
      line,
      answer: { kind: "fraction", value: v },
      traps: cleanTraps(v, traps),
      hint: [{ text: "Contá en cuántas partes está dividido el espacio entre el 0 y el 1: ese es el denominador. Contá espacios, no rayitas." }],
      steps: [
        { text: `Del 0 al 1 hay ${d} espacios iguales: el denominador es ${d}.`, line: plain },
        {
          text: `La banderita está a ${saltos(n)} del 0: el numerador es ${n}.`,
          math: gcd(n, d) > 1 ? row(N(n, d), "=", fr(v)) : N(n, d),
          line: { ...plain, hops: hops(F(0), F(1, d), n), marks: [{ value: v, tone: "ok" }] },
        },
      ],
      rule: RULE_READ,
    } satisfies Question;
  }),
);

export const rectaLeerNeg = gen("rc-leer-neg", (r) => {
  const d = r.pick([2, 3, 4, 5, 6]);
  const k = r.int(1, d - 1);
  const isMixed = r.chance(0.35);
  const v = isMixed ? F(-(d + k), d) : F(-k, d);
  const min = isMixed ? -2 : r.pick([-1, -2]);
  const max = r.pick([0, 1]);
  const plain: LineSpec = { min, max, parts: d };
  const traps = isMixed
    ? [
        { value: F(-k, d), msg: `Te olvidaste del entero: la banderita está más allá del −1. Es −1 − ${ft(k, d)}.` },
        {
          value: F(-(d - k), d),
          msg: `${ft(-(d - k), d)} está a la derecha del −1, pero la banderita está a la izquierda del −1: está ${saltos(d + k)} a la izquierda del 0. Es −1 − ${ft(k, d)} = ${ft(-(d + k), d)}.`,
        },
      ]
    : [{ value: F(-(d - k), d), msg: `Contaste los saltos desde el −1. Se cuentan desde el 0: la banderita está a ${saltos(k)} del 0, hacia la izquierda.` }];
  traps.unshift({ value: v.neg(), msg: "Te olvidaste del signo: la banderita está a la izquierda del 0, así que el número es negativo." });
  return {
    gen: "",
    title: "¿Qué número marca la banderita?",
    story: "Escribilo como fracción (puede ser impropia).",
    line: { ...plain, marks: [{ value: v, tone: "ask" }] },
    answer: { kind: "fraction", value: v },
    traps: cleanTraps(v, traps),
    hint: [{ text: "Está a la izquierda del 0: es negativo. Contá cuántos saltos hay desde el 0 y fijate de qué tamaño es cada salto." }],
    steps: [
      { text: `Cada entero está dividido en ${d} partes: cada salto es ${ft(1, d)}. La banderita está a la izquierda del 0, así que es negativo.`, line: plain },
      {
        text: `Desde el 0 hay ${saltos(isMixed ? d + k : k)} hacia la izquierda.`,
        math: isMixed ? row(N(-(d + k), d), "=", mixed(1, k, d, true)) : N(-k, d),
        line: { ...plain, hops: hops(F(0), F(-1, d), isMixed ? d + k : k), marks: [{ value: v, tone: "ok" }] },
      },
    ],
    rule: RULE_READ,
  };
});

export const rectaLeerZoom = gen("rc-zoom", (r) => {
  const a = r.int(1, 4);
  if (r.chance(0.4)) {
    const k = r.int(1, 9);
    const v = F(10 * a + k, 10);
    const plain: LineSpec = { min: a, max: a + 1, parts: 10 };
    return {
      gen: "",
      title: "¿Qué número decimal marca la banderita?",
      story: `Esta parte del riel va del ${a} al ${a + 1}.`,
      line: { ...plain, marks: [{ value: v, tone: "ask" }] },
      answer: { kind: "decimal", value: v },
      traps: cleanTraps(v, [
        {
          value: F(k, 10),
          msg: `La recta no empieza en 0: empieza en ${a}. ${k === 1 ? "Ese décimo se suma" : `Los ${k} décimos se suman`} al ${a}: ${a} + 0,${k} = ${decStr(v)}.`,
        },
        { value: F(100 * a + k, 100), msg: `Cada salto es un décimo (0,1), no un centésimo: del ${a} al ${a + 1} hay 10 partes.` },
      ]),
      hint: [{ text: `Del ${a} al ${a + 1} hay 10 partes iguales: cada salto es 0,1.` }],
      steps: [
        { text: `Del ${a} al ${a + 1} hay 10 partes iguales: cada salto es un décimo, 0,1.`, line: plain },
        {
          text: `La banderita está ${saltos(k)} después del ${a}.`,
          math: row(N(a), "+", dec(`0,${k}`), "=", dec(decStr(v))),
          line: { ...plain, hops: hops(F(a), F(1, 10), k), marks: [{ value: v, tone: "ok" }] },
        },
      ],
      rule: "En una recta dividida en décimos, cada salto es 0,1. Si la recta no empieza en 0, se cuenta desde el primer número.",
    };
  }
  const d = r.pick([2, 3, 4, 5, 6, 8]);
  const k = r.int(1, d - 1);
  const v = F(a * d + k, d);
  const plain: LineSpec = { min: a, max: a + (d <= 5 && r.chance(0.4) ? 2 : 1), parts: d };
  return {
    gen: "",
    title: "Escribí el número de la banderita como número mixto",
    story: `Esta parte del riel empieza en el ${a}.`,
    line: { ...plain, marks: [{ value: v, tone: "ask" }] },
    answer: { kind: "mixed", value: v },
    traps: cleanTraps(v, [
      { value: F(k, d), msg: `Te olvidaste de que la recta empieza en el ${a}: la parte entera es ${a}.` },
      { value: F(a * (d + 1) + k, d + 1), msg: `Contaste las rayitas en vez de los espacios: entre el ${a} y el ${a + 1} hay ${d} partes iguales.` },
    ]),
    hint: [{ text: `La banderita está entre el ${a} y el ${a + 1}: la parte entera es ${a}. Contá en cuántas partes está dividido cada entero.` }],
    steps: [
      { text: `Cada entero está dividido en ${d} partes iguales: cada salto es ${ft(1, d)}.`, line: plain },
      {
        text: `La banderita está ${saltos(k)} después del ${a}.`,
        math: row(N(a), "+", N(k, d), "=", mixed(a, k, d)),
        line: { ...plain, hops: hops(F(a), F(1, d), k), marks: [{ value: v, tone: "ok" }] },
      },
    ],
    rule: "Si la recta no empieza en 0, se cuenta desde el primer número marcado. El denominador es en cuántas partes está dividido cada entero.",
  };
});

export const rectaLetras = gen("rc-letras", (r) =>
  retry(() => {
    const d = r.pick([3, 4, 5, 6]);
    const max = r.chance(0.5) ? 2 : 1;
    const top = max * d;
    const n = r.int(1, top - 1);
    if (n % d === 0) return null;
    // Lugares a los que se llega con errores típicos.
    const cands: { pos: number; why: (L: string) => string }[] = [
      { pos: n - 1, why: (L) => `La ${L} está una rayita antes: ahí hay ${saltos(n - 1)} desde el 0. Se cuentan saltos (espacios), no rayitas.` },
      { pos: n + 1, why: (L) => `La ${L} está una rayita después: ahí hay ${saltos(n + 1)} desde el 0.` },
      { pos: d - n, why: (L) => `La ${L} está a ${saltos(n)} del 1, no del 0. Se cuenta desde el 0.` },
      { pos: n + d, why: (L) => `La ${L} está un entero más allá: es ${ft(n + d, d)}.` },
      { pos: n + 2, why: (L) => `La ${L} está en ${ft(n + 2, d)}: ahí hay ${saltos(n + 2)} desde el 0.` },
    ];
    const used = new Set([n]);
    const picks: { pos: number; why: (L: string) => string }[] = [];
    for (const c of cands) {
      if (picks.length >= 3) break;
      if (c.pos <= 0 || c.pos >= top || used.has(c.pos) || c.pos % d === 0) continue;
      used.add(c.pos);
      picks.push(c);
    }
    if (picks.length < 2) return null;
    const all = [{ pos: n, why: (_: string) => "" }, ...picks].sort((x, y) => x.pos - y.pos);
    const letters = ["A", "B", "C", "D"];
    const correct = all.findIndex((x) => x.pos === n);
    const marks: LineMark[] = all.map((x, i) => ({ value: F(x.pos, d), tone: "letter", tag: letters[i] }));
    const options: Choice[] = all.map((x, i) => ({ label: letters[i], why: i === correct ? undefined : x.why(letters[i]) }));
    const plain: LineSpec = { min: 0, max, parts: d };
    return {
      gen: "",
      title: "¿En qué letra está la fracción?",
      math: N(n, d),
      line: { ...plain, marks },
      answer: { kind: "choice", options, correct },
      hint: [{ text: `Cada entero está dividido en ${d} partes. Contá ${n === 1 ? "el salto" : "los saltos"} desde el 0.` }],
      steps: [
        { text: `Cada entero está dividido en ${d} partes iguales: cada salto es ${ft(1, d)}.` },
        {
          text: `Contamos ${saltos(n)} desde el 0 y llegamos a la ${letters[correct]}.`,
          line: { ...plain, hops: hops(F(0), F(1, d), n), marks },
        },
      ],
      rule: RULE,
    } satisfies Question;
  }),
);

// ---------------------------------------------------------------- otras rayitas

export const rectaEquivalente = gen("rc-equiv", (r) =>
  retry(() => {
    const d = r.pick([2, 3, 4, 5]);
    const m = r.pick([2, 3]);
    const parts = d * m;
    if (parts > 12) return null;
    const max = parts <= 6 && r.chance(0.5) ? 2 : 1;
    const n = r.int(1, max * d - 1);
    if (gcd(n, d) !== 1) return null;
    const v = F(n, d);
    const line: LineSpec = { min: 0, max, parts };
    return {
      gen: "",
      title: "Ubicá la fracción en la recta",
      story: "Ojo: las rayitas no coinciden con el denominador.",
      math: N(n, d),
      answer: { kind: "point", value: v, line },
      traps: cleanTraps(v, [
        {
          value: F(n, parts),
          msg: `Contaste ${saltos(n)} como si cada uno fuera ${ft(1, d)}, pero acá cada entero está dividido en ${parts} partes: cada salto es ${ft(1, parts)} y llegaste a ${ft(n, parts)}. Primero buscá la equivalente: ${ft(n, d)} = ${ft(n * m, parts)}.`,
        },
      ]),
      hint: [{ text: `Fijate en cuántas partes está dividido cada entero (${parts}) y buscá una fracción equivalente con ese denominador.` }],
      steps: [
        { text: `Cada entero está dividido en ${parts} partes: cada salto es ${ft(1, parts)}, no ${ft(1, d)}.`, line },
        {
          text: `Buscamos la fracción equivalente con denominador ${parts} (multiplicamos arriba y abajo por ${m}).`,
          math: row(N(n, d), "=", frac(row(N(n), "·", N(m)), row(N(d), "·", N(m))), "=", N(n * m, parts)),
        },
        { text: `Contamos ${saltos(n * m)} desde el 0.`, line: { ...line, hops: hops(F(0), F(1, parts), n * m), marks: [{ value: v, tone: "ok" }] } },
      ],
      rule: "Si las rayitas no coinciden con el denominador, buscá una fracción equivalente cuyo denominador sea la cantidad de partes de cada entero.",
    } satisfies Question;
  }),
);

export const rectaElegirPartes = gen("rc-partes", (r) =>
  retry(() => {
    const d = r.pick([2, 3, 4, 5, 6]);
    const max = r.pick([1, 2, 2, 3]);
    if (d * max > 18) return null;
    const n = r.int(1, max * d - 1);
    if (gcd(n, d) !== 1) return null;
    const v = F(n, d);
    const line: LineSpec = { min: 0, max, parts: d };
    const w = Math.floor(n / d);
    const k = n % d;
    const asMixed = w > 0 && r.chance(0.4);
    return {
      gen: "",
      title: "Ubicá el número en la recta",
      story: "Solo están marcados los enteros.",
      math: asMixed ? mixed(w, k, d) : N(n, d),
      answer: { kind: "point", value: v, line, pickParts: true },
      traps: cleanTraps(
        v,
        n !== d && d / n <= max
          ? [{ value: F(d, n), msg: `Lo diste vuelta: el denominador (${d}) dice en cuántas partes dividir cada entero, y el numerador (${n}), cuántos saltos contar.` }]
          : [],
      ),
      hint: [{ text: "El denominador dice en cuántas partes iguales hay que dividir cada entero." }],
      steps: [
        ...(asMixed ? [{ text: `Como fracción: ${mixedTxt(w, k, d)} = ${ft(n, d)}.`, math: row(mixed(w, k, d), "=", N(n, d)) }] : []),
        { text: `El denominador es ${d}: dividimos cada entero en ${d} partes iguales.`, line },
        { text: `El numerador es ${n}: contamos ${saltos(n)} desde el 0.`, line: { ...line, hops: hops(F(0), F(1, d), n), marks: [{ value: v, tone: "ok" }] } },
      ],
      rule: RULE,
    } satisfies Question;
  }),
);

export const rectaUbicarUno = gen("rc-uno", (r) =>
  retry(() => {
    const d = r.pick([3, 4, 5, 6]);
    const p = r.int(1, 2 * d - 1);
    if (p === d) return null;
    const findOne = r.chance(0.6);
    const q = findOne ? d : r.int(1, 2 * d - 1);
    if (q === p || q === 0) return null;
    const target = F(q, d);
    const ref = F(p, d);
    const line: LineSpec = { min: 0, max: 2, parts: d, uniform: true, labels: [F(0), ref] };
    // Error típico: creer que cada salto vale 1 sobre el denominador que se ve escrito.
    const traps =
      findOne && ref.d !== d && ref.d <= 2 * d
        ? [
            {
              value: F(ref.d, d),
              msg: `Cada salto no es ${ft(1, ref.d)}: del 0 al ${ft(ref)} hay ${saltos(p)}, y ${ft(ref)} = ${ft(p, d)}, así que cada salto es ${ft(1, d)}.`,
            },
          ]
        : [];
    const hayP = p === 1 ? "hay 1 salto" : `hay ${p} saltos iguales`;
    return {
      gen: "",
      title: findOne ? "¿Dónde está el 1?" : "Ubicá la fracción en la recta",
      story: `En este riel se borraron casi todos los números: solo quedan el 0 y ${ft(ref)}.`,
      ...(findOne ? {} : { math: fr(target) }),
      answer: { kind: "point", value: target, line },
      traps: cleanTraps(target, traps),
      hint: [{ text: `Contá cuántos saltos hay del 0 al ${ft(ref)}. Así sabés cuánto vale cada salto.` }],
      steps: [
        {
          text:
            ref.d === d
              ? `Del 0 al ${ft(ref)} ${hayP}, así que cada salto es ${ft(1, d)}.`
              : `Del 0 al ${ft(ref)} ${hayP}. Como ${ft(ref)} = ${ft(p, d)}, si ${p === 1 ? "1 salto es" : `${p} saltos son`} ${ft(p, d)}, cada salto es ${ft(1, d)}.`,
          ...(ref.d !== d ? { math: row(fr(ref), "=", N(p, d)) } : {}),
          line: { ...line, hops: hops(F(0), F(1, d), p) },
        },
        {
          text: findOne
            ? `El 1 son ${ft(d, d)}: ${saltos(d)} desde el 0.`
            : target.d !== d
              ? `${ft(target)} = ${ft(q, d)}: ${saltos(q)} desde el 0.`
              : `${ft(target)} son ${saltos(q)} desde el 0.`,
          math: findOne ? row(N(1), "=", N(d, d)) : target.d !== d ? row(fr(target), "=", N(q, d)) : N(q, d),
          line: { ...line, hops: hops(F(0), F(1, d), q), marks: [{ value: target, tone: "ok" }] },
        },
      ],
      rule: "Si conocés dónde está una fracción, contá cuántos saltos hay desde el 0: eso te dice cuánto vale cada salto, y con eso encontrás cualquier otro número.",
    } satisfies Question;
  }),
);
