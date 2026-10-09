import { F, Fraction, decimalStringToFraction, gcd } from "../math/fraction";
import { decStr, isSciMantissa, normSci, sameSci, sciText } from "../math/sci";
import { ft } from "./helpers";
import type { AnswerSpec, Question } from "./types";

/** Lo que escribió el jugador. */
export interface Draft {
  neg: boolean;
  whole: string;
  num: string;
  den: string;
  /** Para respuestas decimales o enteras (y el primer número en notación científica). */
  text: string;
  /** Notación científica: exponente del 10 y su signo. */
  exp: string;
  expNeg: boolean;
  /** Recta: dónde quedó la banderita y en cuántas partes está dividido cada entero. */
  pt: Fraction | null;
  parts: number;
}

export const emptyDraft = (): Draft => ({ neg: false, whole: "", num: "", den: "", text: "", exp: "", expNeg: false, pt: null, parts: 1 });

/** Borrador vacío preparado para una consigna (la recta arranca con sus divisiones). */
export function draftFor(spec: AnswerSpec): Draft {
  const d = emptyDraft();
  if (spec.kind === "point") d.parts = spec.pickParts ? 1 : spec.line.parts;
  return d;
}

export interface Verdict {
  correct: boolean;
  /** Mensaje del error específico detectado (o null si no se reconoce). */
  diagnosis: string | null;
  /** Comentario extra cuando la respuesta es correcta (p. ej. “se puede simplificar”). */
  note?: string;
  /** Lo que el jugador respondió, como texto lindo para mostrar. */
  given: string;
}

/** Si la respuesta está incompleta o no tiene sentido, devuelve el aviso (no cuenta como error). */
export function validate(spec: AnswerSpec, d: Draft, choice: number | null): string | null {
  switch (spec.kind) {
    case "choice":
      return choice === null ? "Elegí una opción." : null;
    case "integer":
      return d.text === "" ? "Escribí un número." : null;
    case "decimal": {
      if (d.text === "") return "Escribí un número.";
      return decimalStringToFraction((d.neg ? "-" : "") + d.text) ? null : "Ese número no se entiende. Revisá la coma.";
    }
    case "fraction":
      if (d.num === "") return "Escribí el numerador (el número de arriba).";
      if (d.den !== "" && Number(d.den) === 0) return "El denominador no puede ser 0: no se puede dividir por cero.";
      return null;
    case "mixed":
      if (d.whole === "" && d.num === "") return "Escribí la parte entera y la fracción.";
      if (d.num !== "" && d.den === "") return "Falta el denominador.";
      if (d.den !== "" && Number(d.den) === 0) return "El denominador no puede ser 0.";
      return null;
    case "point":
      return d.pt ? null : spec.pickParts && d.parts === 1 ? "Primero elegí en cuántas partes dividir cada entero, después tocá la recta." : "Tocá la recta para poner la banderita.";
    case "sci":
      if (d.text === "") return "Escribí el primer número (el que va antes del 10).";
      if (!decimalStringToFraction(d.text) || decimalStringToFraction(d.text)!.isZero()) return "El primer número no se entiende. Revisá la coma.";
      if (d.exp === "") return "Falta el exponente del 10 (tocá el casillero chiquito de arriba).";
      return null;
  }
}

function draftValue(spec: AnswerSpec, d: Draft): Fraction | number | null {
  const s = d.neg ? -1 : 1;
  switch (spec.kind) {
    case "integer":
      return s * Number(d.text);
    case "decimal":
      return decimalStringToFraction((d.neg ? "-" : "") + d.text);
    case "fraction": {
      const den = d.den === "" ? 1 : Number(d.den);
      return F(s * Number(d.num), den);
    }
    case "mixed": {
      const w = Number(d.whole || "0");
      const frac = d.num === "" ? F(0) : F(Number(d.num), Number(d.den));
      return F(w).add(frac).mul(F(s));
    }
    default:
      return null;
  }
}

