import { duckAmbience } from './audio'

// Voice-over for scripture lines. Clips live in public/audio/voice/{lang}/{key}.mp3
// and are listed in manifest.json; a missing manifest or clip just means silence.

type Manifest = { clips: Record<string, Record<string, { file: string; duration: number }>> }

let manifest: Manifest | null = null
let loading: Promise<void> | null = null
let current: HTMLAudioElement | null = null
let muted = false

export function loadNarration() {
  loading ??= fetch('/audio/voice/manifest.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((m: Manifest | null) => {
      manifest = m
    })
    .catch(() => {
      manifest = null
    })
  return loading
}

export function setNarrationMuted(m: boolean) {
  muted = m
  if (current) current.muted = m
}

export function stopNarration() {
  if (current) {
    current.pause()
    current = null
  }
  duckAmbience(false)
}

/** Play the clip for `key` (e.g. "call-3", "after", "final") in `lang`, replacing any current line. */
let request = 0
export async function playNarration(lang: string, key: string) {
  const mine = ++request
  stopNarration()
  await loadNarration()
  // a newer line was requested while the manifest loaded: let that one win
  if (mine !== request) return
  stopNarration()
  const clip = manifest?.clips?.[lang]?.[key]
  if (!clip) return
  const a = new Audio(`/audio/voice/${clip.file}`)
  a.muted = muted
  current = a
  a.onended = () => {
    if (current === a) {
      current = null
      duckAmbience(false)
    }
  }
  duckAmbience(true)
  // autoplay can be refused before the first gesture; the game always has one by now
  a.play().catch(() => duckAmbience(false))
}

export function pauseNarration(p: boolean) {
  if (!current) return
  if (p) current.pause()
  else void current.play().catch(() => {})
}

/** Stop the current line and cancel any line still waiting to start. */
export function cancelNarration() {
  request++
  stopNarration()
}
