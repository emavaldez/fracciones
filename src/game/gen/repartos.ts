// Repartos por partes: "de un chocolate, Jorge se comió 1/2, Juan 1/3; del resto, Lucas 2/5,
// y María los 300 g que quedaban. ¿Cuánto comió cada uno?"
// Hay partes del total, partes del resto y una cantidad conocida (o el total conocido).
import { F, Fraction, lcm } from "../../math/fraction";
import { N, fr, row } from "../../math/expr";
import type { Rng } from "../../math/rng";
import { ft, gen, retry } from "../helpers";
import { genLook } from "../theme";
import type { BarSpec, MultiItem, Question, Step, Trap } from "../types";

const ONE = F(1);
const NAMES = ["Jorge", "Juan", "Lucas", "María", "Martina", "Tomás", "Sofi", "Benja", "Cami", "Joaco", "Valen", "Mili", "Ana", "Nico"];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
/** Miles con punto, como se escribe la plata: $150.000 */
const miles = (v: number) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const plural = (noun: string) => /^(las|los) /.test(noun);

interface Share {
  who: string;
  kind: "T" | "R";
  f: Fraction;
  /** Qué parte del total es. */
  amt: Fraction;
  /** Qué parte del total quedaba justo antes. */
  before: Fraction;
}

/** Cómo se cuenta cada situación. */
interface Ctx {
  /** Personas que se reparten algo (true) o cosas en las que se usa (false). */
  people: boolean;
  fmt: (v: number) => string;
  /** Unidad al lado de cada casillero ("g", "km", "$" o nada). */
  unit: string;
  range: [number, number];
  step: number;
  ofWhole: string;
  wholeShort: string;
  introInverse: string;
  introDirect: (T: number) => string;
  tShare: (who: string, f: string, first: boolean) => string;
  rShare: (who: string, f: string, j: number) => string;
  finalKnown: (who: string, K: number) => string;
  finalUnknown: (who: string) => string;
  qFrac: (who: string) => string;
  qTotal: string;
  qEach: string;
  totalIs: (T: number) => string;
  finalLabel: (who: string) => string;
  finalLabelDirect?: string;
  /** "Eso es lo que se comió Mili" / "Eso es lo que quedó"… */
  finalIs: (who: string) => string;
  /** "Mili se quedó con" / "lo que quedó es"… */
  knownIs: (who: string) => string;
  partOf: (who: string) => string;
  before: (who: string) => string;
  after: (who: string) => string;
  usedAll: string;
  /** "Queda" o "Le falta" */
  remains: string;
  purposes?: string[];
}

