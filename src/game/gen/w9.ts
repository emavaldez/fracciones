// Mundo 9 · El Delivery: problemas con enunciado.
import { F, Fraction, lcm } from "../../math/fraction";
import { N, X, coef, fr, par, pow, root, row, type Expr } from "../../math/expr";
import type { Rng } from "../../math/rng";
import { cleanTraps, ft, gen, nice, properFrac, retry } from "../helpers";
import type { Choice, Question, Step, Trap } from "../types";
import { sumSteps } from "./w3";
import { mulSteps } from "./w4";

function opRow(a: Fraction, op: "+" | "-" | "·" | ":", b: Fraction): Expr {
  const res = op === "+" ? a.add(b) : op === "-" ? a.sub(b) : op === "·" ? a.mul(b) : a.div(b);
  if ((op === "+" || op === "-") && a.d !== b.d) {
    const L = lcm(a.d, b.d);
    return row(fr(a), op, fr(b), "=", N(a.n * (L / a.d), L), op, N(b.n * (L / b.d), L), "=", fr(res));
  }
  if (op === ":") return row(fr(a), ":", fr(b), "=", fr(a), "·", fr(b.inv()), "=", fr(res));
  return row(fr(a), op, fr(b), "=", fr(res));
}

function q(story: string, title: string, ans: Fraction, steps: Step[], traps: Trap[], hint: string, rule: string, math?: Expr): Question {
  return {
    gen: "",
    title,
    story,
    math,
    answer: { kind: "fraction", value: ans },
    traps: cleanTraps(ans, traps),
    hint: [{ text: hint }],
    steps,
    rule,
  };
}

const NAMES = ["Martina", "Tomás", "Lu", "Facu", "Sofi", "Benja", "Cami", "Joaco", "Valen", "Mili", "Thiago", "Agus"];

function twoNames(r: Rng) {
  const [a, b] = r.shuffle(NAMES).slice(0, 2);
  return [a, b];
}

// ---------- Problemas de cálculo ----------

