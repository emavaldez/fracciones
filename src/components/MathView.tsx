import type { ReactNode } from "react";
import { isNegativeAtom, needsBaseParens, toText, type Expr } from "../math/expr";

const OP_SYMBOL: Record<string, string> = { "+": "+", "-": "−", "·": "·", ":": ":", "=": "=", "≠": "≠", "<": "<", ">": ">", "→": "→", "⇒": "⇒" };
const ARITH = new Set(["+", "-", "·", ":"]);

function minus(n: number) {
  return n < 0 ? `−${Math.abs(n)}` : `${n}`;
}

function Frac({ n, d }: { n: ReactNode; d: ReactNode }) {
  return (
    <span className="m-frac">
      <span className="m-fn">{n}</span>
      <span className="m-fd">{d}</span>
    </span>
  );
}

function Fence({ kind, children }: { kind: "(" | "["; children: ReactNode }) {
  const left = kind === "(" ? "M8 1 Q0 50 8 99" : "M9 1 H3 V99 H9";
  const right = kind === "(" ? "M2 1 Q10 50 2 99" : "M1 1 H7 V99 H1";
  return (
    <span className="m-fence">
      <span className="m-fence-l" aria-hidden="true">
        <svg viewBox="0 0 10 100" preserveAspectRatio="none">
          <path d={left} />
        </svg>
      </span>
      <span className="m-fence-body">{children}</span>
      <span className="m-fence-r" aria-hidden="true">
        <svg viewBox="0 0 10 100" preserveAspectRatio="none">
          <path d={right} />
        </svg>
      </span>
    </span>
  );
}

function Node({ e }: { e: Expr }): ReactNode {
  switch (e.t) {
    case "num":
      if (e.d === 1) return <span className="m-n">{minus(e.n)}</span>;
      return (
        <span className="m-signed">
          {e.n < 0 && <span className="m-sign">−</span>}
          <Frac n={<span className="m-n">{Math.abs(e.n)}</span>} d={<span className="m-n">{e.d}</span>} />
        </span>
      );
    case "frac":
      return <Frac n={<Node e={e.n} />} d={<Node e={e.d} />} />;
    case "dec":
      return <span className="m-n">{e.s.replace("-", "−")}</span>;
    case "per":
      return (
        <span className="m-n">
          {e.neg && "−"}
          {e.int},{e.ante}
          <span className="m-period">{e.period}</span>
        </span>
      );
    case "mixed":
      return (
        <span className="m-signed">
          {e.neg && <span className="m-sign">−</span>}
          <span className="m-n m-whole">{e.w}</span>
          <Frac n={<span className="m-n">{e.n}</span>} d={<span className="m-n">{e.d}</span>} />
        </span>
      );
    case "var":
      return <span className="m-var">{e.name}</span>;
    case "row":
      return (
        <span className="m-row">
          {e.parts.map((p, i) => {
            if ("op" in p) {
              return (
                <span key={i} className={`m-op${p.op === "=" || p.op === "≠" || p.op === "⇒" ? " m-eq" : ""}`}>
                  {OP_SYMBOL[p.op] ?? p.op}
                </span>
              );
            }
            const prev = e.parts[i - 1];
            const wrap = prev && "op" in prev && ARITH.has(prev.op) && isNegativeAtom(p);
            return wrap ? (
              <Fence key={i} kind="(">
                <Node e={p} />
              </Fence>
            ) : (
              <Node key={i} e={p} />
            );
          })}
        </span>
      );
    case "paren":
      return (
        <Fence kind={e.kind}>
          <Node e={e.x} />
        </Fence>
      );
    case "pow": {
      const base = needsBaseParens(e.b) ? (
        <Fence kind="(">
          <Node e={e.b} />
        </Fence>
      ) : (
        <Node e={e.b} />
      );
      return (
        <span className="m-pow">
          {base}
          <span className="m-exp">
            <Node e={e.e} />
          </span>
        </span>
      );
    }
    case "root":
      return (
        <span className="m-root">
          {e.k !== 2 && <span className="m-idx">{e.k}</span>}
          <span className="m-root-sign" aria-hidden="true">
            <svg viewBox="0 0 12 100" preserveAspectRatio="none">
              <path d="M0 62 L3 56 L6.5 99 L12 1" />
            </svg>
          </span>
          <span className="m-rad">
            <Node e={e.x} />
          </span>
        </span>
      );
    case "coef":
      return (
        <span className="m-coef">
          <Node e={e.c} />
          <Node e={e.x} />
        </span>
      );
    case "neg":
      return (
        <span className="m-signed">
          <span className="m-sign">−</span>
          <Node e={e.x} />
        </span>
      );
    case "q":
      return <span className={`m-q${e.small ? " m-q-small" : ""}`}>?</span>;
    case "text":
      return <span className="m-text">{e.s}</span>;
    case "hl":
      return (
        <span className={`m-hl m-hl-${e.tone ?? "a"}`}>
          <Node e={e.x} />
        </span>
      );
  }
}

export function MathView({ e, size = "md", className = "" }: { e: Expr; size?: "xl" | "lg" | "md" | "sm"; className?: string }) {
  return (
    <span className={`m m-${size} ${className}`} role="math" aria-label={toText(e)}>
      <Node e={e} />
    </span>
  );
}

/** Texto con fracciones en línea: "Sumamos {3/4} y {1/2}". */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\{-?\d+\/\d+\})/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\{(-?\d+)\/(\d+)\}$/);
        if (!m) return <span key={i}>{p.replace(/(^|[\s(=,])-(?=\d)/g, "$1−")}</span>;
        const n = Number(m[1]);
        const d = Number(m[2]);
        return (
          <span key={i} className="m m-inline" role="math" aria-label={`${n}/${d}`}>
            <Node e={{ t: "num", n, d }} />
          </span>
        );
      })}
    </>
  );
}
