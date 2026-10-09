import type { Draft } from "../game/check";
import type { AnswerSpec } from "../game/types";

export type Slot = "whole" | "num" | "den" | "text";

export function slotsFor(kind: AnswerSpec["kind"]): Slot[] {
  if (kind === "fraction") return ["num", "den"];
  if (kind === "mixed") return ["whole", "num", "den"];
  return ["text"];
}

const MAX = 5;

/** Aplica una tecla al borrador. Devuelve el nuevo borrador y el casillero activo. */
export function applyKey(kind: AnswerSpec["kind"], d: Draft, slot: Slot, key: string): { draft: Draft; slot: Slot } {
  const slots = slotsFor(kind);
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
    const cur = d[slot];
    if (cur === "" && slots.length > 1) {
      const i = slots.indexOf(slot);
      if (i > 0) return { draft: d, slot: slots[i - 1] };
    }
    return { draft: { ...d, [slot]: cur.slice(0, -1) }, slot };
  }
  if (key === ",") {
    if (kind !== "decimal") return { draft: d, slot };
    if (d.text.includes(",")) return { draft: d, slot };
    return { draft: { ...d, text: (d.text === "" ? "0" : d.text) + "," }, slot };
  }
  if (/^\d$/.test(key)) {
    const cur = d[slot];
    const digits = cur.replace(",", "").length;
    if (digits >= MAX) return { draft: d, slot };
    const next = cur === "0" ? key : cur + key;
    return { draft: { ...d, [slot]: next }, slot };
  }
  return { draft: d, slot };
}

function SlotBox({ value, active, label, onClick }: { value: string; active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className={`slot${active ? " is-active" : ""}${value ? "" : " is-empty"}`} onClick={onClick} aria-label={`${label}: ${value || "vacío"}`}>
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
}: {
  kind: AnswerSpec["kind"];
  draft: Draft;
  slot: Slot;
  setSlot: (s: Slot) => void;
  prefix?: string;
}) {
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
      {(kind === "integer" || kind === "decimal") && <SlotBox value={draft.text} active label={kind === "decimal" ? "Número decimal" : "Número"} onClick={() => setSlot("text")} />}
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
  return (
    <div className="keypad" role="group" aria-label="Teclado">
      {digits.map((d) => (
        <button key={d} type="button" className="key" onClick={() => onKey(d)} disabled={disabled}>
          {d}
        </button>
      ))}
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
      <button type="button" className="key key-fn" onClick={() => onKey("⌫")} disabled={disabled} aria-label="Borrar">
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z" className="ico-line" />
          <path d="M12 9l5 6M17 9l-5 6" className="ico-line" />
        </svg>
      </button>
      <button type="button" className="key key-go" onClick={onSubmit} disabled={disabled}>
        {submitLabel}
      </button>
    </div>
  );
}
