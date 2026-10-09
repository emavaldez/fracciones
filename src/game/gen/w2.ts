// Mundo 2 · La Mesa de Amasado: expresar de otra forma (mixtos, decimales, periódicos).
import { F, Fraction, decimalStringToFraction, fractionToDecimalString, gcd } from "../../math/fraction";
import { N, dec, fr, mixed, row, type Expr } from "../../math/expr";
import { cleanTraps, denName, ft, gen, plural, retry, simplifySteps } from "../helpers";
import type { Choice, Step } from "../types";

export const impropiaAMixto = gen("w2-a-mixto", (r) => {
  return retry(() => {
    const d = r.int(2, 9);
    const q = r.int(1, 5);
    const rest = r.int(1, d - 1);
    if (gcd(rest, d) !== 1) return null;
    const n = q * d + rest;
    const ans = F(n, d);
    return {
      gen: "",
      title: "Escribilo como número mixto",
      story: `Salieron ${ft(n, d)} de pizza. ¿Cuántas pizzas enteras son y cuánto sobra?`,
      math: N(n, d),
      pizzas: d <= 8 && q <= 3 ? [{ slices: d, filled: n }] : undefined,
      answer: { kind: "mixed" as const, value: ans },
      traps: cleanTraps(ans, [
        ...(q < d ? [{ value: F(rest).add(F(q, d)), msg: `Intercambiaste: el cociente (${q}) es la parte entera y el resto (${rest}) va en el numerador.` }] : []),
        { value: F(q), msg: `Te faltó lo que sobra: además de ${plural(q, "entera", "enteras")} ${rest === 1 ? "queda" : "quedan"} ${denName(rest, d)}.` },
      ]),
      hint: [{ text: `Dividí ${n} : ${d}. El cociente son las pizzas enteras y el resto, las porciones que sobran.` }],
      steps: [
        { text: `Dividimos ${n} : ${d}. Da ${q} y ${rest === 1 ? "sobra 1" : `sobran ${rest}`}, porque:`, math: row(N(n), "=", N(q), "·", N(d), "+", N(rest)) },
        { text: `${q === 1 ? "Es 1 entera" : `Son ${q} enteras`} y ${ft(rest, d)}:`, math: row(N(n, d), "=", mixed(q, rest, d)) },
      ],
      rule: "Para pasar a número mixto: se divide numerador por denominador. El cociente es la parte entera, el resto es el nuevo numerador y el denominador queda igual.",
    };
  });
});

export const mixtoAImpropia = gen("w2-a-impropia", (r) => {
  return retry(() => {
    const w = r.int(1, 5);
    const d = r.int(2, 9);
    const n = r.int(1, d - 1);
    if (gcd(n, d) !== 1) return null;
    const ans = F(w * d + n, d);
    return {
      gen: "",
      title: "Escribilo como una sola fracción",
      math: mixed(w, n, d),
      answer: { kind: "fraction" as const, value: ans },
      traps: cleanTraps(ans, [
        { value: F(w + n, d), msg: `Sumaste el entero directo al numerador. Pero ${w} ${w === 1 ? "entero es" : "enteros son"} ${ft(w * d, d)}, no ${ft(w, d)}.` },
        // Estas dos solo tienen sentido si no coinciden con "olvidarse una parte".
        ...(w > 1 ? [{ value: F(w * n, d), msg: "Multiplicaste el entero por el numerador. Hay que multiplicarlo por el denominador y sumarle el numerador." }] : []),
        ...(n > 1 ? [{ value: F(w * d * n, d), msg: "No se multiplica todo: el entero por el denominador, y a eso se le SUMA el numerador." }] : []),
        { value: F(w), msg: `Te olvidaste de la parte fraccionaria: hay que sumarle ${ft(n, d)}.` },
        { value: F(n, d), msg: `Te olvidaste ${w === 1 ? "del entero" : "de los enteros"}: ${w === 1 ? "1 entero es" : `${w} enteros son`} ${ft(w * d, d)}.` },
      ]),
      hint: [{ text: `Cada entero son ${ft(d, d)}. ¿Cuántos ${DEN_PLURAL(d)} hay en ${w} ${w === 1 ? "entero" : "enteros"}?` }],
      steps: [
        { text: `${w} ${w === 1 ? "entero es" : "enteros son"} ${w}·${d} = ${denName(w * d, d)}.`, math: row(N(w), "=", N(w * d, d)) },
        { text: `Le sumamos ${ft(n, d)}:`, math: row(mixed(w, n, d), "=", N(w * d, d), "+", N(n, d), "=", N(w * d + n, d)) },
      ],
      rule: "Para pasar un mixto a fracción: entero por denominador, más el numerador. El denominador queda igual.",
    };
  });
});

