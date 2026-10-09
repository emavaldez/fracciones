// Notación científica: a · 10^n con 1 ≤ |a| < 10, siempre con fracciones exactas.
import { F, Fraction, fractionToDecimalString } from "./fraction";
import { N, dec, pow, row, type Expr } from "./expr";

const TEN = F(10);
const ONE = F(1);

export const pow10 = (e: number): Fraction => (e >= 0 ? F(10 ** e) : F(1, 10 ** -e));

/** Lleva m·10^e a la forma con 1 ≤ |m| < 10 (si m ≠ 0). */
export function normSci(m: Fraction, e: number): { m: Fraction; e: number } {
  if (m.isZero()) return { m, e: 0 };
  let mm = m;
  let ee = e;
  while (mm.abs().compare(TEN) >= 0) {
    mm = mm.div(TEN);
    ee++;
  }
  while (mm.abs().compare(ONE) < 0) {
    mm = mm.mul(TEN);
    ee--;
  }
  return { m: mm, e: ee };
}

export const toSci = (v: Fraction) => normSci(v, 0);
export const sciValue = (m: Fraction, e: number) => m.mul(pow10(e));
export const isSciMantissa = (m: Fraction) => m.abs().compare(ONE) >= 0 && m.abs().compare(TEN) < 0;
export const sameSci = (a: { m: Fraction; e: number }, b: { m: Fraction; e: number }) => {
  const x = normSci(a.m, a.e);
  const y = normSci(b.m, b.e);
  return x.e === y.e && x.m.equals(y.m);
};

/** Agrupa de a tres las cifras de la parte entera cuando son 5 o más ("45 000 000"). */
export function groupThousands(s: string): string {
  const neg = s.startsWith("-");
  const body = neg ? s.slice(1) : s;
  const [ip, fp] = body.split(",");
  const g = ip.length >= 5 ? ip.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : ip;
  return (neg ? "-" : "") + g + (fp !== undefined ? "," + fp : "");
}

/** Decimal exacto con coma (y miles separados con un espacio finito). */
export function decStr(f: Fraction, group = true): string {
  const s = fractionToDecimalString(f);
  if (s === null) throw new Error(`No es un decimal finito: ${f}`);
  return group ? groupThousands(s) : s;
}

/** Cantidad de cifras decimales de un decimal finito. */
export function decimalPlaces(f: Fraction): number {
  const s = decStr(f, false);
  const i = s.indexOf(",");
  return i < 0 ? 0 : s.length - i - 1;
}

/** a · 10^n para dibujar. */
export const sciExpr = (m: Fraction, e: number): Expr => row(dec(decStr(m, false)), "·", pow(N(10), e));

/** a·10^n para usar dentro de textos (RichText dibuja la potencia). */
export const sciText = (m: Fraction, e: number) => `${decStr(m, false)}·10^${e}`;
