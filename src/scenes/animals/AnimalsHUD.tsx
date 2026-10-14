// HUD and results for chapter 4. Stud counter, prompt, toasts, touch
// controls and pause menu follow ui/HUD.tsx (copied, since that file is
// owned elsewhere and doesn't export them); the animal tracker fills in an
// icon as each pair walks through the door.
import { useEffect, useRef, useState } from 'react'
import { useGame, useT } from '../../store'
import { input, isTouchDevice, resetInput } from '../../game/input'
import { playNarration } from '../../game/narration'
import { ANIMALS_STRINGS, SPECIES_ICON, SPECIES_ORDER } from '../../i18n/animals'
import { AnimatedText } from '../../ui/AnimatedText'
import { aboardCount, useAnimals, type ActionIcon } from './state'
import './animals.css'

const useA = () => ANIMALS_STRINGS[useGame((s) => s.lang) ?? 'en']

function StudCounter() {
  const s = useT()
  const studs = useGame((st) => st.studs)
  const [bump, setBump] = useState(false)
  const prev = useRef(studs)
  useEffect(() => {
    if (studs > prev.current) {
      setBump(true)
      const id = setTimeout(() => setBump(false), 120)
      prev.current = studs
      return () => clearTimeout(id)
    }
    prev.current = studs
  }, [studs])
  return (
    <div className="studs">
      <div className={`stud-row ${bump ? 'bump' : ''}`}>
        <span className="stud-icon" aria-hidden />
        <span className="stud-num" aria-label={s.studs}>
          {studs.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

/** Eight animal icons that fill in (and pop) as each kind boards. */
function AnimalTracker() {
  const A = useA()
  const status = useAnimals((st) => st.status)
  const sheep = useAnimals((st) => st.sheepFound)
  const n = aboardCount(status)
  return (
    <div className="animal-tracker" aria-label={`${A.pairsAboard} ${n}/${SPECIES_ORDER.length}`}>
      <div className="tracker-head">
        <span className="tracker-label">{n === SPECIES_ORDER.length ? A.objectiveDone : A.objective}</span>
        <span className="tracker-count">
          {n}/{SPECIES_ORDER.length}
        </span>
      </div>
      <ul className="tracker-icons">
        {SPECIES_ORDER.map((id) => (
          <li key={id} className={`tracker-icon is-${status[id]}`} title={A.species[id].name}>
            <span aria-hidden>{SPECIES_ICON[id]}</span>
            {id === 'sheep' && status.sheep !== 'aboard' && sheep > 0 && <em className="tracker-sub">{sheep}/6</em>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Prompt() {
  const prompt = useAnimals((st) => st.prompt)
  const progress = useAnimals((st) => st.buildProgress)
  if (!prompt) return null
  return (
    <div className="prompt">
      {progress !== null && (
        <svg className="ring" viewBox="0 0 36 36" aria-hidden>
          <circle cx="18" cy="18" r="15" className="ring-bg" />
          <circle cx="18" cy="18" r="15" className="ring-fg" strokeDasharray={`${progress * 94.2} 94.2`} />
        </svg>
      )}
      <span>
        {!isTouchDevice && <kbd>E</kbd>} {prompt}
      </span>
    </div>
  )
}

function Toasts() {
  const toasts = useGame((st) => st.toasts)
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.text}
        </div>
      ))}
    </div>
  )
}

function ControlsHint() {
  const A = useA()
  const [show, setShow] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setShow(false), 7000)
    return () => clearTimeout(id)
  }, [])
  if (!show) return null
  return <div className="controls-hint">{isTouchDevice ? A.controlsTouch : A.controlsDesktop}</div>
}

const ACTION_ICON: Record<ActionIcon, string> = { call: '👋', smash: '💥', build: '🔨', bell: '🔔', search: '🌾', catch: '🤲' }

/** Floating joystick on the left half, Action + Jump buttons on the right (same as ui/HUD.tsx). */
function TouchControls() {
  const s = useT()
  const kind = useAnimals((st) => st.promptIcon)
  const base = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLDivElement>(null)
  const origin = useRef<{ x: number; y: number; id: number } | null>(null)
  const RADIUS = 52

  const onDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    origin.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    if (base.current) {
      base.current.style.left = `${e.clientX}px`
      base.current.style.top = `${e.clientY}px`
      base.current.classList.add('active')
    }
  }
  const onMove = (e: React.PointerEvent) => {
    const o = origin.current
    if (!o || o.id !== e.pointerId) return
    let dx = e.clientX - o.x
    let dy = e.clientY - o.y
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS
      dy = (dy / len) * RADIUS
    }
    input.stickX = dx / RADIUS
    input.stickY = dy / RADIUS
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`
  }
  const onUp = (e: React.PointerEvent) => {
    if (origin.current?.id !== e.pointerId) return
    origin.current = null
    input.stickX = input.stickY = 0
    if (knob.current) knob.current.style.transform = 'translate(0px, 0px)'
    base.current?.classList.remove('active')
  }

  return (
    <>
      <div className="stick-zone" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div ref={base} className="stick-base">
          <div ref={knob} className="stick-knob" />
        </div>
      </div>
      <div className="touch-buttons">
        <button
          className="tbtn tbtn-jump"
          aria-label={s.jump}
          onPointerDown={(e) => {
            e.preventDefault()
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
            input.jumpPressed = true
            input.jumpDown = true
          }}
          onPointerUp={() => (input.jumpDown = false)}
          onPointerCancel={() => (input.jumpDown = false)}
        >
          ⤒
        </button>
        <button
          className={`tbtn tbtn-action ${kind ? 'is-context' : ''}`}
          aria-label={s.action}
          onPointerDown={(e) => {
            e.preventDefault()
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
            input.actionDown = true
            input.actionPressed = true
          }}
          onPointerUp={() => (input.actionDown = false)}
          onPointerCancel={() => (input.actionDown = false)}
        >
          <span key={kind ?? 'none'} className={kind ? 'tbtn-icon pop' : 'tbtn-icon'}>
            {kind ? ACTION_ICON[kind] : '✋'}
          </span>
        </button>
      </div>
    </>
  )
}

function PauseMenu({ restart }: { restart: () => void }) {
  const s = useT()
  const setPaused = useGame((st) => st.setPaused)
  const setScreen = useGame((st) => st.setScreen)
  const muted = useGame((st) => st.muted)
  const toggleMuted = useGame((st) => st.toggleMuted)
  return (
    <div className="screen pause">
      <div className="panel pause-panel">
        <h2>{s.paused}</h2>
        <button className="btn btn-primary" onClick={() => setPaused(false)}>
          {s.resume}
        </button>
        <button className="btn" onClick={restart}>
          {s.restart}
        </button>
        <button className="btn" onClick={toggleMuted} aria-pressed={!muted}>
          {s.sound}: {muted ? s.soundOff : s.soundOn}
        </button>
        <button className="btn btn-ghost" onClick={() => setScreen('language')}>
          {s.language}
        </button>
      </div>
    </div>
  )
}

function Caption() {
  const A = useA()
  const on = useAnimals((st) => st.caption)
  if (!on) return null
  return (
    <div className="animals-caption">
      <AnimatedText text={A.closingCaption} by="word" step={0.12} delay={0.1} />
    </div>
  )
}

export function AnimalsHUDView({ restart }: { restart: () => void }) {
  const s = useT()
  const paused = useGame((st) => st.paused)
  const setPaused = useGame((st) => st.setPaused)
  const phase = useAnimals((st) => st.phase)
  useEffect(() => {
    resetInput()
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') setPaused(!useGame.getState().paused)
    }
    const onHide = () => document.hidden && setPaused(true)
    window.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [setPaused])
  useEffect(() => resetInput(), [paused])
  const playing = phase === 'play'
  const storm = useAnimals((st) => st.storm)
  return (
    <div className="hud animals-hud">
      <div className="storm-vignette" style={{ opacity: phase === 'play' ? storm * 0.9 : 1 }} aria-hidden />
      <StudCounter />
      <div className="hud-right">
        <button className="btn-icon" aria-label={s.pause} onClick={() => setPaused(true)}>
          ❚❚
        </button>
        <AnimalTracker />
      </div>
      <div id="animals-edge-arrow" className="edge-arrow" aria-hidden />
      <Toasts />
      {playing && <Prompt />}
      {playing && <ControlsHint />}
      <Caption />
      {isTouchDevice && !paused && playing && <TouchControls />}
      {paused && <PauseMenu restart={restart} />}
    </div>
  )
}

/** Results: Genesis 7:16, the animals aboard, the stud tally. */
export function AnimalsResults({ restart }: { restart: () => void }) {
  const s = useT()
  const A = useA()
  const studs = useGame((st) => st.studs)
  const setScreen = useGame((st) => st.setScreen)
  const lang = useGame((st) => st.lang) ?? 'en'
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = setTimeout(() => void playNarration(lang, 'animals-final'), 900)
    return () => clearTimeout(id)
  }, [lang])
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / 1400)
      setShown(Math.round(studs * (1 - (1 - k) ** 3)))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [studs])
  return (
    <div className="screen complete">
      <div className="panel complete-panel">
        <h2 className="complete-title">
          <AnimatedText text={A.resultsTitle} variant="drop" step={0.04} delay={0.2} />
        </h2>
        <blockquote className="scripture">
          <AnimatedText text={`“${A.verse.text}”`} by="word" step={0.06} delay={0.7} />
          <cite>{A.verse.ref}</cite>
        </blockquote>
        <div className="results-animals" aria-label={A.resultsAnimals}>
          {SPECIES_ORDER.map((id, i) => (
            <span key={id} className="results-animal" style={{ animationDelay: `${1.2 + i * 0.12}s` }} title={A.species[id].name}>
              {SPECIES_ICON[id]}
            </span>
          ))}
        </div>
        <div className="tally">
          <span className="stud-icon" aria-hidden />
          <span className="tally-num">{shown.toLocaleString()}</span>
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={() => setScreen('chapterFlood')}>
            {s.continue}
          </button>
          <button className="btn btn-ghost" onClick={restart}>
            {s.playAgain}
          </button>
          <button className="btn btn-ghost" onClick={() => setScreen('language')}>
            {s.language}
          </button>
        </div>
      </div>
    </div>
  )
}
