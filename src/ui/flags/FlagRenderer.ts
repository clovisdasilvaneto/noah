import { FLAG_ORDER, buildFlagAtlas } from './flagArt'

/**
 * One raw-WebGL canvas that paints all four flag discs. The canvas sits behind
 * the DOM buttons; every frame we read each disc's on-screen rect (so CSS
 * squash/bounce transforms are followed for free) and draw one quad per disc
 * into a scissored viewport. One context, one program, one texture atlas,
 * four draw calls.
 *
 * Frame budget: the cloth wave idles at 30 fps and only goes to the display
 * rate while a disc is hovered or rippling. Rendering stops when the tab is
 * hidden (rAF pauses) and when the component unmounts.
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uTile;      // which flag in the atlas
uniform float uTime;
uniform float uAmp;       // 0 = still (reduced motion), 1 = waving
uniform float uHover;     // 0..1 eased
uniform float uPress;     // 0..1 eased, while held
uniform vec2  uPressPt;   // ripple origin in disc uv
uniform float uPressAge;  // seconds since tap, <0 = none
uniform float uPx;        // one pixel in uv units, for anti-aliasing

void main() {
  vec2 p = vUv - 0.5;
  float r = length(p);
  float mask = 1.0 - smoothstep(0.5 - 1.5 * uPx, 0.5, r);
  if (mask <= 0.0) discard;

  float t = uTime;
  // cloth: two travelling waves, pinned softly at the hoist (left edge)
  float amp = uAmp * (0.3 + 0.7 * vUv.x) * (1.0 + 0.7 * uHover);
  float ph1 = vUv.x * 6.5 + vUv.y * 2.0 - t * 2.3;
  float ph2 = vUv.x * 11.0 - vUv.y * 3.0 - t * 3.1;
  float w = sin(ph1) + 0.45 * sin(ph2);
  float dw = cos(ph1) + 0.45 * 1.7 * cos(ph2);
  vec2 uv = vUv + vec2(0.006 * w, 0.022 * w) * amp;

  // tap ripple: a ring travelling out from the press point
  float rip = 0.0;
  if (uPressAge >= 0.0) {
    float d = distance(vUv, uPressPt);
    float front = uPressAge * 1.25;
    rip = sin((d - front) * 38.0) * exp(-abs(d - front) * 12.0) * exp(-uPressAge * 2.6);
    uv += normalize(vUv - uPressPt + 1e-4) * rip * 0.025;
  }

  uv = clamp(uv, 0.004, 0.996);
  vec3 col = texture2D(uTex, vec2((uTile + uv.x) * 0.25, uv.y)).rgb;

  // fold lighting from the wave slope, plus the ripple crest
  col *= 1.0 + dw * 0.11 * amp + rip * 0.22;

  // domed plastic: darker toward the rim, lit from the top-left
  float dome = 1.0 - smoothstep(0.18, 0.5, r) * 0.28;
  float key = 0.9 + 0.2 * dot(normalize(vec2(-0.6, 0.8)), p * 2.0);
  col *= dome * key;

  // slow glossy light sweep, each disc out of phase
  float s = fract(t * 0.16 + uTile * 0.17) * 2.6 - 0.8;
  float band = exp(-pow((vUv.x * 0.7 + (1.0 - vUv.y) * 0.3) - s, 2.0) * 120.0);
  col += band * 0.28 * (0.6 + 0.4 * uAmp);

  col *= 1.0 + uHover * 0.12 + uPress * 0.14;
  gl_FragColor = vec4(col * mask, mask);
}`

export type DiscState = {
  hover: number // target 0/1
  press: number // target 0/1
  pressPt: [number, number]
  pressAt: number // performance.now() of last tap, -1 = none
}

type Uniforms = Record<
  'uTex' | 'uTile' | 'uTime' | 'uAmp' | 'uHover' | 'uPress' | 'uPressPt' | 'uPressAge' | 'uPx',
  WebGLUniformLocation | null
>

export class FlagRenderer {
  private gl: WebGLRenderingContext | null = null
  private u: Uniforms | null = null
  private raf = 0
  private last = 0
  private lastDraw = 0
  private t0 = performance.now()
  private eased = FLAG_ORDER.map(() => ({ hover: 0, press: 0 }))
  private atlas: HTMLCanvasElement | null = null
  private disposed = false
  /** frames actually drawn; exposed for perf checks */
  drawn = 0
  readonly states: DiscState[] = FLAG_ORDER.map(() => ({ hover: 0, press: 0, pressPt: [0.5, 0.5], pressAt: -1 }))

  private canvas: HTMLCanvasElement
  private discs: () => (HTMLElement | null)[]
  private reducedMotion: boolean
  private onStatus: (ok: boolean) => void

  constructor(
    canvas: HTMLCanvasElement,
    discs: () => (HTMLElement | null)[],
    reducedMotion: boolean,
    onStatus: (ok: boolean) => void,
  ) {
    this.canvas = canvas
    this.discs = discs
    this.reducedMotion = reducedMotion
    this.onStatus = onStatus
    canvas.addEventListener('webglcontextlost', this.onLost, false)
    canvas.addEventListener('webglcontextrestored', this.onRestored, false)
  }

  async start() {
    try {
      this.atlas = await buildFlagAtlas(512)
    } catch {
      this.onStatus(false)
      return
    }
    if (this.disposed) return
    if (!this.init()) {
      this.onStatus(false)
      return
    }
    this.onStatus(true)
    this.loop(performance.now())
  }

  /** Ask for a frame now (e.g. on resize or a state change in reduced motion). */
  invalidate() {
    if (!this.raf && this.gl && !this.disposed) this.raf = requestAnimationFrame(this.loop)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.canvas.removeEventListener('webglcontextlost', this.onLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored)
    // free the context now rather than waiting for GC (browsers cap live contexts)
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext()
    this.gl = null
  }

  private onLost = (e: Event) => {
    e.preventDefault()
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.gl = null
    this.onStatus(false)
  }

  private onRestored = () => {
    if (this.disposed || !this.init()) return
    this.onStatus(true)
    this.invalidate()
  }

  private init(): boolean {
    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    })
    if (!gl || gl.isContextLost() || !this.atlas) return false
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const tex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.atlas)
    gl.generateMipmap(gl.TEXTURE_2D) // atlas is 2048x512, power of two
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    const names = ['uTex', 'uTile', 'uTime', 'uAmp', 'uHover', 'uPress', 'uPressPt', 'uPressAge', 'uPx'] as const
    this.u = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(prog, n)])) as Uniforms
    gl.uniform1i(this.u.uTex, 0)
    gl.clearColor(0, 0, 0, 0)
    this.gl = gl
    return true
  }

  private loop = (now: number) => {
    this.raf = 0
    const gl = this.gl
    if (!gl || this.disposed) return
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000)
    this.last = now

    // ease hover/press toward their targets
    let busy = false
    const k = 1 - Math.exp(-dt * 14)
    this.states.forEach((s, i) => {
      const e = this.eased[i]
      e.hover += (s.hover - e.hover) * k
      e.press += (s.press - e.press) * k
      if (Math.abs(s.hover - e.hover) > 0.01 || Math.abs(s.press - e.press) > 0.01) busy = true
      if (s.hover || s.press) busy = true
      if (s.pressAt >= 0 && now - s.pressAt < 1600) busy = true
    })

    // 30 fps while idle, full rate while something is happening
    const minGap = busy ? 0 : 1000 / 31
    if (now - this.lastDraw >= minGap) {
      this.lastDraw = now
      this.draw(now)
    }
    if (!this.reducedMotion || busy) this.raf = requestAnimationFrame(this.loop)
  }

  private draw(now: number) {
    const gl = this.gl!
    const u = this.u!
    const canvas = this.canvas
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const box = canvas.getBoundingClientRect()
    const w = Math.max(1, Math.round(box.width * dpr))
    const h = Math.max(1, Math.round(box.height * dpr))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    gl.disable(gl.SCISSOR_TEST)
    gl.viewport(0, 0, w, h)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.SCISSOR_TEST)

    const time = this.reducedMotion ? 2.0 : (now - this.t0) / 1000
    gl.uniform1f(u.uTime, time)
    gl.uniform1f(u.uAmp, this.reducedMotion ? 0 : 1)

    this.discs().forEach((el, i) => {
      if (!el) return
      const r = el.getBoundingClientRect()
      const x = Math.round((r.left - box.left) * dpr)
      const y = Math.round((box.bottom - r.bottom) * dpr) // GL origin is bottom-left
      const dw = Math.round(r.width * dpr)
      const dh = Math.round(r.height * dpr)
      if (dw <= 0 || dh <= 0) return
      gl.viewport(x, y, dw, dh)
      gl.scissor(Math.max(0, x), Math.max(0, y), dw, dh)
      const s = this.states[i]
      const e = this.eased[i]
      gl.uniform1f(u.uTile, i)
      gl.uniform1f(u.uHover, e.hover)
      gl.uniform1f(u.uPress, e.press)
      gl.uniform2f(u.uPressPt, s.pressPt[0], s.pressPt[1])
      gl.uniform1f(u.uPressAge, s.pressAt < 0 || this.reducedMotion ? -1 : (now - s.pressAt) / 1000)
      gl.uniform1f(u.uPx, 1 / Math.max(dw, dh))
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    })
    this.drawn++
  }
}
