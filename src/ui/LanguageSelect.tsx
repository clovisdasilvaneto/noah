import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, PointerEvent } from 'react'
import { LANGS } from '../i18n/strings'
import type { Lang } from '../i18n/strings'
import { useGame } from '../store'
import { unlockAudio } from '../game/audio'
import { AnimatedText } from './AnimatedText'
import { FLAG_COUNTRY, flagDataUrl } from './flags/flagArt'
import { FlagRenderer } from './flags/FlagRenderer'
import './ui-polish.css'

const LOCALE: Record<Lang, string> = { pt: 'pt-BR', en: 'en-GB', es: 'es-ES', de: 'de-DE' }
const SWITCH_DELAY = 450
const PIECE_COLORS = ['#c9292f', '#e8b923', '#3d9b3a', '#2a6fd6', '#fff8e1']

type Burst = { id: number; x: number; y: number; pieces: CSSProperties[] }

let burstId = 0

function makeBurst(x: number, y: number): Burst {
  const pieces: CSSProperties[] = []
  const n = 16
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4
    const dist = 60 + Math.random() * 70
    pieces.push({
      '--dx': `${Math.cos(a) * dist}px`,
      '--dy': `${Math.sin(a) * dist - 20}px`,
      '--rot': `${Math.round((Math.random() - 0.5) * 540)}deg`,
      '--c': PIECE_COLORS[i % PIECE_COLORS.length],
      '--delay': `${Math.random() * 60}ms`,
    } as CSSProperties)
  }
  return { id: ++burstId, x, y, pieces }
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export function LanguageSelect() {
  const setLang = useGame((s) => s.setLang)
  const setScreen = useGame((s) => s.setScreen)
  const current = useGame((s) => s.lang)

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const discRefs = useRef<(HTMLSpanElement | null)[]>([])
  const rendererRef = useRef<FlagRenderer | null>(null)
  const chosenRef = useRef(false)
  const timerRef = useRef(0)
  const [glOn, setGlOn] = useState(false)
  const [chosen, setChosen] = useState<Lang | null>(null)
  const [bursts, setBursts] = useState<Burst[]>([])
  const [reduced] = useState(prefersReducedMotion)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const r = new FlagRenderer(canvas, () => discRefs.current, reduced, setGlOn)
    rendererRef.current = r
    void r.start()
    // the animated loop re-measures every frame; the still (reduced-motion) one needs a nudge
    const ro = new ResizeObserver(() => r.invalidate())
    ro.observe(canvas)
    void document.fonts?.ready.then(() => r.invalidate())
    return () => {
      ro.disconnect()
      r.dispose()
      rendererRef.current = null
    }
  }, [reduced])

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const setDisc = (i: number, patch: Partial<{ hover: number; press: number }>) => {
    const r = rendererRef.current
    if (!r) return
    Object.assign(r.states[i], patch)
    r.invalidate()
  }

  const onPointerDown = (i: number) => (e: PointerEvent<HTMLButtonElement>) => {
    const disc = discRefs.current[i]
    const r = rendererRef.current
    if (!disc || !r) return
    const b = disc.getBoundingClientRect()
    r.states[i].pressPt = [(e.clientX - b.left) / b.width, 1 - (e.clientY - b.top) / b.height]
    r.states[i].pressAt = performance.now()
    setDisc(i, { press: 1 })
  }

  const choose = (i: number, code: Lang) => (e: MouseEvent<HTMLButtonElement>) => {
    if (chosenRef.current) return
    chosenRef.current = true
    unlockAudio()
    setLang(code)
    if (reduced) {
      setScreen('title')
      return
    }
    setChosen(code)
    const wrap = wrapRef.current
    const disc = discRefs.current[i]
    const r = rendererRef.current
    if (wrap && disc) {
      const wb = wrap.getBoundingClientRect()
      const db = disc.getBoundingClientRect()
      // keyboard clicks have detail 0 and no pointer position: burst from the centre
      const fromPointer = e.detail > 0 && e.clientX > 0
      const x = fromPointer ? e.clientX : db.left + db.width / 2
      const y = fromPointer ? e.clientY : db.top + db.height / 2
      setBursts((bs) => [...bs, makeBurst(x - wb.left, y - wb.top)])
      if (r && (!fromPointer || performance.now() - r.states[i].pressAt > 400)) {
        r.states[i].pressPt = [0.5, 0.5]
        r.states[i].pressAt = performance.now()
      }
    }
    if (r) {
      r.states[i].hover = 1
      r.invalidate()
    }
    timerRef.current = window.setTimeout(() => setScreen('title'), SWITCH_DELAY)
  }

  return (
    <div className="screen backdrop lang-screen" style={{ backgroundImage: 'url(/art/title.jpg)' }}>
      <div className="lang-stage">
        <h1 className="lang-heading">
          <AnimatedText text="Escolha · Choose · Elige · Wähle" by="word" step={0.12} />
        </h1>
        <div ref={wrapRef} className={`lang-flags ${glOn ? 'gl-on' : ''} ${chosen ? 'has-chosen' : ''}`}>
          <canvas ref={canvasRef} className="lang-gl" aria-hidden />
          {LANGS.map((l, i) => (
            <button
              key={l.code}
              type="button"
              className={`flag-btn ${current === l.code ? 'is-current' : ''} ${chosen === l.code ? 'is-chosen' : ''}`}
              aria-label={`${l.name} (${FLAG_COUNTRY[l.code]})`}
              aria-current={current === l.code ? 'true' : undefined}
              lang={LOCALE[l.code]}
              style={{ '--i': i } as CSSProperties}
              onPointerDown={onPointerDown(i)}
              onPointerUp={() => setDisc(i, { press: 0 })}
              onPointerCancel={() => setDisc(i, { press: 0 })}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setDisc(i, { hover: 1 })}
              onPointerLeave={() => setDisc(i, { hover: 0, press: 0 })}
              onFocus={() => setDisc(i, { hover: 1 })}
              onBlur={() => setDisc(i, { hover: 0 })}
              onClick={choose(i, l.code)}
            >
              <span
                ref={(el) => {
                  discRefs.current[i] = el
                }}
                className="flag-disc"
                style={{ '--flag': `url("${flagDataUrl(l.code)}")` } as CSSProperties}
              >
                <span className="flag-gloss" />
              </span>
              <span className="flag-name">{l.name}</span>
            </button>
          ))}
          <div className="lang-fx" aria-hidden>
            {bursts.map((b) => (
              <div key={b.id} className="burst" style={{ left: b.x, top: b.y }}>
                <span className="burst-ring" />
                {b.pieces.map((p, j) => (
                  <span key={j} className={j % 3 === 0 ? 'burst-spark' : 'burst-brick'} style={p} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
