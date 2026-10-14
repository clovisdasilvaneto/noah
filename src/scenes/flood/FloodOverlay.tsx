import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { Line } from '../../i18n/strings'
import { DOVE_AFTER, FLOOD, type FloodStrings } from '../../i18n/flood'
import { useGame, useT } from '../../store'
import { sfx, unlockAudio } from '../../game/audio'
import { cancelNarration, playNarration } from '../../game/narration'
import { isTouchDevice } from '../../game/input'
import { AnimatedText } from '../../ui/AnimatedText'
import { pending, resetFlood, setDoveStage, setPhase, story, useFlood } from './state'
import { END_BEAT } from './sim'
import './flood.css'

const CHARS_PER_SEC = 42

/**
 * Scripture box for the finale (same look as the shared Dialogue). It knows
 * its place in the whole chapter, so the counter reads 9/14 after the dove.
 */
function FloodDialogue({ lines, from, to, onDone, onSkip }: { lines: Line[]; from: number; to: number; onDone: () => void; onSkip: () => void }) {
  const s = useT()
  const lang = useGame((st) => st.lang) ?? 'en'
  const [index, setIndex] = useState(from)
  const [typed, setTyped] = useState({ line: from, n: 0 })
  const chars = typed.line === index ? typed.n : 0
  const line = lines[index]
  const full = chars >= line.text.length

  useEffect(() => {
    story.line = index
    void playNarration(lang, `flood-${index}`)
    if (line.speaker === 'god' && lines[index - 1]?.speaker !== 'god') sfx.divine()
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const n = Math.floor(((now - start) / 1000) * CHARS_PER_SEC)
      setTyped((prev) => (prev.line === index && prev.n >= n ? prev : { line: index, n }))
      if (n < line.text.length) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [index, line, lines, lang])

  const advance = useCallback(() => {
    if (!full) {
      setTyped({ line: index, n: line.text.length })
      return
    }
    if (index < to) setIndex(index + 1)
    else onDone()
  }, [full, index, line.text.length, to, onDone])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [advance])

  return (
    <div className="dialogue-layer" onClick={advance}>
      <button
        className="btn btn-ghost skip"
        onClick={(e) => {
          e.stopPropagation()
          onSkip()
        }}
      >
        {s.skip} ›
      </button>
      <div className={`dialogue ${line.speaker === 'god' ? 'is-god' : ''}`} role="dialog" aria-live="polite">
        <div className="dialogue-head">
          <span className="speaker" key={`${index}-${line.speaker}`}>
            {line.speaker === 'god' ? s.god : s.narrator}
          </span>
          {line.ref && <span className="ref">{line.ref}</span>}
        </div>
        <p className="dialogue-text" key={index} aria-label={line.text}>
          {[...line.text.slice(0, chars)].map((ch, i) => (
            <span key={i} className="tw-char" aria-hidden>
              {ch}
            </span>
          ))}
          <span className="ghost" aria-hidden>
            {line.text.slice(chars)}
          </span>
        </p>
        <div className="dialogue-foot">
          <span className="source">{line.ref ? s.bibleSource : ''}</span>
          <span className={`next ${full ? 'on' : ''}`}>
            {index + 1}/{lines.length} ▸
          </span>
        </div>
      </div>
    </div>
  )
}

/** The interactive dove flight: tap to release, then steer with a finger, the mouse or the arrow keys. */
function DoveMoment({ f }: { f: FloodStrings }) {
  const s = useT()
  const stage = useFlood((st) => st.doveStage)
  const stars = useFlood((st) => st.stars)
  const [hintGone, setHintGone] = useState(false)
  const layer = useRef<HTMLDivElement>(null)

  useEffect(() => cancelNarration(), [])
  useEffect(() => {
    if (stage !== 'fly') return
    const id = setTimeout(() => setHintGone(true), 5500)
    return () => clearTimeout(id)
  }, [stage])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'Enter') && story.dove.stage === 'ready') {
        e.preventDefault()
        story.dove.release = true
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  const steer = (e: RPointerEvent) => {
    if (story.dove.stage !== 'fly') return
    // touch steers only while the finger is down; a mouse steers by hovering
    if (e.pointerType !== 'mouse' && e.buttons === 0 && e.type === 'pointermove') return
    const r = layer.current!.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 2 - 1
    const y = -(((e.clientY - r.top) / r.height) * 2 - 1)
    story.dove.tx = Math.max(-1, Math.min(1, x * 1.35))
    story.dove.ty = Math.max(-1, Math.min(1, (y - 0.1) * 1.5))
    story.dove.idle = 0
  }

  const release = () => {
    unlockAudio()
    if (story.dove.stage === 'ready') story.dove.release = true
  }

  const skip = () => {
    setDoveStage('done')
    setPhase('storyB', DOVE_AFTER + 1)
  }

  return (
    <div
      ref={layer}
      className={`dove-layer stage-${stage}`}
      onPointerDown={(e) => {
        release()
        steer(e)
      }}
      onPointerMove={steer}
    >
      <button
        className="btn btn-ghost skip"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          skip()
        }}
      >
        {s.skip} ›
      </button>
      {stage === 'ready' && (
        <div className="dove-ready">
          <div className="dove-title">
            <AnimatedText text={f.doveTitle} by="word" step={0.12} delay={0.1} />
          </div>
          <button className="dove-btn" aria-label={f.doveTitle} onClick={release}>
            <DoveIcon />
          </button>
          <div className="dove-hint">{isTouchDevice ? f.doveTap : f.doveTapKeys}</div>
        </div>
      )}
      {(stage === 'fly' || stage === 'found' || stage === 'return') && (
        <div className="dove-stars" aria-live="polite">
          <span className="dove-star-icon" aria-hidden>
            ★
          </span>
          <span className="dove-star-num" key={stars}>
            {stars}
          </span>
          <span className="dove-star-label">{f.stars}</span>
        </div>
      )}
      {stage === 'fly' && !hintGone && <div className="dove-steer">{isTouchDevice ? f.doveSteer : f.doveSteerKeys}</div>}
      {stage === 'found' && (
        <div className="dove-found">
          <AnimatedText text={f.doveFound} variant="drop" step={0.04} />
        </div>
      )}
    </div>
  )
}

