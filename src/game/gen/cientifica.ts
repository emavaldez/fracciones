// Sector 7 · La Despensa: notación científica (números muy grandes y muy chicos).
import { F, Fraction, fractionToDecimalString } from "../../math/fraction";
import { N, Q, dec, frac, par, pow, row, type Expr } from "../../math/expr";
import type { Rng } from "../../math/rng";
import { decStr, decimalPlaces, groupThousands, isSciMantissa, normSci, pow10, sameSci, sciExpr, sciText, sciValue, toSci } from "../../math/sci";
import { cleanTraps, ft, gen, retry } from "../helpers";
import type { Choice, Question, SciTrap, Step } from "../types";

const RULE =
  "Notación científica: un número mayor o igual que 1 y menor que 10, multiplicado por una potencia de 10. El exponente dice cuántos lugares se corre la coma: positivo si el número es grande, negativo si es menor que 1.";
const RULE_OPS =
  "Para multiplicar, se multiplican los primeros números y se suman los exponentes; para dividir, se dividen y se restan. Si el primer número queda fuera de 1 a 10, se corre la coma y se ajusta el exponente.";

// ---------------------------------------------------------------- ayudas

/** Primer número de 1 a 3 cifras significativas (la última distinta de 0). */
function mantissa(r: Rng, maxSig = 3): Fraction {
  const sig = r.pick([1, 2, 2, 3].filter((x) => x <= maxSig));
  const a = r.int(1, 9);
  if (sig === 1) return F(a);
  if (sig === 2) return F(a * 10 + r.int(1, 9), 10);
  return F(a * 100 + r.int(0, 9) * 10 + r.int(1, 9), 100);
}

/** Número para dibujar: entero o decimal con coma. */
const numE = (f: Fraction): Expr => (f.isInteger() ? N(f.n) : dec(decStr(f, false)));
const p10 = (e: number): Expr => pow(N(10), e);
const ds = (f: Fraction) => decStr(f, false);
/** "5 + (−3)" para escribir cuentas con exponentes. */
const withSign = (x: number) => (x < 0 ? `(${x})` : `${x}`);
const lugares = (k: number) => (k === 1 ? "1 lugar" : `${k} lugares`);

/** Saca las trampas que coinciden con la respuesta o entre sí. */
function cleanSci(ans: { m: Fraction; e: number }, traps: SciTrap[]): SciTrap[] {
  const out: SciTrap[] = [];
  for (const t of traps) {
    if (t.m.isZero() || sameSci(t, ans) || out.some((o) => sameSci(o, t))) continue;
    out.push(t);
  }
  return out;
}

function normalizeStep(c: Fraction, e: number): Step[] {
  if (isSciMantissa(c)) return [];
  const n = normSci(c, e);
  return [
    {
      text:
        c.abs().compare(F(10)) >= 0
          ? `${ds(c)} no es menor que 10, y el primer número tiene que ser menor que 10. Corremos la coma: ${ds(c)} = ${ds(n.m)}·10^${n.e - e}, así que el exponente sube ${n.e - e}.`
          : `${ds(c)} es menor que 1. Corremos la coma: ${ds(c)} = ${ds(n.m)}·10^${n.e - e}, así que el exponente baja ${e - n.e}.`,
      math: row(sciExpr(c, e), "=", sciExpr(n.m, n.e)),
    },
  ];
}

