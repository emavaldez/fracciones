// Mundo 5 · La Cámara de Fermentación: potencias y exponentes.
import { F, Fraction, gcd } from "../../math/fraction";
import { N, Q, fr, frac, neg, pow, row, type Expr } from "../../math/expr";
import type { Rng } from "../../math/rng";
import { cleanTraps, gen, nice, retry } from "../helpers";
import type { Step, Trap } from "../types";

const RULE_POW = "Una potencia de una fracción se calcula elevando el numerador y el denominador.";
const RULE_SIGN = "Base negativa: con exponente par el resultado es positivo; con exponente impar, negativo.";
const RULE_NEG = "Exponente negativo: se invierte la base y el exponente pasa a positivo. Exponente 0: da 1.";

function smallFrac(r: Rng, e: number): Fraction {
  return retry(() => {
    const maxN = e >= 4 ? 3 : e === 3 ? 5 : 9;
    const maxD = e >= 4 ? 4 : e === 3 ? 6 : 10;
    const d = r.int(2, maxD);
    const n = r.int(1, maxN);
    if (gcd(n, d) !== 1) return null;
    return F(n, d);
  });
}

/** Pasos para calcular base^e (e entero). */
export function powSteps(base: Fraction, e: number, baseExpr?: Expr): Step[] {
  const be = baseExpr ?? fr(base);
  const steps: Step[] = [];
  if (e === 0) {
    steps.push({ text: "Todo número distinto de 0 elevado a la 0 da 1.", math: row(pow(be, 0), "=", N(1)) });
    return steps;
  }
  let b = base;
  let k = e;
  if (e < 0) {
    b = base.inv();
    k = -e;
    steps.push({
      text: "El exponente negativo da vuelta la base y el exponente pasa a ser positivo:",
      math: row(pow(be, e), "=", pow(fr(b), k)),
    });
  }
  if (b.n < 0) {
    steps.push({
      text: k % 2 === 0 ? `La base es negativa y el exponente (${k}) es par: el resultado es positivo.` : `La base es negativa y el exponente (${k}) es impar: el resultado es negativo.`,
    });
  }
  const res = b.pow(k);
  const abs = b.abs();
  if (k === 1) {
    steps.push({ text: "Con exponente 1 queda la misma base:", math: row(pow(fr(b), 1), "=", fr(res)) });
    return steps;
  }
  if (b.d === 1) {
    steps.push({
      text: k <= 4 ? `Multiplicamos la base ${k} veces por sí misma:` : "Calculamos:",
      math: row(pow(N(abs.n), k), "=", N(abs.n ** k)),
    });
  } else {
    steps.push({
      text: "Elevamos el numerador y el denominador:",
      math: row(pow(fr(abs), k), "=", frac(pow(N(abs.n), k), pow(N(abs.d), k)), "=", fr(abs.pow(k))),
    });
  }
  if (res.n < 0) steps.push({ text: "Con el signo:", math: row(pow(fr(b), k), "=", fr(res)) });
  return steps;
}

function powTraps(base: Fraction, e: number, ans: Fraction): Trap[] {
  const traps: Trap[] = [];
  const b = e < 0 ? base.inv() : base;
  const k = Math.abs(e);
  if (e === 0) {
    traps.push({ value: F(0), msg: "Todo número (distinto de 0) elevado a la 0 da 1, no 0." });
    traps.push({ value: base, msg: "Elevado a la 0 no queda igual: da 1." });
    return cleanTraps(ans, traps);
  }
  if (b.d !== 1) {
    if (Math.abs(b.n) !== 1) traps.push({ value: F(b.n ** k, b.d), msg: "Elevaste solo el numerador. La potencia se aplica arriba Y abajo." });
    traps.push({ value: F(b.n, b.d ** k), msg: "Elevaste solo el denominador. La potencia se aplica arriba Y abajo." });
  }
  traps.push({ value: F(b.n * k, b.d), msg: `Multiplicaste por el exponente. Elevar a la ${k} es multiplicar la base ${k} veces por sí misma.` });
  traps.push({
    value: ans.neg(),
    msg:
      e < 0 && ans.n > 0
        ? "El exponente negativo NO hace negativo el resultado: lo que hace es dar vuelta la base."
        : b.n < 0
          ? RULE_SIGN
          : "El número está bien, pero el signo no.",
  });
  if (e < 0) {
    traps.push({ value: base.pow(k), msg: "Te faltó dar vuelta la base: el exponente negativo invierte la fracción." });
    if (base.pow(k).n > 0) traps.push({ value: base.pow(k).neg(), msg: "El exponente negativo no hace negativo el resultado: invierte la base." });
  }
  return cleanTraps(ans, traps);
}

