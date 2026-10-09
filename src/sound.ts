// Efectos de sonido sintetizados con Web Audio (sin archivos).
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "triangle", gain = 0.18) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  tap() {
    tone(660, 0, 0.05, "square", 0.04);
  },
  correct() {
    tone(523.25, 0, 0.12);
    tone(659.25, 0.09, 0.12);
    tone(783.99, 0.18, 0.22);
  },
  streak() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.07, 0.16, "triangle", 0.16));
  },
  wrong() {
    tone(196, 0, 0.18, "sawtooth", 0.08);
    tone(155.56, 0.14, 0.28, "sawtooth", 0.08);
  },
  coin() {
    tone(1318.5, 0, 0.08, "square", 0.05);
    tone(1760, 0.06, 0.16, "square", 0.05);
  },
  win() {
    [392, 523.25, 659.25, 783.99, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.11, 0.2, "triangle", 0.15));
  },
  lose() {
    [392, 349.23, 311.13, 261.63].forEach((f, i) => tone(f, i * 0.16, 0.26, "triangle", 0.12));
  },
};
