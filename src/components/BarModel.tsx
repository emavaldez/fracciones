// Modelo de barras: el total como una barra dividida en las partes de cada uno.
import type { BarSpec } from "../game/types";

const W = 360;
const X0 = 6;
const X1 = W - 6;
const BAR_H = 34;
const CH = 6.4; // ancho aproximado de un carácter (11 px)

export function BarModel({ spec }: { spec: BarSpec }) {
  const top = (spec.title ? 22 : 4) + (spec.brace ? 26 : 0);
  const xs: number[] = [X0];
  let acc = 0;
  for (const s of spec.segs) {
    acc += s.size.value();
    xs.push(X0 + acc * (X1 - X0));
  }
  // Nombres abajo; si no entran, bajan a una segunda fila.
  type Lab = { x: number; text: string; row: number; seg: number };
  const labs: Lab[] = [];
  const rowEnd = [-Infinity, -Infinity, -Infinity];
  spec.segs.forEach((s, i) => {
    const cx = (xs[i] + xs[i + 1]) / 2;
    const segW = xs[i + 1] - xs[i];
    const inside = !!s.note && segW >= s.note.length * CH + 8;
    const text = inside || !s.note ? s.label : `${s.label} · ${s.note}`;
    const half = (text.length * CH) / 2;
    const x = Math.min(Math.max(cx, X0 + half), X1 - half);
    let row = rowEnd.findIndex((end) => x - half > end + 6);
    if (row < 0) row = 2;
    rowEnd[row] = x + half;
    labs.push({ x, text, row, seg: i });
  });
  const rows = Math.max(...labs.map((l) => l.row)) + 1;
  const H = top + BAR_H + 8 + rows * 18;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="bm" role="img" aria-label={`${spec.title ? spec.title + ": " : ""}${spec.segs.map((s) => `${s.label}${s.note ? ` ${s.note}` : ""}`).join(", ")}`}>
      {spec.title && (
        <text x={X0} y={14} className="bm-title">
          {spec.title}
        </text>
      )}
      {spec.brace && (
        <g className="bm-brace">
          <path
            d={`M${xs[spec.brace.from] + 2} ${top - 4} q0 -7 7 -7 H${(xs[spec.brace.from] + xs[spec.brace.to + 1]) / 2 - 5} l5 -6 l5 6 H${xs[spec.brace.to + 1] - 9} q7 0 7 7`}
          />
          <text x={(xs[spec.brace.from] + xs[spec.brace.to + 1]) / 2} y={top - 20} textAnchor="middle" className="bm-brace-label">
            {spec.brace.label}
          </text>
        </g>
      )}
      {spec.segs.map((s, i) => (
        <rect key={i} x={xs[i]} y={top} width={Math.max(0, xs[i + 1] - xs[i])} height={BAR_H} className={s.muted ? "bm-seg bm-muted" : `bm-seg bm-t${(s.tone ?? i) % 5}`} />
      ))}
      <rect x={X0} y={top} width={X1 - X0} height={BAR_H} rx={4} className="bm-frame" />
      {spec.segs.map((s, i) => {
        const segW = xs[i + 1] - xs[i];
        return s.note && segW >= s.note.length * CH + 8 ? (
          <text key={i} x={(xs[i] + xs[i + 1]) / 2} y={top + BAR_H / 2 + 4} textAnchor="middle" className="bm-note">
            {s.note}
          </text>
        ) : null;
      })}
      {labs.map((l, i) => {
        const cx = (xs[l.seg] + xs[l.seg + 1]) / 2;
        const y = top + BAR_H + 15 + l.row * 18;
        return (
          <g key={i}>
            {(l.row > 0 || Math.abs(l.x - cx) > 2) && <line x1={cx} y1={top + BAR_H + 1} x2={l.x} y2={y - 11} className="bm-lead" />}
            <text x={l.x} y={y} textAnchor="middle" className="bm-label">
              {l.text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
