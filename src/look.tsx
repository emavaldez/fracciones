// Cómo se ven las cosas: con pizzas o con chocolates.
// Cambia los dibujos de fracciones, los íconos de puntaje y de vidas, y las palabras de las
// consignas que hablan de esos dibujos ("pizza" → "tableta").
import { createContext, useContext } from "react";
import type { Question, World } from "./game/types";
import { WORLDS, findLevel } from "./game/worlds";

export type Look = "pizza" | "choco";

export const LookContext = createContext<Look>("pizza");
export const useLook = () => useContext(LookContext);

const KEY = "fraccion-look";

/** Lo único que se recuerda entre visitas (si el navegador lo permite). */
export function loadLook(): Look {
  try {
    return localStorage.getItem(KEY) === "choco" ? "choco" : "pizza";
  } catch {
    return "pizza";
  }
}
export function saveLook(l: Look) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // sin almacenamiento: dura mientras la página está abierta
  }
}

export function LookToggle({ look, setLook }: { look: Look; setLook: (l: Look) => void }) {
  return (
    <div className="look-toggle" role="radiogroup" aria-label="Ver las fracciones con">
      <span className="look-label">Ver con</span>
      {(
        [
          ["pizza", "🍕", "Pizzas"],
          ["choco", "🍫", "Chocolates"],
        ] as const
      ).map(([id, emoji, name]) => (
        <button key={id} type="button" role="radio" aria-checked={look === id} className={`look-opt${look === id ? " is-on" : ""}`} onClick={() => setLook(id)}>
          <span aria-hidden="true">{emoji}</span> {name}
        </button>
      ))}
    </div>
  );
}

/** Nombre de los "premios" de cada nivel. */
export const prizeWord = (look: Look, n = 2) => (look === "choco" ? (n === 1 ? "chocolate" : "chocolates") : n === 1 ? "pizza" : "pizzas");

// Primero las frases que cambian de género o de sentido; después las palabras sueltas.
const SWAPS: [RegExp, string][] = [
  [/la mitad de las pizzas eran de muzza, (.+?) de jamón y las (\d+) restantes de fugazzeta/g, "la mitad de las tabletas eran de chocolate con leche, $1 con almendras y las $2 restantes de chocolate blanco"],
  [/muzza \+ jamón \+ fugazzeta/g, "con leche + con almendras + blancas"],
  [/de fugazzeta/g, "de chocolate blanco"],
  [/De las (.+?) porciones que se vendieron este año, (.+?) fueron de muzzarella\. ¿Cuántas fueron\?/g, "De los $1 bombones que se vendieron este año, $2 fueron de dulce de leche. ¿Cuántos fueron?"],
  [/La cadena de pizzerías vendió (.+?) porciones este año\. Cada pizza tiene 8 porciones\. ¿Cuántas pizzas son\?/g, "La cadena de chocolaterías vendió $1 bombones este año. Cada caja tiene 8 bombones. ¿Cuántas cajas son?"],
  [/Hay que dividir las porciones por 8\./g, "Hay que dividir los bombones por 8."],
  [/Cada pizza son 8 porciones/g, "Cada caja son 8 bombones"],
  [/¿Cuántas pizzas son\?/g, "¿Cuántas cajas son?"],
  [/Una pizza tarda (\d+) minutos en el horno/g, "Un bizcochuelo de chocolate tarda $1 minutos en el horno"],
  [/mientras se hornea la pizza/g, "mientras se hornea el bizcochuelo"],
  [/kg de muzzarella/g, "kg de chocolate"],
  [/hilito de muzzarella/g, "hilito de caramelo"],
  [/hilo de muzzarella/g, "hilo de caramelo"],
  [/gramos de queso/g, "gramos de cacao"],
  [/caja de pizza cuadrada/g, "caja cuadrada de bombones"],
  [/cajas de pizza/g, "cajas de bombones"],
  [/gota de salsa/g, "gota de chocolate"],
  [/Para la salsa/g, "Para la receta"],
  [/(cucharadita|kg) de levadura/g, "$1 de cacao"],
  [/La masa crece: cada hora se multiplica por sí misma\./g, "Los bombones se multiplican: cada caja trae más cajas adentro."],
  [/Fermentación a full\./g, "La fábrica de bombones, a full."],
  [/Cuidado con la temperatura de la cámara\./g, "Cuidado con la temperatura de la fábrica."],
  [/Una masa que todavía no levó nada\./g, "Una máquina que todavía no arrancó."],
  [/La cámara está al revés/g, "La máquina está al revés"],
  [/en la huerta/g, "en la plantación de cacao"],
  [/Para la masa/g, "Para la mezcla"],
  [/harina/g, "cacao"],
  [/¿Cuánta pizza/g, "¿Cuánto chocolate"],
  [/Pizzerías/g, "Chocolaterías"],
  [/pizzerías/g, "chocolaterías"],
  [/Pizzería/g, "Chocolatería"],
  [/pizzería/g, "chocolatería"],
  [/\bPizzas\b/g, "Tabletas"],
  [/\bpizzas\b/g, "tabletas"],
  [/\bPizza\b/g, "Tableta"],
  [/\bpizza\b/g, "tableta"],
  [/\bse cortaron\b/g, "se dividieron"],
  [/\bse cortó\b/g, "se dividió"],
  [/\bse corta\b/g, "se divide"],
  [/\bcortadas\b/g, "divididas"],
  [/\bcortada\b/g, "dividida"],
];

