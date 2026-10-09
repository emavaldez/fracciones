// Mundo 7 · La Cocina a Full: operaciones combinadas.
import { F, Fraction, lcm } from "../../math/fraction";
import { N, Q, fr, par, pow, root, row, type Expr } from "../../math/expr";
import { cleanTraps, gen, nice, retry } from "../helpers";
import type { Question, Step, Trap } from "../types";

type AOp = "+" | "-" | "·" | ":";

function apply(a: Fraction, op: AOp, b: Fraction): Fraction {
  return op === "+" ? a.add(b) : op === "-" ? a.sub(b) : op === "·" ? a.mul(b) : a.div(b);
}

/** Una línea de cuenta: a op b = (paso intermedio) = resultado. */
function opRow(a: Fraction, op: AOp, b: Fraction, ae?: Expr, be?: Expr): Expr {
  const res = apply(a, op, b);
  const A = ae ?? fr(a);
  const B = be ?? fr(b);
  if ((op === "+" || op === "-") && a.d !== b.d && !a.isZero() && !b.isZero()) {
    const L = lcm(a.d, b.d);
    return row(A, op, B, "=", N(a.n * (L / a.d), L), op, N(b.n * (L / b.d), L), "=", fr(res));
  }
  if (op === ":") return row(A, ":", B, "=", fr(a), "·", fr(b.inv()), "=", fr(res));
  return row(A, op, B, "=", fr(res));
}

const sym = (op: AOp) => (op === "-" ? "−" : op);
const opWord: Record<AOp, string> = { "+": "la suma", "-": "la resta", "·": "la multiplicación", ":": "la división" };

const ORDER =
  "Primero se separa en términos (los + y − que no están entre paréntesis). En cada término se resuelven potencias y raíces, después multiplicaciones y divisiones, y al final las sumas y restas.";

const SMALL = [F(1, 2), F(1, 3), F(2, 3), F(1, 4), F(3, 4), F(1, 5), F(2, 5), F(3, 5), F(1, 6), F(5, 6), F(3, 2), F(4, 3), F(5, 4), F(2), F(3)];
const SQUARES = [F(1, 4), F(1, 9), F(4, 9), F(9, 16), F(1, 16), F(25, 4), F(9, 4), F(16, 9), F(1, 25), F(4, 25), F(36, 25), F(49, 4)];
const POWB = [F(1, 2), F(2, 3), F(3, 2), F(1, 3), F(3, 4), F(-1, 2), F(-2, 3), F(4, 3), F(2, 5)];

function ok(f: Fraction) {
  return nice(f, 36, 72);
}

function finish(math: Expr, ans: Fraction, traps: Trap[], hint: string, story?: string, steps: Step[] = []): Question {
  return {
    gen: "",
    title: "Resolvé el cálculo combinado",
    story,
    math: row(math, "=", Q()),
    answer: { kind: "fraction", value: ans },
    traps: cleanTraps(ans, traps),
    hint: [{ text: hint }],
    steps,
    rule: ORDER,
  };
}

const LEFT_TO_RIGHT = "Resolviste de izquierda a derecha. Primero van las multiplicaciones y divisiones, y después las sumas y restas: separá en términos.";
const IGNORE_PARENS = "Lo que está entre paréntesis se resuelve primero.";

/** a ± b·c   ó   a ± b:c */
export const combSumaProducto = gen("w7-suma-producto", (r) => {
  return retry(() => {
    const a = r.pick(SMALL);
    const b = r.pick(SMALL);
    const c = r.pick(SMALL);
    const op1 = r.pick(["+", "-"] as const);
    const op2 = r.pick(["·", ":"] as const);
    const p = apply(b, op2, c);
    const ans = apply(a, op1, p);
    const wrong = apply(apply(a, op1, b), op2, c);
    if (!ok(p) || !ok(ans)) return null;
    const first = r.chance(0.5);
    // Variante: el producto puede ir primero (b·c ± a)
    const math = first ? row(fr(a), op1, fr(b), op2, fr(c)) : row(fr(b), op2, fr(c), op1, fr(a));
    const ans2 = first ? ans : apply(p, op1, a);
    if (!ok(ans2)) return null;
    const steps: Step[] = [
      { text: `Separamos en términos: el ${sym(op1)} separa. Hay un término con ${opWord[op2]} que se resuelve antes.` },
      { text: `Resolvemos ${opWord[op2]}:`, math: opRow(b, op2, c) },
      { text: `Ahora ${opWord[op1]}:`, math: first ? opRow(a, op1, p) : opRow(p, op1, a) },
    ];
    return finish(
      math,
      ans2,
      first ? [{ value: wrong, msg: LEFT_TO_RIGHT }] : [],
      `Antes que ${opWord[op1]}, resolvé ${opWord[op2]}.`,
      r.pick(["Hora pico: tres pedidos a la vez.", "La comanda viene con instrucciones.", undefined]),
      steps,
    );
  });
});

