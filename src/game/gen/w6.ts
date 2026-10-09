// Mundo 6 · La Huerta de Raíces: radicación.
import { F, Fraction, decimalStringToFraction, fractionToDecimalString, gcd, intRoot } from "../../math/fraction";
import { N, Q, dec, fr, frac, mixed, pow, root, row, type Expr } from "../../math/expr";
import { cleanTraps, ft, gen, nice, retry } from "../helpers";
import type { Choice, Step } from "../types";

const RULE_ROOT = "La raíz de una fracción es la raíz del numerador sobre la raíz del denominador.";
const idxName = (k: number) => (k === 2 ? "cuadrada" : k === 3 ? "cúbica" : `de índice ${k}`);

export function rootSteps(x: Fraction, k: number, shown?: Expr): Step[] {
  const res = x.root(k)!;
  const abs = x.abs();
  const ra = res.abs();
  const R = shown ?? fr(x);
  const steps: Step[] = [];
  if (x.n < 0) steps.push({ text: "El índice es impar, así que la raíz de un negativo existe y es negativa." });
  if (x.d === 1) {
    steps.push({ text: `Buscamos un número que elevado a la ${k} dé ${abs.n}: es ${ra.n}.`, math: row(root(k, N(abs.n)), "=", N(ra.n)) });
  } else {
    steps.push({
      text: "Sacamos la raíz del numerador y del denominador:",
      math: row(root(k, fr(abs)), "=", frac(root(k, N(abs.n)), root(k, N(abs.d))), "=", fr(ra)),
    });
  }
  if (x.n < 0) steps.push({ text: "Con el signo:", math: row(root(k, fr(x)), "=", fr(res)) });
  steps.push({ text: "Comprobamos elevando:", math: row(pow(fr(res), k), "=", fr(x)) });
  if (R !== undefined && shown) steps.unshift({ math: row(root(k, R), "=", root(k, fr(x))), text: "Primero simplificamos lo de adentro:" });
  return steps;
}

export const raizCuadrada = gen("w6-cuadrada", (r) => {
  return retry(() => {
    const a = r.int(1, 12);
    const b = r.int(2, 12);
    if (gcd(a, b) !== 1) return null;
    const x = F(a * a, b * b);
    const ans = F(a, b);
    // A veces el radicando viene sin simplificar (8/18 = 4/9)
    const m = a <= 6 && b <= 6 && r.chance(0.3) ? r.pick([2, 3, 5]) : 1;
    const shown = N(a * a * m, b * b * m);
    const steps = rootSteps(x, 2, m > 1 ? shown : undefined);
    return {
      gen: "",
      title: "Calculá la raíz cuadrada",
      story: r.pick(["Cosecha de raíces en la huerta.", "Para la salsa hace falta esta raíz.", undefined]),
      math: row(root(2, shown), "=", Q()),
      answer: { kind: "fraction" as const, value: ans },
      traps: cleanTraps(ans, [
        { value: x, msg: "Ese es el número de adentro: te faltó sacarle la raíz." },
        { value: F(a, b * b), msg: "Sacaste la raíz solo del numerador. Va arriba Y abajo." },
        { value: F(a * a, b), msg: "Sacaste la raíz solo del denominador. Va arriba Y abajo." },
        { value: F(a * a, 2 * b * b), msg: "La raíz cuadrada no es dividir por 2: buscamos un número que multiplicado por sí mismo dé el de adentro." },
      ]),
      hint: [{ text: m > 1 ? "Primero simplificá la fracción de adentro." : `¿Qué número por sí mismo da ${a * a}? ¿Y cuál da ${b * b}?` }],
      steps,
      rule: RULE_ROOT,
    };
  });
});

