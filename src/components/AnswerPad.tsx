import type { Draft } from "../game/check";
import type { AnswerSpec, MultiItem } from "../game/types";
import { groupThousands } from "../math/sci";

export type Slot = "whole" | "num" | "den" | "text" | "exp" | `m${number}`;

/** Casilleros de cada tipo de respuesta (`n`: cuántos hay en una respuesta con varios números). */
export function slotsFor(kind: AnswerSpec["kind"], n = 0): Slot[] {
  if (kind === "multi") return Array.from({ length: n }, (_, i) => `m${i}` as Slot);
  if (kind === "fraction") return ["num", "den"];
  if (kind === "mixed") return ["whole", "num", "den"];
  if (kind === "sci") return ["text", "exp"];
  return ["text"];
}

/** Cuántas cifras entran en cada casillero. */
function maxDigits(kind: AnswerSpec["kind"], slot: Slot) {
  if (slot === "exp") return 2;
  if (kind === "sci") return 4;
  if (kind === "decimal") return 10;
  if (kind === "multi" || kind === "integer") return 7;
  return 5;
}

const multiIndex = (slot: Slot) => (slot.startsWith("m") ? Number(slot.slice(1)) : -1);

function applyMultiKey(d: Draft, slot: Slot, key: string): { draft: Draft; slot: Slot } {
  const slots = slotsFor("multi", d.multi.length);
  const i = Math.max(0, multiIndex(slot));
  const cur = d.multi[i] ?? "";
  const set = (v: string) => ({ ...d, multi: d.multi.map((x, k) => (k === i ? v : x)) });
  if (key === "next") return { draft: d, slot: slots[(i + 1) % slots.length] };
  if (key === "prev") return { draft: d, slot: slots[(i - 1 + slots.length) % slots.length] };
  if (key === "⌫") {
    if (cur === "" && i > 0) return { draft: d, slot: slots[i - 1] };
    return { draft: set(cur.slice(0, -1)), slot };
  }
  if (key === ",") return cur.includes(",") ? { draft: d, slot } : { draft: set((cur === "" ? "0" : cur) + ","), slot };
  if (/^\d$/.test(key)) {
    if (cur.replace(",", "").length >= maxDigits("multi", slot)) return { draft: d, slot };
    return { draft: set(cur === "0" ? key : cur + key), slot };
  }
  return { draft: d, slot };
}

/** Aplica una tecla al borrador. Devuelve el nuevo borrador y el casillero activo. */
export function applyKey(kind: AnswerSpec["kind"], d: Draft, slot: Slot, key: string): { draft: Draft; slot: Slot } {
  if (kind === "multi") return applyMultiKey(d, slot, key);
  if (slot.startsWith("m")) return { draft: d, slot };
  const s = slot as "whole" | "num" | "den" | "text" | "exp";
  const slots = slotsFor(kind);
  // En notación científica el signo es del exponente (el primer número siempre es positivo acá).
  if (key === "±" && kind === "sci") return { draft: { ...d, expNeg: !d.expNeg }, slot: "exp" };
  if (key === "±") return { draft: { ...d, neg: !d.neg }, slot };
  if (key === "next") {
    const i = slots.indexOf(slot);
    return { draft: d, slot: slots[(i + 1) % slots.length] };
  }
  if (key === "prev") {
    const i = slots.indexOf(slot);
    return { draft: d, slot: slots[(i - 1 + slots.length) % slots.length] };
  }
  if (key === "⌫") {
    const cur = d[s];
    if (slot === "exp" && cur === "" && d.expNeg) return { draft: { ...d, expNeg: false }, slot };
    if (cur === "" && slots.length > 1) {
      const i = slots.indexOf(slot);
      if (i > 0) return { draft: d, slot: slots[i - 1] };
    }
    return { draft: { ...d, [s]: cur.slice(0, -1) }, slot };
  }
  if (key === ",") {
    if (kind !== "decimal" && kind !== "sci") return { draft: d, slot };
    if (d.text.includes(",")) return { draft: d, slot: "text" };
    return { draft: { ...d, text: (d.text === "" ? "0" : d.text) + "," }, slot: "text" };
  }
  if (/^\d$/.test(key)) {
    const cur = d[s];
    const digits = cur.replace(",", "").length;
    if (digits >= maxDigits(kind, slot)) return { draft: d, slot };
    const next = cur === "0" ? key : cur + key;
    return { draft: { ...d, [s]: next }, slot };
  }
  return { draft: d, slot };
}

