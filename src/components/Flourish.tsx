// Voluta inspirada en el fileteado porteño, para decorar el cartel.
export function Flourish({ side }: { side: "left" | "right" }) {
  return (
    <svg className={`flourish flourish-${side}`} viewBox="0 0 120 80" aria-hidden="true">
      <g transform={side === "right" ? "translate(120 0) scale(-1 1)" : undefined}>
        <path className="fl-main" d="M116 40 C96 40 84 22 64 22 C42 22 30 44 40 58 C48 69 66 64 64 51 C62 41 49 42 50 50" />
        <path className="fl-main" d="M116 40 C98 42 90 60 70 64 C54 67 38 66 26 56" />
        <path className="fl-curl" d="M26 56 C14 46 10 30 22 22 C32 15 44 24 37 33 C32 39 24 34 28 29" />
        <path className="fl-hi" d="M108 39 C94 38 84 26 66 26" />
        <circle className="fl-dot" cx="10" cy="62" r="4" />
        <circle className="fl-dot fl-dot-b" cx="18" cy="72" r="2.6" />
      </g>
    </svg>
  );
}
