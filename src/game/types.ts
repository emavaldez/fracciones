import type { Fraction } from "../math/fraction";
import type { Expr } from "../math/expr";
import type { Rng } from "../math/rng";
import type { BoardSpec } from "./board";

/** Una línea de explicación: texto (con fracciones en línea {3/4}) y/o una expresión. */
export interface Step {
  text?: string;
  math?: Expr;
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
  | { kind: "choice"; options: Choice[]; correct: number };

/** Error típico: si la respuesta del jugador vale `value`, se muestra `msg`. */
export interface Trap {
  value: Fraction | number;
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
  answer: AnswerSpec;
  /** Lo que se muestra antes del casillero de respuesta, p. ej. "x =". */
  answerPrefix?: string;
  traps?: Trap[];
  hint: Step[];
  steps: Step[];
  /** Regla general para recordar (se muestra en el panel de explicación). */
  rule?: string;
  /** Ecuación para resolver paso a paso en la mesa de trabajo. */
  board?: BoardSpec;
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
