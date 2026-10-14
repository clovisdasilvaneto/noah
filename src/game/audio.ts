// Tiny synthesized sound effects. No audio files to download, which keeps
// the mobile payload small.
let ctx: AudioContext | null = null
let master: GainNode | null = null

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume()
    return
  }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = muted ? 0 : 0.5
  master.connect(ctx.destination)
  if (pendingAmbience) startAmbience(pendingAmbience)
  if (pendingMusic) playMusic(pendingMusic)
}

let muted = false
export function setMuted(m: boolean) {
  muted = m
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.05)
}

/** Pause/resume everything (used while the game is paused or hidden). */
export function suspendAudio(s: boolean) {
  if (!ctx) return
  if (s) void ctx.suspend()
  else void ctx.resume()
  // media elements keep running while the context is suspended; pause them too
  if (music) {
    if (s) music.el.pause()
    else void music.el.play().catch(() => {})
  }
}

/* ------------------------------------------------------------------ */
/* Background music: one looping track per scenario, crossfaded.        */
/* Routed through WebAudio so fades work on iOS (audio.volume is        */
/* read-only there) and so narration can duck it.                       */
/* ------------------------------------------------------------------ */

export type MusicTrack = 'menu' | 'call' | 'gather' | 'complete' | 'animals' | 'storm' | 'promise'
type MusicManifest = { tracks: Record<string, { file: string }> }

// the results fanfare plays once; scene music loops
const ONE_SHOT: MusicTrack[] = ['complete']

const MUSIC_LEVEL = 0.55
const MUSIC_FADE = 1.4
let musicManifest: Promise<MusicManifest | null> | null = null
let musicBus: GainNode | null = null
let music: { name: MusicTrack; el: HTMLAudioElement; gain: GainNode } | null = null
let pendingMusic: MusicTrack | null = null
let musicRequest = 0

function loadMusicManifest() {
  musicManifest ??= fetch('/audio/music/manifest.json')
    .then((r) => (r.ok ? (r.json() as Promise<MusicManifest>) : null))
    .catch(() => null)
  return musicManifest
}

export async function playMusic(name: MusicTrack | null) {
  pendingMusic = name
  const mine = ++musicRequest
  if (!ctx || !master) return
  if (music?.name === name) return
  const m = await loadMusicManifest()
  if (mine !== musicRequest || !ctx || !master) return
  const c = ctx
  musicBus ??= (() => {
    const g = c.createGain()
    g.gain.value = MUSIC_LEVEL
    g.connect(master!)
    return g
  })()
  // fade out whatever is playing
  if (music) {
    const old = music
    old.gain.gain.setTargetAtTime(0.0001, c.currentTime, MUSIC_FADE / 4)
    window.setTimeout(() => {
      old.el.pause()
      old.gain.disconnect()
    }, MUSIC_FADE * 1000 + 200)
    music = null
  }
  const track = name && m?.tracks[name]
  if (!name || !track) return
  const el = new Audio(`/audio/music/${track.file}`)
  el.loop = !ONE_SHOT.includes(name)
  el.preload = 'auto'
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, c.currentTime)
  gain.gain.setTargetAtTime(1, c.currentTime, MUSIC_FADE / 4)
  c.createMediaElementSource(el).connect(gain).connect(musicBus)
  music = { name, el, gain }
  el.play().catch(() => {})
}

/** Lower music under a voice line. */
export function duckMusic(on: boolean) {
  if (!ctx || !musicBus) return
  musicBus.gain.setTargetAtTime(MUSIC_LEVEL * (on ? 0.35 : 1), ctx.currentTime, 0.3)
}

/* ------------------------------------------------------------------ */
/* Ambience: synthesized so there's nothing to download.               */
/*  - night: warm pad chord + soft wind (cutscene)                      */
/*  - day: quieter pad + occasional bird chirps (gather level)          */
/* ------------------------------------------------------------------ */

export type Ambience = 'night' | 'day' | 'rain' | 'storm'
let pendingAmbience: Ambience | null = null
let ambienceNodes: { stop: () => void; out: GainNode; level: number } | null = null

