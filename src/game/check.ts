import { F, Fraction, decimalStringToFraction, gcd } from "../math/fraction";
import type { AnswerSpec, Question } from "./types";

/** Lo que escribió el jugador. */
export interface Draft {
  neg: boolean;
  whole: string;
  num: string;
  den: string;
  /** Para respuestas decimales o enteras. */
  text: string;
}

export const emptyDraft = (): Draft => ({ neg: false, whole: "", num: "", den: "", text: "" });

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