export function draftText(spec: AnswerSpec, d: Draft): string {
  const sg = d.neg ? "−" : "";
  switch (spec.kind) {
    case "integer":
    case "decimal":
      return sg + d.text;
    case "fraction":
      return d.den === "" ? sg + d.num : `${sg}${d.num}/${d.den}`;
    case "mixed":
      return `${sg}${d.whole}${d.num ? ` ${d.num}/${d.den}` : ""}`;
    case "point":
      return d.pt ? `la banderita en ${ft(d.pt)}` : "";
    case "sci":
      return `${d.text}·10^${d.expNeg ? "-" : ""}${d.exp}`;
    default:
      return "";
  }
}

const same = (a: Fraction | number, b: Fraction | number) => {
  const fa = typeof a === "number" ? F(a) : a;
  const fb = typeof b === "number" ? F(b) : b;
  return fa.equals(fb);
};

export function check(q: Question, d: Draft, choice: number | null): Verdict {
  const spec = q.answer;
  if (spec.kind === "choice") {
    const ok = choice === spec.correct;
    const opt = choice !== null ? spec.options[choice] : null;
    return {
      correct: ok,
      diagnosis: ok ? null : opt?.why ?? null,
      given: opt?.label ?? "",
    };
  }
  if (spec.kind === "point") return checkPoint(q, spec, d);
  if (spec.kind === "sci") return checkSci(q, spec, d);
  const v = draftValue(spec, d);
  const given = draftText(spec, d);
  if (v === null) return { correct: false, diagnosis: null, given };
  const correct = spec.kind === "integer" ? spec.value : spec.value;

  if (same(v, correct)) {
    // Correcto en valor. Revisar forma.
    if (spec.kind === "fraction") {
      const n = Number(d.num);
      const den = d.den === "" ? 1 : Number(d.den);
      const g = gcd(n, den);
      if (g > 1) {
        if (spec.mustSimplify) {
          return {
            correct: false,
            diagnosis: `Vale lo mismo, pero todavía se puede simplificar: ${n} y ${den} se pueden dividir por ${g}. Hay que llegar a la fracción irreducible.`,
            given,
          };
        }
        const f = F(n, den);
        return { correct: true, diagnosis: null, given, note: `Está bien. Para la próxima: se puede simplificar a ${f.d === 1 ? f.n : `{${f.n}/${f.d}}`}.` };
      }
    }
    if (spec.kind === "mixed") {
      const n = Number(d.num || "0");
      const den = Number(d.den || "1");
      if (d.num !== "" && n >= den) {
        return {
          correct: false,
          diagnosis: "Vale lo mismo, pero en un número mixto la parte fraccionaria tiene que ser menor que 1 (numerador más chico que el denominador).",
          given,
        };
      }
      if (d.num !== "" && gcd(n, den) > 1) {
        return { correct: true, diagnosis: null, given, note: "Está bien. La parte fraccionaria se puede simplificar." };
      }
    }
    return { correct: true, diagnosis: null, given };
  }

  // Incorrecto: buscar error típico
  for (const t of q.traps ?? []) {
    if (same(v, t.value)) return { correct: false, diagnosis: t.msg, given };
  }
  // Errores genéricos
  const cf = typeof correct === "number" ? F(correct) : correct;
  const vf = typeof v === "number" ? F(v) : v;
  if (!cf.isZero() && vf.equals(cf.neg())) return { correct: false, diagnosis: "El número está bien, pero el signo no. Revisá los signos paso a paso.", given };
  if (!cf.isZero() && !vf.isZero() && vf.equals(cf.inv())) return { correct: false, diagnosis: "Te quedó dada vuelta: numerador y denominador están intercambiados.", given };
  if (spec.kind === "fraction" && d.den !== "" && Number(d.den) === cf.d && Number(d.num) !== cf.n && Math.abs(cf.n) > 0)
    return { correct: false, diagnosis: "El denominador está bien. Revisá la cuenta del numerador.", given };
  return { correct: false, diagnosis: null, given };
}