/** Multiplicación o división en notación científica: pasos y errores típicos. */
function mulDiv(op: "·" | ":", a: Fraction, p: number, b: Fraction, q: number) {
  const c = op === "·" ? a.mul(b) : a.div(b);
  const rawE = op === "·" ? p + q : p - q;
  const ans = normSci(c, rawE);
  const left = row(par(sciExpr(a, p)), op, par(sciExpr(b, q)));
  const split = row(par(row(numE(a), op, numE(b))), "·", par(row(p10(p), op, p10(q))));
  const steps: Step[] = [
    {
      text:
        op === "·" ? "Multiplicamos los primeros números entre sí, y las potencias de 10 entre sí." : "Dividimos los primeros números entre sí, y las potencias de 10 entre sí.",
      math: row(left, "=", split),
    },
    {
      text:
        op === "·"
          ? `${ds(a)} · ${ds(b)} = ${ds(c)}. Los exponentes se suman: ${p} + ${withSign(q)} = ${rawE}.`
          : `${ds(a)} : ${ds(b)} = ${ds(c)}. Los exponentes se restan: ${p} − ${withSign(q)} = ${rawE}.`,
      math: row(split, "=", sciExpr(c, rawE)),
    },
    ...normalizeStep(c, rawE),
  ];
  const traps: SciTrap[] = [];
  if (op === "·") {
    traps.push({ ...normSci(c, p * q), msg: `Multiplicaste los exponentes. Al multiplicar potencias de 10, los exponentes se suman: ${p} + ${withSign(q)} = ${rawE}.` });
    traps.push({ ...normSci(a.add(b), rawE), msg: `Sumaste los primeros números. Se multiplican: ${ds(a)} · ${ds(b)} = ${ds(c)}.` });
    if (p < 0 || q < 0) traps.push({ ...normSci(c, p - q), msg: `Ojo con el signo: ${p} + ${withSign(q)} = ${rawE}.` });
  } else {
    traps.push({
      ...normSci(c, p + q),
      msg: q > 0 ? `Sumaste los exponentes. Al dividir potencias de 10, se restan: ${p} − ${q} = ${rawE}.` : `Ojo: ${p} − ${withSign(q)} = ${rawE}. Restar un negativo es sumar.`,
    });
    traps.push({ ...normSci(c, q - p), msg: `Restaste al revés: es el exponente del primero (el que se divide) menos el del segundo: ${p} − ${withSign(q)} = ${rawE}.` });
    // Solo si al revés da un decimal que se pueda escribir.
    const rev = b.div(a);
    if (fractionToDecimalString(rev) !== null && decimalPlaces(normSci(rev, 0).m) <= 3) traps.push({ ...normSci(rev, rawE), msg: `Dividiste al revés: es ${ds(a)} : ${ds(b)}.` });
  }
  if (c.abs().compare(F(10)) >= 0)
    traps.push({
      m: c.div(F(10)),
      e: rawE,
      msg: `Al pasar ${ds(c)} a ${ds(c.div(F(10)))} lo dividiste por 10: para que valga lo mismo, el exponente tiene que subir 1 (queda ${ans.e}).`,
    });
  if (c.abs().compare(F(1)) < 0)
    traps.push({
      m: c.mul(F(10)),
      e: rawE,
      msg: `Al pasar ${ds(c)} a ${ds(c.mul(F(10)))} lo multiplicaste por 10: para que valga lo mismo, el exponente tiene que bajar 1 (queda ${ans.e}).`,
    });
  return { ans, c, rawE, left, steps, traps: cleanSci(ans, traps) };
}

const BIG_STORIES = [
  (s: string) => `En la despensa hay ${s} granos de arroz.`,
  (s: string) => `Desde que abrió, la pizzería usó ${s} gramos de queso.`,
  (s: string) => `La fábrica ya hizo ${s} cajas de pizza.`,
  (s: string) => `En el depósito hay ${s} granos de sal.`,
  (s: string) => `La app de delivery recibió ${s} pedidos.`,
];
/** Cosas chiquitas, cada una con exponentes que dan tamaños creíbles. */
const SMALL_STORIES: [(s: string) => string, number, number][] = [
  [(s) => `La balanza de precisión marcó ${s} kg de levadura.`, -6, -2],
  [(s) => `Un hilito de muzzarella mide ${s} m de grosor.`, -4, -3],
  [(s) => `Una miga de pan pesa ${s} kg.`, -6, -5],
  [(s) => `Una gota de aceite de oliva tiene ${s} litros.`, -5, -5],
  [(s) => `Un grano de sal pesa ${s} g.`, -5, -5],
  [(s) => `Una cucharadita de aceite tiene ${s} litros.`, -3, -3],
];

// ---------------------------------------------------------------- escribir y leer

export const ncEscribirGrande = gen("nc-grande", (r) => {
  const m = mantissa(r);
  const e = r.int(3, 9);
  const v = sciValue(m, e);
  const s = decStr(v);
  const places = decimalPlaces(m);
  const z = e - places;
  return {
    gen: "",
    title: "Escribilo en notación científica",
    story: r.pick(BIG_STORIES)(s),
    math: dec(s),
    answer: { kind: "sci", m, e },
    sciTraps: cleanSci({ m, e }, [
      ...(places > 0
        ? [{ m, e: z, msg: `Contaste solo los ceros del final (${z}). El exponente es cuántos lugares corrés la coma hasta que queda una sola cifra adelante: ${lugares(e)}.` }]
        : []),
      { m, e: e + 1, msg: `Contaste todas las cifras (${e + 1}). La primera cifra se queda adelante de la coma, así que la coma se corre ${lugares(e)}.` },
    ]),
    hint: [{ text: "Corré la coma hasta que quede una sola cifra adelante. Contá cuántos lugares la corriste: ese es el exponente." }],
    steps: [
      { text: `En un número entero, la coma está al final. La corremos hacia la izquierda hasta que quede una sola cifra adelante: ${ds(m)}.` },
      { text: `La corrimos ${lugares(e)}. Como el número es grande, el exponente es positivo: ${e}.`, math: row(dec(s), "=", sciExpr(m, e)) },
      { text: `Comprobamos: 10^${e} es un 1 con ${e} ceros.`, math: row(numE(m), "·", dec(decStr(pow10(e))), "=", dec(s)) },
    ],
    rule: RULE,
  };
});

