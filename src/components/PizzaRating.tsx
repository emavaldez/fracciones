import { PrizeIcon } from "./Pizza";
import { prizeWord, useLook } from "../look";

/** De 0 a 3 pizzas o chocolates (las “estrellas” del juego). */
export function PizzaRating({ value, size = 28 }: { value: number; size?: number }) {
  const look = useLook();
  return (
    <span className="rating" role="img" aria-label={`${value} de 3 ${prizeWord(look)}`}>
      {[0, 1, 2].map((i) => (
        <PrizeIcon key={i} size={size} className={i < value ? "is-on" : "is-off"} />
      ))}
    </span>
  );
}
