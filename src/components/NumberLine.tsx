// Recta numérica en SVG: rayitas, números, banderitas y saltos.
// Si recibe `onPick`, se puede tocar o arrastrar para mover la banderita (siempre cae en una rayita).
import { useRef, useState, type ReactNode } from "react";
import { F, type Fraction } from "../math/fraction";
import type { LineMark, LineSpec } from "../game/types";

const W = 360;
const PAD = 26;
const Y = 66;

function ticksOf(spec: LineSpec, parts: number) {
  const out: { v: Fraction; k: number; whole: boolean }[] = [];
  const total = (spec.max - spec.min) * parts;
  for (let k = 0; k <= total; k++) {
    const v = F(spec.min * parts + k, parts);
    out.push({ v, k, whole: v.isInteger() });
  }
  return out;
}

function Label({ v, x }: { v: Fraction; x: number }) {
  if (v.isInteger()) {
    return (
      <text x={x} y={Y + 31} className="nl-num" textAnchor="middle">
        {v.n < 0 ? `−${-v.n}` : v.n}
      </text>
    );
  }
  const w = Math.max(String(Math.abs(v.n)).length, String(v.d).length) * 4.6 + 4;
  return (
    <g className="nl-frac">
      {v.n < 0 && (
        <text x={x - w - 4} y={Y + 37} className="nl-num-sm" textAnchor="middle">
          −
        </text>
      )}
      <text x={x} y={Y + 28} className="nl-num-sm" textAnchor="middle">
        {Math.abs(v.n)}
      </text>
      <line x1={x - w} y1={Y + 32.5} x2={x + w} y2={Y + 32.5} className="nl-bar" />
      <text x={x} y={Y + 46} className="nl-num-sm" textAnchor="middle">
        {v.d}
      </text>
    </g>
  );
}

function Pin({ x, tone, tag, lift = 0, dragging }: { x: number; tone: string; tag?: string; lift?: number; dragging?: boolean }) {
  return (
    <g className={`nl-pin nl-pin-${tone}${dragging ? " is-dragging" : ""}`} style={{ transform: `translate(${x}px, ${Y}px)` }}>
      {lift > 0 && <line x1={0} y1={-2} x2={0} y2={-lift - 1} className="nl-stick" />}
      <g transform={`translate(0 ${-lift})`}>
        <path d="M0 0 C-2.5 -7 -10 -13 -10 -21 A10 10 0 1 1 10 -21 C10 -13 2.5 -7 0 0 Z" className="nl-head" />
        {tag ? (
          <text x={0} y={-17} textAnchor="middle" className="nl-tag">
            {tag}
          </text>
        ) : (
          <circle cx={0} cy={-21} r={3.6} className="nl-dot" />
        )}
      </g>
    </g>
  );
}

