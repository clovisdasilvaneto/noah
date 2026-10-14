// Synthesized animal sounds for chapter 4. game/audio.ts keeps its context
// private, so this file has a tiny one of its own; it follows the global
// mute/pause flags and makes nothing until the first sound is played (the
// player has long since interacted with the page by then).
import { useGame } from '../../store'

let ctx: AudioContext | null = null
let out: GainNode | null = null

function ready() {
  const st = useGame.getState()
  if (st.muted || st.paused) return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    out = ctx.createGain()
    out.gain.value = 0.5
    out.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

type Wave = OscillatorType

/** One oscillator note with an optional pitch glide and vibrato. */
function voice(c: AudioContext, o: { f: number; to?: number; dur: number; type: Wave; vol: number; delay?: number; vib?: number; vibRate?: number; lp?: number }) {
  const t0 = c.currentTime + (o.delay ?? 0)
  const osc = c.createOscillator()
  osc.type = o.type
  osc.frequency.setValueAtTime(o.f, t0)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(o.vol, t0 + Math.min(0.04, o.dur * 0.2))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
  let node: AudioNode = osc
  if (o.vib) {
    const lfo = c.createOscillator()
    const lg = c.createGain()
    lfo.frequency.value = o.vibRate ?? 7
    lg.gain.value = o.vib
    lfo.connect(lg).connect(osc.frequency)
    lfo.start(t0)
    lfo.stop(t0 + o.dur + 0.05)
  }
  if (o.lp) {
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = o.lp
    node.connect(f)
    node = f
  }
  node.connect(g).connect(out!)
  osc.start(t0)
  osc.stop(t0 + o.dur + 0.05)
}

function noise(c: AudioContext, dur: number, vol: number, cutoff: number, delay = 0, type: BiquadFilterType = 'lowpass') {
  const len = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 1.5
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.value = cutoff
  const g = c.createGain()
  g.gain.value = vol
  src.connect(f).connect(g).connect(out!)
  src.start(c.currentTime + delay)
}

export const asfx = {
  /** a friendly, kid-sized roar */
  roar() {
    const c = ready()
    if (!c) return
    voice(c, { f: 150, to: 90, dur: 0.9, type: 'sawtooth', vol: 0.09, vib: 14, vibRate: 22, lp: 700 })
    noise(c, 0.8, 0.12, 500)
  },
  trumpet() {
    const c = ready()
    if (!c) return
    voice(c, { f: 330, to: 620, dur: 0.55, type: 'sawtooth', vol: 0.07, vib: 18, vibRate: 9, lp: 1800 })
    voice(c, { f: 620, to: 470, dur: 0.4, type: 'square', vol: 0.04, delay: 0.45, lp: 1500 })
  },
  /** giraffes are quiet: a soft low hum */
  hum() {
    const c = ready()
    if (!c) return
    voice(c, { f: 110, to: 98, dur: 0.7, type: 'triangle', vol: 0.12, vib: 3, vibRate: 5 })
  },
  neigh() {
    const c = ready()
    if (!c) return
    voice(c, { f: 900, to: 420, dur: 0.7, type: 'sawtooth', vol: 0.05, vib: 60, vibRate: 16, lp: 2200 })
  },
  baa() {
    const c = ready()
    if (!c) return
    voice(c, { f: 340, to: 320, dur: 0.5, type: 'sawtooth', vol: 0.05, vib: 25, vibRate: 11, lp: 1600 })
  },
  hop() {
    const c = ready()
    if (!c) return
    voice(c, { f: 420, to: 900, dur: 0.12, type: 'sine', vol: 0.07 })
  },
  squeak() {
    const c = ready()
    if (!c) return
    voice(c, { f: 1400, to: 1900, dur: 0.1, type: 'sine', vol: 0.06 })
    voice(c, { f: 1700, to: 2300, dur: 0.1, type: 'sine', vol: 0.05, delay: 0.12 })
  },
  /** turtles: a slow, round "bloop" */
  bloop() {
    const c = ready()
    if (!c) return
    voice(c, { f: 260, to: 160, dur: 0.25, type: 'sine', vol: 0.12 })
  },
  coo() {
    const c = ready()
    if (!c) return
    voice(c, { f: 520, to: 440, dur: 0.22, type: 'sine', vol: 0.06, vib: 10, vibRate: 12 })
    voice(c, { f: 480, to: 400, dur: 0.35, type: 'sine', vol: 0.06, delay: 0.26, vib: 10, vibRate: 12 })
  },
  flutter() {
    const c = ready()
    if (!c) return
    for (let i = 0; i < 6; i++) noise(c, 0.05, 0.08, 3000, i * 0.06, 'bandpass')
  },
  bell() {
    const c = ready()
    if (!c) return
    // inharmonic partials make it ring like metal
    for (const [m, v] of [
      [1, 0.12],
      [2.76, 0.05],
      [5.4, 0.03],
    ] as const) {
      voice(c, { f: 880 * m, dur: 1.8, type: 'sine', vol: v })
      voice(c, { f: 880 * m, dur: 1.8, type: 'sine', vol: v * 0.8, delay: 0.5 })
    }
  },
  /** a happy rising jingle when a pair walks through the door */
  aboard() {
    const c = ready()
    if (!c) return
    ;[659, 784, 988, 1319].forEach((f, i) => voice(c, { f, dur: 0.22, type: 'triangle', vol: 0.09, delay: i * 0.07 }))
  },
  doorCreak() {
    const c = ready()
    if (!c) return
    voice(c, { f: 120, to: 180, dur: 1.6, type: 'sawtooth', vol: 0.03, vib: 30, vibRate: 13, lp: 900 })
  },
  doorThud() {
    const c = ready()
    if (!c) return
    voice(c, { f: 90, to: 40, dur: 0.6, type: 'sine', vol: 0.35 })
    noise(c, 0.35, 0.3, 600)
  },
  thunder() {
    const c = ready()
    if (!c) return
    noise(c, 2.6, 0.45, 260)
    noise(c, 1.2, 0.25, 900, 0.05)
  },
}