/** (a ± b) · c   ó   (a ± b) : c */
export const combParentesis = gen("w7-parentesis", (r) => {
  return retry(() => {
    const a = r.pick(SMALL);
    const b = r.pick(SMALL);
    const c = r.pick(SMALL);
    const op1 = r.pick(["+", "-"] as const);
    const op2 = r.pick(["·", ":"] as const);
    const s = apply(a, op1, b);
    if (s.isZero()) return null;
    const ans = apply(s, op2, c);
    const wrong = apply(a, op1, apply(b, op2, c));
    if (!ok(s) || !ok(ans)) return null;
    const steps: Step[] = [
      { text: "Primero lo que está entre paréntesis:", math: opRow(a, op1, b) },
      { text: `Después ${opWord[op2]}:`, math: opRow(s, op2, c) },
    ];
    return finish(row(par(row(fr(a), op1, fr(b))), op2, fr(c)), ans, [{ value: wrong, msg: IGNORE_PARENS }], "Empezá por el paréntesis.", undefined, steps);
  });
});

/** p^n ± √q  */
export const combPotRaiz = gen("w7-potencia-raiz", (r) => {
  return retry(() => {
    const p = r.pick(POWB);
    const e = r.pick([2, 2, 3, -1, -2, 0]);
    const q = r.pick(SQUARES);
    const op = r.pick(["+", "-"] as const);
    const pv = p.pow(e);
    const rv = q.root(2)!;
    const order = r.chance(0.5);
    const ans = order ? apply(pv, op, rv) : apply(rv, op, pv);
    if (!ok(ans) || !ok(pv)) return null;
    const P = pow(fr(p), e);
    const R = root(2, fr(q));
    const steps: Step[] = [
      { text: `Separamos en términos: el ${sym(op)} separa la potencia de la raíz.` },
      { text: e < 0 ? "Potencia (exponente negativo: se da vuelta la base):" : e === 0 ? "Potencia (exponente 0):" : "Potencia:", math: row(P, "=", fr(pv)) },
      { text: "Raíz:", math: row(R, "=", fr(rv)) },
      { text: `Ahora ${opWord[op]}:`, math: order ? opRow(pv, op, rv) : opRow(rv, op, pv) },
    ];
    const math = order ? row(P, op, R) : row(R, op, P);
    const traps: Trap[] = [];
    if (e > 0 && p.d !== 1 && Math.abs(p.n) !== 1) traps.push({ value: order ? apply(F(p.n ** e, p.d), op, rv) : apply(rv, op, F(p.n ** e, p.d)), msg: "En la potencia elevaste solo el numerador. Va arriba Y abajo." });
    if (e < 0) traps.push({ value: order ? apply(p.pow(-e), op, rv) : apply(rv, op, p.pow(-e)), msg: "Te faltó dar vuelta la base en la potencia de exponente negativo." });
    if (e === 0) traps.push({ value: order ? apply(F(0), op, rv) : apply(rv, op, F(0)), msg: "Elevado a la 0 da 1, no 0." });
    return finish(math, ans, traps, "Calculá la potencia y la raíz por separado. Después operá.", undefined, steps);
  });
});

