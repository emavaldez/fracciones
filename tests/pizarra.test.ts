import { describe, expect, it } from "vitest";
import { F, Fraction } from "../src/math/fraction";
import { toText } from "../src/math/expr";
import { makeRng } from "../src/math/rng";
import {
  analyze,
  applyDistribute,
  applyPass,
  applyResolve,
  ev,
  explainInvalid,
  hint,
  layout,
  pzExpr,
  solvedValue,
  startPass,
  startResolve,
  tn,
  tProd,
  tSum,
  tTerms,
  eqPz,
  type PzSpec,
} from "../src/game/pizarra";
import * as w7 from "../src/game/gen/w7";
import * as w8 from "../src/game/gen/w8";
import * as w9 from "../src/game/gen/w9";
import type { GenEntry, Question } from "../src/game/types";
import { findFalseEqualities } from "./evaluate";

const GENS: GenEntry[] = [
  w7.combSumaProducto,
  w7.combParentesis,
  w7.combPotRaiz,
  w7.combMixta,
  w7.combCorchetes,
  w8.ecuacionUnPaso,
  w8.ecuacionDosPasos,
  w8.ecuacionDosMiembros,
  w8.ecuacionPotRaiz,
  w9.problemaEcuacion,
  w9.problemaEdades,
];

const pzQ = (q: Question) => (q.pizarra ? q : q.followUp!);
const answerOf = (q: Question): Fraction => {
  if (q.answer.kind !== "fraction") throw new Error("fracción");
  return q.answer.value;
};

/** La cuenta sigue valiendo lo mismo / la ecuación sigue teniendo la misma solución. */
function holds(pz: PzSpec, x: Fraction): boolean {
  if (pz.kind === "calc") {
    const v = ev(pz.sides[0]);
    return !!v && v.equals(x);
  }
  const l = ev(pz.sides[0], x);
  const r = ev(pz.sides[1], x);
  return !!l && !!r && l.equals(r);
}

const show = (pz: PzSpec) => toText(pzExpr(pz));

function solveByHints(pz0: PzSpec, x: Fraction, ctx: string): number {
  let pz = pz0;
  for (let step = 0; step < 25; step++) {
    const v = solvedValue(pz);
    if (v) {
      expect(v.equals(x), `${ctx}: terminó en ${v}, esperaba ${x}`).toBe(true);
      return step;
    }
    const h = hint(pz);
    expect(h, `${ctx}: sin pista en ${show(pz)}`).not.toBeNull();
    const c = `${ctx} [${show(pz)}] pista "${h!.text}"`;
    if (h!.action === "resolver") {
      const r = startResolve(pz, h!.side, h!.i, h!.j);
      expect("calc" in r, `${c}: ${"msg" in r ? r.msg : ""}`).toBe(true);
      if (!("calc" in r)) throw new Error();
      expect(r.calc.sel.ok, `${c}: la pista marca un pedazo inválido`).toBe(true);
      for (const s of r.calc.steps) expect(findFalseEqualities(s.math), `${c}: pasos`).toEqual([]);
      for (const t of r.calc.traps) expect((typeof t.value === "number" ? F(t.value) : t.value).equals(r.calc.value)).toBe(false);
      pz = applyResolve(pz, r.calc);
    } else if (h!.action === "pasar") {
      const r = startPass(pz, h!.side, h!.i, h!.j);
      expect("move" in r, `${c}: ${"msg" in r ? r.msg : ""}`).toBe(true);
      if (!("move" in r)) throw new Error();
      expect(r.options.filter((o) => o.correct).length).toBe(1);
      for (const o of r.options) if (!o.correct) expect(o.why).toBeTruthy();
      pz = applyPass(pz, r.move).pz;
    } else {
      const r = applyDistribute(pz, h!.side, h!.i, h!.j);
      if ("msg" in r) throw new Error(`${c}: ${r.msg}`);
      pz = r.pz;
    }
    expect(holds(pz, x), `${c}: dejó de valer → ${show(pz)}`).toBe(true);
    expect(show(pz)).not.toMatch(/NaN|undefined/);
  }
  throw new Error(`${ctx}: no terminó: ${show(pz)}`);
}

describe("pizarra: se resuelve siguiendo las pistas", () => {
  for (const g of GENS) {
    it(g.id, () => {
      const r = makeRng(5 + g.id.length);
      for (let n = 0; n < 300; n++) {
        const q = pzQ(g.make(r));
        expect(q.pizarra, `${g.id} sin pizarra`).toBeTruthy();
        const x = answerOf(q);
        expect(holds(q.pizarra!, x), `${g.id}: la cuenta inicial no da ${x}: ${show(q.pizarra!)}`).toBe(true);
        solveByHints(q.pizarra!, x, `${g.id} #${n}`);
      }
    });
  }
});

