// Vuelca ejemplos de todos los generadores como texto (para revisión).
import { toText } from "../src/math/expr";
import { makeRng } from "../src/math/rng";
import { WORLDS } from "../src/game/worlds";
import { RECIPES } from "../src/game/recipes";
import type { Question } from "../src/game/types";

const out: string[] = [];
function dumpQ(q: Question, indent = "") {
  const a = q.answer;
  out.push(`${indent}CONSIGNA: ${q.title}`);
  if (q.story) out.push(`${indent}ENUNCIADO: ${q.story}`);
  if (q.math) out.push(`${indent}EXPRESIÓN: ${toText(q.math)}`);
  if (q.pizzas) out.push(`${indent}PIZZAS: ${JSON.stringify(q.pizzas)}`);
  if (a.kind === "choice") {
    a.options.forEach((o, i) => out.push(`${indent}  opción ${i + 1}${i === a.correct ? " (CORRECTA)" : ""}: ${o.label ?? ""}${o.math ? toText(o.math) : ""}${o.pizza ? ` pizza ${o.pizza.filled}/${o.pizza.slices}` : ""}${o.why ? `  → si la eligen: ${o.why}` : ""}`));
  } else {
    out.push(`${indent}RESPUESTA (${a.kind}${a.kind === "fraction" && a.mustSimplify ? ", hay que simplificar" : ""}): ${q.answerPrefix ?? ""} ${String(a.value)}`);
  }
  out.push(`${indent}PISTA: ${q.hint.map((h) => (h.text ?? "") + (h.math ? " " + toText(h.math) : "")).join(" | ")}`);
  q.steps.forEach((s, i) => out.push(`${indent}  paso ${i + 1}: ${s.text ?? ""}${s.math ? "   [" + toText(s.math) + "]" : ""}`));
  for (const t of q.traps ?? []) out.push(`${indent}  error típico si responde ${String(t.value)}: ${t.msg}`);
  if (q.rule) out.push(`${indent}PARA RECORDAR: ${q.rule}`);
  if (q.followUp) {
    out.push(`${indent}--- segunda parte ---`);
    dumpQ(q.followUp, indent + "    ");
  }
}

const seen = new Set<string>();
for (const w of WORLDS) {
  out.push(`\n################ ${w.place} — ${w.topic}`);
  out.push(`RECETA:`);
  for (const it of RECIPES[w.id]) out.push(`  - ${it.text}${it.math ? "   [" + toText(it.math) + "]" : ""}`);
  for (const l of w.levels) {
    out.push(`\n=== Nivel ${l.id} ${l.name}: ${l.about}${l.boss ? ` (jefe ${l.boss.name}: "${l.boss.line}")` : ""}`);
    for (const g of l.gens) {
      if (seen.has(g.id)) continue;
      seen.add(g.id);
      for (let i = 0; i < 4; i++) {
        out.push(`\n[${g.id} ejemplo ${i + 1}]`);
        dumpQ(g.make(makeRng(1000 + i * 31 + g.id.length)));
      }
    }
  }
}
console.log(out.join("\n"));