function contexts(): Ctx[] {
  const look = genLook();
  const grams = (v: number) => `${v} g`;
  const count = (one: string, many: string) => (v: number) => `${v} ${v === 1 ? one : many}`;
  /** Personas que se comen o se llevan partes de algo. */
  const people = (o: {
    noun: string;
    intro: string;
    introD: (T: number) => string;
    eats: boolean;
    fmt: (v: number) => string;
    unit: string;
    range: [number, number];
    step: number;
    qTotal: string;
    qEach: string;
    totalIs: (T: number) => string;
  }): Ctx => {
    const verb = o.eats ? "se comió" : "se llevó";
    const subj = o.eats ? "se comiera" : "se llevara";
    const verbPl = o.eats ? "se comieron" : "se llevaron";
    return {
      people: true,
      fmt: o.fmt,
      unit: o.unit,
      range: o.range,
      step: o.step,
      ofWhole: `de ${o.noun}`,
      wholeShort: o.noun,
      introInverse: o.intro,
      introDirect: o.introD,
      tShare: (who, f, first) => (first ? `${who} ${verb} ${f}` : `${who}, ${f}`),
      rShare: (who, f, j) => `${j === 0 ? "Del resto" : "De lo que quedó después"}, ${who} ${verb} ${f}`,
      finalKnown: (w, K) => (o.eats ? `y ${w} ${verb} ${o.fmt(K).replace(/^(\d+)/, "los $1")} que quedaban` : `y para ${w} quedaron ${o.fmt(K)}`),
      finalUnknown: (w) => (o.eats ? `y ${w} ${verb} lo que quedó` : `y ${w} ${verb} lo que quedó`),
      qFrac: (w) => (o.eats ? `¿Qué parte de ${o.noun} ${verb} ${w}?` : `¿Qué parte de ${o.noun} quedó para ${w}?`),
      qTotal: o.qTotal,
      qEach: o.qEach,
      totalIs: o.totalIs,
      finalLabel: (w) => w,
      finalIs: (w) => (o.eats ? `Eso es lo que ${verb} ${w}` : `Eso es lo que quedó para ${w}`),
      knownIs: (w) => `${w} se quedó con`,
      partOf: (w) => `la parte de ${w}`,
      before: (w) => `antes de que ${w} ${subj} su parte`,
      after: (w) => `Después de la parte de ${w},`,
      usedAll: `Eso es lo que ${verbPl} los demás juntos.`,
      remains: "Queda",
    };
  };
  const out: Ctx[] = [];
  if (look === "choco") {
    out.push(
      people({
        noun: "la tableta",
        intro: "De una tableta de chocolate,",
        introD: (T) => `Una tableta de chocolate pesa ${T} g.`,
        eats: true,
        fmt: grams,
        unit: "g",
        range: [100, 600],
        step: 10,
        qTotal: "¿Cuánto pesaba la tableta entera? (en gramos)",
        qEach: "¿Cuánto se comió cada uno?",
        totalIs: (T) => `La tableta pesaba ${T} g.`,
      }),
      people({
        noun: "la torta",
        intro: "De la torta de chocolate que sobró del cumpleaños,",
        introD: (T) => `De un cumpleaños sobró una torta de chocolate de ${T} g.`,
        eats: false,
        fmt: grams,
        unit: "g",
        range: [600, 3000],
        step: 10,
        qTotal: "¿Cuánto pesaba la torta? (en gramos)",
        qEach: "¿Cuánta torta se llevó cada uno?",
        totalIs: (T) => `La torta pesaba ${T} g.`,
      }),
      people({
        noun: "la caja",
        intro: "De una caja de bombones,",
        introD: (T) => `Una caja trae ${T} bombones.`,
        eats: false,
        fmt: count("bombón", "bombones"),
        unit: "",
        range: [12, 40],
        step: 1,
        qTotal: "¿Cuántos bombones había en la caja?",
        qEach: "¿Cuántos bombones se llevó cada uno?",
        totalIs: (T) => `La caja tenía ${T} bombones.`,
      }),
    );
  } else {
    out.push(
      people({
        noun: "la bandeja",
        intro: "De una bandeja de empanadas,",
        introD: (T) => `Una bandeja tiene ${T} empanadas.`,
        eats: false,
        fmt: count("empanada", "empanadas"),
        unit: "",
        range: [12, 48],
        step: 1,
        qTotal: "¿Cuántas empanadas había en la bandeja?",
        qEach: "¿Cuántas empanadas se llevó cada uno?",
        totalIs: (T) => `La bandeja tenía ${T} empanadas.`,
      }),
      {
        people: false,
        fmt: grams,
        unit: "g",
        range: [1000, 5000],
        step: 10,
        ofWhole: "del queso",
        wholeShort: "el queso",
        introInverse: "De una horma de queso,",
        introDirect: (T) => `Una horma de queso pesa ${T} g.`,
        tShare: (who, f, first) => (first ? `el pizzero usó ${f} para ${who}` : `${f} para ${who}`),
        rShare: (who, f, j) => `${j === 0 ? "De lo que quedaba" : "De lo que quedó después"}, usó ${f} para ${who}`,
        finalKnown: (_, K) => `y le quedaron ${K} g`,
        finalUnknown: () => "y guardó lo que sobró",
        qFrac: () => "¿Qué parte del queso quedó?",
        qTotal: "¿Cuánto pesaba la horma entera? (en gramos)",
        qEach: "¿Cuánto queso usó para cada cosa?",
        totalIs: (T) => `La horma pesaba ${T} g.`,
        finalLabel: () => "Quedó",
        finalIs: () => "Eso es lo que quedó",
        knownIs: () => "lo que quedó es",
        partOf: (w) => `lo que usó para ${w}`,
        before: (w) => `antes de usar queso para ${w}`,
        after: (w) => `Después de usar queso para ${w},`,
        usedAll: "Eso es lo que se usó para todo lo demás.",
        remains: "Queda",
        purposes: ["las muzzas", "las napolitanas", "las fugazzetas", "las calabresas"],
      },
    );
  }
  const pay = (who: string) => (plural(who) ? "se pagaron" : "se pagó");
  out.push({
    people: false,
    fmt: (v) => `$${miles(v)}`,
    unit: "$",
    range: [50000, 900000],
    step: 1000,
    ofWhole: "de la plata",
    wholeShort: "la plata",
    introInverse: "De la plata que había ahorrada,",
    introDirect: (T) => `Había $${miles(T)} ahorrados.`,
    tShare: (who, f, first) => (first ? `se usó ${f} para pagar ${who}` : `${f} para ${who}`),
    rShare: (who, f, j) => `Con ${f} de lo que ${j === 0 ? "quedaba" : "quedó después"} ${pay(who)} ${who}`,
    finalKnown: (_, K) => `y quedaron $${miles(K)}`,
    finalUnknown: () => "y lo que sobró se guardó",
    qFrac: () => "¿Qué parte de la plata quedó?",
    qTotal: "¿Cuánta plata había ahorrada? (en pesos)",
    qEach: "¿Cuánta plata se usó para cada cosa?",
    totalIs: (T) => `Había $${miles(T)} ahorrados.`,
    finalLabel: () => "Quedó",
    finalIs: () => "Eso es lo que quedó",
    knownIs: () => "lo que quedó es",
    partOf: (w) => `lo que se usó para ${w}`,
    before: (w) => `antes de pagar ${w}`,
    after: (w) => `Después de pagar ${w},`,
    usedAll: "Eso es lo que se gastó.",
    remains: "Queda",
    purposes:
      look === "choco" ? ["el cacao", "el azúcar", "el alquiler", "la luz", "las cajitas de bombones"] : ["la harina", "el queso", "el alquiler", "la luz", "las cajas de pizza"],
  });
  out.push({
    people: false,
    fmt: (v) => `${v} km`,
    unit: "km",
    range: [6, 60],
    step: 1,
    ofWhole: "del recorrido",
    wholeShort: "el recorrido",
    introInverse: "Un repartidor salió a hacer un recorrido.",
    introDirect: (T) => `Un repartidor tiene que hacer un recorrido de ${T} km.`,
    tShare: (_, f, first) => (first ? `Primero hizo ${f} del camino` : `después, otro ${f} del camino`),
    rShare: (_, f, j) => `${j === 0 ? "Más tarde" : "Después"} hizo ${f} de lo que le faltaba`,
    finalKnown: (_, K) => `y todavía le faltan ${K} km`,
    finalUnknown: () => "y el resto lo hizo al final",
    qFrac: () => "¿Qué parte del recorrido le falta todavía?",
    qTotal: "¿Cuántos km tiene el recorrido?",
    qEach: "¿Cuántos km hizo en cada tramo?",
    totalIs: (T) => `El recorrido tiene ${T} km.`,
    finalLabel: () => "Le falta",
    finalLabelDirect: "Último tramo",
    finalIs: () => "Eso es lo que le falta",
    knownIs: () => "lo que le falta es",
    partOf: (w) => `el ${w}`,
    before: (w) => `antes del ${w}`,
    after: (w) => `Después del ${w},`,
    usedAll: "Eso es lo que ya recorrió.",
    remains: "Le falta",
    purposes: ["1.er tramo", "2.º tramo", "3.er tramo", "4.º tramo"],
  });
  return out;
}

