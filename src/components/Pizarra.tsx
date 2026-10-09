// Pizarra: la cuenta (o la ecuación) se ve entera, como en la carpeta.
// Se marca un pedazo (arrastrando el dedo, o tocando dónde empieza y dónde termina)
// y se elige qué hacer: resolverlo, pasarlo al otro lado o aplicar la distributiva.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { MathView, RichText } from "./MathView";
import { AnswerDisplay, Keypad, applyKey, type Slot } from "./AnswerPad";
import { Steps } from "./Steps";
import { check, emptyDraft, type Draft } from "../game/check";
import * as P from "../game/pizarra";
import { F, type Fraction } from "../math/fraction";
import { fr, row, type Expr } from "../math/expr";
import { sfx } from "../sound";

export interface PzEntry {
  pz: P.PzSpec;
  label: string;
}
export interface PzMistake {
  text: string;
  math?: Expr;
}
export interface PzSummary {
  value: Fraction;
  slips: number;
  mistakes: PzMistake[];
  history: PzEntry[];
}

interface Mark {
  side: number;
  a: number;
  b: number;
}

type Phase =
  | { t: "idle" }
  | { t: "compute"; calc: P.Calc; draft: Draft; slot: Slot; tries: number; error?: string; revealed: boolean }
  | { t: "choose"; move: P.Move; question: string; options: P.ChoiceOpt[]; wrong: number[] }
  | { t: "solved"; value: Fraction };

interface Explain {
  arith: string;
  reason: string;
  demo: { before: Expr; after: Expr; v0: Fraction; v1: Fraction } | null;
  given: Fraction | null;
}

const lo = (m: Mark) => Math.min(m.a, m.b);
const hi = (m: Mark) => Math.max(m.a, m.b);