export const ncEscribirChico = gen("nc-chico", (r) => {
  const m = mantissa(r);
  const [story, lo, hi] = r.pick(SMALL_STORIES);
  const e = r.int(lo, hi);
  const v = sciValue(m, e);
  const s = decStr(v);
  const places = decimalPlaces(m);
  const zeros = -e - 1;
  return {
    gen: "",
    title: "Escribilo en notación científica",
    story: story(s),
    math: dec(s),
    answer: { kind: "sci", m, e },
    sciTraps: cleanSci({ m, e }, [
      {
        m,
        e: e + 1,
        msg: `Contaste solo los ceros que hay después de la coma (${zeros}). La coma se corre hasta pasar la primera cifra que no es 0: ${lugares(-e)}.`,
      },
      ...(places > 0
        ? [{ m, e: e - places, msg: `Contaste todas las cifras después de la coma (${-e + places}). La coma se corre solo hasta que queda una cifra adelante: ${lugares(-e)}.` }]
        : []),
    ]),
    hint: [{ text: "Corré la coma hacia la derecha hasta que quede una cifra (que no sea 0) adelante. Como el número es chico, el exponente es negativo." }],
    steps: [
      { text: `Corremos la coma hacia la derecha hasta pasar la primera cifra que no es 0: queda ${ds(m)}.` },
      { text: `La corrimos ${lugares(-e)}. Como el número es menor que 1, el exponente es negativo: ${e}.`, math: row(dec(s), "=", sciExpr(m, e)) },
      { text: `Comprobamos: 10^${e} = ${decStr(pow10(e))}.`, math: row(numE(m), "·", dec(decStr(pow10(e))), "=", dec(s)) },
    ],
    rule: RULE,
  };
});

export const ncADecimal = gen("nc-decimal", (r) => {
  const m = mantissa(r);
  const big = r.chance(0.5);
  const e = big ? r.int(2, 7) : r.int(-5, -1);
  const v = sciValue(m, e);
  const places = decimalPlaces(m);
  const first = String(m.isInteger() ? m.n : Math.floor(m.value()));
  const traps = [
    {
      value: sciValue(m, -e),
      msg: big
        ? "Corriste la coma para el lado equivocado. Con exponente positivo el número es grande: la coma va hacia la derecha."
        : "Corriste la coma para el lado equivocado. Con exponente negativo el número es chico: la coma va hacia la izquierda.",
    },
    ...(big && places > 0
      ? [
          {
            value: sciValue(m, e + places),
            msg: `Agregaste ${e} ceros después de las cifras, pero después de la coma ya ${places === 1 ? "había 1 cifra" : `había ${places} cifras`}. Hay que correr la coma ${lugares(e)}: los ceros solo completan los lugares que faltan.`,
          },
        ]
      : []),
    ...(!big
      ? [
          {
            value: sciValue(m, e - 1),
            msg: `Pusiste ${-e} ${-e === 1 ? "cero" : "ceros"} después de la coma, pero la coma se corre ${lugares(-e)} desde donde está (después del ${first}): entre la coma y el ${first} ${-e - 1 === 1 ? "queda 1 cero" : `quedan ${-e - 1} ceros`}.`,
          },
        ]
      : []),
  ];
  return {
    gen: "",
    title: "Escribilo como número decimal (sin potencias)",
    math: sciExpr(m, e),
    answer: { kind: "decimal", value: v },
    traps: cleanTraps(v, traps),
    hint: [
      {
        text: big
          ? `Exponente ${e}: corré la coma ${lugares(e)} hacia la derecha y completá con ceros.`
          : `Exponente ${e}: corré la coma ${lugares(-e)} hacia la izquierda y completá con ceros.`,
      },
    ],
    steps: [
      {
        text: big
          ? `El exponente es ${e}: el número es grande. Corremos la coma ${lugares(e)} hacia la derecha, completando con ceros.`
          : `El exponente es ${e}: el número es chico. Corremos la coma ${lugares(-e)} hacia la izquierda, completando con ceros.`,
        math: row(sciExpr(m, e), "=", dec(decStr(v))),
      },
      { text: `Es lo mismo que multiplicar por ${decStr(pow10(e))}.`, math: row(numE(m), "·", dec(decStr(pow10(e))), "=", dec(decStr(v))) },
    ],
    rule: RULE,
  };
});

