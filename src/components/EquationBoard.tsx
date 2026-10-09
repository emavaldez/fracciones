// Mesa de trabajo para despejar x paso a paso: se arrastran (o se tocan) los términos,
// se elige cómo llegan al otro lado y se hacen las cuentas con el teclado.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Fence, MathView, RichText } from "./MathView";
import { AnswerDisplay, Keypad, applyKey, type Slot } from "./AnswerPad";
import { Steps } from "./Steps";
import { check, emptyDraft, type Draft } from "../game/check";
import {
  actionsFor,
  blockedReason,
  choicesFor,
  eqExpr,
  execute,
  findTerm,
  finishJob,
  isSpecial,
  makeEq,
  solvedValue,
  suggest,
  termAbsExpr,
  termText,
  termsExpr,
  type Action,
  type ActionOption,
  type BEq,
  type BTerm,
  type BoardSpec,
  type ChoiceSet,
  type ComputeJob,
  type SideKey,
  type Target,
} from "../game/board";
import { F, type Fraction } from "../math/fraction";
import { X, fr, type Expr } from "../math/expr";
import { sfx } from "../sound";

export interface BoardEntry {
  eq: BEq;
  label: string;
}

export interface BoardMistake {
  text: string;
  /** La cuenta en la que se equivocó (si fue una cuenta). */
  math?: Expr;
}

export interface BoardSummary {
  value: Fraction;
  slips: number;
  mistakes: BoardMistake[];
  history: BoardEntry[];
}

type Phase =
  | { t: "idle" }
  | { t: "selected"; side: SideKey; target: Target }
  | { t: "choose"; action: Action; set: ChoiceSet; wrong: number[] }
  | { t: "compute"; job: ComputeJob; draft: Draft; slot: Slot; tries: number; error?: string; revealed: boolean }
  | { t: "solved"; value: Fraction };

interface Msg {
  text: string;
  tone: "info" | "bad";
}

interface DragState {
  side: SideKey;
  target: Target;
  mode: "term" | "coef";
  x0: number;
  y0: number;
  active: boolean;
}

const HELP = "Arrastrá un término al otro lado del =, o tocalo para ver qué podés hacer.";

function chipLabel(t: BTerm, first: boolean) {
  const sign = t.c.n < 0 ? "menos " : first ? "" : "más ";
  return sign + termText(t, false).replace(/\{(-?\d+)\/(\d+)\}/g, "$1/$2");
}

function TermBody({ t }: { t: BTerm }) {
  const a = t.c.abs();
  if (!t.x) return <MathView e={fr(a)} size="md" />;
  if (isSpecial(t)) {
    return (
      <span className="chip-coef" data-part="coef">
        <MathView e={termAbsExpr(t)} size="md" />
      </span>
    );
  }
  if (t.div) {
    return (
      <>
        <MathView e={X} size="md" />
        <span className="chip-coef" data-part="coef">
          <span className="chip-op">:</span>
          <MathView e={fr(t.div)} size="md" />
        </span>
      </>
    );
  }
  return (
    <>
      {!a.equals(F(1)) && (
        <span className="chip-coef" data-part="coef">
          <MathView e={fr(a)} size="md" />
        </span>
      )}
      <MathView e={X} size="md" />
    </>
  );
}