/** Lower the ambience while a voice line is playing. */
export function duckAmbience(on: boolean) {
  duckMusic(on)
  if (!ctx || !ambienceNodes) return
  ambienceNodes.out.gain.setTargetAtTime(ambienceNodes.level * (on ? 0.35 : 1), ctx.currentTime, 0.25)
}

export function startAmbience(kind: Ambience) {
  pendingAmbience = kind
  if (!ctx || !master) return
  stopAmbience()
  pendingAmbience = kind
  const c = ctx
  if (kind === 'rain' || kind === 'storm') {
    ambienceNodes = startRain(c, master, kind)
    return
  }
  const out = c.createGain()
  out.gain.setValueAtTime(0.0001, c.currentTime)
  out.gain.exponentialRampToValueAtTime(kind === 'night' ? 0.22 : 0.12, c.currentTime + 2.5)
  out.connect(master)

  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = kind === 'night' ? 900 : 1400
  lp.connect(out)
  // slow filter breathing
  const lfo = c.createOscillator()
  const lfoGain = c.createGain()
  lfo.frequency.value = 0.07
  lfoGain.gain.value = 350
  lfo.connect(lfoGain).connect(lp.frequency)
  lfo.start()

  const oscs: OscillatorNode[] = [lfo]

  // wind: looping filtered noise
  const len = c.sampleRate * 4
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    last = last * 0.985 + (Math.random() * 2 - 1) * 0.015
    d[i] = last * 6
  }
  const wind = c.createBufferSource()
  wind.buffer = buf
  wind.loop = true
  const windGain = c.createGain()
  windGain.gain.value = kind === 'night' ? 0.5 : 0.18
  wind.connect(windGain).connect(lp)
  wind.start()

  let birdTimer = 0
  const chirp = () => {
    if (!ctx) return
    const base = 2200 + Math.random() * 1600
    const n = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) tone(base, 0.09, 'sine', 0.025, i * 0.12, base * 1.35)
    birdTimer = window.setTimeout(chirp, 2500 + Math.random() * 5000)
  }
  if (kind === 'day') birdTimer = window.setTimeout(chirp, 1500)

  ambienceNodes = {
    out,
    level: kind === 'night' ? 0.22 : 0.12,
    stop: () => {
      window.clearTimeout(birdTimer)
      const t = c.currentTime
      out.gain.cancelScheduledValues(t)
      out.gain.setTargetAtTime(0.0001, t, 0.4)
      window.setTimeout(() => {
        oscs.forEach((o) => o.stop())
        wind.stop()
        out.disconnect()
      }, 1600)
    },
  }
}

export function stopAmbience() {
  pendingAmbience = null
  ambienceNodes?.stop()
  ambienceNodes = null
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number) {
  if (!ctx || !master) return
  const t0 = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

function noise(dur: number, vol: number, cutoff: number) {
  if (!ctx || !master) return
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2
  const src = ctx.createBufferSource()
  src.buffer = buf
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = cutoff
  const g = ctx.createGain()
  g.gain.value = vol
  src.connect(f).connect(g).connect(master)
  src.start()
}

let lastStud = 0
export const sfx = {
  stud(value: number) {
    if (!ctx) return
    // throttle so a shower of studs doesn't clip
    if (ctx.currentTime - lastStud < 0.04) return
    lastStud = ctx.currentTime
    const base = value >= 1000 ? 1568 : value >= 100 ? 1318 : 1046
    tone(base, 0.12, 'square', 0.05)
    tone(base * 1.5, 0.16, 'sine', 0.06, 0.04)
  },
  smash() {
    noise(0.25, 0.5, 2400)
    tone(220, 0.12, 'triangle', 0.15, 0, 110)
  },
  chop() {
    noise(0.12, 0.45, 1400)
    tone(140, 0.1, 'square', 0.08, 0, 90)
  },
  buildTick() {
    tone(600 + Math.random() * 500, 0.06, 'square', 0.04)
  },
  built() {
    ;[523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, i * 0.08))
  },
  pickup() {
    tone(784, 0.1, 'sine', 0.12)
    tone(1175, 0.18, 'sine', 0.1, 0.07)
  },
  jump() {
    tone(330, 0.15, 'sine', 0.08, 0, 660)
  },
  divine() {
    ;[392, 494, 587, 784].forEach((f, i) => tone(f, 2.4, 'sine', 0.05, i * 0.12))
  },
  baa() {
    // wobbly bleat: vibrato via quick frequency steps
    for (let i = 0; i < 5; i++) tone(i % 2 ? 360 : 330, 0.09, 'sawtooth', 0.035, i * 0.08)
  },
  complete() {
    ;[523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.12, i * 0.14))
  },
}