export const ncFraccion = gen("nc-fraccion", (r) =>
  retry(() => {
    const k = r.int(3, 6);
    const c = r.pick([1, 1, 1, 2, 4, 5]);
    const n = c === 1 ? r.int(1, 99) : r.int(1, 9);
    if (n % 10 === 0) return null;
    const p10s = groupThousands(String(10 ** k));
    const den = c * 10 ** k;
    const denS = groupThousands(String(den));
    const v = F(n, den);
    const { m, e } = toSci(v);
    if (decimalPlaces(m) > 2) return null;
    const q = F(n, c);
    const shown = frac(N(n), dec(denS));
    const traps: SciTrap[] = [];
    if (c === 1 && n >= 10)
      traps.push({
        m,
        e: e - 1,
        msg: `${n}·10^${-k} está bien, pero ${n} no es menor que 10. Al pasar ${n} a ${ds(m)} lo dividiste por 10: el exponente sube 1 y queda ${e}.`,
      });
    const zerosMsg = `${p10s} tiene ${k} ceros: dividir por ${p10s} es multiplicar por 10^${-k}. Contá los ceros de nuevo.`;
    traps.push({ m, e: e + 1, msg: zerosMsg }, { m, e: e - 1, msg: zerosMsg });
    return {
      gen: "",
      title: "Escribí la fracción en notación científica",
      math: shown,
      answer: { kind: "sci", m, e },
      sciTraps: cleanSci({ m, e }, traps),
      hint: [{ text: c === 1 ? `Dividir por ${p10s} es multiplicar por 10^${-k}.` : `${denS} = ${c} · ${p10s}. Dividí primero ${n} por ${c}.` }],
      steps: [
        c === 1
          ? { text: `Dividir por ${p10s} (un 1 con ${k} ceros) es multiplicar por 10^${-k}.`, math: row(shown, "=", sciExpr(F(n), -k)) }
          : {
              text: `${denS} = ${c} · ${p10s}. Primero dividimos ${n} : ${c} = ${ds(q)}, y dividir por ${p10s} es multiplicar por 10^${-k}.`,
              math: row(shown, "=", sciExpr(q, -k)),
            },
        ...normalizeStep(q, -k),
        { text: "Como número decimal, para comprobar:", math: row(sciExpr(m, e), "=", dec(decStr(v))) },
      ],
      rule: RULE,
    } satisfies Question;
  }),
);

// ---------------------------------------------------------------- comparar

export const ncEsCientifica = gen("nc-escientifica", (r) => {
  const m = mantissa(r, 2);
  const e = r.chance(0.5) ? r.int(3, 8) : r.int(-6, -2);
  const bigM = m.mul(F(10));
  const smallM = m.div(F(10));
  const cands: { math: Expr; why?: string }[] = [
    { math: sciExpr(m, e) },
    { math: sciExpr(bigM, e - 1), why: `${ds(bigM)} es mayor que 10. En notación científica el primer número tiene que ser mayor o igual que 1 y menor que 10.` },
    { math: sciExpr(smallM, e + 1), why: `${ds(smallM)} es menor que 1. En notación científica el primer número tiene que ser mayor o igual que 1 y menor que 10.` },
  ];
  const huge = r.chance(0.5) ? m.mul(F(100)) : null;
  if (huge) {
    cands.push({ math: sciExpr(huge, e - 2), why: `${ds(huge)} es mayor que 10. En notación científica el primer número tiene que ser mayor o igual que 1 y menor que 10.` });
  }
  const order = r.shuffle(cands.map((_, i) => i));
  const options: Choice[] = order.map((i) => ({ math: cands[i].math, why: cands[i].why }));
  return {
    gen: "",
    title: "¿Cuál está escrito en notación científica?",
    story: `Los ${cands.length === 3 ? "tres" : "cuatro"} valen lo mismo, pero solo uno está bien escrito.`,
    answer: { kind: "choice", options, correct: order.indexOf(0) },
    hint: [{ text: "Fijate el primer número: tiene que ser mayor o igual que 1 y menor que 10." }],
    steps: [
      { text: "En notación científica, el primer número tiene que ser mayor o igual que 1 y menor que 10.", math: sciExpr(m, e) },
      {
        text: huge
          ? `Los otros valen lo mismo, pero ${ds(bigM)} y ${ds(huge)} son mayores que 10, y ${ds(smallM)} es menor que 1.`
          : `Los otros valen lo mismo, pero ${ds(bigM)} es mayor que 10 y ${ds(smallM)} es menor que 1.`,
        math: row(sciExpr(bigM, e - 1), "=", sciExpr(m, e), "=", sciExpr(smallM, e + 1)),
      },
    ],
    rule: RULE,
  };
});

