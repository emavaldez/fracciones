import { describe, expect, it } from "vitest";
import { F, fractionToDecimalString, gcd } from "../src/math/fraction";
import { toText } from "../src/math/expr";
import { makeRng } from "../src/math/rng";
import { check, emptyDraft, type Draft } from "../src/game/check";
import { WORLDS } from "../src/game/worlds";
import { RECIPES } from "../src/game/recipes";
import { buildQueue } from "../src/game/session";
import type { GenEntry, LineSpec, Question } from "../src/game/types";
import { decStr, isSciMantissa, sameSci } from "../src/math/sci";
import { containsValue, findFalseEqualities } from "./evaluate";

const N_PER_GEN = 300;

function correctDraft(q: Question): { draft: Draft; choice: number | null } {
  const a = q.answer;
  const d = emptyDraft();
  switch (a.kind) {
    case "choice":
      return { draft: d, choice: a.correct };
    case "integer":
      return { draft: { ...d, neg: a.value < 0, text: String(Math.abs(a.value)) }, choice: null };
    case "decimal": {
      const s = fractionToDecimalString(a.value.abs());
      return { draft: { ...d, neg: a.value.n < 0, text: s ?? "?" }, choice: null };
    }
    case "fraction":
      return { draft: { ...d, neg: a.value.n < 0, num: String(Math.abs(a.value.n)), den: a.value.d === 1 ? "" : String(a.value.d) }, choice: null };
    case "mixed": {
      const n = Math.abs(a.value.n);
      const w = Math.floor(n / a.value.d);
      const rest = n % a.value.d;
      return { draft: { ...d, neg: a.value.n < 0, whole: String(w), num: rest ? String(rest) : "", den: rest ? String(a.value.d) : "" }, choice: null };
    }
    case "point":
      return { draft: { ...d, pt: a.value, parts: a.pickParts ? a.value.d : a.line.parts }, choice: null };
    case "sci":
      return { draft: { ...d, text: decStr(a.m, false), exp: String(Math.abs(a.e)), expNeg: a.e < 0 }, choice: null };
  }
}

const LINE_W = 360 - 2 * 26;
const onGrid = (v: { n: number; d: number }, parts: number) => (v.n * parts) % v.d === 0;

/** La recta se puede dibujar: puntos dentro del rango, sobre rayitas, sin banderitas encimadas. */
function checkLine(l: LineSpec, ctx: string, interactive = false) {
  expect(Number.isInteger(l.min) && Number.isInteger(l.max) && l.max > l.min, ctx).toBe(true);
  expect(l.parts >= 1 && l.parts <= 12, ctx).toBe(true);
  expect((l.max - l.min) * l.parts, `${ctx}\ndemasiadas rayitas`).toBeLessThanOrEqual(interactive ? 24 : 30);
  const inside = (v: { n: number; d: number }) => v.n / v.d >= l.min - 1e-9 && v.n / v.d <= l.max + 1e-9;
  for (const v of l.labels ?? []) {
    expect(inside(v), `${ctx}\nnúmero fuera de la recta`).toBe(true);
    expect(onGrid(v, l.parts), `${ctx}\nnúmero fuera de las rayitas`).toBe(true);
  }
  const pins = (l.marks ?? []).filter((m) => m.tone !== "dot");
  for (const m of l.marks ?? []) {
    expect(inside(m.value), `${ctx}\nmarca fuera de la recta`).toBe(true);
    expect(onGrid(m.value, l.parts), `${ctx}\nmarca fuera de las rayitas`).toBe(true);
  }
  const unit = LINE_W / (l.max - l.min);
  for (let i = 0; i < pins.length; i++)
    for (let j = i + 1; j < pins.length; j++) {
      const dx = Math.abs(pins[i].value.value() - pins[j].value.value()) * unit;
      expect(dx, `${ctx}\nbanderitas encimadas`).toBeGreaterThanOrEqual(21);
    }
  if (l.hops) {
    const end = l.hops.from.add(l.hops.step.mul(F(l.hops.count)));
    expect(inside(l.hops.from) && inside(end), `${ctx}\nsaltos fuera de la recta`).toBe(true);
    expect(l.hops.count, ctx).toBeGreaterThan(0);
    expect(l.hops.count, ctx).toBeLessThanOrEqual(24);
  }
}