const T_FRACS = [F(1, 2), F(1, 3), F(1, 4), F(1, 5), F(1, 6), F(2, 5), F(3, 8), F(1, 8), F(3, 10), F(2, 3), F(3, 4)];
const R_FRACS = [F(1, 2), F(1, 3), F(2, 3), F(1, 4), F(3, 4), F(2, 5), F(3, 5), F(1, 5)];

interface Plan {
  ctx: Ctx;
  shares: Share[];
  final: string;
  /** Qué parte del total queda al final. */
  rest: Fraction;
  T: number;
  K: number;
}

function plan(r: Rng, minR: number, maxR: number): Plan | null {
  const ctx = r.pick(contexts());
  const nT = r.int(1, 2);
  const nR = r.int(minR, maxR);
  const names = r.shuffle(NAMES);
  // Los tramos del recorrido van en orden; las demás cosas, mezcladas.
  const purposes = ctx.purposes ? (ctx.ofWhole === "del recorrido" ? ctx.purposes : r.shuffle(ctx.purposes)) : [];
  const whoAt = (i: number) => (ctx.people ? names[i] : purposes[i]);
  const shares: Share[] = [];
  let rest = ONE;
  for (let i = 0; i < nT; i++) {
    const f = r.pick(T_FRACS);
    if (shares.some((s) => s.f.equals(f))) return null;
    const left = rest.sub(f);
    if (left.compare(F(1, 8)) < 0) return null;
    shares.push({ who: whoAt(i), kind: "T", f, amt: f, before: rest });
    rest = left;
  }
  for (let j = 0; j < nR; j++) {
    const f = r.pick(R_FRACS);
    const amt = f.mul(rest);
    shares.push({ who: whoAt(nT + j), kind: "R", f, amt, before: rest });
    rest = rest.sub(amt);
  }
  if (rest.compare(F(1, 30)) < 0) return null;
  // Fracciones que se puedan manejar (nada de 7/150), y que la respuesta no se pueda adivinar
  // copiando una fracción del enunciado o la parte de otro.
  if (rest.d > 30 || shares.some((s) => s.amt.d > 40)) return null;
  if (rest.equals(F(1, 2)) || shares.some((s) => s.f.equals(rest) || s.amt.equals(rest))) return null;
  const final = ctx.people ? names[shares.length] : "";
  // El total tiene que dar partes enteras.
  const D = [...shares.map((s) => s.amt.d), rest.d].reduce((a, b) => lcm(a, b), 1);
  const base = lcm(D, ctx.step);
  const [lo, hi] = ctx.range;
  const options: number[] = [];
  for (let T = base; T <= hi; T += base) if (T >= lo) options.push(T);
  if (!options.length) return null;
  const T = r.pick(options);
  const K = rest.mul(F(T)).n;
  if (K < 2) return null;
  return { ctx, shares, final, rest, T, K };
}