export const ncComparar = gen("nc-comparar", (r) =>
  retry(() => {
    const kind = r.int(0, 3);
    let A = { m: mantissa(r, 2), e: 0 };
    let B = { m: mantissa(r, 2), e: 0 };
    if (kind === 0 || kind === 1) {
      const [lo, hi] = kind === 0 ? [2, 8] : [-7, -2];
      A.e = r.int(lo, hi);
      B.e = r.int(lo, hi);
      if (A.e === B.e) return null;
      // Primeros números "al revés" de los exponentes, para que no alcance con mirarlos.
      if (A.m.compare(B.m) > 0 === A.e > B.e) [A.m, B.m] = [B.m, A.m];
      if (A.m.equals(B.m)) return null;
    } else if (kind === 2) {
      A.e = B.e = r.chance(0.5) ? r.int(2, 8) : r.int(-7, -2);
      if (A.m.equals(B.m)) return null;
    } else {
      A.e = r.chance(0.5) ? r.int(2, 8) : r.int(-7, -2);
      B = r.chance(0.5) ? { m: A.m.mul(F(10)), e: A.e - 1 } : { m: A.m.div(F(10)), e: A.e + 1 };
    }
    if (r.chance(0.5)) [A, B] = [B, A];
    const va = sciValue(A.m, A.e);
    const vb = sciValue(B.m, B.e);
    const cmp = va.compare(vb);
    const correct = cmp < 0 ? 0 : cmp > 0 ? 1 : 2;
    const sym = ["<", ">", "="] as const;
    const mantCmp = A.m.compare(B.m);
    const why = (i: number): string | undefined => {
      if (i === correct) return undefined;
      if (kind === 3) return `Valen lo mismo: ${sciText(B.m, B.e)} = ${sciText(A.m, A.e)}. Si corrés la coma un lugar, el exponente cambia 1 para compensar.`;
      if (i === 2) return "No valen lo mismo. Mirá primero los exponentes; si son iguales, compará los primeros números.";
      if (kind === 2) return `Tienen la misma potencia de 10, así que gana el primer número más grande: ${ds(A.m.compare(B.m) > 0 ? A.m : B.m)}.`;
      if ((mantCmp < 0 && i === 0) || (mantCmp > 0 && i === 1)) {
        return kind === 1
          ? `Comparaste solo los primeros números. Lo que manda es el exponente: con exponentes negativos, el más cercano a 0 es el más grande (${Math.max(A.e, B.e)} es mayor que ${Math.min(A.e, B.e)}).`
          : `Comparaste solo los primeros números. Lo que manda es el exponente: 10^${Math.max(A.e, B.e)} es mucho más grande que 10^${Math.min(A.e, B.e)}.`;
      }
      return "Al revés: mirá primero los exponentes.";
    };
    const options: Choice[] = sym.map((l, i) => ({ label: l, why: why(i) }));
    const steps: Step[] =
      kind === 3
        ? [
            {
              text: "Corremos la coma en el que no está en notación científica y ajustamos el exponente:",
              math: row(sciExpr(isSciMantissa(A.m) ? B.m : A.m, isSciMantissa(A.m) ? B.e : A.e), "=", sciExpr(isSciMantissa(A.m) ? A.m : B.m, isSciMantissa(A.m) ? A.e : B.e)),
            },
            { text: "Son el mismo número." },
          ]
        : [
            {
              text:
                A.e === B.e
                  ? `Tienen el mismo exponente (${A.e}): comparamos los primeros números.`
                  : `Comparamos los exponentes: ${Math.max(A.e, B.e)} es mayor que ${Math.min(A.e, B.e)}, así que gana el que tiene 10^${Math.max(A.e, B.e)}.`,
            },
            { text: "Escritos como decimales se ve clarito:", math: row(dec(decStr(va)), sym[correct], dec(decStr(vb))) },
          ];
    return {
      gen: "",
      title: "¿Qué signo va en el medio?",
      story: kind === 3 ? "Ojo: uno de los dos no está bien escrito en notación científica." : "Compará los dos números.",
      math: row(sciExpr(A.m, A.e), Q(), sciExpr(B.m, B.e)),
      answer: { kind: "choice", options, correct },
      hint: [
        {
          text:
            kind === 3
              ? "Primero escribí los dos en notación científica (el primer número entre 1 y 10). Después compará los exponentes."
              : "Mirá primero los exponentes. Si son iguales, compará los primeros números.",
        },
      ],
      steps,
      rule: "Con los dos números bien escritos en notación científica, primero se miran los exponentes (el mayor exponente gana). Si son iguales, se comparan los primeros números.",
    } satisfies Question;
  }),
);

