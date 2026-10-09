import type { PizzaSpec } from "../game/types";
import { useLook } from "../look";

const TAU = Math.PI * 2;

function wedge(cx: number, cy: number, r: number, a0: number, a1: number) {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`;
}

// ---------------------------------------------------------------- chocolate

const GRID: Record<number, [number, number]> = {
  1: [1, 1],
  2: [1, 2],
  3: [1, 3],
  4: [2, 2],
  5: [1, 5],
  6: [2, 3],
  7: [1, 7],
  8: [2, 4],
  9: [3, 3],
  10: [2, 5],
  12: [3, 4],
  14: [2, 7],
  15: [3, 5],
  16: [4, 4],
};

/** Ubicación de cada cuadradito de una tableta de `n` cuadraditos, dentro de un cuadrado de 100×100. */
function chocoCells(n: number) {
  const [rows, cols] = GRID[n] ?? (n % 2 === 0 ? [2, n / 2] : [1, n]);
  const pad = 6;
  const gap = 2.4;
  const inner = 100 - 2 * pad;
  const cw = (inner - (cols - 1) * gap) / cols;
  const ch = Math.min((inner - (rows - 1) * gap) / rows, cw * 1.6);
  const w = cols * cw + (cols - 1) * gap;
  const h = rows * ch + (rows - 1) * gap;
  const x0 = (100 - w) / 2;
  const y0 = (100 - h) / 2;
  const cells = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    cells.push({ x: x0 + c * (cw + gap), y: y0 + r * (ch + gap), w: cw, h: ch });
  }
  return { cells, box: { x: x0, y: y0, w, h } };
}

function ChocoPiece({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const b = Math.min(w, h) * 0.16;
  return (
    <g className="ch-piece">
      <rect x={x} y={y} width={w} height={h} rx={1.6} className="ch-side" />
      <rect x={x + b} y={y + b} width={w - 2 * b} height={h - 2 * b} rx={1} className="ch-top" />
      <path d={`M${x + 1.2} ${y + h - 1.2} L${x + 1.2} ${y + 1.2} L${x + w - 1.2} ${y + 1.2}`} className="ch-shine" />
    </g>
  );
}

function OneChoco({ slices, filled, size, label }: { slices: number; filled: number; size: number; label?: string }) {
  const { cells, box } = chocoCells(slices);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="pz ch" role="img" aria-label={label ?? `Tableta de chocolate dividida en ${slices} porciones; hay ${filled}`}>
      <rect x={box.x - 4} y={box.y - 4} width={box.w + 8} height={box.h + 8} rx={4} className="ch-wrap" />
      {cells.map((c, i) => (i < filled ? <ChocoPiece key={i} {...c} /> : <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} rx={1.6} className="ch-empty" />))}
    </svg>
  );
}

// ---------------------------------------------------------------- pizza

/** Una pizza cortada en `slices` porciones (o una tableta de chocolate), con `filled` porciones presentes. */
export function OnePizza({ slices, filled, size = 120, label }: { slices: number; filled: number; size?: number; label?: string }) {
  const look = useLook();
  if (look === "choco") return <OneChoco slices={slices} filled={filled} size={size} label={label?.replace(/Pizza/g, "Tableta").replace(/pizza/g, "tableta")} />;
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
  const look = useLook();
  const count = Math.max(1, Math.ceil(spec.filled / spec.slices));
  const out = [];
  let left = spec.filled;
  for (let i = 0; i < count; i++) {
    const f = Math.min(spec.slices, left);
    left -= f;
    out.push(<OnePizza key={i} slices={spec.slices} filled={f} size={count > 2 ? size * 0.78 : size} />);
  }
  const what = look === "choco" ? "tabletas divididas" : "pizzas cortadas";
  return (
    <div className="pz-group" role="img" aria-label={`${spec.filled} porciones de ${what} en ${spec.slices}`}>
      {out}
    </div>
  );
}

/** Una sola porción, dibujada en la misma posición que tendría dentro de la pizza (o de la tableta). */
export function SingleSlice({ slices, index, size = 120 }: { slices: number; index: number; size?: number }) {
  const look = useLook();
  if (look === "choco") {
    const c = chocoCells(slices).cells[index];
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} className="pz ch" aria-hidden="true">
        <ChocoPiece {...c} />
      </svg>
    );
  }
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

/** Ícono chiquito para vidas y puntajes. */
export function PrizeIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  const look = useLook();
  if (look === "choco") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className={`prize ch ${className}`} aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="3" className="ch-wrap-dark" />
        {[
          [3.5, 3.5],
          [12.5, 3.5],
          [3.5, 12.5],
          [12.5, 12.5],
        ].map(([x, y], i) => (
          <ChocoPiece key={i} x={x} y={y} w={8} h={8} />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`prize ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="11" className="rt-crust" />
      <circle cx="12" cy="12" r="8.6" className="rt-cheese" />
      <circle cx="8.5" cy="9" r="1.9" className="rt-pep" />
      <circle cx="15" cy="10.5" r="1.9" className="rt-pep" />
      <circle cx="11" cy="15.5" r="1.9" className="rt-pep" />
    </svg>
  );
}

/** Una vida del jefe: una porción de pizza o un cuadradito de chocolate. */
export function LifeIcon() {
  const look = useLook();
  if (look === "choco") {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" className="ch">
        <ChocoPiece x={3} y={3} w={18} h={18} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22">
      <path d="M12 2 L22 20 Q12 24 2 20 Z" className="life-crust" />
      <path d="M12 6 L19 19 Q12 22 5 19 Z" className="life-cheese" />
      <circle cx="12" cy="15" r="2.2" className="life-pep" />
    </svg>
  );
}
