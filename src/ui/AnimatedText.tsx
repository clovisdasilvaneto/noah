import type { CSSProperties } from 'react'

/**
 * Text that animates in letter-by-letter or word-by-word (rise + blur + fade),
 * staggered with CSS animation delays so it costs nothing per frame. Words stay
 * unbreakable so wrapping looks natural. `variant` picks the CSS motion.
 */
export function AnimatedText({
  text,
  by = 'letter',
  delay = 0,
  step = by === 'letter' ? 0.035 : 0.09,
  variant = 'rise',
  className,
}: {
  text: string
  by?: 'letter' | 'word'
  delay?: number
  step?: number
  variant?: 'rise' | 'drop' | 'float'
  className?: string
}) {
  const words = text.split(' ')
  let i = 0
  return (
    <span className={`anim-text anim-${variant} ${className ?? ''}`} aria-label={text}>
      {words.map((w, wi) => {
        const wordDelay = delay + i * step
        const node =
          by === 'word' ? (
            <span key={wi} className="anim-unit" aria-hidden style={{ '--d': `${wordDelay}s`, '--i': wi } as CSSProperties}>
              {w}
            </span>
          ) : (
            <span key={wi} className="anim-word" aria-hidden>
              {[...w].map((ch, ci) => (
                <span key={ci} className="anim-unit" style={{ '--d': `${delay + (i + ci) * step}s`, '--i': i + ci } as CSSProperties}>
                  {ch}
                </span>
              ))}
            </span>
          )
        i += by === 'word' ? 1 : w.length + 1
        return (
          <span key={wi}>
            {node}
            {wi < words.length - 1 ? ' ' : ''}
          </span>
        )
      })}
    </span>
  )
}
