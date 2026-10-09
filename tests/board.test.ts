import { describe, expect, it } from "vitest";
import { F, Fraction } from "../src/math/fraction";
import { toText } from "../src/math/expr";
import { makeRng } from "../src/math/rng";
import {
  actionsFor,
  blockedReason,
  choicesFor,
  eqExpr,
  execute,
  finishJob,
  holds,
  makeEq,
  solvedValue,
  suggest,
  type BEq,
  type SideKey,
} from "../src/game/board";
import { opApply } from "../src/game/opcheck";
import * as w8 from "../src/game/gen/w8";
import * as w9 from "../src/game/gen/w9";
import type { GenEntry, Question } from "../src/game/types";
import { findFalseEqualities } from "./evaluate";

const GENS: GenEntry[] = [w8.ecuacionUnPaso, w8.ecuacionDosPasos, w8.ecuacionDosMiembros, w8.ecuacionPotRaiz, w9.problemaEcuacion, w9.problemaEdades];

function boardQuestion(q: Question): Question {
  return q.board ? q : q.followUp!;
}

function xOf(q: Question): Fraction {
  if (q.answer.kind !== "fraction") throw new Error("se esperaba fracción");
  return q.answer.value;
}

/** Resuelve siguiendo las sugerencias, verificando cada paso. */
function solveBySuggestions(eq0: BEq, x: Fraction, ctx: string) {
  let eq = eq0;
  for (let step = 0; step < 14; step++) {
    const v = solvedValue(eq);
    if (v) {
      expect(v.equals(x), `${ctx}: terminó en x = ${v}`).toBe(true);
      return step;
    }
    const s = suggest(eq);
    expect(s, `${ctx}: sin sugerencia en ${toText(eqExpr(eq))}`).not.toBeNull();
    const a = s!.action;
    expect(blockedReason(eq, a), `${ctx}: la sugerencia está bloqueada (${toText(eqExpr(eq))})`).toBeNull();
    // La acción sugerida aparece en el menú del término sugerido
    const menu = actionsFor(eq, s!.side, s!.target).options.map((o) => o.action.kind);
    expect(menu, `${ctx}: el menú no ofrece ${a.kind}`).toContain(a.kind);
    const ch = choicesFor(eq, a);
    if (ch) {
      expect(ch.options.filter((o) => o.correct).length, `${ctx}: opciones`).toBe(1);
      for (const o of ch.options) if (!o.correct) expect(o.why, `${ctx}: opción sin explicación`).toBeTruthy();
    }
    const out = execute(eq, a);
    if ("job" in out) {
      const j = out.job;
      expect(j.steps.length).toBeGreaterThan(0);
      for (const st of j.steps) expect(findFalseEqualities(st.math), `${ctx}: pasos de la cuenta`).toEqual([]);
      for (const t of j.traps) expect((typeof t.value === "number" ? F(t.value) : t.value).equals(j.result), `${ctx}: trampa = resultado`).toBe(false);
      expect(j.result.d).toBeLessThanOrEqual(1000);
      eq = finishJob(j);
    } else {
      eq = out.eq;
    }
    expect(holds(eq, x), `${ctx}: la ecuación dejó de valer en ${toText(eqExpr(eq))}`).toBe(true);
    expect(toText(eqExpr(eq))).not.toMatch(/NaN|undefined/);
  }
  throw new Error(`${ctx}: no terminó: ${toText(eqExpr(eq))}`);
}

describe("mesa de ecuaciones", () => {
  for (const g of GENS) {
    it(`${g.id}: se resuelve siguiendo las pistas`, () => {
      const r = makeRng(99 + g.id.length);
      for (let i = 0; i < 400; i++) {
        const q = boardQuestion(g.make(r));
        expect(q.board, `${g.id} sin mesa`).toBeTruthy();
        const x = xOf(q);
        const eq = makeEq(q.board!);
        expect(holds(eq, x), `${g.id} #${i}: la ecuación inicial no vale para x = ${x}: ${toText(eqExpr(eq))}`).toBe(true);
        const steps = solveBySuggestions(eq, x, `${g.id} #${i} ${toText(eqExpr(eq))}`);
        expect(steps).toBeLessThanOrEqual(8);
      }
    });

    it(`${g.id}: cualquier movimiento permitido mantiene la ecuación`, () => {
      const r = makeRng(7 + g.id.length);
      for (let i = 0; i < 200; i++) {
        const q = boardQuestion(g.make(r));
        const x = xOf(q);
        let eq = makeEq(q.board!);
        for (let k = 0; k < 6; k++) {
          const all = (["L", "R"] as SideKey[]).flatMap((side) => [
            ...eq[side].terms.flatMap((t) => actionsFor(eq, side, t.id).options),
            ...(eq[side].factor ? actionsFor(eq, side, "factor").options : []),
          ]);
          const ok = all.filter((o) => !blockedReason(eq, o.action));
          if (!ok.length) break;
          const o = r.pick(ok);
          const out = execute(eq, o.action);
          eq = "job" in out ? finishJob(out.job) : out.eq;
          expect(holds(eq, x), `${g.id}: ${o.label} rompió la ecuación: ${toText(eqExpr(eq))}`).toBe(true);
          // y desde ahí todavía se puede terminar
        }
        if (!solvedValue(eq)) solveBySuggestions(eq, x, `${g.id} (desde un camino al azar)`);
      }
    });
  }

  it("las cuentas de juntar usan la operación correcta", () => {
    expect(opApply(F(3, 4), "-", F(11, 10)).equals(F(-7, 20))).toBe(true);
  });
});