function DoveIcon() {
  // a little brick dove, drawn in SVG
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden>
      <rect x="14" y="30" width="30" height="14" rx="3" fill="#fff" />
      <rect x="38" y="22" width="12" height="12" rx="2" fill="#fff" />
      <rect x="50" y="26" width="7" height="5" rx="1" fill="#e57a1f" />
      <circle cx="45" cy="26" r="1.8" fill="#1d1d1f" />
      <rect x="6" y="32" width="10" height="6" rx="2" fill="#e9eef2" />
      <path d="M20 31 L34 12 L40 14 L32 31 Z" fill="#eef3f7" stroke="#cfd8df" strokeWidth="1" />
      <rect x="44" y="34" width="10" height="4" rx="2" fill="#5f9e2f" transform="rotate(-20 49 36)" />
    </svg>
  )
}

/** "The End": title, rolling credits and the ways back. */
function EndCard({ f }: { f: FloodStrings }) {
  const s = useT()
  const setScreen = useGame((st) => st.setScreen)
  const stars = useFlood((st) => st.stars)
  useEffect(() => {
    story.line = END_BEAT
    cancelNarration()
  }, [])
  return (
    <div className="screen flood-end">
      <div className="end-top">
        <h1 className="end-title">
          <AnimatedText text={f.theEnd} variant="float" step={0.08} delay={0.3} />
        </h1>
        <div className="end-thanks">{f.thanks}</div>
      </div>
      <div className="credits" aria-label="Credits">
        <div className="credits-roll">
          <div className="credit-game">
            {s.gameTitle}
            <span>{s.gameSubtitle}</span>
          </div>
          {stars > 0 && (
            <div className="credit">
              <span className="credit-h">★ {f.stars}</span>
              <span className="credit-v">{stars}</span>
            </div>
          )}
          {f.credits.map((c) => (
            <div className="credit" key={c.h}>
              <span className="credit-h">{c.h}</span>
              <span className="credit-v">{c.v}</span>
            </div>
          ))}
          <blockquote className="credit-verse">
            “{f.lines[END_BEAT - 2].text}”<cite>{f.lines[END_BEAT - 2].ref}</cite>
          </blockquote>
        </div>
      </div>
      <div className="row end-actions">
        <button className="btn btn-primary btn-big" onClick={() => setScreen('title')}>
          {s.playAgain}
        </button>
        <button className="btn btn-ghost" onClick={() => setScreen('language')}>
          {s.language}
        </button>
      </div>
    </div>
  )
}

/** Overlay for the finale: scripture, the dove moment and the end card. */
export function FloodOverlay() {
  const lang = useGame((st) => st.lang) ?? 'en'
  const f = FLOOD[lang]
  const phase = useFlood((st) => st.phase)
  const startAt = useFlood((st) => st.startAt)
  const run = useFlood((st) => st.run)

  useEffect(() => {
    // a dev jump made just now picks the starting point; otherwise start from the top
    const j = pending.jump
    if (j && performance.now() - j.at < 4000) resetFlood(j.phase, j.line)
    else resetFlood()
  }, [])

  const toDove = useCallback(() => setPhase('dove', DOVE_AFTER), [])
  const toEnd = useCallback(() => {
    cancelNarration()
    story.snap = true
    setPhase('end', END_BEAT)
  }, [])

  return (
    <>
      {phase === 'storyA' && (
        <FloodDialogue key={`a${run}-${startAt}`} lines={f.lines} from={Math.min(startAt, DOVE_AFTER)} to={DOVE_AFTER} onDone={toDove} onSkip={toEnd} />
      )}
      {phase === 'dove' && <DoveMoment key={`d${run}`} f={f} />}
      {phase === 'storyB' && (
        <FloodDialogue
          key={`b${run}-${startAt}`}
          lines={f.lines}
          from={Math.max(startAt, DOVE_AFTER + 1)}
          to={f.lines.length - 1}
          onDone={() => setPhase('end', END_BEAT)}
          onSkip={toEnd}
        />
      )}
      {phase === 'end' && <EndCard key={`e${run}`} f={f} />}
    </>
  )
}
