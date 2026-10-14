import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { brickGeometry, plastic } from '../../three/bricks'
import { beamMaterial } from '../../three/shaders'
import { Motes, type StaticBrick } from '../../three/common'
import type { V3 } from './rig'

/* ------------------------------------------------------------------ */
/* Soft glow sprites                                                    */
/* ------------------------------------------------------------------ */

let glowTex: THREE.Texture | null = null
function glowTexture() {
  if (glowTex) return glowTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.18, 'rgba(255,255,255,0.65)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.18)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  glowTex = new THREE.CanvasTexture(c)
  glowTex.colorSpace = THREE.SRGBColorSpace
  return glowTex
}

export function glowMaterial(color: string, opacity = 1) {
  return new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  })
}

/** Additive billboard glow (halo, campfire, window light, moon). */
export function Glow({ color, size, position, opacity = 1, depthTest = true }: { color: string; size: number; position?: V3; opacity?: number; depthTest?: boolean }) {
  const mat = useMemo(() => {
    const m = glowMaterial(color, opacity)
    m.depthTest = depthTest
    return m
  }, [color, opacity, depthTest])
  return <sprite material={mat} position={position} scale={[size, size, 1]} />
}

/* ------------------------------------------------------------------ */
/* Divine light: layered beams, a fan of god rays, halo, ground pool    */
/* ------------------------------------------------------------------ */

const groundPoolMat = () =>
  new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ffe3a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })

/**
 * Light from heaven. `level` 0..1 drives the descent (scale from the top) and
 * the brightness; `pulse` adds a gentle breathing while God speaks.
 */