function story(p: Plan, known: boolean): string {
  const { ctx, shares } = p;
  const ts = shares.filter((s) => s.kind === "T");
  const rs = shares.filter((s) => s.kind === "R");
  const first = ts.map((s, i) => ctx.tShare(s.who, ft(s.f), i === 0)).join(" y ");
  const intro = known ? ctx.introInverse : ctx.introDirect(p.T);
  const lead = intro.endsWith(",") ? `${intro} ${first}` : `${intro} ${cap(first)}`;
  const rest = rs.map((s, j) => ctx.rShare(s.who, ft(s.f), j));
  const end = known ? ctx.finalKnown(p.final, p.K) : ctx.finalUnknown(p.final);
  // "A se comió 1/2 y B, 1/3. Del resto, C se comió 2/5, y D se comió los 300 g que quedaban."
  if (rest.length) return `${lead}. ${rest.join(". ")}, ${end}.`;
  return `${lead}, ${end}.`;
}

/** Barra con las partes de cada uno. */
function bar(p: Plan, opts: { notes: "frac" | "amount"; title?: string; upTo?: number; finalNote?: string; finalName?: string }): BarSpec {
  const shown = p.shares.slice(0, opts.upTo ?? p.shares.length);
  const used = shown.reduce((a, s) => a.add(s.amt), F(0));
  const segs: BarSpec["segs"] = shown.map((s, i) => ({
    size: s.amt,
    label: cap(s.who),
    note: opts.notes === "frac" ? `${s.amt.n}/${s.amt.d}` : p.ctx.fmt(s.amt.mul(F(p.T)).n),
    tone: i,
  }));
  const restSize = ONE.sub(used);
  const isFinal = shown.length === p.shares.length;
  segs.push({
    size: restSize,
    label: isFinal ? cap(opts.finalName ?? p.ctx.finalLabel(p.final)) : "Resto",
    note: opts.finalNote ?? (opts.notes === "frac" ? `${restSize.n}/${restSize.d}` : p.ctx.fmt(restSize.mul(F(p.T)).n)),
    muted: !isFinal,
    tone: shown.length,
  });
  return { title: opts.title, segs };
}

