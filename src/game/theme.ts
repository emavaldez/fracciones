// Con qué se ambientan los ejercicios que se generan: pizzería o chocolatería.
// La partida lo fija antes de generar las comandas; las pruebas usan la pizzería.

export type Look = "pizza" | "choco";

let current: Look = "pizza";

export function setGenLook(l: Look) {
  current = l;
}

export const genLook = (): Look => current;

/** Elige el texto de la pizzería o el de la chocolatería. */
export const th = <T,>(pizza: T, choco: T): T => (current === "choco" ? choco : pizza);
