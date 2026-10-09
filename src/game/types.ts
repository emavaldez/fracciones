import type { Fraction } from "../math/fraction";
import type { Expr } from "../math/expr";
import type { Rng } from "../math/rng";
import type { PzSpec } from "./pizarra";

/** Una línea de explicación: texto (con fracciones en línea {3/4}) y/o una expresión. */
export interface Step {
  text?: string;
  math?: Expr;
  /** Una recta numérica para acompañar la explicación. */
  line?: LineSpec;
}

/** Un punto marcado en la recta. */
export interface LineMark {
  value: Fraction;
  /** Letra o signo dentro de la banderita ("A", "?"). */
  tag?: string;
  /** ask: la banderita de la consigna · ok/bad: respuesta correcta/dada · letter: opciones · dot: punto de referencia */
  tone?: "ask" | "ok" | "bad" | "letter" | "dot";
}

/** Recta numérica entre dos enteros, con cada entero dividido en `parts` partes iguales. */
export interface LineSpec {
  min: number;
  max: number;
  /** En cuántas partes iguales está dividido cada entero (1 = solo los enteros). */
  parts: number;
  /** Qué valores llevan número abajo. Por defecto, todos los enteros. */
  labels?: Fraction[];
  /** Todas las rayitas del mismo largo (para no delatar dónde están los enteros). */
  uniform?: boolean;
  marks?: LineMark[];
  /** Saltos dibujados como arcos: desde `from`, `count` saltos de tamaño `step` (puede ser negativo). */
  hops?: { from: Fraction; step: Fraction; count: number };
}

export interface PizzaSpec {
  /** En cuántas porciones está cortada cada pizza. */
  slices: number;
  /** Cuántas porciones hay (si supera `slices` se dibujan varias pizzas). */
  filled: number;
}

export interface Choice {
  label?: string;
  math?: Expr;
  pizza?: PizzaSpec;
  /** Explicación si alguien elige esta opción y es incorrecta. */
  why?: string;
}

export type AnswerSpec =
  | { kind: "fraction"; value: Fraction; mustSimplify?: boolean }
  | { kind: "mixed"; value: Fraction }
  | { kind: "decimal"; value: Fraction }
  | { kind: "integer"; value: number }
  | { kind: "choice"; options: Choice[]; correct: number }
  /** Ubicar un punto en la recta. Con `pickParts`, el jugador elige en cuántas partes dividir cada entero. */
  | { kind: "point"; value: Fraction; line: LineSpec; pickParts?: boolean }
  /** Notación científica: m · 10^e con 1 ≤ m < 10. */
  | { kind: "sci"; m: Fraction; e: number };

/** Error típico: si la respuesta del jugador vale `value`, se muestra `msg`. */
export interface Trap {
  value: Fraction | number;
  msg: string;
}

/** Error típico en notación científica (se compara el valor m·10^e, sin calcularlo). */
export interface SciTrap {
  m: Fraction;
  e: number;
  msg: string;
}

export interface Question {
  /** Generador que la produjo (para dar una revancha parecida si se erra). */
  gen: string;
  /** Consigna corta: "Resolvé", "Simplificá", "Despejá x"… */
  title: string;
  /** Texto del enunciado o del pedido del cliente. */
  story?: string;
  math?: Expr;
  pizzas?: PizzaSpec[];
  /** Recta numérica para mirar (por ejemplo, con una banderita para leer). */
  line?: LineSpec;
  answer: AnswerSpec;
  /** Lo que se muestra antes del casillero de respuesta, p. ej. "x =". */
  answerPrefix?: string;
  traps?: Trap[];
  sciTraps?: SciTrap[];
  hint: Step[];
  steps: Step[];
  /** Regla general para recordar (se muestra en el panel de explicación). */
  rule?: string;
  /** Cuenta o ecuación para resolver por partes en la pizarra. */
  pizarra?: PzSpec;
  /** Segunda parte que se juega inmediatamente después (problemas de dos pasos). */
  followUp?: Question;
}

export type Generator = (r: Rng) => Question;

export interface GenEntry {
  id: string;
  make: Generator;
}

export interface Level {
  id: string;
  name: string;
  /** Qué se practica, en una línea. */
  about: string;
  gens: GenEntry[];
  count: number;
  boss?: { name: string; emoji: string; line: string; lives: number };
}

export interface World {
  id: string;
  place: string;
  topic: string;
  emoji: string;
  levels: Level[];
}