const FINITE_DENS = [2, 4, 5, 8, 10, 20, 25, 40, 50];
const DEN_PLURAL = (d: number) => denName(2, d).replace(/^2 /, "");

function tenPowerFor(d: number) {
  for (const k of [1, 2, 3, 4]) if (10 ** k % d === 0) return k;
  return null;
}

export const decimalAFraccion = gen("w2-dec-a-frac", (r) => {
  return retry(() => {
    const d = r.pick(FINITE_DENS);
    const n = r.int(1, 3 * d - 1);
    if (gcd(n, d) !== 1 || n % d === 0) return null;
    const f = F(n, d);
    const s = fractionToDecimalString(f);
    if (!s) return null;
    const k = s.split(",")[1]?.length ?? 0;
    if (k > 3) return null;
    const digits = Number(s.replace(",", ""));
    const p = 10 ** k;
    const steps: Step[] = [
      { text: `${s} tiene ${k} ${k === 1 ? "cifra decimal" : "cifras decimales"}: abajo va un 1 seguido de ${k} ${k === 1 ? "cero" : "ceros"}.`, math: row(dec(s), "=", N(digits, p)) },
      ...simplifySteps(digits, p),
    ];
    return {
      gen: "",
      title: "Escribilo como fracción irreducible",
      story: r.pick(["La balanza marca este peso en kilos.", "La receta dice esta cantidad de harina.", "El ticket marca esta cantidad."]),
      math: dec(s),
      answer: { kind: "fraction" as const, value: f, mustSimplify: true },
      traps: cleanTraps(f, [
        { value: F(digits, p / 10 || 1), msg: `Fijate la cantidad de ceros: ${s} tiene ${k} ${k === 1 ? "cifra decimal" : "cifras decimales"}, así que va ${p} abajo.` },
        { value: F(digits, p * 10), msg: `Fijate la cantidad de ceros: ${s} tiene ${k} ${k === 1 ? "cifra decimal" : "cifras decimales"}, así que va ${p} abajo.` },
      ]),
      hint: [{ text: `Escribí el número sin coma arriba, y abajo un 1 con tantos ceros como cifras decimales. Después simplificá.` }],
      steps,
      rule: "Decimal finito a fracción: el número sin coma, sobre un 1 seguido de tantos ceros como cifras decimales. Después se simplifica.",
    };
  });
});

export const fraccionADecimal = gen("w2-frac-a-dec", (r) => {
  return retry(() => {
    const d = r.pick([2, 4, 5, 8, 10, 20, 25]);
    const n = r.int(1, 2 * d - 1);
    if (gcd(n, d) !== 1 || n % d === 0) return null;
    const f = F(n, d);
    const s = fractionToDecimalString(f)!;
    const k = tenPowerFor(d)!;
    const m = 10 ** k / d;
    const wrongComma = decimalStringToFraction(`${n},${d}`)!;
    return {
      gen: "",
      title: "Escribilo como número decimal",
      math: N(n, d),
      answer: { kind: "decimal" as const, value: f },
      traps: cleanTraps(f, [{ value: wrongComma, msg: `La raya de fracción no es una coma: ${ft(n, d)} significa ${n} dividido ${d}.` }]),
      hint: [{ text: `Hacé ${n} : ${d}, o buscá una fracción equivalente con denominador 10, 100 o 1000.` }],
      steps: [
        m === 1
          ? { text: `El denominador ya es ${d}: se corre la coma.`, math: row(N(n, d), "=", dec(s)) }
          : {
              text: `Multiplicamos arriba y abajo por ${m} para tener denominador ${10 ** k}:`,
              math: row(N(n, d), "=", N(n * m, 10 ** k), "=", dec(s)),
            },
        { text: `Es lo mismo que hacer ${n} : ${d} = ${s}.` },
      ],
      rule: "Una fracción es una división: numerador dividido denominador.",
    };
  });
});

