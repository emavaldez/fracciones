// Mundo 8 · La Receta Secreta: ecuaciones.
import { F, Fraction, gcd, lcm } from "../../math/fraction";
import { N, X, coef, fr, par, pow, root, row, type Expr } from "../../math/expr";
import type { Rng } from "../../math/rng";
import { cleanTraps, ft, gen, nice, retry } from "../helpers";
import type { Question, Step, Trap } from "../types";
import { eqPz, tPar, tPow, tProd, tRoot, tTerms, tX, tn, type PzSpec } from "../pizarra";

const ONE = F(1);

const RULE_POT = "Las potencias pasan al otro lado como raíces, y las raíces como potencias. Ojo: x² = a tiene dos soluciones, una positiva y una negativa.";
const RULE_EQ = "Para despejar x, lo que suma pasa restando, lo que resta pasa sumando, lo que multiplica pasa dividiendo y lo que divide pasa multiplicando.";

export function niceX(r: Rng, allowNeg = true): Fraction {
  return retry(() => {
    const d = r.pick([1, 1, 2, 3, 4, 5, 6]);
    const n = r.int(1, d === 1 ? 9 : 2 * d + 3);
    if (gcd(n, d) !== 1) return null;
    const f = F(n, d);
    return allowNeg && r.chance(0.25) ? f.neg() : f;
  });
}

function coefFrac(r: Rng): Fraction {
  return r.pick([F(1, 2), F(1, 3), F(2, 3), F(3, 4), F(1, 4), F(2, 5), F(3, 5), F(4, 3), F(3, 2), F(5, 2), F(2), F(3), F(5, 4), F(5, 6)]);
}

function opText(a: Fraction, op: "+" | "-" | "·" | ":", b: Fraction): Expr {
  const res = op === "+" ? a.add(b) : op === "-" ? a.sub(b) : op === "·" ? a.mul(b) : a.div(b);
  if ((op === "+" || op === "-") && a.d !== b.d) {
    const L = lcm(a.d, b.d);
    return row(fr(a), op, fr(b), "=", N(a.n * (L / a.d), L), op, N(b.n * (L / b.d), L), "=", fr(res));
  }
  if (op === ":") return row(fr(a), ":", fr(b), "=", fr(a), "·", fr(b.inv()), "=", fr(res));
  return row(fr(a), op, fr(b), "=", fr(res));
}

/** "x + a" o "x − a" según el signo de a. */
function plus(lhs: Expr, a: Fraction): Expr {
  return a.n < 0 ? row(lhs, "-", fr(a.neg())) : row(lhs, "+", fr(a));
}

function verify(x: Fraction, value: Fraction): Step {
  return { text: `Verificamos: reemplazando x por ${ft(x)}, el primer miembro da ${ft(value)}, como tenía que dar.` };
}

function build(r: Rng, math: Expr, x: Fraction, traps: Trap[], hint: string, steps: Step[] = [], story?: string, pizarra?: PzSpec): Question {
  return {
    gen: "",
    pizarra,
    title: "Despejá x",
    story: story ?? r.pick(["La receta secreta está escondida en esta ecuación.", "La caja fuerte se abre con el valor de x.", undefined]),
    math,
    answer: { kind: "fraction", value: x },
    answerPrefix: "x =",
    traps: cleanTraps(x, traps),
    hint: [{ text: hint }],
    steps,
    rule: RULE_EQ,
  };
}