export function chocoText(s: string): string {
  let out = s;
  for (const [re, to] of SWAPS) out = out.replace(re, to);
  return out;
}

/** Con chocolates, todas las consignas pasan a la chocolatería. */
export function withLook(q: Question, look: Look): Question {
  if (look !== "choco") return q;
  const t = (s: string | undefined) => (s === undefined ? s : chocoText(s));
  const a = q.answer;
  return {
    ...q,
    title: chocoText(q.title),
    story: t(q.story),
    rule: t(q.rule),
    answerPrefix: t(q.answerPrefix),
    hint: q.hint.map((h) => ({ ...h, text: t(h.text) })),
    steps: q.steps.map((h) => ({ ...h, text: t(h.text) })),
    traps: q.traps?.map((x) => ({ ...x, msg: chocoText(x.msg) })),
    sciTraps: q.sciTraps?.map((x) => ({ ...x, msg: chocoText(x.msg) })),
    answer: a.kind === "choice" ? { ...a, options: a.options.map((o) => ({ ...o, label: t(o.label), why: t(o.why) })) } : a,
    followUp: q.followUp ? withLook(q.followUp, look) : undefined,
  };
}

// ---------------------------------------------------------------- textos de la pantalla

export interface LookTexts {
  shop: string;
  title: string;
  lead: string;
  open: string;
  mapIntro: string;
  good: string[];
  bad: string[];
  ranks: [number, string][];
  themeColor: string;
}

export const TEXTS: Record<Look, LookTexts> = {
  pizza: {
    shop: "Pizzería",
    title: "Pizzería La Fracción",
    lead: "Atendé la pizzería resolviendo fracciones. Cada sector de la cocina es un tema distinto.",
    open: "Abrir la pizzería",
    mapIntro: "Elegí un sector de la cocina. Todos los niveles están abiertos.",
    good: ["¡Al punto!", "¡Salió perfecta!", "¡Qué muzza!", "¡Crocante!", "¡Impecable!", "¡De diez!"],
    bad: ["¡Se quemó!", "Esa vuelve a la cocina", "Uy, se pasó de horno", "Le faltó cocción"],
    ranks: [
      [0, "Aprendiz de la masa"],
      [100, "Ayudante del horno"],
      [300, "Mano de muzza"],
      [700, "Estrella del mostrador"],
      [1500, "Leyenda de la fugazzeta"],
    ],
    themeColor: "#0f4d3a",
  },
  choco: {
    shop: "Chocolatería",
    title: "Chocolatería La Fracción",
    lead: "Atendé la chocolatería resolviendo fracciones. Cada sector de la fábrica es un tema distinto.",
    open: "Abrir la chocolatería",
    mapIntro: "Elegí un sector de la chocolatería. Todos los niveles están abiertos.",
    good: ["¡Al punto!", "¡Salió perfecto!", "¡Qué rico!", "¡Bien templado!", "¡Impecable!", "¡De diez!"],
    bad: ["¡Se derritió!", "Ese vuelve a la cocina", "Uy, se pasó de punto", "Le faltó templado"],
    ranks: [
      [0, "Aprendiz de bombonero"],
      [100, "Ayudante del baño María"],
      [300, "Mano de cacao"],
      [700, "Estrella del mostrador"],
      [1500, "Leyenda del dulce de leche"],
    ],
    themeColor: "#3d2417",
  },
};

