// Mundo 4 · La Tabla de Cortar: multiplicación y división.
import { F, Fraction, gcd } from "../../math/fraction";
import { N, fr, frac, row, type Expr } from "../../math/expr";
import { DENS_MED, anyFrac, cleanTraps, ft, ftp, gen, nice, properFrac, retry, simplifySteps } from "../helpers";
import type { Question, Step } from "../types";

const RULE_MUL = "Para multiplicar fracciones: numerador por numerador y denominador por denominador.";
const RULE_DIV = "Para dividir fracciones: se multiplica la primera por la inversa de la segunda.";

function signNote(a: Fraction, b: Fraction): Step[] {
  if (a.n >= 0 && b.n >= 0) return [];
  const neg = (a.n < 0) !== (b.n < 0);
  return [
    {
      text: neg
        ? "Regla de los signos: un factor negativo y uno positivo dan resultado NEGATIVO."
        : "Regla de los signos: negativo por negativo da POSITIVO.",
    },
  ];
}

export function mulSteps(a: Fraction, b: Fraction): Step[] {
  const steps: Step[] = [...signNote(a, b)];
  const pn = Math.abs(a.n * b.n);
  const pd = a.d * b.d;
  const g1 = gcd(a.n, b.d);
  const g2 = gcd(b.n, a.d);
  const absA = a.abs();
  const absB = b.abs();
  if (absA.d === 1 && absB.d === 1) {
    steps.push({ text: "Multiplicamos:", math: row(fr(absA), "·", fr(absB), "=", N(pn)) });
    if (a.mul(b).n < 0) steps.push({ text: "Le ponemos el signo:", math: row(fr(a), "·", fr(b), "=", fr(a.mul(b))) });
    return steps;
  }
  steps.push({
    text: "Multiplicamos numerador por numerador y denominador por denominador:",
    math: row(fr(absA), "·", fr(absB), "=", frac(row(N(absA.n), "·", N(absB.n)), row(N(absA.d), "·", N(absB.d))), "=", N(pn, pd)),
  });
  const simp = simplifySteps(pn, pd);
  if (simp.length && (g1 > 1 || g2 > 1)) {
    simp.push({ text: "Truco: podés simplificar en cruz ANTES de multiplicar y los números quedan más chicos." });
  }
  steps.push(...simp);
  const res = a.mul(b);
  if (res.n < 0) steps.push({ text: "Le ponemos el signo:", math: row(fr(a), "·", fr(b), "=", fr(res)) });
  return steps;
}

function mulTraps(a: Fraction, b: Fraction, ans: Fraction) {
  return cleanTraps(ans, [
    { value: F(a.n * b.d, a.d * b.n || 1), msg: "Eso es dividir (multiplicaste en cruz). Para multiplicar: arriba con arriba y abajo con abajo." },
    ...(b.d === 1 ? [{ value: F(a.n * b.n, a.d * b.n || 1), msg: `Multiplicaste también el denominador. El entero ${b.n} es {${b.n}/1}: solo multiplica al numerador.` }] : []),
    ...(a.d === 1 ? [{ value: F(a.n * b.n, a.n * b.d || 1), msg: `Multiplicaste también el denominador. El entero ${a.n} es {${a.n}/1}: solo multiplica al numerador.` }] : []),
    { value: ans.neg(), msg: "El número está bien, pero el signo no. Repasá la regla de los signos." },
  ]);
}

function buildMul(a: Fraction, b: Fraction, story?: string, show?: [Expr, Expr]): Question {
  const ans = a.mul(b);
  return {
    gen: "",
    title: "Resolvé la multiplicación",
    story,
    math: row(show?.[0] ?? fr(a), "·", show?.[1] ?? fr(b), "=", { t: "q" }),
    answer: { kind: "fraction", value: ans },
    traps: mulTraps(a, b, ans),
    hint: [{ text: "Arriba por arriba, abajo por abajo. Si podés, simplificá antes en cruz." }],
    steps: mulSteps(a, b),
    rule: RULE_MUL,
  };
}

function buildDiv(a: Fraction, b: Fraction, story?: string): Question {
  const ans = a.div(b);
  const inv = b.inv();
  return {
    gen: "",
    title: "Resolvé la división",
    story,
    math: row(fr(a), ":", fr(b), "=", { t: "q" }),
    answer: { kind: "fraction", value: ans },
    traps: cleanTraps(ans, [
      { value: a.mul(b), msg: "Multiplicaste directo. Para dividir hay que multiplicar por la INVERSA de la segunda fracción." },
      { value: a.inv().mul(b), msg: "Invertiste la primera fracción. La que se da vuelta es la segunda (el divisor)." },
      { value: ans.neg(), msg: "El número está bien, pero el signo no. En la división vale la misma regla de los signos que en la multiplicación." },
    ]),
    hint: [{ text: `Dividir por ${ft(b)} es lo mismo que multiplicar por ${ft(inv)}.` }],
    steps: [
      { text: "Dividir es multiplicar por la inversa de la segunda fracción (se da vuelta la segunda):", math: row(fr(a), ":", fr(b), "=", fr(a), "·", fr(inv)) },
      ...mulSteps(a, inv),
    ],
    rule: RULE_DIV,
  };
}