/** Un paso: x + a = b, x − a = b, c·x = b, x : c = b */
export const ecuacionUnPaso = gen("w8-un-paso", (r) => {
  return retry(() => {
    const x = niceX(r);
    const kind = r.int(0, 3);
    if (kind <= 1) {
      const a0 = coefFrac(r);
      const a = kind === 0 ? a0 : a0.neg(); // x + a  (si a<0 se muestra x − |a|)
      const b = x.add(a);
      if (!nice(b, 36, 60)) return null;
      const eq = row(plus(X, a), "=", fr(b));
      const moving = a.neg();
      const steps: Step[] = [
        {
          text: a.n > 0 ? `El ${ft(a)} está sumando: pasa al otro lado RESTANDO.` : `El ${ft(a.neg())} está restando: pasa al otro lado SUMANDO.`,
          math: row(X, "=", plus(fr(b), moving)),
        },
        { text: "Resolvemos:", math: row(X, "=", opText(b, moving.n < 0 ? "-" : "+", moving.abs())) },
        verify(x, b),
      ];
      return build(r, eq, x, [{ value: b.add(a), msg: a.n > 0 ? "Al pasar al otro miembro, lo que SUMA pasa RESTANDO." : "Al pasar al otro miembro, lo que RESTA pasa SUMANDO." }], a.n > 0 ? "Lo que suma pasa restando." : "Lo que resta pasa sumando.", steps, undefined, eqPz(tTerms({ x: ONE }, a), tn(b)));
    }
    if (kind === 2) {
      const c = coefFrac(r);
      const b = c.mul(x);
      if (!nice(b, 36, 60)) return null;
      const eq = row(coef(c), "=", fr(b));
      const steps: Step[] = [
        { text: "El coeficiente está multiplicando a la x: pasa al otro lado DIVIDIENDO.", math: row(X, "=", fr(b), ":", fr(c)) },
        { text: "Resolvemos (dividir es multiplicar por la inversa):", math: row(X, "=", opText(b, ":", c)) },
      ];
      return build(r, eq, x, [
        { value: b.mul(c), msg: "Lo que MULTIPLICA a la x pasa DIVIDIENDO, no multiplicando." },
        { value: b.sub(c), msg: "El número está multiplicando a la x: no se resta, se divide." },
        { value: c.div(b), msg: "Dividiste al revés: es lo del otro lado dividido el coeficiente." },
      ], "Lo que multiplica a la x pasa dividiendo.", steps, undefined, eqPz(tTerms({ x: c }), tn(b)));
    }
    const c = coefFrac(r);
    const b = x.div(c);
    if (!nice(b, 36, 60)) return null;
    const eq = row(X, ":", fr(c), "=", fr(b));
    const steps: Step[] = [
      { text: "El número está dividiendo a la x: pasa al otro lado MULTIPLICANDO.", math: row(X, "=", fr(b), "·", fr(c)) },
      { text: "Resolvemos:", math: row(X, "=", opText(b, "·", c)) },
    ];
    return build(r, eq, x, [{ value: b.div(c), msg: "Lo que DIVIDE pasa MULTIPLICANDO." }], "Lo que divide a la x pasa multiplicando.", steps, undefined, eqPz(tProd(tX, ":", tn(c)), tn(b)));
  });
});

