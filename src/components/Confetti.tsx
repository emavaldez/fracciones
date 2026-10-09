import { useMemo } from "react";

// Lluvia de pepperoni, queso y albahaca. Respeta "reducir movimiento" (por CSS).
export function Confetti({ count = 46 }: { count?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.9,
        dur: 2.2 + Math.random() * 1.6,
        size: 8 + Math.random() * 10,
        kind: i % 3,
        rot: Math.random() * 360,
      })),
    [count],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <span
          key={i}
          className={`cf cf-${b.kind}`}
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.kind === 2 ? b.size * 0.55 : b.size,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.dur}s`,
            transform: `rotate(${b.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}