export const multiplicar = gen("w4-multiplicar", (r) => {
  return retry(() => {
    if (r.chance(0.25)) {
      const n = r.int(2, 9);
      const b = properFrac(r, DENS_MED);
      if (!nice(b.mul(F(n)))) return null;
      return r.chance(0.5) ? buildMul(F(n), b, "Varias porciones iguales.") : buildMul(b, F(n), "Varias porciones iguales.");
    }
    const a = anyFrac(r, DENS_MED, 10);
    const b = anyFrac(r, DENS_MED, 10);
    if (!nice(a.mul(b))) return null;
    return buildMul(a, b, r.pick([undefined, "Cortá la porción en partes más chicas."]));
  });
});

export const fraccionDe = gen("w4-fraccion-de", (r) => {
  return retry(() => {
    const f = properFrac(r, [2, 3, 4, 5, 6, 8, 10]);
    if (r.chance(0.6)) {
      const total = f.d * r.int(1, 5) * (r.chance(0.5) ? 2 : 1);
      if (total > 60) return null;
      const ans = f.mul(F(total));
      const los = f.n === 1 ? "" : "los ";
      const what = r.pick([
        { s: `De las ${total} porciones que salieron, se vendieron ${los}${ft(f)}.`, q: "¿Cuántas porciones se vendieron?", rest: "Esas son las porciones que NO se vendieron." },
        { s: `Hay ${total} pizzas para repartir y ${ft(f)} van al delivery.`, q: "¿Cuántas pizzas van al delivery?", rest: "Esas son las pizzas que NO van al delivery." },
        { s: `La pizzería tiene ${total} sillas y ${ft(f)} están ocupadas.`, q: "¿Cuántas sillas están ocupadas?", rest: "Esas son las sillas libres." },
      ]);
      return {
        gen: "",
        title: what.q,
        story: what.s,
        math: row(fr(f), " de ", N(total), "=", { t: "q" }),
        answer: { kind: "fraction" as const, value: ans },
        traps: cleanTraps(ans, [
          { value: F(total, f.d), msg: `Calculaste ${ft(1, f.d)} de ${total}, pero faltó multiplicar por ${f.n}.` },
          { value: F(total).div(f), msg: `Dividiste por ${ft(f)}. "${ft(f)} de" significa MULTIPLICAR por ${ft(f)}.` },
          { value: F(total - f.n * (total / f.d)), msg: `${what.rest} La pregunta es por la otra parte.` },
        ]),
        hint: [
          {
            text:
              f.n === 1
                ? `Calculá ${ft(1, f.d)} de ${total}: dividí ${total} por ${f.d}.`
                : `Primero calculá ${ft(1, f.d)} de ${total} (dividí por ${f.d}) y después multiplicá por ${f.n}.`,
          },
        ],
        steps: [
          { text: `"${ft(f)} de ${total}" es una multiplicación:`, math: row(fr(f), "·", N(total), "=", frac(row(N(f.n), "·", N(total)), f.d), "=", N(f.n * total, f.d), "=", fr(ans)) },
          ...(f.n === 1
            ? [{ text: `Es lo mismo que dividir ${total} : ${f.d} = ${ans.n}.` }]
            : [{ text: `Otra forma: ${total} : ${f.d} = ${total / f.d}, y ${total / f.d} · ${f.n} = ${ans.n}.` }]),
        ],
        rule: '"La fracción de una cantidad" se calcula multiplicando la fracción por la cantidad.',
      };
    }
    const g = properFrac(r, [2, 3, 4, 5, 6, 8]);
    const q = buildMul(f, g, `Quedaba ${ft(g)} de pizza y te comiste ${ft(f)} de eso. ¿Qué parte de la pizza entera comiste?`);
    q.title = "¿Qué parte de la pizza entera es?";
    q.math = row(fr(f), " de ", fr(g), "=", { t: "q" });
    q.steps.unshift({ text: `"${ft(f)} de ${ft(g)}" es una multiplicación.` });
    return q;
  });
});

