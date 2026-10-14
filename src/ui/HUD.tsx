import { useEffect, useRef, useState } from 'react'
import { COAT_GOAL, DECK_GOAL, FAITH_GOAL, PITCH_GOAL, PLANK_GOAL, WOOD_GOAL, coatCount, useGame, useT } from '../store'
import { input, isTouchDevice, resetInput } from '../game/input'

function Objectives() {
  const s = useT()
  const wood = useGame((st) => st.wood)
  const pitch = useGame((st) => st.pitch)
  const cauldron = useGame((st) => st.cauldronBuilt)
  const keel = useGame((st) => st.keelBuilt)
  const planks = useGame((st) => st.planks)
  const decks = useGame((st) => st.decks)
  const coats = coatCount(useGame((st) => st.coatMask))
  const roof = useGame((st) => st.roofBuilt)
  const door = useGame((st) => st.arkComplete)
  const counted = (n: number, goal: number) => `${Math.min(n, goal)}/${goal}`
  const items = [
    { label: s.objWood, done: wood >= WOOD_GOAL, count: counted(wood, WOOD_GOAL) },
    { label: s.objCauldron, done: cauldron, count: '' },
    { label: s.objPitch, done: pitch >= PITCH_GOAL, count: counted(pitch, PITCH_GOAL) },
    { label: s.objKeel, done: keel, count: '' },
    { label: s.objPlanks, done: planks >= PLANK_GOAL, count: counted(planks, PLANK_GOAL) },
    { label: s.objDecks, done: decks >= DECK_GOAL, count: counted(decks, DECK_GOAL) },
    { label: s.objCoat, done: coats >= COAT_GOAL, count: counted(coats, COAT_GOAL) },
    { label: s.objRoof, done: roof, count: '' },
    { label: s.objDoor, done: door, count: '' },
  ]
  const current = items.findIndex((i) => !i.done)
  // keep it short on phones: the last finished step, the current one (later ones are hidden by CSS)
  const first = current === -1 ? items.length - 1 : Math.max(0, current - 1)
  return (
    <ul className="objectives">
      {items.map((it, i) =>
        i < first ? null : (
          <li key={i} className={`${it.done ? 'done' : ''} ${i === current ? 'current' : ''} ${i > current && current !== -1 ? 'later' : ''}`}>
            <span className="check" aria-hidden>
              {it.done ? '✔' : i + 1}
            </span>
            <span className="obj-label">{it.label}</span>
            {it.count && <span className="obj-count">{it.count}</span>}
          </li>
        ),
      )}
    </ul>
  )
}

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
  const pct = Math.min(1, studs / FAITH_GOAL)
  return (
    <div className="studs">
      <div className={`stud-row ${bump ? 'bump' : ''}`}>
        <span className="stud-icon" aria-hidden />
        <span className="stud-num" aria-label={s.studs}>
          {studs.toLocaleString()}
        </span>
      </div>
      <div className="faith" title={s.faithMeter}>
        <div className="faith-fill" style={{ width: `${pct * 100}%` }} />
        <span className="faith-label">{pct >= 1 ? `★ ${s.faithful}` : s.faithMeter}</span>
      </div>
    </div>
  )
}

function Prompt() {
  const prompt = useGame((st) => st.prompt)
  const progress = useGame((st) => st.buildProgress)
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
  const s = useT()
  const [show, setShow] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setShow(false), 7000)
    return () => clearTimeout(id)
  }, [])
  if (!show) return null
  return (
    <div className="controls-hint">
      {isTouchDevice ? s.controlsTouch : s.controlsDesktop}
    </div>
  )
}

/** Floating joystick on the left half, Action + Jump buttons on the right. */
const ACTION_ICON = { chop: '🪓', smash: '💥', build: '🔨' } as const

function TouchControls() {
  const s = useT()
  const kind = useGame((st) => st.promptKind)
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
          {/* the icon changes with context so non-readers know what will happen */}
          <span key={kind ?? 'none'} className={kind ? 'tbtn-icon pop' : 'tbtn-icon'}>
            {kind ? ACTION_ICON[kind] : '✋'}
          </span>
        </button>
      </div>
    </>
  )
}

function PauseMenu() {
  const s = useT()
  const setPaused = useGame((st) => st.setPaused)
  const restart = useGame((st) => st.restartLevel)
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
        <button className="btn" onClick={() => restart()}>
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

export function HUD() {
  const s = useT()
  const paused = useGame((st) => st.paused)
  const setPaused = useGame((st) => st.setPaused)
  // the celebration plays hands-free
  const won = useGame((st) => st.arkComplete)
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
  return (
    <div className="hud">
      <StudCounter />
      <div className="hud-right">
        <button className="btn-icon" aria-label={s.pause} onClick={() => setPaused(true)}>
          ❚❚
        </button>
        <Objectives />
      </div>
      <div id="edge-arrow" className="edge-arrow" aria-hidden />
      <Toasts />
      <Prompt />
      <ControlsHint />
      {isTouchDevice && !paused && !won && <TouchControls />}
      {paused && <PauseMenu />}
    </div>
  )
}