export const problemaCalculo = gen("w9-calculo", (r) => {
  return retry<Question>(() => {
    const kind = r.int(0, 7);
    const [A, B] = twoNames(r);
    if (kind === 0) {
      const a = properFrac(r, [2, 3, 4, 5, 6, 8]);
      const b = properFrac(r, [2, 3, 4, 5, 6, 8]);
      const s = a.add(b);
      if (s.compare(F(1)) > 0) return null;
      return q(
        `${A} comió ${ft(a)} de la pizza y ${B} comió ${ft(b)}.`,
        "¿Qué parte de la pizza comieron entre los dos?",
        s,
        [{ text: "Juntar lo que comieron es una SUMA." }, ...sumSteps([{ f: a, op: "+" }, { f: b, op: "+" }])],
        [{ value: F(a.n + b.n, a.d + b.d), msg: "Sumaste numeradores y denominadores por separado. Buscá un denominador común." }],
        "Juntar es sumar.",
        "Leé qué se pregunta: “entre los dos” es juntar, o sea sumar.",
      );
    }
    if (kind === 1) {
      const a = properFrac(r, [2, 3, 4, 5, 6, 8]);
      const b = properFrac(r, [2, 3, 4, 5, 6, 8]);
      const s = a.add(b);
      const rest = F(1).sub(s);
      if (rest.n <= 0) return null;
      return q(
        `De una pizza, ${A} comió ${ft(a)} y ${B} comió ${ft(b)}.`,
        "¿Qué parte de la pizza sobró?",
        rest,
        [
          { text: "Primero, cuánto comieron entre los dos:", math: opRow(a, "+", b) },
          { text: "La pizza entera es 1. Lo que sobra es 1 menos lo que comieron:", math: opRow(F(1), "-", s) },
        ],
        [{ value: s, msg: "Esa es la parte que COMIERON. La pregunta es cuánto SOBRÓ: restale eso a la pizza entera (1)." }],
        "La pizza entera es 1. Restale lo que comieron.",
        "El entero se escribe 1 (o d/d con el denominador que quieras).",
      );
    }
    if (kind === 2) {
      const a = properFrac(r, [2, 3, 4, 5, 8]);
      const n = r.int(2, 12);
      const ans = a.mul(F(n));
      if (!nice(ans)) return null;
      return q(
        `Cada pizza lleva ${ft(a)} kg de harina.`,
        `¿Cuántos kg de harina hacen falta para ${n} pizzas?`,
        ans,
        [{ text: `Si cada una lleva ${ft(a)}, para ${n} es ${n} veces eso: multiplicamos.` }, ...mulSteps(a, F(n))],
        [{ value: F(n).div(a), msg: "Dividiste. Si cada pizza lleva una cantidad, para varias se MULTIPLICA." }],
        "Para varias pizzas iguales, se multiplica.",
        "Cantidad por pizza × número de pizzas = total.",
      );
    }
    if (kind === 3) {
      const a = properFrac(r, [2, 3, 4, 5, 8]);
      const k = r.int(2, 12);
      const T = a.mul(F(k));
      if (!nice(T, 10, 30)) return null;
      return q(
        `Hay ${ft(T)} kg de muzzarella y cada pizza lleva ${ft(a)} kg.`,
        "¿Cuántas pizzas se pueden hacer?",
        F(k),
        [{ text: `Queremos saber cuántas veces entra ${ft(a)} en ${ft(T)}: es una DIVISIÓN.`, math: opRow(T, ":", a) }],
        [{ value: T.mul(a), msg: "Multiplicaste. Para saber cuántas veces entra una cantidad en otra, se DIVIDE." }],
        "¿Cuántas veces entra lo que lleva una pizza en todo lo que hay?",
        "“¿Cuántas veces entra?” se resuelve con una división.",
      );
    }
    if (kind === 4) {
      const a = properFrac(r, [2, 3, 4, 5, 6]);
      const b = properFrac(r, [2, 3, 4, 5]);
      const ans = b.mul(a);
      return q(
        `Quedaban ${ft(a)} de pizza en la bandeja y ${A} se comió ${ft(b)} de lo que había.`,
        "¿Qué parte de la pizza ENTERA se comió?",
        ans,
        [{ text: `“${ft(b)} de lo que había” es ${ft(b)} DE ${ft(a)}: una multiplicación.` }, ...mulSteps(b, a)],
        [
          { value: a.sub(b), msg: `“${ft(b)} de lo que había” no es una resta: es una multiplicación (${ft(b)} · ${ft(a)}).` },
          { value: b, msg: `${ft(b)} es la parte de lo que HABÍA, no de la pizza entera. Calculá ${ft(b)} de ${ft(a)}.` },
        ],
        "“Una fracción DE algo” es una multiplicación.",
        "“a/b de una cantidad” se calcula multiplicando.",
      );
    }
    if (kind === 5) {
      const a = properFrac(r, [3, 4, 5, 6, 8, 10]);
      const b = properFrac(r, [3, 4, 5, 6]);
      const s = a.add(b);
      const rest = F(1).sub(s);
      if (rest.n <= 0) return null;
      return q(
        `El repartidor recorrió ${ft(a)} del camino, paró a cargar nafta y después recorrió otros ${ft(b)} del camino total.`,
        "¿Qué parte del camino le falta?",
        rest,
        [
          { text: "Lo que ya recorrió:", math: opRow(a, "+", b) },
          { text: "El camino entero es 1. Le falta:", math: opRow(F(1), "-", s) },
        ],
        [{ value: s, msg: "Eso es lo que YA recorrió. La pregunta es cuánto le FALTA." }],
        "Sumá lo recorrido y restáselo al camino entero (1).",
        "Lo que falta = el total (1) − lo que ya se hizo.",
      );
    }
    if (kind === 6) {
      const s = properFrac(r, [2, 3, 4, 5, 6, 10]);
      const area = s.pow(2);
      return q(
        `Una pizza cuadrada mide ${ft(s)} m de lado.`,
        "¿Cuál es su área en m²?",
        area,
        [{ text: "El área de un cuadrado es lado por lado (lado al cuadrado):", math: row(pow(fr(s), 2), "=", fr(area)) }],
        [
          { value: s.mul(F(2)), msg: "El área es lado AL CUADRADO (lado · lado), no lado · 2." },
          { value: s.mul(F(4)), msg: "Eso es el perímetro (4 · lado). El área es lado · lado." },
          ...(s.n !== 1 ? [{ value: F(s.n * s.n, s.d), msg: "Elevaste solo el numerador. Va arriba Y abajo." }] : []),
        ],
        "Área del cuadrado = lado².",
        "Área del cuadrado = lado · lado.",
      );
    }
    // kind 7: lado a partir del área
    const s = properFrac(r, [2, 3, 4, 5, 6, 7, 8, 9]);
    const area = s.pow(2);
    return q(
      `Una caja de pizza cuadrada tiene un área de ${ft(area)} m².`,
      "¿Cuánto mide el lado, en metros?",
      s,
      [{ text: "Si lado² = área, el lado es la raíz cuadrada del área:", math: row(root(2, fr(area)), "=", fr(s)) }],
      [
        { value: area.div(F(2)), msg: "La raíz cuadrada no es dividir por 2: buscamos un número que multiplicado por sí mismo dé el área." },
        { value: area.div(F(4)), msg: "Dividir por 4 sirve con el perímetro, no con el área. Acá hay que sacar la raíz cuadrada." },
      ],
      "¿Qué número por sí mismo da el área?",
      "Lado del cuadrado = √área.",
    );
  });
});

