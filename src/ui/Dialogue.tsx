import { useCallback, useEffect, useRef, useState } from 'react'
import type { Line } from '../i18n/strings'
import { useT } from '../store'
import { sfx } from '../game/audio'

const CHARS_PER_SEC = 42

/**
 * Scripture dialogue box with a typewriter reveal. Tap/Space finishes the
 * line, a second tap advances. Mirrors the current line into `onLine`.
 */
export function Dialogue({
  lines,
  onLine,
  onDone,
  letterbox = false,
}: {
  lines: Line[]
  onLine: (i: number) => void
  onDone: () => void
  /** cinematic black bars that slide in at the top and bottom */
  letterbox?: boolean
}) {
  const s = useT()
  const [index, setIndex] = useState(0)
  // typed count is tagged with its line so a new line never renders fully for a frame
  const [typed, setTyped] = useState({ line: 0, n: 0 })
  const chars = typed.line === index ? typed.n : 0
  const line = lines[index]
  const full = chars >= line.text.length
  const lastGod = useRef(-1)

  useEffect(() => {
    onLine(index)
    if (line.speaker === 'god' && lastGod.current === -1) sfx.divine()
    if (line.speaker === 'god') lastGod.current = index
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const n = Math.floor(((now - start) / 1000) * CHARS_PER_SEC)
      // never move backwards (a tap may have already revealed the whole line)
      setTyped((prev) => (prev.line === index && prev.n >= n ? prev : { line: index, n }))
      if (n < line.text.length) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [index, line, onLine])

  const advance = useCallback(() => {
    if (!full) {
      setTyped({ line: index, n: line.text.length })
      return
    }
    if (index < lines.length - 1) setIndex(index + 1)
    else onDone()
  }, [full, index, line.text.length, lines.length, onDone])

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
      {letterbox && <Letterbox />}
      <button
        className="btn btn-ghost skip"
        onClick={(e) => {
          e.stopPropagation()
          onDone()
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
          {/* each revealed letter rises in with a soft blur; the rest holds the layout */}
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

const BAR: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  height: 'min(7vh, 56px)',
  background: '#000',
  pointerEvents: 'none',
  transition: 'transform 1.1s cubic-bezier(0.2, 0.7, 0.2, 1)',
}

function Letterbox() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <>
      <div aria-hidden style={{ ...BAR, top: 0, transform: on ? 'none' : 'translateY(-100%)' }} />
      <div aria-hidden style={{ ...BAR, bottom: 0, transform: on ? 'none' : 'translateY(100%)' }} />
    </>
  )
}
