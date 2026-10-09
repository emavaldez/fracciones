// Fracción siempre reducida, con el signo en el numerador y denominador positivo.

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

export class Fraction {
  readonly n: number;
  readonly d: number;

  constructor(n: number, d = 1) {
    if (d === 0) throw new Error("Denominador 0");
    if (!Number.isInteger(n) || !Number.isInteger(d)) throw new Error(`Fracción no entera ${n}/${d}`);
    const s = d < 0 ? -1 : 1;
    const g = gcd(n, d);
    // Evita -0
    this.n = (s * n) / g || 0;
    this.d = Math.abs(d) / g;
  }

  static of(n: number, d = 1) {
    return new Fraction(n, d);
  }

  add(o: Fraction) {
    return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Fraction) {
    return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Fraction) {
    return new Fraction(this.n * o.n, this.d * o.d);
  }
  div(o: Fraction) {
    if (o.n === 0) throw new Error("División por 0");
    return new Fraction(this.n * o.d, this.d * o.n);
  }
  neg() {
    return new Fraction(-this.n, this.d);
  }
  inv() {
    return new Fraction(this.d, this.n);
  }
  abs() {
    return new Fraction(Math.abs(this.n), this.d);
  }
  pow(e: number): Fraction {
    if (!Number.isInteger(e)) throw new Error("Exponente no entero");
    if (e === 0) return new Fraction(1);
    const base = e < 0 ? this.inv() : this;
    const k = Math.abs(e);
    return new Fraction(base.n ** k, base.d ** k);
  }
  /** Raíz exacta de índice k, o null si no es racional (o no existe en los reales). */
  root(k: number): Fraction | null {
    if (this.n < 0 && k % 2 === 0) return null;
    const rn = intRoot(Math.abs(this.n), k);
    const rd = intRoot(this.d, k);
    if (rn === null || rd === null) return null;
    return new Fraction(this.n < 0 ? -rn : rn, rd);
  }
  equals(o: Fraction) {
    return this.n === o.n && this.d === o.d;
  }
  compare(o: Fraction) {
    return Math.sign(this.n * o.d - o.n * this.d);
  }
  isInteger() {
    return this.d === 1;
  }
  isZero() {
    return this.n === 0;
  }
  value() {
    return this.n / this.d;
  }
  toString() {
    return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`;
  }
}

export function intRoot(x: number, k: number): number | null {
  if (x < 0) return null;
  const r = Math.round(Math.pow(x, 1 / k));
  for (const c of [r - 1, r, r + 1]) if (c >= 0 && c ** k === x) return c;
  return null;
}

export const F = (n: number, d = 1) => new Fraction(n, d);

/** ¿La fracción n/d (tal como se escribió) es irreducible? */
export function isIrreducible(n: number, d: number) {
  return gcd(n, d) === 1;
}

/** Convierte un decimal finito escrito como string ("0,375") a fracción. */
export function decimalStringToFraction(s: string): Fraction | null {
  const clean = s.trim().replace(",", ".");
  if (!/^-?\d*(\.\d*)?$/.test(clean) || clean === "" || clean === "-" || clean === "." || clean === "-.") return null;
  const neg = clean.startsWith("-");
  const body = neg ? clean.slice(1) : clean;
  const [ip, fp = ""] = body.split(".");
  const den = 10 ** fp.length;
  const num = Number(ip || "0") * den + Number(fp || "0");
  return new Fraction(neg ? -num : num, den);
}

/** Expresión decimal finita de una fracción (si existe), con coma. */
export function fractionToDecimalString(f: Fraction): string | null {
  let d = f.d;
  while (d % 2 === 0) d /= 2;
  while (d % 5 === 0) d /= 5;
  if (d !== 1) return null;
  const v = f.value();
  // Hasta 6 decimales alcanza para los ejercicios del juego.
  let s = v.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  return s.replace(".", ",");
}