// ---------- Periódicos ----------

/** Expansión decimal de una fracción positiva: parte entera, anteperíodo y período. */
export function decimalExpansion(f: Fraction) {
  const n = Math.abs(f.n);
  const d = f.d;
  const int = Math.floor(n / d);
  let rem = n % d;
  const seen = new Map<number, number>();
  let digits = "";
  while (rem !== 0 && !seen.has(rem)) {
    seen.set(rem, digits.length);
    rem *= 10;
    digits += Math.floor(rem / d);
    rem %= d;
  }
  if (rem === 0) return { int: `${int}`, ante: digits, period: "" };
  const start = seen.get(rem)!;
  return { int: `${int}`, ante: digits.slice(0, start), period: digits.slice(start) };
}

const per = (int: string, ante: string, period: string): Expr => ({ t: "per", int, ante, period });

export function periodicToFraction(int: string, ante: string, period: string) {
  const all = Number(int + ante + period);
  const noPer = Number(int + ante);
  const den = Number("9".repeat(period.length) + "0".repeat(ante.length));
  return { num: all - noPer, den, f: F(all - noPer, den) };
}

export const periodicoAFraccion = gen("w2-periodico", (r) => {
  return retry(() => {
    const kind = r.int(0, 2);
    let int = "0";
    let ante = "";
    let period = "";
    if (kind === 0) {
      // 0,(p) o 0,(pq)
      period = r.chance(0.7) ? `${r.int(1, 8)}` : `${r.int(1, 9)}${r.int(0, 9)}`;
      if (period.length === 2 && period[0] === period[1]) return null;
    } else if (kind === 1) {
      int = `${r.int(1, 3)}`;
      period = `${r.int(1, 8)}`;
    } else {
      ante = `${r.int(0, 9)}`;
      period = `${r.int(1, 8)}`;
      if (ante === period) return null;
    }
    const { num, den, f } = periodicToFraction(int, ante, period);
    const all = Number(int + ante + period);
    const noPer = Number(int + ante);
    const finiteWrong = decimalStringToFraction(`${int},${ante}${period}`)!;
    const traps = [
      { value: finiteWrong, msg: `Eso sería ${int},${ante}${period} exacto. Pero acá ${period.length === 1 ? "la cifra" : "las cifras"} ${period} se ${period.length === 1 ? "repite" : "repiten"} para siempre: por cada cifra periódica va un 9 abajo.` },
    ];
    if (noPer !== 0) traps.push({ value: F(all, den), msg: `Te faltó restar la parte que no se repite (${noPer}) en el numerador: ${all} − ${noPer}.` });
    if (ante.length) traps.push({ value: F(all - noPer, Number("9".repeat(period.length + ante.length))), msg: "Por cada cifra NO periódica después de la coma va un 0 en el denominador, no un 9." });
    const nines = "9".repeat(period.length);
    const zeros = "0".repeat(ante.length);
    const steps: Step[] = [
      {
        text: `Numerador: todo el número sin coma (${all}) menos la parte que no se repite (${noPer}).`,
      },
      {
        text: `Denominador: un 9 por cada cifra periódica${ante.length ? " y un 0 por cada cifra no periódica después de la coma" : ""}: ${nines}${zeros}.`,
        math: row(per(int, ante, period), "=", { t: "frac", n: row(N(all), "-", N(noPer)), d: N(den) }, "=", N(num, den)),
      },
      ...simplifySteps(num, den),
    ];
    return {
      gen: "",
      title: "Escribilo como fracción",
      story: "La calculadora del local mostró este número que no termina nunca.",
      math: per(int, ante, period),
      answer: { kind: "fraction" as const, value: f },
      traps: cleanTraps(f, traps),
      hint: [{ text: `Abajo va un 9 por cada cifra que se repite${ante.length ? " y un 0 por cada cifra después de la coma que no se repite" : ""}.` }],
      steps,
      rule: "Periódico a fracción: arriba, el número sin coma menos lo que no se repite. Abajo, un 9 por cada cifra periódica y un 0 por cada cifra no periódica después de la coma.",
    };
  });
});