describe("pizarra: todo pedazo que el juego acepta conserva la cuenta", () => {
  for (const g of GENS) {
    it(g.id, () => {
      const r = makeRng(77 + g.id.length);
      for (let n = 0; n < 60; n++) {
        const q = pzQ(g.make(r));
        const pz = q.pizarra!;
        const x = answerOf(q);
        pz.sides.forEach((side, s) => {
          const lay = layout(side);
          for (let i = 0; i < lay.toks.length; i++) {
            for (let j = i; j < lay.toks.length; j++) {
              const sel = analyze(side, lay, i, j);
              if (!sel.ok) expect(sel.reason.length).toBeGreaterThan(5);
              const res = startResolve(pz, s, i, j);
              if ("calc" in res) {
                if (res.calc.sel.ok) {
                  const next = applyResolve(pz, res.calc);
                  expect(holds(next, x), `${g.id}: resolver [${i},${j}] en ${show(pz)} → ${show(next)}`).toBe(true);
                } else {
                  const ex = explainInvalid(pz, res.calc, res.calc.value);
                  expect(ex.reason.length).toBeGreaterThan(5);
                }
              } else expect(res.msg.length).toBeGreaterThan(5);
              if (pz.kind === "eq") {
                const p = startPass(pz, s, i, j);
                if ("move" in p) {
                  const next = applyPass(pz, p.move).pz;
                  expect(holds(next, x), `${g.id}: pasar [${i},${j}] en ${show(pz)} → ${show(next)}`).toBe(true);
                } else expect(p.msg.length).toBeGreaterThan(5);
              }
              const d = applyDistribute(pz, s, i, j);
              if ("pz" in d) expect(holds(d.pz, x), `${g.id}: distributiva en ${show(pz)} → ${show(d.pz)}`).toBe(true);
            }
          }
        });
      }
    });
  }
});

describe("pizarra: casos de la carpeta", () => {
  const calc = (t: ReturnType<typeof tSum>): PzSpec => ({ kind: "calc", sides: [t] });

  it("2/3 + 1/4 · 2: no se puede juntar 2/3 + 1/4", () => {
    const pz = calc(tSum(tn(F(2, 3)), "+", tProd(tn(F(1, 4)), "·", tn(F(2)))));
    // fichas: 2/3 + 1/4 · 2 → 0 1 2 3 4
    const bad = startResolve(pz, 0, 0, 2);
    if (!("calc" in bad)) throw new Error("debería dejarla calcular");
    expect(bad.calc.sel.ok).toBe(false);
    expect(bad.calc.value.equals(F(11, 12))).toBe(true);
    const ex = explainInvalid(pz, bad.calc, F(11, 12));
    expect(ex.arith).toMatch(/bien hecha/);
    expect(ex.reason).toMatch(/multiplicaci/);
    expect(ex.demo).not.toBeNull();
    const good = startResolve(pz, 0, 2, 4);
    if (!("calc" in good)) throw new Error();
    expect(good.calc.sel.ok).toBe(true);
    expect(good.calc.value.equals(F(1, 2))).toBe(true);
  });

  it("1/2 − 1/3 + 1/4: el signo va con el número", () => {
    const pz = calc(tSum(tn(F(1, 2)), "-", tn(F(1, 3)), "+", tn(F(1, 4))));
    // fichas: 1/2 − 1/3 + 1/4 → 0 1 2 3 4
    const noSign = startResolve(pz, 0, 2, 4);
    if (!("calc" in noSign)) throw new Error();
    expect(noSign.calc.sel.ok).toBe(false);
    if (!noSign.calc.sel.ok) expect(noSign.calc.sel.reason).toMatch(/restando/);
    const withSign = startResolve(pz, 0, 1, 4);
    if (!("calc" in withSign)) throw new Error();
    expect(withSign.calc.sel.ok).toBe(true);
    expect(withSign.calc.value.equals(F(-1, 12))).toBe(true);
    const next = applyResolve(pz, withSign.calc);
    expect(ev(next.sides[0])!.equals(F(5, 12))).toBe(true);
  });

  it("a : b · c: no se puede hacer b · c primero", () => {
    const pz = calc(tProd(tn(F(1, 2)), ":", tn(F(3, 4)), "·", tn(F(2))));
    const r = startResolve(pz, 0, 2, 4);
    if (!("calc" in r)) throw new Error();
    expect(r.calc.sel.ok).toBe(false);
  });

  it("ecuación: el 2/3 de 2/3·x no se pasa mientras haya otros términos", () => {
    const pz = eqPz(tTerms({ x: F(2, 3) }, F(1, 4)), tn(F(5)));
    const lay = layout(pz.sides[0]);
    const twoThirds = lay.toks.findIndex((t) => t.kind === "num");
    const r = startPass(pz, 0, twoThirds, twoThirds);
    expect("msg" in r).toBe(true);
    const quarter = lay.toks.length - 1;
    const ok = startPass(pz, 0, quarter, quarter);
    expect("move" in ok).toBe(true);
  });
});
