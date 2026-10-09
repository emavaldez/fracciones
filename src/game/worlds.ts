import type { GenEntry, Level, World } from "./types";
import * as w1 from "./gen/w1";
import * as w2 from "./gen/w2";
import * as w3 from "./gen/w3";
import * as w4 from "./gen/w4";
import * as w5 from "./gen/w5";
import * as w6 from "./gen/w6";
import * as w7 from "./gen/w7";
import * as w8 from "./gen/w8";
import * as w9 from "./gen/w9";
import * as rc from "./gen/recta";
import * as nc from "./gen/cientifica";

// Los ids de los niveles ("3-2", "7-J") salen de la posición del sector y del nivel (ver más abajo).
const lv = (name: string, about: string, gens: GenEntry[], count = 8): Level => ({ id: "", name, about, gens, count });
const boss = (name: string, emoji: string, line: string, gens: GenEntry[], count = 10): Level => ({
  id: "",
  name,
  about: "Jefe final: 3 vidas y todo lo del sector mezclado.",
  gens,
  count,
  boss: { name, emoji, line, lives: 3 },
});

export const WORLDS: World[] = [
  {
    id: "mostrador",
    place: "El Mostrador",
    topic: "Leer, simplificar y comparar fracciones",
    emoji: "🍕",
    levels: [
      lv("Porciones", "¿Qué fracción de pizza hay?", [w1.leerPizza, w1.elegirPizza, w1.leerPizzaImpropia]),
      lv("Equivalentes", "Fracciones que valen lo mismo", [w1.equivFaltante, w1.equivElegir]),
      lv("Simplificar y comparar", "Fracción irreducible y cuál es mayor", [w1.simplificar, w1.comparar]),
      boss("Doña Porciones", "👵", "Yo pedí la mitad y me trajeron dos cuartos. ¿Me están cargando?", [
        w1.compararNeg,
        w1.simplificar,
        w1.leerPizzaImpropia,
        w1.equivElegir,
        w1.equivFaltante,
      ]),
    ],
  },
  {
    id: "amasado",
    place: "La Mesa de Amasado",
    topic: "Expresar de otra forma: mixtos, decimales y periódicos",
    emoji: "🫓",
    levels: [
      lv("Números mixtos", "Enteros y fracción, ida y vuelta", [w2.impropiaAMixto, w2.mixtoAImpropia]),
      lv("Decimales", "De fracción a decimal y al revés", [w2.decimalAFraccion, w2.fraccionADecimal]),
      lv("Periódicos", "Decimales que no terminan nunca", [w2.periodicoAFraccion, w2.finitoOPeriodico, w2.elegirPeriodico]),
      boss("El Señor Mixto", "🎩", "No acepto fracciones impropias. Y los números que no terminan me ponen nervioso.", [
        w2.impropiaAMixto,
        w2.mixtoAImpropia,
        w2.decimalAFraccion,
        w2.fraccionADecimal,
        w2.periodicoAFraccion,
        w2.finitoOPeriodico,
      ]),
    ],
  },
  {
    id: "recta",
    place: "El Riel de Comandas",
    topic: "Fracciones en la recta numérica",
    emoji: "📏",
    levels: [
      lv("Ubicar en la recta", "Contar saltos desde el 0", [rc.rectaUbicar, rc.rectaUbicarImpropia]),
      lv("Leer la recta", "¿Qué número marca la banderita?", [rc.rectaLeer, rc.rectaLetras, rc.rectaLeerZoom]),
      lv("Negativos y otras rayitas", "A la izquierda del 0, y rayitas que no son el denominador", [
        rc.rectaUbicarNegativa,
        rc.rectaLeerNeg,
        rc.rectaEquivalente,
        rc.rectaElegirPartes,
      ]),
      boss("La Oruga Medidora", "🐛", "Avanzo de a saltitos iguales. ¿Adivinás dónde voy a parar?", [
        rc.rectaUbicarImpropia,
        rc.rectaUbicarNegativa,
        rc.rectaLeerNeg,
        rc.rectaLeerZoom,
        rc.rectaEquivalente,
        rc.rectaElegirPartes,
        rc.rectaUbicarUno,
      ]),
    ],
  },
  {
    id: "horno",
    place: "El Horno",
    topic: "Suma y resta",
    emoji: "🔥",
    levels: [
      lv("Mismo denominador", "Sumar y restar porciones iguales", [w3.sumaMismoDen]),
      lv("Distinto denominador", "Buscar el denominador común", [w3.sumaDistintoDen]),
      lv("Negativos y mixtos", "Signos, enteros y números mixtos", [w3.sumaNegativos, w3.sumaMixtos, w3.sumaTres]),
      boss("El Inspector del Horno", "🕵️", "Una pizza mal sumada es una pizza quemada.", [
        w3.sumaDistintoDen,
        w3.sumaNegativos,
        w3.sumaMixtos,
        w3.sumaTres,
      ]),
    ],
  },
  {
    id: "tabla",
    place: "La Tabla de Cortar",
    topic: "Multiplicación y división",
    emoji: "🪵",
    levels: [
      lv("Multiplicar", "Arriba por arriba, abajo por abajo", [w4.multiplicar, w4.fraccionDe]),
      lv("Dividir", "Multiplicar por la inversa", [w4.dividir, w4.inverso]),
      lv("Con signos", "Negativos y cuentas largas", [w4.multDivSignos, w4.multTres]),
      boss("El Rey del Corte", "🤴", "Corto la pizza en partes iguales. Vos decime cuánto da.", [
        w4.multiplicar,
        w4.fraccionDe,
        w4.dividir,
        w4.multDivSignos,
        w4.multTres,
      ]),
    ],
  },
  {
    id: "fermentacion",
    place: "La Cámara de Fermentación",
    topic: "Potencias y exponentes",
    emoji: "🫧",
    levels: [
      lv("Exponente natural", "Elevar arriba y abajo, y el signo", [w5.potenciaNatural, w5.signoPotencia]),
      lv("Exponente 0 y negativo", "Lo que se da vuelta", [w5.potenciaCeroNeg]),
      lv("Propiedades", "Sumar, restar y multiplicar exponentes", [w5.propiedadesExponente, w5.propiedadesValor]),
      boss("La Levadura Gigante", "👾", "¡Crezco al cuadrado, al cubo y más! ¿Me podés frenar?", [
        w5.potenciaNatural,
        w5.signoPotencia,
        w5.potenciaCeroNeg,
        w5.propiedadesExponente,
        w5.propiedadesValor,
      ]),
    ],
  },
  {
    id: "despensa",
    place: "La Despensa",
    topic: "Notación científica: números muy grandes y muy chicos",
    emoji: "🥫",
    levels: [
      lv("Números gigantes y diminutos", "Correr la coma y contar lugares", [nc.ncEscribirGrande, nc.ncEscribirChico, nc.ncADecimal]),
      lv("Reconocer y comparar", "¿Está bien escrito? ¿Cuál es más grande?", [nc.ncEsCientifica, nc.ncComparar, nc.ncMayor, nc.ncFraccion]),
      lv("Multiplicar y dividir", "Los primeros números por un lado, las potencias de 10 por el otro", [
        nc.ncMultiplicar,
        nc.ncDividir,
        nc.ncFraccionDe,
        nc.ncPotencia,
      ]),
      boss("La Hormiga Contadora", "🐜", "Cuento granos de azúcar: millones. Y cada uno pesa casi nada. ¿Me ayudás?", [
        nc.ncEscribirChico,
        nc.ncADecimal,
        nc.ncMayor,
        nc.ncMultiplicar,
        nc.ncDividir,
        nc.ncPotencia,
        nc.ncProblema,
      ]),
    ],
  },
  {
    id: "huerta",
    place: "La Huerta",
    topic: "Raíces",
    emoji: "🌱",
    levels: [
      lv("Raíz cuadrada", "Fracciones y decimales", [w6.raizCuadrada, w6.raizDecimal]),
      lv("Raíz cúbica y otras", "Índices impares, pares y negativos", [w6.raizCubica, w6.raizExiste]),
      lv("Propiedades y trampas", "Lo que se puede y lo que no", [w6.raizProducto, w6.raizSumaTrampa, w6.raizMixto]),
      boss("La Zanahoria Rebelde", "🥕", "Mis raíces son profundas. A ver si las encontrás.", [
        w6.raizCuadrada,
        w6.raizDecimal,
        w6.raizCubica,
        w6.raizExiste,
        w6.raizSumaTrampa,
        w6.raizMixto,
      ]),
    ],
  },
  {
    id: "cocina",
    place: "La Cocina a Full",
    topic: "Operaciones combinadas",
    emoji: "🍳",
    levels: [
      lv("Separar en términos", "¿Qué se resuelve primero?", [w7.combSumaProducto, w7.combParentesis]),
      lv("Con potencias y raíces", "Cada término a su tiempo", [w7.combPotRaiz, w7.combMixta]),
      lv("Paréntesis y corchetes", "De adentro hacia afuera", [w7.combCorchetes, w7.combParentesis]),
      boss("La Hora Pico", "⏰", "¡Veinte comandas al mismo tiempo! Orden, orden, orden.", [
        w7.combSumaProducto,
        w7.combPotRaiz,
        w7.combMixta,
        w7.combCorchetes,
      ]),
    ],
  },
  {
    id: "receta",
    place: "La Receta Secreta",
    topic: "Ecuaciones",
    emoji: "🔐",
    levels: [
      lv("Un paso", "Pasar al otro lado", [w8.ecuacionUnPaso]),
      lv("Dos pasos", "Despejar de afuera hacia adentro", [w8.ecuacionDosPasos]),
      lv("x de los dos lados", "Y con potencias y raíces", [w8.ecuacionDosMiembros, w8.ecuacionPotRaiz]),
      boss("El Guardián de la Receta", "🧙", "La receta de la muzza perfecta está bajo llave. La llave es x.", [
        w8.ecuacionUnPaso,
        w8.ecuacionDosPasos,
        w8.ecuacionDosMiembros,
        w8.ecuacionPotRaiz,
      ]),
    ],
  },
  {
    id: "delivery",
    place: "El Delivery",
    topic: "Problemas con enunciado",
    emoji: "🛵",
    levels: [
      lv("Problemas de cuentas", "Leer, pensar y calcular", [w9.problemaCalculo]),
      lv("Plantear ecuaciones", "Traducir el enunciado y resolver", [w9.problemaEcuacion, w9.problemaEdades], 5),
      lv("Problemas desafiantes", "Varios pasos, y también con números gigantes", [w9.problemaDelResto, w9.problemaCalculo, w9.problemaEcuacion, nc.ncProblema], 8),
      boss("El Gran Crítico",
        "🧐",
        "Probé todas las pizzerías del barrio. Si me convencés, te doy cinco estrellas.",
        [
          w1.compararNeg,
          w2.periodicoAFraccion,
          rc.rectaEquivalente,
          w3.sumaTres,
          w4.multTres,
          w5.propiedadesValor,
          nc.ncDividir,
          w6.raizSumaTrampa,
          w7.combCorchetes,
          w8.ecuacionDosPasos,
          w9.problemaCalculo,
          w9.problemaDelResto,
        ],
        12,
      ),
    ],
  },
];

// Numeración: sector 1, 2, 3… y niveles 1, 2, 3 o J (jefe).
WORLDS.forEach((w, i) => {
  let k = 0;
  for (const l of w.levels) l.id = l.boss ? `${i + 1}-J` : `${i + 1}-${++k}`;
});

export function findLevel(levelId: string) {
  for (const w of WORLDS) {
    const i = w.levels.findIndex((l) => l.id === levelId);
    if (i >= 0) return { world: w, level: w.levels[i], index: i };
  }
  return null;
}

/** El nivel que sigue (o null si es el último). */
export function nextLevel(levelId: string) {
  const all = WORLDS.flatMap((w) => w.levels);
  const i = all.findIndex((l) => l.id === levelId);
  return i >= 0 && i < all.length - 1 ? all[i + 1] : null;
}