/** a · b ± c^(-1)   ó   √(a·b) ± c */
export const combMixta = gen("w7-mixta", (r) => {
  return retry(() => {
    if (r.chance(0.5)) {
      const a = r.pick(SMALL);
      const b = r.pick(SMALL);
      const c = r.pick(POWB);
      const op = r.pick(["+", "-"] as const);
      const m = a.mul(b);
      const ci = c.inv();
      const ans = apply(m, op, ci);
      if (!ok(ans) || !ok(m)) return null;
      const q = finish(
        row(fr(a), "·", fr(b), op, pow(fr(c), -1)),
        ans,
        [
          { value: apply(m, op, c), msg: "El exponente −1 da vuelta la base (es el inverso)." },
          { value: apply(m, op, c.neg()), msg: "El exponente −1 no cambia el signo: da vuelta la base." },
        ],
        "Separá en términos. En uno hay una multiplicación, en el otro una potencia.",
      );
      q.steps = [
        { text: `Separamos en términos con el ${sym(op)}.` },
        { text: "Multiplicación:", math: opRow(a, "·", b) },
        { text: "Potencia con exponente −1 (es el inverso):", math: row(pow(fr(c), -1), "=", fr(ci)) },
        { text: `Ahora ${opWord[op]}:`, math: opRow(m, op, ci) },
      ];
      return q;
    }
    const s = r.pick(SQUARES);
    const a = r.pick(SMALL.filter((x) => !x.root(2)));
    const b = s.div(a);
    if (!nice(b, 30, 30) || b.root(2)) return null;
    const c = r.pick(SMALL);
    const op = r.pick(["+", "-"] as const);
    const rv = s.root(2)!;
    const ans = apply(rv, op, c);
    if (!ok(ans)) return null;
    const q = finish(
      row(root(2, row(fr(a), "·", fr(b))), op, fr(c)),
      ans,
      [{ value: apply(s, op, c), msg: "Te faltó sacar la raíz después de multiplicar." }],
      "Primero resolvé lo de adentro de la raíz.",
    );
    q.steps = [
      { text: "Primero lo de adentro de la raíz:", math: opRow(a, "·", b) },
      { text: "Sacamos la raíz:", math: row(root(2, fr(s)), "=", fr(rv)) },
      { text: `Ahora ${opWord[op]}:`, math: opRow(rv, op, c) },
    ];
    return q;
  });
});

/** [ (a ± b) : c ]^2   ó   (a ± b)^2 · c */
export const combCorchetes = gen("w7-corchetes", (r) => {
  return retry(() => {
    const kind = r.int(0, 2);
    const a = r.pick(SMALL);
    const b = r.pick(SMALL);
    const c = r.pick(SMALL);
    const op1 = r.pick(["+", "-"] as const);
    const s = apply(a, op1, b);
    if (s.isZero() || !ok(s)) return null;
    if (kind === 0) {
      const op2 = r.pick(["·", ":"] as const);
      const t = apply(s, op2, c);
      const ans = t.pow(2);
      if (!ok(t) || !ok(ans)) return null;
      return {
        ...finish(pow(par(row(par(row(fr(a), op1, fr(b))), op2, fr(c)), "["), 2), ans, [{ value: t, msg: "Te faltó elevar al cuadrado el corchete." }], "De adentro hacia afuera: paréntesis, corchete y al final la potencia."),
        steps: [
          { text: "Primero el paréntesis:", math: opRow(a, op1, b) },
          { text: `Después ${opWord[op2]} dentro del corchete:`, math: opRow(s, op2, c) },
          { text: "Por último, la potencia:", math: row(pow(fr(t), 2), "=", fr(ans)) },
        ],
      };
    }
    if (kind === 1) {
      const sq = s.pow(2);
      const ans = sq.mul(c);
      if (!ok(sq) || !ok(ans)) return null;
      return {
        ...finish(row(pow(par(row(fr(a), op1, fr(b))), 2), "·", fr(c)), ans, [
          { value: apply(a.pow(2), op1, b.pow(2)).mul(c), msg: "La potencia NO se distribuye en la suma ni en la resta: primero se resuelve el paréntesis y después se eleva." },
          { value: s.mul(c), msg: "Te faltó elevar al cuadrado el paréntesis." },
        ], "Resolvé el paréntesis, elevá, y después multiplicá."),
        steps: [
          { text: "Primero el paréntesis:", math: opRow(a, op1, b) },
          { text: "Elevamos al cuadrado:", math: row(pow(fr(s), 2), "=", fr(sq)) },
          { text: "Multiplicamos:", math: opRow(sq, "·", c) },
        ],
        rule: "La potencia no se distribuye en la suma ni en la resta: (a + b)² no es a² + b².",
      };
    }
    // a − [b − c²]  (base positiva, para que el error de signo del corchete no se confunda con el de la potencia)
    const p = r.pick(POWB.filter((x) => x.n > 0));
    const p2 = p.pow(2);
    const inner = b.sub(p2);
    const ans = a.sub(inner);
    if (!ok(inner) || !ok(ans)) return null;
    return {
      ...finish(row(fr(a), "-", par(row(fr(b), "-", pow(fr(p), 2)), "[")), ans, [{ value: a.sub(b).sub(p2), msg: "El − delante del corchete cambia el signo de TODO lo de adentro: −[b − c] = −b + c." }], "Resolvé primero lo de adentro del corchete."),
      steps: [
        { text: "Dentro del corchete, primero la potencia:", math: row(pow(fr(p), 2), "=", fr(p2)) },
        { text: "Después la resta de adentro:", math: opRow(b, "-", p2) },
        { text: "Por último:", math: opRow(a, "-", inner) },
      ],
    };
  });
});