export const useTexts = () => TEXTS[useLook()];

// ---------------------------------------------------------------- sectores

type LevelPatch = { name?: string; about?: string; boss?: { name?: string; emoji?: string; line?: string } };
type WorldPatch = { place?: string; topic?: string; emoji?: string; levels?: Record<number, LevelPatch> };

/** Cómo se llaman los sectores (y sus jefes) en la chocolatería. */
const CHOCO_WORLDS: Record<string, WorldPatch> = {
  mostrador: {
    emoji: "🍫",
    levels: { 0: { about: "¿Qué fracción de chocolate hay?" }, 3: { boss: { line: "Yo pedí media tableta y me trajeron dos cuartos. ¿Me están cargando?" } } },
  },
  amasado: { place: "La Mesa de Templado", emoji: "🥣" },
  recta: { place: "El Riel de Pedidos" },
  horno: {
    place: "El Baño María",
    emoji: "♨️",
    levels: { 3: { boss: { name: "El Inspector del Baño María", line: "Un chocolate mal sumado es un chocolate quemado." } } },
  },
  tabla: { levels: { 3: { boss: { line: "Corto la tableta en partes iguales. Vos decime cuánto da." } } } },
  fermentacion: { place: "La Fábrica de Bombones", emoji: "🍬", levels: { 3: { boss: { name: "El Bombón Gigante" } } } },
  despensa: { levels: { 3: { boss: { line: "Cuento granos de azúcar: millones. Y cada uno pesa casi nada. ¿Me ayudás?" } } } },
  huerta: { place: "La Plantación de Cacao", emoji: "🌳", levels: { 3: { boss: { name: "El Cacaotero Rebelde", emoji: "🌰" } } } },
  cocina: { emoji: "🧑‍🍳" },
  receta: { levels: { 3: { boss: { line: "La receta del chocolate perfecto está bajo llave. La llave es x." } } } },
  delivery: { levels: { 3: { boss: { line: "Probé todas las chocolaterías del barrio. Si me convencés, te doy cinco estrellas." } } } },
};

export function themeWorld(w: World, look: Look): World {
  const p = look === "choco" ? CHOCO_WORLDS[w.id] : undefined;
  if (!p) return w;
  return {
    ...w,
    place: p.place ?? w.place,
    topic: p.topic ?? w.topic,
    emoji: p.emoji ?? w.emoji,
    levels: w.levels.map((l, i) => {
      const lp = p.levels?.[i];
      if (!lp) return l;
      return { ...l, name: lp.name ?? lp.boss?.name ?? l.name, about: lp.about ?? l.about, boss: l.boss && lp.boss ? { ...l.boss, ...lp.boss } : l.boss };
    }),
  };
}

export const themedWorlds = (look: Look) => WORLDS.map((w) => themeWorld(w, look));

export function findThemed(levelId: string, look: Look) {
  const f = findLevel(levelId);
  if (!f) return null;
  const world = themeWorld(f.world, look);
  return { world, level: world.levels[f.index], index: f.index };
}