/** Dos pasos: c·x ± a = b   ó   c·(x ± a) = b */
export const ecuacionDosPasos = gen("w8-dos-pasos", (r) => {
  return retry(() => {
    const x = niceX(r);
    const c = coefFrac(r);
    const a = r.chance(0.5) ? coefFrac(r) : coefFrac(r).neg();
    if (r.chance(0.65)) {
      const b = c.mul(x).add(a);
      if (!nice(b, 36, 60)) return null;
      const eq = row(plus(coef(c), a), "=", fr(b));
      const moved = b.sub(a);
      const steps: Step[] = [
        { text: `Primero sacamos el término sin x: ${a.n > 0 ? "lo que suma pasa restando" : "lo que resta pasa sumando"}.`, math: row(coef(c), "=", plus(fr(b), a.neg())) },
        { text: "Resolvemos ese lado:", math: opText(b, a.n > 0 ? "-" : "+", a.abs()) },
        { text: "Ahora lo que multiplica a la x pasa dividiendo:", math: row(X, "=", fr(moved), ":", fr(c)) },
        { text: "Resolvemos:", math: row(X, "=", opText(moved, ":", c)) },
      ];
      return build(r, eq, x, [
        { value: b.div(c).sub(a), msg: "Dividiste antes de sacar el término sin x. Primero pasá lo que suma o resta, y DESPUÉS lo que multiplica (o dividí TODO el otro lado)." },
        { value: b.add(a).div(c), msg: a.n > 0 ? "Lo que SUMA pasa RESTANDO." : "Lo que RESTA pasa SUMANDO." },
        { value: moved.mul(c), msg: "Lo que MULTIPLICA a la x pasa DIVIDIENDO." },
      ], "Primero pasá el término que no tiene x. Después, lo que multiplica a la x.", steps, undefined, eqPz(tTerms({ x: c }, a), tn(b)));
    }
    // c(x + a) = b
    const b = c.mul(x.add(a));
    if (!nice(b, 36, 60) || x.add(a).isZero()) return null;
    const eq = row(fr(c), "·", par(plus(X, a)), "=", fr(b));
    const q = b.div(c);
    const steps: Step[] = [
      { text: "El número de afuera multiplica a TODO el paréntesis: pasa dividiendo.", math: row(plus(X, a), "=", fr(b), ":", fr(c)) },
      { text: "Resolvemos:", math: opText(b, ":", c) },
      { text: "Ahora despejamos la x:", math: row(X, "=", plus(fr(q), a.neg())) },
      { math: row(X, "=", opText(q, a.n > 0 ? "-" : "+", a.abs())) },
    ];
    return build(r, eq, x, [
      { value: b.sub(a).div(c), msg: `El ${c.d === 1 ? c.n : "coeficiente"} multiplica a TODO el paréntesis (también al número). Primero pasalo dividiendo, o aplicá la propiedad distributiva a los dos términos.` },
      { value: b.mul(c).sub(a), msg: "Lo que MULTIPLICA pasa DIVIDIENDO." },
    ], "Pasá dividiendo el número de afuera del paréntesis.", steps, undefined, eqPz(tProd(tn(c), "·", tPar(tTerms({ x: ONE }, a))), tn(b)));
  });
});

/** x en los dos miembros: c1·x + a = c2·x + b */
export const ecuacionDosMiembros = gen("w8-dos-miembros", (r) => {
  return retry(() => {
    const x = niceX(r);
    const c1 = coefFrac(r);
    const c2 = coefFrac(r);
    if (c1.equals(c2)) return null;
    const a = r.chance(0.5) ? coefFrac(r) : coefFrac(r).neg();
    const b = c1.mul(x).add(a).sub(c2.mul(x));
    if (!nice(b, 24, 40) || b.isZero()) return null;
    const eq = row(plus(coef(c1), a), "=", plus(coef(c2), b));
    const cd = c1.sub(c2);
    const rhs = b.sub(a);
    if (cd.isZero() || !nice(cd, 24, 40) || !nice(rhs, 36, 60)) return null;
    const steps: Step[] = [
      { text: "Juntamos los términos con x de un lado y los números del otro:", math: row(coef(c1), "-", coef(c2), "=", fr(b), a.n > 0 ? "-" : "+", fr(a.abs())) },
      { text: "Operamos con los coeficientes de x:", math: opText(c1, "-", c2) },
      { text: "Operamos con los números:", math: opText(b, a.n > 0 ? "-" : "+", a.abs()) },
      { text: "Queda:", math: row(coef(cd), "=", fr(rhs)) },
      { text: "Pasamos dividiendo:", math: row(X, "=", opText(rhs, ":", cd)) },
    ];
    return build(r, eq, x, [
      { value: rhs.div(c1.add(c2)), msg: "Al pasar el término con x al otro lado cambia de signo: queda restando, no sumando." },
      { value: b.add(a).div(cd), msg: "Al pasar un número al otro miembro cambia el signo." },
    ], "Llevá las x a un lado y los números al otro. Cada término que cruza el = cambia de signo.", steps, undefined, eqPz(tTerms({ x: c1 }, a), tTerms({ x: c2 }, b)));
  });
});

