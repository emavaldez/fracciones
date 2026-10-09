// Cuentas sueltas entre dos fracciones (para la mesa de ecuaciones):
// resultado, errores típicos y explicación paso a paso.
import { F, Fraction, lcm } from "../math/fraction";
import { fr, row } from "../math/expr";
import { sumSteps } from "./gen/w3";
import { mulSteps } from "./gen/w4";
import { cleanTraps, ft } from "./helpers";
import type { Step, Trap } from "./types";

export type COp = "+" | "-" | "·" | ":";

export function opApply(a: Fraction, op: COp, b: Fraction): Fraction {
  return op === "+" ? a.add(b) : op === "-" ? a.sub(b) : op === "·" ? a.mul(b) : a.div(b);
}

export function opSteps(a: Fraction, op: COp, b: Fraction): Step[] {
  if (op === "+" || op === "-") return sumSteps([{ f: a, op: "+" }, { f: b, op }]);
  if (op === "·") return mulSteps(a, b);
  return [
    { text: "Dividir es multiplicar por la inversa (se da vuelta la segunda):", math: row(fr(a), ":", fr(b), "=", fr(a), "·", fr(b.inv())) },
    ...mulSteps(a, b.inv()),
  ];
}

export function opTraps(a: Fraction, op: COp, b: Fraction): Trap[] {
  const ans = opApply(a, op, b);
  const t: Trap[] = [];
  if (op === "+" || op === "-") {
    const s = op === "+" ? 1 : -1;
    if (a.d === b.d) {
      if (op === "+") t.push({ value: F(a.n + b.n, 2 * a.d), msg: "Sumaste los denominadores. Si el denominador es el mismo, queda igual: solo se suman los numeradores." });
      else t.push({ value: F(a.n - b.n), msg: `Te olvidaste del denominador: si es el mismo, queda igual (${a.d}).` });
    } else {
      const L = lcm(a.d, b.d);
      const dd = a.d + s * b.d;
      if (dd > 0)
        t.push({
          value: F(a.n + s * b.n, dd),
          msg: `${op === "+" ? "Sumaste" : "Restaste"} numerador con numerador y denominador con denominador. Primero llevá las dos al mismo denominador (${L}).`,
        });
      t.push({ value: F(a.n + s * b.n, L), msg: `Usaste el denominador común ${L}, pero te faltó ampliar los numeradores.` });
    }
    t.push({ value: op === "+" ? a.sub(b) : a.add(b), msg: `Fijate la operación: es una ${op === "+" ? "suma" : "resta"}.` });
    if (a.n < 0) t.push({ value: opApply(a.abs(), op, b), msg: `Ojo con el signo del primer número: es negativo (${ft(a)}).` });
  } else if (op === "·") {
    if (!b.isZero()) t.push({ value: a.div(b), msg: "Eso es dividir. Para multiplicar: numerador por numerador y denominador por denominador." });
  } else {
    t.push({ value: a.mul(b), msg: "Multiplicaste directo. Para dividir, multiplicá por la inversa de la segunda fracción." });
    if (!a.isZero()) t.push({ value: a.inv().mul(b), msg: "Diste vuelta la primera fracción. La que se da vuelta es la segunda." });
  }
  t.push({ value: ans.neg(), msg: "El número está bien, pero el signo no. Revisá la regla de los signos." });
  return cleanTraps(ans, t);
}
