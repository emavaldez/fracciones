import type { PizzaSpec } from "../game/types";

const TAU = Math.PI * 2;

function wedge(cx: number, cy: number, r: number, a0: number, a1: number) {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`;
}

/** Una pizza cortada en `slices` porciones, con `filled` porciones presentes. */
export function OnePizza({ slices, filled, size = 120, label }: { slices: number; filled: number; size?: number; label?: string }) {
  const c = 50;
  const R = 46;
  const step = TAU / slices;
  const start = -Math.PI / 2;
  const items = [];
  for (let i = 0; i < slices; i++) {
    const a0 = start + i * step;
    const a1 = a0 + step;
    const mid = (a0 + a1) / 2;
    if (i < filled) {
      const pr = slices <= 4 ? 4.6 : slices <= 8 ? 4 : 3.2;
      const px = c + R * 0.56 * Math.cos(mid);
      const py = c + R * 0.56 * Math.sin(mid);
      const bx = c + R * 0.32 * Math.cos(mid + step * 0.18);
      const by = c + R * 0.32 * Math.sin(mid + step * 0.18);
      items.push(
        <g key={i} className="pz-slice">
          <path d={wedge(c, c, R, a0, a1)} className="pz-crust" />
          <path d={wedge(c, c, R * 0.84, a0, a1)} className="pz-cheese" />
          <circle cx={px} cy={py} r={pr} className="pz-pep" />
          {slices <= 10 && <ellipse cx={bx} cy={by} rx={2.2} ry={1.2} transform={`rotate(${(mid * 180) / Math.PI + 30} ${bx} ${by})`} className="pz-basil" />}
        </g>,
      );
    } else {
      items.push(<path key={i} d={wedge(c, c, R, a0, a1)} className="pz-empty" />);
    }
  }
  const cuts = [];
  for (let i = 0; i < slices; i++) {
    const a = start + i * step;
    cuts.push(<line key={i} x1={c} y1={c} x2={c + R * Math.cos(a)} y2={c + R * Math.sin(a)} className="pz-cut" />);
  }
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="pz" role="img" aria-label={label ?? `Pizza cortada en ${slices} porciones; hay ${filled}`}>
      <circle cx={c} cy={c} r={49} className="pz-plate" />
      {items}
      {slices > 1 && cuts}
    </svg>
  );
}

/** Una o varias pizzas (si hay más porciones que las de una pizza). */
export function Pizzas({ spec, size = 120 }: { spec: PizzaSpec; size?: number }) {
  const count = Math.max(1, Math.ceil(spec.filled / spec.slices));
  const out = [];
  let left = spec.filled;
  for (let i = 0; i < count; i++) {
    const f = Math.min(spec.slices, left);
    left -= f;
    out.push(<OnePizza key={i} slices={spec.slices} filled={f} size={count > 2 ? size * 0.78 : size} />);
  }
  return (
    <div className="pz-group" role="img" aria-label={`${spec.filled} porciones de pizzas cortadas en ${spec.slices}`}>
      {out}
    </div>
  );
}

/** Una sola porción, dibujada en la misma posición que tendría dentro de la pizza. */
export function SingleSlice({ slices, index, size = 120 }: { slices: number; index: number; size?: number }) {
  const c = 50;
  const R = 46;
  const step = TAU / slices;
  const a0 = -Math.PI / 2 + index * step;
  const a1 = a0 + step;
  const mid = (a0 + a1) / 2;
  const px = c + R * 0.56 * Math.cos(mid);
  const py = c + R * 0.56 * Math.sin(mid);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="pz" aria-hidden="true">
      <path d={wedge(c, c, R, a0, a1)} className="pz-crust" />
      <path d={wedge(c, c, R * 0.84, a0, a1)} className="pz-cheese" />
      <circle cx={px} cy={py} r={4} className="pz-pep" />
    </svg>
  );
}