export const problemaDelResto = gen("w9-del-resto", (r) => {
  return retry(() => {
    const a = properFrac(r, [2, 3, 4, 5]);
    const b = properFrac(r, [2, 3, 4, 5]);
    const rest = F(1).sub(a);
    const k = lcm(a.d, rest.mul(b).d);
    const total = k * r.int(1, 4);
    if (total > 80 || total < 6) return null;
    const restN = rest.mul(F(total));
    const ans = restN.mul(b);
    if (!ans.isInteger()) return null;
    return q(
      `Se hicieron ${total} pizzas. ${ft(a)} se vendieron en el local y ${ft(b)} del resto se mandaron por delivery.`,
      "¿Cuántas pizzas se mandaron por delivery?",
      ans,
      [
        { text: "Pizzas vendidas en el local:", math: row(fr(a), "·", N(total), "=", fr(a.mul(F(total)))) },
        { text: "El resto:", math: row(N(total), "-", fr(a.mul(F(total))), "=", fr(restN)) },
        { text: `Por delivery van ${ft(b)} DEL RESTO:`, math: row(fr(b), "·", fr(restN), "=", fr(ans)) },
      ],
      [
        { value: b.mul(F(total)), msg: `Calculaste ${ft(b)} del TOTAL. El enunciado dice ${ft(b)} DEL RESTO (lo que no se vendió en el local).` },
        { value: restN, msg: "Ese es el resto. Faltó calcular qué parte de ese resto fue por delivery." },
      ],
      "Primero calculá cuántas quedaron después del local.",
      "Leé con cuidado: “del resto” no es lo mismo que “del total”.",
    );
  });
});

// ---------- Plantear y resolver ecuaciones ----------

interface EqTemplate {
  hint?: string;
  rule?: string;
  story: string;
  question: string;
  correct: Expr;
  wrong: { math: Expr; why: string }[];
  x: Fraction;
  solve: Step[];
  meaning: string;
}

