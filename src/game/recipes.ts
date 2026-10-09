// "Recetas": la teoría de cada sector, con ejemplos.
import { N, Q, X, coef, dec, frac, mixed, neg, par, pow, root, row, type Expr } from "../math/expr";
import { F } from "../math/fraction";
import { sciExpr } from "../math/sci";
import type { LineSpec } from "./types";

export interface RecipeItem {
  text: string;
  math?: Expr;
  line?: LineSpec;
}

export const RECIPES: Record<string, RecipeItem[]> = {
  mostrador: [
    { text: "Una fracción dice en cuántas partes iguales se cortó algo (el denominador, abajo) y cuántas de esas partes hay (el numerador, arriba).", math: N(3, 8) },
    { text: "Si el numerador es más grande que el denominador, hay más de un entero.", math: row(N(7, 4), "=", N(4, 4), "+", N(3, 4)) },
    { text: "Fracciones equivalentes: multiplicando o dividiendo arriba y abajo por el mismo número, la fracción vale lo mismo.", math: row(N(2, 3), "=", frac(row(N(2), "·", N(4)), row(N(3), "·", N(4))), "=", N(8, 12)) },
    { text: "Simplificar es dividir arriba y abajo por un divisor común, hasta que no se pueda más (fracción irreducible).", math: row(N(18, 24), "=", N(9, 12), "=", N(3, 4)) },
    { text: "Para comparar, llevalas al mismo denominador y fijate qué numerador es mayor. Como 8 < 9:", math: row(N(2, 3), "=", N(8, 12), "<", N(9, 12), "=", N(3, 4)) },
    { text: "Con negativos: cualquier positivo es mayor que cualquier negativo, y entre dos negativos es mayor el que está más cerca del 0.", math: row(N(-3, 4), "<", N(-1, 4), "<", N(1, 2)) },
  ],
  amasado: [
    { text: "Número mixto: dividí el numerador por el denominador. El cociente son los enteros y el resto queda arriba.", math: row(N(17, 5), "=", mixed(3, 2, 5)) },
    { text: "De mixto a fracción: entero por denominador, más el numerador.", math: row(mixed(2, 3, 4), "=", frac(row(N(2), "·", N(4), "+", N(3)), 4), "=", N(11, 4)) },
    { text: "Decimal finito a fracción: el número sin coma, sobre un 1 con tantos ceros como cifras decimales. Después simplificá.", math: row(dec("0,375"), "=", N(375, 1000), "=", N(3, 8)) },
    { text: "Fracción a decimal: es una división.", math: row(N(3, 4), "=", dec("0,75")) },
    { text: "Periódico puro: arriba el número sin coma menos la parte entera; abajo, un 9 por cada cifra que se repite.", math: row({ t: "per", int: "0", ante: "", period: "3" }, "=", N(3, 9), "=", N(1, 3)) },
    { text: "Periódico mixto: arriba, el número sin coma menos la parte que no se repite; abajo, un 9 por cada cifra periódica y un 0 por cada cifra no periódica después de la coma.", math: row({ t: "per", int: "0", ante: "1", period: "6" }, "=", frac(row(N(16), "-", N(1)), 90), "=", N(15, 90), "=", N(1, 6)) },
    { text: "¿Finito o periódico? Si el denominador (simplificado) solo tiene factores 2 y 5, el decimal es finito." },
  ],
  recta: [
    {
      text: "Para ubicar {3/4}: el denominador (4) dice en cuántas partes iguales se divide cada entero, y el numerador (3), cuántos saltos se cuentan desde el 0.",
      line: { min: 0, max: 1, parts: 4, hops: { from: F(0), step: F(1, 4), count: 3 }, marks: [{ value: F(3, 4), tone: "ok" }] },
    },
    { text: "Se cuentan saltos (los espacios entre rayitas), no rayitas. Entre el 0 y el 1 hay 5 rayitas, pero 4 partes." },
    {
      text: "Si es mayor que 1, pasala a número mixto: {7/4} = 1 + {3/4}. Llegás al 1 y contás 3 saltos más.",
      math: row(N(7, 4), "=", mixed(1, 3, 4)),
      line: { min: 0, max: 2, parts: 4, hops: { from: F(1), step: F(1, 4), count: 3 }, marks: [{ value: F(7, 4), tone: "ok" }] },
    },
    {
      text: "Los negativos van a la izquierda del 0: para {-2/3}, salís del 0 y contás 2 saltos de {1/3} hacia la izquierda.",
      line: { min: -1, max: 1, parts: 3, hops: { from: F(0), step: F(-1, 3), count: 2 }, marks: [{ value: F(-2, 3), tone: "ok" }] },
    },
    {
      text: "Si las rayitas no coinciden con el denominador, buscá una equivalente: con sextos, {2/3} = {4/6} son 4 saltos.",
      math: row(N(2, 3), "=", N(4, 6)),
      line: { min: 0, max: 1, parts: 6, hops: { from: F(0), step: F(1, 6), count: 4 }, marks: [{ value: F(2, 3), tone: "ok" }] },
    },
    { text: "Para leer un punto, hacé al revés: contá en cuántas partes está dividido cada entero (denominador) y cuántos saltos hay desde el 0 (numerador)." },
  ],
  horno: [
    { text: "Mismo denominador: se suman (o restan) los numeradores y el denominador queda igual.", math: row(N(2, 7), "+", N(3, 7), "=", N(5, 7)) },
    { text: "Distinto denominador: primero buscá un denominador común (el mínimo común múltiplo) y ampliá cada fracción.", math: row(N(1, 4), "+", N(1, 6), "=", N(3, 12), "+", N(2, 12), "=", N(5, 12)) },
    { text: "¡Nunca sumes denominadores! Esto está MAL:", math: row(N(1, 2), "+", N(1, 3), "≠", N(2, 5)) },
    { text: "Restar un negativo es sumar.", math: row(N(1, 2), "-", N(-1, 4), "=", N(1, 2), "+", N(1, 4), "=", N(3, 4)) },
    { text: "Un entero es una fracción con denominador 1.", math: row(N(2), "-", N(3, 5), "=", N(10, 5), "-", N(3, 5), "=", N(7, 5)) },
  ],
  tabla: [
    { text: "Multiplicar: numerador por numerador y denominador por denominador.", math: row(N(2, 3), "·", N(4, 5), "=", N(8, 15)) },
    { text: "Truco: simplificá en cruz antes de multiplicar (el 3 con el 9 y el 8 con el 4).", math: row(N(3, 4), "·", N(8, 9), "=", frac(row(N(1), "·", N(2)), row(N(1), "·", N(3))), "=", N(2, 3)) },
    { text: "Dividir: multiplicá por la inversa de la segunda fracción.", math: row(N(3, 4), ":", N(2, 5), "=", N(3, 4), "·", N(5, 2), "=", N(15, 8)) },
    { text: "“Una fracción de algo” es una multiplicación.", math: row(N(3, 4), "·", N(20), "=", N(15)) },
    { text: "Regla de los signos: signos iguales dan +, signos distintos dan −.", math: row(N(-2, 3), "·", N(-3, 5), "=", N(2, 5)) },
    { text: "El inverso de una fracción se obtiene dándola vuelta (conserva el signo).", math: row(N(-3, 7), "·", N(-7, 3), "=", N(1)) },
  ],
  fermentacion: [
    { text: "La potencia se aplica al numerador y al denominador.", math: row(pow(N(2, 3), 3), "=", frac(pow(N(2), 3), pow(N(3), 3)), "=", N(8, 27)) },
    { text: "Base negativa: exponente par da positivo; exponente impar da negativo.", math: row(pow(N(-1, 2), 2), "=", N(1, 4), "     ", pow(N(-1, 2), 3), "=", N(-1, 8)) },
    { text: "No es lo mismo: el menos de afuera no se eleva.", math: row(neg(pow(N(1, 2), 2)), "=", N(-1, 4)) },
    { text: "Exponente 0: siempre da 1 (si la base no es 0).", math: row(pow(N(5, 7), 0), "=", N(1)) },
    { text: "Exponente negativo: se da vuelta la base y el exponente pasa a positivo.", math: row(pow(N(2, 3), -2), "=", pow(N(3, 2), 2), "=", N(9, 4)) },
    { text: "Igual base multiplicando: se suman los exponentes. Dividiendo: se restan.", math: row(pow(N(2, 5), 3), "·", pow(N(2, 5), 4), "=", pow(N(2, 5), 7)) },
    { text: "Potencia de potencia: se multiplican los exponentes.", math: row(pow(par(pow(N(3, 4), 2)), 3), "=", pow(N(3, 4), 6)) },
  ],
  despensa: [
    { text: "Notación científica: un número mayor o igual que 1 y menor que 10, multiplicado por una potencia de 10.", math: sciExpr(F(45, 10), 7) },
    {
      text: "Números grandes: corré la coma hacia la izquierda hasta que quede una sola cifra adelante. Los lugares que corriste son el exponente (positivo).",
      math: row(dec("45\u202f000\u202f000"), "=", sciExpr(F(45, 10), 7)),
    },
    {
      text: "Números chicos (menores que 1): corré la coma hacia la derecha hasta pasar la primera cifra que no es 0. El exponente es negativo.",
      math: row(dec("0,00032"), "=", sciExpr(F(32, 10), -4)),
    },
    { text: "Para volver al número: exponente positivo, la coma va a la derecha; negativo, a la izquierda. Completá con ceros.", math: row(sciExpr(F(61, 10), -3), "=", dec("0,0061")) },
    { text: "Para comparar (con los dos bien escritos en notación científica), mirá primero los exponentes: manda el más grande. Si son iguales, compará los primeros números.", math: row(sciExpr(F(2), 5), ">", sciExpr(F(9), 4)) },
    {
      text: "Multiplicar: primeros números por un lado y potencias por el otro (los exponentes se suman). Si el primero da 10 o más, se acomoda.",
      math: row(par(sciExpr(F(3), 4)), "·", par(sciExpr(F(5), 2)), "=", sciExpr(F(15), 6), "=", sciExpr(F(15, 10), 7)),
    },
    {
      text: "Dividir: se dividen los primeros números y se restan los exponentes.",
      math: row(par(sciExpr(F(4), 6)), ":", par(sciExpr(F(8), -2)), "=", sciExpr(F(5, 10), 8), "=", sciExpr(F(5), 7)),
    },
  ],
  huerta: [
    { text: "La raíz se aplica al numerador y al denominador.", math: row(root(2, N(9, 25)), "=", frac(root(2, N(9)), root(2, N(25))), "=", N(3, 5)) },
    { text: "La raíz cuadrada NO es dividir por 2: es buscar un número que multiplicado por sí mismo dé el de adentro.", math: row(root(2, N(16)), "=", N(4)) },
    { text: "Índice impar: la raíz de un negativo existe y es negativa.", math: row(root(3, N(-8, 27)), "=", N(-2, 3)) },
    { text: "Índice par de un negativo: no tiene solución en los reales.", math: row(root(2, N(-4)), "=", Q()) },
    { text: "Se puede distribuir en la multiplicación y la división…", math: row(root(2, N(1, 2)), "·", root(2, N(8, 9)), "=", root(2, N(4, 9)), "=", N(2, 3)) },
    { text: "…pero NUNCA en la suma ni en la resta. Primero se opera adentro.", math: row(root(2, row(N(9, 4), "+", N(16, 4))), "=", root(2, N(25, 4)), "=", N(5, 2)) },
  ],
  cocina: [
    { text: "1. Separá en términos: los + y − que no están dentro de paréntesis separan términos." },
    { text: "2. En cada término: primero paréntesis, después potencias y raíces, después multiplicaciones y divisiones." },
    { text: "3. Al final, sumá y restá los resultados de los términos.", math: row(N(1, 2), "+", N(3, 4), "·", N(2, 3), "=", N(1, 2), "+", N(1, 2), "=", N(1)) },
    { text: "Con paréntesis, cambia el orden:", math: row(par(row(N(1, 2), "+", N(3, 4))), "·", N(2, 3), "=", N(5, 4), "·", N(2, 3), "=", N(5, 6)) },
    { text: "La potencia no se distribuye en la suma: primero resolvé el paréntesis.", math: row(pow(par(row(N(1, 2), "+", N(1, 2))), 2), "=", pow(N(1), 2), "=", N(1)) },
  ],
  receta: [
    { text: "Una ecuación es una balanza: lo que hacés de un lado, lo hacés del otro." },
    { text: "Lo que suma pasa restando; lo que resta pasa sumando.", math: row(X, "+", N(1, 3), "=", N(3, 4), "⇒", X, "=", N(3, 4), "-", N(1, 3), "=", N(5, 12)) },
    { text: "Lo que multiplica pasa dividiendo; lo que divide pasa multiplicando.", math: row(coef(F(2, 3)), "=", N(4), "⇒", X, "=", N(4), ":", N(2, 3), "=", N(6)) },
    { text: "Con dos pasos, se despeja de afuera hacia adentro. En {2/3}·x + 1 = 5, primero se pasa el 1 restando; en {2/3}·(x + 1) = 5, primero se pasa el {2/3} dividiendo, porque multiplica a todo el paréntesis." },
    { text: "Las potencias pasan como raíces y las raíces como potencias. Ojo: con x² hay dos soluciones.", math: row(pow(X, 2), "=", N(9, 16), "⇒", X, "=", N(3, 4), " o ", X, "=", N(-3, 4)) },
    { text: "Al final, verificá: reemplazá x en la ecuación original." },
  ],
  delivery: [
    { text: "1. Leé todo el enunciado. ¿Qué te preguntan?" },
    { text: "2. “Juntar” es sumar; “cuánto queda o falta” es restar; “la fracción DE algo” es multiplicar; “cuántas veces entra” es dividir." },
    { text: "3. Si no sabés un número, llamalo x y traducí cada frase.", math: row(txtExpr("un número más sus 2/3 partes es 10:"), X, "+", coef(F(2, 3)), "=", N(10)) },
    { text: "4. Resolvé y fijate si la respuesta tiene sentido (¿puede ser negativa? ¿más que el total?)." },
  ],
};

function txtExpr(s: string): Expr {
  return { t: "text", s: s + "  " };
}