function SlotBox({ value, active, label, onClick, className = "" }: { value: string; active: boolean; label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      className={`slot${active ? " is-active" : ""}${value ? "" : " is-empty"}${className ? ` ${className}` : ""}`}
      onClick={onClick}
      aria-label={`${label}: ${value || "vacío"}`}
    >
      <span className="slot-val">{value}</span>
      {active && <span className="caret" aria-hidden="true" />}
    </button>
  );
}

export function AnswerDisplay({
  kind,
  draft,
  slot,
  setSlot,
  prefix,
  items,
}: {
  kind: AnswerSpec["kind"];
  draft: Draft;
  slot: Slot;
  setSlot: (s: Slot) => void;
  prefix?: string;
  /** Nombres de los casilleros, en las respuestas con varios números. */
  items?: MultiItem[];
}) {
  if (kind === "multi" && items) {
    return (
      <div className="ans ans-multi" aria-live="polite">
        {items.map((it, i) => (
          <div key={i} className="ans-row">
            <span className="ans-row-label">{it.label}</span>
            <span className="ans-row-slot">
              {it.unit === "$" && <span className="ans-row-unit">$</span>}
              <SlotBox value={groupThousands(draft.multi[i] ?? "")} active={slot === `m${i}`} label={it.label} onClick={() => setSlot(`m${i}`)} className="slot-multi" />
            </span>
            <span className="ans-row-unit">{it.unit && it.unit !== "$" ? it.unit : ""}</span>
          </div>
        ))}
      </div>
    );
  }
  const sign = draft.neg ? <span className="ans-sign">−</span> : null;
  return (
    <div className="ans" aria-live="polite">
      {prefix && <span className="ans-prefix">{prefix}</span>}
      {sign}
      {kind === "fraction" && (
        <span className="ans-frac">
          <SlotBox value={draft.num} active={slot === "num"} label="Numerador" onClick={() => setSlot("num")} />
          <span className="ans-bar" />
          <SlotBox value={draft.den} active={slot === "den"} label="Denominador" onClick={() => setSlot("den")} />
        </span>
      )}
      {kind === "mixed" && (
        <>
          <SlotBox value={draft.whole} active={slot === "whole"} label="Parte entera" onClick={() => setSlot("whole")} />
          <span className="ans-frac">
            <SlotBox value={draft.num} active={slot === "num"} label="Numerador" onClick={() => setSlot("num")} />
            <span className="ans-bar" />
            <SlotBox value={draft.den} active={slot === "den"} label="Denominador" onClick={() => setSlot("den")} />
          </span>
        </>
      )}
      {(kind === "integer" || kind === "decimal") && (
        <SlotBox value={groupThousands(draft.text)} active label={kind === "decimal" ? "Número decimal" : "Número"} onClick={() => setSlot("text")} />
      )}
      {kind === "sci" && (
        <span className="ans-sci">
          <SlotBox value={draft.text} active={slot === "text"} label="Primer número" onClick={() => setSlot("text")} />
          <span className="ans-times">·</span>
          <span className="ans-ten">10</span>
          <SlotBox
            value={(draft.expNeg ? "−" : "") + draft.exp}
            active={slot === "exp"}
            label="Exponente"
            onClick={() => setSlot("exp")}
            className="slot-exp"
          />
        </span>
      )}
    </div>
  );
}

