import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MathView, RichText } from "../components/MathView";
import { Pizzas, OnePizza, LifeIcon } from "../components/Pizza";
import { TEXTS, findThemed, useLook, withLook } from "../look";
import { AnswerDisplay, Keypad, applyKey, slotsFor, type Slot } from "../components/AnswerPad";
import { NumberLine } from "../components/NumberLine";
import { PizarraPath, PizarraStage, type PzSummary } from "../components/Pizarra";
import { Steps } from "../components/Steps";
import { check, draftFor, validate, type Draft, type Verdict } from "../game/check";
import { buildQueue, signature, similar } from "../game/session";
import type { Question } from "../game/types";
import { makeRng } from "../math/rng";
import { dec, fr, mixedOf, N, toText } from "../math/expr";
import { F, type Fraction } from "../math/fraction";
import { decStr, sciExpr } from "../math/sci";
import { sfx } from "../sound";

export interface LevelResult {
  levelId: string;
  served: number;
  correct: number;
  wrong: number;
  coins: number;
  bestStreak: number;
  pizzas: number;
  lost: boolean;
}

const CUSTOMERS: [string, string][] = [
  ["Rosa", "👩‍🦳"],
  ["Tito", "🧔"],
  ["Lucía", "👩"],
  ["El Tano", "👨‍🦲"],
  ["Mirta", "👵"],
  ["Facu", "🧑"],
  ["Sol", "👧"],
  ["Don Carmelo", "👴"],
  ["Agus", "🧑‍🦱"],
  ["Nati", "👩‍🦰"],
  ["Rulo", "👨‍🦱"],
  ["Vale", "🧑‍🎓"],
  ["Pato", "👦"],
  ["Coco", "🧑‍🍳"],
];
const MAX_EXTRA = 3;

function CorrectAnswer({ q }: { q: Question }) {
  const a = q.answer;
  if (a.kind === "choice") {
    const o = a.options[a.correct];
    return (
      <span className="fb-answer-val">
        {o.label && <span className="fb-answer-label">{o.label}</span>}
        {o.math && <MathView e={o.math} size="md" />}
        {o.pizza && <OnePizza slices={o.pizza.slices} filled={o.pizza.filled} size={56} />}
      </span>
    );
  }
  const e =
    a.kind === "integer"
      ? N(a.value)
      : a.kind === "mixed"
        ? mixedOf(a.value)
        : a.kind === "decimal"
          ? dec(decStr(a.value))
          : a.kind === "sci"
            ? sciExpr(a.m, a.e)
            : fr(a.value);
  return (
    <span className="fb-answer-val">
      {q.answerPrefix && <span className="fb-answer-prefix">{q.answerPrefix}</span>}
      <MathView e={e} size="md" />
    </span>
  );
}