export const ncMayor = gen("nc-mayor", (r) =>
  retry(() => {
    const negs = r.pick(["pos", "neg", "mix"] as const);
    const range = negs === "pos" ? [2, 8] : negs === "neg" ? [-8, -2] : [-6, 6];
    const nums: { m: Fraction; e: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const e = r.int(range[0], range[1]);
      if (e === 0) return null;
      nums.push({ m: mantissa(r, 2), e });
    }
    const vals = nums.map((x) => sciValue(x.m, x.e));
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (vals[i].equals(vals[j])) return null;
    const askMax = r.chance(0.5);
    const best = vals.reduce((bi, v, i) => ((askMax ? v.compare(vals[bi]) > 0 : v.compare(vals[bi]) < 0) ? i : bi), 0);
    const c = nums[best];
    // Que haya una "trampa": un número con el primer número más extremo pero que no es la respuesta.
    const trap = nums.findIndex((x, i) => i !== best && (askMax ? x.m.compare(c.m) > 0 : x.m.compare(c.m) < 0));
    if (trap < 0) return null;
    const options: Choice[] = nums.map((x, i) => ({
      math: sciExpr(x.m, x.e),
      why:
        i === best
          ? undefined
          : x.e === c.e
            ? `Tiene la misma potencia de 10 que ${sciText(c.m, c.e)}, pero el primer número es ${askMax ? "más chico" : "más grande"}.`
            : (askMax ? x.m.compare(c.m) > 0 : x.m.compare(c.m) < 0)
              ? `Tiene el primer número ${askMax ? "más grande" : "más chico"}, pero lo que manda es el exponente: ${x.e} es ${askMax ? "menor" : "mayor"} que ${c.e}.`
              : x.e < 0 && c.e < 0
                ? `Con exponentes negativos, el más cercano a 0 es el mayor: ${Math.max(x.e, c.e)} es mayor que ${Math.min(x.e, c.e)}.`
                : `Mirá los exponentes: ${x.e} es ${askMax ? "menor" : "mayor"} que ${c.e}.`,
    }));
    const sorted = nums.map((x, i) => ({ x, v: vals[i] })).sort((p, q) => p.v.compare(q.v));
    const chain: (Expr | "<")[] = [];
    sorted.forEach((s, i) => {
      if (i) chain.push("<");
      chain.push(sciExpr(s.x.m, s.x.e));
    });
    return {
      gen: "",
      title: askMax ? "¿Cuál es el número más grande?" : "¿Cuál es el número más chico?",
      story: askMax ? "Ordenando la despensa: buscá el número más grande." : "Ordenando la despensa: buscá el número más chico.",
      answer: { kind: "choice", options, correct: best },
      hint: [{ text: "Mirá primero los exponentes. Solo si dos tienen el mismo exponente, compará los primeros números." }],
      steps: [
        {
          text:
            (askMax ? `El exponente más grande es ${c.e}` : `El exponente más chico es ${c.e}`) +
            (nums.filter((x) => x.e === c.e).length > 1
              ? `, y hay más de uno con ese exponente: entre esos, gana el que tiene el primer número ${askMax ? "más grande" : "más chico"}.`
              : "."),
        },
        { text: "Ordenados de menor a mayor:", math: row(...chain) },
      ],
      rule: "En notación científica manda el exponente: cuanto más grande el exponente, más grande el número. Si los exponentes son iguales, se comparan los primeros números.",
    } satisfies Question;
  }),
);

// ---------------------------------------------------------------- operar

const MUL_A = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "1,5", "2,5", "3,5", "4,5", "1,2"];
const MUL_B = ["2", "3", "4", "5", "6", "8", "1,5", "2,5"];
const parseF = (s: string) => {
  const [i, f = ""] = s.split(",");
  return F(Number(i + f), 10 ** f.length);
};

export const ncMultiplicar = gen("nc-multiplicar", (r) =>
  retry(() => {
    const a = parseF(r.pick(MUL_A));
    const b = parseF(r.pick(MUL_B));
    const p = r.int(-6, 8);
    const q = r.int(-6, 8);
    if (p === 0 || q === 0 || p + q === 0 || Math.abs(p + q) > 11) return null;
    const md = mulDiv("·", a, p, b, q);
    if (md.ans.e === 0 || decimalPlaces(md.ans.m) > 3) return null;
    return {
      gen: "",
      title: "Calculá y escribí el resultado en notación científica",
      math: md.left,
      answer: { kind: "sci", m: md.ans.m, e: md.ans.e },
      sciTraps: md.traps,
      hint: [{ text: "Multiplicá los primeros números entre sí y sumá los exponentes. Si el primer número da 10 o más, acomodalo." }],
      steps: md.steps,
      rule: RULE_OPS,
    } satisfies Question;
  }),
);

const DIV_B = ["2", "4", "5", "8", "1,5", "2,5", "3", "6", "1,2"];
const DIV_C = ["0,5", "0,25", "0,75", "1,5", "2", "2,5", "3", "4", "1,2", "0,4", "0,6", "0,8", "3,5"];

export const ncDividir = gen("nc-dividir", (r) =>
  retry(() => {
    const b = parseF(r.pick(DIV_B));
    const c = parseF(r.pick(DIV_C));
    const a = b.mul(c);
    if (!isSciMantissa(a) || decimalPlaces(a) > 2) return null;
    const p = r.int(-5, 9);
    const q = r.int(-6, 8);
    if (p === 0 || q === 0 || p === q || Math.abs(p - q) > 11) return null;
    const md = mulDiv(":", a, p, b, q);
    if (md.ans.e === 0) return null;
    return {
      gen: "",
      title: "Calculá y escribí el resultado en notación científica",
      math: md.left,
      answer: { kind: "sci", m: md.ans.m, e: md.ans.e },
      sciTraps: md.traps,
      hint: [{ text: "Dividí los primeros números y restá los exponentes (el del primero menos el del segundo). Si el primer número da menos de 1, acomodalo." }],
      steps: md.steps,
      rule: RULE_OPS,
    } satisfies Question;
  }),
);

const FRACS: [number, number][] = [
  [1, 2],
  [1, 4],
  [3, 4],
  [1, 5],
  [2, 5],
  [3, 5],
  [3, 8],
  [5, 8],
  [1, 3],
  [2, 3],
];
const FRAC_A = ["2", "3", "4", "6", "8", "9", "1,2", "1,5", "2,4", "3,6", "4,8", "6,4", "7,2"];