function allText(q: Question): string {
  const parts: string[] = [q.title, q.story ?? "", q.rule ?? "", q.math ? toText(q.math) : ""];
  for (const s of [...q.steps, ...q.hint]) parts.push(s.text ?? "", s.math ? toText(s.math) : "");
  for (const t of q.traps ?? []) parts.push(t.msg);
  if (q.answer.kind === "choice") for (const o of q.answer.options) parts.push(o.label ?? "", o.why ?? "", o.math ? toText(o.math) : "");
  return parts.join(" | ");
}

function validateQuestion(q: Question, where: string) {
  const ctx = `${where}\n${allText(q)}`;
  // Sin basura
  expect(allText(q), ctx).not.toMatch(/NaN|undefined|Infinity|\[object/);
  expect(q.steps.length, ctx).toBeGreaterThan(0);
  expect(q.hint.length, ctx).toBeGreaterThan(0);
  // La respuesta correcta se acepta
  const { draft, choice } = correctDraft(q);
  const v = check(q, draft, choice);
  expect(v.correct, `${ctx}\nrespuesta: ${JSON.stringify(draft)} ${JSON.stringify(v)}`).toBe(true);
  // Valores razonables
  const a = q.answer;
  const big = q.gen.startsWith("nc-");
  if (a.kind === "fraction" || a.kind === "mixed" || a.kind === "decimal") {
    expect(a.value.d, ctx).toBeLessThanOrEqual(big ? 10 ** 8 : 1000);
    expect(Math.abs(a.value.n), ctx).toBeLessThanOrEqual(big ? 10 ** 9 : 99999);
  }
  if (a.kind === "decimal") expect(decStr(a.value, false).replace(/[-,]/g, "").length, `${ctx}\nno entra en el casillero`).toBeLessThanOrEqual(10);
  if (a.kind === "sci") {
    expect(isSciMantissa(a.m), ctx).toBe(true);
    expect(decStr(a.m, false).replace(",", "").length, ctx).toBeLessThanOrEqual(4);
    expect(Math.abs(a.e), ctx).toBeLessThanOrEqual(12);
    expect(a.e, `${ctx}\nexponente 0`).not.toBe(0);
    for (const t of q.sciTraps ?? []) expect(sameSci(t, a), `${ctx}\ntrampa igual a la respuesta: ${t.msg}`).toBe(false);
  }
  if (q.line) checkLine(q.line, ctx);
  for (const s of [...q.steps, ...q.hint]) if (s.line) checkLine(s.line, ctx);
  if (a.kind === "point") {
    checkLine(a.line, ctx, true);
    const l = a.line;
    expect(a.value.value() >= l.min && a.value.value() <= l.max, `${ctx}\nla respuesta no está en la recta`).toBe(true);
    if (a.pickParts) expect(a.value.d, ctx).toBeLessThanOrEqual(12);
    else expect(onGrid(a.value, l.parts), `${ctx}\nla respuesta no cae en una rayita`).toBe(true);
    for (const t of q.traps ?? []) {
      const tv = typeof t.value === "number" ? F(t.value) : t.value;
      expect(tv.value() >= l.min && tv.value() <= l.max, `${ctx}\ntrampa fuera de la recta: ${t.msg}`).toBe(true);
    }
  }
  if (a.kind === "decimal") expect(fractionToDecimalString(a.value), ctx).not.toBeNull();

  if (a.kind === "choice") {
    expect(a.options.length, ctx).toBeGreaterThanOrEqual(2);
    expect(a.correct, ctx).toBeGreaterThanOrEqual(0);
    expect(a.correct, ctx).toBeLessThan(a.options.length);
    a.options.forEach((o, i) => {
      if (i !== a.correct) expect(o.why, `${ctx}\nopción ${i} sin explicación`).toBeTruthy();
    });
    const shown = a.options.map((o) => (o.label ?? "") + (o.math ? toText(o.math) : "") + (o.pizza ? JSON.stringify(o.pizza) : ""));
    expect(new Set(shown).size, `${ctx}\nopciones repetidas`).toBe(shown.length);
  }
  // Las trampas nunca coinciden con la respuesta correcta
  if (a.kind !== "choice" && a.kind !== "sci") {
    const correct = a.kind === "integer" ? F(a.value) : a.value;
    for (const t of q.traps ?? []) {
      const tv = typeof t.value === "number" ? F(t.value) : t.value;
      expect(tv.equals(correct), `${ctx}\ntrampa igual a la respuesta`).toBe(false);
    }
  }
  // Todas las igualdades de las explicaciones son verdaderas
  const bad: string[] = [];
  for (const s of q.steps) findFalseEqualities(s.math, bad);
  for (const s of q.hint) findFalseEqualities(s.math, bad);
  expect(bad, `${ctx}\nigualdades falsas`).toEqual([]);
  // La explicación llega al resultado
  if (a.kind === "fraction" || a.kind === "decimal" || a.kind === "mixed") {
    const reached = q.steps.some((s) => containsValue(s.math, a.value)) || q.steps.some((s) => (s.text ?? "").includes(String(a.value.n)));
    expect(reached, `${ctx}\nla explicación no muestra el resultado ${a.value}`).toBe(true);
  }
  // Pizzas dibujables
  for (const p of q.pizzas ?? []) {
    expect(p.slices).toBeGreaterThan(1);
    expect(p.filled).toBeGreaterThan(0);
    expect(Math.ceil(p.filled / p.slices)).toBeLessThanOrEqual(4);
  }
  if (q.followUp) validateQuestion(q.followUp, where + " (2ª parte)");
}

const allGens = new Map<string, GenEntry>();
for (const w of WORLDS) for (const l of w.levels) for (const g of l.gens) allGens.set(g.id, g);

describe("generadores", () => {
  for (const [id, g] of allGens) {
    it(`${id} genera ejercicios válidos`, () => {
      const r = makeRng(12345 + id.length * 7);
      for (let i = 0; i < N_PER_GEN; i++) validateQuestion(g.make(r), `${id} #${i}`);
    });
  }
});

describe("niveles", () => {
  for (const w of WORLDS) {
    for (const l of w.levels) {
      it(`nivel ${l.id} arma ${l.count} comandas distintas`, () => {
        for (let s = 0; s < 20; s++) {
          const qs = buildQueue(l, makeRng(s));
          expect(qs.length).toBe(l.count);
        }
      });
    }
  }
});

describe("recetas", () => {
  it("todas las igualdades de los ejemplos son verdaderas", () => {
    for (const w of WORLDS) {
      const items = RECIPES[w.id];
      expect(items, w.id).toBeTruthy();
      for (const it of items) {
        expect(findFalseEqualities(it.math), `${w.id}: ${it.text}`).toEqual([]);
      }
    }
  });
});

describe("corrección de respuestas", () => {
  it("acepta fracciones equivalentes con un consejo, salvo cuando hay que simplificar", () => {
    const q: Question = { gen: "t", title: "", answer: { kind: "fraction", value: F(3, 4) }, hint: [{ text: "x" }], steps: [{ text: "x" }] };
    const d = { ...emptyDraft(), num: "6", den: "8" };
    const v = check(q, d, null);
    expect(v.correct).toBe(true);
    expect(v.note).toBeTruthy();
    const q2: Question = { ...q, answer: { kind: "fraction", value: F(3, 4), mustSimplify: true } };
    expect(check(q2, d, null).correct).toBe(false);
  });
  it("detecta el signo cambiado y la fracción invertida", () => {
    const q: Question = { gen: "t", title: "", answer: { kind: "fraction", value: F(-2, 5) }, hint: [{ text: "x" }], steps: [{ text: "x" }] };
    expect(check(q, { ...emptyDraft(), num: "2", den: "5" }, null).diagnosis).toMatch(/signo/);
    expect(check(q, { ...emptyDraft(), neg: true, num: "5", den: "2" }, null).diagnosis).toMatch(/vuelta/);
  });
  it("gcd básico", () => {
    expect(gcd(12, 18)).toBe(6);
  });
});

describe("recta y notación científica", () => {
  const line = { min: 0, max: 2, parts: 4 };
  const base: Question = { gen: "t", title: "", answer: { kind: "point", value: F(3, 4), line }, hint: [{ text: "x" }], steps: [{ text: "x" }] };
  it("la banderita en el lugar justo es correcta", () => {
    expect(check(base, { ...emptyDraft(), parts: 4, pt: F(3, 4) }, null).correct).toBe(true);
  });
  it("una rayita antes o del lado equivocado tienen su explicación", () => {
    expect(check(base, { ...emptyDraft(), parts: 4, pt: F(2, 4) }, null).diagnosis).toMatch(/rayita/);
    const neg: Question = { ...base, answer: { kind: "point", value: F(-3, 4), line: { min: -1, max: 1, parts: 4 } } };
    expect(check(neg, { ...emptyDraft(), parts: 4, pt: F(3, 4) }, null).diagnosis).toMatch(/lado/);
  });
  it("si eligió mal las divisiones, se lo dice", () => {
    const q: Question = { ...base, answer: { kind: "point", value: F(2, 3), line: { min: 0, max: 1, parts: 1 }, pickParts: true } };
    expect(check(q, { ...emptyDraft(), parts: 4, pt: F(3, 4) }, null).diagnosis).toMatch(/partes/);
    expect(check(q, { ...emptyDraft(), parts: 6, pt: F(4, 6) }, null).correct).toBe(true);
  });
  const sci: Question = { gen: "t", title: "", answer: { kind: "sci", m: F(45, 10), e: 7 }, hint: [{ text: "x" }], steps: [{ text: "x" }] };
  const sd = (text: string, exp: number) => ({ ...emptyDraft(), text, exp: String(Math.abs(exp)), expNeg: exp < 0 });
  it("notación científica: bien escrita, mal normalizada, signo y lugares", () => {
    expect(check(sci, sd("4,5", 7), null).correct).toBe(true);
    expect(check(sci, sd("4,50", 7), null).correct).toBe(true);
    const v = check(sci, sd("45", 6), null);
    expect(v.correct).toBe(false);
    expect(v.diagnosis).toMatch(/entre 1 y 10|mayor o igual que 1/);
    expect(check(sci, sd("0,45", 8), null).diagnosis).toMatch(/menor que 1/);
    expect(check(sci, sd("4,5", -7), null).diagnosis).toMatch(/signo/);
    expect(check(sci, sd("4,5", 6), null).diagnosis).toMatch(/exponente/);
  });
  it("decimales exactos y con miles separados", () => {
    expect(fractionToDecimalString(F(1, 128))).toBe("0,0078125");
    expect(fractionToDecimalString(F(-32, 10 ** 7))).toBe("-0,0000032");
    expect(fractionToDecimalString(F(45 * 10 ** 6))).toBe("45000000");
    expect(decStr(F(45 * 10 ** 6))).toBe("45 000 000");
  });
});

describe("pizzas o chocolates", () => {
  it("las consignas con dibujos hablan de tabletas", async () => {
    const { withLook, chocoText } = await import("../src/look");
    expect(chocoText("¿Qué fracción de la pizza queda?")).toBe("¿Qué fracción de la tableta queda?");
    expect(chocoText("Todas las pizzas se cortaron en 8 porciones. La pizzería abrió.")).toBe("Todas las tabletas se dividieron en 8 porciones. La pizzería abrió.");
    for (const [id, g] of allGens) {
      if (!/^w[1-4]-/.test(id)) continue;
      for (let i = 0; i < 40; i++) {
          const q = withLook(g.make(makeRng(3 + i)), "choco");
          const txt = allText(q);
          expect(txt, `${g.id}: ${txt}`).not.toMatch(/\bpizzas?\b/i);
          validateQuestion(q, `${g.id} (chocolates)`);
      }
    }
  });
});
