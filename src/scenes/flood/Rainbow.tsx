import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BH, brickGeometry, plastic } from '../../three/bricks'
import { confettiMaterial, rainbowGlowMaterial } from './materials'
import { sim, since } from './sim'
import { ARK_REST } from './layout'
import { sfxFlood } from '../../game/audio'

/** Beat on which the rainbow builds (Genesis 9:13). */
export const RAINBOW_BEAT = 12
export const CELEBRATE_BEAT = 13

const S = 2.5 // brick scale
const BAND = BH * S
const R0 = 21
const BANDS = ['#8b4fd8', '#3d5fe0', '#2aa7e8', '#3fbf4a', '#ffd23a', '#ff8a1f', '#e8322f'] // inner violet .. outer red
export const RAINBOW_CENTER = new THREE.Vector3(ARK_REST.x, ARK_REST.y - 6, ARK_REST.z - 34)
const BUILD_TIME = 3.2

type RB = { ang: number; r: number; delay: number; c: string }

/**
 * A giant rainbow built from bricks: seven courses laid around a half circle,
 * studs facing out. Bricks snap in from the left foot to the right, each with
 * a little overshoot, then the matrices are left alone.
 */
export function Rainbow() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const glow = useRef<THREE.Mesh>(null)
  const bricks = useMemo(() => {
    const out: RB[] = []
    BANDS.forEach((c, band) => {
      const r = R0 + band * BAND
      const len = 1.6 * S
      const n = Math.ceil((Math.PI * r) / len)
      for (let i = 0; i < n; i++) {
        // running bond: odd courses shift half a brick
        const k = (i + (band % 2 ? 0.5 : 0.25)) / n
        if (k > 1) continue
        const ang = Math.PI * (1 - k)
        out.push({ ang, r, c, delay: k * BUILD_TIME + band * 0.06 })
      }
    })
    return out
  }, [])
  const mat = useMemo(() => {
    const m = plastic('#ffffff').clone()
    m.fog = false
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        float rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
        gl_FragColor.rgb += rimF * 0.25 + vColor.rgb * 0.35;`,
      )
    }
    m.customProgramCacheKey = () => 'flood-rainbow'
    return m
  }, [])
  const glowMat = useMemo(() => {
    const g = rainbowGlowMaterial()
    g.uniforms.uInner.value = R0
    g.uniforms.uOuter.value = R0 + BANDS.length * BAND
    return g
  }, [])
  const obj = useMemo(() => new THREE.Object3D(), [])
  const col = useMemo(() => new THREE.Color(), [])
  const settled = useRef(false)
  const clicks = useRef(0)

  useEffect(() => {
    const m = ref.current
    if (!m) return
    bricks.forEach((b, i) => {
      m.setColorAt(i, col.set(b.c))
      obj.scale.setScalar(0)
      obj.updateMatrix()
      m.setMatrixAt(i, obj.matrix)
    })
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.instanceMatrix.needsUpdate = true
  }, [bricks, col, obj])

  useFrame(() => {
    const m = ref.current
    if (!m) return
    const t = since(RAINBOW_BEAT)
    m.visible = t >= 0
    if (glow.current) glow.current.visible = t >= 0
    if (t < 0) {
      settled.current = false
      clicks.current = 0
      return
    }
    glowMat.uniforms.uReveal.value = Math.min(1, t / (BUILD_TIME + 0.6))
    if (settled.current) return
    let done = true
    for (let i = 0; i < bricks.length; i++) {
      const b = bricks[i]
      const k = THREE.MathUtils.clamp((t - b.delay) / 0.45, 0, 1)
      if (k < 1) done = false
      // back-out overshoot, dropping in from slightly further out
      const e = k === 0 ? 0 : 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2)
      const r = b.r + (1 - k) * 3
      obj.position.set(RAINBOW_CENTER.x + Math.cos(b.ang) * r, RAINBOW_CENTER.y + Math.sin(b.ang) * r, RAINBOW_CENTER.z)
      // brick "up" points away from the centre, its length runs along the arc
      obj.rotation.set(0, 0, b.ang - Math.PI / 2)
      obj.scale.setScalar(S * e)
      obj.updateMatrix()
      m.setMatrixAt(i, obj.matrix)
    }
    m.instanceMatrix.needsUpdate = true
    // a soft click every few bricks as the arc builds
    const step = Math.floor(Math.min(t, BUILD_TIME) / 0.16)
    if (step > clicks.current) {
      clicks.current = step
      sfxFlood.click(1 + step * 0.02)
    }
    if (done) settled.current = true
  })

  return (
    <>
      <mesh ref={glow} material={glowMat} position={RAINBOW_CENTER} visible={false} frustumCulled={false} renderOrder={-0.5}>
        <ringGeometry args={[R0 - 3, R0 + BANDS.length * BAND + 3, 96, 1, 0, Math.PI]} />
      </mesh>
      <instancedMesh ref={ref} args={[brickGeometry(4, 2), mat, bricks.length]} frustumCulled={false} visible={false} />
    </>
  )
}

const CONFETTI = 480
const CONFETTI_COLORS = ['#e8322f', '#ffd23a', '#3fbf4a', '#2aa7e8', '#8b4fd8', '#ff8a1f', '#ffffff', '#ff6fa8']

/** Brick confetti cannons around the family, firing in a loop once the celebration starts. */
export function Confetti({ origin }: { origin: THREE.Vector3 }) {
  const ref = useRef<THREE.Points>(null)
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(CONFETTI * 3)
    const vel = new Float32Array(CONFETTI * 3)
    const colr = new Float32Array(CONFETTI * 3)
    const seed = new Float32Array(CONFETTI)
    const c = new THREE.Color()
    const cannons = [-5, 0, 5]
    let r = 21
    const rnd = () => {
      r = (r * 16807) % 2147483647
      return r / 2147483647
    }
    for (let i = 0; i < CONFETTI; i++) {
      const cx = cannons[i % 3]
      pos[i * 3] = cx
      pos[i * 3 + 1] = 0.5
      pos[i * 3 + 2] = 0
      const a = rnd() * Math.PI * 2
      const sp = 1.5 + rnd() * 3
      vel[i * 3] = Math.cos(a) * sp - cx * 0.15
      vel[i * 3 + 1] = 7 + rnd() * 6
      vel[i * 3 + 2] = Math.sin(a) * sp
      c.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length])
      colr[i * 3] = c.r
      colr[i * 3 + 1] = c.g
      colr[i * 3 + 2] = c.b
      seed[i] = rnd()
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3))
    g.setAttribute('aColor', new THREE.BufferAttribute(colr, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    return g
  }, [])
  const mat = useMemo(() => confettiMaterial(), [])
  useFrame((state) => {
    const t = since(CELEBRATE_BEAT)
    if (ref.current) ref.current.visible = t >= 0
    mat.uniforms.uTime.value = sim.t
    mat.uniforms.uStart.value = t >= 0 ? sim.reached[CELEBRATE_BEAT] : 1e6
    mat.uniforms.uPixelRatio.value = state.gl.getPixelRatio()
  })
  return <points ref={ref} geometry={geo} material={mat} position={origin} frustumCulled={false} visible={false} />
}