/* ------------------------------------------------------------------ */
/* Flood finale (chapter 5): rain ambience and weather/bird sounds.     */
/* ------------------------------------------------------------------ */

/** Looping noise buffer: white (`smooth` 0) or brown-ish (`smooth` near 1). */
function noiseBuffer(c: AudioContext, seconds: number, smooth: number, gain: number) {
  const len = Math.floor(c.sampleRate * seconds)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    last = last * smooth + (Math.random() * 2 - 1) * (1 - smooth)
    d[i] = last * gain
  }
  return buf
}

/** Steady rain hiss with soft patter, plus a low rumble and wind when it storms. */
function startRain(c: AudioContext, dest: GainNode, kind: 'rain' | 'storm') {
  const level = kind === 'storm' ? 0.26 : 0.16
  const out = c.createGain()
  out.gain.setValueAtTime(0.0001, c.currentTime)
  out.gain.exponentialRampToValueAtTime(level, c.currentTime + 2.5)
  out.connect(dest)
  const sources: AudioScheduledSourceNode[] = []

  // hiss: band-limited white noise
  const hiss = c.createBufferSource()
  hiss.buffer = noiseBuffer(c, 3, 0, 1)
  hiss.loop = true
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 900
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = kind === 'storm' ? 6500 : 5000
  const hissGain = c.createGain()
  hissGain.gain.value = kind === 'storm' ? 0.32 : 0.24
  hiss.connect(hp).connect(lp).connect(hissGain).connect(out)
  hiss.start()
  sources.push(hiss)

  // patter: a second noise layer through a resonant band, wobbling slowly
  const patter = c.createBufferSource()
  patter.buffer = noiseBuffer(c, 2.3, 0, 1)
  patter.loop = true
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2600
  bp.Q.value = 1.4
  const patterGain = c.createGain()
  patterGain.gain.value = 0.22
  const lfo = c.createOscillator()
  const lfoGain = c.createGain()
  lfo.frequency.value = 0.13
  lfoGain.gain.value = 700
  lfo.connect(lfoGain).connect(bp.frequency)
  lfo.start()
  patter.connect(bp).connect(patterGain).connect(out)
  patter.start()
  sources.push(patter, lfo)

  if (kind === 'storm') {
    // low rumble and gusting wind
    const rumble = c.createBufferSource()
    rumble.buffer = noiseBuffer(c, 4, 0.985, 6)
    rumble.loop = true
    const rlp = c.createBiquadFilter()
    rlp.type = 'lowpass'
    rlp.frequency.value = 520
    const rGain = c.createGain()
    rGain.gain.value = 0.55
    const gust = c.createOscillator()
    const gustGain = c.createGain()
    gust.frequency.value = 0.09
    gustGain.gain.value = 260
    gust.connect(gustGain).connect(rlp.frequency)
    gust.start()
    rumble.connect(rlp).connect(rGain).connect(out)
    rumble.start()
    sources.push(rumble, gust)
  }

  return {
    out,
    level,
    stop: () => {
      const t = c.currentTime
      out.gain.cancelScheduledValues(t)
      out.gain.setTargetAtTime(0.0001, t, 0.6)
      window.setTimeout(() => {
        sources.forEach((s) => s.stop())
        out.disconnect()
      }, 2600)
    },
  }
}