export const ncFraccionDe = gen("nc-fracde", (r) =>
  retry(() => {
    const [n, d] = r.pick(FRACS);
    const a = parseF(r.pick(FRAC_A));
    const prod = a.mul(F(n, d));
    if (fractionToDecimalString(prod) === null || decimalPlaces(prod) > 3) return null;
    const big = r.chance(0.6);
    // Cosas chiquitas con tamaños creíbles: cada historia trae su exponente.
    const small = r.pick<[number, (x: string) => string]>([
      [-3, (x) => `Una cucharadita de levadura pesa ${x} kg. ¿Cuánto pesa ${ft(n, d)} de cucharadita?`],
      [-4, (x) => `Un hilo de muzzarella mide ${x} m de grosor. Otro hilo es ${ft(n, d)} de ese grosor. ¿Cuánto mide?`],
      [-5, (x) => `Una gota de salsa pesa ${x} kg. Una gotita pesa ${ft(n, d)} de eso. ¿Cuánto pesa?`],
    ]);
    const p = big ? r.int(3, 9) : small[0];
    const ans = normSci(prod, p);
    if (decimalPlaces(ans.m) > 3 || ans.e === 0) return null;
    const traps: SciTrap[] = [];
    if (n !== 1)
      traps.push({ ...normSci(a.div(F(d)), p), msg: `Dividiste por ${d}, pero te faltó multiplicar por ${n}: ${ft(n, d)} de un número es multiplicarlo por ${ft(n, d)}.` });
    if (prod.compare(F(1)) < 0)
      traps.push({ m: prod.mul(F(10)), e: p, msg: `Al pasar ${ds(prod)} a ${ds(prod.mul(F(10)))} lo multiplicaste por 10: el exponente tiene que bajar 1 (queda ${ans.e}).` });
    if (prod.compare(F(10)) >= 0)
      traps.push({ m: prod.div(F(10)), e: p, msg: `Al pasar ${ds(prod)} a ${ds(prod.div(F(10)))} lo dividiste por 10: el exponente tiene que subir 1 (queda ${ans.e}).` });
    const big0 = sciText(a, p);
    const story = big
      ? r.pick([
          `De las ${big0} porciones que se vendieron este año, ${ft(n, d)} fueron de muzzarella. ¿Cuántas fueron?`,
          `En la despensa hay ${big0} granos de arroz. ${ft(n, d)} son de arroz integral. ¿Cuántos son?`,
        ])
      : small[1](big0);
    return {
      gen: "",
      title: "Respondé en notación científica",
      story,
      math: row(N(n, d), "·", par(sciExpr(a, p))),
      answer: { kind: "sci", m: ans.m, e: ans.e },
      sciTraps: cleanSci(ans, traps),
      hint: [{ text: `${ft(n, d)} de un número es multiplicarlo por ${ft(n, d)}. La potencia de 10 se queda como está.` }],
      steps: [
        {
          text: `${ft(n, d)} de un número es multiplicarlo por ${ft(n, d)}. Multiplicamos el primer número y dejamos la potencia de 10 como está: ${ft(n, d)} · ${ds(a)} = ${ds(prod)}.`,
          math: row(N(n, d), "·", par(sciExpr(a, p)), "=", sciExpr(prod, p)),
        },
        ...normalizeStep(prod, p),
      ],
      rule: RULE_OPS,
    } satisfies Question;
  }),
);

const POW_A: [string, number[]][] = [
  ["2", [3]],
  ["3", [2, 3]],
  ["4", [2]],
  ["5", [2]],
  ["1,2", [2, 3]],
  ["1,5", [2, 3]],
  ["2,5", [2]],
];

export const ncPotencia = gen("nc-potencia", (r) =>
  retry(() => {
    const [as, ks] = r.pick(POW_A);
    const a = parseF(as);
    const k = r.pick(ks);
    const p = r.int(-4, 5);
    if (p === 0) return null;
    const ak = a.pow(k);
    const ans = normSci(ak, p * k);
    if (ans.e === 0 || Math.abs(ans.e) > 10 || decimalPlaces(ans.m) > 3) return null;
    const traps: SciTrap[] = [
      { ...normSci(ak, p + k), msg: `Sumaste ${k} al exponente. Al elevar una potencia, los exponentes se multiplican: ${p} · ${k} = ${p * k}.` },
      { ...normSci(a, p * k), msg: `Elevaste solo la potencia de 10: el ${ds(a)} también va elevado a la ${k}.` },
      { ...normSci(a.mul(F(k)), p * k), msg: `${ds(a)} elevado a la ${k} no es ${ds(a)} · ${k}: es ${Array(k).fill(ds(a)).join(" · ")} = ${ds(ak)}.` },
    ];
    if (ak.compare(F(10)) >= 0)
      traps.push({ m: ak.div(F(10)), e: p * k, msg: `Al pasar ${ds(ak)} a ${ds(ak.div(F(10)))} lo dividiste por 10: el exponente tiene que subir 1 (queda ${ans.e}).` });
    return {
      gen: "",
      title: "Calculá y escribí el resultado en notación científica",
      math: pow(sciExpr(a, p), k),
      answer: { kind: "sci", m: ans.m, e: ans.e },
      sciTraps: cleanSci(ans, traps),
      hint: [{ text: `Se elevan los dos: el primer número a la ${k}, y la potencia de 10 multiplicando los exponentes.` }],
      steps: [
        {
          text: `La potencia se reparte en la multiplicación: elevamos el ${ds(a)} y la potencia de 10.`,
          math: row(pow(sciExpr(a, p), k), "=", pow(numE(a), k), "·", pow(par(p10(p)), k)),
        },
        {
          text: `${ds(a)} a la ${k} da ${ds(ak)}. Potencia de potencia: los exponentes se multiplican, ${p} · ${k} = ${p * k}.`,
          math: row(pow(numE(a), k), "·", pow(par(p10(p)), k), "=", sciExpr(ak, p * k)),
        },
        ...normalizeStep(ak, p * k),
      ],
      rule: "Para elevar un número en notación científica a una potencia: se eleva el primer número y se multiplican los exponentes. Después se acomoda el primer número si hace falta.",
    } satisfies Question;
  }),
);