function ParenSvg({ side, br }: { side: "l" | "r"; br: string }) {
  const square = br === "[" || br === "]";
  const d = side === "l" ? (square ? "M9 1 H3 V99 H9" : "M8 1 Q0 50 8 99") : square ? "M1 1 H7 V99 H1" : "M2 1 Q10 50 2 99";
  return (
    <svg viewBox="0 0 10 100" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function PizarraStage({
  spec,
  header,
  hintOn,
  disabled,
  ticketRef,
  onSolved,
  onDirect,
}: {
  spec: P.PzSpec;
  header: ReactNode;
  hintOn: boolean;
  disabled: boolean;
  ticketRef: RefObject<HTMLElement | null>;
  onSolved: (s: PzSummary) => void;
  onDirect: () => void;
}) {
  const [history, setHistory] = useState<PzEntry[]>([{ pz: spec, label: "" }]);
  const [phase, setPhase] = useState<Phase>({ t: "idle" });
  const [mark, setMark] = useState<Mark | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "bad" } | null>(null);
  const [explain, setExplain] = useState<Explain | null>(null);
  const [fresh, setFresh] = useState(false);
  const slips = useRef(0);
  const mistakes = useRef<PzMistake[]>([]);
  const drag = useRef<{ side: number; start: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const workRef = useRef<HTMLDivElement>(null);
  const eqRef = useRef<HTMLDivElement>(null);

  const pz = history[history.length - 1].pz;
  const layouts = useMemo(() => pz.sides.map((s) => P.layout(s)), [pz]);
  const hint = useMemo(() => (hintOn && phase.t === "idle" ? P.hint(pz) : null), [hintOn, phase.t, pz]);

  const slip = useCallback((text: string, math?: Expr) => {
    slips.current++;
    mistakes.current.push({ text, math });
    sfx.wrong();
  }, []);

  const commit = useCallback(
    (next: P.PzSpec, label: string, note?: string) => {
      const h = [...history, { pz: next, label }];
      setHistory(h);
      setMark(null);
      setExplain(null);
      setFresh(true);
      window.setTimeout(() => setFresh(false), 700);
      setMsg(note ? { text: note, tone: "info" } : null);
      const v = P.solvedValue(next);
      if (v) {
        setPhase({ t: "solved", value: v });
        window.setTimeout(() => onSolved({ value: v, slips: slips.current, mistakes: mistakes.current, history: h }), 900);
      } else setPhase({ t: "idle" });
    },
    [history, onSolved],
  );

  const literal = useMemo(() => {
    if (!mark) return null;
    return P.parseToks(layouts[mark.side].toks.slice(lo(mark), hi(mark) + 1));
  }, [mark, layouts]);

  // ---------- Marcar ----------

  const tapTok = useCallback(
    (side: number, t: number) => {
      if (suppressClick.current || disabled || (phase.t !== "idle" && phase.t !== "choose")) return;
      if (phase.t === "choose") return;
      sfx.tap();
      setMsg(null);
      setExplain(null);
      setMark((m) => {
        if (!m || m.side !== side) return { side, a: t, b: t };
        if (m.a === m.b && m.a === t) return null;
        if (t >= lo(m) && t <= hi(m) && lo(m) !== hi(m)) return { side, a: t, b: t };
        return { side, a: m.a, b: t };
      });
    },
    [disabled, phase.t],
  );

  const onTokDown = (e: React.PointerEvent, side: number, t: number) => {
    if (disabled || phase.t !== "idle") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { side, start: t, moved: false };
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-tok]");
      if (!el || Number(el.dataset.side) !== d.side) return;
      const t = Number(el.dataset.tok);
      if (t === d.start && !d.moved) return;
      d.moved = true;
      setMark({ side: d.side, a: d.start, b: t });
      setMsg(null);
      setExplain(null);
    };
    const up = () => {
      const d = drag.current;
      drag.current = null;
      if (d?.moved) {
        suppressClick.current = true;
        window.setTimeout(() => (suppressClick.current = false), 0);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  // ---------- Acciones ----------

  const resolve = useCallback(() => {
    if (!mark) return;
    const r = P.startResolve(pz, mark.side, mark.a, mark.b);
    if ("msg" in r) {
      setMsg({ text: r.msg, tone: "info" });
      return;
    }
    setMsg(null);
    setPhase({ t: "compute", calc: r.calc, draft: emptyDraft(), slot: "num", tries: 0, revealed: false });
  }, [mark, pz]);

  const pass = useCallback(() => {
    if (!mark) return;
    const r = P.startPass(pz, mark.side, mark.a, mark.b);
    if ("msg" in r) {
      setMsg({ text: r.msg, tone: "info" });
      return;
    }
    setMsg(null);
    setPhase({ t: "choose", move: r.move, question: r.question, options: r.options, wrong: [] });
  }, [mark, pz]);

  const distribute = useCallback(() => {
    if (!mark) return;
    const r = P.applyDistribute(pz, mark.side, mark.a, mark.b);
    if ("msg" in r) {
      setMsg({ text: r.msg, tone: "info" });
      return;
    }
    sfx.tap();
    commit(r.pz, r.label);
  }, [mark, pz, commit]);

  const choose = useCallback(
    (i: number) => {
      if (phase.t !== "choose") return;
      const o = phase.options[i];
      if (!o || phase.wrong.includes(i)) return;
      if (o.correct) {
        sfx.tap();
        const r = P.applyPass(pz, phase.move);
        commit(r.pz, r.label);
      } else {
        slip(o.why ?? "");
        setPhase({ ...phase, wrong: [...phase.wrong, i] });
        setMsg({ text: o.why ?? "Probá de nuevo.", tone: "bad" });
      }
    },
    [phase, pz, commit, slip],
  );

  const submitCompute = useCallback(() => {
    if (phase.t !== "compute") return;
    const { calc } = phase;
    if (phase.revealed) {
      commit(P.applyResolve(pz, calc), `Resolviste ${P.tText(calc.lit)}.`);
      return;
    }
    const d = phase.draft;
    if (d.num === "") {
      setPhase({ ...phase, error: "Escribí cuánto da." });
      return;
    }
    if (d.den !== "" && Number(d.den) === 0) {
      setPhase({ ...phase, error: "El denominador no puede ser 0." });
      return;
    }
    const given = F((d.neg ? -1 : 1) * Number(d.num), d.den === "" ? 1 : Number(d.den));
    // El pedazo no se podía resolver solo: la dejamos calcular y después explicamos por qué.
    if (!calc.sel.ok) {
      const ex = P.explainInvalid(pz, calc, given);
      slip(ex.reason, P.toExpr(calc.lit));
      setExplain({ ...ex, given });
      setMark(null);
      setPhase({ t: "idle" });
      return;
    }
    const v = check({ gen: "", title: "", answer: { kind: "fraction", value: calc.value }, traps: calc.traps, hint: [], steps: [] }, d, null);
    if (v.correct) {
      sfx.coin();
      const res = calc.linear ? `${P.tText(calc.lit)} = ${P.tText(P.tCx(calc.value))}` : `${P.tText(calc.lit)} = ${P.tText(P.tn(calc.value))}`;
      commit(P.applyResolve(pz, calc), `Resolviste ${res}.`, v.note);
      return;
    }
    const why = v.diagnosis ?? "No es eso. Revisá la cuenta.";
    slip(why, P.toExpr(calc.lit));
    const tries = phase.tries + 1;
    setPhase({ ...phase, tries, error: why, revealed: tries >= 2, draft: tries >= 2 ? d : emptyDraft(), slot: "num" });
  }, [phase, pz, commit, slip]);

  const computeKey = useCallback(
    (k: string) => {
      if (phase.t !== "compute" || phase.revealed) return;
      const res = applyKey("fraction", phase.draft, phase.slot, k);
      setPhase({ ...phase, draft: res.draft, slot: res.slot, error: undefined });
    },
    [phase],
  );

  const cancel = useCallback(() => {
    setPhase({ t: "idle" });
    setMsg(null);
  }, []);

  const undo = useCallback(() => {
    if (history.length < 2) return;
    setHistory(history.slice(0, -1));
    setPhase({ t: "idle" });
    setMark(null);
    setMsg(null);
    setExplain(null);
  }, [history]);

  // ---------- Teclado físico ----------

  useEffect(() => {
    const h = (ev: KeyboardEvent) => {
      if (disabled || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (ev.key === "Escape") {
        if (phase.t === "choose" || phase.t === "compute") cancel();
        else setMark(null);
        return;
      }
      if (phase.t === "choose") {
        const n = Number(ev.key);
        if (n >= 1 && n <= phase.options.length) choose(n - 1);
        return;
      }
      if (phase.t !== "compute") return;
      if (ev.key === "Enter") {
        ev.preventDefault();
        submitCompute();
        return;
      }
      const map: Record<string, string> = { Backspace: "⌫", "-": "±", "/": "next", Tab: "next", ArrowDown: "next", ArrowUp: "prev" };
      const key = /^\d$/.test(ev.key) ? ev.key : map[ev.key];
      if (key) {
        ev.preventDefault();
        computeKey(key);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [disabled, phase, cancel, choose, submitCompute, computeKey]);

  // Que lo importante quede a la vista.
  const computeError = phase.t === "compute" ? phase.error : undefined;
  useEffect(() => {
    // Con la explicación, la cuenta arriba y la explicación debajo.
    if (explain) eqRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    else if (phase.t === "compute") workRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    else eqRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [phase.t, history.length, computeError, explain]);

  // Solo en desarrollo: estado para las pruebas automáticas.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __pz?: unknown }).__pz = {
      phase: phase.t,
      hint: P.hint(pz),
      mark,
      calc: phase.t === "compute" ? { n: phase.calc.value.n, d: phase.calc.value.d, linear: phase.calc.linear, ok: phase.calc.sel.ok } : null,
      correct: phase.t === "choose" ? phase.options.findIndex((o) => o.correct) : null,
      steps: history.length,
      explain: !!explain,
    };
  }, [phase, pz, mark, history, explain]);

  // ---------- Dibujo de la cuenta ----------

  const renderSide = (side: number) => {
    const lay = layouts[side];
    const m = mark && mark.side === side ? mark : null;
    const pending = phase.t === "compute" && phase.calc.side === side ? phase.calc : null;
    const hl = hint && hint.side === side ? hint : null;
    const tokClass = (i: number) => {
      const cls = ["tk"];
      const inMark = m && i >= lo(m) && i <= hi(m);
      const inPending = pending && i >= Math.min(pending.i, pending.j) && i <= Math.max(pending.i, pending.j);
      if (inMark || inPending) {
        cls.push("is-sel");
        const a = m ? lo(m) : Math.min(pending!.i, pending!.j);
        const b = m ? hi(m) : Math.max(pending!.i, pending!.j);
        if (i === a) cls.push("is-sel-a");
        if (i === b) cls.push("is-sel-b");
      }
      if (hl && i >= hl.i && i <= hl.j) cls.push("is-hint");
      return cls.join(" ");
    };
    // Función (no componente) para que los botones no se vuelvan a crear en cada dibujo.
    const tk = (tok: P.Tok, children: ReactNode, extra = "") => (
      <button
        key={tok.i}
        type="button"
        className={`${tokClass(tok.i)} tk-${tok.kind} ${extra}`}
        data-tok={tok.i}
        data-side={side}
        onPointerDown={(e) => onTokDown(e, side, tok.i)}
        onClick={() => tapTok(side, tok.i)}
        disabled={disabled}
        aria-label={tokLabel(tok)}
      >
        {children}
      </button>
    );
    const R = (n: P.RNode): ReactNode => {
      switch (n.r) {
        case "tok": {
          const t = n.tok;
          if (t.kind === "num") return tk(t, <MathView e={fr(t.v!)} size="md" />);
          if (t.kind === "x") return tk(t, <span className="tk-xv">x</span>);
          return tk(t, <span className="tk-opv">{t.op}</span>);
        }
        case "row":
          return n.c.map((c, k) => <span key={k} className="pz-cell">{R(c)}</span>);
        case "pow":
          return (
            <span className="pz-pow">
              <span className="pz-base">
                {n.autoPar && <span className="pz-deco"><ParenSvg side="l" br="(" /></span>}
                {R(n.base)}
                {n.autoPar && <span className="pz-deco"><ParenSvg side="r" br=")" /></span>}
              </span>
              {tk(n.exp, <span className="tk-expv">{n.exp.e}</span>)}
            </span>
          );
        case "root":
          return (
            <span className="pz-root">
              {tk(
                n.tok,
                <>
                  {n.tok.ri !== 2 && <span className="tk-rooti">{n.tok.ri}</span>}
                  <svg viewBox="0 0 12 100" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0 62 L3 56 L6.5 99 L12 1" />
                  </svg>
                </>,
                "tk-rootsign",
              )}
              <span className="pz-rad">{R(n.inner)}</span>
            </span>
          );
        case "par":
          return (
            <span className="pz-par">
              {tk(n.open, <ParenSvg side="l" br={n.open.br!} />, "tk-paren")}
              <span className="pz-in">{R(n.inner)}</span>
              {tk(n.close, <ParenSvg side="r" br={n.close.br!} />, "tk-paren")}
            </span>
          );
      }
    };
    return (
      <div className="pz-side" data-zone={side}>
        {R(lay.tree)}
      </div>
    );
  };

  const trail = history.slice(0, -1).slice(-3);
  const lastLabel = history.length > 1 ? history[history.length - 1].label : "";
  const isEq = pz.kind === "eq";
  const hasParen = mark ? layouts[mark.side].toks.slice(lo(mark), hi(mark) + 1).some((t) => t.kind === "open") : false;

  // ---------- Controles ----------

  let controls: ReactNode;
  if (phase.t === "compute") {
    controls = phase.revealed ? (
      <button type="button" className="btn btn-primary btn-big btn-block" onClick={submitCompute}>
        Seguir
      </button>
    ) : (
      <div className="bc">
        <div className="bc-row bc-row-top">
          <button type="button" className="btn btn-ghost btn-small bc-back" onClick={cancel}>
            Marcar otro pedazo
          </button>
        </div>
        <Keypad
          kind="fraction"
          slot={phase.slot}
          onKey={(k) => {
            sfx.tap();
            computeKey(k);
          }}
          onSubmit={submitCompute}
          submitLabel="Listo"
          disabled={disabled}
        />
      </div>
    );
  } else if (phase.t === "choose") {
    controls = (
      <div className="bc">
        <div className="bc-top">
          <p className="bc-question">
            <RichText text={phase.question} />
          </p>
          <button type="button" className="icon-btn bc-x" onClick={cancel} aria-label="Cancelar">
            ✕
          </button>
        </div>
        {msg && (
          <p className={`bc-msg is-${msg.tone}`} role="alert">
            <RichText text={msg.text} />
          </p>
        )}
        <div className="bc-options">
          {phase.options.map((o, i) => (
            <button key={i} type="button" className={`bc-option${phase.wrong.includes(i) ? " is-wrong" : ""}`} onClick={() => choose(i)} disabled={phase.wrong.includes(i) || disabled}>
              {o.math && <MathView e={o.math} size="md" />}
              <span className="bc-option-label">{o.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  } else if (phase.t === "solved") {
    controls = <p className="bc-done">{isEq ? "¡Despejaste la x!" : "¡Cuenta terminada!"}</p>;
  } else if (mark) {
    controls = (
      <div className="bc">
        <div className="bc-top">
          <p className="bc-question">
            Marcaste {literal ? <MathView e={P.toExpr(literal)} size="sm" /> : "un pedazo"}. ¿Qué hacés?
          </p>
          <button type="button" className="icon-btn bc-x" onClick={() => setMark(null)} aria-label="Desmarcar">
            ✕
          </button>
        </div>
        {msg && (
          <p className={`bc-msg is-${msg.tone}`} role="status">
            <RichText text={msg.text} />
          </p>
        )}
        <div className="bc-actions">
          <button type="button" className="bc-action is-primary" onClick={resolve}>
            Resolver: escribir cuánto da
          </button>
          {isEq && (
            <button type="button" className="bc-action" onClick={pass}>
              Pasar al otro lado del =
            </button>
          )}
          {hasParen && (
            <button type="button" className="bc-action" onClick={distribute}>
              Aplicar la distributiva
            </button>
          )}
        </div>
      </div>
    );
  } else {
    controls = (
      <div className="bc">
        {msg ? (
          <p className={`bc-msg is-${msg.tone}`} role="status">
            <RichText text={msg.text} />
          </p>
        ) : (
          <p className="bc-help">Marcá un pedazo: arrastrá el dedo, o tocá dónde empieza y dónde termina.</p>
        )}
        <div className="bc-row">
          <button type="button" className="btn btn-ghost" onClick={undo} disabled={history.length < 2 || disabled}>
            Deshacer
          </button>
          <button type="button" className="btn btn-ghost" onClick={onDirect} disabled={disabled}>
            Saltear pasos
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <main className="ticket-wrap" ref={ticketRef as RefObject<HTMLElement>}>
        <article className="ticket is-board">
          {header}
          <div className="board">
            {trail.length > 0 && (
              <ol className="board-trail" aria-label="Pasos anteriores">
                {trail.map((h, k) => (
                  <li key={history.length - trail.length - 1 + k}>
                    <MathView e={P.pzExpr(h.pz)} size="sm" />
                  </li>
                ))}
              </ol>
            )}
            <div className={`pz-eq${isEq ? " is-eq" : ""}${phase.t === "solved" ? " is-solved" : ""}${fresh ? " is-fresh" : ""}`} ref={eqRef}>
              {renderSide(0)}
              {isEq && (
                <>
                  <span className="pz-eqsign" aria-hidden="true">
                    =
                  </span>
                  {renderSide(1)}
                </>
              )}
            </div>
            {lastLabel && phase.t !== "compute" && !explain && (
              <p className="board-caption" aria-live="polite">
                <RichText text={lastLabel} />
              </p>
            )}
            {hint && !mark && (
              <p className="board-hint" role="note">
                <strong>Pista:</strong> <RichText text={hint.text} />
              </p>
            )}
            <div ref={workRef}>
              {phase.t === "compute" && (
                <div className="bc-compute">
                  <p className="bc-prompt">¿Cuánto da?</p>
                  {phase.error && (
                    <p className="bc-error" role="alert">
                      <RichText text={phase.error} />
                      {!phase.revealed && phase.tries === 1 && <span className="bc-error-retry"> Probá de nuevo.</span>}
                    </p>
                  )}
                  <div className="bc-calc">
                    <MathView e={P.toExpr(phase.calc.lit)} size="md" />
                    <span className="bc-eq">=</span>
                    {phase.revealed ? (
                      <MathView e={phase.calc.linear ? P.toExpr(P.tCx(phase.calc.value)) : fr(phase.calc.value)} size="md" />
                    ) : (
                      <>
                        <AnswerDisplay kind="fraction" draft={phase.draft} slot={phase.slot} setSlot={(s) => setPhase({ ...phase, slot: s })} />
                        {phase.calc.linear && <span className="bc-xsuffix">x</span>}
                      </>
                    )}
                  </div>
                  {phase.revealed && (
                    <div className="bc-reveal">
                      <p>Así se hace la cuenta:</p>
                      <Steps steps={phase.calc.steps} />
                    </div>
                  )}
                  {!phase.revealed && phase.draft.den === "" && phase.draft.num !== "" && <p className="bc-tip">Si da un número entero, dejá vacío el casillero de abajo.</p>}
                  {!phase.revealed && phase.calc.linear && <p className="bc-tip">Escribí el número que queda acompañando a la x.</p>}
                </div>
              )}
              {explain && (
                <div className="pz-explain" role="alert">
                  <p className="pz-explain-head">
                    <RichText text={explain.arith} />
                  </p>
                  <p>
                    <RichText text={explain.reason} />
                  </p>
                  {explain.demo && (
                    <div className="pz-demo">
                      <p>Mirá qué pasa si reemplazamos ese pedazo por lo que da:</p>
                      <div className="pz-demo-row">
                        <MathView e={row(explain.demo.after, "=", fr(explain.demo.v1))} size="sm" />
                      </div>
                      <p>Pero la cuenta original da otra cosa:</p>
                      <div className="pz-demo-row">
                        <MathView e={row(explain.demo.before, "=", fr(explain.demo.v0))} size="sm" />
                      </div>
                      <p>Por eso ese pedazo no se puede resolver solo.</p>
                    </div>
                  )}
                  <p className="pz-explain-next">Marcá otro pedazo para seguir.</p>
                </div>
              )}
            </div>
          </div>
        </article>
      </main>
      <footer className="play-bottom board-controls">{controls}</footer>
    </>
  );
}

function tokLabel(t: P.Tok): string {
  switch (t.kind) {
    case "num":
      return t.v!.d === 1 ? String(t.v!.n) : `${t.v!.n}/${t.v!.d}`;
    case "x":
      return "x";
    case "op":
      return t.op === "+" ? "más" : t.op === "−" ? "menos" : t.op === "·" ? "por" : "dividido";
    case "open":
      return "abre paréntesis";
    case "close":
      return "cierra paréntesis";
    case "root":
      return "raíz";
    case "exp":
      return `elevado a ${t.e}`;
  }
}

/** Los pasos que hizo el jugador, para la devolución final. */
export function PizarraPath({ history }: { history: PzEntry[] }) {
  return (
    <ol className="fb-path">
      {history.map((h, i) => (
        <li key={i}>
          {h.label && (
            <span className="fb-path-label">
              <RichText text={h.label} />
            </span>
          )}
          <span className="fb-path-eq">
            <MathView e={P.pzExpr(h.pz)} size="sm" />
          </span>
        </li>
      ))}
    </ol>
  );
}