export const raizDecimal = gen("w6-decimal", (r) => {
  return retry(() => {
    const small = r.chance(0.25);
    const k = small ? r.int(11, 15) : r.int(1, 15);
    if (k % 10 === 0) return null;
    const den = small ? 100 : 10;
    const base = F(k, den);
    const x = base.pow(2);
    const sx = fractionToDecimalString(x)!;
    const sb = fractionToDecimalString(base)!;
    const half = fractionToDecimalString(x.div(F(2)));
    const shift = decimalStringToFraction(sb)!.div(F(10));
    return {
      gen: "",
      title: "Calculá (respondé con un decimal)",
      math: row(root(2, dec(sx)), "=", Q()),
      answer: { kind: "decimal" as const, value: base },
      traps: cleanTraps(base, [
        { value: shift, msg: `Fijate las cifras decimales: ${fractionToDecimalString(shift)} · ${fractionToDecimalString(shift)} da ${fractionToDecimalString(shift.pow(2))}, no ${sx}.` },
        { value: base.mul(F(10)), msg: `Fijate la coma: ${fractionToDecimalString(base.mul(F(10)))} al cuadrado da ${fractionToDecimalString(base.mul(F(10)).pow(2))}.` },
        ...(half ? [{ value: x.div(F(2)), msg: "La raíz cuadrada no es dividir por 2: buscamos un número que multiplicado por sí mismo dé el de adentro." }] : []),
      ]),
      hint: [{ text: `Pasalo a fracción: ${sx} = ${ft(k * k, den * den)}. Después sacale la raíz arriba y abajo.` }],
      steps: [
        { text: "Lo pasamos a fracción decimal:", math: row(root(2, dec(sx)), "=", root(2, N(k * k, den * den))) },
        { text: "Sacamos la raíz arriba y abajo:", math: row(root(2, N(k * k, den * den)), "=", N(k, den), "=", dec(sb)) },
        { text: "Comprobación:", math: row(dec(sb), "·", dec(sb), "=", dec(sx)) },
      ],
      rule: "Truco: el resultado tiene la MITAD de cifras decimales que el número de adentro.",
    };
  });
});

export const raizCubica = gen("w6-cubica", (r) => {
  return retry(() => {
    const k = r.chance(0.2) ? 4 : 3;
    const a = r.int(1, k === 4 ? 3 : 5);
    const b = r.int(1, k === 4 ? 3 : 6);
    if (gcd(a, b) !== 1 || (a === 1 && b === 1)) return null;
    const negv = k === 3 && r.chance(0.45);
    const x = F(negv ? -(a ** k) : a ** k, b ** k);
    const ans = x.root(k)!;
    return {
      gen: "",
      title: `Calculá la raíz ${idxName(k)}`,
      math: row(root(k, fr(x)), "=", Q()),
      answer: { kind: "fraction" as const, value: ans },
      traps: cleanTraps(ans, [
        {
          value: ans.neg(),
          msg: negv
            ? "Con índice impar, la raíz de un negativo es negativa: (−) · (−) · (−) = (−)."
            : k % 2 === 0
              ? `Es cierto que ${ft(ans.neg())} elevado a la ${k} también da ${ft(x)}, pero la raíz de índice par se toma positiva.`
              : "Revisá el signo.",
        },
        { value: x.div(F(k)), msg: `La raíz no es dividir por ${k}: buscamos un número que elevado a la ${k} dé el de adentro.` },
        { value: x, msg: "Ese es el número de adentro: te faltó sacarle la raíz." },
      ]),
      hint: [{ text: x.d === 1 ? `¿Qué número elevado a la ${k} da ${Math.abs(x.n)}?` : `¿Qué número elevado a la ${k} da ${Math.abs(x.n)}? ¿Y cuál da ${x.d}?` }],
      steps: rootSteps(x, k),
      rule: RULE_ROOT,
    };
  });
});