/** Slow-attack sine pad: the soft "glory" chords of the finale. */
function pad(freqs: number[], dur: number, vol: number, attack = 0.8, delay = 0) {
  if (!ctx || !master) return
  const t0 = ctx.currentTime + delay
  for (const f of freqs) {
    for (const detune of [-4, 4]) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = f
      osc.detune.value = detune
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(vol, t0 + attack)
      g.gain.setValueAtTime(vol, t0 + Math.max(attack, dur - 1.2))
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      osc.connect(g).connect(master)
      osc.start(t0)
      osc.stop(t0 + dur + 0.05)
    }
  }
}

/** A filtered noise burst with its own envelope (thunder, wing flaps, splashes). */
function noiseShot(dur: number, vol: number, type: BiquadFilterType, freq: number, delay = 0, smooth = 0, attack = 0.01) {
  if (!ctx || !master) return
  const c = ctx
  const t0 = c.currentTime + delay
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, dur, smooth, smooth > 0 ? 5 : 1)
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(f).connect(g).connect(master)
  src.start(t0)
}

export const sfxFlood = {
  /** Rolling thunder; `near` (0..1) adds a soft crack up front. Kept gentle for young players. */
  thunder(near = 0.5) {
    if (near > 0.5) noiseShot(0.35, 0.18 * near, 'highpass', 1400)
    noiseShot(3.2, 0.5 + near * 0.3, 'lowpass', 260 + near * 300, 0.05, 0.985, 0.25)
    noiseShot(2.4, 0.3, 'lowpass', 180, 0.9, 0.99, 0.4)
  },
  /** Wooden door/ramp creak. */
  creak() {
    tone(90, 0.7, 'sawtooth', 0.035, 0, 140)
    tone(70, 0.5, 'sawtooth', 0.03, 0.55, 55)
  },
  /** Heavy thud of the ramp or the ark settling. */
  thud() {
    tone(80, 0.35, 'sine', 0.22, 0, 45)
    noiseShot(0.3, 0.2, 'lowpass', 500)
  },
  splash() {
    noiseShot(0.9, 0.22, 'lowpass', 1800, 0, 0, 0.04)
  },
  /** Soft dove coo: "coo-COO-coo". */
  coo() {
    tone(430, 0.28, 'sine', 0.07, 0, 400)
    tone(520, 0.4, 'sine', 0.08, 0.3, 455)
    tone(440, 0.34, 'sine', 0.06, 0.78, 390)
  },
  flap() {
    for (let i = 0; i < 3; i++) noiseShot(0.09, 0.12, 'bandpass', 900, i * 0.11)
  },
  /** Picking up a star; `i` climbs the scale so a run of stars sings upward. */
  star(i: number) {
    const scale = [1047, 1175, 1319, 1568, 1760, 2093]
    const f = scale[i % scale.length] * (i >= scale.length ? 2 : 1)
    tone(f, 0.18, 'sine', 0.09)
    tone(f * 1.5, 0.3, 'triangle', 0.04, 0.05)
  },
  /** The olive leaf is found. */
  leaf() {
    ;[784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.5, 'sine', 0.08, i * 0.09))
  },
  /** A brick of the rainbow (or the altar) clicking into place. */
  click(pitch = 1) {
    tone(900 * pitch, 0.05, 'square', 0.025)
    tone(1800 * pitch, 0.06, 'sine', 0.03, 0.01)
  },
  /** God remembers Noah: the storm breaks and light returns. */
  dawn() {
    pad([196, 294, 392, 494], 6, 0.03, 2.5)
  },
  /** The rainbow covenant: a rising arpeggio over a big warm chord. */
  rainbow() {
    const arp = [523, 659, 784, 1047, 1319, 1568, 2093]
    arp.forEach((f, i) => tone(f, 0.9, 'sine', 0.06, 0.2 + i * 0.22))
    pad([131, 262, 330, 392, 523], 8, 0.035, 2.2)
  },
  /** Celebration fanfare with the family. */
  celebrate() {
    ;[523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.4, 'triangle', 0.1, i * 0.15))
    pad([262, 330, 392, 523, 659], 5, 0.03, 0.6, 0.9)
  },
  /** Crackle of the altar fire. */
  crackle() {
    for (let i = 0; i < 4; i++) noiseShot(0.05, 0.06, 'highpass', 2500, Math.random() * 0.6)
  },
}