function linSolve(K: Fraction, C: Fraction, R: Fraction, grouped?: { from: Expr; to: Expr; text: string }): Step[] {
  const steps: Step[] = [];
  if (grouped) steps.push({ text: grouped.text, math: row(grouped.from, "=", grouped.to) });
  let rhs = R;
  if (!C.isZero()) {
    rhs = R.sub(C);
    steps.push({
      text: C.n > 0 ? `Pasamos ${ft(C)} restando:` : `Pasamos ${ft(C.neg())} sumando:`,
      math: row(coef(K), "=", C.n > 0 ? opRow(R, "-", C) : opRow(R, "+", C.neg())),
    });
  }
  const x = rhs.div(K);
  if (!K.equals(F(1))) steps.push({ text: `Pasamos ${ft(K)} dividiendo:`, math: row(X, "=", opRow(rhs, ":", K)) });
  else steps.push({ math: row(X, "=", fr(x)) });
  return steps;
}

function eqProblem(r: Rng, t: EqTemplate): Question {
  const opts: Choice[] = r.shuffle([{ math: t.correct }, ...t.wrong.map((w) => ({ math: w.math, why: w.why }))]);
  const correctIdx = opts.findIndex((o) => o.math === t.correct);
  const solveQ: Question = {
    gen: "",
    title: "Ahora resolvela: ¿cuánto vale x?",
    story: t.story,
    math: t.correct,
    answer: { kind: "fraction", value: t.x },
    answerPrefix: "x =",
    hint: [{ text: t.hint ?? "Juntá los términos con x, pasá los números al otro lado y despejá." }],
    steps: [...t.solve, { text: t.meaning }],
    rule: t.rule ?? "Para despejar x: lo que suma pasa restando, lo que resta pasa sumando, lo que multiplica pasa dividiendo.",
  };
  return {
    gen: "",
    title: "¿Qué ecuación representa el problema?",
    story: `${t.story} ${t.question}`,
    answer: { kind: "choice", options: opts, correct: correctIdx },
    hint: [{ text: "Llamá x a lo que no sabés y traducí cada frase del enunciado." }],
    steps: [{ text: "Llamamos x a lo que queremos averiguar y traducimos el enunciado:", math: t.correct }],
    rule: "Plantear una ecuación es traducir el enunciado al lenguaje matemático. x es lo que no conocemos.",
    followUp: solveQ,
  };
}

const PARTS: Record<number, string> = { 2: "la mitad", 3: "la tercera parte", 4: "la cuarta parte", 5: "la quinta parte", 6: "la sexta parte" };