export const potenciaNatural = gen("w5-natural", (r) => {
  return retry(() => {
    const e = r.pick([2, 2, 2, 3, 3, 4]);
    let base = r.chance(0.15) ? F(r.int(2, e === 2 ? 9 : 4)) : smallFrac(r, e);
    if (r.chance(0.35)) base = base.neg();
    const ans = base.pow(e);
    if (!nice(ans, 1000, 1000)) return null;
    return {
      gen: "",
      title: "Calculá la potencia",
      story: base.compare(F(1)) > 0 ? r.pick(["La masa crece: cada hora se multiplica por sí misma.", "Fermentación a full."]) : r.pick(["Cuidado con la temperatura de la cámara.", undefined]),
      math: row(pow(fr(base), e), "=", Q()),
      answer: { kind: "fraction" as const, value: ans },
      traps: powTraps(base, e, ans),
      hint: [{ text: `Elevar a la ${e} es multiplicar la base ${e} veces. Elevá el numerador y el denominador.` }],
      steps: powSteps(base, e),
      rule: base.n < 0 ? RULE_SIGN : RULE_POW,
    };
  });
});

export const signoPotencia = gen("w5-signo", (r) => {
  // Exponente par: es donde se nota la diferencia entre (−a)ⁿ y −aⁿ.
  const e = r.pick([2, 2, 2, 4]);
  const b = smallFrac(r, e);
  const inside = r.chance(0.5);
  // inside: (−b)^e ; si no: −(b^e)
  const ans = inside ? b.neg().pow(e) : b.pow(e).neg();
  const math: Expr = inside ? pow(fr(b.neg()), e) : neg(pow(fr(b), e));
  const steps: Step[] = inside
    ? [
        { text: "El signo menos está ADENTRO del paréntesis: es parte de la base." },
        ...powSteps(b.neg(), e),
      ]
    : [
        { text: "El signo menos está AFUERA: la potencia se aplica solo a la fracción, y el menos queda adelante." },
        { math: row(neg(pow(fr(b), e)), "=", neg(frac(pow(N(b.n), e), pow(N(b.d), e))), "=", fr(ans)) },
      ];
  return {
    gen: "",
    title: "Calculá. Ojo con el signo",
    math: row(math, "=", Q()),
    answer: { kind: "fraction" as const, value: ans },
    traps: cleanTraps(ans, [
      {
        value: ans.neg(),
        msg: inside
          ? e % 2 === 0
            ? "La base es negativa (el menos está adentro del paréntesis) y el exponente es par: da positivo."
            : "La base es negativa y el exponente es impar: da negativo."
          : "El menos está afuera del paréntesis: no se eleva. Primero se calcula la potencia y después se le pone el menos.",
      },
      ...(b.n !== 1 ? [{ value: F(b.n ** e, b.d), msg: "Elevaste solo el numerador. La potencia se aplica arriba Y abajo." }] : []),
    ]),
    hint: [{ text: inside ? "El menos está adentro del paréntesis: se eleva junto con la fracción." : "El menos está afuera: no se eleva." }],
    steps,
    rule: "No es lo mismo (−a)² que −a²: en el primero el menos es parte de la base; en el segundo, no.",
  };
});

export const potenciaCeroNeg = gen("w5-cero-negativo", (r) => {
  return retry(() => {
    const kind = r.int(0, 4);
    let base: Fraction;
    let e: number;
    if (kind === 0) {
      base = r.chance(0.5) ? smallFrac(r, 2) : F(r.int(2, 9));
      if (r.chance(0.4)) base = base.neg();
      e = 0;
    } else if (kind === 1) {
      base = F(r.int(2, 5));
      e = -r.pick([1, 2, 3]);
      if (r.chance(0.3)) base = base.neg();
    } else {
      const k = r.pick([1, 2, 2, 3]);
      base = smallFrac(r, k);
      if (r.chance(0.35)) base = base.neg();
      e = -k;
    }
    const ans = base.pow(e);
    if (!nice(ans, 1000, 1000)) return null;
    return {
      gen: "",
      title: "Calculá la potencia",
      story: e === 0 ? "Una masa que todavía no levó nada." : "La cámara está al revés: todo se da vuelta.",
      math: row(pow(fr(base), e), "=", Q()),
      answer: { kind: "fraction" as const, value: ans },
      traps: powTraps(base, e, ans),
      hint: [{ text: e === 0 ? "¿Cuánto da cualquier número (no cero) elevado a la 0?" : "Exponente negativo: da vuelta la base y cambiá el exponente a positivo." }],
      steps: powSteps(base, e),
      rule: RULE_NEG,
    };
  });
});

const PROP_BASES = [F(2, 3), F(3, 4), F(1, 2), F(5, 2), F(3, 5), F(-2, 3), F(4, 3), F(-1, 2), F(2, 5)];