export const raizExiste = gen("w6-existe", (r) => {
  return retry(() => {
    const k = r.pick([2, 3, 4, 2, 3]);
    const a = r.int(1, k === 2 ? 9 : 3);
    const b = r.int(2, k === 2 ? 9 : 4);
    if (gcd(a, b) !== 1) return null;
    const x = F(-(a ** k), b ** k);
    const even = k % 2 === 0;
    const p = F(a, b);
    const opts: Choice[] = [
      { math: fr(p.neg()), why: even ? `Probá: ${k === 2 ? `(${ft(p.neg())})²` : "un negativo a una potencia par"} da POSITIVO, nunca ${ft(x)}.` : undefined },
      { math: fr(p), why: `${ft(p)} elevado a la ${k} da positivo, no ${ft(x)}.` },
      { label: "No tiene solución en los números reales", why: even ? undefined : `Con índice impar sí existe: (${ft(p.neg())}) elevado a la ${k} da ${ft(x)}.` },
    ];
    const correct = even ? 2 : 0;
    return {
      gen: "",
      title: "¿Cuánto da?",
      story: "Una zanahoria tramposa te desafía.",
      math: row(root(k, fr(x)), "=", Q()),
      answer: { kind: "choice" as const, options: opts, correct },
      hint: [{ text: `¿Hay algún número que elevado a la ${k} dé negativo? Pensá si ${k} es par o impar.` }],
      steps: even
        ? [
            { text: `El índice ${k} es par. Cualquier número elevado a una potencia par da positivo (o cero).` },
            { text: `Entonces ningún número real elevado a la ${k} da ${ft(x)}: no tiene solución en los reales.` },
          ]
        : [{ text: `El índice ${k} es impar, así que existe y es negativa:`, math: row(root(k, fr(x)), "=", fr(p.neg())) }, { math: row(pow(fr(p.neg()), k), "=", fr(x)) }],
      rule: "Raíz de índice par de un número negativo: no existe en los reales. Índice impar: existe y es negativa.",
    };
  });
});

const NON_SQUARE = [F(2), F(3), F(5), F(1, 2), F(1, 3), F(2, 3), F(3, 2), F(2, 5), F(5, 2), F(3, 8), F(8, 3), F(1, 5), F(5, 3), F(6)];

export const raizProducto = gen("w6-producto", (r) => {
  return retry(() => {
    const s = retry(() => {
      const a = r.int(1, 6);
      const b = r.int(1, 7);
      return gcd(a, b) === 1 && !(a === 1 && b === 1) ? F(a, b) : null;
    });
    const p = r.pick(NON_SQUARE);
    const op = r.pick(["·", ":"] as const);
    // · : √p · √q = s  =>  q = s²/p ;  : : √p : √q = s => q = p/s²
    const q = op === "·" ? s.pow(2).div(p) : p.div(s.pow(2));
    if (q.root(2) || !nice(q, 50, 50) || q.equals(p)) return null;
    const inside = op === "·" ? p.mul(q) : p.div(q);
    return {
      gen: "",
      title: "Resolvé usando propiedades",
      story: "Ninguna de las dos raíces es exacta… pero juntas, sí.",
      math: row(root(2, fr(p)), op, root(2, fr(q)), "=", Q()),
      answer: { kind: "fraction" as const, value: s },
      traps: cleanTraps(s, [{ value: inside, msg: "Juntaste bien adentro de una sola raíz, pero te faltó sacar la raíz." }]),
      hint: [{ text: `Juntá todo adentro de una sola raíz: √a ${op} √b = √(a ${op} b).` }],
      steps: [
        { text: `La raíz es distributiva respecto de la ${op === "·" ? "multiplicación" : "división"}: juntamos todo en una sola raíz.`, math: row(root(2, fr(p)), op, root(2, fr(q)), "=", root(2, row(fr(p), op, fr(q)))) },
        { text: "Calculamos adentro y sacamos la raíz:", math: row(root(2, fr(inside)), "=", fr(s)) },
      ],
      rule: "√a · √b = √(a·b)   y   √a : √b = √(a:b). Pero OJO: con la suma y la resta NO vale.",
    };
  });
});

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [6, 8, 10],
  [5, 12, 13],
  [8, 6, 10],
  [4, 3, 5],
  [12, 5, 13],
];