export const problemaEcuacion = gen("w9-ecuacion", (r) => {
  return retry<Question>(() => {
    const kind = r.int(0, 4);
    if (kind === 0) {
      // x + (a/b)x = N
      const a = properFrac(r, [2, 3, 4, 5]);
      const x = F(a.d * r.int(1, 6));
      const K = F(1).add(a);
      const Nn = x.mul(K);
      return eqProblem(r, {
        story: `En la pizzería pensaron un número. Si a ese número le suman ${a.n === 1 ? `su ${PARTS[a.d].replace("la ", "")}` : `sus ${ft(a)} partes`}, da ${ft(Nn)}.`,
        question: "¿Cuál es el número?",
        correct: row(X, "+", coef(a), "=", fr(Nn)),
        wrong: [
          { math: row(X, "+", fr(a), "=", fr(Nn)), why: `Así le sumás ${ft(a)} y nada más. Lo que se suma es una parte DEL número: ${ft(a)}·x.` },
          { math: row(coef(a), "=", fr(Nn)), why: "Falta sumar el número x." },
          { math: row(X, "-", coef(a), "=", fr(Nn)), why: "El enunciado dice “le suman”: es una suma." },
        ],
        x,
        solve: linSolve(K, F(0), Nn, { text: "Juntamos los términos con x (x es 1·x):", from: row(X, "+", coef(a)), to: coef(K) }),
        meaning: `El número es ${ft(x)}.`,
      });
    }
    if (kind === 1) {
      // x − (a/b)x = N
      const a = properFrac(r, [3, 4, 5, 6, 8]);
      const x = F(a.d * r.int(2, 9) * 1000);
      const K = F(1).sub(a);
      const Nn = x.mul(K);
      return eqProblem(r, {
        story: `Gastaron ${ft(a)} de la plata de la caja en harina y les quedaron $${Nn.n}.`,
        question: "¿Cuánta plata había en la caja?",
        correct: row(X, "-", coef(a), "=", fr(Nn)),
        wrong: [
          { math: row(coef(a), "=", fr(Nn)), why: `Los $${Nn.n} son lo que QUEDÓ, no lo que se gastó.` },
          { math: row(X, "-", fr(a), "=", fr(Nn)), why: `Se gastaron ${ft(a)} DE la plata, o sea ${ft(a)}·x, no ${ft(a)} pesos.` },
          { math: row(X, "+", coef(a), "=", fr(Nn)), why: "Si gastan, la plata disminuye: es una resta." },
        ],
        x,
        solve: linSolve(K, F(0), Nn, { text: "Juntamos los términos con x:", from: row(X, "-", coef(a)), to: coef(K) }),
        meaning: `Había $${x.n} en la caja.`,
      });
    }
    if (kind === 2) {
      // (1/2)x + (1/k)x + N = x
      const k = r.pick([3, 4, 5, 6]);
      const L = lcm(2, k);
      const x = F(L * r.int(1, 5));
      const frac2 = F(1, 2);
      const fk = F(1, k);
      const K = F(1).sub(frac2).sub(fk);
      const Nn = x.mul(K);
      if (Nn.n < 2) return null;
      return eqProblem(r, {
        story: `En un pedido, la mitad de las pizzas eran de muzza, ${PARTS[k]} de jamón y las ${Nn.n} restantes de fugazzeta.`,
        question: "¿Cuántas pizzas tenía el pedido?",
        correct: row(coef(frac2), "+", coef(fk), "+", fr(Nn), "=", X),
        wrong: [
          { math: row(fr(frac2), "+", fr(fk), "+", fr(Nn), "=", X), why: `Es la mitad DE las pizzas y ${PARTS[k]} DE las pizzas: hay que multiplicar por x.` },
          { math: row(coef(frac2), "+", coef(fk), "=", fr(Nn)), why: `Las ${Nn.n} de fugazzeta son las que SOBRAN, no la suma de las otras.` },
          { math: row(X, "+", coef(frac2), "+", coef(fk), "=", fr(Nn)), why: "x es el total de pizzas: muzza + jamón + fugazzeta = x." },
        ],
        x,
        solve: linSolve(K, F(0), Nn, {
          text: "Pasamos los términos con x al mismo lado: x − ½x − (la otra parte)·x = (los números)",
          from: row(X, "-", coef(frac2), "-", coef(fk)),
          to: coef(K),
        }).map((s, i) => (i === 0 ? { ...s, text: `Pasamos los términos con x a un lado: x − ${ft(frac2)}x − ${ft(fk)}x = ${Nn.n}. Juntamos:` } : s)),
        meaning: `El pedido tenía ${x.n} pizzas.`,
      });
    }
    if (kind === 3) {
      // k·x − a = c  ó  (1/k)x + a = c
      const half = r.chance(0.5);
      const k = r.pick([2, 3, 4]);
      const a = properFrac(r, [2, 3, 4, 5]);
      const x = properFrac(r, [2, 3, 4, 5, 6]);
      if (!half) {
        const K = F(k);
        const c = K.mul(x).sub(a);
        if (c.n <= 0 || !nice(c, 30, 40)) return null;
        const word = k === 2 ? "el doble" : k === 3 ? "el triple" : "el cuádruple";
        return eqProblem(r, {
          story: `Si a ${word} de un número le restás ${ft(a)}, obtenés ${ft(c)}.`,
          question: "¿Cuál es el número?",
          correct: row(coef(K), "-", fr(a), "=", fr(c)),
          wrong: [
            { math: row(fr(K), "·", par(row(X, "-", fr(a))), "=", fr(c)), why: `Así le restás ${ft(a)} ANTES de multiplicar. El enunciado dice: primero ${word}, después restás.` },
            { math: row(pow(X, k), "-", fr(a), "=", fr(c)), why: `${word[0].toUpperCase() + word.slice(1)} es ${k}·x, no x elevado a la ${k}.` },
            { math: row(coef(K), "+", fr(a), "=", fr(c)), why: "Dice “le restás”: es una resta." },
          ],
          x,
          solve: linSolve(K, a.neg(), c),
          meaning: `El número es ${ft(x)}.`,
        });
      }
      const K = F(1, k);
      const c = K.mul(x).add(a);
      if (!nice(c, 40, 40)) return null;
      return eqProblem(r, {
        story: `${PARTS[k][0].toUpperCase() + PARTS[k].slice(1)} de un número, aumentada en ${ft(a)}, es igual a ${ft(c)}.`,
        question: "¿Cuál es el número?",
        correct: row(coef(K), "+", fr(a), "=", fr(c)),
        wrong: [
          { math: row(coef(F(k)), "+", fr(a), "=", fr(c)), why: `${PARTS[k][0].toUpperCase() + PARTS[k].slice(1)} es x : ${k}, o sea ${ft(K)}·x, no ${k}·x.` },
          { math: row(fr(K), "·", par(row(X, "+", fr(a))), "=", fr(c)), why: "Primero se toma la parte del número y DESPUÉS se suma. Con el paréntesis se suma primero." },
          { math: row(pow(X, k), "+", fr(a), "=", fr(c)), why: `${PARTS[k]} no es una potencia: es dividir por ${k}.` },
        ],
        x,
        solve: linSolve(K, a, c),
        meaning: `El número es ${ft(x)}.`,
      });
    }
    // kind 4: x² = s
    const xp = properFrac(r, [2, 3, 4, 5, 6, 7, 8, 9]);
    const s = xp.pow(2);
    return eqProblem(r, {
      hint: "La potencia pasa al otro lado como raíz.",
      rule: "Si x² = a, entonces x = √a (o −√a). Como el número es positivo, nos quedamos con √a.",
      story: `El cuadrado de un número positivo es ${ft(s)}.`,
      question: "¿Cuál es el número?",
      correct: row(pow(X, 2), "=", fr(s)),
      wrong: [
        { math: row(coef(F(2)), "=", fr(s)), why: "El cuadrado de x es x·x, no 2·x." },
        { math: row(root(2, X), "=", fr(s)), why: "Eso dice que la RAÍZ del número es esa fracción. El enunciado habla del CUADRADO." },
        { math: row(X, ":", N(2), "=", fr(s)), why: "El cuadrado no es la mitad: es x·x." },
      ],
      x: xp,
      solve: [
        { text: "La potencia pasa al otro lado como raíz:", math: row(X, "=", root(2, fr(s))) },
        { math: row(X, "=", fr(xp)) },
      ],
      meaning: `El número es ${ft(xp)}.`,
    });
  });
});

export const problemaEdades = gen("w9-partes", (r) => {
  return retry(() => {
    const a = properFrac(r, [2, 3, 4, 5]);
    const x = F(a.d * r.int(2, 8));
    const Nn = a.mul(x);
    const [A] = twoNames(r);
    return eqProblem(r, {
      story: `${a.n === 1 ? PARTS[a.d][0].toUpperCase() + PARTS[a.d].slice(1) : `Los ${ft(a)}`} de las porciones que hizo ${A} son ${Nn.n} porciones.`,
      question: `¿Cuántas porciones hizo ${A}?`,
      correct: row(coef(a), "=", fr(Nn)),
      wrong: [
        { math: row(X, "+", fr(a), "=", fr(Nn)), why: `“Los ${ft(a)} de las porciones” es ${ft(a)}·x, una multiplicación, no una suma.` },
        { math: row(coef(a.inv()), "=", fr(Nn)), why: "Diste vuelta la fracción." },
        { math: row(X, "-", fr(a), "=", fr(Nn)), why: `“Los ${ft(a)} de” es una multiplicación.` },
      ],
      x,
      solve: linSolve(a, F(0), Nn),
      meaning: `${A} hizo ${x.n} porciones.`,
    });
  });
});