export function Play({ levelId, onExit, onFinish }: { levelId: string; onExit: () => void; onFinish: (r: LevelResult) => void }) {
  const look = useLook();
  const { level, world } = findThemed(levelId, look)!;
  const rng = useMemo(() => makeRng(), []);
  const isBoss = !!level.boss;
  const { good: GOOD, bad: BAD } = TEXTS[look];

  const [started, setStarted] = useState(!isBoss);
  const [queue, setQueue] = useState<Question[]>(() => buildQueue(level, rng).map((x) => withLook(x, look)));
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => draftFor(queue[0].answer));
  const [slot, setSlot] = useState<Slot>("num");
  const [choice, setChoice] = useState<number | null>(null);
  const [phase, setPhase] = useState<"answer" | "feedback">("answer");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [lives, setLives] = useState(level.boss?.lives ?? 0);
  const [extra, setExtra] = useState(0);
  const [requeued, setRequeued] = useState(false);
  const [earned, setEarned] = useState(0);
  const stats = useRef({ correct: 0, wrong: 0, helped: 0, coins: 0, streak: 0, best: 0 });
  // Ecuaciones: mesa de trabajo paso a paso, salvo que el jugador elija escribir el resultado directo.
  const [direct, setDirect] = useState(false);
  const [boardSummary, setPzSummary] = useState<PzSummary | null>(null);
  const [coins, setCoins] = useState(0);
  const [streak, setStreak] = useState(0);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const ticketRef = useRef<HTMLDivElement>(null);

  const q = queue[idx];
  const boardMode = !!q?.pizarra && !direct;
  // Las segundas partes de un problema siguen siendo del mismo cliente.
  const followUps = useRef(new WeakSet<Question>());
  const offset = useMemo(() => Math.floor(Math.random() * CUSTOMERS.length), []);
  const order = useMemo(() => queue.slice(0, idx + 1).filter((x) => !followUps.current.has(x)).length - 1, [queue, idx]);
  const customer = CUSTOMERS[(order * 5 + offset) % CUSTOMERS.length];
  const table = 1 + ((order * 7 + offset) % 20);
  const goodWord = GOOD[(idx + coins) % GOOD.length];
  const badWord = BAD[idx % BAD.length];

  const resetInput = useCallback((next: Question) => {
    setDraft(draftFor(next.answer));
    setChoice(null);
    setSlot(slotsFor(next.answer.kind)[0]);
    setWarn(null);
    setHint(false);
    setShowHow(false);
    setVerdict(null);
    setRequeued(false);
    setDirect(false);
    setPzSummary(null);
    setPhase("answer");
  }, []);

  useEffect(() => {
    if (q) setSlot(slotsFor(q.answer.kind)[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(() => {
    if (phase !== "answer" || !q) return;
    const w = validate(q.answer, draft, choice);
    if (w) {
      setWarn(w);
      return;
    }
    const v = check(q, draft, choice);
    setVerdict(v);
    setPhase("feedback");
    const s = stats.current;
    let newQueue = queue;
    if (q.followUp) {
      followUps.current.add(q.followUp);
      newQueue = [...queue.slice(0, idx + 1), q.followUp, ...queue.slice(idx + 1)];
    }
    if (v.correct) {
      s.correct++;
      s.streak++;
      s.best = Math.max(s.best, s.streak);
      const base = isBoss ? 20 : 10;
      const bonus = s.streak >= 5 ? 10 : s.streak >= 3 ? 5 : 0;
      const gained = Math.round((base + bonus) * (hint ? 0.5 : 1));
      s.coins += gained;
      setEarned(gained);
      setCoins(s.coins);
      if (s.streak === 3 || s.streak === 5 || s.streak === 10) sfx.streak();
      else sfx.correct();
      window.setTimeout(() => sfx.coin(), 260);
    } else {
      s.wrong++;
      s.streak = 0;
      setEarned(0);
      sfx.wrong();
      if (isBoss) setLives((l) => l - 1);
      else if (extra < MAX_EXTRA) {
        const avoid = new Set(newQueue.map(signature));
        const sim = similar(level, q.gen, rng, avoid);
        if (sim) {
          newQueue = [...newQueue, withLook(sim, look)];
          setExtra((x) => x + 1);
          setRequeued(true);
        }
      }
    }
    setStreak(s.streak);
    if (newQueue !== queue) setQueue(newQueue);
  }, [phase, q, draft, choice, queue, idx, isBoss, hint, extra, level, rng, look]);

  const finishBoard = useCallback(
    (sum: PzSummary) => {
      if (phase !== "answer" || !q) return;
      const s = stats.current;
      setPzSummary(sum);
      setVerdict({ correct: true, diagnosis: null, given: "" });
      setPhase("feedback");
      s.correct++;
      if (sum.slips === 0) s.streak++;
      else s.streak = 0;
      s.best = Math.max(s.best, s.streak);
      const base = isBoss ? 20 : 10;
      const bonus = s.streak >= 5 ? 10 : s.streak >= 3 ? 5 : 0;
      const gained = Math.max(2, Math.round((base + bonus) * (hint ? 0.5 : 1)) - 3 * sum.slips);
      s.coins += gained;
      setEarned(gained);
      setCoins(s.coins);
      // Con varios errores en el camino cuenta como "con ayuda" (y en el jefe cuesta una vida).
      if (sum.slips >= 2) {
        s.helped++;
        if (isBoss) setLives((l) => l - 1);
      }
      setStreak(s.streak);
      if (sum.slips === 0 && (s.streak === 3 || s.streak === 5 || s.streak === 10)) sfx.streak();
      else sfx.correct();
      window.setTimeout(() => sfx.coin(), 260);
    },
    [phase, q, isBoss, hint],
  );

  const finish = useCallback(
    (lost: boolean) => {
      const s = stats.current;
      const served = s.correct + s.wrong;
      let pizzas = 0;
      if (!lost) {
        if (isBoss) pizzas = Math.max(1, lives);
        else {
          const errs = s.wrong + s.helped;
          pizzas = errs <= 1 ? 3 : errs <= 3 ? 2 : 1;
        }
      }
      onFinish({ levelId, served, correct: s.correct, wrong: s.wrong, coins: s.coins, bestStreak: s.best, pizzas, lost });
    },
    [isBoss, lives, levelId, onFinish],
  );

  const next = useCallback(() => {
    if (phase !== "feedback") return;
    if (isBoss && lives <= 0) return finish(true);
    if (idx + 1 >= queue.length) return finish(false);
    const nq = queue[idx + 1];
    setIdx(idx + 1);
    resetInput(nq);
    ticketRef.current?.scrollTo({ top: 0 });
  }, [phase, isBoss, lives, idx, queue, finish, resetInput]);

  // Recta: poner la banderita, moverla de a una rayita y cambiar las divisiones.
  const pick = useCallback(
    (v: Fraction) => {
      if (phase !== "answer" || (draft.pt && draft.pt.equals(v))) return;
      sfx.tap();
      setDraft({ ...draft, pt: v });
      setWarn(null);
    },
    [phase, draft],
  );
  const nudge = useCallback(
    (dir: 1 | -1) => {
      if (phase !== "answer" || !q || q.answer.kind !== "point") return;
      const { min, max } = q.answer.line;
      const p = draft.parts;
      const start = min <= 0 && max >= 0 ? F(0) : F(min);
      let v = draft.pt ? draft.pt.add(F(dir, p)) : start;
      if (v.compare(F(min)) < 0) v = F(min);
      if (v.compare(F(max)) > 0) v = F(max);
      pick(v);
    },
    [phase, q, draft, pick],
  );
  const setParts = useCallback(
    (p: number) => {
      if (phase !== "answer" || !q || q.answer.kind !== "point") return;
      const parts = Math.max(1, Math.min(12, p));
      if (parts === draft.parts) return;
      sfx.tap();
      // La banderita se queda en la rayita nueva más cercana.
      const pt = draft.pt ? F(Math.round(draft.pt.value() * parts), parts) : null;
      setDraft({ ...draft, parts, pt });
      setWarn(null);
    },
    [phase, q, draft],
  );

  const onKey = useCallback(
    (k: string) => {
      if (phase !== "answer" || !q || q.answer.kind === "choice" || q.answer.kind === "point") return;
      const res = applyKey(q.answer.kind, draft, slot, k);
      setDraft(res.draft);
      setSlot(res.slot);
      setWarn(null);
    },
    [phase, q, draft, slot],
  );

  // Teclado físico
  useEffect(() => {
    const h = (ev: KeyboardEvent) => {
      if (!started) {
        if (ev.key === "Enter") setStarted(true);
        return;
      }
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      // La mesa de ecuaciones maneja su propio teclado.
      if (boardMode && phase === "answer") return;
      if (ev.key === "Enter") {
        ev.preventDefault();
        if (phase === "answer") submit();
        else next();
        return;
      }
      if (phase !== "answer" || !q) return;
      if (q.answer.kind === "point") {
        const act: Record<string, () => void> = {
          ArrowLeft: () => nudge(-1),
          ArrowRight: () => nudge(1),
          "+": () => setParts(draft.parts + 1),
          "-": () => setParts(draft.parts - 1),
        };
        if (act[ev.key] && (q.answer.pickParts || ev.key.startsWith("Arrow"))) {
          ev.preventDefault();
          act[ev.key]();
        }
        return;
      }
      if (q.answer.kind === "choice") {
        const n = Number(ev.key);
        if (n >= 1 && n <= q.answer.options.length) {
          setChoice(n - 1);
          setWarn(null);
        }
        return;
      }
      const map: Record<string, string> = { Backspace: "⌫", "-": "±", "/": "next", "^": "next", Tab: "next", ArrowDown: "next", ArrowRight: "next", ArrowUp: "prev", ArrowLeft: "prev", ",": ",", ".": "," };
      const key = /^\d$/.test(ev.key) ? ev.key : map[ev.key];
      if (key) {
        ev.preventDefault();
        onKey(key);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [started, phase, q, submit, next, onKey, boardMode, nudge, setParts, draft.parts]);

  useEffect(() => {
    if (phase === "feedback") feedbackRef.current?.focus();
  }, [phase]);

  // Solo en desarrollo: deja el ejercicio actual a mano para las pruebas automáticas.
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __q?: Question }).__q = q;
  }, [q]);

  if (!started && level.boss) {
    return (
      <div className="screen boss-intro">
        <button type="button" className="icon-btn exit" onClick={onExit} aria-label="Volver al mapa">
          ✕
        </button>
        <div className="boss-card">
          <div className="boss-emoji" aria-hidden="true">
            {level.boss.emoji}
          </div>
          <p className="boss-kicker">Jefe de {world.place}</p>
          <h1 className="sign sign-md">{level.boss.name}</h1>
          <blockquote className="boss-line">“{level.boss.line}”</blockquote>
          <p className="boss-rules">
            {level.count} comandas difíciles. Tenés {level.boss.lives} vidas: cada error te saca una.
          </p>
          <button type="button" className="btn btn-primary btn-big" onClick={() => setStarted(true)}>
            ¡A cocinar!
          </button>
        </div>
      </div>
    );
  }

  if (!q) return null;
  const kind = q.answer.kind;
  const total = queue.length;
  const progress = (idx + (phase === "feedback" ? 1 : 0)) / total;

  const ticketHead = (
    <>
      <div className="ticket-head">
        <span className="ticket-customer">
          <span className="ticket-avatar" aria-hidden="true">
            {isBoss ? level.boss!.emoji : customer[1]}
          </span>
          <span>
            <span className="ticket-name">{isBoss ? level.boss!.name : customer[0]}</span>
            <span className="ticket-table">{isBoss ? "Mesa VIP" : `Mesa ${table}`}</span>
          </span>
        </span>
        {phase === "answer" && !hint && (
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setHint(true)}>
            Pista
          </button>
        )}
      </div>
      {q.story && !(boardMode && q.gen.startsWith("w8")) && (
        <p className="ticket-story">
          <RichText text={q.story} />
        </p>
      )}
      <h2 className="ticket-title">
        {boardMode ? (q.pizarra!.kind === "calc" ? "Resolvelo por partes" : q.title === "Despejá x" ? "Despejá x por partes" : q.title) : q.title}
      </h2>
    </>
  );

  return (
    <div className={`screen play${isBoss ? " is-boss" : ""}`}>
      <header className="play-top">
        <button type="button" className="icon-btn" onClick={onExit} aria-label="Salir al mapa">
          ✕
        </button>
        <div className="play-title">
          <span className="play-place">{world.place}</span>
          <span className="play-level">{isBoss ? level.boss!.name : `${level.id.replace("-", ".")} · ${level.name}`}</span>
        </div>
        {isBoss && (
          <div className="lives" aria-label={`${lives} vidas`}>
            {Array.from({ length: level.boss!.lives }, (_, i) => (
              <span key={i} className={`life${i < lives ? "" : " is-lost"}`} aria-hidden="true">
                <LifeIcon />
              </span>
            ))}
          </div>
        )}
        <div className="coins" aria-label={`Propinas: ${coins} pesos`}>
          <span className="coin" aria-hidden="true">$</span>
          {coins}
        </div>
      </header>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={idx + 1} aria-label={`Comanda ${idx + 1} de ${total}`}>
        <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
        <span className="progress-text">
          Comanda {idx + 1} de {total}
        </span>
        {streak >= 3 && <span className="streak">Racha ×{streak}</span>}
      </div>

      {boardMode ? (
        <PizarraStage
          key={idx}
          spec={q.pizarra!}
          header={ticketHead}
          hintOn={hint}
          disabled={phase !== "answer"}
          ticketRef={ticketRef}
          onSolved={finishBoard}
          onDirect={() => {
            setDirect(true);
            setSlot("num");
          }}
        />
      ) : (
        <>
          <main className="ticket-wrap" ref={ticketRef}>
            <article className="ticket" key={idx}>
              {ticketHead}
              {q.math && (
                <div className={`ticket-math${q.answer.kind === "point" || q.line ? " is-tight" : ""}`}>
                  <MathView e={q.math} size={q.answer.kind === "point" || q.line ? "md" : "lg"} />
                </div>
              )}
              {q.pizzas && (
                <div className="ticket-pizzas">
                  {q.pizzas.map((p, i) => (
                    <Pizzas key={i} spec={p} size={q.pizzas!.length > 1 ? 96 : 120} />
                  ))}
                </div>
              )}
              {q.line && (
                <div className="ticket-line">
                  <NumberLine spec={q.line} />
                </div>
              )}
              {hint && phase === "answer" && (
                <div className="hint" role="note">
                  <strong>Pista:</strong>{" "}
                  {q.hint.map((h, i) => (
                    <span key={i}>
                      {h.text && <RichText text={h.text} />}
                      {h.math && <MathView e={h.math} size="sm" />}
                    </span>
                  ))}
                  <span className="hint-cost"> (esta comanda da la mitad de propina)</span>
                </div>
              )}

              {q.answer.kind === "point" ? (
                <div className="line-answer">
                  {q.answer.pickParts && (
                    <div className="nl-parts" role="group" aria-label="Divisiones de cada entero">
                      <span>Dividí cada entero en</span>
                      <span className="nl-parts-ctl">
                        <button type="button" className="nl-step" onClick={() => setParts(draft.parts - 1)} disabled={phase !== "answer" || draft.parts <= 1} aria-label="Menos partes">
                          −
                        </button>
                        <span className="nl-parts-n" aria-live="polite">
                          {draft.parts}
                        </span>
                        <button type="button" className="nl-step" onClick={() => setParts(draft.parts + 1)} disabled={phase !== "answer" || draft.parts >= 12} aria-label="Más partes">
                          +
                        </button>
                      </span>
                      <span>{draft.parts === 1 ? "parte" : "partes"}</span>
                    </div>
                  )}
                  <NumberLine spec={q.answer.line} parts={draft.parts} pin={draft.pt} onPick={phase === "answer" ? pick : undefined} />
                  {!draft.pt && phase === "answer" && <p className="nl-help">Tocá la recta o arrastrá la banderita. Las flechas la mueven de a una rayita.</p>}
                </div>
              ) : kind === "choice" ? (
                <div
                  className={`choices${q.answer.kind === "choice" && q.answer.options.some((o) => o.pizza) ? " has-pizzas" : ""}${
                    q.answer.kind === "choice" && q.answer.options.some((o) => (o.math ? toText(o.math).length > 14 : (o.label ?? "").length > 22)) ? " is-wide" : ""
                  }${q.answer.kind === "choice" && q.answer.options.every((o) => !o.math && !o.pizza && (o.label ?? "").length === 1) ? " is-letters" : ""}`}
                  role="radiogroup"
                  aria-label="Opciones"
                >
                  {q.answer.kind === "choice" &&
                    q.answer.options.map((o, i) => {
                      const state =
                        phase === "feedback" && q.answer.kind === "choice"
                          ? i === q.answer.correct
                            ? " is-right"
                            : i === choice
                              ? " is-wrong"
                              : ""
                          : choice === i
                            ? " is-picked"
                            : "";
                      return (
                        <button
                          key={i}
                          type="button"
                          role="radio"
                          aria-checked={choice === i}
                          className={`choice${state}`}
                          onClick={() => {
                            if (phase !== "answer") return;
                            sfx.tap();
                            setChoice(i);
                            setWarn(null);
                          }}
                        >
                          {o.label && <span className={`choice-label${o.label.length <= 2 ? " choice-sym" : ""}`}>{o.label}</span>}
                          {o.math && <MathView e={o.math} size="md" />}
                          {o.pizza && <OnePizza slices={o.pizza.slices} filled={o.pizza.filled} size={84} />}
                        </button>
                      );
                    })}
                </div>
              ) : (
                <AnswerDisplay kind={kind} draft={draft} slot={slot} setSlot={setSlot} prefix={q.answerPrefix} />
              )}
              {warn && (
                <p className="warn" role="alert">
                  {warn}
                </p>
              )}
              {q.pizarra && direct && phase === "answer" && (
                <button type="button" className="btn btn-ghost btn-small back-to-board" onClick={() => setDirect(false)}>
                  Mejor resolverlo paso a paso
                </button>
              )}
            </article>
          </main>

          <footer className="play-bottom">
            {kind === "point" ? (
              <div className="line-controls">
                <button type="button" className="key key-fn" onClick={() => nudge(-1)} disabled={phase !== "answer"} aria-label="Mover la banderita a la izquierda">
                  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                    <path d="M15 5l-7 7 7 7" className="ico-line" />
                  </svg>
                </button>
                <button type="button" className="key key-fn" onClick={() => nudge(1)} disabled={phase !== "answer"} aria-label="Mover la banderita a la derecha">
                  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                    <path d="M9 5l7 7-7 7" className="ico-line" />
                  </svg>
                </button>
                <button type="button" className="key key-go" onClick={submit} disabled={phase !== "answer"}>
                  Servir
                </button>
              </div>
            ) : kind === "choice" ? (
              <button type="button" className="btn btn-primary btn-big btn-block" onClick={submit} disabled={phase !== "answer"}>
                Servir
              </button>
            ) : (
              <Keypad
                kind={kind}
                slot={slot}
                onKey={(k) => {
                  sfx.tap();
                  onKey(k);
                }}
                onSubmit={submit}
                submitLabel="Servir"
                disabled={phase !== "answer"}
              />
            )}
          </footer>
        </>
      )}

      {phase === "feedback" && verdict && (
        <div className="sheet-backdrop">
          <div className={`sheet feedback ${verdict.correct ? "is-good" : "is-bad"}`} role="dialog" aria-modal="true" aria-labelledby="fb-title" tabIndex={-1} ref={feedbackRef}>
            <div className="sheet-scroll">
              <div className="fb-head">
                <span className="fb-icon" aria-hidden="true">
                  {verdict.correct ? <OnePizza slices={8} filled={8} size={52} /> : <span className="burnt"><OnePizza slices={8} filled={8} size={52} /></span>}
                </span>
                <div>
                  <h2 id="fb-title" className="fb-title">
                    {verdict.correct ? (boardSummary && boardSummary.slips > 0 ? "¡Despejada!" : goodWord) : badWord}
                  </h2>
                  {boardSummary ? (
                    <p className="fb-sub">
                      +${earned} de propina
                      {boardSummary.slips > 0
                        ? ` · ${boardSummary.slips === 1 ? "1 error" : `${boardSummary.slips} errores`} en el camino`
                        : streak >= 3
                          ? ` · racha de ${streak}`
                          : ""}
                      {isBoss && boardSummary.slips >= 2 ? `. Perdiste una vida: ${lives === 1 ? "te queda 1" : `te quedan ${lives}`}.` : ""}
                    </p>
                  ) : verdict.correct ? (
                    <p className="fb-sub">
                      +${earned} de propina{streak >= 3 ? ` · racha de ${streak}` : ""}
                    </p>
                  ) : (
                    <p className="fb-sub">
                      {isBoss ? (lives > 0 ? `Te ${lives === 1 ? "queda 1 vida" : `quedan ${lives} vidas`}.` : "Te quedaste sin vidas.") : "No pasa nada: mirá qué pasó y seguimos."}
                    </p>
                  )}
                </div>
              </div>

              {!verdict.correct && (
                <>
                  <div className="fb-answer">
                    <span className="fb-answer-key">La respuesta era</span>
                    <CorrectAnswer q={q} />
                  </div>
                  {q.answer.kind === "point" && (
                    <div className="fb-line">
                      <NumberLine
                        spec={q.answer.line}
                        parts={draft.parts}
                        extra={[{ value: q.answer.value, tone: "ok" }, ...(draft.pt ? [{ value: draft.pt, tone: "bad" as const }] : [])]}
                        label="La banderita verde es la respuesta; la roja, la tuya"
                      />
                      <p className="fb-line-key">
                        <span className="fb-key-ok">verde</span>: dónde iba · <span className="fb-key-bad">roja</span>: dónde la pusiste
                      </p>
                    </div>
                  )}
                  <div className="fb-diagnosis">
                    <h3>Qué pasó</h3>
                    <p>
                      {verdict.diagnosis ? (
                        <RichText text={verdict.diagnosis} />
                      ) : (
                        <RichText text={`Esta vez no salió${verdict.given ? ` (pusiste ${verdict.given})` : ""}. Seguí la receta paso a paso:`} />
                      )}
                    </p>
                  </div>
                </>
              )}
              {verdict.correct && verdict.note && (
                <p className="fb-note">
                  <RichText text={verdict.note} />
                </p>
              )}

              {boardSummary ? (
                <>
                  <div className="fb-how">
                    <h3>Tus pasos</h3>
                    <PizarraPath history={boardSummary.history} />
                  </div>
                  {boardSummary.mistakes.length > 0 && (
                    <div className="fb-diagnosis">
                      <h3>Para repasar</h3>
                      <ul className="fb-mistakes">
                        {boardSummary.mistakes
                          .filter((m, i, all) => all.findIndex((o) => o.text === m.text) === i)
                          .slice(0, 3)
                          .map((m, i) => (
                            <li key={i}>
                              {m.math && (
                                <>
                                  <span className="fb-mistake-math">
                                    En la cuenta <MathView e={m.math} size="sm" />
                                  </span>
                                  {": "}
                                </>
                              )}
                              <RichText text={m.text} />
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                  {q.rule && (
                    <p className="fb-rule">
                      <strong>Para recordar:</strong> {q.rule}
                    </p>
                  )}
                </>
              ) : verdict.correct ? (
                <details className="fb-how" open={showHow} onToggle={(e) => setShowHow((e.target as HTMLDetailsElement).open)}>
                  <summary>Ver cómo se hace</summary>
                  <Steps steps={q.steps} />
                </details>
              ) : (
                <div className="fb-how">
                  <h3>Cómo se hace</h3>
                  <Steps steps={q.steps} />
                </div>
              )}
              {!verdict.correct && q.rule && (
                <p className="fb-rule">
                  <strong>Para recordar:</strong> {q.rule}
                </p>
              )}
              {requeued && <p className="fb-requeue">Más adelante te va a tocar una comanda parecida, para practicar.</p>}
            </div>
            <button type="button" className="btn btn-primary btn-big btn-block" onClick={next}>
              {isBoss && lives <= 0 ? "Ver resultado" : idx + 1 >= queue.length ? "Terminar el turno" : q.followUp ? "Seguir con el problema" : "Siguiente comanda"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