const hasRest = (p: Plan) => p.shares.some((s) => s.kind === "R");
const restWarning = (p: Plan) => {
  const r1 = p.shares.find((s) => s.kind === "R");
  return r1 ? ` Ojo: ${ft(r1.f)} de lo que quedaba es una parte del RESTO, no del total.` : "";
};

/** Pasos para saber qué parte del total le tocó a cada uno y qué parte queda. */
function fractionSteps(p: Plan): Step[] {
  const { shares, ctx } = p;
  const steps: Step[] = [];
  const ts = shares.filter((s) => s.kind === "T");
  const of = ctx.ofWhole;
  const afterT = ts.reduce((a, s) => a.sub(s.f), ONE);
  const sumT = ONE.sub(afterT);
  if (ts.length === 2) {
    steps.push({
      text: `Las dos primeras partes son ${ft(ts[0].f)} y ${ft(ts[1].f)} ${of}: juntas, ${ft(sumT)}.`,
      math: row(fr(ts[0].f), "+", fr(ts[1].f), "=", fr(sumT)),
    });
  }
  steps.push({
    text: `${ts.length === 2 ? "Después de esas dos partes," : ctx.after(ts[0].who)} ${ctx.remains.toLowerCase()} 1 − ${ft(sumT)} = ${ft(afterT)} ${of}.`,
    math: row(N(1), "-", fr(sumT), "=", fr(afterT)),
    // Sin partes "del resto", la barra completa va en el último paso.
    ...(hasRest(p) ? { bar: bar(p, { notes: "frac", upTo: ts.length }) } : {}),
  });
  shares
    .filter((s) => s.kind === "R")
    .forEach((s, j, rs) => {
      const after = s.before.sub(s.amt);
      steps.push({
        text: `${cap(ctx.partOf(s.who))}: ${ft(s.f)} DEL RESTO (de lo que quedaba), o sea ${ft(s.f)} de ${ft(s.before)}. Es una multiplicación.`,
        math: row(fr(s.f), "·", fr(s.before), "=", fr(s.amt)),
      });
      steps.push({
        text: `${ctx.remains} ${ft(s.before)} − ${ft(s.amt)} = ${ft(after)} ${of}.`,
        math: row(fr(s.before), "-", fr(s.amt), "=", fr(after)),
        ...(j === rs.length - 1 ? {} : { bar: bar(p, { notes: "frac", upTo: ts.length + j + 1 }) }),
      });
    });
  return steps;
}

