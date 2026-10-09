import { OnePizza, SingleSlice } from "../components/Pizza";
import { Flourish } from "../components/Flourish";
import { LookToggle, TEXTS, type Look } from "../look";

export function Home({ onStart, look, setLook }: { onStart: () => void; look: Look; setLook: (l: Look) => void }) {
  const t = TEXTS[look];
  return (
    <div className="screen home">
      <div className="home-sign">
        <Flourish side="left" />
        <div className="home-sign-text">
          <span className="home-pizzeria">{t.shop}</span>
          <h1 className="sign sign-xl">La Fracción</h1>
        </div>
        <Flourish side="right" />
      </div>

      <div className="home-hero" aria-hidden="true">
        <div className="home-pizza">
          <OnePizza slices={8} filled={7} size={240} label={look === "choco" ? "Tableta de chocolate a la que le falta un cuadradito" : "Pizza con una porción servida"} />
        </div>
        <div className="home-slice">
          <SingleSlice slices={8} index={7} size={240} />
        </div>
        <div className="home-frac">
          <span>1</span>
          <span>8</span>
        </div>
      </div>

      <p className="home-lead">{t.lead}</p>

      <LookToggle look={look} setLook={setLook} />

      <button type="button" className="btn btn-primary btn-big" onClick={onStart}>
        {t.open}
      </button>

      <ul className="home-how">
        <li>Elegí cualquier sector y nivel: está todo abierto.</li>
        <li>Si te equivocás, te mostramos qué pasó y cómo se hace paso a paso.</li>
        <li>Cada sector termina con un cliente difícil. Tenés tres vidas para convencerlo.</li>
      </ul>
    </div>
  );
}