export function NumberLine({
  spec,
  parts: partsOverride,
  pin,
  extra = [],
  onPick,
  label,
  className = "",
}: {
  spec: LineSpec;
  /** Divisiones por entero que se dibujan (si el jugador las eligió). */
  parts?: number;
  /** Banderita que mueve el jugador. */
  pin?: Fraction | null;
  /** Marcas además de las de la consigna (por ejemplo, la respuesta correcta). */
  extra?: LineMark[];
  onPick?: (v: Fraction) => void;
  label?: string;
  className?: string;
}) {
  const parts = partsOverride ?? spec.parts;
  const span = spec.max - spec.min;
  const x0 = PAD;
  const x1 = W - PAD;
  const unit = (x1 - x0) / span;
  const xOf = (v: Fraction) => x0 + (v.value() - spec.min) * unit;
  const ref = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(false);

  const labels = spec.labels ?? ticksOf(spec, 1).map((t) => t.v);
  const hasFracLabel = labels.some((v) => !v.isInteger());
  const H = Y + (hasFracLabel ? 54 : 40);
  const marks = [...(spec.marks ?? []), ...extra];
  const both = marks.some((m) => m.tone === "ok") && (marks.some((m) => m.tone === "bad") || !!pin);
  const liftFor = (m: LineMark) => (spec.hops ? 22 : m.tone === "ok" && both ? 24 : 0);

  const valueAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * W;
    const total = span * parts;
    const k = Math.min(total, Math.max(0, Math.round(((x - x0) / unit) * parts)));
    return F(spec.min * parts + k, parts);
  };

  const ticks = ticksOf(spec, parts);
  const hopEls: ReactNode[] = [];
  if (spec.hops) {
    const { from, step, count } = spec.hops;
    for (let i = 0; i < count; i++) {
      const a = from.add(step.mul(F(i)));
      const b = a.add(step);
      const xa = xOf(a);
      const xb = xOf(b);
      const w = Math.abs(xb - xa);
      const h = Math.min(15, w * 0.55);
      const mid = (xa + xb) / 2;
      hopEls.push(<path key={`h${i}`} d={`M${xa} ${Y - 3} Q${mid} ${Y - 3 - 2 * h} ${xb} ${Y - 3}`} className="nl-hop" />);
      if (w >= 13 && count > 1)
        hopEls.push(
          <text key={`t${i}`} x={mid} y={Y - h - 7} textAnchor="middle" className="nl-hop-n">
            {i + 1}
          </text>,
        );
    }
  }

  const interactive = !!onPick;
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      className={`nl${interactive ? " is-interactive" : ""}${className ? ` ${className}` : ""}`}
      role={interactive ? "group" : "img"}
      aria-label={label ?? (interactive ? "Recta numérica: tocala o arrastrá la banderita" : "Recta numérica")}
      onPointerDown={
        interactive
          ? (e) => {
              e.preventDefault();
              (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
              drag.current = true;
              setDragging(true);
              onPick!(valueAt(e.clientX));
            }
          : undefined
      }
      onPointerMove={interactive ? (e) => drag.current && onPick!(valueAt(e.clientX)) : undefined}
      onPointerUp={interactive ? () => ((drag.current = false), setDragging(false)) : undefined}
      onPointerCancel={interactive ? () => ((drag.current = false), setDragging(false)) : undefined}
    >
      {interactive && <rect x={0} y={0} width={W} height={H} className="nl-hit" />}
      <line x1={x0 - 16} y1={Y} x2={x1 + 12} y2={Y} className="nl-axis" />
      <path d={`M${x1 + 19} ${Y} L${x1 + 9} ${Y - 5.5} L${x1 + 9} ${Y + 5.5} Z`} className="nl-arrow" />
      {spec.min < 0 && <path d={`M${x0 - 23} ${Y} L${x0 - 13} ${Y - 5.5} L${x0 - 13} ${Y + 5.5} Z`} className="nl-arrow" />}
      {ticks.map((t) => {
        const big = !spec.uniform && t.whole;
        const h = spec.uniform ? 8 : big ? 11 : 7;
        const on = pin && pin.equals(t.v);
        return <line key={t.k} x1={xOf(t.v)} y1={Y - h} x2={xOf(t.v)} y2={Y + h} className={`nl-tick${big ? " is-whole" : ""}${on ? " is-on" : ""}`} />;
      })}
      {labels.map((v, i) => (
        <Label key={i} v={v} x={xOf(v)} />
      ))}
      {hopEls}
      {marks
        .filter((m) => m.tone === "dot")
        .map((m, i) => (
          <circle key={`d${i}`} cx={xOf(m.value)} cy={Y} r={5} className="nl-ref" />
        ))}
      {marks
        .filter((m) => m.tone !== "dot")
        .map((m, i) => (
          <Pin key={`m${i}`} x={xOf(m.value)} tone={m.tone ?? "ask"} tag={m.tag} lift={liftFor(m)} />
        ))}
      {pin && <Pin x={xOf(pin)} tone="pick" dragging={dragging} />}
    </svg>
  );
}