/** Errores típicos al calcular qué parte queda (sin valores repetidos). */
function restTraps(p: Plan): Trap[] {
  const { shares, ctx } = p;
  const traps: Trap[] = [];
  const rs = shares.filter((s) => s.kind === "R");
  const allOfTotal = shares.reduce((a, s) => a.sub(s.f), ONE);
  if (rs.length && allOfTotal.n > 0)
    traps.push({
      value: allOfTotal,
      msg: `Restaste todas las fracciones como si fueran del total. Pero ${ft(rs[0].f)} es DEL RESTO: hay que calcular ${ft(rs[0].f)} de lo que quedaba (una multiplicación).`,
    });
  rs.forEach((s, j) => {
    const missing = rs.slice(j).map((x) => ctx.partOf(x.who));
    traps.push({
      value: s.before,
      msg: `Esa es la parte que quedaba ${ctx.before(s.who)}. Falta restar ${missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} y ${missing[missing.length - 1]}`}.`,
    });
  });
  // "Esa es la parte de…", "Eso es lo que…", "Ese es el 2.º tramo…"
  const thatIs = (w: string) => {
    const part = ctx.partOf(w);
    return `${part.startsWith("la ") ? "Esa" : part.startsWith("lo ") ? "Eso" : "Ese"} es ${part}`;
  };
  for (const s of rs) traps.push({ value: s.amt, msg: `${thatIs(s.who)}, no lo que ${ctx.remains === "Queda" ? "quedó" : "le falta"} al final.` });
  traps.push({ value: ONE.sub(p.rest), msg: `${ctx.usedAll} Lo que ${ctx.remains === "Queda" ? "queda" : "le falta"} es 1 menos eso.` });
  const out: Trap[] = [];
  for (const t of traps) {
    const v = t.value as Fraction;
    if (v.equals(p.rest) || out.some((o) => (o.value as Fraction).equals(v))) continue;
    out.push(t);
  }
  return out;
}

function eachItems(p: Plan): MultiItem[] {
  return p.shares.map((s) => {
    const v = s.amt.mul(F(p.T));
    const traps: Trap[] = [];
    if (s.kind === "R") {
      const wrong = s.f.mul(F(p.T));
      traps.push({ value: wrong, msg: `${ft(s.f)} es DEL RESTO, no del total: hay que calcular ${ft(s.f)} de ${p.ctx.fmt(s.before.mul(F(p.T)).n)}.` });
    }
    // Solo números enteros: es lo que se escribe en el casillero.
    return { label: cap(s.who), value: v, unit: p.ctx.unit, traps: traps.filter((t) => (t.value as Fraction).isInteger() && !(t.value as Fraction).equals(v)) };
  });
}

function eachSteps(p: Plan): Step[] {
  const steps: Step[] = [];
  for (const s of p.shares) {
    const v = s.amt.mul(F(p.T)).n;
    if (s.kind === "T") steps.push({ text: `${cap(s.who)}: ${ft(s.f)} de ${p.ctx.fmt(p.T)}.`, math: row(fr(s.f), "·", N(p.T), "=", N(v)) });
    else {
      const restV = s.before.mul(F(p.T)).n;
      steps.push({ text: `${cap(s.who)}: ${ft(s.f)} del resto, y el resto eran ${p.ctx.fmt(restV)}.`, math: row(fr(s.f), "·", N(restV), "=", N(v)) });
    }
  }
  return steps;
}

const RULE =
  "“Del total” se calcula sobre el entero; “del resto” se calcula sobre lo que quedaba en ese momento (es una fracción de una fracción: se multiplica). Al final, todas las partes juntas tienen que dar el total.";

// ---------------------------------------------------------------- total desconocido

export const repartoInverso = gen("rp-inverso", (r) =>
  retry(() => {
    const p = plan(r, 0, 2);
    if (!p || (!hasRest(p) && r.chance(0.6))) return null;
    const { ctx } = p;
    const st = story(p, true);
    const known = ctx.fmt(p.K);
    const fullBar = bar(p, { notes: "frac", finalNote: `${p.rest.n}/${p.rest.d} = ${known}` });

    // 3) Cuánto le tocó a cada uno
    const items = eachItems(p);
    const q3: Question = {
      gen: "",
      title: ctx.qEach,
      story: `${st} ${ctx.totalIs(p.T)}`,
      answer: { kind: "multi", items },
      hint: [{ text: `Cada parte se calcula sobre lo que había en ese momento.${restWarning(p)}` }],
      steps: [
        ...eachSteps(p),
        {
          text: "Comprobamos: todas las partes juntas dan el total.",
          math: row(...items.flatMap((it, i) => [...(i ? ["+" as const] : []), N(it.value.n)]), "+", N(p.K), "=", N(p.T)),
          bar: bar(p, { notes: "amount", title: ctx.totalIs(p.T) }),
        },
      ],
      rule: RULE,
    };

    // 2) El total
    const unitPart = p.K / p.rest.n;
    const totalTraps: Trap[] = [];
    if (p.rest.n > 1)
      totalTraps.push({
        value: p.K * p.rest.d,
        msg: `${known} son ${ft(p.rest)} del total, no ${ft(1, p.rest.d)}. Primero buscá cuánto es ${ft(1, p.rest.d)}: ${p.K} : ${p.rest.n} = ${unitPart}.`,
      });
    const times = p.rest.mul(F(p.K));
    if (times.isInteger())
      totalTraps.push({ value: times.n, msg: `Multiplicaste ${p.K} por ${ft(p.rest)}. Pero ${known} ya son ${ft(p.rest)} del total: el total tiene que ser más grande.` });
    const q2: Question = {
      gen: "",
      title: ctx.qTotal,
      story: `${st} Ya sabemos que ${ctx.knownIs(p.final)} ${ft(p.rest)} ${ctx.ofWhole}.`,
      answer: { kind: "integer", value: p.T },
      traps: totalTraps.filter((t) => t.value !== p.T),
      hint: [
        {
          text:
            p.rest.n === 1
              ? `Si ${ft(p.rest)} ${ctx.ofWhole} son ${known}, el entero (${ft(p.rest.d, p.rest.d)}) es ${p.rest.d} veces eso.`
              : `${cap(ft(p.rest))} ${ctx.ofWhole} son ${known}. ¿Cuánto es ${ft(1, p.rest.d)}? ¿Y el entero, que son ${ft(p.rest.d, p.rest.d)}?`,
        },
      ],
      steps: [
        { text: `${cap(ft(p.rest))} ${ctx.ofWhole} son ${known}.`, bar: { title: `${cap(ctx.wholeShort)}: ?`, segs: fullBar.segs } },
        ...(p.rest.n > 1 ? [{ text: `Entonces ${ft(1, p.rest.d)} es ${p.K} : ${p.rest.n} = ${unitPart}.`, math: row(N(p.K), ":", N(p.rest.n), "=", N(unitPart)) }] : []),
        { text: `El entero son ${ft(p.rest.d, p.rest.d)}: ${unitPart} · ${p.rest.d} = ${p.T}.`, math: row(N(unitPart), "·", N(p.rest.d), "=", N(p.T)) },
      ],
      rule: "Si sabés cuánto es una parte del total, dividí por el numerador (así tenés una sola parte) y multiplicá por el denominador (todas las partes).",
      followUp: q3,
    };

    // 1) Qué parte quedó
    return {
      gen: "",
      title: ctx.qFrac(p.final),
      story: st,
      answer: { kind: "fraction", value: p.rest },
      traps: restTraps(p),
      hint: [{ text: hasRest(p) ? `Fijate qué parte queda después de cada paso.${restWarning(p)}` : "Sumá las partes que se conocen y fijate cuánto falta para llegar al entero." }],
      steps: [...fractionSteps(p), { text: `${ctx.finalIs(p.final)}: ${ft(p.rest)} ${ctx.ofWhole}.`, bar: fullBar }],
      rule: RULE,
      followUp: q2,
    } satisfies Question;
  }),
);

// ---------------------------------------------------------------- total conocido

export const repartoDirecto = gen("rp-directo", (r) =>
  retry(() => {
    const p = plan(r, 0, 1);
    if (!p) return null;
    const { ctx } = p;
    const items = eachItems(p);
    // Que la última parte no coincida con otra (se podría acertar por casualidad).
    if (items.some((it) => it.value.equals(F(p.K)))) return null;
    const finalName = ctx.finalLabelDirect ?? ctx.finalLabel(p.final);
    const allOfTotal = p.shares.reduce((a, s) => a.sub(s.f), ONE).mul(F(p.T));
    const finalItem: MultiItem = {
      label: cap(finalName),
      value: F(p.K),
      unit: ctx.unit,
      traps:
        hasRest(p) && allOfTotal.n > 0 && allOfTotal.isInteger() && !allOfTotal.equals(F(p.K))
          ? [{ value: allOfTotal, msg: "Restaste las fracciones como si todas fueran del total. Las partes “del resto” se calculan sobre lo que quedaba." }]
          : [],
    };
    return {
      gen: "",
      title: ctx.people || ctx.finalLabelDirect ? ctx.qEach : `${ctx.qEach} ¿Y cuánto quedó?`,
      story: story(p, false),
      answer: { kind: "multi", items: [...items, finalItem] },
      hint: [{ text: `Calculá cada parte en orden y, al final, lo que queda.${restWarning(p)}` }],
      steps: [
        ...eachSteps(p),
        {
          text: ctx.people ? `${cap(p.final)}: lo que sobró de ${p.ctx.fmt(p.T)}.` : `${cap(finalName)}: lo que quedó de ${p.ctx.fmt(p.T)}.`,
          math: row(N(p.T), ...items.flatMap((it) => ["-" as const, N(it.value.n)]), "=", N(p.K)),
          bar: bar(p, { notes: "amount", title: ctx.totalIs(p.T), finalName }),
        },
      ],
      rule: RULE,
    } satisfies Question;
  }),
);