export const dividir = gen("w4-dividir", (r) => {
  return retry(() => {
    if (r.chance(0.25)) {
      // entero : fracción (cuántas porciones entran)
      const b = properFrac(r, [2, 3, 4, 5, 6, 8]);
      const n = r.int(1, 6);
      const q = buildDiv(F(n), b, `Hay ${n} ${n === 1 ? "pizza" : "pizzas"} y cada porción es ${ft(b)} de pizza. ¿Cuántas porciones salen?`);
      return nice(F(n).div(b)) ? q : null;
    }
    const a = anyFrac(r, DENS_MED, 10);
    const b = anyFrac(r, DENS_MED, 10);
    if (a.equals(b) || !nice(a.div(b))) return null;
    return buildDiv(a, b);
  });
});

export const inverso = gen("w4-inverso", (r) => {
  const f0 = anyFrac(r, DENS_MED, 9);
  const f = r.chance(0.5) ? f0.neg() : f0;
  const ans = f.inv();
  return {
    gen: "",
    title: "¿Cuál es el inverso multiplicativo?",
    story: "El inverso es el número que multiplicado por este da 1.",
    math: fr(f),
    answer: { kind: "fraction" as const, value: ans },
    traps: cleanTraps(ans, [
      { value: f.neg(), msg: "Ese es el OPUESTO (cambia el signo). El inverso da vuelta la fracción y conserva el signo." },
      { value: ans.neg(), msg: `Diste vuelta bien, pero el inverso conserva el signo: ${ft(f)} · ${ftp(ans)} = 1.` },
    ]),
    hint: [{ text: "Da vuelta la fracción: el numerador pasa abajo y el denominador arriba. El signo no cambia." }],
    steps: [
      { text: "Damos vuelta la fracción y conservamos el signo:", math: row(fr(f), "→", fr(ans)) },
      { text: "Comprobación:", math: row(fr(f), "·", fr(ans), "=", N(1)) },
    ],
    rule: "El inverso de a/b es b/a (con el mismo signo). Un número por su inverso da 1.",
  };
});

export const multDivSignos = gen("w4-signos", (r) => {
  return retry(() => {
    const a0 = anyFrac(r, DENS_MED, 9);
    const b0 = r.chance(0.2) ? F(r.int(2, 6)) : anyFrac(r, DENS_MED, 9);
    const sa = r.sign();
    const sb = sa > 0 ? -1 : r.sign();
    const a = sa < 0 ? a0.neg() : a0;
    const b = sb < 0 ? b0.neg() : b0;
    const op = r.pick(["·", ":"] as const);
    const ans = op === "·" ? a.mul(b) : a.div(b);
    if (!nice(ans)) return null;
    return op === "·" ? buildMul(a, b) : buildDiv(a, b);
  });
});

export const multTres = gen("w4-tres", (r) => {
  return retry(() => {
    const a = anyFrac(r, DENS_MED, 9);
    const b = anyFrac(r, DENS_MED, 9);
    const c = anyFrac(r, DENS_MED, 9);
    const neg = r.chance(0.4);
    const A = neg ? a.neg() : a;
    const ans = A.mul(b).div(c);
    if (!nice(ans, 40, 60)) return null;
    const inv = c.inv();
    return {
      gen: "",
      title: "Resolvé",
      story: "Una comanda complicada: cortá, repartí y listo.",
      math: row(fr(A), "·", fr(b), ":", fr(c), "=", { t: "q" }),
      answer: { kind: "fraction" as const, value: ans },
      traps: cleanTraps(ans, [
        { value: A.mul(b).mul(c), msg: "Multiplicaste por la última fracción. Como es una división, hay que multiplicar por su INVERSA." },
        { value: ans.neg(), msg: "El número está bien, pero el signo no. Repasá la regla de los signos." },
      ]),
      hint: [{ text: `Cambiá la división por una multiplicación: ": ${ft(c)}" es lo mismo que "· ${ft(inv)}".` }],
      steps: [
        { text: "Cambiamos la división por la multiplicación por la inversa:", math: row(fr(A), "·", fr(b), "·", fr(inv)) },
        ...(A.n < 0 ? [{ text: "Hay un solo factor negativo (una cantidad impar de negativos): el resultado es negativo." }] : []),
        {
          text: "Multiplicamos todos los numeradores y todos los denominadores:",
          math: row(frac(row(N(Math.abs(A.n)), "·", N(b.n), "·", N(inv.n)), row(N(A.d), "·", N(b.d), "·", N(inv.d))), "=", N(Math.abs(A.n) * b.n * inv.n, A.d * b.d * inv.d)),
        },
        ...simplifySteps(Math.abs(A.n) * b.n * inv.n, A.d * b.d * inv.d),
        ...(ans.n < 0 ? [{ text: "Con el signo:", math: fr(ans) }] : []),
      ],
      rule: RULE_DIV,
    };
  });
});
