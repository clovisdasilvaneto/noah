import { useEffect, useState } from 'react'
import { FAITH_GOAL, useGame, useT } from '../store'
import { unlockAudio } from '../game/audio'
import { playNarration } from '../game/narration'
import { AnimatedText } from './AnimatedText'

export function TitleScreen() {
  const s = useT()
  const setScreen = useGame((st) => st.setScreen)
  return (
    <div className="screen backdrop" style={{ backgroundImage: 'url(/art/title.jpg)' }}>
      <div className="title-block">
        <h1 className="game-title">
          <AnimatedText key={s.gameTitle} text={s.gameTitle} variant="float" step={0.06} delay={0.1} />
        </h1>
        <div className="game-subtitle shimmer">{s.gameSubtitle}</div>
        <button
          className="btn btn-primary btn-big"
          onClick={() => {
            unlockAudio()
            setScreen('chapterCall')
          }}
        >
          {s.play}
        </button>
        <button className="btn btn-ghost" onClick={() => setScreen('language')}>
          {s.language}
        </button>
      </div>
    </div>
  )
}

/** Painted chapter card between scenes. Auto-advances, tap to skip. */
export function ChapterCard({ number, title, image, next }: { number: number; title: string; image: string; next: () => void }) {
  const s = useT()
  useEffect(() => {
    const id = setTimeout(next, 4200)
    return () => clearTimeout(id)
  }, [next])
  return (
    <button className="screen backdrop chapter-card" style={{ backgroundImage: `url(${image})` }} onClick={next}>
      <div className="chapter-inner">
        <div className="chapter-num">
          {s.chapter} {number}
        </div>
        <div className="chapter-title">
          <AnimatedText text={title} by="word" step={0.18} delay={0.35} />
        </div>
        <div className="tap-hint">{s.tapToContinue}</div>
      </div>
    </button>
  )
}

export function CompleteScreen() {
  const s = useT()
  const studs = useGame((st) => st.studs)
  const restart = useGame((st) => st.restartLevel)
  const setScreen = useGame((st) => st.setScreen)
  const faithful = studs >= FAITH_GOAL
  const [shown, setShown] = useState(0)
  const lang = useGame((st) => st.lang) ?? 'en'
  useEffect(() => {
    // read Genesis 6:22 aloud once the verse has animated in
    const id = setTimeout(() => void playNarration(lang, 'final'), 900)
    return () => clearTimeout(id)
  }, [lang])
  useEffect(() => {
    // count the studs up like the end-of-level tally
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
          <AnimatedText text={s.levelComplete} variant="drop" step={0.04} delay={0.2} />
        </h2>
        <div className="complete-ark" style={{ fontWeight: 700, opacity: 0.85 }}>
          {s.completeArk}
        </div>
        <blockquote className="scripture">
          <AnimatedText text={`“${s.finalVerse.text}”`} by="word" step={0.07} delay={0.7} />
          <cite>{s.finalVerse.ref}</cite>
        </blockquote>
        <div className="tally">
          <span className="stud-icon" aria-hidden />
          <span className="tally-num">{shown.toLocaleString()}</span>
        </div>
        <div className={`faith-badge ${faithful ? 'earned' : ''}`}>
          {faithful ? `★ ${s.faithful}` : `${s.faithMeter}: ${Math.min(100, Math.round((studs / FAITH_GOAL) * 100))}%`}
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={() => setScreen('chapterAnimalsCall')}>
            {s.continue}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              restart()
              setScreen('gather')
            }}
          >
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
