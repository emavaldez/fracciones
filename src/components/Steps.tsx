import { MathView, RichText } from "./MathView";
import { NumberLine } from "./NumberLine";
import type { Step } from "../game/types";

export function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <li key={i}>
          {s.text && (
            <p>
              <RichText text={s.text} />
            </p>
          )}
          {s.math && (
            <div className="steps-math">
              <MathView e={s.math} size="sm" />
            </div>
          )}
          {s.line && (
            <div className="steps-line">
              <NumberLine spec={s.line} />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
