// Borrador: una hoja cuadriculada para hacer cuentas con el dedo, el lápiz o el mouse.
// Los trazos se guardan como líneas (no como imagen): así se pueden deshacer y redibujar si cambia el tamaño.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export interface Stroke {
  tool: "pen" | "eraser";
  color: string;
  w: number;
  pts: [number, number][];
}

const COLORS: [string, string][] = [
  ["Lápiz", "#2a2a33"],
  ["Azul", "#1d5fbf"],
  ["Rojo", "#d13b2c"],
];

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  ctx.globalCompositeOperation = s.tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const p = s.pts;
  if (p.length === 1) {
    ctx.beginPath();
    ctx.arc(p[0][0], p[0][1], s.w / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]);
  // Curvas suaves entre puntos medios.
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i][0] + p[i + 1][0]) / 2;
    const my = (p[i][1] + p[i + 1][1]) / 2;
    ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my);
  }
  const last = p[p.length - 1];
  ctx.lineTo(last[0], last[1]);
  ctx.stroke();
}

export function Scratchpad({
  strokes,
  setStrokes,
  onClose,
  header,
}: {
  strokes: Stroke[];
  setStrokes: (s: Stroke[]) => void;
  onClose: () => void;
  /** La consigna, para tenerla a la vista mientras se hacen las cuentas. */
  header?: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cur = useRef<Stroke | null>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState(COLORS[0][1]);
  const [history, setHistory] = useState<Stroke[][]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const s of strokes) drawStroke(ctx, s);
    if (cur.current) drawStroke(ctx, cur.current);
  }, [strokes]);

  useEffect(() => {
    redraw();
    const ro = new ResizeObserver(() => redraw());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [redraw]);

  useEffect(() => {
    closeRef.current?.focus();
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const point = (e: React.PointerEvent | PointerEvent): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    cur.current = { tool, color, w: tool === "pen" ? 2.6 : 26, pts: [point(e)] };
    redraw();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = cur.current;
    if (!s) return;
    const evs = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
    for (const ev of evs.length ? evs : [e.nativeEvent]) s.pts.push(point(ev));
    // Solo el tramo nuevo, para que vaya rápido.
    const ctx = canvasRef.current!.getContext("2d")!;
    const tail: Stroke = { ...s, pts: s.pts.slice(-Math.min(s.pts.length, evs.length + 3)) };
    drawStroke(ctx, tail);
  };
  const up = () => {
    const s = cur.current;
    if (!s) return;
    cur.current = null;
    setHistory((h) => [...h.slice(-30), strokes]);
    setStrokes([...strokes, s]);
  };

  const undo = () => {
    if (!history.length) return;
    setStrokes(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  };
  const clear = () => {
    if (!strokes.length) return;
    setHistory((h) => [...h.slice(-30), strokes]);
    setStrokes([]);
  };

  return (
    <div className="scratch" role="dialog" aria-modal="true" aria-label="Borrador">
      <div className="scratch-top">
        <span className="scratch-name">Borrador</span>
        <button type="button" className="btn btn-primary btn-small scratch-close" onClick={onClose} ref={closeRef} aria-label="Cerrar el borrador y volver a la comanda">
          Volver
        </button>
      </div>
      {header && <div className="scratch-q">{header}</div>}
      <div className="scratch-tools" role="toolbar" aria-label="Herramientas">
        {COLORS.map(([name, c]) => (
          <button
            key={c}
            type="button"
            className={`scratch-tool${tool === "pen" && color === c ? " is-on" : ""}`}
            onClick={() => {
              setTool("pen");
              setColor(c);
            }}
            aria-label={`Escribir con ${name.toLowerCase()}`}
            aria-pressed={tool === "pen" && color === c}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d="M4 20l1.2-4.6L15.8 4.8a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" fill={c} />
              <path d="M4 20l1.2-4.6 3.4 3.4z" fill="#f2d4a2" />
            </svg>
          </button>
        ))}
        <button type="button" className={`scratch-tool${tool === "eraser" ? " is-on" : ""}`} onClick={() => setTool("eraser")} aria-label="Goma" aria-pressed={tool === "eraser"}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M14.5 4.5l5 5-9 9H6l-2.5-2.5z" fill="#f4a3b4" stroke="#8a4b5a" strokeWidth="1.2" />
            <path d="M9 10l5 5" stroke="#8a4b5a" strokeWidth="1.2" />
          </svg>
        </button>
        <span className="scratch-sep" aria-hidden="true" />
        <button type="button" className="scratch-tool" onClick={undo} disabled={!history.length} aria-label="Deshacer">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M9 7H4V2M4 7a9 9 0 1 1-1.2 7" className="ico-line" />
          </svg>
        </button>
        <button type="button" className="scratch-tool scratch-new" onClick={clear} disabled={!strokes.length} aria-label="Hoja nueva (borrar todo)" title="Hoja nueva">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M6 3h8l4 4v14H6z" className="ico-line" />
            <path d="M14 3v4h4M12 11v6M9 14h6" className="ico-line" />
          </svg>
        </button>
      </div>
      <div className="scratch-paper" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className={`scratch-canvas${tool === "eraser" ? " is-eraser" : ""}`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
        {!strokes.length && <p className="scratch-empty">Hacé las cuentas acá, con el dedo o el mouse.</p>}
      </div>
    </div>
  );
}