export const propiedadesExponente = gen("w5-propiedades", (r) => {
  const base = r.pick(PROP_BASES);
  const B = fr(base);
  const kind = r.int(0, 2);
  const m = r.int(2, 7);
  const n = r.int(2, 6);
  let ans: number;
  let math: Expr;
  let steps: Step[];
  let traps: Trap[];
  let rule: string;
  if (kind === 0) {
    ans = m + n;
    math = row(pow(B, m), "·", pow(B, n), "=", pow(B, Q(true)));
    rule = "Multiplicación de potencias de igual base: se deja la base y se SUMAN los exponentes.";
    traps = [{ value: m * n, msg: "En la multiplicación de potencias de igual base los exponentes se SUMAN, no se multiplican." }];
    steps = [{ text: `Es una multiplicación de igual base: sumamos los exponentes, ${m} + ${n} = ${m + n}.`, math: row(pow(B, m), "·", pow(B, n), "=", pow(B, m + n)) }];
  } else if (kind === 1) {
    ans = m - n;
    math = row(pow(B, m), ":", pow(B, n), "=", pow(B, Q(true)));
    rule = "División de potencias de igual base: se deja la base y se RESTAN los exponentes (el de arriba menos el de abajo).";
    traps = [
      { value: m + n, msg: "En la división de potencias de igual base los exponentes se RESTAN." },
      { value: n - m, msg: `Restaste al revés: es el exponente del dividendo menos el del divisor, ${m} − ${n}.` },
    ];
    steps = [{ text: `Es una división de igual base: restamos los exponentes, ${m} − ${n} = ${m - n}.`, math: row(pow(B, m), ":", pow(B, n), "=", pow(B, m - n)) }];
  } else {
    const a = r.int(2, 4);
    const b = r.int(2, 4);
    ans = a * b;
    math = row(pow({ t: "paren", x: pow(B, a), kind: "(" }, b), "=", pow(B, Q(true)));
    rule = "Potencia de potencia: se deja la base y se MULTIPLICAN los exponentes.";
    traps = [{ value: a + b, msg: "En la potencia de potencia los exponentes se MULTIPLICAN, no se suman." }];
    steps = [{ text: `Potencia de potencia: multiplicamos los exponentes, ${a} · ${b} = ${a * b}.`, math: row(pow({ t: "paren", x: pow(B, a), kind: "(" }, b), "=", pow(B, a * b)) }];
  }
  return {
    gen: "",
    title: "¿Qué exponente va?",
    story: "Sin hacer las cuentas: usá las propiedades.",
    math,
    answer: { kind: "integer" as const, value: ans },
    traps: cleanTraps(ans, traps),
    hint: [{ text: kind === 0 ? "Misma base multiplicando: los exponentes se suman." : kind === 1 ? "Misma base dividiendo: los exponentes se restan." : "Potencia de potencia: los exponentes se multiplican." }],
    steps,
    rule,
  };
});

export const propiedadesValor = gen("w5-propiedades-valor", (r) => {
  return retry(() => {
    const base = r.pick(PROP_BASES);
    const B = fr(base);
    const kind = r.int(0, 1);
    let total: number;
    let math: Expr;
    let first: Step;
    if (kind === 0) {
      // b^m · b^n con m + n chico (puede haber negativos)
      const m = r.int(-3, 6);
      const n = r.int(-4, 3);
      total = m + n;
      if (m === 0 || n === 0 || Math.abs(total) > 3 || (total === 0 && r.chance(0.7))) return null;
      math = row(pow(B, m), "·", pow(B, n));
      first = { text: `Igual base multiplicando: sumamos los exponentes, ${m} + ${n < 0 ? `(${n})` : n} = ${total}.`, math: row(pow(B, m), "·", pow(B, n), "=", pow(B, total)) };
    } else {
      const m = r.int(2, 8);
      const n = r.int(2, 9);
      total = m - n;
      if (Math.abs(total) > 3 || total === 0) return null;
      math = row(pow(B, m), ":", pow(B, n));
      first = { text: `Igual base dividiendo: restamos los exponentes, ${m} − ${n} = ${total}.`, math: row(pow(B, m), ":", pow(B, n), "=", pow(B, total)) };
    }
    const ans = base.pow(total);
    return {
      gen: "",
      title: "Resolvé usando propiedades",
      story: "Usá las propiedades primero: las cuentas quedan mucho más cortas.",
      math: row(math, "=", Q()),
      answer: { kind: "fraction" as const, value: ans },
      traps: cleanTraps(ans, [
        { value: ans.neg(), msg: "Revisá el signo: fijate si el exponente final es par o impar y si la base es negativa." },
        ...(total < 0 ? [{ value: base.pow(-total), msg: `El exponente que queda es negativo (${total}): hay que dar vuelta la base.` }] : []),
      ]),
      hint: [{ text: "Primero juntá todo en una sola potencia con las propiedades. Después calculá." }],
      steps: [first, ...powSteps(base, total)],
      rule: "Con igual base: al multiplicar se suman los exponentes y al dividir se restan.",
    };
  });
});