// ---------------------------------------------------------------- problemas

export const ncProblema = gen("nc-problema", (r) =>
  retry(() => {
    const kind = r.int(0, 3);
    let story: string;
    let plan: string;
    let hint: string;
    let md: ReturnType<typeof mulDiv>;
    let title = "Respondé en notación científica";
    if (kind === 0) {
      // Células de levadura en fila (miden unos 5 micrómetros).
      const k = parseF(r.pick(["2", "4", "6", "8", "1,2", "1,5", "3"]));
      const q = r.int(2, 4);
      md = mulDiv("·", F(5), -6, k, q);
      story = `Una célula de levadura mide unos 5·10^-6 m. Si pusiéramos ${sciText(k, q)} células en fila, ¿cuánto medirían?`;
      plan = "Hay que multiplicar lo que mide cada célula por la cantidad de células.";
      hint = "¿Qué operación hacés para juntar muchas células iguales en fila?";
      title = "¿Cuántos metros miden en fila?";
    } else if (kind === 1) {
      // Granos de sal (pesan unos 6·10^-5 g).
      const grams = r.pick(["3", "1,2", "0,6", "9", "12", "1,8", "0,3", "30"]);
      const g = toSci(parseF(grams));
      md = mulDiv(":", g.m, g.e, F(6), -5);
      story = `Un grano de sal pesa unos 6·10^-5 g. ¿Cuántos granos hay en ${grams} g de sal?`;
      plan = `Hay que dividir el peso total por lo que pesa cada grano. Primero escribimos ${grams} en notación científica: ${sciText(g.m, g.e)}.`;
      hint = "¿Cuántas veces entra el peso de un grano en el peso total? Escribí también el total en notación científica.";
      title = "¿Cuántos granos hay?";
    } else if (kind === 2) {
      // La luz recorre unos 3·10^8 m por segundo.
      const [mins, tm, te] = r.pick<[number, Fraction, number]>([
        [5, F(3), 2],
        [10, F(6), 2],
        [15, F(9), 2],
        [20, F(12, 10), 3],
      ]);
      md = mulDiv("·", F(3), 8, tm, te);
      story = `La luz recorre unos 3·10^8 metros por segundo. Una pizza tarda ${mins} minutos en el horno, que son ${sciText(tm, te)} segundos. ¿Cuántos metros recorre la luz mientras se hornea la pizza?`;
      plan = "Hay que multiplicar lo que recorre en un segundo por la cantidad de segundos.";
      hint = "Si en 1 segundo recorre eso, ¿qué hacés para saber cuánto recorre en muchos segundos?";
      title = "¿Cuántos metros recorre la luz?";
    } else {
      // Porciones vendidas y pizzas de 8 porciones.
      const a = parseF(r.pick(["1,6", "2,4", "4", "4,8", "5,6", "6,4", "7,2"]));
      const p = r.int(4, 7);
      md = mulDiv(":", a, p, F(8), 0);
      story = `La cadena de pizzerías vendió ${sciText(a, p)} porciones este año. Cada pizza tiene 8 porciones. ¿Cuántas pizzas son?`;
      plan = "Hay que dividir las porciones por 8. El 8 es 8·10^0 (porque 10^0 = 1).";
      hint = "Cada pizza son 8 porciones: ¿cuántas veces entra el 8 en el total? Podés escribir el 8 como 8·10^0.";
      title = "¿Cuántas pizzas son?";
    }
    if (md.ans.e === 0 || decimalPlaces(md.ans.m) > 3) return null;
    return {
      gen: "",
      title,
      // Sin la cuenta escrita: plantearla es parte del problema.
      story: `${story} Respondé en notación científica.`,
      answer: { kind: "sci", m: md.ans.m, e: md.ans.e },
      sciTraps: md.traps,
      hint: [{ text: hint }],
      steps: [{ text: plan }, ...md.steps],
      rule: RULE_OPS,
    } satisfies Question;
  }),
);