type PointSpec = Extract<AnswerSpec, { kind: "point" }>;
type SciSpec = Extract<AnswerSpec, { kind: "sci" }>;

function checkPoint(q: Question, spec: PointSpec, d: Draft): Verdict {
  const v = d.pt!;
  const given = draftText(spec, d);
  const target = spec.value;
  if (v.equals(target)) return { correct: true, diagnosis: null, given };
  if (spec.pickParts && !target.mul(F(d.parts)).isInteger()) {
    const p = d.parts;
    return {
      correct: false,
      diagnosis: `Dividiste cada entero en ${p} ${p === 1 ? "parte" : "partes"}: con esas rayitas no hay ninguna justo en ${ft(target)}. Para ubicar ${ft(target)}, dividí cada entero en ${target.d} partes (lo que dice el denominador).`,
      given,
    };
  }
  for (const t of q.traps ?? []) {
    const tv = typeof t.value === "number" ? F(t.value) : t.value;
    if (v.equals(tv)) return { correct: false, diagnosis: t.msg, given };
  }
  if (!target.isZero() && v.equals(target.neg()))
    return {
      correct: false,
      diagnosis: "La distancia al 0 está bien, pero quedó del lado equivocado: los positivos van a la derecha del 0 y los negativos a la izquierda.",
      given,
    };
  const step = F(1, d.parts);
  if (v.sub(target).abs().equals(step) && v.n * target.n >= 0) {
    const closer = v.abs().compare(target.abs()) < 0;
    return {
      correct: false,
      diagnosis: closer
        ? `Te quedaste a una rayita. Se cuentan saltos (los espacios entre rayitas), no rayitas: la rayita de donde salís no cuenta. Cada salto es ${ft(step)}.`
        : `Te pasaste una rayita. Contá los saltos (los espacios entre rayitas): cada salto es ${ft(step)}.`,
      given,
    };
  }
  return { correct: false, diagnosis: null, given };
}

function checkSci(q: Question, spec: SciSpec, d: Draft): Verdict {
  const m = decimalStringToFraction(d.text)!;
  const e = (d.expNeg ? -1 : 1) * Number(d.exp);
  const given = draftText(spec, d);
  const target = { m: spec.m, e: spec.e };
  const shown = sciText(spec.m, spec.e);
  if (sameSci({ m, e }, target)) {
    if (isSciMantissa(m)) return { correct: true, diagnosis: null, given };
    const big = m.abs().compare(F(10)) >= 0;
    return {
      correct: false,
      diagnosis: `Vale lo mismo, pero no está en notación científica: el primer número tiene que ser mayor o igual que 1 y menor que 10, y ${decStr(m, false)} es ${big ? "mayor que 10" : "menor que 1"}. Corré la coma y compensá con el exponente: ${shown}.`,
      given,
    };
  }
  for (const t of q.sciTraps ?? []) {
    if (sameSci({ m, e }, t)) return { correct: false, diagnosis: t.msg, given };
  }
  const norm = normSci(m, e);
  const extra = isSciMantissa(m) ? "" : ` Además, ${decStr(m, false)} no está entre 1 y 10.`;
  if (norm.m.equals(spec.m)) {
    if (norm.e === -spec.e && spec.e !== 0)
      return {
        correct: false,
        diagnosis: `Las cifras están bien, pero el exponente tiene el signo cambiado. Los números grandes (de 10 para arriba) llevan exponente positivo; los chiquitos (menores que 1), negativo.${extra}`,
        given,
      };
    return {
      correct: false,
      diagnosis: `Las cifras están bien, pero el exponente no: el exponente dice cuántos lugares se corre la coma. Contalos de nuevo.${extra}`,
      given,
    };
  }
  return { correct: false, diagnosis: extra ? extra.trim() : null, given };
}