function SwitchIcon({ target }: { target: Slot }) {
  // Dos casilleros apilados; el que se va a activar, relleno.
  if (target === "whole") {
    return (
      <svg viewBox="0 0 34 30" width="30" height="26" aria-hidden="true">
        <rect x="2" y="8" width="11" height="14" rx="2" className="ico-fill" />
        <rect x="19" y="2" width="12" height="10" rx="2" className="ico-line" />
        <line x1="18" y1="15" x2="32" y2="15" className="ico-bar" />
        <rect x="19" y="18" width="12" height="10" rx="2" className="ico-line" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 22 30" width="20" height="26" aria-hidden="true">
      <rect x="4" y="2" width="14" height="10" rx="2" className={target === "num" ? "ico-fill" : "ico-line"} />
      <line x1="2" y1="15" x2="20" y2="15" className="ico-bar" />
      <rect x="4" y="18" width="14" height="10" rx="2" className={target === "den" ? "ico-fill" : "ico-line"} />
    </svg>
  );
}

export function Keypad({
  kind,
  slot,
  onKey,
  onSubmit,
  submitLabel,
  disabled,
}: {
  kind: AnswerSpec["kind"];
  slot: Slot;
  onKey: (k: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  disabled?: boolean;
}) {
  const slots = slotsFor(kind);
  const nextSlot = slots[(slots.indexOf(slot) + 1) % slots.length];
  const nextName = nextSlot === "den" ? "Ir al denominador" : nextSlot === "num" ? "Ir al numerador" : "Ir a la parte entera";
  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  const digitKeys = digits.map((d) => (
    <button key={d} type="button" className="key" onClick={() => onKey(d)} disabled={disabled}>
      {d}
    </button>
  ));
  const back = (
    <button type="button" className="key key-fn" onClick={() => onKey("⌫")} disabled={disabled} aria-label="Borrar">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z" className="ico-line" />
        <path d="M12 9l5 6M17 9l-5 6" className="ico-line" />
      </svg>
    </button>
  );
  if (kind === "multi") {
    // [siguiente casillero] [coma] [borrar] [servir]
    return (
      <div className="keypad" role="group" aria-label="Teclado">
        {digitKeys}
        <button type="button" className="key key-fn" onClick={() => onKey("next")} disabled={disabled} aria-label="Siguiente casillero" title="Siguiente casillero">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M12 4v15M6 13l6 6 6-6" className="ico-line" />
          </svg>
        </button>
        <button type="button" className="key key-fn" onClick={() => onKey(",")} disabled={disabled} aria-label="Coma decimal">
          ,
        </button>
        {back}
        <button type="button" className="key key-go" onClick={onSubmit} disabled={disabled}>
          {submitLabel}
        </button>
      </div>
    );
  }
  if (kind === "sci") {
    // [ir al otro casillero] [coma o signo del exponente] [borrar] [servir]
    const onExp = slot === "exp";
    return (
      <div className="keypad" role="group" aria-label="Teclado">
        {digitKeys}
        <button
          type="button"
          className="key key-fn key-sci"
          onClick={() => onKey("next")}
          disabled={disabled}
          aria-label={onExp ? "Volver al primer número" : "Ir al exponente"}
          title={onExp ? "Volver al primer número" : "Ir al exponente"}
        >
          {onExp ? (
            <span className="key-sci-label">
              <b>a</b>·10
            </span>
          ) : (
            <span className="key-sci-label">
              10<sup>
                <b>n</b>
              </sup>
            </span>
          )}
        </button>
        {onExp ? (
          <button type="button" className="key key-fn" onClick={() => onKey("±")} disabled={disabled} aria-label="Cambiar el signo del exponente">
            ±
          </button>
        ) : (
          <button type="button" className="key key-fn" onClick={() => onKey(",")} disabled={disabled} aria-label="Coma decimal">
            ,
          </button>
        )}
        {back}
        <button type="button" className="key key-go" onClick={onSubmit} disabled={disabled}>
          {submitLabel}
        </button>
      </div>
    );
  }
  return (
    <div className="keypad" role="group" aria-label="Teclado">
      {digitKeys}
      <button type="button" className="key key-fn" onClick={() => onKey("±")} disabled={disabled} aria-label="Cambiar signo">
        ±
      </button>
      {slots.length > 1 ? (
        <button type="button" className="key key-fn" onClick={() => onKey("next")} disabled={disabled} aria-label={nextName} title={nextName}>
          <SwitchIcon target={nextSlot} />
        </button>
      ) : kind === "decimal" ? (
        <button type="button" className="key key-fn" onClick={() => onKey(",")} disabled={disabled} aria-label="Coma decimal">
          ,
        </button>
      ) : (
        <span className="key key-blank" aria-hidden="true" />
      )}
      {back}
      <button type="button" className="key key-go" onClick={onSubmit} disabled={disabled}>
        {submitLabel}
      </button>
    </div>
  );
}