/** Ecuaciones con potencias y raíces: x² = s (x > 0), x³ = s, √x = s, x^(-1) = s */
export const ecuacionPotRaiz = gen("w8-pot-raiz", (r) => {
  return retry(() => {
    const kind = r.int(0, 3);
    const a = r.int(1, 7);
    const b = r.int(1, 7);
    if (gcd(a, b) !== 1 || (a === 1 && b === 1)) return null;
    const p = F(a, b);
    if (kind === 0) {
      const s = p.pow(2);
      const q = build(r, row(pow(X, 2), "=", fr(s)), p, [
        { value: s.div(F(2)), msg: "Elevar al cuadrado no es multiplicar por 2: la operación inversa es la raíz cuadrada." },
        { value: s.pow(2), msg: "Lo contrario de elevar al cuadrado es sacar raíz cuadrada, no volver a elevar." },
      ], "La potencia pasa al otro lado como raíz.", [], undefined, eqPz(tPow(tX, 2), tn(s)));
      q.title = "Despejá x (la solución positiva)";
      q.rule = RULE_POT;
    q.steps = [
        { text: "La potencia 2 pasa al otro lado como raíz cuadrada:", math: row(X, "=", root(2, fr(s))) },
        { math: row(X, "=", fr(p)) },
        { text: `Ojo: ${ft(p.neg())} también cumple, porque un negativo al cuadrado da positivo. Por eso pedimos la positiva.` },
      ];
      return q;
    }
    if (kind === 1) {
      const pp = r.chance(0.5) ? p.neg() : p;
      if (a > 5 || b > 5) return null;
      const s = pp.pow(3);
      const q = build(r, row(pow(X, 3), "=", fr(s)), pp, [
        { value: pp.neg(), msg: "Raíz cúbica de un número negativo es negativa (y de un positivo, positiva)." },
        { value: s.div(F(3)), msg: "Elevar al cubo no es multiplicar por 3: lo inverso es la raíz cúbica." },
      ], "El cubo pasa al otro lado como raíz cúbica.", [], undefined, eqPz(tPow(tX, 3), tn(s)));
      q.rule = RULE_POT;
    q.steps = [
        { text: "La potencia 3 pasa como raíz cúbica:", math: row(X, "=", root(3, fr(s))) },
        { math: row(X, "=", fr(pp)) },
      ];
      return q;
    }
    if (kind === 2) {
      if (b === 1) return null;
      const s = p.pow(2);
      const q = build(r, row(root(2, X), "=", fr(p)), s, [
        ...(p.root(2) ? [{ value: p.root(2)!, msg: "La raíz pasa al otro lado como POTENCIA: hay que elevar al cuadrado." }] : []),
        { value: p.mul(F(2)), msg: "Elevar al cuadrado no es multiplicar por 2." },
        { value: p, msg: "Te faltó elevar al cuadrado: la raíz pasa al otro lado como potencia." },
      ], "La raíz pasa al otro lado como potencia.", [], undefined, eqPz(tRoot(2, tX), tn(p)));
      q.rule = RULE_POT;
    q.steps = [
        { text: "La raíz cuadrada pasa al otro lado como potencia 2:", math: row(X, "=", pow(fr(p), 2)) },
        { math: row(X, "=", fr(s)) },
      ];
      return q;
    }
    const pp = r.chance(0.3) ? p.neg() : p;
    const q = build(r, row(pow(X, -1), "=", fr(pp)), pp.inv(), [
      { value: pp, msg: "x elevado a la −1 es el inverso de x. Entonces x es el inverso de ese número." },
      { value: pp.neg(), msg: "El exponente −1 no cambia el signo: da vuelta la fracción." },
    ], "x elevado a la −1 es el inverso de x.", [], undefined, eqPz(tPow(tX, -1), tn(pp)));
    q.rule = RULE_POT;
    q.steps = [
      { text: "x elevado a la −1 es el inverso de x. Si el inverso de x es ese número, x es su inverso:", math: row(X, "=", pow(fr(pp), -1)) },
      { math: row(X, "=", fr(pp.inv())) },
    ];
    return q;
  });
});