export function BoardStage({
  spec,
  header,
  hintOn,
  disabled,
  ticketRef,
  onSolved,
  onDirect,
}: {
  spec: BoardSpec;
  header: ReactNode;
  hintOn: boolean;
  disabled: boolean;
  ticketRef: RefObject<HTMLElement | null>;
  onSolved: (s: BoardSummary) => void;
  onDirect: () => void;
}) {
  const start = useMemo(() => makeEq(spec), [spec]);
  const [history, setHistory] = useState<BoardEntry[]>([{ eq: start, label: "" }]);
  const [phase, setPhase] = useState<Phase>({ t: "idle" });
  const [msg, setMsg] = useState<Msg | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [ghost, setGhost] = useState<{ x: number; y: number; expr: Expr; mode: "term" | "coef"; side: SideKey; target: Target } | null>(null);
  const slips = useRef(0);
  const mistakes = useRef<BoardMistake[]>([]);
  const drag = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const computeRef = useRef<HTMLDivElement>(null);
  const eqRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const eq = history[history.length - 1].eq;
  const shown = phase.t === "compute" ? phase.job.base : eq;
  const suggestion = useMemo(() => (hintOn && (phase.t === "idle" || phase.t === "selected") ? suggest(eq) : null), [hintOn, phase.t, eq]);

  const slip = useCallback((why: string, math?: Expr) => {
    slips.current++;
    mistakes.current.push({ text: why, math });
    sfx.wrong();
  }, []);

  const commit = useCallback(
    (next: BEq, label: string, note?: string) => {
      const before = new Set([...eq.L.terms, ...eq.R.terms].map((t) => t.id));
      setFresh(new Set([...next.L.terms, ...next.R.terms].map((t) => t.id).filter((id) => !before.has(id))));
      const h = [...history, { eq: next, label }];
      setHistory(h);
      setMsg(note ? { text: note, tone: "info" } : null);
      const v = solvedValue(next);
      if (v) {
        setPhase({ t: "solved", value: v });
        window.setTimeout(() => onSolved({ value: v, slips: slips.current, mistakes: mistakes.current, history: h }), 900);
      } else {
        setPhase({ t: "idle" });
      }
    },
    [eq, history, onSolved],
  );

  const run = useCallback(
    (a: Action) => {
      const out = execute(eq, a);
      if ("job" in out) {
        setPhase({ t: "compute", job: out.job, draft: emptyDraft(), slot: "num", tries: 0, revealed: false });
        setMsg(null);
      } else {
        sfx.tap();
        commit(out.eq, out.label);
      }
    },
    [eq, commit],
  );

  const startAction = useCallback(
    (a: Action) => {
      const why = blockedReason(eq, a);
      if (why) {
        setMsg({ text: why, tone: "info" });
        setPhase({ t: "idle" });
        return;
      }
      const set = choicesFor(eq, a);
      if (set) {
        setPhase({ t: "choose", action: a, set, wrong: [] });
        setMsg(null);
      } else run(a);
    },
    [eq, run],
  );

  const choose = useCallback(
    (i: number) => {
      if (phase.t !== "choose") return;
      const o = phase.set.options[i];
      if (!o || phase.wrong.includes(i)) return;
      if (o.correct) {
        run(phase.action);
      } else {
        slip(o.why ?? "");
        setPhase({ ...phase, wrong: [...phase.wrong, i] });
        setMsg({ text: o.why ?? "Probá de nuevo.", tone: "bad" });
      }
    },
    [phase, run, slip],
  );

  const submitCompute = useCallback(() => {
    if (phase.t !== "compute") return;
    const { job } = phase;
    if (phase.revealed) {
      commit(finishJob(job), job.label, job.note);
      return;
    }
    const d = phase.draft;
    if (d.num === "") {
      setPhase({ ...phase, error: "Escribí el resultado de la cuenta." });
      return;
    }
    if (d.den !== "" && Number(d.den) === 0) {
      setPhase({ ...phase, error: "El denominador no puede ser 0." });
      return;
    }
    const v = check({ gen: "", title: "", answer: { kind: "fraction", value: job.result }, traps: job.traps, hint: [], steps: [] }, d, null);
    if (v.correct) {
      sfx.coin();
      commit(finishJob(job), job.label, v.note ?? job.note);
      return;
    }
    const why = v.diagnosis ?? "No es eso. Revisá la cuenta.";
    slip(why, job.expr);
    const tries = phase.tries + 1;
    setPhase({ ...phase, tries, error: why, revealed: tries >= 2, draft: tries >= 2 ? phase.draft : emptyDraft(), slot: "num" });
  }, [phase, commit, slip]);

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
    setMsg(null);
    setFresh(new Set());
  }, [history]);

  const tap = useCallback(
    (side: SideKey, target: Target) => {
      if (suppressClick.current || disabled) return;
      if (phase.t !== "idle" && phase.t !== "selected") return;
      sfx.tap();
      if (phase.t === "selected" && phase.side === side && phase.target === target) {
        cancel();
        return;
      }
      setPhase({ t: "selected", side, target });
      setMsg(null);
    },
    [phase, disabled, cancel],
  );

  // ---------- Arrastrar ----------

  /**
   * Qué se mueve al arrastrar: no depende de dónde se apoye el dedo (en un celular
   * los términos son chicos), sino de lo que tiene sentido en ese momento.
   * Si la x está sola y el número que la multiplica puede pasar, pasa el número;
   * si no, pasa el término entero.
   */
  const dragMode = (side: SideKey, target: Target): "term" | "coef" => {
    if (target === "factor") return "coef";
    const t = findTerm(eq, side, target);
    if (!t || !t.x) return "term";
    if (isSpecial(t) || t.div) return "coef";
    if (t.c.equals(F(1))) return "term";
    return blockedReason(eq, { kind: "coef", from: side, id: t.id }) ? "term" : "coef";
  };

  const onChipPointerDown = (e: React.PointerEvent, side: SideKey, target: Target) => {
    if (disabled || (phase.t !== "idle" && phase.t !== "selected")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { side, target, mode: dragMode(side, target), x0: e.clientX, y0: e.clientY, active: false };
  };

  const ghostExpr = useCallback(
    (d: DragState): Expr => {
      if (d.target === "factor") return fr(eq[d.side].factor!);
      const t = findTerm(eq, d.side, d.target)!;
      if (d.mode === "coef") return t.div ? fr(t.div) : isSpecial(t) ? termAbsExpr(t) : fr(t.c);
      return termsExpr([t]);
    },
    [eq],
  );

  const drop = useCallback(
    (d: DragState, x: number, y: number) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const zone = el?.closest<HTMLElement>("[data-zone]");
      const chip = el?.closest<HTMLElement>("[data-chip]");
      const to = zone?.dataset.zone as SideKey | undefined;
      if (!to) {
        setMsg({ text: "Para pasarlo, soltalo del otro lado del =.", tone: "info" });
        return;
      }
      if (to !== d.side) {
        if (d.target === "factor") return startAction({ kind: "factor", from: d.side });
        const t = findTerm(eq, d.side, d.target)!;
        if (d.mode === "term") return startAction({ kind: "move", from: d.side, id: t.id });
        if (isSpecial(t)) return startAction({ kind: "special", from: d.side, id: t.id });
        if (t.div) return startAction({ kind: "divisor", from: d.side, id: t.id });
        return startAction({ kind: "coef", from: d.side, id: t.id });
      }
      // Mismo lado: soltado sobre otro término = juntar
      const otherId = chip ? Number(chip.dataset.chip) : NaN;
      if (d.mode === "term" && typeof d.target === "number" && Number.isFinite(otherId) && otherId !== d.target) {
        startAction({ kind: "combine", side: d.side, a: d.target, b: otherId });
      }
    },
    [eq, startAction],
  );

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (!d.active) {
        if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 8) return;
        // Mientras se arrastra no cambia nada más en pantalla, para que la ecuación no se mueva bajo el dedo.
        d.active = true;
      }
      setGhost({ x: e.clientX, y: e.clientY, expr: ghostExpr(d), mode: d.mode, side: d.side, target: d.target });
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (!d || !d.active) return;
      setGhost(null);
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
      drop(d, e.clientX, e.clientY);
    };
    const cancelDrag = () => {
      drag.current = null;
      setGhost(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancelDrag);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancelDrag);
    };
  }, [drop, ghostExpr]);

  // ---------- Teclado físico ----------

  useEffect(() => {
    const h = (ev: KeyboardEvent) => {
      if (disabled || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (ev.key === "Escape") {
        if (phase.t === "selected" || phase.t === "choose" || phase.t === "compute") cancel();
        return;
      }
      if (phase.t === "choose") {
        const n = Number(ev.key);
        if (n >= 1 && n <= phase.set.options.length) choose(n - 1);
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

  // Que la ecuación (y la cuenta, si hay) quede siempre a la vista.
  const computeError = phase.t === "compute" ? phase.error : undefined;
  useEffect(() => {
    if (phase.t === "compute") computeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    else eqRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [phase.t, history.length, computeError]);

  // Solo en desarrollo: estado a mano para las pruebas automáticas.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __board?: unknown }).__board = {
      phase: phase.t,
      suggestion: suggest(eq),
      correct: phase.t === "choose" ? phase.set.options.findIndex((o) => o.correct) : null,
      result: phase.t === "compute" ? { n: phase.job.result.n, d: phase.job.result.d } : null,
      steps: history.length,
    };
  }, [phase, eq, history]);

  // ---------- Dibujo ----------

  const total = shown.L.terms.length + shown.R.terms.length + (shown.L.factor ? 1 : 0) + (shown.R.factor ? 1 : 0);
  const pending = phase.t === "compute" ? phase.job : null;
  const dragging = !!ghost;
  const dragSide = ghost ? ghost.side : null;
  const dragTerm = ghost && typeof ghost.target === "number" ? findTerm(eq, ghost.side, ghost.target) : undefined;
  const combineIds = new Set<number>();
  if (ghost && dragTerm && ghost.mode === "term") {
    const s = eq[ghost.side];
    for (const u of s.terms) if (u.id !== dragTerm.id && ((!u.x && !dragTerm.x) || (u.x && dragTerm.x && !isSpecial(u) && !u.div && !isSpecial(dragTerm) && !dragTerm.div))) combineIds.add(u.id);
  }

  const renderChips = (side: SideKey, terms: BTerm[], inFactor: boolean) => {
    const out: ReactNode[] = [];
    let shownCount = 0;
    terms.forEach((t) => {
      if (pending && pending.side === side && pending.replace.includes(t.id)) {
        if (t.id !== pending.replace[0]) return;
        out.push(
          <span key={`p${t.id}`} className="chip chip-pending" aria-label="Cuenta pendiente">
            {shownCount > 0 && <span className="chip-sign">+</span>}
            <MathView e={pending.expr} size="md" />
          </span>,
        );
        shownCount++;
        return;
      }
      const first = shownCount === 0;
      const sel = (phase.t === "selected" && phase.side === side && phase.target === t.id) || (!!ghost && ghost.side === side && ghost.target === t.id);
      const hinted = suggestion && suggestion.side === side && suggestion.target === t.id;
      out.push(
        <button
          key={t.id}
          type="button"
          className={`chip${t.x ? " chip-x" : ""}${sel ? " is-selected" : ""}${hinted ? " is-hinted" : ""}${fresh.has(t.id) ? " is-fresh" : ""}${
            combineIds.has(t.id) ? " is-combine" : ""
          }${inFactor ? " is-inner" : ""}`}
          data-chip={t.id}
          onPointerDown={(e) => !pending && onChipPointerDown(e, side, t.id)}
          onClick={() => !pending && tap(side, t.id)}
          aria-pressed={sel}
          aria-label={chipLabel(t, first)}
          disabled={disabled}
        >
          {(!first || t.c.n < 0) && <span className="chip-sign">{t.c.n < 0 ? "−" : "+"}</span>}
          <TermBody t={t} />
        </button>,
      );
      shownCount++;
    });
    if (!out.length) out.push(<span key="zero" className="chip chip-zero">0</span>);
    return out;
  };

  const renderSide = (side: SideKey) => {
    const s = shown[side];
    const isDrop = dragging && dragSide !== null && dragSide !== side;
    if (s.factor) {
      const sel = phase.t === "selected" && phase.side === side && phase.target === "factor";
      const hinted = suggestion && suggestion.side === side && suggestion.target === "factor";
      return (
        <div className={`side${isDrop ? " is-drop" : ""}`} data-zone={side}>
          <button
            type="button"
            className={`chip chip-factor${sel ? " is-selected" : ""}${hinted ? " is-hinted" : ""}`}
            data-part="coef"
            onPointerDown={(e) => !pending && onChipPointerDown(e, side, "factor")}
            onClick={() => !pending && tap(side, "factor")}
            aria-pressed={sel}
            aria-label={`${termText({ id: 0, c: s.factor, x: false })} que multiplica al paréntesis`.replace(/\{(-?\d+)\/(\d+)\}/g, "$1/$2")}
            disabled={disabled}
          >
            <MathView e={fr(s.factor)} size="md" />
          </button>
          <span className="side-dot">·</span>
          <Fence kind="(">
            <span className="side-inner">{renderChips(side, s.terms, true)}</span>
          </Fence>
        </div>
      );
    }
    return (
      <div className={`side${isDrop ? " is-drop" : ""}`} data-zone={side}>
        {renderChips(side, s.terms, false)}
      </div>
    );
  };

  const lastLabel = history.length > 1 ? history[history.length - 1].label : "";
  const trail = history.slice(0, -1);

  // ---------- Controles (abajo) ----------

  let controls: ReactNode;
  if (phase.t === "compute") {
    controls = phase.revealed ? (
      <button type="button" className="btn btn-primary btn-big btn-block" onClick={submitCompute}>
        Seguir con la ecuación
      </button>
    ) : (
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
    );
  } else if (phase.t === "choose") {
    controls = (
      <div className="bc">
        <div className="bc-top">
          <p className="bc-question">
            <RichText text={phase.set.question} />
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
          {phase.set.options.map((o, i) => (
            <button key={i} type="button" className={`bc-option${phase.wrong.includes(i) ? " is-wrong" : ""}`} onClick={() => choose(i)} disabled={phase.wrong.includes(i) || disabled}>
              {o.math && <MathView e={o.math} size="md" />}
              <span className="bc-option-label">{o.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  } else if (phase.t === "selected") {
    const { options, note } = actionsFor(eq, phase.side, phase.target);
    const t = phase.target === "factor" ? null : findTerm(eq, phase.side, phase.target);
    controls = (
      <div className="bc">
        <div className="bc-top">
          <p className="bc-question">
            {t ? (
              <>
                ¿Qué hacés con <MathView e={termsExpr([t])} size="sm" />?
              </>
            ) : (
              "¿Qué hacés con el número de afuera del paréntesis?"
            )}
          </p>
          <button type="button" className="icon-btn bc-x" onClick={cancel} aria-label="Cancelar">
            ✕
          </button>
        </div>
        {msg && (
          <p className={`bc-msg is-${msg.tone}`} role="status">
            <RichText text={msg.text} />
          </p>
        )}
        {note && (
          <p className="bc-msg is-info" role="status">
            <RichText text={note} />
          </p>
        )}
        <div className="bc-actions">
          {options.map((o: ActionOption, i) => (
            <button key={i} type="button" className={`bc-action${o.primary ? " is-primary" : ""}`} onClick={() => startAction(o.action)}>
              <RichText text={o.label} />
            </button>
          ))}
        </div>
      </div>
    );
  } else if (phase.t === "solved") {
    controls = <p className="bc-done">¡Despejaste la x!</p>;
  } else {
    controls = (
      <div className="bc">
        {msg ? (
          <p className={`bc-msg is-${msg.tone}`} role="status">
            <RichText text={msg.text} />
          </p>
        ) : (
          <p className="bc-help">{HELP}</p>
        )}
        <div className="bc-row">
          <button type="button" className="btn btn-ghost bc-undo" onClick={undo} disabled={history.length < 2 || disabled}>
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
          <div className={`board${dragging ? " is-dragging" : ""}${total > 5 ? " is-crowded" : ""}`} ref={boardRef}>
            {trail.length > 0 && (
              <ol className="board-trail" aria-label="Pasos anteriores">
                {trail.slice(-3).map((h, i) => (
                  <li key={history.length - trail.slice(-3).length - 1 + i}>
                    <MathView e={eqExpr(h.eq)} size="sm" />
                  </li>
                ))}
              </ol>
            )}
            <div className={`board-eq${phase.t === "solved" ? " is-solved" : ""}`} ref={eqRef}>
              {renderSide("L")}
              <span className="board-eqsign" aria-hidden="true">
                =
              </span>
              {renderSide("R")}
            </div>
            {lastLabel && phase.t !== "compute" && (
              <p className="board-caption" aria-live="polite">
                <RichText text={lastLabel} />
              </p>
            )}
            {suggestion && (
              <p className="board-hint" role="note">
                <strong>Pista:</strong> <RichText text={suggestion.text} />
              </p>
            )}
            {phase.t === "compute" && (
              <div className="bc-compute" ref={computeRef}>
                <p className="bc-prompt">
                  <RichText text={phase.job.prompt} />
                </p>
                {phase.error && (
                  <p className="bc-error" role="alert">
                    <RichText text={phase.error} />
                    {!phase.revealed && phase.tries === 1 && <span className="bc-error-retry"> Probá de nuevo.</span>}
                  </p>
                )}
                <div className="bc-calc">
                  <MathView e={phase.job.expr} size="md" />
                  <span className="bc-eq">=</span>
                  {phase.revealed ? (
                    <MathView e={fr(phase.job.result)} size="md" />
                  ) : (
                    <AnswerDisplay kind="fraction" draft={phase.draft} slot={phase.slot} setSlot={(s) => setPhase({ ...phase, slot: s })} />
                  )}
                </div>
                {phase.revealed && (
                  <div className="bc-reveal">
                    <p>Así se hace la cuenta:</p>
                    <Steps steps={phase.job.steps} />
                  </div>
                )}
                {!phase.revealed && phase.draft.den === "" && phase.draft.num !== "" && (
                  <p className="bc-tip">Si da un número entero, dejá vacío el casillero de abajo.</p>
                )}
              </div>
            )}
          </div>
        </article>
      </main>
      <footer className="play-bottom board-controls">{controls}</footer>
      {ghost && (
        <div className={`drag-ghost${ghost.mode === "coef" ? " is-coef" : ""}`} style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">
          <MathView e={ghost.expr} size="md" />
        </div>
      )}
    </>
  );
}

/** Los pasos que hizo el jugador, para la devolución final. */
export function BoardPath({ history }: { history: BoardEntry[] }) {
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
            <MathView e={eqExpr(h.eq)} size="sm" />
          </span>
        </li>
      ))}
    </ol>
  );
}

