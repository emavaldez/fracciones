/** De 0 a 3 pizzas (las “estrellas” del juego). */
export function PizzaRating({ value, size = 28 }: { value: number; size?: number }) {
  return (
    <span className="rating" role="img" aria-label={`${value} de 3 pizzas`}>
      {[0, 1, 2].map((i) => (
        <svg key={i} viewBox="0 0 24 24" width={size} height={size} className={i < value ? "is-on" : "is-off"} aria-hidden="true">
          <circle cx="12" cy="12" r="11" className="rt-crust" />
          <circle cx="12" cy="12" r="8.6" className="rt-cheese" />
          <circle cx="8.5" cy="9" r="1.9" className="rt-pep" />
          <circle cx="15" cy="10.5" r="1.9" className="rt-pep" />
          <circle cx="11" cy="15.5" r="1.9" className="rt-pep" />
        </svg>
      ))}
    </span>
  );
}
