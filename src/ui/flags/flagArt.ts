import type { Lang } from '../../i18n/strings'

/**
 * Flags drawn in code as square SVGs, composed for a round crop (the button
 * disc). The same markup feeds the WebGL texture atlas and the CSS fallback,
 * so there is nothing to download and nothing that depends on emoji fonts.
 *
 * EN uses the Union Flag: it is the language's home flag, and its symmetric
 * crosses read well inside a circle (the US canton would be cut off).
 */

const S = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"'

// five-point star, centred on (x, y)
function star(x: number, y: number, r: number) {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.42 : r
    pts.push(`${(x + Math.cos(a) * rr).toFixed(2)},${(y + Math.sin(a) * rr).toFixed(2)}`)
  }
  return `<polygon points="${pts.join(' ')}" fill="#fff"/>`
}

const brazilStars = [
  [41, 56, 1.6],
  [46, 61, 1.3],
  [52, 58, 1.5],
  [57, 63, 1.2],
  [60, 55, 1.4],
  [50, 66, 1.3],
  [44, 52, 1.0],
  [55, 51, 1.0],
  [63, 60, 1.0],
  [38, 61, 1.0],
]
  .map(([x, y, r]) => star(x, y, r))
  .join('')

const brazil = `<svg ${S}>
<rect width="100" height="100" fill="#009c3b"/>
<polygon points="7,50 50,19 93,50 50,81" fill="#ffdf00"/>
<circle cx="50" cy="50" r="18.5" fill="#002776"/>
<clipPath id="g"><circle cx="50" cy="50" r="18.5"/></clipPath>
<path d="M28 47 Q50 38 74 52 L73 56.5 Q50 43 28 51.5 Z" fill="#fff" clip-path="url(#g)"/>
${brazilStars}
</svg>`

const unionFlag = `<svg ${S}>
<rect width="100" height="100" fill="#012169"/>
<clipPath id="u"><rect width="100" height="100"/></clipPath>
<g clip-path="url(#u)">
<clipPath id="t"><path d="M50 50 H100 V100 Z V100 H0 Z H0 V0 Z V0 H100 Z"/></clipPath>
<path d="M0 0 L100 100 M100 0 L0 100" stroke="#fff" stroke-width="20"/>
<path d="M0 0 L100 100 M100 0 L0 100" stroke="#c8102e" stroke-width="13" clip-path="url(#t)"/>
<path d="M50 0 V100 M0 50 H100" stroke="#fff" stroke-width="30"/>
<path d="M50 0 V100 M0 50 H100" stroke="#c8102e" stroke-width="18"/>
</g>
</svg>`

const spain = `<svg ${S}>
<rect width="100" height="100" fill="#aa151b"/>
<rect y="25" width="100" height="50" fill="#f1bf00"/>
</svg>`

const germany = `<svg ${S}>
<rect width="100" height="34" fill="#000"/>
<rect y="33.3" width="100" height="33.4" fill="#dd0000"/>
<rect y="66.6" width="100" height="33.4" fill="#ffce00"/>
</svg>`

export const FLAG_ORDER: Lang[] = ['pt', 'en', 'es', 'de']

export const FLAG_SVG: Record<Lang, string> = { pt: brazil, en: unionFlag, es: spain, de: germany }

export const FLAG_COUNTRY: Record<Lang, string> = {
  pt: 'Brasil',
  en: 'United Kingdom',
  es: 'España',
  de: 'Deutschland',
}

export function flagDataUrl(lang: Lang) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(FLAG_SVG[lang])}`
}

/** Rasterise all four flags side by side into one canvas (texture atlas). */
export async function buildFlagAtlas(tile = 512): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = tile * FLAG_ORDER.length
  canvas.height = tile
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d canvas unavailable')
  const imgs = await Promise.all(
    FLAG_ORDER.map(
      (l) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image(tile, tile)
          img.onload = () => resolve(img)
          img.onerror = () => reject(new Error(`flag ${l} failed to rasterise`))
          img.src = flagDataUrl(l)
        }),
    ),
  )
  imgs.forEach((img, i) => ctx.drawImage(img, i * tile, 0, tile, tile))
  return canvas
}