export const raizSumaTrampa = gen("w6-suma-trampa", (r) => {
  return retry(() => {
    const [a, b, c] = r.pick(TRIPLES);
    const d = r.pick([2, 3, 5, 7, 9, 11]);
    if (gcd(c, d) !== 1) return null;
    const sum = r.chance(0.6);
    const ans = sum ? F(c, d) : F(a, d);
    const A = N(a * a, d * d);
    const B = N(b * b, d * d);
    const C = N(c * c, d * d);
    const insideExpr = sum ? row(A, "+", B) : row(C, "-", B);
    const insideVal = sum ? F(c * c, d * d) : F(a * a, d * d);
    const splitVal = sum ? F(a + b, d) : F(c - b, d);
    if (splitVal.equals(insideVal)) return null;
    return {
      gen: "",
      title: "Calculá. Cuidado con la trampa",
      math: row(root(2, insideExpr), "=", Q()),
      answer: { kind: "fraction" as const, value: ans },
      traps: cleanTraps(ans, [
        {
          value: sum ? F(a + b, d) : F(c - b, d),
          msg: `La raíz NO se distribuye en la ${sum ? "suma" : "resta"}: no se puede sacar la raíz de cada término por separado. Primero se opera adentro y después se saca la raíz.`,
        },
        { value: insideVal, msg: "Hiciste bien la cuenta de adentro, pero te faltó sacar la raíz." },
      ]),
      hint: [{ text: `Primero resolvé la ${sum ? "suma" : "resta"} de adentro de la raíz.` }],
      steps: [
        { text: `Primero resolvemos lo de adentro (tienen el mismo denominador):`, math: row(root(2, insideExpr), "=", root(2, N(insideVal.n, insideVal.d))) },
        { text: "Ahora sí sacamos la raíz:", math: row(root(2, N(insideVal.n, insideVal.d)), "=", fr(ans)) },
        { text: `Si separabas, daba ${ft(sum ? F(a + b, d) : F(c - b, d))}, que está MAL.` },
      ],
      rule: "La raíz se puede distribuir en la multiplicación y la división, pero NO en la suma ni en la resta.",
    };
  });
});

const MIXED_ROOTS: [number, number, number][] = [
  // [entero, p, q] con √(entero + p²/q²) exacta
  [1, 3, 4],
  [2, 1, 2],
  [3, 1, 4],
  [4, 5, 6],
  [5, 2, 3],
  [5, 1, 4],
  [6, 1, 2],
];

export const raizMixto = gen("w6-mixto", (r) => {
  const [w, p, q] = r.pick(MIXED_ROOTS);
  const x = F(w * q * q + p * p, q * q);
  const ans = x.root(2)!;
  const rw = intRoot(w, 2);
  return {
    gen: "",
    title: "Calculá la raíz",
    math: row(root(2, mixed(w, p * p, q * q)), "=", Q()),
    answer: { kind: "fraction" as const, value: ans },
    traps: cleanTraps(ans, [
      ...(rw !== null ? [{ value: F(rw).add(F(p, q)), msg: "No se puede sacar la raíz de cada parte del número mixto por separado: un mixto es una SUMA. Primero pasalo a fracción." }] : []),
      { value: x, msg: "Pasaste bien a fracción, pero te faltó sacar la raíz." },
    ]),
    hint: [{ text: "Primero pasá el número mixto a fracción." }],
    steps: [
      { text: "Pasamos el número mixto a fracción:", math: row(mixed(w, p * p, q * q), "=", N(x.n, x.d)) },
      { text: "Sacamos la raíz arriba y abajo:", math: row(root(2, N(x.n, x.d)), "=", frac(root(2, N(x.n)), root(2, N(x.d))), "=", fr(ans)) },
    ],
    rule: "Un número mixto es una suma (entero + fracción): para sacarle la raíz, primero pasalo a fracción.",
  };
});