function factorText(d: number) {
  const fs: number[] = [];
  let x = d;
  for (let p = 2; p <= x; p++) while (x % p === 0) (fs.push(p), (x /= p));
  return fs.join("·");
}

export const finitoOPeriodico = gen("w2-finito-o-periodico", (r) => {
  return retry(() => {
    const d = r.pick([3, 4, 6, 7, 8, 9, 11, 12, 15, 16, 20, 25, 30, 40]);
    const n = r.int(1, d - 1);
    if (gcd(n, d) !== 1) return null;
    const f = F(n, d);
    const e = decimalExpansion(f);
    if (e.period.length > 6) return null;
    const finite = e.period === "";
    const options: Choice[] = [
      { label: "Decimal finito", why: finite ? undefined : `El denominador ${d} tiene un factor primo distinto de 2 y 5 (${factorText(d)}), así que la división nunca termina.` },
      { label: "Decimal periódico", why: finite ? `El denominador ${d} = ${factorText(d)} no tiene factores primos distintos de 2 y 5, así que la división termina.` : undefined },
    ];
    const shown: Expr = finite ? dec(fractionToDecimalString(f)!) : per(e.int, e.ante, e.period);
    return {
      gen: "",
      title: "¿Su expresión decimal es finita o periódica?",
      story: "Sin hacer la cuenta: mirá el denominador.",
      math: fr(f),
      answer: { kind: "choice" as const, options, correct: finite ? 0 : 1 },
      hint: [{ text: "Con la fracción ya simplificada, descomponé el denominador en factores primos. Si solo aparecen 2 o 5, es finito." }],
      steps: [
        {
          text: `${factorText(d) === String(d) ? `${d} es primo` : `${d} = ${factorText(d)}`}. ${
            finite ? "No tiene factores primos distintos de 2 y 5: es finito." : "Tiene algún factor primo distinto de 2 y 5: es periódico."
          }`,
        },
        { text: "Haciendo la división:", math: row(fr(f), "=", shown) },
      ],
      rule: "Una fracción irreducible da decimal finito solo si su denominador no tiene otros factores primos que 2 y 5.",
    };
  });
});

export const elegirPeriodico = gen("w2-elegir-periodico", (r) => {
  return retry(() => {
    const d = r.pick([3, 6, 9, 11, 12, 15, 18, 22, 30, 33, 45]);
    const n = r.int(1, Math.min(d - 1, 20));
    if (gcd(n, d) !== 1) return null;
    const f = F(n, d);
    const e = decimalExpansion(f);
    if (!e.period || e.period.length > 2 || e.ante.length > 1) return null;
    const correct: Choice = { math: per(e.int, e.ante, e.period) };
    const truncated = `${e.int},${e.ante}${e.period}`;
    const other = decimalExpansion(F(n + 1, d));
    const opts: Choice[] = [
      correct,
      { math: dec(truncated), why: `${truncated} es un decimal exacto. En ${ft(n, d)} la división no termina: ${e.period.length === 1 ? "la cifra se repite" : "las cifras se repiten"} para siempre.` },
      { math: dec(`${n},${d}`), why: `La raya de fracción no es una coma: ${ft(n, d)} es ${n} dividido ${d}.` },
    ];
    if (other.period && `${other.int}${other.ante}${other.period}` !== `${e.int}${e.ante}${e.period}`) {
      opts.push({ math: per(other.int, other.ante, other.period), why: `Ese es el decimal de ${ft(F(n + 1, d))}. Hacé la división ${n} : ${d}.` });
    }
    const texts = opts.map((o) => JSON.stringify(o.math));
    if (new Set(texts).size !== texts.length) return null;
    const shuffled = r.shuffle(opts);
    return {
      gen: "",
      title: "¿Cuál es su expresión decimal?",
      math: N(n, d),
      answer: { kind: "choice" as const, options: shuffled, correct: shuffled.indexOf(correct) },
      hint: [{ text: `Hacé la división ${n} : ${d} y fijate qué cifras se repiten.` }],
      steps: [{ text: `Dividiendo ${n} : ${d}, las cifras empiezan a repetirse:`, math: row(N(n, d), "=", per(e.int, e.ante, e.period)) }],
      rule: "El arco arriba de las cifras indica que se repiten infinitamente.",
    };
  });
});

