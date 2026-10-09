import { describe, expect, it } from "vitest";
import { F, fractionToDecimalString, gcd } from "../src/math/fraction";
import { toText } from "../src/math/expr";
import { makeRng } from "../src/math/rng";
import { check, emptyDraft, type Draft } from "../src/game/check";
import { WORLDS } from "../src/game/worlds";
import { RECIPES } from "../src/game/recipes";
import { buildQueue } from "../src/game/session";
import type { GenEntry, Question } from "../src/game/types";
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
  if (a.kind === "fraction" || a.kind === "mixed" || a.kind === "decimal") {
    expect(a.value.d, ctx).toBeLessThanOrEqual(1000);
    expect(Math.abs(a.value.n), ctx).toBeLessThanOrEqual(99999);
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
  if (a.kind !== "choice") {
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