export function GodLight({
  position,
  height = 40,
  level,
  warm = '#ffe7ad',
  rays = 7,
  gain = 1,
}: {
  position: V3
  height?: number
  level: React.MutableRefObject<number>
  warm?: string
  rays?: number
  /** brightness multiplier (daylight needs more) */
  gain?: number
}) {
  const group = useRef<THREE.Group>(null)
  const fan = useRef<THREE.Group>(null)
  const halo = useRef<THREE.Sprite>(null)
  const pool = useRef<THREE.Mesh>(null)
  const sparkle = useRef<THREE.Group>(null)
  const mats = useMemo(
    () => ({
      outer: beamMaterial(warm, 0),
      mid: beamMaterial('#fff4d6', 0),
      core: beamMaterial('#ffffff', 0),
      ray: beamMaterial(warm, 0),
      halo: glowMaterial('#fff1c8', 0),
      pool: groundPoolMat(),
    }),
    [warm],
  )
  const rayDefs = useMemo(
    () =>
      Array.from({ length: rays }, (_, i) => {
        const a = (i / rays) * Math.PI * 2 + 0.3
        return { a, tilt: 0.16 + (i % 3) * 0.07, r: 0.25 + (i % 2) * 0.2 }
      }),
    [rays],
  )
  useFrame((state, dt) => {
    const L = level.current * gain
    const t = state.clock.elapsedTime
    const breathe = 0.88 + Math.sin(t * 2.1) * 0.08 + Math.sin(t * 5.3) * 0.04
    for (const m of [mats.outer, mats.mid, mats.core, mats.ray]) m.uniforms.uTime.value += dt
    mats.outer.uniforms.uIntensity.value = 0.75 * L * breathe
    mats.mid.uniforms.uIntensity.value = 0.9 * L * breathe
    mats.core.uniforms.uIntensity.value = 0.9 * L
    mats.ray.uniforms.uIntensity.value = 0.55 * L * (0.8 + Math.sin(t * 0.9) * 0.2)
    if (group.current) {
      group.current.scale.set(1, Math.max(0.001, Math.min(1, level.current * 1.25)), 1)
      group.current.visible = level.current > 0.01
    }
    if (fan.current) fan.current.rotation.y += dt * 0.05
    mats.halo.opacity = Math.min(1, L * 1.3) * breathe
    if (halo.current) halo.current.scale.setScalar(16 + Math.sin(t * 0.7) * 1.5)
    mats.pool.opacity = Math.max(0, L * 1.4 - 0.4) * 0.8 * breathe
    if (sparkle.current) sparkle.current.visible = L > 0.5
  })
  return (
    <group position={position}>
      {/* pivot at the top so scale.y makes the light come down from heaven */}
      <group ref={group} position={[0, height, 0]}>
        <mesh material={mats.outer} position={[0, -height / 2, 0]}>
          <cylinderGeometry args={[1.2, 2.4, height, 28, 1, true]} />
        </mesh>
        <mesh material={mats.mid} position={[0, -height / 2, 0]}>
          <cylinderGeometry args={[0.7, 1.4, height, 24, 1, true]} />
        </mesh>
        <mesh material={mats.core} position={[0, -height / 2, 0]}>
          <cylinderGeometry args={[0.3, 0.65, height, 16, 1, true]} />
        </mesh>
        <group ref={fan}>
          {rayDefs.map((r, i) => (
            <group key={i} rotation={[Math.sin(r.a) * r.tilt, 0, Math.cos(r.a) * r.tilt]}>
              <mesh material={mats.ray} position={[0, -height * 0.45, 0]}>
                <cylinderGeometry args={[r.r * 0.4, r.r, height * 0.9, 10, 1, true]} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
      <sprite ref={halo} material={mats.halo} position={[0, height * 0.42, 0]} />
      <mesh ref={pool} material={mats.pool} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} scale={[6, 6, 1]}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <group ref={sparkle}>
        <Motes count={110} area={[3.4, 3.4]} height={10} color="#ffe9b0" size={7} rise={0.9} />
        <Motes count={40} area={[1.2, 1.2]} height={7} color="#ffffff" size={9} rise={1.6} />
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Wind-swept grass tufts                                               */
/* ------------------------------------------------------------------ */

function tuftGeometry() {
  // three crossed blades, each a thin triangle, origin at the base
  const pos: number[] = []
  const h: number[] = []
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI
    const cx = Math.cos(a) * 0.07
    const cz = Math.sin(a) * 0.07
    const lean = (i - 1) * 0.05
    pos.push(-cx, 0, -cz, cx, 0, cz, lean, 0.34 + i * 0.04, lean * 0.5)
    h.push(0, 0, 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('aH', new THREE.Float32BufferAttribute(h, 1))
  return g
}

export function grassMaterial(base: string, tip: string, fog: string, near: number, far: number, light = 1) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uWind: { value: 1 },
      uBase: { value: new THREE.Color(base) },
      uTip: { value: new THREE.Color(tip) },
      uFog: { value: new THREE.Color(fog) },
      uNear: { value: near },
      uFar: { value: far },
      uLight: { value: light },
      uGlowPos: { value: new THREE.Vector3(0, 0, 0) },
      uGlow: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aH;
      uniform float uTime, uWind;
      varying float vH;
      varying float vDepth;
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        float sway = sin(uTime * 2.1 + w.x * 0.7 + w.z * 0.45) + 0.5 * sin(uTime * 3.7 + w.x * 1.3);
        w.x += sway * 0.07 * aH * aH * uWind;
        w.z += cos(uTime * 1.7 + w.z * 0.6) * 0.04 * aH * aH * uWind;
        vH = aH;
        vWorld = w.xyz;
        vec4 mv = viewMatrix * w;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase, uTip, uFog, uGlowPos;
      uniform float uNear, uFar, uLight, uGlow;
      varying float vH;
      varying float vDepth;
      varying vec3 vWorld;
      void main() {
        vec3 col = mix(uBase, uTip, vH) * uLight;
        float g = uGlow * smoothstep(3.5, 0.0, length(vWorld.xz - uGlowPos.xz));
        col *= 1.0 + g * (1.0 + vH) * vec3(1.6, 1.4, 0.8);
        gl_FragColor = vec4(mix(col, uFog, smoothstep(uNear, uFar, vDepth)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
}

/** Instanced grass tufts that sway in the wind. `wind` scales the sway. */
export function Grass({
  spots,
  material,
}: {
  spots: { p: V3; s?: number; r?: number }[]
  material: THREE.ShaderMaterial
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => tuftGeometry(), [])
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    spots.forEach((s, i) => {
      o.position.set(...s.p)
      o.rotation.set(0, s.r ?? 0, 0)
      o.scale.setScalar(s.s ?? 1)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [spots])
  useFrame((_, dt) => {
    material.uniforms.uTime.value += dt
  })
  return <instancedMesh ref={ref} args={[geo, material, spots.length]} key={spots.length} />
}

/* ------------------------------------------------------------------ */
/* Holographic "blueprint" bricks                                       */
/* ------------------------------------------------------------------ */

export type HoloUniforms = { uProgress: { value: number }; uOpacity: { value: number }; uTime: { value: number } }
export const makeHoloUniforms = (): HoloUniforms => ({ uProgress: { value: 0 }, uOpacity: { value: 1 }, uTime: { value: 0 } })

function holoMaterial(color: string, u: HoloUniforms) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { ...u, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      attribute float aOrder;
      uniform float uProgress;
      varying float vFres;
      varying float vAppear;
      varying float vY;
      void main() {
        float appear = clamp((uProgress - aOrder) * 14.0, 0.0, 1.0);
        vAppear = appear;
        mat4 m = modelMatrix * instanceMatrix;
        vec4 w = m * vec4(position, 1.0);
        // each brick drops into place from above
        w.y += (1.0 - appear) * (1.0 - appear) * 1.6;
        vec4 mv = viewMatrix * w;
        vec3 n = normalize(mat3(viewMatrix) * mat3(m) * normal);
        vFres = 1.0 - abs(dot(n, normalize(-mv.xyz)));
        vY = position.y + w.x * 0.3;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity, uTime;
      varying float vFres;
      varying float vAppear;
      varying float vY;
      void main() {
        float scan = 0.75 + 0.25 * sin(vY * 34.0 - uTime * 5.0);
        float flash = (1.0 - vAppear) * vAppear * 4.0;
        float a = (0.12 + pow(vFres, 2.0) * 0.9) * scan + flash * 0.6;
        a *= vAppear * uOpacity;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  })
}

export type HoloBrick = StaticBrick & { o: number }

/**
 * Translucent glowing bricks that build themselves as `uProgress` goes 0→1
 * (each brick has an order `o` in 0..1). One draw call per brick shape.
 */
export function HoloBricks({ bricks, uniforms, color = '#8fd8ff' }: { bricks: HoloBrick[]; uniforms: HoloUniforms; color?: string }) {
  const mat = useMemo(() => holoMaterial(color, uniforms), [color, uniforms])
  const groups = useMemo(() => {
    const map = new Map<string, HoloBrick[]>()
    for (const b of bricks) {
      const key = `${b.w}|${b.d}|${b.h ?? 1}|${b.studs ?? true}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(b)
    }
    return [...map.values()].map((list) => {
      const b0 = list[0]
      const geo = brickGeometry(b0.w, b0.d, b0.h ?? 1, b0.studs ?? true).clone()
      geo.setAttribute('aOrder', new THREE.InstancedBufferAttribute(new Float32Array(list.map((b) => b.o)), 1))
      return { geo, list }
    })
  }, [bricks])
  useFrame((_, dt) => {
    uniforms.uTime.value += dt
  })
  return (
    <>
      {groups.map((g, i) => (
        <HoloGroup key={i} geo={g.geo} list={g.list} mat={mat} />
      ))}
    </>
  )
}

function HoloGroup({ geo, list, mat }: { geo: THREE.BufferGeometry; list: HoloBrick[]; mat: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    list.forEach((b, i) => {
      o.position.set(...b.p)
      o.rotation.set(0, b.ry ?? 0, 0)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
    if (m.boundingSphere) m.boundingSphere.radius += 2
  }, [list])
  return <instancedMesh ref={ref} args={[geo, mat, list.length]} />
}

/* ------------------------------------------------------------------ */
/* Brick clouds that can part                                           */
/* ------------------------------------------------------------------ */

type Cluster = { a: number; r: number; y: number; bricks: { w: number; d: number; p: V3; c: string }[] }

/**
 * A ring of flat brick clouds around `center`. `part` 0..1 pushes them
 * outwards so a hole opens over the divine light.
 */
export function PartingClouds({
  center,
  part,
  count = 12,
  radius = 5,
  colors = ['#c8d2f0', '#a9b5dc', '#8e9cc8'],
  emissive = 0.15,
}: {
  center: V3
  part: React.MutableRefObject<number>
  count?: number
  radius?: number
  colors?: string[]
  emissive?: number
}) {
  const clusters = useMemo<Cluster[]>(() => {
    const out: Cluster[] = []
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (i % 2) * 0.2
      const bricks: Cluster['bricks'] = []
      const n = 3 + (i % 3)
      for (let j = 0; j < n; j++) {
        bricks.push({
          w: 4 + ((i + j) % 3) * 2,
          d: 4 + ((i * 3 + j) % 2) * 2,
          p: [(j - n / 2) * 0.9 + Math.sin(i * 7 + j) * 0.4, (j % 2) * 0.32, Math.cos(i * 5 + j * 3) * 0.7],
          c: colors[(i + j) % colors.length],
        })
      }
      out.push({ a, r: radius + (i % 3) * 1.2, y: (i % 4) * 0.5, bricks })
    }
    return out
  }, [count, radius, colors])
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const k = part.current
    clusters.forEach((c, i) => {
      const g = refs.current[i]
      if (!g) return
      const r = c.r * (0.35 + k * 1.1) + Math.sin(t * 0.2 + i) * 0.3
      const a = c.a + t * 0.012
      g.position.set(Math.cos(a) * r, c.y, Math.sin(a) * r)
    })
  })
  return (
    <group position={center}>
      {clusters.map((c, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} rotation={[0, -c.a, 0]}>
          {c.bricks.map((b, j) => (
            <mesh key={j} geometry={brickGeometry(b.w, b.d, 1 / 3, false)} material={plastic(b.c, { emissive })} position={b.p} />
          ))}
        </group>
      ))}
    </group>
  )
}
